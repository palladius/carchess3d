/**
 * @fileoverview Headless CombatAnimationManager (Niccolò Game Design Rule #1, #6 & #7).
 *
 * - Subscribes to `PIECE_CAPTURED`, `DROP_SPAWNED`, and `WOW_ARENA_CLASH`.
 * - Resolves the declarative 6x6 capture choreography from `BATTLE_MATRIX[attacker][defender]`
 *   with zero `if/else` chains on piece types.
 * - Emits `BATTLE_STARTED` (`durationMs: 2800`), tracks the active cutscene timer in `update(dt)`,
 *   and emits `BATTLE_COMPLETED` on expiry or `BATTLE_SKIPPED` when `skip()` is called.
 * - Strictly headless: zero Three.js imports and zero DOM/window references.
 */

import { BATTLE_MATRIX, CHARACTER_REGISTRY, resolveFamilyMatchup } from '../core/Registry.js';

export const DEFAULT_BATTLE_DURATION_MS = 6000;

export class CombatAnimationManager {
  /**
   * @param {{ durationMs?: number }} [cfg]
   */
  constructor(cfg = {}) {
    this.durationMs = cfg.durationMs ?? DEFAULT_BATTLE_DURATION_MS;
    this.ctx = null;
    this.activeBattle = null;
    this.elapsedMs = 0;
    this.lastCaptureContext = null;
    this.offs = [];
  }

  /**
   * @param {{ bus: import('../core/EventBus.js').GameEventBus }} ctx
   */
  init(ctx) {
    this.ctx = ctx;
    this.offs.push(
      ctx.bus.on('PIECE_CAPTURED', (e) => {
        this.lastCaptureContext = {
          from: e.from,
          to: e.to,
          capturedSquare: e.capturedSquare || e.to,
          color: e.color || 'w',
          victimColor: e.victimColor || (e.color === 'w' ? 'b' : 'w'),
        };
      }),
      ctx.bus.on('DROP_SPAWNED', (e) => this.onDropSpawned(e)),
      ctx.bus.on('WOW_ARENA_CLASH', (e) => this.onWowArenaClash(e)),
      ctx.bus.on('BOARD_RESET', () => {
        this.activeBattle = null;
        this.elapsedMs = 0;
        this.lastCaptureContext = null;
      }),
    );
  }

  /**
   * @returns {boolean}
   */
  isActive() {
    return this.activeBattle !== null;
  }

  /**
   * @returns {boolean}
   */
  isBusy() {
    return this.isActive();
  }

  /**
   * @returns {object|null}
   */
  getActiveBattle() {
    return this.activeBattle;
  }

  /**
   * Normalized progress `0..1` of the currently playing battle cutscene.
   * @returns {number}
   */
  getProgress() {
    if (!this.activeBattle) return 0;
    return Math.min(1, Math.max(0, this.elapsedMs / this.activeBattle.durationMs));
  }

  /**
   * Look up the declarative 6x6 choreography entry for `(attacker, defender)`.
   * @param {string} attacker - 'k'|'q'|'b'|'n'|'r'|'p'
   * @param {string} defender - 'k'|'q'|'b'|'n'|'r'|'p'
   */
  resolveChoreography(attacker, defender) {
    const atkKey = String(attacker || 'p').toLowerCase();
    const defKey = String(defender || 'p').toLowerCase();
    return BATTLE_MATRIX[atkKey]?.[defKey] ?? BATTLE_MATRIX.p.p;
  }

  /**
   * Triggered when `DropManager` emits `DROP_SPAWNED` after a board capture.
   * @param {object} e
   */
  onDropSpawned(e) {
    const cap = this.lastCaptureContext || {};
    const square = e.square || e.to || cap.to || 'd5';
    const from = e.from || cap.from || 'e4';
    const to = e.to || square;
    this.startBattle({
      attacker: e.attacker,
      defender: e.defender,
      familyId: e.familyId || 'carlesso',
      from,
      to,
      square,
      capturedSquare: cap.capturedSquare || square,
      playerId: e.playerId || cap.color || 'w',
      victimColor: cap.victimColor || (e.playerId === 'b' ? 'w' : 'b'),
      tier: e.tier || 'normal',
      spectacle: e.spectacle || 'Standard Signature Clash ⚔️',
      sticker: e.sticker || null,
      source: 'board_capture',
    });
  }

  /**
   * Triggered from Mode 2 (3D WOW Mode & Battle Cinema Arena) or 6x6 Matrix Explorer.
   * @param {object} e
   */
  onWowArenaClash(e) {
    const square = e.square || e.to || 'e4';
    const from = e.from || 'd4';
    const to = e.to || square;
    this.startBattle({
      attacker: e.attacker || 'b',
      defender: e.defender || 'n',
      familyId: e.familyId || 'carlesso',
      from,
      to,
      square,
      capturedSquare: square,
      playerId: e.playerId || 'w',
      victimColor: e.victimColor || 'b',
      tier: e.tier || 'normal',
      spectacle: e.spectacle || 'WOW Arena Showcase Clash 🎬',
      sticker: e.sticker || null,
      durationMs: e.durationMs,
      source: e.source || 'wow_arena',
    });
  }

  /**
   * Starts a 6x6 choreographed battle and emits `BATTLE_STARTED`.
   * @param {object} params
   */
  startBattle(params) {
    const entry = resolveFamilyMatchup(
      params.familyId || 'carlesso',
      params.attacker,
      params.defender,
    );
    const atkChar = CHARACTER_REGISTRY[entry.attacker];
    const defChar = CHARACTER_REGISTRY[entry.defender];
    const durationMs = params.durationMs ?? this.durationMs;

    const playerId = params.playerId || 'w';
    const pm = this.ctx?.pieces || this.ctx?.pieceManager;
    const atkFamily = pm?.getPieceSetForColor?.(playerId) || 'carlesso';
    const isSanGennaro =
      (atkFamily === 'classic' && entry.attacker === 'b') ||
      params.effect === 'san_gennaro_miracle' ||
      params.effect === 'crosier_blessing_beam';

    const battleEvent = {
      type: 'BATTLE_STARTED',
      id: isSanGennaro ? 'san_gennaro_miracle_clash' : entry.id,
      familyId: entry.familyId,
      attacker: entry.attacker,
      defender: entry.defender,
      attackerName: isSanGennaro ? 'San Gennaro ♗🩸' : entry.attackerName,
      defenderName: entry.defenderName,
      attackerDisplayName: entry.attackerDisplayName,
      defenderDisplayName: entry.defenderDisplayName,
      attackerAnimations: atkChar?.animations || null,
      defenderAnimations: defChar?.animations || null,
      from: params.from || 'e4',
      to: params.to || params.square || 'd5',
      square: params.square || params.to || 'd5',
      capturedSquare: params.capturedSquare || params.square || 'd5',
      playerId,
      victimColor: params.victimColor || 'b',
      tier: params.tier || 'normal',
      spectacle: isSanGennaro
        ? 'Miracolo del Sangue di San Gennaro! 🩸✨'
        : params.spectacle || 'Standard Signature Clash ⚔️',
      sticker: params.sticker || null,
      effect: isSanGennaro ? 'san_gennaro_miracle' : entry.effect,
      debrisType: isSanGennaro ? 'san_gennaro_blood_drops' : entry.debrisType,
      victimReaction: isSanGennaro ? 'levitate_dissolve' : entry.victimReaction,
      banner: isSanGennaro
        ? {
            it: 'MIRACOLO DI SAN GENNARO! SANGUE SCIOLTO! 🩸✨',
            en: 'MIRACLE OF ST. JANUARIUS! BLOOD LIQUEFIED! 🩸✨',
          }
        : entry.banner,
      easterEgg: isSanGennaro ? 'san_gennaro_miracle' : entry.easterEgg,
      nonLethalCuddle: entry.nonLethalCuddle,
      hasDedicatedVideo: entry.hasDedicatedVideo,
      hasSkeletalGlbClip: entry.hasSkeletalGlbClip,
      videoUrl: entry.videoUrl,
      compositeUrl: entry.compositeUrl,
      attackerImg: isSanGennaro
        ? 'assets/characters/bishop-classic-vescovo.jpg'
        : entry.attackerImg,
      defenderImg: entry.defenderImg,
      source: params.source || 'board_capture',
      durationMs,
    };

    this.activeBattle = battleEvent;
    this.elapsedMs = 0;
    this.ctx?.bus.emit(battleEvent);
    return battleEvent;
  }

  /**
   * Immediately skips the active cutscene (e.g. via user click/tap/`Space`/`Escape`).
   * @param {string} [reason='user_skip']
   * @returns {boolean} True if an active cutscene was skipped
   */
  skip(reason = 'user_skip') {
    if (!this.activeBattle) return false;
    const current = this.activeBattle;
    const elapsedMs = this.elapsedMs;
    this.activeBattle = null;
    this.elapsedMs = 0;
    this.ctx?.bus.emit({
      ...current,
      type: 'BATTLE_SKIPPED',
      elapsedMs,
      reason,
    });
    return true;
  }

  /**
   * Fixed-timestep update (`dt` in seconds from `GameLoop`, or milliseconds if `dt > 20`).
   * Automatically emits `BATTLE_COMPLETED` when `elapsedMs >= durationMs`.
   * @param {number} dt
   */
  update(dt) {
    if (!this.activeBattle || !(dt > 0)) return;
    const deltaMs = dt > 20 ? dt : dt * 1000;
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.activeBattle.durationMs) {
      const finished = this.activeBattle;
      const elapsedMs = this.elapsedMs;
      this.activeBattle = null;
      this.elapsedMs = 0;
      this.ctx?.bus.emit({
        ...finished,
        type: 'BATTLE_COMPLETED',
        elapsedMs,
      });
    }
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
    this.activeBattle = null;
  }
}
