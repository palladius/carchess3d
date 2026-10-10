import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/Rng.js';
import { GameLoop } from '../src/core/GameLoop.js';
import { computeGroundingTransform, CANONICAL_PIECE_HEIGHTS } from '../src/utils/glbGrounding.js';

test('GameEventBus: emit() queues events and flush() delivers once per tick in FIFO order', () => {
  const bus = new GameEventBus();
  const received = [];

  const off = bus.on('PIECE_SELECTED', (e) => {
    received.push(e.square);
    // Re-entrant emit during flush must wait for the NEXT flush()
    bus.emit({ type: 'SELECTION_CLEARED' });
  });
  bus.on('SELECTION_CLEARED', () => {
    received.push('CLEARED');
  });

  bus.emit({ type: 'PIECE_SELECTED', square: 'e2' });
  assert.equal(received.length, 0, 'emit() must not dispatch synchronously');

  bus.flush();
  assert.deepEqual(received, ['e2'], 'First flush() delivers only initial batch');

  bus.flush();
  assert.deepEqual(received, ['e2', 'CLEARED'], 'Second flush() delivers re-entrant events');

  off();
  bus.emit({ type: 'PIECE_SELECTED', square: 'd2' });
  bus.flush();
  assert.deepEqual(received, ['e2', 'CLEARED'], 'Unsubscribed handler must not fire');
});

test('mulberry32: deterministic seeded PRNG sequence in [0, 1)', () => {
  const rng1 = mulberry32(42);
  const rng2 = mulberry32(42);
  const rng3 = mulberry32(99);

  const seq1 = Array.from({ length: 20 }, () => rng1.next());
  const seq2 = Array.from({ length: 20 }, () => rng2.next());
  const seq3 = Array.from({ length: 20 }, () => rng3.next());

  assert.deepEqual(seq1, seq2, 'Same seed produces identical sequence');
  assert.notDeepEqual(seq1, seq3, 'Different seed produces different sequence');
  for (const val of seq1) {
    assert.ok(val >= 0 && val < 1, `Value ${val} out of [0, 1)`);
  }
});

test('GameLoop: fixed 1/30s timestep accumulator, bus.flush(), lateUpdate(), and render()', () => {
  const bus = new GameEventBus();
  const order = [];
  const manager = {
    updates: 0,
    lateUpdates: 0,
    update(dt) {
      this.updates++;
      assert.ok(Math.abs(dt - 1 / 30) < 1e-6);
      bus.emit({ type: 'TICK_DONE', n: this.updates });
    },
    lateUpdate(frameDt) {
      this.lateUpdates++;
      order.push(`late:${frameDt.toFixed(3)}`);
    },
  };
  bus.on('TICK_DONE', (e) => order.push(`bus:${e.n}`));

  const loop = new GameLoop([manager], bus, 1 / 30);
  // Pass 2.5 steps worth of time (2.5 / 30 = 0.083333s) -> should run 2 fixed updates
  loop.frame(2.5 / 30, () => order.push('render'));

  assert.equal(manager.updates, 2);
  assert.equal(manager.lateUpdates, 1);
  assert.deepEqual(order, ['bus:1', 'bus:2', 'late:0.083', 'render']);
});

test('glbGrounding: grounds TRELLIS [-0.5..+0.5] bbox cleanly to min.y === 0 and canonical rank height', () => {
  const rawBbox = {
    min: { x: -0.25, y: -0.5, z: -0.25 },
    max: { x: 0.25, y: 0.5, z: 0.25 },
  };
  for (const [rank, expectedH] of Object.entries(CANONICAL_PIECE_HEIGHTS)) {
    const t = computeGroundingTransform(rawBbox, rank);
    assert.equal(t.finalMinY, 0, `${rank} must sit at y = 0`);
    assert.ok(Math.abs(t.finalHeight - expectedH) < 1e-6, `${rank} height should be ${expectedH}`);
  }
});
