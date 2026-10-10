/**
 * @fileoverview Headless PieceManager (Niccolò Game Design Rule #2, #3, #6).
 *
 * Tracks living 8x8 pieces, captured White/Black trays, rival set mode (`'family'|'stone'`),
 * and Bishop Ale GLB variant (`'rigged'|'hat'`). Zero DOM or Three.js imports (`<= 300` LOC).
 */

import { CHARACTER_REGISTRY, squareToWorld } from '../core/Registry.js';
import { CANONICAL_PIECE_HEIGHTS } from '../utils/glbGrounding.js';

export const BISHOP_GLB_VARIANTS = Object.freeze({
  rigged: 'assets/models/bishop-ale-rigged.glb',
  hat: 'assets/models/bishop-ale-1.glb',
});

export const CLIP_ALIASES = Object.freeze({
  Idle: 'Idle_Track',
  Idle_Track: 'Idle_Track',
  Click_Fire_Breath: 'FireBreath_Track',
  FireBreath_Track: 'FireBreath_Track',
});

export class PieceManager {
  constructor() {
    this.ctx = null;
    /** @type {'family'|'stone'} */
    this.rivalSetMode = 'family';
    /** @type {'rigged'|'hat'} */
    this.bishopVariant = 'hat';
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
    );
  }

  resolveDescriptor(raw) {
    const type = String(raw.type || 'p').toLowerCase();
    const color = raw.color === 'b' ? 'b' : 'w';
    const square = raw.square || 'e4';
    const meta = CHARACTER_REGISTRY[type] || CHARACTER_REGISTRY.p;
    const isStoneSet = color === 'b' && this.rivalSetMode === 'stone';

    let glbUrl = null;
    if (!isStoneSet) {
      glbUrl = type === 'b'
        ? (BISHOP_GLB_VARIANTS[this.bishopVariant] || meta.glbUrl)
        : (meta.glbUrl || null);
    }

    const pos = squareToWorld(square);
    return {
      id: raw.id || `${color}_${type}_${square}`,
      square,
      type,
      color,
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
      x: pos.x,
      y: 0,
      z: pos.z,
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
    const capturedSq = e.capturedSquare || e.to;
    const existing = this.livingBySquare.get(capturedSq);
    if (existing && existing.color === victimColor) {
      this.livingBySquare.delete(capturedSq);
    }

    const trayList = this.capturedTrays[victimColor] || this.capturedTrays.b;
    const slotIndex = trayList.length;
    const sideSign = victimColor === 'w' ? -1 : 1;
    const colRing = slotIndex % 2;
    const rowSlot = Math.floor(slotIndex / 2);
    // Place captured pieces in the Enchanted Swamp Moat ("Palude di Shrek", r = 6.2m..8.2m, y = -0.28m)
    const trayX = sideSign * (6.25 + colRing * 0.95);
    const trayY = -0.28;
    const trayZ = rowSlot * 1.05 - 2.65;

    const desc = this.resolveDescriptor({
      type: e.defender || existing?.type || 'p',
      color: victimColor,
      square: capturedSq,
      id: existing?.id || `captured_${victimColor}_${e.defender}_${slotIndex}`,
    });
    trayList.push({
      ...desc,
      capturedFromSquare: capturedSq,
      capturedBy: e.attacker || 'p',
      trayIndex: slotIndex,
      trayX,
      trayY,
      trayZ,
    });
  }

  handleCastling(e) {
    const rook = this.livingBySquare.get(e.rookFrom);
    if (rook) {
      this.livingBySquare.delete(e.rookFrom);
      this.livingBySquare.set(e.rookTo, this.resolveDescriptor({ ...rook, square: e.rookTo, id: rook.id }));
    }
    this.ctx?.bus?.emit({
      type: 'PIECE_ANIM_REQUESTED',
      animType: 'castling_belly_bounce',
      color: e.color,
      side: e.side,
      kingFrom: e.kingFrom,
      kingTo: e.kingTo,
      rookFrom: e.rookFrom,
      rookTo: e.rookTo,
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

  setRivalSetMode(mode) {
    const normalized = mode === 'stone' ? 'stone' : 'family';
    if (this.rivalSetMode === normalized) return;
    this.rivalSetMode = normalized;
    this.reResolveAll();
    this.ctx?.bus?.emit({
      type: 'PIECE_SET_CHANGED',
      rivalSetMode: this.rivalSetMode,
      bishopVariant: this.bishopVariant,
    });
    this.emitPiecesSynced('rival_set_changed');
  }

  setBishopVariant(variant) {
    const normalized = variant === 'hat' ? 'hat' : 'rigged';
    if (this.bishopVariant === normalized) return;
    this.bishopVariant = normalized;
    this.reResolveAll();
    this.ctx?.bus?.emit({
      type: 'PIECE_SET_CHANGED',
      rivalSetMode: this.rivalSetMode,
      bishopVariant: this.bishopVariant,
    });
    this.emitPiecesSynced('bishop_variant_changed');
  }

  reResolveAll() {
    for (const [sq, desc] of this.livingBySquare.entries()) {
      this.livingBySquare.set(sq, this.resolveDescriptor(desc));
    }
    for (const color of ['w', 'b']) {
      this.capturedTrays[color] = this.capturedTrays[color].map((item) => ({
        ...item,
        ...this.resolveDescriptor(item),
        trayX: item.trayX,
        trayY: item.trayY,
        trayZ: item.trayZ,
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
      type: 'PIECE_ANIM_REQUESTED',
      animType: 'clip',
      square: payload.square || null,
      pieceType,
      clipKey: rawKey,
      resolvedClip,
    });
    return resolvedClip;
  }

  emitPiecesSynced(reason = 'sync', move = null) {
    this.ctx?.bus?.emit({
      type: 'PIECES_SYNCED',
      reason,
      move,
      rivalSetMode: this.rivalSetMode,
      bishopVariant: this.bishopVariant,
      pieces: this.getLivingPieces(),
      captured: this.getCapturedTrays(),
    });
  }

  getLivingPieces() { return Array.from(this.livingBySquare.values()); }
  getPieceAt(square) { return this.livingBySquare.get(square) || null; }
  getCapturedTrays() { return { w: [...this.capturedTrays.w], b: [...this.capturedTrays.b] }; }
  getRivalSetMode() { return this.rivalSetMode; }
  getBishopVariant() { return this.bishopVariant; }
  update(_dt) {}
  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
  }
}
