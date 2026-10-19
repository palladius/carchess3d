/**
 * @fileoverview Headless PieceManager (Niccolò Game Design Rule #2, #3, #6).
 *
 * Tracks living 8x8 pieces, captured White/Black trays, rival set mode (`'family'|'stone'`),
 * and Bishop Ale GLB variant (`'rigged'|'hat'`). Zero DOM or Three.js imports (`<= 300` LOC).
 */

import { CHARACTER_REGISTRY, FAMILY_REGISTRIES, squareToWorld, BISHOP_GLB_VARIANTS, QUEEN_GLB_VARIANTS, KNIGHT_GLB_VARIANTS } from '../core/Registry.js';
import { CANONICAL_PIECE_HEIGHTS } from '../utils/glbGrounding.js';

export { BISHOP_GLB_VARIANTS, QUEEN_GLB_VARIANTS, KNIGHT_GLB_VARIANTS };

export const CLIP_ALIASES = Object.freeze({
  Idle: 'Idle_Track', Idle_Track: 'Idle_Track',
  Click_Fire_Breath: 'FireBreath_Track', FireBreath_Track: 'FireBreath_Track',
});

export class PieceManager {

  constructor() {
    this.ctx = null;
    /** @type {'carlesso'|'swamp'|'classic'} */
    this.whiteFamily = 'carlesso';
    /** @type {'family'|'swamp'|'classic'|'stone'} */
    this.rivalSetMode = 'family';
    /** @type {'hat'|'astrolabe'|'rigged'} */
    this.bishopVariant = 'hat';
    /** @type {'young'|'wedding'} */
    this.queenVariant = 'young';
    /** @type {'classic'|'lightsaber'|'halberd'|'aurora'} */
    this.knightVariant = 'classic';
    /** @type {'auto'|'low'|'medium'|'high'} */
    this.qualityTier = 'auto';
    /** @type {'low'|'medium'|'high'} */
    this.effectiveLod = 'high';
    /** @type {Map<string, object>} */
    this.livingBySquare = new Map();
    /** @type {{ w: Array<object>, b: Array<object> }} */
    this.capturedTrays = { w: [], b: [] };
    this.offs = [];
  }

  init(ctx) {
    this.ctx = ctx;
    if (ctx?.board?.pieces) {
      this.syncFromBoard(ctx.board.pieces(), false);
    }
    if (!ctx?.bus) return;
    this.offs.push(
      ctx.bus.on('BOARD_RESET', (e) => {
        this.capturedTrays = { w: [], b: [] };
        this.syncFromBoard(e.pieces || this.ctx?.board?.pieces?.() || [], true);
      }),
      ctx.bus.on('PIECE_CAPTURED', (e) => this.handlePieceCaptured(e)),
      ctx.bus.on('CASTLING_EXECUTED', (e) => this.handleCastling(e)),
      ctx.bus.on('MOVE_EXECUTED', (e) => this.handleMoveExecuted(e)),
      ctx.bus.on('WOW_TRIGGER_ANIMATION', (e) => this.requestAnimation(e)),
      ctx.bus.on('PIECE_VARIANT_REQUESTED', (e) => {
        if (e.bishopVariant) this.setBishopVariant(e.bishopVariant);
        if (e.queenVariant) this.setQueenVariant(e.queenVariant);
        if (e.knightVariant) this.setKnightVariant(e.knightVariant);
      }),
      ctx.bus.on('QUALITY_TIER_CHANGED', (e) => {
        this.qualityTier = e.tier || 'auto';
        this.effectiveLod = e.effectiveLod || (this.qualityTier === 'auto' ? 'high' : this.qualityTier);
        this.emitPiecesSynced('quality_tier_changed');
      }),
    );
  }


  resolveDescriptor(raw) {
    const type = String(raw.type || 'p').toLowerCase();
    const color = raw.color === 'b' ? 'b' : 'w';
    const square = raw.square || 'e4';
    const isStoneSet = color === 'b' && this.rivalSetMode === 'stone';
    const activeFamily = color === 'w'
      ? this.whiteFamily
      : (isStoneSet || this.rivalSetMode === 'family' ? 'carlesso' : this.rivalSetMode);
    const reg = FAMILY_REGISTRIES[activeFamily] || CHARACTER_REGISTRY;
    const meta = reg[type] || CHARACTER_REGISTRY[type] || CHARACTER_REGISTRY.p;

    let glbUrl = null;
    if (!isStoneSet) {
      if (activeFamily === 'carlesso' && type === 'b') {
        glbUrl = BISHOP_GLB_VARIANTS[this.bishopVariant] || meta.glbUrl;
      } else if (activeFamily === 'carlesso' && type === 'q') {
        glbUrl = QUEEN_GLB_VARIANTS[this.queenVariant] || meta.glbUrl;
      } else if (activeFamily === 'carlesso' && type === 'n') {
        glbUrl = KNIGHT_GLB_VARIANTS[this.knightVariant] || meta.glbUrl;
      } else {
        glbUrl = meta.glbUrl || null;
      }
    }

    const pos = squareToWorld(square);
    return {
      id: raw.id || `${color}_${type}_${square}`,
      square, type, color,
      family: isStoneSet ? 'stone' : activeFamily,
      role: meta.role,
      name: isStoneSet ? `Stone ${meta.role[0].toUpperCase()}${meta.role.slice(1)}` : meta.name,
      glyph: meta.glyph,
      height: CANONICAL_PIECE_HEIGHTS[type] ?? meta.height ?? 1.2,
      glbUrl,
      optionalGlbCandidates: meta.optionalGlbCandidates || [],
      frontPortrait: meta.frontPortrait,
      altPortrait: meta.altPortrait || meta.frontPortrait,
      backPortrait: meta.backPortrait || meta.frontPortrait,
      accentColor: meta.accentColor,
      isStoneSet,
      animations: { ...meta.animations },
      x: pos.x, y: 0, z: pos.z,
    };
  }

  syncFromBoard(rawPieces = [], emitEvent = true) {
    this.livingBySquare.clear();
    for (const item of rawPieces) {
      const desc = this.resolveDescriptor(item);
      this.livingBySquare.set(desc.square, desc);
    }
    if (emitEvent) this.emitPiecesSynced('board_sync');
  }

  handlePieceCaptured(e) {
    const victimColor = e.victimColor || (e.color === 'w' ? 'b' : 'w');
    const capturedSq = e.capturedSquare || e.to || 'e4';
    const defType = String(e.defender || this.livingBySquare.get(capturedSq)?.type || 'p').toLowerCase();
    const existing = this.livingBySquare.get(capturedSq);
    const isRealBoardMove = Boolean(e.move) || e.removeLiving === true;
    if (isRealBoardMove && existing && existing.color === victimColor) {
      this.livingBySquare.delete(capturedSq);
    }

    const trayList = this.capturedTrays[victimColor] || this.capturedTrays.b;
    const slotIndex = trayList.length;
    const captureId = e.id || (isRealBoardMove
      ? `${existing?.id || `captured_${victimColor}_${defType}_${capturedSq}`}_${slotIndex}`
      : `swamp_${victimColor}_${defType}_${capturedSq}`);
    if (trayList.some((item) => item.id === captureId)) return false;

    const sideSign = victimColor === 'w' ? -1 : 1;
    const trayX = sideSign * (6.25 + (slotIndex % 2) * 0.95), trayY = -0.28, trayZ = Math.floor(slotIndex / 2) * 1.05 - 2.65;

    const desc = this.resolveDescriptor({ type: defType, color: victimColor, square: capturedSq, id: captureId });
    trayList.push({
      ...desc,
      capturedFromSquare: capturedSq,
      capturedBy: e.attacker || 'p',
      trayIndex: slotIndex,
      trayX, trayY, trayZ,
    });
    return true;
  }

  seedSwampParty() {
    const swimmers = [
      { defender: 'b', victimColor: 'w', capturedSquare: 'c1', attacker: 'n' }, { defender: 'n', victimColor: 'w', capturedSquare: 'g1', attacker: 'r' },
      { defender: 'p', victimColor: 'w', capturedSquare: 'e2', attacker: 'q' }, { defender: 'n', victimColor: 'b', capturedSquare: 'b8', attacker: 'b' },
      { defender: 'b', victimColor: 'b', capturedSquare: 'f8', attacker: 'k' }, { defender: 'r', victimColor: 'b', capturedSquare: 'h8', attacker: 'n' },
    ];
    let added = 0;
    for (const s of swimmers) {
      if (this.handlePieceCaptured(s)) added++;
    }
    if (added > 0) this.emitPiecesSynced('swamp_party_demo');
    return added;
  }

  handleCastling(e) {
    const rook = this.livingBySquare.get(e.rookFrom);
    if (rook) {
      this.livingBySquare.delete(e.rookFrom);
      this.livingBySquare.set(e.rookTo, this.resolveDescriptor({ ...rook, square: e.rookTo, id: rook.id }));
    }
    this.ctx?.bus?.emit({
      type: 'PIECE_ANIM_REQUESTED', animType: 'castling_belly_bounce',
      color: e.color, side: e.side, kingFrom: e.kingFrom, kingTo: e.kingTo, rookFrom: e.rookFrom, rookTo: e.rookTo,
    });
  }

  handleMoveExecuted(e) {
    const move = e.move;
    if (this.ctx?.board?.pieces) {
      this.syncFromBoard(this.ctx.board.pieces(), false);
    } else if (move?.from && move?.to) {
      const moving = this.livingBySquare.get(move.from);
      this.livingBySquare.delete(move.from);
      const updated = this.resolveDescriptor({
        type: move.promotion || moving?.type || move.piece || 'p',
        color: moving?.color || move.color || 'w',
        square: move.to,
        id: moving?.id,
      });
      this.livingBySquare.set(move.to, updated);
    }
    this.emitPiecesSynced('move_executed', move);
  }

  _applySetChange(reason) {
    this.reResolveAll();
    this.ctx?.bus?.emit({
      type: 'PIECE_SET_CHANGED', whiteFamily: this.whiteFamily, rivalSetMode: this.rivalSetMode,
      bishopVariant: this.bishopVariant, queenVariant: this.queenVariant, knightVariant: this.knightVariant,
    });
    this.emitPiecesSynced(reason);
  }

  setWhiteFamily(family) {
    const normalized = ['carlesso', 'swamp', 'classic'].includes(family) ? family : 'carlesso';
    if (this.whiteFamily === normalized) return;
    this.whiteFamily = normalized;
    this._applySetChange('white_family_changed');
  }

  setRivalSetMode(mode) {
    const norm = mode === 'carlesso' ? 'family' : (['family', 'swamp', 'classic', 'stone'].includes(mode) ? mode : 'family');
    if (this.rivalSetMode === norm) return;
    this.rivalSetMode = norm;
    this._applySetChange('rival_set_changed');
  }


  setBishopVariant(v) {
    const norm = ['hat', 'astrolabe', 'rigged'].includes(v) ? v : 'hat';
    if (this.bishopVariant !== norm) { this.bishopVariant = norm; this._applySetChange('bishop_variant_changed'); }
  }
  setQueenVariant(v) {
    const norm = ['young', 'wedding'].includes(v) ? v : 'young';
    if (this.queenVariant !== norm) { this.queenVariant = norm; this._applySetChange('queen_variant_changed'); }
  }
  setKnightVariant(v) {
    const norm = ['classic', 'lightsaber', 'halberd', 'aurora'].includes(v) ? v : 'classic';
    if (this.knightVariant !== norm) { this.knightVariant = norm; this._applySetChange('knight_variant_changed'); }
  }

  reResolveAll() {
    for (const [sq, desc] of this.livingBySquare.entries()) {
      this.livingBySquare.set(sq, this.resolveDescriptor(desc));
    }
    for (const color of ['w', 'b']) {
      this.capturedTrays[color] = this.capturedTrays[color].map((item) => ({
        ...item, ...this.resolveDescriptor(item), trayX: item.trayX, trayY: item.trayY, trayZ: item.trayZ,
      }));
    }
  }

  requestAnimation(payload = {}) {
    const pieceType = String(payload.pieceType || 'b').toLowerCase();
    const meta = CHARACTER_REGISTRY[pieceType] || CHARACTER_REGISTRY.b;
    const rawKey = payload.clipKey || 'Idle';
    const resolvedClip =
      CLIP_ALIASES[rawKey] ||
      meta.animations?.[rawKey.toLowerCase()] ||
      meta.animations?.idle ||
      'Idle_Track';

    this.ctx?.bus?.emit({
      type: 'PIECE_ANIM_REQUESTED', animType: 'clip',
      square: payload.square || null, pieceType, clipKey: rawKey, resolvedClip,
    });
    return resolvedClip;
  }

  emitPiecesSynced(reason = 'sync', move = null) {
    this.ctx?.bus?.emit({
      type: 'PIECES_SYNCED', reason, move,
      whiteFamily: this.whiteFamily, rivalSetMode: this.rivalSetMode,
      bishopVariant: this.bishopVariant, queenVariant: this.queenVariant, knightVariant: this.knightVariant,
      qualityTier: this.qualityTier, effectiveLod: this.effectiveLod,
      pieces: this.getLivingPieces(), captured: this.getCapturedTrays(),
    });
  }

  setQualityTier(tier, effectiveLod = null) {
    this.qualityTier = tier || 'auto';
    this.effectiveLod = effectiveLod || (this.qualityTier === 'auto' ? 'high' : this.qualityTier);
    this.emitPiecesSynced('quality_tier_changed');
  }

  getLivingPieces() { return Array.from(this.livingBySquare.values()); }
  getPieceAt(square) { return this.livingBySquare.get(square) || null; }
  getCapturedTrays() { return { w: [...this.capturedTrays.w], b: [...this.capturedTrays.b] }; }
  getWhiteFamily() { return this.whiteFamily; }
  getRivalSetMode() { return this.rivalSetMode; }
  getBishopVariant() { return this.bishopVariant; }
  getQueenVariant() { return this.queenVariant; }
  getKnightVariant() { return this.knightVariant; }
  getQualityTier() { return this.qualityTier; }
  getEffectiveLod() { return this.effectiveLod; }
  update(_dt) {}
  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
  }
}
