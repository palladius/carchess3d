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
    this.outroBattle = null;
    this.battleElapsed = 0;
    this.cinemaBlend = 0.0;
    this.usingVideoTexture = false;
    this.activeVideoUrl = null;
    this._idleGoldColor = new THREE.Color(0xe6b84a);
    this._cinemaRedColor = new THREE.Color(0xe50914);

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
    this.root.userData.idlePos = this.idlePos.clone();
    this.root.userData.idleScale = this.idleScale;

    this.root.position.copy(this.idlePos);
    this.root.scale.setScalar(this.idleScale);
    this.scene.add(this.root);
    if (this.scene) {
      this.scene.userData = this.scene.userData || {};
      this.scene.userData.applyCinemaCombatBlend = (b) => this.setCinemaBlend(b);
    }

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
      this.videoEl.loop = false;
      this.videoEl.crossOrigin = 'anonymous';
      this.videoEl.preload = 'metadata';
    }
  }

  // ===========================================================================
  // 2. 16:9 SCREEN MESH (8.0m x 4.5m) & SLEEK 1.5% CINEMA RED BEZEL
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

    // 2. Subtle Cinema Crimson Backlight Ambient Halo (8.10m x 4.60m) right behind the 1.2% bezel
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

    // 3. Minimal 1.2% Maxi Cinema Bezel (8.10m x 4.60m — zero bulky frame or top hook!)
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

    // Signature Cinema Red (#D32F2F) 1.1% Razor Bezel Trim (0.05m width around the 8.0m x 4.5m screen)
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
      this.bus.on('BATTLE_COMPLETED', () => this.stopBattlePresentation(false)),
      this.bus.on('BATTLE_SKIPPED', () => this.stopBattlePresentation(false)),
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
        this.stopBattlePresentation(true);
      }),
    );
  }

  // ===========================================================================
  // 4. 3-TIER BATTLE PRESENTATION PIPELINE (VEO .MP4 -> COMPOSITE -> VERSUS CARD)
  // ===========================================================================

  startBattlePresentation(e = {}) {
    const atkKey = (e.attacker || e.choreo?.attacker || 'b').toLowerCase();
    const defKey = (e.defender || e.choreo?.defender || 'p').toLowerCase();
    // Deduplicate back-to-back events (e.g. PIECE_CAPTURED / WOW_ARENA_CLASH + BATTLE_STARTED)
    // within the same battle opening window so we never reset battleElapsed or restart the video!
    if (
      this.mode === 'battle' &&
      this.activeBattle &&
      this.activeBattle.attacker === atkKey &&
      this.activeBattle.defender === defKey &&
      this.battleElapsed < 0.6 &&
      !e.forceRestart
    ) {
      return;
    }
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
    this.outroBattle = choreo;
    this.mode = 'battle';
    this.battleElapsed = 0;

    // Only snap position when VFXPoolView is not driving the smooth 3D trajectory
    if (!this.scene?.userData?.vfxControlsCombatBlend && this.root && this.battlePos) {
      this.root.position.copy(this.battlePos);
      this.root.scale.setScalar(this.battleScale || 0.75);
      this.setCinemaBlend(1.0);
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

    this.tryPlayVeoVideo(choreo.videoUrl, false, 'battle', true);
  }

  getPrePaddingS() {
    if (typeof window !== 'undefined' && window.location?.search) {
      const q = new URLSearchParams(window.location.search).get('prePaddingSeconds');
      if (q !== null && Number.isFinite(Number(q))) {
        return Math.max(0.0, Math.min(3.0, Number(q)));
      }
    }
    return Number.isFinite(this.videoPrePaddingS) ? this.videoPrePaddingS : 1.0;
  }

  getCombatVideoAlpha() {
    if (typeof window !== 'undefined' && window.location?.search) {
      const q = new URLSearchParams(window.location.search).get('videoAlpha');
      if (q !== null && Number.isFinite(Number(q))) {
        return Math.max(0.25, Math.min(1.0, Number(q)));
      }
    }
    return Number.isFinite(this.combatVideoAlpha) ? this.combatVideoAlpha : 0.78;
  }

  /**
   * Loads and plays ANY of the 36 `<atk>_x_<def>.mp4` or `.webm` battle videos on the 16:9 Cinema Mirror.
   * During a 10.0s battle (`1s pre-padding + 8s Veo video + 1s post-padding`), cues Frame 0 during the
   * `0.0s .. 1.0s` pre-padding zoom-in and starts playback at `t = 1.0s` (`loop = false`) so the user
   * never misses the first second of the video and the video holds its final frame during `9.0s .. 10.0s`!
   * @param {string} videoUrl
   * @param {boolean} [triedWebm=false]
   * @param {'battle'|'checkmate'} [expectedMode='battle']
   * @param {boolean} [deferForPrePadding=false]
   */
  tryPlayVeoVideo(videoUrl, triedWebm = false, expectedMode = 'battle', deferForPrePadding = false) {
    this.stopVideoPlayback();
    if (!videoUrl || !this.videoEl) return;
    if (!/[kqbnrp]_x_[kqbnrp]\.(mp4|webm)$/i.test(videoUrl)) return;

    try {
      this.videoEl.loop = expectedMode === 'checkmate';
      this.videoEl.src = videoUrl;
      this.videoEl.currentTime = 0;
      this.videoEl.playbackRate = 1.0;
      const prePadS = deferForPrePadding ? this.getPrePaddingS() : 0;
      this.videoWaitingPrePadding = prePadS > 0 && this.battleElapsed < prePadS;

      const playPromise = this.videoEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (
              this.mode !== expectedMode &&
              this.mode !== 'battle' &&
              this.mode !== 'checkmate' &&
              !this.outroBattle
            ) {
              this.videoEl.pause();
              return;
            }
            this.usingVideoTexture = true;
            this.activeVideoUrl = videoUrl;
            // If still inside the 1.0s pre-padding intro window, hold at Frame 0 until battleElapsed >= 1.0s!
            if (this.videoWaitingPrePadding && this.battleElapsed < prePadS) {
              try {
                this.videoEl.pause();
                this.videoEl.currentTime = 0;
              } catch {
                // Ignore seek/pause errors
              }
            } else {
              this.videoWaitingPrePadding = false;
            }
          })
          .catch(() => {
            if (!triedWebm && /\.mp4$/i.test(videoUrl)) {
              this.tryPlayVeoVideo(
                videoUrl.replace(/\.mp4$/i, '.webm'),
                true,
                expectedMode,
                deferForPrePadding,
              );
              return;
            }
            this.usingVideoTexture = false;
            this.activeVideoUrl = null;
            this.videoWaitingPrePadding = false;
          });
      }
    } catch {
      this.usingVideoTexture = false;
      this.activeVideoUrl = null;
      this.videoWaitingPrePadding = false;
    }
  }

  stopVideoPlayback() {
    this.usingVideoTexture = false;
    this.activeVideoUrl = null;
    this.videoWaitingPrePadding = false;
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

  /**
   * Smoothly updates the Maxi Cinema <-> Classic Idle Mirror blend (`0.0 .. 1.0`):
   * - `1.0` = 100% Maxi Cinema XXL (live Veo film + `#D32F2F` bezel + `N` badge + scrubber)
   * - `0.0` = 100% "Cinema Vecchio" idle mirror docked between the Grossmünster Twin Towers
   * - `0.0 < b < 1.0` = Sliding-window zoom-out & alpha cross-fade (`100% -> 0%` film alpha!)
   * @param {number} b
   */
  setCinemaBlend(b) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(b) ? b : 0));
    this.cinemaBlend = clamped;
    if (this.root) {
      this.root.userData.cinemaBlend = clamped;
    }

    // Morph bezel trim color between Classic Zurich Gold (#e6b84a) and Cinema Red (#D32F2F)
    if (this.goldMaterial?.color && this._idleGoldColor && this._cinemaRedColor) {
      this.goldMaterial.color.lerpColors(this._idleGoldColor, this._cinemaRedColor, clamped);
    }

    // Modulate 3D screen & casing opacity during the sliding-window transition so the zooming-out
    // Cinema film becomes translucent (`alpha: 100% -> ~18%`) as Zurich & the Swamp rematerialize,
    // before settling cleanly at 100% as the discreet "Cinema Vecchio" between the Grossmünster towers!
    const inTransition = clamped > 0.005 && clamped < 0.995;
    const meshAlpha = inTransition
      ? clamped >= 0.22
        ? 0.18 + 0.82 * ((clamped - 0.22) / 0.78)
        : 0.18 + 0.82 * (1.0 - clamped / 0.22)
      : 1.0;

    for (const mat of [this.screenMaterial, this.cinemaCasingMaterial, this.goldMaterial]) {
      if (!mat) continue;
      if (mat.transparent !== inTransition) {
        mat.transparent = inTransition;
        mat.depthWrite = !inTransition;
        mat.needsUpdate = true;
      }
      mat.opacity = meshAlpha;
    }

    if (this.videoEl && this.mode === 'idle' && this.outroBattle) {
      try {
        this.videoEl.volume = Math.max(0, Math.min(1, clamped));
      } catch {
        // Ignore volume assignment in headless environments
      }
    }

    // Once the outro sliding window reaches 0.0, stop the hidden <video> element cleanly
    if (clamped <= 0.002 && this.mode === 'idle' && (this.usingVideoTexture || this.outroBattle)) {
      this.stopVideoPlayback();
      this.outroBattle = null;
    }
  }

  stopBattlePresentation(immediate = false) {
    if (this.mode === 'battle' || this.mode === 'checkmate') {
      this.mode = 'idle';
    }
    if (immediate || !this.scene?.userData?.vfxControlsCombatBlend) {
      this.stopVideoPlayback();
      this.outroBattle = null;
      this.setCinemaBlend(0.0);
      if (this.root && this.idlePos) {
        this.root.position.copy(this.idlePos);
        this.root.rotation.set(0, 0, 0);
        this.root.scale.setScalar(this.idleScale || 0.65);
      }
    } else if (this.videoWaitingPrePadding && this.videoEl && this.videoEl.paused) {
      // If the user forced an early exit during the 1s pre-padding, let the video flow smoothly during the zoom-out!
      this.videoWaitingPrePadding = false;
      try {
        const p = this.videoEl.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        // Ignore play errors in headless environments
      }
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

    const battleData = this.activeBattle || this.outroBattle;
    const blend = this.mode === 'battle' && !this.scene?.userData?.vfxControlsCombatBlend
      ? 1.0
      : this.cinemaBlend;

    if (this.mode === 'checkmate') {
      this.drawCheckmateFrame(ctx, w, h);
    } else if (blend >= 0.998 && battleData) {
      this.drawBattleFrame(ctx, w, h, battleData);
    } else if (blend > 0.002 && battleData) {
      // Smooth sliding-window cross-fade: "Il Cinema Vecchio" materializes underneath (`0 -> 100%`)
      // while the Maxi Cinema film fades its alpha channel from `100%` down to `0%` (invisible)!
      this.drawIdleCrestFrame(ctx, w, h);
      ctx.save();
      ctx.globalAlpha = blend;
      this.drawBattleFrame(ctx, w, h, battleData);
      ctx.restore();
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
    const prePadS = this.getPrePaddingS();
    const vidDur = this.videoEl?.duration > 0 ? this.videoEl.duration : 8.0;
    const videoElapsed = Math.max(0, (this.battleElapsed || 0) - prePadS);
    const phaseTag =
      this.battleElapsed < prePadS
        ? '1s INTRO · FACE-OFF ⚔️'
        : videoElapsed < vidDur
          ? '8s VEO FILM · LIVE 🎬'
          : '1s FINALE · VITTORIA 🏆';

    // TIER 1: If a Veo / 3D .mp4 or .webm video is loaded, draw the 16:9 video frame with
    // balanced cinema alpha (0.78 default) + subtle lower-arena contrast vignette so both the
    // full-screen Veo movie AND the 100%-solid 3D foreground fighters are crystal clear!
    if (this.usingVideoTexture && this.videoEl && this.videoEl.readyState >= 2) {
      this._drawMediaWithArenaContrast(ctx, w, h, this.videoEl);
      const activeVidTime =
        this.battleElapsed < prePadS
          ? 0
          : this.battleElapsed >= prePadS + vidDur
            ? vidDur
            : this.videoEl.currentTime || videoElapsed;
      const progress = Math.min(1, Math.max(0.02, activeVidTime / vidDur));
      this.drawCinemaCinemaOverlay(ctx, w, h, titleText, progress, phaseTag);
      return;
    }

    // TIER 2: If the Nano Banana 16:9 Initial Battle Keyframe (`assets/battles/keyframes/<id>.png`) is loaded, draw it cleanly!
    const nbKeyframe = this.getOrLoadImage(choreo.keyframeUrl);
    if (nbKeyframe) {
      this._drawMediaWithArenaContrast(ctx, w, h, nbKeyframe);
      const progress = Math.min(1, Math.max(0.02, videoElapsed / vidDur));
      this.drawCinemaCinemaOverlay(ctx, w, h, titleText, progress, phaseTag);
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
   * Draws the 16:9 Veo video or keyframe with balanced alpha (`0.78` default) over a deep cinema
   * obsidian backing plus a soft lower-arena radial contrast cushion so the 3D protagonists in front
   * stand out with 100% silhouette readability while the Veo movie fills the screen behind them!
   */
  _drawMediaWithArenaContrast(ctx, w, h, mediaSource) {
    ctx.save();
    ctx.fillStyle = '#060812';
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = this.getCombatVideoAlpha();
    ctx.drawImage(mediaSource, 0, 0, w, h);
    ctx.globalAlpha = 1.0;

    // Soft radial contrast cushion in the lower-center foreground zone where the 2 3D fighters clash
    const arenaGrad = ctx.createRadialGradient(w * 0.5, h * 0.69, 40, w * 0.5, h * 0.69, 390);
    arenaGrad.addColorStop(0, 'rgba(6, 9, 20, 0.34)');
    arenaGrad.addColorStop(0.65, 'rgba(6, 9, 20, 0.14)');
    arenaGrad.addColorStop(1, 'rgba(6, 9, 20, 0.0)');
    ctx.fillStyle = arenaGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /**
   * Draws a completely text-free Maxischermo frame on the 1280x720 (16:9) screen:
   * Zero header text or titles covering the movie — only a discreet 3px `#D32F2F` progress hairline at the bottom edge.
   */
  drawCinemaCinemaOverlay(ctx, w, h, _titleText, progress = 0.35, _phaseTag = '') {
    ctx.save();

    // Discreet 3px Cinema Red playback scrubber hairline along the bottom edge
    const barY = h - 5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(16, barY, w - 32, 3);

    const progW = Math.max(12, Math.min(w - 32, (w - 32) * progress));
    ctx.fillStyle = '#D32F2F';
    ctx.fillRect(16, barY, progW, 3);

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
    if (this.mode === 'battle' || this.outroBattle) {
      this.battleElapsed += dt;
      const prePadS = this.getPrePaddingS();
      // Release the 8.0s Veo video right at the end of the 1.0s pre-padding intro window!
      if (this.videoWaitingPrePadding && this.battleElapsed >= prePadS) {
        this.videoWaitingPrePadding = false;
        if (this.videoEl && this.videoEl.paused) {
          try {
            const p = this.videoEl.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch {
            // Ignore play errors in headless environments
          }
        }
      } else if (!this.videoWaitingPrePadding && this.usingVideoTexture && this.videoEl) {
        const vidDur = this.videoEl.duration > 0 ? this.videoEl.duration : 8.0;
        const targetVideoTime = Math.max(0, Math.min(vidDur - 0.04, this.battleElapsed - prePadS));
        if (this.battleElapsed >= prePadS + vidDur) {
          if (!this.videoEl.paused) {
            try {
              this.videoEl.pause();
            } catch {
              // Ignore pause errors
            }
          }
        } else if (Math.abs((this.videoEl.currentTime || 0) - targetVideoTime) > 0.45) {
          try {
            this.videoEl.currentTime = targetVideoTime;
          } catch {
            // Ignore seek errors
          }
        }
      }
    }

    const isExpanded = this.mode === 'battle' || this.mode === 'checkmate';
    if (!this.root?.userData?.vfxControlled) {
      const targetPos = isExpanded ? this.battlePos : this.idlePos;
      const targetScale = isExpanded ? this.battleScale : this.idleScale;
      const lerpAlpha = Math.min(1, dt * 6.5);

      this.root.position.lerp(targetPos, lerpAlpha);
      const nextScale = this.root.scale.x + (targetScale - this.root.scale.x) * lerpAlpha;
      this.root.scale.setScalar(nextScale);
    }

    // Pulse backlight halo in proportion to cinemaBlend
    const b = this.cinemaBlend;
    if (this.haloMaterial) {
      const idleHalo = 0.14 + Math.sin(this.time * 2.2) * 0.04;
      const battleHalo = 0.36 + Math.sin(this.time * 8.0) * 0.12;
      this.haloMaterial.opacity = idleHalo + (battleHalo - idleHalo) * b;
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
