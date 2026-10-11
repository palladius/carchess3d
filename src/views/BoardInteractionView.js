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
import {
  CHARACTER_REGISTRY,
  BATTLE_MATRIX,
  squareToWorld,
  worldToSquare,
} from '../core/Registry.js';

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
    this.hoverPreviewGroup = new THREE.Group();
    this.hoverPreviewGroup.name = 'CapturePreviewHoverGroup';
    this.checkGroup = new THREE.Group();
    this.hintGroup = new THREE.Group();
    this.rootGroup.add(
      this.selectionGroup,
      this.legalMovesGroup,
      this.hoverPreviewGroup,
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
    /** @type {THREE.Object3D|null} */
    this.hoverRingMesh = null;

    /** @type {string|null} */
    this.hoveredSquare = null;
    /** @type {Map<string, object>} */
    this.captureTargetsBySquare = new Map();
    /** @type {Map<string, object>} */
    this.legalTargetsBySquare = new Map();

    this.elapsedTime = 0;
    this.pointerDownPos = { x: 0, y: 0, active: false };
    this.offs = [];
    this._boundPointerDown = (e) => this.onPointerDown(e);
    this._boundPointerUp = (e) => this.onPointerUp(e);
    this._boundPointerMove = (e) => this.onPointerMove(e);

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
    this._installTrackpadWheelFix();
  }

  /**
   * Ensures `OrbitControls._customWheelEvent` preserves `deltaX` and modifier keys (`ctrlKey`,
   * `metaKey`, `altKey`, `shiftKey`) so Mac Trackpad 2-finger rotate and pinch-zoom (`#13`)
   * never produce `NaN` camera coordinates.
   */
  _installTrackpadWheelFix() {
    const controls = this.ctx?.controls;
    if (!controls) return;

    controls._customWheelEvent = function (event) {
      const mode = event.deltaMode;
      let dx = Number(event.deltaX) || 0;
      let dy = Number(event.deltaY) || 0;
      if (mode === 1) {
        dx *= 16;
        dy *= 16;
      } else if (mode === 2) {
        dx *= 100;
        dy *= 100;
      }
      if (event.ctrlKey && !this._controlActive) {
        dy *= 10;
      }
      return {
        clientX: Number(event.clientX) || 0,
        clientY: Number(event.clientY) || 0,
        deltaX: dx,
        deltaY: dy,
        ctrlKey: Boolean(event.ctrlKey),
        metaKey: Boolean(event.metaKey),
        altKey: Boolean(event.altKey),
        shiftKey: Boolean(event.shiftKey),
      };
    };

    controls._handleMouseWheel = function (event) {
      const cx = Number(event.clientX) || 0;
      const cy = Number(event.clientY) || 0;
      const dx = Number(event.deltaX) || 0;
      const dy = Number(event.deltaY) || 0;
      this._updateZoomParameters(cx, cy);
      const isPinchOrZoomMod =
        Boolean(event.ctrlKey || event.metaKey || event.altKey) || !this.trackpadTwoFingerRotate;
      if (isPinchOrZoomMod) {
        const pinchScale = Math.pow(
          0.95,
          this.zoomSpeed * Math.min(8.0, Math.abs(dy) * 0.025 + 0.35),
        );
        if (dy < 0) {
          this._dollyIn(pinchScale);
        } else if (dy > 0) {
          this._dollyOut(pinchScale);
        }
      } else if (event.shiftKey) {
        this._pan(-dx * 0.65, -dy * 0.65);
      } else {
        const h = Math.max(1, this.domElement?.clientHeight || window.innerHeight || 800);
        const twoPi = Math.PI * 2;
        this._rotateLeft((twoPi * dx * this.rotateSpeed * 0.85) / h);
        this._rotateUp((twoPi * dy * this.rotateSpeed * 0.85) / h);
      }
      this.update();
    };
  }

  /**
   * Initializes DOM pointer listeners and `GameEventBus` subscriptions.
   * @param {object} [optsOrCtx]
   */
  init(optsOrCtx = {}) {
    this._applyOpts(optsOrCtx);

    if (!this._boundPointerCancel) {
      this._boundPointerCancel = (e) => {
        if (this.activePointers && e?.pointerId !== undefined) {
          this.activePointers.delete(e.pointerId);
        }
        this.pointerDownPos.active = false;
      };
    }
    if (this.domElement && typeof this.domElement.addEventListener === 'function') {
      this.domElement.addEventListener('pointerdown', this._boundPointerDown);
      this.domElement.addEventListener('pointerup', this._boundPointerUp);
      this.domElement.addEventListener('pointermove', this._boundPointerMove);
      this.domElement.addEventListener('pointercancel', this._boundPointerCancel);
    }

    const bus = this.ctx?.bus;
    if (bus) {
      this.offs.push(
        bus.on('PIECE_SELECTED', (e) => {
          this.renderSelectionAndLegalMoves(e.square, e.legalMoves || [], e.piece || null);
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
    if (!this.activePointers) this.activePointers = new Set();
    if (event.pointerId !== undefined) {
      this.activePointers.add(event.pointerId);
    }
    if (this.activePointers.size > 1) {
      this.pointerDownPos.multiTouch = true;
      this.pointerDownPos.active = false;
      return;
    }
    this.pointerDownPos = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      multiTouch: false,
      active: true,
    };
  }

  onPointerUp(event) {
    if (this.activePointers && event.pointerId !== undefined) {
      this.activePointers.delete(event.pointerId);
    }
    if (!this.pointerDownPos.active || this.pointerDownPos.multiTouch) {
      this.pointerDownPos.active = false;
      return;
    }
    this.pointerDownPos.active = false;

    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    const maxTapDist = event.pointerType === 'touch' ? 18 : 8;
    if (Math.hypot(dx, dy) > maxTapDist) {
      // Ignore camera orbit drags
      return;
    }

    const square = this.pickSquareFromPointerEvent(event);
    if (square) {
      this.handleSquareTap(square);
    }
  }

  /**
   * Handles pointer hover over the 3D board to preview legal captures and moves (`#16`).
   * Emits `CAPTURE_PREVIEW_HOVER` and renders a floating 3D ring glow on the hovered capture square.
   * @param {PointerEvent|MouseEvent} event
   */
  onPointerMove(event) {
    if (this.pointerDownPos.active) return;
    const board = this.ctx?.board;
    if (!board) return;

    const sq = this.pickSquareFromPointerEvent(event);
    const hoveredPiece = sq ? board.pieceAt?.(sq) : null;
    this.pieceView?.setHoveredSquare?.(hoveredPiece ? sq : null);

    // Emit PIECE_HOVERED when pointer enters a living piece (with per-type anti-spam cooldown for pawn rows)
    const pieceSq = hoveredPiece ? sq : null;
    if (pieceSq !== this.hoveredPieceSquare) {
      this.hoveredPieceSquare = pieceSq;
      if (hoveredPiece && pieceSq) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const pType = String(hoveredPiece.type || 'p').toLowerCase();
        if (!this.lastHoverByTypeMs) this.lastHoverByTypeMs = new Map();
        const lastTypeMs = this.lastHoverByTypeMs.get(pType) || 0;
        const typeCooldownMs = pType === 'p' ? 2800 : 950;
        if (
          (!this.lastHoverEmitMs || now - this.lastHoverEmitMs >= 750) &&
          (!lastTypeMs || now - lastTypeMs >= typeCooldownMs)
        ) {
          this.lastHoverEmitMs = now;
          this.lastHoverByTypeMs.set(pType, now);
          this.ctx?.bus?.emit?.({
            type: 'PIECE_HOVERED',
            square: pieceSq,
            piece: hoveredPiece,
            pieceType: hoveredPiece.type,
            color: hoveredPiece.color,
          });
          this.ctx?.bus?.flush?.();
        }
      }
    }

    if (!board.selectedSquare) {
      if (this.hoveredSquare) {
        this.hoveredSquare = null;
        this.clearHoverPreview();
      }
      return;
    }

    if (sq === this.hoveredSquare) return;
    this.hoveredSquare = sq;

    if (sq && this.captureTargetsBySquare.has(sq)) {
      const cap = this.captureTargetsBySquare.get(sq);
      this.renderCaptureHoverPreview(sq, cap.attacker, cap.defender);
      this.emitCapturePreviewHover(cap, 'hover');
      this.ctx?.bus?.flush?.();
    } else if (sq && this.legalTargetsBySquare.has(sq)) {
      this.renderMoveHoverPreview(sq);
    } else if (this.captureTargetsBySquare.size > 0) {
      // Keep the primary capture target glowing when pointer is not on another target
      const firstCap = this.captureTargetsBySquare.values().next().value;
      if (firstCap) {
        this.renderCaptureHoverPreview(firstCap.to, firstCap.attacker, firstCap.defender);
      }
    } else {
      this.clearHoverPreview();
    }
  }

  /**
   * Emits `CAPTURE_PREVIEW_HOVER` with rich 6x6 matchup info and toast message.
   * @param {object} cap
   * @param {'selection'|'hover'} [source]
   */
  emitCapturePreviewHover(cap, source = 'hover') {
    if (!cap) return;
    const atkChar = CHARACTER_REGISTRY[cap.attacker] || CHARACTER_REGISTRY.p;
    const defChar = CHARACTER_REGISTRY[cap.defender] || CHARACTER_REGISTRY.p;
    const pairEntry = BATTLE_MATRIX?.[cap.attacker]?.[cap.defender] || null;
    const pairCode = `${String(cap.attacker).toUpperCase()}×${String(cap.defender).toUpperCase()}`;
    const toastTextEn = `⚔️ Possible capture: ${atkChar.glyph} ${atkChar.name} vs ${defChar.glyph} ${defChar.name} (${pairCode}) — Click for 3D Brawl!`;
    const toastTextIt = `⚔️ Cattura possibile: ${atkChar.glyph} ${atkChar.name} vs ${defChar.glyph} ${defChar.name} (${pairCode}) — Clicca per la Scazzottata 3D!`;

    this.ctx?.bus?.emit?.({
      type: 'CAPTURE_PREVIEW_HOVER',
      from: cap.from,
      to: cap.to,
      square: cap.to,
      attacker: cap.attacker,
      defender: cap.defender,
      attackerName: atkChar.name,
      defenderName: defChar.name,
      attackerGlyph: atkChar.glyph,
      defenderGlyph: defChar.glyph,
      pairCode,
      banner: pairEntry?.banner || null,
      videoUrl: `assets/battles/videos/${cap.attacker}_x_${cap.defender}.mp4`,
      toastText: toastTextEn,
      toastTextEn,
      toastTextIt,
      source,
    });
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
    if (ai?.isCpuTurn?.()) {
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
   * - Legal empty target squares -> **pulsing emerald-yellow 3D dots** (`0x00e676` + `0xffeb3b`)
   * - Legal capture target squares -> **rotating red segmented target rings** (`0xff3d00`) + floating 3D glow
   * @param {string} selectedSquare
   * @param {Array<object>} legalMoves
   * @param {object|null} [selectedPiece]
   */
  renderSelectionAndLegalMoves(selectedSquare, legalMoves = [], selectedPiece = null) {
    this.clearSelectionIndicators();
    if (!selectedSquare) return;

    const boardPiece = selectedPiece || this.ctx?.board?.pieceAt?.(selectedSquare) || null;
    const attackerType = boardPiece?.type || 'p';
    const atkChar = CHARACTER_REGISTRY[attackerType] || CHARACTER_REGISTRY.p;

    // 1. Selected square glowing golden ring
    const selPos = squareToWorld(selectedSquare);
    const selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.46, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffd54f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.94,
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
      this.legalTargetsBySquare.set(targetSq, move);

      const targetBoardPiece = this.ctx?.board?.pieceAt?.(targetSq) || null;
      const isCapture = Boolean(
        move.captured ||
        (typeof move.flags === 'string' && (move.flags.includes('c') || move.flags.includes('e'))) ||
        (targetBoardPiece && boardPiece && targetBoardPiece.color !== boardPiece.color),
      );

      if (isCapture) {
        const defenderType = move.captured || targetBoardPiece?.type || 'p';
        const defChar = CHARACTER_REGISTRY[defenderType] || CHARACTER_REGISTRY.p;
        const capInfo = {
          from: selectedSquare,
          to: targetSq,
          attacker: attackerType,
          defender: defenderType,
          attackerName: atkChar.name,
          defenderName: defChar.name,
          move,
        };
        this.captureTargetsBySquare.set(targetSq, capInfo);

        // Rotating red segmented target ring (0xff3d00) + elevated danger crown
        const capRing = this.buildSegmentedCaptureRing(targetSq, attackerType, defenderType);
        capRing.position.set(pos.x, INDICATOR_Y + 0.012, pos.z);
        this.legalMovesGroup.add(capRing);
        this.rotatingCaptureRings.push(capRing);
      } else {
        // Pulsing colored legal-move dot (glowing emerald-gold core + bright yellow halo ring)
        const circleGroup = new THREE.Group();
        circleGroup.name = `LegalMoveCircle_${targetSq}`;
        circleGroup.userData = { square: targetSq, isCapture: false };
        circleGroup.position.set(pos.x, INDICATOR_Y + 0.008, pos.z);

        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(0.22, 32),
          new THREE.MeshBasicMaterial({
            color: 0x00e676,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.94,
          }),
        );
        disc.rotation.x = -Math.PI * 0.5;

        const innerDot = new THREE.Mesh(
          new THREE.SphereGeometry(0.115, 16, 12),
          new THREE.MeshBasicMaterial({
            color: 0xffee58,
            transparent: true,
            opacity: 0.98,
          }),
        );
        innerDot.scale.set(1, 0.42, 1);
        innerDot.position.y = 0.022;

        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.24, 0.32, 32),
          new THREE.MeshBasicMaterial({
            color: 0xffeb3b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.88,
          }),
        );
        halo.rotation.x = -Math.PI * 0.5;

        circleGroup.add(disc, innerDot, halo);
        this.legalMovesGroup.add(circleGroup);
        this.pulsingCircles.push(circleGroup);
      }
    }

    // 3. If the selected piece has legal capture targets, immediately show the 3D floating
    //    capture preview ring glow & emit CAPTURE_PREVIEW_HOVER for the HUD toast!
    if (this.captureTargetsBySquare.size > 0) {
      const firstCap = this.captureTargetsBySquare.values().next().value;
      if (firstCap) {
        this.renderCaptureHoverPreview(firstCap.to, firstCap.attacker, firstCap.defender);
        this.emitCapturePreviewHover(firstCap, 'selection');
      }
    }
  }

  /**
   * Builds a rotating red segmented target reticle (`0xff3d00`) for capture squares.
   * @param {string} square
   * @param {string} [attackerType]
   * @param {string} [defenderType]
   */
  buildSegmentedCaptureRing(square, attackerType = 'b', defenderType = 'p') {
    const group = new THREE.Group();
    group.name = `CaptureTargetRing_${square}`;
    group.userData = {
      square,
      isCapture: true,
      attackerType,
      defenderType,
      pairCode: `${String(attackerType).toUpperCase()}×${String(defenderType).toUpperCase()}`,
    };

    const segMat = new THREE.MeshBasicMaterial({
      color: 0xff3d00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });

    // 4 segmented arcs around the target piece pedestal
    const segmentCount = 4;
    const arcSpan = Math.PI * 0.34;
    for (let i = 0; i < segmentCount; i++) {
      const thetaStart = i * (Math.PI * 0.5) + 0.12;
      const seg = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.47, 16, 1, thetaStart, arcSpan),
        segMat,
      );
      seg.rotation.x = -Math.PI * 0.5;
      group.add(seg);
    }

    // Inner subtle danger ring
    const inner = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.31, 28),
      new THREE.MeshBasicMaterial({
        color: 0xff8a65,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      }),
    );
    inner.rotation.x = -Math.PI * 0.5;
    group.add(inner);

    // Floating elevated gold-crimson duel ring at y = 0.16m
    const elevatedRing = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.43, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffca28,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      }),
    );
    elevatedRing.rotation.x = -Math.PI * 0.5;
    elevatedRing.position.y = 0.16;
    group.add(elevatedRing);

    return group;
  }

  /**
   * Renders a floating 3D capture preview ring glow + clash badge over a capture target square.
   * @param {string} square
   * @param {string} [attackerType]
   * @param {string} [defenderType]
   */
  renderCaptureHoverPreview(square, attackerType = 'b', defenderType = 'p') {
    this.clearHoverPreview();
    if (!square) return;

    const pos = squareToWorld(square);
    const previewGroup = new THREE.Group();
    previewGroup.name = `CaptureHoverPreview_${square}`;
    previewGroup.userData = {
      square,
      attackerType,
      defenderType,
      pairCode: `${String(attackerType).toUpperCase()}×${String(defenderType).toUpperCase()}`,
    };
    previewGroup.position.set(pos.x, INDICATOR_Y, pos.z);

    // Floating outer golden-crimson ring at y = 0.24m
    const floatingRing = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.48, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffd54f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      }),
    );
    floatingRing.rotation.x = -Math.PI * 0.5;
    floatingRing.position.y = 0.24;
    previewGroup.add(floatingRing);

    // Subtle vertical holo-beacon cylinder around the target piece
    const holoCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.43, 0.47, 0.38, 28, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff3d00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
      }),
    );
    holoCylinder.position.y = 0.20;
    previewGroup.add(holoCylinder);

    // Optional floating 3D sprite badge above the target piece when running in browser DOM
    const sprite = this._buildFloatingPairSprite(attackerType, defenderType);
    if (sprite) {
      sprite.position.set(0, 1.55, 0);
      previewGroup.add(sprite);
    }

    this.hoverPreviewGroup.add(previewGroup);
    this.hoverRingMesh = previewGroup;
  }

  /**
   * Renders a subtle floating emerald-gold hover ring over a legal empty target square.
   * @param {string} square
   */
  renderMoveHoverPreview(square) {
    this.clearHoverPreview();
    if (!square) return;

    const pos = squareToWorld(square);
    const previewGroup = new THREE.Group();
    previewGroup.name = `MoveHoverPreview_${square}`;
    previewGroup.position.set(pos.x, INDICATOR_Y + 0.08, pos.z);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.37, 32),
      new THREE.MeshBasicMaterial({
        color: 0x69f0ae,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
      }),
    );
    ring.rotation.x = -Math.PI * 0.5;
    previewGroup.add(ring);

    this.hoverPreviewGroup.add(previewGroup);
    this.hoverRingMesh = previewGroup;
  }

  /**
   * Builds a 3D floating `THREE.Sprite` badge showing `⚔️ ATK × DEF` above a capture target.
   * Safe in headless Node environments where `document` is undefined.
   */
  _buildFloatingPairSprite(attackerType = 'b', defenderType = 'p') {
    if (typeof document === 'undefined') return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return null;

      const atkChar = CHARACTER_REGISTRY[attackerType] || CHARACTER_REGISTRY.p;
      const defChar = CHARACTER_REGISTRY[defenderType] || CHARACTER_REGISTRY.p;
      const label = `⚔️ ${atkChar.glyph} ${atkChar.name} vs ${defChar.glyph} ${defChar.name}`;

      ctx2d.fillStyle = 'rgba(18, 12, 28, 0.88)';
      ctx2d.strokeStyle = '#ffd54f';
      ctx2d.lineWidth = 4;
      ctx2d.beginPath();
      if (typeof ctx2d.roundRect === 'function') {
        ctx2d.roundRect(4, 4, 248, 56, 24);
      } else {
        ctx2d.rect(4, 4, 248, 56);
      }
      ctx2d.fill();
      ctx2d.stroke();

      ctx2d.font = 'bold 20px system-ui, sans-serif';
      ctx2d.fillStyle = '#ffe082';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText(label, 128, 33);

      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.name = 'CapturePreviewPairSprite';
      sprite.scale.set(1.45, 0.36, 1);
      return sprite;
    } catch {
      return null;
    }
  }

  clearHoverPreview() {
    this.hoverRingMesh = null;
    while (this.hoverPreviewGroup.children.length > 0) {
      this.hoverPreviewGroup.remove(this.hoverPreviewGroup.children[0]);
    }
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
    this.hoveredSquare = null;
    this.captureTargetsBySquare.clear();
    this.legalTargetsBySquare.clear();
    this.clearHoverPreview();
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
   * floating capture hover preview ring, and pulsing crimson King-in-Check aura.
   * @param {number} dt
   */
  update(dt = 1 / 60) {
    this.elapsedTime += dt;
    const t = this.elapsedTime;

    // Pulse emerald/yellow legal move circles
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

    // Animate floating 3D hover preview ring
    if (this.hoverRingMesh) {
      const s = 1.0 + 0.09 * Math.sin(t * 6.5);
      this.hoverRingMesh.scale.set(s, 1, s);
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
      this.domElement.removeEventListener('pointermove', this._boundPointerMove);
    }
    this.clearSelectionIndicators();
    this.clearCheckIndicator();
    this.clearHintIndicator();
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
