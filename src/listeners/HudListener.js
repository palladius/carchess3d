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
  FAMILY_ROSTERS,
  resolveFamilyMatchup,
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
    this.wowBishopVariant = 'hat';
    this.wowCardSide = 'front';
    this.wowAutoRotate = true;
    this.wowAttacker = 'b';
    this.wowDefender = 'n';
    this.wowGoldenCrit = false;
    this.matrixFamily = 'carlesso';
    this.matrixSelectedAtk = 'n';
    this.matrixSelectedDef = 'b';
    this.topDownCamera = false;
    this.cameraFlipped = false;
    this.hintPending = false;
    this.musicPlaying = false;
    this.sfxEnabled = true;
    /** @type {Array<{ id: number, text: string, tone: string }>} */
    this.miniLog = [];
    this._logSeq = 0;

    this.rootEl = null;
    this.els = {};
    this.toastTimer = null;
    this.checkmateModalTimer = null;
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
      this.pushMiniLog(this._formatTurnLabel(), 'turn');
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

  _activeProfileName() {
    const found = PROFILES.find((p) => p.id === this.activeProfile);
    return found ? found.name : 'Riccardo 👑';
  }

  _formatTurnLabel() {
    if (this.turn === 'w') {
      const who = this._activeProfileName();
      return this.lang === 'it' ? `⚪ Turno di ${who}` : `⚪ ${who}'s turn`;
    }
    if (this.opponentMode !== 'hotseat') {
      return this.lang === 'it' ? '⚫ Turno CPU 🤖' : '⚫ CPU Turn 🤖';
    }
    return `⚫ ${this.t('turnBlack')}`;
  }

  // ===========================================================================
  // 1. DOM OVERLAY CONSTRUCTION (Minimal Obsidian & Gold Desktop UX)
  // ===========================================================================

  buildDom() {
    const existing = document.getElementById('carchess-hud-root');
    if (existing) existing.remove();
    const existingStyle = document.getElementById('carchess-hud-styles');
    if (existingStyle) existingStyle.remove();

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
        background: rgba(12, 16, 24, 0.76);
        border: 1px solid rgba(255, 213, 79, 0.45);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(8px);
        border-radius: 10px;
      }
      .hud-topbar {
        position: absolute;
        top: 6px;
        left: 10px;
        right: 10px;
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 4px 10px;
      }
      .hud-brand {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }
      .hud-brand-title {
        font-weight: 800;
        font-size: 13.5px;
        color: #ffe082;
        letter-spacing: 0.2px;
      }
      .hud-controls-row {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: 5px;
      }
      .hud-btn {
        font: 600 11px/1.1 system-ui, sans-serif;
        padding: 4px 8px;
        border-radius: 7px;
        border: 1px solid rgba(255, 213, 79, 0.4);
        background: linear-gradient(180deg, #22293a 0%, #151a26 100%);
        color: #f5efe0;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }
      .hud-btn:hover {
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
        font: 600 11px/1.1 system-ui, sans-serif;
        padding: 4px 6px;
        border-radius: 7px;
        border: 1px solid rgba(255, 213, 79, 0.4);
        background: #171d2b;
        color: #ffe082;
        cursor: pointer;
      }
      .hud-bottombar {
        position: absolute;
        bottom: 6px;
        left: 10px;
        right: 10px;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 8px;
      }
      /* Compact Bottom Mini-Log (Turn + Move/Event feed + Luck bar) */
      .hud-status-card {
        padding: 6px 10px;
        min-width: 250px;
        max-width: 360px;
        display: flex;
        flex-direction: column;
        gap: 4px;
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
        padding: 2px 6px;
        border-radius: 999px;
        background: linear-gradient(90deg, #d50000, #ff5252);
        color: #fff;
        font-weight: 800;
        font-size: 10.5px;
        animation: hudPulse 0.8s infinite alternate;
      }
      .hud-luck-inline {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10.5px;
        color: #b8f5d8;
        font-weight: 600;
      }
      .hud-luck-track {
        flex: 1;
        height: 6px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(76, 217, 162, 0.45);
        overflow: hidden;
      }
      .hud-luck-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #00c853 0%, #64dd17 55%, #ffd600 100%);
        transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .hud-luck-track.hot {
        border-color: #ffd600;
        animation: hudPulse 0.55s infinite alternate;
      }
      .hud-minilog-entries {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 46px;
        overflow: hidden;
        border-top: 1px solid rgba(255, 213, 79, 0.18);
        padding-top: 3px;
        font-size: 11px;
        line-height: 1.25;
        color: #cfd8e6;
      }
      .hud-minilog-line {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0.78;
      }
      .hud-minilog-line:last-child {
        opacity: 1;
        color: #9be7c4;
        font-weight: 600;
      }
      .hud-stickers-row {
        display: none;
        gap: 4px;
        flex-wrap: wrap;
        font-size: 11px;
      }
      .hud-actions-dock {
        padding: 5px 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
      }
      .hud-comic-banner {
        position: absolute;
        bottom: 68px;
        left: 50%;
        transform: translateX(-50%) scale(0.95);
        padding: 5px 14px;
        border-radius: 999px;
        background: linear-gradient(135deg, #ffca28 0%, #ff6f00 100%);
        border: 2px solid #fff8e1;
        color: #1a0f00;
        font-weight: 800;
        font-size: 13.5px;
        box-shadow: 0 8px 24px rgba(255, 111, 0, 0.5);
        display: none;
        align-items: center;
        gap: 10px;
        z-index: 860;
      }
      .hud-toast {
        display: none;
      }
      .hud-lyria-caption {
        position: absolute;
        bottom: 72px;
        left: 50%;
        transform: translateX(-50%);
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(26, 18, 48, 0.85);
        border: 1px solid #ffd54f;
        color: #ffe082;
        font-weight: 600;
        font-size: 11.5px;
        display: none;
      }
      /* Mode 2 WOW Compact Drawer */
      .hud-wow-panel {
        position: absolute;
        top: 46px;
        left: 10px;
        width: 248px;
        padding: 9px;
        display: none;
        flex-direction: column;
        gap: 7px;
      }
      .hud-char-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
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
        width: min(92vw, 440px);
        padding: 16px 18px;
        text-align: center;
      }
      .hud-promo-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-top: 12px;
      }
      .hud-promo-btn {
        padding: 8px;
        border-radius: 12px;
        border: 1.5px solid #e6b84a;
        background: #1a2130;
        color: #ffe082;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        font-weight: 800;
        font-size: 13px;
      }
      .hud-promo-btn:hover {
        background: #2b354d;
      }
      .hud-promo-btn img {
        width: 68px;
        height: 68px;
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
        to { transform: scale(1.04); }
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'carchess-hud-root';
    root.innerHTML = `
      <!-- COMPACT TOP BAR -->
      <header class="hud-topbar hud-glass hud-interactive">
        <div class="hud-brand">
          <span style="font-size:17px;">🏰🚽</span>
          <span id="hud-title" class="hud-brand-title">${this.t('title')}</span>
        </div>

        <div class="hud-controls-row">
          <button id="hud-mode1-btn" class="hud-btn active">${this.t('mode1Btn')}</button>
          <button id="hud-mode2-btn" class="hud-btn">${this.t('mode2Btn')}</button>
          <button id="hud-matrix-btn" class="hud-btn gold" title="Matrice 6×6 Combattimenti & Video">${this.t('matrixBtn')}</button>

          <select id="hud-profile-select" class="hud-select" aria-label="Player">
            ${PROFILES.map((p) => `<option value="${p.id}" ${p.id === this.activeProfile ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>

          <select id="hud-opponent-select" class="hud-select" aria-label="Opponent">
            <option value="hotseat">${this.t('hotseat')}</option>
            <option value="easy">${this.t('cpuEasy')}</option>
            <option value="medium">${this.t('cpuMed')}</option>
            <option value="hard">${this.t('cpuHard')}</option>
          </select>

          <select id="hud-rival-select" class="hud-select" aria-label="Rival Set">
            <option value="family">${this.t('setFamily')}</option>
            <option value="stone">${this.t('setStone')}</option>
          </select>

          <button id="hud-lang-btn" class="hud-btn" title="IT / EN">🇮🇹/🇬🇧</button>
        </div>
      </header>

      <!-- COMPACT CUTSCENE BANNER & SKIP -->
      <div id="hud-comic-banner" class="hud-comic-banner hud-interactive">
        <span id="hud-comic-text">⚡</span>
        <button id="hud-skip-btn" class="hud-btn gold">${this.t('skipBtn')}</button>
      </div>

      <!-- HIDDEN TOAST (kept for compatibility, routed to mini-log) -->
      <div id="hud-toast" class="hud-toast"></div>

      <!-- LYRIA CAPTION -->
      <div id="hud-lyria-caption" class="hud-lyria-caption"></div>

      <!-- MODE 2: COMPACT WOW PANEL -->
      <aside id="hud-wow-panel" class="hud-wow-panel hud-glass hud-interactive">
        <div style="display:flex;gap:4px;">
          <button id="hud-wow-tab-inspector" class="hud-btn active" style="flex:1;justify-content:center;">${this.t('wowInspectorTab')}</button>
          <button id="hud-wow-tab-arena" class="hud-btn" style="flex:1;justify-content:center;">${this.t('wowArenaTab')}</button>
        </div>

        <!-- Sub-mode A: 360° Inspector -->
        <div id="hud-wow-inspector-box" style="display:flex;flex-direction:column;gap:6px;">
          <div class="hud-char-grid">
            ${Object.values(CHARACTER_REGISTRY)
              .map(
                (c) =>
                  `<button class="hud-btn ${c.type === 'b' ? 'active' : ''}" data-wow-char="${c.type}" style="justify-content:center;">${c.glyph} ${c.name}</button>`,
              )
              .join('')}
          </div>

          <div id="hud-ale-variant-row" style="display:flex;gap:4px;">
            <button id="hud-ale-hat-btn" class="hud-btn active" style="flex:1;justify-content:center;">🎩 Ale #1</button>
            <button id="hud-ale-rigged-btn" class="hud-btn" style="flex:1;justify-content:center;">🐉 Ale #2</button>
          </div>

          <div style="display:flex;gap:4px;">
            <button id="hud-card-flip-btn" class="hud-btn" style="flex:1;justify-content:center;">🖼️ Carta</button>
            <button id="hud-autorotate-btn" class="hud-btn active" style="flex:1;justify-content:center;">🔄 360°</button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <button class="hud-btn" data-wow-anim="Idle">✨ Idle</button>
            <button class="hud-btn gold" data-wow-anim="Click_Fire_Breath">🔥 Fuoco</button>
            <button class="hud-btn" data-wow-anim="attack">⚔️ Attacco</button>
            <button class="hud-btn" data-wow-anim="victory">🏆 Vittoria</button>
          </div>
        </div>

        <!-- Sub-mode B: 6x6 Battle & 16:9 Video Launcher -->
        <div id="hud-wow-arena-box" style="display:none;flex-direction:column;gap:6px;">
          <div style="display:flex;gap:4px;align-items:center;">
            <select id="hud-wow-atk" class="hud-select" style="flex:1;">
              ${Object.values(CHARACTER_REGISTRY)
                .map((c) => `<option value="${c.type}" ${c.type === 'b' ? 'selected' : ''}>⚔️ ${c.glyph} ${c.name}</option>`)
                .join('')}
            </select>
            <span style="font-size:11px;color:#ffe082;font-weight:800;">VS</span>
            <select id="hud-wow-def" class="hud-select" style="flex:1;">
              ${Object.values(CHARACTER_REGISTRY)
                .map((c) => `<option value="${c.type}" ${c.type === 'n' ? 'selected' : ''}>🛡️ ${c.glyph} ${c.name}</option>`)
                .join('')}
            </select>
          </div>
          <div style="display:flex;gap:4px;align-items:center;">
            <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#ffe082;cursor:pointer;">
              <input id="hud-wow-crit" type="checkbox">
              <span>🌟 Crit</span>
            </label>
            <button id="hud-wow-clash-btn" class="hud-btn gold" style="flex:1;justify-content:center;">
              ${this.t('triggerBattleBtn')}
            </button>
          </div>

          <div style="display:flex;flex-direction:column;gap:3px;">
            <button class="hud-btn" data-quick-clash="b_n" style="justify-content:center;">🎬 Ale 🐉 × Seby 🏎️</button>
            <button class="hud-btn" data-quick-clash="n_b" style="justify-content:center;">🎬 Seby 🏎️ × Ale 🐉</button>
            <button class="hud-btn" data-quick-clash="n_r" style="justify-content:center;">🎬 Seby 🏎️ 💜 Pupurabbu</button>
            <button id="hud-wow-open-matrix-btn" class="hud-btn gold" style="justify-content:center;">⚔️ Apri Matrice 6×6 Completa</button>
          </div>
        </div>
      </aside>

      <!-- BOTTOM MINI-LOG & ICON ACTION DOCK -->
      <footer class="hud-bottombar">
        <div id="hud-minilog" class="hud-status-card hud-glass hud-interactive">
          <div class="hud-turn-pill">
            <span id="hud-turn-text">${this._formatTurnLabel()}</span>
            <span id="hud-check-badge" class="hud-check-badge">${this.t('checkAlert')}</span>
            <div class="hud-luck-inline" title="Luck Meter">
              <span id="hud-luck-label">${this.t('luckBar')}</span>
              <div id="hud-luck-track" class="hud-luck-track" style="width:52px;">
                <div id="hud-luck-fill" class="hud-luck-fill"></div>
              </div>
              <span id="hud-luck-val">0/12</span>
            </div>
          </div>
          <div id="hud-minilog-entries" class="hud-minilog-entries" aria-live="polite"></div>
          <div id="hud-stickers-row" class="hud-stickers-row"></div>
        </div>

        <div class="hud-actions-dock hud-glass hud-interactive">
          <button id="hud-hint-btn" class="hud-btn gold" title="Hint">${this.t('hintBtn')}</button>
          <button id="hud-swamp-btn" class="hud-btn" title="Palude">🐸 Palude</button>
          <button id="hud-flip-btn" class="hud-btn" title="Flip camera">${this.t('flipCamBtn')}</button>
          <button id="hud-top-btn" class="hud-btn" title="Top-down view">${this.t('topCamBtn')}</button>
          <button id="hud-new-btn" class="hud-btn" title="New match">${this.t('newGameBtn')}</button>
          <button id="hud-fen-btn" class="hud-btn" title="FEN / PGN">${this.t('fenBtn')}</button>
          <button id="hud-music-btn" class="hud-btn" title="Music">${this.t('musicBtn')}</button>
          <button id="hud-sfx-btn" class="hud-btn active" title="SFX">${this.t('sfxBtn')}</button>
        </div>
      </footer>

      <!-- MODAL 1: PAWN PROMOTION -->
      <div id="hud-promo-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-modal-card hud-glass">
          <h3 id="hud-promo-title" style="margin:0;color:#ffe082;font-size:16px;">${this.t('promoTitle')}</h3>
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

      <!-- MODAL 2: CHECKMATE / DRAW -->
      <div id="hud-gameover-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-modal-card hud-glass">
          <h2 id="hud-gameover-title" style="margin:0 0 8px;color:#ffe082;font-size:21px;">🏆 SCACCO MATTO!</h2>
          <p id="hud-gameover-sub" style="margin:0 0 14px;color:#d6e4f0;font-size:14px;"></p>
          <button id="hud-play-again-btn" class="hud-btn gold" style="font-size:14px;padding:8px 18px;">
            ✨ ${this.t('newGameBtn')}
          </button>
        </div>
      </div>

      <!-- MODAL 3: FEN / PGN -->
      <div id="hud-fen-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-modal-card hud-glass" style="text-align:left;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="color:#ffe082;font-size:14px;">📋 FEN & PGN</strong>
            <button id="hud-fen-close" class="hud-btn">✕</button>
          </div>
          <label style="font-size:11px;color:#9be7c4;display:block;margin-bottom:3px;">FEN:</label>
          <input id="hud-fen-input" type="text" style="width:100%;padding:6px;border-radius:7px;border:1px solid #445;background:#0e131d;color:#fff;margin-bottom:8px;">
          <label style="font-size:11px;color:#9be7c4;display:block;margin-bottom:3px;">PGN:</label>
          <textarea id="hud-pgn-input" rows="3" style="width:100%;padding:6px;border-radius:7px;border:1px solid #445;background:#0e131d;color:#fff;margin-bottom:8px;"></textarea>
          <div style="display:flex;gap:6px;justify-content:flex-end;">
            <button id="hud-fen-load-btn" class="hud-btn gold">📥 FEN</button>
            <button id="hud-pgn-load-btn" class="hud-btn">📥 PGN</button>
          </div>
        </div>
      </div>

      <!-- MODAL 4: 6x6 CAPTURE MATRIX EXPLORER & ASSET INVENTORY -->
      <div id="hud-matrix-modal" class="hud-modal-backdrop hud-interactive">
        <div class="hud-matrix-card hud-glass">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div>
              <strong style="color:#ffe082;font-size:15px;">⚔️ Matrice 6×6 Combattimenti: Chi Mangia Chi (3D VFX & Film Veo 16:9)</strong>
              <div style="font-size:11px;color:#b8f5d8;margin-top:2px;">
                <span class="hud-badge-pill hud-badge-mp4">📹 MP4 Dedicato (4/36: b×n, n×b, n↔r)</span>
                <span class="hud-badge-pill hud-badge-mix">🎞️ Video + Canvas (32/36)</span>
                <span class="hud-badge-pill hud-badge-glb">🦴 GLB Rigged (Ale #2 FireBreath_Track)</span>
                <span class="hud-badge-pill hud-badge-egg">🌟 Easter Egg (6/36)</span>
              </div>
            </div>
            <button id="hud-matrix-close" class="hud-btn">✕</button>
          </div>

          <!-- Family Selector Tabs -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:11px;color:#ffe082;font-weight:700;">Famiglia Attaccante (A):</span>
            ${Object.values(FAMILY_ROSTERS)
              .map(
                (fam) =>
                  `<button class="hud-btn ${fam.id === this.matrixFamily ? 'active' : ''}" data-matrix-family="${fam.id}">${fam.label.it}</button>`,
              )
              .join('')}
          </div>

          <!-- Dynamic 6x6 Grid Container -->
          <div id="hud-matrix-grid-container"></div>

          <!-- Selected Pair Detail & Launch Bar -->
          <div id="hud-matrix-detail-bar" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(10,14,24,0.88);border:1px solid rgba(255,213,79,0.4);">
            <div id="hud-matrix-detail-text" style="font-size:11.5px;line-height:1.35;color:#e6eef8;"></div>
            <button id="hud-matrix-play-btn" class="hud-btn gold" style="padding:6px 12px;font-size:12px;">
              ▶ Guarda in 3D + Video
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

  _applyBoardCameraPose() {
    if (!this.ctx?.camera) return;
    if (this.topDownCamera) {
      const zTilt = this.cameraFlipped ? -0.01 : 0.01;
      this.ctx.camera.position.set(0, 12.8, zTilt);
      this.ctx.controls?.target?.set?.(0, 0.3, 0);
    } else if (this.cameraFlipped) {
      // Stay in front of the z = -10.2 cinema mirror so the board is never occluded
      this.ctx.camera.position.set(0, 6.2, -8.2);
      this.ctx.controls?.target?.set?.(0, 0.4, 0.4);
    } else {
      this.ctx.camera.position.set(0, 5.85, 12.6);
      this.ctx.controls?.target?.set?.(0, 2.15, -2.2);
    }
    this.ctx.controls?.update?.();
    if (this.rootEl) {
      this.rootEl.querySelector('#hud-flip-btn')?.classList.toggle('active', this.cameraFlipped);
      this.rootEl.querySelector('#hud-top-btn')?.classList.toggle('active', this.topDownCamera);
    }
  }

  _bindDomActions(root) {
    const q = (sel) => root.querySelector(sel);

    // Mode 1 <-> Mode 2 Switcher (idempotent)
    q('#hud-mode1-btn')?.addEventListener('click', () => {
      if (this.flowState === 'Mode1_Chess') return;
      this.skipActiveCutscene();
      if (this.ctx?.flow?.startChessMode) {
        this.ctx.flow.startChessMode();
      } else {
        this.ctx?.bus?.emit({ type: 'FLOW_STATE_CHANGED', from: this.flowState, to: 'Mode1_Chess' });
      }
      this.ctx?.bus?.flush?.();
    });

    q('#hud-mode2-btn')?.addEventListener('click', () => {
      if (this.flowState === 'Mode2_WowArena') return;
      this.skipActiveCutscene();
      if (this.ctx?.flow?.startWowMode) {
        this.ctx.flow.startWowMode();
      } else {
        this.ctx?.bus?.emit({ type: 'FLOW_STATE_CHANGED', from: this.flowState, to: 'Mode2_WowArena' });
      }
      this.ctx?.bus?.flush?.();
    });

    // Profile selector
    q('#hud-profile-select')?.addEventListener('change', (e) => {
      const nextProfile = e.target.value;
      if (this.activeProfile === nextProfile) return;
      this.activeProfile = nextProfile;
      this.ctx?.bus?.emit({ type: 'PROFILE_CHANGED', profileId: this.activeProfile });
      this.ctx?.bus?.flush?.();
      this.updateTurnAndCheckUi();
      this.pushMiniLog(this._formatTurnLabel(), 'turn');
    });

    // Opponent selector (2P vs CPU Easy/Med/Hard)
    q('#hud-opponent-select')?.addEventListener('change', (e) => {
      const nextMode = e.target.value;
      if (this.opponentMode === nextMode) return;
      this.opponentMode = nextMode;
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
      this.updateTurnAndCheckUi();
      if (enabled && this.ctx?.board?.turn?.() === 'b' && !this.ctx?.board?.isGameOver?.()) {
        this.ctx?.ai?.requestMove?.(this.ctx.board.fen(), difficulty);
      }
    });

    // Rival Set selector (Carlesso Family vs Classic Stone Warriors)
    q('#hud-rival-select')?.addEventListener('change', (e) => {
      const nextSet = e.target.value;
      if (this.rivalSet === nextSet) return;
      this.rivalSet = nextSet;
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

    // Action dock buttons (idempotent)
    q('#hud-hint-btn')?.addEventListener('click', () => {
      if (this.hintPending) return;
      const fen = this.ctx?.board?.fen?.();
      if (this.ctx?.ai?.requestHint && fen) {
        this.hintPending = true;
        Promise.resolve(this.ctx.ai.requestHint(fen))
          .finally(() => {
            this.hintPending = false;
            this.ctx?.bus?.flush?.();
          });
      } else {
        this.ctx?.bus?.emit({ type: 'HINT_REQUESTED' });
        this.ctx?.bus?.flush?.();
      }
    });

    q('#hud-flip-btn')?.addEventListener('click', () => {
      this.cameraFlipped = !this.cameraFlipped;
      this._applyBoardCameraPose();
      this.ctx?.bus?.emit({
        type: 'CAMERA_VIEW_REQUESTED',
        view: 'flip',
        flipped: this.cameraFlipped,
      });
      this.ctx?.bus?.flush?.();
    });

    q('#hud-top-btn')?.addEventListener('click', () => {
      this.topDownCamera = !this.topDownCamera;
      this._applyBoardCameraPose();
      this.ctx?.bus?.emit({
        type: 'CAMERA_VIEW_REQUESTED',
        view: this.topDownCamera ? 'top' : 'default',
      });
      this.ctx?.bus?.flush?.();
    });

    q('#hud-new-btn')?.addEventListener('click', () => {
      this.skipActiveCutscene();
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
          this.showToast('⚠️ FEN non valido');
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
          this.showToast('⚠️ PGN non valido');
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

    // Mode 2 WOW Controls (strictly idempotent)
    q('#hud-wow-tab-inspector')?.addEventListener('click', () => {
      if (this.wowSubMode === 'inspector') return;
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
      if (this.wowSubMode === 'arena') return;
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
        const nextChar = btn.dataset.wowChar || 'b';
        if (this.wowChar === nextChar && this.wowSubMode === 'inspector') return;
        this.wowChar = nextChar;
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
      if (this.wowBishopVariant === 'rigged') return;
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
      if (this.wowBishopVariant === 'hat') return;
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

    // Idempotent Palude button: populates the 6 demo swamp swimmers at most once
    q('#hud-swamp-btn')?.addEventListener('click', () => {
      const pm = this.ctx?.pieces || this.ctx?.pieceManager;
      if (!pm) return;
      const added = typeof pm.seedSwampParty === 'function' ? pm.seedSwampParty() : 0;
      this.ctx?.bus?.flush?.();
      q('#hud-swamp-btn')?.classList.add('active');
      if (added > 0) {
        this.showToast('🐸 Palude: 6 eroi in ammollo 💦');
      } else {
        this.showToast('🐸 Palude già attiva');
      }
    });

    // 6x6 Capture Matrix Explorer Modal controls
    const openMatrixModal = () => {
      const modal = q('#hud-matrix-modal');
      if (!modal) return;
      this._renderMatrixExplorerGrid();
      modal.style.display = 'grid';
    };

    q('#hud-matrix-btn')?.addEventListener('click', openMatrixModal);
    q('#hud-wow-open-matrix-btn')?.addEventListener('click', openMatrixModal);
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
              ? '<span class="hud-badge-pill hud-badge-mp4">📹 MP4</span>'
              : '<span class="hud-badge-pill hud-badge-mix">🎞️ Mix</span>';
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
            <th>Attaccante (A) \\ Difensore (B)</th>
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
    const m = resolveFamilyMatchup(
      this.matrixFamily,
      this.matrixSelectedAtk,
      this.matrixSelectedDef,
    );
    const animDesc = m.anim3dDesc?.[this.lang] || m.anim3dDesc?.it || m.effect;
    const videoKind = m.hasDedicatedVideo
      ? `📹 Film Veo/MP4 16:9 Dedicato (${m.videoUrl})`
      : `🎞️ Video Condiviso (${m.videoUrl}) + Card 2D Canvas`;
    const glbKind = m.hasSkeletalGlbClip
      ? '🦴 Clip GLB Scheletrica: FireBreath_Track'
      : '✨ Animazione 3D Procedurale & Pool VFX';

    detailEl.innerHTML = `
      <div><strong style="color:#ffe082;">${m.attackerDisplayName} mangia ${m.defenderDisplayName}</strong> — <em>${m.banner?.[this.lang] || m.banner?.it}</em></div>
      <div><strong>3D Scacchiera:</strong> ${animDesc} · <strong>Reazione Vittima:</strong> <code>${m.victimReaction}</code> · ${glbKind}</div>
      <div><strong>Sfondo 16:9:</strong> ${videoKind}</div>
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

    // Switch rival set if Classic Stone family is selected so the 3D pieces match!
    const pm = this.ctx?.pieces || this.ctx?.pieceManager;
    if (pm?.setRivalSetMode) {
      pm.setRivalSetMode(this.matrixFamily === 'classic' ? 'stone' : 'family');
    }

    this.ctx?.bus?.emit({
      type: 'WOW_ARENA_CLASH',
      familyId: this.matrixFamily,
      attacker,
      defender,
      goldenCrit: true,
      tier: 'golden_crit',
      from: 'd4',
      to: 'e5',
      square: 'e5',
      source: 'matrix_explorer',
    });
    this.ctx?.bus?.flush?.();
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
    if (this.checkmateModalTimer) {
      clearTimeout(this.checkmateModalTimer);
      this.checkmateModalTimer = null;
    }
    this.onBattleEnded();
    this.updateTurnAndCheckUi();
    this.pushMiniLog(`✨ ${this._formatTurnLabel()}`, 'reset');
    if (this.rootEl) {
      this.rootEl.querySelector('#hud-gameover-modal').style.display = 'none';
      this.rootEl.querySelector('#hud-promo-modal').style.display = 'none';
      this.rootEl.querySelector('#hud-swamp-btn')?.classList.remove('active');
    }
  }

  onPieceSelected(e) {
    const char = CHARACTER_REGISTRY[e.piece?.type];
    if (char) {
      const count = e.legalMoves?.length || 0;
      const msg = `${char.glyph} ${char.name} (${e.square}) · ${count}`;
      this.showToast(msg, 1800);
    }
  }

  onMoveExecuted(e) {
    this.turn = e.turn || 'w';
    this.inCheck = false;
    this.updateTurnAndCheckUi();
    const mv = e.move;
    if (mv) {
      const sideIcon = mv.color === 'b' ? '⚫' : '⚪';
      const san = mv.san || `${mv.from}→${mv.to}`;
      const capIcon = e.captured ? ' ⚔️' : '';
      this.pushMiniLog(`${sideIcon} ${san}${capIcon} · ${this._formatTurnLabel()}`, 'move');
    } else {
      this.pushMiniLog(this._formatTurnLabel(), 'turn');
    }
  }

  onCheckDetected(e) {
    this.inCheck = true;
    this.turn = e.color || this.turn;
    this.updateTurnAndCheckUi();
    this.pushMiniLog(`${this.t('checkAlert')} (${this._formatTurnLabel()})`, 'check');
  }

  onCheckmate(e) {
    const winnerName = e.winner === 'w' ? this._activeProfileName() : 'Nero ⚔️';
    const bannerText = `${this.t('checkmateBanner')} · ${winnerName}`;
    this.activeBanner = bannerText;
    this.pushMiniLog(`${this.t('checkmateTitle')} · ${winnerName}`, 'gameover');
    if (!this.rootEl) return;

    const modal = this.rootEl.querySelector('#hud-gameover-modal');
    const title = this.rootEl.querySelector('#hud-gameover-title');
    const sub = this.rootEl.querySelector('#hud-gameover-sub');
    if (title) title.textContent = this.t('checkmateTitle');
    if (sub) {
      sub.textContent = `👑 ${winnerName}`;
    }

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
    this.pushMiniLog(`${this.t('drawTitle')} (${e.reason || '='})`, 'gameover');
    if (!this.rootEl) return;
    const modal = this.rootEl.querySelector('#hud-gameover-modal');
    const title = this.rootEl.querySelector('#hud-gameover-title');
    const sub = this.rootEl.querySelector('#hud-gameover-sub');
    if (title) title.textContent = this.t('drawTitle');
    if (sub) {
      sub.textContent = `🤝 ${e.reason || 'Draw'}`;
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
      this.showToast(`🌟 ${stickerLabel}`, 3000);
    }
  }

  onLuckReset(e) {
    const pid = e.playerId || 'w';
    this.luck[pid] = 0;
    this.updateLuckUi(pid);
  }

  onBattleStarted(e) {
    const bannerObj = e.banner || BATTLE_MATRIX[e.attacker]?.[e.defender]?.banner;
    const text = bannerObj?.[this.lang] || bannerObj?.it || '⚔️✨';
    this.activeBanner = text;
    this.pushMiniLog(`🎬 ${text}`, 'battle');

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
    this.updateTurnAndCheckUi();
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
      combat.skip('user_skip');
    } else if (this.activeBanner || this.flowState === 'CaptureCutscene') {
      this.ctx?.bus?.emit({ type: 'BATTLE_SKIPPED', reason: 'user_skip' });
    }
    this.ctx?.bus?.flush?.();
  }

  // ===========================================================================
  // 3. UI HELPERS, MINI-LOG & BILINGUAL REFRESH
  // ===========================================================================

  pushMiniLog(text, tone = 'info') {
    if (!text) return;
    const prev = this.miniLog[this.miniLog.length - 1];
    if (prev && prev.text === text) return;
    this.miniLog.push({ id: ++this._logSeq, text, tone });
    if (this.miniLog.length > 3) {
      this.miniLog.splice(0, this.miniLog.length - 3);
    }
    if (!this.rootEl) return;
    const container = this.rootEl.querySelector('#hud-minilog-entries');
    if (!container) return;
    container.innerHTML = '';
    for (const item of this.miniLog) {
      const div = document.createElement('div');
      div.className = 'hud-minilog-line';
      div.textContent = item.text;
      container.appendChild(div);
    }
  }

  updateTurnAndCheckUi() {
    if (!this.rootEl) return;
    const turnEl = this.rootEl.querySelector('#hud-turn-text');
    const checkEl = this.rootEl.querySelector('#hud-check-badge');
    if (turnEl) {
      turnEl.textContent = this._formatTurnLabel();
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
    if (valEl) valEl.textContent = `${val}/${max}`;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (trackEl) trackEl.classList.toggle('hot', val >= 9);
  }

  renderStickersUi() {
    if (!this.rootEl) return;
    const row = this.rootEl.querySelector('#hud-stickers-row');
    if (!row) return;
    const badges = FAMILY_STICKERS.filter((s) => this.unlockedStickers.has(s.id)).map((s) => {
      const label = s.name[this.lang] || s.name.it;
      return `<span style="background:#263248;border:1px solid #ffd54f;border-radius:999px;padding:1px 6px;font-size:10px;color:#ffe082;">${label}</span>`;
    });
    row.style.display = badges.length > 0 ? 'flex' : 'none';
    row.innerHTML = badges.join('');
  }

  showToast(message, _durationMs = 2600) {
    this.lastToast = message;
    this.pushMiniLog(message, 'toast');
  }

  refreshTranslations() {
    if (!this.rootEl) return;
    const setTxt = (sel, key) => {
      const el = this.rootEl.querySelector(sel);
      if (el) el.textContent = this.t(key);
    };
    setTxt('#hud-title', 'title');
    setTxt('#hud-mode1-btn', 'mode1Btn');
    setTxt('#hud-mode2-btn', 'mode2Btn');
    setTxt('#hud-matrix-btn', 'matrixBtn');
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
    this._renderMatrixExplorerGrid();
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.checkmateModalTimer) clearTimeout(this.checkmateModalTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._boundKeyDown);
    }
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
  }
}
