import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/Rng.js';
import { GameFlowManager, FLOW_STATES } from '../src/managers/GameFlowManager.js';
import { BoardMapManager } from '../src/managers/BoardMapManager.js';

function createSetup() {
  const bus = new GameEventBus();
  const rng = mulberry32(12345);
  const flow = new GameFlowManager();
  const board = new BoardMapManager();
  const ctx = { bus, rng, flow, board };
  flow.init(ctx);
  board.init(ctx);
  return { bus, rng, flow, board, ctx };
}

test('GameFlowManager: transitions Boot -> Mode1_Chess <-> Mode2_WowArena -> CaptureCutscene -> Checkmate/Draw', () => {
  const { bus, flow } = createSetup();
  const transitions = [];
  bus.on('FLOW_STATE_CHANGED', (e) => transitions.push(`${e.from}->${e.to}`));

  assert.equal(flow.state(), FLOW_STATES.BOOT);
  flow.startChessMode();
  bus.flush();
  assert.equal(flow.state(), FLOW_STATES.MODE1_CHESS);

  flow.toggleWowMode();
  bus.flush();
  assert.equal(flow.state(), FLOW_STATES.MODE2_WOW_ARENA);

  flow.toggleWowMode();
  bus.flush();
  assert.equal(flow.state(), FLOW_STATES.MODE1_CHESS);

  // Trigger a capture cutscene and return
  bus.emit({ type: 'BATTLE_STARTED', attacker: 'b', defender: 'p', from: 'c4', to: 'f7' });
  bus.flush(); // delivers BATTLE_STARTED -> flow emits FLOW_STATE_CHANGED
  bus.flush();
  assert.equal(flow.state(), FLOW_STATES.CAPTURE_CUTSCENE);

  bus.emit({ type: 'BATTLE_COMPLETED', attacker: 'b', defender: 'p' });
  bus.flush();
  bus.flush();
  assert.equal(flow.state(), FLOW_STATES.MODE1_CHESS);

  // Trigger Checkmate
  bus.emit({ type: 'CHECKMATE', winner: 'w', loser: 'b' });
  bus.flush();
  bus.flush();
  assert.equal(flow.state(), FLOW_STATES.CHECKMATE);
  assert.ok(transitions.length >= 6);
});

test('BoardMapManager: legal moves, Scholar/Fool Mate checkmate, stalemate, castling, en passant, promotion, FEN/PGN', () => {
  const { bus, flow, board } = createSetup();
  flow.startChessMode();
  bus.flush();

  // 1. Initial board has 32 pieces and 20 legal moves for White
  assert.equal(board.pieces().length, 32);
  assert.equal(board.legalMoves().length, 20);

  // 2. Select e2 pawn -> emits PIECE_SELECTED with e3, e4
  board.selectSquare('e2');
  bus.flush();
  const e2Moves = board.legalMovesFrom('e2').map((m) => m.to);
  assert.deepEqual(e2Moves.sort(), ['e3', 'e4']);

  // 3. Fool's Mate (fastest checkmate)
  board.reset();
  bus.flush();
  let mateEvent = null;
  bus.on('CHECKMATE', (e) => { mateEvent = e; });

  assert.ok(board.move('f2', 'f3'));
  assert.ok(board.move('e7', 'e5'));
  assert.ok(board.move('g2', 'g4'));
  assert.ok(board.move('d8', 'h4'));
  bus.flush();

  assert.ok(mateEvent, 'BoardMapManager must own and emit CHECKMATE');
  assert.equal(mateEvent.winner, 'b');
  assert.equal(mateEvent.loser, 'w');

  // 4. Castling (Riccardo <-> Pupurabbu belly-bounce event)
  let castleEvent = null;
  bus.on('CASTLING_EXECUTED', (e) => { castleEvent = e; });
  board.loadFen('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
  bus.flush();
  assert.ok(board.move('e1', 'g1'));
  bus.flush();
  assert.ok(castleEvent, 'Must emit CASTLING_EXECUTED on kingside castle');
  assert.equal(castleEvent.kingTo, 'g1');
  assert.equal(castleEvent.rookTo, 'f1');

  // 5. En Passant capture
  let capturedEvent = null;
  bus.on('PIECE_CAPTURED', (e) => { capturedEvent = e; });
  board.loadFen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
  bus.flush();
  assert.ok(board.move('e5', 'd6'));
  bus.flush();
  assert.ok(capturedEvent, 'En passant must emit PIECE_CAPTURED');
  assert.equal(capturedEvent.defender, 'p');

  // 6. Pawn Promotion
  board.loadFen('8/P7/8/8/8/8/7k/4K3 w - - 0 1');
  bus.flush();
  const promoMove = board.move('a7', 'a8', 'q');
  bus.flush();
  assert.ok(promoMove);
  assert.equal(promoMove.promotion, 'q');
  assert.equal(board.pieceAt('a8')?.type, 'q');

  // 7. Stalemate detection
  let drawEvent = null;
  bus.on('DRAW', (e) => { drawEvent = e; });
  board.loadFen('7k/5K2/8/8/8/8/8/6Q1 w - - 0 1');
  bus.flush();
  assert.ok(board.move('g1', 'g6')); // stalemates black king on h8
  bus.flush();
  assert.ok(drawEvent, 'Stalemate must emit DRAW');
  assert.equal(drawEvent.reason, 'stalemate');
});
