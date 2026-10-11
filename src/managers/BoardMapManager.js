/**
 * @fileoverview Headless BoardMapManager (Niccolò Game Design Rule #2 & #3).
 *
 * Rules live with the data they inspect:
 * - Wraps vendored `chess.js` to track the 8x8 board, legal moves, castling,
 *   en passant, promotion, FEN/PGN import/export.
 * - Owns Game Over / Victory rules (`CHECKMATE`, `DRAW` via stalemate,
 *   threefold repetition, 50-move rule, insufficient material) and emits
 *   facts once per transition on `GameEventBus`.
 * - Zero DOM or Three.js imports.
 */

import { Chess } from '../../vendor/chess.js';
import { CHARACTER_REGISTRY, squareToWorld } from '../core/Registry.js';

export class BoardMapManager {
  constructor() {
    this.ctx = null;
    this.chess = new Chess();
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.moveHistory = [];
    this.offs = [];
  }

  init(ctx) {
    this.ctx = ctx;
  }

  reset() {
    this.chess.reset();
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.moveHistory = [];
    this.emitBoardReset();
  }

  loadFen(fen) {
    this.chess.load(fen);
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.moveHistory = [];
    this.emitBoardReset();
    return true;
  }

  loadPgn(pgn) {
    this.chess.loadPgn(pgn);
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.emitBoardReset();
    return true;
  }

  fen() { return this.chess.fen(); }
  pgn() { return this.chess.pgn(); }
  turn() { return this.chess.turn(); }
  inCheck() { return this.chess.inCheck(); }
  isGameOver() { return this.chess.isGameOver(); }
  pieceAt(square) { return this.chess.get(square) || null; }

  /** Returns all living pieces currently on the 8x8 board with world coordinates. */
  pieces() {
    const board = this.chess.board();
    const list = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r][c];
        if (cell) {
          const pos = squareToWorld(cell.square);
          list.push({
            square: cell.square,
            type: cell.type,
            color: cell.color,
            x: pos.x,
            y: 0,
            z: pos.z,
          });
        }
      }
    }
    return list;
  }

  legalMoves() { return this.chess.moves({ verbose: true }); }
  legalMovesFrom(square) { return square ? this.chess.moves({ square, verbose: true }) : []; }

  findKingSquare(color) {
    for (const p of this.pieces()) {
      if (p.type === 'k' && p.color === color) return p.square;
    }
    return null;
  }

  selectSquare(square) {
    const piece = this.pieceAt(square);
    if (!piece || piece.color !== this.turn()) {
      this.clearSelection();
      return [];
    }
    this.selectedSquare = square;
    const legalMoves = this.legalMovesFrom(square);
    this.ctx?.bus.emit({ type: 'PIECE_SELECTED', square, piece, legalMoves });
    return legalMoves;
  }

  clearSelection() {
    if (this.selectedSquare !== null) {
      this.selectedSquare = null;
      this.ctx?.bus.emit({ type: 'SELECTION_CLEARED' });
    }
  }

  isPromotionMove(from, to) {
    return this.legalMovesFrom(from).some((m) => m.to === to && Boolean(m.promotion));
  }

  requestMove(from, to, promotion) {
    if (this.isPromotionMove(from, to) && !promotion) {
      this.pendingPromotion = { from, to, color: this.turn() };
      this.ctx?.bus.emit({
        type: 'PROMOTION_PENDING',
        from,
        to,
        color: this.turn(),
        legalPromotions: ['q', 'r', 'b', 'n'],
      });
      return null;
    }
    return this.move(from, to, promotion);
  }

  move(from, to, promotion = 'q') {
    const candidates = this.legalMovesFrom(from).filter((m) => m.to === to);
    if (candidates.length === 0) return null;

    const isPromo = candidates.some((m) => Boolean(m.promotion));
    const moveObj = isPromo ? { from, to, promotion: promotion || 'q' } : { from, to };

    let result = null;
    try {
      result = this.chess.move(moveObj);
    } catch {
      return null;
    }
    if (!result) return null;

    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.moveHistory.push(result);

    const isCastle = result.flags.includes('k') || result.flags.includes('q');
    const isEnPassant = result.flags.includes('e');
    const isPromotion = result.flags.includes('p') || Boolean(result.promotion);

    if (isCastle) {
      const rank = result.color === 'w' ? '1' : '8';
      const kingside = result.flags.includes('k');
      this.ctx?.bus.emit({
        type: 'CASTLING_EXECUTED',
        color: result.color,
        side: kingside ? 'kingside' : 'queenside',
        kingFrom: result.from,
        kingTo: result.to,
        rookFrom: kingside ? `h${rank}` : `a${rank}`,
        rookTo: kingside ? `f${rank}` : `d${rank}`,
      });
    }

    if (result.captured) {
      const victimWeight = CHARACTER_REGISTRY[result.captured]?.weight ?? 1;
      const victimColor = result.color === 'w' ? 'b' : 'w';
      const capturedSq = isEnPassant ? `${result.to[0]}${result.from[1]}` : result.to;
      this.ctx?.bus.emit({
        type: 'PIECE_CAPTURED',
        attacker: result.piece,
        defender: result.captured,
        from: result.from,
        to: result.to,
        capturedSquare: capturedSq,
        color: result.color,
        victimColor,
        weight: victimWeight,
        move: result,
      });
    }

    this.ctx?.bus.emit({
      type: 'MOVE_EXECUTED',
      move: result,
      fen: this.fen(),
      pgn: this.pgn(),
      turn: this.turn(),
      isCastle,
      isEnPassant,
      isPromotion,
      captured: result.captured || null,
    });

    this.evaluateRulesAfterMove(result);
    return result;
  }

  evaluateRulesAfterMove(lastMove) {
    if (!this.ctx?.bus) return;
    const nextColor = this.turn();

    if (this.chess.inCheck()) {
      this.ctx.bus.emit({
        type: 'CHECK_DETECTED',
        color: nextColor,
        kingSquare: this.findKingSquare(nextColor),
      });
    }

    if (this.chess.isCheckmate()) {
      this.ctx.bus.emit({
        type: 'CHECKMATE',
        winner: lastMove.color,
        loser: nextColor,
        loserKingSquare: this.findKingSquare(nextColor),
        winnerKingSquare: this.findKingSquare(lastMove.color),
        fen: this.fen(),
        pgn: this.pgn(),
      });
      return;
    }

    if (this.chess.isDraw()) {
      let reason = 'draw';
      if (this.chess.isStalemate()) reason = 'stalemate';
      else if (this.chess.isThreefoldRepetition()) reason = 'threefold_repetition';
      else if (this.chess.isInsufficientMaterial()) reason = 'insufficient_material';
      else if (this.chess.isDrawByFiftyMoves?.()) reason = 'fifty_move_rule';
      this.ctx.bus.emit({ type: 'DRAW', reason, fen: this.fen(), pgn: this.pgn() });
    }
  }

  emitBoardReset() {
    this.ctx?.bus.emit({
      type: 'BOARD_RESET',
      fen: this.fen(),
      turn: this.turn(),
      pieces: this.pieces(),
    });
  }

  update(_dt) {}

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
  }
}
