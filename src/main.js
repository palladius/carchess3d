/**
 * @fileoverview CarChess3D ("Carlesso al Cesso") — Main Entry Point (`src/main.js`).
 *
 * Follows `.agents/skills/niccolo-game-design/SKILL.md`:
 * - Top-level loop is intentionally boring:
 *   1. Fixed `1/30s` simulation step across managers + `bus.flush()`
 *   2. `lateUpdate(frameDt)` across views/choreographers
 *   3. `composer.render()` / `renderer.render(scene, camera)`
 * - Zero gameplay rules in `main.js` — all rules live in `BoardMapManager`,
 *   `DropManager`, `GameFlowManager`, `PieceManager`, `CombatAnimationManager`,
 *   and `AIWorkerManager`.
 */

import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/addons/controls/OrbitControls.js';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';

import { GameEventBus } from './core/EventBus.js';
import { mulberry32 } from './core/Rng.js';
import { GameLoop } from './core/GameLoop.js';

import { GameFlowManager, FLOW_STATES } from './managers/GameFlowManager.js';
import { BoardMapManager } from './managers/BoardMapManager.js';
import { PieceManager } from './managers/PieceManager.js';
import { DropManager } from './managers/DropManager.js';
import { CombatAnimationManager } from './managers/CombatAnimationManager.js';
import { AIWorkerManager } from './managers/AIWorkerManager.js';

import { ZurichSwampView } from './views/ZurichSwampView.js';
import { VeoCinemaView } from './views/VeoCinemaView.js';
import { PieceView } from './views/PieceView.js';
import { BoardInteractionView } from './views/BoardInteractionView.js';
import { VFXPoolView } from './views/VFXPoolView.js';
import { WowModeView } from './views/WowModeView.js';
import { DebugPanelView } from './views/DebugPanelView.js';

import { HudListener } from './listeners/HudListener.js';
import { AudioListener } from './listeners/AudioListener.js';
import { ProfileStorageListener } from './listeners/ProfileStorageListener.js';

function bootstrapCarChess3D() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true, // Enables clean screenshot capture for 4-angle Critic
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;

  const scene = new THREE.Scene();

  // Default player camera framing both the 8x8 altar + 4 braziers AND the 16:9 Cinema Mirror + Grossmünster
  const camera = new THREE.PerspectiveCamera(
    46,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.1,
    120,
  );
  camera.position.set(0.0, 5.85, 12.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 3.2;
  controls.maxDistance = 24.0;
  controls.maxPolarAngle = Math.PI * 0.485; // Keep camera above the swamp water plane
  controls.target.set(0.0, 2.15, -2.2);
  controls.update();

  // Post-processing bloom pipeline
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.36, // strength
    0.45, // radius
    0.80, // threshold
  );
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  // 1. Core Event Bus & Seeded PRNG
  const bus = new GameEventBus();
  const rng = mulberry32(42);

  // 2. Headless Managers (Update order declared once!)
  const flow = new GameFlowManager();
  const board = new BoardMapManager();
  const pieces = new PieceManager();
  const drops = new DropManager();
  const combat = new CombatAnimationManager();
  const ai = new AIWorkerManager();

  // 3. Shared GameContext (Service Locator / Dependency Injection)
  const ctx = {
    bus,
    rng,
    flow,
    board,
    pieces,
    pieceManager: pieces,
    drops,
    combat,
    ai,
    scene,
    camera,
    controls,
    renderer,
  };

  flow.init(ctx);
  board.init(ctx);
  pieces.init(ctx);
  drops.init(ctx);
  combat.init(ctx);
  ai.init(ctx);

  // 4. 3D Views
  const swampView = new ZurichSwampView(scene, bus);
  const cinemaView = new VeoCinemaView(scene, bus);
  const pieceView = new PieceView(scene, ctx);
  pieceView.init(scene, ctx);

  const boardInteraction = new BoardInteractionView({
    scene,
    camera,
    domElement: renderer.domElement,
    swampView,
    pieceView,
    ctx,
  });
  boardInteraction.init({
    scene,
    camera,
    domElement: renderer.domElement,
    swampView,
    pieceView,
    ctx,
  });

  const vfxView = new VFXPoolView({
    scene,
    camera,
    controls,
    bus,
    pieceView,
  });

  const wowView = new WowModeView({
    scene,
    camera,
    controls,
    domElement: renderer.domElement,
    pieceView,
    ctx,
  });
  wowView.init({
    scene,
    camera,
    controls,
    domElement: renderer.domElement,
    pieceView,
    ctx,
  });

  // Hide Mode 1 3D pieces when Mode 2 WOW Turntable Inspector is active
  bus.on('FLOW_STATE_CHANGED', (e) => {
    if (e.to === FLOW_STATES.MODE2_WOW_ARENA) {
      pieceView.rootGroup.visible = false;
      boardInteraction.rootGroup.visible = false;
    } else if (e.to === FLOW_STATES.MODE1_CHESS) {
      pieceView.rootGroup.visible = true;
      boardInteraction.rootGroup.visible = true;
    }
  });
  bus.on('WOW_INSPECT_CHARACTER', (e) => {
    if (flow.state() === FLOW_STATES.MODE2_WOW_ARENA) {
      // In Arena submode, show staged pieces; in Inspector submode, hide board pieces
      pieceView.rootGroup.visible = e.subMode === 'arena';
    }
  });

  // 5. Event Listeners (Audio, Storage, HUD)
  const profileStorage = new ProfileStorageListener(ctx);
  const audio = new AudioListener(ctx);
  ctx.audio = audio;
  ctx.profileStorage = profileStorage;
  const hud = new HudListener(ctx);

  // 6. CPU AI Move Orchestration lives in AIWorkerManager (reacts to MOVE_EXECUTED /
  //    OPPONENT_CHANGED / BATTLE_*), and BoardMapManager applies AI_MOVE_READY.

  // 7. Art Director Live Control Panel (?debug=1 & ?cam=...)
  const debugPanel = new DebugPanelView({
    swampView,
    pieceView,
    bloomPass,
    camera,
    controls,
    scene,
  });
  debugPanel.init();

  // Start initial chess match and flush initial events
  flow.startChessMode();
  board.reset();
  bus.flush();
  bus.flush();

  // Re-apply URL camera preset after initial board sync
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'wow') {
    flow.startWowMode({
      submode: urlParams.get('submode') || 'turntable',
      character: urlParams.get('char') || 'b',
    });
    bus.flush();
    bus.flush();
    camera.fov = 38;
    camera.position.set(0.0, 2.35, 5.4);
    controls.target.set(0.0, 1.05, 0.0);
    camera.updateProjectionMatrix();
    controls.update();
  }
  if (urlParams.get('swamp_party') === '1') {
    for (const [color, victimColor, atk, def, sq] of [
      ['b', 'w', 'n', 'b', 'c1'],
      ['b', 'w', 'b', 'n', 'g1'],
      ['b', 'w', 'r', 'p', 'e2'],
      ['w', 'b', 'b', 'n', 'b8'],
      ['w', 'b', 'n', 'b', 'f8'],
      ['w', 'b', 'q', 'r', 'h8'],
    ]) {
      pieces.handlePieceCaptured({ color, victimColor, attacker: atk, defender: def, capturedSquare: sq });
    }
    pieces.emitPiecesSynced('swamp_party');
    bus.flush();
    bus.flush();
  }
  if (urlParams.get('clash')) {
    const [atk, def] = urlParams.get('clash').split('_');
    bus.emit({
      type: 'WOW_ARENA_CLASH',
      attacker: atk || 'b',
      defender: def || 'p',
      tier: urlParams.get('tier') || 'golden_crit',
      square: 'e4',
      durationMs: 12000,
    });
    bus.flush();
    bus.flush();
  }
  if (urlParams.get('demo_moves') === '1') {
    board.requestMove('g1', 'f3');
    bus.flush();
    board.requestMove('e7', 'e5');
    bus.flush();
    board.selectSquare(urlParams.get('select') || 'f3');
    bus.flush();
  } else if (urlParams.get('select')) {
    board.selectSquare(urlParams.get('select'));
    bus.flush();
  }
  if (urlParams.get('cam')) {
    debugPanel.applyCameraPreset(urlParams.get('cam'));
  }
  if (urlParams.get('hidehud') === '1' && hud.rootEl) {
    hud.rootEl.style.display = 'none';
  }

  // 8. Ordered Manager & View Lifecycle List for the Fixed-Timestep Loop
  const orderedUnits = [
    flow,
    board,
    pieces,
    drops,
    combat,
    ai,
    {
      update(dt) {
        swampView.update?.(dt);
        cinemaView.update?.(dt);
        pieceView.update?.(dt);
        boardInteraction.update?.(dt);
        vfxView.update?.(dt);
        wowView.update?.(dt);
      },
      lateUpdate(frameDt) {
        controls.update();
        vfxView.lateUpdate?.(frameDt);
      },
    },
  ];

  const gameLoop = new GameLoop(orderedUnits, bus, 1 / 30);

  // Window Resize Handler
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });

  // Expose handle for automated Playwright/Chromium 4-angle Critic & UAT inspection
  window.__CARCHESS__ = {
    bus,
    ctx,
    scene,
    camera,
    renderer,
    composer,
    controls,
    swampView,
    cinemaView,
    pieceView,
    boardInteraction,
    vfxView,
    wowView,
    debugPanel,
    hud,
    audio,
    profileStorage,
    gameLoop,
  };

  let lastTime = performance.now();
  function animate(now) {
    const frameDt = (now - lastTime) / 1000;
    lastTime = now;
    gameLoop.frame(frameDt, () => {
      if (debugPanel.state.wireframe) {
        renderer.render(scene, camera);
      } else {
        composer.render();
      }
    });
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

bootstrapCarChess3D();
