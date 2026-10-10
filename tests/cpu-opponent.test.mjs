import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/Rng.js';
import { BoardMapManager } from '../src/managers/BoardMapManager.js';
import { GameFlowManager, FLOW_STATES } from '../src/managers/GameFlowManager.js';
import { AIWorkerManager } from '../src/managers/AIWorkerManager.js';

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
