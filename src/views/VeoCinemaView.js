/**
 * @fileoverview VeoCinemaView — 16:9 3D Magic Cinema Mirror (`8.0m x 4.5m`) suspended at
 * `(0, y = 4.5m, z = -10.0m)` between the Grossmünster Twin Towers.
 *
 * Implements the 3-Tier Visual Pipeline for all 36 `6x6` capture combinations:
 * - Tier 1 (Veo `.mp4` `THREE.VideoTexture`): Attempts to play `choreo.videoUrl` in a hidden
 *   `<video muted playsInline>` element and binds a live `THREE.VideoTexture` to the 16:9 mirror.
 * - Tier 2 & 3 (Dynamic 2D `1280x720` `<canvas>` Composite Keyframe + Cutie Versus Card):
 *   Renders a 60fps `THREE.CanvasTexture` with preloaded `assets/characters/*.jpg` portraits
 *   (plus optional `assets/battles/keyframes/*.svg`), shader-style diagonal lightning /
 *   purple heart cuddle storm (`Seby <-> Pupurabbu`) / golden throne aura (`Riccardo <-> Kate`),
 *   and bilingual comic impact banners.
 */

import * as THREE from 'three';
import { BATTLE_MATRIX, CHARACTER_REGISTRY } from '../core/Registry.js';

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

    /** @type {Map<string, HTMLImageElement>} */
    this.imageCache = new Map();
    /** @type {Array<() => void>} */
    this.offs = [];

    this.root = new THREE.Group();
    this.root.name = 'VeoMagicCinemaMirror';
    // Canonical coordinates from docs/floorplan.svg: (0, y = 4.5m, z = -10.0m)
    this.root.position.set(0, 4.5, -10.0);
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
      opacity: 0.18,
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
      color: 0xffcf52,
      roughness: 0.24,
      metalness: 0.86,
      emissive: new THREE.Color(0x5c3c06),
      emissiveIntensity: 0.35,
    });

    this.runeBezelMaterial = new THREE.MeshStandardMaterial({
      color: 0x261d3a,
      roughness: 0.4,
      metalness: 0.5,
      emissive: new THREE.Color(0x7e57c2),
      emissiveIntensity: 0.45,
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

    // Top Center Royal Crown Crest Finial (y = +2.78m -> world y = 7.28m)
    const crestArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.11, 8, 20, Math.PI),
      this.goldMaterial,
    );
    crestArch.position.set(0, 2.52, 0.08);
    this.frameGroup.add(crestArch);

    const crownOrb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), this.goldMaterial);
    crownOrb.position.set(0, 3.22, 0.08);
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
          img.decoding = 'async';
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
        // If PIECE_CAPTURED fires before BATTLE_STARTED, prime the battle preview immediately
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
        this.stopVideoPlayback();
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
    const matrixEntry = BATTLE_MATRIX[atkKey]?.[defKey] || BATTLE_MATRIX.b.p;
    const choreo = {
      ...matrixEntry,
      ...(e.choreo || {}),
      ...e,
      attacker: atkKey,
      defender: defKey,
    };

    this.activeBattle = choreo;
    this.mode = 'battle';
    this.battleElapsed = 0;

    // Preload portraits & optional SVG composite keyframe
    this.getOrLoadImage(choreo.attackerImg);
    this.getOrLoadImage(choreo.defenderImg);
    if (choreo.compositeUrl) {
      this.getOrLoadImage(choreo.compositeUrl);
    }

    // Tier 1: Attempt Veo .mp4 VideoTexture if videoUrl is provided
    this.tryPlayVeoVideo(choreo.videoUrl);
  }

  tryPlayVeoVideo(videoUrl) {
    this.stopVideoPlayback();
    if (!videoUrl || !this.videoEl) return;

    try {
      this.videoEl.src = videoUrl;
      const playPromise = this.videoEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (this.mode !== 'battle') {
              this.videoEl.pause();
              return;
            }
            if (!this.videoTexture) {
              this.videoTexture = new THREE.VideoTexture(this.videoEl);
              this.videoTexture.colorSpace = THREE.SRGBColorSpace;
            }
            this.usingVideoTexture = true;
            this.screenMaterial.map = this.videoTexture;
            this.screenMaterial.needsUpdate = true;
          })
          .catch(() => {
            // Tier 1 .mp4 not yet rendered or autoplay blocked -> stay on Tier 2/3 CanvasTexture
            this.usingVideoTexture = false;
            this.restoreCanvasTexture();
          });
      }
    } catch {
      this.usingVideoTexture = false;
      this.restoreCanvasTexture();
    }
  }

  stopVideoPlayback() {
    this.usingVideoTexture = false;
    if (this.videoEl) {
      try {
        this.videoEl.pause();
      } catch {
        // Ignore pause errors in headless environments
      }
    }
    this.restoreCanvasTexture();
  }

  restoreCanvasTexture() {
    if (this.screenMaterial && this.canvasTexture && this.screenMaterial.map !== this.canvasTexture) {
      this.screenMaterial.map = this.canvasTexture;
      this.screenMaterial.needsUpdate = true;
    }
  }

  stopBattlePresentation() {
    this.stopVideoPlayback();
    if (this.mode === 'battle') {
      this.mode = 'idle';
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

    // Deep Enchanted Zurich Twilight Gradient
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#12192e');
    bg.addColorStop(0.5, '#172d3b');
    bg.addColorStop(1, '#1f1533');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle animated magic circles
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(t * 0.15);
    ctx.strokeStyle = 'rgba(255, 213, 79, 0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 250, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Animated golden & emerald sparkles
    for (let i = 0; i < 28; i++) {
      const sx = ((i * 197 + Math.sin(t + i) * 35) % (w - 80)) + 40;
      const sy = ((i * 131 + Math.cos(t * 0.8 + i) * 25) % (h - 80)) + 40;
      const r = 2.5 + Math.sin(t * 3 + i) * 1.5;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 224, 130, 0.75)' : 'rgba(105, 240, 174, 0.65)';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
    }

    // Ornate Inner Gold Border
    ctx.strokeStyle = '#e6b84a';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    // Royal Crest Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe082';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('🏰 CarChess3D · Scacchi di Famiglia 🚽', w / 2, 145);

    ctx.fillStyle = '#9ec5ff';
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.fillText('Palude Incantata di Zurigo · Specchio Magico Veo 16:9', w / 2, 198);

    // Family Hero Icons Row
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.fillText('♔ Riccardo   ♕ Kate   ♗ Ale 🐉   ♘ Seby 🏎️   ♖ Pupurabbu 💜   ♙ Puffin 🐟', w / 2, 345);

    // Live Turn Status Pill
    const isWhite = this.turnColor === 'w';
    ctx.fillStyle = isWhite ? 'rgba(255, 236, 179, 0.18)' : 'rgba(144, 202, 249, 0.18)';
    ctx.strokeStyle = isWhite ? '#ffd54f' : '#90caf9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 340, 430, 680, 96, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isWhite ? '#ffe082' : '#bbdefb';
    ctx.font = 'bold 38px system-ui, sans-serif';
    const turnLabel = isWhite
      ? '♔ Turno del Bianco (Avorio & Oro)'
      : '♚ Turno del Nero (Ossidiana & Argento)';
    ctx.fillText(turnLabel, w / 2, 490);

    if (this.lastMoveSan) {
      ctx.fillStyle = '#8be8c2';
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.fillText(`Ultima mossa: ${this.lastMoveSan} · Cattura un pezzo per il Cinema 3D!`, w / 2, 605);
    } else {
      ctx.fillStyle = '#8be8c2';
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.fillText('Cattura un pezzo o apri 🌟 WOW Mode per lanciare le sfide 3D!', w / 2, 605);
    }
  }

  drawBattleFrame(ctx, w, h, choreo) {
    const t = this.time;
    const atkChar = CHARACTER_REGISTRY[choreo.attacker] || CHARACTER_REGISTRY.b;
    const defChar = CHARACTER_REGISTRY[choreo.defender] || CHARACTER_REGISTRY.p;

    const isCuddle = Boolean(choreo.nonLethalCuddle) || choreo.easterEgg === 'seby_pupurabbu_cuddle';
    const isThrone = choreo.easterEgg === 'carlesso_al_cesso_throne';

    // 1. Dynamic Split-Screen Background
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
    this.drawCharacterCard(ctx, w - 485, 130, 410, 440, defChar, isCuddle ? 'AMICO COCCOLOSO 💜' : 'DIFENSORE 🛡️', '#90caf9', -t);

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

    // Pulsing VS Medallion
    const pulse = 1 + Math.sin(t * 8) * 0.08;
    ctx.save();
    ctx.translate(w / 2, h / 2 - 10);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = isCuddle ? '#ad1457' : '#d84315';
    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isCuddle ? '💜' : 'VS', 0, 4);
    ctx.restore();

    // 5. Top Matchup Title & Bottom Comic Impact Banner
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe082';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(
      `${atkChar.glyph} ${atkChar.name.toUpperCase()}  ⚡  ${defChar.glyph} ${defChar.name.toUpperCase()}`,
      w / 2,
      72,
    );

    const bannerText =
      typeof choreo.banner === 'string'
        ? choreo.banner
        : choreo.banner?.it || choreo.banner?.en || 'SFIDA MAGICA 3D! ⚔️✨';

    ctx.fillStyle = 'rgba(14, 18, 32, 0.88)';
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(110, h - 112, w - 220, 82, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText(bannerText, w / 2, h - 58);
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
      ctx.drawImage(img, x + 16, y + 16, cw - 32, ch - 115);
      ctx.restore();
    } else {
      // Stylized fallback emblem while image decodes
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
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#311b92');
    bg.addColorStop(0.5, '#880e4f');
    bg.addColorStop(1, '#f57f17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe082';
    ctx.font = 'bold 74px system-ui, sans-serif';
    ctx.fillText('🏆 SCACCO MATTO REALE! 🏆', w / 2, h / 2 - 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    const winnerText =
      this.winnerColor === 'b'
        ? 'Vittoria del Nero (Ossidiana & Argento)! 🎉'
        : 'Vittoria del Bianco (Famiglia Carlesso)! 🎉';
    ctx.fillText(winnerText, w / 2, h / 2 + 55);
  }

  // ===========================================================================
  // 6. FRAME UPDATE & CLEANUP
  // ===========================================================================

  /**
   * Animates the 16:9 screen canvas texture / video texture and golden frame glow.
   * @param {number} dt
   */
  update(dt = 0.016) {
    this.time += dt;
    if (this.mode === 'battle') {
      this.battleElapsed += dt;
    }

    // Pulse golden frame and backlight halo
    const isBattle = this.mode === 'battle';
    if (this.haloMaterial) {
      this.haloMaterial.opacity = isBattle
        ? 0.34 + Math.sin(this.time * 8.0) * 0.12
        : 0.16 + Math.sin(this.time * 2.2) * 0.05;
    }
    if (this.goldMaterial) {
      this.goldMaterial.emissiveIntensity = isBattle
        ? 0.55 + Math.sin(this.time * 6.0) * 0.2
        : 0.32 + Math.sin(this.time * 2.0) * 0.08;
    }

    if (!this.usingVideoTexture) {
      this.drawCanvasFrame();
    }
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
