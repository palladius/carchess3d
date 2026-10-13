/**
 * @fileoverview Bilingual Kid-Friendly HUD & Modal Listener (`HudListener`).
 *
 * Follows Niccolò Game Design Rule #5: **Listeners, Not Callers** —
 * subscribes to `GameEventBus` facts (`FLOW_STATE_CHANGED`, `BOARD_RESET`,
 * `PIECE_SELECTED`, `MOVE_EXECUTED`, `CHECK_DETECTED`, `CHECKMATE`, `DRAW`,
 * `PROMOTION_PENDING`, `LUCK_CHANGED`, `DROP_SPAWNED`, `LUCK_RESET`,
 * `BATTLE_STARTED`, `BATTLE_COMPLETED`, `BATTLE_SKIPPED`, `HINT_SUGGESTED`,
 * `LANGUAGE_CHANGED`, `PROFILE_CHANGED`) and renders the sleek dark
 * obsidian-and-gold Wizard Chess overlay while keeping the center 3D viewport
 * completely unobstructed.
 *
 * Headless-safe: when `typeof document === 'undefined'`, tracks state in memory
 * for deterministic Node unit tests.
 */

import {
  CHARACTER_REGISTRY,
  VOICE_LINES,
  BATTLE_MATRIX,
  FAMILY_ROSTERS,
  resolveFamilyMatchup,
  FAMILY_STICKERS,
  PROFILES,
  I18N,
  APP_VERSION,
  GITHUB_REPO_URL,
  GITHUB_NEW_ISSUE_URL,
  isMobilePhoneViewport,
  isPortraitOrientation,
} from '../core/Registry.js';
import { BATTLE_MATRIX_36 } from '../core/BattleMatrix36.js';

const PIECE_ORDER = ['k', 'q', 'b', 'n', 'r', 'p'];

const WEAPON_LABELS_IT = {
  k: '⚡ Scettro Reale & Trono d’Oro',
  q: '🍫 Bacchetta Ciocco-Onda Lilla',
  b: '🐉 Draghetto & Cristallo Ametista',
  n: '🏎️ Pista Loop Turbo & Destriero',
  r: '💜 Guantoni Puffosi & Panciata',
  p: '🐟 Alabarda Svizzera & Pesce',
};

const WEAPON_LABELS_EN = {
  k: '⚡ Royal Sceptre & Golden Throne',
  q: '🍫 Lilac Choco-Wave Wand',
  b: '🐉 Shoulder Dragon & Amethyst Crystal',
  n: '🏎️ Turbo Loop-Track & Steed',
  r: '💜 Plushie Boxing Gloves & Belly Bounce',
  p: '🐟 Swiss-Guard Halberd & Fish Slap',
};

const COUNTER_LABELS_IT = {
  k: '⚡ Lampo Reale di Scettro (ZAP!)',
  q: '🛡️ Scudo Ciocco-Vortice Lilla (SWIRL!)',
  b: '🔥 Soffio Difensivo del Draghetto (FIAMMA!)',
  n: '🐴 Impennata e Doppio Calcio (IMPENNATA!)',
  r: '💜 Rimbalzo Pancia Gommoso (BOING!)',
  p: '⚔️ Parata d’Alabarda & Slap (PARATA!)',
};

const COUNTER_LABELS_EN = {
  k: '⚡ Royal Sceptre Lightning (ZAP!)',
  q: '🛡️ Lilac Choco-Vortex Shield (SWIRL!)',
  b: '🔥 Defensive Dragon Fire Breath (FLAME!)',
  n: '🐴 Rear-Up & Double Hoof Kick (REAR-UP!)',
  r: '💜 Squishy Plush Belly Rebound (BOING!)',
  p: '⚔️ Halberd Parry & Fish Slap (PARRY!)',
};

export class HudListener {
  /**
   * @param {object} [ctx]
   */
  constructor(ctx = null) {
    this.ctx = ctx;
    let initialLang = ctx?.lang === 'it' ? 'it' : 'en';
    if (typeof window !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const urlLang = new URLSearchParams(window.location.search).get('lang');
      if (urlLang === 'it' || urlLang === 'en') {
        initialLang = urlLang;
      }
    }
    /** @type {'it'|'en'} */
    this.lang = initialLang;
    this.isMobilePhone =
      typeof ctx?.isMobilePhone === 'boolean' ? ctx.isMobilePhone : isMobilePhoneViewport();
    this.portraitDismissed = false;
    this.mobileQuickMode = 'easy'; // 'easy' | 'medium' | 'hotseat'
    this.mobileAdvancedOpen = false;
    this.mobileAwaitingFirstAttack3D = this.isMobilePhone;
    this.justUnlockedMobile3D = false;

    this.activeProfile = this.isMobilePhone ? 'ospite' : 'ale';
    this.opponentMode = 'easy';
    this.whiteFamily = 'carlesso';
    this.rivalSet = 'classic';
    this.whitePlayerType = 'human';
    this.blackPlayerType = 'ai';
    this.whiteDifficulty = 'easy';
    this.blackDifficulty = 'easy';
    this.topbarVisible = !this.isMobilePhone;
    this.setupModalOpen = false;
    this.quakeConsoleOpen = false;
    this.quakeLogs = [];
    this.flowState = 'Mode1_Chess';
    this.turn = 'w';
    this.inCheck = false;
    this.luck = { w: 0, b: 0, max: 12 };
    this.unlockedStickers = new Set();
    this.lastToast = null;
    this.lastVoiceQuote = null;
    this.activeBanner = null;
    this.pendingPromotion = null;
    this.wowSubMode = 'inspector';
    this.wowChar = 'b';
    this.wowBishopVariant = 'rigged';
    this.wowCardSide = 'front';
    this.wowAutoRotate = true;
    this.wowAttacker = 'b';
    this.wowDefender = 'n';
    this.wowGoldenCrit = false;
    this.matrixFamily = 'carlesso';
    this.matrixSelectedAtk = 'n';
    this.matrixSelectedDef = 'b';
    this.topDownCamera = this.isMobilePhone;
    this.musicPlaying = false;
    this.sfxEnabled = true;
    this.skeletonsVisible = false;
    this.matrixModalOpen = false;
    this.matrixSelectedPair = { atk: 'b', def: 'n' };
    this.matrixMarathonTimer = null;
    this.matrixMarathonIndex = 0;
    this.battleMatrix36 = BATTLE_MATRIX_36 || null;

    this.appVersion = APP_VERSION.startsWith('v') ? APP_VERSION : `v${APP_VERSION}`;

    this.rootEl = null;
    this.els = {};
    this.toastTimer = null;
    this.checkmateModalTimer = null;
    this.offs = [];
    this.battleStartedAtMs = 0;
    this.combatPointerStart = null;
    this.combatBlend = 0;

    this._boundKeyDown = (e) => this.onKeyDown(e);
    this._boundCombatPointerDown = (e) => this.onCombatPointerDown(e);
    this._boundCombatPointerUp = (e) => this.onCombatPointerUp(e);
    this._boundViewportChange = () => this.syncMobileOrientationUi();

    if (ctx) {
      this.init(ctx);
    }
  }

  /**
   * @param {object} ctx
   */
  init(ctx = {}) {
    this.ctx = ctx;
    if (ctx.scene?.userData) {
      ctx.scene.userData.applyHudCombatBlend = (b) => this.setCombatBlend(b);
    }
    if (typeof ctx.isMobilePhone === 'boolean' && ctx.isMobilePhone !== this.isMobilePhone) {
      this.isMobilePhone = ctx.isMobilePhone;
      if (this.isMobilePhone) {
        this.activeProfile = 'ospite';
        this.topDownCamera = true;
        this.mobileAwaitingFirstAttack3D = true;
        this.topbarVisible = false;
      }
    }
    const bus = ctx.bus;

    if (typeof document !== 'undefined' && !this.rootEl) {
      this.buildDom();
      window.addEventListener('keydown', this._boundKeyDown);
      window.addEventListener('pointerdown', this._boundCombatPointerDown);
      window.addEventListener('pointerup', this._boundCombatPointerUp);
      window.addEventListener('resize', this._boundViewportChange);
      window.addEventListener('orientationchange', this._boundViewportChange);
      this.syncMobileOrientationUi();
    }

    if (this.isMobilePhone) {
      this.applyMobileCameraMode('top', { silent: true });
    }

    if (typeof fetch === 'function') {
      fetch('./VERSION', { cache: 'no-store' })
        .then((r) => (r.ok ? r.text() : null))
        .then((txt) => {
          if (txt && txt.trim()) {
            this.handleRemoteVersionCheck(txt.trim());
          }
        })
        .catch(() => {});
    }

    if (bus && this.offs.length === 0) {
      this.offs.push(
        bus.on('FLOW_STATE_CHANGED', (e) => this.onFlowStateChanged(e)),
        bus.on('BOARD_RESET', (e) => this.onBoardReset(e)),
        bus.on('PIECE_HOVERED', (e) => this.onPieceHovered(e)),
        bus.on('PIECE_SELECTED', (e) => this.onPieceSelected(e)),
        bus.on('VOICE_LINE_SPOKEN', (e) => this.onVoiceLineSpoken(e)),
        bus.on('CAPTURE_PREVIEW_HOVER', (e) => this.onCapturePreviewHover(e)),
        bus.on('MOVE_EXECUTED', (e) => this.onMoveExecuted(e)),
        bus.on('CHECK_DETECTED', (e) => this.onCheckDetected(e)),
        bus.on('CHECKMATE', (e) => this.onCheckmate(e)),
        bus.on('DRAW', (e) => this.onDraw(e)),
        bus.on('PROMOTION_PENDING', (e) => this.onPromotionPending(e)),
        bus.on('LUCK_CHANGED', (e) => this.onLuckChanged(e)),
        bus.on('DROP_SPAWNED', (e) => this.onDropSpawned(e)),
        bus.on('LUCK_RESET', (e) => this.onLuckReset(e)),
        bus.on('BATTLE_STARTED', (e) => this.onBattleStarted(e)),
        bus.on('BATTLE_COMPLETED', () => this.onBattleEnded()),
        bus.on('BATTLE_SKIPPED', () => this.onBattleEnded()),
        bus.on('HINT_SUGGESTED', (e) => this.onHintSuggested(e)),
        bus.on('LANGUAGE_CHANGED', (e) => this.onLanguageChanged(e)),
        bus.on('PROFILE_CHANGED', (e) => this.onProfileChanged(e)),
        bus.on('PROFILE_RESTORED', (e) => this.onProfileRestored(e)),
        bus.on('LYRIA_CAPTION', (e) => this.onLyriaCaption(e)),
        bus.on('TOGGLE_SKELETONS', (e) => this.onSkeletonsToggled(e)),
        bus.on('PIECE_SET_CHANGED', (e) => this.onPieceSetChanged(e)),
        bus.on('AI_THINKING', (e) => this.onAiThinking(e)),
        bus.on('AI_MOVE_READY', (e) => this.onAiMoveReady(e)),
      );
    }

    if (typeof window !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const skipSetup = params.has('nosetup') || params.has('skipsetup') || params.get('mode') === 'wow';
      if (!skipSetup && !this._hasAutoOpenedSetup) {
        this._hasAutoOpenedSetup = true;
        setTimeout(() => this.openSetupModal(), 350);
      }
    }
  }

  /**
   * Zero-Split-Brain Version Drift Detector:
   * - `this.appVersion` ALWAYS reflects `APP_VERSION` from `Registry.js` (the actual JS code in memory).
   * - If `./VERSION` fetched with `{ cache: 'no-store' }` differs from `this.appVersion`, we know
   *   a newer version was deployed while stale JS was cached. We never fake the badge; instead we
   *   purge old SW caches and auto-reload once per version (guarded by `sessionStorage`), and mark
   *   `#hud-version-tag` as `${this.appVersion} ➔ 🔄 ${remoteTag}`.
   * @param {string} remoteRaw
   */
  handleRemoteVersionCheck(remoteRaw) {
    const clean = String(remoteRaw || '').trim();
    if (!clean) return false;
    const remoteTag = clean.startsWith('v') ? clean : `v${clean}`;
    if (remoteTag === this.appVersion) {
      this.remoteAvailableVersion = null;
      return false;
    }

    this.remoteAvailableVersion = remoteTag;
    const el = this.rootEl?.querySelector?.('#hud-version-tag');
    if (el) {
      el.textContent = `${this.appVersion} ➔ 🔄 ${remoteTag}`;
      el.style.cursor = 'pointer';
      el.style.borderColor = '#ffd54f';
      el.title = `Running JS ${this.appVersion} — Click to update to ${remoteTag}`;
      el.onclick = () => this._purgeCachesAndReload(remoteTag);
    }
    const refreshBtn = this.rootEl?.querySelector?.('#hud-refresh-btn');
    if (refreshBtn) {
      refreshBtn.classList.add('has-update');
      refreshBtn.title = `Update available: ${this.appVersion} → ${remoteTag}`;
    }

    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      try {
        const key = 'carchess3d_autoreload_ver';
        if (sessionStorage.getItem(key) !== remoteTag) {
          sessionStorage.setItem(key, remoteTag);
          this._purgeCachesAndReload(remoteTag);
        }
      } catch {
        // Ignore sessionStorage restrictions in private/sandboxed frames
      }
    }
    return true;
  }

  checkAndRefreshVersion() {
    this.showToast(
      this.lang === 'it'
        ? `🔄 Aggiornamento app e pulizia cache (${this.appVersion})...`
        : `🔄 Checking update & refreshing cache (${this.appVersion})...`,
      2200,
    );
    if (typeof fetch === 'function') {
      fetch('./VERSION', { cache: 'no-store' })
        .then((r) => (r.ok ? r.text() : null))
        .then((txt) => {
          if (txt && txt.trim()) {
            this.handleRemoteVersionCheck(txt.trim());
          }
        })
        .catch(() => {})
        .finally(() => {
          this._purgeCachesAndReload(this.remoteAvailableVersion || this.appVersion);
        });
    } else {
      this._purgeCachesAndReload(this.appVersion);
    }
  }

  _purgeCachesAndReload(targetTag = '') {
    const reloadNow = () => {
      if (typeof window !== 'undefined' && window.location?.reload) {
        window.location.reload();
      }
    };
    const tasks = [];
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistration) {
      tasks.push(
        navigator.serviceWorker
          .getRegistration()
          .then((reg) => reg?.update?.())
          .catch(() => {}),
      );
    }
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      tasks.push(
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {}),
      );
    }
    if (tasks.length > 0) {
      Promise.allSettled(tasks).then(reloadNow);
    } else {
      reloadNow();
    }
  }

  t(key) {
    return I18N[this.lang]?.[key] || I18N.en[key] || I18N.it[key] || key;
  }

  /**
   * Switches UI language between English ('en' 🇬🇧) and Italian ('it' 🇮🇹).
   * Keeps all audio/voice files untouched per design.
   * @param {'en'|'it'} lang
   */
  setLanguage(lang) {
    const targetLang = lang === 'it' ? 'it' : 'en';
    if (this.ctx?.bus) {
      this.ctx.bus.emit({ type: 'LANGUAGE_CHANGED', lang: targetLang });
      this.ctx.bus.flush?.();
    } else {
      this.onLanguageChanged({ lang: targetLang });
    }
  }

  /**
   * Resolves rich metadata for any of the 36 (6x6) Attacker x Defender combinations.
   * @param {string} atk
   * @param {string} def
   */
  getPairMeta36(atk = 'b', def = 'n') {
    const atkChar = CHARACTER_REGISTRY[atk] || CHARACTER_REGISTRY.b;
    const defChar = CHARACTER_REGISTRY[def] || CHARACTER_REGISTRY.n;
    const baseEntry = BATTLE_MATRIX?.[atk]?.[def] || {};
    const richEntry = this.battleMatrix36?.[atk]?.[def] || {};
    const pairCode = `${atk.toUpperCase()}×${def.toUpperCase()}`;
    const isIt = this.lang === 'it';

    let eggBadge = '';
    let eggClass = '';
    if ((atk === 'n' && def === 'r') || (atk === 'r' && def === 'n')) {
      eggBadge = isIt ? '💜 Abbraccio' : '💜 Cuddle';
      eggClass = 'cuddle';
    } else if ((atk === 'k' && def === 'q') || (atk === 'q' && def === 'k')) {
      eggBadge = isIt ? "🚽 Trono d'Oro" : '🚽 Golden Throne';
      eggClass = 'throne';
    } else if ((atk === 'b' && def === 'n') || (atk === 'n' && def === 'b')) {
      eggBadge = '🐉 vs 🏎️';
      eggClass = 'rivals';
    } else if (atk === def) {
      eggBadge = isIt ? '🪞 Specchio' : '🪞 Mirror';
      eggClass = 'mirror';
    }

    const titleText =
      richEntry.title?.[this.lang] ||
      richEntry.title?.en ||
      richEntry.title?.it ||
      `${atkChar.glyph} ${atkChar.name} vs ${defChar.glyph} ${defChar.name}`;
    const bannerText =
      richEntry.banner?.[this.lang] ||
      richEntry.banner?.en ||
      richEntry.banner?.it ||
      baseEntry.banner?.[this.lang] ||
      baseEntry.banner?.en ||
      baseEntry.banner?.it ||
      `${atkChar.name.toUpperCase()} vs ${defChar.name.toUpperCase()}! ✨`;
    const weaponMap = isIt ? WEAPON_LABELS_IT : WEAPON_LABELS_EN;
    const counterMap = isIt ? COUNTER_LABELS_IT : COUNTER_LABELS_EN;
    const counterText =
      richEntry.defenderCounter?.[this.lang] ||
      counterMap[def] ||
      (isIt ? 'Contrattacco Eroico!' : 'Heroic Counterattack!');

    return {
      id: `${atk}_x_${def}`,
      atk,
      def,
      pairCode,
      atkChar,
      defChar,
      titleText,
      bannerText,
      weaponText: weaponMap[atk] || atkChar.signatureId,
      counterText,
      eggBadge,
      eggClass,
      videoUrl: `assets/battles/videos/${atk}_x_${def}.mp4`,
      webmUrl: `assets/battles/videos/${atk}_x_${def}.webm`,
    };
  }

  // ===========================================================================
  // 1. DOM OVERLAY CONSTRUCTION (Dark Obsidian & Gold Wizard Chess Theme)
  // ===========================================================================

  buildDom() {
    const existing = document.getElementById('carchess-hud-root');
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = 'carchess-hud-styles';
    style.textContent = `
      #carchess-hud-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: #f5efe0;
        z-index: 800;
        user-select: none;
      }
      #carchess-hud-root button,
      #carchess-hud-root select,
      #carchess-hud-root input,
      #carchess-hud-root textarea,
      #carchess-hud-root .hud-interactive {
        pointer-events: auto;
      }
      .hud-glass {
        background: rgba(14, 18, 27, 0.78);
        border: 1.5px solid rgba(255, 213, 79, 0.55);
        box-shadow: 0 6px 22px rgba(0, 0, 0, 0.50), inset 0 1px 0 rgba(255, 236, 179, 0.15);
        backdrop-filter: blur(8px);
        border-radius: 12px;
      }
      .hud-topbar {
        position: absolute;
        top: 6px;
        left: 12px;
        right: 12px;
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 5px 12px;
        transform: translateY(0);
        opacity: 1;
        transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.28s ease;
      }
      .hud-topbar.hidden {
        transform: translateY(-130%);
        opacity: 0;
        pointer-events: none !important;
      }
      .hud-footer-brand {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #ffe082;
        text-decoration: none;
        font-weight: 800;
        font-size: 12.5px;
        padding: 4px 8px;
        border-radius: 8px;
        background: rgba(255, 213, 79, 0.12);
        border: 1px solid rgba(255, 213, 79, 0.35);
        white-space: nowrap;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .hud-footer-brand:hover {
        background: rgba(255, 213, 79, 0.22);
        border-color: #ffd54f;
      }
      .hud-footer-sub {
        font-size: 10.5px;
        color: #9be7c4;
        font-weight: 600;
      }
      .hud-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
      }
      .hud-brand-title {
        font-weight: 800;
        font-size: 14.5px;
        color: #ffe082;
        letter-spacing: 0.2px;
        text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      }
      .hud-brand-sub {
        font-size: 10.5px;
        color: #9be7c4;
        display: block;
      }
      .hud-controls-row {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: 6px;
      }
      .hud-btn {
        font: 600 11.5px/1.15 system-ui, sans-serif;
        padding: 5px 10px;
        border-radius: 9px;
        border: 1px solid rgba(255, 213, 79, 0.45);
        background: linear-gradient(180deg, #22293a 0%, #151a26 100%);
        color: #f5efe0;
        cursor: pointer;
        transition: transform 0.12s ease, border-color 0.15s ease, background 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }
      .hud-btn:hover {
        transform: translateY(-1px);
        border-color: #ffe082;
        background: linear-gradient(180deg, #2d374f 0%, #1c2333 100%);
      }
      .hud-btn.active, .hud-btn.gold {
        background: linear-gradient(180deg, #ffe082 0%, #d49b27 100%);
        color: #1a1200;
        border-color: #fff3c4;
        font-weight: 800;
      }
      .hud-btn.gold-emerald {
        background: linear-gradient(135deg, #ffd54f 0%, #00c853 100%);
        color: #0b1911;
        border: 1.5px solid #fff8e1;
        font-weight: 800;
        box-shadow: 0 0 14px rgba(0, 200, 83, 0.45);
      }
      .hud-btn.gold-emerald:hover {
        background: linear-gradient(135deg, #ffe082 0%, #00e676 100%);
        box-shadow: 0 0 20px rgba(255, 213, 79, 0.75);
      }
      .hud-select {
        font: 600 11.5px/1.15 system-ui, sans-serif;
        padding: 5px 8px;
        border-radius: 8px;
        border: 1px solid rgba(255, 213, 79, 0.45);
        background: #171d2b;
        color: #ffe082;
        cursor: pointer;
      }
      .hud-bottombar {
        position: absolute;
        bottom: 6px;
        left: 12px;
        right: 12px;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 8px;
      }
      .hud-status-card {
        padding: 6px 11px;
        min-width: 210px;
        max-width: 295px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .hud-footer-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        font-size: 10.5px;
        color: #90a4ae;
        padding-top: 4px;
        margin-top: 2px;
        border-top: 1px solid rgba(255, 255, 255, 0.10);
      }
      .hud-version-pill {
        font-weight: 700;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #cfd8dc;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.18);
        padding: 1px 6px;
        border-radius: 5px;
        font-size: 10px;
        letter-spacing: 0.3px;
      }
      .hud-footer-sep {
        color: rgba(255, 255, 255, 0.25);
      }
      .hud-footer-link {
        color: #b0bec5;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-weight: 600;
        transition: color 0.15s ease;
      }
      .hud-footer-link:hover {
        color: #fff;
        text-decoration: underline;
      }
      .hud-footer-link.hud-bug-link {
        color: #90a4ae;
      }
      .hud-footer-link.hud-bug-link:hover {
        color: #ffccbc;
      }
      .hud-turn-pill {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-weight: 700;
        font-size: 12px;
      }
      .hud-check-badge {
        display: none;
        padding: 2px 7px;
        border-radius: 999px;
        background: linear-gradient(90deg, #d50000, #ff5252);
        color: #fff;
        font-weight: 800;
        font-size: 10.5px;
        animation: hudPulse 0.8s infinite alternate;
      }
      .hud-luck-wrap {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .hud-luck-header {
        display: flex;
        justify-content: space-between;
        font-size: 10.5px;
        color: #90a4ae;
        font-weight: 600;
      }
      .hud-luck-track {
        height: 6px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.18);
        overflow: hidden;
        position: relative;
      }
      .hud-luck-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #26a69a 0%, #66bb6a 60%, #ffd54f 100%);
        transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .hud-luck-track.hot {
        border-color: #ffd600;
        animation: hudPulse 0.55s infinite alternate;
      }
      .hud-stickers-row {
        display: none;
        gap: 4px;
        flex-wrap: wrap;
        font-size: 12px;
      }
      .hud-actions-dock {
        padding: 5px 7px;
        display: flex;
        flex-wrap: nowrap;
        gap: 4px;
        align-items: center;
      }
      /* Clean Material / Angular-style Vector Icon Buttons for the Bottom Toolbar */
      .hud-actions-dock .hud-icon-btn {
        width: 34px;
        height: 34px;
        min-width: 34px;
        padding: 0 6px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(22, 28, 42, 0.86);
        color: #cfd8dc;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        cursor: pointer;
        box-shadow: none;
        font: 600 10.5px/1 system-ui, -apple-system, sans-serif;
        transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease, transform 0.1s ease;
      }
      .hud-actions-dock .hud-icon-btn.with-badge {
        width: auto;
        padding: 0 8px;
      }
      .hud-actions-dock .hud-icon-btn:hover {
        background: rgba(38, 48, 70, 0.95);
        border-color: rgba(255, 255, 255, 0.36);
        color: #ffffff;
        transform: translateY(-1px);
      }
      .hud-actions-dock .hud-icon-btn.active {
        background: rgba(255, 213, 79, 0.16);
        border-color: rgba(255, 213, 79, 0.68);
        color: #ffe082;
        font-weight: 700;
      }
      .hud-actions-dock .hud-icon-btn.has-update {
        background: rgba(0, 229, 255, 0.16);
        border-color: #00e5ff;
        color: #84ffff;
      }
      .hud-svg-icon {
        width: 18px;
        height: 18px;
        fill: currentColor;
        flex-shrink: 0;
        display: block;
      }
      .hud-icon-badge {
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.2px;
        text-transform: uppercase;
      }
      .hud-dock-sep {
        width: 1px;
        height: 18px;
        background: rgba(255, 255, 255, 0.14);
        margin: 0 2px;
        flex-shrink: 0;
      }
      .hud-lang-seg {
        display: inline-flex;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 7px;
        overflow: hidden;
        background: rgba(15, 20, 30, 0.85);
      }
      .hud-lang-seg .hud-lang-pill {
        border: none;
        border-radius: 0;
        background: transparent;
        color: #90a4ae;
        padding: 0 7px;
        height: 32px;
        font: 700 10.5px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      .hud-lang-seg .hud-lang-pill.active {
        background: rgba(255, 213, 79, 0.20);
        color: #ffe082;
      }
      /* Compact Top-Right Skip Pill (100% clear of the center 3D combat & 16:9 Cinema Backdrop!) */
      .hud-comic-banner {
        position: absolute;
        top: 52px;
        right: 14px;
        padding: 5px 12px;
        border-radius: 999px;
        background: rgba(14, 18, 27, 0.86);
        border: 1.5px solid #ffd54f;
        color: #ffe082;
        font-weight: 800;
        font-size: 12px;
        letter-spacing: 0.3px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
        display: none;
        align-items: center;
        gap: 10px;
        z-index: 860;
      }
      /* Toast & Hint Bubble */
      .hud-toast {
        position: absolute;
        top: 138px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        border-radius: 12px;
        background: rgba(20, 32, 48, 0.94);
        border: 1.5px solid #4cd9a2;
        color: #e8fff5;
        font-weight: 700;
        font-size: 13px;
        display: none;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      }
      /* Lyria Karaoke Caption Pill */
      .hud-lyria-caption {
        position: absolute;
        bottom: 92px;
        left: 50%;
        transform: translateX(-50%);
        padding: 6px 16px;
        border-radius: 999px;
        background: rgba(26, 18, 48, 0.88);
        border: 1.5px solid #ffd54f;
        color: #ffe082;
        font-weight: 700;
        font-size: 13px;
        display: none;
        box-shadow: 0 6px 20px rgba(0,0,0,0.5);
      }
      /* Mode 2 WOW Inspector & Arena Side/Bottom Drawer */
      .hud-wow-panel {
        position: absolute;
        top: 72px;
        left: 12px;
        width: 310px;
        padding: 12px;
        display: none;
        flex-direction: column;
        gap: 10px;
      }
      .hud-char-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
      }
      /* Modals (Promotion, Checkmate, FEN/PGN, 6x6 Matrix) */
      .hud-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(6, 9, 15, 0.82);
        backdrop-filter: blur(7px);
        display: none;
        place-items: center;
        z-index: 920;
      }
      .hud-modal-card {
        width: min(92vw, 500px);
        padding: 20px 22px;
        text-align: center;
      }
      /* 6x6 Battle Choreography & Video Matrix Modal */
      .hud-matrix36-card {
        width: min(97vw, 1240px);
        max-height: 94vh;
        overflow-y: auto;
        padding: 12px 14px;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .hud-matrix36-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border-bottom: 1px solid rgba(255, 213, 79, 0.35);
        padding-bottom: 8px;
      }
      .hud-matrix36-body {
        display: grid;
        grid-template-columns: 1fr 310px;
        gap: 10px;
        align-items: start;
      }
      @media (max-width: 1020px) {
        .hud-matrix36-body {
          grid-template-columns: 1fr;
        }
      }
      .hud-matrix36-table {
        display: grid;
        grid-template-columns: 98px repeat(6, minmax(112px, 1fr));
        gap: 5px;
        align-items: stretch;
      }
      .hud-matrix-colhdr, .hud-matrix-rowhdr {
        background: rgba(24, 31, 48, 0.92);
        border: 1px solid rgba(255, 213, 79, 0.42);
        border-radius: 8px;
        padding: 4px 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 800;
        color: #ffe082;
        text-align: center;
      }
      .hud-matrix-colhdr img, .hud-matrix-rowhdr img {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid #ffd54f;
      }
      .hud-matrix-cell {
        background: linear-gradient(180deg, rgba(25, 32, 48, 0.95) 0%, rgba(15, 20, 32, 0.98) 100%);
        border: 1px solid rgba(255, 213, 79, 0.34);
        border-radius: 9px;
        padding: 5px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 4px;
        transition: border-color 0.14s ease, box-shadow 0.14s ease, transform 0.12s ease;
      }
      .hud-matrix-cell:hover, .hud-matrix-cell.active {
        border-color: #00e676;
        box-shadow: 0 0 12px rgba(0, 230, 118, 0.42);
        transform: translateY(-1px);
      }
      .hud-matrix-cell-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 3px;
      }
      .hud-matrix-avatars {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .hud-matrix-avatars img {
        width: 21px;
        height: 21px;
        border-radius: 50%;
        object-fit: cover;
        border: 1.5px solid #ffd54f;
      }
      .hud-matrix-paircode {
        font-size: 10.5px;
        font-weight: 900;
        color: #ffe082;
        background: rgba(0, 0, 0, 0.45);
        padding: 1px 4px;
        border-radius: 4px;
      }
      .matrix-egg-badge {
        font-size: 9px;
        font-weight: 800;
        padding: 1px 4px;
        border-radius: 999px;
        white-space: nowrap;
      }
      .matrix-egg-badge.cuddle {
        background: rgba(171, 71, 188, 0.35);
        border: 1px solid #ce93d8;
        color: #f3e5f5;
      }
      .matrix-egg-badge.throne {
        background: rgba(255, 193, 7, 0.3);
        border: 1px solid #ffd54f;
        color: #fff8e1;
      }
      .matrix-egg-badge.rivals {
        background: rgba(255, 87, 34, 0.32);
        border: 1px solid #ff8a65;
        color: #fbe9e7;
      }
      .matrix-egg-badge.mirror {
        background: rgba(38, 166, 154, 0.3);
        border: 1px solid #80cbc4;
        color: #e0f2f1;
      }
      .hud-matrix-cell-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 3px;
      }
      .matrix-cell-btn {
        font: 700 9.5px/1.1 system-ui, sans-serif;
        padding: 4px 3px;
        border-radius: 5px;
        cursor: pointer;
        border: 1px solid rgba(255, 213, 79, 0.45);
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .matrix-cell-btn.clash {
        background: linear-gradient(180deg, #ffd54f 0%, #c88719 100%);
        color: #1a1100;
      }
      .matrix-cell-btn.video {
        background: linear-gradient(180deg, #1b3b2f 0%, #10241d 100%);
        color: #9be7c4;
        border-color: rgba(0, 230, 118, 0.5);
      }
      .hud-matrix36-preview {
        background: rgba(12, 16, 26, 0.94);
        border: 1.5px solid rgba(255, 213, 79, 0.55);
        border-radius: 12px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .hud-matrix36-preview video {
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 8px;
        background: #05070c;
        border: 1.5px solid #ffd54f;
      }
      .hud-promo-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-top: 14px;
      }
      .hud-promo-btn {
        padding: 10px;
        border-radius: 14px;
        border: 2px solid #e6b84a;
        background: #1a2130;
        color: #ffe082;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        font-weight: 800;
        font-size: 14px;
      }
      .hud-promo-btn:hover {
        background: #2b354d;
        box-shadow: 0 0 18px rgba(255, 224, 130, 0.55);
      }
      .hud-promo-btn img {
        width: 78px;
        height: 78px;
        object-fit: cover;
        border-radius: 50%;
        border: 2px solid #ffe082;
      }
      /* 6x6 Capture Matrix Explorer Modal */
      .hud-matrix-card {
        width: min(96vw, 880px);
        max-height: 90vh;
        overflow-y: auto;
        padding: 12px 14px;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .hud-matrix-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 4px;
      }
      .hud-matrix-table th {
        font-size: 11px;
        color: #ffe082;
        padding: 4px;
        text-align: center;
        background: rgba(24, 32, 48, 0.85);
        border-radius: 6px;
      }
      .hud-matrix-cell {
        width: 100%;
        padding: 5px 4px;
        border-radius: 7px;
        border: 1px solid rgba(255, 213, 79, 0.32);
        background: rgba(20, 26, 40, 0.9);
        color: #f5efe0;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        font-size: 10.5px;
        transition: transform 0.12s ease, border-color 0.12s ease;
      }
      .hud-matrix-cell:hover, .hud-matrix-cell.selected {
        border-color: #ffe082;
        background: rgba(45, 58, 86, 0.95);
        transform: translateY(-1px);
      }
      .hud-matrix-cell.dedicated-video {
        border-color: rgba(105, 240, 174, 0.75);
        background: linear-gradient(180deg, rgba(18, 52, 44, 0.9) 0%, rgba(18, 28, 42, 0.92) 100%);
      }
      .hud-matrix-badges {
        display: flex;
        gap: 3px;
        flex-wrap: wrap;
        justify-content: center;
        font-size: 9.5px;
      }
      .hud-badge-pill {
        padding: 1px 4px;
        border-radius: 4px;
        font-weight: 700;
      }
      .hud-badge-mp4 { background: #00695c; color: #a7ffeb; }
      .hud-badge-mix { background: #283593; color: #c5cae9; }
      .hud-badge-glb { background: #6a1b9a; color: #f3e5f5; }
      .hud-badge-egg { background: #ef6c00; color: #fff8e1; }
      @keyframes hudPulse {
        from { transform: scale(1); }
        to { transform: scale(1.05); }
      }
      @keyframes hudPopIn {
        from { opacity: 0; transform: translateX(-50%) scale(0.75); }
        to { opacity: 1; transform: translateX(-50%) scale(1); }
      }

      /* QUAKE CONSOLE */
      .hud-quake-console {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 290px;
        max-height: 48vh;
        background: rgba(9, 13, 22, 0.96);
        border-bottom: 3px solid #ffd54f;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.88), 0 2px 14px rgba(255, 213, 79, 0.35);
        backdrop-filter: blur(10px);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        transform: translateY(-100%);
        transition: transform 0.24s cubic-bezier(0.1, 0.9, 0.2, 1);
        user-select: text;
        font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      }
      .hud-quake-console.open {
        transform: translateY(0);
      }
      .quake-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 12px;
        background: rgba(18, 25, 40, 0.98);
        border-bottom: 1px solid rgba(255, 213, 79, 0.3);
        font-size: 11.5px;
        color: #ffe082;
        font-weight: 800;
        letter-spacing: 0.5px;
      }
      .quake-title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .quake-help-pill {
        font-size: 10px;
        color: #80cbc4;
        background: rgba(0, 230, 118, 0.12);
        padding: 1px 6px;
        border-radius: 4px;
        border: 1px solid rgba(0, 230, 118, 0.3);
      }
      .quake-btn {
        font: 700 11px system-ui, sans-serif;
        padding: 2px 8px;
        border-radius: 5px;
        background: #1e2638;
        color: #ffe082;
        border: 1px solid rgba(255, 213, 79, 0.4);
        cursor: pointer;
      }
      .quake-btn:hover {
        background: #2a354d;
        border-color: #ffd54f;
      }
      .quake-btn.gold {
        background: linear-gradient(180deg, #ffe082 0%, #d49b27 100%);
        color: #1a1200;
        border-color: #fff3c4;
      }
      .quake-body {
        flex: 1;
        overflow-y: auto;
        padding: 8px 12px;
        font-size: 12px;
        line-height: 1.4;
        display: flex;
        flex-direction: column;
        gap: 2px;
        color: #00e676;
      }
      .quake-line {
        display: flex;
        gap: 6px;
        align-items: baseline;
      }
      .quake-time {
        color: #80cbc4;
        font-size: 10.5px;
        flex-shrink: 0;
      }
      .quake-tag {
        font-weight: 800;
        font-size: 11px;
        flex-shrink: 0;
        padding: 0 4px;
        border-radius: 3px;
        background: rgba(0, 0, 0, 0.4);
      }
      .quake-tag.move { color: #ffe082; }
      .quake-tag.brawl { color: #ff9100; }
      .quake-tag.check { color: #ff5252; }
      .quake-tag.ai { color: #40c4ff; }
      .quake-tag.luck { color: #b9f6ca; }
      .quake-tag.sys { color: #ce93d8; }
      .quake-tag.cmd { color: #81d4fa; }
      .quake-msg {
        color: #f1f8e9;
      }
      .quake-prompt-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        background: rgba(14, 19, 30, 0.98);
        border-top: 1px solid rgba(255, 213, 79, 0.25);
      }
      .quake-prompt-symbol {
        color: #ffd54f;
        font-weight: 900;
        font-size: 13.5px;
      }
      .quake-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #00e676;
        font-family: inherit;
        font-size: 12px;
      }

      /* SETUP MODAL */
      .hud-setup-card {
        width: min(94vw, 680px);
        max-height: 92vh;
        overflow-y: auto;
        padding: 18px 22px;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .hud-setup-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1.5px solid rgba(255, 213, 79, 0.35);
        padding-bottom: 10px;
      }
      .hud-setup-sides {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      @media (max-width: 600px) {
        .hud-setup-sides {
          grid-template-columns: 1fr;
        }
      }
      .hud-side-box {
        background: rgba(20, 27, 42, 0.88);
        border: 1.5px solid rgba(255, 213, 79, 0.4);
        border-radius: 12px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .hud-side-box.white-side {
        border-color: rgba(255, 224, 130, 0.8);
        box-shadow: inset 0 0 16px rgba(255, 213, 79, 0.12);
      }
      .hud-side-box.black-side {
        border-color: rgba(144, 164, 174, 0.7);
        box-shadow: inset 0 0 16px rgba(120, 144, 156, 0.12);
      }
      .hud-side-title {
        font-size: 13.5px;
        font-weight: 800;
        color: #ffe082;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .hud-setup-label {
        font-size: 11.5px;
        color: #b0bec5;
        font-weight: 700;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .hud-setup-radio-group {
        display: flex;
        gap: 10px;
        align-items: center;
        background: rgba(0, 0, 0, 0.35);
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255, 213, 79, 0.25);
      }
      .hud-setup-radio-label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #eceff1;
        cursor: pointer;
        font-weight: 600;
      }
      .hud-setup-badge {
        font-size: 11.5px;
        color: #b9f6ca;
        background: rgba(0, 200, 83, 0.15);
        border: 1px solid rgba(0, 200, 83, 0.4);
        border-radius: 8px;
        padding: 6px 10px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* MOBILE SIMPLIFIED UX ("Easy Adopter" mode — phones only, iPad/Desktop untouched) */
      .hud-modal-backdrop, .hud-setup-card, .hud-matrix36-card, .hud-matrix-card {
        touch-action: pan-y;
        -webkit-overflow-scrolling: touch;
      }
      .hud-rotate-overlay {
        position: fixed;
        inset: 0;
        z-index: 980;
        background: radial-gradient(circle at 50% 35%, rgba(28, 38, 62, 0.96), rgba(7, 10, 18, 0.98));
        backdrop-filter: blur(10px);
        display: none;
        place-items: center;
        padding: 20px;
        text-align: center;
      }
      .hud-rotate-card {
        max-width: 360px;
        padding: 22px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .hud-rotate-icon {
        font-size: 46px;
        line-height: 1;
        animation: hudPulse 0.9s infinite alternate;
      }
      .hud-mobile-quick-setup {
        display: none;
        flex-direction: column;
        gap: 10px;
      }
      .hud-mobile-matchup-pill {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        background: rgba(16, 23, 38, 0.92);
        border: 1.5px solid rgba(255, 213, 79, 0.55);
        border-radius: 12px;
        padding: 10px 12px;
      }
      .hud-mobile-team-col {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 12px;
      }
      .hud-mobile-diff-pills {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .hud-mobile-diff-btn {
        padding: 9px 6px;
        font-size: 12.5px;
        justify-content: center;
      }
      .hud-mobile-play-cta {
        width: 100%;
        padding: 13px 16px;
        font-size: 16px;
        font-weight: 900;
        justify-content: center;
        border-radius: 12px;
      }
      #carchess-hud-root.mobile-simplified #hud-topbar {
        display: none !important;
      }
      #carchess-hud-root.mobile-simplified .hud-bottombar {
        bottom: 4px;
        left: 6px;
        right: 6px;
        flex-wrap: nowrap;
        align-items: center;
        gap: 6px;
      }
      #carchess-hud-root.mobile-simplified .hud-status-card {
        flex-shrink: 0;
        min-width: auto;
        max-width: 195px;
        padding: 4px 9px;
        flex-direction: row;
        align-items: center;
        gap: 6px;
      }
      #carchess-hud-root.mobile-simplified .hud-luck-wrap,
      #carchess-hud-root.mobile-simplified .hud-stickers-row,
      #carchess-hud-root.mobile-simplified .hud-footer-meta .hud-footer-sep,
      #carchess-hud-root.mobile-simplified .hud-footer-meta .hud-footer-link {
        display: none !important;
      }
      #carchess-hud-root.mobile-simplified .hud-footer-meta {
        border-top: none;
        padding-top: 0;
        margin-top: 0;
      }
      #carchess-hud-root.mobile-simplified .hud-actions-dock {
        padding: 4px 6px;
        gap: 4px;
        flex-wrap: nowrap;
        min-width: 0;
        overflow-x: auto;
        scrollbar-width: none;
      }
      #carchess-hud-root.mobile-simplified .hud-actions-dock .hud-icon-btn {
        width: 34px;
        height: 34px;
        min-width: 34px;
        flex-shrink: 0;
      }
      #carchess-hud-root.mobile-simplified .hud-actions-dock .hud-icon-btn.with-badge {
        width: auto;
        padding: 0 7px;
      }
      #carchess-hud-root.mobile-simplified #hud-dock-gallery,
      #carchess-hud-root.mobile-simplified #hud-dock-videos,
      #carchess-hud-root.mobile-simplified #hud-console-btn,
      #carchess-hud-root.mobile-simplified #hud-skeletons-btn,
      #carchess-hud-root.mobile-simplified #hud-swamp-btn,
      #carchess-hud-root.mobile-simplified #hud-flip-btn,
      #carchess-hud-root.mobile-simplified #hud-zoom-in-btn,
      #carchess-hud-root.mobile-simplified #hud-zoom-out-btn,
      #carchess-hud-root.mobile-simplified #hud-trackpad-btn,
      #carchess-hud-root.mobile-simplified #hud-fen-btn,
      #carchess-hud-root.mobile-simplified #hud-toggle-topbar-btn,
      #carchess-hud-root.mobile-simplified .hud-dock-sep {
        display: none !important;
      }
      @media (max-width: 500px) {
        #carchess-hud-root.mobile-simplified .hud-status-card #hud-turn-text {
          display: none !important;
        }
      }
      #carchess-hud-root.mobile-simplified .hud-setup-card {
        width: min(95vw, 480px);
        max-height: 92dvh;
        padding: 12px 14px;
        gap: 9px;
      }
      #carchess-hud-root.mobile-simplified .hud-mobile-quick-setup {
        display: flex;
      }
      #carchess-hud-root.mobile-simplified .hud-desktop-setup-only {
        display: none;
      }
      #carchess-hud-root.mobile-simplified.mobile-advanced-open .hud-desktop-setup-only {
        display: flex;
      }
      #carchess-hud-root.mobile-simplified.mobile-advanced-open .hud-setup-sides.hud-desktop-setup-only {
        display: grid;
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'carchess-hud-root';
    if (this.isMobilePhone) {
      root.classList.add('mobile-simplified');
    }
    root.innerHTML = `
      <!-- MOBILE PORTRAIT -> LANDSCAPE FRIENDLY PROMPT -->
      <div id="hud-rotate-overlay" class="hud-rotate-overlay hud-interactive">
        <div class="hud-rotate-card hud-glass">
          <div class="hud-rotate-icon">📱🔄</div>
          <h2 id="hud-rotate-title" style="margin:0;color:#ffe082;font-size:19px;">${this.t('rotateTitle')}</h2>
          <p id="hud-rotate-sub" style="margin:0;color:#d6e4f0;font-size:13px;line-height:1.4;">${this.t('rotateSub')}</p>
          <button type="button" id="hud-rotate-dismiss-btn" class="hud-btn gold" style="padding:9px 14px;font-size:12.5px;margin-top:4px;">
            ${this.t('rotateDismissBtn')}
          </button>
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px;font-size:11px;color:#9be7c4;">
            <span class="hud-version-pill">⚡ ${this.appVersion}</span>
            <a href="./nocache.html" style="color:#ffd54f;text-decoration:underline;font-weight:700;">🧹 Force No-Cache Reload</a>
          </div>
        </div>
      </div>

      <!-- QUAKE CONSOLE DROPDOWN (Toggle with ~ or \\ or §) -->
      <aside id="hud-quake-console" class="hud-quake-console hud-interactive" aria-label="Console Quake">
        <div class="quake-header">
          <div class="quake-title-wrap">
            <span style="color:#ffd54f;">~</span>
            <strong>CARCHESS3D QUAKE CONSOLE</strong>
            <span class="quake-help-pill">[~] / [\\] / [ESC]</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button id="quake-clear-btn" class="quake-btn" title="Pulisci log">🗑️ Pulisci</button>
            <button id="quake-close-btn" class="quake-btn" title="Chiudi console">✕</button>
          </div>
        </div>
        <div id="quake-log-body" class="quake-body"></div>
        <form id="quake-form" class="quake-prompt-row">
          <span class="quake-prompt-symbol">&gt;</span>
          <input id="quake-input" class="quake-input" type="text" placeholder="help, fen, pgn, hint, setup, reset, topbar, clear, close..." autocomplete="off" spellcheck="false">
          <button type="submit" class="quake-btn gold">Invia</button>
        </form>
      </aside>

      <!-- TOP BAR (Togglable for max screen space) -->
      <header id="hud-topbar" class="hud-topbar hud-glass hud-interactive">
        <div class="hud-brand">
          <span style="font-size:24px;">🏰🚽</span>
          <div>
            <span id="hud-title" class="hud-brand-title">${this.t('title')}</span>
            <span id="hud-subtitle" class="hud-brand-sub">${this.t('subtitle')}</span>
          </div>
        </div>

        <div class="hud-controls-row">
          <button id="hud-mode1-btn" class="hud-btn active">${this.t('mode1Btn')}</button>
          <button id="hud-mode2-btn" class="hud-btn">${this.t('mode2Btn')}</button>
          <button id="hud-matrix-btn" class="hud-btn gold" title="6×6 Battle Matrix & Videos">${this.t('matrixBtn')}</button>

          <label style="font-size:11px;color:#b0bac9;margin-left:4px;" id="hud-who-label">${this.t('whoPlays')}</label>
          <select id="hud-profile-select" class="hud-select" aria-label="Who plays">
            ${PROFILES.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>

          <select id="hud-opponent-select" class="hud-select" aria-label="Opponent">
            <option value="hotseat">${this.t('hotseat')}</option>
            <option value="easy" selected>${this.t('cpuEasy')}</option>
            <option value="medium">${this.t('cpuMed')}</option>
            <option value="hard">${this.t('cpuHard')}</option>
          </select>

          <select id="hud-white-select" class="hud-select" aria-label="White Set" title="White Family (South)">
            <option value="carlesso" selected>${this.t('setWhiteCarlesso')}</option>
            <option value="swamp">${this.t('setWhiteSwamp')}</option>
            <option value="classic">${this.t('setWhiteClassic')}</option>
          </select>

          <select id="hud-rival-select" class="hud-select" aria-label="Black Set" title="Black Family (North)">
            <option value="classic" selected>${this.t('setClassic')}</option>
            <option value="family">${this.t('setFamily')}</option>
            <option value="swamp">${this.t('setSwamp')}</option>
            <option value="stone">${this.t('setStone')}</option>
          </select>

          <a id="hud-top-gallery-link" href="showcase/" class="hud-btn" style="text-decoration:none;" title="Open 3D Gallery of all 18 Pieces">${this.t('galleryBtn')}</a>

          <div id="hud-lang-btn" style="display:inline-flex;gap:4px;align-items:center;" role="group" aria-label="Language / Lingua">
            <button type="button" id="hud-top-flag-en" class="hud-btn ${this.lang === 'en' ? 'active' : ''}" data-set-lang="en" title="English 🇬🇧">🇬🇧 EN</button>
            <button type="button" id="hud-top-flag-it" class="hud-btn ${this.lang === 'it' ? 'active' : ''}" data-set-lang="it" title="Italiano 🇮🇹">🇮🇹 IT</button>
          </div>
        </div>
      </header>

      <!-- COMIC IMPACT BANNER & SKIP BUTTON -->
      <div id="hud-comic-banner" class="hud-comic-banner hud-interactive">
        <span id="hud-comic-text">STECCHITO! ✨</span>
        <button id="hud-skip-btn" class="hud-btn gold">${this.t('skipBtn')}</button>
      </div>

      <!-- HINT & STICKER TOAST -->
      <div id="hud-toast" class="hud-toast"></div>

      <!-- LYRIA THEME KARAOKE CAPTION -->
      <div id="hud-lyria-caption" class="hud-lyria-caption"></div>

      <!-- MODE 2: 3D WOW MODE & BATTLE CINEMA CONTROL PANEL -->
      <aside id="hud-wow-panel" class="hud-wow-panel hud-glass hud-interactive">
        <div style="display:flex;gap:6px;">
          <button id="hud-wow-tab-inspector" class="hud-btn active" style="flex:1;justify-content:center;">${this.t('wowInspectorTab')}</button>
          <button id="hud-wow-tab-arena" class="hud-btn" style="flex:1;justify-content:center;">${this.t('wowArenaTab')}</button>
        </div>

        <button id="hud-wow-matrix36-btn" class="hud-btn gold-emerald" style="justify-content:center;padding:7px 10px;">
          ${this.t('matrix36Btn')}
        </button>

        <!-- Sub-mode A: 360° Inspector Controls -->
        <div id="hud-wow-inspector-box" style="display:flex;flex-direction:column;gap:8px;">
          <div id="hud-wow-choose-hero" style="font-size:12px;color:#ffe082;font-weight:700;">${this.t('wowChooseHero')}</div>
          <div class="hud-char-grid">
            ${Object.values(CHARACTER_REGISTRY)
              .map(
                (c) =>
                  `<button class="hud-btn ${c.type === 'b' ? 'active' : ''}" data-wow-char="${c.type}" style="justify-content:center;">${c.glyph} ${c.name}</button>`,
              )
              .join('')}
          </div>

          <div id="hud-ale-variant-row" style="display:flex;gap:5px;">
            <button id="hud-ale-rigged-btn" class="hud-btn active" style="flex:1;justify-content:center;">🐉 Ale #2 (Dragon Rigged)</button>
            <button id="hud-ale-hat-btn" class="hud-btn" style="flex:1;justify-content:center;">🎩 Ale #1 (Hat)</button>
          </div>

          <div style="display:flex;gap:5px;">
            <button id="hud-card-flip-btn" class="hud-btn" style="flex:1;justify-content:center;">${this.t('wowCardFlipBtn')}</button>
            <button id="hud-autorotate-btn" class="hud-btn active" style="flex:1;justify-content:center;">${this.t('wowAutoRotateBtn')}</button>
          </div>

          <div id="hud-wow-anim-title" style="font-size:12px;color:#9be7c4;font-weight:700;">${this.t('wowAnimTitle')}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">
            <button class="hud-btn" data-wow-anim="Idle">✨ Idle (Wings)</button>
            <button class="hud-btn gold" data-wow-anim="Click_Fire_Breath">🔥 Fire Breath!</button>
            <button class="hud-btn" data-wow-anim="attack">⚔️ Attack</button>
            <button class="hud-btn" data-wow-anim="victory">🏆 Victory!</button>
          </div>
        </div>

        <!-- Sub-mode B: 6x6 Battle Cinema Launcher -->
        <div id="hud-wow-arena-box" style="display:none;flex-direction:column;gap:8px;">
          <div id="hud-wow-arena-title" style="font-size:12px;color:#ffe082;font-weight:700;">${this.t('wowArenaTitle')}</div>
          <label style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">
            <span id="hud-wow-atk-lbl">${this.t('wowAtkLabel')}</span>
            <select id="hud-wow-atk" class="hud-select">
              ${Object.values(CHARACTER_REGISTRY)
                .map((c) => `<option value="${c.type}" ${c.type === 'b' ? 'selected' : ''}>${c.glyph} ${c.name}</option>`)
                .join('')}
            </select>
          </label>
          <label style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">
            <span id="hud-wow-def-lbl">${this.t('wowDefLabel')}</span>
            <select id="hud-wow-def" class="hud-select">
              ${Object.values(CHARACTER_REGISTRY)
                .map((c) => `<option value="${c.type}" ${c.type === 'n' ? 'selected' : ''}>${c.glyph} ${c.name}</option>`)
                .join('')}
            </select>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#ffe082;cursor:pointer;">
            <input id="hud-wow-crit" type="checkbox">
            <span id="hud-wow-crit-lbl">${this.t('wowCritLabel')}</span>
          </label>
          <button id="hud-wow-clash-btn" class="hud-btn gold" style="justify-content:center;padding:10px;">
            ${this.t('triggerBattleBtn')}
          </button>

          <div style="font-size:11.5px;color:#9be7c4;font-weight:700;margin-top:4px;">🎬 Quick 16:9 Video Tests (Ale & Seby MP4):</div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <button class="hud-btn" data-quick-clash="b_n" style="justify-content:center;">🎬 1. Ale 🐉 vs Seby 🏎️ (Crystal MP4)</button>
            <button class="hud-btn" data-quick-clash="n_b" style="justify-content:center;">🎬 2. Seby 🏎️ vs Ale 🐉 (Turbo Track MP4)</button>
            <button class="hud-btn" data-quick-clash="n_r" style="justify-content:center;">🎬 3. Seby 🏎️ 💜 Pupurabbu (Cuddle MP4)</button>
          </div>
        </div>
      </aside>

      <!-- MODAL 0: GAME STARTUP & FACTION / PLAYER SETUP -->
      <div id="hud-setup-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-modal-card hud-setup-card hud-glass">
          <div class="hud-setup-header">
            <div>
              <div style="font-size:18px;font-weight:900;color:#ffe082;display:flex;align-items:center;gap:8px;">
                <span>🏰🚽</span>
                <span id="hud-setup-title">${this.t(this.isMobilePhone ? 'mobileQuickTitle' : 'setupTitle')}</span>
              </div>
              <span id="hud-setup-sub" style="font-size:11.5px;color:#9be7c4;display:block;margin-top:2px;">
                ${this.t(this.isMobilePhone ? 'mobileQuickSub' : 'setupSub')}
              </span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" id="hud-setup-flag-en" class="hud-btn ${this.lang === 'en' ? 'active' : ''}" data-set-lang="en" title="English 🇬🇧">🇬🇧 EN</button>
              <button type="button" id="hud-setup-flag-it" class="hud-btn ${this.lang === 'it' ? 'active' : ''}" data-set-lang="it" title="Italiano 🇮🇹">🇮🇹 IT</button>
              <button id="hud-setup-close" class="hud-btn" title="Close / Chiudi">✕</button>
            </div>
          </div>

          <!-- MOBILE SIMPLIFIED 1-TAP QUICK START ("Easy Adopter" Mode) -->
          <div id="hud-mobile-quick-setup" class="hud-mobile-quick-setup">
            <div class="hud-mobile-matchup-pill">
              <div class="hud-mobile-team-col">
                <strong id="hud-mobile-you-lbl" style="color:#ffe082;">${this.t('mobileQuickYou')}</strong>
                <span id="hud-mobile-papino-team" style="color:#b9f6ca;font-size:11px;">${this.t('mobileQuickPapinoTeam')}</span>
              </div>
              <span style="font-size:18px;font-weight:900;color:#ffd54f;">⚡ VS ⚡</span>
              <div class="hud-mobile-team-col" style="text-align:right;">
                <strong id="hud-mobile-cpu-lbl" style="color:#90caf9;">${this.t('mobileQuickCpu')}</strong>
                <span id="hud-mobile-cpu-team" style="color:#cfd8dc;font-size:11px;">${this.t('mobileQuickCpuTeam')}</span>
              </div>
            </div>

            <div class="hud-mobile-diff-pills" role="group" aria-label="Quick Mode">
              <button type="button" id="hud-mobile-diff-easy" class="hud-btn hud-mobile-diff-btn active" data-mobile-mode="easy">${this.t('mobileDiffEasy')}</button>
              <button type="button" id="hud-mobile-diff-medium" class="hud-btn hud-mobile-diff-btn" data-mobile-mode="medium">${this.t('mobileDiffMed')}</button>
              <button type="button" id="hud-mobile-diff-hotseat" class="hud-btn hud-mobile-diff-btn" data-mobile-mode="hotseat">${this.t('mobileDiff2P')}</button>
            </div>

            <button type="button" id="hud-mobile-quick-play-btn" class="hud-btn gold-emerald hud-mobile-play-cta">
              ${this.t('mobilePlayNowBtn')}
            </button>

            <div style="display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="hud-version-pill">⚡ ${this.appVersion}</span>
              <button type="button" id="hud-mobile-advanced-toggle" class="hud-btn" style="font-size:11px;padding:4px 10px;opacity:0.88;">
                ${this.t('mobileAdvOptionsBtn')}
              </button>
              <a href="./nocache.html" class="hud-btn" style="font-size:11px;padding:4px 10px;text-decoration:none;color:#ffd54f;">🧹 No-Cache</a>
            </div>
          </div>

          <div class="hud-setup-sides hud-desktop-setup-only">
            <!-- WHITE SIDE -->
            <div class="hud-side-box white-side">
              <div class="hud-side-title">
                <span>⚪</span>
                <span id="hud-setup-white-title">${this.t('whiteSide')}</span>
              </div>

              <label class="hud-setup-label">
                <span id="hud-setup-white-faction-lbl">${this.t('factionLabel')}</span>
                <select id="hud-setup-white-set" class="hud-select" style="width:100%;">
                  <option value="carlesso" selected>${this.t('setupWhiteCarlesso')}</option>
                  <option value="swamp">${this.t('setupWhiteSwamp')}</option>
                  <option value="classic">${this.t('setupWhiteClassic')}</option>
                </select>
              </label>

              <div class="hud-setup-label">
                <span id="hud-setup-white-ctrl-lbl">${this.t('controlLabel')}</span>
                <div class="hud-setup-radio-group">
                  <label class="hud-setup-radio-label">
                    <input type="radio" name="white-player-type" value="human" checked>
                    <span id="hud-setup-white-human-lbl">${this.t('playerHuman')}</span>
                  </label>
                  <label class="hud-setup-radio-label">
                    <input type="radio" name="white-player-type" value="ai">
                    <span id="hud-setup-white-ai-lbl">${this.t('playerAi')}</span>
                  </label>
                </div>
              </div>

              <label id="hud-setup-white-profile-wrap" class="hud-setup-label">
                <span id="hud-setup-profile-lbl">${this.t('profileLabel')}</span>
                <select id="hud-setup-white-profile" class="hud-select" style="width:100%;">
                  ${PROFILES.map((p) => `<option value="${p.id}" ${p.id === (this.isMobilePhone ? 'ospite' : 'ale') ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
              </label>

              <label id="hud-setup-white-ai-wrap" class="hud-setup-label" style="display:none;">
                <span id="hud-setup-white-diff-lbl">${this.t('difficultyLabel')}</span>
                <select id="hud-setup-white-diff" class="hud-select" style="width:100%;">
                  <option value="easy" selected>${this.t('cpuEasy')}</option>
                  <option value="medium">${this.t('cpuMed')}</option>
                  <option value="hard">${this.t('cpuHard')}</option>
                </select>
              </label>
            </div>

            <!-- BLACK SIDE -->
            <div class="hud-side-box black-side">
              <div class="hud-side-title">
                <span>⚫</span>
                <span id="hud-setup-black-title">${this.t('blackSide')}</span>
              </div>

              <label class="hud-setup-label">
                <span id="hud-setup-black-faction-lbl">${this.t('factionLabel')}</span>
                <select id="hud-setup-black-set" class="hud-select" style="width:100%;">
                  <option value="classic" selected>${this.t('setupBlackClassic')}</option>
                  <option value="swamp">${this.t('setupBlackSwamp')}</option>
                  <option value="family">${this.t('setupBlackFamily')}</option>
                  <option value="stone">${this.t('setupBlackStone')}</option>
                </select>
              </label>

              <div class="hud-setup-label">
                <span id="hud-setup-black-ctrl-lbl">${this.t('controlLabel')}</span>
                <div class="hud-setup-radio-group">
                  <label class="hud-setup-radio-label">
                    <input type="radio" name="black-player-type" value="ai" checked>
                    <span id="hud-setup-black-ai-lbl">${this.t('playerAi')}</span>
                  </label>
                  <label class="hud-setup-radio-label">
                    <input type="radio" name="black-player-type" value="human">
                    <span id="hud-setup-black-human-lbl">${this.t('playerHumanHotseat')}</span>
                  </label>
                </div>
              </div>

              <label id="hud-setup-black-ai-wrap" class="hud-setup-label">
                <span id="hud-setup-black-diff-lbl">${this.t('difficultyLabel')}</span>
                <select id="hud-setup-black-diff" class="hud-select" style="width:100%;">
                  <option value="easy" selected>${this.t('cpuEasy')}</option>
                  <option value="medium">${this.t('cpuMed')}</option>
                  <option value="hard">${this.t('cpuHard')}</option>
                </select>
              </label>

              <div id="hud-setup-black-human-wrap" class="hud-setup-label" style="display:none;color:#90caf9;font-size:11.5px;padding-top:4px;">
                ${this.t('hotseatDesc')}
              </div>
            </div>
          </div>

          <div class="hud-setup-badge hud-desktop-setup-only">
            <span>✨</span>
            <span id="hud-setup-badge-text">${this.t('defaultSetupBadge')}</span>
          </div>

          <div class="hud-desktop-setup-only" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;align-items:center;margin-top:4px;">
            <button id="hud-setup-apply-btn" class="hud-btn" style="padding:10px 18px;font-size:13px;" title="Update factions, players and AI in the current match without resetting board pieces">
              ${this.t('applyCurrentBtn')}
            </button>
            <button id="hud-setup-start-btn" class="hud-btn gold-emerald" style="padding:10px 22px;font-size:14px;" title="Apply settings and start a brand new match (resets all 32 pieces)">
              ${this.t('startMatchBtn')}
            </button>
          </div>
        </div>
      </div>

      <!-- BOTTOM STATUS & CLEAN MATERIAL ICON FOOTER BAR -->
      <footer class="hud-bottombar">
        <div class="hud-status-card hud-glass hud-interactive">
          <div class="hud-turn-pill">
            <span id="hud-turn-text">⚪ ${this.t('turnWhite')}</span>
            <span id="hud-check-badge" class="hud-check-badge">${this.t('checkAlert')}</span>
          </div>
          <div class="hud-luck-wrap">
            <div class="hud-luck-header">
              <span id="hud-luck-label">${this.t('luckBar')}</span>
              <span id="hud-luck-val">0 / 12 ✨</span>
            </div>
            <div id="hud-luck-track" class="hud-luck-track">
              <div id="hud-luck-fill" class="hud-luck-fill"></div>
            </div>
          </div>
          <div id="hud-stickers-row" class="hud-stickers-row" title="Unlocked Collectible Stickers"></div>
          <div class="hud-footer-meta">
            <span id="hud-version-tag" class="hud-version-pill" title="CarChess3D Running Version">${this.appVersion}</span>
            <span class="hud-footer-sep">·</span>
            <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" class="hud-footer-link" title="View source code on GitHub">
              <span>GitHub</span>
            </a>
            <span class="hud-footer-sep">·</span>
            <a href="${GITHUB_NEW_ISSUE_URL}" target="_blank" rel="noopener noreferrer" class="hud-footer-link hud-bug-link" title="Report a bug or open a new GitHub issue">
              <span>Issue</span>
            </a>
          </div>
        </div>

        <div class="hud-actions-dock hud-glass hud-interactive" role="toolbar" aria-label="Game Controls">
          <!-- Primary Match Actions: New Match, Edit Match, Check/Force Update -->
          <button type="button" id="hud-new-btn" class="hud-btn hud-icon-btn" title="${this.t('newGameBtn')}" aria-label="${this.t('newGameBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 2.97-2.17 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93 0-4.42-3.58-8-8-8zm-6 8c0-1.65.67-3.15 1.76-4.24L6.34 7.34A8.014 8.014 0 0 0 4 13c0 4.08 3.05 7.44 7 7.93v-2.02c-2.83-.48-5-2.94-5-5.91z"/></svg>
          </button>
          <button type="button" id="hud-setup-btn" class="hud-btn hud-icon-btn" title="${this.t('setupBtn')}" aria-label="${this.t('setupBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
          </button>
          <button type="button" id="hud-refresh-btn" class="hud-btn hud-icon-btn" title="Check Update / Refresh App (${this.appVersion})" aria-label="Check Update / Refresh App">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
          </button>

          <span class="hud-dock-sep"></span>

          <!-- Camera & Gameplay Assistance: 2D/3D Camera, Flip Board, Hint, 6x6 Battle Matrix -->
          <button type="button" id="hud-top-btn" class="hud-btn hud-icon-btn with-badge ${!this.topDownCamera ? 'active' : ''}" title="${this.t('topCamBtn')}" aria-label="${this.t('topCamBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.25 7.6 12.75 4.4a1.5 1.5 0 0 0-1.5 0L5.75 7.6A1.5 1.5 0 0 0 5 8.9v6.2c0 .54.29 1.03.75 1.3l5.5 3.2c.46.27 1.04.27 1.5 0l5.5-3.2c.46-.27.75-.76.75-1.3V8.9c0-.54-.29-1.03-.75-1.3zM12 6.15l4.62 2.69L12 11.53 7.38 8.84 12 6.15zm-5 4.42 4.25 2.47v4.88L7 15.45v-4.88zm6.25 7.35v-4.88L17.5 10.57v4.88l-4.25 2.47z"/></svg>
            <span id="hud-top-badge" class="hud-icon-badge">${this.topDownCamera ? '2D' : '3D'}</span>
          </button>
          <button type="button" id="hud-flip-btn" class="hud-btn hud-icon-btn" title="${this.t('flipCamBtn')}" aria-label="${this.t('flipCamBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3 5 6.99h3V14h2V6.99h3L9 3z"/></svg>
          </button>
          <button type="button" id="hud-reset-cam-btn" class="hud-btn hud-icon-btn" title="${this.t('resetCamBtn')}" aria-label="${this.t('resetCamBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
          </button>
          <button type="button" id="hud-hint-btn" class="hud-btn hud-icon-btn" title="${this.t('hintBtn')}" aria-label="${this.t('hintBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>
          </button>
          <button type="button" id="hud-matrix36-btn" class="hud-btn hud-icon-btn" title="${this.t('matrixBtn')}" aria-label="${this.t('matrixBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z"/></svg>
          </button>

          <span class="hud-dock-sep"></span>

          <!-- Audio Controls: SFX & Music -->
          <button type="button" id="hud-sfx-btn" class="hud-btn hud-icon-btn active" title="${this.t('sfxBtn')}" aria-label="${this.t('sfxBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          </button>
          <button type="button" id="hud-music-btn" class="hud-btn hud-icon-btn" title="${this.t('musicBtn')}" aria-label="${this.t('musicBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </button>

          <span class="hud-dock-sep"></span>

          <!-- Desktop Utility Icons: 3D Gallery, FEN/PGN, Quake Console, Topbar Menu -->
          <a id="hud-dock-gallery" href="./showcase/" class="hud-btn hud-icon-btn" style="text-decoration:none;" title="${this.t('galleryBtn')}" aria-label="${this.t('galleryBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11V9L12 2 2 9v2h2v9H2v2h20v-2h-2v-9h2zm-6 9H8v-9h8v9zm-4-7-2 3h4l-2-3z"/></svg>
          </a>
          <button type="button" id="hud-fen-btn" class="hud-btn hud-icon-btn" title="${this.t('fenBtn')}" aria-label="${this.t('fenBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
          </button>
          <button type="button" id="hud-console-btn" class="hud-btn hud-icon-btn" title="Quake Console (~ or \\)" aria-label="Quake Console">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/></svg>
          </button>
          <button type="button" id="hud-toggle-topbar-btn" class="hud-btn hud-icon-btn" title="${this.t('toggleTopbarBtn')}" aria-label="${this.t('toggleTopbarBtn')}">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </button>

          <!-- Clean Language Segmented Toggle (EN | IT) -->
          <div class="hud-lang-seg" role="group" aria-label="Language">
            <button type="button" id="hud-flag-en" class="hud-lang-pill ${this.lang === 'en' ? 'active' : ''}" data-set-lang="en" title="English">EN</button>
            <button type="button" id="hud-flag-it" class="hud-lang-pill ${this.lang === 'it' ? 'active' : ''}" data-set-lang="it" title="Italiano">IT</button>
          </div>

          <!-- Hidden legacy/debug action hooks (preserved for keyboard/Quake console & URL flags) -->
          <a id="hud-dock-videos" href="./battles.html" class="hud-btn" style="display:none;" title="${this.t('videosBtn')}"></a>
          <button type="button" id="hud-skeletons-btn" class="hud-btn hud-icon-btn" style="display:none;" title="${this.t('skeletonsBtn')}">🦴</button>
          <button type="button" id="hud-swamp-btn" class="hud-btn" style="display:none;" title="${this.t('swampBtn')}"></button>
          <button type="button" id="hud-zoom-in-btn" class="hud-btn" style="display:none;" title="Zoom In (+)"></button>
          <button type="button" id="hud-zoom-out-btn" class="hud-btn" style="display:none;" title="Zoom Out (-)"></button>
          <button type="button" id="hud-trackpad-btn" class="hud-btn active" style="display:none;" title="${this.t('trackpadRotateBtn')}"></button>
        </div>
      </footer>

      <!-- MODAL 1: CUTIE PAWN PROMOTION -->
      <div id="hud-promo-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-modal-card hud-glass">
          <h3 id="hud-promo-title" style="margin:0;color:#ffe082;font-size:18px;">${this.t('promoTitle')}</h3>
          <div class="hud-promo-grid">
            ${['q', 'r', 'b', 'n']
              .map((k) => {
                const c = CHARACTER_REGISTRY[k];
                return `
                  <button class="hud-promo-btn" data-promo="${k}">
                    <img src="${c.frontPortrait}" alt="${c.name}">
                    <span>${c.glyph} ${c.name}</span>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>

      <!-- MODAL 2: CHECKMATE / DRAW CELEBRATION -->
      <div id="hud-gameover-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-modal-card hud-glass">
          <h2 id="hud-gameover-title" style="margin:0 0 8px;color:#ffe082;font-size:24px;">${this.t('checkmateTitle')}</h2>
          <p id="hud-gameover-sub" style="margin:0 0 16px;color:#d6e4f0;font-size:15px;"></p>
          <button id="hud-play-again-btn" class="hud-btn gold" style="font-size:15px;padding:10px 22px;">
            ${this.t('playAgainBtn')}
          </button>
        </div>
      </div>

      <!-- MODAL 3: FEN / PGN IMPORT-EXPORT -->
      <div id="hud-fen-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-modal-card hud-glass" style="text-align:left;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong id="hud-fen-modal-title" style="color:#ffe082;font-size:16px;">${this.t('fenModalTitle')}</strong>
            <button id="hud-fen-close" class="hud-btn">✕</button>
          </div>
          <label style="font-size:12px;color:#9be7c4;display:block;margin-bottom:4px;">FEN:</label>
          <input id="hud-fen-input" type="text" style="width:100%;padding:7px;border-radius:8px;border:1px solid #445;background:#0e131d;color:#fff;margin-bottom:10px;">
          <label style="font-size:12px;color:#9be7c4;display:block;margin-bottom:4px;">PGN:</label>
          <textarea id="hud-pgn-input" rows="4" style="width:100%;padding:7px;border-radius:8px;border:1px solid #445;background:#0e131d;color:#fff;margin-bottom:10px;"></textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="hud-fen-load-btn" class="hud-btn gold">${this.t('loadFenBtn')}</button>
            <button id="hud-pgn-load-btn" class="hud-btn">${this.t('loadPgnBtn')}</button>
          </div>
        </div>
      </div>

      <!-- MODAL 4: INTERACTIVE 6x6 BATTLE CHOREOGRAPHY & VIDEO MATRIX (ALL 36 CLASHES) -->
      <div id="hud-matrix36-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-matrix36-card hud-glass">
          <div class="hud-matrix36-header">
            <div>
              <strong id="hud-matrix36-title" style="color:#ffe082;font-size:16px;">${this.t('matrix36ModalTitle')}</strong>
              <span id="hud-matrix36-sub" style="display:block;font-size:11.5px;color:#9be7c4;">${this.t('matrix36ModalSub')}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              <button id="hud-matrix36-marathon-btn" class="hud-btn gold">${this.t('matrix36MarathonBtn')}</button>
              <a id="hud-matrix36-page-link" href="./battles.html" class="hud-btn" style="text-decoration:none;">${this.t('matrix36GalleryLink')}</a>
              <button id="hud-matrix36-close" class="hud-btn">${this.t('closeBtn')}</button>
            </div>
          </div>

          <div class="hud-matrix36-body">
            <!-- 6x6 Grid of all 36 Attacker x Defender combinations -->
            <div id="hud-matrix36-grid" class="hud-matrix36-table">
              ${this._renderMatrix36GridHtml()}
            </div>

            <!-- Built-in 16:9 Video Preview Player & Selected Pair Choreography Inspector -->
            <div id="hud-matrix36-preview-pane" class="hud-matrix36-preview">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong id="hud-matrix36-preview-title" style="color:#ffe082;font-size:13.5px;">♗ Ale vs ♘ Seby (B×N)</strong>
                <span id="hud-matrix36-preview-code" class="hud-matrix-paircode">B×N</span>
              </div>
              <video id="hud-matrix36-video" controls playsinline preload="metadata" src="assets/battles/videos/b_x_n.mp4"></video>
              <div id="hud-matrix36-preview-banner" style="font-size:12px;font-weight:800;color:#ffca28;background:rgba(255,193,7,0.12);border:1px solid rgba(255,213,79,0.4);padding:5px 8px;border-radius:7px;">
                ALE vs SEBY: CRISTALLO SUL CAVALLINO! 💎🐴
              </div>
              <div id="hud-matrix36-preview-details" style="font-size:11px;color:#d6e4f0;display:flex;flex-direction:column;gap:3px;">
                <div>⚔️ <strong>Attack Weapon:</strong> <span id="hud-matrix36-preview-weapon">🐉 Shoulder Dragon & Amethyst Crystal</span></div>
                <div>🛡️ <strong>Act 2 Counter:</strong> <span id="hud-matrix36-preview-counter">🐴 Rear-Up & Double Hoof Kick (REAR-UP!)</span></div>
              </div>
              <button id="hud-matrix36-launch-selected" class="hud-btn gold" style="justify-content:center;padding:8px;">
                ${this.t('matrix36LaunchBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL 4: 6x6 CAPTURE MATRIX EXPLORER & ASSET INVENTORY -->
      <div id="hud-matrix-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-matrix-card hud-glass">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div>
              <strong style="color:#ffe082;font-size:15px;">⚔️ 6×6 Battle Matrix: Who Eats Who (3D VFX & 16:9 Veo Cinema)</strong>
              <div style="font-size:11px;color:#b8f5d8;margin-top:2px;">
                <span class="hud-badge-pill hud-badge-mp4">📹 Dedicated MP4 (4/36: b×n, n×b, n↔r)</span>
                <span class="hud-badge-pill hud-badge-mix">🎞️ Video + Canvas (32/36)</span>
                <span class="hud-badge-pill hud-badge-glb">🦴 GLB Rigged (Ale #2 FireBreath_Track)</span>
                <span class="hud-badge-pill hud-badge-egg">🌟 Easter Egg (6/36)</span>
              </div>
            </div>
            <button id="hud-matrix-close" class="hud-btn">✕</button>
          </div>

          <!-- Family Selector Tabs -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:11px;color:#ffe082;font-weight:700;">Attacker Family (A):</span>
            ${Object.values(FAMILY_ROSTERS)
              .map(
                (fam) =>
                  `<button class="hud-btn ${fam.id === this.matrixFamily ? 'active' : ''}" data-matrix-family="${fam.id}">${fam.label[this.lang] || fam.label.en || fam.label.it}</button>`,
              )
              .join('')}
          </div>

          <!-- Dynamic 6x6 Grid Container -->
          <div id="hud-matrix-grid-container"></div>

          <!-- Selected Pair Detail & Launch Bar -->
          <div id="hud-matrix-detail-bar" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(10,14,24,0.88);border:1px solid rgba(255,213,79,0.4);">
            <div id="hud-matrix-detail-text" style="font-size:11.5px;line-height:1.35;color:#e6eef8;"></div>
            <button id="hud-matrix-play-btn" class="hud-btn gold" style="padding:6px 12px;font-size:12px;">
              ▶ Watch in 3D + Video
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    this.rootEl = root;
    this._renderMatrixExplorerGrid();
    this._bindDomActions(root);
  }

  _bindDomActions(root) {
    const q = (sel) => root.querySelector(sel);

    // Mode 1 <-> Mode 2 Switcher
    q('#hud-mode1-btn')?.addEventListener('click', () => {
      if (this.ctx?.flow?.startChessMode) {
        this.ctx.flow.startChessMode();
      } else {
        this.ctx?.bus?.emit({ type: 'FLOW_STATE_CHANGED', from: this.flowState, to: 'Mode1_Chess' });
      }
      this.ctx?.bus?.flush?.();
    });

    q('#hud-mode2-btn')?.addEventListener('click', () => {
      if (this.ctx?.flow?.startWowMode) {
        this.ctx.flow.startWowMode();
      } else {
        this.ctx?.bus?.emit({ type: 'FLOW_STATE_CHANGED', from: this.flowState, to: 'Mode2_WowArena' });
      }
      this.ctx?.bus?.flush?.();
    });

    // Profile selector
    q('#hud-profile-select')?.addEventListener('change', (e) => {
      this.activeProfile = e.target.value;
      this.ctx?.bus?.emit({ type: 'PROFILE_CHANGED', profileId: this.activeProfile });
      this.ctx?.bus?.flush?.();
    });

    // Opponent selector (2P vs CPU Easy/Med/Hard). HUD only announces the fact;
    // AIWorkerManager reacts to OPPONENT_CHANGED and takes its turn when due.
    q('#hud-opponent-select')?.addEventListener('change', (e) => {
      this.opponentMode = e.target.value;
      const enabled = this.opponentMode !== 'hotseat';
      const difficulty = enabled ? this.opponentMode : 'easy';
      this.ctx?.bus?.emit({
        type: 'OPPONENT_CHANGED',
        mode: this.opponentMode,
        enabled,
        cpuColor: 'b',
        difficulty,
      });
      this.ctx?.bus?.flush?.();
    });

    // White Set selector (Carlesso vs Swamp vs Classic)
    q('#hud-white-select')?.addEventListener('change', (e) => {
      this.whiteFamily = e.target.value;
      const pm = this.ctx?.pieces || this.ctx?.pieceManager;
      pm?.setWhiteFamily?.(this.whiteFamily);
      this.ctx?.bus?.flush?.();
    });

    // Rival Set selector (Carlesso vs Swamp vs Classic vs Stone)
    q('#hud-rival-select')?.addEventListener('change', (e) => {
      this.rivalSet = e.target.value;
      const pm = this.ctx?.pieces || this.ctx?.pieceManager;
      pm?.setRivalSetMode?.(this.rivalSet);
      this.ctx?.bus?.flush?.();
    });

    // Direct language flag buttons (🇬🇧 EN / 🇮🇹 IT) across Topbar, Setup Modal, and Bottom Dock
    root.querySelectorAll('button[data-set-lang]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetLang = btn.dataset.setLang === 'it' ? 'it' : 'en';
        this.setLanguage(targetLang);
      });
    });

    // Backwards-compatible toggle on #hud-lang-btn if clicked outside a specific flag button
    q('#hud-lang-btn')?.addEventListener('click', (e) => {
      if (e.target?.closest?.('button[data-set-lang]')) return;
      const nextLang = this.lang === 'it' ? 'en' : 'it';
      this.setLanguage(nextLang);
    });

    // Action dock buttons
    q('#hud-hint-btn')?.addEventListener('click', () => {
      const fen = this.ctx?.board?.fen?.();
      if (this.ctx?.ai?.requestHint && fen) {
        this.ctx.ai.requestHint(fen).then(() => this.ctx?.bus?.flush?.());
      } else {
        this.ctx?.bus?.emit({ type: 'HINT_REQUESTED' });
        this.ctx?.bus?.flush?.();
      }
    });

    q('#hud-zoom-in-btn')?.addEventListener('click', () => {
      if (this.ctx?.controls?._dollyOut) {
        this.ctx.controls._dollyOut(0.84);
        this.ctx.controls.update?.();
      } else if (this.ctx?.camera) {
        this.ctx.camera.position.multiplyScalar(0.85);
        this.ctx.controls?.update?.();
      }
    });

    q('#hud-zoom-out-btn')?.addEventListener('click', () => {
      if (this.ctx?.controls?._dollyIn) {
        this.ctx.controls._dollyIn(0.84);
        this.ctx.controls.update?.();
      } else if (this.ctx?.camera) {
        this.ctx.camera.position.multiplyScalar(1.18);
        this.ctx.controls?.update?.();
      }
    });

    q('#hud-trackpad-btn')?.addEventListener('click', () => {
      if (!this.ctx?.controls) return;
      const next = !this.ctx.controls.trackpadTwoFingerRotate;
      this.ctx.controls.trackpadTwoFingerRotate = next;
      const btn = q('#hud-trackpad-btn');
      if (btn) {
        btn.classList.toggle('active', next);
        btn.textContent = next ? this.t('trackpadRotateBtn') : this.t('trackpadZoomBtn');
      }
      this.showToast(
        this.lang === 'it'
          ? next
            ? '🖐️ Mac Trackpad: 2 dita ruotano alto/basso & sx/dx (Pizzica o Cmd+scroll per Zoom!)'
            : '🔍 Mac Trackpad: 2 dita fanno Zoom (Trascina con 1 dito per ruotare!)'
          : next
            ? '🖐️ Mac Trackpad: 2 fingers rotate up/down & left/right (Pinch or Cmd+scroll to Zoom!)'
            : '🔍 Mac Trackpad: 2 fingers Zoom (Drag with 1 finger to rotate!)',
      );
    });

    q('#hud-flip-btn')?.addEventListener('click', () => {
      this.cameraFlipped = !this.cameraFlipped;
      this.topDownCamera = false;
      if (this.ctx?.camera) {
        if (this.cameraFlipped) {
          this.ctx.camera.position.set(0, 7.0, -8.2);
        } else {
          this.ctx.camera.position.set(0, 7.2, 9.8);
        }
        this.ctx.controls?.target?.set?.(0, 0.3, 0);
        this.ctx.controls?.update?.();
      }
      this.ctx?.bus?.emit({ type: 'CAMERA_VIEW_REQUESTED', view: 'flip' });
      this.ctx?.bus?.flush?.();
    });

    q('#hud-reset-cam-btn')?.addEventListener('click', () => {
      this.resetCameraView();
    });

    q('#hud-top-btn')?.addEventListener('click', () => {
      if (this.isMobilePhone) {
        this.applyMobileCameraMode(this.topDownCamera ? '3d' : 'top', { silent: false });
        return;
      }
      this.topDownCamera = !this.topDownCamera;
      const topBtn = q('#hud-top-btn');
      const topBadge = q('#hud-top-badge');
      if (topBadge) topBadge.textContent = this.topDownCamera ? '2D' : '3D';
      if (topBtn) topBtn.classList.toggle('active', !this.topDownCamera);
      if (this.ctx?.camera) {
        if (this.topDownCamera) {
          this.ctx.camera.position.set(0, 12.8, this.cameraFlipped ? -0.01 : 0.01);
        } else {
          this.ctx.camera.position.set(0, this.cameraFlipped ? 7.0 : 7.2, this.cameraFlipped ? -8.2 : 9.8);
        }
        this.ctx.controls?.target?.set?.(0, 0.3, 0);
        this.ctx.controls?.update?.();
      }
      this.ctx?.bus?.emit({
        type: 'CAMERA_VIEW_REQUESTED',
        view: this.topDownCamera ? 'top' : 'default',
      });
      this.ctx?.bus?.flush?.();
    });

    if (this.isMobilePhone) {
      const topBtn = q('#hud-top-btn');
      const topBadge = q('#hud-top-badge');
      if (topBadge) topBadge.textContent = this.topDownCamera ? '2D' : '3D';
      if (topBtn) {
        const lbl = this.t(this.topDownCamera ? 'mobileCamTopBtn' : 'mobileCam3dBtn');
        topBtn.title = lbl;
        topBtn.setAttribute('aria-label', lbl);
        topBtn.classList.toggle('active', !this.topDownCamera);
      }
    }

    q('#hud-new-btn')?.addEventListener('click', () => {
      this.startNewGame();
    });

    q('#hud-refresh-btn')?.addEventListener('click', () => {
      this.checkAndRefreshVersion();
    });

    q('#hud-fen-btn')?.addEventListener('click', () => {
      const modal = q('#hud-fen-modal');
      if (!modal) return;
      q('#hud-fen-input').value = this.ctx?.board?.fen?.() || '';
      q('#hud-pgn-input').value = this.ctx?.board?.pgn?.() || '';
      modal.style.display = 'grid';
    });

    q('#hud-fen-close')?.addEventListener('click', () => {
      q('#hud-fen-modal').style.display = 'none';
    });

    q('#hud-fen-load-btn')?.addEventListener('click', () => {
      const fenVal = q('#hud-fen-input')?.value?.trim();
      if (fenVal && this.ctx?.board?.loadFen) {
        try {
          this.ctx.board.loadFen(fenVal);
          this.ctx?.bus?.flush?.();
          q('#hud-fen-modal').style.display = 'none';
        } catch {
          this.showToast('⚠️ FEN non valido / Invalid FEN');
        }
      }
    });

    q('#hud-pgn-load-btn')?.addEventListener('click', () => {
      const pgnVal = q('#hud-pgn-input')?.value?.trim();
      if (pgnVal && this.ctx?.board?.loadPgn) {
        try {
          this.ctx.board.loadPgn(pgnVal);
          this.ctx?.bus?.flush?.();
          q('#hud-fen-modal').style.display = 'none';
        } catch {
          this.showToast('⚠️ PGN non valido / Invalid PGN');
        }
      }
    });

    q('#hud-music-btn')?.addEventListener('click', () => {
      if (this.ctx?.audio?.toggleThemeSong) {
        this.musicPlaying = this.ctx.audio.toggleThemeSong();
      } else {
        this.musicPlaying = !this.musicPlaying;
        this.ctx?.bus?.emit({ type: 'MUSIC_TOGGLE_REQUESTED', playing: this.musicPlaying });
        this.ctx?.bus?.flush?.();
      }
      q('#hud-music-btn')?.classList.toggle('active', this.musicPlaying);
    });

    q('#hud-sfx-btn')?.addEventListener('click', () => {
      if (this.ctx?.audio?.toggleSfx) {
        this.sfxEnabled = this.ctx.audio.toggleSfx();
      } else {
        this.sfxEnabled = !this.sfxEnabled;
        this.ctx?.bus?.emit({ type: 'SFX_TOGGLE_REQUESTED', enabled: this.sfxEnabled });
        this.ctx?.bus?.flush?.();
      }
      q('#hud-sfx-btn')?.classList.toggle('active', this.sfxEnabled);
    });

    // Skip Battle Cutscene button
    q('#hud-skip-btn')?.addEventListener('click', () => this.skipActiveCutscene());

    // Play Again button in Checkmate/Draw modal
    q('#hud-play-again-btn')?.addEventListener('click', () => {
      q('#hud-gameover-modal').style.display = 'none';
      this.ctx?.board?.reset?.();
      this.ctx?.bus?.flush?.();
    });

    // Cutie Pawn Promotion buttons
    root.querySelectorAll('button[data-promo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const promo = btn.dataset.promo || 'q';
        const pending = this.pendingPromotion;
        q('#hud-promo-modal').style.display = 'none';
        this.pendingPromotion = null;
        if (pending && this.ctx?.board?.move) {
          this.ctx.board.move(pending.from, pending.to, promo);
          this.ctx?.bus?.flush?.();
        }
      });
    });

    // Mode 2 WOW Controls
    q('#hud-wow-tab-inspector')?.addEventListener('click', () => {
      this.wowSubMode = 'inspector';
      this._syncWowPanelTabs();
      this.ctx?.bus?.emit({
        type: 'WOW_INSPECT_CHARACTER',
        subMode: 'inspector',
        pieceType: this.wowChar,
      });
      this.ctx?.bus?.flush?.();
    });

    q('#hud-wow-tab-arena')?.addEventListener('click', () => {
      this.wowSubMode = 'arena';
      this._syncWowPanelTabs();
      this.ctx?.bus?.emit({
        type: 'WOW_INSPECT_CHARACTER',
        subMode: 'arena',
        pieceType: this.wowChar,
      });
      this.ctx?.bus?.flush?.();
    });

    root.querySelectorAll('button[data-wow-char]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.wowChar = btn.dataset.wowChar || 'b';
        root.querySelectorAll('button[data-wow-char]').forEach((b) =>
          b.classList.toggle('active', b === btn),
        );
        const aleRow = q('#hud-ale-variant-row');
        if (aleRow) aleRow.style.display = this.wowChar === 'b' ? 'flex' : 'none';
        this.ctx?.bus?.emit({
          type: 'WOW_INSPECT_CHARACTER',
          subMode: 'inspector',
          pieceType: this.wowChar,
          bishopVariant: this.wowBishopVariant,
        });
        this.ctx?.bus?.flush?.();
      });
    });

    q('#hud-ale-rigged-btn')?.addEventListener('click', () => {
      this.wowBishopVariant = 'rigged';
      q('#hud-ale-rigged-btn')?.classList.add('active');
      q('#hud-ale-hat-btn')?.classList.remove('active');
      this.ctx?.bus?.emit({
        type: 'WOW_INSPECT_CHARACTER',
        pieceType: 'b',
        bishopVariant: 'rigged',
      });
      this.ctx?.bus?.flush?.();
    });

    q('#hud-ale-hat-btn')?.addEventListener('click', () => {
      this.wowBishopVariant = 'hat';
      q('#hud-ale-hat-btn')?.classList.add('active');
      q('#hud-ale-rigged-btn')?.classList.remove('active');
      this.ctx?.bus?.emit({
        type: 'WOW_INSPECT_CHARACTER',
        pieceType: 'b',
        bishopVariant: 'hat',
      });
      this.ctx?.bus?.flush?.();
    });

    q('#hud-card-flip-btn')?.addEventListener('click', () => {
      this.wowCardSide = this.wowCardSide === 'front' ? 'back' : 'front';
      this.ctx?.bus?.emit({
        type: 'WOW_INSPECT_CHARACTER',
        pieceType: this.wowChar,
        cardSide: this.wowCardSide,
      });
      this.ctx?.bus?.flush?.();
    });

    q('#hud-autorotate-btn')?.addEventListener('click', () => {
      this.wowAutoRotate = !this.wowAutoRotate;
      q('#hud-autorotate-btn')?.classList.toggle('active', this.wowAutoRotate);
      this.ctx?.bus?.emit({
        type: 'WOW_INSPECT_CHARACTER',
        pieceType: this.wowChar,
        autoRotate: this.wowAutoRotate,
      });
      this.ctx?.bus?.flush?.();
    });

    root.querySelectorAll('button[data-wow-anim]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const clipKey = btn.dataset.wowAnim || 'Idle';
        this.ctx?.bus?.emit({
          type: 'WOW_TRIGGER_ANIMATION',
          pieceType: this.wowChar,
          clipKey,
        });
        this.ctx?.bus?.flush?.();
      });
    });

    q('#hud-wow-clash-btn')?.addEventListener('click', () => {
      const attacker = q('#hud-wow-atk')?.value || 'b';
      const defender = q('#hud-wow-def')?.value || 'n';
      const goldenCrit = Boolean(q('#hud-wow-crit')?.checked);
      this.ctx?.bus?.emit({
        type: 'WOW_ARENA_CLASH',
        attacker,
        defender,
        goldenCrit,
        tier: goldenCrit ? 'golden_crit' : 'normal',
        from: 'd4',
        to: 'e5',
        square: 'e5',
      });
      this.ctx?.bus?.flush?.();
    });

    root.querySelectorAll('button[data-quick-clash]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [attacker, defender] = (btn.dataset.quickClash || 'b_n').split('_');
        if (q('#hud-wow-atk')) q('#hud-wow-atk').value = attacker;
        if (q('#hud-wow-def')) q('#hud-wow-def').value = defender;
        this.ctx?.bus?.emit({
          type: 'WOW_ARENA_CLASH',
          attacker,
          defender,
          goldenCrit: true,
          tier: 'golden_crit',
          from: 'd4',
          to: 'e5',
          square: 'e5',
        });
        this.ctx?.bus?.flush?.();
      });
    });

    q('#hud-swamp-btn')?.addEventListener('click', () => {
      const pm = this.ctx?.pieces || this.ctx?.pieceManager;
      if (pm) {
        let added = 0;
        if (typeof pm.seedSwampParty === 'function') {
          added = pm.seedSwampParty();
        }
        this.ctx?.bus?.flush?.();
        this.showToast(
          this.lang === 'it'
            ? added > 0
              ? '🐸 Splash! I 6 pezzi demo si tuffano nella Palude! 💦'
              : '🐸 Palude già attiva (idempotente: i 6 nuotatori sono già sulle ninfee! 🪷)'
            : added > 0
              ? '🐸 Splash! All 6 demo pieces dive into the Swamp! 💦'
              : '🐸 Swamp already active (all 6 swimmers are on the lily pads! 🪷)',
        );
      }
    });

    // 🦴 Scheletri 3D toggle button (#12) — hidden in production unless ?debug=1, ?skeletons=1, or ?experiments=ToggleSkeleton
    const skelBtn = q('#hud-skeletons-btn');
    if (skelBtn && typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const exps = (sp.get('experiments') || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const showSkelBtn =
        sp.get('debug') === '1' ||
        sp.get('debug') === 'true' ||
        sp.get('skeletons') === '1' ||
        sp.get('skeletons') === 'true' ||
        exps.includes('toggleskeleton') ||
        exps.includes('showskeletons');
      skelBtn.style.display = showSkelBtn ? '' : 'none';
      if (sp.get('skeletons') === '1' || exps.includes('showskeletons')) {
        this.skeletonsVisible = true;
        skelBtn.classList.add('active');
      }
    }
    skelBtn?.addEventListener('click', () => {
      const next = !this.skeletonsVisible;
      this.skeletonsVisible = next;
      q('#hud-skeletons-btn')?.classList.toggle('active', next);
      this.ctx?.bus?.emit({ type: 'TOGGLE_SKELETONS', visible: next });
      this.ctx?.bus?.flush?.();
      this.showToast(
        this.lang === 'it'
          ? next
            ? '🦴 Scheletri 3D Attivi (Debug): Giunture e locomozione articolata visibili su tutti i 32 pezzi!'
            : '🦴 Scheletri 3D Nascosti (100% invisibili in partita e combattimento)'
          : next
            ? '🦴 3D Skeletons Active (Debug): Articulated joints visible on all 32 pieces!'
            : '🦴 3D Skeletons Hidden (100% invisible during match and combat)',
      );
    });

    // 🎬 Matrice 6×6 (36 Scontri) modal open/close & cell actions (#11)
    q('#hud-matrix36-btn')?.addEventListener('click', () => this.openMatrix36Modal());
    q('#hud-wow-matrix36-btn')?.addEventListener('click', () => this.openMatrix36Modal());
    q('#hud-matrix36-close')?.addEventListener('click', () => this.closeMatrix36Modal());
    q('#hud-matrix36-marathon-btn')?.addEventListener('click', () => this.toggleMatrix36Marathon());

    q('#hud-matrix36-launch-selected')?.addEventListener('click', () => {
      const { atk, def } = this.matrixSelectedPair;
      this.launchMatrix36Clash(atk, def);
    });

    // 36 cells: 1-click Scazzottata 3D + Cinema OR 1-click Video 16:9 preview
    root.querySelectorAll('button[data-matrix-clash]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [atk, def] = (btn.dataset.matrixClash || 'b_n').split('_');
        this.launchMatrix36Clash(atk, def);
      });
    });

    root.querySelectorAll('button[data-matrix-video]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [atk, def] = (btn.dataset.matrixVideo || 'b_n').split('_');
        this._updateMatrixPreviewPane(atk, def, true);
      });
    });

    root.querySelectorAll('.hud-matrix-cell[data-matrix-cell]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const [atk, def] = (cell.dataset.matrixCell || 'b_n').split('_');
        this._updateMatrixPreviewPane(atk, def, true);
      });
    });

    // Topbar Toggle
    q('#hud-toggle-topbar-btn')?.addEventListener('click', () => this.toggleTopbar());

    // Setup Modal open & close
    q('#hud-setup-btn')?.addEventListener('click', () => this.openSetupModal());
    q('#hud-setup-close')?.addEventListener('click', () => this.closeSetupModal());

    // Setup radio changes (White and Black player types)
    root.querySelectorAll('input[name="white-player-type"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const isHuman = e.target.value === 'human';
        const profWrap = q('#hud-setup-white-profile-wrap');
        const aiWrap = q('#hud-setup-white-ai-wrap');
        if (profWrap) profWrap.style.display = isHuman ? 'block' : 'none';
        if (aiWrap) aiWrap.style.display = isHuman ? 'none' : 'block';
      });
    });

    root.querySelectorAll('input[name="black-player-type"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const isAi = e.target.value === 'ai';
        const aiWrap = q('#hud-setup-black-ai-wrap');
        const humanWrap = q('#hud-setup-black-human-wrap');
        if (aiWrap) aiWrap.style.display = isAi ? 'block' : 'none';
        if (humanWrap) humanWrap.style.display = isAi ? 'none' : 'block';
      });
    });

    // Apply setup in-place (Modifica Partita in Corso) OR start new match (Nuova Partita con Reset)
    const submitSetupFromModal = (resetBoard) => {
      const whiteFamily = q('#hud-setup-white-set')?.value || 'carlesso';
      const whitePlayerType =
        root.querySelector('input[name="white-player-type"]:checked')?.value || 'human';
      const whiteProfile = q('#hud-setup-white-profile')?.value || 'ale';
      const whiteDiff = q('#hud-setup-white-diff')?.value || 'easy';

      const rivalSet = q('#hud-setup-black-set')?.value || 'classic';
      const blackPlayerType =
        root.querySelector('input[name="black-player-type"]:checked')?.value || 'ai';
      const blackDiff = q('#hud-setup-black-diff')?.value || 'easy';

      this.applySetup({
        whiteFamily,
        whitePlayerType,
        whiteProfile,
        whiteDiff,
        rivalSet,
        blackPlayerType,
        blackDiff,
        resetBoard,
      });
    };

    q('#hud-setup-apply-btn')?.addEventListener('click', () => submitSetupFromModal(false));
    q('#hud-setup-start-btn')?.addEventListener('click', () => submitSetupFromModal(true));

    // Mobile Simplified UX bindings ("Easy Adopter" 1-tap start & Portrait -> Landscape prompt)
    q('#hud-rotate-dismiss-btn')?.addEventListener('click', () => {
      this.portraitDismissed = true;
      this.syncMobileOrientationUi();
    });

    root.querySelectorAll('button[data-mobile-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mobileQuickMode = btn.dataset.mobileMode || 'easy';
        root.querySelectorAll('button[data-mobile-mode]').forEach((b) =>
          b.classList.toggle('active', b === btn),
        );
      });
    });

    q('#hud-mobile-quick-play-btn')?.addEventListener('click', () => {
      this.startMobileQuickMatch();
    });

    q('#hud-mobile-advanced-toggle')?.addEventListener('click', () => {
      this.mobileAdvancedOpen = !this.mobileAdvancedOpen;
      root.classList.toggle('mobile-advanced-open', this.mobileAdvancedOpen);
      const advBtn = q('#hud-mobile-advanced-toggle');
      if (advBtn) {
        advBtn.textContent = this.t(
          this.mobileAdvancedOpen ? 'mobileHideAdvBtn' : 'mobileAdvOptionsBtn',
        );
      }
    });

    // Quake Console bindings
    q('#hud-console-btn')?.addEventListener('click', () => this.toggleQuakeConsole());
    q('#quake-close-btn')?.addEventListener('click', () => this.closeQuakeConsole());
    q('#quake-clear-btn')?.addEventListener('click', () => this.clearQuakeLogs());
    q('#quake-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = q('#quake-input');
      if (!inp) return;
      const val = inp.value;
      inp.value = '';
      this.handleQuakeCommand(val);
    });

    // 6x6 Family Capture Matrix Explorer & Asset Inventory Modal controls
    const openMatrixModal = () => {
      const modal = q('#hud-matrix-modal');
      if (!modal) return;
      this._renderMatrixExplorerGrid();
      modal.style.display = 'grid';
    };

    q('#hud-matrix-btn')?.addEventListener('click', openMatrixModal);
    q('#hud-matrix-close')?.addEventListener('click', () => {
      const modal = q('#hud-matrix-modal');
      if (modal) modal.style.display = 'none';
    });

    root.querySelectorAll('button[data-matrix-family]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const famId = btn.dataset.matrixFamily || 'carlesso';
        if (this.matrixFamily === famId) return;
        this.matrixFamily = famId;
        root.querySelectorAll('button[data-matrix-family]').forEach((b) =>
          b.classList.toggle('active', b === btn),
        );
        this._renderMatrixExplorerGrid();
      });
    });

    q('#hud-matrix-play-btn')?.addEventListener('click', () => {
      this._launchMatrixPair(this.matrixSelectedAtk, this.matrixSelectedDef);
    });
  }

  _renderMatrixExplorerGrid() {
    if (!this.rootEl) return;
    const container = this.rootEl.querySelector('#hud-matrix-grid-container');
    if (!container) return;

    const fam = FAMILY_ROSTERS[this.matrixFamily] || FAMILY_ROSTERS.carlesso;
    const pieceKeys = ['k', 'q', 'b', 'n', 'r', 'p'];
    const isIt = this.lang === 'it';

    const headerCells = pieceKeys
      .map((defKey) => {
        const p = fam.pieces[defKey];
        return `<th>🛡️ ${p.glyph} ${p.name}</th>`;
      })
      .join('');

    const rowsHtml = pieceKeys
      .map((atkKey) => {
        const atkP = fam.pieces[atkKey];
        const cellsHtml = pieceKeys
          .map((defKey) => {
            const m = resolveFamilyMatchup(this.matrixFamily, atkKey, defKey);
            const isSelected =
              this.matrixSelectedAtk === atkKey && this.matrixSelectedDef === defKey;
            const classes = [
              'hud-matrix-cell',
              isSelected ? 'selected' : '',
              m.hasDedicatedVideo ? 'dedicated-video' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const videoBadge = m.hasDedicatedVideo
              ? '<span class="hud-badge-pill hud-badge-mp4">📹 Veo MP4</span>'
              : '<span class="hud-badge-pill hud-badge-mix">🎞️ 3D MP4</span>';
            const glbBadge = m.hasSkeletalGlbClip
              ? '<span class="hud-badge-pill hud-badge-glb">🦴 GLB</span>'
              : '';
            const eggBadge = m.easterEgg
              ? '<span class="hud-badge-pill hud-badge-egg">🌟 Egg</span>'
              : '';

            return `
              <td>
                <button
                  class="${classes}"
                  data-matrix-atk="${atkKey}"
                  data-matrix-def="${defKey}"
                  title="${m.attackerDisplayName} → ${m.defenderDisplayName}"
                >
                  <strong>${atkP.glyph} → ${fam.pieces[defKey].glyph}</strong>
                  <div class="hud-matrix-badges">${videoBadge}${glbBadge}${eggBadge}</div>
                </button>
              </td>
            `;
          })
          .join('');

        return `
          <tr>
            <th style="text-align:left;white-space:nowrap;">
              ⚔️ ${atkP.glyph} ${atkP.name}
              <div style="font-size:9.5px;color:#9be7c4;font-weight:500;">${atkP.attackLabel}</div>
            </th>
            ${cellsHtml}
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <table class="hud-matrix-table">
        <thead>
          <tr>
            <th>${isIt ? 'Attaccante (A) \\ Difensore (B)' : 'Attacker (A) \\ Defender (B)'}</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    container.querySelectorAll('button[data-matrix-atk]').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        this.matrixSelectedAtk = btn.dataset.matrixAtk || 'n';
        this.matrixSelectedDef = btn.dataset.matrixDef || 'b';
        container.querySelectorAll('.hud-matrix-cell').forEach((c) =>
          c.classList.toggle('selected', c === btn),
        );
        this._updateMatrixDetailBar();
      });
      btn.addEventListener('click', () => {
        const atk = btn.dataset.matrixAtk || 'n';
        const def = btn.dataset.matrixDef || 'b';
        this.matrixSelectedAtk = atk;
        this.matrixSelectedDef = def;
        this._launchMatrixPair(atk, def);
      });
    });

    this._updateMatrixDetailBar();
  }

  _updateMatrixDetailBar() {
    if (!this.rootEl) return;
    const detailEl = this.rootEl.querySelector('#hud-matrix-detail-text');
    if (!detailEl) return;
    const isIt = this.lang === 'it';
    const m = resolveFamilyMatchup(
      this.matrixFamily,
      this.matrixSelectedAtk,
      this.matrixSelectedDef,
    );
    const animDesc = m.anim3dDesc?.[this.lang] || m.anim3dDesc?.en || m.anim3dDesc?.it || m.effect;
    const videoKind = m.hasDedicatedVideo
      ? isIt
        ? `📹 Film Veo/MP4 Dedicato (${m.videoUrl})`
        : `📹 Dedicated Veo/MP4 Film (${m.videoUrl})`
      : isIt
        ? `🎞️ Film 3D MP4 (${m.videoUrl}) + Card 2D Canvas`
        : `🎞️ 3D MP4 Film (${m.videoUrl}) + 2D Canvas Card`;
    const glbKind = m.hasSkeletalGlbClip
      ? isIt
        ? '🦴 Clip GLB Scheletrica: FireBreath_Track'
        : '🦴 Skeletal GLB Clip: FireBreath_Track'
      : isIt
        ? '✨ Animazione 3D Procedurale & Pool VFX'
        : '✨ Procedural 3D Animation & VFX Pool';

    detailEl.innerHTML = `
      <div><strong style="color:#ffe082;">${m.attackerDisplayName} ${isIt ? 'mangia' : 'captures'} ${m.defenderDisplayName}</strong> — <em>${m.banner?.[this.lang] || m.banner?.en || m.banner?.it}</em></div>
      <div><strong>${isIt ? '3D Scacchiera' : '3D Board'}:</strong> ${animDesc} · <strong>${isIt ? 'Reazione Vittima' : 'Victim Reaction'}:</strong> <code>${m.victimReaction}</code> · ${glbKind}</div>
      <div><strong>${isIt ? 'Sfondo 16:9' : '16:9 Backdrop'}:</strong> ${videoKind}</div>
    `;
  }

  _launchMatrixPair(attacker, defender) {
    if (this.rootEl) {
      const modal = this.rootEl.querySelector('#hud-matrix-modal');
      if (modal) modal.style.display = 'none';
      if (this.rootEl.querySelector('#hud-wow-atk')) {
        this.rootEl.querySelector('#hud-wow-atk').value = attacker;
      }
      if (this.rootEl.querySelector('#hud-wow-def')) {
        this.rootEl.querySelector('#hud-wow-def').value = defender;
      }
    }

    const pm = this.ctx?.pieces || this.ctx?.pieceManager;
    if (pm?.setWhiteFamily && pm?.setRivalSetMode) {
      pm.setWhiteFamily(this.matrixFamily);
      pm.setRivalSetMode(this.matrixFamily === 'carlesso' ? 'family' : this.matrixFamily);
    }

    this.ctx?.bus?.emit({
      type: 'WOW_ARENA_CLASH',
      attacker,
      defender,
      goldenCrit: true,
      tier: 'golden_crit',
      from: 'd4',
      to: 'e5',
      square: 'e5',
    });
    this.ctx?.bus?.flush?.();
  }

  /**
   * Builds the HTML for the 6 Attacker rows x 6 Defender columns (all 36 combinations).
   */
  _renderMatrix36GridHtml() {
    const isIt = this.lang === 'it';
    const colHeaders = [
      `<div class="hud-matrix-colhdr" style="font-size:10px;color:#9be7c4;">⚔️ ATK \\ DEF 🛡️</div>`,
      ...PIECE_ORDER.map((def) => {
        const c = CHARACTER_REGISTRY[def];
        return `
          <div class="hud-matrix-colhdr" title="${isIt ? 'Difensore' : 'Defender'}: ${c.name}">
            <img src="${c.frontPortrait}" alt="${c.name}">
            <span>${c.glyph} ${c.name}</span>
          </div>
        `;
      }),
    ].join('');

    const rowsHtml = PIECE_ORDER.map((atk) => {
      const atkChar = CHARACTER_REGISTRY[atk];
      const rowHdr = `
        <div class="hud-matrix-rowhdr" title="${isIt ? 'Attaccante' : 'Attacker'}: ${atkChar.name}">
          <img src="${atkChar.frontPortrait}" alt="${atkChar.name}">
          <span>${atkChar.glyph} ${atkChar.name}</span>
        </div>
      `;

      const cells = PIECE_ORDER.map((def) => {
        const meta = this.getPairMeta36(atk, def);
        const isDefaultActive = atk === this.matrixSelectedPair.atk && def === this.matrixSelectedPair.def;
        const badgeHtml = meta.eggBadge
          ? `<span class="matrix-egg-badge ${meta.eggClass}">${meta.eggBadge}</span>`
          : `<span class="hud-matrix-paircode">${meta.pairCode}</span>`;

        return `
          <div class="hud-matrix-cell ${isDefaultActive ? 'active' : ''}" data-matrix-cell="${atk}_${def}" data-atk="${atk}" data-def="${def}">
            <div class="hud-matrix-cell-top">
              <div class="hud-matrix-avatars">
                <img src="${meta.atkChar.frontPortrait}" alt="${meta.atkChar.name}">
                <span class="hud-matrix-paircode">${meta.pairCode}</span>
                <img src="${meta.defChar.frontPortrait}" alt="${meta.defChar.name}">
              </div>
              ${meta.eggBadge ? badgeHtml : ''}
            </div>
            <div style="font-size:9.5px;color:#d6e4f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${meta.bannerText}">
              ${meta.atkChar.glyph}${meta.atkChar.name} vs ${meta.defChar.glyph}${meta.defChar.name}
            </div>
            <div class="hud-matrix-cell-actions">
              <button class="matrix-cell-btn clash" data-matrix-clash="${atk}_${def}" title="3D Brawl + Cinema (${meta.pairCode})">🥊 ${isIt ? 'Scazzottata 3D + Cinema' : '3D Brawl + Cinema'}</button>
              <button class="matrix-cell-btn video" data-matrix-video="${atk}_${def}" title="16:9 Video (${meta.videoUrl})">▶️ Video 16:9</button>
            </div>
          </div>
        `;
      }).join('');

      return rowHdr + cells;
    }).join('');

    return colHeaders + rowsHtml;
  }

  openMatrix36Modal(atk = null, def = null) {
    this.matrixModalOpen = true;
    if (!this.rootEl) return;
    const modal = this.rootEl.querySelector('#hud-matrix36-modal');
    if (modal) {
      modal.style.display = 'grid';
    }
    const targetAtk = atk || this.matrixSelectedPair.atk || 'b';
    const targetDef = def || this.matrixSelectedPair.def || 'n';
    this._updateMatrixPreviewPane(targetAtk, targetDef, true);
  }

  closeMatrix36Modal() {
    this.matrixModalOpen = false;
    this.stopMatrix36Marathon();
    if (!this.rootEl) return;
    const modal = this.rootEl.querySelector('#hud-matrix36-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    const vid = this.rootEl.querySelector('#hud-matrix36-video');
    if (vid && typeof vid.pause === 'function') {
      try {
        vid.pause();
      } catch {
        // Ignore in headless environments
      }
    }
  }

  launchMatrix36Clash(atk = 'b', def = 'n') {
    this.closeMatrix36Modal();
    if (this.rootEl) {
      const atkSel = this.rootEl.querySelector('#hud-wow-atk');
      const defSel = this.rootEl.querySelector('#hud-wow-def');
      if (atkSel) atkSel.value = atk;
      if (defSel) defSel.value = def;
    }
    this.ctx?.bus?.emit({
      type: 'WOW_ARENA_CLASH',
      attacker: atk,
      defender: def,
      goldenCrit: true,
      tier: 'golden_crit',
      from: 'd4',
      to: 'e5',
      square: 'e5',
    });
    this.ctx?.bus?.flush?.();
  }

  _updateMatrixPreviewPane(atk = 'b', def = 'n', autoPlay = false) {
    this.matrixSelectedPair = { atk, def };
    if (!this.rootEl) return;

    const meta = this.getPairMeta36(atk, def);
    this.rootEl.querySelectorAll('.hud-matrix-cell[data-matrix-cell]').forEach((cell) => {
      cell.classList.toggle('active', cell.dataset.matrixCell === `${atk}_${def}`);
    });

    const titleEl = this.rootEl.querySelector('#hud-matrix36-preview-title');
    const codeEl = this.rootEl.querySelector('#hud-matrix36-preview-code');
    const bannerEl = this.rootEl.querySelector('#hud-matrix36-preview-banner');
    const weaponEl = this.rootEl.querySelector('#hud-matrix36-preview-weapon');
    const counterEl = this.rootEl.querySelector('#hud-matrix36-preview-counter');
    const vidEl = this.rootEl.querySelector('#hud-matrix36-video');

    if (titleEl) titleEl.textContent = meta.titleText;
    if (codeEl) codeEl.textContent = meta.pairCode;
    if (bannerEl) bannerEl.textContent = meta.bannerText;
    if (weaponEl) weaponEl.textContent = meta.weaponText;
    if (counterEl) counterEl.textContent = meta.counterText;

    if (vidEl) {
      if (vidEl.getAttribute('src') !== meta.videoUrl) {
        vidEl.setAttribute('src', meta.videoUrl);
        vidEl.src = meta.videoUrl;
      }
      if (autoPlay && typeof vidEl.play === 'function') {
        try {
          const p = vidEl.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {
          // Ignore autoplay restrictions in headless browsers
        }
      }
    }
  }

  toggleMatrix36Marathon() {
    if (this.matrixMarathonTimer) {
      this.stopMatrix36Marathon();
      return;
    }
    const pairs = [];
    for (const a of PIECE_ORDER) {
      for (const d of PIECE_ORDER) {
        pairs.push([a, d]);
      }
    }
    this.matrixMarathonIndex = 0;
    const btn = this.rootEl?.querySelector('#hud-matrix36-marathon-btn');
    const step = () => {
      if (this.matrixMarathonIndex >= pairs.length) {
        this.stopMatrix36Marathon();
        return;
      }
      const [atk, def] = pairs[this.matrixMarathonIndex];
      this.matrixMarathonIndex++;
      if (btn) {
        btn.textContent =
          this.lang === 'it'
            ? `⏹️ Ferma Maratona (${this.matrixMarathonIndex}/36 · ${atk.toUpperCase()}×${def.toUpperCase()})`
            : `⏹️ Stop Marathon (${this.matrixMarathonIndex}/36 · ${atk.toUpperCase()}×${def.toUpperCase()})`;
      }
      this._updateMatrixPreviewPane(atk, def, true);
    };
    step();
    this.matrixMarathonTimer = setInterval(step, 2900);
  }

  stopMatrix36Marathon() {
    if (this.matrixMarathonTimer) {
      clearInterval(this.matrixMarathonTimer);
      this.matrixMarathonTimer = null;
    }
    const btn = this.rootEl?.querySelector('#hud-matrix36-marathon-btn');
    if (btn) {
      btn.textContent = this.t('matrix36MarathonBtn');
    }
  }

  _syncWowPanelTabs() {
    if (!this.rootEl) return;
    const isInspector = this.wowSubMode === 'inspector';
    this.rootEl.querySelector('#hud-wow-tab-inspector')?.classList.toggle('active', isInspector);
    this.rootEl.querySelector('#hud-wow-tab-arena')?.classList.toggle('active', !isInspector);
    const inspBox = this.rootEl.querySelector('#hud-wow-inspector-box');
    const arenaBox = this.rootEl.querySelector('#hud-wow-arena-box');
    if (inspBox) inspBox.style.display = isInspector ? 'flex' : 'none';
    if (arenaBox) arenaBox.style.display = isInspector ? 'none' : 'flex';
  }

  // ===========================================================================
  // 1.5 MOBILE SIMPLIFIED UX, SETUP MODAL, TOPBAR TOGGLE & QUAKE CONSOLE
  // ===========================================================================

  /**
   * Synchronizes the Portrait -> Landscape friendly overlay (`#hud-rotate-overlay`)
   * on mobile phones. Automatically hides as soon as the phone rotates to landscape.
   */
  syncMobileOrientationUi(envOverride = undefined) {
    const isPortrait = isPortraitOrientation(envOverride);
    if (!isPortrait) {
      // Reset dismiss flag once user rotates to landscape so rotating back to portrait prompts again
      this.portraitDismissed = false;
    }
    if (!this.rootEl) return;
    this.rootEl.classList.toggle('mobile-simplified', Boolean(this.isMobilePhone));
    const rotateOverlay = this.rootEl.querySelector('#hud-rotate-overlay');
    if (rotateOverlay) {
      const shouldShow = Boolean(this.isMobilePhone && isPortrait && !this.portraitDismissed);
      rotateOverlay.style.display = shouldShow ? 'grid' : 'none';
    }
  }

  /**
   * Sets camera between 'top' (Easy Alto-Basso 2D-like overhead view) and '3d' (panoramic 3D view)
   * on mobile phones, updating `#hud-top-btn` label and notifying `VFXPoolView`.
   * @param {'top'|'3d'} mode
   * @param {{ silent?: boolean }} [opts]
   */
  applyMobileCameraMode(mode = 'top', opts = {}) {
    const isTop = mode === 'top';
    this.topDownCamera = isTop;
    const pos = isTop
      ? { x: 0, y: 12.8, z: this.cameraFlipped ? -0.01 : 0.01 }
      : { x: 0, y: this.cameraFlipped ? 7.0 : 7.2, z: this.cameraFlipped ? -8.2 : 9.8 };
    const target = { x: 0, y: 0.3, z: 0 };

    if (this.ctx?.camera?.position?.set) {
      this.ctx.camera.position.set(pos.x, pos.y, pos.z);
      this.ctx.controls?.target?.set?.(target.x, target.y, target.z);
      this.ctx.controls?.update?.();
    }

    if (this.rootEl) {
      const topBtn = this.rootEl.querySelector('#hud-top-btn');
      const topBadge = this.rootEl.querySelector('#hud-top-badge');
      if (topBadge) topBadge.textContent = isTop ? '2D' : '3D';
      if (topBtn) {
        const lbl = this.t(isTop ? 'mobileCamTopBtn' : 'mobileCam3dBtn');
        topBtn.title = lbl;
        topBtn.setAttribute('aria-label', lbl);
        topBtn.classList.toggle('active', !isTop);
      }
    }

    if (!opts.silent && this.ctx?.bus) {
      this.ctx.bus.emit({
        type: 'CAMERA_VIEW_REQUESTED',
        view: isTop ? 'top' : 'default',
        pos,
        target,
      });
      this.ctx.bus.flush?.();
    }
  }

  /**
   * Resets the player camera and orbit controls back to default canonical framing.
   * Shortcut: Hotkey 'r' / 'R' or HUD reset button (#hud-reset-cam-btn).
   */
  resetCameraView() {
    this.topDownCamera = false;
    const pos = this.cameraFlipped
      ? { x: 0, y: 7.0, z: -8.2 }
      : { x: 0, y: 5.85, z: 12.6 };
    const target = this.cameraFlipped
      ? { x: 0, y: 0.3, z: 0 }
      : { x: 0, y: 2.15, z: -2.2 };

    if (this.ctx?.camera?.position?.set) {
      this.ctx.camera.position.set(pos.x, pos.y, pos.z);
      this.ctx.controls?.target?.set?.(target.x, target.y, target.z);
      this.ctx.controls?.update?.();
    }

    if (this.rootEl) {
      const topBtn = this.rootEl.querySelector('#hud-top-btn');
      const topBadge = this.rootEl.querySelector('#hud-top-badge');
      if (topBadge) topBadge.textContent = '3D';
      if (topBtn) topBtn.classList.add('active');
    }

    if (this.ctx?.bus) {
      this.ctx.bus.emit({
        type: 'CAMERA_VIEW_REQUESTED',
        view: 'reset',
        pos,
        target,
      });
      this.ctx.bus.flush?.();
    }

    this.showToast(
      this.lang === 'it'
        ? '🎥 Visuale ripristinata alla posizione iniziale (Scorciatoia: R)'
        : '🎥 Camera view reset to default (Shortcut: R)',
      2200,
    );
  }

  /**
   * 1-tap "Easy Adopter" mobile match launcher:
   * - White: Guest (`ospite`) with Papino's Team (`carlesso`)
   * - Black: CPU (`easy` / `medium`) or 2P (`hotseat`) with Classic Rivals (`classic`)
   * - Camera: Starts in Easy Top-Down (`Alto-Basso`) and arms `mobileAwaitingFirstAttack3D = true`
   *   so the very first capture automatically unlocks and transitions to full 3D!
   */
  startMobileQuickMatch() {
    const mode = this.mobileQuickMode || 'easy';
    const isHotseat = mode === 'hotseat';
    const blackDiff = mode === 'medium' ? 'medium' : 'easy';

    this.mobileAwaitingFirstAttack3D = true;
    this.justUnlockedMobile3D = false;
    this.applyMobileCameraMode('top', { silent: true });

    this.applySetup({
      whiteFamily: 'carlesso',
      whitePlayerType: 'human',
      whiteProfile: 'ospite',
      whiteDiff: 'easy',
      rivalSet: 'classic',
      blackPlayerType: isHotseat ? 'human' : 'ai',
      blackDiff,
      resetBoard: true,
    });

    this.showToast(this.t('mobileStartToast'), 3800);
  }

  openSetupModal() {
    this.setupModalOpen = true;
    if (!this.rootEl) return;
    const modal = this.rootEl.querySelector('#hud-setup-modal');
    if (modal) {
      modal.style.display = 'grid';
      const wSet = this.rootEl.querySelector('#hud-setup-white-set');
      if (wSet) wSet.value = this.whiteFamily || 'carlesso';
      const bSet = this.rootEl.querySelector('#hud-setup-black-set');
      if (bSet) bSet.value = this.rivalSet || 'classic';
      const wProf = this.rootEl.querySelector('#hud-setup-white-profile');
      if (wProf) wProf.value = this.activeProfile || (this.isMobilePhone ? 'ospite' : 'ale');
      const bDiff = this.rootEl.querySelector('#hud-setup-black-diff');
      if (bDiff) bDiff.value = this.blackDifficulty || this.opponentMode || 'easy';
      const wDiff = this.rootEl.querySelector('#hud-setup-white-diff');
      if (wDiff) wDiff.value = this.whiteDifficulty || 'easy';

      const wType = this.whitePlayerType || 'human';
      this.rootEl.querySelectorAll('input[name="white-player-type"]').forEach((r) => {
        r.checked = r.value === wType;
      });
      const profWrap = this.rootEl.querySelector('#hud-setup-white-profile-wrap');
      const wAiWrap = this.rootEl.querySelector('#hud-setup-white-ai-wrap');
      if (profWrap) profWrap.style.display = wType === 'human' ? 'block' : 'none';
      if (wAiWrap) wAiWrap.style.display = wType === 'human' ? 'none' : 'block';

      const bType = this.blackPlayerType || 'ai';
      this.rootEl.querySelectorAll('input[name="black-player-type"]').forEach((r) => {
        r.checked = r.value === bType;
      });
      const bAiWrap = this.rootEl.querySelector('#hud-setup-black-ai-wrap');
      const bHumanWrap = this.rootEl.querySelector('#hud-setup-black-human-wrap');
      if (bAiWrap) bAiWrap.style.display = bType === 'ai' ? 'block' : 'none';
      if (bHumanWrap) bHumanWrap.style.display = bType === 'ai' ? 'none' : 'block';
    }
  }

  closeSetupModal() {
    this.setupModalOpen = false;
    if (!this.rootEl) return;
    const modal = this.rootEl.querySelector('#hud-setup-modal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * Resets all 32 pieces to the starting board position while preserving current factions & AI setup.
   */
  startNewGame() {
    this.closeSetupModal();
    if (this.isMobilePhone) {
      this.mobileAwaitingFirstAttack3D = true;
      this.justUnlockedMobile3D = false;
      this.applyMobileCameraMode('top', { silent: true });
    }
    if (this.rootEl) {
      const goModal = this.rootEl.querySelector('#hud-gameover-modal');
      if (goModal) goModal.style.display = 'none';
      const promoModal = this.rootEl.querySelector('#hud-promo-modal');
      if (promoModal) promoModal.style.display = 'none';
    }
    this.ctx?.board?.reset?.();
    this.ctx?.bus?.flush?.();
    this.ctx?.bus?.flush?.();
    this.logToQuake(
      'RESET',
      this.lang === 'it'
        ? '🔄 Nuova partita iniziata! Tutti i 32 pezzi sono tornati al via.'
        : '🔄 New match started! All 32 pieces reset to starting squares.',
      'green',
    );
    this.showToast(
      this.lang === 'it'
        ? '🔄 Nuova Partita! Tutti i 32 pezzi sono tornati al via! ✨'
        : '🔄 New Match! All 32 pieces are back at the starting line! ✨',
      3200,
    );
  }

  applySetup(settings = {}) {
    this.closeSetupModal();

    // Hide topbar to maximize 3D board view per spec!
    this.setTopbarVisible(false);

    const whiteFamily = settings.whiteFamily || this.whiteFamily || 'carlesso';
    const rivalSet = settings.rivalSet || this.rivalSet || 'classic';
    const whitePlayerType = settings.whitePlayerType || this.whitePlayerType || 'human'; // 'human' | 'ai'
    const blackPlayerType = settings.blackPlayerType || this.blackPlayerType || 'ai'; // 'human' | 'ai'
    const whiteDiff = settings.whiteDiff || this.whiteDifficulty || 'easy';
    const blackDiff = settings.blackDiff || this.blackDifficulty || 'easy';
    const whiteProfile = settings.whiteProfile || this.activeProfile || 'ale';
    const resetBoard = settings.resetBoard !== false;

    this.whiteFamily = whiteFamily;
    this.rivalSet = rivalSet;
    this.whitePlayerType = whitePlayerType;
    this.blackPlayerType = blackPlayerType;
    this.whiteDifficulty = whiteDiff;
    this.blackDifficulty = blackDiff;
    this.activeProfile = whiteProfile;

    // Configure CPU AI side(s)
    let cpuColor = 'none';
    if (whitePlayerType === 'ai' && blackPlayerType === 'ai') {
      cpuColor = 'both';
    } else if (whitePlayerType === 'ai') {
      cpuColor = 'w';
    } else if (blackPlayerType === 'ai') {
      cpuColor = 'b';
    }
    const aiEnabled = cpuColor !== 'none';
    this.opponentMode = aiEnabled ? blackDiff : 'hotseat';

    // Sync topbar dropdowns so UI stays consistent
    if (this.rootEl) {
      const wSel = this.rootEl.querySelector('#hud-white-select');
      if (wSel) wSel.value = whiteFamily;
      const bSel = this.rootEl.querySelector('#hud-rival-select');
      if (bSel) bSel.value = rivalSet;
      const pSel = this.rootEl.querySelector('#hud-profile-select');
      if (pSel) pSel.value = whiteProfile;
      const oSel = this.rootEl.querySelector('#hud-opponent-select');
      if (oSel) oSel.value = this.opponentMode;
    }

    if (this.ctx?.ai?.configure) {
      this.ctx.ai.configure({
        enabled: aiEnabled,
        cpuColor,
        whiteDifficulty: whiteDiff,
        blackDifficulty: blackDiff,
        difficulty: blackDiff,
      });
    }

    // Update 3D PieceManager families (works both mid-game and on reset)
    const pm = this.ctx?.pieces || this.ctx?.pieceManager;
    if (pm?.setWhiteFamily) pm.setWhiteFamily(whiteFamily);
    if (pm?.setRivalSetMode) pm.setRivalSetMode(rivalSet);

    // Emit configuration changes to Bus & Piece Manager
    if (this.ctx?.bus) {
      if (!pm?.setWhiteFamily && !pm?.setRivalSetMode) {
        this.ctx.bus.emit({
          type: 'PIECE_SET_CHANGED',
          whiteFamily,
          rivalSetMode: rivalSet,
        });
      }

      if (whitePlayerType === 'human') {
        this.ctx.bus.emit({
          type: 'PROFILE_CHANGED',
          profileId: whiteProfile,
          restoreBoard: false,
        });
      }

      this.ctx.bus.emit({
        type: 'OPPONENT_CHANGED',
        mode: this.opponentMode,
        enabled: aiEnabled,
        whitePlayerType,
        blackPlayerType,
        cpuColor,
        difficulty: blackDiff,
        whiteDifficulty: whiteDiff,
        blackDifficulty: blackDiff,
      });

      // Reset chess board only when starting a New Game (resetBoard !== false)
      if (resetBoard) {
        this.ctx.board?.reset?.();
      }
      this.ctx.bus.flush?.();
      this.ctx.bus.flush?.();
    }

    const isIt = this.lang === 'it';
    const wDesc =
      whitePlayerType === 'ai'
        ? `AI (${whiteDiff})`
        : isIt
          ? `Umano (${whiteProfile})`
          : `Human (${whiteProfile})`;
    const bDesc =
      blackPlayerType === 'ai'
        ? `AI (${blackDiff})`
        : isIt
          ? 'Umano (Hotseat)'
          : 'Human (Hotseat)';
    const actionLabel = resetBoard
      ? isIt
        ? 'Nuova partita'
        : 'New match'
      : isIt
        ? 'Partita aggiornata'
        : 'Match updated';
    this.logToQuake(
      'SETUP',
      `${actionLabel}: ⚪ ${whiteFamily} [${wDesc}] vs ⚫ ${rivalSet} [${bDesc}]`,
      'green',
    );
    this.showToast(
      isIt
        ? resetBoard
          ? `🏰 Nuova partita! Bianco: ${whiteFamily} [${wDesc}] vs Nero: ${rivalSet} [${bDesc}] · Barra nascosta ('M' o '☰')`
          : `⚙️ Partita aggiornata (senza reset)! Bianco: ${whiteFamily} [${wDesc}] vs Nero: ${rivalSet} [${bDesc}]`
        : resetBoard
          ? `🏰 New match! White: ${whiteFamily} [${wDesc}] vs Black: ${rivalSet} [${bDesc}] · Top bar hidden ('M' or '☰')`
          : `⚙️ Match updated (no reset)! White: ${whiteFamily} [${wDesc}] vs Black: ${rivalSet} [${bDesc}]`,
      4000,
    );
  }

  setTopbarVisible(visible) {
    this.topbarVisible = Boolean(visible);
    if (!this.rootEl) return;
    const topbar = this.rootEl.querySelector('#hud-topbar');
    if (topbar) {
      topbar.classList.toggle('hidden', !this.topbarVisible);
    }
    const btn = this.rootEl.querySelector('#hud-toggle-topbar-btn');
    if (btn) {
      btn.classList.toggle('active', this.topbarVisible);
      const lbl =
        this.lang === 'it'
          ? this.topbarVisible
            ? 'Nascondi la barra in alto'
            : 'Mostra la barra in alto'
          : this.topbarVisible
            ? 'Hide top bar'
            : 'Show top bar';
      btn.title = lbl;
      btn.setAttribute('aria-label', lbl);
    }
  }

  toggleTopbar() {
    this.setTopbarVisible(!this.topbarVisible);
    this.logToQuake(
      'UI',
      this.lang === 'it'
        ? `Barra superiore ${this.topbarVisible ? 'visibile' : 'nascosta'}.`
        : `Top bar ${this.topbarVisible ? 'visible' : 'hidden'}.`,
    );
  }

  openQuakeConsole() {
    this.quakeConsoleOpen = true;
    if (!this.rootEl) return;
    const con = this.rootEl.querySelector('#hud-quake-console');
    if (con) {
      con.classList.add('open');
      const input = this.rootEl.querySelector('#quake-input');
      setTimeout(() => input?.focus(), 50);
    }
  }

  closeQuakeConsole() {
    this.quakeConsoleOpen = false;
    if (!this.rootEl) return;
    const con = this.rootEl.querySelector('#hud-quake-console');
    if (con) con.classList.remove('open');
  }

  toggleQuakeConsole() {
    if (this.quakeConsoleOpen) {
      this.closeQuakeConsole();
    } else {
      this.openQuakeConsole();
    }
  }

  clearQuakeLogs() {
    this.quakeLogs = [];
    if (!this.rootEl) return;
    const out = this.rootEl.querySelector('#quake-log-body, #quake-output');
    if (out) out.innerHTML = '';
  }

  logToQuake(tag = 'LOG', message = '', colorClass = '') {
    const time = new Date().toTimeString().slice(0, 8);
    const entry = { time, tag, message, colorClass };
    this.quakeLogs.push(entry);
    if (this.quakeLogs.length > 250) {
      this.quakeLogs.shift();
    }

    if (!this.rootEl) return;
    const out = this.rootEl.querySelector('#quake-log-body, #quake-output');
    if (!out) return;

    const row = document.createElement('div');
    row.className = 'quake-line';
    const tagCls = colorClass ? `quake-tag ${colorClass}` : 'quake-tag';
    row.innerHTML = `<span class="quake-time">[${time}]</span> <span class="${tagCls}">[${tag}]</span> <span class="quake-msg">${this._escapeHtml(message)}</span>`;
    out.appendChild(row);
    out.scrollTop = out.scrollHeight;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  handleQuakeCommand(cmdRaw = '') {
    const cmd = cmdRaw.trim();
    if (!cmd) return;
    this.logToQuake('USER', `> ${cmd}`, 'cyan');

    const [action] = cmd.toLowerCase().split(/\s+/);
    switch (action) {
      case 'help':
      case '?':
        this.logToQuake('INFO', 'Available commands / Comandi disponibili:', 'gold');
        this.logToQuake('INFO', '  help             - Show this list / Mostra questo elenco');
        this.logToQuake('INFO', '  setup            - Open player & faction setup');
        this.logToQuake('INFO', '  topbar           - Show/Hide top bar');
        this.logToQuake('INFO', '  fen              - Show and copy current FEN');
        this.logToQuake('INFO', '  pgn              - Show current PGN history');
        this.logToQuake('INFO', '  hint             - Request move hint');
        this.logToQuake('INFO', '  reset / new      - Reset chess board');
        this.logToQuake('INFO', '  matrix           - Open interactive 6x6 battle matrix');
        this.logToQuake('INFO', '  swamp            - Splash pieces in the swamp');
        this.logToQuake('INFO', '  skeletons        - Toggle 3D skeletons');
        this.logToQuake('INFO', '  clear            - Clear console');
        this.logToQuake('INFO', '  close / exit     - Close Quake console');
        break;

      case 'setup':
        this.openSetupModal();
        break;

      case 'topbar':
        this.toggleTopbar();
        break;

      case 'fen': {
        const fen = this.ctx?.board?.fen?.() || 'FEN unavailable';
        this.logToQuake('FEN', fen, 'gold');
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(fen).catch(() => {});
        }
        break;
      }

      case 'pgn': {
        const pgn = this.ctx?.board?.pgn?.() || 'PGN unavailable';
        this.logToQuake('PGN', pgn, 'gold');
        break;
      }

      case 'hint':
        this.rootEl?.querySelector('#hud-hint-btn')?.click();
        this.logToQuake('HINT', 'Hint request sent.');
        break;

      case 'reset':
      case 'new':
        this.ctx?.board?.reset?.();
        this.ctx?.bus?.flush?.();
        this.logToQuake('RESET', 'Board reset to starting position.', 'green');
        break;

      case 'matrix':
        this.openMatrix36Modal();
        break;

      case 'swamp':
        this.rootEl?.querySelector('#hud-swamp-btn')?.click();
        break;

      case 'skeletons':
        this.rootEl?.querySelector('#hud-skeletons-btn')?.click();
        break;

      case 'clear':
        this.clearQuakeLogs();
        break;

      case 'close':
      case 'exit':
      case 'quit':
        this.closeQuakeConsole();
        break;

      default:
        this.logToQuake(
          'ERR',
          `Unknown command: "${cmd}". Type "help" for available commands.`,
          'red',
        );
        break;
    }
  }

  // ===========================================================================
  // 2. EVENT BUS HANDLERS
  // ===========================================================================

  onFlowStateChanged(e) {
    this.flowState = e.to;
    if (!this.rootEl) return;

    const isWow = e.to === 'Mode2_WowArena';
    this.rootEl.querySelector('#hud-mode1-btn')?.classList.toggle('active', !isWow);
    this.rootEl.querySelector('#hud-mode2-btn')?.classList.toggle('active', isWow);

    const wowPanel = this.rootEl.querySelector('#hud-wow-panel');
    if (wowPanel) {
      wowPanel.style.display = isWow ? 'flex' : 'none';
    }
  }

  onBoardReset(e) {
    this.turn = e.turn || 'w';
    this.inCheck = false;
    this.pendingPromotion = null;
    this.updateTurnAndCheckUi();
    if (this.rootEl) {
      this.rootEl.querySelector('#hud-gameover-modal').style.display = 'none';
      this.rootEl.querySelector('#hud-promo-modal').style.display = 'none';
    }
  }

  onPieceHovered(e) {
    const type = String(e?.piece?.type || e?.pieceType || e?.type || '').toLowerCase();
    const char = CHARACTER_REGISTRY[type];
    const v = VOICE_LINES[type];
    if (!char || !v) return;
    const hoverLabel = v.hoverSound?.label?.[this.lang] || v.hoverSound?.label?.en || v.hoverSound?.label?.it || '';
    this.lastHoverSound = hoverLabel;
    // Show subtle creature sound cue if not currently showing a battle or selection toast
    if (!this.activeBanner && hoverLabel) {
      this.showToast(`${char.glyph} ${char.name} (${e.square || ''}) — ${hoverLabel}`, 1100);
    }
  }

  onPieceSelected(e) {
    this._lastSelectedEvent = e;
    const type = String(e.piece?.type || e.pieceType || '').toLowerCase();
    const char = CHARACTER_REGISTRY[type];
    if (!char) return;
    const v = VOICE_LINES[type];
    const quote = this._pendingSpokenQuote || v?.quote?.[this.lang] || v?.quote?.it || '';
    this._pendingSpokenQuote = null;
    this.lastVoiceQuote = quote;
    this._renderSelectionToast(e, char, quote);
  }

  onVoiceLineSpoken(e) {
    if (!e?.quote) return;
    this.lastVoiceQuote = e.quote;
    const type = String(e.pieceType || '').toLowerCase();
    const char = CHARACTER_REGISTRY[type];
    if (char && this._lastSelectedEvent && (!e.square || this._lastSelectedEvent.square === e.square)) {
      this._renderSelectionToast(this._lastSelectedEvent, char, e.quote);
    } else {
      this._pendingSpokenQuote = e.quote;
    }
  }

  _renderSelectionToast(e, char, quote) {
    const legalMoves = e.legalMoves || [];
    const firstCapture = legalMoves.find(
      (m) =>
        m.captured ||
        (typeof m.flags === 'string' && (m.flags.includes('c') || m.flags.includes('e'))),
    );

    if (firstCapture) {
      const defType =
        firstCapture.captured || this.ctx?.board?.pieceAt?.(firstCapture.to)?.type || 'p';
      const defChar = CHARACTER_REGISTRY[defType] || CHARACTER_REGISTRY.p;
      const pairCode = `${char.type.toUpperCase()}×${defChar.type.toUpperCase()}`;
      const voicePart = quote ? ` 💬 "${quote}" · ` : ' ';
      this.showToast(
        this.lang === 'it'
          ? `${char.glyph} ${char.name}:${voicePart}⚔️ Cattura ${defChar.glyph} ${defChar.name} (${pairCode}) — Clicca per la Scazzottata 3D!`
          : `${char.glyph} ${char.name}:${voicePart}⚔️ Capture ${defChar.glyph} ${defChar.name} (${pairCode}) — Click for 3D Brawl!`,
        3400,
      );
      return;
    }

    const voicePrefix = quote ? `💬 "${quote}" — ` : '';
    const msg =
      this.lang === 'it'
        ? `${char.glyph} ${char.name} (${e.square}): ${voicePrefix}${legalMoves.length} mosse possibili`
        : `${char.glyph} ${char.name} (${e.square}): ${voicePrefix}${legalMoves.length} legal moves`;
    this.showToast(msg, 2400);
  }

  onCapturePreviewHover(e) {
    if (!e) return;
    const atkChar = CHARACTER_REGISTRY[e.attacker] || CHARACTER_REGISTRY.b;
    const defChar = CHARACTER_REGISTRY[e.defender] || CHARACTER_REGISTRY.p;
    const pairCode = e.pairCode || `${atkChar.type.toUpperCase()}×${defChar.type.toUpperCase()}`;
    const msg =
      this.lang === 'it'
        ? e.toastTextIt ||
          `⚔️ Cattura possibile: ${atkChar.glyph} ${atkChar.name} vs ${defChar.glyph} ${defChar.name} (${pairCode}) — Clicca per la Scazzottata 3D!`
        : e.toastTextEn ||
          `⚔️ Possible capture: ${atkChar.glyph} ${atkChar.name} vs ${defChar.glyph} ${defChar.name} (${pairCode}) — Click for 3D Brawl!`;
    this.showToast(msg, 3200);
  }

  onSkeletonsToggled(e) {
    if (typeof e?.visible === 'boolean') {
      this.skeletonsVisible = e.visible;
    } else {
      this.skeletonsVisible = !this.skeletonsVisible;
    }
    if (this.rootEl) {
      this.rootEl
        .querySelector('#hud-skeletons-btn')
        ?.classList.toggle('active', this.skeletonsVisible);
    }
  }

  onMoveExecuted(e) {
    this.turn = e.turn || 'w';
    this.inCheck = false;
    this.updateTurnAndCheckUi();
    const side = e.color === 'w' ? '⚪ White' : '⚫ Black';
    const moveStr = e.san || (e.from && e.to ? `${e.from} → ${e.to}` : 'move');
    this.logToQuake('MOVE', `${side}: ${moveStr}`);
  }

  onCheckDetected(e) {
    this.inCheck = true;
    this.turn = e.color || this.turn;
    this.updateTurnAndCheckUi();
    const side = e.color === 'w' ? '⚪ White King' : '⚫ Black King';
    this.logToQuake('CHECK', `⚠️ ${side} is in check!`, 'gold');
  }

  onCheckmate(e) {
    if (!this.rootEl) return;

    const modal = this.rootEl.querySelector('#hud-gameover-modal');
    const title = this.rootEl.querySelector('#hud-gameover-title');
    const sub = this.rootEl.querySelector('#hud-gameover-sub');
    if (title) title.textContent = this.t('checkmateTitle');
    if (sub) {
      const winnerName =
        e.winner === 'w'
          ? this.lang === 'it'
            ? 'Squadra Bianca (Avorio & Oro) 👑'
            : 'White Team (Ivory & Gold) 👑'
          : this.lang === 'it'
            ? 'Squadra Nera (Ossidiana & Argento) ⚔️'
            : 'Black Team (Obsidian & Silver) ⚔️';
      sub.textContent =
        this.lang === 'it'
          ? `Vittoria epica per: ${winnerName}!`
          : `Epic victory for: ${winnerName}!`;
    }
    const winnerTag = e.winner === 'w' ? '⚪ White' : '⚫ Black';
    this.logToQuake('MATE', `🏆 CHECKMATE! Victory for ${winnerTag}!`, 'green');

    const bannerText =
      this.lang === 'it'
        ? '👑 CAPITOLAZIONE DEL RE! SCACCO MATTO! 💥'
        : '👑 KING CAPITULATION! CHECKMATE! 💥';
    this.activeBanner = bannerText;

    // Show the Royal Capitulation comic banner while the 4.2s 3D King Capitulation plays on the board!
    const bannerEl = this.rootEl.querySelector('#hud-comic-banner');
    const textEl = this.rootEl.querySelector('#hud-comic-text');
    if (textEl) textEl.textContent = bannerText;
    if (bannerEl) bannerEl.style.display = 'inline-flex';

    if (this.checkmateModalTimer) clearTimeout(this.checkmateModalTimer);
    this.checkmateModalTimer = setTimeout(() => {
      this.checkmateModalTimer = null;
      this.onBattleEnded();
      if (modal) modal.style.display = 'grid';
    }, 4200);
  }

  onDraw(e) {
    if (!this.rootEl) return;
    const modal = this.rootEl.querySelector('#hud-gameover-modal');
    const title = this.rootEl.querySelector('#hud-gameover-title');
    const sub = this.rootEl.querySelector('#hud-gameover-sub');
    if (title) title.textContent = this.t('drawTitle');
    if (sub) {
      sub.textContent =
        this.lang === 'it'
          ? `Partita patta (${e.reason || 'equilibrio magico'}) 🤝`
          : `Match drawn (${e.reason || 'magical balance'}) 🤝`;
    }
    if (modal) modal.style.display = 'grid';
    this.logToQuake('DRAW', `🤝 Match drawn: ${e.reason || 'draw'}`, 'cyan');
  }

  onPromotionPending(e) {
    this.pendingPromotion = e;
    if (!this.rootEl) return;
    const modal = this.rootEl.querySelector('#hud-promo-modal');
    if (modal) modal.style.display = 'grid';
  }

  onLuckChanged(e) {
    const pid = e.playerId || 'w';
    this.luck[pid] = e.luck ?? 0;
    this.luck.max = e.maxLuck ?? 12;
    this.updateLuckUi(pid);
    if (this.luck[pid] >= (this.luck.max || 12)) {
      this.logToQuake(
        'LUCK',
        `✨ MAX LUCK for ${pid === 'w' ? '⚪ White' : '⚫ Black'}! Guaranteed Golden Crit on next capture!`,
        'gold',
      );
    }
  }

  onDropSpawned(e) {
    if (e.sticker?.id) {
      this.unlockedStickers.add(e.sticker.id);
      this.renderStickersUi();
      const stickerLabel = e.sticker.name?.[this.lang] || e.sticker.name?.en || e.sticker.name?.it || e.sticker.id;
      const prefix = this.lang === 'it' ? '🌟 STICKER SBLOCCATO' : '🌟 STICKER UNLOCKED';
      this.showToast(`${prefix}: ${stickerLabel}!`, 3600);
      this.logToQuake('STICKER', `${prefix}: ${stickerLabel}!`, 'gold');
    }
  }

  onLuckReset(e) {
    const pid = e.playerId || 'w';
    this.luck[pid] = 0;
    this.updateLuckUi(pid);
  }

  onBattleStarted(e) {
    const richBanner = this.battleMatrix36?.[e.attacker]?.[e.defender]?.banner;
    const bannerObj = e.banner || richBanner || BATTLE_MATRIX[e.attacker]?.[e.defender]?.banner;
    const text = bannerObj?.[this.lang] || bannerObj?.en || bannerObj?.it || 'KNOCKOUT! ✨';
    this.activeBanner = text;
    this.battleStartedAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Mobile Simplified UX: on the FIRST attack/capture, automatically unlock 3D camera mode!
    // Emitting CAMERA_VIEW_REQUESTED updates VFXPoolView.camSaved so when the battle finishes,
    // the camera smoothly restores to the 3D panoramic angle instead of overhead Top-Down.
    if (this.isMobilePhone && this.mobileAwaitingFirstAttack3D) {
      this.mobileAwaitingFirstAttack3D = false;
      this.topDownCamera = false;
      this.justUnlockedMobile3D = true;
      const pos3d = {
        x: 0,
        y: this.cameraFlipped ? 7.0 : 7.2,
        z: this.cameraFlipped ? -8.2 : 9.8,
      };
      const target3d = { x: 0, y: 0.3, z: 0 };
      this.ctx?.bus?.emit({
        type: 'CAMERA_VIEW_REQUESTED',
        view: 'default',
        pos: pos3d,
        target: target3d,
      });
    }

    if (!this.rootEl) return;
    // Hide the left WOW drawer, center toast, karaoke caption, and comic banner during combat
    // so the Netflix Maxischermo + 3D fight is 100% pure and free of any header/footer clutter!
    const wowPanel = this.rootEl.querySelector('#hud-wow-panel');
    if (wowPanel) wowPanel.style.display = 'none';
    const toastEl = this.rootEl.querySelector('#hud-toast');
    if (toastEl) toastEl.style.display = 'none';
    const lyriaCap = this.rootEl.querySelector('#hud-lyria-caption');
    if (lyriaCap) lyriaCap.style.display = 'none';

    const bannerEl = this.rootEl.querySelector('#hud-comic-banner');
    const textEl = this.rootEl.querySelector('#hud-comic-text');
    if (textEl) textEl.textContent = text;
    if (bannerEl) bannerEl.style.display = 'none';

    if (!this.ctx?.scene?.userData?.vfxControlsCombatBlend) {
      this.setCombatBlend(1.0);
    }

    this.logToQuake(
      'BATTLE',
      `🥊 3D Brawl: ${e.attacker?.toUpperCase()} vs ${e.defender?.toUpperCase()} (${e.square || ''}) — "${text}"`,
      'gold',
    );
  }

  onBattleEnded() {
    this.activeBanner = null;
    if (this.isMobilePhone && this.justUnlockedMobile3D) {
      this.justUnlockedMobile3D = false;
      this.applyMobileCameraMode('3d', { silent: true });
      this.showToast(this.t('mobile3dUnlockedToast'), 3800);
    }
    if (!this.rootEl) return;
    const bannerEl = this.rootEl.querySelector('#hud-comic-banner');
    if (bannerEl) bannerEl.style.display = 'none';
    // Restore WOW drawer if we returned to Mode2_WowArena
    const wowPanel = this.rootEl.querySelector('#hud-wow-panel');
    if (wowPanel) {
      wowPanel.style.display = this.flowState === 'Mode2_WowArena' ? 'flex' : 'none';
    }
    if (!this.ctx?.scene?.userData?.vfxControlsCombatBlend) {
      this.setCombatBlend(0.0);
    }
    this.logToQuake('BATTLE', '✨ Clash completed.');
  }

  /**
   * Smoothly hides all HUD chrome (header `#hud-topbar`, footer `.hud-bottombar`, status card, banners)
   * as `blend` goes `0.0 -> 1.0` during Netflix Maxischermo combat, and smoothly restores them
   * as `blend` glides `1.0 -> 0.0` during the sliding-window exit!
   * @param {number} blend
   */
  setCombatBlend(blend) {
    const b = Math.max(0, Math.min(1, Number.isFinite(blend) ? blend : 0));
    this.combatBlend = b;
    if (!this.rootEl) return;

    const hudAlpha = b >= 0.96 ? 0 : Math.max(0, Math.min(1, Math.pow(1 - b, 2.4)));
    const topBar = this.rootEl.querySelector('#hud-topbar');
    const bottomBar = this.rootEl.querySelector('.hud-bottombar');
    const bannerEl = this.rootEl.querySelector('#hud-comic-banner');
    const toastEl = this.rootEl.querySelector('#hud-toast');
    const lyriaCap = this.rootEl.querySelector('#hud-lyria-caption');

    if (topBar) {
      topBar.style.opacity = String(hudAlpha);
      topBar.style.transform = b > 0.002 ? `translateY(${(-32 * b).toFixed(1)}px)` : '';
      topBar.style.pointerEvents = b > 0.12 ? 'none' : 'auto';
    }
    if (bottomBar) {
      bottomBar.style.opacity = String(hudAlpha);
      bottomBar.style.transform = b > 0.002 ? `translateY(${(32 * b).toFixed(1)}px)` : '';
      const interactiveChildren = bottomBar.querySelectorAll('.hud-interactive');
      interactiveChildren.forEach((el) => {
        el.style.pointerEvents = b > 0.12 ? 'none' : 'auto';
      });
    }
    if (b > 0.02) {
      if (bannerEl) bannerEl.style.display = 'none';
      if (toastEl) toastEl.style.display = 'none';
      if (lyriaCap) lyriaCap.style.display = 'none';
    }
  }

  onAiThinking(e) {
    const side = e?.color === 'w' ? '⚪ White' : '⚫ Black';
    const diff =
      e?.difficulty ||
      (e?.color === 'w' ? this.whiteDifficulty : this.blackDifficulty) ||
      'easy';
    this.logToQuake('AI', `🤖 AI thinking (${side} - ${diff})...`, 'cyan');
  }

  onAiMoveReady(e) {
    const move = e?.move;
    const notation = move
      ? `${move.from} → ${move.to}${move.promotion ? '=' + move.promotion : ''}`
      : '?';
    const ms = typeof e?.timeMs === 'number' ? ` in ${e.timeMs}ms` : '';
    this.logToQuake('AI', `🎯 AI move ready: ${notation}${ms}`, 'green');
  }

  onHintSuggested(e) {
    const expl =
      this.lang === 'it'
        ? e.explanationIt || e.explanation
        : e.explanationEn || e.explanation;
    if (expl) {
      this.showToast(`💡 ${expl}`, 3500);
      this.logToQuake('HINT', `💡 ${expl}`, 'gold');
    }
  }

  onLanguageChanged(e) {
    this.lang = e.lang === 'it' ? 'it' : 'en';
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = this.lang;
    }
    this.refreshTranslations();
  }

  onProfileChanged(e) {
    this.activeProfile = e.profileId || 'ale';
    if (this.rootEl) {
      const sel = this.rootEl.querySelector('#hud-profile-select');
      if (sel) sel.value = this.activeProfile;
    }
  }

  onProfileRestored(e) {
    if (Array.isArray(e.stickers)) {
      this.unlockedStickers = new Set(e.stickers);
      this.renderStickersUi();
    }
    if (typeof e.luck === 'number') {
      this.luck.w = e.luck;
      this.updateLuckUi('w');
    }
  }

  onLyriaCaption(e) {
    if (!this.rootEl) return;
    const cap = this.rootEl.querySelector('#hud-lyria-caption');
    if (!cap) return;
    if (e.text && this.combatBlend <= 0.02) {
      cap.textContent = `🎵 ${e.text}`;
      cap.style.display = 'block';
    } else {
      cap.style.display = 'none';
    }
  }

  onPieceSetChanged(e) {
    if (e.whiteFamily) this.whiteFamily = e.whiteFamily;
    if (e.rivalSetMode) this.rivalSet = e.rivalSetMode;
    if (this.rootEl) {
      const wSel = this.rootEl.querySelector('#hud-white-select');
      if (wSel && this.whiteFamily) wSel.value = this.whiteFamily;
      const bSel = this.rootEl.querySelector('#hud-rival-select');
      if (bSel && this.rivalSet) bSel.value = this.rivalSet;
    }
  }

  isCombatCutsceneActive() {
    const combat = this.ctx?.combat || this.ctx?.combatManager;
    return Boolean(
      this.activeBanner ||
        this.flowState === 'CaptureCutscene' ||
        (combat && typeof combat.isActive === 'function' && combat.isActive()),
    );
  }

  onCombatPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!this.isCombatCutsceneActive()) {
      this.combatPointerStart = null;
      return;
    }
    this.combatPointerStart = {
      x: e.clientX ?? 0,
      y: e.clientY ?? 0,
    };
  }

  onCombatPointerUp(e) {
    if (!this.combatPointerStart) return;
    const start = this.combatPointerStart;
    this.combatPointerStart = null;

    if (!this.isCombatCutsceneActive()) return;
    if (this.setupModalOpen || this.matrixModalOpen || this.quakeConsoleOpen) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Guard against the initial square-tap that triggered the capture move (< 350ms ago)
    if (this.battleStartedAtMs && now - this.battleStartedAtMs < 350) return;

    const dx = (e.clientX ?? 0) - start.x;
    const dy = (e.clientY ?? 0) - start.y;
    const maxTapDist = e.pointerType === 'touch' ? 20 : 12;
    if (Math.hypot(dx, dy) > maxTapDist) {
      // Allow drag-to-orbit without exiting
      return;
    }

    this.skipActiveCutscene('user_click');
  }

  onKeyDown(e) {
    const targetTag = e.target?.tagName?.toLowerCase();
    const isTextInput =
      targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

    // Toggle Quake console with `, ~, \, §
    if (e.key === '`' || e.key === '~' || e.key === '\\' || e.key === '§') {
      if (!isTextInput || e.target?.id === 'quake-input') {
        e.preventDefault();
        this.toggleQuakeConsole();
        return;
      }
    }

    if (e.code === 'Escape') {
      if (this.quakeConsoleOpen) {
        e.preventDefault();
        this.closeQuakeConsole();
        return;
      }
      if (this.setupModalOpen) {
        e.preventDefault();
        this.closeSetupModal();
        return;
      }
      if (this.matrixModalOpen) {
        e.preventDefault();
        this.closeMatrix36Modal();
        return;
      }
      if (this.isCombatCutsceneActive()) {
        e.preventDefault();
        this.skipActiveCutscene('escape');
        return;
      }
    }

    // Hotkey 'm' / 'M' to toggle topbar when not typing in an input
    if (!isTextInput && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      this.toggleTopbar();
      return;
    }

    // Hotkey 'r' / 'R' to reset camera view when not typing in an input
    if (!isTextInput && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      this.resetCameraView();
      return;
    }

    if ((e.code === 'Space' || e.code === 'Enter') && !isTextInput) {
      if (this.isCombatCutsceneActive()) {
        e.preventDefault();
        this.skipActiveCutscene(e.code === 'Enter' ? 'enter' : 'spacebar');
      }
    }
  }

  skipActiveCutscene(reason = 'user_skip') {
    if (this.checkmateModalTimer) {
      clearTimeout(this.checkmateModalTimer);
      this.checkmateModalTimer = null;
      this.onBattleEnded();
      const modal = this.rootEl?.querySelector('#hud-gameover-modal');
      if (modal) modal.style.display = 'grid';
      return;
    }
    const combat = this.ctx?.combat || this.ctx?.combatManager;
    if (combat?.skip) {
      combat.skip(reason);
    } else {
      this.ctx?.bus?.emit({ type: 'BATTLE_SKIPPED', reason });
    }
    this.ctx?.bus?.flush?.();
  }

  // ===========================================================================
  // 3. UI HELPERS & BILINGUAL REFRESH
  // ===========================================================================

  updateTurnAndCheckUi() {
    if (!this.rootEl) return;
    const turnEl = this.rootEl.querySelector('#hud-turn-text');
    const checkEl = this.rootEl.querySelector('#hud-check-badge');
    if (turnEl) {
      turnEl.textContent =
        this.turn === 'w' ? `⚪ ${this.t('turnWhite')}` : `⚫ ${this.t('turnBlack')}`;
    }
    if (checkEl) {
      checkEl.textContent = this.t('checkAlert');
      checkEl.style.display = this.inCheck ? 'inline-block' : 'none';
    }
  }

  updateLuckUi(playerId = 'w') {
    if (!this.rootEl) return;
    const val = this.luck[playerId] ?? this.luck.w ?? 0;
    const max = this.luck.max || 12;
    const pct = Math.min(100, Math.round((val / max) * 100));

    const valEl = this.rootEl.querySelector('#hud-luck-val');
    const fillEl = this.rootEl.querySelector('#hud-luck-fill');
    const trackEl = this.rootEl.querySelector('#hud-luck-track');
    if (valEl) valEl.textContent = `${val} / ${max} ✨`;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (trackEl) trackEl.classList.toggle('hot', val >= 9);
  }

  renderStickersUi() {
    if (!this.rootEl) return;
    const row = this.rootEl.querySelector('#hud-stickers-row');
    if (!row) return;
    const badges = FAMILY_STICKERS.filter((s) => this.unlockedStickers.has(s.id)).map((s) => {
      const label = s.name[this.lang] || s.name.en || s.name.it;
      return `<span style="background:#263248;border:1px solid #ffd54f;border-radius:999px;padding:2px 7px;font-size:11px;color:#ffe082;">${label}</span>`;
    });
    row.innerHTML = badges.join('');
  }

  showToast(message, durationMs = 2600) {
    this.lastToast = message;
    if (!this.rootEl) return;
    const el = this.rootEl.querySelector('#hud-toast');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.style.display = 'none';
    }, durationMs);
  }

  refreshTranslations() {
    if (!this.rootEl) return;
    const setTxt = (sel, key) => {
      const el = this.rootEl.querySelector(sel);
      if (el) el.textContent = this.t(key);
    };

    // Highlight active language flag buttons (🇬🇧 EN / 🇮🇹 IT) across Topbar, Setup Modal, and Bottom Dock
    this.rootEl.querySelectorAll('button[data-set-lang]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.setLang === this.lang);
    });

    // Topbar & Opponent/Set dropdowns
    setTxt('#hud-title', 'title');
    setTxt('#hud-subtitle', 'subtitle');
    setTxt('#hud-mode1-btn', 'mode1Btn');
    setTxt('#hud-mode2-btn', 'mode2Btn');
    setTxt('#hud-matrix-btn', 'matrixBtn');
    setTxt('#hud-top-gallery-link', 'galleryBtn');
    setTxt('#hud-who-label', 'whoPlays');
    setTxt('#hud-opponent-select option[value="hotseat"]', 'hotseat');
    setTxt('#hud-opponent-select option[value="easy"]', 'cpuEasy');
    setTxt('#hud-opponent-select option[value="medium"]', 'cpuMed');
    setTxt('#hud-opponent-select option[value="hard"]', 'cpuHard');
    setTxt('#hud-white-select option[value="carlesso"]', 'setWhiteCarlesso');
    setTxt('#hud-white-select option[value="swamp"]', 'setWhiteSwamp');
    setTxt('#hud-white-select option[value="classic"]', 'setWhiteClassic');
    setTxt('#hud-rival-select option[value="family"]', 'setFamily');
    setTxt('#hud-rival-select option[value="swamp"]', 'setSwamp');
    setTxt('#hud-rival-select option[value="classic"]', 'setClassic');
    setTxt('#hud-rival-select option[value="stone"]', 'setStone');

    // Bottom Status & Material Icon Action Dock (preserve <svg> icons, update title/aria-label)
    const setTip = (sel, key) => {
      const el = this.rootEl.querySelector(sel);
      if (!el) return;
      const lbl = this.t(key);
      el.title = lbl;
      el.setAttribute('aria-label', lbl);
    };
    setTxt('#hud-luck-label', 'luckBar');
    setTip('#hud-dock-gallery', 'galleryBtn');
    setTip('#hud-dock-videos', 'videosBtn');
    setTip('#hud-setup-btn', 'setupBtn');
    setTip('#hud-matrix36-btn', 'matrixBtn');
    setTip('#hud-hint-btn', 'hintBtn');
    setTip('#hud-skeletons-btn', 'skeletonsBtn');
    setTip('#hud-swamp-btn', 'swampBtn');
    setTip('#hud-flip-btn', 'flipCamBtn');
    setTip('#hud-reset-cam-btn', 'resetCamBtn');
    setTip('#hud-top-btn', this.isMobilePhone ? (this.topDownCamera ? 'mobileCamTopBtn' : 'mobileCam3dBtn') : 'topCamBtn');
    const topBadge = this.rootEl.querySelector('#hud-top-badge');
    if (topBadge) topBadge.textContent = this.topDownCamera ? '2D' : '3D';
    setTip('#hud-new-btn', 'newGameBtn');
    setTip('#hud-fen-btn', 'fenBtn');
    setTip('#hud-music-btn', 'musicBtn');
    setTip('#hud-sfx-btn', 'sfxBtn');
    setTxt('#hud-skip-btn', 'skipBtn');
    const toggleBtn = this.rootEl.querySelector('#hud-toggle-topbar-btn');
    if (toggleBtn) {
      const lbl = this.topbarVisible ? this.t('toggleTopbarBtn') : this.t('showTopbarBtn');
      toggleBtn.title = lbl;
      toggleBtn.setAttribute('aria-label', lbl);
    }

    // Startup & Match Setup Modal
    setTxt('#hud-setup-title', this.isMobilePhone ? 'mobileQuickTitle' : 'setupTitle');
    setTxt('#hud-setup-sub', this.isMobilePhone ? 'mobileQuickSub' : 'setupSub');
    setTxt('#hud-rotate-title', 'rotateTitle');
    setTxt('#hud-rotate-sub', 'rotateSub');
    setTxt('#hud-rotate-dismiss-btn', 'rotateDismissBtn');
    setTxt('#hud-mobile-you-lbl', 'mobileQuickYou');
    setTxt('#hud-mobile-papino-team', 'mobileQuickPapinoTeam');
    setTxt('#hud-mobile-cpu-lbl', 'mobileQuickCpu');
    setTxt('#hud-mobile-cpu-team', 'mobileQuickCpuTeam');
    setTxt('#hud-mobile-diff-easy', 'mobileDiffEasy');
    setTxt('#hud-mobile-diff-medium', 'mobileDiffMed');
    setTxt('#hud-mobile-diff-hotseat', 'mobileDiff2P');
    setTxt('#hud-mobile-quick-play-btn', 'mobilePlayNowBtn');
    setTxt(
      '#hud-mobile-advanced-toggle',
      this.mobileAdvancedOpen ? 'mobileHideAdvBtn' : 'mobileAdvOptionsBtn',
    );
    setTxt('#hud-setup-white-title', 'whiteSide');
    setTxt('#hud-setup-black-title', 'blackSide');
    setTxt('#hud-setup-white-faction-lbl', 'factionLabel');
    setTxt('#hud-setup-black-faction-lbl', 'factionLabel');
    setTxt('#hud-setup-white-ctrl-lbl', 'controlLabel');
    setTxt('#hud-setup-black-ctrl-lbl', 'controlLabel');
    setTxt('#hud-setup-white-human-lbl', 'playerHuman');
    setTxt('#hud-setup-white-ai-lbl', 'playerAi');
    setTxt('#hud-setup-black-ai-lbl', 'playerAi');
    setTxt('#hud-setup-black-human-lbl', 'playerHumanHotseat');
    setTxt('#hud-setup-profile-lbl', 'profileLabel');
    setTxt('#hud-setup-white-diff-lbl', 'difficultyLabel');
    setTxt('#hud-setup-black-diff-lbl', 'difficultyLabel');
    setTxt('#hud-setup-white-set option[value="carlesso"]', 'setupWhiteCarlesso');
    setTxt('#hud-setup-white-set option[value="swamp"]', 'setupWhiteSwamp');
    setTxt('#hud-setup-white-set option[value="classic"]', 'setupWhiteClassic');
    setTxt('#hud-setup-black-set option[value="classic"]', 'setupBlackClassic');
    setTxt('#hud-setup-black-set option[value="swamp"]', 'setupBlackSwamp');
    setTxt('#hud-setup-black-set option[value="family"]', 'setupBlackFamily');
    setTxt('#hud-setup-black-set option[value="stone"]', 'setupBlackStone');
    setTxt('#hud-setup-white-diff option[value="easy"]', 'cpuEasy');
    setTxt('#hud-setup-white-diff option[value="medium"]', 'cpuMed');
    setTxt('#hud-setup-white-diff option[value="hard"]', 'cpuHard');
    setTxt('#hud-setup-black-diff option[value="easy"]', 'cpuEasy');
    setTxt('#hud-setup-black-diff option[value="medium"]', 'cpuMed');
    setTxt('#hud-setup-black-diff option[value="hard"]', 'cpuHard');
    setTxt('#hud-setup-black-human-wrap', 'hotseatDesc');
    setTxt('#hud-setup-apply-btn', 'applyCurrentBtn');
    setTxt('#hud-setup-start-btn', 'startMatchBtn');
    setTxt('#hud-setup-badge-text', 'defaultSetupBadge');

    // Mode 2 WOW Panel & Modals
    setTxt('#hud-promo-title', 'promoTitle');
    setTxt('#hud-play-again-btn', 'playAgainBtn');
    setTxt('#hud-fen-modal-title', 'fenModalTitle');
    setTxt('#hud-fen-load-btn', 'loadFenBtn');
    setTxt('#hud-pgn-load-btn', 'loadPgnBtn');
    setTxt('#hud-wow-tab-inspector', 'wowInspectorTab');
    setTxt('#hud-wow-tab-arena', 'wowArenaTab');
    setTxt('#hud-wow-matrix36-btn', 'matrix36Btn');
    setTxt('#hud-wow-choose-hero', 'wowChooseHero');
    setTxt('#hud-wow-anim-title', 'wowAnimTitle');
    setTxt('#hud-card-flip-btn', 'wowCardFlipBtn');
    setTxt('#hud-autorotate-btn', 'wowAutoRotateBtn');
    setTxt('#hud-wow-arena-title', 'wowArenaTitle');
    setTxt('#hud-wow-atk-lbl', 'wowAtkLabel');
    setTxt('#hud-wow-def-lbl', 'wowDefLabel');
    setTxt('#hud-wow-crit-lbl', 'wowCritLabel');
    setTxt('#hud-wow-clash-btn', 'triggerBattleBtn');
    setTxt('#hud-matrix36-title', 'matrix36ModalTitle');
    setTxt('#hud-matrix36-sub', 'matrix36ModalSub');
    if (!this.matrixMarathonTimer) {
      setTxt('#hud-matrix36-marathon-btn', 'matrix36MarathonBtn');
    }
    setTxt('#hud-matrix36-page-link', 'matrix36GalleryLink');
    setTxt('#hud-matrix36-close', 'closeBtn');
    setTxt('#hud-matrix36-launch-selected', 'matrix36LaunchBtn');

    this.updateTurnAndCheckUi();
    this.renderStickersUi();
    this._renderMatrixExplorerGrid();
    if (this.matrixSelectedPair) {
      this._updateMatrixPreviewPane(this.matrixSelectedPair.atk, this.matrixSelectedPair.def, false);
    }
  }

  dispose() {
    this.stopMatrix36Marathon();
    for (const off of this.offs) off();
    this.offs = [];
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.checkmateModalTimer) clearTimeout(this.checkmateModalTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._boundKeyDown);
      window.removeEventListener('pointerdown', this._boundCombatPointerDown);
      window.removeEventListener('pointerup', this._boundCombatPointerUp);
      window.removeEventListener('resize', this._boundViewportChange);
      window.removeEventListener('orientationchange', this._boundViewportChange);
    }
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
  }
}
