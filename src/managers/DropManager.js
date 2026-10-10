/**
 * @fileoverview Headless DropManager — Kid-Friendly "🍀 Barra della Fortuna" (Pity Timer).
 *
 * Follows `.agents/skills/niccolo-game-design/references/drop-manager-pity.md`:
 * - Every capture increases the active player's Luck `L` by the captured piece's weight:
 *   `Pawn = 1, Knight = 3, Bishop = 3, Rook = 5, Queen = 9`.
 * - Hard Pity threshold: `L_max = 12`.
 * - Soft Pity: As `t = clamp(L / L_max, 0, 1)` rises, weights shift smoothly from
 *   `normal` -> `shiny` -> `golden_crit`.
 * - Hard Pity (`L >= 12`): Guarantees `golden_crit` (🌟 Critical Golden Capture Spectacle
 *   + Collectible Family Sticker unlock) and resets `L = 0` (`LUCK_RESET`).
 */

import { FAMILY_STICKERS } from '../core/Registry.js';

export const PIECE_LUCK_WEIGHTS = Object.freeze({
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 12,
});

export const SPECTACLE_TIERS = Object.freeze(['normal', 'shiny', 'golden_crit']);
const GOLDEN_CRIT_INDEX = 2;

export const DEFAULT_DROP_CONFIG = Object.freeze({
  luckMax: 12,
  baseWeights: [82, 16, 2],  // at t = 0: 82% normal, 16% shiny, 2% golden_crit
  luckyWeights: [20, 50, 30], // at t = 1 (before hard pity clamp): 20% normal, 50% shiny, 30% golden_crit
});

export class DropManager {
  /**
   * @param {Partial<typeof DEFAULT_DROP_CONFIG>} [cfg]
   */
  constructor(cfg = {}) {
    this.cfg = { ...DEFAULT_DROP_CONFIG, ...cfg };
    this.ctx = null;
    /** @type {Map<string, number>} */
    this.luckByPlayer = new Map([
      ['w', 0],
      ['b', 0],
    ]);
    /** @type {Map<string, Set<string>>} */
    this.stickersByPlayer = new Map([
      ['w', new Set()],
      ['b', new Set()],
    ]);
    this.offs = [];
  }

  /**
   * @param {{ bus: import('../core/EventBus.js').GameEventBus, rng: { next: () => number } }} ctx
   */
  init(ctx) {
    this.ctx = ctx;
    this.offs.push(
      ctx.bus.on('PIECE_CAPTURED', (e) => this.onPieceCaptured(e)),
      ctx.bus.on('BOARD_RESET', () => {
        this.luckByPlayer.set('w', 0);
        this.luckByPlayer.set('b', 0);
        this.emitLuckChanged('w');
        this.emitLuckChanged('b');
      }),
    );
  }

  getLuck(playerId = 'w') {
    return this.luckByPlayer.get(playerId) ?? 0;
  }

  getLuckRatio(playerId = 'w') {
    return Math.min(1, this.getLuck(playerId) / this.cfg.luckMax);
  }

  getUnlockedStickers(playerId = 'w') {
    return [...(this.stickersByPlayer.get(playerId) ?? [])];
  }

  setLuckForTest(playerId, value) {
    this.luckByPlayer.set(playerId, Math.max(0, value));
  }

  onPieceCaptured(e) {
    const playerId = e.color || 'w';
    const weight = e.weight ?? PIECE_LUCK_WEIGHTS[e.defender] ?? 1;
    const newLuck = this.getLuck(playerId) + weight;
    this.luckByPlayer.set(playerId, newLuck);

    const t = Math.min(1, newLuck / this.cfg.luckMax);
    this.emitLuckChanged(playerId);

    const hardPity = newLuck >= this.cfg.luckMax;
    const tierIndex = this.pickTierIndex(t, hardPity);
    const tier = SPECTACLE_TIERS[tierIndex];

    let sticker = null;
    if (tierIndex >= GOLDEN_CRIT_INDEX) {
      sticker = this.unlockNextSticker(playerId);
    }

    this.ctx?.bus.emit({
      type: 'DROP_SPAWNED',
      playerId,
      tier,
      spectacle: this.resolveSpectacleLabel(e.attacker, tier),
      sticker,
      attacker: e.attacker,
      defender: e.defender,
      square: e.to,
    });

    if (tierIndex >= GOLDEN_CRIT_INDEX) {
      this.resetLuck(playerId, sticker);
    }
  }

  pickTierIndex(t, hardPity) {
    if (hardPity) return GOLDEN_CRIT_INDEX;
    const w = this.cfg.baseWeights.map(
      (base, i) => base + (this.cfg.luckyWeights[i] - base) * t,
    );
    const total = w.reduce((acc, val) => acc + val, 0);
    let roll = (this.ctx?.rng ? this.ctx.rng.next() : 0.5) * total;
    for (let i = 0; i < w.length; i++) {
      roll -= w[i];
      if (roll < 0) return i;
    }
    return w.length - 1;
  }

  unlockNextSticker(playerId) {
    let set = this.stickersByPlayer.get(playerId);
    if (!set) {
      set = new Set();
      this.stickersByPlayer.set(playerId, set);
    }
    const locked = FAMILY_STICKERS.filter((s) => !set.has(s.id));
    const pool = locked.length > 0 ? locked : FAMILY_STICKERS;
    const idx = Math.floor((this.ctx?.rng ? this.ctx.rng.next() : 0) * pool.length);
    const chosen = pool[idx] || FAMILY_STICKERS[0];
    set.add(chosen.id);
    return chosen;
  }

  resolveSpectacleLabel(attacker, tier) {
    if (tier === 'golden_crit') {
      const critNames = {
        k: 'Golden Toilet-Throne Mega Strike 🚽👑🌟',
        q: 'Royal Choco-Lilac Supernova 🍫💜🌟',
        b: 'Rainbow Dragon Crystal Supernova 🐉💎🌟',
        n: 'Mega Orange Loop-Track Grand Prix 🏎️🔥🌟',
        r: 'Giant Fluffy Cuddle Supernova 🤗💜🌟',
        p: 'Golden Swiss-Guard Mega Fish-Slap 🐟🌟',
      };
      return critNames[attacker] || 'Golden Critical Capture Spectacle 🌟';
    }
    if (tier === 'shiny') {
      return 'Shiny Sparkle Clash ✨';
    }
    return 'Standard Signature Clash ⚔️';
  }

  emitLuckChanged(playerId) {
    const luck = this.getLuck(playerId);
    const t = Math.min(1, luck / this.cfg.luckMax);
    this.ctx?.bus.emit({
      type: 'LUCK_CHANGED',
      playerId,
      luck,
      maxLuck: this.cfg.luckMax,
      t,
    });
  }

  resetLuck(playerId, sticker = null) {
    this.luckByPlayer.set(playerId, 0);
    this.ctx?.bus.emit({
      type: 'LUCK_RESET',
      playerId,
      sticker,
    });
    this.emitLuckChanged(playerId);
  }

  update(_dt) {
    // Event-driven
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
  }
}
