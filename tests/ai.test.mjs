import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/Rng.js';
import { chooseBestMove } from '../src/ai/worker.js';
import { AIWorkerManager } from '../src/managers/AIWorkerManager.js';

test('AI Engine (Easy): eagerly prefers capturing hanging pieces for kid-friendly fun', () => {
  // White Queen on d4 can be captured by Black Pawn on e5 (exd4)
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/3Q4/8/PPP1PPPP/RNB1KBNR b KQkq - 0 2';
  const rng = mulberry32(7);
  const res = chooseBestMove(fen, 'easy', rng);
  assert.ok(res.move, 'Easy AI must return a legal move');
  assert.equal(res.move.from, 'e5');
  assert.equal(res.move.to, 'd4');
});

test('AI Engine (Medium d=2 & Hard d=4): finds Mate-in-1 and respects <1.5s budget', () => {
  // Black can deliver Fool's Mate on h4 (Qd8-h4#)
  const mateIn1Fen = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
  const medRes = chooseBestMove(mateIn1Fen, 'medium', mulberry32(42));
  assert.equal(medRes.move.from, 'd8');
  assert.equal(medRes.move.to, 'h4');

  const t0 = Date.now();
  const hardRes = chooseBestMove(mateIn1Fen, 'hard', mulberry32(42));
  const elapsed = Date.now() - t0;
  assert.equal(hardRes.move.from, 'd8');
  assert.equal(hardRes.move.to, 'h4');
  assert.ok(elapsed < 1500, `Hard AI took ${elapsed}ms (> 1500ms budget)`);
});

test('AIWorkerManager: integrates with GameEventBus and emits AI_THINKING + AI_MOVE_READY + Magic Hint', async () => {
  const bus = new GameEventBus();
  const rng = mulberry32(42);
  const ai = new AIWorkerManager();
  ai.init({ bus, rng });

  const events = [];
  bus.on('AI_THINKING', (e) => events.push(e));
  bus.on('AI_MOVE_READY', (e) => events.push(e));
  bus.on('HINT_SUGGESTED', (e) => events.push(e));

  const startFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  await ai.requestMove(startFen, 'medium');
  bus.flush();

  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'AI_THINKING');
  assert.equal(events[1].type, 'AI_MOVE_READY');
  assert.ok(events[1].move.from && events[1].move.to);

  // Magic Hint Bulb
  const hint = await ai.requestHint(startFen);
  bus.flush();
  assert.ok(hint.from && hint.to);
  assert.equal(events[2].type, 'HINT_SUGGESTED');
  ai.dispose();
});
