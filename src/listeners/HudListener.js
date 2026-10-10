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
  BATTLE_MATRIX,
  FAMILY_STICKERS,
  PROFILES,
  I18N,
} from '../core/Registry.js';

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
    this.rivalSet = 'family';
    this.flowState = 'Mode1_Chess';
    this.turn = 'w';
    this.inCheck = false;
    this.luck = { w: 0, b: 0, max: 12 };
    this.unlockedStickers = new Set();
    this.lastToast = null;
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

    if (bus && this.offs.length === 0) {
      this.offs.push(
        bus.on('FLOW_STATE_CHANGED', (e) => this.onFlowStateChanged(e)),
        bus.on('BOARD_RESET', (e) => this.onBoardReset(e)),
        bus.on('PIECE_SELECTED', (e) => this.onPieceSelected(e)),
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
      );
    }
  }

  t(key) {
    return I18N[this.lang]?.[key] || I18N.it[key] || key;
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
        background: rgba(14, 18, 27, 0.84);
        border: 1.5px solid rgba(230, 184, 74, 0.55);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 236, 179, 0.15);
        backdrop-filter: blur(10px);
        border-radius: 14px;
      }
      .hud-topbar {
        position: absolute;
        top: 10px;
        left: 12px;
        right: 12px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 14px;
      }
      .hud-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .hud-brand-title {
        font-weight: 800;
        font-size: 16px;
        color: #ffe082;
        letter-spacing: 0.2px;
        text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      }
      .hud-brand-sub {
        font-size: 11px;
        color: #9be7c4;
        display: block;
      }
      .hud-controls-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .hud-btn {
        font: 600 12px/1.2 system-ui, sans-serif;
        padding: 7px 11px;
        border-radius: 10px;
        border: 1px solid rgba(230, 184, 74, 0.45);
        background: linear-gradient(180deg, #22293a 0%, #151a26 100%);
        color: #f5efe0;
        cursor: pointer;
        transition: transform 0.12s ease, border-color 0.15s ease, background 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 5px;
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
      .hud-select {
        font: 600 12px/1.2 system-ui, sans-serif;
        padding: 6px 9px;
        border-radius: 9px;
        border: 1px solid rgba(230, 184, 74, 0.45);
        background: #171d2b;
        color: #ffe082;
        cursor: pointer;
      }
      .hud-bottombar {
        position: absolute;
        bottom: 12px;
        left: 12px;
        right: 12px;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 10px;
      }
      .hud-status-card {
        padding: 10px 14px;
        min-width: 265px;
        max-width: 350px;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .hud-turn-pill {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-weight: 700;
        font-size: 13px;
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
        gap: 4px;
      }
      .hud-luck-header {
        display: flex;
        justify-content: space-between;
        font-size: 11.5px;
        color: #b8f5d8;
        font-weight: 600;
      }
      .hud-luck-track {
        height: 11px;
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
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        font-size: 14px;
        min-height: 20px;
      }
      .hud-actions-dock {
        padding: 8px 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      /* Comic Impact Banner & Skip Cutscene */
      .hud-comic-banner {
        position: absolute;
        top: 78px;
        left: 50%;
        transform: translateX(-50%) scale(0.9);
        padding: 10px 24px;
        border-radius: 999px;
        background: linear-gradient(135deg, #ffca28 0%, #ff6f00 100%);
        border: 3px solid #fff8e1;
        color: #1a0f00;
        font-weight: 900;
        font-size: 20px;
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
      /* Modals (Promotion, Checkmate, FEN/PGN) */
      .hud-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(6, 9, 15, 0.76);
        backdrop-filter: blur(6px);
        display: none;
        place-items: center;
        z-index: 920;
      }
      .hud-modal-card {
        width: min(92vw, 500px);
        padding: 20px 22px;
        text-align: center;
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

          <select id="hud-rival-select" class="hud-select" aria-label="Set Nero">
            <option value="family">${this.t('setFamily')}</option>
            <option value="stone">${this.t('setStone')}</option>
          </select>

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
        </div>

        <div class="hud-actions-dock hud-glass hud-interactive">
          <button id="hud-hint-btn" class="hud-btn gold">${this.t('hintBtn')}</button>
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

    // Opponent selector (2P vs CPU Easy/Med/Hard)
    q('#hud-opponent-select')?.addEventListener('change', (e) => {
      this.opponentMode = e.target.value;
      const enabled = this.opponentMode !== 'hotseat';
      const difficulty = enabled ? this.opponentMode : 'easy';
      this.ctx?.ai?.configure?.({ enabled, cpuColor: 'b', difficulty });
      this.ctx?.bus?.emit({
        type: 'OPPONENT_CHANGED',
        mode: this.opponentMode,
        enabled,
        cpuColor: 'b',
        difficulty,
      });
      this.ctx?.bus?.flush?.();
      if (enabled && this.ctx?.board?.turn?.() === 'b' && !this.ctx?.board?.isGameOver?.()) {
        this.ctx?.ai?.requestMove?.(this.ctx.board.fen(), difficulty);
      }
    });

    // Rival Set selector (Carlesso Family vs Classic Stone Warriors)
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

    q('#hud-flip-btn')?.addEventListener('click', () => {
      if (this.ctx?.camera) {
        this.ctx.camera.position.x *= -1;
        this.ctx.camera.position.z *= -1;
        this.ctx.controls?.update?.();
      }
      this.ctx?.bus?.emit({ type: 'CAMERA_VIEW_REQUESTED', view: 'flip' });
      this.ctx?.bus?.flush?.();
    });

    q('#hud-top-btn')?.addEventListener('click', () => {
      this.topDownCamera = !this.topDownCamera;
      if (this.ctx?.camera) {
        if (this.topDownCamera) {
          this.ctx.camera.position.set(0, 12.8, 0.01);
        } else {
          this.ctx.camera.position.set(0, 7.2, 9.8);
        }
        this.ctx.controls?. target?.set?.(0, 0.3, 0);
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

  onPieceSelected(e) {
    const char = CHARACTER_REGISTRY[e.piece?.type];
    if (char) {
      const msg =
        this.lang === 'it'
          ? `${char.glyph} ${char.name} (${e.square}) — ${e.legalMoves?.length || 0} mosse possibili`
          : `${char.glyph} ${char.name} (${e.square}) — ${e.legalMoves?.length || 0} legal moves`;
      this.showToast(msg, 1800);
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
    const bannerObj = e.banner || BATTLE_MATRIX[e.attacker]?.[e.defender]?.banner;
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

  onKeyDown(e) {
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
    this.updateTurnAndCheckUi();
    this.renderStickersUi();
  }

  dispose() {
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
