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
    // during combat/checkmate it frames 100% of the 16:9 video cleanly behind the 5x5 board view!
    this.idlePos = new THREE.Vector3(0, 3.65, -10.8);
    this.idleScale = 0.65;
    this.battlePos = new THREE.Vector3(0, 2.15, -5.3);
    this.battleScale = 0.75;

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
  // 2. 16:9 SCREEN MESH (8.0m x 4.5m) & SLEEK 1.5% NETFLIX RED CINEMA BEZEL
  // ===========================================================================

  buildMirrorMeshAndOrnateFrame() {
    // 1. True 16:9 Cinema Screen (8.0m x 4.5m = 1.777:1)
    const screenGeo = new THREE.PlaneGeometry(8.0, 4.5);
    this.screenMaterial = new THREE.MeshBasicMaterial({
      map: this.canvasTexture || null,
      color: 0xffffff,
    });
    this.screenMesh = new THREE.Mesh(screenGeo, this.screenMaterial);
    this.screenMesh.name = 'VeoCinemaScreen16x9';
    this.screenMesh.position.z = 0.04;
    this.root.add(this.screenMesh);

    // 2. Subtle Netflix Crimson Backlight Ambient Halo (8.10m x 4.60m) right behind the 1.2% bezel
    const haloGeo = new THREE.PlaneGeometry(8.10, 4.60);
    this.haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xe50914,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.haloMesh = new THREE.Mesh(haloGeo, this.haloMaterial);
    this.haloMesh.position.z = -0.06;
    this.root.add(this.haloMesh);

    // 3. Minimal 1.2% Netflix Cinema Bezel (8.10m x 4.60m — zero bulky frame or top hook!)
    this.frameGroup = new THREE.Group();
    this.frameGroup.name = 'OrnateGoldenMirrorFrame';
    this.root.add(this.frameGroup);

    // Matte obsidian-black theatre casing (8.12m x 4.62m)
    this.cinemaCasingMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0f,
      roughness: 0.45,
      metalness: 0.35,
    });
    const backPlate = new THREE.Mesh(
      new THREE.BoxGeometry(8.12, 4.62, 0.06),
      this.cinemaCasingMaterial,
    );
    backPlate.position.z = -0.02;
    this.frameGroup.add(backPlate);

    // Signature Netflix Red (#E50914) 1.1% Razor Bezel Trim (0.05m width around the 8.0m x 4.5m screen)
    this.goldMaterial = new THREE.MeshBasicMaterial({
      color: 0xe50914,
    });
    this.runeBezelMaterial = this.cinemaCasingMaterial;

    const borderThickness = 0.05; // ~1.1% of screen height (4.5m)
    const horizBarGeo = new THREE.BoxGeometry(8.0 + borderThickness * 2, borderThickness, 0.05);
    for (const yPos of [2.25 + borderThickness * 0.5, -(2.25 + borderThickness * 0.5)]) {
      const bar = new THREE.Mesh(horizBarGeo, this.goldMaterial);
      bar.position.set(0, yPos, 0.045);
      this.frameGroup.add(bar);
    }

    const vertBarGeo = new THREE.BoxGeometry(borderThickness, 4.5 + borderThickness * 2, 0.05);
    for (const xPos of [-(4.0 + borderThickness * 0.5), 4.0 + borderThickness * 0.5]) {
      const bar = new THREE.Mesh(vertBarGeo, this.goldMaterial);
      bar.position.set(xPos, 0, 0.045);
      this.frameGroup.add(bar);
    }
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

    // Position 16:9 Veo Cinema Screen behind the board so 100% of the video is visible!
    if (this.root && this.battlePos) {
      this.root.position.copy(this.battlePos);
      this.root.scale.setScalar(this.battleScale || 0.75);
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
      this.root.rotation.set(0, 0, 0);
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

    // TIER 1: If a Veo / 3D .mp4 or .webm video is loaded and playing, draw the clean live 16:9 video frame
    // with a sleek Netflix Cinema overlay (red N badge, episode header, and bottom red timeline scrubber!)
    if (this.usingVideoTexture && this.videoEl && this.videoEl.readyState >= 2) {
      ctx.drawImage(this.videoEl, 0, 0, w, h);
      const vidDur = this.videoEl.duration > 0 ? this.videoEl.duration : 8.0;
      const progress = Math.min(1, Math.max(0.05, (this.videoEl.currentTime || this.battleElapsed) / vidDur));
      this.drawNetflixCinemaOverlay(ctx, w, h, titleText, progress);
      return;
    }

    // TIER 2: If the Nano Banana 16:9 Initial Battle Keyframe (`assets/battles/keyframes/<id>.png`) is loaded, draw it cleanly!
    const nbKeyframe = this.getOrLoadImage(choreo.keyframeUrl);
    if (nbKeyframe) {
      ctx.drawImage(nbKeyframe, 0, 0, w, h);
      const progress = Math.min(1, Math.max(0.08, (this.battleElapsed || 0.8) / 4.2));
      this.drawNetflixCinemaOverlay(ctx, w, h, titleText, progress);
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

  /**
   * Draws a minimal, high-contrast Netflix Cinema player overlay on the 1280x720 (16:9) screen:
   * - Top subtle vignette gradient
   * - Iconic `#E50914` Netflix-red "N" ribbon + `CARCHESS CINEMA` series header + episode title
   * - Minimal 4px `#E50914` playback scrubber bar at the bottom edge with a glowing red playhead dot
   */
  drawNetflixCinemaOverlay(ctx, w, h, titleText, progress = 0.35) {
    ctx.save();

    // Subtle top cinema gradient vignette for crisp typography
    const topGrad = ctx.createLinearGradient(0, 0, 0, 92);
    topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, 92);

    // Iconic Netflix Red "N" Badge (28x38 at x=24, y=16)
    ctx.fillStyle = '#E50914';
    ctx.beginPath();
    ctx.roundRect(24, 16, 28, 36, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', 38, 43);

    // "CARCHESS CINEMA" series tracking label + episode title
    ctx.textAlign = 'left';
    ctx.fillStyle = '#E50914';
    ctx.font = '800 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('C A R C H E S S   C I N E M A   ·   1 6 : 9   U H D', 62, 28);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(String(titleText).slice(0, 54), 62, 50);

    // Bottom minimal 5px Netflix Red playback scrubber bar
    const barY = h - 8;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.fillRect(20, barY, w - 40, 4);

    const progW = Math.max(24, Math.min(w - 40, (w - 40) * progress));
    ctx.fillStyle = '#E50914';
    ctx.fillRect(20, barY, progW, 4);

    // Glowing red scrubber playhead dot
    ctx.beginPath();
    ctx.arc(20 + progW, barY + 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#E50914';
    ctx.fill();

    ctx.restore();
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
