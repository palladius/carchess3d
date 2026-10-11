/**
 * @fileoverview Pre-Allocated Object-Pooled 3D VFX & 6x6 Capture Stage (`VFXPoolView`).
 *
 * Follows Niccolò Game Design Rule #6 & #7:
 * - Zero `new THREE.Mesh()` allocations during gameplay frames.
 * - Pre-allocates pools at startup (`visible = false` when inactive) for all 6 Carlesso
 *   signature attacks, family Easter Eggs, Stone Rival shrapnel, Swamp K.O. water droplets,
 *   and Golden Crit Overdrive:
 *   1. King Riccardo (`sceptre_lightning` & `golden_toilet_throne` — "Carlesso al Cesso" 🚽👑)
 *   2. Queen Kate (`chocolate_wave` — glossy milk-chocolate crest + lilac/gold confetti 🍫💜)
 *   3. Bishop Ale (`crystal_shatter` — translucent amethyst/ruby crystal case + 60 bouncing gem shards 💎🐉)
 *   4. Knight Seby (`loop_track_cars` — bright orange hot-wheels loop + 8 zooming toy cars + stars 🏎️✨)
 *   5. Rook Pupurabbu (`plush_ground_pound` — 2.6m high jump + indigo shockwave + 36 fluffy poof clouds 💥💜)
 *   6. Pawn Puffin (`halberd_fish_slap` — sculpted 3D silver-blue fish slap + spinning arc off-board 🐟⚔️)
 *   7. Easter Egg (`mega_cuddle_bounce` — Seby <-> Pupurabbu non-lethal cuddle hop + 40 3D hearts 💜🤗)
 *   8. Golden Crit Overdrive (`tier === 'golden_crit'` — 2x particles + golden sky-beam + rainbow ring 🌟)
 * - Stages the 3-Act `4.0s` 3D Scazzottata between the two `.glb` characters (`this.attackerFighter` &
 *   `this.defenderFighter`) with attached 3D character weapons (`buildFighterWeaponProp(pieceType)`),
 *   character-specific Defender Counter-Attacks in Act 2, 3D Floating Comic Impact Words
 *   (`this.props.comicWordSprite` at `y = 1.95m`), impact camera shake, and a 3D Shrek Swamp
 *   Water Splash ring + droplet burst (`x = ±6.4m, y = -0.28m`) at the end of Act 3!
 */

import * as THREE from 'three';
import { CHARACTER_REGISTRY, squareToWorld } from '../core/Registry.js';

const GRAVITY = 9.8;
const DEBRIS_LIFETIME_S = 4.5;

/**
 * Declarative combat & counter-attack specs per character role (Niccolò Rule #7: Data-driven over if/else).
 */
export const FIGHTER_COMBAT_SPECS = Object.freeze({
  p: {
    weaponId: 'halberd_and_fish',
    counterMove: 'halberd_fish_parry',
    counterLabel: 'PARATA ALABARDA & PESCE! ⚔️🐟',
    counterPool: 'fish_and_feathers',
    counterPitch: 0.46,
    counterJumpY: 0.24,
    counterRollAmp: 0.34,
    counterSpinYaw: 0,
    pushBackDist: 0.28,
    bellyInflate: 1.0,
  },
  b: {
    weaponId: 'amethyst_staff_and_dragon_fire',
    counterMove: 'dragon_flame_puff',
    counterLabel: 'FIAMMATA DEL DRAGHETTO! 🐉🔥',
    counterPool: 'amethyst_ruby_shards',
    counterPitch: 0.32,
    counterJumpY: 0.28,
    counterRollAmp: 0.22,
    counterSpinYaw: 0,
    pushBackDist: 0.30,
    bellyInflate: 1.0,
  },
  n: {
    weaponId: 'turbo_booster_and_orbit_car',
    counterMove: 'horse_rear_hoof_kick',
    counterLabel: 'IMPENNATA E CALCIO TURBO! 🐴🏎️',
    counterPool: 'golden_sparks',
    counterPitch: -0.64,
    counterJumpY: 0.38,
    counterRollAmp: 0.18,
    counterSpinYaw: 0,
    pushBackDist: 0.32,
    bellyInflate: 1.0,
  },
  r: {
    weaponId: 'plush_boxing_gloves_and_aura',
    counterMove: 'plush_belly_bounce',
    counterLabel: 'PANCIONE BOING PUFFOSO! 💜🥊',
    counterPool: 'purple_poof_clouds',
    counterPitch: -0.24,
    counterJumpY: 0.34,
    counterRollAmp: 0.28,
    counterSpinYaw: 0,
    pushBackDist: 0.38,
    bellyInflate: 1.30,
  },
  q: {
    weaponId: 'choco_swirl_wand_and_shield',
    counterMove: 'lilac_choco_shield_spin',
    counterLabel: 'SCUDO VORTICE LILLA! 🛡️🍫',
    counterPool: 'choco_lilac_confetti',
    counterPitch: 0.20,
    counterJumpY: 0.26,
    counterRollAmp: 0.20,
    counterSpinYaw: Math.PI * 4,
    pushBackDist: 0.30,
    bellyInflate: 1.0,
  },
  k: {
    weaponId: 'lightning_sceptre_and_plunger_crown',
    counterMove: 'royal_sceptre_zap',
    counterLabel: 'SCETTRO LAMPO REALE! ⚡👑',
    counterPool: 'golden_sparks',
    counterPitch: 0.38,
    counterJumpY: 0.28,
    counterRollAmp: 0.24,
    counterSpinYaw: 0,
    pushBackDist: 0.34,
    bellyInflate: 1.0,
  },
});

export class VFXPoolView {
  /**
   * @param {object} [deps]
   * @param {THREE.Scene} [deps.scene]
   * @param {THREE.Camera} [deps.camera]
   * @param {any} [deps.controls]
   * @param {import('../core/EventBus.js').GameEventBus} [deps.bus]
   * @param {any} [deps.pieceView]
   */
  constructor(deps = {}) {
    this.scene = deps.scene || null;
    this.camera = deps.camera || null;
    this.controls = deps.controls || null;
    this.bus = deps.bus || null;
    this.pieceView = deps.pieceView || null;

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'VFXPoolRoot';

    /** @type {Map<string, Array<THREE.Object3D>>} */
    this.pools = new Map();
    /** @type {Array<object>} */
    this.activeParticles = [];

    // Special stage props (pre-allocated once, toggled via `.visible`)
    this.props = {};
    this.victimProxy = null;
    this.cuddlePartnerProxy = null;
    this.clashLight = null;

    // Active cutscene state
    this.activeClash = null;
    this.clashElapsed = 0;
    this.currentComicWord = '';
    this.defenderCounterBurstFired = false;
    this.swampSplashTriggered = false;
    this.swampLandingPos = { x: 6.4, y: -0.28, z: 0 };
    this.lastCameraShake = 0;

    // Orbiting camera & smooth sliding-window transition state
    this.camSaved = null;
    this.camRestoreTimer = 0;
    this.camRestoreDuration = 0;
    this.exitWindowTotalS = 3.5;
    this.exitPreWindowS = 0;
    this.combatBlend = 0.0;
    this.lastCombatDesiredPos = new THREE.Vector3(0, 2.5, 4.8);
    this.lastCombatDesiredTarget = new THREE.Vector3(0, 1.62, 0);
    this.lastNetflixMirrorPos = new THREE.Vector3(0, 0.78, -6.0);
    this.lastNetflixMirrorScale = 1.53;
    this.lastNetflixMirrorQuat = new THREE.Quaternion();
    this._idleMirrorQuat = new THREE.Quaternion(0, 0, 0, 1);
    this.hiddenBoardNodes = [];
    this.offs = [];

    if (this.scene) {
      this.scene.userData = this.scene.userData || {};
      this.scene.userData.vfxControlsCombatBlend = true;
      this.buildPools();
      this.scene.add(this.rootGroup);
    }
    if (this.bus) {
      this.bindEvents(this.bus);
    }
  }

  /**
   * Initialize or re-bind with `GameContext` / dependencies.
   * @param {object} [ctx]
   */
  init(ctx = {}) {
    if (ctx.scene && !this.scene) {
      this.scene = ctx.scene;
      this.scene.userData = this.scene.userData || {};
      this.scene.userData.vfxControlsCombatBlend = true;
      if (this.pools.size === 0) this.buildPools();
      this.scene.add(this.rootGroup);
    }
    if (ctx.camera) this.camera = ctx.camera;
    if (ctx.controls) this.controls = ctx.controls;
    if (ctx.pieceView) this.pieceView = ctx.pieceView;
    const bus = ctx.bus || this.bus;
    if (bus && this.offs.length === 0) {
      this.bus = bus;
      this.bindEvents(bus);
    }
  }

  bindEvents(bus) {
    this.offs.push(
      bus.on('BATTLE_STARTED', (e) => this.onBattleStarted(e)),
      bus.on('BATTLE_COMPLETED', (e) => this.onBattleEnded(e)),
      bus.on('BATTLE_SKIPPED', (e) => this.onBattleEnded(e)),
      bus.on('CHECKMATE', (e) => this.onCheckmate(e)),
      bus.on('BOARD_RESET', () => this.clearAllActive()),
      bus.on('CAMERA_VIEW_REQUESTED', (e) => {
        if (e?.pos && this.camSaved) {
          this.camSaved.pos.set(e.pos.x, e.pos.y, e.pos.z);
          if (e.target) {
            this.camSaved.target.set(e.target.x, e.target.y, e.target.z);
          }
          if (typeof e.fov === 'number') {
            this.camSaved.fov = e.fov;
          }
        }
      }),
    );
  }

  /**
   * Pre-allocates all reusable object pools and hero stage props at startup.
   * Zero meshes are created during `update(dt)`.
   */
  buildPools() {
    // 1. Golden Sparks (`sceptre_lightning` & `golden_toilet_throne`) — 60 orbs
    const sparkGeo = new THREE.SphereGeometry(0.065, 8, 8);
    this.createPool('golden_sparks', 60, () => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffd54f,
        emissive: 0xffb300,
        emissiveIntensity: 1.4,
        roughness: 0.2,
        metalness: 0.8,
        transparent: true,
        opacity: 1,
      });
      return new THREE.Mesh(sparkGeo, mat);
    });

    // 2. Lilac & Gold Confetti (`chocolate_wave`) — 60 ribbons
    const confettiGeo = new THREE.BoxGeometry(0.11, 0.02, 0.065);
    const confettiColors = [0xce93d8, 0xffd54f, 0xab47bc, 0x4e2c18, 0xf48fb1];
    this.createPool('choco_lilac_confetti', 60, (i) => {
      const col = confettiColors[i % confettiColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        metalness: 0.3,
        transparent: true,
        opacity: 1,
      });
      return new THREE.Mesh(confettiGeo, mat);
    });

    // 3. Faceted Amethyst & Ruby Gem Shards (`crystal_shatter`) — 70 shards
    const shardGeo = new THREE.OctahedronGeometry(0.085, 0);
    const gemColors = [0xab47bc, 0xe53935, 0x7e57c2, 0x29b6f6, 0xff4081];
    this.createPool('amethyst_ruby_shards', 70, (i) => {
      const col = gemColors[i % gemColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.45,
        roughness: 0.14,
        metalness: 0.25,
        transparent: true,
        opacity: 0.92,
      });
      return new THREE.Mesh(shardGeo, mat);
    });

    // 4. Die-Cast Miniature Toy Cars (`loop_track_cars`) — 12 cars
    const carBodyGeo = new THREE.BoxGeometry(0.22, 0.07, 0.12);
    const carCabinGeo = new THREE.BoxGeometry(0.11, 0.055, 0.10);
    const wheelGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.14, 8);
    wheelGeo.rotateZ(Math.PI * 0.5);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const carPalette = [0xff3d00, 0x00e676, 0x2979ff, 0xffea00, 0xd500f9, 0x00e5ff];

    this.createPool('diecast_toy_cars', 12, (i) => {
      const carGroup = new THREE.Group();
      const col = carPalette[i % carPalette.length];
      const bodyMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.2,
        metalness: 0.6,
        transparent: true,
        opacity: 1,
      });
      const cabinMat = new THREE.MeshStandardMaterial({
        color: 0xe0f7fa,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.9,
      });
      const body = new THREE.Mesh(carBodyGeo, bodyMat);
      body.position.y = 0.045;
      const cabin = new THREE.Mesh(carCabinGeo, cabinMat);
      cabin.position.set(-0.01, 0.095, 0);
      const wFront = new THREE.Mesh(wheelGeo, wheelMat);
      wFront.position.set(0.065, 0.032, 0);
      const wBack = new THREE.Mesh(wheelGeo, wheelMat);
      wBack.position.set(-0.065, 0.032, 0);
      carGroup.add(body, cabin, wFront, wBack);
      carGroup.userData.primaryMat = bodyMat;
      return carGroup;
    });

    // 5. Fluffy Purple Poof Clouds (`plush_ground_pound`) — 50 clouds
    const poofGeo = new THREE.SphereGeometry(0.12, 10, 10);
    const poofColors = [0xb39ddb, 0x9575cd, 0xce93d8, 0xede7f6];
    this.createPool('purple_poof_clouds', 50, (i) => {
      const col = poofColors[i % poofColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: 0x5e35b1,
        emissiveIntensity: 0.3,
        roughness: 0.85,
        metalness: 0.05,
        transparent: true,
        opacity: 0.95,
      });
      return new THREE.Mesh(poofGeo, mat);
    });

    // 6. Feathers & Water Droplets (`halberd_fish_slap`) — 40 particles
    const featherGeo = new THREE.ConeGeometry(0.045, 0.15, 6);
    const featherColors = [0xffffff, 0x4dd0e1, 0xff8a65, 0x80deea];
    this.createPool('fish_and_feathers', 40, (i) => {
      const col = featherColors[i % featherColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.25,
        roughness: 0.4,
        transparent: true,
        opacity: 1,
      });
      return new THREE.Mesh(featherGeo, mat);
    });

    // 7. Floating 3D Purple/Pink Hearts (`mega_cuddle_bounce` Easter Egg) — 50 hearts
    const heartGeo = this.createHeartGeometry();
    const heartColors = [0xe040fb, 0xff4081, 0xab47bc, 0xff80ab, 0xb388ff];
    this.createPool('floating_purple_hearts', 50, (i) => {
      const col = heartColors[i % heartColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.2,
        transparent: true,
        opacity: 1,
      });
      return new THREE.Mesh(heartGeo, mat);
    });

    // 8. Classic Stone Rival Shrapnel (`stone_shrapnel`) — 36 chunks
    const stoneGeo = new THREE.DodecahedronGeometry(0.075, 0);
    this.createPool('stone_shrapnel', 36, () => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x607d8b,
        roughness: 0.82,
        metalness: 0.15,
        transparent: true,
        opacity: 1,
      });
      return new THREE.Mesh(stoneGeo, mat);
    });

    // 9. Shrek Swamp Emerald Water Splash Droplets (`swamp_water_droplets`) — 42 droplets
    const dropletGeo = new THREE.SphereGeometry(0.068, 8, 8);
    const swampColors = [0x00e676, 0x69f0ae, 0x1de9b6, 0x76ff03, 0x4dd0e1];
    this.createPool('swamp_water_droplets', 42, (i) => {
      const col = swampColors[i % swampColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.75,
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.95,
      });
      return new THREE.Mesh(dropletGeo, mat);
    });

    // 10. Sacro Acquarius Diamond-Ice Shards (`diamond_ice_crystals` — Seby vs Puffin) — 64 crystals
    const iceShardGeo = new THREE.OctahedronGeometry(0.095, 0);
    const iceColors = [0x80deea, 0xe0f7fa, 0x00e5ff, 0x4dd0e1, 0xffffff];
    this.createPool('diamond_ice_crystals', 64, (i) => {
      const col = iceColors[i % iceColors.length];
      const mat = new THREE.MeshPhysicalMaterial({
        color: col,
        emissive: 0x00bcd4,
        emissiveIntensity: 0.65,
        roughness: 0.06,
        metalness: 0.15,
        transmission: 0.78,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.96,
      });
      return new THREE.Mesh(iceShardGeo, mat);
    });

    // 11. San Gennaro Liquefied Blood Droplets & Golden Miracle Sparks (`san_gennaro_blood_drops`) — 64 droplets
    const dropGeo = new THREE.SphereGeometry(0.072, 10, 10);
    const bloodColors = [0xd50000, 0xff1744, 0xb71c1c, 0xffd700];
    this.createPool('san_gennaro_blood_drops', 64, (i) => {
      const col = bloodColors[i % bloodColors.length];
      const isGold = col === 0xffd700;
      const mat = new THREE.MeshPhysicalMaterial({
        color: col,
        emissive: isGold ? 0xffab00 : 0xd50000,
        emissiveIntensity: isGold ? 1.3 : 1.05,
        roughness: 0.08,
        metalness: isGold ? 0.85 : 0.12,
        transmission: isGold ? 0.0 : 0.55,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.96,
      });
      const mesh = new THREE.Mesh(dropGeo, mat);
      if (!isGold) mesh.scale.set(0.85, 1.35, 0.85);
      return mesh;
    });

    this.buildStageProps();
  }

  createHeartGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.06);
    shape.bezierCurveTo(0.06, -0.01, 0.09, 0.05, 0.045, 0.085);
    shape.bezierCurveTo(0.015, 0.10, 0, 0.07, 0, 0.055);
    shape.bezierCurveTo(0, 0.07, -0.015, 0.10, -0.045, 0.085);
    shape.bezierCurveTo(-0.09, 0.05, -0.06, -0.01, 0, -0.06);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.03,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008,
    });
  }

  createPool(name, count, factory) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const obj = factory(i);
      obj.visible = false;
      this.rootGroup.add(obj);
      arr.push(obj);
    }
    this.pools.set(name, arr);
  }

  /**
   * Pre-allocates the hero stage props (Rune Circle, Lightning Bolts, Golden Toilet-Throne,
   * Chocolate Wave Crest, Crystal Display Case, Orange Loop-Track, Orbiting Stars,
   * Cartoon Silver-Blue Fish, Shockwave Ring, Golden Crit Sky-Beam, 3D Comic Impact Sprite,
   * Swamp K.O. Water Splash Ring, and Victim/Cuddle Proxies).
   */
  buildStageProps() {
    // Dynamic clash point light
    this.clashLight = new THREE.PointLight(0xffd54f, 0, 6.5);
    this.clashLight.visible = false;
    this.rootGroup.add(this.clashLight);

    // 1a. Golden Rune Circle + Jagged Lightning Bolts
    const runeGeo = new THREE.RingGeometry(0.32, 0.52, 32);
    runeGeo.rotateX(-Math.PI * 0.5);
    this.props.runeCircle = new THREE.Mesh(
      runeGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffd54f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.props.runeCircle.visible = false;
    this.rootGroup.add(this.props.runeCircle);

    this.props.lightningBolts = new THREE.Group();
    const boltGeo = new THREE.CylinderGeometry(0.025, 0.05, 2.4, 6);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xfff59d, transparent: true, opacity: 0.95 });
    for (let i = 0; i < 5; i++) {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(Math.cos((i * Math.PI * 2) / 5) * 0.18, 1.2, Math.sin((i * Math.PI * 2) / 5) * 0.18);
      bolt.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.12;
      this.props.lightningBolts.add(bolt);
    }
    this.props.lightningBolts.visible = false;
    this.rootGroup.add(this.props.lightningBolts);

    // 1b. Sculpted Golden Toilet-Throne ("Carlesso al Cesso" 🚽👑)
    const throne = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffca28,
      emissive: 0xff8f00,
      emissiveIntensity: 0.55,
      roughness: 0.18,
      metalness: 0.92,
    });
    const basePed = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.24, 16), goldMat);
    basePed.position.y = 0.12;
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), goldMat);
    bowl.scale.set(1.0, 0.75, 1.25);
    bowl.position.set(0, 0.34, 0.06);
    const seatRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 12, 24), goldMat);
    seatRim.rotation.x = Math.PI * 0.5;
    seatRim.position.set(0, 0.48, 0.06);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.22), goldMat);
    tank.position.set(0, 0.68, -0.22);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 6), goldMat);
    crown.position.set(0, 1.08, -0.22);
    throne.add(basePed, bowl, seatRim, tank, crown);
    throne.visible = false;
    this.props.goldenThrone = throne;
    this.rootGroup.add(throne);

    // 2. Queen Kate Glossy Milk-Chocolate Wave Torus (`0x4e2c18`, low roughness 0.15)
    const chocoGeo = new THREE.TorusGeometry(0.38, 0.14, 16, 32);
    chocoGeo.rotateX(Math.PI * 0.5);
    this.props.chocoWave = new THREE.Mesh(
      chocoGeo,
      new THREE.MeshStandardMaterial({
        color: 0x4e2c18,
        emissive: 0x3e2723,
        emissiveIntensity: 0.25,
        roughness: 0.15,
        metalness: 0.25,
        transparent: true,
        opacity: 0.95,
      }),
    );
    this.props.chocoWave.visible = false;
    this.rootGroup.add(this.props.chocoWave);

    // 3. Bishop Ale Translucent Amethyst/Ruby Crystal Display Case
    const crystalGeo = new THREE.OctahedronGeometry(0.68, 1);
    this.props.crystalCase = new THREE.Mesh(
      crystalGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0x9c27b0,
        emissive: 0x7b1fa2,
        emissiveIntensity: 0.4,
        roughness: 0.08,
        metalness: 0.1,
        transmission: 0.78,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.82,
      }),
    );
    this.props.crystalCase.visible = false;
    this.rootGroup.add(this.props.crystalCase);

    // 4. Knight Seby Bright Orange Loop-Track Ring (`0xff6d00`) + Cartoon Stars
    const loopGeo = new THREE.TorusGeometry(0.68, 0.075, 14, 36);
    this.props.loopTrack = new THREE.Mesh(
      loopGeo,
      new THREE.MeshStandardMaterial({
        color: 0xff6d00,
        emissive: 0xff3d00,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.4,
      }),
    );
    this.props.loopTrack.visible = false;
    this.rootGroup.add(this.props.loopTrack);

    this.props.dizzyStars = new THREE.Group();
    const starGeo = new THREE.OctahedronGeometry(0.075, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    for (let i = 0; i < 6; i++) {
      const star = new THREE.Mesh(starGeo, starMat);
      const ang = (i * Math.PI * 2) / 6;
      star.position.set(Math.cos(ang) * 0.38, 0, Math.sin(ang) * 0.38);
      this.props.dizzyStars.add(star);
    }
    this.props.dizzyStars.visible = false;
    this.rootGroup.add(this.props.dizzyStars);

    // 5. Rook Pupurabbu Indigo Shockwave Ring
    const shockGeo = new THREE.RingGeometry(0.25, 0.46, 32);
    shockGeo.rotateX(-Math.PI * 0.5);
    this.props.shockwaveRing = new THREE.Mesh(
      shockGeo,
      new THREE.MeshBasicMaterial({
        color: 0x7e57c2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.props.shockwaveRing.visible = false;
    this.rootGroup.add(this.props.shockwaveRing);

    // 6. Pawn Puffin Sculpted 3D Cartoon Silver-Blue Fish (`🐟`)
    const fishGroup = new THREE.Group();
    const fishMat = new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      emissive: 0x0288d1,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.65,
    });
    const fishBody = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), fishMat);
    fishBody.scale.set(1.9, 0.75, 0.5);
    const fishTail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 4), fishMat);
    fishTail.rotation.z = -Math.PI * 0.5;
    fishTail.position.set(-0.34, 0, 0);
    fishGroup.add(fishBody, fishTail);
    fishGroup.visible = false;
    this.props.puffinFish = fishGroup;
    this.rootGroup.add(fishGroup);

    // 7. Golden Crit Sky-Beam Pillar (subtle halo so fighters remain crisp)
    const beamGeo = new THREE.CylinderGeometry(0.45, 0.65, 5.5, 20, 1, true);
    this.props.skyBeam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      }),
    );
    this.props.skyBeam.visible = false;
    this.rootGroup.add(this.props.skyBeam);

    // 7b. San Gennaro Sacred Reliquary Ampoule (`Ampolla del Sangue di San Gennaro 🩸✨`)
    const ampouleGroup = new THREE.Group();
    ampouleGroup.name = 'SanGennaroReliquaryAmpoule';
    const reliquaryGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      emissive: 0xff8f00,
      emissiveIntensity: 0.65,
      roughness: 0.18,
      metalness: 0.92,
    });
    const reliquaryRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.055, 16, 32), reliquaryGoldMat);
    const topCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), reliquaryGoldMat);
    topCrossV.position.set(0, 0.50, 0);
    const topCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), reliquaryGoldMat);
    topCrossH.position.set(0, 0.52, 0);
    const stemPed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.28, 16), reliquaryGoldMat);
    stemPed.position.set(0, -0.48, 0);
    const glassVial = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 20, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.06,
        metalness: 0.05,
        transmission: 0.86,
        transparent: true,
        opacity: 0.52,
      }),
    );
    glassVial.scale.set(1.0, 1.12, 0.58);
    const bloodCoreMat = new THREE.MeshPhysicalMaterial({
      color: 0x4a000b,
      emissive: 0x3b0008,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.1,
      clearcoat: 1.0,
    });
    const bloodCore = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), bloodCoreMat);
    bloodCore.scale.set(0.9, 0.52, 0.48);
    bloodCore.position.set(0, -0.05, 0);
    ampouleGroup.add(reliquaryRing, topCrossV, topCrossH, stemPed, glassVial, bloodCore);
    ampouleGroup.userData = { bloodCore, bloodCoreMat, reliquaryRing };
    ampouleGroup.visible = false;
    this.props.sanGennaroAmpoule = ampouleGroup;
    this.rootGroup.add(ampouleGroup);

    // 8. 3D Scazzottata Brawl Stage & Cartoon Brawl Cloud + Starburst
    this.brawlStageGroup = new THREE.Group();
    this.brawlStageGroup.name = 'BrawlStageFighters';
    this.rootGroup.add(this.brawlStageGroup);
    this.attackerFighter = null;
    this.defenderFighter = null;
    this.attackerWeaponProp = null;
    this.defenderWeaponProp = null;
    this.hiddenBoardNodes = [];

    this.props.brawlCloud = this.createBrawlCloudProp();
    this.rootGroup.add(this.props.brawlCloud);

    // 9. Pre-allocated 3D Floating Comic Impact Word Sprite (kept hidden to prevent occluding the 3D fighters)
    this.props.comicWordSprite = this.createComicWordSpriteProp();
    this.rootGroup.add(this.props.comicWordSprite);

    // 10. Pre-allocated 3D Shrek Swamp K.O. Water Splash Ring (`x = ±6.4m, y = -0.28m`)
    this.props.swampKoSplash = this.createSwampKoSplashProp();
    this.rootGroup.add(this.props.swampKoSplash);

    // 11. Sacro Acquarius Celestial Water-Bearer Maiden + Giant Golden Amphora + IceCoffin (`n_x_p`)
    this.props.aquariusMaiden = this.createAquariusMaidenAmphoraProp();
    this.props.iceCoffin = this.createIceCoffinProp();
    this.rootGroup.add(this.props.aquariusMaiden, this.props.iceCoffin);

    // 12. King Riccardo ("Papino" `k`) 6 D&D Spells 3D Stage Props
    this.createPapinoDndProps();

    // 13. Fallback Stage Figurines (used only in headless unit tests where PieceView is not mounted)
    this.victimProxy = this.createStageFigurine(0xd7ccc8);
    this.cuddlePartnerProxy = this.createStageFigurine(0x9575cd);
    this.rootGroup.add(this.victimProxy, this.cuddlePartnerProxy);
  }

  /**
<<<<<<< HEAD
   * Pre-allocates the 3D D&D Spell Stage Props for King Riccardo ("Papino" `k`):
   * - `dndFireball`: Blazing 8d6 Fireball sphere + floating golden d20 icosahedron (`k_x_p`)
   * - `dndMeteorSwarm`: 4 blazing volcanic meteors raining from a sky spell ring (`k_x_b`)
   * - `dndComicDaemon`: Chubby red comic baby Balor demon with horns, bat wings, pitchfork & pizza slice (`k_x_r`)
   * - `dndDisintegrateRay`: Intense emerald-green Disintegrate beam + green arcane dust pile (`k_x_k`)
   * - `dndPetrifyStatue`: Gray-gold marble petrification shell around the target (`k_x_q`)
   */
  createPapinoDndProps() {
    // 1. D&D Fireball (`k_x_p`) + Golden d20
    const fbGroup = new THREE.Group();
    fbGroup.name = 'DndFireballProp';
    const fbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 14),
      new THREE.MeshBasicMaterial({ color: 0xff6d00, transparent: true, opacity: 0.9 }),
    );
    const d20Mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xff8f00,
        emissiveIntensity: 0.75,
        roughness: 0.15,
        metalness: 0.9,
      }),
    );
    d20Mesh.position.set(0, 0.65, 0);
    fbGroup.add(fbCore, d20Mesh);
    fbGroup.userData = { fbCore, d20Mesh };
    fbGroup.visible = false;
    this.props.dndFireball = fbGroup;
    this.rootGroup.add(fbGroup);

    // 2. D&D Meteor Swarm (`k_x_b`) — 4 volcanic meteors with flame tails
    const meteorGroup = new THREE.Group();
    meteorGroup.name = 'DndMeteorSwarmProp';
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xd84315,
      emissive: 0xff3d00,
      emissiveIntensity: 0.85,
      roughness: 0.4,
    });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), rockMat);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.65, 8), tailMat);
      tail.position.set(0, 0.42, 0);
      m.add(rock, tail);
      const ang = (i * Math.PI * 2) / 4;
      m.position.set(Math.cos(ang) * 0.45, 1.8 + i * 0.35, Math.sin(ang) * 0.45);
      meteorGroup.add(m);
    }
    meteorGroup.visible = false;
    this.props.dndMeteorSwarm = meteorGroup;
    this.rootGroup.add(meteorGroup);

    // 3. D&D Summon Greater Comic Daemon (`k_x_r`) — Chubby Red Baby Balor with Horns, Bat Wings & Pizza
    const daemonGroup = new THREE.Group();
    daemonGroup.name = 'DndComicDaemonProp';
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xe53935,
      emissive: 0xb71c1c,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.2, metalness: 0.8 });
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), redMat);
    belly.position.set(0, 0.38, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), redMat);
    head.position.set(0, 0.82, 0);
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 8), hornMat);
    hornL.position.set(-0.14, 1.02, 0);
    hornL.rotation.z = 0.35;
    const hornR = hornL.clone();
    hornR.position.x = 0.14;
    hornR.rotation.z = -0.35;
    // Slice of Pizza in left hand!
    const pizzaSlice = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.28, 3),
      new THREE.MeshBasicMaterial({ color: 0xffca28 }),
    );
    pizzaSlice.position.set(-0.36, 0.55, 0.18);
    pizzaSlice.rotation.x = Math.PI * 0.4;
    daemonGroup.add(belly, head, hornL, hornR, pizzaSlice);
    daemonGroup.visible = false;
    this.props.dndComicDaemon = daemonGroup;
    this.rootGroup.add(daemonGroup);

    // 4. D&D Disintegrate Emerald Laser Ray (`k_x_k`)
    const disGroup = new THREE.Group();
    disGroup.name = 'DndDisintegrateRayProp';
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.12, 1.8, 12),
      new THREE.MeshBasicMaterial({ color: 0x00e676, transparent: true, opacity: 0.92 }),
    );
    beam.rotation.x = Math.PI * 0.5;
    beam.position.set(0, 0.68, 0);
    const dustPile = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.28, 16),
      new THREE.MeshStandardMaterial({
        color: 0x00e676,
        emissive: 0x00c853,
        emissiveIntensity: 0.65,
        roughness: 0.8,
      }),
    );
    dustPile.position.set(0, 0.14, 0);
    disGroup.add(beam, dustPile);
    disGroup.userData = { beam, dustPile };
    disGroup.visible = false;
    this.props.dndDisintegrateRay = disGroup;
    this.rootGroup.add(disGroup);

    // 5. D&D Flesh to Stone / Petrification Statue Shell (`k_x_q`)
    const petrifyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.44, 1.32, 8),
      new THREE.MeshStandardMaterial({
        color: 0x9e9e9e,
        emissive: 0xffca28,
        emissiveIntensity: 0.28,
        roughness: 0.65,
        metalness: 0.25,
        transparent: true,
        opacity: 0.72,
      }),
    );
    petrifyMesh.name = 'DndPetrifyStatueProp';
    petrifyMesh.position.set(0, 0.66, 0);
    petrifyMesh.visible = false;
    this.props.dndPetrifyStatue = petrifyMesh;
    this.rootGroup.add(petrifyMesh);
  }

  /**
   * Builds the celestial Golden-Cyan Water-Bearer Maiden silhouette holding an enormous
   * Golden Amphora (`Anfora dell'Acquario`) pouring a luminous stream of Absolute-Zero ice energy.
   */
  createAquariusMaidenAmphoraProp() {
    const group = new THREE.Group();
    group.name = 'AquariusMaidenAmphora';

    const auraMat = new THREE.MeshStandardMaterial({
      color: 0x80deea,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.82,
    });
    const goldAmphoraMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      emissive: 0xffa000,
      emissiveIntensity: 0.65,
      roughness: 0.18,
      metalness: 0.88,
    });
    const iceStreamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f7fa,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });

    // Celestial maiden flowing robe & torso silhouette
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 16), auraMat);
    robe.position.set(0, 0.48, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), auraMat);
    head.position.set(0, 1.06, 0);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 10, 24), goldAmphoraMat);
    halo.position.set(0, 1.12, -0.04);

    // Enormous Golden Amphora held overhead and tilted forward
    const amphoraGroup = new THREE.Group();
    amphoraGroup.position.set(0, 1.36, 0.18);
    amphoraGroup.rotation.x = Math.PI * 0.38;
    const vaseBelly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), goldAmphoraMat);
    vaseBelly.scale.set(1.0, 1.35, 1.0);
    const vaseNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.24, 16), goldAmphoraMat);
    vaseNeck.position.set(0, 0.32, 0);
    const vaseLip = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 10, 20), goldAmphoraMat);
    vaseLip.rotation.x = Math.PI * 0.5;
    vaseLip.position.set(0, 0.44, 0);
    amphoraGroup.add(vaseBelly, vaseNeck, vaseLip);

    // Luminous cascading ice-energy stream pouring out of the Amphora mouth
    const streamBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.34, 1.45, 16, 1, true),
      iceStreamMat,
    );
    streamBeam.position.set(0, 1.05, 0.65);
    streamBeam.rotation.x = -Math.PI * 0.32;

    group.add(robe, head, halo, amphoraGroup, streamBeam);
    group.userData = { amphoraGroup, streamBeam, halo };
    group.visible = false;
    return group;
  }

  /**
   * Builds the towering translucent Diamond-Blue Ice Coffin (`Teca di Ghiaccio Eterno`)
   * that encases the victim before crumbling into 60+ diamond-ice crystals.
   */
  createIceCoffinProp() {
    const group = new THREE.Group();
    group.name = 'TecaDiGhiaccioEterno';

    const iceGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x4dd0e1,
      emissive: 0x00bcd4,
      emissiveIntensity: 0.55,
      roughness: 0.05,
      metalness: 0.14,
      transmission: 0.88,
      ior: 1.33,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const frontIceSlabMat = new THREE.MeshPhysicalMaterial({
      color: 0x80deea,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.42,
      roughness: 0.04,
      metalness: 0.10,
      transmission: 0.90,
      ior: 1.35,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const frostRimMat = new THREE.MeshStandardMaterial({
      color: 0xe0f7fa,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.72,
      roughness: 0.15,
      metalness: 0.35,
    });

    // Main hexagonal prism ice monolith surrounding the Puffin (rendered after the Puffin so the Puffin is BEHIND the ice)
    const monolith = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 1.48, 6), iceGlassMat);
    monolith.position.set(0, 0.74, 0);
    monolith.renderOrder = 18;

    // Thick front refractive ice slab so the translucent cyan Puffin is unmistakably BEHIND the ice wall
    const frontSlab = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.36, 0.16), frontIceSlabMat);
    frontSlab.position.set(0, 0.72, 0.42);
    frontSlab.renderOrder = 19;

    // Crown of jagged ice spires atop the coffin
    const spireGeo = new THREE.ConeGeometry(0.14, 0.36, 5);
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI * 2) / 6;
      const spire = new THREE.Mesh(spireGeo, frostRimMat);
      spire.position.set(Math.cos(ang) * 0.40, 1.52, Math.sin(ang) * 0.40);
      group.add(spire);
    }

    // Frozen base rune pedestal
    const baseIce = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.10, 6), frostRimMat);
    baseIce.position.set(0, 0.05, 0);

    group.add(monolith, frontSlab, baseIce);
    group.visible = false;
    return group;
  }

  /**
   * Builds a pre-allocated `THREE.Sprite` with a dynamic `512x160` `CanvasTexture`.
   * Kept hidden during 3D close-up combat so it never occludes the two fighting pieces.
   */
  createComicWordSpriteProp() {
    let tex = null;
    let canvas = null;
    let ctx2d = null;

    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 160;
      ctx2d = canvas.getContext('2d');
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    } else {
      tex = new THREE.Texture();
    }

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.name = 'ComicWordImpactSprite';
    sprite.position.set(0, 1.95, 0);
    sprite.scale.set(2.35, 0.74, 1);
    sprite.renderOrder = 25;
    sprite.visible = false;
    sprite.userData = {
      canvas,
      ctx2d,
      texture: tex,
      currentWord: '',
    };
    return sprite;
  }

  /**
   * Updates the Comic Impact Word state without displaying an occluding 3D billboard over the fighters.
   * @param {string} word
   * @param {string} [bgHex='#ff3d00']
   * @param {string} [borderHex='#ffea00']
   */
  setComicWordText(word, bgHex = '#ff3d00', borderHex = '#ffea00') {
    const sprite = this.props.comicWordSprite;
    if (!sprite) return;
    // Never show the 3D text billboard over the close-up auto-zoomed fighters!
    sprite.visible = false;
    if (this.currentComicWord === word) return;
    this.currentComicWord = word;
    sprite.userData.currentWord = word;

    const { canvas, ctx2d, texture } = sprite.userData;
    if (!ctx2d || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);

    // Jagged comic burst background pill
    ctx2d.save();
    ctx2d.fillStyle = bgHex;
    ctx2d.strokeStyle = borderHex;
    ctx2d.lineWidth = 8;
    ctx2d.beginPath();
    ctx2d.roundRect(18, 18, w - 36, h - 36, 36);
    ctx2d.fill();
    ctx2d.stroke();

    // Inner dark contrast rim
    ctx2d.strokeStyle = '#120a1f';
    ctx2d.lineWidth = 4;
    ctx2d.strokeRect(28, 28, w - 56, h - 56);

    // Bold comic impact lettering
    ctx2d.font = '900 44px system-ui, sans-serif';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.lineJoin = 'round';
    ctx2d.strokeStyle = '#120a1f';
    ctx2d.lineWidth = 10;
    ctx2d.strokeText(word, w / 2, h / 2 + 3);
    ctx2d.fillStyle = '#fffde7';
    ctx2d.fillText(word, w / 2, h / 2 + 3);
    ctx2d.restore();

    if (texture) {
      texture.needsUpdate = true;
    }
  }

  /**
   * Builds the pre-allocated 3D emerald water splash ring + crown column triggered
   * when the defeated piece splashes into Shrek's Swamp (`x = ±6.4m, y = -0.28m`) in Act 3.
   */
  createSwampKoSplashProp() {
    const group = new THREE.Group();
    group.name = 'SwampKoSplashRing';

    const outerRingGeo = new THREE.RingGeometry(0.28, 0.56, 32);
    outerRingGeo.rotateX(-Math.PI * 0.5);
    const outerRing = new THREE.Mesh(
      outerRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0x00e676,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      }),
    );

    const innerRingGeo = new THREE.RingGeometry(0.14, 0.30, 28);
    innerRingGeo.rotateX(-Math.PI * 0.5);
    const innerRing = new THREE.Mesh(
      innerRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0x76ff03,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      }),
    );
    innerRing.position.y = 0.03;

    const crownGeo = new THREE.CylinderGeometry(0.48, 0.24, 0.72, 16, 1, true);
    const crownMesh = new THREE.Mesh(
      crownGeo,
      new THREE.MeshBasicMaterial({
        color: 0x69f0ae,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      }),
    );
    crownMesh.position.y = 0.36;

    group.add(outerRing, innerRing, crownMesh);
    group.userData = { outerRing, innerRing, crownMesh };
    group.visible = false;
    return group;
  }

  /**
   * Builds a bespoke 3D Weapon & Signature Prop Group attached directly to each brawling fighter:
   * - `p` (Puffin): 3D Swiss-Guard Halberd + 3D Silver Fish in hand that swings during lunges!
   * - `b` (Ale): 3D Glowing Amethyst Staff + 3D Fireball stream shooting from his shoulder dragon!
   * - `n` (Seby): 3D Orange Turbo Track Booster + miniature race car orbiting his warhorse!
   * - `r` (Pupurabbu): Giant Glowing Purple Plushie Boxing Gloves + Belly Aura!
   * - `q` (Kate): 3D Golden-Lilac Chocolate Swirl Wand + Magic Lilac Shield!
   * - `k` (Riccardo): 3D Royal Lightning Sceptre + Golden Plunger-Crown!
   * @param {string} pieceType - 'k'|'q'|'b'|'n'|'r'|'p'
   * @returns {THREE.Group}
   */
  buildFighterWeaponProp(pieceType = 'p') {
    const type = String(pieceType || 'p').toLowerCase();
    const spec = FIGHTER_COMBAT_SPECS[type] || FIGHTER_COMBAT_SPECS.p;
    const weaponGroup = new THREE.Group();
    weaponGroup.name = `FighterWeaponProp_${type}`;
    weaponGroup.userData.pieceType = type;
    weaponGroup.userData.weaponId = spec.weaponId;

    const rightHandPivot = new THREE.Group();
    rightHandPivot.name = 'RightWeaponPivot';
    const leftHandPivot = new THREE.Group();
    leftHandPivot.name = 'LeftWeaponPivot';
    const specialPivot = new THREE.Group();
    specialPivot.name = 'SpecialWeaponPivot';
    weaponGroup.add(rightHandPivot, leftHandPivot, specialPivot);
    weaponGroup.userData.rightHandPivot = rightHandPivot;
    weaponGroup.userData.leftHandPivot = leftHandPivot;
    weaponGroup.userData.specialPivot = specialPivot;

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      emissive: 0xff8f00,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.88,
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xe0f7fa,
      emissive: 0x4fc3f7,
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.9,
    });

    if (type === 'p') {
      // PUFFIN (`p`): 3D Swiss-Guard Halberd (right) + 3D Silver Fish in hand (left)
      rightHandPivot.position.set(0.26, 0.48, 0.18);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, 0.98, 8),
        new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.6 }),
      );
      pole.position.y = 0.28;
      const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.028), silverMat);
      axeBlade.position.set(0.07, 0.62, 0);
      const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 6), silverMat);
      spearTip.position.set(0, 0.86, 0);
      const tassel = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff1744 }),
      );
      tassel.position.set(0, 0.50, 0);
      rightHandPivot.add(pole, axeBlade, spearTip, tassel);

      leftHandPivot.position.set(-0.26, 0.46, 0.22);
      const fishMat = new THREE.MeshStandardMaterial({
        color: 0x4fc3f7,
        emissive: 0x0288d1,
        emissiveIntensity: 0.55,
        roughness: 0.18,
        metalness: 0.72,
      });
      const fishBody = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), fishMat);
      fishBody.scale.set(0.65, 0.55, 1.85);
      fishBody.position.z = 0.12;
      const fishTail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 4), fishMat);
      fishTail.rotation.x = -Math.PI * 0.5;
      fishTail.position.z = -0.08;
      leftHandPivot.add(fishBody, fishTail);
    } else if (type === 'b') {
      // BISHOP ALE (`b`): 3D Glowing Amethyst Staff (right) + 3D Fireball Stream from Shoulder Dragon (special)
      rightHandPivot.position.set(0.28, 0.54, 0.16);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 1.08, 8), goldMat);
      shaft.position.y = 0.30;
      const amethystGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.13, 0),
        new THREE.MeshStandardMaterial({
          color: 0xd500f9,
          emissive: 0xaa00ff,
          emissiveIntensity: 1.15,
          roughness: 0.1,
          metalness: 0.3,
        }),
      );
      amethystGem.position.y = 0.90;
      rightHandPivot.add(shaft, amethystGem);

      // Shoulder Dragon 3D Fireball Stream shooting forward along +Z
      specialPivot.position.set(-0.22, 0.88, 0.20);
      const fireColors = [0xffea00, 0xff9100, 0xff3d00, 0xd50000, 0xff6d00];
      for (let i = 0; i < 5; i++) {
        const fb = new THREE.Mesh(
          new THREE.SphereGeometry(0.055 + i * 0.012, 8, 8),
          new THREE.MeshBasicMaterial({
            color: fireColors[i],
            transparent: true,
            opacity: 0.92,
          }),
        );
        fb.position.set(0, -i * 0.02, 0.12 + i * 0.14);
        specialPivot.add(fb);
      }
      const flameCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.55, 8),
        new THREE.MeshBasicMaterial({ color: 0xff6d00, transparent: true, opacity: 0.78 }),
      );
      flameCone.rotation.x = Math.PI * 0.5;
      flameCone.position.set(0, -0.04, 0.38);
      specialPivot.add(flameCone);
    } else if (type === 'n') {
      // KNIGHT SEBY (`n`): 3D Orange Turbo Track Booster + Miniature Race Car Orbiting Warhorse
      const orangeBoosterMat = new THREE.MeshStandardMaterial({
        color: 0xff6d00,
        emissive: 0xff3d00,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.5,
      });
      rightHandPivot.position.set(0.28, 0.56, -0.05);
      const boosterR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.38, 10), orangeBoosterMat);
      boosterR.rotation.x = Math.PI * 0.35;
      const nitroR = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.22, 8),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff }),
      );
      nitroR.rotation.x = -Math.PI * 0.65;
      nitroR.position.set(0, -0.18, -0.14);
      rightHandPivot.add(boosterR, nitroR);

      leftHandPivot.position.set(-0.28, 0.56, -0.05);
      const boosterL = boosterR.clone();
      const nitroL = nitroR.clone();
      leftHandPivot.add(boosterL, nitroL);

      // Orbiting miniature race car + glowing orange track ring
      specialPivot.position.set(0, 0.48, 0);
      const miniTrack = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.028, 8, 24),
        orangeBoosterMat,
      );
      miniTrack.rotation.x = Math.PI * 0.5;
      const miniCar = new THREE.Group();
      const carBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.06, 0.10),
        new THREE.MeshStandardMaterial({ color: 0x00e676, emissive: 0x00c853, emissiveIntensity: 0.6 }),
      );
      const carTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.05, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xffea00 }),
      );
      carTop.position.y = 0.05;
      miniCar.add(carBody, carTop);
      miniCar.position.set(0.42, 0.04, 0);
      specialPivot.add(miniTrack, miniCar);
    } else if (type === 'r') {
      // ROOK PUPURABBU (`r`): Giant Glowing Purple Plushie Boxing Gloves + Belly Aura
      const gloveMat = new THREE.MeshStandardMaterial({
        color: 0xab47bc,
        emissive: 0x8e24aa,
        emissiveIntensity: 0.78,
        roughness: 0.4,
        metalness: 0.15,
      });
      rightHandPivot.position.set(0.32, 0.56, 0.24);
      const gloveR = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), gloveMat);
      gloveR.scale.set(1.0, 0.9, 1.25);
      const cuffR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), goldMat);
      cuffR.rotation.x = Math.PI * 0.5;
      cuffR.position.z = -0.11;
      rightHandPivot.add(gloveR, cuffR);

      leftHandPivot.position.set(-0.32, 0.56, 0.24);
      const gloveL = gloveR.clone();
      const cuffL = cuffR.clone();
      leftHandPivot.add(gloveL, cuffL);

      specialPivot.position.set(0, 0.52, 0.06);
      const bellyAura = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.045, 10, 24),
        new THREE.MeshBasicMaterial({
          color: 0xe040fb,
          transparent: true,
          opacity: 0.85,
        }),
      );
      bellyAura.rotation.x = Math.PI * 0.5;
      specialPivot.add(bellyAura);
    } else if (type === 'q') {
      // QUEEN KATE (`q`): 3D Golden-Lilac Chocolate Swirl Wand (right) + Lilac Magic Shield (left)
      rightHandPivot.position.set(0.28, 0.58, 0.20);
      const wandShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.92, 8), goldMat);
      wandShaft.position.y = 0.26;
      const chocoSwirl = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.038, 10, 20),
        new THREE.MeshStandardMaterial({
          color: 0x4e2c18,
          emissive: 0xab47bc,
          emissiveIntensity: 0.55,
          roughness: 0.15,
        }),
      );
      chocoSwirl.position.y = 0.76;
      const starGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.085, 0),
        new THREE.MeshBasicMaterial({ color: 0xf48fb1 }),
      );
      starGem.position.y = 0.76;
      rightHandPivot.add(wandShaft, chocoSwirl, starGem);

      leftHandPivot.position.set(-0.26, 0.58, 0.24);
      const lilacShield = new THREE.Mesh(
        new THREE.RingGeometry(0.10, 0.26, 6),
        new THREE.MeshBasicMaterial({
          color: 0xce93d8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        }),
      );
      leftHandPivot.add(lilacShield);
    } else {
      // KING RICCARDO (`k`): 3D Royal Lightning Sceptre (right) + Golden Plunger-Crown (left)
      rightHandPivot.position.set(0.30, 0.60, 0.20);
      const sceptreShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.02, 10), goldMat);
      sceptreShaft.position.y = 0.30;
      const sceptreOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xfff176 }),
      );
      sceptreOrb.position.y = 0.84;
      const boltProng = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.28, 5),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff }),
      );
      boltProng.position.y = 1.02;
      rightHandPivot.add(sceptreShaft, sceptreOrb, boltProng);

      // Left hand: Golden Plunger-Crown ("Carlesso al Cesso" 🚽👑)
      leftHandPivot.position.set(-0.28, 0.58, 0.22);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.65, 8), goldMat);
      handle.position.y = 0.20;
      const plungerCup = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({
          color: 0xd50000,
          emissive: 0xff8f00,
          emissiveIntensity: 0.45,
          roughness: 0.3,
        }),
      );
      plungerCup.position.y = 0.52;
      const miniCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.10, 6), goldMat);
      miniCrown.position.y = 0.62;
      leftHandPivot.add(handle, plungerCup, miniCrown);
    }

    return weaponGroup;
  }

  /**
   * Animates a fighter's attached 3D weapon prop in sync with their body pose, lunges, and counter-attacks.
   */
  animateFighterWeaponProp(fighter, weaponGroup, elapsedS, strikeAmp = 1.0, isCounter = false) {
    if (!fighter || !weaponGroup) return;
    const body = fighter.userData?.bodyContainer;
    if (body) {
      weaponGroup.position.y = body.position.y;
      weaponGroup.rotation.set(body.rotation.x, body.rotation.y, body.rotation.z);
    }

    const type = weaponGroup.userData.pieceType || 'p';
    const right = weaponGroup.userData.rightHandPivot;
    const left = weaponGroup.userData.leftHandPivot;
    const special = weaponGroup.userData.specialPivot;
    const boost = isCounter ? 1.85 : 1.0;

    if (right) {
      right.rotation.x = Math.sin(elapsedS * 22) * 0.75 * strikeAmp * boost;
      right.rotation.z = Math.cos(elapsedS * 18) * 0.35 * strikeAmp;
    }
    if (left) {
      left.rotation.x = -Math.sin(elapsedS * 22 + 0.8) * 0.72 * strikeAmp * boost;
      left.rotation.z = -Math.cos(elapsedS * 16) * 0.32 * strikeAmp;
      if (type === 'q') {
        left.rotation.z = elapsedS * (isCounter ? 16.0 : 6.0);
        left.scale.setScalar(isCounter ? 1.65 : 1.0);
      } else if (type === 'r') {
        left.position.z = 0.24 + Math.max(0, Math.sin(elapsedS * 26)) * 0.26 * boost;
        right.position.z = 0.24 + Math.max(0, -Math.sin(elapsedS * 26)) * 0.26 * boost;
      }
    }
    if (special) {
      if (type === 'n') {
        // Spin the miniature race car around Seby's warhorse!
        special.rotation.y = elapsedS * (isCounter ? 18.0 : 9.5);
      } else if (type === 'b') {
        // Pulse the 3D fireball stream from Ale's shoulder dragon!
        const fireScale = (0.75 + Math.abs(Math.sin(elapsedS * 20)) * 0.75) * (isCounter ? 1.75 : 1.0);
        special.scale.set(fireScale, fireScale, fireScale * 1.35);
      } else if (type === 'r') {
        // Expand Pupurabbu's glowing purple belly aura!
        const auraScale = (0.9 + Math.sin(elapsedS * 18) * 0.25) * (isCounter ? 1.65 : 1.0);
        special.scale.setScalar(auraScale);
      }
    }
  }

  /**
   * Builds a pre-allocated 3D cartoon brawl dust cloud + comic impact starburst (`KAPOW!`)
   * that swirls between Attacker A and Defender B during Act 2 of the 3D Scazzottata.
   */
  createBrawlCloudProp() {
    const cloudGroup = new THREE.Group();
    cloudGroup.name = 'CartoonBrawlCloud';
    const dustMat = new THREE.MeshStandardMaterial({
      color: 0xf5f0e6,
      emissive: 0xffe0b2,
      emissiveIntensity: 0.25,
      roughness: 0.78,
      metalness: 0.05,
      transparent: true,
      opacity: 0.35,
    });
    const puffGeo = new THREE.SphereGeometry(0.15, 10, 10);
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const puff = new THREE.Mesh(puffGeo, dustMat);
      puff.position.set(
        Math.cos(ang) * 0.26,
        i % 2 === 0 ? 0.04 : -0.02,
        Math.sin(ang) * 0.26,
      );
      puff.scale.setScalar(0.75 + (i % 3) * 0.16);
      cloudGroup.add(puff);
    }

    // Comic orange-gold & crimson impact spikes ("SCAZZOTTATA!")
    const spikeGeo = new THREE.ConeGeometry(0.06, 0.28, 5);
    const goldSpikeMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    const redSpikeMat = new THREE.MeshBasicMaterial({ color: 0xff3d00 });
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI * 2) / 6 + 0.25;
      const spike = new THREE.Mesh(spikeGeo, i % 2 === 0 ? goldSpikeMat : redSpikeMat);
      spike.position.set(Math.cos(ang) * 0.30, 0.04, Math.sin(ang) * 0.30);
      spike.rotation.z = -Math.sin(ang) * 1.2;
      spike.rotation.x = Math.cos(ang) * 1.2;
      cloudGroup.add(spike);
    }

    cloudGroup.visible = false;
    return cloudGroup;
  }

  createStageFigurine(defaultColor) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: defaultColor,
      roughness: 0.3,
      metalness: 0.25,
      transparent: true,
      opacity: 1,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.16, 16), mat);
    base.position.y = 0.08;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.62, 16), mat);
    torso.position.y = 0.47;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 14), mat);
    head.position.y = 0.92;
    g.add(base, torso, head);
    g.userData.mat = mat;
    g.visible = false;
    return g;
  }

  clearBrawlFighters() {
    if (this.hiddenBoardNodes?.length) {
      for (const node of this.hiddenBoardNodes) {
        if (node) node.visible = true;
      }
      this.hiddenBoardNodes = [];
    }
    if (this.brawlStageGroup) {
      if (this.pieceView?.clearGroup) {
        this.pieceView.clearGroup(this.brawlStageGroup);
      } else {
        while (this.brawlStageGroup.children.length > 0) {
          this.brawlStageGroup.remove(this.brawlStageGroup.children[0]);
        }
      }
    }
    this.attackerFighter = null;
    this.defenderFighter = null;
    this.attackerWeaponProp = null;
    this.defenderWeaponProp = null;
  }

  /**
   * Triggered on `BATTLE_STARTED`: mounts the two real 3D `.glb` characters (`attackerFighter` &
   * `defenderFighter`) with their 3D weapons (`buildFighterWeaponProp`), activates pooled particles
   * and stage props, and starts the close-up Auto-Zoom Capture Camera.
   * @param {object} e
   */
  onBattleStarted(e) {
    this.hideStageProps();
    this.activeClash = e;
    this.clashElapsed = 0;
    this.currentComicWord = '';
    this.defenderCounterBurstFired = false;
    this.swampSplashTriggered = false;
    this.lastCameraShake = 0;

    const toPos = squareToWorld(e.square || e.to || 'd5');
    const rawFrom = squareToWorld(e.from || 'e4');
    const sameSq = Math.hypot(toPos.x - rawFrom.x, toPos.z - rawFrom.z) < 0.15;
    const fromPos = sameSq ? { x: toPos.x, y: 0, z: toPos.z + 1.15 } : rawFrom;
    this.activeFromPos = fromPos;
    this.activeToPos = toPos;

    // Temporarily hide static board pieces on the active clash squares (`from` & `to`) so they
    // don't double-render with the brawling fighters, while keeping neighboring pieces visible!
    const boardMap = this.pieceView?.pieceBySquare || this.pieceView?.pieceNodes;
    if (boardMap) {
      const clashSquares = new Set(
        [e.from, e.to, e.square, e.capturedSquare].filter(Boolean).map((s) => String(s).toLowerCase()),
      );
      for (const [sqKey, node] of boardMap.entries()) {
        const sq = String(node?.userData?.square || sqKey || '').toLowerCase();
        if (sq && clashSquares.has(sq) && node?.visible) {
          node.visible = false;
          this.hiddenBoardNodes.push(node);
        }
      }
    }

    const atkType = String(e.attacker || 'p').toLowerCase();
    const defType = String(e.defender || 'p').toLowerCase();
    const atkColor = e.playerId || 'w';
    const defColor = e.victimColor || (atkColor === 'w' ? 'b' : 'w');
    const sideSign = defColor === 'w' ? -1 : 1;
    this.swampLandingPos = {
      x: sideSign * 6.4,
      y: -0.28,
      z: Math.max(-2.6, Math.min(2.6, toPos.z * 0.65)),
    };

    const isCrit = e.tier === 'golden_crit';
    const isShiny = e.tier === 'shiny' || isCrit;
    const countMult = isCrit ? 2.0 : isShiny ? 1.35 : 1.0;

    // Position dynamic clash light
    const atkChar = CHARACTER_REGISTRY[atkType] || CHARACTER_REGISTRY.p;
    const defChar = CHARACTER_REGISTRY[defType] || CHARACTER_REGISTRY.p;
    if (this.clashLight) {
      this.clashLight.color.setHex(isCrit ? 0xffd700 : atkChar.accentColor);
      this.clashLight.intensity = isCrit ? 6.5 : 4.6;
      this.clashLight.position.set(toPos.x, 1.8, toPos.z);
      this.clashLight.visible = true;
    }

    // Spawn the TWO REAL 3D GLB COMBATANTS (Attacker A vs Defender B) + 3D WEAPON PROPS!
    if (this.pieceView?.createStandalonePiece && this.brawlStageGroup) {
      this.attackerFighter = this.pieceView.createStandalonePiece(atkType, atkColor);
      this.defenderFighter = this.pieceView.createStandalonePiece(defType, defColor);
    } else if (this.brawlStageGroup) {
      // Headless fallback fighter groups when PieceView is not mounted
      this.attackerFighter = this.createStageFigurine(atkChar.accentColor || 0xffca28);
      this.attackerFighter.visible = true;
      this.defenderFighter = this.createStageFigurine(defChar.accentColor || 0xb0bec5);
      this.defenderFighter.visible = true;
      if (this.victimProxy) {
        this.victimProxy.visible = true;
        this.victimProxy.position.set(toPos.x, 0, toPos.z);
        this.victimProxy.rotation.set(0, 0, 0);
        this.victimProxy.scale.set(1, 1, 1);
      }
    }

    if (this.attackerFighter && this.defenderFighter && this.brawlStageGroup) {
      this.attackerFighter.position.set(fromPos.x, 0, fromPos.z);
      this.defenderFighter.position.set(toPos.x, 0, toPos.z);

      // Attach bespoke 3D weapon props directly to each fighter root so GLB async loading never clears them
      this.attackerWeaponProp = this.buildFighterWeaponProp(atkType);
      this.defenderWeaponProp = this.buildFighterWeaponProp(defType);
      this.attackerFighter.add(this.attackerWeaponProp);
      this.defenderFighter.add(this.defenderWeaponProp);
      this.attackerFighter.userData.weaponProp = this.attackerWeaponProp;
      this.defenderFighter.userData.weaponProp = this.defenderWeaponProp;
      this.defenderFighter.userData.counterMove =
        (FIGHTER_COMBAT_SPECS[defType] || FIGHTER_COMBAT_SPECS.p).counterMove;
      this.defenderFighter.userData.isCounterAttacking = false;

      this.brawlStageGroup.add(this.attackerFighter, this.defenderFighter);

      if (atkType === 'b' || defType === 'b') {
        if (atkType === 'b') this.pieceView?.playClip?.(this.attackerFighter, 'FireBreath_Track');
        if (defType === 'b') this.pieceView?.playClip?.(this.defenderFighter, 'FireBreath_Track');
      }
    }

    // Prime the Comic Impact Word state (sprite stays hidden so it never occludes the fighters)
    if (this.props.comicWordSprite) {
      this.props.comicWordSprite.position.set(toPos.x, 1.95, toPos.z);
      this.setComicWordText('CHARGE! ⚔️', '#1e88e5', '#ffea00');
    }

    // Golden Crit Sky-Beam Overdrive
    if (isCrit && this.props.skyBeam) {
      this.props.skyBeam.position.set(toPos.x, 2.75, toPos.z);
      this.props.skyBeam.visible = true;
    }

    // Spawn initial clash sparks when the first blow of the 3D Scazzottata lands (delayS: 0.95s)
    this.spawnFromPool('golden_sparks', toPos, Math.round(18 * countMult), {
      speedMin: 1.4,
      speedMax: 3.6,
      upMin: 2.2,
      upMax: 4.5,
      restitution: 0.65,
      delayS: 0.95,
    });

    // Spawn signature particle bursts from pre-allocated pools timed with Act 2 Brawl
    const effect = e.effect;
    if (effect === 'sceptre_lightning' || effect === 'golden_toilet_throne') {
      this.props.runeCircle.position.set(toPos.x, 0.03, toPos.z);
      this.props.runeCircle.visible = true;
      this.props.lightningBolts.position.set(toPos.x, 0, toPos.z);
      this.props.lightningBolts.visible = true;
      if (effect === 'golden_toilet_throne' || isCrit) {
        this.props.goldenThrone.position.set(toPos.x, 2.8, toPos.z);
        this.props.goldenThrone.visible = true;
      }
      this.spawnFromPool('golden_sparks', toPos, Math.round(28 * countMult), {
        speedMin: 1.5,
        speedMax: 4.2,
        upMin: 2.8,
        upMax: 5.6,
        restitution: 0.65,
        delayS: 1.6,
      });
    } else if (effect === 'chocolate_wave') {
      this.props.chocoWave.position.set(toPos.x, 0.14, toPos.z);
      this.props.chocoWave.scale.setScalar(0.5);
      this.props.chocoWave.visible = true;
      this.spawnFromPool('choco_lilac_confetti', toPos, Math.round(40 * countMult), {
        speedMin: 1.4,
        speedMax: 3.6,
        upMin: 3.0,
        upMax: 5.5,
        restitution: 0.45,
        delayS: 1.5,
      });
    } else if (effect === 'crystal_shatter') {
      const isTanzaniteMom = e.easterEgg === 'ale_tanzanite_coffin_for_mom' || (e.attacker === 'b' && e.defender === 'q');
      if (this.props.crystalCase.material) {
        this.props.crystalCase.material.color.setHex(isTanzaniteMom ? 0x5e35b1 : 0x9c27b0);
        this.props.crystalCase.material.emissive.setHex(isTanzaniteMom ? 0x00b0ff : 0x7b1fa2);
        this.props.crystalCase.material.emissiveIntensity = isTanzaniteMom ? 0.62 : 0.4;
      }
      this.props.crystalCase.position.set(toPos.x, 0.65, toPos.z);
      this.props.crystalCase.scale.set(isTanzaniteMom ? 1.05 : 1, isTanzaniteMom ? 1.45 : 1, isTanzaniteMom ? 1.05 : 1);
      this.props.crystalCase.visible = true;
      this.spawnFromPool('amethyst_ruby_shards', toPos, Math.round(52 * countMult), {
        speedMin: 1.8,
        speedMax: 4.8,
        upMin: 2.5,
        upMax: 5.8,
        restitution: 0.72,
        delayS: 1.8,
      });
    } else if (effect === 'loop_track_cars') {
      this.props.loopTrack.position.set(toPos.x, 0.68, toPos.z);
      this.props.loopTrack.visible = true;
      this.props.dizzyStars.position.set(toPos.x, 0.55, toPos.z);
      this.props.dizzyStars.visible = true;
      this.spawnLoopCars(toPos, Math.min(12, Math.round(8 * countMult)));
    } else if (effect === 'plush_ground_pound') {
      this.props.shockwaveRing.position.set(toPos.x, 0.04, toPos.z);
      this.props.shockwaveRing.scale.setScalar(0.4);
      this.props.shockwaveRing.visible = true;
      this.spawnFromPool('purple_poof_clouds', toPos, Math.round(32 * countMult), {
        speedMin: 1.2,
        speedMax: 3.4,
        upMin: 1.8,
        upMax: 4.2,
        restitution: 0.55,
        delayS: 1.5,
      });
    } else if (effect === 'halberd_fish_slap') {
      this.props.puffinFish.position.set(fromPos.x, 0.75, fromPos.z);
      this.props.puffinFish.visible = true;
      this.spawnFromPool('fish_and_feathers', toPos, Math.round(26 * countMult), {
        speedMin: 1.6,
        speedMax: 4.0,
        upMin: 2.4,
        upMax: 5.0,
        restitution: 0.5,
        delayS: 1.4,
      });
    } else if (effect === 'mega_cuddle_bounce') {
      this.spawnFromPool('floating_purple_hearts', toPos, Math.round(36 * countMult), {
        speedMin: 0.8,
        speedMax: 2.4,
        upMin: 2.2,
        upMax: 4.6,
        restitution: 0.6,
        floatUp: true,
      });
    } else if (effect === 'sacro_acquarius_ice_coffin') {
      // Knight Seby vs Pawn Puffin (`n_x_p`): Sacro Acquarius & Teca di Ghiaccio Eterno!
      if (this.props.aquariusMaiden) {
        this.props.aquariusMaiden.position.set(fromPos.x, 0.55, fromPos.z);
        this.props.aquariusMaiden.scale.setScalar(1);
        this.props.aquariusMaiden.visible = true;
      }
      if (this.props.iceCoffin) {
        this.props.iceCoffin.position.set(toPos.x, 0, toPos.z);
        this.props.iceCoffin.scale.set(1, 0.08, 1);
        this.props.iceCoffin.visible = true;
      }
      // Initial Aurora ice stream frost burst + final Teca di Ghiaccio crumble shards
      this.spawnFromPool('diamond_ice_crystals', toPos, Math.round(24 * countMult), {
        speedMin: 1.4,
        speedMax: 3.4,
        upMin: 2.0,
        upMax: 4.4,
        restitution: 0.65,
        delayS: 1.25,
      });
      this.spawnFromPool('diamond_ice_crystals', toPos, Math.round(40 * countMult), {
        speedMin: 2.0,
        speedMax: 5.2,
        upMin: 2.8,
        upMax: 6.0,
        restitution: 0.72,
        delayS: 2.85,
      });
    } else if (effect === 'san_gennaro_miracle' || effect === 'crosier_blessing_beam') {
      if (this.props.sanGennaroAmpoule) {
        this.props.sanGennaroAmpoule.position.set(toPos.x, 1.75, toPos.z);
        this.props.sanGennaroAmpoule.scale.setScalar(1.0);
        this.props.sanGennaroAmpoule.visible = true;
      }
      if (this.props.runeCircle) {
        this.props.runeCircle.position.set(toPos.x, 0.03, toPos.z);
        this.props.runeCircle.visible = true;
      }
      this.spawnFromPool('san_gennaro_blood_drops', toPos, Math.round(52 * countMult), {
        speedMin: 1.6,
        speedMax: 4.4,
        upMin: 2.8,
        upMax: 5.8,
        restitution: 0.68,
        delayS: 1.15,
      });
    }

    // Start Auto-Zoom Capture Camera choreography
    this.startCameraOrbit(toPos);
  }

  /**
   * Activates `count` meshes from the named pre-allocated pool with radial + upward velocity.
   */
  spawnFromPool(poolName, origin, count, opts = {}) {
    const pool = this.pools.get(poolName);
    if (!pool) return;
    const limit = Math.min(count, pool.length);
    const baseY = opts.originY ?? 0.35;
    const floorY = opts.floorY ?? 0.04;
    for (let i = 0; i < limit; i++) {
      const mesh = pool[i];
      const angle = (i / limit) * Math.PI * 2 + i * 0.618;
      const speed = opts.speedMin + (((i * 7) % 11) / 10) * (opts.speedMax - opts.speedMin);
      const vy = opts.upMin + (((i * 13) % 11) / 10) * (opts.upMax - opts.upMin);

      mesh.position.set(
        origin.x + Math.cos(angle) * 0.18,
        baseY + (i % 5) * 0.08,
        origin.z + Math.sin(angle) * 0.18,
      );
      mesh.rotation.set(i * 0.5, angle, i * 0.3);
      mesh.scale.setScalar(1);
      mesh.visible = !(opts.delayS > 0);

      const mat = mesh.material || mesh.userData.primaryMat;
      if (mat) mat.opacity = 1;

      this.activeParticles.push({
        mesh,
        originX: origin.x,
        originZ: origin.z,
        vx: Math.cos(angle) * speed,
        vy,
        vz: Math.sin(angle) * speed,
        rx: (i % 2 === 0 ? 1 : -1) * 4.5,
        ry: 3.2,
        restitution: opts.restitution ?? 0.55,
        floorY,
        floatUp: Boolean(opts.floatUp),
        delayS: opts.delayS ?? 0,
        age: 0,
        lifetime: DEBRIS_LIFETIME_S,
        mode: 'ballistic',
      });
    }
  }

  /**
   * Activates 8+ die-cast miniature toy cars zooming around Seby's orange loop-track!
   */
  spawnLoopCars(origin, count) {
    const pool = this.pools.get('diecast_toy_cars');
    if (!pool) return;
    const limit = Math.min(count, pool.length);
    for (let i = 0; i < limit; i++) {
      const car = pool[i];
      car.visible = true;
      car.scale.setScalar(1);
      if (car.userData.primaryMat) car.userData.primaryMat.opacity = 1;
      this.activeParticles.push({
        mesh: car,
        originX: origin.x,
        originZ: origin.z,
        phase: (i / limit) * Math.PI * 2,
        speed: 7.5 + (i % 3) * 1.2,
        radius: 0.68,
        age: 0,
        lifetime: DEBRIS_LIFETIME_S,
        mode: 'loop_car',
      });
    }
  }

  /**
   * Saves the player's camera pose + FOV and prepares tight close-up auto-zoom framing around `targetPos`.
   */
  startCameraOrbit(targetPos) {
    if (!this.camera) return;
    if (!this.camSaved) {
      this.camSaved = {
        pos: this.camera.position.clone(),
        target: this.controls?.target ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0),
        fov: this.camera.fov || 46,
      };
    }
    this.camOrbitCenter = new THREE.Vector3(targetPos.x, 0.75, targetPos.z);
    this._orbitPoseInitialized = false;
    this.camRestoreTimer = 0;
  }

  /**
   * Triggered on `CHECKMATE`: stages a spectacular 4.2s Royal Capitulation 3D sequence
   * over the defeated King's square (descending Golden Throne, lightning bolts, sky-beam,
   * golden sparks, gem shards, and confetti) while orbiting the camera around the fallen King.
   * @param {object} e
   */
  onCheckmate(e) {
    this.hideStageProps();
    const kingSq = e.loserKingSquare || (e.loser === 'w' ? 'e1' : 'e8');
    const winKingSq = e.winnerKingSquare || (e.winner === 'w' ? 'e1' : 'e8');
    const kingPos = squareToWorld(kingSq);
    const winPos = squareToWorld(winKingSq);

    this.activeClash = {
      type: 'CHECKMATE_CAPITULATION',
      square: kingSq,
      to: kingSq,
      from: winKingSq,
      effect: 'golden_toilet_throne',
      victimReaction: 'royal_throne_whirl',
      durationMs: 4200,
    };
    this.clashElapsed = 0;
    this.activeFromPos = winPos;
    this.activeToPos = kingPos;

    if (this.clashLight) {
      this.clashLight.color.setHex(0xffd700);
      this.clashLight.intensity = 7.5;
      this.clashLight.position.set(kingPos.x, 2.2, kingPos.z);
      this.clashLight.visible = true;
    }

    if (this.props.skyBeam) {
      this.props.skyBeam.position.set(kingPos.x, 2.75, kingPos.z);
      this.props.skyBeam.visible = true;
    }
    if (this.props.runeCircle) {
      this.props.runeCircle.position.set(kingPos.x, 0.03, kingPos.z);
      this.props.runeCircle.visible = true;
    }
    if (this.props.lightningBolts) {
      this.props.lightningBolts.position.set(kingPos.x, 0, kingPos.z);
      this.props.lightningBolts.visible = true;
    }
    if (this.props.goldenThrone) {
      this.props.goldenThrone.position.set(kingPos.x, 3.0, kingPos.z);
      this.props.goldenThrone.visible = true;
    }
    if (this.props.shockwaveRing) {
      this.props.shockwaveRing.position.set(kingPos.x, 0.04, kingPos.z);
      this.props.shockwaveRing.scale.setScalar(0.5);
      this.props.shockwaveRing.visible = true;
    }

    // Royal Capitulation multi-wave fireworks on both the fallen King and victorious King
    this.spawnFromPool('golden_sparks', kingPos, 55, {
      speedMin: 1.8,
      speedMax: 5.0,
      upMin: 3.2,
      upMax: 6.4,
      restitution: 0.7,
    });
    this.spawnFromPool('amethyst_ruby_shards', kingPos, 45, {
      speedMin: 1.6,
      speedMax: 4.5,
      upMin: 2.8,
      upMax: 5.8,
      restitution: 0.72,
      delayS: 0.35,
    });
    this.spawnFromPool('choco_lilac_confetti', winPos, 50, {
      speedMin: 1.5,
      speedMax: 4.2,
      upMin: 3.4,
      upMax: 6.0,
      restitution: 0.5,
      delayS: 0.5,
    });
    this.spawnFromPool('floating_purple_hearts', winPos, 30, {
      speedMin: 0.9,
      speedMax: 2.6,
      upMin: 2.4,
      upMax: 5.0,
      restitution: 0.6,
      floatUp: true,
    });

    this.startCameraOrbit(kingPos);
  }

  smoothstep(x) {
    const c = Math.max(0, Math.min(1, x));
    return c * c * (3 - 2 * c);
  }

  getEntryDurationS() {
    if (typeof window !== 'undefined' && window.location?.search) {
      const q = new URLSearchParams(window.location.search).get('entrySeconds');
      if (q !== null && Number.isFinite(Number(q))) {
        return Math.max(0.2, Math.min(4.0, Number(q)));
      }
    }
    return 1.10;
  }

  getExitWindowS() {
    if (typeof window !== 'undefined' && window.location?.search) {
      const q = new URLSearchParams(window.location.search).get('transitionSeconds');
      if (q !== null && Number.isFinite(Number(q))) {
        return Math.max(0.5, Math.min(8.0, Number(q)));
      }
    }
    return Number.isFinite(this.combatTransitionSeconds) ? this.combatTransitionSeconds : 3.50;
  }

  /**
   * Triggered on `BATTLE_COMPLETED` or `BATTLE_SKIPPED`: clears stage fighters/props and
   * continues the smooth 3.5s sliding-window zoom-out & alpha cross-fade back to the saved camera view!
   */
  onBattleEnded(e) {
    if (this.activeClash?.type === 'CHECKMATE_CAPITULATION') return;
    const isSkip = e?.type === 'BATTLE_SKIPPED';
    const exitTotalS = isSkip ? 1.35 : this.getExitWindowS();
    const durationS = (this.activeClash?.durationMs || 6000) / 1000;
    const preExitS = isSkip ? 0 : Math.min(durationS * 0.20, exitTotalS * 0.34);
    const exitStartS = Math.max(1.5, durationS - preExitS);
    const alreadyRan =
      !isSkip && this.clashElapsed > exitStartS
        ? Math.min(preExitS, this.clashElapsed - exitStartS)
        : 0;

    this.activeClash = null;
    this.hideStageProps();

    if (this.camSaved) {
      this.exitWindowTotalS = exitTotalS;
      this.exitPreWindowS = alreadyRan;
      this.camRestoreDuration = Math.max(0.5, exitTotalS - alreadyRan);
      this.camRestoreTimer = this.camRestoreDuration;
    } else {
      this._applyCombatBlendState(0.0);
    }
  }

  hideStageProps() {
    for (const prop of Object.values(this.props)) {
      if (prop) prop.visible = false;
    }
    this.clearBrawlFighters();
    if (this.victimProxy) this.victimProxy.visible = false;
    if (this.cuddlePartnerProxy) this.cuddlePartnerProxy.visible = false;
    if (this.clashLight) this.clashLight.visible = false;
  }

  clearAllActive() {
    this.activeClash = null;
    this.camRestoreTimer = 0;
    this.hideStageProps();
    this._applyCombatBlendState(0.0);
    this.camSaved = null;
    for (const p of this.activeParticles) {
      p.mesh.visible = false;
    }
    this.activeParticles = [];
  }

  /**
   * Advances all active pooled particles, 3D Scazzottata character brawl, stage prop animations,
   * and the Auto-Zoom Capture Camera + 3.5s Sliding-Window Transition.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!(dt > 0)) return;
    const step = Math.min(dt, 0.1);

    // 1. Update active 3-Act 3D Scazzottata & stage props
    if (this.activeClash) {
      this.clashElapsed += step;
      const durationS = (this.activeClash.durationMs || 6000) / 1000;
      const t = Math.min(1, this.clashElapsed / durationS);
      this.updateActiveChoreography(this.activeClash, t, this.clashElapsed);
      this.updateCameraOrbit(t, step);
      if (this.activeClash.type === 'CHECKMATE_CAPITULATION' && t >= 1) {
        this.activeClash = null;
        this.hideStageProps();
        if (this.camSaved) {
          this.exitWindowTotalS = 2.2;
          this.exitPreWindowS = 0;
          this.camRestoreDuration = 2.2;
          this.camRestoreTimer = 2.2;
        }
      }
    } else if (this.camRestoreTimer > 0 && this.camSaved && this.camera) {
      this.camRestoreTimer = Math.max(0, this.camRestoreTimer - step);
      const postElapsed = this.camRestoreDuration - this.camRestoreTimer;
      const totalExitElapsed = this.exitPreWindowS + postElapsed;
      const rawExitU = Math.min(1, totalExitElapsed / Math.max(0.1, this.exitWindowTotalS));
      const blend = Math.max(0, 1.0 - this.smoothstep(rawExitU));
      this._applyCombatBlendState(blend);

      if (this.camRestoreTimer === 0) {
        this._applyCombatBlendState(0.0);
        this.camSaved = null;
      }
    }

    // 2. Update pooled debris particles (gravity + board/swamp bounce + 3.0s fade-out)
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      if (p.delayS > 0) {
        p.delayS -= step;
        if (p.delayS <= 0) {
          p.mesh.visible = true;
          if (this.props.crystalCase && this.activeClash?.effect === 'crystal_shatter') {
            this.props.crystalCase.visible = false;
          }
          if (this.props.iceCoffin && this.activeClash?.effect === 'sacro_acquarius_ice_coffin' && this.clashElapsed >= 2.6) {
            this.props.iceCoffin.visible = false;
          }
        }
        continue;
      }

      p.age += step;
      if (p.age >= p.lifetime) {
        p.mesh.visible = false;
        this.activeParticles.splice(i, 1);
        continue;
      }

      const lifeRatio = p.age / p.lifetime;
      const fade = lifeRatio > 0.6 ? Math.max(0, 1 - (lifeRatio - 0.6) / 0.4) : 1;
      const mat = p.mesh.material || p.mesh.userData.primaryMat;
      if (mat) mat.opacity = fade;

      if (p.mode === 'loop_car') {
        const ang = p.phase + p.age * p.speed;
        p.mesh.position.set(
          p.originX + Math.cos(ang) * p.radius,
          0.68 + Math.sin(ang) * p.radius,
          p.originZ + Math.sin(ang * 2) * 0.14,
        );
        p.mesh.rotation.z = ang + Math.PI * 0.5;
      } else if (p.floatUp) {
        p.mesh.position.x += p.vx * step * 0.45;
        p.mesh.position.y += (1.1 + Math.sin(p.age * 5) * 0.3) * step;
        p.mesh.position.z += p.vz * step * 0.45;
        p.mesh.rotation.y += p.ry * step;
      } else {
        p.vy -= GRAVITY * step;
        p.mesh.position.x += p.vx * step;
        p.mesh.position.y += p.vy * step;
        p.mesh.position.z += p.vz * step;
        p.mesh.rotation.x += p.rx * step;
        p.mesh.rotation.y += p.ry * step;

        const floorY = p.floorY ?? 0.04;
        if (p.mesh.position.y < floorY) {
          p.mesh.position.y = floorY;
          p.vy = Math.abs(p.vy) * p.restitution;
          p.vx *= 0.78;
          p.vz *= 0.78;
        }
      }
    }
  }

  /**
   * Animates the 3-Act 3D Scazzottata between the two real `.glb` fighters (`attackerFighter` & `defenderFighter`)
   * plus their 3D weapons, Defender Counter-Attack, Comic Impact Words, and Shrek Swamp K.O. Water Splash over `4.0s`:
   * - Act 1 (`t = 0.00 .. 0.25`): Walk/Gallop Charge & Combat Guard Stance (`"CHARGE!"`)
   * - Act 2 (`t = 0.25 .. 0.74`): La Scazzottata 3D!
   *   - Exchange 1 (`brawlU = 0.00..0.20`): Attacker Lunge & Weapon Slash (`"CLANG! ⚔️"`)
   *   - Exchange 2 (`brawlU = 0.20..0.44`): Defender Character-Specific 3D Counter-Attack #1 (`"CONTRATTACCO! 💥"`)
   *   - Exchange 3 (`brawlU = 0.44..0.68`): Defender Counter-Attack #2 + Mid-Air Whirlwind Clash (`"KAPOW! 🌪️"`)
   *   - Exchange 4 & 5 (`brawlU = 0.68..1.00`): Attacker Uppercut & Signature Finishing Slam (`"KAPOW! 🌪️"`)
   * - Act 3 (`t = 0.74 .. 1.00`): High Parabolic Knockout Launch into Shrek's Swamp (`x = ±6.4m, y = -0.28m`)
   *   + Emerald Water Splash Ring & Droplet Burst (`t = 0.88..1.00`, `"K.O.! 🐸💦"`).
   */
  updateActiveChoreography(clash, t, elapsedS) {
    const toPos = this.activeToPos || squareToWorld(clash.square || clash.to || 'd5');
    const fromPos = this.activeFromPos || squareToWorld(clash.from || 'e4');
    const dx = toPos.x - fromPos.x;
    const dz = toPos.z - fromPos.z;
    const dist = Math.hypot(dx, dz) || 1.0;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const atkYaw = Math.atan2(dirX, dirZ);
    const defYaw = Math.atan2(-dirX, -dirZ);
    const defType = String(clash.defender || 'p').toLowerCase();
    const defSpec = FIGHTER_COMBAT_SPECS[defType] || FIGHTER_COMBAT_SPECS.p;

    // 1. Animate Signature Stage Props
    if (this.props.runeCircle?.visible) {
      this.props.runeCircle.rotation.y = elapsedS * 4.2;
      this.props.runeCircle.scale.setScalar(1 + Math.sin(elapsedS * 10) * 0.15);
    }
    if (this.props.lightningBolts?.visible) {
      this.props.lightningBolts.rotation.y = elapsedS * 8.0;
      this.props.lightningBolts.visible = t > 0.25 && t < 0.85;
    }
    if (this.props.goldenThrone?.visible) {
      if (clash.dndSpell === 'kiss_of_death_blight') {
        this.props.goldenThrone.visible = false;
      } else {
        const dropT = Math.min(1, Math.max(0, (t - 0.35) * 2.5));
        this.props.goldenThrone.position.y = (1 - dropT) * 2.6 + 0.05;
        this.props.goldenThrone.rotation.y = elapsedS * 3.2;
      }
    }
    if (this.props.chocoWave?.visible) {
      const waveT = Math.max(0, (t - 0.25) / 0.75);
      this.props.chocoWave.scale.setScalar(0.4 + waveT * 2.5);
      this.props.chocoWave.rotation.z = elapsedS * 2.5;
    }
    if (this.props.crystalCase?.visible) {
      this.props.crystalCase.rotation.y = elapsedS * 2.2;
      const isTanzaniteMom =
        clash.easterEgg === 'ale_tanzanite_coffin_for_mom' || (clash.attacker === 'b' && clash.defender === 'q');
      if (isTanzaniteMom && this.defenderFighter) {
        this.props.crystalCase.position.set(
          this.defenderFighter.position.x,
          this.defenderFighter.position.y + 0.68,
          this.defenderFighter.position.z,
        );
        if (this.props.crystalCase.material) {
          const pulse = 0.5 + 0.5 * Math.sin(elapsedS * 6.0);
          this.props.crystalCase.material.color.setHex(pulse > 0.5 ? 0x5e35b1 : 0x3949ab);
          this.props.crystalCase.material.emissive.setHex(pulse > 0.5 ? 0x00b0ff : 0x7c4dff);
        }
      }
    }
    if (this.props.dizzyStars?.visible) {
      this.props.dizzyStars.rotation.y = elapsedS * 6.5;
    }
    if (this.props.shockwaveRing?.visible) {
      const ringT = Math.max(0, (t - 0.32) / 0.68);
      this.props.shockwaveRing.scale.setScalar(0.35 + ringT * 3.4);
    }
    if (this.props.puffinFish?.visible) {
      const slapT = Math.min(1, Math.max(0, (t - 0.22) * 2.2));
      this.props.puffinFish.position.set(
        fromPos.x + (toPos.x - fromPos.x) * slapT,
        0.65 + Math.sin(slapT * Math.PI) * 0.48,
        fromPos.z + (toPos.z - fromPos.z) * slapT,
      );
      this.props.puffinFish.rotation.y = elapsedS * 9.5;
    }
    if (clash.effect === 'sacro_acquarius_ice_coffin') {
      // Animate Celestial Aquarius Water-Bearer Woman & Golden Amphora pouring ice energy!
      if (this.props.aquariusMaiden) {
        const showMaiden = t >= 0.28 && t < 0.78;
        this.props.aquariusMaiden.visible = showMaiden;
        if (showMaiden) {
          const atkX = this.attackerFighter ? this.attackerFighter.position.x : toPos.x - dirX * 0.36;
          const atkZ = this.attackerFighter ? this.attackerFighter.position.z : toPos.z - dirZ * 0.36;
          this.props.aquariusMaiden.position.set(
            atkX - dirX * 0.24,
            0.55 + Math.sin(elapsedS * 6.0) * 0.08,
            atkZ - dirZ * 0.24,
          );
          this.props.aquariusMaiden.rotation.set(0, atkYaw, 0);
          const { amphoraGroup, streamBeam, halo } = this.props.aquariusMaiden.userData;
          if (amphoraGroup) {
            const pourProgress = Math.min(1, (t - 0.28) / 0.22);
            amphoraGroup.rotation.x = Math.PI * (0.18 + pourProgress * 0.32);
          }
          if (streamBeam) {
            const beamPulse = 0.85 + Math.sin(elapsedS * 24.0) * 0.25;
            streamBeam.scale.set(beamPulse, 1.0 + Math.sin(elapsedS * 18.0) * 0.15, beamPulse);
          }
          if (halo) {
            halo.rotation.z = elapsedS * 3.5;
          }
        }
      }
      // Animate Teca di Ghiaccio Eterno rising around the Puffin (Puffin is translucent cyan-blue BEHIND the front ice wall!)
      if (this.props.iceCoffin) {
        if (t < 0.36) {
          this.props.iceCoffin.visible = false;
        } else if (t < 0.74) {
          this.props.iceCoffin.visible = true;
          const riseU = Math.min(1, (t - 0.36) / 0.28);
          const defX = this.defenderFighter ? this.defenderFighter.position.x : toPos.x;
          const defZ = this.defenderFighter ? this.defenderFighter.position.z : toPos.z;
          this.props.iceCoffin.position.set(defX, 0, defZ);
          this.props.iceCoffin.scale.set(0.92 + riseU * 0.22, Math.max(0.1, riseU), 0.92 + riseU * 0.22);
          this.props.iceCoffin.rotation.y = defYaw + Math.sin(elapsedS * 2.0) * 0.12;
          // Tint the Puffin translucent icy cyan-blue ("azzurro traslucido") inside/behind the ice block!
          if (this.defenderFighter && !this.defenderFighter.userData.frozenCyanTinted) {
            this.defenderFighter.userData.frozenCyanTinted = true;
            this.defenderFighter.traverse((child) => {
              if (child.isMesh && child.material) {
                const clonedMat = child.material.clone();
                if (clonedMat.color) clonedMat.color.setHex(0x4dd0e1);
                if (clonedMat.emissive) {
                  clonedMat.emissive.setHex(0x00bcd4);
                  clonedMat.emissiveIntensity = 0.55;
                }
                clonedMat.transparent = true;
                clonedMat.opacity = 0.68;
                child.material = clonedMat;
              }
            });
          }
        } else {
          // Crumbles into 60 diamond-ice crystals at the start of Act 3!
          this.props.iceCoffin.visible = false;
        }
      }
    }

    // Animate King Riccardo ("Papino" `k`) 6 D&D Spells in 3D!
    const dndSpell = clash.dndSpell;
    if (dndSpell) {
      const showDnd = t >= 0.30 && t < 0.86;
      if (dndSpell === 'fireball' && this.props.dndFireball) {
        this.props.dndFireball.visible = showDnd;
        if (showDnd) {
          const fbU = Math.min(1, (t - 0.30) / 0.35);
          this.props.dndFireball.position.set(
            fromPos.x + (toPos.x - fromPos.x) * fbU,
            0.55 + Math.sin(fbU * Math.PI) * 0.65,
            fromPos.z + (toPos.z - fromPos.z) * fbU,
          );
          const { fbCore, d20Mesh } = this.props.dndFireball.userData;
          if (fbCore) fbCore.scale.setScalar(0.5 + fbU * 1.45 + Math.sin(elapsedS * 20) * 0.15);
          if (d20Mesh) d20Mesh.rotation.set(elapsedS * 8, elapsedS * 11, elapsedS * 6);
        }
      } else if (dndSpell === 'meteor_swarm' && this.props.dndMeteorSwarm) {
        this.props.dndMeteorSwarm.visible = showDnd;
        if (showDnd) {
          const fallU = ((t - 0.30) / 0.56) % 1;
          this.props.dndMeteorSwarm.position.set(toPos.x, (1 - fallU) * 1.6, toPos.z);
          this.props.dndMeteorSwarm.rotation.y = elapsedS * 4.5;
        }
      } else if (dndSpell === 'summon_comic_daemon' && this.props.dndComicDaemon) {
        this.props.dndComicDaemon.visible = showDnd;
        if (showDnd) {
          const hop = Math.abs(Math.sin(elapsedS * 14.0)) * 0.35;
          this.props.dndComicDaemon.position.set(
            toPos.x - dirX * 0.12,
            hop,
            toPos.z - dirZ * 0.12,
          );
          this.props.dndComicDaemon.rotation.set(0, atkYaw + Math.sin(elapsedS * 10) * 0.4, 0);
        }
      } else if (dndSpell === 'disintegrate' && this.props.dndDisintegrateRay) {
        this.props.dndDisintegrateRay.visible = showDnd;
        if (showDnd) {
          this.props.dndDisintegrateRay.position.set(toPos.x, 0, toPos.z);
          this.props.dndDisintegrateRay.rotation.set(0, atkYaw, 0);
          const { beam, dustPile } = this.props.dndDisintegrateRay.userData;
          if (beam) beam.scale.set(1 + Math.sin(elapsedS * 30) * 0.3, 1, 1 + Math.sin(elapsedS * 30) * 0.3);
          if (dustPile) dustPile.scale.setScalar(Math.min(1.4, Math.max(0.2, (t - 0.30) * 2.5)));
        }
      } else if (dndSpell === 'flesh_to_stone_petrification' && this.props.dndPetrifyStatue) {
        this.props.dndPetrifyStatue.visible = showDnd;
        if (showDnd) {
          this.props.dndPetrifyStatue.position.set(toPos.x, 0.66, toPos.z);
          this.props.dndPetrifyStatue.rotation.y = elapsedS * 2.0;
        }
      }
    }

    if (this.props.sanGennaroAmpoule?.visible) {
      const amp = this.props.sanGennaroAmpoule;
      const { bloodCore, bloodCoreMat } = amp.userData || {};
      // Tilts side-to-side like the Cardinal showing the Ampoule to Naples, then spins radiantly!
      amp.position.y = 1.68 + Math.sin(elapsedS * 5.0) * 0.14;
      amp.rotation.y = elapsedS * 2.8;
      amp.rotation.z = t < 0.28 ? Math.sin(elapsedS * 14.0) * 0.42 : Math.sin(elapsedS * 6.0) * 0.16;
      if (bloodCore && bloodCoreMat) {
        if (t < 0.28) {
          // Clotted dark solid garnet before the miracle
          bloodCoreMat.color.setHex(0x4a000b);
          bloodCoreMat.emissive.setHex(0x2b0005);
          bloodCoreMat.emissiveIntensity = 0.35;
          bloodCore.scale.set(0.88, 0.50, 0.48);
          bloodCore.position.y = -0.06;
        } else {
          // IL MIRACOLO! The blood liquefies, swells, and boils with radiant ruby-gold glow!
          const liqT = Math.min(1, (t - 0.28) / 0.25);
          bloodCoreMat.color.setHex(0xff1744);
          bloodCoreMat.emissive.setHex(0xd50000);
          bloodCoreMat.emissiveIntensity = 1.4 + Math.sin(elapsedS * 22.0) * 0.6;
          const slosh = Math.sin(elapsedS * 18.0) * 0.12;
          bloodCore.scale.set(
            0.94 + slosh * 0.5,
            0.52 + liqT * 0.54 - slosh * 0.4,
            0.54,
          );
          bloodCore.position.y = -0.05 + liqT * 0.05 + Math.cos(elapsedS * 15.0) * 0.03;
        }
      }
    }

    // Animate 3D Comic Impact Word Sprite bobbing & pulsing above the brawl (`y = 2.08m`)
    if (this.props.comicWordSprite) {
      const wordPulse = 1.0 + Math.abs(Math.sin(elapsedS * 14.0)) * 0.12;
      this.props.comicWordSprite.position.set(
        toPos.x,
        2.08 + Math.sin(elapsedS * 10.0) * 0.05,
        toPos.z,
      );
      this.props.comicWordSprite.scale.set(1.38 * wordPulse, 0.43 * wordPulse, 1);
    }

    // 2. Animate Real 3D GLB Combatants (Attacker A vs Defender B)!
    const atk = this.attackerFighter;
    const def = this.defenderFighter;
    const reaction = clash.victimReaction;

    if (atk && def) {
      const scale = (this.pieceView?.globalPieceScale || 1.0) * 1.22;

      if (reaction === 'happy_cuddle_hop' || clash.effect === 'mega_cuddle_bounce') {
        // Seby <-> Pupurabbu Easter Egg: Synchronized Mega Cuddle Bounce!
        if (this.props.brawlCloud) this.props.brawlCloud.visible = false;
        this.setComicWordText('SUPER ABBRACCIO! 💜🤗', '#8e24aa', '#ff80ab');
        const hop = Math.abs(Math.sin(elapsedS * 8.5)) * 0.65;
        atk.position.set(toPos.x - dirX * 0.24, hop, toPos.z - dirZ * 0.24);
        def.position.set(toPos.x + dirX * 0.24, hop, toPos.z + dirZ * 0.24);
        atk.rotation.set(0, atkYaw + Math.sin(elapsedS * 6) * 0.35, 0);
        def.rotation.set(0, defYaw - Math.sin(elapsedS * 6) * 0.35, 0);
        this.pieceView?.applyPoseToPiece(atk, {
          walkPhase: elapsedS * 18,
          walkAmp: 1.2,
          bodyY: 0.1,
          rollZ: Math.sin(elapsedS * 9) * 0.16,
        });
        this.pieceView?.applyPoseToPiece(def, {
          walkPhase: elapsedS * 18,
          walkAmp: 1.2,
          bodyY: 0.1,
          rollZ: -Math.sin(elapsedS * 9) * 0.16,
        });
        this.animateFighterWeaponProp(atk, this.attackerWeaponProp, elapsedS, 0.8, false);
        this.animateFighterWeaponProp(def, this.defenderWeaponProp, elapsedS, 0.8, false);
        return;
      }

      if (t < 0.25) {
        // ACT 1 (0..25%): Walk/Gallop Charge toward Defender B!
        if (this.props.brawlCloud) this.props.brawlCloud.visible = false;
        this.setComicWordText('CHARGE!', '#1565c0', '#ffea00');
        def.userData.isCounterAttacking = false;

        const u = t / 0.25;
        const stopX = toPos.x - dirX * 0.42;
        const stopZ = toPos.z - dirZ * 0.42;
        const stepHop = Math.abs(Math.sin(u * Math.PI * 4));

        atk.position.set(
          fromPos.x + (stopX - fromPos.x) * u,
          stepHop * 0.10,
          fromPos.z + (stopZ - fromPos.z) * u,
        );
        atk.rotation.set(0, atkYaw, 0);
        atk.scale.setScalar(scale);
        this.pieceView?.applyPoseToPiece(atk, {
          walkPhase: elapsedS * 20,
          walkAmp: 1.45,
          combatPhase: elapsedS * 10,
          combatAmp: 0.55,
          bodyY: stepHop * 0.18,
          pitchX: 0.22,
          rollZ: Math.sin(u * Math.PI * 4) * 0.18,
        });

        // Defender B braces in an aggressive guard stance with weapon raised!
        def.position.set(toPos.x + dirX * 0.16, 0, toPos.z + dirZ * 0.16);
        def.rotation.set(0, defYaw, 0);
        def.scale.setScalar(scale);
        this.pieceView?.applyPoseToPiece(def, {
          walkPhase: elapsedS * 14,
          walkAmp: 0.85,
          combatPhase: elapsedS * 12,
          combatAmp: 0.65,
          bodyY: Math.abs(Math.sin(elapsedS * 10)) * 0.09,
          pitchX: 0.14,
          rollZ: Math.sin(elapsedS * 10) * 0.12,
        });

        this.animateFighterWeaponProp(atk, this.attackerWeaponProp, elapsedS, 1.0, false);
        this.animateFighterWeaponProp(def, this.defenderWeaponProp, elapsedS, 0.85, false);
      } else if (t < 0.74) {
        // ACT 2 (25..74%): LA SCAZZOTTATA 3D! (5-Hit Back-and-Forth 3D Character Brawl + Defender Counter-Attacks!)
        const brawlU = (t - 0.25) / 0.49;

        // Swirl the low-profile 3D Cartoon Brawl Dust at the fighters' feet (`y = 0.16m`) so bodies stay 100% clear!
        const strike = Math.abs(Math.sin(brawlU * Math.PI * 5.0));
        if (this.props.brawlCloud) {
          this.props.brawlCloud.visible = true;
          this.props.brawlCloud.position.set(toPos.x, 0.16 + strike * 0.06, toPos.z);
          this.props.brawlCloud.rotation.y = elapsedS * 11.0;
          this.props.brawlCloud.rotation.z = elapsedS * 7.5;
          const cScale = 0.42 + strike * 0.20;
          this.props.brawlCloud.scale.setScalar(cScale);
        }

        let atkOffset = -0.34;
        let defOffset = 0.20;
        let atkY = 0;
        let defY = 0;
        let atkPitch = 0;
        let defPitch = 0;
        let atkRoll = 0;
        let defRoll = 0;
        let atkYawOff = 0;
        let defYawOff = 0;
        let isDefenderCounter = false;

        if (brawlU < 0.20) {
          // Exchange 1 (brawlU = 0.00..0.20): Attacker A lunges & slashes with weapon into Defender B!
          const exFrac = brawlU / 0.20;
          const s = Math.sin(exFrac * Math.PI);
          this.setComicWordText('CLANG! ⚔️', '#ff6d00', '#ffea00');
          atkOffset = -0.36 + s * 0.36;
          defOffset = 0.18 + s * 0.26;
          atkY = s * 0.20;
          atkPitch = 0.40 * s;
          defPitch = -0.38 * s;
          defRoll = 0.25 * s;
        } else if (brawlU < 0.44) {
          // Exchange 2 (brawlU = 0.20..0.44): DEFENDER COUNTER-ATTACK #1!
          // Defender actively fights back with their bespoke character counter-move & weapon prop!
          const exFrac = (brawlU - 0.20) / 0.24;
          const s = Math.sin(exFrac * Math.PI);
          isDefenderCounter = true;
          this.setComicWordText('CONTRATTACCO! 💥', '#d50000', '#ffea00');

          if (!this.defenderCounterBurstFired) {
            this.defenderCounterBurstFired = true;
            this.spawnFromPool(defSpec.counterPool, toPos, 18, {
              speedMin: 1.5,
              speedMax: 3.8,
              upMin: 2.0,
              upMax: 4.4,
              restitution: 0.6,
            });
          }

          // Defender lunges forward into Attacker and knocks Attacker backward!
          defOffset = 0.20 - s * 0.38;
          atkOffset = -0.32 - s * defSpec.pushBackDist;
          defY = s * defSpec.counterJumpY;
          defPitch = defSpec.counterPitch * s;
          defRoll = Math.sin(exFrac * Math.PI * 4) * defSpec.counterRollAmp;
          defYawOff = exFrac * defSpec.counterSpinYaw;
          atkPitch = -0.42 * s;
          atkRoll = -0.28 * s;
          atkY = s * 0.14;
        } else if (brawlU < 0.68) {
          // Exchange 3 (brawlU = 0.44..0.68): DEFENDER COUNTER-ATTACK #2 + Mid-Air Whirlwind Clash!
          const exFrac = (brawlU - 0.44) / 0.24;
          const s = Math.sin(exFrac * Math.PI);
          isDefenderCounter = true;
          this.setComicWordText(
            clash.effect === 'sacro_acquarius_ice_coffin' ? 'SACRO ACQUARIUS! ♒❄️' : 'KAPOW! 🌪️',
            clash.effect === 'sacro_acquarius_ice_coffin' ? '#00ACC1' : '#aa00ff',
            '#ffea00',
          );

          atkOffset = -0.18 + Math.cos(exFrac * Math.PI * 2) * 0.16;
          defOffset = 0.14 - Math.cos(exFrac * Math.PI * 2) * 0.22;
          atkY = s * 0.42;
          defY = s * (defSpec.counterJumpY + 0.16);
          defPitch = defSpec.counterPitch * 0.85 * s;
          atkYawOff = clash.effect === 'sacro_acquarius_ice_coffin' ? 0 : exFrac * Math.PI * 2;
          defYawOff = defSpec.counterSpinYaw ? exFrac * defSpec.counterSpinYaw : -exFrac * Math.PI * 2;
          atkRoll = Math.sin(exFrac * Math.PI * 4) * 0.25;
          defRoll = -Math.sin(exFrac * Math.PI * 4) * defSpec.counterRollAmp;
        } else if (brawlU < 0.84) {
          // Exchange 4 (brawlU = 0.68..0.84): Attacker A breaks through with a heavy uppercut / Aurora stream!
          const exFrac = (brawlU - 0.68) / 0.16;
          const s = Math.sin(exFrac * Math.PI);
          const dndWords = {
            fireball: 'D&D FIREBALL 8d6! 🔥',
            chain_lightning: 'CHAIN LIGHTNING! ⚡',
            meteor_swarm: 'METEOR SWARM! ☄️',
            summon_comic_daemon: 'SUMMON DAEMON! 😈',
            disintegrate: 'DISINTEGRATE! 🟢',
            flesh_to_stone_petrification: 'PIETRIFICAZIONE! 🗿',
            kiss_of_death_blight: 'KISS OF DEATH! 💋🥀',
          };
          this.setComicWordText(
            clash.effect === 'sacro_acquarius_ice_coffin'
              ? 'SACRO ACQUARIUS! ♒❄️'
              : dndWords[clash.dndSpell] || 'KAPOW! 🌪️',
            clash.effect === 'sacro_acquarius_ice_coffin' ? '#0097a7' : '#ff3d00',
            '#80deea',
          );
          atkOffset = clash.dndSpell === 'kiss_of_death_blight' ? -0.08 : -0.28 + s * 0.30;
          defOffset = clash.dndSpell === 'kiss_of_death_blight' ? 0.10 : 0.20 + s * 0.26;
          atkY = clash.dndSpell === 'kiss_of_death_blight' ? 0.04 : s * 0.34;
          defY = clash.effect === 'sacro_acquarius_ice_coffin' || clash.dndSpell === 'kiss_of_death_blight' ? 0.05 : s * 0.40;
          atkPitch = clash.dndSpell === 'kiss_of_death_blight' ? 0.36 : -0.28 * s;
          defPitch = clash.dndSpell === 'kiss_of_death_blight' ? -0.48 : 0;
          defYawOff = clash.effect === 'sacro_acquarius_ice_coffin' || clash.dndSpell === 'kiss_of_death_blight' ? 0 : exFrac * Math.PI * 4;
          defRoll = 0.32 * s;
        } else {
          // Exchange 5 (brawlU = 0.84..1.00): Attacker A Signature Finishing Slam / Teca di Ghiaccio!
          const exFrac = (brawlU - 0.84) / 0.16;
          const s = Math.sin(exFrac * Math.PI);
          const dndFinishWords = {
            fireball: 'NAT 20 FIREBALL! 🔥🎲',
            chain_lightning: 'CHAIN LIGHTNING! ⚡⛓️',
            meteor_swarm: 'METEOR SWARM! ☄️🌋',
            summon_comic_daemon: 'DEMONE PIZZA! 😈🍕',
            disintegrate: '10d6+40 DUST! 🟢✨',
            flesh_to_stone_petrification: 'STATUA D’ORO! 🗿👑',
            kiss_of_death_blight: 'AVVIZZITA! 🥀💀',
          };
          this.setComicWordText(
            clash.effect === 'sacro_acquarius_ice_coffin'
              ? 'TECA DI GHIACCIO! 🧊'
              : dndFinishWords[clash.dndSpell] || 'KAPOW! 🌪️',
            clash.effect === 'sacro_acquarius_ice_coffin' ? '#00838f' : '#ff6d00',
            '#e0f7fa',
          );
          const jumpH = clash.effect === 'plush_ground_pound' ? 1.85 : 0.78;
          atkOffset = clash.dndSpell === 'kiss_of_death_blight' ? -0.10 : -0.30 * (1 - exFrac);
          defOffset = 0.18;
          atkY = clash.effect === 'sacro_acquarius_ice_coffin' ? 0.18 : Math.sin(exFrac * Math.PI) * jumpH;
          atkPitch = clash.effect === 'sacro_acquarius_ice_coffin' ? -0.18 : Math.cos(exFrac * Math.PI) * 0.38;
          defPitch = clash.dndSpell === 'kiss_of_death_blight' ? -0.68 : clash.effect === 'sacro_acquarius_ice_coffin' ? 0 : -0.36 * s;
        }

        def.userData.isCounterAttacking = isDefenderCounter;
        const defScaleMult = isDefenderCounter ? defSpec.bellyInflate : 1.0;
        atk.scale.setScalar(scale);
        if (clash.dndSpell === 'kiss_of_death_blight' && brawlU >= 0.68) {
          // Gothic Wither ("avvizzisce in un corpo senza vita"): shrinks thinner and drains color to ashen-gray!
          const witherU = Math.min(1, (brawlU - 0.68) / 0.32);
          def.scale.set(
            scale * (1 - witherU * 0.32),
            scale * (1 - witherU * 0.18),
            scale * (1 - witherU * 0.32),
          );
          if (!def.userData.kissWitherTinted) {
            def.userData.kissWitherTinted = true;
            def.traverse((child) => {
              if (child.isMesh && child.material) {
                const m = child.material.clone();
                if (m.color) m.color.setHex(0x6e6a7c);
                if (m.emissive) {
                  m.emissive.setHex(0x2a1836);
                  m.emissiveIntensity = 0.35;
                }
                m.transparent = true;
                m.opacity = 0.80;
                child.material = m;
              }
            });
          }
        } else {
          def.scale.setScalar(scale * defScaleMult);
        }

        atk.position.set(toPos.x + dirX * atkOffset, atkY, toPos.z + dirZ * atkOffset);
        def.position.set(toPos.x + dirX * defOffset, defY, toPos.z + dirZ * defOffset);
        atk.rotation.set(0, atkYaw, 0);
        def.rotation.set(0, defYaw, 0);

        this.pieceView?.applyPoseToPiece(atk, {
          walkPhase: elapsedS * 26,
          walkAmp: 1.5,
          combatPhase: elapsedS * 28,
          combatAmp: isDefenderCounter ? 1.25 : 1.85,
          bodyY: Math.abs(Math.sin(elapsedS * 18)) * 0.14,
          pitchX: atkPitch,
          rollZ: atkRoll,
          yawOffset: atkYawOff,
        });
        // Seby's Sacro Acquarius Pose: Unites both hands high overhead while the Golden Amphora pours ice!
        if (clash.effect === 'sacro_acquarius_ice_coffin' && brawlU >= 0.44) {
          const skel = atk.userData?.proceduralSkeleton;
          if (skel?.leftArm && skel?.rightArm) {
            skel.leftArm.rotation.set(-2.85, 0, -0.32);
            skel.rightArm.rotation.set(-2.85, 0, 0.32);
          }
          if (this.attackerWeaponProp?.userData) {
            const { leftHandPivot, rightHandPivot } = this.attackerWeaponProp.userData;
            if (leftHandPivot) leftHandPivot.position.set(-0.08, 0.96, 0.08);
            if (rightHandPivot) rightHandPivot.position.set(0.08, 0.96, 0.08);
          }
        }
        this.pieceView?.applyPoseToPiece(def, {
          walkPhase: elapsedS * 26,
          walkAmp: clash.effect === 'sacro_acquarius_ice_coffin' && brawlU >= 0.55 ? 0.1 : 1.55,
          combatPhase: elapsedS * 28 + Math.PI,
          combatAmp: isDefenderCounter ? 2.15 : 1.65,
          bodyY: Math.abs(Math.cos(elapsedS * 18)) * 0.14,
          pitchX: defPitch,
          rollZ: defRoll,
          yawOffset: defYawOff,
        });

        this.animateFighterWeaponProp(atk, this.attackerWeaponProp, elapsedS, 1.35, false);
        this.animateFighterWeaponProp(def, this.defenderWeaponProp, elapsedS, 1.45, isDefenderCounter);
      } else {
        // ACT 3 (74..100%): Knockout Launch toward Shrek's Swamp (`x = ±6.4m, y = -0.28m`) + Water Splash!
        if (this.props.brawlCloud) this.props.brawlCloud.visible = false;
        this.setComicWordText(
          clash.effect === 'sacro_acquarius_ice_coffin' ? 'CRUMBLE! ❄️💎' : 'K.O.! 🐸💦',
          clash.effect === 'sacro_acquarius_ice_coffin' ? '#00bcd4' : '#00c853',
          '#ffea00',
        );
        def.userData.isCounterAttacking = false;

        const koU = (t - 0.74) / 0.26;
        const vicBounce = Math.abs(Math.sin(koU * Math.PI * 2));

        // Attacker A claims the square and celebrates with weapon raised!
        atk.position.set(toPos.x, vicBounce * 0.18, toPos.z);
        atk.rotation.set(0, atkYaw + Math.sin(koU * Math.PI) * 0.35, 0);
        atk.scale.setScalar(scale);
        this.pieceView?.applyPoseToPiece(atk, {
          walkPhase: elapsedS * 16,
          walkAmp: 0.95,
          combatPhase: koU * Math.PI * 2,
          combatAmp: 1.15,
          bodyY: vicBounce * 0.18,
          pitchX: -0.15 * vicBounce,
          rollZ: Math.sin(koU * Math.PI * 2) * 0.14,
        });
        this.animateFighterWeaponProp(atk, this.attackerWeaponProp, elapsedS, 1.1, false);

        // Defender B reacts to signature finisher and arcs into Shrek's Swamp (`x = ±6.4m, y = -0.28m`)!
        const swampX = this.swampLandingPos.x;
        const swampY = this.swampLandingPos.y;
        const swampZ = this.swampLandingPos.z;

        if (reaction === 'frozen_coffin_crumble' && koU < 0.36) {
          // Frozen Puffin inside the Teca di Ghiaccio crumbles/shatters into diamond-ice crystals on the square!
          const subU = koU / 0.36;
          const crumbleScale = Math.max(0.12, 1 - subU * 0.85);
          def.scale.set(scale * (1 + subU * 0.35), scale * crumbleScale, scale * (1 + subU * 0.35));
          def.position.set(toPos.x + dirX * 0.16, 0, toPos.z + dirZ * 0.16);
        } else if ((reaction === 'sweet_melt' || reaction === 'bowled_flat_stars' || reaction === 'pancake_squash') && koU < 0.28) {
          // Brief squash/melt on the square before being catapulted into Shrek's Swamp!
          const subU = koU / 0.28;
          def.scale.set(
            scale * (1 + subU * 0.55),
            scale * Math.max(0.18, 1 - subU * 0.72),
            scale * (1 + subU * 0.55),
          );
          def.position.set(toPos.x + dirX * 0.20, 0, toPos.z + dirZ * 0.20);
        } else {
          const arcU =
            reaction === 'frozen_coffin_crumble'
              ? (koU - 0.36) / 0.64
              : reaction === 'sweet_melt' || reaction === 'bowled_flat_stars' || reaction === 'pancake_squash'
                ? (koU - 0.28) / 0.72
                : koU;
          const clampedU = Math.min(1, Math.max(0, arcU));
          const curX = toPos.x + (swampX - toPos.x) * clampedU;
          const curZ = toPos.z + (swampZ - toPos.z) * clampedU;
          const linY = clampedU * swampY;
          const curY = linY + Math.sin(clampedU * Math.PI) * 2.45;
          def.position.set(curX, curY, curZ);
          def.rotation.set(clampedU * 12, defYaw + clampedU * 10, clampedU * 11);
          const shrink = Math.max(0.55, 1 - clampedU * 0.22);
          def.scale.setScalar(scale * shrink);
        }
        this.animateFighterWeaponProp(def, this.defenderWeaponProp, elapsedS, 0.7, false);

        // Trigger 3D Shrek Swamp Emerald Water Splash Ring + Droplet Burst at `t = 0.88..1.00`!
        if (t >= 0.86) {
          if (!this.swampSplashTriggered) {
            this.swampSplashTriggered = true;
            if (this.props.swampKoSplash) {
              this.props.swampKoSplash.position.set(swampX, swampY + 0.04, swampZ);
              this.props.swampKoSplash.visible = true;
            }
            this.spawnFromPool(
              'swamp_water_droplets',
              { x: swampX, z: swampZ },
              30,
              {
                originY: swampY + 0.12,
                floorY: swampY,
                speedMin: 1.4,
                speedMax: 3.8,
                upMin: 2.6,
                upMax: 5.4,
                restitution: 0.45,
              },
            );
          }
          if (this.props.swampKoSplash?.visible) {
            const splashU = Math.min(1, (t - 0.86) / 0.14);
            const { outerRing, innerRing, crownMesh } = this.props.swampKoSplash.userData;
            if (outerRing) {
              outerRing.scale.setScalar(0.6 + splashU * 3.2);
              outerRing.material.opacity = Math.max(0.1, (1 - splashU) * 0.95);
            }
            if (innerRing) {
              innerRing.scale.setScalar(0.5 + splashU * 2.1);
              innerRing.material.opacity = Math.max(0.15, (1 - splashU * 0.85) * 0.95);
            }
            if (crownMesh) {
              const crownArc = Math.sin(splashU * Math.PI);
              crownMesh.scale.set(0.8 + splashU * 1.4, Math.max(0.1, crownArc * 1.6), 0.8 + splashU * 1.4);
              crownMesh.material.opacity = Math.max(0.1, crownArc * 0.85);
            }
          }
        }
      }
      return;
    }

    // 3. Fallback Victim Proxy Reactions (used only in headless tests without PieceView)
    const v = this.victimProxy;
    if (!v || !v.visible) return;
    if (reaction === 'levitate_dissolve' || reaction === 'royal_throne_whirl') {
      v.position.y = Math.min(1.6, t * 1.8);
      v.rotation.y = elapsedS * 9.5;
      v.scale.setScalar(Math.max(0.08, 1 - t * 0.85));
    } else if (reaction === 'sweet_melt') {
      const melt = Math.min(1, t * 1.4);
      v.scale.set(1 + melt * 0.6, Math.max(0.08, 1 - melt * 0.92), 1 + melt * 0.6);
    } else if (reaction === 'crystallize_shatter' || reaction === 'frozen_coffin_crumble') {
      v.scale.setScalar(t < 0.32 ? 1.05 : Math.max(0.01, 1 - (t - 0.32) * 3.0));
    } else if (reaction === 'bowled_flat_stars' || reaction === 'pancake_squash') {
      const flat = Math.min(1, Math.max(0, (t - 0.2) * 2.0));
      v.scale.set(1 + flat * 0.5, Math.max(0.1, 1 - flat * 0.9), 1 + flat * 0.5);
    } else if (reaction === 'spin_off_board') {
      const flyT = Math.max(0, (t - 0.32) / 0.68);
      v.position.set(toPos.x + flyT * 2.8, Math.sin(flyT * Math.PI) * 2.4, toPos.z - flyT * 2.2);
      v.rotation.set(flyT * 14, flyT * 10, flyT * 12);
    }
  }

  /**
   * Half-Board (~5x5 Squares) Combat Camera (`dist = 4.55m..4.90m, y = 2.42m..2.58m, fov = 45°`),
   * framing the 2 fighting pieces, ~5x5 squares of neighboring pieces around them,
   * and 100% of the 16:9 Veo video backdrop right behind the board from any camera angle,
   * with a smooth entry window (`0 -> 1.1s`) and a continuous `3.5s` exit sliding window!
   */
  updateCameraOrbit(t, step) {
    if (!this.camera || !this.camOrbitCenter) return;
    const c = this.camOrbitCenter;
    let focusX = c.x;
    let focusZ = c.z;
    if (this.attackerFighter && this.defenderFighter && t < 0.74) {
      focusX = (this.attackerFighter.position.x + this.defenderFighter.position.x) * 0.5;
      focusZ = (this.attackerFighter.position.z + this.defenderFighter.position.z) * 0.5;
    }

    const angleOffset = Number.isFinite(this.combatAngleOffset) ? this.combatAngleOffset : 0;
    const orbitAngle = (t - 0.5) * 0.48 + angleOffset; // Smooth sweep around the 2 fighters + optional angle offset
    const dist = 4.90 - Math.sin(t * Math.PI) * 0.35; // Frames ~5x5 chessboard squares (~half board)
    const camY = 2.42 + Math.sin(t * Math.PI) * 0.16; // Elevated angle showing 5x5 board + full 16:9 backdrop

    // Impact camera shake on heavy hits in Act 2 (`t = 0.25..0.74`) and swamp splash (`t = 0.88..0.98`)
    let shakeX = 0;
    let shakeY = 0;
    if (t >= 0.25 && t < 0.74) {
      const brawlU = (t - 0.25) / 0.49;
      const exFrac = (brawlU * 5.0) % 1;
      const hitPulse = Math.pow(Math.sin(exFrac * Math.PI), 4);
      const amp = 0.065 * hitPulse;
      shakeX = Math.sin(this.clashElapsed * 65.0) * amp;
      shakeY = Math.cos(this.clashElapsed * 53.0) * amp * 0.85;
    } else if (t >= 0.88 && t < 0.98) {
      const splashPulse = Math.sin(((t - 0.88) / 0.10) * Math.PI);
      shakeX = Math.sin(this.clashElapsed * 48.0) * 0.035 * splashPulse;
      shakeY = Math.cos(this.clashElapsed * 42.0) * 0.045 * splashPulse;
    }
    this.lastCameraShake = Math.hypot(shakeX, shakeY);

    const dirX = Math.sin(orbitAngle);
    const dirZ = Math.cos(orbitAngle);
    const targetY = 1.62;

    const desiredPos = new THREE.Vector3(
      focusX + dirX * dist + shakeX,
      camY + shakeY,
      focusZ + dirZ * dist,
    );
    const desiredTarget = new THREE.Vector3(
      focusX + shakeX * 0.4,
      targetY + shakeY * 0.4,
      focusZ,
    );

    if (!this._orbitPoseInitialized) {
      this._orbitPoseInitialized = true;
      this.lastCombatDesiredPos.copy(desiredPos);
      this.lastCombatDesiredTarget.copy(desiredTarget);
    } else {
      const orbitAlpha = Math.min(1, step * 9.0);
      this.lastCombatDesiredPos.lerp(desiredPos, orbitAlpha);
      this.lastCombatDesiredTarget.lerp(desiredTarget, orbitAlpha);
    }

    // Compute the exact 16:9 Netflix Cinema XXL pose corresponding to the combat camera
    const targetFov = 45;
    this._computeNetflixMirrorPose(this.lastCombatDesiredPos, this.lastCombatDesiredTarget, targetFov, dist);

    // Compute unified `combatBlend` (`0.0 .. 1.0`) across Entry (`0..1.1s`), Peak (`1.1s..4.8s`),
    // and Phase 1 of the 3.5s Exit Sliding Window (`4.8s..6.0s`)
    const durationS = (this.activeClash?.durationMs || 6000) / 1000;
    const entryS = this.getEntryDurationS();
    const exitTotalS = this.getExitWindowS();
    const preExitS = Math.min(durationS * 0.20, exitTotalS * 0.34);
    const exitStartS = Math.max(entryS + 0.5, durationS - preExitS);

    let blend = 1.0;
    if (this.clashElapsed < entryS) {
      blend = Math.max(0.02, this.smoothstep(this.clashElapsed / entryS));
    } else if (
      this.clashElapsed > exitStartS &&
      this.activeClash?.type !== 'CHECKMATE_CAPITULATION'
    ) {
      const exitElapsed = this.clashElapsed - exitStartS;
      blend = Math.max(0, 1.0 - this.smoothstep(exitElapsed / Math.max(0.1, exitTotalS)));
    }

    this._applyCombatBlendState(blend);
  }

  /**
   * Computes the camera-aligned 16:9 Netflix Cinema XXL position, scale, and quaternion
   * for a given combat camera pose `(camPos, camTgt, fov)`.
   */
  _computeNetflixMirrorPose(camPos, camTgt, fov = 45, fallbackDist = 4.8) {
    const upVec = new THREE.Vector3(0, 1, 0);
    const lookMat = new THREE.Matrix4().lookAt(camPos, camTgt, upVec);
    this.lastNetflixMirrorQuat.setFromRotationMatrix(lookMat);

    const camDx = camPos.x - camTgt.x;
    const camDz = camPos.z - camTgt.z;
    const actualHorizDist = Math.hypot(camDx, camDz) || fallbackDist;
    const actualDirX = camDx / actualHorizDist;
    const actualDirZ = camDz / actualHorizDist;

    const maxAltarCornerDist =
      Math.abs(4.8 * actualDirX) +
      Math.abs(4.8 * actualDirZ) +
      camTgt.x * actualDirX +
      camTgt.z * actualDirZ;
    const backdropDist = Math.max(5.8, maxAltarCornerDist + 0.85);

    let defaultBoost = 1.75; // Cinema XXL (+75%, covers the entire 90%-transparent chessboard underneath!)
    if (typeof window !== 'undefined' && window.location?.search) {
      const qb = new URLSearchParams(window.location.search).get('videoBoost');
      if (qb !== null && Number.isFinite(Number(qb))) {
        defaultBoost = Math.max(0.8, Math.min(2.5, Number(qb)));
      }
    }
    const videoBoost = Number.isFinite(this.combatVideoBoost)
      ? this.combatVideoBoost
      : defaultBoost;

    const dMirror = actualHorizDist + backdropDist;
    const halfTan = Math.tan((fov * 0.5 * Math.PI) / 180);
    const hHalf = dMirror * halfTan;

    const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.lastNetflixMirrorQuat).normalize();
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.lastNetflixMirrorQuat).normalize();

    const topOffset = 0.72 * hHalf;
    const frameSpanH = 0.78 * hHalf * videoBoost;
    const mirrorScale = Math.max(0.52, Math.min(2.20, frameSpanH / 4.60));
    const centerOffset = topOffset - 2.30 * mirrorScale;

    this.lastNetflixMirrorPos
      .copy(camPos)
      .addScaledVector(camFwd, dMirror)
      .addScaledVector(camUp, centerOffset);
    this.lastNetflixMirrorScale = mirrorScale;
  }

  /**
   * Applies the unified `combatBlend` (`0.0 .. 1.0`) across:
   * 1. `ZurichSwampView` (Swamp, Zurich Skyline, Alps, and 64 Chessboard tiles alpha cross-fade)
   * 2. `VeoCinemaView` (Netflix film alpha `100% <-> 0%` + "Cinema Vecchio" convergence)
   * 3. `this.camera` & `this.controls.target` (smooth pull-back to `this.camSaved`)
   * 4. `VeoMagicCinemaMirror` 3D position, scale, and quaternion convergence to `(0, 3.65, -10.8)`
   * @param {number} blend
   */
  _applyCombatBlendState(blend) {
    const b = Math.max(0, Math.min(1, Number.isFinite(blend) ? blend : 0));
    this.combatBlend = b;

    if (this.scene?.userData) {
      this.scene.userData.combatBlend = b;
      this.scene.userData.applySwampCombatBlend?.(b);
      this.scene.userData.applyCinemaCombatBlend?.(b);
    }

    if (this.camera && this.camSaved) {
      const savedPos = this.camSaved.pos;
      const savedTarget = this.camSaved.target;
      const savedFov = this.camSaved.fov || 46;
      const targetFov = 45;

      this.camera.position.lerpVectors(savedPos, this.lastCombatDesiredPos, b);
      if (this.camera.fov !== undefined) {
        this.camera.fov = savedFov + (targetFov - savedFov) * b;
        this.camera.updateProjectionMatrix?.();
      }
      if (this.controls?.target) {
        this.controls.target.lerpVectors(savedTarget, this.lastCombatDesiredTarget, b);
        this.controls.update?.();
      } else {
        const lookTgt = new THREE.Vector3().lerpVectors(savedTarget, this.lastCombatDesiredTarget, b);
        this.camera.lookAt(lookTgt);
      }
    }

    const mirrorRoot = this.scene?.getObjectByName?.('VeoMagicCinemaMirror');
    if (mirrorRoot) {
      const idlePos = mirrorRoot.userData?.idlePos || new THREE.Vector3(0, 3.65, -10.8);
      const idleScale = mirrorRoot.userData?.idleScale || 0.65;

      if (b >= 0.999 && this.camera) {
        this.camera.updateMatrixWorld?.();
        mirrorRoot.position.copy(this.lastNetflixMirrorPos);
        mirrorRoot.scale.setScalar(this.lastNetflixMirrorScale);
        mirrorRoot.quaternion.copy(this.camera.quaternion);
        mirrorRoot.userData.vfxControlled = true;
      } else if (b <= 0.001) {
        mirrorRoot.position.copy(idlePos);
        mirrorRoot.scale.setScalar(idleScale);
        mirrorRoot.rotation.set(0, 0, 0);
        mirrorRoot.userData.vfxControlled = false;
      } else {
        mirrorRoot.position.lerpVectors(idlePos, this.lastNetflixMirrorPos, b);
        mirrorRoot.scale.setScalar(idleScale + (this.lastNetflixMirrorScale - idleScale) * b);
        mirrorRoot.quaternion.slerpQuaternions(
          this._idleMirrorQuat,
          this.lastNetflixMirrorQuat,
          b,
        );
        mirrorRoot.userData.vfxControlled = true;
      }
    }
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
    this.clearAllActive();
    if (this.scene && this.rootGroup.parent === this.scene) {
      this.scene.remove(this.rootGroup);
    }
  }
}
