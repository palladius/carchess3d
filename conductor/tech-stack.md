# Technology Stack: CarChess3D

> **Forged with Argon** ✨ — Zero-Build Offline PWA, Niccolò Game Design Architecture & Multi-Agent 3D/Video Stack (Argon Edition).

## 1. Game Architecture (`niccolo-game-design` Skill)

All game code strictly follows [`.agents/skills/niccolo-game-design/SKILL.md`](../.agents/skills/niccolo-game-design/SKILL.md) (distilled from Niccolò's code-review feedback and Robert Nystrom's *Game Programming Patterns*):
- **7 Core Rules:**
  1. **One Manager = One Responsibility (≤ 300 LOC):** No God-object `GameManager` or 400-line `animate()` loop.
  2. **Top-Level Loop is Boring:** Fixed-timestep `update(STEP)` + `bus.flush()` + `lateUpdate(frameDt)` + `renderer.render()`.
  3. **Rules Live with the Data They Inspect:** `BoardMapManager` owns check, checkmate, stalemate, draw, and legal moves and emits `GAME_OVER` / `CHECKMATE`.
  4. **Talk via Typed Event Bus, Query via `GameContext`:** Deferred event queue (`emit()` enqueues, `flush()` delivers once per tick in past tense: `PIECE_SELECTED`, `MOVE_EXECUTED`, `PIECE_CAPTURED`, `CHECKMATE`, `FLOW_STATE_CHANGED`). Managers never call another manager's mutating methods directly.
  5. **Listeners, Not Callers:** `AudioListener`, `HudListener`, `ProfileStorageListener`, and `CinemaListener` subscribe to events. Gameplay code never calls `Sound.play()` or mutates DOM directly.
  6. **Headless Simulation Logic:** Core managers (`GameFlowManager`, `BoardMapManager`, `AIPlayerManager`) import zero DOM and zero Three.js modules — 100% unit-testable in Node/CLI. Visuals live in `*View` adapters (`BoardView`, `PieceView`, `ZurichSwampView`, `VeoCinemaView`).
  7. **Data-Driven Registries & Object Pools:** Attack signatures, victim reactions, and Easter Egg overrides (`Seby ↔ Pupurabbu`) live in declarative lookup tables (`BATTLE_MATRIX[attacker][defender]`), not `if/else` ladders. Debris shards, toy cars, and particles use pre-allocated **Object Pools** (`VFXPoolManager`).

### Canonical CarChess3D Managers
| Manager | Responsibility | Key Events Emitted |
|---|---|---|
| `GameFlowManager` | State machine: `Boot → Mode1_Chess ⇄ Mode2_WowArena → CaptureCutscene → Checkmate` | `FLOW_STATE_CHANGED` |
| `BoardMapManager` | Headless 8×8 rules wrapper (`chess.js`), legal moves, check/mate/draw detection | `PIECE_SELECTED`, `MOVE_EXECUTED`, `PIECE_CAPTURED`, `CHECK_DETECTED`, `CHECKMATE`, `DRAW` |
| `PieceManager` | Tracks 32 piece entities, GLB cache (`bishop-ale-rigged.glb`, `pawn-puffin.glb`), skeletal animation clips (`Idle`, `Click_Fire_Breath`), procedural pedestal + 2D medallion fallback | `PIECE_MODEL_READY`, `PIECE_ANIM_FINISHED` |
| `CombatAnimationManager` | Resolves `(attacker, defender)` in the 6×6 + Easter Egg registry, orchestrates foreground 3D clash + background 16:9 Veo Cinema + orbiting camera | `BATTLE_STARTED`, `BATTLE_SKIPPED`, `BATTLE_COMPLETED` |
| `VFXPoolManager` | Object-pooled particles, amethyst/ruby shards, toy cars, chocolate droplets, stone shrapnel | — |
| `AIWorkerManager` | Bridges the non-blocking Web Worker CPU (*Easy / Medium / Hard*) to the Event Bus | `AI_THINKING`, `AI_MOVE_READY` |

## 2. Frontend & 3D Web Application (Runtime)

- **Runtime:** Vanilla ES Modules (`<script type="module">` + `importmap`), **zero build step**, static file serving (`just serve` / `python3 -m http.server`).
- **3D Rendering Engine:** **Three.js** (vendored locally in `vendor/three/`):
  - `GLTFLoader` + `AnimationMixer` (supports skeletal animations like Ale's 26-bone dragon rig).
  - `OrbitControls` + scripted camera spline/orbit choreographer.
  - `EffectComposer` + `RenderPass` + `UnrealBloomPass`.
  - `MeshPhysicalMaterial` (crystal transmission) & `VideoTexture` (16:9 Veo 3D Cinema screen).
- **Audio Engine:**
  - **Lyria 3 (`musicgen-lyria3`)** bilingual MP3 theme songs (*"Ale & Seby, Eroi della Scacchiera"* IT 🇮🇹 & *"Ale & Seby, Heroes of the Board"* EN 🇬🇧).
  - **WebAudio API Synthesizer** (`AudioListener`) for procedural SFX and fallback music.
- **Offline PWA:** `manifest.webmanifest` + Service Worker (`sw.js`) precaching all assets for airplane-mode play on Android and desktop.

## 3. Offline Generative Asset Pipelines & Multi-Agent Harness

1. **2D Multi-View & 3D Mesh Pipeline (`tools/model-pipeline/`):**
   - **Nano Banana Pro / 2.1 (`nb_views.py`):** Multi-angle turnarounds (`front`, `side`, `back`, `threequarter`) + seamless surface textures.
   - **TRELLIS Multi-Image (`gen_mv.py` with `/lambda_1`):** Watertight textured `.glb` generation.
   - **Headless Blender Rigging & Sculpting (`/usr/bin/blender -b -P ...`):** Automated bone rigging, skinning, and animation baking (e.g. `bishop-ale-rigged.glb` with 26-bone dragon wing/jaw chains).
2. **Battle Composite & Veo 3D Cinema Pipeline (`assets/battles/manifest.yaml`):**
   - `attacker_img` + `defender_img` → Nano Banana 16:9 composite keyframe → Veo `.mp4` battle video.
   - Declarative MD5 hashes verified by `scripts/check.py` (`just test`) to detect stale battle videos whenever source character art changes.
3. **Autonomous Multi-Agent Harness & Adversarial Critics:**
   - **2D SVG Spatial Floorplan (`docs/floorplan.svg`):** Grounds exact meter coordinates of the 8×8 altar, braziers, 16:9 Cinema screen, and Zurich skyline before 3D placement.
   - **Headless 4-Angle Screenshot Harness & `progress.html`:** Captures `(1) 3/4 Overview`, `(2) Close-Up Materials`, `(3) Low-Angle Grounding Check (y=0)`, and `(4) Wireframe Collision Check` at every milestone.
   - **Live Art-Director Control Panel (`?debug=1`):** On-screen sliders for lighting, water/crystal shaders, and camera FOV.
   - **Dual Autonomous Gatekeepers (Functional Verifier + Adversarial Aesthetic Critic ≥ 9/10):** Subagents iterate autonomously until all unit tests, `niccolo-game-design` checks, `just test`, and the 4-angle visual critique pass ≥ 9/10 before waking the human user.
