/**
 * @fileoverview Headless AIWorkerManager (Niccolò Game Design Rule #1 & #5).
 *
 * Bridges the non-blocking Web Worker CPU (`src/ai/worker.js`) and the Magic Hint
 * Bulb to the `GameEventBus`. Automatically uses a browser `Worker` when available
 * and seamlessly falls back to in-process execution in Node unit tests.
 */

import { chooseBestMove } from '../ai/worker.js';
import { CHARACTER_REGISTRY } from '../core/Registry.js';

export class AIWorkerManager {
  constructor() {
    this.ctx = null;
    this.worker = null;
    this.reqSeq = 0;
    /** @type {Map<number, (res: any) => void>} */
    this.pending = new Map();
    this.enabled = false;
    this.cpuColor = 'b';
    this.difficulty = 'easy';
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
  }

  configure({ enabled = false, cpuColor = 'b', difficulty = 'easy' } = {}) {
    this.enabled = Boolean(enabled);
    this.cpuColor = cpuColor;
    this.difficulty = difficulty;
  }

  /**
   * Computes the best move for `fen` at `difficulty` and emits `AI_THINKING` + `AI_MOVE_READY`.
   */
  async requestMove(fen, difficulty = this.difficulty) {
    const color = fen.split(' ')[1] || 'b';
    this.ctx?.bus.emit({
      type: 'AI_THINKING',
      difficulty,
      color,
      fen,
    });

    const result = await this.compute(fen, difficulty);
    if (result?.move) {
      this.ctx?.bus.emit({
        type: 'AI_MOVE_READY',
        difficulty,
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
    const explanation = m.captured
      ? `${charName} (${m.from} → ${m.to}) cattura ${CHARACTER_REGISTRY[m.captured]?.name || m.captured}! ⚔️`
      : `${charName} si muove da ${m.from} a ${m.to} ✨`;
    const event = {
      type: 'HINT_SUGGESTED',
      move: m,
      from: m.from,
      to: m.to,
      explanation,
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
    for (const off of this.offs) off();
    this.offs = [];
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
  }
}
