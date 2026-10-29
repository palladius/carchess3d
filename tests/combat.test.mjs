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

  // 4. Knight Seby (n) vs Pawn Puffin (p): golden zodiac knights Sigillo dell’Acquario & Teca di Ghiaccio Eterno!
  combat.onDropSpawned({ attacker: 'n', defender: 'p', square: 'e5' });
  bus.flush();
  const acqEv = events[events.length - 1];
  assert.equal(acqEv.effect, 'sigillo_acquario_ice_coffin');
  assert.equal(acqEv.debrisType, 'diamond_ice_crystals');
  assert.equal(acqEv.victimReaction, 'frozen_coffin_crumble');
  assert.equal(acqEv.easterEgg, 'seby_sigillo_acquario');
  assert.match(acqEv.banner.it, /SIGILLO DELL’ACQUARIO/);

  // 5. King Riccardo ("Papino" k) casts a different spell for each of his 6 targets!
  const expectedDndSpells = {
    k: 'disintegrate',
    q: 'kiss_of_death_blight',
    b: 'meteor_swarm',
    n: 'chain_lightning',
    r: 'summon_comic_daemon',
    p: 'fireball',
  };
  for (const [def, expectedSpell] of Object.entries(expectedDndSpells)) {
    combat.onDropSpawned({ attacker: 'k', defender: def, square: 'd5' });
    bus.flush();
    const dndEv = events[events.length - 1];
    assert.equal(dndEv.dndSpell, expectedSpell, `k vs ${def} must cast spell ${expectedSpell}`);
  }
});

test('CombatAnimationManager: update(dt) completes cutscene after 10000ms (1s pre + 8s video + 1s post) and skip() aborts immediately', () => {
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

  assert.equal(DEFAULT_BATTLE_DURATION_MS, 10000);

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

  // Advance 5.0 seconds (halfway of 10.0s)
  combat.update(5.0);
  bus.flush();
  assert.equal(combat.isActive(), true);
  assert.equal(completed, null);
  assert.ok(Math.abs(combat.getProgress() - 0.5) < 0.01);

  // Advance another 5.1 seconds (total 10.1s >= 10.0s)
  combat.update(5.1);
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
  const neighborInitialX = neighborPiece.position.x;
  const neighborInitialZ = neighborPiece.position.z;
  const neighborInitialScale = neighborPiece.scale.x;

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

  // 1. 3D floating comic text billboard and chaotic brawlCloud must be hidden so they never occlude the fighters!
  assert.equal(vfxView.props.comicWordSprite.visible, false, '3D comicWordSprite must stay hidden');
  assert.equal(vfxView.props.brawlCloud.visible, false, 'brawlCloud dust blob must stay hidden for clean fighter silhouettes');

  // 2. Camera must zoom onto the 2 fighters while framing ~5x5 board squares (FOV ~45 deg, distance ~4.5m..5.2m)
  assert.ok(camera.fov <= 46 && camera.fov >= 42, `Expected half-board FOV ~45, got ${camera.fov}`);
  const camDist = camera.position.distanceTo(controls.target);
  assert.ok(camDist > 4.0 && camDist < 5.5, `Expected ~5x5 half-board camera distance 4.0m..5.5m, got ${camDist.toFixed(2)}m`);

  // 3. Static board pieces on d4 & e5 are temporarily hidden (replaced by 1.52x hero fighters),
  //    while neighboring piece c4 remains visible, dilated outward, and scaled down non-linearly!
  assert.equal(clashFromPiece.visible, false, 'Static piece on d4 hidden during clash');
  assert.equal(clashToPiece.visible, false, 'Static piece on e5 hidden during clash');
  assert.equal(neighborPiece.visible, true, 'Neighboring piece on c4 remains visible around the clash');
  assert.ok(vfxView.attackerFighter?.visible, 'Animated 3D attacker fighter is visible');
  assert.ok(vfxView.defenderFighter?.visible, 'Animated 3D defender fighter is visible');
  assert.ok(vfxView.attackerFighter.scale.x > 1.45, `Expected 1.52x hero scale on attacker, got ${vfxView.attackerFighter.scale.x.toFixed(2)}`);

  const neighborMovedDist = Math.hypot(
    neighborPiece.position.x - neighborInitialX,
    neighborPiece.position.z - neighborInitialZ,
  );
  assert.ok(neighborMovedDist > 0.6, `Expected neighbor piece c4 to be dilated outward >0.6m, got ${neighborMovedDist.toFixed(2)}m`);
  assert.ok(
    neighborPiece.scale.x < neighborInitialScale * 0.72,
    `Expected neighbor piece c4 to be scaled down <72% of initial scale, got ${(neighborPiece.scale.x / neighborInitialScale).toFixed(2)}`,
  );
  assert.equal(vfxView.props.loopTrack.visible, false, 'loopTrack orange ring must stay hidden so it never occludes Knight Seby');

  // 4. Verify Spacebar / Click forced exit (BATTLE_SKIPPED) triggers a measured 2.5s sliding-window transition
  let lastHudBlend = 1.0;
  scene.userData.applyHudCombatBlend = (b) => {
    lastHudBlend = b;
  };
  combat.skipActiveCutscene('space_or_click');
  bus.flush();
  bus.flush();

  assert.ok(vfxView.camRestoreTimer > 0, 'BATTLE_SKIPPED enters measured sliding-window exit instead of abrupt cut');
  assert.equal(vfxView.exitWindowTotalS, 2.5, 'Forced exit uses measured 2.5s sliding window');

  // Advance 1.25s (halfway through 2.5s exit, using 0.05s steps since VFXPoolView clamps step <= 0.1s)
  for (let i = 0; i < 25; i++) {
    vfxView.update(0.05);
  }
  assert.ok(lastHudBlend > 0.2 && lastHudBlend < 0.8, `Expected mid-exit HUD blend ~0.5, got ${lastHudBlend.toFixed(2)}`);

  // Advance remaining 1.3s to complete exit
  for (let i = 0; i < 26; i++) {
    vfxView.update(0.05);
  }
  assert.equal(vfxView.camRestoreTimer, 0, 'Sliding-window exit finishes cleanly');
  assert.equal(lastHudBlend, 0, 'HUD chrome is 100% restored at end of sliding-window exit');
});

test('ZurichSwampView: switches 64 chessboard tiles to 50% translucency during combat and restores 100% opacity after', async () => {
  const THREE = await import('three');
  const { ZurichSwampView } = await import('../src/views/ZurichSwampView.js');

  const scene = new THREE.Scene();
  const bus = new GameEventBus();
  const swampView = new ZurichSwampView(scene, bus);

  assert.equal(swampView.squareMeshes.length, 64);
  assert.equal(swampView.squareMeshes[0].material.transparent, false);
  assert.equal(swampView.squareMeshes[0].material.opacity, 1.0);
  assert.equal(swampView.foundationMesh.visible, true);

  bus.emit({ type: 'BATTLE_STARTED', attacker: 'p', defender: 'p', from: 'e4', to: 'd5' });
  bus.flush();

  assert.equal(swampView.inCombatCinemaMode, true);
  assert.equal(swampView.foundationMesh.visible, false, 'Under-board stone foundation hidden during combat');
  assert.equal(swampView.islandMesh.visible, false, 'Under-board stone island hidden during combat');
  for (const sq of swampView.squareMeshes) {
    assert.equal(sq.material.transparent, true);
    assert.equal(sq.material.opacity, 0.10);
    assert.equal(sq.material.depthWrite, false);
  }

  // Mid-sliding-window transition (50% blend): chessboard is 55% opaque and diorama is rematerializing at 50% alpha
  swampView.setCombatBlend(0.5);
  assert.equal(swampView.inCombatCinemaMode, true);
  assert.equal(swampView.foundationMesh.visible, true, 'Foundation visible while rematerializing at 50% blend');
  assert.ok(Math.abs(swampView.squareMeshes[0].material.opacity - 0.55) < 0.01, 'Board tiles at 55% opacity mid-transition');

  // End of sliding-window transition (0% blend): full restoration
  swampView.setCombatBlend(0.0);

  assert.equal(swampView.inCombatCinemaMode, false);
  assert.equal(swampView.foundationMesh.visible, true);
  assert.equal(swampView.islandMesh.visible, true);
  for (const sq of swampView.squareMeshes) {
    assert.equal(sq.material.transparent, false);
    assert.equal(sq.material.opacity, 1.0);
    assert.equal(sq.material.depthWrite, true);
  }
});

test('Integration: 4-angle camera rotation (0°, 90°, 180°, 270°) keeps chessboard 100% playable and unoccluded by Zurich skyline & Veo screen, with living pond frogs & fish', async () => {
  const THREE = await import('three');
  const { ZurichSwampView } = await import('../src/views/ZurichSwampView.js');
  const { VeoCinemaView } = await import('../src/views/VeoCinemaView.js');
  const { PieceView } = await import('../src/views/PieceView.js');
  const { PieceManager } = await import('../src/managers/PieceManager.js');
  const { BoardInteractionView } = await import('../src/views/BoardInteractionView.js');
  const { squareToWorld } = await import('../src/core/Registry.js');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 120);
  camera.position.set(0.0, 5.85, 12.6);
  const controls = {
    target: new THREE.Vector3(0.0, 2.15, -2.2),
    update() {
      camera.lookAt(this.target);
      camera.updateMatrixWorld(true);
    },
  };
  controls.update();

  const bus = new GameEventBus();
  const flow = new GameFlowManager();
  const board = new BoardMapManager();
  const pieces = new PieceManager();
  const ctx = { bus, flow, board, pieces, pieceManager: pieces, scene, camera, controls };
  flow.init(ctx);
  board.init(ctx);
  pieces.init(ctx);
  flow.startChessMode();
  board.reset();
  bus.flush();
  bus.flush();

  const swampView = new ZurichSwampView(scene, bus);
  const cinemaView = new VeoCinemaView(scene, bus);
  const pieceView = new PieceView(scene, ctx);
  pieceView.init(scene, ctx);

  const domElement = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener() {},
  };
  const boardInteraction = new BoardInteractionView({
    scene,
    camera,
    domElement,
    swampView,
    pieceView,
    ctx,
  });
  boardInteraction.init(ctx);

  // Collect all backdrop meshes (Zurich Skyline & Alps + Veo Cinema Mirror) that could occlude the board
  const backdropRoots = [
    scene.getObjectByName('ZurichSkylineAndAlps'),
    scene.getObjectByName('VeoMagicCinemaMirror'),
  ].filter(Boolean);
  assert.equal(backdropRoots.length, 2, 'Both ZurichSkylineAndAlps and VeoMagicCinemaMirror exist in scene');

  // Helper: project a 3D world point to screen pixel coordinates (1280x720)
  const worldToClient = (wx, wy, wz) => {
    const v = new THREE.Vector3(wx, wy, wz).project(camera);
    return {
      clientX: ((v.x + 1) * 0.5) * 1280,
      clientY: ((-v.y + 1) * 0.5) * 720,
    };
  };

  // Test 4 canonical camera orbit viewpoints: 0° (South), 90° (East), 180° (North/Black POV), 270° (West)
  const orbitAnglesDeg = [0, 90, 180, 270];
  const radius = 12.6;
  const camY = 5.85;
  const keySquares = ['e1', 'd1', 'e2', 'd2', 'e4', 'd5', 'e7', 'd7', 'e8', 'd8', 'a1', 'h1', 'a8', 'h8'];

  const raycaster = new THREE.Raycaster();
  raycaster.camera = camera;

  for (const deg of orbitAnglesDeg) {
    const rad = (deg * Math.PI) / 180;
    // Rotate camera around board origin (0, 0, 0) at 0°, 90°, 180° (z = -12.6!), 270°
    camera.position.set(Math.sin(rad) * radius, camY, Math.cos(rad) * radius);
    controls.target.set(0, 0.3, 0);
    controls.update();

    // Advance views with current camera so infinite/horizon parallax updates
    swampView.update(1 / 30, camera, controls.target);
    cinemaView.update(1 / 30, camera, controls.target);
    scene.updateMatrixWorld(true);

    // 1. Raycast from camera to key squares & pieces: verify ZERO occlusion by Zurich skyline or Veo screen
    const boardAndPieceTargets = [
      ...pieceView.getAllPieceObjects(),
      ...swampView.squareMeshes,
    ];
    for (const sq of keySquares) {
      const sqWorld = squareToWorld(sq);
      const targetPt = new THREE.Vector3(sqWorld.x, 0.35, sqWorld.z);
      const dir = targetPt.clone().sub(camera.position).normalize();
      raycaster.set(camera.position, dir);

      const backdropHits = raycaster.intersectObjects(backdropRoots, true);
      const boardHits = raycaster.intersectObjects(boardAndPieceTargets, true);
      assert.ok(boardHits.length > 0, `At ${deg}°, ray to square ${sq} must hit board or piece`);

      if (backdropHits.length > 0) {
        assert.ok(
          backdropHits[0].distance > boardHits[0].distance,
          `At ${deg}°, ${backdropHits[0].object.name || 'Zurich/Veo backdrop'} OCCLUDES square ${sq} (backdrop hit at ${backdropHits[0].distance.toFixed(2)}m < piece/square at ${boardHits[0].distance.toFixed(2)}m)!`,
        );
      }

      // Also verify BoardInteractionView.pickSquareFromPointerEvent resolves the square from this angle
      const screenPt = worldToClient(sqWorld.x, 0.02, sqWorld.z);
      const picked = boardInteraction.pickSquareFromPointerEvent(screenPt);
      assert.ok(picked, `At ${deg}°, pointer click on ${sq} must resolve a valid board square`);
    }
  }

  for (const deg of orbitAnglesDeg) {
    const rad = (deg * Math.PI) / 180;
    camera.position.set(Math.sin(rad) * radius, camY, Math.cos(rad) * radius);
    controls.target.set(0, 0.3, 0);
    controls.update();
    swampView.update(1 / 30, camera, controls.target);
    cinemaView.update(1 / 30, camera, controls.target);
    scene.updateMatrixWorld(true);

    // 2. Verify the observer (camera) is strictly BETWEEN the Zurich/Veo backdrop and the chessboard!
    const camToBoard = new THREE.Vector3(0, 0, 0).sub(camera.position).normalize();
    const distToBoardCenter = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    for (const bRoot of backdropRoots) {
      const box = new THREE.Box3().setFromObject(bRoot);
      const bCenter = new THREE.Vector3();
      box.getCenter(bCenter);
      const camToBackdrop = bCenter.sub(camera.position);
      const distAlongView = camToBackdrop.dot(camToBoard);
      assert.ok(
        distAlongView > distToBoardCenter + 2.5,
        `At ${deg}° camera rotation, ${bRoot.name} must remain behind the board (observer between Zurich and board), got distAlongView=${distAlongView.toFixed(2)}m vs boardDist=${distToBoardCenter.toFixed(2)}m`,
      );
    }
  }

  // 3. Verify a real chess move can be played via pointer tap when rotated 180° (Black perspective)
  const rad180 = Math.PI;
  camera.position.set(Math.sin(rad180) * radius, camY, Math.cos(rad180) * radius);
  controls.target.set(0, 0.3, 0);
  controls.update();
  swampView.update(1 / 30, camera, controls.target);
  cinemaView.update(1 / 30, camera, controls.target);
  scene.updateMatrixWorld(true);

  boardInteraction.handleSquareTap('e2');
  assert.equal(board.selectedSquare, 'e2', 'Selecting e2 works at 180° rotation');
  boardInteraction.handleSquareTap('e4');
  assert.equal(board.pieceAt('e4')?.type, 'p', 'Moving e2->e4 works at 180° rotation');

  // 4. Verify the Enchanted Swamp Moat stays anchored around the board and features animated frogs & fish!
  const moatGroup = scene.getObjectByName('EnchantedSwampMoat');
  assert.ok(moatGroup, 'EnchantedSwampMoat remains in scene');
  assert.equal(moatGroup.position.x, 0, 'Swamp moat stays centered on X=0');
  assert.equal(moatGroup.position.z, 0, 'Swamp moat stays centered on Z=0');
  assert.ok(
    Array.isArray(swampView.jumpingFrogs) && swampView.jumpingFrogs.length >= 4,
    'Swamp pond includes animated jumping frogs',
  );
  assert.ok(
    Array.isArray(swampView.swimmingFish) && swampView.swimmingFish.length >= 6,
    'Swamp pond includes animated swimming/leaping fish',
  );

  // 5. Verify semi-transparent 3D liquid water volume, visible seabed & animated 3D surface waves!
  assert.ok(swampView.waterMaterial?.transparent === true, 'Swamp water material must be semi-transparent');
  assert.ok(
    swampView.waterMaterial?.opacity >= 0.45 && swampView.waterMaterial?.opacity <= 0.85,
    `Swamp water opacity must be semi-transparent (0.45..0.85), got ${swampView.waterMaterial?.opacity}`,
  );
  assert.ok(swampView.seabedMesh, 'Swamp pond must have a 3D underwater seabed mesh beneath the translucent liquid');
  assert.ok(
    swampView.waterBodyMesh,
    'Swamp pond must have a volumetric 3D liquid body cylinder/ring',
  );
  const wavePosAttr = swampView.waterMesh.geometry.getAttribute('position');
  const yBefore = wavePosAttr.getY(10);
  swampView.update(0.35, camera, controls.target);
  const yAfter = wavePosAttr.getY(10);
  assert.notEqual(yBefore, yAfter, '3D water surface vertices must animate with 3D liquid waves over time');

  // 6. Verify water-skating insects & concentric circular water ripples + radial wave crests!
  assert.ok(
    Array.isArray(swampView.waterInsects) && swampView.waterInsects.length >= 8,
    'Swamp pond must include animated water-skating insects (Gerridi/Libellule)',
  );
  assert.ok(
    Array.isArray(swampView.waterInsects[0].rippleRings) && swampView.waterInsects[0].rippleRings.length >= 3,
    'Each water insect must generate 3 nested concentric circular ripple rings',
  );
  assert.ok(
    Array.isArray(swampView.waveCrestRings) && swampView.waveCrestRings.length >= 4,
    'Swamp pond must include propagating radial wave-crest shimmer rings',
  );
});

test('Regression: VeoCinemaView video playback lifecycle (no premature play/pause abort, no per-frame currentTime seek storm) & EnchantedSwampMoat fade during combat', async () => {
  const THREE = await import('three');
  const { ZurichSwampView } = await import('../src/views/ZurichSwampView.js');
  const { VeoCinemaView } = await import('../src/views/VeoCinemaView.js');

  const scene = new THREE.Scene();
  const bus = new GameEventBus();
  const swampView = new ZurichSwampView(scene, bus);
  const cinemaView = new VeoCinemaView(scene, bus);

  // Mock a DOM <video> element on cinemaView to verify exact load/play/seek calls
  let loadCalls = 0;
  let playCalls = 0;
  let pauseCalls = 0;
  let currentTimeWrites = 0;
  let internalCurrentTime = 0;

  cinemaView.videoEl = {
    preload: 'auto',
    src: '',
    paused: true,
    readyState: 4,
    videoWidth: 1280,
    videoHeight: 720,
    duration: 8.0,
    get currentTime() {
      return internalCurrentTime;
    },
    set currentTime(val) {
      currentTimeWrites += 1;
      internalCurrentTime = val;
    },
    load() {
      loadCalls += 1;
      this.paused = true;
    },
    play() {
      playCalls += 1;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      pauseCalls += 1;
      this.paused = true;
    },
  };

  const initialWaterOpacity = swampView.waterMaterial.opacity;

  // 1. Emit PIECE_CAPTURED followed 0.8s later by BATTLE_STARTED (simulating heavy GLB load frame gap)
  bus.emit({
    type: 'PIECE_CAPTURED',
    attacker: { type: 'b', color: 'w' },
    captured: { type: 'n', color: 'b' },
    from: 'd4',
    to: 'e5',
  });
  bus.flush();

  assert.equal(cinemaView.mode, 'battle');
  assert.equal(cinemaView.videoWaitingPrePadding, true, 'Waits in 1.0s pre-padding before calling play()');
  assert.equal(loadCalls, 1, 'Calls videoEl.load() once during pre-padding');
  assert.equal(playCalls, 0, 'Does NOT call videoEl.play() prematurely during [0, 1.0s) pre-padding');

  cinemaView.update(0.8);
  const elapsedBeforeSecondEvent = cinemaView.battleElapsed;
  assert.ok(elapsedBeforeSecondEvent >= 0.79, 'battleElapsed advanced to 0.8s');

  // Emit BATTLE_STARTED 0.8s later with rich metadata: must deduplicate and merge metadata without resetting battleElapsed or reloading video
  bus.emit({
    type: 'BATTLE_STARTED',
    attacker: 'b',
    defender: 'n',
    from: 'd4',
    to: 'e5',
    title: { it: 'Alfiere Ale vs Cavaliere Seby' },
    banner: { it: 'ALE vs SEBY!' },
  });
  bus.flush();

  assert.equal(cinemaView.battleElapsed, elapsedBeforeSecondEvent, 'battleElapsed is NOT reset by follow-up BATTLE_STARTED');
  assert.equal(loadCalls, 1, 'videoEl.load() is NOT called a second time');
  assert.equal(cinemaView.activeBattle?.title?.it, 'Alfiere Ale vs Cavaliere Seby', 'Rich metadata is merged into activeBattle');

  // 2. Advance past 1.0s pre-padding (total 1.1s): play() must be called once, and subsequent frames must NOT overwrite currentTime!
  cinemaView.update(0.3);
  await Promise.resolve();
  assert.equal(cinemaView.videoWaitingPrePadding, false, 'Pre-padding finishes at t >= 1.0s');
  assert.equal(playCalls, 1, 'videoEl.play() called exactly once at t = 1.0s');
  assert.equal(cinemaView.usingVideoTexture, true);
  assert.equal(cinemaView.videoEl.paused, false);

  const writesAtPlayStart = currentTimeWrites;
  // Simulate 30 frames of active playback where videoCurrentTime lags slightly behind battleElapsed - 1.0s
  for (let i = 0; i < 30; i++) {
    internalCurrentTime += 0.025;
    cinemaView.update(1 / 30);
  }
  assert.equal(
    currentTimeWrites,
    writesAtPlayStart,
    'VeoCinemaView.update() must NEVER force-seek videoEl.currentTime every frame during playback (prevents net::ERR_ABORTED seek storms)',
  );

  // 3. Verify EnchantedSwampMoat (swampView.swampGroup) hides during full combat (combatBlend = 1.0)
  //    so it never cuts across the 16:9 Veo Cinema screen, and restores cleanly after combat (combatBlend = 0.0)
  assert.equal(swampView.swampGroup.visible, false, 'EnchantedSwampMoat must be hidden at combatBlend = 1.0 so it never occludes the 16:9 Veo video');
  swampView.setCombatBlend(0.5);
  assert.equal(swampView.swampGroup.visible, true, 'EnchantedSwampMoat rematerializes during sliding-window exit');
  swampView.setCombatBlend(0.0);
  assert.equal(swampView.swampGroup.visible, true, 'EnchantedSwampMoat is visible after combat ends');
  assert.equal(swampView.waterMaterial.transparent, true, 'Swamp water remains semi-transparent after combat restoration');
  assert.ok(
    Math.abs(swampView.waterMaterial.opacity - initialWaterOpacity) < 0.01,
    `Swamp water opacity restores to ${initialWaterOpacity} after combat, got ${swampView.waterMaterial.opacity}`,
  );
});


