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
  FAMILY_STICKERS,
  PROFILES,
  I18N,
  APP_VERSION,
  GITHUB_REPO_URL,
  GITHUB_NEW_ISSUE_URL,
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

const COUNTER_LABELS_IT = {
  k: '⚡ Lampo Reale di Scettro (ZAP!)',
  q: '🛡️ Scudo Ciocco-Vortice Lilla (SWIRL!)',
  b: '🔥 Soffio Difensivo del Draghetto (FIAMMA!)',
  n: '🐴 Impennata e Doppio Calcio (IMPENNATA!)',
  r: '💜 Rimbalzo Pancia Gommoso (BOING!)',
  p: '⚔️ Parata d’Alabarda & Slap (PARATA!)',
};

export class HudListener {
  /**
   * @param {object} [ctx]
   */
  constructor(ctx = null) {
    this.ctx = ctx;
    /** @type {'it'|'en'} */
    this.lang = 'it';
    this.activeProfile = 'ale';
    this.opponentMode = 'hotseat';
    this.whiteFamily = 'carlesso';
    this.rivalSet = 'family';
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
    this.topDownCamera = false;
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
    this.offs = [];

    this._boundKeyDown = (e) => this.onKeyDown(e);

    if (ctx) {
      this.init(ctx);
    }
  }

  /**
   * @param {object} ctx
   */
  init(ctx = {}) {
    this.ctx = ctx;
    const bus = ctx.bus;

    if (typeof document !== 'undefined' && !this.rootEl) {
      this.buildDom();
      window.addEventListener('keydown', this._boundKeyDown);
    }

    if (typeof fetch === 'function') {
      fetch('./VERSION')
        .then((r) => (r.ok ? r.text() : null))
        .then((txt) => {
          if (txt && txt.trim()) {
            const v = txt.trim();
            this.appVersion = v.startsWith('v') ? v : `v${v}`;
            const el = this.rootEl?.querySelector?.('#hud-version-tag');
            if (el) el.textContent = this.appVersion;
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
      );
    }
  }

  t(key) {
    return I18N[this.lang]?.[key] || I18N.it[key] || key;
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

    let eggBadge = '';
    let eggClass = '';
    if ((atk === 'n' && def === 'r') || (atk === 'r' && def === 'n')) {
      eggBadge = '💜 Abbraccio';
      eggClass = 'cuddle';
    } else if ((atk === 'k' && def === 'q') || (atk === 'q' && def === 'k')) {
      eggBadge = "🚽 Trono d'Oro";
      eggClass = 'throne';
    } else if ((atk === 'b' && def === 'n') || (atk === 'n' && def === 'b')) {
      eggBadge = '🐉 vs 🏎️';
      eggClass = 'rivals';
    } else if (atk === def) {
      eggBadge = '🪞 Specchio';
      eggClass = 'mirror';
    }

    const titleText =
      richEntry.title?.[this.lang] ||
      richEntry.title?.it ||
      `${atkChar.glyph} ${atkChar.name} vs ${defChar.glyph} ${defChar.name}`;
    const bannerText =
      richEntry.banner?.[this.lang] ||
      richEntry.banner?.it ||
      baseEntry.banner?.[this.lang] ||
      baseEntry.banner?.it ||
      `${atkChar.name.toUpperCase()} vs ${defChar.name.toUpperCase()}! ✨`;
    const counterText =
      richEntry.defenderCounter?.[this.lang] ||
      richEntry.defenderCounter?.it ||
      COUNTER_LABELS_IT[def] ||
      'Contrattacco Eroico!';

    return {
      id: `${atk}_x_${def}`,
      atk,
      def,
      pairCode,
      atkChar,
      defChar,
      titleText,
      bannerText,
      weaponText: WEAPON_LABELS_IT[atk] || atkChar.signatureId,
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
        padding: 7px 12px;
        min-width: 245px;
        max-width: 320px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .hud-footer-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        font-size: 10.5px;
        color: #b0bec5;
        padding-top: 5px;
        margin-top: 3px;
        border-top: 1px solid rgba(255, 213, 79, 0.20);
      }
      .hud-version-pill {
        font-weight: 700;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #ffe082;
        background: rgba(255, 224, 130, 0.12);
        border: 1px solid rgba(255, 224, 130, 0.35);
        padding: 1px 6px;
        border-radius: 6px;
        font-size: 10px;
        letter-spacing: 0.3px;
      }
      .hud-footer-sep {
        color: rgba(255, 255, 255, 0.35);
      }
      .hud-footer-link {
        color: #9be7c4;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-weight: 600;
        transition: color 0.15s ease, transform 0.1s ease;
      }
      .hud-footer-link:hover {
        color: #fff;
        text-decoration: underline;
        transform: translateY(-1px);
      }
      .hud-footer-link.hud-bug-link {
        color: #ffab91;
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
        font-size: 12.5px;
      }
      .hud-check-badge {
        display: none;
        padding: 3px 8px;
        border-radius: 999px;
        background: linear-gradient(90deg, #d50000, #ff5252);
        color: #fff;
        font-weight: 800;
        font-size: 11px;
        animation: hudPulse 0.8s infinite alternate;
      }
      .hud-luck-wrap {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .hud-luck-header {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #b8f5d8;
        font-weight: 600;
      }
      .hud-luck-track {
        height: 9px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(76, 217, 162, 0.45);
        overflow: hidden;
        position: relative;
      }
      .hud-luck-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #00c853 0%, #64dd17 55%, #ffd600 100%);
        transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        box-shadow: 0 0 12px rgba(100, 221, 23, 0.8);
      }
      .hud-luck-track.hot {
        border-color: #ffd600;
        animation: hudPulse 0.55s infinite alternate;
      }
      .hud-stickers-row {
        display: none;
        gap: 4px;
        flex-wrap: wrap;
        font-size: 13px;
      }
      .hud-actions-dock {
        padding: 6px 9px;
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        align-items: center;
      }
      /* Comic Impact Banner & Skip Cutscene (docked at bottom so 16:9 Cinema Screen is 100% clear) */
      .hud-comic-banner {
        position: absolute;
        bottom: 62px;
        left: 50%;
        transform: translateX(-50%) scale(0.9);
        padding: 8px 20px;
        border-radius: 999px;
        background: linear-gradient(135deg, #ffca28 0%, #ff6f00 100%);
        border: 3px solid #fff8e1;
        color: #1a0f00;
        font-weight: 900;
        font-size: 18px;
        letter-spacing: 0.6px;
        box-shadow: 0 12px 35px rgba(255, 111, 0, 0.65);
        display: none;
        align-items: center;
        gap: 14px;
        z-index: 860;
        animation: hudPopIn 0.24s cubic-bezier(0.18, 1.25, 0.4, 1) forwards;
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
      @keyframes hudPulse {
        from { transform: scale(1); }
        to { transform: scale(1.05); }
      }
      @keyframes hudPopIn {
        from { opacity: 0; transform: translateX(-50%) scale(0.75); }
        to { opacity: 1; transform: translateX(-50%) scale(1); }
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'carchess-hud-root';
    root.innerHTML = `
      <!-- TOP BAR -->
      <header class="hud-topbar hud-glass hud-interactive">
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

          <label style="font-size:11px;color:#b0bac9;margin-left:4px;" id="hud-who-label">${this.t('whoPlays')}</label>
          <select id="hud-profile-select" class="hud-select" aria-label="Chi gioca">
            ${PROFILES.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>

          <select id="hud-opponent-select" class="hud-select" aria-label="Avversario">
            <option value="hotseat">${this.t('hotseat')}</option>
            <option value="easy">${this.t('cpuEasy')}</option>
            <option value="medium">${this.t('cpuMed')}</option>
            <option value="hard">${this.t('cpuHard')}</option>
          </select>

          <select id="hud-white-select" class="hud-select" aria-label="Set Bianco" title="Famiglia Bianco (Sud)">
            <option value="carlesso">${this.t('setWhiteCarlesso')}</option>
            <option value="swamp">${this.t('setWhiteSwamp')}</option>
            <option value="classic">${this.t('setWhiteClassic')}</option>
          </select>

          <select id="hud-rival-select" class="hud-select" aria-label="Set Nero" title="Famiglia Nero (Nord)">
            <option value="family">${this.t('setFamily')}</option>
            <option value="swamp">${this.t('setSwamp')}</option>
            <option value="classic">${this.t('setClassic')}</option>
            <option value="stone">${this.t('setStone')}</option>
          </select>

          <a href="showcase/" class="hud-btn" style="text-decoration:none;" title="Apri la Galleria 3D dei 18 Pezzi (Carlesso, Classici & Palude)">🎨 Galleria</a>

          <button id="hud-lang-btn" class="hud-btn" title="Italiano / English">🇮🇹 IT | 🇬🇧 EN</button>
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
          🎬 Matrice 6×6 (36 Scontri)
        </button>

        <!-- Sub-mode A: 360° Inspector Controls -->
        <div id="hud-wow-inspector-box" style="display:flex;flex-direction:column;gap:8px;">
          <div style="font-size:12px;color:#ffe082;font-weight:700;">🦸 Scegli l’Eroe della Famiglia:</div>
          <div class="hud-char-grid">
            ${Object.values(CHARACTER_REGISTRY)
              .map(
                (c) =>
                  `<button class="hud-btn ${c.type === 'b' ? 'active' : ''}" data-wow-char="${c.type}" style="justify-content:center;">${c.glyph} ${c.name}</button>`,
              )
              .join('')}
          </div>

          <div id="hud-ale-variant-row" style="display:flex;gap:5px;">
            <button id="hud-ale-rigged-btn" class="hud-btn active" style="flex:1;justify-content:center;">🐉 Ale #2 (Drago Rigged)</button>
            <button id="hud-ale-hat-btn" class="hud-btn" style="flex:1;justify-content:center;">🎩 Ale #1 (Cappello)</button>
          </div>

          <div style="display:flex;gap:5px;">
            <button id="hud-card-flip-btn" class="hud-btn" style="flex:1;justify-content:center;">🖼️ Carta 2D: Fronte/Retro</button>
            <button id="hud-autorotate-btn" class="hud-btn active" style="flex:1;justify-content:center;">🔄 Auto-Gira</button>
          </div>

          <div style="font-size:12px;color:#9be7c4;font-weight:700;">🎬 Animazioni 3D & Soffio Drago:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">
            <button class="hud-btn" data-wow-anim="Idle">✨ Idle (Ali)</button>
            <button class="hud-btn gold" data-wow-anim="Click_Fire_Breath">🔥 Soffio di Fuoco!</button>
            <button class="hud-btn" data-wow-anim="attack">⚔️ Attacco</button>
            <button class="hud-btn" data-wow-anim="victory">🏆 Vittoria!</button>
          </div>
        </div>

        <!-- Sub-mode B: 6x6 Battle Cinema Launcher -->
        <div id="hud-wow-arena-box" style="display:none;flex-direction:column;gap:8px;">
          <div style="font-size:12px;color:#ffe082;font-weight:700;">⚔️ Sfida 6×6 & Specchio Cinema Veo:</div>
          <label style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">
            <span>Attaccante (Bianco):</span>
            <select id="hud-wow-atk" class="hud-select">
              ${Object.values(CHARACTER_REGISTRY)
                .map((c) => `<option value="${c.type}" ${c.type === 'b' ? 'selected' : ''}>${c.glyph} ${c.name}</option>`)
                .join('')}
            </select>
          </label>
          <label style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">
            <span>Difensore (Nero):</span>
            <select id="hud-wow-def" class="hud-select">
              ${Object.values(CHARACTER_REGISTRY)
                .map((c) => `<option value="${c.type}" ${c.type === 'n' ? 'selected' : ''}>${c.glyph} ${c.name}</option>`)
                .join('')}
            </select>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#ffe082;cursor:pointer;">
            <input id="hud-wow-crit" type="checkbox">
            <span>🌟 Forza Colpo Critico Dorato (Golden Crit!)</span>
          </label>
          <button id="hud-wow-clash-btn" class="hud-btn gold" style="justify-content:center;padding:10px;">
            ${this.t('triggerBattleBtn')}
          </button>

          <div style="font-size:11.5px;color:#9be7c4;font-weight:700;margin-top:4px;">🎬 Test Rapidi Video 16:9 (Ale & Seby MP4):</div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <button class="hud-btn" data-quick-clash="b_n" style="justify-content:center;">🎬 1. Ale 🐉 vs Seby 🏎️ (Cristallo MP4)</button>
            <button class="hud-btn" data-quick-clash="n_b" style="justify-content:center;">🎬 2. Seby 🏎️ vs Ale 🐉 (Pista Turbo MP4)</button>
            <button class="hud-btn" data-quick-clash="n_r" style="justify-content:center;">🎬 3. Seby 🏎️ 💜 Pupurabbu (Abbraccio MP4)</button>
          </div>
        </div>
      </aside>

      <!-- BOTTOM STATUS & ACTION DOCK -->
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
          <div id="hud-stickers-row" class="hud-stickers-row" title="Sticker Collezionabili Sbloccati"></div>
          <div class="hud-footer-meta">
            <span id="hud-version-tag" class="hud-version-pill" title="Versione di CarChess3D">${this.appVersion}</span>
            <span class="hud-footer-sep">·</span>
            <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" class="hud-footer-link" title="Visualizza il codice sorgente su GitHub">
              <span>🐙</span> <span>GitHub Code</span>
            </a>
            <span class="hud-footer-sep">·</span>
            <a href="${GITHUB_NEW_ISSUE_URL}" target="_blank" rel="noopener noreferrer" class="hud-footer-link hud-bug-link" title="Segnala un bug o apri una nuova issue su GitHub">
              <span>🐛</span> <span>Open a bug</span>
            </a>
          </div>
        </div>

        <div class="hud-actions-dock hud-glass hud-interactive">
          <button id="hud-matrix36-btn" class="hud-btn gold-emerald" title="Apri la Matrice Interattiva 6×6 con tutte le 36 Scazzottate 3D e i 36 Video 16:9!">🎬 Matrice 6×6 (36 Scontri)</button>
          <button id="hud-skeletons-btn" class="hud-btn" title="Mostra/Nascondi gli Scheletri Articolati 3D su tutti i personaggi">🦴 Scheletri 3D</button>
          <button id="hud-hint-btn" class="hud-btn gold">${this.t('hintBtn')}</button>
          <button id="hud-swamp-btn" class="hud-btn" title="Fai sguazzare i pezzi catturati nella Palude di Shrek!">🐸 Palude Shrek</button>
          <button id="hud-zoom-in-btn" class="hud-btn" title="Zoom In (+)">🔍+</button>
          <button id="hud-zoom-out-btn" class="hud-btn" title="Zoom Out (-)">🔍−</button>
          <button id="hud-trackpad-btn" class="hud-btn active" title="Mac Trackpad 2 dita: Ruota (Alto/Basso/Sx/Dx) + Pizzica o Cmd per Zoom">🖐️ 2-Dita: Ruota</button>
          <button id="hud-flip-btn" class="hud-btn">${this.t('flipCamBtn')}</button>
          <button id="hud-top-btn" class="hud-btn">${this.t('topCamBtn')}</button>
          <button id="hud-new-btn" class="hud-btn">${this.t('newGameBtn')}</button>
          <button id="hud-fen-btn" class="hud-btn">${this.t('fenBtn')}</button>
          <button id="hud-music-btn" class="hud-btn">${this.t('musicBtn')}</button>
          <button id="hud-sfx-btn" class="hud-btn active">${this.t('sfxBtn')}</button>
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
          <h2 id="hud-gameover-title" style="margin:0 0 8px;color:#ffe082;font-size:24px;">🏆 SCACCO MATTO!</h2>
          <p id="hud-gameover-sub" style="margin:0 0 16px;color:#d6e4f0;font-size:15px;"></p>
          <button id="hud-play-again-btn" class="hud-btn gold" style="font-size:15px;padding:10px 22px;">
            ✨ Gioca Ancora! / Play Again!
          </button>
        </div>
      </div>

      <!-- MODAL 3: FEN / PGN IMPORT-EXPORT -->
      <div id="hud-fen-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-modal-card hud-glass" style="text-align:left;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="color:#ffe082;font-size:16px;">📋 FEN & PGN Scacchiera</strong>
            <button id="hud-fen-close" class="hud-btn">✕</button>
          </div>
          <label style="font-size:12px;color:#9be7c4;display:block;margin-bottom:4px;">FEN:</label>
          <input id="hud-fen-input" type="text" style="width:100%;padding:7px;border-radius:8px;border:1px solid #445;background:#0e131d;color:#fff;margin-bottom:10px;">
          <label style="font-size:12px;color:#9be7c4;display:block;margin-bottom:4px;">PGN:</label>
          <textarea id="hud-pgn-input" rows="4" style="width:100%;padding:7px;border-radius:8px;border:1px solid #445;background:#0e131d;color:#fff;margin-bottom:10px;"></textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="hud-fen-load-btn" class="hud-btn gold">📥 Carica FEN</button>
            <button id="hud-pgn-load-btn" class="hud-btn">📥 Carica PGN</button>
          </div>
        </div>
      </div>

      <!-- MODAL 4: INTERACTIVE 6x6 BATTLE CHOREOGRAPHY & VIDEO MATRIX (ALL 36 CLASHES) -->
      <div id="hud-matrix36-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-matrix36-card hud-glass">
          <div class="hud-matrix36-header">
            <div>
              <strong style="color:#ffe082;font-size:16px;">🎬 Matrice Interattiva 6×6 — Tutte le 36 Scazzottate 3D & Video 16:9</strong>
              <span style="display:block;font-size:11.5px;color:#9be7c4;">6 Attaccanti (Righe) × 6 Difensori (Colonne) · Clicca 🥊 per la Scazzottata 3D + Specchio o ▶️ per il Video 16:9!</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              <button id="hud-matrix36-marathon-btn" class="hud-btn gold">▶️ Riproduci Tutti i 36 Scontri (Maratona 6×6)</button>
              <a id="hud-matrix36-page-link" href="./battles.html" class="hud-btn" style="text-decoration:none;">🌐 Galleria 36 Video (battles.html)</a>
              <button id="hud-matrix36-close" class="hud-btn">✕ Chiudi</button>
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
                <div>⚔️ <strong>Arma Attacco:</strong> <span id="hud-matrix36-preview-weapon">🐉 Draghetto & Cristallo Ametista</span></div>
                <div>🛡️ <strong>Contrattacco Atto 2:</strong> <span id="hud-matrix36-preview-counter">🐴 Impennata e Doppio Calcio (IMPENNATA!)</span></div>
              </div>
              <button id="hud-matrix36-launch-selected" class="hud-btn gold" style="justify-content:center;padding:8px;">
                🥊 Scazzottata 3D + Cinema sulla Scacchiera!
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    this.rootEl = root;
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

    // Language toggle (IT 🇮🇹 <-> EN 🇬🇧)
    q('#hud-lang-btn')?.addEventListener('click', () => {
      const nextLang = this.lang === 'it' ? 'en' : 'it';
      this.ctx?.bus?.emit({ type: 'LANGUAGE_CHANGED', lang: nextLang });
      this.ctx?.bus?.flush?.();
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
        btn.textContent = next ? '🖐️ 2-Dita: Ruota' : '🔍 2-Dita: Zoom';
      }
      this.showToast(
        next
          ? '🖐️ Mac Trackpad: 2 dita ruotano alto/basso & sx/dx (Pizzica o Cmd+scroll per Zoom!)'
          : '🔍 Mac Trackpad: 2 dita fanno Zoom (Trascina con 1 dito per ruotare!)',
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

    q('#hud-top-btn')?.addEventListener('click', () => {
      this.topDownCamera = !this.topDownCamera;
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

    q('#hud-new-btn')?.addEventListener('click', () => {
      this.ctx?.board?.reset?.();
      this.ctx?.bus?.flush?.();
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
        if (typeof pm.seedSwampParty === 'function') {
          pm.seedSwampParty();
        } else {
          for (const [color, victimColor, atk, def, sq] of [
            ['b', 'w', 'n', 'b', 'c1'],
            ['b', 'w', 'b', 'n', 'g1'],
            ['b', 'w', 'r', 'p', 'e2'],
            ['w', 'b', 'b', 'n', 'b8'],
            ['w', 'b', 'n', 'b', 'f8'],
            ['w', 'b', 'q', 'r', 'h8'],
          ]) {
            pm.handlePieceCaptured({ color, victimColor, attacker: atk, defender: def, capturedSquare: sq });
          }
          pm.emitPiecesSynced('swamp_party');
        }
        this.ctx?.bus?.flush?.();
        this.showToast('🐸 Splash! I pezzi catturati sguazzano nella Palude di Shrek! 💦');
      }
    });

    // 🦴 Scheletri 3D toggle button (#12)
    q('#hud-skeletons-btn')?.addEventListener('click', () => {
      const next = !this.skeletonsVisible;
      this.skeletonsVisible = next;
      q('#hud-skeletons-btn')?.classList.toggle('active', next);
      this.ctx?.bus?.emit({ type: 'TOGGLE_SKELETONS', visible: next });
      this.ctx?.bus?.flush?.();
      this.showToast(
        next
          ? '🦴 Scheletri 3D Attivi: Giunture e locomozione articolata visibili su tutti i 32 pezzi!'
          : '🦴 Scheletri 3D Nascosti (visibili automaticamente durante la camminata/cavalcata)',
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
  }

  /**
   * Builds the HTML for the 6 Attacker rows x 6 Defender columns (all 36 combinations).
   */
  _renderMatrix36GridHtml() {
    const colHeaders = [
      `<div class="hud-matrix-colhdr" style="font-size:10px;color:#9be7c4;">⚔️ ATK \\ DEF 🛡️</div>`,
      ...PIECE_ORDER.map((def) => {
        const c = CHARACTER_REGISTRY[def];
        return `
          <div class="hud-matrix-colhdr" title="Difensore: ${c.name}">
            <img src="${c.frontPortrait}" alt="${c.name}">
            <span>${c.glyph} ${c.name}</span>
          </div>
        `;
      }),
    ].join('');

    const rowsHtml = PIECE_ORDER.map((atk) => {
      const atkChar = CHARACTER_REGISTRY[atk];
      const rowHdr = `
        <div class="hud-matrix-rowhdr" title="Attaccante: ${atkChar.name}">
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
              <button class="matrix-cell-btn clash" data-matrix-clash="${atk}_${def}" title="Scazzottata 3D + Cinema (${meta.pairCode})">🥊 Scazzottata 3D + Cinema</button>
              <button class="matrix-cell-btn video" data-matrix-video="${atk}_${def}" title="Riproduci Video 16:9 (${meta.videoUrl})">▶️ Video 16:9</button>
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
        btn.textContent = `⏹️ Ferma Maratona (${this.matrixMarathonIndex}/36 · ${atk.toUpperCase()}×${def.toUpperCase()})`;
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
      btn.textContent = '▶️ Riproduci Tutti i 36 Scontri (Maratona 6×6)';
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
    const hoverLabel = v.hoverSound?.label?.[this.lang] || v.hoverSound?.label?.it || '';
    this.lastHoverSound = hoverLabel;
    // Show subtle creature sound cue if not currently showing a battle or selection toast
    if (!this.activeBanner && hoverLabel) {
      this.showToast(`${char.glyph} ${char.name} (${e.square || ''}) — ${hoverLabel}`, 1100);
    }
  }

  onPieceSelected(e) {
    const type = String(e.piece?.type || e.pieceType || '').toLowerCase();
    const char = CHARACTER_REGISTRY[type];
    if (!char) return;
    const v = VOICE_LINES[type];
    const quote = v?.quote?.[this.lang] || v?.quote?.it || '';
    this.lastVoiceQuote = quote;

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
        `${char.glyph} ${char.name}:${voicePart}⚔️ Cattura ${defChar.glyph} ${defChar.name} (${pairCode}) — Clicca per la Scazzottata 3D!`,
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
      e.toastText ||
      `⚔️ Cattura possibile: ${atkChar.glyph} ${atkChar.name} vs ${defChar.glyph} ${defChar.name} (${pairCode}) — Clicca per la Scazzottata 3D!`;
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
  }

  onCheckDetected(e) {
    this.inCheck = true;
    this.turn = e.color || this.turn;
    this.updateTurnAndCheckUi();
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
    if (modal) modal.style.display = 'grid';
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
  }

  onDropSpawned(e) {
    if (e.sticker?.id) {
      this.unlockedStickers.add(e.sticker.id);
      this.renderStickersUi();
      const stickerLabel = e.sticker.name?.[this.lang] || e.sticker.name?.it || e.sticker.id;
      this.showToast(`🌟 STICKER SBLOCCATO: ${stickerLabel}!`, 3600);
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
    const text = bannerObj?.[this.lang] || bannerObj?.it || 'STECCHITO! ✨';
    this.activeBanner = text;

    if (!this.rootEl) return;
    const bannerEl = this.rootEl.querySelector('#hud-comic-banner');
    const textEl = this.rootEl.querySelector('#hud-comic-text');
    if (textEl) textEl.textContent = text;
    if (bannerEl) bannerEl.style.display = 'inline-flex';
  }

  onBattleEnded() {
    this.activeBanner = null;
    if (!this.rootEl) return;
    const bannerEl = this.rootEl.querySelector('#hud-comic-banner');
    if (bannerEl) bannerEl.style.display = 'none';
  }

  onHintSuggested(e) {
    if (e.explanation) {
      this.showToast(`💡 ${e.explanation}`, 3500);
    }
  }

  onLanguageChanged(e) {
    this.lang = e.lang === 'en' ? 'en' : 'it';
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
    if (e.text) {
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

  onKeyDown(e) {
    if (e.code === 'Escape' && this.matrixModalOpen) {
      e.preventDefault();
      this.closeMatrix36Modal();
      return;
    }
    if (e.code === 'Space' || e.code === 'Escape') {
      if (this.activeBanner || this.flowState === 'CaptureCutscene') {
        e.preventDefault();
        this.skipActiveCutscene();
      }
    }
  }

  skipActiveCutscene() {
    const combat = this.ctx?.combat || this.ctx?.combatManager;
    if (combat?.skip) {
      combat.skip('user_skip');
    } else {
      this.ctx?.bus?.emit({ type: 'BATTLE_SKIPPED', reason: 'user_skip' });
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
      const label = s.name[this.lang] || s.name.it;
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
    setTxt('#hud-title', 'title');
    setTxt('#hud-subtitle', 'subtitle');
    setTxt('#hud-mode1-btn', 'mode1Btn');
    setTxt('#hud-mode2-btn', 'mode2Btn');
    setTxt('#hud-who-label', 'whoPlays');
    setTxt('#hud-luck-label', 'luckBar');
    setTxt('#hud-hint-btn', 'hintBtn');
    setTxt('#hud-flip-btn', 'flipCamBtn');
    setTxt('#hud-top-btn', 'topCamBtn');
    setTxt('#hud-new-btn', 'newGameBtn');
    setTxt('#hud-fen-btn', 'fenBtn');
    setTxt('#hud-music-btn', 'musicBtn');
    setTxt('#hud-sfx-btn', 'sfxBtn');
    setTxt('#hud-skip-btn', 'skipBtn');
    setTxt('#hud-promo-title', 'promoTitle');
    setTxt('#hud-wow-tab-inspector', 'wowInspectorTab');
    setTxt('#hud-wow-tab-arena', 'wowArenaTab');
    setTxt('#hud-wow-clash-btn', 'triggerBattleBtn');
    setTxt('#hud-white-select option[value="carlesso"]', 'setWhiteCarlesso');
    setTxt('#hud-white-select option[value="swamp"]', 'setWhiteSwamp');
    setTxt('#hud-white-select option[value="classic"]', 'setWhiteClassic');
    setTxt('#hud-rival-select option[value="family"]', 'setFamily');
    setTxt('#hud-rival-select option[value="swamp"]', 'setSwamp');
    setTxt('#hud-rival-select option[value="classic"]', 'setClassic');
    setTxt('#hud-rival-select option[value="stone"]', 'setStone');
    this.updateTurnAndCheckUi();
    this.renderStickersUi();
  }

  dispose() {
    this.stopMatrix36Marathon();
    for (const off of this.offs) off();
    this.offs = [];
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._boundKeyDown);
    }
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
  }
}
