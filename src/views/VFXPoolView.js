/**
 * @fileoverview Pre-Allocated Object-Pooled 3D VFX & 6x6 Capture Stage (`VFXPoolView`).
 *
 * Follows Niccolò Game Design Rule #6:
 * - Zero `new THREE.Mesh()` allocations during gameplay frames.
 * - Pre-allocates pools at startup (`visible = false` when inactive) for all 6 Carlesso
 *   signature attacks, family Easter Eggs, Stone Rival shrapnel, and Golden Crit Overdrive:
 *   1. King Riccardo (`sceptre_lightning` & `golden_toilet_throne` — "Carlesso al Cesso" 🚽👑)
 *   2. Queen Kate (`chocolate_wave` — glossy milk-chocolate crest + lilac/gold confetti 🍫💜)
 *   3. Bishop Ale (`crystal_shatter` — translucent amethyst/ruby crystal case + 60 bouncing gem shards 💎🐉)
 *   4. Knight Seby (`loop_track_cars` — bright orange hot-wheels loop + 8 zooming toy cars + stars 🏎️✨)
 *   5. Rook Pupurabbu (`plush_ground_pound` — 2.6m high jump + indigo shockwave + 36 fluffy poof clouds 💥💜)
 *   6. Pawn Puffin (`halberd_fish_slap` — sculpted 3D silver-blue fish slap + spinning arc off-board 🐟⚔️)
 *   7. Easter Egg (`mega_cuddle_bounce` — Seby <-> Pupurabbu non-lethal cuddle hop + 40 3D hearts 💜🤗)
 *   8. Golden Crit Overdrive (`tier === 'golden_crit'` — 2x particles + golden sky-beam + rainbow ring 🌟)
 * - Includes the Orbiting Capture Camera Choreographer that frames BOTH the 3D board clash
 *   and the background 16:9 Veo Magic Cinema Mirror (`z = -10m, y = 4.5m`).
 */

import * as THREE from 'three';
import { CHARACTER_REGISTRY, squareToWorld } from '../core/Registry.js';

const GRAVITY = 9.8;
const DEBRIS_LIFETIME_S = 3.0;

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

    // Orbiting camera state
    this.camSaved = null;
    this.camRestoreTimer = 0;
    this.offs = [];

    if (this.scene) {
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
      bus.on('BOARD_RESET', () => this.clearAllActive()),
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
      const mat = new THREE.MeshPhysicalMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.45,
        roughness: 0.1,
        metalness: 0.15,
        transmission: 0.65,
        clearcoat: 1.0,
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
   * Cartoon Silver-Blue Fish, Shockwave Ring, Golden Crit Sky-Beam, and Victim/Cuddle Proxies).
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

    // 7. Golden Crit Sky-Beam Pillar
    const beamGeo = new THREE.CylinderGeometry(0.45, 0.65, 5.5, 20, 1, true);
    this.props.skyBeam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      }),
    );
    this.props.skyBeam.visible = false;
    this.rootGroup.add(this.props.skyBeam);

    // 8. Pre-allocated Victim & Attacker Stage Figurines (so squashes, melts, fish-slaps,
    //    and Seby <-> Pupurabbu cuddles always animate visibly on the clash square)
    this.victimProxy = this.createStageFigurine(0xd7ccc8);
    this.cuddlePartnerProxy = this.createStageFigurine(0x9575cd);
    this.rootGroup.add(this.victimProxy, this.cuddlePartnerProxy);
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

  /**
   * Triggered on `BATTLE_STARTED`: activates pooled particles, stage props, and orbiting camera.
   * @param {object} e
   */
  onBattleStarted(e) {
    this.hideStageProps();
    this.activeClash = e;
    this.clashElapsed = 0;

    const toPos = squareToWorld(e.square || e.to || 'd5');
    const fromPos = squareToWorld(e.from || 'e4');
    const isCrit = e.tier === 'golden_crit';
    const isShiny = e.tier === 'shiny' || isCrit;
    const countMult = isCrit ? 2.0 : isShiny ? 1.35 : 1.0;

    // Position dynamic clash light
    const atkChar = CHARACTER_REGISTRY[e.attacker] || CHARACTER_REGISTRY.p;
    const defChar = CHARACTER_REGISTRY[e.defender] || CHARACTER_REGISTRY.p;
    if (this.clashLight) {
      this.clashLight.color.setHex(isCrit ? 0xffd700 : atkChar.accentColor);
      this.clashLight.intensity = isCrit ? 6.5 : 4.2;
      this.clashLight.position.set(toPos.x, 1.8, toPos.z);
      this.clashLight.visible = true;
    }

    // Configure victim proxy figurine on the clash square
    if (this.victimProxy) {
      this.victimProxy.visible = true;
      this.victimProxy.position.set(toPos.x, 0, toPos.z);
      this.victimProxy.rotation.set(0, 0, 0);
      this.victimProxy.scale.set(1, 1, 1);
      this.victimProxy.userData.mat.color.setHex(defChar.accentColor || 0xb0bec5);
      this.victimProxy.userData.mat.opacity = 1;
    }

    // Trigger Ale's `FireBreath_Track` or attacker animation on PieceView if available
    if (this.pieceView?.playClipOnSquare) {
      const clipName = e.attacker === 'b' ? 'FireBreath_Track' : atkChar.animations?.attack;
      if (clipName) this.pieceView.playClipOnSquare(e.to || e.square, clipName);
    }

    // Golden Crit Sky-Beam Overdrive
    if (isCrit && this.props.skyBeam) {
      this.props.skyBeam.position.set(toPos.x, 2.75, toPos.z);
      this.props.skyBeam.visible = true;
    }

    // Spawn signature particle bursts from pre-allocated pools
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
      });
    } else if (effect === 'crystal_shatter') {
      this.props.crystalCase.position.set(toPos.x, 0.65, toPos.z);
      this.props.crystalCase.scale.setScalar(1);
      this.props.crystalCase.visible = true;
      // Pre-schedule 50+ gem shards bursting at 0.9s (plus immediate spark shards)
      this.spawnFromPool('amethyst_ruby_shards', toPos, Math.round(52 * countMult), {
        speedMin: 1.8,
        speedMax: 4.8,
        upMin: 2.5,
        upMax: 5.8,
        restitution: 0.72,
        delayS: 0.85,
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
      if (this.cuddlePartnerProxy) {
        this.cuddlePartnerProxy.visible = true;
        this.cuddlePartnerProxy.userData.mat.color.setHex(atkChar.accentColor);
        this.cuddlePartnerProxy.position.set(fromPos.x, 0, fromPos.z);
      }
      this.spawnFromPool('purple_poof_clouds', toPos, Math.round(32 * countMult), {
        speedMin: 1.2,
        speedMax: 3.4,
        upMin: 1.8,
        upMax: 4.2,
        restitution: 0.55,
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
      });
    } else if (effect === 'mega_cuddle_bounce') {
      // Seby <-> Pupurabbu non-lethal cuddle hop!
      if (this.cuddlePartnerProxy) {
        this.cuddlePartnerProxy.visible = true;
        this.cuddlePartnerProxy.userData.mat.color.setHex(atkChar.accentColor);
      }
      this.spawnFromPool('floating_purple_hearts', toPos, Math.round(36 * countMult), {
        speedMin: 0.8,
        speedMax: 2.4,
        upMin: 2.2,
        upMax: 4.6,
        restitution: 0.6,
        floatUp: true,
      });
    }

    // Start Orbiting Capture Camera choreography
    this.startCameraOrbit(toPos);
  }

  /**
   * Activates `count` meshes from the named pre-allocated pool with radial + upward velocity.
   */
  spawnFromPool(poolName, origin, count, opts = {}) {
    const pool = this.pools.get(poolName);
    if (!pool) return;
    const limit = Math.min(count, pool.length);
    for (let i = 0; i < limit; i++) {
      const mesh = pool[i];
      const angle = (i / limit) * Math.PI * 2 + (i * 0.618);
      const speed = opts.speedMin + ((i * 7) % 11) / 10 * (opts.speedMax - opts.speedMin);
      const vy = opts.upMin + ((i * 13) % 11) / 10 * (opts.upMax - opts.upMin);

      mesh.position.set(
        origin.x + Math.cos(angle) * 0.18,
        0.35 + (i % 5) * 0.08,
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
   * Saves the player's camera pose and prepares smooth orbital framing around `targetPos`
   * angled toward `-Z` so both the 3D board clash AND the Veo Cinema Mirror (`z = -10m`) are visible.
   */
  startCameraOrbit(targetPos) {
    if (!this.camera) return;
    if (!this.camSaved) {
      this.camSaved = {
        pos: this.camera.position.clone(),
        target: this.controls?.target ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0),
      };
    }
    this.camOrbitCenter = new THREE.Vector3(targetPos.x, 0.6, targetPos.z);
    this.camRestoreTimer = 0;
  }

  /**
   * Triggered on `BATTLE_COMPLETED` or `BATTLE_SKIPPED`: hides stage props and restores camera.
   */
  onBattleEnded(_e) {
    this.activeClash = null;
    this.hideStageProps();
    if (this.camSaved) {
      this.camRestoreTimer = 0.45;
    }
  }

  hideStageProps() {
    for (const prop of Object.values(this.props)) {
      if (prop) prop.visible = false;
    }
    if (this.victimProxy) this.victimProxy.visible = false;
    if (this.cuddlePartnerProxy) this.cuddlePartnerProxy.visible = false;
    if (this.clashLight) this.clashLight.visible = false;
  }

  clearAllActive() {
    this.activeClash = null;
    this.hideStageProps();
    for (const p of this.activeParticles) {
      p.mesh.visible = false;
    }
    this.activeParticles = [];
  }

  /**
   * Advances all active pooled particles, stage prop animations, victim reactions,
   * and the Orbiting Capture Camera.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!(dt > 0)) return;
    const step = Math.min(dt, 0.1);

    // 1. Update active 6x6 stage props & victim reaction
    if (this.activeClash) {
      this.clashElapsed += step;
      const durationS = (this.activeClash.durationMs || 2800) / 1000;
      const t = Math.min(1, this.clashElapsed / durationS);
      this.updateActiveChoreography(this.activeClash, t, this.clashElapsed);
      this.updateCameraOrbit(t, step);
    } else if (this.camRestoreTimer > 0 && this.camSaved && this.camera) {
      this.camRestoreTimer = Math.max(0, this.camRestoreTimer - step);
      const alpha = Math.min(1, step * 8.0);
      this.camera.position.lerp(this.camSaved.pos, alpha);
      if (this.controls?.target) {
        this.controls.target.lerp(this.camSaved.target, alpha);
        this.controls.update?.();
      } else {
        this.camera.lookAt(this.camSaved.target);
      }
      if (this.camRestoreTimer === 0) {
        this.camera.position.copy(this.camSaved.pos);
        if (this.controls?.target) {
          this.controls.target.copy(this.camSaved.target);
          this.controls.update?.();
        }
        this.camSaved = null;
      }
    }

    // 2. Update pooled debris particles (gravity + y=0 board bounce + 3.0s fade-out)
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      if (p.delayS > 0) {
        p.delayS -= step;
        if (p.delayS <= 0) {
          p.mesh.visible = true;
          if (this.props.crystalCase) this.props.crystalCase.visible = false;
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

        // Bounce on y = 0 board surface!
        if (p.mesh.position.y < 0.04) {
          p.mesh.position.y = 0.04;
          p.vy = Math.abs(p.vy) * p.restitution;
          p.vx *= 0.78;
          p.vz *= 0.78;
        }
      }
    }
  }

  /**
   * Animates the 6 signature props + Easter Eggs + victim figurine reactions over `t in [0, 1]`.
   */
  updateActiveChoreography(clash, t, elapsedS) {
    const toPos = squareToWorld(clash.square || clash.to || 'd5');
    const fromPos = squareToWorld(clash.from || 'e4');
    const v = this.victimProxy;

    if (this.props.runeCircle?.visible) {
      this.props.runeCircle.rotation.y = elapsedS * 4.2;
      this.props.runeCircle.scale.setScalar(1 + Math.sin(elapsedS * 10) * 0.15);
    }
    if (this.props.lightningBolts?.visible) {
      this.props.lightningBolts.rotation.y = elapsedS * 8.0;
      this.props.lightningBolts.visible = t < 0.75;
    }
    if (this.props.goldenThrone?.visible) {
      // Descends from y = 2.8m to y = 0.05m in a beam of royal light!
      const dropT = Math.min(1, t * 2.2);
      this.props.goldenThrone.position.y = (1 - dropT) * 2.6 + 0.05;
      this.props.goldenThrone.rotation.y = elapsedS * 3.2;
    }
    if (this.props.chocoWave?.visible) {
      this.props.chocoWave.scale.setScalar(0.5 + t * 2.4);
      this.props.chocoWave.rotation.z = elapsedS * 2.5;
    }
    if (this.props.crystalCase?.visible) {
      this.props.crystalCase.rotation.y = elapsedS * 2.2;
    }
    if (this.props.dizzyStars?.visible) {
      this.props.dizzyStars.rotation.y = elapsedS * 6.5;
    }
    if (this.props.shockwaveRing?.visible) {
      this.props.shockwaveRing.scale.setScalar(0.4 + t * 3.2);
    }
    if (this.props.puffinFish?.visible) {
      // Fish charges from attacker square to victim square and slaps!
      const slapT = Math.min(1, t * 2.4);
      this.props.puffinFish.position.set(
        fromPos.x + (toPos.x - fromPos.x) * slapT,
        0.65 + Math.sin(slapT * Math.PI) * 0.45,
        fromPos.z + (toPos.z - fromPos.z) * slapT,
      );
      this.props.puffinFish.rotation.y = elapsedS * 9.0;
    }

    // Victim & Partner Figurine Reactions
    if (!v || !v.visible) return;
    const reaction = clash.victimReaction;

    if (reaction === 'levitate_dissolve' || reaction === 'royal_throne_whirl') {
      v.position.y = Math.min(1.6, t * 1.8);
      v.rotation.y = elapsedS * 9.5;
      const shrink = Math.max(0.08, 1 - t * 0.85);
      v.scale.setScalar(shrink);
    } else if (reaction === 'sweet_melt') {
      // Melts into a glossy puddle: scale.y -> 0.08, scale.x/z -> 1.6
      const melt = Math.min(1, t * 1.4);
      v.scale.set(1 + melt * 0.6, Math.max(0.08, 1 - melt * 0.92), 1 + melt * 0.6);
    } else if (reaction === 'crystallize_shatter') {
      if (t < 0.32) {
        v.scale.setScalar(1.05);
      } else {
        v.scale.setScalar(Math.max(0.01, 1 - (t - 0.32) * 3.0));
      }
    } else if (reaction === 'bowled_flat_stars') {
      // Bowled flat ("STECCHITO! ✨"): scale.y -> 0.12
      const flat = Math.min(1, Math.max(0, (t - 0.2) * 2.0));
      v.scale.set(1 + flat * 0.45, Math.max(0.12, 1 - flat * 0.88), 1 + flat * 0.45);
    } else if (reaction === 'pancake_squash') {
      // Pupurabbu leaps to y = 2.6m and slams down at t = 0.4!
      if (this.cuddlePartnerProxy?.visible) {
        const jumpT = Math.min(1, t * 2.5);
        this.cuddlePartnerProxy.position.set(
          fromPos.x + (toPos.x - fromPos.x) * jumpT,
          Math.sin(jumpT * Math.PI) * 2.6,
          fromPos.z + (toPos.z - fromPos.z) * jumpT,
        );
      }
      const squash = Math.min(1, Math.max(0, (t - 0.36) * 2.5));
      v.scale.set(1 + squash * 0.55, Math.max(0.09, 1 - squash * 0.91), 1 + squash * 0.55);
    } else if (reaction === 'spin_off_board') {
      // Sent spinning along a high arc off the board after fish-slap!
      const flyT = Math.max(0, (t - 0.32) / 0.68);
      v.position.set(
        toPos.x + flyT * 2.8,
        Math.sin(flyT * Math.PI) * 2.4 + flyT * 0.6,
        toPos.z - flyT * 2.2,
      );
      v.rotation.set(flyT * 14, flyT * 10, flyT * 12);
    } else if (reaction === 'happy_cuddle_hop') {
      // Seby <-> Pupurabbu synchronized Mega Cuddle Bounce! Never hurt each other!
      const hop = Math.abs(Math.sin(elapsedS * 8.5)) * 0.85;
      const midX = (fromPos.x + toPos.x) * 0.5;
      const midZ = (fromPos.z + toPos.z) * 0.5;
      v.position.set(midX + 0.22, hop, midZ);
      v.rotation.y = Math.sin(elapsedS * 6) * 0.4;
      v.scale.set(1 + Math.sin(elapsedS * 12) * 0.08, 1 + Math.cos(elapsedS * 12) * 0.08, 1);
      if (this.cuddlePartnerProxy?.visible) {
        this.cuddlePartnerProxy.position.set(midX - 0.22, hop, midZ);
        this.cuddlePartnerProxy.rotation.y = -Math.sin(elapsedS * 6) * 0.4;
      }
    }
  }

  /**
   * Smoothly orbits the camera around the clash square at distance `4.8m..6.2m, y = 2.6m..3.6m`,
   * angled from `+Z` looking toward `-Z` so both the 3D clash and the 16:9 Veo Mirror (`z = -10m`) stay in frame.
   */
  updateCameraOrbit(t, step) {
    if (!this.camera || !this.camOrbitCenter) return;
    const c = this.camOrbitCenter;
    const orbitAngle = (t - 0.5) * 0.75; // Sweeps smoothly across the Southern arc
    const dist = 5.3 - Math.sin(t * Math.PI) * 0.45; // 4.85m .. 5.3m
    const camY = 2.85 + Math.sin(t * Math.PI) * 0.55; // 2.85m .. 3.4m

    const desiredPos = new THREE.Vector3(
      c.x + Math.sin(orbitAngle) * dist,
      camY,
      c.z + Math.cos(orbitAngle) * dist,
    );
    // Look slightly toward -Z/upward to keep both the clash square and the z=-10m Veo Mirror in view
    const desiredTarget = new THREE.Vector3(c.x * 0.75, 1.25, c.z * 0.65 - 1.8);

    const alpha = Math.min(1, step * 5.5);
    this.camera.position.lerp(desiredPos, alpha);
    if (this.controls?.target) {
      this.controls.target.lerp(desiredTarget, alpha);
      this.controls.update?.();
    } else {
      this.camera.lookAt(desiredTarget);
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
