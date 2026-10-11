import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { BATTLE_MATRIX, CHARACTER_REGISTRY, resolveFamilyMatchup } from '../src/core/Registry.js';
import { CombatAnimationManager, DEFAULT_BATTLE_DURATION_MS } from '../src/managers/CombatAnimationManager.js';
import { GameFlowManager, FLOW_STATES } from '../src/managers/GameFlowManager.js';
import { BoardMapManager } from '../src/managers/BoardMapManager.js';

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
});

test('CombatAnimationManager: update(dt) completes cutscene after 6000ms (+50% slower) and skip() aborts immediately', () => {
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

  assert.equal(DEFAULT_BATTLE_DURATION_MS, 6000);

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

  // Advance 3.0 seconds (halfway)
  combat.update(3.0);
  bus.flush();
  assert.equal(combat.isActive(), true);
  assert.equal(completed, null);
  assert.ok(Math.abs(combat.getProgress() - 0.5) < 0.01);

  // Advance another 3.1 seconds (total 6.1s >= 6.0s)
  combat.update(3.1);
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

test('6x6 Family Matrix Explorer & Royal Capitulation CHECKMATE squares', () => {
  // 1. Verify all 3 families x 36 combinations = 108 matchups resolve with asset inventory metadata
  let dedicatedCount = 0;
  for (const fam of ['carlesso', 'classic', 'swamp']) {
    for (const atk of PIECE_KEYS) {
      for (const def of PIECE_KEYS) {
        const m = resolveFamilyMatchup(fam, atk, def);
        assert.equal(m.familyId, fam);
        assert.ok(m.attackerDisplayName.length > 0);
        assert.ok(m.defenderDisplayName.length > 0);
        assert.ok(m.anim3dDesc?.it.length > 0);
        assert.equal(m.hasSkeletalGlbClip, atk === 'b');
        if (fam === 'carlesso' && m.hasDedicatedVideo) {
          dedicatedCount += 1;
        }
      }
    }
  }
  assert.equal(dedicatedCount, 4, '4 cells (b_x_n, n_x_b, n_x_r, r_x_n) map to dedicated Veo/MP4 videos');

  // 2. Verify BoardMapManager emits loserKingSquare and winnerKingSquare on CHECKMATE (Scholar's Mate)
  const bus = new GameEventBus();
  const board = new BoardMapManager();
  board.init({ bus });

  let checkmateEvent = null;
  bus.on('CHECKMATE', (e) => {
    checkmateEvent = e;
  });

  board.move('e2', 'e4');
  board.move('e7', 'e5');
  board.move('f1', 'c4');
  board.move('b8', 'c6');
  board.move('d1', 'h5');
  board.move('g8', 'f6');
  board.move('h5', 'f7'); // Scholar's Mate!
  bus.flush();

  assert.ok(checkmateEvent, 'CHECKMATE event must be emitted');
  assert.equal(checkmateEvent.winner, 'w');
  assert.equal(checkmateEvent.loser, 'b');
  assert.equal(checkmateEvent.loserKingSquare, 'e8');
  assert.equal(checkmateEvent.winnerKingSquare, 'e1');
});

test('VFXPoolView: auto-zooms camera tightly onto the 2 fighting pieces, hides occluding 3D text billboard, and keeps neighboring pieces visible', async () => {
  const { register } = await import('node:module');
  const threeUrl = new URL('../vendor/three/three.module.js', import.meta.url).href;
  register(
    `data:text/javascript,${encodeURIComponent(
      `export function resolve(specifier, context, nextResolve) {
        if (specifier === 'three') return { shortCircuit: true, url: ${JSON.stringify(threeUrl)} };
        return nextResolve(specifier, context);
      }`,
    )}`,
  );

  const THREE = await import('three');
  const { VFXPoolView } = await import('../src/views/VFXPoolView.js');
  const { PieceView } = await import('../src/views/PieceView.js');
  const { PieceManager } = await import('../src/managers/PieceManager.js');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 120);
  camera.position.set(0, 5.85, 12.6);
  const controls = {
    target: new THREE.Vector3(0, 2.15, -2.2),
    update() {},
  };

  const bus = new GameEventBus();
  const board = new BoardMapManager();
  const pieces = new PieceManager();
  const combat = new CombatAnimationManager();
  const ctx = { bus, board, pieces, pieceManager: pieces, combat, scene, camera, controls };
  board.init(ctx);
  pieces.init(ctx);
  combat.init(ctx);

  const pieceView = new PieceView(scene, ctx);
  pieceView.init(scene, ctx);
  const vfxView = new VFXPoolView({ scene, camera, controls, bus, pieceView });

  // Place a piece on d4 and e5 plus a neighbor on c4
  board.loadFen('rnbqkbnr/pppp1ppp/8/4p3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 2');
  bus.flush();
  bus.flush();

  const neighborPiece = pieceView.getPieceObject('c4');
  const clashFromPiece = pieceView.getPieceObject('d4');
  const clashToPiece = pieceView.getPieceObject('e5');
  assert.ok(neighborPiece?.visible, 'Neighbor piece c4 is visible before clash');
  assert.ok(clashFromPiece?.visible, 'd4 piece is visible before clash');
  assert.ok(clashToPiece?.visible, 'e5 piece is visible before clash');

  // Trigger "Lancia Sfida Ale vs Seby" (WOW_ARENA_CLASH on d4 -> e5)
  bus.emit({
    type: 'WOW_ARENA_CLASH',
    attacker: 'b',
    defender: 'n',
    from: 'd4',
    to: 'e5',
    square: 'e5',
  });
  bus.flush();
  bus.flush();

  // Advance 1.5s into combat
  for (let i = 0; i < 45; i++) {
    combat.update(1 / 30);
    vfxView.update(1 / 30);
  }

  // 1. 3D floating comic text billboard must be hidden so it never occludes the fighters!
  assert.equal(vfxView.props.comicWordSprite.visible, false, '3D comicWordSprite must stay hidden');

  // 2. Camera must auto-zoom tightly onto the 2 fighters (FOV ~30 deg, distance < 2.6m to target)
  assert.ok(camera.fov < 32, `Expected close-up FOV < 32, got ${camera.fov}`);
  const camDist = camera.position.distanceTo(controls.target);
  assert.ok(camDist < 2.6, `Expected tight close-up camera distance < 2.6m, got ${camDist.toFixed(2)}m`);

  // 3. Static board pieces on d4 & e5 are temporarily hidden (replaced by 1.22x brawl fighters),
  //    while neighboring piece c4 remains visible!
  assert.equal(clashFromPiece.visible, false, 'Static piece on d4 hidden during clash');
  assert.equal(clashToPiece.visible, false, 'Static piece on e5 hidden during clash');
  assert.equal(neighborPiece.visible, true, 'Neighboring piece on c4 remains visible around the clash');
  assert.ok(vfxView.attackerFighter?.visible, 'Animated 3D attacker fighter is visible');
  assert.ok(vfxView.defenderFighter?.visible, 'Animated 3D defender fighter is visible');
});

