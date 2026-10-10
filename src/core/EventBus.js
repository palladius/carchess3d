/**
 * @fileoverview Deferred, Deterministic GameEventBus (Niccolò Game Design Rule #3 & #4).
 *
 * - `emit(event)` enqueues past-tense facts (`PIECE_SELECTED`, `MOVE_EXECUTED`, etc.).
 * - `flush()` dispatches queued events once per fixed tick in FIFO order.
 * - Events emitted *during* `flush()` are queued for the next `flush()`, preventing
 *   re-entrancy bugs and guaranteeing deterministic ordering.
 */

export class GameEventBus {
  constructor() {
    /** @type {Map<string, Set<(event: object) => void>>} */
    this.handlers = new Map();
    /** @type {Set<(event: object) => void>} */
    this.wildcardHandlers = new Set();
    /** @type {Array<object>} */
    this.queue = [];
    /** @type {Array<object>} */
    this.history = [];
    this.maxHistory = 200;
  }

  /**
   * Subscribe to an event type (or '*' for all events).
   * Returns an unsubscribe function to call in `dispose()`.
   * @param {string} type
   * @param {(event: object) => void} handler
   * @returns {() => void}
   */
  on(type, handler) {
    if (type === '*') {
      this.wildcardHandlers.add(handler);
      return () => this.wildcardHandlers.delete(handler);
    }
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  /**
   * Enqueue a past-tense fact event for delivery on the next `flush()`.
   * @param {{ type: string, [key: string]: any }} event
   */
  emit(event) {
    if (!event || typeof event.type !== 'string') {
      throw new Error('GameEventBus.emit requires an event object with a string `type`');
    }
    this.queue.push(event);
  }

  /**
   * Deliver all currently queued events in FIFO order.
   * Events emitted by handlers during `flush()` wait for the next `flush()`.
   * @returns {number} Number of events dispatched in this batch
   */
  flush() {
    if (this.queue.length === 0) return 0;
    const batch = this.queue;
    this.queue = [];
    for (const event of batch) {
      this.history.push(event);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
      const set = this.handlers.get(event.type);
      if (set) {
        for (const handler of [...set]) {
          handler(event);
        }
      }
      for (const wildcard of [...this.wildcardHandlers]) {
        wildcard(event);
      }
    }
    return batch.length;
  }

  /**
   * Clear pending queue and optionally all handlers.
   * @param {boolean} [clearHandlers=false]
   */
  clear(clearHandlers = false) {
    this.queue = [];
    if (clearHandlers) {
      this.handlers.clear();
      this.wildcardHandlers.clear();
    }
  }
}
