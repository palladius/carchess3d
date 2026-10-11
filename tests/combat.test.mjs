import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { BATTLE_MATRIX, CHARACTER_REGISTRY } from '../src/core/Registry.js';
import { CombatAnimationManager, DEFAULT_BATTLE_DURATION_MS } from '../src/managers/CombatAnimationManager.js';
import { GameFlowManager, FLOW_STATES } from '../src/managers/GameFlowManager.js';

const PIECE_KEYS = ['k', 'q', 'b', 'n', 'r', 'p'];

test('CombatAnimationManager: all 36 BATTLE_MATRIX combinations resolve declaratively and emit BATTLE_STARTED', () => {
  const bus = new GameEventBus();
  const combat = new CombatAnimationManager();
  combat.init({ bus });

  const startedEvents = [];
  bus.on('BATTLE_STARTED', (e) => startedEvents.push(e));

  for (const atk of PIECE_KEYS) {
    for (const def of PIECE_KEYS) {
      bus.emit({
        type: 'DROP_SPAWNED',
        playerId: 'w',
        tier: 'normal',
        spectacle: 'Standard Signature Clash ⚔️',
        sticker: null,
        attacker: atk,
        defender: def,
        from: 'e4',
        to: 'd5',
        square: 'd5',
      });
      bus.flush(); // delivers DROP_SPAWNED -> CombatAnimationManager emits BATTLE_STARTED
      bus.flush(); // delivers BATTLE_STARTED

      const latest = startedEvents[startedEvents.length - 1];
      assert.equal(latest.attacker, atk);
      assert.equal(latest.defender, def);
      assert.equal(latest.durationMs, DEFAULT_BATTLE_DURATION_MS);
      assert.equal(latest.effect, BATTLE_MATRIX[atk][def].effect);
      assert.equal(latest.debrisType, BATTLE_MATRIX[atk][def].debrisType);
      assert.equal(latest.victimReaction, BATTLE_MATRIX[atk][def].victimReaction);
      assert.ok(latest.videoUrl.endsWith('.mp4'));
      assert.ok(latest.compositeUrl.endsWith('.svg'));
      assert.equal(latest.attackerImg, CHARACTER_REGISTRY[atk].frontPortrait);
      assert.equal(latest.defenderImg, CHARACTER_REGISTRY[def].frontPortrait);
    }
  }

  assert.equal(startedEvents.length, 36, 'All 36 (6x6) pairings must emit BATTLE_STARTED');
});

test('CombatAnimationManager: Easter Egg overrides (Seby <-> Pupurabbu cuddle & Riccardo <-> Kate Golden Throne)', () => {
  const bus = new GameEventBus();
  const combat = new CombatAnimationManager();
  combat.init({ bus });

  const events = [];
  bus.on('BATTLE_STARTED', (e) => events.push(e));

  // 1. Seby (n) vs Pupurabbu (r) and Pupurabbu (r) vs Seby (n)
  for (const [atk, def] of [['n', 'r'], ['r', 'n']]) {
    combat.onDropSpawned({ attacker: atk, defender: def, square: 'e5' });
    bus.flush();
    const ev = events[events.length - 1];
    assert.equal(ev.effect, 'mega_cuddle_bounce');
    assert.equal(ev.debrisType, 'floating_purple_hearts');
    assert.equal(ev.victimReaction, 'happy_cuddle_hop');
    assert.equal(ev.easterEgg, 'seby_pupurabbu_cuddle');
    assert.equal(ev.nonLethalCuddle, true);
    assert.match(ev.banner.it, /ABBRACCIO PUFFOSO/);
  }

  // 2. Riccardo (k) vs Kate (q) and Kate (q) vs Riccardo (k)
  for (const [atk, def] of [['k', 'q'], ['q', 'k']]) {
    combat.onDropSpawned({ attacker: atk, defender: def, square: 'd8' });
    bus.flush();
    const ev = events[events.length - 1];
    assert.equal(ev.effect, 'golden_toilet_throne');
    assert.equal(ev.debrisType, 'golden_sparks');
    assert.equal(ev.victimReaction, 'royal_throne_whirl');
    assert.equal(ev.easterEgg, 'carlesso_al_cesso_throne');
    assert.match(ev.banner.it, /CARLESSO AL CESSO/);
  }

  // 3. Brother Rivalry: Seby (n) <-> Ale (b)
  combat.onDropSpawned({ attacker: 'n', defender: 'b', square: 'c6' });
  bus.flush();
  assert.equal(events[events.length - 1].easterEgg, 'brothers_turbo_vs_dragon');

  combat.onDropSpawned({ attacker: 'b', defender: 'n', square: 'f3' });
  bus.flush();
  assert.equal(events[events.length - 1].easterEgg, 'brothers_dragon_vs_turbo');

  // 4. Knight Seby (n) vs Pawn Puffin (p): Saint Seiya Sacro Acquarius & Teca di Ghiaccio Eterno!
  combat.onDropSpawned({ attacker: 'n', defender: 'p', square: 'e5' });
  bus.flush();
  const acqEv = events[events.length - 1];
  assert.equal(acqEv.effect, 'sacro_acquarius_ice_coffin');
  assert.equal(acqEv.debrisType, 'diamond_ice_crystals');
  assert.equal(acqEv.victimReaction, 'frozen_coffin_crumble');
  assert.equal(acqEv.easterEgg, 'seby_sacro_acquarius');
  assert.match(acqEv.banner.it, /SACRO ACQUARIUS/);

  // 5. King Riccardo ("Papino" k) casts a different D&D spell for each of his 6 targets!
  const expectedDndSpells = {
    k: 'disintegrate',
    q: 'flesh_to_stone_petrification',
    b: 'meteor_swarm',
    n: 'chain_lightning',
    r: 'summon_comic_daemon',
    p: 'fireball',
  };
  for (const [def, expectedSpell] of Object.entries(expectedDndSpells)) {
    combat.onDropSpawned({ attacker: 'k', defender: def, square: 'd5' });
    bus.flush();
    const dndEv = events[events.length - 1];
    assert.equal(dndEv.dndSpell, expectedSpell, `k vs ${def} must cast D&D spell ${expectedSpell}`);
  }
});

test('CombatAnimationManager: update(dt) completes cutscene after 4000ms and skip() aborts immediately', () => {
  const bus = new GameEventBus();
  const flow = new GameFlowManager();
  const combat = new CombatAnimationManager();
  flow.init({ bus });
  combat.init({ bus });
  flow.startChessMode();
  bus.flush();

  let completed = null;
  let skipped = null;
  bus.on('BATTLE_COMPLETED', (e) => { completed = e; });
  bus.on('BATTLE_SKIPPED', (e) => { skipped = e; });

  // Trigger a clash via WOW_ARENA_CLASH
  bus.emit({
    type: 'WOW_ARENA_CLASH',
    attacker: 'b',
    defender: 'p',
    tier: 'golden_crit',
    square: 'e4',
  });
  bus.flush(); // delivers WOW_ARENA_CLASH -> emits BATTLE_STARTED
  bus.flush(); // delivers BATTLE_STARTED -> GameFlow enters CaptureCutscene

  assert.equal(combat.isActive(), true);
  assert.equal(flow.state(), FLOW_STATES.CAPTURE_CUTSCENE);

  // Advance 2.0 seconds (halfway)
  combat.update(2.0);
  bus.flush();
  assert.equal(combat.isActive(), true);
  assert.equal(completed, null);
  assert.ok(Math.abs(combat.getProgress() - 0.5) < 0.01);

  // Advance another 2.1 seconds (total 4.1s >= 4.0s)
  combat.update(2.1);
  bus.flush(); // delivers BATTLE_COMPLETED
  bus.flush(); // delivers FLOW_STATE_CHANGED

  assert.equal(combat.isActive(), false);
  assert.ok(completed, 'BATTLE_COMPLETED must fire when elapsedMs >= durationMs');
  assert.equal(completed.attacker, 'b');
  assert.equal(completed.tier, 'golden_crit');
  assert.equal(flow.state(), FLOW_STATES.MODE1_CHESS);

  // Now start another battle and test skip()
  bus.emit({
    type: 'DROP_SPAWNED',
    attacker: 'q',
    defender: 'r',
    tier: 'shiny',
    square: 'c4',
  });
  bus.flush();
  bus.flush();
  assert.equal(combat.isActive(), true);
  assert.equal(flow.state(), FLOW_STATES.CAPTURE_CUTSCENE);

  combat.update(0.5);
  const didSkip = combat.skip('spacebar');
  bus.flush();
  bus.flush();

  assert.equal(didSkip, true);
  assert.equal(combat.isActive(), false);
  assert.ok(skipped, 'skip() must emit BATTLE_SKIPPED immediately');
  assert.equal(skipped.reason, 'spacebar');
  assert.equal(flow.state(), FLOW_STATES.MODE1_CHESS);
  assert.equal(combat.skip(), false, 'Calling skip() when idle returns false');
});
