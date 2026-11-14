---
name: antigravity-glb-viewer
description: >-
  (💛) Interactive 3D Turntable GLB/GLTF Viewer UI Sidecar for Google Antigravity's
  right-hand Aux Pane (file_extensions: [".glb", ".gltf"]). Replaces raw binary glTF
  streams with a 60 FPS Three.js studio turntable spinning in 360° auto-rotation like
  an animated GIF, complete with giant Prev/Next folder navigation buttons, speed
  controls, wireframe topology overlay, skeletal animation playback, 1-click PNG
  clipboard snapshot, and Chat context injection.
compatibility: Antigravity, Gemini CLI
metadata:
  version: 0.1.0
  tags: antigravity_sidecar, glb, gltf, 3d, threejs, turntable, utility
---
# Antigravity Inline GLB 3D Turntable Viewer Sidecar (`antigravity-glb-viewer`)

## Problem Solved
By default, clicking a `[model.glb](file:///path/to/model.glb)` link in Google Antigravity opens the raw binary `glTF` stream as garbled text in the right-hand `fileView` pane.

Just like `antigravity-pdf-viewer` intercepts `.pdf` files, `antigravity-glb-viewer` registers `"entrypoint": "SIDECAR_UI_ENTRYPOINT_AUX_PANE"` and `"file_extensions": [".glb", ".gltf"]` in its `sidecar.json` so clicking any `.glb` or `.gltf` file opens an interactive **360° Auto-Rotating 3D Turntable** (spinning continuously like an animated GIF!).

---

## Bundled Files (`$SKILL_DIR/scripts/`)
All files are 100% self-contained inside `$SKILL_DIR/scripts/` (with zero external CDN or NPM runtime dependencies):
- `$SKILL_DIR/scripts/main.mjs`: Complete Node.js `sidecar_sdk` server + Three.js WebGL 3D Turntable Aux Pane UI + binary GLB JSON header parser.
- `$SKILL_DIR/scripts/sidecar.json`: Antigravity UI Sidecar manifest registering `file_extensions: [".glb", ".gltf"]`.
- `$SKILL_DIR/scripts/vendor/`: Vendored Three.js ES modules (`three.module.js`, `OrbitControls.js`, `GLTFLoader.js`, `BufferGeometryUtils.js`) for 100% offline execution.
- `$SKILL_DIR/scripts/install_glb_sidecar.sh`: Installer script that hardlinks `main.mjs`, `sidecar.json`, and `vendor/*.js` into `~/.gemini/config/sidecars/glb-viewer/`.

---

## Features
- **Automatic `.glb` & `.gltf` Interception:** Clicking any `[*.glb](file:///...)` link in chat or the file explorer opens the 3D model in the right-hand Aux Pane.
- **🔄 360° Auto-Rotate like an Animated GIF:** Starts immediately in continuous 360° turntable rotation (`OrbitControls.autoRotate = true`) with a live `AUTO-ROTATE GIF` badge, speed presets (`1x`, `2x`, `4x`, `0.5x`, `-1x`), and `Space` key pause/play.
- **2 Giant Prev/Next Folder Navigation Buttons (`◀ Prev` / `▶ Next`):** Automatically scans the parent folder for all sibling `.glb`/`.gltf` files so you can flip through an entire `assets/models/` directory with the side buttons, top dropdown, or `⬅️` / `➡️` keyboard arrows!
- **🕸️ Wireframe & Decimation Inspector (`W`):** Cycle between `Solid`, `Wireframe Overlay` (cyan topology lines over lit materials), and `Pure Wireframe`, with live Triangle / Vertex / Mesh / Bone counters in the HUD.
- **🎬 Embedded Animation Playback:** Automatically detects and plays embedded `gltf.animations` clips via `THREE.AnimationMixer`.
- **📸 1-Click Copy PNG & 💬 Send to Chat:** Copy a crisp high-DPI PNG render directly to the clipboard or inject the `.glb` path and polygon stats into the active Antigravity conversation.

---

## Installation & Activation

Run the bundled installer script from `$SKILL_DIR`:

```bash
bash "$SKILL_DIR/scripts/install_glb_sidecar.sh"
```
