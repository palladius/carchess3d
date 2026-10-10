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
import { CHARACTER_REGISTRY, squareToWorld } from '../core/Registry.js';
import {
  groundAndNormalizeObject3D,
  CANONICAL_PIECE_HEIGHTS,
  PEDESTAL_RADIUS,
  PEDESTAL_HEIGHT,
} from '../utils/glbGrounding.js';

const CLIP_NAME_MAP = Object.freeze({
  Idle: 'Idle_Track',
  Idle_Track: 'Idle_Track',
  idle: 'Idle_Track',
  Click_Fire_Breath: 'FireBreath_Track',
  FireBreath_Track: 'FireBreath_Track',
  fire: 'FireBreath_Track',
  attack: 'FireBreath_Track',
});

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
    this.rootGroup.add(this.livingGroup, this.trayGroup);

    /** @type {Map<string, THREE.Group>} square -> piece Group */
    this.pieceBySquare = new Map();
    /** @type {Map<string, Promise<any>>} url -> GLTF load promise */
    this.gltfCache = new Map();
    /** @type {Map<string, THREE.Texture>} url -> Texture */
    this.textureCache = new Map();
    /** @type {Set<{ mixer: THREE.AnimationMixer, clips: Map<string, THREE.AnimationClip>, root: THREE.Object3D }>} */
    this.activeMixers = new Set();
    /** @type {Array<object>} Active parabolic / castling / squash animations */
    this.activeTweens = [];

    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.globalPieceScale = 1.0;
    this.swampTime = 0;
    this.offs = [];

    this._applyInitArgs(sceneOrOpts, ctx);
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
          this.syncPiecesFromManager();
        }),
        bus.on('PIECES_SYNCED', (e) => {
          if (e.reason === 'board_sync' || e.reason === 'rival_set_changed' || e.reason === 'bishop_variant_changed') {
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
        bus.on('PIECE_ANIM_REQUESTED', (e) => {
          if (e.animType === 'clip') {
            const target = e.square ? this.getPieceObject(e.square) : null;
            if (target) {
              this.playClip(target, e.resolvedClip || e.clipKey);
            }
          }
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
   * Synchronizes all 3D living and captured tray pieces with `PieceManager`.
   * @param {Array<object>} [livingDescriptors]
   * @param {{ w: Array<object>, b: Array<object> }} [capturedTrays]
   */
  syncPiecesFromManager(livingDescriptors, capturedTrays) {
    const pm = this.ctx?.pieces || this.ctx?.pieceManager;
    const list = livingDescriptors || pm?.getLivingPieces?.() || this.ctx?.board?.pieces?.() || [];
    const trays = capturedTrays || pm?.getCapturedTrays?.() || { w: [], b: [] };

    this.clearGroup(this.livingGroup);
    this.pieceBySquare.clear();

    for (const raw of list) {
      const desc = pm?.resolveDescriptor ? pm.resolveDescriptor(raw) : this._fallbackDescriptor(raw);
      const group = this.buildPieceGroup(desc);
      const pos = squareToWorld(desc.square);
      group.position.set(pos.x, 0, pos.z);
      group.scale.setScalar(this.globalPieceScale);
      this.livingGroup.add(group);
      this.pieceBySquare.set(desc.square, group);
    }

    this.renderCapturedTrays(trays);
  }

  /**
   * Renders captured ("dead") pieces splashing happily inside the Enchanted Swamp Moat
   * ("Palude di Shrek", r = 6.2m..8.2m, half-submerged at y = -0.28m with emerald ripple rings & bubbles!).
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
        group.userData.swampPhase = globalIdx * 1.37;
        group.userData.baseSwampY = y;
        group.userData.baseSwampYaw = color === 'w' ? 0.35 : -0.35;

        group.position.set(x, y, z);
        group.scale.setScalar(0.84 * this.globalPieceScale);
        this.trayGroup.add(group);
        globalIdx += 1;
      });
    }
  }

  buildSwampSplashRing(color = 'w', seed = 0) {
    const splashGroup = new THREE.Group();
    splashGroup.name = 'SwampSplashRing';
    // Water surface sits around y = -0.44m in world space; since group is at y = -0.28m, local y = -0.15m
    splashGroup.position.y = -0.14;

    // 1. Shrek-green floating lily-pad / inner tube ring around waist
    const floatRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.065, 12, 28),
      new THREE.MeshStandardMaterial({
        color: color === 'w' ? 0x2ecc71 : 0x00bfa5,
        emissive: 0x0f522d,
        emissiveIntensity: 0.45,
        roughness: 0.35,
      }),
    );
    floatRing.rotation.x = Math.PI * 0.5;
    floatRing.position.y = 0.28;
    splashGroup.add(floatRing);

    // 2. Two concentric glowing lime-emerald water ripple rings
    const ripple1 = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 32),
      new THREE.MeshBasicMaterial({
        color: 0x69f0ae,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      }),
    );
    ripple1.rotation.x = -Math.PI * 0.5;
    ripple1.position.y = 0.26;

    const ripple2 = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.67, 32),
      new THREE.MeshBasicMaterial({
        color: 0x76ff03,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.52,
      }),
    );
    ripple2.rotation.x = -Math.PI * 0.5;
    ripple2.position.y = 0.255;
    splashGroup.add(ripple1, ripple2);

    // 3. Six rising green swamp bubbles / splash droplets
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
      const rad = 0.36 + (i % 2) * 0.14;
      bMesh.position.set(Math.cos(angle) * rad, 0.32 + (i * 0.08), Math.sin(angle) * rad);
      bMesh.userData = { angle, rad, phaseOffset: i * 1.05 };
      splashGroup.add(bMesh);
      bubbles.push(bMesh);
    }

    splashGroup.userData = { ripple1, ripple2, bubbles, floatRing };
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
   * - Either Stone Warrior (`isStoneSet`), or Luxury Medallion + Role Crown (replaced by GLB when loaded).
   * @param {object} desc
   * @returns {THREE.Group}
   */
  buildPieceGroup(desc) {
    const group = new THREE.Group();
    group.name = `Piece_${desc.color}_${desc.type}_${desc.square || 'standalone'}`;
    group.userData = {
      isChessPiece: true,
      pieceId: desc.id,
      square: desc.square,
      type: desc.type,
      color: desc.color,
      role: desc.role,
      name: desc.name,
      descriptor: desc,
      baseScale: this.globalPieceScale,
      emotePhase: 0,
    };

    // 1. Sculpted 3D Faction Pedestal (y = 0.00m .. 0.22m, Ø 0.75m)
    const pedestal = this.buildFactionPedestal(desc.color, desc.accentColor);
    group.add(pedestal);

    // 2. Body container atop pedestal
    const bodyContainer = new THREE.Group();
    bodyContainer.name = 'PieceBodyContainer';
    group.add(bodyContainer);
    group.userData.bodyContainer = bodyContainer;

    if (desc.isStoneSet) {
      const stoneMesh = this.buildStoneWarriorFigure(desc.type, desc.color);
      bodyContainer.add(stoneMesh);
    } else {
      // Build luxury double-sided portrait medallion + 3D crown fallback immediately
      const fallback = this.buildMedallionFallbackFigure(desc);
      bodyContainer.add(fallback);
      group.userData.fallbackFigure = fallback;

      // If a GLB path is configured, asynchronously load, clone, ground at y = PEDESTAL_HEIGHT, and swap!
      if (desc.glbUrl) {
        this.attachGlbToPiece(group, bodyContainer, desc);
      }
    }

    // Tag all child meshes with reference to root piece group for raycasting
    this._tagRaycastHierarchy(group);
    return group;
  }

  /**
   * Sculpted multi-tiered lathe/cylinder pedestal grounded strictly at `y = 0.0m`.
   * - White Team: Warm Ivory Marble (`0xfcf6e8`, roughness 0.25) + Gold trim (`0xe6b84a`).
   * - Black Team: Dark Obsidian (`0x181c26`, roughness 0.22) + Silver/Violet-Steel trim (`0xc0cce0`).
   */
  buildFactionPedestal(color, accentColor = 0xe6b84a) {
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
    const bodySpan = Math.max(0.55, totalHeight - PEDESTAL_HEIGHT);
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
      // King Riccardo: Royal Golden Toilet-Throne Crown + Cross Orb reaching 1.85m
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
      // Queen Kate: Tiara Coronet + Lilac Choco Pearl Spire reaching 1.65m
      const tiara = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.10, h * 0.55, 12), metalMat);
      tiara.position.y = startY + h * 0.28;
      const pearl = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 1), gemMat);
      pearl.position.y = startY + h * 0.78;
      crownGroup.add(tiara, pearl);
    } else if (type === 'b') {
      // Bishop Ale: Pointed Mitre + Dragon Ruby Gem reaching 1.45m
      const mitre = new THREE.Mesh(new THREE.ConeGeometry(0.13, h * 0.82, 16), bodyMat);
      mitre.position.y = startY + h * 0.41;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), gemMat);
      tip.position.y = startY + h * 0.88;
      crownGroup.add(mitre, tip);
    } else if (type === 'n') {
      // Knight Seby: Orange Loop-Track Arch + Turbo Crest reaching 1.35m
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.028, 12, 24), gemMat);
      arch.position.y = startY + h * 0.52;
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, h * 0.5, 8), metalMat);
      fin.position.y = startY + h * 0.75;
      crownGroup.add(arch, fin);
    } else if (type === 'r') {
      // Rook Pupurabbu: Castle Battlement Crenellations + Plush Ears reaching 1.20m
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, h * 0.65, 12), bodyMat);
      turret.position.y = startY + h * 0.325;
      const earL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), gemMat);
      earL.scale.set(0.8, 1.5, 0.6);
      earL.position.set(-0.08, startY + h * 0.76, 0);
      const earR = earL.clone();
      earR.position.x = 0.08;
      crownGroup.add(turret, earL, earR);
    } else {
      // Pawn Puffin: Swiss Guard Halberd Plume reaching 0.90m
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
                // Fix glTF 2.0 omitted metallicFactor=1.0 trap: restore full diffuse albedo!
                mat.metalness = 0.04;
                mat.metalnessMap = null;
                mat.roughness = 0.52;
                mat.roughnessMap = null;
                if (isWhite) {
                  if (mat.color) {
                    mat.color.setHex(0xffffff);
                  }
                  if (mat.emissive) {
                    mat.emissiveMap = mat.map || null;
                    mat.emissive.setHex(mat.map ? 0xffffff : 0x453318);
                    mat.emissiveIntensity = mat.map ? 0.32 : 0.28;
                  }
                } else {
                  if (mat.color) {
                    mat.color.setHex(0xb8c6f0);
                  }
                  if (mat.emissive) {
                    mat.emissiveMap = mat.map || null;
                    mat.emissive.setHex(mat.map ? 0x7c90e8 : 0x22184a);
                    mat.emissiveIntensity = mat.map ? 0.22 : 0.28;
                  }
                }
                if (isWireframe) {
                  mat.wireframe = true;
                }
                mat.needsUpdate = true;
              }
              child.material = Array.isArray(child.material) ? mats : mats[0];
            }
          }
        });

        // Ground & normalize character atop its pedestal (y = PEDESTAL_HEIGHT = 0.22m)
        const { holder } = groundAndNormalizeObject3D(
          THREE,
          clonedScene,
          desc.type,
          { baseElevation: PEDESTAL_HEIGHT, maxRadius: 0.36 },
        );
        // Subtle heroic 3/4 turn so both armies show their expressive faces & shoulder dragon
        holder.rotation.y = isWhite ? 0.16 : -0.16;

        // Remove fallback medallion figure and mount the grounded 3D GLB
        bodyContainer.clear();
        bodyContainer.add(holder);
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
  }

  /**
   * Plays a clip or procedural emote on the piece occupying `square`.
   * @param {string} square
   * @param {string} [clipKey='Idle']
   */
  playClipOnSquare(square, clipKey = 'Idle') {
    if (!square) return;
    const pieceGroup = this.pieceBySquare.get(square);
    if (pieceGroup) {
      this.playClip(pieceGroup, clipKey);
    }
  }

  /**
   * Animates a moving piece along a parabolic jump arc:
   * `y = 4 * h_peak * t * (1 - t)` (`h_peak = 1.2m`, `0.42s`) followed by
   * a squash-and-stretch landing (`scale(1.22, 0.78, 1.22) -> 1.0`).
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

    // If a piece was captured, launch its new swamp swimmer along a high splash arc into Shrek's Swamp!
    if (move.captured && this.trayGroup.children.length > 0) {
      const victimColor = move.color === 'w' ? 'b' : 'w';
      const swimmersForVictim = this.trayGroup.children.filter((c) => c.userData?.color === victimColor);
      const newestSwimmer = swimmersForVictim[swimmersForVictim.length - 1];
      if (newestSwimmer) {
        const capWorld = squareToWorld(capturedSq);
        const destX = newestSwimmer.position.x;
        const destY = newestSwimmer.userData.baseSwampY ?? -0.28;
        const destZ = newestSwimmer.position.z;
        newestSwimmer.userData.isDivingToSwamp = true;
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

    const startPos = squareToWorld(move.from);
    const endPos = squareToWorld(move.to);

    this.activeTweens.push({
      kind: 'parabolic_jump',
      group: movingGroup,
      fromX: startPos.x,
      fromZ: startPos.z,
      toX: endPos.x,
      toZ: endPos.z,
      hPeak: 1.2,
      elapsed: 0,
      duration: 0.42,
    });
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
      duration: 0.68,
      bounced: false,
    });
  }

  triggerSquashLanding(group) {
    this.activeTweens.push({
      kind: 'squash_landing',
      group,
      elapsed: 0,
      duration: 0.22,
    });
  }

  /**
   * Creates a standalone 3D piece Group for Mode 2 WOW 360° Turntable Inspector & Battle Arena.
   * @param {string} type - 'k'|'q'|'b'|'n'|'r'|'p'
   * @param {'w'|'b'} [color='w']
   * @param {{ isStoneSet?: boolean, bishopVariant?: 'rigged'|'hat' }} [opts]
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
        : 'assets/models/bishop-ale-rigged.glb';
    }
    const group = this.buildPieceGroup(desc);
    group.position.set(0, 0, 0);
    return group;
  }

  getPieceObject(square) {
    return this.pieceBySquare.get(square) || null;
  }

  getAllPieceObjects() {
    return Array.from(this.pieceBySquare.values());
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
   * Advances all `AnimationMixer` instances and active parabolic/castling/squash tweens.
   * @param {number} dt - Delta time in seconds
   */
  update(dt = 1 / 60) {
    for (const entry of this.activeMixers) {
      entry.mixer.update(dt);
    }

    // Animate captured ("dead") pieces splashing happily in Shrek's Swamp ("Palude Incantata")!
    this.swampTime += dt;
    if (this.trayGroup.children.length > 0) {
      for (let i = 0; i < this.trayGroup.children.length; i++) {
        const swimmer = this.trayGroup.children[i];
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
          const p1 = ((this.swampTime * 0.85 + phase * 0.3) % 1);
          const p2 = ((this.swampTime * 0.85 + phase * 0.3 + 0.5) % 1);
          if (splash.ripple1) {
            splash.ripple1.scale.setScalar(0.85 + p1 * 0.75);
            splash.ripple1.material.opacity = Math.max(0.15, (1 - p1) * 0.85);
          }
          if (splash.ripple2) {
            splash.ripple2.scale.setScalar(0.85 + p2 * 0.85);
            splash.ripple2.material.opacity = Math.max(0.12, (1 - p2) * 0.75);
          }
          if (Array.isArray(splash.bubbles)) {
            for (const b of splash.bubbles) {
              const bp = ((this.swampTime * 1.4 + b.userData.phaseOffset) % 1);
              const ang = b.userData.angle + Math.sin(this.swampTime * 2 + b.userData.phaseOffset) * 0.3;
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

      if (tw.kind === 'parabolic_jump') {
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
        }
      }
    }

    this.activeTweens = remaining;
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
