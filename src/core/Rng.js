/**
 * @fileoverview Deterministic Seeded PRNG (`mulberry32`).
 * Used across DropManager, AIWorkerManager, and VFX pools for reproducible
 * unit tests, Monte-Carlo verification, and deterministic replays.
 */

/**
 * Creates a seeded `mulberry32` PRNG instance.
 * @param {number} [seed=42]
 * @returns {{ next: () => number, nextInt: (min: number, max: number) => number, pick: <T>(arr: T[]) => T, seed: () => number }}
 */
export function mulberry32(seed = 42) {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick(arr) {
      if (!arr || arr.length === 0) return undefined;
      return arr[Math.floor(this.next() * arr.length)];
    },
    seed() {
      return a;
    },
  };
}
