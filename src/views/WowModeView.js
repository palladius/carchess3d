/**
 * @fileoverview Mode 2: 3D WOW Mode — Turntable Character Inspector & Battle Cinema Stage (`WowModeView`).
 *
 * Implements:
 * 1. **Sub-mode A: 360° Turntable Character Inspector**:
 *    - Dedicated 3D Spotlight Pedestal Stage positioned at `(0, y = 0.0m, z = 0.0m)`.
 *    - Displays any of the 6 Carlesso Family heroes (`Ale`, `Seby`, `Puffin`, `Riccardo`,
 *      `Kate`, `Pupurabbu`) at large hero scale (`1.35x`) on a rotating golden rune pedestal (`y = 0`).
 *    - Floating 2D Front/Back Reference Card plane (`assets/characters/*.jpg` & back portraits)
 *      mounted beside the turntable with one-click front/back flip.
 *    - Live switching for Bishop Ale between **Ale #1 (Con Cappello `bishop-ale-1.glb`)**
 *      and **Ale #2 (Rigged Dragon `bishop-ale-rigged.glb`)**.
 *    - Auto-rotates at `0.6 rad/s` (toggleable) and supports pointer drag-to-rotate.
 *    - On-demand skeletal & procedural animation triggers:
 *      `Idle` (Dragon Wing Glide), `Click_Fire_Breath` (Dragon Fire Breath + 60-particle 3D flame cone!),
 *      `Attack Signature`, and `Victory Emote`.
 * 2. **Sub-mode B: Action Arena (Battle Cinema Stage)**:
 *    - Stages any `Attacker (6) × Defender (6)` pair on the central altar (`d4` vs `e5`)
 *      and cooperates with `CombatAnimationManager`, `VFXPoolView`, and `VeoCinemaView`
 *      when `WOW_ARENA_CLASH` is emitted.
 */

import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../../vendor/three/addons/utils/SkeletonUtils.js';
import { CHARACTER_REGISTRY, BATTLE_MATRIX, squareToWorld } from '../core/Registry.js';
import {
  groundAndNormalizeObject3D,
  CANONICAL_PIECE_HEIGHTS,
  PEDESTAL_HEIGHT,
} from '../utils/glbGrounding.js';
import { BISHOP_GLB_VARIANTS, QUEEN_GLB_VARIANTS, KNIGHT_GLB_VARIANTS } from '../managers/PieceManager.js';
import {
  createArticulatedSkeletonRig,
  updateSkeletonRigPose,
} from './SkeletonRigHelper.js';

const HERO_SCALE = 1.35;
const TURNTABLE_SPEED_RAD_S = 0.6;
const TURNTABLE_TOP_Y = 0.14;
const FIRE_PARTICLE_COUNT = 64;

const ROLE_OR_NAME_TO_KEY = Object.freeze({
  k: 'k', king: 'k', riccardo: 'k',
  q: 'q', queen: 'q', kate: 'q',
  b: 'b', bishop: 'b', ale: 'b',
  n: 'n', knight: 'n', seby: 'n',
  r: 'r', rook: 'r', pupurabbu: 'r',
  p: 'p', pawn: 'p', puffin: 'p',
});

export class WowModeView {
  /**
   * @param {object} [opts]
   */
  constructor(opts = {}) {
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.domElement = null;
    this.pieceView = null;
    this.ctx = null;

    this.active = false;
    /** @type {'inspector'|'arena'} */
    this.subMode = 'inspector';
    /** @type {'k'|'q'|'b'|'n'|'r'|'p'} */
    this.selectedKey = 'b';
    /** @type {'hat'|'astrolabe'|'rigged'} */
    this.bishopVariant = 'hat';
    /** @type {'young'|'wedding'} */
    this.queenVariant = 'young';
    /** @type {'classic'|'lightsaber'|'halberd'|'aurora'} */
    this.knightVariant = 'classic';
    /** @type {'front'|'back'} */
    this.cardSide = 'front';
    this.autoRotate = true;
    this.turntableAngle = 0;
    this.skeletonsVisible = false;
    this.heroSkeletonRig = null;

    // Root 3D Stage Group at (0, 0, 0)
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'WowModeStageRoot';
    this.rootGroup.position.set(0, 0, 0);
    this.rootGroup.visible = false;

    // Sub-groups
    this.inspectorGroup = new THREE.Group();
    this.inspectorGroup.name = 'WowTurntableInspectorGroup';
    this.turntableGroup = new THREE.Group();
    this.turntableGroup.name = 'WowTurntableRotatingGroup';
    this.heroMountGroup = new THREE.Group();
    this.heroMountGroup.name = 'WowHeroMountGroup';
    this.turntableGroup.add(this.heroMountGroup);

    this.cardGroup = new THREE.Group();
    this.cardGroup.name = 'WowFloatingReferenceCardGroup';
    this.inspectorGroup.add(this.turntableGroup, this.cardGroup);

    this.arenaGroup = new THREE.Group();
    this.arenaGroup.name = 'WowBattleArenaStageGroup';
    this.arenaGroup.visible = false;

    this.fireParticleGroup = new THREE.Group();
    this.fireParticleGroup.name = 'WowDragonFireBreathPool';

    this.rootGroup.add(this.inspectorGroup, this.arenaGroup, this.fireParticleGroup);

    // Loaders & caches
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.gltfCache = new Map();
    this.textureCache = new Map();

    // Active hero mixer & procedural emote state
    this.heroMixer = null;
    this.heroClips = new Map();
    this.activeAction = null;
    this.emoteState = {
      type: 'idle',
      elapsed: 0,
      duration: 0,
    };

    // Pooled 3D Dragon Fire Breath particles (zero per-frame allocations)
    /** @type {Array<{ mesh: THREE.Mesh, vel: THREE.Vector3, life: number, maxLife: number, active: boolean }>} */
    this.fireParticles = [];
    this.fireBreathLight = null;
    this.fireEmitTimer = 0;

    // Pointer drag-to-rotate state
    this.dragging = false;
    this.lastPointerX = 0;
    this.savedCamera = null;
    this.offs = [];

    this._boundDown = (e) => this.onPointerDown(e);
    this._boundMove = (e) => this.onPointerMove(e);
    this._boundUp = (e) => this.onPointerUp(e);

    this._buildStageGeometry();
    this._buildFireParticlePool();
    this._applyOpts(opts);
  }

  _applyOpts(opts = {}) {
    if (!opts || typeof opts !== 'object') return;
    if (opts.isScene) {
      this.scene = opts;
    } else {
      this.scene = opts.scene || this.scene;
      this.camera = opts.camera || this.camera;
      this.controls = opts.controls || this.controls;
      this.domElement = opts.domElement || opts.renderer?.domElement || this.domElement;
      this.pieceView = opts.pieceView || this.pieceView;
      this.ctx = opts.ctx || (opts.bus ? opts : this.ctx);
    }
    if (this.pieceView && typeof this.pieceView.skeletonsVisible === 'boolean') {
      this.skeletonsVisible = this.pieceView.skeletonsVisible;
    }
    if (this.scene && !this.rootGroup.parent) {
      this.scene.add(this.rootGroup);
    }
  }

  /**
   * Initializes event subscriptions and pointer drag handlers.
   * @param {object} [optsOrCtx]
   */
  init(optsOrCtx = {}) {
    this._applyOpts(optsOrCtx);

    if (this.domElement && typeof this.domElement.addEventListener === 'function') {
      this.domElement.addEventListener('pointerdown', this._boundDown);
      window.addEventListener('pointermove', this._boundMove);
      window.addEventListener('pointerup', this._boundUp);
    }

    const bus = this.ctx?.bus;
    if (bus && this.offs.length === 0) {
      this.offs.push(
        bus.on('FLOW_STATE_CHANGED', (e) => this.onFlowStateChanged(e)),
        bus.on('WOW_INSPECT_CHARACTER', (e) => this.onInspectCharacter(e)),
        bus.on('WOW_TRIGGER_ANIMATION', (e) => this.onTriggerAnimation(e)),
        bus.on('WOW_ARENA_CLASH', (e) => this.onArenaClash(e)),
        bus.on('TOGGLE_SKELETONS', (e) => {
          const next =
            typeof e?.visible === 'boolean'
              ? e.visible
              : typeof e?.enabled === 'boolean'
                ? e.enabled
                : Boolean(this.pieceView?.skeletonsVisible ?? !this.skeletonsVisible);
          this.setSkeletonsVisible(next);
        }),
        bus.on('PIECE_SET_CHANGED', (e) => {
          if (e.bishopVariant && e.bishopVariant !== this.bishopVariant) {
            this.bishopVariant = e.bishopVariant;
            if (this.active && this.selectedKey === 'b') {
              this.loadSelectedHero();
            }
          }
          if (e.queenVariant && e.queenVariant !== this.queenVariant) {
            this.queenVariant = e.queenVariant;
            if (this.active && this.selectedKey === 'q') {
              this.loadSelectedHero();
            }
          }
          if (e.knightVariant && e.knightVariant !== this.knightVariant) {
            this.knightVariant = e.knightVariant;
            if (this.active && this.selectedKey === 'n') {
              this.loadSelectedHero();
            }
          }
        }),
      );
    }
  }

  setSkeletonsVisible(visible) {
    this.skeletonsVisible = typeof visible === 'boolean' ? visible : !this.skeletonsVisible;
    if (this.heroSkeletonRig) {
      this.heroSkeletonRig.userData.alwaysVisible = this.skeletonsVisible;
      updateSkeletonRigPose(this.heroSkeletonRig, this.selectedKey, {
        walkPhase: this.emoteState.elapsed * 6,
        walkAmp: this.skeletonsVisible ? 0.35 : 0,
        skeletonsVisible: this.skeletonsVisible,
      });
    }
    return this.skeletonsVisible;
  }

  // ===========================================================================
  // 1. 3D SPOTLIGHT PEDESTAL STAGE & FLOATING 2D REFERENCE CARD
  // ===========================================================================

  _buildStageGeometry() {
    // Golden Rune Spotlight Podium at (0, y = 0.0m .. 0.14m, z = 0.0m)
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1d2331,
      roughness: 0.25,
      metalness: 0.45,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xe6b84a,
      emissive: 0x5c3d08,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.88,
    });
    const runeGlowMat = new THREE.MeshBasicMaterial({
      color: 0x4cd9a2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });

    // Outer stepped cylinder grounded at y = 0.0m
    const lowerDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.42, 1.54, 0.08, 48),
      baseMat,
    );
    lowerDisc.position.y = 0.04;
    lowerDisc.receiveShadow = true;

    const upperDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.22, 1.32, 0.06, 48),
      goldMat,
    );
    upperDisc.position.y = 0.11;
    upperDisc.receiveShadow = true;

    const runeRing = new THREE.Mesh(
      new THREE.RingGeometry(1.02, 1.16, 48),
      runeGlowMat,
    );
    runeRing.rotation.x = -Math.PI * 0.5;
    runeRing.position.y = TURNTABLE_TOP_Y + 0.003;
    this.runeRingMesh = runeRing;

    this.turntableGroup.add(lowerDisc, upperDisc, runeRing);

    // Stage Spotlight & Rim Light
    this.stageKeyLight = new THREE.SpotLight(0xfff1d0, 4.5, 14, Math.PI / 4, 0.45, 1.2);
    this.stageKeyLight.position.set(2.2, 4.8, 3.6);
    this.stageKeyLight.target.position.set(0, 1.1, 0);
    this.inspectorGroup.add(this.stageKeyLight, this.stageKeyLight.target);

    this.stageRimLight = new THREE.PointLight(0x4cd9a2, 2.4, 8);
    this.stageRimLight.position.set(-2.4, 2.4, -2.0);
    this.inspectorGroup.add(this.stageRimLight);

    // Floating 2D Reference Card Plane on the left of the turntable (-2.05m, y = 1.25m, z = -0.35m)
    this.cardGroup.position.set(-2.05, 1.25, -0.35);
    this.cardGroup.rotation.y = 0.28;

    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 1.84, 0.05),
      goldMat,
    );
    this.cardGroup.add(frameMesh);

    this.cardFrontMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.cardBackMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const cardPlaneGeo = new THREE.PlaneGeometry(1.30, 1.72);
    this.cardFrontMesh = new THREE.Mesh(cardPlaneGeo, this.cardFrontMat);
    this.cardFrontMesh.position.z = 0.028;

    this.cardBackMesh = new THREE.Mesh(cardPlaneGeo, this.cardBackMat);
    this.cardBackMesh.rotation.y = Math.PI;
    this.cardBackMesh.position.z = -0.028;

    this.cardGroup.add(this.cardFrontMesh, this.cardBackMesh);
  }

  _buildFireParticlePool() {
    const sphereGeo = new THREE.SphereGeometry(0.055, 8, 8);
    for (let i = 0; i < FIRE_PARTICLE_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xfff176 : i % 2 === 0 ? 0xff9800 : 0xff3d00,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.visible = false;
      this.fireParticleGroup.add(mesh);
      this.fireParticles.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.65,
        active: false,
      });
    }

    this.fireBreathLight = new THREE.PointLight(0xff6d00, 0, 6);
    this.fireBreathLight.position.set(0.3, 1.45, 0.65);
    this.fireParticleGroup.add(this.fireBreathLight);
  }

  // ===========================================================================
  // 2. EVENT HANDLERS & MODE ACTIVATION
  // ===========================================================================

  onFlowStateChanged(e) {
    if (e.to === 'Mode2_WowArena') {
      this.setActive(true);
    } else if (e.to === 'Mode1_Chess') {
      this.setActive(false);
    } else if (e.to === 'CaptureCutscene' && this.active) {
      // During WOW Arena battle cutscene, hide single inspector and show neighboring chessboard pieces around the clash!
      this.inspectorGroup.visible = false;
      this.arenaGroup.visible = true;
      if (this.pieceView?.rootGroup) {
        this.pieceView.rootGroup.visible = true;
      }
    }
  }

  setActive(enabled) {
    if (this.active === enabled) {
      if (enabled) {
        this.inspectorGroup.visible = this.subMode === 'inspector';
        this.arenaGroup.visible = this.subMode === 'arena';
        if (this.pieceView?.rootGroup) {
          this.pieceView.rootGroup.visible = this.subMode === 'arena';
        }
      }
      return;
    }
    this.active = enabled;
    this.rootGroup.visible = enabled;

    if (enabled) {
      // Save camera and move to hero turntable showcase angle
      if (this.camera && !this.savedCamera) {
        this.savedCamera = {
          pos: this.camera.position.clone(),
          target: this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0.4, 0),
          fov: this.camera.fov,
        };
      }
      if (this.pieceView?.rootGroup) {
        this.pieceView.rootGroup.visible = this.subMode === 'arena';
      }
      this.setSubMode(this.subMode);
      this.focusCameraForSubMode();
      this.loadSelectedHero();
    } else {
      this._stopFireBreath();
      this._clearArenaFighters();
      if (this.pieceView?.rootGroup) {
        this.pieceView.rootGroup.visible = true;
      }
      if (this.camera && this.savedCamera) {
        this.camera.fov = this.savedCamera.fov;
        this.camera.position.copy(this.savedCamera.pos);
        this.camera.updateProjectionMatrix();
        if (this.controls) {
          this.controls.target.copy(this.savedCamera.target);
          this.controls.update();
        }
        this.savedCamera = null;
      }
    }
  }

  setSubMode(mode) {
    this.subMode = mode === 'arena' ? 'arena' : 'inspector';
    this.inspectorGroup.visible = this.subMode === 'inspector';
    this.arenaGroup.visible = this.subMode === 'arena';
    if (this.active) {
      if (this.pieceView?.rootGroup) {
        this.pieceView.rootGroup.visible = this.subMode === 'arena';
      }
      this.focusCameraForSubMode();
    }
  }

  focusCameraForSubMode() {
    if (!this.camera) return;
    if (this.subMode === 'inspector') {
      this.camera.fov = 38;
      this.camera.position.set(0.0, 2.35, 5.2);
      this.camera.updateProjectionMatrix();
      if (this.controls) {
        this.controls.target.set(-0.35, 1.15, 0.0);
        this.controls.update();
      }
    } else {
      this.camera.fov = 42;
      this.camera.position.set(0.0, 4.8, 7.6);
      this.camera.updateProjectionMatrix();
      if (this.controls) {
        this.controls.target.set(0.0, 1.6, -2.2);
        this.controls.update();
      }
    }
  }

  onInspectCharacter(e = {}) {
    const prevKey = this.selectedKey;
    const prevVariant = this.bishopVariant;
    const prevQueenVariant = this.queenVariant;
    const prevKnightVariant = this.knightVariant;

    if (e.subMode) {
      this.setSubMode(e.subMode);
    } else if (!e.cardSide && typeof e.autoRotate !== 'boolean') {
      this.setSubMode('inspector');
    }

    if (typeof e.autoRotate === 'boolean') {
      this.autoRotate = e.autoRotate;
    }

    if (e.cardSide === 'front' || e.cardSide === 'back') {
      this.cardSide = e.cardSide;
      if (this.cardGroup) {
        this.cardGroup.rotation.y = this.cardSide === 'back' ? Math.PI + 0.28 : 0.28;
      }
    }

    if (e.bishopVariant === 'hat' || e.bishopVariant === 'astrolabe' || e.bishopVariant === 'rigged') {
      this.bishopVariant = e.bishopVariant;
      const pm = this.ctx?.pieces || this.ctx?.pieceManager;
      pm?.setBishopVariant?.(this.bishopVariant);
    }

    if (e.queenVariant === 'young' || e.queenVariant === 'wedding') {
      this.queenVariant = e.queenVariant;
      const pm = this.ctx?.pieces || this.ctx?.pieceManager;
      pm?.setQueenVariant?.(this.queenVariant);
    }

    if (
      e.knightVariant === 'classic' ||
      e.knightVariant === 'lightsaber' ||
      e.knightVariant === 'halberd' ||
      e.knightVariant === 'aurora'
    ) {
      this.knightVariant = e.knightVariant;
      const pm = this.ctx?.pieces || this.ctx?.pieceManager;
      pm?.setKnightVariant?.(this.knightVariant);
    }

    const rawKey = String(e.pieceType || e.character || this.selectedKey).toLowerCase();
    this.selectedKey = ROLE_OR_NAME_TO_KEY[rawKey] || 'b';

    const heroChanged =
      this.selectedKey !== prevKey ||
      this.bishopVariant !== prevVariant ||
      this.queenVariant !== prevQueenVariant ||
      this.knightVariant !== prevKnightVariant ||
      !this.currentHeroObject;

    if (this.active && heroChanged) {
      this.loadSelectedHero();
    }
  }

  // ===========================================================================
  // 3. HERO TURNTABLE MODEL LOADER & 2D REFERENCE CARD UPDATER
  // ===========================================================================

  loadSelectedHero() {
    this._heroLoadToken = (this._heroLoadToken || 0) + 1;
    const loadToken = this._heroLoadToken;
    const meta = CHARACTER_REGISTRY[this.selectedKey] || CHARACTER_REGISTRY.b;

    // 1. Update 2D Front & Back Reference Card Textures
    const frontTex = this._loadTexture(meta.frontPortrait, `${meta.name} (Front)`);
    const backTex = this._loadTexture(meta.backPortrait || meta.frontPortrait, `${meta.name} (Back)`);
    this.cardFrontMat.map = frontTex;
    this.cardFrontMat.needsUpdate = true;
    this.cardBackMat.map = backTex;
    this.cardBackMat.needsUpdate = true;
    this.cardGroup.rotation.y = this.cardSide === 'back' ? Math.PI + 0.28 : 0.28;

    // 2. Clear previous hero mesh & mixer
    this.heroMountGroup.clear();
    this.heroMixer = null;
    this.heroClips.clear();
    this.activeAction = null;
    if (this.pieceView && typeof this.pieceView.skeletonsVisible === 'boolean') {
      this.skeletonsVisible = this.pieceView.skeletonsVisible;
    }

    // Determine GLB URL (supporting Ale variants, Kate variants & Seby variants)
    let glbUrl = meta.glbUrl;
    if (this.selectedKey === 'b') {
      glbUrl = BISHOP_GLB_VARIANTS[this.bishopVariant] || meta.glbUrl;
    } else if (this.selectedKey === 'q') {
      glbUrl = QUEEN_GLB_VARIANTS[this.queenVariant] || meta.glbUrl;
    } else if (this.selectedKey === 'n') {
      glbUrl = KNIGHT_GLB_VARIANTS[this.knightVariant] || meta.glbUrl;
    }

    const baseHeroHeight = CANONICAL_PIECE_HEIGHTS[this.selectedKey] ?? 1.45;
    const desc = {
      id: `wow_hero_${this.selectedKey}`,
      square: 'e4',
      type: this.selectedKey,
      color: 'w',
      role: meta.role,
      name: meta.name,
      glyph: meta.glyph,
      height: baseHeroHeight,
      glbUrl,
      frontPortrait: meta.frontPortrait,
      backPortrait: meta.backPortrait || meta.frontPortrait,
      accentColor: meta.accentColor,
      isStoneSet: false,
      animations: meta.animations,
    };

    // Build immediate sculpted pedestal + portrait medallion fallback
    if (this.pieceView?.buildPieceGroup) {
      const pieceGroup = this.pieceView.buildPieceGroup({ ...desc, glbUrl: null });
      pieceGroup.position.set(0, TURNTABLE_TOP_Y, 0);
      pieceGroup.rotation.set(0, 0, 0);
      pieceGroup.scale.setScalar(HERO_SCALE);
      this.heroMountGroup.add(pieceGroup);
      this.currentHeroObject = pieceGroup;
      this.heroSkeletonRig = pieceGroup.userData?.skeletonRig || null;
      if (this.heroSkeletonRig) {
        this.heroSkeletonRig.userData.alwaysVisible = this.skeletonsVisible;
        updateSkeletonRigPose(this.heroSkeletonRig, this.selectedKey, {
          skeletonsVisible: this.skeletonsVisible,
        });
      }
    } else {
      const fallback = this._buildStandaloneHeroFallback(desc);
      const rig = createArticulatedSkeletonRig(THREE, this.selectedKey, baseHeroHeight, 'w');
      rig.userData.alwaysVisible = this.skeletonsVisible;
      updateSkeletonRigPose(rig, this.selectedKey, {
        skeletonsVisible: this.skeletonsVisible,
      });
      fallback.add(rig);
      fallback.userData = { ...(fallback.userData || {}), skeletonRig: rig };
      fallback.position.set(0, TURNTABLE_TOP_Y, 0);
      fallback.scale.setScalar(HERO_SCALE);
      this.heroMountGroup.add(fallback);
      this.currentHeroObject = fallback;
      this.heroSkeletonRig = rig;
    }

    // Load high-res 3D GLB if available (`bishop-ale-rigged.glb`, `bishop-ale-1.glb`, `pawn-puffin.glb`, etc.)
    if (glbUrl) {
      this._loadGltf(glbUrl)
        .then((gltf) => {
          if (loadToken !== this._heroLoadToken || !gltf?.scene) return;
          let cloned;
          try {
            cloned = SkeletonUtils.clone(gltf.scene);
          } catch {
            cloned = gltf.scene.clone(true);
          }
          cloned.traverse((ch) => {
            if (ch.isMesh) {
              ch.castShadow = true;
              ch.receiveShadow = true;
              if (ch.material) {
                const mats = Array.isArray(ch.material)
                  ? ch.material.map((m) => m.clone())
                  : [ch.material.clone()];
                for (const mat of mats) {
                  mat.metalness = 0.04;
                  mat.metalnessMap = null;
                  mat.roughness = 0.52;
                  mat.roughnessMap = null;
                  if (mat.color) mat.color.setHex(0xffffff);
                  if (mat.emissive) {
                    mat.emissiveMap = mat.map || null;
                    mat.emissive.setHex(mat.map ? 0xffffff : 0x453318);
                    mat.emissiveIntensity = mat.map ? 0.34 : 0.28;
                  }
                  mat.needsUpdate = true;
                }
                ch.material = Array.isArray(ch.material) ? mats : mats[0];
              }
            }
          });

          const targetHeight = baseHeroHeight * HERO_SCALE;
          const { holder } = groundAndNormalizeObject3D(THREE, cloned, targetHeight, {
            baseElevation: TURNTABLE_TOP_Y,
          });

          // Create and attach hero-scaled articulated 3D skeleton rig to turntable holder
          const glbRig = createArticulatedSkeletonRig(THREE, this.selectedKey, baseHeroHeight, 'w');
          glbRig.scale.setScalar(HERO_SCALE);
          glbRig.position.y = -PEDESTAL_HEIGHT * HERO_SCALE;
          glbRig.userData.alwaysVisible = this.skeletonsVisible;
          updateSkeletonRigPose(glbRig, this.selectedKey, {
            skeletonsVisible: this.skeletonsVisible,
          });
          holder.add(glbRig);
          holder.userData = { ...(holder.userData || {}), skeletonRig: glbRig };

          this.heroMountGroup.clear();
          this.heroMountGroup.add(holder);
          this.currentHeroObject = holder;
          this.heroSkeletonRig = glbRig;

          if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
            this.heroMixer = new THREE.AnimationMixer(cloned);
            for (const clip of gltf.animations) {
              this.heroClips.set(clip.name, clip);
            }
            this.playHeroClip('Idle_Track');
          }
        })
        .catch(() => {
          // Keep sculpted hero standee if GLB is unavailable
        });
    }
  }

  _buildStandaloneHeroFallback(desc) {
    const group = new THREE.Group();
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.38, PEDESTAL_HEIGHT, 24),
      new THREE.MeshStandardMaterial({ color: 0xfcf6e8, roughness: 0.25, metalness: 0.2 }),
    );
    ped.position.y = PEDESTAL_HEIGHT * 0.5;
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: desc.accentColor || 0xe6b84a }),
    );
    disc.rotation.z = Math.PI * 0.5;
    disc.position.y = PEDESTAL_HEIGHT + 0.45;
    group.add(ped, disc);
    return group;
  }

  // ===========================================================================
  // 4. SKELETAL & PROCEDURAL ANIMATION TRIGGERS + 3D DRAGON FIRE BREATH
  // ===========================================================================

  onTriggerAnimation(e = {}) {
    const rawClip = String(e.clipKey || e.animation || 'Idle');
    const lower = rawClip.toLowerCase();

    if (lower.includes('fire') || lower === 'click_fire_breath') {
      this.playHeroClip('FireBreath_Track');
      this.emoteState = { type: 'fire', elapsed: 0, duration: 2.2 };
      this._startFireBreath(2.0);
    } else if (lower.includes('attack')) {
      this.playHeroClip('FireBreath_Track');
      this.emoteState = { type: 'attack', elapsed: 0, duration: 1.4 };
      if (this.selectedKey === 'b') {
        this._startFireBreath(1.2);
      }
    } else if (lower.includes('victory')) {
      this.playHeroClip('Idle_Track');
      this.emoteState = { type: 'victory', elapsed: 0, duration: 1.6 };
    } else {
      this.playHeroClip('Idle_Track');
      this.emoteState = { type: 'idle', elapsed: 0, duration: 0 };
      this._stopFireBreath();
    }
  }

  playHeroClip(preferredName) {
    if (!this.heroMixer || this.heroClips.size === 0) return;
    const clip =
      this.heroClips.get(preferredName) ||
      (preferredName === 'FireBreath_Track'
        ? this.heroClips.get('Click_Fire_Breath')
        : this.heroClips.get('Idle')) ||
      this.heroClips.values().next().value;
    if (!clip) return;

    const nextAction = this.heroMixer.clipAction(clip);
    if (this.activeAction && this.activeAction !== nextAction) {
      this.activeAction.fadeOut(0.18);
    }
    nextAction.reset().fadeIn(0.18).play();
    this.activeAction = nextAction;
  }

  _startFireBreath(durationS = 1.8) {
    this.fireEmitTimer = durationS;
    if (this.fireBreathLight) {
      this.fireBreathLight.intensity = 5.0;
    }
  }

  _stopFireBreath() {
    this.fireEmitTimer = 0;
    if (this.fireBreathLight) {
      this.fireBreathLight.intensity = 0;
    }
    for (const p of this.fireParticles) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  _spawnFireParticle() {
    const slot = this.fireParticles.find((p) => !p.active);
    if (!slot) return;

    slot.active = true;
    slot.life = 0;
    slot.maxLife = 0.45 + Math.random() * 0.35;

    // Emit from shoulder dragon height (~1.42m above turntable) oriented along turntable angle
    const forwardX = Math.sin(this.turntableAngle);
    const forwardZ = Math.cos(this.turntableAngle);
    const startX = forwardX * 0.32 + (Math.random() - 0.5) * 0.08;
    const startY = TURNTABLE_TOP_Y + 1.38 + (Math.random() - 0.5) * 0.08;
    const startZ = forwardZ * 0.32 + (Math.random() - 0.5) * 0.08;

    slot.mesh.position.set(startX, startY, startZ);
    slot.mesh.scale.setScalar(0.65);
    slot.mesh.visible = true;

    const speed = 2.4 + Math.random() * 1.8;
    slot.vel.set(
      forwardX * speed + (Math.random() - 0.5) * 0.9,
      0.35 + (Math.random() - 0.3) * 0.7,
      forwardZ * speed + (Math.random() - 0.5) * 0.9,
    );
  }

  // ===========================================================================
  // 5. SUB-MODE B: ACTION ARENA (6x6 BATTLE CINEMA STAGE)
  // ===========================================================================

  onArenaClash(e = {}) {
    this.subMode = 'arena';
    this.inspectorGroup.visible = false;
    this.arenaGroup.visible = true;
    if (this.pieceView?.rootGroup) {
      this.pieceView.rootGroup.visible = true;
    }
    this._clearArenaFighters();

    const atkType = ROLE_OR_NAME_TO_KEY[String(e.attacker || 'b').toLowerCase()] || 'b';
    const defType = ROLE_OR_NAME_TO_KEY[String(e.defender || 'n').toLowerCase()] || 'n';
    const fromSq = e.from || 'd4';
    const toSq = e.to || e.square || 'e5';

    // When CombatAnimationManager + VFXPoolView are wired into ctx, VFXPoolView spawns the
    // animated 3D fighters and drives the close-up auto-zoom camera directly.
    // Only stage fallback static meshes if CombatAnimationManager is absent (e.g. unit test).
    const hasCombatManager = Boolean(this.ctx?.combat || this.ctx?.combatManager);
    if (!hasCombatManager) {
      this.focusCameraForSubMode();
      if (this.pieceView?.buildPieceGroup) {
        const pm = this.ctx?.pieces || this.ctx?.pieceManager;
        const atkDesc = pm?.resolveDescriptor
          ? pm.resolveDescriptor({ type: atkType, color: 'w', square: fromSq })
          : { type: atkType, color: 'w', square: fromSq, ...CHARACTER_REGISTRY[atkType] };
        const defDesc = pm?.resolveDescriptor
          ? pm.resolveDescriptor({ type: defType, color: 'b', square: toSq })
          : { type: defType, color: 'b', square: toSq, ...CHARACTER_REGISTRY[defType] };

        const atkMesh = this.pieceView.buildPieceGroup(atkDesc);
        const defMesh = this.pieceView.buildPieceGroup(defDesc);
        const pFrom = squareToWorld(fromSq);
        const pTo = squareToWorld(toSq);
        atkMesh.position.set(pFrom.x, 0, pFrom.z);
        defMesh.position.set(pTo.x, 0, pTo.z);

        this.arenaGroup.add(atkMesh, defMesh);
      }

      if (this.ctx?.bus) {
        const entry = BATTLE_MATRIX[atkType]?.[defType] || BATTLE_MATRIX.b.n;
        this.ctx.bus.emit({
          type: 'BATTLE_STARTED',
          ...entry,
          from: fromSq,
          to: toSq,
          square: toSq,
          capturedSquare: toSq,
          playerId: 'w',
          victimColor: 'b',
          tier: e.goldenCrit || e.tier === 'golden_crit' ? 'golden_crit' : 'normal',
          source: 'wow_arena',
          durationMs: 6000,
        });
      }
    }
  }

  _clearArenaFighters() {
    this.arenaGroup.clear();
  }

  // ===========================================================================
  // 6. POINTER DRAG-TO-ROTATE & FRAME UPDATE
  // ===========================================================================

  onPointerDown(e) {
    if (!this.active || this.subMode !== 'inspector') return;
    this.dragging = true;
    this.lastPointerX = e.clientX;
  }

  onPointerMove(e) {
    if (!this.active || !this.dragging || this.subMode !== 'inspector') return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    this.turntableAngle += dx * 0.012;
    this.turntableGroup.rotation.y = this.turntableAngle;
  }

  onPointerUp() {
    this.dragging = false;
  }

  update(dt = 1 / 60) {
    if (!this.active) return;

    // 1. Turntable rotation (0.6 rad/s when autoRotate is enabled and not dragging)
    if (this.subMode === 'inspector' && this.autoRotate && !this.dragging) {
      this.turntableAngle += TURNTABLE_SPEED_RAD_S * dt;
      this.turntableGroup.rotation.y = this.turntableAngle;
    }

    if (this.runeRingMesh) {
      this.runeRingMesh.rotation.z -= 0.45 * dt;
    }

    // 2. Skeletal AnimationMixer tick
    if (this.heroMixer) {
      this.heroMixer.update(dt);
    }

    // 3. Procedural Emote overlays (Attack lunge / Victory spin / Idle breathing) & Skeleton Rig update
    if (this.currentHeroObject) {
      this.emoteState.elapsed += dt;
      const t = this.emoteState.elapsed;
      let walkAmp = this.skeletonsVisible ? 0.32 : 0;
      let combatAmp = 0;

      if (this.emoteState.type === 'attack' && t < this.emoteState.duration) {
        const pulse = Math.sin((t / this.emoteState.duration) * Math.PI);
        this.currentHeroObject.position.y = TURNTABLE_TOP_Y + pulse * 0.32;
        this.currentHeroObject.position.z = pulse * 0.28;
        combatAmp = 1.25;
        walkAmp = 1.1;
      } else if (this.emoteState.type === 'fire' && t < this.emoteState.duration) {
        this.currentHeroObject.position.y = TURNTABLE_TOP_Y + Math.sin(t * 8) * 0.06;
        combatAmp = 0.95;
        walkAmp = 0.85;
      } else if (this.emoteState.type === 'victory' && t < this.emoteState.duration) {
        const p = t / this.emoteState.duration;
        this.currentHeroObject.position.y = TURNTABLE_TOP_Y + Math.abs(Math.sin(p * Math.PI * 2)) * 0.42;
        this.currentHeroObject.rotation.y = p * Math.PI * 2;
        walkAmp = 1.2;
      } else {
        this.currentHeroObject.position.y = TURNTABLE_TOP_Y + Math.sin(t * 2.4) * 0.025;
        this.currentHeroObject.position.z = 0;
        this.currentHeroObject.rotation.y = 0;
      }

      if (this.heroSkeletonRig) {
        const isVis = Boolean(this.pieceView?.skeletonsVisible ?? this.skeletonsVisible);
        this.heroSkeletonRig.userData.alwaysVisible = isVis;
        updateSkeletonRigPose(this.heroSkeletonRig, this.selectedKey, {
          walkPhase: t * 6.5,
          walkAmp,
          combatPhase: t * 10.0,
          combatAmp,
          rearUp: this.selectedKey === 'n' && combatAmp > 0.5 ? 0.65 : 0,
          skeletonsVisible: isVis,
        });
      }
    }

    // 4. Pooled 3D Dragon Fire Breath Particles
    if (this.fireEmitTimer > 0) {
      this.fireEmitTimer = Math.max(0, this.fireEmitTimer - dt);
      for (let i = 0; i < 3; i++) {
        this._spawnFireParticle();
      }
      if (this.fireBreathLight) {
        this.fireBreathLight.intensity = 3.5 + Math.sin(this.emoteState.elapsed * 28) * 1.5;
      }
    } else if (this.fireBreathLight) {
      this.fireBreathLight.intensity = Math.max(0, this.fireBreathLight.intensity - dt * 8);
    }

    for (const p of this.fireParticles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const ratio = p.life / p.maxLife;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.position.y += 0.35 * dt; // buoyancy
      p.mesh.scale.setScalar(0.55 + ratio * 1.35);
      p.mesh.material.opacity = Math.max(0, 1 - ratio);
    }
  }

  _loadGltf(url) {
    if (this.gltfCache.has(url)) return this.gltfCache.get(url);
    const p = new Promise((resolve, reject) => {
      this.gltfLoader.load(url, resolve, undefined, reject);
    });
    this.gltfCache.set(url, p);
    return p;
  }

  _loadTexture(url, label) {
    const key = `${url}_${label}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const tex = this._createCardFallbackTexture(label);
    this.textureCache.set(key, tex);

    if (url && typeof Image !== 'undefined') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = tex.userData?.ctx;
        if (!c) return;
        c.save();
        c.fillStyle = '#182030';
        c.fillRect(0, 0, 384, 512);
        // Smart crop if 16:9 2-up sheet
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;
        if (img.width > img.height * 1.35) {
          sw = Math.floor(img.width * 0.52);
          sx = Math.floor(img.width * 0.01);
        }
        c.drawImage(img, sx, sy, sw, sh, 16, 16, 352, 430);
        c.strokeStyle = '#e6b84a';
        c.lineWidth = 8;
        c.strokeRect(12, 12, 360, 488);
        c.fillStyle = 'rgba(12, 16, 28, 0.88)';
        c.fillRect(16, 444, 352, 52);
        c.fillStyle = '#ffe082';
        c.font = 'bold 22px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillText(label, 192, 477);
        c.restore();
        tex.needsUpdate = true;
      };
      img.src = url;
    }
    return tex;
  }

  _createCardFallbackTexture(label) {
    if (typeof document === 'undefined') return new THREE.Texture();
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 512;
    const c = canvas.getContext('2d');
    if (c) {
      c.fillStyle = '#182030';
      c.fillRect(0, 0, 384, 512);
      c.strokeStyle = '#e6b84a';
      c.lineWidth = 10;
      c.strokeRect(12, 12, 360, 488);
      c.fillStyle = '#ffe082';
      c.font = 'bold 28px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(label, 192, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData = { canvas, ctx: c };
    return tex;
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
    if (this.domElement && typeof this.domElement.removeEventListener === 'function') {
      this.domElement.removeEventListener('pointerdown', this._boundDown);
      window.removeEventListener('pointermove', this._boundMove);
      window.removeEventListener('pointerup', this._boundUp);
    }
  }
}
