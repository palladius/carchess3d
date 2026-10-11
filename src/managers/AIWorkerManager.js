/**
 * @fileoverview Headless AIWorkerManager (Niccolò Game Design Rule #1 & #5).
 *
 * Bridges the non-blocking Web Worker CPU (`src/ai/worker.js`) and the Magic Hint
 * Bulb to the `GameEventBus`. Automatically uses a browser `Worker` when available
 * and seamlessly falls back to in-process execution in Node unit tests.
 */

import { chooseBestMove } from '../ai/worker.js';
import { CHARACTER_REGISTRY } from '../core/Registry.js';

/** Small "thinking" pause so the CPU reply does not feel instantaneous. */
export const CPU_REPLY_DELAY_MS = 260;

export class AIWorkerManager {
  constructor({ replyDelayMs = CPU_REPLY_DELAY_MS } = {}) {
    this.ctx = null;
    this.worker = null;
    this.reqSeq = 0;
    /** @type {Map<number, (res: any) => void>} */
    this.pending = new Map();
    this.enabled = false;
    this.cpuColor = 'b';
    this.difficulty = 'easy';
    this.replyDelayMs = replyDelayMs;
    /** Bumped whenever the CPU turn is (re)scheduled so stale timers become no-ops. */
    this.turnGeneration = 0;
    this.turnTimer = null;
    this.thinking = false;
    this.offs = [];
  }

  /**
   * @param {{ bus: import('../core/EventBus.js').GameEventBus, rng: { next: () => number, seed?: () => number } }} ctx
   */
  init(ctx) {
    this.ctx = ctx;
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../ai/worker.js', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = (e) => {
          const { id, ...payload } = e.data || {};
          const resolve = this.pending.get(id);
          if (resolve) {
            this.pending.delete(id);
            resolve(payload);
          }
        };
      } catch {
        this.worker = null;
      }
    }

    const bus = ctx?.bus;
    if (bus?.on) {
      this.offs.push(
        bus.on('OPPONENT_CHANGED', (e) => {
          const cpuColor = e.cpuColor ?? this.cpuColor ?? 'b';
          const enabled =
            typeof e.enabled === 'boolean'
              ? e.enabled
              : e.mode !== 'hotseat' && cpuColor !== 'none';
          this.configure({
            enabled,
            cpuColor,
            difficulty: e.difficulty || e.mode || this.difficulty || 'easy',
            whiteDifficulty: e.whiteDifficulty || e.difficulty || this.whiteDifficulty || 'easy',
            blackDifficulty: e.blackDifficulty || e.difficulty || e.mode || this.blackDifficulty || 'easy',
          });
        }),
        bus.on('MOVE_EXECUTED', () => this.scheduleCpuTurn()),
        bus.on('BOARD_RESET', () => this.scheduleCpuTurn()),
        bus.on('BATTLE_COMPLETED', () => this.scheduleCpuTurn()),
        bus.on('BATTLE_SKIPPED', () => this.scheduleCpuTurn()),
      );
    }
  }

  configure({
    enabled = false,
    cpuColor = 'b',
    difficulty = 'easy',
    whiteDifficulty = 'easy',
    blackDifficulty = 'easy',
  } = {}) {
    this.enabled = Boolean(enabled);
    this.cpuColor = cpuColor;
    this.difficulty = difficulty;
    this.whiteDifficulty = whiteDifficulty || difficulty;
    this.blackDifficulty = blackDifficulty || difficulty;
    this.scheduleCpuTurn();
  }

  /** True when the board says it is the CPU's turn and the game is still running. */
  isCpuTurn() {
    const board = this.ctx?.board;
    if (!this.enabled || !board) return false;
    if (board.isGameOver?.()) return false;
    const currentTurn = board.turn?.();
    if (this.cpuColor === 'both') return true;
    if (this.cpuColor === 'none') return false;
    return currentTurn === this.cpuColor;
  }

  /** True while a capture cutscene / combat choreography is running: the CPU waits. */
  isCutsceneRunning() {
    const flowState = this.ctx?.flow?.state?.();
    if (flowState === 'CaptureCutscene') return true;
    return Boolean(this.ctx?.combat?.isActive?.());
  }

  /**
   * (Re)evaluates whether the CPU should move now. Called on every relevant fact.
   * Safe to call often: a pending timer is replaced, in-flight thinking is not duplicated.
   */
  scheduleCpuTurn() {
    this.cancelScheduledTurn();
    if (!this.isCpuTurn() || this.isCutsceneRunning() || this.thinking) return;
    const generation = ++this.turnGeneration;
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      if (generation !== this.turnGeneration) return;
      if (!this.isCpuTurn() || this.isCutsceneRunning() || this.thinking) return;
      this.thinking = true;
      this.requestMove(this.ctx.board.fen())
        .catch(() => null)
        .finally(() => {
          this.thinking = false;
        });
    }, this.replyDelayMs);
  }

  cancelScheduledTurn() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  /**
   * Computes the best move for `fen` at `difficulty` and emits `AI_THINKING` + `AI_MOVE_READY`.
   */
  async requestMove(fen, difficulty = null) {
    const color = fen.split(' ')[1] || 'b';
    const activeDifficulty =
      difficulty ||
      (color === 'w' ? this.whiteDifficulty : this.blackDifficulty) ||
      this.difficulty ||
      'easy';
    this.ctx?.bus.emit({
      type: 'AI_THINKING',
      difficulty: activeDifficulty,
      color,
      fen,
    });

    const result = await this.compute(fen, activeDifficulty);
    if (result?.move) {
      this.ctx?.bus.emit({
        type: 'AI_MOVE_READY',
        difficulty: activeDifficulty,
        color,
        move: result.move,
        score: result.score,
        depth: result.depth,
        elapsedMs: result.elapsedMs,
      });
    }
    return result;
  }

  /**
   * Kid-friendly 💡 Magic Hint Bulb: suggests a strong legal move and emits `HINT_SUGGESTED`.
   */
  async requestHint(fen) {
    const result = await this.compute(fen, 'medium');
    if (!result?.move) return null;
    const m = result.move;
    const charName = CHARACTER_REGISTRY[m.piece]?.name || m.piece;
    const capName = m.captured ? CHARACTER_REGISTRY[m.captured]?.name || m.captured : '';
    const explanationEn = m.captured
      ? `${charName} (${m.from} → ${m.to}) captures ${capName}! ⚔️`
      : `${charName} moves from ${m.from} to ${m.to} ✨`;
    const explanationIt = m.captured
      ? `${charName} (${m.from} → ${m.to}) cattura ${capName}! ⚔️`
      : `${charName} si muove da ${m.from} a ${m.to} ✨`;
    const event = {
      type: 'HINT_SUGGESTED',
      move: m,
      from: m.from,
      to: m.to,
      explanation: explanationEn,
      explanationEn,
      explanationIt,
    };
    this.ctx?.bus.emit(event);
    return event;
  }

  compute(fen, difficulty) {
    const seed = this.ctx?.rng?.seed ? this.ctx.rng.seed() : 42;
    if (this.worker) {
      const id = ++this.reqSeq;
      return new Promise((resolve) => {
        this.pending.set(id, resolve);
        this.worker.postMessage({ id, fen, difficulty, seed });
      });
    }
    const res = chooseBestMove(fen, difficulty, this.ctx?.rng);
    return Promise.resolve(res);
  }

  update(_dt) {
    // Event/Promise driven
  }

  dispose() {
    this.cancelScheduledTurn();
    this.turnGeneration++;
    for (const off of this.offs) off();
    this.offs = [];
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
  }
}
