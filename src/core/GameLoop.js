/**
 * @fileoverview Fixed-Timestep Simulation Loop (`GameLoop`).
 * Keeps the top-level loop boring per Niccolò Game Design Rule #2:
 *   1. Fixed step `1/30s` simulation ticks (`manager.update(STEP)` + `bus.flush()`)
 *   2. `manager.lateUpdate(frameDt)` for camera/interpolation
 *   3. `render()` callback
 */

export class GameLoop {
  /**
   * @param {Array<{ update?: (dt: number) => void, lateUpdate?: (dt: number) => void }>} managers
   * @param {import('./EventBus.js').GameEventBus} bus
   * @param {number} [step=1/30]
   */
  constructor(managers, bus, step = 1 / 30) {
    this.managers = managers;
    this.bus = bus;
    this.step = step;
    this.acc = 0;
  }

  /**
   * Advance one frame of wall-clock delta time `frameDt` (in seconds).
   * @param {number} frameDt
   * @param {() => void} [render]
   */
  frame(frameDt, render) {
    const clampedDt = Math.min(Math.max(0, frameDt), 0.25);
    this.acc += clampedDt;
    while (this.acc + 1e-9 >= this.step) {
      for (const m of this.managers) {
        if (typeof m.update === 'function') {
          m.update(this.step);
        }
      }
      this.bus.flush();
      this.acc -= this.step;
    }
    if (this.acc < 0) this.acc = 0;
    for (const m of this.managers) {
      if (typeof m.lateUpdate === 'function') {
        m.lateUpdate(clampedDt);
      }
    }
    if (typeof render === 'function') {
      render();
    }
  }
}
