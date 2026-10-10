/**
 * @fileoverview Headless GameFlowManager (Niccolò Game Design Rule #1 & #3).
 *
 * State machine owning high-level screen/mode transitions:
 *   `Boot -> Mode1_Chess <-> Mode2_WowArena -> CaptureCutscene -> Checkmate/Draw`
 *
 * Emits `FLOW_STATE_CHANGED` on the queued `GameEventBus`.
 * Never touches DOM or Three.js directly.
 */

export const FLOW_STATES = Object.freeze({
  BOOT: 'Boot',
  MODE1_CHESS: 'Mode1_Chess',
  MODE2_WOW_ARENA: 'Mode2_WowArena',
  CAPTURE_CUTSCENE: 'CaptureCutscene',
  CHECKMATE: 'Checkmate',
  DRAW: 'Draw',
});

export class GameFlowManager {
  constructor() {
    this.ctx = null;
    this.currentState = FLOW_STATES.BOOT;
    this.previousPlayState = FLOW_STATES.MODE1_CHESS;
    this.pendingOutcome = null;
    this.offs = [];
  }

  /**
   * @param {{ bus: import('../core/EventBus.js').GameEventBus }} ctx
   */
  init(ctx) {
    this.ctx = ctx;
    this.offs.push(
      ctx.bus.on('BATTLE_STARTED', (e) => {
        if (
          this.currentState === FLOW_STATES.MODE1_CHESS ||
          this.currentState === FLOW_STATES.MODE2_WOW_ARENA
        ) {
          this.previousPlayState = this.currentState;
        }
        this.transitionTo(FLOW_STATES.CAPTURE_CUTSCENE, 'battle_started', e);
      }),
      ctx.bus.on('BATTLE_SKIPPED', (e) => {
        this.finishCutscene('battle_skipped', e);
      }),
      ctx.bus.on('BATTLE_COMPLETED', (e) => {
        this.finishCutscene('battle_completed', e);
      }),
      ctx.bus.on('CHECKMATE', (e) => {
        if (this.currentState === FLOW_STATES.CAPTURE_CUTSCENE) {
          this.pendingOutcome = { state: FLOW_STATES.CHECKMATE, reason: 'checkmate', payload: e };
        } else {
          this.transitionTo(FLOW_STATES.CHECKMATE, 'checkmate', e);
        }
      }),
      ctx.bus.on('DRAW', (e) => {
        if (this.currentState === FLOW_STATES.CAPTURE_CUTSCENE) {
          this.pendingOutcome = { state: FLOW_STATES.DRAW, reason: e.reason || 'draw', payload: e };
        } else {
          this.transitionTo(FLOW_STATES.DRAW, e.reason || 'draw', e);
        }
      }),
      ctx.bus.on('BOARD_RESET', (e) => {
        this.pendingOutcome = null;
        if (this.currentState !== FLOW_STATES.MODE2_WOW_ARENA) {
          this.transitionTo(FLOW_STATES.MODE1_CHESS, 'board_reset', e);
        }
      }),
    );
  }

  state() {
    return this.currentState;
  }

  startChessMode(payload = {}) {
    this.pendingOutcome = null;
    this.previousPlayState = FLOW_STATES.MODE1_CHESS;
    this.transitionTo(FLOW_STATES.MODE1_CHESS, 'start_chess', payload);
  }

  startWowMode(payload = {}) {
    this.previousPlayState = FLOW_STATES.MODE2_WOW_ARENA;
    this.transitionTo(FLOW_STATES.MODE2_WOW_ARENA, 'start_wow', payload);
  }

  toggleWowMode() {
    if (this.currentState === FLOW_STATES.MODE2_WOW_ARENA) {
      this.startChessMode();
    } else {
      this.startWowMode();
    }
  }

  finishCutscene(reason, payload) {
    if (this.currentState !== FLOW_STATES.CAPTURE_CUTSCENE) return;
    if (this.pendingOutcome) {
      const outcome = this.pendingOutcome;
      this.pendingOutcome = null;
      this.transitionTo(outcome.state, outcome.reason, outcome.payload);
      return;
    }
    this.transitionTo(this.previousPlayState || FLOW_STATES.MODE1_CHESS, reason, payload);
  }

  transitionTo(nextState, reason = 'manual', payload = {}) {
    if (this.currentState === nextState) return;
    const from = this.currentState;
    this.currentState = nextState;
    if (this.ctx?.bus) {
      this.ctx.bus.emit({
        type: 'FLOW_STATE_CHANGED',
        from,
        to: nextState,
        reason,
        payload,
      });
    }
  }

  update(_dt) {
    // Event-driven state transitions
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
  }
}
