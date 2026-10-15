import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameEventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/Rng.js';
import { GameLoop } from '../src/core/GameLoop.js';
import { computeGroundingTransform, CANONICAL_PIECE_HEIGHTS } from '../src/utils/glbGrounding.js';
import {
  APP_VERSION,
  GITHUB_REPO_URL,
  GITHUB_NEW_ISSUE_URL,
  isMobilePhoneViewport,
  isPortraitOrientation,
  applyWheelZoomOrOrbit,
} from '../src/core/Registry.js';
import { HudListener } from '../src/listeners/HudListener.js';

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

test('footer metadata & i18n flags: APP_VERSION matches VERSION file, GitHub links work, and HudListener defaults to English with EN/IT flag switching', () => {
  const versionFile = readFileSync(new URL('../VERSION', import.meta.url), 'utf-8').trim();
  assert.equal(APP_VERSION, versionFile, 'APP_VERSION in Registry.js must match repo VERSION file');
  assert.equal(GITHUB_REPO_URL, 'https://github.com/palladius/carchess3d');
  assert.equal(GITHUB_NEW_ISSUE_URL, 'https://github.com/palladius/carchess3d/issues/new');

  const hud = new HudListener();
  assert.equal(hud.appVersion, `v${APP_VERSION}`);
  assert.equal(hud.lang, 'en', 'Default language must be English for Nonna Susan');
  assert.equal(hud.t('startMatchBtn'), '🔄 New Match (Reset Board) ✨');

  hud.setLanguage('it');
  assert.equal(hud.lang, 'it');
  assert.equal(hud.t('startMatchBtn'), '🔄 Nuova Partita (Reset Pezzi) ✨');

  hud.setLanguage('en');
  assert.equal(hud.lang, 'en');
  assert.equal(hud.t('startMatchBtn'), '🔄 New Match (Reset Board) ✨');
});

test('Mobile Simplified UX: detects Pixel 10 & phones while leaving iPad/Desktop untouched, starts in Alto-Basso (Top-Down) with Guest vs CPU, and unlocks 3D on first capture', () => {
  // 1. Viewport detection: Pixel 10 portrait (412x915) & landscape (915x412) -> true
  assert.equal(isMobilePhoneViewport({ width: 412, height: 915 }), true, 'Pixel 10 portrait is mobile phone');
  assert.equal(isMobilePhoneViewport({ width: 915, height: 412 }), true, 'Pixel 10 landscape is mobile phone');
  assert.equal(isPortraitOrientation({ width: 412, height: 915 }), true, '412x915 is portrait');
  assert.equal(isPortraitOrientation({ width: 915, height: 412 }), false, '915x412 is landscape');

  // iPad (768x1024) and Desktop (1440x900) must NOT trigger mobile phone mode
  assert.equal(isMobilePhoneViewport({ width: 768, height: 1024 }), false, 'iPad portrait must keep full desktop UX');
  assert.equal(isMobilePhoneViewport({ width: 1024, height: 768 }), false, 'iPad landscape must keep full desktop UX');
  assert.equal(isMobilePhoneViewport({ width: 1440, height: 900 }), false, 'Desktop must keep full desktop UX');

  // Query string overrides (?mobile=1 / ?desktop=1)
  assert.equal(isMobilePhoneViewport({ width: 1440, height: 900, search: '?mobile=1' }), true);
  assert.equal(isMobilePhoneViewport({ width: 412, height: 915, search: '?desktop=1' }), false);

  // 2. Desktop HudListener remains 100% unchanged
  const desktopHud = new HudListener({ isMobilePhone: false });
  assert.equal(desktopHud.isMobilePhone, false);
  assert.equal(desktopHud.activeProfile, 'ale');
  assert.equal(desktopHud.topDownCamera, false);
  assert.equal(desktopHud.topbarVisible, true);

  // 3. Mobile HudListener: starts with Guest ('ospite'), Top-Down ('Alto-Basso'), and unlocks 3D on first capture
  const bus = new GameEventBus();
  const cameraEvents = [];
  bus.on('CAMERA_VIEW_REQUESTED', (e) => cameraEvents.push(e));

  const mobileHud = new HudListener({ bus, isMobilePhone: true, lang: 'it' });
  assert.equal(mobileHud.isMobilePhone, true);
  assert.equal(mobileHud.activeProfile, 'ospite', 'Mobile defaults to Guest profile');
  assert.equal(mobileHud.topDownCamera, true, 'Mobile starts in easy Top-Down (Alto-Basso) view');
  assert.equal(mobileHud.mobileAwaitingFirstAttack3D, true);
  assert.equal(mobileHud.topbarVisible, false);

  // 1-tap Quick Play configures Guest (Carlesso) vs CPU (Classic)
  mobileHud.startMobileQuickMatch();
  assert.equal(mobileHud.whiteFamily, 'carlesso');
  assert.equal(mobileHud.rivalSet, 'classic');
  assert.equal(mobileHud.activeProfile, 'ospite');
  assert.equal(mobileHud.blackPlayerType, 'ai');
  assert.equal(mobileHud.topDownCamera, true);

  // First capture triggers BATTLE_STARTED -> automatically unlocks 3D camera pose!
  bus.emit({ type: 'BATTLE_STARTED', attacker: 'b', defender: 'n', square: 'e5' });
  bus.flush();
  bus.flush();

  assert.equal(mobileHud.topDownCamera, false, 'First attack transitions mobile camera from Alto-Basso to 3D');
  assert.equal(mobileHud.mobileAwaitingFirstAttack3D, false);
  assert.ok(
    cameraEvents.some((e) => e.view === 'default' && e.pos?.y === 7.2 && e.pos?.z === 9.8),
    'Emits CAMERA_VIEW_REQUESTED with 3D pose during first battle so VFXPoolView restores to 3D',
  );

  bus.emit({ type: 'BATTLE_COMPLETED' });
  bus.flush();
  assert.ok(mobileHud.lastToast.includes('3D'), 'Shows 3D unlocked toast when first battle finishes');

  // 4. Zero-Split-Brain Version Check: remote VERSION never overwrites running code's appVersion
  const hud = new HudListener({ isMobilePhone: false });
  const runningVersion = hud.appVersion;
  assert.equal(hud.handleRemoteVersionCheck(runningVersion), false, 'Same version returns false (no drift)');
  assert.equal(hud.appVersion, runningVersion);
  assert.equal(hud.remoteAvailableVersion, null);

  assert.equal(hud.handleRemoteVersionCheck('9.9.99'), true, 'Different remote version triggers drift detection');
  assert.equal(hud.appVersion, runningVersion, 'Never fakes appVersion with remote VERSION (prevents split-brain badge)');
  assert.equal(hud.remoteAvailableVersion, 'v9.9.99', 'Tracks newer available remote version separately');
});

test("Issue #29: 'Reset view' camera button and hotkey 'R' restores default 3D camera pose", () => {
  const bus = new GameEventBus();
  const cameraEvents = [];
  bus.on('CAMERA_VIEW_REQUESTED', (e) => cameraEvents.push(e));

  const camera = {
    position: {
      x: 99,
      y: 99,
      z: 99,
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    },
  };
  const controls = {
    target: {
      x: 5,
      y: 5,
      z: 5,
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    },
    update() {},
  };

  const hud = new HudListener({ bus, camera, controls, lang: 'en' });
  // Move into top-down mode
  hud.topDownCamera = true;

  // Trigger resetCameraView()
  hud.resetCameraView();

  assert.equal(hud.topDownCamera, false, 'topDownCamera reset to false');
  assert.equal(camera.position.x, 0);
  assert.equal(camera.position.y, 5.85);
  assert.equal(camera.position.z, 12.6);
  assert.equal(controls.target.x, 0);
  assert.equal(controls.target.y, 2.15);
  assert.equal(controls.target.z, -2.2);
  assert.ok(
    cameraEvents.some((e) => e.view === 'reset'),
    'Emits CAMERA_VIEW_REQUESTED with view: reset',
  );

  // Test hotkey 'r' / 'R' via onKeyDown
  camera.position.set(42, 42, 42);
  let prevented = false;
  hud.onKeyDown({
    key: 'r',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(camera.position.y, 5.85);
  assert.equal(camera.position.z, 12.6);
});

test('Mouse Wheel Zoom Default & Modifiers: applyWheelZoomOrOrbit zooms in/out by default on mouse wheel, pans on Shift+wheel, and rotates on Alt+wheel or trackpadTwoFingerRotate=true', () => {
  const createMockControls = (trackpadTwoFingerRotate = false) => {
    const calls = [];
    return {
      calls,
      trackpadTwoFingerRotate,
      enableZoom: true,
      enablePan: true,
      enableRotate: true,
      rotateSpeed: 1.0,
      domElement: { clientHeight: 800 },
      _getZoomScale(delta) {
        return Math.pow(0.95, Math.abs(delta * 0.01));
      },
      _dollyIn(scale) {
        calls.push({ fn: '_dollyIn', scale });
      },
      _dollyOut(scale) {
        calls.push({ fn: '_dollyOut', scale });
      },
      _pan(dx, dy) {
        calls.push({ fn: '_pan', dx, dy });
      },
      _rotateLeft(angle) {
        calls.push({ fn: '_rotateLeft', angle });
      },
      _rotateUp(angle) {
        calls.push({ fn: '_rotateUp', angle });
      },
      update() {
        calls.push({ fn: 'update' });
      },
    };
  };

  // 1. Default (trackpadTwoFingerRotate = false): Wheel Up (deltaY < 0) -> Zoom IN (_dollyIn)
  const ctrl = createMockControls(false);
  const resIn = applyWheelZoomOrOrbit(ctrl, { deltaY: -100, deltaX: 0, deltaMode: 0 });
  assert.equal(resIn, 'zoom', 'Wheel scroll up must zoom in by default');
  assert.equal(ctrl.calls[0].fn, '_dollyIn');
  assert.equal(ctrl.calls[1].fn, 'update');

  // 2. Default (trackpadTwoFingerRotate = false): Wheel Down (deltaY > 0) -> Zoom OUT (_dollyOut)
  ctrl.calls.length = 0;
  const resOut = applyWheelZoomOrOrbit(ctrl, { deltaY: 100, deltaX: 0, deltaMode: 0 });
  assert.equal(resOut, 'zoom', 'Wheel scroll down must zoom out by default');
  assert.equal(ctrl.calls[0].fn, '_dollyOut');
  assert.equal(ctrl.calls[1].fn, 'update');

  // 3. Shift + Wheel -> Pan camera target
  ctrl.calls.length = 0;
  const resPan = applyWheelZoomOrOrbit(ctrl, {
    deltaY: 80,
    deltaX: 20,
    deltaMode: 0,
    shiftKey: true,
  });
  assert.equal(resPan, 'pan', 'Shift + wheel must pan camera');
  assert.equal(ctrl.calls[0].fn, '_pan');

  // 4. Alt + Wheel -> Orbit / Rotate camera even when default is zoom
  ctrl.calls.length = 0;
  const resAltRotate = applyWheelZoomOrOrbit(ctrl, {
    deltaY: 60,
    deltaX: 0,
    deltaMode: 0,
    altKey: true,
  });
  assert.equal(resAltRotate, 'rotate', 'Alt + wheel must rotate camera');
  assert.ok(ctrl.calls.some((c) => c.fn === '_rotateUp'));

  // 5. Legacy opt-in (trackpadTwoFingerRotate = true): plain wheel rotates, Ctrl/Cmd+wheel still zooms
  const ctrlRotate = createMockControls(true);
  const resTrackpadRot = applyWheelZoomOrOrbit(ctrlRotate, {
    deltaY: 60,
    deltaX: 30,
    deltaMode: 0,
  });
  assert.equal(resTrackpadRot, 'rotate', 'When trackpadTwoFingerRotate=true, plain wheel rotates');
  ctrlRotate.calls.length = 0;
  const resCtrlZoom = applyWheelZoomOrOrbit(ctrlRotate, {
    deltaY: -100,
    deltaX: 0,
    deltaMode: 0,
    ctrlKey: true,
  });
  assert.equal(resCtrlZoom, 'zoom', 'Ctrl/Cmd + wheel always zooms even in trackpad rotate mode');
  assert.equal(ctrlRotate.calls[0].fn, '_dollyIn');
});

test("Help & Shortcuts Modal: hotkeys 'h', 'H', and '?' toggle Help modal, Escape closes it, and 'v'/'f'/'c' hotkeys trigger camera & clarity actions", () => {
  const bus = new GameEventBus();
  const hud = new HudListener({ bus, isMobilePhone: false, lang: 'it' });
  assert.equal(hud.helpModalOpen, false, 'Help modal starts closed');

  // Press 'h' -> opens help modal
  let prevented = false;
  hud.onKeyDown({
    key: 'h',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(hud.helpModalOpen, true, "'h' opens Help modal");

  // Press '?' -> closes help modal (toggle)
  hud.onKeyDown({
    key: '?',
    preventDefault() {},
  });
  assert.equal(hud.helpModalOpen, false, "'?' toggles Help modal closed");

  // Press '?' again -> opens help modal, then Escape closes it
  hud.onKeyDown({
    key: '?',
    preventDefault() {},
  });
  assert.equal(hud.helpModalOpen, true);
  hud.onKeyDown({
    key: 'Escape',
    code: 'Escape',
    preventDefault() {},
  });
  assert.equal(hud.helpModalOpen, false, 'Escape closes Help modal');

  // Typing 'h' or '?' inside an <input> must NOT toggle the Help modal
  hud.onKeyDown({
    key: 'h',
    target: { tagName: 'INPUT' },
    preventDefault() {},
  });
  assert.equal(hud.helpModalOpen, false, 'Typing in input must not trigger hotkey');

  // Bilingual Help body rendering contains key shortcuts
  const htmlIt = hud._renderHelpModalBodyHtml();
  assert.ok(htmlIt.includes('Rotella'), 'Italian help mentions mouse wheel zoom');
  assert.ok(htmlIt.includes('H / ?'), 'Italian help mentions H / ? shortcut');

  hud.setLanguage('en');
  const htmlEn = hud._renderHelpModalBodyHtml();
  assert.ok(htmlEn.includes('Mouse Wheel'), 'English help mentions mouse wheel zoom');
  assert.ok(htmlEn.includes('Left-Click + Drag'), 'English help mentions left-click drag orbit');

  // Verify 'v' toggles topDownCamera and 'f' toggles cameraFlipped
  assert.equal(hud.topDownCamera, false);
  hud.onKeyDown({ key: 'v', preventDefault() {} });
  assert.equal(hud.topDownCamera, true, "'v' toggles top-down 2D camera");
  hud.onKeyDown({ key: 'f', preventDefault() {} });
  assert.equal(hud.cameraFlipped, true, "'f' flips camera perspective");
});

test('HudListener: New Game confirmation modal guards against accidental board reset (#hud-new-btn -> requestNewGame -> cancel/confirm)', () => {
  const bus = new GameEventBus();
  let boardResets = 0;
  const board = {
    reset() {
      boardResets++;
      bus.emit({ type: 'BOARD_RESET', turn: 'w' });
    },
  };
  const hud = new HudListener({ bus, board, isMobilePhone: false, lang: 'it' });

  assert.equal(hud.confirmNewModalOpen, false, 'Confirmation modal starts closed');

  // 1. Clicking "🔄 Nuova" calls requestNewGame(), which opens modal and does NOT reset the board
  hud.requestNewGame();
  bus.flush();
  assert.equal(hud.confirmNewModalOpen, true, 'requestNewGame() must open confirmation modal');
  assert.equal(boardResets, 0, 'requestNewGame() must NOT reset the board before user confirms');

  // 2. Pressing Escape cancels the modal without resetting the board
  hud.onKeyDown({ key: 'Escape', code: 'Escape', preventDefault() {} });
  bus.flush();
  assert.equal(hud.confirmNewModalOpen, false, 'Escape closes confirmation modal');
  assert.equal(boardResets, 0, 'Cancelling confirmation modal must NOT reset the board');

  // 3. Re-open confirmation modal and confirm with Enter (or confirmNewGame()) -> resets board
  hud.requestNewGame();
  assert.equal(hud.confirmNewModalOpen, true);
  hud.onKeyDown({ key: 'Enter', code: 'Enter', preventDefault() {} });
  bus.flush();
  assert.equal(hud.confirmNewModalOpen, false, 'Confirming closes the modal');
  assert.equal(boardResets, 1, 'Confirming calls board.reset()');
});

test('HudListener & VFXPoolView: Solid Ruby-Marble d20 replaces 0/12 luck bar, rolls on hotkey D and capture', () => {
  const bus = new GameEventBus();
  const hud = new HudListener({ bus, isMobilePhone: false, lang: 'it' });

  const rollRequests = [];
  bus.on('D20_ROLL_REQUESTED', (e) => rollRequests.push(e));

  // Pressing 'd' triggers rollRubyD20() -> emits D20_ROLL_REQUESTED
  let prevented = false;
  hud.onKeyDown({
    key: 'd',
    preventDefault() {
      prevented = true;
    },
  });
  bus.flush();
  assert.equal(prevented, true, "Hotkey 'd' prevents default");
  assert.equal(rollRequests.length, 1, "Hotkey 'd' emits D20_ROLL_REQUESTED");
  assert.equal(rollRequests[0].playerId, 'w');

  // Receiving D20_ROLLED updates hud.lastD20Roll
  hud.onD20Rolled({ playerId: 'w', d20Roll: 20 });
  assert.equal(hud.lastD20Roll, 20, 'onD20Rolled updates lastD20Roll to 20');

  // Verify VFXPoolView.js contains the 3D Solid Ruby-Marble Icosahedron d20 implementation
  const vfxSrc = readFileSync(new URL('../src/views/VFXPoolView.js', import.meta.url), 'utf8');
  assert.ok(
    vfxSrc.includes('createRubyMarbleD20Prop') &&
      vfxSrc.includes('IcosahedronGeometry') &&
      vfxSrc.includes('triggerRubyD20Roll'),
    'VFXPoolView.js must implement 3D Ruby-Marble Icosahedron d20 prop and tumble animation',
  );
});





