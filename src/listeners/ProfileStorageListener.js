/**
 * @fileoverview Passwordless Family Profile Storage Listener (`ProfileStorageListener`).
 *
 * Follows Niccolò Game Design Rule #5: **Listeners, Not Callers** —
 * subscribes to `MOVE_EXECUTED`, `BOARD_RESET`, `DROP_SPAWNED`, `LUCK_CHANGED`,
 * `CHECKMATE`, and `PROFILE_CHANGED`, persisting per-profile state under
 * `localStorage['carchess3d_profiles_v1']` (with an automatic in-memory fallback
 * for headless Node unit tests).
 *
 * Profiles: `ale`, `seby`, `riccardo`, `kate`, `ospite`.
 */

import { PROFILES } from '../core/Registry.js';

export const STORAGE_KEY = 'carchess3d_profiles_v1';

function createDefaultProfileEntry(profileId) {
  return {
    activeProfile: profileId,
    fen: null,
    pgn: '',
    luck: 0,
    stickers: [],
    stats: {
      wins: 0,
      captures: 0,
    },
  };
}

export class ProfileStorageListener {
  /**
   * @param {object} [ctx]
   * @param {{ getItem?: (k:string)=>string|null, setItem?: (k:string,v:string)=>void }} [customStorage]
   */
  constructor(ctx = null, customStorage = null) {
    this.ctx = ctx;
    this.storage = customStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.memoryStore = new Map();
    this.activeProfile = 'ale';
    this.state = this.loadStore();
    this.offs = [];

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
    if (!bus || this.offs.length > 0) return;

    this.offs.push(
      bus.on('MOVE_EXECUTED', (e) => {
        const entry = this.getProfile(this.activeProfile);
        entry.fen = e.fen || entry.fen;
        entry.pgn = e.pgn ?? entry.pgn;
        if (e.captured) {
          entry.stats.captures = (entry.stats.captures || 0) + 1;
        }
        this.saveStore();
      }),
      bus.on('BOARD_RESET', (e) => {
        const entry = this.getProfile(this.activeProfile);
        entry.fen = e.fen || null;
        entry.pgn = '';
        entry.luck = 0;
        this.saveStore();
      }),
      bus.on('LUCK_CHANGED', (e) => {
        if ((e.playerId || 'w') === 'w') {
          const entry = this.getProfile(this.activeProfile);
          entry.luck = e.luck ?? 0;
          this.saveStore();
        }
      }),
      bus.on('DROP_SPAWNED', (e) => {
        const entry = this.getProfile(this.activeProfile);
        if (e.sticker?.id && !entry.stickers.includes(e.sticker.id)) {
          entry.stickers.push(e.sticker.id);
        }
        this.saveStore();
      }),
      bus.on('CHECKMATE', (e) => {
        const entry = this.getProfile(this.activeProfile);
        if (e.winner === 'w') {
          entry.stats.wins = (entry.stats.wins || 0) + 1;
        }
        entry.fen = null;
        entry.pgn = '';
        this.saveStore();
      }),
      bus.on('PROFILE_CHANGED', (e) => {
        this.switchProfile(e.profileId || 'ale', e.restoreBoard !== false);
      }),
    );
  }

  loadStore() {
    let raw = null;
    try {
      raw = this.storage ? this.storage.getItem(STORAGE_KEY) : this.memoryStore.get(STORAGE_KEY);
    } catch {
      raw = null;
    }

    const base = {
      activeProfile: 'ale',
      profiles: {},
    };
    for (const p of PROFILES) {
      base.profiles[p.id] = createDefaultProfileEntry(p.id);
    }

    if (!raw) return base;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        base.activeProfile = parsed.activeProfile || 'ale';
        if (parsed.profiles && typeof parsed.profiles === 'object') {
          for (const [id, data] of Object.entries(parsed.profiles)) {
            base.profiles[id] = {
              ...createDefaultProfileEntry(id),
              ...data,
              stickers: Array.isArray(data?.stickers) ? [...new Set(data.stickers)] : [],
              stats: {
                wins: data?.stats?.wins || 0,
                captures: data?.stats?.captures || 0,
              },
            };
          }
        }
      }
    } catch {
      // Return clean default store if JSON is corrupted
    }
    this.activeProfile = base.activeProfile;
    return base;
  }

  saveStore() {
    this.state.activeProfile = this.activeProfile;
    const serialized = JSON.stringify(this.state);
    try {
      if (this.storage) {
        this.storage.setItem(STORAGE_KEY, serialized);
      } else {
        this.memoryStore.set(STORAGE_KEY, serialized);
      }
    } catch {
      this.memoryStore.set(STORAGE_KEY, serialized);
    }
  }

  getProfile(profileId = this.activeProfile) {
    const id = String(profileId || 'ale').toLowerCase();
    if (!this.state.profiles[id]) {
      this.state.profiles[id] = createDefaultProfileEntry(id);
    }
    return this.state.profiles[id];
  }

  switchProfile(profileId, restoreBoard = false) {
    const id = String(profileId || 'ale').toLowerCase();
    this.activeProfile = id;
    const entry = this.getProfile(id);
    this.saveStore();

    // Sync DropManager luck & unlocked stickers for the active profile
    const drops = this.ctx?.drops || this.ctx?.dropManager;
    if (drops) {
      drops.luckByPlayer?.set('w', entry.luck || 0);
      if (drops.stickersByPlayer) {
        drops.stickersByPlayer.set('w', new Set(entry.stickers || []));
      }
      drops.emitLuckChanged?.('w');
    }

    if (restoreBoard && entry.fen && this.ctx?.board?.loadFen) {
      try {
        this.ctx.board.loadFen(entry.fen);
      } catch {}
    }

    this.ctx?.bus?.emit({
      type: 'PROFILE_RESTORED',
      profileId: id,
      fen: entry.fen,
      pgn: entry.pgn,
      luck: entry.luck,
      stickers: [...entry.stickers],
      stats: { ...entry.stats },
    });
    return entry;
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
  }
}
