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
  controls.rotateSpeed = 0.95;
  controls.zoomSpeed = 1.25;
  controls.panSpeed = 0.85;
  controls.minDistance = 2.6;
  controls.maxDistance = 24.0;
  controls.minPolarAngle = 0.06;
  controls.maxPolarAngle = Math.PI * 0.485; // Keep camera above the swamp water plane
  controls.target.set(0.0, 2.15, -2.2);
  controls.trackpadTwoFingerRotate = true;

  // Mac Trackpad 2-Finger Gesture Upgrade:
  // - 2-finger swipe (deltaX, deltaY without ctrl/meta/alt) -> Rotates Left/Right & Up/Down!
  // - 2-finger pinch (event.ctrlKey === true) or Cmd/Option/Ctrl + 2-finger scroll -> Zooms In/Out!
  // - Shift + 2-finger swipe -> Pans camera target!
  controls._handleMouseWheel = function (event) {
    this._updateZoomParameters(event.clientX, event.clientY);
    const isPinchOrZoomMod =
      event.ctrlKey || event.metaKey || event.altKey || !this.trackpadTwoFingerRotate;
    if (isPinchOrZoomMod) {
      const pinchScale = Math.pow(
        0.95,
        this.zoomSpeed * Math.min(8.0, Math.abs(event.deltaY) * 0.025 + 0.35),
      );
      if (event.deltaY < 0) {
        this._dollyIn(pinchScale);
      } else if (event.deltaY > 0) {
        this._dollyOut(pinchScale);
      }
    } else if (event.shiftKey) {
      this._pan(-event.deltaX * 0.65, -event.deltaY * 0.65);
    } else {
      const h = Math.max(1, this.domElement.clientHeight || window.innerHeight || 800);
      const twoPi = Math.PI * 2;
      this._rotateLeft((twoPi * event.deltaX * this.rotateSpeed * 0.85) / h);
      this._rotateUp((twoPi * event.deltaY * this.rotateSpeed * 0.85) / h);
    }
    this.update();
  };

  // Safari macOS native 2-finger trackpad pinch gesture support (`gesturestart` / `gesturechange`)
  let lastSafariScale = 1.0;
  renderer.domElement.addEventListener(
    'gesturestart',
    (e) => {
      e.preventDefault();
      lastSafariScale = e.scale || 1.0;
    },
    { passive: false },
  );
  renderer.domElement.addEventListener(
    'gesturechange',
    (e) => {
      e.preventDefault();
      const currentScale = e.scale || 1.0;
      const ratio = currentScale / Math.max(0.01, lastSafariScale);
      lastSafariScale = currentScale;
      if (ratio > 1.002) {
        controls._dollyOut(Math.min(1.18, ratio));
      } else if (ratio < 0.998) {
        controls._dollyIn(Math.max(0.84, ratio));
      }
      controls.update();
    },
    { passive: false },
  );

  // Keyboard Zoom (+ / -) and Arrow Orbit shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
      return;
    }
    if (e.key === '+' || e.key === '=') {
      controls._dollyOut(0.88);
      controls.update();
    } else if (e.key === '-' || e.key === '_') {
      controls._dollyIn(0.88);
      controls.update();
    } else if (e.key === 'ArrowLeft') {
      controls._rotateLeft(0.08);
      controls.update();
    } else if (e.key === 'ArrowRight') {
      controls._rotateLeft(-0.08);
      controls.update();
    } else if (e.key === 'ArrowUp') {
      controls._rotateUp(0.08);
      controls.update();
    } else if (e.key === 'ArrowDown') {
      controls._rotateUp(-0.08);
      controls.update();
    }
  });

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

  // Hide Mode 1 3D pieces when Mode 2 WOW Turntable Inspector is active,
  // but show them during CaptureCutscene or Arena submode so neighboring pieces frame the combat!
  bus.on('FLOW_STATE_CHANGED', (e) => {
    if (e.to === FLOW_STATES.CAPTURE_CUTSCENE) {
      pieceView.rootGroup.visible = true;
      boardInteraction.rootGroup.visible = false;
    } else if (e.to === FLOW_STATES.MODE2_WOW_ARENA) {
      pieceView.rootGroup.visible = wowView.subMode === 'arena';
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

  // Re-apply URL camera preset & family selectors after initial board sync
  const urlParams = new URLSearchParams(window.location.search);
  const familyParam = urlParams.get('family');
  const whiteParam = urlParams.get('white') || familyParam || 'carlesso';
  const blackParam =
    urlParams.get('black') ||
    urlParams.get('rival') ||
    (familyParam && familyParam !== 'carlesso' ? familyParam : 'classic');
  if (whiteParam) {
    pieces.setWhiteFamily(whiteParam);
  }
  if (blackParam) {
    pieces.setRivalSetMode(blackParam);
  }

  // Default setup: Famiglia Carlesso (White, Human) vs Scacchi Classici (Black, AI Easy)
  const cpuParam = urlParams.get('ai') || urlParams.get('cpu') || 'easy';
  const cpuColorParam = urlParams.get('cpucolor') || 'b';
  ai.configure({
    enabled: cpuParam !== '0' && cpuParam !== 'none' && cpuParam !== 'false',
    cpuColor: cpuColorParam,
    difficulty: cpuParam,
    whiteDifficulty: 'easy',
    blackDifficulty: cpuParam,
  });

  bus.flush();
  bus.flush();
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
    pieces.seedSwampParty();
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
    flow,
    board,
    pieces,
    drops,
    combat,
    ai,
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
