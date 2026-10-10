# Technology Stack: CarChess3D

> **Forged with Argon** ✨ — Zero-Build Offline PWA & Generative 3D/Video Pipeline Stack (Argon Edition).

## 1. Frontend & 3D Web Application (Runtime)

- **Architecture:** Vanilla ES Modules (`<script type="module">` + `importmap`), **zero build step**, static file serving (`just serve` / `python3 -m http.server`).
- **3D Rendering Engine:** **Three.js** (vendored locally in `vendor/three/` for 100% offline execution):
  - `GLTFLoader` for loading TRELLIS-generated `.glb` character meshes.
  - `OrbitControls` for smooth mouse/touch camera rotation, zoom, and scripted capture-orbit choreography.
  - `EffectComposer` + `RenderPass` + `UnrealBloomPass` for warm brazier glow, magic runes, and crystal shatter bloom.
  - `MeshPhysicalMaterial` (transmission/iridescence for Ale's amethyst/ruby crystals and Kate's glossy chocolate) & `VideoTexture` for the **16:9 3D Veo Cinema Screen**.
- **Chess Rules Engine:** **chess.js** (vendored locally in `vendor/chess.js`), wrapped in a pure, WebGL-independent `src/rules/` module for fast unit testing.
- **CPU AI Engine:** **Web Worker (`src/ai/worker.js`)** so the UI and 3D animations never block:
  - *Easy:* Random legal move weighted heavily toward captures (maximizes battle animations for kids!).
  - *Medium:* Minimax (depth 2) with material evaluation.
  - *Hard:* Alpha-Beta pruning with iterative deepening (depth ~4, <1.5s budget), move ordering (MVV-LVA), and piece-square tables.
- **Audio Engine:**
  - **Lyria 3 (`musicgen-lyria3`)** pre-generated MP3 theme songs in `assets/audio/` (*"Ale & Seby, Eroi della Scacchiera"* IT 🇮🇹 & *"Ale & Seby, Heroes of the Board"* EN 🇬🇧).
  - **WebAudio API Synthesizer (`src/audio/`)** for zero-dependency procedural sound effects and chiptune/orchestral fallback music.
- **Offline & Mobile Delivery:**
  - **Progressive Web App (PWA):** `manifest.webmanifest` + Service Worker (`sw.js`) precaching all HTML/CSS/JS, `.glb` models, character portraits, audio, and available battle videos for full airplane-mode play on Android and desktop.
  - **Persistence:** `localStorage` per-profile autosave + FEN/PGN import/export.

## 2. Offline Generative Asset Pipelines (`tools/`)

All generative AI pipelines run offline during development via Python (`uv` with `UV_INDEX_URL="https://pypi.org/simple"`) and commit their static outputs into `assets/`:

1. **2D Multi-View Character Pipeline (`tools/model-pipeline/nbviews/`):**
   - **Nano Banana Pro / 2.1 (`google-genai` SDK):** Generates consistent `front`, `back`, and `side` views from canonical character sheets in `assets/characters/`.
2. **Image → 3D Mesh Pipeline (`tools/model-pipeline/`):**
   - **TRELLIS Multi-Image (`gradio_client` on HF ZeroGPU, `/lambda_1` enabled):** Converts `front + side + back` views into watertight textured `.glb` figurines in `assets/models/`.
   - **Geometry Critic (`critic_geo.py` / `trimesh`):** Checks face budgets, degenerate triangles, watertightness, and backdrop artifacts.
3. **Battle Composite & Veo 3D Cinema Pipeline (`tools/battle-pipeline/` & `assets/battles/manifest.yaml`):**
   - **Step 1 (Composite Keyframe):** Combines `attacker_img` + `defender_img` via Nano Banana into a dramatic 16:9 battle keyframe (`composite_img`).
   - **Step 2 (Veo Video Generation):** Animates the composite keyframe into a 2–4s 16:9 `.mp4` battle clip via **Veo (`veo_i2v` / `veo_ingredients_to_video`)** stored in `assets/battles/videos/`.
   - **Step 3 (Declarative MD5 Freshness Check):** `assets/battles/manifest.yaml` stores the MD5 hashes of `attacker_img`, `defender_img`, and `composite_img`. `scripts/check.py` (`just test`) verifies every hash and flags any battle whose input image changed so stale videos are immediately detected.

## 3. Quality Assurance & Task Runner

- **Task Runner:** `justfile` (`just list`, `just test`, `just serve`, `just trellis`, `just nb-views`, `just battle-video`).
- **Automated Verification (`scripts/check.py`):** Stdlib-only Python suite checking `.glb` binary headers, character asset naming, secret/path hygiene, and `assets/battles/manifest.yaml` MD5 freshness, plus Node/Python unit tests for the chess rules and AI worker.
