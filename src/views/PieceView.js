/**
 * @fileoverview Three.js 3D Hybrid 32-Piece Factory & Animation Renderer (`PieceView`).
 *
 * Implements:
 * 1. Sculpted 3D Faction Pedestals (`y = 0 .. 0.22m`, `Ø 0.75m`) grounded strictly at `y = 0.0m`:
 *    - White Team: Warm Ivory Marble (`0xfcf6e8`) + Gleaming Gold trim rings (`0xe6b84a`).
 *    - Black Team: Dark Obsidian (`0x181c26`) + Gleaming Silver/Violet-Steel trim rings (`0xc0cce0`).
 * 2. GLB Auto-Loader + Grounding (`assets/models/*.glb`) via `GLTFLoader` + `SkeletonUtils.clone`
 *    + `groundAndNormalizeObject3D` + `THREE.AnimationMixer` (`Idle_Track`, `FireBreath_Track`).
 * 3. Luxury 3D Pedestal + Double-Sided 2D Cutie Portrait Medallion + 3D Role Crown Fallback
 *    for pieces whose `.glb` is not yet on disk or while loading.
 * 4. Classic Stone/Marble Wizard Chess Rival Set (`isStoneSet = true` for Black when selected).
 * 5. Parabolic Jump Arc (`y = 4 * h_peak * t * (1 - t)`, `h_peak = 1.2m`, `0.42s`) with
 *    squash-and-stretch landing, plus Riccardo <-> Pupurabbu Belly-Bounce Castling!
 */

import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../../vendor/three/addons/utils/SkeletonUtils.js';
import {
  CHARACTER_REGISTRY,
  squareToWorld,
  isMobileOrTabletDevice,
  shouldUseMobileLite3D,
} from '../core/Registry.js';
import {
  groundAndNormalizeObject3D,
  CANONICAL_PIECE_HEIGHTS,
  PEDESTAL_RADIUS,
  PEDESTAL_HEIGHT,
} from '../utils/glbGrounding.js';
import {
  createArticulatedSkeletonRig,
  updateSkeletonRigPose,
} from './SkeletonRigHelper.js';

const CLIP_NAME_MAP = Object.freeze({
  Idle: 'Idle_Track',
  Idle_Track: 'Idle_Track',
  idle: 'Idle_Track',
  Click_Fire_Breath: 'FireBreath_Track',
  FireBreath_Track: 'FireBreath_Track',
  fire: 'FireBreath_Track',
  attack: 'FireBreath_Track',
});

const FOOTSTEP_POOL_SIZE = 24;

export class PieceView {
  /**
   * @param {THREE.Scene|object} [sceneOrOpts]
   * @param {object} [ctx]
   */
  constructor(sceneOrOpts = null, ctx = null) {
    this.scene = null;
    this.ctx = null;
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'CarChess3D_PiecesRoot';
    this.livingGroup = new THREE.Group();
    this.livingGroup.name = 'LivingPiecesGroup';
    this.trayGroup = new THREE.Group();
    this.trayGroup.name = 'CapturedTraysGroup';
    this.footstepGroup = new THREE.Group();
    this.footstepGroup.name = 'LocomotionFootstepsGroup';
    this.rootGroup.add(this.livingGroup, this.trayGroup, this.footstepGroup);

    /** @type {Map<string, THREE.Group>} square -> piece Group */
    this.pieceBySquare = new Map();
    /** @type {Map<string, Promise<any>>} url -> GLTF load promise */
    this.gltfCache = new Map();
    /** @type {Map<string, THREE.Texture>} url -> Texture */
    this.textureCache = new Map();
    /** @type {Set<{ mixer: THREE.AnimationMixer, clips: Map<string, THREE.AnimationClip>, root: THREE.Object3D }>} */
    this.activeMixers = new Set();
    /** @type {Array<object>} Active locomotion / parabolic / castling / squash animations */
    this.activeTweens = [];
    /** @type {Array<object>} Alias for active move animations */
    this.activeMoves = this.activeTweens;
    /** @type {Array<THREE.Group>} Captured pieces swimming in the Ogre's Swamp */
    this.capturedSwimmers = this.trayGroup.children;

    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.globalPieceScale = 1.0;
    const searchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const expList = (searchParams?.get('experiments') || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    this.skeletonsVisible = Boolean(
      searchParams &&
        (searchParams.get('skeletons') === '1' ||
          searchParams.get('skeletons') === 'true' ||
          expList.includes('showskeletons')),
    );
    this.isMobileOrTablet = isMobileOrTabletDevice();
    this.mobileLite3D = shouldUseMobileLite3D();
    this.forceMobileShaders = Boolean(
      searchParams &&
        (searchParams.get('shaders') === '1' || searchParams.get('shaders') === 'true'),
    );
    this._lastSyncSignature = null;
    this.swampTime = 0;
    this.offs = [];

    /** @type {Array<{ mesh: THREE.Mesh, age: number, maxAge: number, active: boolean }>} */
    this.footstepPool = [];
    this._buildFootstepPool();

    this._applyInitArgs(sceneOrOpts, ctx);
  }

  _buildFootstepPool() {
    const ringGeo = new THREE.RingGeometry(0.055, 0.125, 18);
    for (let i = 0; i < FOOTSTEP_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x00f0ff : 0xffd740,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI * 0.5;
      mesh.position.y = 0.016;
      mesh.visible = false;
      mesh.renderOrder = 8;
      this.footstepGroup.add(mesh);
      this.footstepPool.push({ mesh, age: 0, maxAge: 1.35, active: false });
    }
  }

  /**
   * Stamps a glowing cyan/gold footstep or horseshoe hoofprint on the board (`y = 0.016m`).
   */
  spawnFootstepPrint(x, z, yaw = 0, pieceType = 'p', color = 'w', sideSign = 1) {
    const slot = this.footstepPool.find((s) => !s.active) || this.footstepPool[0];
    if (!slot) return;
    slot.active = true;
    slot.age = 0;
    slot.maxAge = pieceType === 'n' ? 1.55 : 1.25;

    const lateral = (pieceType === 'n' ? 0.13 : 0.10) * sideSign;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    slot.mesh.position.set(x + cosY * lateral, 0.016, z - sinY * lateral);
    slot.mesh.rotation.set(-Math.PI * 0.5, 0, yaw);
    slot.mesh.scale.setScalar(pieceType === 'n' ? 1.18 : 0.92);
    slot.mesh.material.color.setHex(
      pieceType === 'n' ? 0xffab00 : color === 'w' ? 0x00f0ff : 0x7c4dff,
    );
    slot.mesh.material.opacity = 0.85;
    slot.mesh.visible = true;
  }

  _applyInitArgs(sceneOrOpts, ctx) {
    if (sceneOrOpts && sceneOrOpts.isScene) {
      this.scene = sceneOrOpts;
      this.ctx = ctx || this.ctx;
    } else if (sceneOrOpts && typeof sceneOrOpts === 'object') {
      this.scene = sceneOrOpts.scene || this.scene;
      this.ctx = sceneOrOpts.ctx || sceneOrOpts;
    }
    if (this.scene && !this.rootGroup.parent) {
      this.scene.add(this.rootGroup);
    }
  }

  /**
   * Initializes event subscriptions and builds initial 32 pieces.
   * @param {object} [ctxOrScene]
   * @param {object} [maybeCtx]
   */
  init(ctxOrScene = null, maybeCtx = null) {
    this._applyInitArgs(ctxOrScene, maybeCtx);
    const bus = this.ctx?.bus;
    const pm = this.ctx?.pieces || this.ctx?.pieceManager;

    if (bus) {
      this.offs.push(
        bus.on('BOARD_RESET', () => {
          this.activeTweens = [];
          this.activeMoves = this.activeTweens;
          this.pendingCaptureHandoff = null;
          this.syncPiecesFromManager();
        }),
        bus.on('PIECES_SYNCED', (e) => {
          if (e.reason === 'board_sync' || e.reason === 'rival_set_changed' || e.reason === 'bishop_variant_changed' || e.reason === 'queen_variant_changed') {
            this.syncPiecesFromManager(e.pieces, e.captured);
          } else if (e.reason === 'move_executed' && e.move) {
            this.animateMove(e.move, e.pieces, e.captured);
          } else {
            this.syncPiecesFromManager(e.pieces, e.captured);
          }
        }),
        bus.on('CASTLING_EXECUTED', (e) => {
          this.animateCastlingBellyBounce(e);
        }),
        bus.on('TOGGLE_SKELETONS', (e) => {
          const next =
            typeof e?.visible === 'boolean'
              ? e.visible
              : typeof e?.enabled === 'boolean'
                ? e.enabled
                : !this.skeletonsVisible;
          this.setSkeletonsVisible(next);
        }),
        bus.on('BATTLE_STARTED', (e) => {
          if (e.source === 'board_capture' && this.pendingCaptureHandoff) {
            const h = this.pendingCaptureHandoff;
            // Hide board destination piece & swamp swimmer while VFXPoolView stages the 3D Scazzottata!
            if (h.movingGroup) {
              h.movingGroup.visible = false;
              this.activeTweens = this.activeTweens.filter((tw) => tw.group !== h.movingGroup);
              this.activeMoves = this.activeTweens;
            }
            if (h.newestSwimmer) {
              h.newestSwimmer.visible = false;
              this.activeTweens = this.activeTweens.filter((tw) => tw.group !== h.newestSwimmer);
              this.activeMoves = this.activeTweens;
            }
          }
        }),
        bus.on('BATTLE_COMPLETED', () => {
          this.completePendingCaptureHandoff();
        }),
        bus.on('BATTLE_SKIPPED', () => {
          this.completePendingCaptureHandoff();
        }),
        bus.on('PIECE_ANIM_REQUESTED', (e) => {
          if (e.animType === 'clip') {
            const target = e.square ? this.getPieceObject(e.square) : null;
            if (target) {
              this.playClip(target, e.resolvedClip || e.clipKey);
            }
          }
        }),
        bus.on('CHECKMATE', (e) => {
          this.animateKingCapitulation(e);
        }),
      );
    }

    if (pm) {
      this.syncPiecesFromManager(pm.getLivingPieces(), pm.getCapturedTrays());
    } else if (this.ctx?.board?.pieces) {
      this.syncPiecesFromManager(this.ctx.board.pieces(), { w: [], b: [] });
    }
  }

  /**
   * Toggles or explicitly sets 100% visibility of the 3D articulated skeleton rigs across all pieces.
   * @param {boolean} [visible]
   * @returns {boolean}
   */
  setSkeletonsVisible(visible) {
    this.skeletonsVisible = typeof visible === 'boolean' ? visible : !this.skeletonsVisible;
    const syncGroupRig = (group) => {
      const rig = group?.userData?.skeletonRig;
      if (!rig) return;
      rig.userData.alwaysVisible = this.skeletonsVisible;
      const u = group.userData?.locomotionUniforms;
      updateSkeletonRigPose(rig, group.userData?.type, {
        walkPhase: u?.uWalkPhase?.value || 0.65,
        walkAmp: u?.uWalkAmp?.value || 0,
        combatPhase: u?.uCombatPhase?.value || 0,
        combatAmp: u?.uCombatAmp?.value || 0,
        skeletonsVisible: this.skeletonsVisible,
      });
    };

    for (const group of this.pieceBySquare.values()) {
      syncGroupRig(group);
    }
    for (const swimmer of this.trayGroup.children) {
      syncGroupRig(swimmer);
    }
    return this.skeletonsVisible;
  }

  /**
   * Switches between Mobile Lite 3D Mode (fast sculpted 3D pedestals + portrait medallions + crowns,
   * zero 850k-vertex GLB download storm) and Full GLB 3D Mode, rebuilding pieces immediately.
   * @param {boolean} [enabled]
   * @returns {boolean}
   */
  setMobileLite3D(enabled) {
    const next = typeof enabled === 'boolean' ? enabled : !this.mobileLite3D;
    if (this.mobileLite3D === next) return this.mobileLite3D;
    this.mobileLite3D = next;
    this._lastSyncSignature = null;
    this.syncPiecesFromManager();
    return this.mobileLite3D;
  }

  /**
   * Synchronizes all 3D living and captured tray pieces with `PieceManager`.
   * Deduplicates identical back-to-back syncs by resetting positions/rotations in-place
   * instead of destroying and re-cloning all 32 piece hierarchies.
   * @param {Array<object>} [livingDescriptors]
   * @param {{ w: Array<object>, b: Array<object> }} [capturedTrays]
   */
  syncPiecesFromManager(livingDescriptors, capturedTrays) {
    const pm = this.ctx?.pieces || this.ctx?.pieceManager;
    const list = livingDescriptors || pm?.getLivingPieces?.() || this.ctx?.board?.pieces?.() || [];
    const trays = capturedTrays || pm?.getCapturedTrays?.() || { w: [], b: [] };

    const resolvedList = list.map((raw) =>
      pm?.resolveDescriptor ? pm.resolveDescriptor(raw) : this._fallbackDescriptor(raw),
    );
    const trayCount = (trays.w?.length || 0) + (trays.b?.length || 0);
    const sig =
      `${this.mobileLite3D ? 'L' : 'G'}|${trayCount}|` +
      resolvedList
        .map(
          (d) =>
            `${d.square}:${d.color}:${d.type}:${d.family || ''}:${d.isStoneSet ? 1 : 0}:${d.glbUrl || ''}`,
        )
        .join(',');

    if (
      sig === this._lastSyncSignature &&
      this.livingGroup.children.length === resolvedList.length &&
      this.pieceBySquare.size === resolvedList.length &&
      this.trayGroup.children.length === trayCount
    ) {
      let allMatched = true;
      for (const desc of resolvedList) {
        if (!this.pieceBySquare.has(desc.square)) {
          allMatched = false;
          break;
        }
      }
      if (allMatched) {
        for (const desc of resolvedList) {
          const group = this.pieceBySquare.get(desc.square);
          const pos = squareToWorld(desc.square);
          const isWhite = String(desc.color || 'w').toLowerCase() !== 'b';
          const homeYaw = isWhite ? Math.PI : 0;
          group.userData.homeYaw = homeYaw;
          group.position.set(pos.x, 0, pos.z);
          group.rotation.set(0, homeYaw, 0);
          group.scale.setScalar(this.globalPieceScale);
          group.visible = true;
          this.applyPoseToPiece(group, {});
        }
        return;
      }
    }

    this._lastSyncSignature = sig;
    this.clearGroup(this.livingGroup);
    this.pieceBySquare.clear();

    for (const desc of resolvedList) {
      const group = this.buildPieceGroup(desc);
      const pos = squareToWorld(desc.square);
      const isWhite = String(desc.color || 'w').toLowerCase() !== 'b';
      const homeYaw = isWhite ? Math.PI : 0;
      group.userData.homeYaw = homeYaw;
      group.position.set(pos.x, 0, pos.z);
      group.rotation.set(0, homeYaw, 0);
      group.scale.setScalar(this.globalPieceScale);
      this.livingGroup.add(group);
      this.pieceBySquare.set(desc.square, group);
    }

    this.renderCapturedTrays(trays);
  }

  /**
   * Renders captured ("dead") pieces splashing happily inside the Enchanted Swamp Moat
   * ("Palude dell’Orco", r = 6.2m..8.2m, half-submerged at y = -0.28m with 3D lily-pad leaves,
   * blooming lotus flowers, emerald ripple rings & bubbles!).
   */
  renderCapturedTrays(trays = { w: [], b: [] }) {
    this.clearGroup(this.trayGroup);
    let globalIdx = 0;
    for (const color of ['w', 'b']) {
      const items = trays[color] || [];
      const sideSign = color === 'w' ? -1 : 1;
      items.forEach((item, idx) => {
        const pm = this.ctx?.pieces || this.ctx?.pieceManager;
        const desc = pm?.resolveDescriptor ? pm.resolveDescriptor(item) : this._fallbackDescriptor(item);
        const group = this.buildPieceGroup(desc);
        const colRing = idx % 2;
        const rowSlot = Math.floor(idx / 2);
        const x = item.trayX ?? (sideSign * (6.25 + colRing * 0.95));
        const y = item.trayY ?? -0.28;
        const z = item.trayZ ?? (rowSlot * 1.05 - 2.65);

        const splashFx = this.buildSwampSplashRing(color, globalIdx);
        group.add(splashFx);
        group.userData.swampSplash = splashFx;
        group.userData.lilyPad = splashFx.userData.lilyPad;
        group.userData.lotusFlower = splashFx.userData.lotusFlower;
        group.userData.swampPhase = globalIdx * 1.37;
        group.userData.baseSwampY = y;
        group.userData.baseSwampYaw = color === 'w' ? 0.35 : -0.35;
        group.userData.celebrationSplashTimer = 1.1;

        group.position.set(x, y, z);
        group.scale.setScalar(0.84 * this.globalPieceScale);
        this.trayGroup.add(group);
        globalIdx += 1;
      });
    }
    this.capturedSwimmers = this.trayGroup.children;
  }

  buildSwampSplashRing(color = 'w', seed = 0) {
    const splashGroup = new THREE.Group();
    splashGroup.name = 'SwampSplashRing';
    // Water surface sits around y = -0.44m in world space; since group is at y = -0.28m, local y = -0.14m
    splashGroup.position.y = -0.14;

    // 1. Sculpted 3D Notched Lily-Pad Leaf ("Ninfea della Palude dell’Orco") under each swimming piece!
    const lilyPad = new THREE.Group();
    lilyPad.name = 'SwampLilyPad';
    const padLeafMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.52, 0.036, 28, 1, false, 0.22, Math.PI * 1.86),
      new THREE.MeshStandardMaterial({
        color: color === 'w' ? 0x2ecc71 : 0x26a69a,
        emissive: 0x0f522d,
        emissiveIntensity: 0.42,
        roughness: 0.38,
        metalness: 0.06,
      }),
    );
    const padRimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.055, 10, 26),
      new THREE.MeshStandardMaterial({
        color: color === 'w' ? 0x69f0ae : 0x00bfa5,
        emissive: 0x1b5e20,
        emissiveIntensity: 0.48,
        roughness: 0.32,
      }),
    );
    padRimMesh.rotation.x = Math.PI * 0.5;
    padRimMesh.position.y = 0.025;
    lilyPad.add(padLeafMesh, padRimMesh);
    lilyPad.position.y = 0.24;
    lilyPad.rotation.y = seed * 0.85;
    splashGroup.add(lilyPad);

    // 2. Sculpted 3D Multi-Petal Lotus Flower ("Fiore di Loto") perched on the lily-pad rim!
    const lotusFlower = new THREE.Group();
    lotusFlower.name = 'SwampLotusFlower';
    const petalMat = new THREE.MeshStandardMaterial({
      color: color === 'w' ? 0xff80ab : 0xe040fb,
      emissive: color === 'w' ? 0xc51162 : 0x6a1b9a,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    const petalGeo = new THREE.ConeGeometry(0.052, 0.13, 6);
    for (let p = 0; p < 6; p++) {
      const pAngle = (p / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(Math.cos(pAngle) * 0.055, 0.04, Math.sin(pAngle) * 0.055);
      petal.rotation.z = -Math.cos(pAngle) * 0.52;
      petal.rotation.x = Math.sin(pAngle) * 0.52;
      lotusFlower.add(petal);
    }
    const stamen = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffea00 }),
    );
    stamen.position.y = 0.055;
    lotusFlower.add(stamen);
    const lotusAngle = seed * 1.15 + 0.6;
    lotusFlower.position.set(Math.cos(lotusAngle) * 0.40, 0.265, Math.sin(lotusAngle) * 0.40);
    splashGroup.add(lotusFlower);

    // 3. Concentric glowing lime-emerald water ripple rings + celebratory splash burst ring
    const ripple1 = new THREE.Mesh(
      new THREE.RingGeometry(0.54, 0.65, 32),
      new THREE.MeshBasicMaterial({
        color: 0x69f0ae,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.82,
      }),
    );
    ripple1.rotation.x = -Math.PI * 0.5;
    ripple1.position.y = 0.26;

    const ripple2 = new THREE.Mesh(
      new THREE.RingGeometry(0.70, 0.82, 32),
      new THREE.MeshBasicMaterial({
        color: 0x76ff03,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.58,
      }),
    );
    ripple2.rotation.x = -Math.PI * 0.5;
    ripple2.position.y = 0.255;

    const celebrationRing = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.78, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffea00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0,
      }),
    );
    celebrationRing.rotation.x = -Math.PI * 0.5;
    celebrationRing.position.y = 0.27;
    splashGroup.add(ripple1, ripple2, celebrationRing);

    // 4. Six rising green swamp bubbles / splash droplets
    const bubbles = [];
    const bubbleGeo = new THREE.SphereGeometry(0.055, 8, 8);
    for (let i = 0; i < 6; i++) {
      const bMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x76ff03 : 0x69f0ae,
        transparent: true,
        opacity: 0.85,
      });
      const bMesh = new THREE.Mesh(bubbleGeo, bMat);
      const angle = (i / 6) * Math.PI * 2 + seed;
      const rad = 0.42 + (i % 2) * 0.14;
      bMesh.position.set(Math.cos(angle) * rad, 0.32 + (i * 0.08), Math.sin(angle) * rad);
      bMesh.userData = { angle, rad, phaseOffset: i * 1.05 };
      splashGroup.add(bMesh);
      bubbles.push(bMesh);
    }

    splashGroup.userData = {
      ripple1,
      ripple2,
      celebrationRing,
      bubbles,
      floatRing: lilyPad,
      lilyPad,
      lotusFlower,
    };
    return splashGroup;
  }

  _fallbackDescriptor(raw) {
    const type = String(raw.type || 'p').toLowerCase();
    const color = raw.color === 'b' ? 'b' : 'w';
    const meta = CHARACTER_REGISTRY[type] || CHARACTER_REGISTRY.p;
    const pos = squareToWorld(raw.square || 'e4');
    return {
      id: raw.id || `${color}_${type}_${raw.square || 'e4'}`,
      square: raw.square || 'e4',
      type,
      color,
      role: meta.role,
      name: meta.name,
      glyph: meta.glyph,
      height: CANONICAL_PIECE_HEIGHTS[type] ?? 1.2,
      glbUrl: meta.glbUrl,
      frontPortrait: meta.frontPortrait,
      backPortrait: meta.backPortrait || meta.frontPortrait,
      accentColor: meta.accentColor,
      isStoneSet: Boolean(raw.isStoneSet),
      animations: meta.animations,
      x: pos.x,
      y: 0,
      z: pos.z,
    };
  }

  /**
   * Builds a complete 3D piece Group grounded strictly at `y = 0.0m`:
   * - Tiered Faction Pedestal (`y = 0 .. 0.22m`, `Ø 0.75m`)
   * - Articulated 3D Skeleton Rig (`group.userData.skeletonRig`)
   * - Either Stone Warrior (`isStoneSet`), or Luxury Medallion + Role Crown (replaced by GLB when loaded).
   * @param {object} desc
   * @returns {THREE.Group}
   */
  buildPieceGroup(desc) {
    const group = new THREE.Group();
    const normColor = String(desc.color || 'w').toLowerCase() === 'b' ? 'b' : 'w';
    const pieceType = String(desc.type || 'p').toLowerCase();
    group.name = `Piece_${normColor}_${pieceType}_${desc.square || 'standalone'}`;
    // White pieces (South, Ranks 1-2, z > 0) face North (-Z -> Math.PI) to confront Black pieces (North, Ranks 7-8, z < 0) facing South (+Z -> 0)!
    const homeYaw = normColor === 'w' ? Math.PI : 0;
    const KIND_ID_MAP = { p: 0.0, n: 1.0, b: 2.0, r: 3.0, q: 4.0, k: 5.0 };
    const sqStr = String(desc.square || 'e4');
    const idlePhaseOffset =
      ((sqStr.charCodeAt(0) || 97) * 1.37 + (parseInt(sqStr[1], 10) || 1) * 2.19) %
      (Math.PI * 2);

    const locomotionUniforms = {
      uWalkPhase: { value: 0.0 },
      uWalkAmp: { value: 0.0 },
      uCombatPhase: { value: 0.0 },
      uCombatAmp: { value: 0.0 },
      uGaitMode: { value: pieceType === 'n' ? 1.0 : 0.0 },
      uIdlePhase: { value: idlePhaseOffset },
      uIdleAmp: { value: 1.0 },
      uPieceKind: { value: KIND_ID_MAP[pieceType] ?? 0.0 },
    };

    // Build Articulated 3D Hierarchical Skeleton & Joint Rig (Issue #12)
    const pieceHeight = desc.height || CANONICAL_PIECE_HEIGHTS[pieceType] || 1.25;
    const skeletonRig = createArticulatedSkeletonRig(
      THREE,
      pieceType,
      pieceHeight,
      normColor,
    );
    skeletonRig.userData.alwaysVisible = this.skeletonsVisible;
    updateSkeletonRigPose(skeletonRig, pieceType, {
      idlePhase: idlePhaseOffset,
      idleAmp: 0.45,
      skeletonsVisible: this.skeletonsVisible,
    });

    group.userData = {
      isChessPiece: true,
      pieceId: desc.id,
      square: desc.square,
      type: pieceType,
      color: normColor,
      role: desc.role,
      name: desc.name,
      descriptor: desc,
      baseScale: this.globalPieceScale,
      homeYaw,
      locomotionUniforms,
      skeletonRig,
      emotePhase: 0,
      idlePhaseOffset,
      idleTime: idlePhaseOffset,
      hoverBoost: 0,
    };
    group.rotation.set(0, homeYaw, 0);

    // 1. Sculpted 3D Faction Pedestal (y = 0.00m .. 0.22m, Ø 0.75m)
    // - Knight ('n'): elongated equestrian oval plinth (LUNGO e un po' larghetto)
    // - Pawn ('p'): compact plinth proportional to halved minion stature
    // - Royals/Others: canonical circular pedestal (Ø 0.75m)
    const pedestal = this.buildFactionPedestal(normColor, desc.accentColor, pieceType);
    group.add(pedestal);

    // 2. Body container atop pedestal
    const bodyContainer = new THREE.Group();
    bodyContainer.name = 'PieceBodyContainer';
    group.add(bodyContainer);
    group.userData.bodyContainer = bodyContainer;

    if (desc.isStoneSet || (this.mobileLite3D && desc.family === 'classic')) {
      const stoneMesh = this.buildStoneWarriorFigure(desc.type, normColor);
      bodyContainer.add(stoneMesh);
      group.userData.fallbackFigure = stoneMesh;
    } else {
      // Build luxury double-sided portrait medallion + 3D crown fallback immediately
      const fallback = this.buildMedallionFallbackFigure(desc);
      bodyContainer.add(fallback);
      group.userData.fallbackFigure = fallback;

      // If a GLB path is configured AND not in Mobile Lite 3D mode, asynchronously load, clone, ground at y = PEDESTAL_HEIGHT, and swap!
      if (desc.glbUrl && !this.mobileLite3D) {
        this.attachGlbToPiece(group, bodyContainer, desc);
      }
    }

    // Mount the articulated 3D skeleton rig inside bodyContainer
    bodyContainer.add(skeletonRig);

    // Tag all child meshes with reference to root piece group for raycasting
    this._tagRaycastHierarchy(group);
    return group;
  }

  /**
   * Sculpted multi-tiered lathe/cylinder pedestal grounded strictly at `y = 0.0m`.
   * - White Team: Warm Ivory Marble (`0xfcf6e8`, roughness 0.25) + Gold trim (`0xe6b84a`).
   * - Black Team: Dark Obsidian (`0x181c26`, roughness 0.22) + Silver/Violet-Steel trim (`0xc0cce0`).
   */
  buildFactionPedestal(color, accentColor = 0xe6b84a, pieceType = null) {
    const isWhite = color !== 'b';
    const pedGroup = new THREE.Group();
    pedGroup.name = `FactionPedestal_${isWhite ? 'White' : 'Black'}`;

    const marbleMat = new THREE.MeshStandardMaterial({
      color: isWhite ? 0xfcf6e8 : 0x1a2030,
      roughness: isWhite ? 0.24 : 0.22,
      metalness: isWhite ? 0.08 : 0.25,
      emissive: isWhite ? 0x261d0e : 0x0b1020,
      emissiveIntensity: 0.22,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: isWhite ? 0xffd54f : 0xdce7f7,
      roughness: isWhite ? 0.28 : 0.26,
      metalness: 0.38,
      emissive: isWhite ? 0x6e4b08 : 0x2c3e5e,
      emissiveIntensity: 0.42,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColor || (isWhite ? 0xffca28 : 0x7c4dff),
      roughness: 0.28,
      metalness: 0.35,
      emissive: accentColor || 0x222222,
      emissiveIntensity: 0.36,
    });

    // Bottom plinth (y = 0.00 .. 0.08m, strictly min.y = 0.0)
    const h1 = 0.08;
    const baseCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(PEDESTAL_RADIUS * 0.95, PEDESTAL_RADIUS, h1, 28),
      marbleMat,
    );
    baseCyl.position.y = h1 * 0.5;
    baseCyl.castShadow = true;
    baseCyl.receiveShadow = true;
    pedGroup.add(baseCyl);

    // Lower gleaming metallic ring (y = 0.08m)
    const lowerRing = new THREE.Mesh(
      new THREE.CylinderGeometry(PEDESTAL_RADIUS * 0.97, PEDESTAL_RADIUS * 0.97, 0.024, 28),
      trimMat,
    );
    lowerRing.position.y = 0.08;
    lowerRing.castShadow = true;
    pedGroup.add(lowerRing);

    // Mid tapered cushion (y = 0.08 .. 0.17m)
    const h2 = 0.09;
    const midCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(PEDESTAL_RADIUS * 0.78, PEDESTAL_RADIUS * 0.92, h2, 28),
      marbleMat,
    );
    midCyl.position.y = 0.08 + h2 * 0.5;
    midCyl.castShadow = true;
    midCyl.receiveShadow = true;
    pedGroup.add(midCyl);

    // Character role color band (y = 0.17 .. 0.19m)
    const bandCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(PEDESTAL_RADIUS * 0.81, PEDESTAL_RADIUS * 0.81, 0.022, 28),
      accentMat,
    );
    bandCyl.position.y = 0.18;
    pedGroup.add(bandCyl);

    // Top crown stage (y = 0.18 .. 0.22m = PEDESTAL_HEIGHT)
    const h3 = 0.04;
    const topCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(PEDESTAL_RADIUS * 0.84, PEDESTAL_RADIUS * 0.78, h3, 28),
      trimMat,
    );
    topCyl.position.y = PEDESTAL_HEIGHT - h3 * 0.5;
    topCyl.castShadow = true;
    topCyl.receiveShadow = true;
    pedGroup.add(topCyl);

    // Dynamic equestrian oval plinth for Knight ('n') (LUNGO e un po' larghetto vs standard circular base)
    // and compact halved circular plinth for Pawns ('p')
    if (pieceType === 'n') {
      pedGroup.scale.set(1.15, 1.0, 1.35);
    } else if (pieceType === 'p') {
      pedGroup.scale.set(0.85, 1.0, 0.85);
    }

    return pedGroup;
  }

  /**
   * Builds the Luxury 3D Column + Double-Sided 2D Cutie Portrait Medallion + Role Crown
   * reaching the exact canonical rank height (`CANONICAL_PIECE_HEIGHTS[type]`).
   */
  buildMedallionFallbackFigure(desc) {
    const isWhite = desc.color !== 'b';
    const figGroup = new THREE.Group();
    figGroup.name = `MedallionFallback_${desc.type}`;

    const totalHeight = CANONICAL_PIECE_HEIGHTS[desc.type] ?? 1.35;
    const bodySpan = Math.max(0.48, totalHeight - PEDESTAL_HEIGHT);
    const crownHeight = 0.24;
    const medallionRadius = Math.min(0.24, 0.185 + bodySpan * 0.045);
    const medallionCenterY = PEDESTAL_HEIGHT + bodySpan - crownHeight - medallionRadius * 0.85;
    const stemTopY = Math.max(PEDESTAL_HEIGHT + 0.12, medallionCenterY - medallionRadius * 0.76);
    const stemHeight = Math.max(0.08, stemTopY - PEDESTAL_HEIGHT);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: isWhite ? 0xfaf3e3 : 0x1e2536,
      roughness: 0.24,
      metalness: isWhite ? 0.10 : 0.28,
      emissive: isWhite ? 0x2a2010 : 0x0c1222,
      emissiveIntensity: 0.24,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: isWhite ? 0xffd54f : 0xdce7f7,
      roughness: 0.26,
      metalness: 0.40,
      emissive: isWhite ? 0x6e4b08 : 0x2c3e5e,
      emissiveIntensity: 0.44,
    });

    // Sculpted 3-part royal chess column rising from pedestal to medallion
    const lowerH = stemHeight * 0.48;
    const lowerStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.235, lowerH, 24),
      bodyMat,
    );
    lowerStem.position.y = PEDESTAL_HEIGHT + lowerH * 0.5;
    lowerStem.castShadow = true;
    lowerStem.receiveShadow = true;
    figGroup.add(lowerStem);

    const midRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.022, 12, 24),
      frameMat,
    );
    midRing.rotation.x = Math.PI * 0.5;
    midRing.position.y = PEDESTAL_HEIGHT + lowerH;
    figGroup.add(midRing);

    const upperH = stemHeight * 0.52;
    const upperStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.145, upperH, 24),
      bodyMat,
    );
    upperStem.position.y = PEDESTAL_HEIGHT + lowerH + upperH * 0.5;
    upperStem.castShadow = true;
    upperStem.receiveShadow = true;
    figGroup.add(upperStem);

    // Ornate metallic collar ring under medallion
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.165, 0.14, 0.036, 24),
      frameMat,
    );
    collar.position.y = stemTopY;
    figGroup.add(collar);

    // Medallion outer metallic rim (Cylinder oriented along Z axis)
    const rimThickness = 0.068;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(medallionRadius, medallionRadius, rimThickness, 32),
      frameMat,
    );
    rim.rotation.x = Math.PI * 0.5;
    rim.position.y = medallionCenterY;
    rim.castShadow = true;
    figGroup.add(rim);

    // Front (+Z) and Back (-Z) circular portrait discs (both show the smiling front character bust!)
    const portraitTex = this.loadPortraitTexture(desc.frontPortrait, desc.name, isWhite);

    const discGeo = new THREE.CircleGeometry(medallionRadius * 0.89, 32);
    const portraitMat = new THREE.MeshStandardMaterial({
      map: portraitTex,
      roughness: 0.26,
      metalness: 0.04,
      emissive: 0xffffff,
      emissiveMap: portraitTex,
      emissiveIntensity: 0.28,
    });

    const frontDisc = new THREE.Mesh(discGeo, portraitMat);
    frontDisc.position.set(0, medallionCenterY, rimThickness * 0.52);
    figGroup.add(frontDisc);

    const backDisc = new THREE.Mesh(discGeo, portraitMat);
    backDisc.rotation.y = Math.PI;
    backDisc.position.set(0, medallionCenterY, -rimThickness * 0.52);
    figGroup.add(backDisc);

    // Role-specific 3D Crown / Crest atop the medallion reaching `totalHeight`
    const crownBaseY = medallionCenterY + medallionRadius * 0.92;
    const crown = this.buildRoleCrown(desc.type, crownBaseY, totalHeight, frameMat, bodyMat, desc.accentColor);
    figGroup.add(crown);

    return figGroup;
  }

  /**
   * Builds a distinct 3D silhouette crown/crest atop the medallion so every rank
   * is recognizable even in pure silhouette.
   */
  buildRoleCrown(type, startY, targetTopY, metalMat, bodyMat, accentColor = 0xffca28) {
    const crownGroup = new THREE.Group();
    const h = Math.max(0.14, targetTopY - startY);
    const gemMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.5,
    });

    if (type === 'k') {
      // King Riccardo: Royal Golden Toilet-Throne Crown + Cross Orb reaching 1.86m
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, h * 0.55, 16), metalMat);
      band.position.y = startY + h * 0.275;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), gemMat);
      orb.position.y = startY + h * 0.68;
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.03, h * 0.32, 0.03), metalMat);
      crossV.position.y = startY + h * 0.84;
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.03), metalMat);
      crossH.position.y = startY + h * 0.86;
      crownGroup.add(band, orb, crossV, crossH);
    } else if (type === 'q') {
      // Queen Kate: Tiara Coronet + Lilac Choco Pearl Spire reaching 1.68m
      const tiara = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.10, h * 0.55, 12), metalMat);
      tiara.position.y = startY + h * 0.28;
      const pearl = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 1), gemMat);
      pearl.position.y = startY + h * 0.78;
      crownGroup.add(tiara, pearl);
    } else if (type === 'b') {
      // Bishop Ale: Pointed Mitre + Dragon Ruby Gem reaching 1.55m
      const mitre = new THREE.Mesh(new THREE.ConeGeometry(0.13, h * 0.82, 16), bodyMat);
      mitre.position.y = startY + h * 0.41;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), gemMat);
      tip.position.y = startY + h * 0.88;
      crownGroup.add(mitre, tip);
    } else if (type === 'n') {
      // Knight Seby: Orange Loop-Track Arch + Turbo Crest reaching 1.92m
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.028, 12, 24), gemMat);
      arch.position.y = startY + h * 0.52;
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, h * 0.5, 8), metalMat);
      fin.position.y = startY + h * 0.75;
      crownGroup.add(arch, fin);
    } else if (type === 'r') {
      // Rook Pupurabbu: Castle Battlement Crenellations + Plush Ears reaching 2.50m
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, h * 0.65, 12), bodyMat);
      turret.position.y = startY + h * 0.325;
      const earL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), gemMat);
      earL.scale.set(0.8, 1.5, 0.6);
      earL.position.set(-0.08, startY + h * 0.76, 0);
      const earR = earL.clone();
      earR.position.x = 0.08;
      crownGroup.add(turret, earL, earR);
    } else {
      // Pawn Puffin: Swiss Guard Halberd Plume reaching 0.80m
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), metalMat);
      helm.position.y = startY + h * 0.45;
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.045, h * 0.55, 10), gemMat);
      plume.position.y = startY + h * 0.75;
      crownGroup.add(helm, plume);
    }

    return crownGroup;
  }

  /**
   * Builds a Classic Stone/Marble Wizard Chess Warrior for the Black Rival Set (`isStoneSet = true`).
   * Weathered dark basalt/obsidian with glowing runic eyes and carved armor silhouette.
   */
  buildStoneWarriorFigure(type, color = 'b') {
    const group = new THREE.Group();
    group.name = `StoneWarrior_${type}`;

    const totalHeight = CANONICAL_PIECE_HEIGHTS[type] ?? 1.20;
    const figH = Math.max(0.55, totalHeight - PEDESTAL_HEIGHT);

    const basaltMat = new THREE.MeshStandardMaterial({
      color: color === 'b' ? 0x222836 : 0xd8d2c5,
      roughness: 0.68,
      metalness: 0.22,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: color === 'b' ? 0x39445c : 0xb5ad9e,
      roughness: 0.42,
      metalness: 0.65,
    });
    const runeMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x7c4dff,
      emissiveIntensity: 1.4,
      roughness: 0.15,
    });

    // Carved armored torso column
    const torsoH = figH * 0.56;
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.25, torsoH, 10),
      basaltMat,
    );
    torso.position.y = PEDESTAL_HEIGHT + torsoH * 0.5;
    torso.castShadow = true;
    torso.receiveShadow = true;
    group.add(torso);

    // Shoulder pauldrons
    const shoulders = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.11, 0.24),
      armorMat,
    );
    shoulders.position.y = PEDESTAL_HEIGHT + torsoH * 0.88;
    shoulders.castShadow = true;
    group.add(shoulders);

    // Helm / Head
    const headY = PEDESTAL_HEIGHT + torsoH + figH * 0.16;
    const helm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, figH * 0.24, 8),
      armorMat,
    );
    helm.position.y = headY;
    helm.castShadow = true;
    group.add(helm);

    // Glowing runic visor eyes
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.028, 0.04),
      runeMat,
    );
    visor.position.set(0, headY + 0.02, 0.125);
    group.add(visor);

    // Rank-specific carved stone weapon & crown reaching `totalHeight`
    const crestY = PEDESTAL_HEIGHT + figH * 0.85;
    if (type === 'k') {
      // Horned Crown + Great Broadsword in front
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, figH * 0.22, 8), armorMat);
      crown.position.y = crestY;
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.05, figH * 0.72, 0.025), armorMat);
      sword.position.set(0, PEDESTAL_HEIGHT + figH * 0.42, 0.22);
      group.add(crown, sword);
    } else if (type === 'q') {
      // Wizard Queen Rune Staff + Tall Coronet
      const coronet = new THREE.Mesh(new THREE.ConeGeometry(0.15, figH * 0.26, 8), armorMat);
      coronet.position.y = crestY;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), runeMat);
      orb.position.set(0.18, crestY, 0.14);
      group.add(coronet, orb);
    } else if (type === 'b') {
      // Hooded Stone Mitre + Crosier
      const mitre = new THREE.Mesh(new THREE.ConeGeometry(0.15, figH * 0.28, 6), basaltMat);
      mitre.position.y = crestY;
      group.add(mitre);
    } else if (type === 'n') {
      // Armored Warhorse Snout & Mane Crest
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.26), basaltMat);
      snout.position.set(0, headY + 0.04, 0.12);
      const mane = new THREE.Mesh(new THREE.BoxGeometry(0.06, figH * 0.30, 0.18), armorMat);
      mane.position.set(0, crestY, -0.04);
      group.add(snout, mane);
    } else if (type === 'r') {
      // Crenellated Battlement Fortress Crown
      const battlement = new THREE.Mesh(new THREE.BoxGeometry(0.32, figH * 0.24, 0.32), basaltMat);
      battlement.position.y = crestY;
      group.add(battlement);
    } else {
      // Stone Shield-Bearer Pawn
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.32, 6), armorMat);
      shield.rotation.x = Math.PI * 0.5;
      shield.position.set(0, PEDESTAL_HEIGHT + figH * 0.42, 0.19);
      group.add(shield);
    }

    return group;
  }

  /**
   * Loads and caches a GLB model, clones it with `SkeletonUtils.clone` so rigged
   * skeletons animate independently, grounds it atop the pedestal (`y = 0.22m`),
   * and sets up `THREE.AnimationMixer` (`Idle_Track` / `FireBreath_Track`).
   */
  attachGlbToPiece(pieceGroup, bodyContainer, desc) {
    this.loadGltfCached(desc.glbUrl)
      .then((gltf) => {
        if (!gltf || !gltf.scene || !pieceGroup.parent) return;

        let clonedScene;
        try {
          clonedScene = SkeletonUtils.clone(gltf.scene);
        } catch {
          clonedScene = gltf.scene.clone(true);
        }

        const isWhite = desc.color !== 'b';
        const isWireframe =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('wireframe') === '1';

        clonedScene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              const mats = Array.isArray(child.material)
                ? child.material.map((m) => m.clone())
                : [child.material.clone()];
              for (const mat of mats) {
                if (mat.map) {
                  // Single-texture UV-mapped Carlesso models: restore full diffuse albedo!
                  mat.metalness = 0.04;
                  mat.metalnessMap = null;
                  mat.roughness = 0.52;
                  mat.roughnessMap = null;
                  if (isWhite) {
                    if (mat.color) mat.color.setHex(0xffffff);
                    if (mat.emissive) {
                      mat.emissiveMap = mat.map;
                      mat.emissive.setHex(0xffffff);
                      mat.emissiveIntensity = 0.32;
                    }
                  } else {
                    if (mat.color) mat.color.setHex(0xb8c6f0);
                    if (mat.emissive) {
                      mat.emissiveMap = mat.map;
                      mat.emissive.setHex(0x7c90e8);
                      mat.emissiveIntensity = 0.22;
                    }
                  }
                } else {
                  // Multi-material untextured PBR models (Swamp & Classic families):
                  // Preserve native character/material colors and tint faction_primary / faction_trim!
                  if (mat.name === 'faction_primary' && mat.color) {
                    mat.color.setHex(isWhite ? 0xf5f0e6 : 0x232a3a);
                    mat.roughness = isWhite ? 0.26 : 0.24;
                    mat.metalness = isWhite ? 0.06 : 0.22;
                  } else if (mat.name === 'faction_trim' && mat.color) {
                    mat.color.setHex(isWhite ? 0xd4af37 : 0xc0cce0);
                    mat.roughness = 0.24;
                    mat.metalness = 0.78;
                  } else {
                    mat.metalness = Math.min(0.75, mat.metalness ?? 0.12);
                    mat.roughness = Math.max(0.22, mat.roughness ?? 0.45);
                  }
                  if (mat.emissive && mat.color) {
                    mat.emissive.copy(mat.color);
                    mat.emissiveIntensity = isWhite ? 0.22 : 0.16;
                  }
                }
                if (isWireframe) {
                  mat.wireframe = true;
                }
                const isDraghessaPiece =
                  desc.id === 'rook_swamp_draghessa' ||
                  String(desc.glbUrl || '').includes('rook-swamp-draghessa');
                let dragonCoilMode = 0.0;
                if (isDraghessaPiece) {
                  const dragonMatNames = new Set([
                    'dragon_ruby',
                    'dragon_emerald',
                    'amber_gem',
                    'eye_dark',
                    'onion_gold',
                  ]);
                  if (dragonMatNames.has(mat.name)) {
                    dragonCoilMode = 1.0; // Dedicated Dragon sub-mesh: 100% helical coiling around the stationary tower!
                  } else if (mat.map) {
                    dragonCoilMode = 2.0; // UV-mapped TRELLIS.2 single-mesh: outer radial dragon coils around inner stone tower!
                  }
                }
                if (!this.isMobileOrTablet || this.forceMobileShaders) {
                  this.injectLocomotionShader(
                    mat,
                    desc.type,
                    pieceGroup.userData.locomotionUniforms,
                    dragonCoilMode,
                  );
                }
                mat.needsUpdate = true;
              }
              child.material = Array.isArray(child.material) ? mats : mats[0];
            }
          }
        });

        // Ground & normalize character atop its pedestal (y = PEDESTAL_HEIGHT = 0.22m)
        // Scaled to canonical rank height without artificial horizontal radius clamping
        const { holder } = groundAndNormalizeObject3D(
          THREE,
          clonedScene,
          desc.type,
          { baseElevation: PEDESTAL_HEIGHT },
        );
        // Face straight along pieceGroup's forward axis (White=Math.PI North, Black=0 South)
        holder.rotation.y = 0;

        // Remove fallback medallion figure and mount the grounded 3D GLB + articulated skeleton rig
        bodyContainer.clear();
        bodyContainer.add(holder);
        if (pieceGroup.userData.skeletonRig) {
          bodyContainer.add(pieceGroup.userData.skeletonRig);
        }
        pieceGroup.userData.glbHolder = holder;
        pieceGroup.userData.fallbackFigure = null;

        // Setup skeletal AnimationMixer if animations are present
        if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(clonedScene);
          const clipMap = new Map();
          for (const clip of gltf.animations) {
            clipMap.set(clip.name, clip);
          }
          const mixerEntry = { mixer, clips: clipMap, root: pieceGroup, activeAction: null };
          pieceGroup.userData.mixerEntry = mixerEntry;
          this.activeMixers.add(mixerEntry);

          // Auto-play Idle_Track / first clip
          this.playClip(pieceGroup, 'Idle_Track');
        }

        this._tagRaycastHierarchy(pieceGroup);
      })
      .catch(() => {
        // Keep luxury double-sided medallion fallback if GLB fails to load
      });
  }

  /**
   * Injects a real-time procedural skeletal limb & horse-gallop vertex shader into `.glb` materials
   * so every character's legs, feet, horse hooves, arms, and weapons visibly walk, gallop, and brawl!
   * For `rook-swamp-draghessa`, `dragonCoilMode > 0` drives a perpetual, slow, inexorable 3D helical
   * coiling of the Dragon around the stationary stone watchtower.
   */
  injectLocomotionShader(mat, pieceType, uniforms, dragonCoilMode = 0.0) {
    if (!mat || !uniforms) return;
    mat.customProgramCacheKey = () =>
      `carchess_loco_v4_${pieceType}_dc${dragonCoilMode}_${mat.wireframe ? 'w' : 's'}_${mat.map ? 't' : 'u'}`;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWalkPhase = uniforms.uWalkPhase;
      shader.uniforms.uWalkAmp = uniforms.uWalkAmp;
      shader.uniforms.uCombatPhase = uniforms.uCombatPhase;
      shader.uniforms.uCombatAmp = uniforms.uCombatAmp;
      shader.uniforms.uGaitMode = uniforms.uGaitMode;
      shader.uniforms.uIdlePhase = uniforms.uIdlePhase;
      shader.uniforms.uIdleAmp = uniforms.uIdleAmp;
      shader.uniforms.uPieceKind = uniforms.uPieceKind;
      shader.uniforms.uDragonCoilMode = { value: dragonCoilMode };

      shader.vertexShader =
        `
uniform float uWalkPhase;
uniform float uWalkAmp;
uniform float uCombatPhase;
uniform float uCombatAmp;
uniform float uGaitMode;
uniform float uIdlePhase;
uniform float uIdleAmp;
uniform float uPieceKind;
uniform float uDragonCoilMode;
` +
        shader.vertexShader
          .replace(
            '#include <beginnormal_vertex>',
            `#include <beginnormal_vertex>
if (uDragonCoilMode > 0.5) {
  float normYN = clamp(position.y + 0.5, 0.0, 1.0);
  float dMaskN = (uDragonCoilMode < 1.5)
    ? 1.0
    : (smoothstep(0.11, 0.175, length(position.xz)) * smoothstep(0.16, 0.25, normYN) * smoothstep(0.95, 0.82, normYN));
  float coilThetaN = (uIdlePhase * 0.68 + sin(uIdlePhase * 1.15 - normYN * 5.2) * 0.34) * dMaskN;
  float cN = cos(coilThetaN);
  float sN = sin(coilThetaN);
  objectNormal = vec3(
    objectNormal.x * cN - objectNormal.z * sN,
    objectNormal.y,
    objectNormal.x * sN + objectNormal.z * cN
  );
}
`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
float normY = clamp(position.y + 0.5, 0.0, 1.0);
float side = clamp(position.x * 6.5, -1.0, 1.0);
if (uDragonCoilMode > 0.5) {
  // Perpetual, slow, inexorable, scary 3D Dragon Coiling & Slithering around the stationary Watchtower!
  float dMask = (uDragonCoilMode < 1.5)
    ? 1.0
    : (smoothstep(0.11, 0.175, length(position.xz)) * smoothstep(0.16, 0.25, normY) * smoothstep(0.95, 0.82, normY));
  float coilTheta = (uIdlePhase * 0.68 + sin(uIdlePhase * 1.15 - normY * 5.2) * 0.34) * dMask;
  float constrictR = 1.0 + sin(uIdlePhase * 1.85 - normY * 4.2) * 0.065 * dMask;
  float slitherY = sin(uIdlePhase * 1.45 - normY * 6.0) * 0.045 * dMask;
  float cT = cos(coilTheta);
  float sT = sin(coilTheta);
  float rx = (transformed.x * cT - transformed.z * sT) * constrictR;
  float rz = (transformed.x * sT + transformed.z * cT) * constrictR;
  transformed.x = rx;
  transformed.z = rz;
  transformed.y += slitherY;
} else if (uIdleAmp > 0.001 && uWalkAmp < 0.05 && uCombatAmp < 0.05) {
  if (abs(uPieceKind - 1.0) < 0.25) {
    // Knight Seby ('n'): Horse steps/trots in place, nods head & swishes tail!
    float legMask = smoothstep(0.45, 0.03, normY);
    float hoofTrot = sin(uIdlePhase * 2.8 + side * 1.57);
    transformed.y += max(0.0, hoofTrot) * 0.065 * uIdleAmp * legMask;
    transformed.z += hoofTrot * 0.045 * uIdleAmp * legMask;
    float tailMask = smoothstep(-0.04, -0.22, position.z) * smoothstep(0.15, 0.58, normY);
    transformed.x += sin(uIdlePhase * 4.2) * 0.065 * uIdleAmp * tailMask;
    float headMask = smoothstep(0.05, 0.24, position.z) * smoothstep(0.38, 0.78, normY);
    transformed.y += sin(uIdlePhase * 2.1) * 0.035 * uIdleAmp * headMask;
  } else if (uPieceKind < 0.25) {
    // Pawn Puffin ('p'): Fluid S-curve body wave + cute tail-feather wag (scodinzolio)!
    float bodyWave = sin(uIdlePhase * 2.4 - normY * 3.6);
    transformed.x += bodyWave * 0.034 * uIdleAmp * smoothstep(0.08, 0.88, normY);
    float tailMask = smoothstep(0.0, -0.16, position.z) * smoothstep(0.48, 0.08, normY);
    transformed.x += sin(uIdlePhase * 6.8) * 0.068 * uIdleAmp * tailMask;
    transformed.y += abs(cos(uIdlePhase * 6.8)) * 0.025 * uIdleAmp * tailMask;
  } else if (abs(uPieceKind - 2.0) < 0.25) {
    // Bishop Ale ('b'): Shoulder dragon wing-flap & wand gentle figure-8 wave!
    float upperWingMask = smoothstep(0.42, 0.85, normY) * abs(side);
    transformed.y += sin(uIdlePhase * 3.4 + abs(side)) * 0.048 * uIdleAmp * upperWingMask;
    transformed.x += cos(uIdlePhase * 2.2) * 0.024 * uIdleAmp * smoothstep(0.25, 0.85, normY);
  } else if (abs(uPieceKind - 3.0) < 0.25) {
    // Rook Pupurabbu ('r'): Squishy plush monster belly breathing & ear wiggle!
    float breath = sin(uIdlePhase * 2.6) * 0.045 * uIdleAmp;
    float plushMask = smoothstep(0.18, 0.78, normY);
    transformed.x *= (1.0 + breath * plushMask);
    transformed.z *= (1.0 + breath * plushMask);
    transformed.y += cos(uIdlePhase * 2.6) * 0.032 * uIdleAmp * plushMask;
  } else {
    // King Riccardo ('k') & Queen Kate ('q'): Royal chest breathing & sceptre/wand float!
    float regalBreath = sin(uIdlePhase * 2.0) * 0.026 * uIdleAmp;
    transformed.y += regalBreath * smoothstep(0.25, 0.88, normY);
    transformed.x += cos(uIdlePhase * 1.5) * 0.018 * uIdleAmp * smoothstep(0.30, 0.85, normY);
  }
}
if (uWalkAmp > 0.001) {
  if (uGaitMode > 0.5) {
    // Knight Seby Horse Gallop: front legs (z > 0) and hind legs (z < 0) scissor & bound!
    float legMask = smoothstep(0.48, 0.04, normY);
    float frontBack = clamp(position.z * 4.5, -1.0, 1.0);
    float hoofPhase = uWalkPhase + side * 0.45;
    float gallopSwing = sin(hoofPhase) * frontBack;
    transformed.z += gallopSwing * uWalkAmp * 0.25 * legMask;
    transformed.y += max(0.0, cos(hoofPhase) * frontBack) * uWalkAmp * 0.16 * legMask;
    float riderMask = smoothstep(0.45, 0.88, normY);
    transformed.z += sin(uWalkPhase) * uWalkAmp * 0.09 * riderMask;
    transformed.x += cos(uWalkPhase * 0.5) * uWalkAmp * 0.045 * riderMask;
  } else {
    // Biped Walk / March (Puffin, Riccardo, Kate, Ale, Pupurabbu): alternating left/right leg stride!
    float legMask = smoothstep(0.46, 0.04, normY);
    float stride = sin(uWalkPhase) * side;
    float lift = max(0.0, cos(uWalkPhase) * side);
    transformed.z += stride * uWalkAmp * 0.26 * legMask;
    transformed.y += lift * uWalkAmp * 0.16 * legMask;
    // Counter-swinging arms, halberd, sword, wings & torso twist
    float armMask = smoothstep(0.36, 0.68, normY) * (0.35 + 0.65 * abs(side));
    transformed.z -= stride * uWalkAmp * 0.21 * armMask;
    transformed.x += sin(uWalkPhase) * uWalkAmp * 0.05 * smoothstep(0.30, 0.82, normY);
  }
}
if (uCombatAmp > 0.001) {
  // 3D Scazzottata Combat: aggressive weapon slash, upper-body punch/lunge & torso twist!
  float upperMask = smoothstep(0.26, 0.80, normY);
  float slash = sin(uCombatPhase);
  float punch = cos(uCombatPhase * 1.5);
  transformed.z += slash * uCombatAmp * 0.28 * upperMask;
  transformed.x += punch * side * uCombatAmp * 0.16 * upperMask;
  transformed.y += abs(slash) * uCombatAmp * 0.09 * upperMask;
}
`,
          );
    };
  }

  /**
   * Drives the vertex-shader skeletal limb uniforms, the 3D articulated joint hierarchy (`skeletonRig`),
   * and the `bodyContainer` pose on any piece group (used during 2.0s–2.2s board locomotion, 3D Scazzottata combat, AND living idle!).
   */
  applyPoseToPiece(
    pieceGroup,
    {
      walkPhase = 0,
      walkAmp = 0,
      combatPhase = 0,
      combatAmp = 0,
      idlePhase = undefined,
      idleAmp = undefined,
      rearUp = 0,
      bodyY = 0,
      pitchX = 0,
      rollZ = 0,
      yawOffset = 0,
    } = {},
  ) {
    if (!pieceGroup) return;
    const u = pieceGroup.userData?.locomotionUniforms;
    if (u) {
      u.uWalkPhase.value = walkPhase;
      u.uWalkAmp.value = walkAmp;
      u.uCombatPhase.value = combatPhase;
      u.uCombatAmp.value = combatAmp;
      if (idlePhase !== undefined && u.uIdlePhase) u.uIdlePhase.value = idlePhase;
      if (idleAmp !== undefined && u.uIdleAmp) u.uIdleAmp.value = idleAmp;
    }
    const body = pieceGroup.userData?.bodyContainer;
    if (body) {
      body.position.y = bodyY;
      body.rotation.x = pitchX;
      body.rotation.z = rollZ;
      body.rotation.y = yawOffset;
    }
    const rig = pieceGroup.userData?.skeletonRig;
    if (rig) {
      rig.userData.alwaysVisible = this.skeletonsVisible;
      updateSkeletonRigPose(rig, pieceGroup.userData?.type, {
        walkPhase,
        walkAmp,
        combatPhase,
        combatAmp,
        idlePhase: idlePhase ?? u?.uIdlePhase?.value ?? 0.65,
        idleAmp: idleAmp ?? u?.uIdleAmp?.value ?? 0.45,
        rearUp,
        pitchX,
        skeletonsVisible: this.skeletonsVisible,
      });
    }
  }

  loadGltfCached(url) {
    if (!url) return Promise.reject(new Error('No GLB URL'));
    if (this.gltfCache.has(url)) {
      return this.gltfCache.get(url);
    }
    const promise = new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (err) => reject(err),
      );
    });
    this.gltfCache.set(url, promise);
    return promise;
  }

  loadPortraitTexture(url, label = 'Hero', isWhite = true) {
    const cacheKey = `${url || label}_${isWhite ? 'w' : 'b'}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    // Create a 512x512 CanvasTexture and keep its 2D context so WebGL2 texStorage2D never changes dimensions!
    const tex = this.createPlaceholderPortraitTexture(label, isWhite);
    this.textureCache.set(cacheKey, tex);

    if (url && typeof Image !== 'undefined') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = tex.userData?.ctx;
        if (!c) return;
        const size = 512;
        c.save();
        c.clearRect(0, 0, size, size);

        // Background radial glow
        const bgGrad = c.createRadialGradient(256, 220, 24, 256, 256, 256);
        bgGrad.addColorStop(0, isWhite ? '#fffdf5' : '#2d3752');
        bgGrad.addColorStop(1, isWhite ? '#e2c178' : '#121726');
        c.fillStyle = bgGrad;
        c.fillRect(0, 0, size, size);

        // Circular clip for portrait
        c.save();
        c.beginPath();
        c.arc(256, 256, 240, 0, Math.PI * 2);
        c.clip();

        // Smart crop: if 16:9 2-up turnaround sheet, crop the left-half character bust
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;
        if (img.width > img.height * 1.22) {
          sx = img.width * 0.04;
          sy = img.height * 0.02;
          sw = img.width * 0.44;
          sh = img.height * 0.66;
        } else {
          const minDim = Math.min(img.width, img.height);
          sx = (img.width - minDim) * 0.5;
          sy = (img.height - minDim) * 0.15;
          sw = minDim;
          sh = minDim;
        }
        c.drawImage(img, sx, sy, sw, sh, 16, 16, 480, 480);

        // Sleek royal name pill at bottom of medallion
        const pillGrad = c.createLinearGradient(0, 396, 0, 496);
        pillGrad.addColorStop(0, isWhite ? 'rgba(34, 24, 8, 0.0)' : 'rgba(10, 14, 26, 0.0)');
        pillGrad.addColorStop(0.28, isWhite ? 'rgba(34, 24, 8, 0.86)' : 'rgba(14, 20, 36, 0.90)');
        pillGrad.addColorStop(1, isWhite ? 'rgba(24, 16, 4, 0.95)' : 'rgba(8, 12, 24, 0.96)');
        c.fillStyle = pillGrad;
        c.fillRect(0, 392, size, 120);

        c.fillStyle = isWhite ? '#ffe082' : '#e3f2fd';
        c.font = '900 40px system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.shadowColor = 'rgba(0,0,0,0.85)';
        c.shadowBlur = 8;
        c.fillText(String(label || 'Hero').slice(0, 11), 256, 450);
        c.restore();

        // Outer gleaming faction ring
        c.strokeStyle = isWhite ? '#ffd54f' : '#b3e5fc';
        c.lineWidth = 18;
        c.beginPath();
        c.arc(256, 256, 238, 0, Math.PI * 2);
        c.stroke();

        c.restore();
        tex.needsUpdate = true;
      };
      img.src = url;
    }
    return tex;
  }

  createPlaceholderPortraitTexture(label, isWhite) {
    if (typeof document === 'undefined') {
      return new THREE.Texture();
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const c = canvas.getContext('2d');
    if (c) {
      const grad = c.createRadialGradient(256, 220, 36, 256, 256, 256);
      grad.addColorStop(0, isWhite ? '#fff7e0' : '#323c54');
      grad.addColorStop(1, isWhite ? '#d9b36c' : '#141824');
      c.fillStyle = grad;
      c.fillRect(0, 0, 512, 512);

      c.strokeStyle = isWhite ? '#ffd54f' : '#90caf9';
      c.lineWidth = 18;
      c.beginPath();
      c.arc(256, 256, 236, 0, Math.PI * 2);
      c.stroke();

      c.fillStyle = isWhite ? '#2c1e08' : '#e8eef7';
      c.font = 'bold 58px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(label || 'Carlesso').slice(0, 10), 256, 260);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData = { canvas, ctx: c };
    return texture;
  }

  /**
   * Plays a skeletal animation clip (`Idle_Track`, `FireBreath_Track`) or triggers
   * a lively procedural bounce/spin emote when a piece has no skeletal clip.
   * @param {THREE.Object3D} pieceGroup
   * @param {string} clipKey
   */
  playClip(pieceGroup, clipKey = 'Idle') {
    if (!pieceGroup) return;
    const mappedName = CLIP_NAME_MAP[clipKey] || clipKey;
    const entry = pieceGroup.userData?.mixerEntry;

    if (entry && entry.clips.size > 0) {
      const clip =
        entry.clips.get(mappedName) ||
        entry.clips.get(clipKey) ||
        Array.from(entry.clips.values()).find((c) =>
          c.name.toLowerCase().includes(String(clipKey).toLowerCase()),
        ) ||
        Array.from(entry.clips.values())[0];

      if (clip) {
        const nextAction = entry.mixer.clipAction(clip);
        if (entry.activeAction && entry.activeAction !== nextAction) {
          entry.activeAction.fadeOut(0.18);
        }
        nextAction.reset().fadeIn(0.18).play();
        if (mappedName === 'FireBreath_Track' || clipKey === 'Click_Fire_Breath') {
          nextAction.setLoop(THREE.LoopOnce, 1);
          nextAction.clampWhenFinished = true;
          // Return smoothly to Idle_Track after fire-breath clip completes
          const durationMs = Math.max(800, (clip.duration || 1.5) * 1000);
          setTimeout(() => {
            if (pieceGroup.parent) this.playClip(pieceGroup, 'Idle_Track');
          }, durationMs);
        }
        entry.activeAction = nextAction;
        return;
      }
    }

    // Procedural lively emote bounce/spin for non-rigged pieces
    this.activeTweens.push({
      kind: 'emote',
      group: pieceGroup,
      elapsed: 0,
      duration: 0.65,
      startY: pieceGroup.position.y,
      baseRotY: pieceGroup.rotation.y,
    });
    this.activeMoves = this.activeTweens;
  }

  /**
   * Completes the capture handoff when `BATTLE_COMPLETED` or `BATTLE_SKIPPED` fires:
   * reveals the victorious attacker on `toPos` and launches the defeated piece into the Ogre's Swamp!
   */
  completePendingCaptureHandoff() {
    if (!this.pendingCaptureHandoff) return;
    const h = this.pendingCaptureHandoff;
    this.pendingCaptureHandoff = null;

    if (h.movingGroup) {
      h.movingGroup.visible = true;
      h.movingGroup.position.set(h.toX, 0, h.toZ);
      const homeYaw =
        h.movingGroup.userData.homeYaw ?? (h.movingGroup.userData.color === 'w' ? Math.PI : 0);
      h.movingGroup.rotation.set(0, homeYaw, 0);
      this.applyPoseToPiece(h.movingGroup, {});
      this.triggerSquashLanding(h.movingGroup);
    }

    if (h.newestSwimmer) {
      h.newestSwimmer.visible = true;
      h.newestSwimmer.userData.isDivingToSwamp = true;
      this.activeTweens.push({
        kind: 'swamp_splash_dive',
        group: h.newestSwimmer,
        fromX: h.capWorld.x,
        fromY: 0,
        fromZ: h.capWorld.z,
        toX: h.destX,
        toY: h.destY,
        toZ: h.destZ,
        hPeak: 2.35,
        elapsed: 0,
        duration: 0.85,
      });
      this.activeMoves = this.activeTweens;
    }
  }

  /**
   * Animates a moving piece over `2.0s` (`2.2s` for Knight Seby) with character-specific
   * skeletal limb locomotion (Pawn Puffin march, Seby horse rear-up & gallop, Ale winged glide,
   * Pupurabbu heavy bounds, Kate royal twirl, Riccardo pompous swagger).
   */
  animateMove(move, updatedLiving, updatedCaptured) {
    const isCastle = move.flags && (move.flags.includes('k') || move.flags.includes('q'));
    if (isCastle) {
      // Handled by animateCastlingBellyBounce; just ensure trays are synced
      this.renderCapturedTrays(updatedCaptured);
      return;
    }

    const movingGroup = this.pieceBySquare.get(move.from);
    if (!movingGroup || Boolean(move.promotion)) {
      // On promotion or missing group, rebuild cleanly and play landing squash on target
      this.syncPiecesFromManager(updatedLiving, updatedCaptured);
      const promoted = this.pieceBySquare.get(move.to);
      if (promoted) this.triggerSquashLanding(promoted);
      return;
    }

    // Remove any captured piece mesh at destination (or en-passant square)
    const capturedSq = move.flags?.includes('e') ? `${move.to[0]}${move.from[1]}` : move.to;
    if (move.captured) {
      const victimGroup = this.pieceBySquare.get(capturedSq);
      if (victimGroup && victimGroup !== movingGroup) {
        this.livingGroup.remove(victimGroup);
        this.pieceBySquare.delete(capturedSq);
      }
    }

    this.pieceBySquare.delete(move.from);
    movingGroup.userData.square = move.to;
    this.pieceBySquare.set(move.to, movingGroup);
    this._tagRaycastHierarchy(movingGroup);
    this.renderCapturedTrays(updatedCaptured);

    const startPos = squareToWorld(move.from);
    const endPos = squareToWorld(move.to);
    const pieceType = String(move.piece || movingGroup.userData.type || 'p').toLowerCase();

    // If a piece was captured, prepare handoff for BATTLE_STARTED (or immediate dive if no battle listener)
    let newestSwimmer = null;
    if (move.captured && this.trayGroup.children.length > 0) {
      const victimColor = move.color === 'w' ? 'b' : 'w';
      const swimmersForVictim = this.trayGroup.children.filter((c) => c.userData?.color === victimColor);
      newestSwimmer = swimmersForVictim[swimmersForVictim.length - 1] || null;
      if (newestSwimmer) {
        const capWorld = squareToWorld(capturedSq);
        const destX = newestSwimmer.position.x;
        const destY = newestSwimmer.userData.baseSwampY ?? -0.28;
        const destZ = newestSwimmer.position.z;
        newestSwimmer.userData.isDivingToSwamp = true;
        this.pendingCaptureHandoff = {
          movingGroup,
          newestSwimmer,
          toX: endPos.x,
          toZ: endPos.z,
          capWorld,
          destX,
          destY,
          destZ,
        };
        this.activeTweens.push({
          kind: 'swamp_splash_dive',
          group: newestSwimmer,
          fromX: capWorld.x,
          fromY: 0,
          fromZ: capWorld.z,
          toX: destX,
          toY: destY,
          toZ: destZ,
          hPeak: 2.35,
          elapsed: 0,
          duration: 0.78,
        });
      }
    }

    // Remove any previous locomotion tween on this piece
    this.activeTweens = this.activeTweens.filter((tw) => tw.group !== movingGroup);

    const duration = pieceType === 'n' ? 2.2 : 2.0;
    const dx = endPos.x - startPos.x;
    const dz = endPos.z - startPos.z;
    const travelYaw = Math.atan2(dx, dz);
    const homeYaw = movingGroup.userData.homeYaw ?? (movingGroup.userData.color === 'w' ? Math.PI : 0);

    // For Knight Seby ('n'), compute the L-shaped corner midpoint so the horse gallops along the L!
    const cornerX = Math.abs(dx) > Math.abs(dz) ? endPos.x : startPos.x;
    const cornerZ = Math.abs(dx) > Math.abs(dz) ? startPos.z : endPos.z;

    // Immediately engage initial walking/galloping pose & stamp takeoff footstep/hoofprint
    this.applyPoseToPiece(movingGroup, {
      walkPhase: 0.75,
      walkAmp: 1.35,
      rearUp: pieceType === 'n' ? 0.65 : 0,
      bodyY: 0.08,
      pitchX: pieceType === 'n' ? -0.28 : 0.12,
    });
    this.spawnFootstepPrint(
      startPos.x,
      startPos.z,
      travelYaw,
      pieceType,
      movingGroup.userData.color,
      1,
    );

    this.activeTweens.push({
      kind: 'character_locomotion',
      group: movingGroup,
      pieceType,
      fromX: startPos.x,
      fromZ: startPos.z,
      toX: endPos.x,
      toZ: endPos.z,
      cornerX,
      cornerZ,
      travelYaw,
      homeYaw,
      elapsed: 0,
      duration,
      lastStepIndex: 0,
    });
    this.activeMoves = this.activeTweens;
  }

  /**
   * Riccardo <-> Pupurabbu Belly-Bounce Castling (`CASTLING_EXECUTED`):
   * King and Rook leap toward each other, do a celebratory mid-air belly-bounce
   * at the midpoint (`t = 0.5`), and land in their castled squares!
   */
  animateCastlingBellyBounce(e) {
    const kingGroup = this.pieceBySquare.get(e.kingFrom) || this.pieceBySquare.get(e.kingTo);
    const rookGroup = this.pieceBySquare.get(e.rookFrom) || this.pieceBySquare.get(e.rookTo);
    if (!kingGroup || !rookGroup) {
      this.syncPiecesFromManager();
      return;
    }

    this.pieceBySquare.delete(e.kingFrom);
    this.pieceBySquare.delete(e.rookFrom);
    kingGroup.userData.square = e.kingTo;
    rookGroup.userData.square = e.rookTo;
    this.pieceBySquare.set(e.kingTo, kingGroup);
    this.pieceBySquare.set(e.rookTo, rookGroup);
    this._tagRaycastHierarchy(kingGroup);
    this._tagRaycastHierarchy(rookGroup);

    const kStart = squareToWorld(e.kingFrom);
    const kEnd = squareToWorld(e.kingTo);
    const rStart = squareToWorld(e.rookFrom);
    const rEnd = squareToWorld(e.rookTo);
    const midX = (kStart.x + rStart.x) * 0.5;
    const midZ = kStart.z;

    this.activeTweens.push({
      kind: 'castling_belly_bounce',
      kingGroup,
      rookGroup,
      kStart,
      kEnd,
      rStart,
      rEnd,
      midX,
      midZ,
      elapsed: 0,
      duration: 1.6,
      bounced: false,
    });
    this.activeMoves = this.activeTweens;
  }

  triggerSquashLanding(group) {
    this.activeTweens.push({
      kind: 'squash_landing',
      group,
      elapsed: 0,
      duration: 0.28,
    });
    this.activeMoves = this.activeTweens;
  }

  /**
   * Spectacular 3D Royal Capitulation (`CHECKMATE`):
   * - The defeated King trembles violently, leaps in slow-motion, and topples 84° onto the board!
   * - All surviving victorious pieces jump in celebratory waves!
   */
  animateKingCapitulation(e = {}) {
    const loserColor = e.loser ? String(e.loser).toLowerCase() : (e.winner === 'w' ? 'b' : 'w');
    const winnerColor = loserColor === 'w' ? 'b' : 'w';
    let kingGroup = e.kingSquare ? this.pieceBySquare.get(e.kingSquare) : null;

    if (!kingGroup) {
      for (const grp of this.pieceBySquare.values()) {
        if (grp.userData?.type === 'k' && grp.userData?.color === loserColor) {
          kingGroup = grp;
          break;
        }
      }
    }

    if (kingGroup) {
      const fallSign = loserColor === 'w' ? 1 : -1;
      this.activeTweens.push({
        kind: 'king_capitulation',
        group: kingGroup,
        baseX: kingGroup.position.x,
        baseZ: kingGroup.position.z,
        fallSign,
        elapsed: 0,
        duration: 2.8,
      });
    }

    let idx = 0;
    for (const grp of this.pieceBySquare.values()) {
      if (grp.userData?.color === winnerColor) {
        this.activeTweens.push({
          kind: 'victory_jump',
          group: grp,
          baseY: 0,
          baseRotY: grp.rotation.y,
          phaseOffset: (idx % 5) * 0.14,
          elapsed: 0,
          duration: 3.2,
        });
        idx += 1;
      }
    }
    this.activeMoves = this.activeTweens;
  }

  /**
   * Creates a standalone 3D piece Group for Mode 2 WOW 360° Turntable Inspector & 3D Scazzottata Stage.
   * @param {string} type - 'k'|'q'|'b'|'n'|'r'|'p'
   * @param {'w'|'b'} [color='w']
   * @param {{ isStoneSet?: boolean, bishopVariant?: 'hat'|'astrolabe'|'rigged', queenVariant?: 'young'|'wedding', knightVariant?: 'classic'|'lightsaber'|'halberd'|'aurora' }} [opts]
   * @returns {THREE.Group}
   */
  createStandalonePiece(type = 'b', color = 'w', opts = {}) {
    const pm = this.ctx?.pieces || this.ctx?.pieceManager;
    const raw = { type, color, square: 'e4' };
    const desc = pm?.resolveDescriptor ? pm.resolveDescriptor(raw) : this._fallbackDescriptor(raw);
    if (typeof opts.isStoneSet === 'boolean') {
      desc.isStoneSet = opts.isStoneSet;
    }
    if (type === 'b' && opts.bishopVariant) {
      desc.glbUrl = opts.bishopVariant === 'hat'
        ? 'assets/models/bishop-ale-1.glb'
        : (opts.bishopVariant === 'astrolabe' ? 'assets/models/bishop-ale-2-remastered.glb' : 'assets/models/bishop-ale-rigged.glb');
    }
    if (type === 'q' && opts.queenVariant) {
      desc.glbUrl = opts.queenVariant === 'wedding'
        ? 'assets/models/queen-kate-wedding2016-remastered.glb'
        : 'assets/models/queen-kate.glb';
    }
    if (type === 'n' && opts.knightVariant) {
      desc.glbUrl = opts.knightVariant === 'lightsaber'
        ? 'assets/models/knight-seby-lightsaber.glb'
        : (opts.knightVariant === 'halberd'
          ? 'assets/models/knight-seby-halberd.glb'
          : (opts.knightVariant === 'aurora'
            ? 'assets/models/knight-seby-aurora.glb'
            : 'assets/models/knight-seby.glb'));
    }
    const group = this.buildPieceGroup(desc);
    group.position.set(0, 0, 0);
    group.rotation.y = 0;
    group.userData.homeYaw = 0;
    return group;
  }

  getPieceObject(square) {
    return this.pieceBySquare.get(square) || null;
  }

  getAllPieceObjects() {
    return Array.from(this.pieceBySquare.values());
  }

  setHoveredSquare(square = null) {
    this.hoveredSquare = square || null;
  }

  setPieceScale(scale = 1.0) {
    this.globalPieceScale = Math.max(0.5, Math.min(1.6, Number(scale) || 1.0));
    for (const group of this.pieceBySquare.values()) {
      group.userData.baseScale = this.globalPieceScale;
      group.scale.setScalar(this.globalPieceScale);
    }
  }

  _tagRaycastHierarchy(rootPieceGroup) {
    rootPieceGroup.traverse((child) => {
      child.userData = child.userData || {};
      child.userData.pieceRoot = rootPieceGroup;
      child.userData.square = rootPieceGroup.userData.square;
    });
  }

  clearGroup(group) {
    for (const entry of [...this.activeMixers]) {
      if (group.children.includes(entry.root)) {
        entry.mixer.stopAllAction();
        this.activeMixers.delete(entry);
      }
    }
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
  }

  /**
   * Advances all `AnimationMixer` instances, living idle animations for all 32 board pieces,
   * footstep trails, swamp swimmers, and active character locomotion tweens.
   * @param {number} dt - Delta time in seconds
   */
  update(dt = 1 / 60) {
    for (const entry of this.activeMixers) {
      entry.mixer.update(dt);
    }

    this.swampTime += dt;

    // 1. Update fading board footstep & hoofprint rings
    for (const slot of this.footstepPool) {
      if (!slot.active) continue;
      slot.age += dt;
      if (slot.age >= slot.maxAge) {
        slot.active = false;
        slot.mesh.visible = false;
      } else {
        const ratio = slot.age / slot.maxAge;
        slot.mesh.material.opacity = Math.max(0, (1 - ratio) * 0.85);
        slot.mesh.scale.setScalar(0.9 + ratio * 0.45);
      }
    }

    // 2. Continuous Living Idle Animations for all 32 pieces on the board!
    //    (Knight horse stepping in place, Puffin fluid body sway & tail wag,
    //     Ale dragon wing-flap, Pupurabbu squishy bounce, Riccardo & Kate royal breathing)
    for (const group of this.pieceBySquare.values()) {
      const isTweening = this.activeTweens.some(
        (tw) => tw.group === group || tw.kingGroup === group || tw.rookGroup === group,
      );
      if (isTweening) continue;

      const u = group.userData?.locomotionUniforms;
      if (u && (u.uWalkAmp.value > 0.02 || u.uCombatAmp.value > 0.04)) continue;

      const sq = group.userData?.square;
      const isHovered = Boolean(sq && this.hoveredSquare === sq);
      const prevBoost = group.userData.hoverBoost || 0;
      const nextBoost = isHovered
        ? Math.min(1, prevBoost + dt * 7.5)
        : Math.max(0, prevBoost - dt * 5.0);
      group.userData.hoverBoost = nextBoost;

      const phaseOffset =
        group.userData.idlePhaseOffset ??
        (group.position.x * 1.3 + group.position.z * 1.7);
      const speedMult = 1.0 + nextBoost * 0.85;
      group.userData.idleTime = (group.userData.idleTime ?? phaseOffset) + dt * speedMult;
      const tIdle = group.userData.idleTime;
      const ampMult = 1.0 + nextBoost * 0.75;
      const pType = group.userData.type || 'p';

      let bodyY = nextBoost * 0.045;
      let pitchX = 0;
      let rollZ = 0;
      let yawOffset = 0;
      const body = group.userData.bodyContainer;

      if (pType === 'n') {
        // Knight Seby: Horse gently steps/trots in place, nods head & swishes tail
        const trot = Math.abs(Math.sin(tIdle * 2.8));
        bodyY += trot * 0.036 * ampMult;
        pitchX = Math.sin(tIdle * 2.8) * 0.048 * ampMult;
        rollZ = Math.cos(tIdle * 1.4) * 0.035 * ampMult;
        yawOffset = Math.sin(tIdle * 1.1) * 0.055 * ampMult;
      } else if (pType === 'p') {
        // Pawn Puffin: Fluid S-curve waddle sway + cute tail-feather wag
        bodyY += Math.abs(Math.sin(tIdle * 2.4)) * 0.028 * ampMult;
        rollZ = Math.sin(tIdle * 2.4) * 0.078 * ampMult;
        pitchX = Math.cos(tIdle * 4.8) * 0.032 * ampMult;
        yawOffset = Math.sin(tIdle * 3.4) * 0.085 * ampMult;
      } else if (pType === 'b') {
        // Bishop Ale: Shoulder dragon wing-beat lift & arcane wand sway
        bodyY += (Math.sin(tIdle * 3.2) * 0.5 + 0.5) * 0.042 * ampMult;
        rollZ = Math.cos(tIdle * 1.6) * 0.042 * ampMult;
        yawOffset = Math.sin(tIdle * 1.6) * 0.052 * ampMult;
      } else if (pType === 'r') {
        // Rook Pupurabbu: Squishy plush monster bounce & squash-stretch breathing
        const bounce = Math.sin(tIdle * 2.6);
        bodyY += Math.max(0, bounce) * 0.045 * ampMult;
        rollZ = Math.sin(tIdle * 1.3) * 0.055 * ampMult;
        if (body) {
          const sqFactor = 1 + bounce * 0.038 * ampMult;
          body.scale.set(1 / Math.sqrt(sqFactor), sqFactor, 1 / Math.sqrt(sqFactor));
        }
      } else if (pType === 'q') {
        // Queen Kate: Poised royal breathing & graceful wand sway
        bodyY += (Math.sin(tIdle * 1.9) * 0.5 + 0.5) * 0.028 * ampMult;
        rollZ = Math.sin(tIdle * 1.2) * 0.036 * ampMult;
        yawOffset = Math.cos(tIdle * 1.1) * 0.045 * ampMult;
      } else {
        // King Riccardo: Proud dad-king chest breathing & sceptre bob
        bodyY += (Math.sin(tIdle * 2.1) * 0.5 + 0.5) * 0.032 * ampMult;
        pitchX = Math.sin(tIdle * 2.1) * 0.028 * ampMult;
        yawOffset = Math.sin(tIdle * 1.05) * 0.042 * ampMult;
      }

      if (pType !== 'r' && body) {
        body.scale.set(1, 1, 1);
      }

      if (u) {
        if (u.uIdlePhase) u.uIdlePhase.value = tIdle;
        if (u.uIdleAmp) u.uIdleAmp.value = ampMult;
      }
      if (body) {
        body.position.y = bodyY;
        body.rotation.x = pitchX;
        body.rotation.z = rollZ;
        body.rotation.y = yawOffset;
      }

      const rig = group.userData?.skeletonRig;
      if (rig) {
        rig.userData.alwaysVisible = this.skeletonsVisible;
        updateSkeletonRigPose(rig, pType, {
          idlePhase: tIdle * 2.2,
          idleAmp: 0.45 * ampMult,
          skeletonsVisible: this.skeletonsVisible,
        });
      }
    }

    // 3. Animate captured ("dead") pieces splashing happily on 3D lily-pads in the Ogre's Swamp!
    if (this.trayGroup.children.length > 0) {
      for (let i = 0; i < this.trayGroup.children.length; i++) {
        const swimmer = this.trayGroup.children[i];
        if (swimmer.userData.isDivingToSwamp) continue;
        const phase = swimmer.userData.swampPhase ?? i * 1.3;
        const baseY = swimmer.userData.baseSwampY ?? -0.28;
        const baseYaw = swimmer.userData.baseSwampYaw ?? 0;

        // Playful bobbing up & down + side-to-side paddling ("sguazzano!")
        swimmer.position.y = baseY + Math.sin(this.swampTime * 3.4 + phase) * 0.085;
        swimmer.rotation.z = Math.sin(this.swampTime * 2.7 + phase) * 0.16;
        swimmer.rotation.x = Math.cos(this.swampTime * 2.1 + phase * 0.8) * 0.11;
        swimmer.rotation.y = baseYaw + Math.sin(this.swampTime * 1.5 + phase) * 0.42;

        const splash = swimmer.userData.swampSplash?.userData;
        if (splash) {
          const p1 = (this.swampTime * 0.85 + phase * 0.3) % 1;
          const p2 = (this.swampTime * 0.85 + phase * 0.3 + 0.5) % 1;
          if (splash.ripple1) {
            splash.ripple1.scale.setScalar(0.85 + p1 * 0.75);
            splash.ripple1.material.opacity = Math.max(0.15, (1 - p1) * 0.85);
          }
          if (splash.ripple2) {
            splash.ripple2.scale.setScalar(0.85 + p2 * 0.85);
            splash.ripple2.material.opacity = Math.max(0.12, (1 - p2) * 0.75);
          }
          if (splash.lotusFlower) {
            splash.lotusFlower.rotation.y = this.swampTime * 0.9 + phase;
          }
          if (splash.celebrationRing && swimmer.userData.celebrationSplashTimer > 0) {
            swimmer.userData.celebrationSplashTimer = Math.max(
              0,
              swimmer.userData.celebrationSplashTimer - dt,
            );
            const cProg = 1 - swimmer.userData.celebrationSplashTimer / 1.1;
            splash.celebrationRing.scale.setScalar(0.8 + cProg * 1.85);
            splash.celebrationRing.material.opacity = Math.max(0, (1 - cProg) * 0.92);
          }
          if (Array.isArray(splash.bubbles)) {
            for (const b of splash.bubbles) {
              const bp = (this.swampTime * 1.4 + b.userData.phaseOffset) % 1;
              const ang =
                b.userData.angle + Math.sin(this.swampTime * 2 + b.userData.phaseOffset) * 0.3;
              const rad = b.userData.rad + bp * 0.12;
              b.position.set(Math.cos(ang) * rad, 0.25 + bp * 0.55, Math.sin(ang) * rad);
              b.scale.setScalar(0.6 + Math.sin(bp * Math.PI) * 0.65);
            }
          }
        }
      }
    }

    if (this.activeTweens.length === 0) return;
    const remaining = [];

    for (const tw of this.activeTweens) {
      tw.elapsed += dt;
      const t = Math.min(1, tw.elapsed / Math.max(0.001, tw.duration));

      if (tw.kind === 'character_locomotion') {
        const {
          group,
          pieceType,
          fromX,
          fromZ,
          toX,
          toZ,
          cornerX,
          cornerZ,
          travelYaw,
          homeYaw,
        } = tw;
        const s = this.globalPieceScale;
        const env = Math.sin(t * Math.PI);

        // Smooth S-curve progress so acceleration & deceleration feel weighty
        const smoothT = t * t * (3 - 2 * t);

        // Turn toward travel direction during walk, returning smoothly to homeYaw at landing (t > 0.86)
        let currentYaw = travelYaw;
        if (t > 0.86) {
          const returnAlpha = (t - 0.86) / 0.14;
          let diff = homeYaw - travelYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          currentYaw = travelYaw + diff * returnAlpha;
        }
        group.rotation.y = currentYaw;

        if (pieceType === 'n') {
          // KNIGHT SEBY ("Cavalcata di Seby", 2.2s):
          // Phase 1 (t = 0..0.18): Horse rears up heroically on its hind legs!
          // Phase 2 (t = 0.18..1.0): 4 galloping bounds along the curved L-path!
          if (t < 0.18) {
            const rearU = t / 0.18;
            const rearArc = Math.max(0.35, Math.sin(rearU * Math.PI));
            group.position.set(fromX, rearArc * 0.08, fromZ);
            this.applyPoseToPiece(group, {
              walkPhase: 0.65 + rearU * Math.PI * 3,
              walkAmp: 1.30 * rearArc,
              rearUp: rearArc,
              bodyY: rearArc * 0.24,
              pitchX: -0.46 * rearArc,
              rollZ: Math.sin(rearU * Math.PI * 2) * 0.08,
            });
          } else {
            const gallopU = (t - 0.18) / 0.82;
            const inv = 1 - gallopU;
            // Quadratic Bezier curve through the L-corner so Seby gallops along the L!
            const x = inv * inv * fromX + 2 * inv * gallopU * cornerX + gallopU * gallopU * toX;
            const z = inv * inv * fromZ + 2 * inv * gallopU * cornerZ + gallopU * gallopU * toZ;

            const bounds = 4;
            const boundCycle = gallopU * bounds;
            const boundFrac = boundCycle % 1;
            const hopY = Math.sin(boundFrac * Math.PI) * 0.52;
            const pitchX = Math.cos(boundFrac * Math.PI) * 0.34;
            const rollZ = Math.sin(boundCycle * Math.PI) * 0.10;

            group.position.set(x, hopY * 0.35, z);
            this.applyPoseToPiece(group, {
              walkPhase: 0.65 + boundCycle * Math.PI * 2,
              walkAmp: 1.48,
              rearUp: Math.max(0, Math.cos(boundFrac * Math.PI) * 0.45),
              bodyY: hopY * 0.65,
              pitchX,
              rollZ,
            });

            const stepIdx = Math.floor(boundCycle * 2);
            if (stepIdx > (tw.lastStepIndex || 0)) {
              tw.lastStepIndex = stepIdx;
              this.spawnFootstepPrint(
                x,
                z,
                currentYaw,
                'n',
                group.userData.color,
                stepIdx % 2 === 0 ? 1 : -1,
              );
            }
          }
        } else if (pieceType === 'p') {
          // PAWN PUFFIN ("Camminata di Puffin", 2.0s):
          // 8 brisk Swiss-Guard marching steps with alternating feet & cute waddle!
          const steps = 8;
          const stepPhase = 0.55 + t * Math.PI * steps;
          const stepBounce = Math.abs(Math.sin(stepPhase));
          const x = fromX + (toX - fromX) * smoothT;
          const z = fromZ + (toZ - fromZ) * smoothT;

          group.position.set(x, stepBounce * 0.05, z);
          this.applyPoseToPiece(group, {
            walkPhase: stepPhase * 2,
            walkAmp: Math.max(0.85, 1.38 * Math.min(1, env * 1.8)),
            bodyY: stepBounce * 0.16,
            pitchX: 0.16 * env + Math.cos(stepPhase * 2) * 0.06,
            rollZ: Math.sin(stepPhase) * 0.21,
          });

          const stepIdx = Math.floor(t * steps);
          if (stepIdx > (tw.lastStepIndex || 0)) {
            tw.lastStepIndex = stepIdx;
            this.spawnFootstepPrint(
              x,
              z,
              currentYaw,
              'p',
              group.userData.color,
              stepIdx % 2 === 0 ? 1 : -1,
            );
          }
        } else if (pieceType === 'b') {
          // BISHOP ALE ("Volo col Draghetto di Ale", 2.0s):
          // Swooping diagonal flight with 6 wing-beats & banking turn!
          const wingBeats = 6;
          const beatPhase = 0.55 + t * Math.PI * wingBeats;
          const x = fromX + (toX - fromX) * smoothT;
          const z = fromZ + (toZ - fromZ) * smoothT;
          const flightY = env * 0.38 + Math.abs(Math.sin(beatPhase)) * 0.12;

          group.position.set(x, flightY * 0.4, z);
          this.applyPoseToPiece(group, {
            walkPhase: beatPhase * 2,
            walkAmp: Math.max(0.85, 1.2 * Math.min(1, env * 1.6)),
            bodyY: flightY * 0.6,
            pitchX: 0.22 * env,
            rollZ: Math.sin(beatPhase) * 0.15,
          });
        } else if (pieceType === 'r') {
          // ROOK PUPURABBU ("Balzi di Pupurabbu", 2.0s):
          // 5 heavy plushie bounds with squash-and-stretch on each bounce!
          const hops = 5;
          const hopPhase = 0.55 + t * Math.PI * hops;
          const hopSin = Math.abs(Math.sin(hopPhase));
          const x = fromX + (toX - fromX) * smoothT;
          const z = fromZ + (toZ - fromZ) * smoothT;

          group.position.set(x, hopSin * 0.14, z);
          const squash = 1 + (hopSin - 0.4) * 0.16;
          group.scale.set(s / Math.sqrt(squash), s * squash, s / Math.sqrt(squash));
          this.applyPoseToPiece(group, {
            walkPhase: hopPhase * 2,
            walkAmp: 1.28,
            bodyY: hopSin * 0.26,
            pitchX: Math.cos(hopPhase * 2) * 0.18,
            rollZ: Math.sin(hopPhase) * 0.16,
          });
        } else if (pieceType === 'q') {
          // QUEEN KATE ("Passo Reale & Pirouette di Kate", 2.0s):
          const steps = 7;
          const stepPhase = 0.55 + t * Math.PI * steps;
          const x = fromX + (toX - fromX) * smoothT;
          const z = fromZ + (toZ - fromZ) * smoothT;
          const twirlYaw = Math.sin(t * Math.PI) * Math.PI * 2;

          group.position.set(x, Math.abs(Math.sin(stepPhase)) * 0.06, z);
          this.applyPoseToPiece(group, {
            walkPhase: stepPhase * 2,
            walkAmp: Math.max(0.85, 1.22 * Math.min(1, env * 1.7)),
            bodyY: Math.abs(Math.sin(stepPhase)) * 0.15,
            pitchX: 0.12 * env,
            rollZ: Math.sin(stepPhase) * 0.14,
            yawOffset: twirlYaw,
          });
        } else {
          // KING RICCARDO ("Marcia Solenne di Riccardo", 2.0s):
          const steps = 6;
          const stepPhase = 0.55 + t * Math.PI * steps;
          const stepBounce = Math.abs(Math.sin(stepPhase));
          const x = fromX + (toX - fromX) * smoothT;
          const z = fromZ + (toZ - fromZ) * smoothT;

          group.position.set(x, stepBounce * 0.05, z);
          this.applyPoseToPiece(group, {
            walkPhase: stepPhase * 2,
            walkAmp: Math.max(0.85, 1.32 * Math.min(1, env * 1.8)),
            bodyY: stepBounce * 0.15,
            pitchX: 0.12 * env,
            rollZ: Math.sin(stepPhase) * 0.18,
          });
        }

        if (t < 1) {
          remaining.push(tw);
        } else {
          group.position.set(toX, 0, toZ);
          group.rotation.set(0, homeYaw, 0);
          group.scale.setScalar(s);
          this.applyPoseToPiece(group, {});
          this.triggerSquashLanding(group);
        }
      } else if (tw.kind === 'parabolic_jump') {
        const { group, fromX, fromZ, toX, toZ, hPeak } = tw;
        const x = fromX + (toX - fromX) * t;
        const z = fromZ + (toZ - fromZ) * t;
        const y = 4 * hPeak * t * (1 - t);
        group.position.set(x, y, z);

        // Stretch slightly on ascent/descent
        const s = this.globalPieceScale;
        const stretch = 1 + 0.14 * Math.sin(t * Math.PI);
        group.scale.set(s / Math.sqrt(stretch), s * stretch, s / Math.sqrt(stretch));

        if (t < 1) {
          remaining.push(tw);
        } else {
          group.position.set(toX, 0, toZ);
          group.scale.setScalar(s);
          this.triggerSquashLanding(group);
        }
      } else if (tw.kind === 'squash_landing') {
        const { group } = tw;
        const s = this.globalPieceScale;
        // Damped spring from (1.22, 0.78, 1.22) back to (1, 1, 1)
        const env = Math.pow(1 - t, 2) * Math.cos(t * Math.PI * 1.5);
        const sx = s * (1 + 0.22 * env);
        const sy = s * (1 - 0.22 * env);
        group.scale.set(sx, sy, sx);
        if (t < 1) {
          remaining.push(tw);
        } else {
          group.scale.setScalar(s);
        }
      } else if (tw.kind === 'castling_belly_bounce') {
        const { kingGroup, rookGroup, kStart, kEnd, rStart, rEnd, midX, midZ } = tw;
        const s = this.globalPieceScale;
        if (t < 0.5) {
          // Leap toward midpoint for belly-bounce!
          const u = t * 2;
          const y = Math.sin(u * Math.PI * 0.5) * 1.15;
          kingGroup.position.set(kStart.x + (midX - 0.28 - kStart.x) * u, y, midZ);
          rookGroup.position.set(rStart.x + (midX + 0.28 - rStart.x) * u, y, midZ);
          this.applyPoseToPiece(kingGroup, { walkPhase: u * 12, walkAmp: 1.2 });
          this.applyPoseToPiece(rookGroup, { walkPhase: u * 12, walkAmp: 1.2 });
        } else {
          if (!tw.bounced) {
            tw.bounced = true;
            kingGroup.scale.set(s * 1.25, s * 0.78, s * 1.25);
            rookGroup.scale.set(s * 1.25, s * 0.78, s * 1.25);
          }
          const u = (t - 0.5) * 2;
          const y = Math.cos(u * Math.PI * 0.5) * 1.15;
          kingGroup.position.set((midX - 0.28) + (kEnd.x - (midX - 0.28)) * u, Math.max(0, y), kEnd.z);
          rookGroup.position.set((midX + 0.28) + (rEnd.x - (midX + 0.28)) * u, Math.max(0, y), rEnd.z);
          kingGroup.scale.setScalar(s);
          rookGroup.scale.setScalar(s);
        }
        if (t < 1) {
          remaining.push(tw);
        } else {
          kingGroup.position.set(kEnd.x, 0, kEnd.z);
          rookGroup.position.set(rEnd.x, 0, rEnd.z);
          kingGroup.rotation.set(0, kingGroup.userData.homeYaw ?? Math.PI, 0);
          rookGroup.rotation.set(0, rookGroup.userData.homeYaw ?? Math.PI, 0);
          this.applyPoseToPiece(kingGroup, {});
          this.applyPoseToPiece(rookGroup, {});
          this.triggerSquashLanding(kingGroup);
          this.triggerSquashLanding(rookGroup);
        }
      } else if (tw.kind === 'emote') {
        const { group, startY, baseRotY } = tw;
        group.position.y = startY + Math.sin(t * Math.PI) * 0.55;
        group.rotation.y = baseRotY + t * Math.PI * 2;
        if (t < 1) {
          remaining.push(tw);
        } else {
          group.position.y = startY;
          group.rotation.y = baseRotY;
        }
      } else if (tw.kind === 'swamp_splash_dive') {
        const { group, fromX, fromY, fromZ, toX, toY, toZ, hPeak } = tw;
        const x = fromX + (toX - fromX) * t;
        const z = fromZ + (toZ - fromZ) * t;
        const baseLinY = fromY + (toY - fromY) * t;
        const y = baseLinY + 4 * hPeak * t * (1 - t);
        group.position.set(x, y, z);
        group.rotation.z = t * Math.PI * 2;
        if (t < 1) {
          remaining.push(tw);
        } else {
          group.position.set(toX, toY, toZ);
          group.rotation.z = 0;
          group.userData.isDivingToSwamp = false;
          group.userData.celebrationSplashTimer = 1.1;
        }
      } else if (tw.kind === 'king_capitulation') {
        const { group, baseX, baseZ, fallSign } = tw;
        if (t < 0.28) {
          // Phase 1: Violent royal earthquake tremble
          const shake = Math.sin(tw.elapsed * 52) * 0.12;
          group.position.set(baseX + shake, Math.abs(Math.sin(tw.elapsed * 24)) * 0.08, baseZ - shake * 0.6);
          group.rotation.z = Math.sin(tw.elapsed * 42) * 0.22;
        } else if (t < 0.56) {
          // Phase 2: Slow-motion dramatic leap & tilt
          const u = (t - 0.28) / 0.28;
          group.position.set(baseX, Math.sin(u * Math.PI) * 0.92, baseZ);
          group.rotation.y += dt * 8.5;
          group.rotation.z = fallSign * u * 0.72;
        } else {
          // Phase 3: 84° Royal Topple onto the chessboard with damped bounce!
          const u = (t - 0.56) / 0.44;
          const bounce = Math.abs(Math.sin(u * Math.PI * 2.5)) * (1 - u) * 0.28;
          group.position.set(baseX + fallSign * u * 0.18, bounce + 0.12, baseZ);
          group.rotation.z = fallSign * (0.72 + Math.min(1, u * 1.4) * 0.76);
        }
        if (t < 1) {
          remaining.push(tw);
        }
      } else if (tw.kind === 'victory_jump') {
        const { group, baseY, baseRotY, phaseOffset } = tw;
        const localT = Math.max(0, tw.elapsed - phaseOffset);
        const hop = Math.abs(Math.sin(localT * 6.5)) * 0.48 * (1 - t * 0.5);
        group.position.y = baseY + hop;
        group.rotation.y = baseRotY + Math.sin(localT * 4.5) * 0.45;
        if (t < 1) {
          remaining.push(tw);
        } else {
          group.position.y = baseY;
          group.rotation.y = baseRotY;
        }
      }
    }

    this.activeTweens = remaining;
    this.activeMoves = this.activeTweens;
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
    this.clearGroup(this.livingGroup);
    this.clearGroup(this.trayGroup);
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
