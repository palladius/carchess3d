import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/Rng.js';
import { DropManager, PIECE_LUCK_WEIGHTS } from '../src/managers/DropManager.js';

test('DropManager: Luck increases by victim weight, hard pity at L >= 12 guarantees golden_crit + LUCK_RESET', () => {
  const bus = new GameEventBus();
  const rng = mulberry32(42);
  const drops = new DropManager();
  drops.init({ bus, rng });

  assert.equal(PIECE_LUCK_WEIGHTS.p, 1);
  assert.equal(PIECE_LUCK_WEIGHTS.n, 3);
  assert.equal(PIECE_LUCK_WEIGHTS.b, 3);
  assert.equal(PIECE_LUCK_WEIGHTS.r, 5);
  assert.equal(PIECE_LUCK_WEIGHTS.q, 9);

  let lastDrop = null;
  let resets = 0;
  bus.on('DROP_SPAWNED', (e) => { lastDrop = e; });
  bus.on('LUCK_RESET', () => { resets++; });

  // Force luck to 9 (capturing a Queen) + 3 (capturing a Bishop) = 12 -> guaranteed golden_crit
  drops.setLuckForTest('w', 9);
  bus.emit({
    type: 'PIECE_CAPTURED',
    color: 'w',
    attacker: 'k',
    defender: 'b',
    weight: 3,
    from: 'e1',
    to: 'e2',
  });
  bus.flush(); // delivers PIECE_CAPTURED -> DropManager emits DROP_SPAWNED and LUCK_RESET
  bus.flush(); // delivers DROP_SPAWNED and LUCK_RESET

  assert.ok(lastDrop, 'Capture must emit DROP_SPAWNED');
  assert.equal(lastDrop.tier, 'golden_crit', 'L >= 12 must guarantee golden_crit');
  assert.ok(lastDrop.sticker, 'golden_crit must unlock a collectible family sticker');
  assert.equal(drops.getLuck('w'), 0, 'Luck must reset to 0 after golden_crit');
  assert.equal(resets, 1, 'LUCK_RESET must be emitted once');
});

test('DropManager: 10,000-capture Monte-Carlo verification of soft/hard pity and determinism', () => {
  const bus = new GameEventBus();
  const rng = mulberry32(42);
  const drops = new DropManager();
  drops.init({ bus, rng });

  let sinceCrit = 0;
  let maxCapturesBetweenCrits = 0;
  const counts = { normal: 0, shiny: 0, golden_crit: 0 };

  bus.on('DROP_SPAWNED', (e) => {
    counts[e.tier]++;
    if (e.tier === 'golden_crit') {
      maxCapturesBetweenCrits = Math.max(maxCapturesBetweenCrits, sinceCrit);
      sinceCrit = 0;
    }
  });

  for (let i = 0; i < 10000; i++) {
    sinceCrit++;
    bus.emit({
      type: 'PIECE_CAPTURED',
      color: 'w',
      attacker: 'p',
      defender: 'p',
      weight: 1,
      from: 'e4',
      to: 'd5',
    });
    bus.flush();
    bus.flush();
  }

  const total = counts.normal + counts.shiny + counts.golden_crit;
  assert.equal(total, 10000, 'Every capture produces a tier classification');
  assert.ok(
    maxCapturesBetweenCrits <= 12,
    `Hard pity violated: max gap was ${maxCapturesBetweenCrits} > 12`,
  );
  assert.ok(counts.golden_crit >= 800, `Expected >= 800 golden crits, got ${counts.golden_crit}`);
  assert.ok(counts.shiny > 1000, `Expected > 1000 shiny captures, got ${counts.shiny}`);
  assert.ok(drops.getUnlockedStickers('w').length >= 6, 'All 6 family stickers unlocked over 10k captures');
});

test('DropManager: d20Roll (1..20) is emitted on DROP_SPAWNED and D20_ROLL_REQUESTED -> D20_ROLLED', () => {
  const bus = new GameEventBus();
  const rng = mulberry32(12345);
  const drops = new DropManager();
  drops.init({ bus, rng });

  let lastDrop = null;
  let lastRolled = null;
  bus.on('DROP_SPAWNED', (e) => { lastDrop = e; });
  bus.on('D20_ROLLED', (e) => { lastRolled = e; });

  // Capture at hard pity (L >= 12) must yield a Natural 20 (d20Roll === 20, isNat20 === true)
  drops.setLuckForTest('w', 11);
  bus.emit({
    type: 'PIECE_CAPTURED',
    color: 'w',
    attacker: 'p',
    defender: 'p',
    weight: 1,
    from: 'e4',
    to: 'd5',
  });
  bus.flush();
  bus.flush();

  assert.ok(lastDrop, 'DROP_SPAWNED must fire');
  assert.equal(lastDrop.tier, 'golden_crit');
  assert.equal(lastDrop.d20Roll, 20, 'golden_crit must produce d20Roll === 20');
  assert.equal(lastDrop.isNat20, true, 'golden_crit must set isNat20 === true');
  assert.equal(drops.lastD20Roll, 20);

  // Manual d20 roll request from HUD ('d' hotkey or clicking #hud-d20-btn)
  bus.emit({
    type: 'D20_ROLL_REQUESTED',
    playerId: 'b',
    reason: 'manual',
  });
  bus.flush();
  bus.flush();

  assert.ok(lastRolled, 'D20_ROLLED must fire on D20_ROLL_REQUESTED');
  assert.equal(lastRolled.playerId, 'b');
  assert.equal(lastRolled.reason, 'manual');
  assert.ok(
    Number.isInteger(lastRolled.d20Roll) && lastRolled.d20Roll >= 1 && lastRolled.d20Roll <= 20,
    `Expected d20Roll in 1..20, got ${lastRolled.d20Roll}`,
  );
  assert.equal(drops.lastD20Roll, lastRolled.d20Roll);
});

