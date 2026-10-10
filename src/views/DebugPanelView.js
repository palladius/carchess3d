/**
 * @fileoverview Art Director's Seat Live Control Panel (`?debug=1`).
 *
 * Provides live on-screen sliders for:
 * - Sun / Moonlight elevation & intensity
 * - Brazier intensity & warmth
 * - UnrealBloomPass strength & threshold
 * - Enchanted Swamp water roughness
 * - Camera FOV, distance, and canonical 4-angle Critic presets
 * - Piece global scale & wireframe collision inspection toggle
 */

export class DebugPanelView {
  /**
   * @param {object} deps
   * @param {any} deps.swampView
   * @param {any} deps.pieceView
   * @param {any} deps.bloomPass
   * @param {any} deps.camera
   * @param {any} deps.controls
   * @param {any} deps.scene
   */
  constructor(deps = {}) {
    this.deps = deps;
    this.state = {
      sunIntensity: 2.2,
      brazierIntensity: 3.4,
      brazierWarmth: 0xff8f24,
      bloomStrength: 0.42,
      bloomThreshold: 0.78,
      waterRoughness: 0.14,
      cameraFov: 42,
      cameraDist: 12.2,
      pieceScale: 1.0,
      wireframe: false,
    };
    this.container = null;
  }

  init() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const enabled = params.get('debug') === '1' || params.get('artdirector') === '1';

    this.buildDom(enabled);

    // Support URL camera preset (`?cam=overview|closeup|lowangle|wireframe`) for automated 4-angle critic!
    const camPreset = params.get('cam');
    if (camPreset) {
      this.applyCameraPreset(camPreset);
    }
    if (params.get('wireframe') === '1') {
      this.setWireframe(true);
    }
  }

  buildDom(visibleByDefault) {
    const panel = document.createElement('aside');
    panel.id = 'art-director-panel';
    panel.style.cssText = `
      position: fixed;
      top: 74px;
      right: 14px;
      width: 290px;
      max-height: calc(100vh - 96px);
      overflow-y: auto;
      background: rgba(14, 18, 28, 0.92);
      border: 1.5px solid #e6b84a;
      border-radius: 14px;
      padding: 12px 14px;
      color: #f3ebd9;
      font: 12px/1.4 system-ui, -apple-system, sans-serif;
      z-index: 950;
      box-shadow: 0 12px 32px rgba(0,0,0,0.65);
      backdrop-filter: blur(10px);
      display: ${visibleByDefault ? 'block' : 'none'};
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid rgba(230,184,74,0.3);padding-bottom:6px;">
        <strong style="color:#ffe082;font-size:13px;">🎨 Art Director (?debug=1)</strong>
        <button id="ad-close-btn" style="background:none;border:none;color:#9aa3b5;cursor:pointer;font-size:14px;">✕</button>
      </div>
      <div style="display:grid;gap:7px;">
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>☀️ Luce Lunare/Sole</span>
          <input id="ad-sun" type="range" min="0.2" max="5.0" step="0.1" value="${this.state.sunIntensity}" style="width:120px;">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>🔥 Intensità Bracieri</span>
          <input id="ad-brazier" type="range" min="0.2" max="8.0" step="0.2" value="${this.state.brazierIntensity}" style="width:120px;">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>🎨 Calore Bracieri</span>
          <input id="ad-warmth" type="color" value="#ff8f24" style="width:60px;height:22px;border:none;background:none;">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>✨ Forza Bloom</span>
          <input id="ad-bloom-str" type="range" min="0" max="1.5" step="0.02" value="${this.state.bloomStrength}" style="width:120px;">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>🌟 Soglia Bloom</span>
          <input id="ad-bloom-thr" type="range" min="0.1" max="1.0" step="0.02" value="${this.state.bloomThreshold}" style="width:120px;">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>🐸 Rugosità Palude</span>
          <input id="ad-water" type="range" min="0.02" max="0.8" step="0.02" value="${this.state.waterRoughness}" style="width:120px;">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>📷 Camera FOV (°)</span>
          <input id="ad-fov" type="range" min="24" max="70" step="1" value="${this.state.cameraFov}" style="width:120px;">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>📏 Distanza Camera</span>
          <input id="ad-dist" type="range" min="5" max="22" step="0.5" value="${this.state.cameraDist}" style="width:120px;">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>♟️ Scala Pezzi 3D</span>
          <input id="ad-scale" type="range" min="0.7" max="1.35" step="0.05" value="${this.state.pieceScale}" style="width:120px;">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;">
          <span>🕸️ Vista Wireframe</span>
          <input id="ad-wire" type="checkbox">
        </label>
      </div>
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(230,184,74,0.25);">
        <div style="color:#9aa3b5;font-size:11px;margin-bottom:5px;">📸 4 Viste Canoniche Critic:</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">
          <button data-cam="overview" style="padding:4px 6px;border-radius:6px;border:1px solid #3a4559;background:#1b2232;color:#ffe082;cursor:pointer;font-size:11px;">1. 3/4 Overview</button>
          <button data-cam="closeup" style="padding:4px 6px;border-radius:6px;border:1px solid #3a4559;background:#1b2232;color:#ffe082;cursor:pointer;font-size:11px;">2. Close-Up</button>
          <button data-cam="lowangle" style="padding:4px 6px;border-radius:6px;border:1px solid #3a4559;background:#1b2232;color:#ffe082;cursor:pointer;font-size:11px;">3. Low-Angle y=0</button>
          <button data-cam="wireframe" style="padding:4px 6px;border-radius:6px;border:1px solid #3a4559;background:#1b2232;color:#ffe082;cursor:pointer;font-size:11px;">4. Wireframe</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.container = panel;

    const bind = (id, evt, fn) => panel.querySelector(id)?.addEventListener(evt, fn);
    bind('#ad-close-btn', 'click', () => { panel.style.display = 'none'; });
    bind('#ad-sun', 'input', (e) => {
      this.state.sunIntensity = parseFloat(e.target.value);
      this.syncToScene();
    });
    bind('#ad-brazier', 'input', (e) => {
      this.state.brazierIntensity = parseFloat(e.target.value);
      this.syncToScene();
    });
    bind('#ad-warmth', 'input', (e) => {
      this.state.brazierWarmth = parseInt(e.target.value.replace('#', ''), 16);
      this.syncToScene();
    });
    bind('#ad-bloom-str', 'input', (e) => {
      this.state.bloomStrength = parseFloat(e.target.value);
      if (this.deps.bloomPass) this.deps.bloomPass.strength = this.state.bloomStrength;
    });
    bind('#ad-bloom-thr', 'input', (e) => {
      this.state.bloomThreshold = parseFloat(e.target.value);
      if (this.deps.bloomPass) this.deps.bloomPass.threshold = this.state.bloomThreshold;
    });
    bind('#ad-water', 'input', (e) => {
      this.state.waterRoughness = parseFloat(e.target.value);
      this.syncToScene();
    });
    bind('#ad-fov', 'input', (e) => {
      this.state.cameraFov = parseFloat(e.target.value);
      if (this.deps.camera) {
        this.deps.camera.fov = this.state.cameraFov;
        this.deps.camera.updateProjectionMatrix();
      }
    });
    bind('#ad-dist', 'input', (e) => {
      this.state.cameraDist = parseFloat(e.target.value);
      if (this.deps.camera && this.deps.controls) {
        const dir = this.deps.camera.position.clone().sub(this.deps.controls.target).normalize();
        this.deps.camera.position.copy(this.deps.controls.target).addScaledVector(dir, this.state.cameraDist);
        this.deps.controls.update();
      }
    });
    bind('#ad-scale', 'input', (e) => {
      this.state.pieceScale = parseFloat(e.target.value);
      this.deps.pieceView?.setPieceScale?.(this.state.pieceScale);
    });
    bind('#ad-wire', 'change', (e) => {
      this.setWireframe(Boolean(e.target.checked));
    });

    panel.querySelectorAll('button[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => this.applyCameraPreset(btn.dataset.cam));
    });
  }

  syncToScene() {
    this.deps.swampView?.applyDebugParams?.({
      sunIntensity: this.state.sunIntensity,
      brazierIntensity: this.state.brazierIntensity,
      brazierWarmth: this.state.brazierWarmth,
      waterRoughness: this.state.waterRoughness,
    });
  }

  setWireframe(enabled) {
    this.state.wireframe = enabled;
    const wireCheckbox = this.container?.querySelector('#ad-wire');
    if (wireCheckbox) wireCheckbox.checked = enabled;
    if (!this.deps.scene) return;
    this.deps.scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if ('wireframe' in m) m.wireframe = enabled;
        }
      }
    });
  }

  /**
   * Moves the camera to one of the 4 canonical Adversarial Critic diagnostic angles:
   * - `overview`: 3/4 overview showing board, 32 pieces, Swamp, Grossmünster & 16:9 Cinema Mirror
   * - `closeup`: Close-up on White home rank (Ale Bishop, Puffin Pawn, Riccardo, Kate pedestals & medallions)
   * - `lowangle`: Low-angle grazing view along `y = 0` checking all 32 pieces & braziers sit cleanly on ground
   * - `wireframe`: 3/4 geometry & bounding-box collision inspection with wireframe enabled
   */
  applyCameraPreset(preset) {
    const cam = this.deps.camera;
    const ctrl = this.deps.controls;
    if (!cam || !ctrl) return;

    this.setWireframe(preset === 'wireframe');

    if (preset === 'overview') {
      cam.fov = 42;
      cam.position.set(0.0, 6.8, 10.6);
      ctrl.target.set(0.0, 1.35, -1.5);
    } else if (preset === 'closeup') {
      cam.fov = 35;
      cam.position.set(-1.35, 2.15, 5.45);
      ctrl.target.set(-0.5, 0.78, 2.8);
    } else if (preset === 'lowangle') {
      cam.fov = 36;
      cam.position.set(4.8, 0.62, 6.2);
      ctrl.target.set(0.0, 0.52, 1.5);
    } else if (preset === 'wireframe') {
      cam.fov = 40;
      cam.position.set(5.4, 5.6, 7.8);
      ctrl.target.set(0.0, 0.8, 0.0);
    }
    cam.updateProjectionMatrix();
    ctrl.update();
  }

  toggle() {
    if (!this.container) return;
    this.container.style.display = this.container.style.display === 'none' ? 'block' : 'none';
  }
}
