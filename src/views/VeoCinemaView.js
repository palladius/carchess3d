/**
 * @fileoverview VeoCinemaView — 16:9 3D Magic Cinema Mirror (`8.0m x 4.5m`) suspended at
 * `(0, y = 4.5m, z = -10.0m)` between the Grossmünster Twin Towers.
 *
 * Implements the 3-Tier Visual Pipeline for all 36 `6x6` capture combinations:
 * - Tier 1 (Veo `.mp4` / `.webm` `THREE.VideoTexture` / Canvas Video Frame): Attempts to play
 *   `choreo.videoUrl` (`assets/battles/videos/<atk>_x_<def>.mp4` or `.webm`) in a hidden
 *   `<video muted playsInline>` element for all 36 `6x6` pairings!
 * - Tier 2 & 3 (Dynamic 2D `1280x720` `<canvas>` Composite Keyframe + Cutie Versus Card):
 *   Renders a 60fps `THREE.CanvasTexture` with preloaded `assets/characters/*.jpg` portraits
 *   (plus optional `assets/battles/keyframes/*.svg`), shader-style diagonal lightning /
 *   purple heart cuddle storm (`Seby <-> Pupurabbu`) / golden throne aura (`Riccardo <-> Kate`),
 *   and bespoke pair-specific titles, Defender counter-attack badges, and comic impact banners
 *   from `BattleMatrix36.js`!
 */

import * as THREE from 'three';
import { BATTLE_MATRIX, CHARACTER_REGISTRY } from '../core/Registry.js';
import { BATTLE_MATRIX_36, getBattle36 } from '../core/BattleMatrix36.js';

export class VeoCinemaView {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/EventBus.js').GameEventBus} [bus]
   */
  constructor(scene, bus = null) {
    this.scene = scene;
    this.bus = bus;
    this.time = 0;

    /** @type {'idle' | 'battle' | 'checkmate'} */
    this.mode = 'idle';
    this.turnColor = 'w';
    this.lastMoveSan = null;
    this.winnerColor = null;
    this.activeBattle = null;
    this.battleElapsed = 0;
    this.usingVideoTexture = false;
    this.activeVideoUrl = null;

    /** @type {Map<string, HTMLImageElement>} */
    this.imageCache = new Map();
    /** @type {Array<() => void>} */
    this.offs = [];

    this.root = new THREE.Group();
    this.root.name = 'VeoMagicCinemaMirror';
    // In idle mode, keep the mirror discreet ("in disparte") between the Grossmünster towers;
    // during combat/checkmate it expands to a full-screen 16:9 backdrop right behind the auto-zoomed fighters!
    this.idlePos = new THREE.Vector3(0, 3.65, -10.8);
    this.idleScale = 0.65;
    this.battlePos = new THREE.Vector3(0, 2.45, -5.2);
    this.battleScale = 1.85;

    this.root.position.copy(this.idlePos);
    this.root.scale.setScalar(this.idleScale);
    this.scene.add(this.root);

    this.initCanvasAndVideo();
    this.buildMirrorMeshAndOrnateFrame();
    this.preloadCharacterPortraits();
    this.bindEvents();
    this.drawCanvasFrame();
  }

  // ===========================================================================
  // 1. 1280x720 CANVAS + HIDDEN VEO <VIDEO> ELEMENT
  // ===========================================================================

  initCanvasAndVideo() {
    this.canvas = null;
    this.ctx2d = null;
    this.canvasTexture = null;
    this.videoEl = null;
    this.videoTexture = null;

    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.ctx2d = this.canvas.getContext('2d');

      this.canvasTexture = new THREE.CanvasTexture(this.canvas);
      this.canvasTexture.colorSpace = THREE.SRGBColorSpace;
      this.canvasTexture.minFilter = THREE.LinearFilter;
      this.canvasTexture.magFilter = THREE.LinearFilter;

      this.videoEl = document.createElement('video');
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;
      this.videoEl.loop = true;
      this.videoEl.crossOrigin = 'anonymous';
      this.videoEl.preload = 'metadata';
    }
  }

  // ===========================================================================
  // 2. 16:9 SCREEN MESH (8.0m x 4.5m) & ORNATE 3D GOLDEN FRAME (8.6m x 5.1m)
  // ===========================================================================

  buildMirrorMeshAndOrnateFrame() {
    // 1. 16:9 Magic Mirror Screen (8.0m x 4.5m)
    const screenGeo = new THREE.PlaneGeometry(8.0, 4.5);
    this.screenMaterial = new THREE.MeshBasicMaterial({
      map: this.canvasTexture || null,
      color: 0xffffff,
    });
    this.screenMesh = new THREE.Mesh(screenGeo, this.screenMaterial);
    this.screenMesh.name = 'VeoCinemaScreen16x9';
    this.screenMesh.position.z = 0.04;
    this.root.add(this.screenMesh);

    // 2. Subtle Backlight Halo Plane (9.4m x 5.9m) behind the frame
    const haloGeo = new THREE.PlaneGeometry(9.4, 5.9);
    this.haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffca28,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.haloMesh = new THREE.Mesh(haloGeo, this.haloMaterial);
    this.haloMesh.position.z = -0.18;
    this.root.add(this.haloMesh);

    // 3. Ornate Sculpted 3D Golden Frame (8.6m x 5.1m)
    this.frameGroup = new THREE.Group();
    this.frameGroup.name = 'OrnateGoldenMirrorFrame';
    this.root.add(this.frameGroup);

    this.goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      roughness: 0.26,
      metalness: 0.40,
      emissive: new THREE.Color(0x6e4b08),
      emissiveIntensity: 0.48,
    });

    this.runeBezelMaterial = new THREE.MeshStandardMaterial({
      color: 0x261d3a,
      roughness: 0.35,
      metalness: 0.45,
      emissive: new THREE.Color(0x9575cd),
      emissiveIntensity: 0.55,
    });

    // Dark backing plate (8.5m x 5.0m)
    const backPlate = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 5.0, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x161324, roughness: 0.7 }),
    );
    backPlate.position.z = -0.05;
    this.frameGroup.add(backPlate);

    // Top & Bottom sculpted golden bars (width 8.6m, height 0.32m, depth 0.28m)
    const horizBarGeo = new THREE.BoxGeometry(8.6, 0.32, 0.28);
    for (const yPos of [2.39, -2.39]) {
      const bar = new THREE.Mesh(horizBarGeo, this.goldMaterial);
      bar.position.set(0, yPos, 0.04);
      this.frameGroup.add(bar);
    }

    // Left & Right sculpted golden bars (width 0.32m, height 5.1m, depth 0.28m)
    const vertBarGeo = new THREE.BoxGeometry(0.32, 5.1, 0.28);
    for (const xPos of [-4.14, 4.14]) {
      const bar = new THREE.Mesh(vertBarGeo, this.goldMaterial);
      bar.position.set(xPos, 0, 0.04);
      this.frameGroup.add(bar);
    }

    // Inner glowing rune bezel strips framing the 8.0m x 4.5m canvas
    const innerHorizGeo = new THREE.BoxGeometry(8.08, 0.08, 0.18);
    for (const yPos of [2.25, -2.25]) {
      const strip = new THREE.Mesh(innerHorizGeo, this.runeBezelMaterial);
      strip.position.set(0, yPos, 0.07);
      this.frameGroup.add(strip);
    }
    const innerVertGeo = new THREE.BoxGeometry(0.08, 4.58, 0.18);
    for (const xPos of [-4.0, 4.0]) {
      const strip = new THREE.Mesh(innerVertGeo, this.runeBezelMaterial);
      strip.position.set(xPos, 0, 0.07);
      this.frameGroup.add(strip);
    }

    // 4 Corner Royal Rosette Crests (±4.18m, ±2.42m)
    const cornerRosetteGeo = new THREE.CylinderGeometry(0.34, 0.38, 0.34, 8);
    cornerRosetteGeo.rotateX(Math.PI / 2);
    for (const [cx, cy] of [
      [-4.18, 2.42],
      [4.18, 2.42],
      [-4.18, -2.42],
      [4.18, -2.42],
    ]) {
      const rosette = new THREE.Mesh(cornerRosetteGeo, this.goldMaterial);
      rosette.position.set(cx, cy, 0.08);
      this.frameGroup.add(rosette);
    }

    // Top Center Royal Crown Crest Finial
    const crestArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.10, 8, 20, Math.PI),
      this.goldMaterial,
    );
    crestArch.position.set(0, 2.48, 0.08);
    this.frameGroup.add(crestArch);

    const crownOrb = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 12), this.goldMaterial);
    crownOrb.position.set(0, 3.12, 0.08);
    this.frameGroup.add(crownOrb);
  }

  // ===========================================================================
  // 3. PORTRAIT PRELOADING & EVENT BUS SUBSCRIPTIONS
  // ===========================================================================

  preloadCharacterPortraits() {
    if (typeof Image === 'undefined') return;
    for (const char of Object.values(CHARACTER_REGISTRY)) {
      for (const url of [char.frontPortrait, char.altPortrait]) {
        if (url && !this.imageCache.has(url)) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this.drawCanvasFrame();
          };
          img.src = url;
          this.imageCache.set(url, img);
        }
      }
    }
  }

  getOrLoadImage(url) {
    if (!url || typeof Image === 'undefined') return null;
    let img = this.imageCache.get(url);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.src = url;
      this.imageCache.set(url, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  bindEvents() {
    if (!this.bus) return;
    this.offs.push(
      this.bus.on('BATTLE_STARTED', (e) => this.startBattlePresentation(e)),
      this.bus.on('WOW_ARENA_CLASH', (e) => this.startBattlePresentation(e)),
      this.bus.on('PIECE_CAPTURED', (e) => {
        if (this.mode !== 'battle') {
          this.startBattlePresentation(e);
        }
      }),
      this.bus.on('BATTLE_COMPLETED', () => this.stopBattlePresentation()),
      this.bus.on('BATTLE_SKIPPED', () => this.stopBattlePresentation()),
      this.bus.on('MOVE_EXECUTED', (e) => {
        this.turnColor = e.turn || 'w';
        this.lastMoveSan = e.move?.san || `${e.move?.from || ''}→${e.move?.to || ''}`;
      }),
      this.bus.on('CHECKMATE', (e) => {
        this.mode = 'checkmate';
        this.winnerColor = e.winner || 'w';
        this.tryPlayVeoVideo('assets/battles/videos/b_x_n.mp4', false, 'checkmate');
      }),
      this.bus.on('BOARD_RESET', (e) => {
        this.mode = 'idle';
        this.turnColor = e.turn || 'w';
        this.lastMoveSan = null;
        this.winnerColor = null;
        this.stopBattlePresentation();
      }),
    );
  }

  // ===========================================================================
  // 4. 3-TIER BATTLE PRESENTATION PIPELINE (VEO .MP4 -> COMPOSITE -> VERSUS CARD)
  // ===========================================================================

  startBattlePresentation(e = {}) {
    const atkKey = (e.attacker || e.choreo?.attacker || 'b').toLowerCase();
    const defKey = (e.defender || e.choreo?.defender || 'p').toLowerCase();
    const baseEntry = BATTLE_MATRIX[atkKey]?.[defKey] || BATTLE_MATRIX.b.p;
    const matrix36Entry =
      BATTLE_MATRIX_36?.[atkKey]?.[defKey] || getBattle36?.(atkKey, defKey) || {};

    const choreo = {
      ...baseEntry,
      ...matrix36Entry,
      ...(e.choreo || {}),
      ...e,
      title: e.title || matrix36Entry.title || baseEntry.title || null,
      banner: matrix36Entry.banner || e.banner || baseEntry.banner,
      defenderCounter: e.defenderCounter || matrix36Entry.defenderCounter || null,
      videoUrl: e.videoUrl || matrix36Entry.videoUrl || baseEntry.videoUrl,
      webmUrl: e.webmUrl || matrix36Entry.webmUrl || null,
      keyframeUrl:
        e.keyframeUrl ||
        matrix36Entry.keyframeUrl ||
        `assets/battles/keyframes/${atkKey}_x_${defKey}.png`,
      attacker: atkKey,
      defender: defKey,
    };

    this.activeBattle = choreo;
    this.mode = 'battle';
    this.battleElapsed = 0;

    // Expand 16:9 Veo Cinema Screen into giant near-fullscreen IMAX backdrop right behind the board!
    if (this.root && this.battlePos) {
      this.root.position.copy(this.battlePos);
      this.root.scale.setScalar(this.battleScale || 1.85);
    }

    // Preload portraits, Nano Banana 16:9 initial battle keyframe, & optional SVG composite
    this.getOrLoadImage(choreo.attackerImg);
    this.getOrLoadImage(choreo.defenderImg);
    if (choreo.keyframeUrl) {
      this.getOrLoadImage(choreo.keyframeUrl);
    }
    if (choreo.compositeUrl) {
      this.getOrLoadImage(choreo.compositeUrl);
    }

    this.tryPlayVeoVideo(choreo.videoUrl, false, 'battle');
  }

  /**
   * Loads and plays ANY of the 36 `<atk>_x_<def>.mp4` or `.webm` battle videos on the 16:9 Cinema Mirror.
   * @param {string} videoUrl
   * @param {boolean} [triedWebm=false]
   * @param {'battle'|'checkmate'} [expectedMode='battle']
   */
  tryPlayVeoVideo(videoUrl, triedWebm = false, expectedMode = 'battle') {
    this.stopVideoPlayback();
    if (!videoUrl || !this.videoEl) return;
    if (!/[kqbnrp]_x_[kqbnrp]\.(mp4|webm)$/i.test(videoUrl)) return;

    try {
      this.videoEl.src = videoUrl;
      this.videoEl.currentTime = 0;
      this.videoEl.playbackRate = 1.0;
      const playPromise = this.videoEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (this.mode !== expectedMode && this.mode !== 'battle' && this.mode !== 'checkmate') {
              this.videoEl.pause();
              return;
            }
            this.usingVideoTexture = true;
            this.activeVideoUrl = videoUrl;
          })
          .catch(() => {
            if (!triedWebm && /\.mp4$/i.test(videoUrl)) {
              this.tryPlayVeoVideo(videoUrl.replace(/\.mp4$/i, '.webm'), true, expectedMode);
              return;
            }
            this.usingVideoTexture = false;
            this.activeVideoUrl = null;
          });
      }
    } catch {
      this.usingVideoTexture = false;
      this.activeVideoUrl = null;
    }
  }

  stopVideoPlayback() {
    this.usingVideoTexture = false;
    this.activeVideoUrl = null;
    if (this.videoEl) {
      try {
        this.videoEl.pause();
      } catch {
        // Ignore pause errors in headless environments
      }
    }
  }

  restoreCanvasTexture() {
    if (this.screenMaterial && this.canvasTexture && this.screenMaterial.map !== this.canvasTexture) {
      this.screenMaterial.map = this.canvasTexture;
      this.screenMaterial.needsUpdate = true;
    }
  }

  stopBattlePresentation() {
    this.stopVideoPlayback();
    if (this.mode === 'battle' || this.mode === 'checkmate') {
      this.mode = 'idle';
    }
    if (this.root && this.idlePos) {
      this.root.position.copy(this.idlePos);
      this.root.scale.setScalar(this.idleScale || 0.65);
    }
  }

  // ===========================================================================
  // 5. DYNAMIC 1280x720 2D CANVAS RENDERING (IDLE / BATTLE / CHECKMATE)
  // ===========================================================================

  drawCanvasFrame() {
    if (!this.ctx2d || !this.canvas) return;
    const ctx = this.ctx2d;
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (this.mode === 'battle' && this.activeBattle) {
      this.drawBattleFrame(ctx, w, h, this.activeBattle);
    } else if (this.mode === 'checkmate') {
      this.drawCheckmateFrame(ctx, w, h);
    } else {
      this.drawIdleCrestFrame(ctx, w, h);
    }

    if (this.canvasTexture) {
      this.canvasTexture.needsUpdate = true;
    }
  }

  drawIdleCrestFrame(ctx, w, h) {
    const t = this.time;

    // Quiet, discreet Enchanted Zurich Crest when idle ("in disparte")
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0f1629');
    bg.addColorStop(0.5, '#142634');
    bg.addColorStop(1, '#191229');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle animated magic circles
    ctx.save();
    ctx.translate(w / 2, h / 2 + 20);
    ctx.rotate(t * 0.12);
    ctx.strokeStyle = 'rgba(255, 213, 79, 0.16)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 240, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Ornate Inner Gold Border
    ctx.strokeStyle = 'rgba(230, 184, 74, 0.65)';
    ctx.lineWidth = 5;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    // Minimal Royal Crest Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe082';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText('🏰 CarChess3D · Specchio Magico Veo 🎬', w / 2, 108);

    // 6 Family Hero Circular Portrait Medallions across the center of the 16:9 screen
    const heroKeys = ['k', 'q', 'b', 'n', 'r', 'p'];
    const spacing = 186;
    const startX = w / 2 - ((heroKeys.length - 1) * spacing) / 2;
    const centerY = 360;
    const radius = 72;

    heroKeys.forEach((key, idx) => {
      const charMeta = CHARACTER_REGISTRY[key];
      const cx = startX + idx * spacing;
      const img = this.getOrLoadImage(charMeta.frontPortrait);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, centerY, radius, 0, Math.PI * 2);
      ctx.clip();

      if (img) {
        const { sx, sy, sw, sh } = this.computeBustCrop(img);
        ctx.drawImage(img, sx, sy, sw, sh, cx - radius, centerY - radius, radius * 2, radius * 2);
      } else {
        ctx.fillStyle = '#26324d';
        ctx.fillRect(cx - radius, centerY - radius, radius * 2, radius * 2);
        ctx.fillStyle = '#ffe082';
        ctx.font = 'bold 54px serif';
        ctx.fillText(charMeta.glyph, cx, centerY + 18);
      }
      ctx.restore();

      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(`${charMeta.glyph} ${charMeta.name}`, cx, centerY + radius + 32);
    });

    ctx.fillStyle = 'rgba(139, 232, 194, 0.78)';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText('In attesa di combattimento · Lo schermo si espanderà dietro la scacchiera ⚔️', w / 2, 620);
  }

  computeBustCrop(img) {
    if (img.width > img.height * 1.22) {
      return {
        sx: img.width * 0.04,
        sy: img.height * 0.02,
        sw: img.width * 0.44,
        sh: img.height * 0.66,
      };
    }
    const minDim = Math.min(img.width, img.height);
    return {
      sx: (img.width - minDim) * 0.5,
      sy: (img.height - minDim) * 0.12,
      sw: minDim,
      sh: minDim,
    };
  }

  drawBattleFrame(ctx, w, h, choreo) {
    const t = this.time;
    const atkChar = CHARACTER_REGISTRY[choreo.attacker] || CHARACTER_REGISTRY.b;
    const defChar = CHARACTER_REGISTRY[choreo.defender] || CHARACTER_REGISTRY.p;

    const titleText =
      typeof choreo.title === 'string'
        ? choreo.title
        : choreo.title?.it ||
          choreo.title?.en ||
          `${atkChar.glyph} ${atkChar.name.toUpperCase()}  ⚡  ${defChar.glyph} ${defChar.name.toUpperCase()}`;

    const counterSfx = choreo.defenderCounter?.sfxText || '';

    // TIER 1: If a Veo / 3D .mp4 or .webm video is loaded and playing, draw the clean live video frame
    // with only a compact top-border pill (ZERO bottom text banner so the 3D fighters are never occluded!)
    if (this.usingVideoTexture && this.videoEl && this.videoEl.readyState >= 2) {
      ctx.drawImage(this.videoEl, 0, 0, w, h);

      ctx.save();
      ctx.fillStyle = 'rgba(14, 18, 32, 0.72)';
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(24, 14, 560, 38, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffe082';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⚔️ ${titleText}`.slice(0, 46), 42, 39);
      ctx.restore();
      return;
    }

    // TIER 2: If the Nano Banana 16:9 Initial Battle Keyframe (`assets/battles/keyframes/<id>.png`) is loaded, draw it cleanly!
    const nbKeyframe = this.getOrLoadImage(choreo.keyframeUrl);
    if (nbKeyframe) {
      ctx.drawImage(nbKeyframe, 0, 0, w, h);
      ctx.save();
      ctx.fillStyle = 'rgba(14, 18, 32, 0.72)';
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(24, 14, 560, 38, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffe082';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`🍌 ${titleText}`.slice(0, 46), 42, 39);
      ctx.restore();
      return;
    }

    const isCuddle = Boolean(choreo.nonLethalCuddle) || choreo.easterEgg === 'seby_pupurabbu_cuddle';
    const isThrone = choreo.easterEgg === 'carlesso_al_cesso_throne';

    // 1. Dynamic Split-Screen Background (Tier 3 Fallback)
    const grad = ctx.createLinearGradient(0, 0, w, h);
    if (isCuddle) {
      grad.addColorStop(0, '#4a148c');
      grad.addColorStop(0.5, '#ad1457');
      grad.addColorStop(1, '#6a1b9a');
    } else if (isThrone) {
      grad.addColorStop(0, '#5d4037');
      grad.addColorStop(0.5, '#f57f17');
      grad.addColorStop(1, '#4a148c');
    } else {
      grad.addColorStop(0, '#1a237e');
      grad.addColorStop(0.5, '#311b92');
      grad.addColorStop(1, '#4a148c');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Shader-style Energy / Heart / Throne Particles
    for (let i = 0; i < 32; i++) {
      const px = (i * 157 + t * 220 * (i % 2 === 0 ? 1 : -1) + w * 4) % w;
      const py = (i * 93 + Math.sin(t * 4 + i) * 60 + h) % h;
      if (isCuddle) {
        ctx.font = `${26 + (i % 3) * 10}px sans-serif`;
        ctx.fillText(i % 2 === 0 ? '💜' : '🤗', px, py);
      } else if (isThrone) {
        ctx.font = `${26 + (i % 3) * 10}px sans-serif`;
        ctx.fillText(i % 2 === 0 ? '👑' : '⚡', px, py);
      } else {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 235, 59, 0.7)' : 'rgba(105, 240, 174, 0.65)';
        ctx.beginPath();
        ctx.arc(px, py, 3 + (i % 4) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Left Attacker Portrait Card & Right Defender Portrait Card
    this.drawCharacterCard(ctx, 75, 130, 410, 440, atkChar, 'ATTACCANTE ⚔️', '#ffd54f', t);
    const defRoleLabel = isCuddle
      ? 'AMICO COCCOLOSO 💜'
      : counterSfx
      ? `DIFENSORE 🛡️ · ${counterSfx}`
      : 'DIFENSORE 🛡️';
    this.drawCharacterCard(ctx, w - 485, 130, 410, 440, defChar, defRoleLabel, '#90caf9', -t);

    // 4. Center Diagonal Lightning / Cuddle Rainbow Clash
    ctx.save();
    ctx.strokeStyle = isCuddle ? '#ff80ab' : '#ffeb3b';
    ctx.lineWidth = 10;
    ctx.shadowColor = isCuddle ? '#f50057' : '#ff6d00';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(w / 2 + 55, 110);
    ctx.lineTo(w / 2 - 35 + Math.sin(t * 24) * 12, h / 2 - 20);
    ctx.lineTo(w / 2 + 35 + Math.cos(t * 24) * 12, h / 2 + 25);
    ctx.lineTo(w / 2 - 55, h - 120);
    ctx.stroke();
    ctx.restore();

    // 5. Top Bespoke 6x6 Matchup Title only (keep bottom clear behind 3D fighters)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe082';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(titleText, w / 2, 64);
  }

  drawCharacterCard(ctx, x, y, cw, ch, charMeta, roleLabel, borderColor, phase) {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 22, 38, 0.88)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 20);
    ctx.fill();
    ctx.stroke();

    const img = this.getOrLoadImage(charMeta.frontPortrait);
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 16, y + 16, cw - 32, ch - 115, 14);
      ctx.clip();
      const { sx, sy, sw, sh } = this.computeBustCrop(img);
      ctx.drawImage(img, sx, sy, sw, sh, x + 16, y + 16, cw - 32, ch - 115);
      ctx.restore();
    } else {
      ctx.fillStyle = '#26324d';
      ctx.fillRect(x + 16, y + 16, cw - 32, ch - 115);
      ctx.fillStyle = '#ffe082';
      ctx.font = 'bold 110px serif';
      ctx.textAlign = 'center';
      ctx.fillText(charMeta.glyph, x + cw / 2, y + (ch - 115) / 2 + 40 + Math.sin(phase * 3) * 6);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText(`${charMeta.glyph} ${charMeta.name}`, x + cw / 2, y + ch - 52);

    ctx.fillStyle = borderColor;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(roleLabel, x + cw / 2, y + ch - 20);
    ctx.restore();
  }

  drawCheckmateFrame(ctx, w, h) {
    const t = this.time;
    if (this.usingVideoTexture && this.videoEl && this.videoEl.readyState >= 2) {
      ctx.drawImage(this.videoEl, 0, 0, w, h);
      ctx.fillStyle = 'rgba(20, 10, 35, 0.45)';
      ctx.fillRect(0, 0, w, h);
    } else {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#311b92');
      bg.addColorStop(0.5, '#880e4f');
      bg.addColorStop(1, '#f57f17');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    for (let i = 0; i < 36; i++) {
      const fx = ((i * 179 + t * 140) % (w - 80)) + 40;
      const fy = ((i * 113 + Math.sin(t * 3 + i) * 70 + h) % (h - 80)) + 40;
      ctx.font = '32px sans-serif';
      ctx.fillText(i % 3 === 0 ? '🏆' : i % 2 === 0 ? '👑' : '✨', fx, fy);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe082';
    ctx.font = 'bold 62px system-ui, sans-serif';
    ctx.fillText('🏆 SCACCO MATTO! 👑', w / 2, 130);

    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('CAPITOLAZIONE REALE DEL RE SCONFITTO! 💥', w / 2, 195);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px system-ui, sans-serif';
    const winLabel =
      this.winnerColor === 'b'
        ? 'Vittoria del Set Nero! 🎉'
        : 'Vittoria della Famiglia Carlesso (Bianco)! 🎉';
    ctx.fillText(winLabel, w / 2, 265);
  }

  // ===========================================================================
  // 6. FRAME UPDATE & CLEANUP
  // ===========================================================================

  /**
   * Animates the 16:9 screen canvas texture / video texture and smoothly transitions
   * between discreet idle pose ("in disparte") and full-screen backdrop behind the board!
   * @param {number} dt
   */
  update(dt = 0.016) {
    this.time += dt;
    if (this.mode === 'battle') {
      this.battleElapsed += dt;
    }

    const isExpanded = this.mode === 'battle' || this.mode === 'checkmate';
    const targetPos = isExpanded ? this.battlePos : this.idlePos;
    const targetScale = isExpanded ? this.battleScale : this.idleScale;
    const lerpAlpha = Math.min(1, dt * 6.5);

    this.root.position.lerp(targetPos, lerpAlpha);
    const nextScale = this.root.scale.x + (targetScale - this.root.scale.x) * lerpAlpha;
    this.root.scale.setScalar(nextScale);

    // Pulse golden frame and backlight halo
    if (this.haloMaterial) {
      this.haloMaterial.opacity = isExpanded
        ? 0.36 + Math.sin(this.time * 8.0) * 0.12
        : 0.14 + Math.sin(this.time * 2.2) * 0.04;
    }
    if (this.goldMaterial) {
      this.goldMaterial.emissiveIntensity = isExpanded
        ? 0.58 + Math.sin(this.time * 6.0) * 0.2
        : 0.28 + Math.sin(this.time * 2.0) * 0.06;
    }

    this.drawCanvasFrame();
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
    this.stopVideoPlayback();
    this.canvasTexture?.dispose?.();
    this.videoTexture?.dispose?.();
    this.screenMaterial?.dispose?.();
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}
