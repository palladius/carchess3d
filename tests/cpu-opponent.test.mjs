import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/Rng.js';
import { BoardMapManager } from '../src/managers/BoardMapManager.js';
import { PieceManager } from '../src/managers/PieceManager.js';
import { GameFlowManager, FLOW_STATES } from '../src/managers/GameFlowManager.js';
import { AIWorkerManager } from '../src/managers/AIWorkerManager.js';
import { HudListener } from '../src/listeners/HudListener.js';
import { ProfileStorageListener } from '../src/listeners/ProfileStorageListener.js';

/**
 * Headless harness mirroring main.js wiring: bus + board + flow + ai (+ a stub combat).
 * Drives the fixed-timestep loop by hand: `tick()` = one flush.
 */
function makeGame({ combatBusy = false } = {}) {
  const bus = new GameEventBus();
  const rng = mulberry32(42);
  const flow = new GameFlowManager();
  const board = new BoardMapManager();
  const ai = new AIWorkerManager();
  const combat = { isActive: () => combatBusy };
  const ctx = { bus, rng, flow, board, ai, combat };
  flow.init(ctx);
  board.init(ctx);
  ai.init(ctx);
  flow.startChessMode();
  board.reset();
  bus.flush();
  return { bus, board, flow, ai, ctx };
}

/** Flush repeatedly, awaiting microtasks + the AI reply delay, until the bus is quiet. */
async function settle(bus, rounds = 12) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((r) => setTimeout(r, 40));
    bus.flush();
  }
}

test('CPU opponent: after being enabled, it keeps replying to EVERY human move (regression: only moved once)', async () => {
  const { bus, board, ai } = makeGame();
  const cpuMoves = [];
  bus.on('AI_MOVE_READY', (e) => cpuMoves.push(`${e.move.from}${e.move.to}`));

  // HUD selects "CPU easy" (black). White to move: CPU must stay quiet.
  ai.configure({ enabled: true, cpuColor: 'b', difficulty: 'easy' });
  await settle(bus);
  assert.equal(cpuMoves.length, 0, 'CPU must not move on the human turn');
  assert.equal(board.turn(), 'w');

  // 1. Human plays e4 -> CPU must reply
  board.requestMove('e2', 'e4');
  await settle(bus);
  assert.equal(cpuMoves.length, 1, 'CPU must reply to the first human move');
  assert.equal(board.turn(), 'w', 'CPU reply must be applied on the board');

  // 2. Human plays d4 -> CPU must reply AGAIN without re-selecting the opponent
  board.requestMove('d2', 'd4');
  await settle(bus);
  assert.equal(cpuMoves.length, 2, 'CPU must reply to the second human move too');
  assert.equal(board.turn(), 'w');

  // 3. And a third time, for good measure
  board.requestMove('g1', 'f3');
  await settle(bus);
  assert.equal(cpuMoves.length, 3, 'CPU must keep replying for the whole game');
  assert.equal(board.turn(), 'w');
  ai.dispose();
});

test('CPU opponent: enabling it while it is already the CPU turn triggers a move immediately', async () => {
  const { bus, board, ai } = makeGame();
  const cpuMoves = [];
  bus.on('AI_MOVE_READY', (e) => cpuMoves.push(e));

  board.requestMove('e2', 'e4');
  bus.flush();
  assert.equal(board.turn(), 'b');

  // HUD switches to CPU via the OPPONENT_CHANGED fact (listener-style, no direct call)
  bus.emit({ type: 'OPPONENT_CHANGED', mode: 'easy', enabled: true, cpuColor: 'b', difficulty: 'easy' });
  await settle(bus);
  assert.equal(cpuMoves.length, 1, 'CPU must take its pending turn right after being enabled');
  assert.equal(board.turn(), 'w');
  ai.dispose();
});

test('CPU opponent: switching back to hotseat stops the CPU', async () => {
  const { bus, board, ai } = makeGame();
  const cpuMoves = [];
  bus.on('AI_MOVE_READY', (e) => cpuMoves.push(e));

  ai.configure({ enabled: true, cpuColor: 'b', difficulty: 'easy' });
  board.requestMove('e2', 'e4');
  await settle(bus);
  assert.equal(cpuMoves.length, 1);

  bus.emit({ type: 'OPPONENT_CHANGED', mode: 'hotseat', enabled: false, cpuColor: 'b', difficulty: 'easy' });
  bus.flush();
  board.requestMove('d2', 'd4');
  await settle(bus);
  assert.equal(cpuMoves.length, 1, 'CPU must not move once disabled');
  assert.equal(board.turn(), 'b', 'Black (now human) still to move');
  ai.dispose();
});

test('CPU opponent: waits for the capture cutscene to finish, then moves once', async () => {
  const { bus, board, ai } = makeGame();
  const cpuMoves = [];
  bus.on('AI_MOVE_READY', (e) => cpuMoves.push(e));
  ai.configure({ enabled: true, cpuColor: 'b', difficulty: 'easy' });

  // Simulate a running cutscene (GameFlowManager owns the state)
  bus.emit({ type: 'BATTLE_STARTED', attacker: 'p', defender: 'p' });
  bus.flush();
  assert.equal(ai.ctx.flow.state(), FLOW_STATES.CAPTURE_CUTSCENE);

  board.requestMove('e2', 'e4');
  await settle(bus);
  assert.equal(cpuMoves.length, 0, 'CPU must not move during a cutscene');

  bus.emit({ type: 'BATTLE_COMPLETED' });
  await settle(bus);
  assert.equal(cpuMoves.length, 1, 'CPU must move exactly once after the cutscene');
  assert.equal(board.turn(), 'w');
  ai.dispose();
});

test('CPU opponent: BoardMapManager applies AI_MOVE_READY only when it is still that color\'s turn', async () => {
  const { bus, board } = makeGame();
  board.requestMove('e2', 'e4');
  bus.flush();
  // Stale move for white while it is black's turn -> ignored
  bus.emit({ type: 'AI_MOVE_READY', color: 'w', move: { from: 'd2', to: 'd4' } });
  bus.flush();
  assert.equal(board.turn(), 'b');
  // Valid move for black -> applied
  bus.emit({ type: 'AI_MOVE_READY', color: 'b', move: { from: 'e7', to: 'e5' } });
  bus.flush();
  assert.equal(board.turn(), 'w');
  assert.equal(board.pieceAt('e5')?.type, 'p');
});

test('CPU opponent: White CPU plays immediately on initial board turn', async () => {
  const { bus, board, ai } = makeGame();
  const whiteCpuMoves = [];
  bus.on('AI_MOVE_READY', (e) => {
    if (e.color === 'w') whiteCpuMoves.push(e);
  });

  // Configure White CPU: since board.turn() === 'w', it must take turn
  ai.configure({ enabled: true, cpuColor: 'w', whiteDifficulty: 'easy' });
  await settle(bus);
  assert.equal(whiteCpuMoves.length, 1, 'White CPU must play its first move');
  assert.equal(board.turn(), 'b', 'Board turn must advance to black');
  ai.dispose();
});

test('CPU opponent: Dual CPU (cpuColor="both") plays consecutive turns', async () => {
  const { bus, board, ai } = makeGame();
  const readyMoves = [];
  bus.on('AI_MOVE_READY', (e) => readyMoves.push(e));

  ai.configure({ enabled: true, cpuColor: 'both', whiteDifficulty: 'easy', blackDifficulty: 'easy' });
  await settle(bus, 16);
  assert.ok(readyMoves.length >= 2, 'Both White CPU and Black CPU must take turns in dual CPU mode');
  ai.dispose();
});

test('Regression Bug #1 & #2: HudListener.applySetup keeps CPU AI enabled and distinguishes Nuova Partita (resetBoard:true) vs Modifica Partita (resetBoard:false)', async () => {
  const { bus, board, ai, ctx } = makeGame();
  const pieces = new PieceManager();
  ctx.pieces = pieces;
  pieces.init(ctx);
  const profiles = new ProfileStorageListener(ctx);
  const hud = new HudListener(ctx);
  ctx.profiles = profiles;
  ctx.hud = hud;

  const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // 1. Apply default Setup (White: Carlesso Human vs Black: Classic AI Easy)
  hud.applySetup({
    whiteFamily: 'carlesso',
    whitePlayerType: 'human',
    whiteProfile: 'ale',
    rivalSet: 'classic',
    blackPlayerType: 'ai',
    blackDiff: 'easy',
    resetBoard: true,
  });

  assert.equal(ai.enabled, true, 'AI must remain enabled after applySetup (Bug #1 regression)');
  assert.equal(ai.cpuColor, 'b', 'AI must play Black by default');

  // Human plays e2 -> e4; Black CPU must automatically reply!
  const cpuMoves = [];
  bus.on('AI_MOVE_READY', (e) => cpuMoves.push(e));
  board.requestMove('e2', 'e4');
  await settle(bus);
  assert.equal(cpuMoves.length, 1, 'Black CPU must reply after White human moves in default setup');
  assert.equal(board.turn(), 'w');
  const midGameFen = board.fen();
  assert.notEqual(midGameFen, INITIAL_FEN, 'Board is now mid-game and saved in ProfileStorageListener');

  // 2. "Modifica Partita in Corso" (resetBoard: false): changes sets/settings WITHOUT resetting pieces!
  hud.applySetup({
    whiteFamily: 'swamp',
    whitePlayerType: 'human',
    whiteProfile: 'ale',
    rivalSet: 'family',
    blackPlayerType: 'ai',
    blackDiff: 'medium',
    resetBoard: false,
  });
  assert.equal(board.fen(), midGameFen, 'Modifica Partita (resetBoard: false) must preserve current board pieces');
  assert.equal(pieces.whiteFamily, 'swamp', 'PieceManager whiteFamily must update in-place');
  assert.equal(pieces.rivalSetMode, 'family', 'PieceManager rivalSetMode must update in-place');
  assert.equal(ai.enabled, true, 'AI must stay enabled after mid-game edit');
  assert.equal(ai.blackDifficulty, 'medium', 'AI difficulty must update after mid-game edit');

  // 3. "Nuova Partita (Reset Pezzi)" (resetBoard: true): resets board to 32 initial pieces even when ProfileStorage has midGameFen!
  hud.applySetup({
    whiteFamily: 'carlesso',
    whitePlayerType: 'human',
    whiteProfile: 'ale',
    rivalSet: 'swamp',
    blackPlayerType: 'ai',
    blackDiff: 'easy',
    resetBoard: true,
  });
  assert.equal(board.fen(), INITIAL_FEN, 'Nuova Partita (resetBoard: true) must reset board to initial 32 pieces (Bug #2 regression)');
  assert.equal(pieces.getLivingPieces().length, 32, 'All 32 pieces must be back on their starting squares');
  assert.equal(pieces.whiteFamily, 'carlesso');
  assert.equal(pieces.rivalSetMode, 'swamp');

  // 4. And direct startNewGame() (#hud-new-btn) also resets the board mid-game
  board.requestMove('d2', 'd4');
  await settle(bus);
  assert.notEqual(board.fen(), INITIAL_FEN);
  hud.startNewGame();
  assert.equal(board.fen(), INITIAL_FEN, 'hud.startNewGame() must immediately reset the board');

  hud.dispose();
  ai.dispose();
});


