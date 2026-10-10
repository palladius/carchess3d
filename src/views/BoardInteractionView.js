/**
 * @fileoverview 3D Board Raycasting & Tactical Indicator View (`BoardInteractionView`).
 *
 * Handles:
 * - Mouse / Pointer / Touch raycasting against `swampView.squareMeshes`,
 *   `pieceView.getAllPieceObjects()`, and the `y = 0` mathematical board plane
 *   (so clicks/taps on any square or piece always resolve cleanly).
 * - Distinguishes camera orbit drags from intentional square taps (`<= 8px` threshold).
 * - Renders 3D tactical board indicators at `y = 0.015m`:
 *   1. Selected piece square: glowing golden ring (`0xffd54f`).
 *   2. Legal empty target squares: **pulsing yellow circles** (`0xffeb3b`).
 *   3. Legal capture target squares: **rotating red segmented target rings** (`0xff3d00`).
 *   4. King in Check (`CHECK_DETECTED`): **pulsing crimson-red check aura** (`0xff1744`).
 *   5. Hint move (`HINT_SUGGESTED`): sparkling cyan-gold 3D arrow & trail between `from` and `to`.
 */

import * as THREE from 'three';
import { squareToWorld, worldToSquare } from '../core/Registry.js';

const INDICATOR_Y = 0.015;

export class BoardInteractionView {
  /**
   * @param {object} [opts]
   */
  constructor(opts = {}) {
    this.scene = null;
    this.camera = null;
    this.domElement = null;
    this.swampView = null;
    this.pieceView = null;
    this.ctx = null;

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'BoardInteractionIndicators';

    this.selectionGroup = new THREE.Group();
    this.legalMovesGroup = new THREE.Group();
    this.checkGroup = new THREE.Group();
    this.hintGroup = new THREE.Group();
    this.rootGroup.add(
      this.selectionGroup,
      this.legalMovesGroup,
      this.checkGroup,
      this.hintGroup,
    );

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.planeHit = new THREE.Vector3();

    /** @type {Array<THREE.Object3D>} */
    this.pulsingCircles = [];
    /** @type {Array<THREE.Object3D>} */
    this.rotatingCaptureRings = [];
    /** @type {THREE.Object3D|null} */
    this.checkAuraMesh = null;
    /** @type {THREE.Object3D|null} */
    this.selectedRingMesh = null;

    this.elapsedTime = 0;
    this.pointerDownPos = { x: 0, y: 0, active: false };
    this.offs = [];
    this._boundPointerDown = (e) => this.onPointerDown(e);
    this._boundPointerUp = (e) => this.onPointerUp(e);

    this._applyOpts(opts);
  }

  _applyOpts(opts = {}) {
    if (!opts || typeof opts !== 'object') return;
    this.scene = opts.scene || this.scene;
    this.camera = opts.camera || this.camera;
    this.domElement = opts.domElement || opts.renderer?.domElement || this.domElement;
    this.swampView = opts.swampView || this.swampView;
    this.pieceView = opts.pieceView || this.pieceView;
    this.ctx = opts.ctx || (opts.bus ? opts : this.ctx);

    if (this.scene && !this.rootGroup.parent) {
      this.scene.add(this.rootGroup);
    }
  }

  /**
   * Initializes DOM pointer listeners and `GameEventBus` subscriptions.
   * @param {object} [optsOrCtx]
   */
  init(optsOrCtx = {}) {
    this._applyOpts(optsOrCtx);

    if (this.domElement && typeof this.domElement.addEventListener === 'function') {
      this.domElement.addEventListener('pointerdown', this._boundPointerDown);
      this.domElement.addEventListener('pointerup', this._boundPointerUp);
    }

    const bus = this.ctx?.bus;
    if (bus) {
      this.offs.push(
        bus.on('PIECE_SELECTED', (e) => {
          this.renderSelectionAndLegalMoves(e.square, e.legalMoves || []);
        }),
        bus.on('SELECTION_CLEARED', () => {
          this.clearSelectionIndicators();
        }),
        bus.on('MOVE_EXECUTED', () => {
          this.clearSelectionIndicators();
          this.clearHintIndicator();
          if (!this.ctx?.board?.inCheck?.()) {
            this.clearCheckIndicator();
          }
        }),
        bus.on('CHECK_DETECTED', (e) => {
          this.renderCheckIndicator(e.kingSquare);
        }),
        bus.on('HINT_SUGGESTED', (e) => {
          this.renderHintIndicator(e.from, e.to);
        }),
        bus.on('BOARD_RESET', () => {
          this.clearSelectionIndicators();
          this.clearCheckIndicator();
          this.clearHintIndicator();
        }),
      );
    }
  }

  onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this.pointerDownPos = {
      x: event.clientX,
      y: event.clientY,
      active: true,
    };
  }

  onPointerUp(event) {
    if (!this.pointerDownPos.active) return;
    this.pointerDownPos.active = false;

    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    if (Math.hypot(dx, dy) > 8) {
      // Ignore camera orbit drags
      return;
    }

    const square = this.pickSquareFromPointerEvent(event);
    if (square) {
      this.handleSquareTap(square);
    }
  }

  /**
   * Raycasts against `pieceView.getAllPieceObjects()`, `swampView.squareMeshes`,
   * and the `y = 0` board plane to resolve an algebraic square (`'a1'..'h8'`).
   * @param {PointerEvent|MouseEvent} event
   * @returns {string|null}
   */
  pickSquareFromPointerEvent(event) {
    if (!this.camera || !this.domElement) return null;
    const rect = this.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    // 1. Check 3D pieces first so clicking the top of a tall piece selects its square
    const pieceObjects = this.pieceView?.getAllPieceObjects?.() || [];
    if (pieceObjects.length > 0) {
      const pieceHits = this.raycaster.intersectObjects(pieceObjects, true);
      for (const hit of pieceHits) {
        const sq = hit.object?.userData?.square || hit.object?.userData?.pieceRoot?.userData?.square;
        if (sq) return sq;
      }
    }

    // 2. Check SwampBoardView square meshes
    const squareMeshes = this.swampView?.squareMeshes || [];
    if (squareMeshes.length > 0) {
      const tileHits = this.raycaster.intersectObjects(squareMeshes, true);
      for (const hit of tileHits) {
        const sq = hit.object?.userData?.square || hit.object?.parent?.userData?.square;
        if (sq) return sq;
      }
    }

    // 3. Fallback: intersect y = 0 altar plane directly
    if (this.raycaster.ray.intersectPlane(this.boardPlane, this.planeHit)) {
      return worldToSquare(this.planeHit.x, this.planeHit.z);
    }
    return null;
  }

  /**
   * Processes an intentional click/tap on an algebraic square (`'a1'..'h8'`).
   * @param {string} square
   */
  handleSquareTap(square) {
    const board = this.ctx?.board;
    const flow = this.ctx?.flow;
    const ai = this.ctx?.ai;
    if (!board) return;

    // Do not allow board moves during cutscenes, Mode 2 WOW Arena, or after game over
    const flowState = flow?.state?.();
    if (flowState && flowState !== 'Mode1_Chess' && flowState !== 'Boot') {
      return;
    }
    if (board.isGameOver?.()) return;

    // If CPU controls the active turn, block human move execution
    if (ai?.enabled && board.turn() === ai.cpuColor) {
      return;
    }

    const currentSelected = board.selectedSquare;
    if (currentSelected) {
      if (currentSelected === square) {
        board.clearSelection();
        this.ctx?.bus?.flush?.();
        return;
      }

      const legalFromSelected = board.legalMovesFrom(currentSelected);
      const isLegalTarget = legalFromSelected.some((m) => m.to === square);
      if (isLegalTarget) {
        board.requestMove(currentSelected, square);
        this.ctx?.bus?.flush?.();
        return;
      }
    }

    const clickedPiece = board.pieceAt(square);
    if (clickedPiece && clickedPiece.color === board.turn()) {
      board.selectSquare(square);
      // Trigger subtle emote/idle on Bishop Ale or selected piece if clicked
      if (clickedPiece.type === 'b') {
        const obj = this.pieceView?.getPieceObject?.(square);
        if (obj) this.pieceView?.playClip?.(obj, 'Idle_Track');
      }
      this.ctx?.bus?.flush?.();
    } else {
      board.clearSelection();
      this.ctx?.bus?.flush?.();
    }
  }

  /**
   * Renders the glowing golden selection ring (`0xffd54f`) and legal target indicators at `y = 0.015m`:
   * - Legal empty target squares -> **pulsing yellow circles** (`0xffeb3b`)
   * - Legal capture target squares -> **rotating red segmented target rings** (`0xff3d00`)
   * @param {string} selectedSquare
   * @param {Array<object>} legalMoves
   */
  renderSelectionAndLegalMoves(selectedSquare, legalMoves = []) {
    this.clearSelectionIndicators();
    if (!selectedSquare) return;

    // 1. Selected square glowing golden ring
    const selPos = squareToWorld(selectedSquare);
    const selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.46, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffd54f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      }),
    );
    selRing.rotation.x = -Math.PI * 0.5;
    selRing.position.set(selPos.x, INDICATOR_Y, selPos.z);
    selRing.name = `SelectedSquareRing_${selectedSquare}`;
    this.selectionGroup.add(selRing);
    this.selectedRingMesh = selRing;

    // Deduplicate target squares (e.g. 4 promotion options on same target square)
    const seenTargets = new Map();
    for (const move of legalMoves) {
      if (!seenTargets.has(move.to)) {
        seenTargets.set(move.to, move);
      }
    }

    // 2. Legal move targets
    for (const [targetSq, move] of seenTargets.entries()) {
      const pos = squareToWorld(targetSq);
      const isCapture = Boolean(
        move.captured ||
        (typeof move.flags === 'string' && (move.flags.includes('c') || move.flags.includes('e'))),
      );

      if (isCapture) {
        // Rotating red segmented target ring (0xff3d00)
        const capRing = this.buildSegmentedCaptureRing(targetSq);
        capRing.position.set(pos.x, INDICATOR_Y + 0.012, pos.z);
        this.legalMovesGroup.add(capRing);
        this.rotatingCaptureRings.push(capRing);
      } else {
        // Pulsing colored legal-move dot (glowing emerald-gold core + bright yellow halo ring)
        const circleGroup = new THREE.Group();
        circleGroup.name = `LegalMoveCircle_${targetSq}`;
        circleGroup.position.set(pos.x, INDICATOR_Y + 0.008, pos.z);

        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(0.21, 32),
          new THREE.MeshBasicMaterial({
            color: 0x00e676,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92,
          }),
        );
        disc.rotation.x = -Math.PI * 0.5;

        const innerDot = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 16, 12),
          new THREE.MeshBasicMaterial({
            color: 0xffee58,
            transparent: true,
            opacity: 0.96,
          }),
        );
        innerDot.scale.set(1, 0.38, 1);
        innerDot.position.y = 0.02;

        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.23, 0.31, 32),
          new THREE.MeshBasicMaterial({
            color: 0xffeb3b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
          }),
        );
        halo.rotation.x = -Math.PI * 0.5;

        circleGroup.add(disc, innerDot, halo);
        this.legalMovesGroup.add(circleGroup);
        this.pulsingCircles.push(circleGroup);
      }
    }
  }

  /**
   * Builds a rotating red segmented target reticle (`0xff3d00`) for capture squares.
   */
  buildSegmentedCaptureRing(square) {
    const group = new THREE.Group();
    group.name = `CaptureTargetRing_${square}`;

    const segMat = new THREE.MeshBasicMaterial({
      color: 0xff3d00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });

    // 4 segmented arcs around the target piece pedestal
    const segmentCount = 4;
    const arcSpan = Math.PI * 0.34;
    for (let i = 0; i < segmentCount; i++) {
      const thetaStart = i * (Math.PI * 0.5) + 0.12;
      const seg = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.46, 16, 1, thetaStart, arcSpan),
        segMat,
      );
      seg.rotation.x = -Math.PI * 0.5;
      group.add(seg);
    }

    // Inner subtle danger ring
    const inner = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.30, 28),
      new THREE.MeshBasicMaterial({
        color: 0xff8a65,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      }),
    );
    inner.rotation.x = -Math.PI * 0.5;
    group.add(inner);

    return group;
  }

  /**
   * Renders a pulsing crimson-red check aura under the endangered King's square (`CHECK_DETECTED`).
   * @param {string} kingSquare
   */
  renderCheckIndicator(kingSquare) {
    this.clearCheckIndicator();
    if (!kingSquare) return;

    const pos = squareToWorld(kingSquare);
    const auraGroup = new THREE.Group();
    auraGroup.name = `KingCheckAura_${kingSquare}`;
    auraGroup.position.set(pos.x, INDICATOR_Y + 0.004, pos.z);

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.49, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff1744,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    outerRing.rotation.x = -Math.PI * 0.5;

    const innerGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.44, 32),
      new THREE.MeshBasicMaterial({
        color: 0xd50000,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      }),
    );
    innerGlow.rotation.x = -Math.PI * 0.5;

    auraGroup.add(innerGlow, outerRing);
    this.checkGroup.add(auraGroup);
    this.checkAuraMesh = auraGroup;
  }

  /**
   * Renders a sparkling cyan-gold 3D arrow/trail between `from` and `to` (`HINT_SUGGESTED`).
   * @param {string} fromSquare
   * @param {string} toSquare
   */
  renderHintIndicator(fromSquare, toSquare) {
    this.clearHintIndicator();
    if (!fromSquare || !toSquare) return;

    const start = squareToWorld(fromSquare);
    const end = squareToWorld(toSquare);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const dist = Math.max(0.1, Math.hypot(dx, dz));
    const angleY = Math.atan2(dx, dz);

    const arrowGroup = new THREE.Group();
    arrowGroup.name = `HintArrow_${fromSquare}_${toSquare}`;

    const cyanMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const goldMat = new THREE.MeshBasicMaterial({
      color: 0xffd54f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });

    // Origin & destination rings
    for (const [pt, mat] of [[start, goldMat], [end, cyanMat]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.30, 0.42, 28), mat);
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.set(pt.x, INDICATOR_Y + 0.008, pt.z);
      arrowGroup.add(ring);
    }

    // Shaft + arrowhead between `from` and `to`
    const shaftLen = Math.max(0.1, dist - 0.35);
    const shaft = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, shaftLen),
      cyanMat,
    );
    shaft.rotation.order = 'YXZ';
    shaft.rotation.y = angleY;
    shaft.rotation.x = -Math.PI * 0.5;
    shaft.position.set(
      start.x + dx * 0.45,
      INDICATOR_Y + 0.01,
      start.z + dz * 0.45,
    );
    arrowGroup.add(shaft);

    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.20, 0.32, 16),
      goldMat,
    );
    head.rotation.order = 'YXZ';
    head.rotation.y = angleY;
    head.rotation.x = Math.PI * 0.5;
    head.position.set(
      end.x - (dx / dist) * 0.18,
      INDICATOR_Y + 0.04,
      end.z - (dz / dist) * 0.18,
    );
    arrowGroup.add(head);

    this.hintGroup.add(arrowGroup);
  }

  clearSelectionIndicators() {
    this.pulsingCircles = [];
    this.rotatingCaptureRings = [];
    this.selectedRingMesh = null;
    while (this.selectionGroup.children.length > 0) {
      this.selectionGroup.remove(this.selectionGroup.children[0]);
    }
    while (this.legalMovesGroup.children.length > 0) {
      this.legalMovesGroup.remove(this.legalMovesGroup.children[0]);
    }
  }

  clearCheckIndicator() {
    this.checkAuraMesh = null;
    while (this.checkGroup.children.length > 0) {
      this.checkGroup.remove(this.checkGroup.children[0]);
    }
  }

  clearHintIndicator() {
    while (this.hintGroup.children.length > 0) {
      this.hintGroup.remove(this.hintGroup.children[0]);
    }
  }

  /**
   * Animates pulsing yellow legal circles, rotating red capture reticles,
   * and pulsing crimson King-in-Check aura.
   * @param {number} dt
   */
  update(dt = 1 / 60) {
    this.elapsedTime += dt;
    const t = this.elapsedTime;

    // Pulse yellow legal move circles
    const pulseScale = 1.0 + 0.15 * Math.sin(t * 5.2);
    for (let i = 0; i < this.pulsingCircles.length; i++) {
      const circle = this.pulsingCircles[i];
      const phase = t * 5.2 + i * 0.4;
      const s = 1.0 + 0.15 * Math.sin(phase);
      circle.scale.set(s, 1, s);
    }

    // Rotate red segmented capture target rings
    for (const ring of this.rotatingCaptureRings) {
      ring.rotation.y += dt * 2.4;
      const s = 1.0 + 0.06 * Math.sin(t * 6.0);
      ring.scale.set(s, 1, s);
    }

    // Pulse selected ring subtly
    if (this.selectedRingMesh) {
      const s = 1.0 + 0.04 * Math.sin(t * 4.0);
      this.selectedRingMesh.scale.set(s, s, 1);
    }

    // Pulse crimson King-in-Check aura
    if (this.checkAuraMesh) {
      const s = 1.0 + 0.16 * Math.sin(t * 8.0);
      this.checkAuraMesh.scale.set(s, 1, s);
    }
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
    if (this.domElement && typeof this.domElement.removeEventListener === 'function') {
      this.domElement.removeEventListener('pointerdown', this._boundPointerDown);
      this.domElement.removeEventListener('pointerup', this._boundPointerUp);
    }
    this.clearSelectionIndicators();
    this.clearCheckIndicator();
    this.clearHintIndicator();
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
