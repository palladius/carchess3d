/**
 * @fileoverview Non-blocking Chess AI Engine & Web Worker (`src/ai/worker.js`).
 *
 * Supports 3 difficulty levels:
 * - `easy`: Kid-friendly Capture-Maximizer! Eagerly prefers captures (so Ale & Seby
 *   get lots of exciting battles!) with seeded randomness among non-captures.
 * - `medium`: Minimax depth 2 with material + piece-square tables.
 * - `hard`: Iterative-deepening Alpha-Beta pruning up to depth 4 with MVV-LVA move
 *   ordering, piece-square tables, and a strict `< 1200ms` time budget.
 *
 * Can run inside a browser Web Worker (`self.onmessage`) OR be imported directly
 * in Node unit tests (`chooseBestMove(fen, difficulty, rng)`).
 */

import { Chess } from '../../vendor/chess.js';
import { mulberry32 } from '../core/Rng.js';

const PIECE_VALUES = Object.freeze({
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
});

// Compact 8x8 Piece-Square Bonus Tables (from White's perspective, rank 8 -> rank 1)
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const CENTER_CONTROL_PST = [
  [-40, -30, -20, -20, -20, -20, -30, -40],
  [-30, -10, 0, 5, 5, 0, -10, -30],
  [-20, 5, 15, 20, 20, 15, 5, -20],
  [-20, 10, 20, 28, 28, 20, 10, -20],
  [-20, 10, 20, 28, 28, 20, 10, -20],
  [-20, 5, 15, 20, 20, 15, 5, -20],
  [-30, -10, 0, 5, 5, 0, -10, -30],
  [-40, -30, -20, -20, -20, -20, -30, -40],
];

/**
 * Evaluates a `Chess` position from the side-to-move's perspective (in centipawns).
 * @param {Chess} chess
 * @returns {number}
 */
export function evaluatePosition(chess) {
  if (chess.isCheckmate()) return -99999;
  if (chess.isDraw()) return 0;

  const board = chess.board();
  let whiteScore = 0;
  let blackScore = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const base = PIECE_VALUES[cell.type] || 100;
      const table = cell.type === 'p' ? PAWN_PST : CENTER_CONTROL_PST;
      const rowIdx = cell.color === 'w' ? r : 7 - r;
      const pstBonus = cell.type === 'k' ? 0 : table[rowIdx][c];
      if (cell.color === 'w') {
        whiteScore += base + pstBonus;
      } else {
        blackScore += base + pstBonus;
      }
    }
  }

  const diff = whiteScore - blackScore;
  return chess.turn() === 'w' ? diff : -diff;
}

/**
 * MVV-LVA (Most Valuable Victim - Least Valuable Attacker) move ordering.
 */
function orderMoves(moves) {
  return moves.slice().sort((a, b) => {
    const scoreA =
      (a.captured ? (PIECE_VALUES[a.captured] || 100) * 10 - (PIECE_VALUES[a.piece] || 100) : 0) +
      (a.promotion ? 800 : 0) +
      (a.san.includes('+') ? 150 : 0);
    const scoreB =
      (b.captured ? (PIECE_VALUES[b.captured] || 100) * 10 - (PIECE_VALUES[b.piece] || 100) : 0) +
      (b.promotion ? 800 : 0) +
      (b.san.includes('+') ? 150 : 0);
    return scoreB - scoreA;
  });
}

function negamax(chess, depth, alpha, beta, deadlineMs) {
  if (depth === 0 || chess.isGameOver() || Date.now() >= deadlineMs) {
    return evaluatePosition(chess);
  }
  const moves = orderMoves(chess.moves({ verbose: true }));
  let best = -Infinity;
  for (const m of moves) {
    chess.move(m);
    const val = -negamax(chess, depth - 1, -beta, -alpha, deadlineMs);
    chess.undo();
    if (val > best) best = val;
    if (val > alpha) alpha = val;
    if (alpha >= beta || Date.now() >= deadlineMs) break;
  }
  return best;
}

/**
 * Selects the best move for `fen` given `difficulty` ('easy' | 'medium' | 'hard').
 * @param {string} fen
 * @param {'easy'|'medium'|'hard'} [difficulty='medium']
 * @param {{ next: () => number }} [rng]
 */
export function chooseBestMove(fen, difficulty = 'medium', rng = mulberry32(42)) {
  const t0 = Date.now();
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) {
    return { move: null, score: 0, depth: 0, elapsedMs: 0 };
  }

  // 1. Check for immediate Mate-in-1 at all difficulties (or medium/hard)
  if (difficulty !== 'easy') {
    for (const m of legalMoves) {
      chess.move(m);
      const isMate = chess.isCheckmate();
      chess.undo();
      if (isMate) {
        return { move: m, score: 99999, depth: 1, elapsedMs: Date.now() - t0 };
      }
    }
  }

  // 2. Easy mode: Kid-friendly Capture-Maximizer (loves exciting battles!)
  if (difficulty === 'easy') {
    const captures = legalMoves.filter((m) => Boolean(m.captured));
    if (captures.length > 0) {
      captures.sort(
        (a, b) => (PIECE_VALUES[b.captured] || 100) - (PIECE_VALUES[a.captured] || 100),
      );
      return {
        move: captures[0],
        score: PIECE_VALUES[captures[0].captured] || 100,
        depth: 1,
        elapsedMs: Date.now() - t0,
      };
    }
    const chosen = legalMoves[Math.floor(rng.next() * legalMoves.length)];
    return { move: chosen, score: 0, depth: 1, elapsedMs: Date.now() - t0 };
  }

  // 3. Medium (depth 2) & Hard (iterative deepening up to depth 4 within 1100ms budget)
  const targetDepth = difficulty === 'hard' ? 4 : 2;
  const deadlineMs = t0 + (difficulty === 'hard' ? 1100 : 500);
  const ordered = orderMoves(legalMoves);

  let bestMove = ordered[0];
  let bestScore = -Infinity;
  let reachedDepth = 1;

  for (let d = 1; d <= targetDepth; d++) {
    if (d > 1 && Date.now() >= deadlineMs) break;
    let currentBestMove = bestMove;
    let currentBestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (const m of ordered) {
      chess.move(m);
      const score = -negamax(chess, d - 1, -beta, -alpha, deadlineMs);
      chess.undo();
      if (score > currentBestScore) {
        currentBestScore = score;
        currentBestMove = m;
      }
      if (score > alpha) alpha = score;
      if (Date.now() >= deadlineMs && d > 2) break;
    }

    bestMove = currentBestMove;
    bestScore = currentBestScore;
    reachedDepth = d;
  }

  return {
    move: bestMove,
    score: bestScore,
    depth: reachedDepth,
    elapsedMs: Date.now() - t0,
  };
}

// Web Worker message handler when running in a browser Worker context
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (event) => {
    const { id, fen, difficulty, seed } = event.data || {};
    const rng = mulberry32(seed || 42);
    const result = chooseBestMove(fen, difficulty, rng);
    self.postMessage({ id, ...result });
  };
}
