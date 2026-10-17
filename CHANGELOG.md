# Changelog

## [0.3.64] - 2026-10-15

- 🎬💥 **Expansion of 36 Cinematic Combat Animations (Veo/Canvas 16:9 3-Act Structure)**:
  - Enhanced `VeoCinemaView.js` (`drawCinemaCinemaOverlay`) with a 3-act narrative overlay that preserves full visibility of foreground 3D combatants:
    - **Act 1 (0–1s / Pre-Padding)**: Attacker weapon banner card with sleek gold-trimmed glass backing (`⚔️ ATTO 1 · [Attacker] sfodera [Attacker Weapon]!`).
    - **Act 2 (Mid-Fight / Progress 28%–72%)**: Dynamic Defender Counter-Attack badge (`🛡️ ATTO 2 · DIFESA [Defender]`) featuring an animated tilted comic SFX pop-in pill (`CLANG!`, `WHOOSH!`, `BOING!`, `ZAP!`).
    - **Act 3 (Finale / Progress > 82%)**: Swamp K.O. finisher verdict card and bespoke Easter Egg visual flairs:
      - Radiant Golden Throne Aura with spinning crowns, lightning bolts, and amber radial vignette for `k_x_q` ("Carlesso al Cesso").
      - Swirling Purple/Pink Heart Storm for `n_x_r` ("Mega Cuddle").
    - **Sleek Scrubber**: Cinema Red (`#e50914`) progress hairline with glowing playhead dot along the bottom edge.
  - Synchronized `battles.html` with updated version `v0.3.64` and responsive 3D clash launchers.
- 🎭⚔️ **Complete 3D Modular Skin Variant System in HUD & Mode 2 WOW Inspector**:
  - **Knight Seby 4-Weapon Modular Switcher**: Integrated `classic` (Destriero d'Oro), `lightsaber` (Spada Laser radiosa), `halberd` (Alabarda Cavalleresca), and `aurora` (Sfera Acquario).
  - Integrated live selection into the HUD Game Setup modal (`#hud-setup-knight-variant`) and Mode 2 WOW Inspector interactive pill chips (`#hud-seby-variant-row`).
  - Added full i18n keys and bilingual translations (`it` and `en`) in `Registry.js`, `PieceManager.js`, `PieceView.js`, `WowModeView.js`, and `CharacterPovData.js`.
  - Maintained strict headless manager constraint: `PieceManager.js` stays $\le 300$ LOC (297 LOC, verified by `scripts/check.py`).
- 🎙️🎵 **Bilingual Voice Triggers & Procedural Audio Refinements**:
  - Replaced duplicate placeholder translations in `VOICE_LINES` with natural, authentic English translations for all characters.
  - Enhanced `AudioListener.js` speech synthesis fallback to dynamically match active session language (`this.lang === 'en'` passes `en-GB` for Queen Kate and `en-US` for others).
  - Validated with signal processing audio critic (`just audio-critic --all`) and unit tests (`tests/test_audio_quality.py`).
- 📏🏰 **Ricalibrazione Dimensioni Canoniche Familiari & Fix Raggio Base**:
  - Re Riccardo: **1.86m** (Papino).
  - Regina Kate: **1.68m** (Kate).
  - Alfiere Ale: **1.55m** (slanciato con mitria e draghetto).
  - Cavaliere Seby: **1.92m** (Seby a cavallo su un destriero maestoso: più alto di papà, con proporzioni espanse in altezza, larghezza e lunghezza).
  - Torre Pupurabbu: **2.25m** (imponente fortezza in pietra con Pupurabbu affacciato dai merli, tra 2.00m e 2.50m).
  - Pedone Puffin: **0.95m** (Guardia Svizzera).
  - Rimosso il vincolo artificiale `maxRadius: 0.36` in `PieceView.js` e `WowModeView.js`: ora cavallo e torre scalano alle loro reali dimensioni volumetriche senza essere schiacciati sul piano orizzontale.
  - Aggiornato diagramma metrico `docs/floorplan.svg` e test di grounding.

## [0.3.63] - 2026-10-14

- 🐸🎭 **Human-In-The-Loop Aesthetic Critique & Swamp Restoration**:
  - Based on user visual inspection of the Before/After showcase, reverted bulky extruded Mode A models for King (Orco), Bishop (Don Gatto), Knight (Asinello), Rook (Draghessa), and Pawn (Tappo) back to procedural watertight chibi 3D sculptures (`tools/model-pipeline/swamp/build_swamp_models.py`), restoring their true 3D proportions, chess lathe bases, and beloved details (cat rapier, 3D dragon coiled around stone tower, 40-tooth grin).
  - Preserved Mode A UV-textured mesh for Queen Orchessa (Fiona) which achieved high aesthetic fidelity.
  - Parked all Before/After comparisons, lineup cards, and 16:9 article hero banner under `article/assets/before_after/` and `article/SHOWCASE_BEFORE_AFTER.md`.
  - Added AGENTS.md / GEMINI.md mandate to automatically save notable visual showcases under `article/` for future technical articles.
- 🔀 Merged branch `generate_swamp_classic_models` (it was numbered 0.3.59; renumbered above main's 0.3.62).

## [0.3.62] - 2026-10-14

- 🎙️👦 **Authentic Male Boy Voice Synthesis & Soundboard Integration**:
  - Eliminated the adult female "anime dubbing actress" trope for young boys by benchmarking Gemini TTS (`Fenrir`, `Puck`) and dedicated neural models.
  - Mastered authentic young male child voices for:
    - **Seby (Knight `n`)**:
      - *"Hey Google, metti Scrivile Scemo dei Pinguini Tattici Nucleari su YouTube Music!"* (`voice-n-scrivilescemo.mp3`).
      - *"Hey Google, uccidi questo mostro per me!"* (`voice-n-uccidimostro.mp3`).
    - **Ale (Bishop `b`)**:
      - *"Mummy... I'm still hungry!"* (`voice-b-stillhungry.mp3`, English with sweet boy pleading tone).
      - *"Papino, tu sì che cucini bene!"* (`voice-b-cucinibene.mp3`, Italian affectionate dad cooking compliment).
  - Wired all lines into `src/core/CharacterPovData.js` soundboards, `src/core/Registry.js` voice line variants, and the Character POV showcase.
- 🧪🎧 **Automated Audio QA Critic Tool & Regression Test Suite**:
  - Built `tools/model-pipeline/critic/critic_audio.py` featuring:
    - Deterministic PCM acoustic envelope analysis (24kHz mono): peak level detection, digital clipping check (`peak >= -0.05 dBFS`), and trailing glitch/burst detector (detects anomalous energy rebounds after post-speech silence).
    - Multimodal LLM QA critic using `gemini-3.8-flash` with structured Pydantic schema (`LlmAudioCritique`) auditing word-for-word transcript, speaker persona (boy vs female anime dubber), naturalness score (1-10), and release cleanliness.
  - Added CLI command in `justfile`: `just audio-critic <file> [--llm] [--all]`.
  - Added automated test suite `tests/test_audio_quality.py` (integrated into `just test`):
    - Tests duration, volume headroom, clipping, and glitch-free envelopes for all target voice lines.
    - Added regression fixture `tests/fixtures/buggy_pinguini_defect.mp3` asserting that the detector specifically isolates the un-mastered trailing +62.6 dB pop/spike after silence in the Pinguini clip.
- 🎛️ **Audio Mastering & Glitch Removal**:
  - Fixed the trailing digital burst / inhale pop in the Pinguini Tattici Nucleari clip by applying precise speech endpoint truncation, smooth 140ms cosine fade-out, and broadcast-grade peak limiting (`alimiter=limit=-1.0dB`), achieving -1.36dB peak with 0.0 clipping and zero end defects.

## [0.3.61] - 2026-10-14

- 🐸✨ **Swamp 3D Mesh Solid Hull Refinement & Before/After Showcase**:
  - Refined Mode A reconstruction pipeline (`tools/model-pipeline/reconstruct_mode_a_batch.py`) with automatic aspect ratio detection (`aspect > 1.35` for 16:9 turnaround sheets vs 1:1 single portraits) and convex elliptical depth envelopes (`depth = 0.54 * width`), ensuring full solid watertight geometry without phantom gaps for all Swamp models.
  - Re-sculpted and updated 5 Swamp GLBs (`king-swamp-orco`, `queen-swamp-orchessa`, `bishop-swamp-focaccina`, `rook-swamp-draghessa`, `pawn-swamp-tappo`) with updated MD5 checksums in `docs/models-provenance.yaml`.
  - Generated Before/After visual comparison cards (2D concept vs procedural vs reconstructed 3D) and a 16:9 cinematic article hero banner.
- 🔀 Merged branch `generate_swamp_classic_models` (originally numbered 0.3.58, renumbered above main's 0.3.60). Also re-synced the `nocache.html` title, which was stuck at v0.3.57.

## [0.3.60] - 2026-10-14

- 👑♗ **Pillar 1: In-Game 3D Piece Variant Integration & Live HUD Switching**:
  - Registered declarative variant registries `QUEEN_GLB_VARIANTS` (`young` vs `wedding`) and `BISHOP_GLB_VARIANTS` (`hat` vs `astrolabe` vs `rigged`) in `src/core/Registry.js`.
  - Updated `PieceManager.js` with headless `setQueenVariant` and `setBishopVariant`, event bus reactions (`PIECE_VARIANT_REQUESTED`), and synchronized emission on `PIECE_SET_CHANGED` and `PIECES_SYNCED` (strictly <= 300 LOC Niccolò contract).
  - Wired live variant select dropdowns into the Setup Modal (`#hud-setup-queen-variant`, `#hud-setup-bishop-variant`), 360° WOW Inspector, and URL params (`?queen=` / `?bishop=`).
  - Updated `PieceView.js` and `WowModeView.js` to render selected 3D GLB variants seamlessly onto the board altar.
- ⚔️🛡️ **Pillar 2: Knight Sebastian Modular Weapon Armaments & Headless Assembly**:
  - Built headless Blender pipeline `tools/model-pipeline/seby/assemble_modular_seby.py` with computer-vision calibrated fist anchor at `(X=0.195, Y=-0.025, Z=0.738)`.
  - Assembled and floor-grounded 3 modular weapon variants with zero boundary edges and valid glTF VEC3 bounds:
    - **Alabarda Reale** (`assets/models/knight-seby-halberd.glb`, 4.08 MB): Ceremonial dark mahogany halberd with sapphire core and royal blue pennant.
    - **Spada Laser** (`assets/models/knight-seby-lightsaber.glb`, 4.11 MB): Dual-layer glowing plasma beam saber tilted +12° heroically away from helmet.
    - **Sigillo dell'Acquario** (`assets/models/knight-seby-aurora.glb`, 4.07 MB): Golden amphora with Sapphire Enamel constellation band and swirling stardust cascade.
  - Generated 4-view contact sheets (`tools/model-pipeline/critic/out/knight-seby-*_critic_sheet.png`).
- 👑💎 **Pillar 3: King Riccardo Surface Polish & Royal Crown Jewel Remaster**:
  - Built headless Blender polish tool `tools/model-pipeline/king/clean_king_riccardo.py`.
  - Inset white ermine fur collar undercut (`0.14 <= z <= 0.18, y > 0.04`) for crisp shadow separation against blue velvet cape; sculpted harmonic drape folds.
  - Sharpened Maltese cross finials on golden imperial orb and ceremonial scepter spearhead to razor-sharp points.
  - Welded coincident UV seams, pruned 855 floating face crumbs, and grounded strictly at Z=0.0m (`assets/models/king-riccardo-remastered.glb`, 4.19 MB).
  - Audited with Gemini VLM critic and logged contact sheet and report to `tools/model-pipeline/critic/out/king-riccardo-remastered_*`.
- 📋🔐 **Pillar 4: Model Provenance Registry & Checksum Verification**:
  - Updated `docs/models-provenance.yaml` with all newly added 3D models and their exact MD5 checksums.
  - Automated verification via `python3 scripts/test_provenance.py` validating 28 models and 47 concept sources with 100% green integrity.
- 🎙️👦 **Pillar 5: Voice Lines & Continuous Verification**:
  - Added *"Hey Google, uccidi questo mostro per me!"* for Seby (`voice-n-uccidimostro.mp3`).
  - Added *"Mummy... I'm still hungry!"* (`voice-b-stillhungry.mp3`) [EN] and *"Papino, tu sì che cucini bene!"* (`voice-b-cucinibene.mp3`) [IT] for Ale.
  - Zero IP denylist infractions across all files; `just test` passes 100%.

## [0.3.59] - 2026-10-14

- 🎨🖌️ **Local GPU 3D Paint/Texture Pipeline Verified on RTX 5080 (Blackwell sm_120) with TurboSebux (Issue #5 Phase 2)**:
  - Recompiled C++/CUDA `custom_rasterizer_kernel` with PTX forward-compatibility (`TORCH_CUDA_ARCH_LIST="9.0+PTX"` using `g++-12`), enabling native JIT execution on Blackwell `sm_120`.
  - Added Quadric Edge Collapse decimation (`--max-faces 60000` by default in `hunyuan_shape.py`), reducing face count from 697k to 60k faces (12.5 MB -> 1.1 MB) in 9.9 seconds with zero visual loss.
  - Implemented `tools/model-pipeline/local/hunyuan_paint.py` and `just local3d-paint` recipe.
  - Successfully executed end-to-end local texture painting: `ale1_hy2_shape_60k.glb` + `tools/model-pipeline/ale/front.png` -> `ale1_hy2_textured.glb` (60k faces, 3.7 MB with 2048x2048 PBR texture map) in **45 seconds** on RTX 5080 with 9.7 GB peak VRAM.

## [0.3.58] - 2026-10-14

- 🎙️👦 **Knight Seby Voice Line ("Scrivile Scemo")**:
  - Added *"Hey Google, metti Scrivile Scemo dei Pinguini Tattici Nucleari su YouTube Music!"* (`voice-n-scrivilescemo.mp3`) using Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`).
  - Tuned acoustic synthesis to avoid cartoon/female dubbing artifacts, using natural prepubescent Italian boy vocal cords without artificial pitch-shift distortion.
  - Registered soundboard clip in `src/core/CharacterPovData.js` and in `src/core/Registry.js` for in-game and showcase playback.
- ♟️✨ **Showcase Hero Selector Navigation Polish**:
  - Replaced cropped photo avatars with crisp 2D circular Staunton chess medallions (`getPieceMedallion`).
  - Streamlined character chip labels to single-word names (*Sebi, Ale, Riccardo, Kate, Pupurabbu, Puffin*), removing *"Papà"* and *"Mamma"* prefixes.

## [0.3.57] - 2026-10-14

- 🧊🏰 **Reconstruct High-Res UV-Textured 3D GLB Models for Classic & Swamp Families (Issue #20)**:
  - **Classic Family 3D Meshes (`assets/models/classic/`)**: Reconstructed high-res UV-textured 3D models complying with `assets/families/_contract.json`. King (1.80m, 99.2k tris), Queen (1.65m, 99.5k tris), and Bishop (1.45m, 97.1k tris) generated via `microsoft/TRELLIS.2`. Knight (1.35m, 22.1k tris), Rook (1.30m, 20.2k tris), and Pawn (0.95m, 13.3k tris) sculpted via Mode A 2D-to-3D SDF visual hull and 1024x1024 diffuse UV baking.
  - **Swamp Family 3D Meshes (`assets/models/swamp/`)**: Reconstructed high-res UV-textured 3D models complying with `assets/families/_contract.json`. King (1.80m, 21.6k tris), Queen (1.65m, 15.8k tris), Bishop (1.45m, 12.4k tris), Knight (1.35m, 16.5k tris with 40-tooth smile relief), Rook (1.30m, 16.7k tris), and Pawn (0.95m, 9.9k tris) sculpted via Mode A 2D-to-3D SDF visual hull and 1024x1024 diffuse UV baking.
  - **Model Provenance Registry (`docs/models-provenance.yaml`)**: Added all 12 newly reconstructed models with exact MD5 checksums, target paths, sizes, and pipeline details. `scripts/check.py` validates all 22 tracked models.
  - **Contract & Budget Alignment**: Grounding at `min.y == 0.0m`, canonical piece heights, clamped footprint spans (`0.70m <= span <= 0.86m`), named material slots `faction_primary` (diffuse 1024x1024 UV map) and `faction_trim`, aligned triangle budgets (`assets/families/classic.json`).
  - **Tooling (`tools/model-pipeline/`)**: Added zero-GPU local Mode A batch sculpting pipeline (`reconstruct_mode_a_batch.py`) utilizing `rembg` foreground segmentation, visual hull density carving, Taubin fairing, and UV texture baking.


## [0.3.56] - 2026-10-13

- 🚀🎮 **Local GPU 3D Shape Pipeline Verified on RTX 5080 (Blackwell sm_120) with TurboSebux (Issue #5)**:
  - Validated zero-footprint local inference environment on host `pupurabbux` using the 600 GB ext4 loop volume `TurboSebux` (`/media/riccardo/TurboSebux`).
  - Added `just turbosebux` recipe and `tools/model-pipeline/local/ensure_turbosebux.sh` to safely verify or mount TurboSebux across reboots.
  - Pinned `diffusers==0.31.0` and `transformers==4.48.3` in `setup_local.sh` and `venv-hunyuan` to ensure compatibility with `Hunyuan3D-2` shape checkpoints.
  - Successfully executed first local shape generation on RTX 5080: `tools/model-pipeline/ale/front.png` produced `ale1_hy2_shape.glb` (697,264 faces, 12.5 MB) in 32s with 5.6 GB peak VRAM.
  - Added documentation to `tools/model-pipeline/RUNNING_DOC.md` §10.11 and host log in Obsidian.

## [0.3.55] - 2026-10-13

- 🔐 **No local paths in the public repo**: `critic/refine_loop.py` dropped a hard-coded `/home/<user>/…/.env` candidate and now writes **repo-relative** `glb_path` / `sheet_path` / `report_path` in its reports; the committed `queen-kate-wedding2016_refine_summary.json` (v0.3.54) was scrubbed of 12 absolute agent-worktree paths. `scripts/check.py` secret scan now also fails on `/home/<user>/` paths.

## [0.3.54] - 2026-10-13

- ♗✨ **Bishop Ale #2 Modular Remaster (`bishop-ale-2-remastered.glb`)**:
  - Executed Option C modular clean-up on Bishop Ale #2, eliminating fused props / "two half dragons" artifacts by completely retracting the dragon and smoke lump into the mantle drape and retracting staff protrusion into the sleeve cuff.
  - Modeled an authentic 8-spoked celestial navigation wheel astrolabe with raised central hub and full-length grounded brass crosier staff (`tools/model-pipeline/ale2/out/astrolabe_clean.glb`).
  - Re-textured modular baby dragon with concept-accurate ruby-red scales, lime-green underbelly/wing lining, and emerald eyes (`tools/model-pipeline/dragon/out/dragon_clean.glb`), perching cleanly on the shoulder pad with clear negative space separation.
  - Automated headless assembly in `assemble_modular_ale2.py` (44.9k faces, zero stray islands, grounded at Z=0).
- 👑💇 **Queen Kate Nozze 2016 Geometry & Hair Clean-up (`queen-kate-wedding2016-remastered.glb`)**:
  - Created `tools/model-pipeline/kate/clean_queen_kate.py` to undercut the chignon bun from the collar creating a crisp neck crease.
  - Pulled scepter/hands forward by 1.6 cm to eliminate dress coplanarity, applied selective Surface Smooth preserving lathe pedestal edges, and grounded to Z=0. Passed VLM QA audit at 6.3 ACCEPTABLE tier (`passed: true`).
- 🌐 **Web Showcase Complete Character Suite (`showcase/index.html`)**:
  - Updated showcase with explicit v1..v4 model selectors for both Bishop Ale and Queen Kate, allowing side-by-side inspection of all original monolithic and remastered modular iterations.
- 📸💡 **Critic & Renderer Studio Lighting Upgrade**: upgraded `tools/model-pipeline/critic/render_contact_sheet.py` with camera-tracking rotating key/fill studio suns and neutral ambient backdrop, permanently solving dark angle dropoffs. Added automatic detection and assignment of empty `VERTEX_COLOR` layers for glTF imports in Cycles.
- 📋 **QA Scoreboard & Running Doc**: updated `docs/qa-scores.yaml` and documented Section 27 in `tools/model-pipeline/RUNNING_DOC.md`.

## [0.3.53] - 2026-10-13

- 🔄🎥 **'Reset View' Camera Button & Hotkey `R` (Issue #29)**:
  - **HUD Action Button**: Added `#hud-reset-cam-btn` to the HUD bottom dock with intuitive target/recenter icon and bilingual tooltips (`🎥 Ripristina Telecamera (R)` / `🎥 Reset Camera View (R)`).
  - **Keyboard Shortcut**: Pressing `r` or `R` during gameplay instantly animates/restores the camera position back to the default canonical 3D framing and centers controls target.
  - **Bilingual Toast Notification**: Brief feedback toast confirming camera reset in Italian and English.
  - **Unit Test Coverage**: Added Node.js test suite verification in `tests/core.test.mjs`.
  - **Merge fixes (main agent)**: branch renumbered 0.3.49 → 0.3.53 (main had moved to 0.3.52); the `R` hotkey now ignores Ctrl/Cmd/Alt so **Ctrl+R / Cmd+R still reloads the page**; on mobile phones Reset View delegates to `applyMobileCameraMode('3d')` so it keeps the v0.3.52 portrait framing.

## [0.3.52] - 2026-10-13

- 📱🔄🧹 **Pixel 10 & Mobile Self-Healing Cache Recovery, Service Worker De-Poisoning, Restored Mobile Top-Bar Toggle (`☰` + `🔄 Reload` + Pull-to-Refresh) & Portrait Board Framing (`index.html`, `nocache.html`, `sw.js`, `src/listeners/HudListener.js`, `src/core/Registry.js`, `docs/spec/SPEC.md`, `VERSION`)**:
  - **Root-Cause Fix for "Stuck `/carchess3d/` After Clearing Cache & Visiting `nocache.html`" (`nocache.html`, `index.html`, `sw.js`)**:
    - Fixed the Service Worker re-poisoning race in `nocache.html`: previously, when `nocache.html` ran while an older Service Worker was still the active `navigator.serviceWorker.controller`, calling `LIVE_MODULES.map(u => fetch(u, { cache: 'reload' }))` passed straight through the active Service Worker's `fetch` handler, which re-wrote the stale responses back into `CacheStorage` right after `caches.delete()`! `nocache.html` now detects an active `navigator.serviceWorker.controller`, unregisters all Service Workers, deletes all caches, and reloads once (`sessionStorage` guard) to detach the controller *before* warming the HTTP cache with `{ cache: 'reload' }`.
    - Added `'./'` (the root `/carchess3d/` URL), `'./sw.js'`, `'./manifest.webmanifest'`, `'./vendor/chess.js'`, `'./vendor/three/three.module.js'`, and `'./src/core/CharacterPovData.js'` to `LIVE_MODULES` so the root URL is refreshed alongside `./index.html`.
    - Fixed `index.html` script execution order: replaced the static `<script type="module" src="./src/main.js"></script>` (which previously executed *before* the `?nocache=1` script) with an async bootstrapper that first checks `?nocache=1` or a version change against `./VERSION` (`localStorage.getItem('carchess3d_boot_ver')`), purges stale Service Workers + `CacheStorage` + HTTP module cache when needed, and only then dynamically imports `./src/main.js`.
    - Upgraded `sw.js` (`carchess3d-offline-v33`) to use Network-First with `{ cache: 'reload' }` for all HTML/JS/manifest requests, skip `Range` requests and `.mp4`/`.webm` video streams, and lazy-cache `.glb`/`.mp3` assets on demand instead of triggering a 35 MB install-time precache storm.
  - **Restored Mobile Top Bar Toggle (`☰`), 1-Tap Hard Reload (`🔄 Reload`) & Native Pull-to-Refresh (`src/listeners/HudListener.js`, `index.html`)**:
    - Removed `overscroll-behavior: none` from `html, body` in `index.html` so Android Chrome's native vertical pull-to-refresh gesture works when the browser URL bar is hidden.
    - Unhid `#hud-toggle-topbar-btn` (`☰`) and `#hud-topbar` on mobile (`#carchess-hud-root.mobile-simplified`) so smartphone users can expand/collapse the top bar at any time, and added a 1-tap `🔄 Reload` (`#hud-top-reload-btn`) button inside `#hud-topbar` (in addition to `🔄` in the bottom dock and setup modal).
  - **Mobile Setup Modal & Portrait Camera Framing Fixes (`src/listeners/HudListener.js`, `src/core/Registry.js`)**:
    - Enforced `.hud-desktop-setup-only { display: none !important; }` on mobile so inline `style="display:flex"` on the desktop action buttons row no longer leaks a duplicate button row below the mobile Quick Start card.
    - Removed the duplicate `🏰🚽` icon prefix in `mobileQuickTitle`.
    - Scaled mobile camera distance in Portrait (`window.innerHeight > window.innerWidth`) by `portraitScale` (`y = 20.67` in top-down portrait, `z = 16.5` in 3D portrait) so all 8 columns (`A`–`H`) fit inside narrow vertical phone screens without clipping columns `A, B, G, H`.

## [0.3.51] - 2026-10-12

- 🚫 **IP safety / Be Googley (#24)**: no more third-party brand or franchise names in the app (381 replacements across 22 files: UI, code, identifiers, data, prompts, tests).
  - Palude di Shrek → **Palude dell’Orco**; Don Gatto con gli Stivali / Zorro-Vescovo → **Don Gatto Spadaccino-Vescovo**; Netflix Maxischermo → **Maxischermo / Maxi Cinema** (ids `netflix-*` → `cinema-*`, red `#E50914` → `#D32F2F`); D&D spells → generic **fantasy spells**; Saint Seiya / Sacro Acquarius → **Sigillo dell’Acquario** (`sigillo_acquario_*`); Hot-Wheels → **turbo toy-car**.
  - "Pixar-style" kept on purpose in generation prompts only (image quality).
  - New `etc/ip-denylist.txt` + check in `scripts/check.py`: `just test` fails on any hit in the app scope (docs/CHANGELOG/conductor/tools exempt).
  - `AGENTS.md` (= `GEMINI.md`): explicit IP-safety rule; spec *Be Googley* line updated with the Pixar exception.
  - `assets/battles/video_audit.yaml` → `docs/battles/video_audit.yaml` (historical prompt log, kept verbatim).

## [0.3.50] - 2026-10-12

- 📐 Spec *IP Safety*: new **Be Googley** rule. The app (code, UI, data, generation prompts) must never name protected brands, franchises or characters; docs may cite them; enforced by a denylist in `just test` (coming in #24).

## [0.3.49] - 2026-10-12

- 📝 README refresh: status was frozen at v0.3.0. It now shows v0.3.48 features, a 3-family × 6-piece model table (reconstructed vs procedural) and the real repo layout. "Palude di Shrek" → "Palude Incantata" in the README (spec *IP Safety*).

## [0.3.48] - 2026-10-12

- 🎲🔴🎲🔵👑 **6+6 Risiko Shelves (Attacco Dadi Rossi & Difesa Dadi Blu), Medaglione Target Scacchistico 48px Sovraimpresso sul Film e Rotator 3D Snello (`showcase/index.html`, `src/core/CharacterPovData.js`, `VERSION`, `src/core/Registry.js`, `tests/character-pov.test.mjs`, `tests/test_character_pov.py`)**:
  - **Doppia Riga Scontri Risiko (6 Sopra e 6 Sotto Visibili Contemporaneamente)**:
    - Risolto il limite del carousel a 5 card e l'occultamento delle difese dietro un tab secondario: eliminate le tab e introdotte **DUE RIGHE COMPLETE E SIMULTANEE**:
      - **Riga Superiore (🎲🔴 ATTACCO - Dadi Rossi Risiko)**: le 6 vittorie dell'eroe selezionato contro tutti i 6 pezzi avversari, con bordo e badge rosso fuoco (`#ff1744` / `#e53935`).
      - **Riga Inferiore (🎲🔵 DIFESA - Dadi Blu Risiko)**: i 6 contrattacchi quando l'eroe viene mangiato/attaccato, con bordo e badge blu cobalto (`#2979ff` / `#1e88e5`).
    - Layout a griglia 6 colonne: tutte e 12 le card sono visibili immediatamente sul monitor senza scrolling orizzontale o tagli.
  - **Pezzo Target Scacchistico GIGANTE Sovraimpresso SUL FILM (48px = 50% dell'Altezza del Video)**:
    - Sull'anteprima di ogni film/video, il pezzo target (non ovvio) è reso **immediatamente riconoscibile per i bambini e giocatori**:
      - Medaglione circolare Staunton ad alta risoluzione da **48px** (esattamente il 50% dell'altezza del thumbnail di 96px).
      - Cerchio a contrasto elevato con bordo luminescente color Risiko (rosso per attacco, blu per difesa) e pillola dedicata con glyph e nome in maiuscolo: `♛ REGINA`, `♝ ALFIERE`, `♜ TORRE`, `♚ RE`, `♟ PEDONE`, `♞ CAVALLO`.
      - Chiunque voglia sapere *"come mi comporto contro la Regina?"* vede l'icona gigante della Regina sul film e ci clicca direttamente, senza dover indovinare chi sia Kate!
      - Testo sotto la card focalizzato sul bersaglio: `⚔️ vs REGINA (Kate)` o `🛡️ da REGINA (Kate)`.
  - **Badge Target Fluttuante sul Maxischermo Video**:
    - Nell'angolo superiore sinistro del player principale (`#netflix-screen-wrap`), appare un badge dinamico in vetro scuro con l'icona circolare da 32px del pezzo target e la didascalia `🎲🔴 ATTACCO vs ♛ REGINA (Kate)` o `🎲🔵 DIFESA da ♛ REGINA (Kate)`.
  - **Rotator GLB 3D a Sinistra Ottimizzato e Rimpicciolito**:
    - Ridotta la larghezza della colonna sinistra da ~43% a una colonna fissa snella da 280px (`height: 160px` per il viewer Three.js, risparmiando il 36% di altezza verticale), regalando oltre l'80% della larghezza desktop al cinema e alle due righe da 6 film.
    - Soundboard a 2 colonne ultra-compatta posizionata sotto il 3D.
  - **AI Pairing & Implementation**:
    - Sviluppato e rifinito in pair programming con **`gemini38flash-high`** (AntiGravity harness) per la logica architetturale, asset SVG, test suite ed esperienza utente cinema a 6+6 corsie.
  - **Suite di Test Aggiornata**:
    - Aggiunte verifiche in Node (`character-pov.test.mjs`) e Python (`test_character_pov.py`) su `attacks-cards-grid`, `defenses-cards-grid`, `netflix-screen-target-badge`, `film-target-overlay` e coerenza metadati target.

## [0.3.47] - 2026-10-12

- 🎬▶️📐 **Full Frame Uncropped Video Playback (`object-fit: contain`), 16:9 Cinema / 4:3 Classic Ratio Toggle, Autostart & Smooth Cross-Fade Transitions (`showcase/index.html`, `VERSION`, `src/core/Registry.js`)**:
  - **Full Frame Uncropped (`object-fit: contain`) & Ratio Toggle (`showcase/index.html`)**:
    - Risolto il ritaglio del video causato da `object-fit: cover` e `max-height: 280px` che comprimevano il video in formato 2.28:1 tagliando la testa dei personaggi e la base del tabellone.
    - Video ora visualizzato con `object-fit: contain` e sfondo nero cinematografico: 100% dell'inquadratura naturale è visibile senza tagli.
    - Aggiunto pulsante toggle rapido `📐 16:9 CINEMA` / `📐 4:3 CLASSIC` nell'angolo superiore del maxischermo per alternare al volo tra aspect ratio 16:9 e 4:3 con transizione fluida.
  - **Autostart Immediato dei Video**:
    - Il video parte automaticamente appena viene selezionato un eroe, una variante o un episodio dalla playlist, senza costringere l'utente a cliccare play manualmente (con fallback soft a muted autoplay in caso di policy browser restrittive senza gesture utente iniziale).
  - **Transizione Fluida Cross-Fade tra gli Episodi**:
    - Quando un video finisce (`video.onended`) o si naviga tramite `⏮️ Precedente` / `⏭️ Successivo` / card del carousel: il video esegue un morbido fade-out (300ms con leggera scala), carica il nuovo episodio e sfuma in fade-in con riproduzione immediata, mentre la card corrispondente nel carousel scorre automaticamente in vista con la pillola `IN ONDA`.

## [0.3.46] - 2026-10-12

- 📐✨🍿 **Ultra-Compact & Functional Showcase Layout: Slim Navbar, Single-Row Hero Chips & Side-by-Side Dual Stage ("Zero Scroll" Above the Fold) (`showcase/index.html`, `VERSION`, `src/core/Registry.js`)**:
  - **Navbar Slim a Riga Singola (Altezza ~44px, Risparmiati ~180px)**:
    - Eliminati tutti i banner verticali ingombranti, sottotitoli ridondanti e margini gonfi.
    - Barra superiore compatta e moderna: logo `🏰 CarChess3D`, pillole modalità compatte (`🎭 Eroi POV` / `🏛️ 18 Pezzi`), tinte fazione iconiche (`🎨 Orig`, `⚪ Bianco`, `⚫ Nero`), e collegamenti rapidi (`🎬 Scontri 6×6`, `♟️ Gioca`).
  - **Selettore Eroi a Chip Orizzontali (Riga Singola, Altezza ~38px, Risparmiati ~120px)**:
    - Sostituite le schede giganti a 2 righe con 6 chip ovali compatti: avatar rotondo da 26px, glyph e nome (`🐴 Seby`, `🐉 Ale`, `👑 Riccardo`, `👸 Kate`, `🏰 Pupurabbu`, `🐧 Puffin`).
    - Niente wrapping: layout fluido orizzontale con bordo dorato luminoso sull'eroe attivo.
  - **Dual Stage Affiancato (3D + Soundboard a Sinistra | Maxischermo Netflix a Destra)**:
    - Risolto il problema del dover scrollare giù un'intera pagina per vedere foto e video: ora **il modello 3D interattivo E il video Netflix sono visibili contemporaneamente sulla prima schermata**!
    - **Pannello Sinistro**: Turntable Three.js compatto (canvas da 250px) con pillole varianti (es. Ale riggato) e tasto `⛶`, pillole statistiche arma/difesa, box soundboard con avatar, catchphrase in corsivo e chip audio compatti a risposta immediata.
    - **Pannello Destro**: Netflix Theater centrale con medaglioni classici Staunton dei combattenti, maxischermo video 16:9 pronto all'avvio, pulsante rapido `🥊 Scontro 3D`, e carousel playlist episodi snello (card da 160px con scroll fluido).
    - L'intera interfaccia si adatta entro ~550px verticali, visibile senza scrollare su qualsiasi laptop/desktop.

## [0.3.45] - 2026-10-12

- 🎭🐴🧙‍♂️ **Vetrina per Personaggio (Showcase POV) con Turntable 3D, Soundboard Vocale e Video Attacco/Difesa (Issue #22) (`showcase/index.html`, `src/core/CharacterPovData.js`, `battles.html`, `tests/character-pov.test.mjs`, `tests/test_character_pov.py`)**:
  - **Cruscotto POV a 2 Colonne per i 6 Eroi Carlesso (`showcase/index.html`)**:
    - **Selettore Eroi Touch/Kid-Friendly**: 6 pulsanti orizzontali ad alto contrasto con avatar frontale, glyph e ruolo per Cavaliere Seby (`n`), Alfiere Ale (`b`), Re Riccardo (`k`), Regina Kate (`q`), Torre Pupurabbu (`r`) e Guardia Svizzera Puffin (`p`).
    - **Colonna 3D Turntable Interattivo**: Three.js auto-rotante su singolo renderer condiviso (conforme alle quote Chromium `kMaxActiveWebGLContexts = 16`), drag-to-rotate fluido, pulsante Schermo Intero `⛶`, selettore tinte di fazione (Originale, Bianco, Nero) e pillole varianti modello (es. Ale con drago riggato a 26 ossa e Regina Kate nozze 2016).
    - **Colonna Soundboard Vocale & Catchphrases**: Pulsanti audio dedicati per tutti i file `assets/audio/voices/voice-*.mp3` con etichetta, badge e trascrizione della battuta, animazione live d'onda sonora durante la riproduzione, e SpeechSynthesis fallback per le nuove catchphrase richieste:
      - **Regina Kate (`q`)**: *"I'll bear that in mind"* (accento British).
      - **Torre Pupurabbu (`r`)**: *"Catchphrase!"* (citazione di Blue Shirt Guy / Free Guy 👕).
  - **Cinema Netflix-Style Theater per gli Scontri (Issue #22)**:
    - **Maxischermo Centrale 16:9 4K**: Singolo player cinema centrale (`#netflix-video`) pronto all'avvio, con filigrana cinema, banner scontro stilizzato, riassunto Atto 1 (Arma) / Atto 2 (Contrattacco) e pulsante diretto `🥊 Gioca questo Scontro in 3D nella Scacchiera`.
    - **Carousel Orizzontale a Scorrimento ("Playlist Episodi")**: Shelf in perfetto stile Netflix con card snelle (`[icona] Seby vs [icona] Pupurabbu`), thumbnail video, badge durata/vittoria/difesa, e pillola `IN ONDA` per l'episodio attualmente selezionato con scorrimento fluido (`scrollIntoView`).
    - **Navigazione & Auto-play**: Tasti `⏮️ Precedente` e `⏭️ Successivo`, navigazione da tastiera e passaggio automatico al termine del video (`ended` event) all'episodio successivo.
    - **12 Medaglioni Circolari Classici Staunton (`assets/icons/chess/{white,black}/*.svg`)**: Icone vettoriali ad alta definizione per Re, Regina, Alfiere, Cavallo, Torre e Pedone (in versione Bianco avorio / oro e Nero ossidiana / antracite), disegnate con cerchi bordati a gradiente e ombre soffuse per rendere nitide sia come miniature (20px) nelle card, sia in grande sul maxischermo.
  - **Navigazione & Integrazione Olistica**:
    - Selettore modalità in primo piano: `🎭 Per Personaggio (Showcase POV)` e `🏛️ Confronto Famiglie (18 Pezzi Multi-Family)`.
    - Deep-linking URL via query param: `?hero=seby`, `?hero=ale`, `?hero=k`, `?hero=q`, `?hero=r`, `?hero=p`, `?view=pov` e `?view=families`.
    - Aggiunto tasto di collegamento rapido `🎭 Vetrina Personaggi (POV)` nell'header di `battles.html`.
  - **Suite di Test**: Aggiunti `tests/character-pov.test.mjs` (Node) e `tests/test_character_pov.py` (Python stdlib) verificando la completezza di tutti i 6 profili, medaglioni scacchistici, file audio MP3, video e conformità DOM.
- 🎲🔄 **Bumped and Synchronized `niccolo-game-design` Skill to v0.2.1 (`.agents/skills/niccolo-game-design/`, `SKILL.md`, `CHANGELOG.md`, `DEPENDENCIES.md`)**:
  - Bumped skill metadata version to `v0.2.1` in both `SKILL.md` and skill `CHANGELOG.md` reflecting the Mode B adversarial face-grafting additions.
  - Added `DEPENDENCIES.md` establishing downstream sync contract with `gemini-cli-palladius-public-goodies` and `skillume`.
  - Synchronized upstream to `gemini-cli-palladius-public-goodies`, aligning MD5 content hash (`#e2c08`) across local, public, and skillume registries.

## [0.3.44] - 2026-10-11

- 🎻🔇🕹️ **Non-Fatiguing 30s Chamber Strings Background Loop (`chess-strings-bg.mp3`) + Complete Removal of 1980s Arcade Oscillator Sequencers (`assets/audio/chess-strings-bg.mp3`, `src/listeners/AudioListener.js`, `sw.js`, `tests/voices_idle.test.mjs`)**:
  - **Warm, Non-Fatiguing 30s Chamber Strings Background Loop (`assets/audio/chess-strings-bg.mp3`, `106 BPM` E Dorian)**: Generated a pure acoustic chamber string octet loop (`4 violins, 2 violas, 2 cellos`, zero synths/drums) with balanced dynamics designed for continuous background looping while thinking at the chessboard (`volume = 0.42`), paired with the `128 BPM` Baroque String Overture (`assets/audio/chess-strings-theme.mp3`).
  - **Eliminated 1980s Pixel-Arcade Oscillator Loops (`AudioListener.js`)**:
    - Disabled the procedural `synthTone` melody loop in `startThemeSong()` whenever `typeof Audio !== 'undefined'` unless the `.mp3` genuinely errors (`this.themeAudioFailed`), preventing any 8-bit bleeps while buffering or playing.
    - Disabled the `98ms` 16th-note `sawtooth`/`square` wave `_stepCombatSequencer()` overlay and removed the harsh `sawtooth` chord from `synthCombatEntryBraaam()` when `combat-suspense.mp3` is available in the browser.

## [0.3.43] - 2026-10-11

- 🎻🎼🏰 **Lyria 3 Baroque-Symphonic String Chess Overture (`assets/audio/chess-strings-theme.mp3`, `src/listeners/AudioListener.js`, `sw.js`, `docs/spec/SPEC.md`, `tests/voices_idle.test.mjs`)**:
  - Generated a 100% instrumental 30-second **Baroque String Octet & Symphonic Chess Overture** (`assets/audio/chess-strings-theme.mp3`) via `lyria-3-clip-preview` in E Dorian minor (`128 BPM`), featuring a crisp double string quartet (`4 violins, 2 violas, 2 cellos`) playing urgent rhythmic staccato chords, descending chromatic violin melodies (`C# → C → B`), deep cello counter-melodies, and theatrical West End symphonic grandeur.
  - Wired `CHESS_STRINGS_THEME_URL` (`assets/audio/chess-strings-theme.mp3`) as the primary musical soundtrack in `AudioListener.startThemeSong()`, upgraded the procedural WebAudio fallback to a multi-voice E-Dorian Baroque String Octet (`BAROQUE_VIOLIN_MELODY_HZ` + `BAROQUE_CELLO_STACCATO_HZ`), and added `chess-strings-theme.mp3` to `sw.js` (`v31`) offline precache and `tests/voices_idle.test.mjs`.

## [0.3.42] - 2026-10-11

- 🎬⚔️🍿 **10-Second Synchronized Combat (`1s Pre + 8s Veo Video + 1s Post`), Chrome-Free Netflix Maxischermo (`2.38x`, `78%` Alpha), Non-Linear Board Warp & Measured Space/Click Exit (`CombatAnimationManager.js`, `VeoCinemaView.js`, `VFXPoolView.js`, `HudListener.js`, `AudioListener.js`, `tests/combat.test.mjs`, `docs/spec/SPEC.md`)**:
  - **Exact 10.0s Combat Timeline (`1000ms Pre-Padding + 8000ms Full Veo Video + 1000ms Post-Padding = 10000ms`)**:
    - Verified all 36 active battle videos in `assets/battles/videos/*.mp4` are `8.00s`.
    - **`0.0s .. 1.0s` (1s Pre-Padding)**: Camera zooms in, Netflix screen expands to full viewport, non-linear board/piece warp opens the arena, the 2 contenders step into a wide Left/Right 3/4 profile Face-Off stance (`2.28m` apart), and the `<video>` is cued and held at Frame 0 (`0.0s`) so zero seconds of the movie are lost during entry.
    - **`1.0s .. 9.0s` (8s Full Veo Video)**: At `t = 1.0s`, `<video>.play()` starts from `0.0s` (`loop = false`) and plays all `8.0s` uninterrupted while the Netflix screen remains at 100% full viewport size (`combatBlend = 1.0`).
    - **`9.0s .. 10.0s` (1s Post-Padding)**: The video holds its final frame (`8.0s`) at full viewport while the victorious 3D piece holds a calm Victory Pose on the conquered square for 1 full second.
    - **`10.0s .. 13.5s` (3.5s Sliding-Window Exit)**: Smoothly zooms the Netflix screen out to the "Cinema Vecchio" between the Grossmünster towers while cross-fading alpha and restoring the board, camera, HUD chrome, and soundtrack.
  - **Full-Viewport Chrome-Free Netflix Maxischermo (`videoBoost = 2.38`, `videoAlpha = 0.78`)**:
    - Expanded default `videoBoost` from `1.75` to **`2.38`** (`19.04m × 10.71m` at `z = -4.65m`), filling ~93% of the 16:9 viewport with minimal black margin.
    - **Pure Text-Free & Header/Footer-Free Cinema**: Smoothly fades out and slides away all HTML HUD chrome (`#hud-topbar`, `.hud-bottombar`, `#hud-comic-banner`, `#hud-toast`, `#hud-lyria-caption`) via `HudListener.setCombatBlend(blend)` during combat, and stripped all canvas text/titles from `VeoCinemaView.drawNetflixCinemaOverlay` (leaving only a discreet 3px `#E50914` progress hairline at the bottom edge).
    - **Visual Harmony (`100%` Solid 3D Fighters + `78%` Alpha Veo Video)**: Draws the Veo video at `78%` opacity (`?videoAlpha=0.78`) with a soft lower-center radial contrast cushion (`_drawMediaWithArenaContrast`) so both the 16:9 movie and the 100% solid 3D foreground fighters are crystal clear simultaneously.
  - **Spaced, Readable 3D Choreography (`1.52x` Hero Scale, `2.28m` Left/Right Separation) & Non-Linear Board/Piece Transformation (`_applyArenaNonLinearWarp`)**:
    - Radially dilates non-fighting neighboring pieces outward (`+1.52m` fisheye clearing) and scales them down non-linearly to `56%..70%`, while scaling the 2 protagonists to `1.52x` (`?heroScale=1.52`) separated by `2.28m` (`baseSep = 1.14m`, minimum lunge gap `1.52m`) in 3/4 front-profile with zero `brawlCloud` dust blob and no occluding orange `loopTrack` ring.
  - **Measured, Unbroken Video + Audio Exit on `SPACEBAR` or `CLICK / TAP` (`BATTLE_SKIPPED`)**:
    - Pressing `Space` (or `Enter`/`Escape`) or clicking/tapping anywhere on the screen (with a `350ms` start guard and `<= 12px` drag threshold so camera orbiting still works) triggers a **measured `2.5s` sliding-window exit** where the `<video>` keeps playing uninterrupted while its alpha and volume smoothly fade `1.0 -> 0.0`, the combat soundtrack cross-fades out over `2.5s` (`AudioListener.stopCombatMusic(false, 2500)`), the victorious piece glides onto `toSquare`, and the HUD header/footer slide back in.

## [0.3.41] - 2026-10-11

- 🗿📱✨ **Full 3D `.glb` Models Enabled by Default on Pixel 10 & Mobile Phones (`src/core/Registry.js`, `sw.js`, `docs/spec/SPEC.md`)**:
  - Verified on real Google Pixel 10 hardware that with `HalfFloatType` `UnrealBloomPass` and hidden transmission FBOs bypassed, all 32 full 3D `.glb` character meshes render smoothly on mobile GPUs.
  - Updated `shouldUseMobileLite3D()` to default to `false` (Full 3D `.glb` mode on all devices without needing `?glb=1`), while keeping lightweight 3D portrait medallions available via `?lite=1` or `?lite3d=1`.

## [0.3.40] - 2026-10-11

- 🎙️🇬🇧🇮🇹 **New Iconic Family Voice Lines (`"Don't be FACETIOUS!"`, `"Mummy, can you clean my bottooooom?"`, `"Papino, ti manco tantissimo!"`, `"Sei proprio un cafoNAZZO!"`) (`scripts/generate_voice_lines.py`, `assets/audio/voices/`, `src/core/Registry.js`, `sw.js`, `docs/spec/SPEC.md`, `tests/voices_idle.test.mjs`)**:
  - **Queen Kate (`q`)**: Added *"Don't be FACETIOUS!"* (`voice-q-facetious.mp3`) spoken by the 40yo Winchester UK voice (`en-gb-csagent-4`) with crisp dry-witted British emphasis on `FACETIOUS!`.
  - **Knight Seby (`n`)**: Added *"Mummy, can you clean my bottooooom?"* (`voice-n-bottom.mp3`) with the long dragged-out final syllable (`bottooooooom?`), and updated `voice-n-timanco.mp3` to *"Papino, ti manco tantissimo!"* (capturing the adorable 3rd-language inversion of *"I miss you"*).
  - **Bishop Ale (`b`)**: Updated `voice-b-cafonazzo.mp3` to *"Sei proprio un cafoNAZZO!"* with the funny rising comic accent on `-NÀZZO!` at the end, and `voice-b-timanco.mp3` to *"Papino, ti manco tantissimo!"*.

## [0.3.39] - 2026-10-11

- 🎛️✨📱 **Clean Angular/Material SVG Icon Footer Toolbar (`src/listeners/HudListener.js`, `sw.js`)**:
  - **Replaced Gaudy Emoji/Text Footer Buttons with Crisp Material Design Vector SVG Icon Buttons (`.hud-icon-btn`)**:
    - Removed noisy emojis, long multi-word button labels, and bright yellow/green gradient buttons from `.hud-actions-dock` in favor of uniform `34×34px` matte-slate Material SVG icon buttons (`#hud-new-btn` `restart_alt`, `#hud-setup-btn` `tune`, `#hud-refresh-btn` `sync`, `#hud-top-btn` `view_in_ar` + `2D`/`3D` badge, `#hud-flip-btn` `swap_vert`, `#hud-hint-btn` `lightbulb`, `#hud-matrix36-btn` `grid_view`, `#hud-sfx-btn` `volume_up`, `#hud-music-btn` `music_note`, `#hud-dock-gallery` `museum`, `#hud-fen-btn` `code`, `#hud-console-btn` `terminal`, `#hud-toggle-topbar-btn` `menu`, plus a compact `EN | IT` segmented pill).
    - Added a dedicated **Update / Refresh App** icon button (`#hud-refresh-btn`, Material `sync` icon) in the footer toolbar that checks `./VERSION` (`cache: 'no-store'`), purges Service Worker caches, and reloads on click (`checkAndRefreshVersion()`).
    - Removed duplicate brand/GitHub links and hidden secondary/debug buttons from the bottom bar so both Desktop and Mobile (`#carchess-hud-root.mobile-simplified`) remain clean, readable, and single-row without overflowing.
    - Updated `refreshTranslations()`, `setTopbarVisible()`, and `applyMobileCameraMode()` to update `title` and `aria-label` tooltips without overwriting `<svg>` icons.

## [0.3.38] - 2026-10-11

- 🧹⚡📱 **Zero-Cache Mobile Permalink (`nocache.html` & `?nocache=1`) + Mobile HUD Flexbox Fix (`nocache.html`, `index.html`, `sw.js`, `HudListener.js`, `Registry.js`)**:
  - **Standalone `nocache.html` Permalink (`https://palladius.github.io/carchess3d/nocache.html`)**: Added a brand-new entry-point HTML page that is never in any legacy Service Worker precache list; on load it unregisters all Service Workers (`navigator.serviceWorker.getRegistrations()`), deletes all `CacheStorage` caches (`caches.keys()`), forces Chrome's HTTP disk cache (`max-age=600`) to re-fetch all `src/**/*.js` ES modules (`fetch(u, { cache: 'reload' })`), displays a green confirmation pill (`⚡ NO-CACHE LIVE v0.3.38`), and boots `./src/main.js?nocache=1&t=<timestamp>` directly without redirecting back to a cached `index.html`.
  - **`?nocache=1` / `?fresh=1` Query Support (`index.html`, `sw.js`)**: Passing `?nocache=1` or `?fresh=1` to `index.html` unregisters Service Workers and purges caches instead of registering `sw.js`, while `sw.js` (`v26`) bypasses cache lookup (`fetch(req, { cache: 'no-store' })`) for `nocache.html` and `?nocache=1`.
  - **Visible Mobile Version Badge, 1-Tap `🧹 No-Cache` Button & Bottom Bar Flexbox Fix (`HudListener.js`)**: Added `⚡ v0.3.38` and a 1-tap `🧹 No-Cache` link right inside `#hud-rotate-overlay` and `#hud-mobile-quick-setup`, and fixed `#carchess-hud-root.mobile-simplified .hud-status-card` (`flex-shrink: 0`) so the bottom dock buttons never squish the turn status card.

## [0.3.37] - 2026-10-11

- 👨‍👩‍👦‍👦🏛️🐸 **Showcase Divided Into 3 Families (`Carlesso`, `Classic`, `Shrek / Palude` = Strictly 6 Pieces at a Time) + Lazy Per-Family Loading & TDD Guard (`showcase/index.html`, `tests/showcase-webgl.test.mjs`)**:
  - **Strictly 3 Family Tabs (`6` Pieces Visible at a Time)**: Removed the `"Tutte le Famiglie (18)"` (`data-family="all"`) tab so `showcase/index.html` presents the **3 dedicated family tabs** — `👨‍👩‍👦‍👦 Famiglia Carlesso (6)` (default), `♔🏛️ Scacchi Classici Vanilla (6)`, and `🐸🧅 Famiglia Shrek / Palude (6)` (supporting `#carlesso`, `#classic`, `#swamp`, and `#shrek` URL hashes) — showing and lazily loading **only 6 pieces at a time** (`ensureFamilyViews(validFam)`).
  - **Double Protection Against Chrome's 16-WebGL-Context Limit (`kMaxActiveWebGLContexts = 16`)**: Combining **6 visible pieces per family tab** (`6 << 16`) with a **single shared `THREE.WebGLRenderer`** (`sharedRenderer` blitting via `ctx.drawImage` into lightweight 2D canvases) guarantees **Ale 1** and **Re Riccardo** never suffer WebGL context eviction (`webglcontextlost` white box) on any desktop or mobile browser.
  - **TDD Regression Suite (`tests/showcase-webgl.test.mjs`)**: Verifies that (1) no `data-family="all"` tab exists, (2) `#family-tabs` contains strictly `['carlesso', 'classic', 'swamp']` with `6` pieces each, (3) `makeView()` never instantiates per-card `THREE.WebGLRenderer` instances, and (4) all 2D/3D `.glb` assets exist and have valid `glTF` v2 headers.

## [0.3.36] - 2026-10-11

- 🎬⏱️⚔️ **10-Second Battle Cutscene (`1s Pre-Padding + 8s Veo Video + 1s Post-Padding`), `1.52x` Hero Combatant Scale & Radial Neighbor Dilation (`CombatAnimationManager.js`, `VeoCinemaView.js`, `VFXPoolView.js`, `tests/combat.test.mjs`)**:
  - **`10.0s` Total Duel Timeline (`DEFAULT_BATTLE_DURATION_MS = 10000`)**:
    - **`1.0s` Pre-Padding (`0.0s .. 1.0s`)**: `VeoCinemaView` cues Frame 0 of the 16:9 Veo battle video and holds it while the camera glides into position so the player never misses the first second of the film.
    - **`8.0s` Full Veo Video Playback (`1.0s .. 9.0s`, `loop = false`)**: Plays the entire 8-second Veo 3.1 clip from start to finish with configurable translucency (`combatVideoAlpha = 0.78`, `?videoAlpha=0.78`).
    - **`1.0s` Post-Padding (`9.0s .. 10.0s`)**: Holds the final K.O. frame before completing the duel.
  - **`1.52x` Heroic Combatant Scale & Radial Neighbor Dilation (`VFXPoolView.js`)**:
    - Enlarged the 2 active 3D fighters to `1.52x` hero scale and hid the `brawlCloud` dust blob for crisp silhouettes.
    - Smoothly dilates neighboring board pieces radially outward (`> 0.6m`) and scales them down (`< 72%`) during combat so they frame the arena without crowding the two heroes, restoring their exact board positions and scale afterward.

## [0.3.35] - 2026-10-11

- 🎙️🇬🇧🇮🇹 **Gemini 3.8 TTS Multi-Clip Character Voice Pool + Smart Anti-Repetition & Anti-Spam Engine (`scripts/generate_voice_lines.py`, `assets/audio/voices/voice-*.mp3`, `src/core/Registry.js`, `src/listeners/AudioListener.js`, `src/views/BoardInteractionView.js`, `src/listeners/HudListener.js`, `sw.js`, `docs/spec/SPEC.md`, `tests/voices_idle.test.mjs`)**:
  - **25 Character Voice Clips via `gemini-3.8-flash-tts` (`scripts/generate_voice_lines.py`)**:
    - Upgraded the voice pipeline to **`gemini-3.8-flash-tts`** using `parts[].speech_metadata.style` for acting persona and inline `<sigh>`, `<pff>`, `<giggle>` tags (so stage directions are never spoken aloud).
    - **Queen Kate (`q`, 40-Year-Old British UK Woman — Extended Voice `en-gb-csagent-4`, Winchester UK)**:
      - Signature sentences: *"That's... interesting."*, *"Ok, Puffin McMuffin!"*, *"You... love me! I tell myself EVERY day!"*
      - Higher-probability non-verbal reactions (`kind: 'mumble'`): *"Hmm-hmm..."* (`voice-q-hmm.mp3`) & *"Pff... oh, honestly!"* (`voice-q-sbuffo.mp3`).
    - **Knight Seby (`n`, Young Italian Boy)**:
      - Signature sentences: *"Dimmi papino!"*, *"Papinoooooo!!!"*, *"Ti manco tantissimo, papino!"*, *"My body, my choice!"* (in English), *"Mi scappa la cacca!"*
      - Higher-probability non-verbal reactions (`kind: 'mumble'`): *"Mmh-hmm! Ehehe!"* (`voice-n-hmm.mp3`) & *"Pff... uffaaa!"* (`voice-n-sbuffo.mp3`).
    - **Bishop Ale (`b`, 10-Year-Old Italian Boy Wizard)**:
      - Signature sentences: *"Agli ordini, Signore!"*, *"Ti manco tantissimo, papino!"*, *"Papino, qual è il più forte?"*, *"Papino, quando mi compri un regalo?"*, *"Cafonazzo!"*
      - Higher-probability non-verbal reactions (`kind: 'mumble'`): *"Mmh-hmm... vediamo!"* (`voice-b-hmm.mp3`) & *"Pff... ma dai!"* (`voice-b-sbuffo.mp3`).
    - **King Riccardo (`k`), Rook Pupurabbu (`r`), Pawn Puffin (`p`)**: Added high-probability non-verbal `voice-{k,r,p}-hmm.mp3` clips alongside `voice-{k,r,p}.mp3`.
  - **3-Layer Anti-Repetition Voice Selector (`AudioListener.selectVoiceVariant`)**:
    - First selection of each character plays a full `signature` quote; subsequent selections blend higher-probability `mumble` clips (`hmm-hmm` / `sbuffo`, `55%–65%` for heroes, `78%` for Puffin pawns) with a Fisher-Yates shuffled `signature` deck (`signatureDeckByType`) and a per-type ring buffer (`recentVariantIdsByType`) so **no clip ever plays twice in a row**.
    - Emits `VOICE_LINE_SPOKEN` so `HudListener` displays the exact randomized quote spoken in the HUD speech bubble.
  - **Pawn Hover Anti-Spam (`BoardInteractionView.js`, `AudioListener.playHoverSfxWithAntiSpam`)**: Added a per-piece-type hover cooldown (`2800ms` for pawns `'p'`, `950ms` for other pieces), softened the Puffin chirp pitch/volume, and alternated repeated hovers with a soft WebAudio `"hmm-hmm / sbuffo"` breath (`synthSoftSbuffo`).

## [0.3.34] - 2026-10-11

- 🔄🛡️🌐 **Zero-Split-Brain PWA Cache & Version Drift Detector (`sw.js`, `index.html`, `src/listeners/HudListener.js`, `tests/core.test.mjs`)**:
  - **No Split-Brain / No "Lying Version Badge" (`HudListener.js`)**: `this.appVersion` strictly reflects `APP_VERSION` from `Registry.js` (the version of the JavaScript code actually running in memory). `fetch('./VERSION', { cache: 'no-store' })` now acts as a **Version Drift Detector** (`handleRemoteVersionCheck(remoteRaw)`): if the remote `VERSION` on GitHub Pages differs from the running `APP_VERSION`, it never overwrites `this.appVersion`; instead it purges stale Service Worker caches, triggers a one-time auto-reload (`sessionStorage` guard per version), and displays `${this.appVersion} ➔ 🔄 ${remoteTag}` on `#hud-version-tag`.
  - **Bypass GitHub Pages 10-Minute HTTP Disk Cache for Code (`sw.js`, `index.html`)**:
    - Never caches `/VERSION` (`fetch(event.request, { cache: 'no-store' })`).
    - Uses `{ cache: 'no-cache' }` for `.html`, `.js`, and `.webmanifest` both during Service Worker `install` precaching and online `fetch` requests so the browser always validates `ETag` / `If-None-Match` against GitHub Pages while preserving offline fallback for 3D `.glb` / `.mp4` / `.mp3` assets (`carchess3d-offline-v22`).
    - Registers `./sw.js` with `{ updateViaCache: 'none' }` and triggers `reg.update()` on load.

## [0.3.33] - 2026-10-11

- 🧪🖼️🔧 **Fix White 3D GLB Boxes on Ale 1 & Re Riccardo in `showcase/index.html` + TDD WebGL Context Budget Guard (`showcase/index.html`, `tests/showcase-webgl.test.mjs`)**:
  - **Root Cause (`kMaxActiveWebGLContexts = 16` in Chromium/Blink)**: `showcase/index.html` displays **18 character cards** (`6 Carlesso + 6 Classic + 6 Swamp`). Previously, `makeView()` instantiated a separate `new THREE.WebGLRenderer({ antialias: true, alpha: true })` per card (`18` total). Because Chromium enforces a hard cap of **16 active WebGL contexts per page**, creating contexts `#17` (*Draghessa della Palude*) and `#18` (*Zenzy Pan di Zenzero*) automatically evicted the 2 oldest WebGL contexts — **Card `#0` (`Ale 1`)** and **Card `#1` (`Re Riccardo`)** — turning their `<canvas>` elements into blank white rectangles (`WARNING: Too many active WebGL contexts. Oldest context will be lost`).
  - **Single Shared `THREE.WebGLRenderer` + 2D Canvas Blitting (`showcase/index.html`)**: Replaced per-card WebGL contexts with a single shared `sharedRenderer` (`1` WebGL context for the entire page) that renders each visible card's `scene` + `camera` and blits to the card's lightweight 2D `<canvas>` (`ctx.drawImage(sharedRenderer.domElement, ...)`), keeping pointer drag, auto-rotation, faction tinting, and fullscreen working identically across all 18+ cards with zero context loss.
  - **TDD Regression Suite (`tests/showcase-webgl.test.mjs`)**: Added automated tests verifying that (1) every 2D image and 3D `.glb` referenced in `showcase/index.html` exists and has a valid `glTF` v2 binary header, and (2) `makeView()` never instantiates `new THREE.WebGLRenderer` per card (`webglRendererInstantiations.length === 1`).

## [0.3.32] - 2026-10-11

- 📱🔥♟️ **Pixel 10 & Samsung Galaxy Tab S10 Ultra 3D WebGL Fix + Mobile Lite 3D Mode + Multi-Device Simulation (`main.js`, `PieceView.js`, `VFXPoolView.js`, `ZurichSwampView.js`, `HudListener.js`, `Registry.js`, `index.html`, `sw.js`, `scripts/simulate_mobile_devices.py`, `docs/spec/SPEC.md`)**:
  - **Root-Cause Fix for Dead/White 3D Viewport on Google Pixel 10**:
    - **Bypassed `EffectComposer` + `UnrealBloomPass` (`13 × HalfFloatType RGBA16F` FBOs) on Mobile & Tablet GPUs (`main.js`, `Registry.isMobileOrTabletDevice`)**: On Pixel 10 (Tensor G5 / PowerVR DXT GPU) and Android tablets, `UnrealBloomPass` allocates 13 `HalfFloatType` render targets that either overflow to `Inf`/`NaN` in the 5-mip Gaussian blur chain (which `OutputPass` ACES Filmic tone-mapping clamps to solid `#FFFFFF` pure white across the entire `<canvas>`) or trigger `webglcontextlost` (which Android Chrome composites as a dead white canvas while the HTML HUD bottom bar remains responsive). Mobile and tablet devices now render directly via `renderer.render(scene, camera)` with `renderer.setClearColor(0x0b1528, 1.0)` and `canvas#game-canvas { background-color: #0b1528; }` (overrideable via `?bloom=1`).
    - **Removed Hidden Three.js Transmission Pass (`VFXPoolView.js`)**: Replaced `THREE.MeshPhysicalMaterial({ transmission: 0.65 })` on `amethyst_ruby_shards` with `THREE.MeshStandardMaterial({ transparent: true, opacity: 0.84 })`, eliminating Three.js's hidden full-screen multisampled `HalfFloatType` `_transmissionRenderTarget` allocation.
    - **Mobile Lite 3D Mode (`PieceView.js`, `Registry.shouldUseMobileLite3D`)**: On smartphones (`isMobilePhone`), `PieceView` defaults to **Mobile Lite 3D Mode** (`mobileLite3D = true`, overrideable with `?glb=1` for full `.glb` models or `?lite3d=1` on any device), rendering the sculpted 3D Faction Pedestals, 3D Columns, Double-Sided 2D Cutie Portrait Medallions, and 3D Role Crowns in `< 15 ms` without downloading or cloning `30 MB` / `850k` vertices of `.glb` meshes.
    - **Deduplicated Startup Piece Syncs & Guarded Custom Vertex Shaders (`main.js`, `PieceView.js`, `ZurichSwampView.js`)**: Pre-seeded `pieces.whiteFamily` and `pieces.rivalSetMode` before `pieceView.init()` and added `_lastSyncSignature` deduplication in `syncPiecesFromManager()` so startup builds the 32 pieces once instead of 4–5 times; skipped `injectLocomotionShader` (`onBeforeCompile`) and dynamic corner brazier `PointLight`s on mobile phones; added `webglcontextlost` / `webglcontextrestored` automatic recovery.
  - **Mobile Bottom Bar Flexbox Fix (`HudListener.js`)**: Added `flex-shrink: 0` on `.hud-status-card` and `min-width: 0; overflow-x: auto` on `.hud-actions-dock` under `#carchess-hud-root.mobile-simplified` so the status card is never squished by the action dock buttons.
  - **Automated Multi-Device Playwright WebGL Simulation (`scripts/simulate_mobile_devices.py`)**: Verified **Google Pixel 10** (`412×915` Portrait & `915×412` Landscape, both Default Lite 3D Mode and `?glb=1` Full GLB Mode) and **Samsung Galaxy Tab S10 Ultra** (`SM-X920`, `1480×925` Landscape & `925×1480` Portrait) with automated Not-White / Not-Black / WebGL `readPixels` checks (`tmp/device_simulation/simulation_report.json`).
  - **Service Worker Cache Bump (`sw.js`)**: Bumped cache to `carchess3d-offline-v20` and included postprocessing modules in `PRECACHE_URLS`.

## [0.3.31] - 2026-10-11

- 🔥🥁🎻 **Fiery, Fast-Paced, Suspenseful Combat Soundtrack — Lyria 3 Orchestral-Rock Track + 152 BPM D-Minor Phrygian WebAudio Sequencer (`assets/audio/combat-suspense.mp3`, `src/listeners/AudioListener.js`, `sw.js`, `tests/voices_idle.test.mjs`)**:
  - **Lyria 3 Fiery Duel Soundtrack (`assets/audio/combat-suspense.mp3` & `.txt`)**: Generated a `30.8s` `152 BPM` D-Minor Phrygian orchestral-rock combat track via Google Lyria 3 (driving staccato string ostinato, thunderous Taiko war drums, heroic brass stabs, electric cello suspense, and embedded ID3v2.3 metadata). Automatically triggers on `BATTLE_STARTED` cycling through 4 dramatic phrase cue points (`0.0s, 7.6s, 15.2s, 22.0s`).
  - **152 BPM (`98ms` 16th-Note) WebAudio Suspense Sequencer (`AudioListener.startCombatMusic`)**:
    - Opens with a Netflix-style **"TUDUM" double sub-bass punch** + Phrygian minor-second brass swell (`synthCombatEntryBraaam`).
    - Drives a relentless 16th-note D-Minor Phrygian ostinato (`D3 - F3 - G3 - G#3 - A3 - Bb3 - C#4 - D4`), Taiko war-drum downbeats, metallic sword/halberd off-beat rim clangs, and a rising suspense lead (`A4 -> A5`) that accelerates in Act 2 (*La Scazzottata*) and erupts into a 6-note K.O. climax chord in Act 3.
  - **Smooth `3.5s` Sliding-Window Audio Cross-Fade (`AudioListener.stopCombatMusic`)**: On `BATTLE_COMPLETED`, instead of cutting the combat soundtrack abruptly, smoothly ramps down the combat music volume along the exact same `3.5s` `smoothstep` sliding window (`?transitionSeconds=3.5`) as the visual Netflix-to-Zurich transition while restoring the peaceful theme song if active.

## [0.3.30] - 2026-10-11

- 👑🧬🤖 **Re Riccardo Adversarial Biometric Likeness Generator + Critic Loop (`tools/model-pipeline/king/adversarial_riccardo_likeness.py`, `graft_papino_face_3d.py`, `assets/models/king-riccardo.glb`, `niccolo-game-design` Skill)**:
  - **Root-Cause Diagnosis via `nano-banana-ricc` Ground-Truth Photos**: Compared the 5 reference photos in `nano-banana-ricc` against the previous `king-riccardo.glb` / `front.png`, identifying why likeness was low: the old portrait had dark brown hair and a clean-shaven generic face instead of Riccardo's **deep-set hooded warm brown smiling eyes** under a masculine brow ridge with a vertical glabella crease and **signature small white tuft on his left eyebrow**, **broad rounded fleshy nose tip**, **thin wide affectionate smile**, **very short 2-to-3-day light white/silver stubble (`barbetta cortissima di 2-3 giorni`)**, and **short silver-white / salt-and-pepper temples**.
  - **Photo-Anchored Template Seeding (`build_photo_seeded_template`)**: Seeded the King figurine head oval directly with Riccardo's frontal photograph from `riccardosouthafrica.png` and harmonized studio lighting + silver temples via `gemini-3-pro-image-preview` alongside all 5 `nano-banana-ricc` photos, locking crown (`y <= 212`) and collar (`y >= 490`) without double-exposure ghosting.
  - **Piecewise-Linear 3D Landmark Calibration + Hybrid Side-Cylindrical Azimuth Unwrapping (`graft_papino_face_3d.py`)**: Calibrated `row_2d(y)` around `y_eye_3d = +0.1928m <-> row = 320.0` (`scale_y_upper = 1240.0 px/m`, `scale_y_lower = 892.0 px/m`), sculpted the 3D head mesh (`nose_shorten = 0.46`, `nose_widen = 0.26`, `brow_overhang = 0.0080`, `jaw_slim = 0.045`), unwrapped side-cheek UVs cylindrically via $\theta = \text{atan2}(\Delta x, \Delta z)$ to eliminate planar fold-over/stretching at `+32°` and `+72°`, and recolored non-shell hair texels inside exact barycentric triangles using a smooth luminance/warmth ramp.
  - **Multimodal Adversarial Critic (`gemini-3.1-pro-preview` + `riccardo-likeness-critic`)**: Iteratively evaluated 6-panel biometric critique sheets (`tools/model-pipeline/king/out/adversarial_likeness/adversarial_iter_1..3.png`), raising overall 3D biometric likeness from **`4.1/10`** (Iter 0 baseline) to **`9.1/10`** (`adversarial_history.json`).

## [0.3.29] - 2026-10-11

- 🎞️🌊🏰 **Smooth `3.5s` Sliding-Window Transitions Into & Out Of Netflix Cinema (`VFXPoolView.js`, `VeoCinemaView.js`, `ZurichSwampView.js`, `tests/combat.test.mjs`)**:
  - **Continuous `3.5s` Exit Sliding Window (`?transitionSeconds=3.5`, `4.80s -> 8.30s`)**: Eliminated the abrupt film cut and instant world snap when a duel finishes. Instead, starting during the final `1.20s` of the K.O. climax (`4.80s .. 6.00s`) and gliding seamlessly for `2.30s` after `BATTLE_COMPLETED` (`6.00s .. 8.30s`), a unified `combatBlend` (`1.0 -> 0.0`) drives the camera, Netflix Cinema screen, chessboard, and Zurich Swamp diorama in lockstep.
  - **Smooth Entry Sliding Window (`?entrySeconds=1.10`)**: Entering a capture duel smoothly ramps `combatBlend` (`0.0 -> 1.0`) over `1.10s` as the camera glides in, the diorama dissolves, and the "Cinema Vecchio" expands into the 16:9 Netflix XXL theatre.
  - **Netflix -> "Cinema Vecchio" 3D Convergence & Alpha Cross-Fade (`VeoCinemaView.js`)**: Keeps the Veo MP4 film playing during the exit window while cross-fading its canvas alpha from `100%` (`1.0`) down to `0%` over the classic idle crest (`drawIdleCrestFrame`), simultaneously zooming the 3D screen out (`lerpVectors` / `slerpQuaternions`) back to `(0, 3.65, -10.8)` (`scale = 0.65`) between the Grossmünster Twin Towers and morphing the bezel color from Netflix Red (`#E50914`) back to Zurich Gold (`#e6b84a`).
  - **Simultaneous Rematerialization of Swamp, Zurich Skyline & Chessboard (`ZurichSwampView.js`)**: Added `setCombatBlend(blend)` to smoothly interpolate the 64 chessboard squares (`opacity: 0.10 <-> 1.00`) and all surrounding diorama meshes (`Swamp`, `Zurich Skyline`, `Swiss Alps`, `Corner Braziers`, `Under-Board Foundation` with `opacity: 0.0 <-> 1.0`, `depthWrite = false` during the cross-fade) while gently pulling the camera back from the two contenders to the player's saved pre-combat view.

## [0.3.28] - 2026-10-11

- 💎💙💜🐉 **`b_x_q` Alfiere Ale vs Regina Kate — *"Teca Sacra di Tanzanite Blu-Viola"* alla Cavalieri dello Zodiaco (`assets/battles/videos/b_x_q.mp4`, `assets/battles/keyframes/b_x_q_{start,end}.png`, `BattleMatrix36.js`, `Registry.js`, `VFXPoolView.js`, `video_audit.yaml`, `docs/spec/SPEC.md`)**:
  - **Saint Seiya Tanzanite Crystal Case (`firstFrame` + `lastFrame` Veo 3.1)**:
    - **`b_x_q_start.png` (`t = 0.0s`)**: Bishop Ale raises his glowing crystal wand with his red shoulder dragon, projecting a swirling ribbon of pleochroic **blue-violet and electric azure-blue Tanzanite** light around Queen Kate standing freely on the right.
    - **`b_x_q_end.png` & `b_x_q.mp4` (`t = 2.5s..8.0s`)**: A towering translucent hexagonal **Tanzanite Crystal Case (`Teca di Tanzanite`)** glowing with both deep purple-violet and vivid azure-blue reflections crystallizes around Mamma Kate, holding her safely petrified inside for two seconds before Ale gently slides the intact Tanzanite Teca into the emerald swamp moat while waving affectionately (because Ale would never hurt his mom!).
  - **Archived `b_x_q_v1` in [`assets/battles/archive/videos/b_x_q_v1_shield_shatter_no_tanzanite_coffin.mp4`](assets/battles/archive/videos/b_x_q_v1_shield_shatter_no_tanzanite_coffin.mp4)** and documented both versions in [`assets/battles/video_audit.yaml`](assets/battles/video_audit.yaml).
  - **3D In-Game Choreography (`VFXPoolView.js`, `Registry.js`, `BattleMatrix36.js`)**: Added `ale_tanzanite_coffin_for_mom` Easter Egg so the 3D `crystalCase` shimmers between royal blue-violet (`0x5e35b1`) and electric azure-blue (`0x00b0ff`) and carries Queen Kate intact into the swamp.

## [0.3.27] - 2026-10-11

- 📱✨♟️ **Mobile Simplified UX ("Easy Adopter" Mode for Pixel 10 & Smartphones — Desktop & iPad 100% Untouched) (`HudListener.js`, `Registry.js`, `BoardInteractionView.js`, `VFXPoolView.js`, `main.js`, `index.html`, `manifest.webmanifest`, `docs/spec/SPEC.md`)**:
  - **Mobile Phone Detection (`isMobilePhoneViewport`)**: Activates exclusively on smartphone viewports (`shortSide < 600 && longSide <= 1024`, or `?mobile=1`, disabled with `?desktop=1`/`?mobile=0`), keeping Desktop and iPad/Tablet (`768×1024+`) 100% identical to before.
  - **Fixed Mobile Touch & Scroll Blockers (`index.html`, `BoardInteractionView.js`)**:
    - Moved `touch-action: none` from `html, body` to `canvas#game-canvas` and added `touch-action: pan-y` on modal cards so mobile Chrome/Safari never freezes touch scrolling inside modals.
    - Increased touch-tap tolerance from `8px` to `18px` (`event.pointerType === 'touch' ? 18 : 8`) and added a multi-touch pinch guard (`activePointers`) so thumb taps on high-DPI phones (e.g., Pixel 10) select and move squares reliably on the first tap.
  - **Portrait ➔ Landscape Friendly Prompt (`#hud-rotate-overlay`)**: When held vertically (`isPortraitOrientation`), displays a friendly `"Rotate your phone to Landscape 🔄📱"` card for 16:9 battle movies and full-width board framing, with a `"📱 Play in vertical anyway →"` escape button if rotation lock is active, and auto-dismisses when rotated to landscape.
  - **1-Tap Quick Start Setup (`#hud-mobile-quick-setup`)**: Replaces the 8-input desktop setup form on phones with an instant 1-screen card (**`🧑 Guest (Papino's Team)` vs `🤖 Computer (Classic Rivals)`**, 3 quick pills `🤖 Easy` / `🧠 Medium` / `👥 2P`, giant **`▶️ PLAY NOW! ✨`** button, and optional `"⚙️ Advanced options"` toggle).
  - **Progressive Camera Flow (`Alto-Basso` ➔ `3D` on First Attack)**: Mobile matches start in **Easy Top-Down (`Alto-Basso`)** view (`topDownCamera = true`) for effortless opening moves, and **automatically unlock and transition to full 3D panoramic mode** (`topDownCamera = false` via `CAMERA_VIEW_REQUESTED` in `VFXPoolView`) upon the first capture (`BATTLE_STARTED` ➔ `BATTLE_COMPLETED`), with a persistent 1-tap `📐 View: Top` ⇄ `🎬 View: 3D` button in the sleek 1-line mobile dock.

## [0.3.26] - 2026-10-11

- 🎬🕵️‍♂️🏆 **Full 36-Video Adversarial Critic Audit, Veo 3.1 `firstFrame` + `lastFrame` Regeneration & Historical Video Archive (`assets/battles/video_audit.yaml`, `assets/battles/archive/`, `assets/battles/videos/`, `assets/battles/keyframes/`, `docs/spec/SPEC.md`)**:
  - **36/36 Temporal Contact-Sheet Audit by Adversarial Video Critic**: Extracted 4-frame (`0.5s, 2.8s, 5.2s, 7.4s`) temporal contact sheets across all 36 battle videos and scored every video against a `6.5 / 10` quality threshold.
  - **Dedicated Archive Directory (`assets/battles/archive/videos/` & `assets/battles/archive/keyframes/`) + `assets/battles/video_audit.yaml`**:
    - Preserved all **27 historical/rejected video takes** in [`assets/battles/archive/videos/`](assets/battles/archive/videos/) (separate from active [`assets/battles/videos/`](assets/battles/videos/)) and documented every active and archived take in [`assets/battles/video_audit.yaml`](assets/battles/video_audit.yaml) (`911` lines) with `nb_prompt`, `veo_prompt`, `critic_score`, `critic_verdict`, `critic_reason`, and `human_rescue_note`.
  - **Regenerated 21 Battle Videos with Vertex AI Veo 3.1 `firstFrame` (`<id>.png`) + `lastFrame` (`<id>_end.png`) + Audio (`36/36 PASS`, avg score `8.8 / 10`)**:
    - **`n_x_p` (*Sacro Acquarius*)** (`9.5/10`): Start frame (`n_x_p_start.png`) with Seby clasping both hands high above his head shouting *"Per il Sacro Acquarius!"* and healthy Puffin on right (no statue/ice yet) → Aquarius Maiden materializes behind Seby and shoots freezing water → End frame (`n_x_p_end.png`) with Puffin petrified cyan-blue deep behind the Ice Coffin.
    - **`k_x_q` (*Kiss of Death*, Throne-Free)** (`9.4/10`): Start frame (`k_x_q_start.png`) with standing Riccardo holding a gothic Black Rose to his lips and vibrant alive Kate on right (zero throne) → blows necrotic purple-crimson kiss mist → End frame (`k_x_q_end.png`) with Kate withering into an ashen-pale lifeless gothic figurine.
    - **Eliminated Duplicate Clones, Vanishing/Teleporting Rook Towers & Bizarre Morphs (`9.0–9.3/10`)**: Regenerated `k_x_p` (fixed duplicate Puffin clone during Fireball), `k_x_b` (fixed duplicate Ale clone during Meteor Swarm), `k_x_r` (fixed vanishing/reappearing rook tower & King jumping into swamp), `q_x_q` (fixed wrong Black-Queen winner), `q_x_b` (fixed duplicate dragon & Ale clones), `q_x_r` (fixed vanishing/reappearing rook tower), `b_x_k` (fixed King morphing into crowned green dragon), `b_x_n` (fixed horse morphing into giant dragon + `"1 G"` golden letters), `b_x_r` (fixed teleporting rook tower), `b_x_p` (fixed 2nd Puffin clone + balloon chest), `n_x_k` (fixed vanishing horse & Seby wearing King's cloak), `n_x_r` (fixed blurry duplicate Seby clone & missing tower), `r_x_k` (fixed duplicate mini-Pupurabbu clone & breakfast pancake morph), `r_x_q` (fixed Pupurabbu wearing Queen Kate's corset dress), `r_x_b`, `r_x_r`, `r_x_p`, `p_x_q` (fixed tall humanoid Puffin morph), `p_x_n`, `p_x_r`, and `p_x_p`.
  - Updated [`docs/spec/SPEC.md`](docs/spec/SPEC.md) to document the `firstFrame` + `lastFrame` Veo 3.1 pipeline, `assets/battles/video_audit.yaml`, and `assets/battles/archive/`.

## [0.3.25] - 2026-10-11

- 👑🔄 **Re Riccardo 3D Side-Profile Preview (`tools/model-pipeline/king/graft_papino_face_3d.py`, `out/papino_face_graft_preview.png`)**:
  - Updated Panel 4 of `papino_face_graft_preview.png` to display the `+75°` 3D side profile of `assets/models/king-riccardo.glb`, confirming clean-shaven, no-glasses 3D consistency alongside the Mode B `2048×1024` Face-Grafted front view.

## [0.3.24] - 2026-10-11

- 👑🫏📚 **2D→3D Pipeline (Mode A & Mode B) Applied to Re Riccardo (`king-riccardo.glb`) & Ciuchino (`knight-swamp-asinello.glb`) + `niccolo-game-design` Skill `v0.2.0`**:
  - **`niccolo-game-design` Skill (`v0.2.0`)**: Added [`references/2d-to-3d-sdf-uv-baking.md`](.agents/skills/niccolo-game-design/references/2d-to-3d-sdf-uv-baking.md) documenting **Mode A** (*Full 2D→3D SDF Visual-Hull + Relief Sculpting + Seamless `1024×1024` UV Baking*) and **Mode B** (*Dual-Chart `2048×1024` UV Face-Grafting & Laplacian Multi-Band Skin Blending onto Existing 3D Meshes*).
  - **Re Riccardo Turnaround Sheet (`tools/model-pipeline/king/side.png`, `king_turnaround_sheet.png`, `generate_side_noglasses.py`)**: Fixed prompt bug in [`tools/model-pipeline/king/generate_side_noglasses.py`](tools/model-pipeline/king/generate_side_noglasses.py) and regenerated the 90° side profile (`side.png`) and 4-panel turnaround sheet (`king_turnaround_sheet.png`) so Riccardo is 100% clean-shaven, without glasses, and wearing the matching royal blue velvet cape with white ermine collar.
  - **Re Riccardo 3D — Mode B Face-Grafting (`assets/models/king-riccardo.glb`, `tools/model-pipeline/king/graft_papino_face_3d.py`)**: Built [`tools/model-pipeline/king/graft_papino_face_3d.py`](tools/model-pipeline/king/graft_papino_face_3d.py) to upgrade `king-riccardo.glb` (`4.1 MB`, `96,958` triangles) with a **Dual-Chart `2048×1024` UV Atlas** — preserving the original `TRELLIS.2` texture (`u ∈ [0, 0.5]`) for the crown, hair, ears, ermine cape, sceptre, orb, and `"KING RICCARDO"` pedestal while assigning a continuous `1024×1024` Planar Face Chart (`u ∈ [0.5, 1.0]`) mapped from `tools/model-pipeline/king/front.png` with Laplacian multi-band skin harmonization.
  - **Asinello Chiacchierone 3D — Mode A SDF + 40-Tooth Relief Reconstruction (`assets/models/swamp/knight-swamp-asinello.glb`, `tools/model-pipeline/swamp/reconstruct_asinello_3d.py`)**: Reconstructed `knight-swamp-asinello.glb` (`2.1 MB`, `16,508` triangles, `1.35m` height, `min.y == 0.0`) from `assets/characters/knight-swamp-asinello.jpg` with 3D embossed 40-tooth Eddie Murphy smile, golden onion medallion, dorsal mane, and seamless `1024×1024` UV atlas.

## [0.3.23] - 2026-10-11

- 🍿🔴🎬 **Netflix Cinema 16:9 Look & Feel — Minimal `1.1%` `#E50914` Red Bezel, `"N"` Badge, Scrubber Bar & Zero-Distortion `16:9` Camera Alignment (`VeoCinemaView.js`, `VFXPoolView.js`)**:
  - **Minimal `1.1%` Netflix Red (`#E50914`) Cinema Bezel**: Replaced the thick `0.32m` yellow frame, corner cylinders, and top crown hook (`6.12m` tall, which compressed the outer silhouette toward `4:3`) with a razor-thin `0.05m` (`~1.1%`) `#E50914` Netflix-red neon bezel on a matte obsidian-black theatre casing (`8.12m × 4.62m`).
  - **Netflix Cinema HUD Overlay (`drawNetflixCinemaOverlay`)**: Added the iconic red **`N`** ribbon badge, `CARCHESS CINEMA · 16:9 UHD` series header, episode title, and a `4px` `#E50914` bottom timeline scrubber bar with glowing playhead dot.
  - **True `16:9` Rectangular Projection (`camera.quaternion`)**: Aligned `VeoMagicCinemaMirror` strictly parallel to the actual camera image plane (`mirrorRoot.quaternion.copy(this.camera.quaternion)`) along `camFwd`/`camUp`, eliminating horizontal yaw foreshortening and vertical pitch trapezoid distortion so the `1280×720` (`16:9`) Veo videos always render as a true `16:9` rectangle from any camera angle.

## [0.3.22] - 2026-10-11

- 🎬♟️✨ **Cinema XXL (`+75%`, `1.75x`) Veo Combat Video & 90% Transparent Chessboard (`opacity = 0.10`) (`ZurichSwampView.js`, `VFXPoolView.js`, `tests/combat.test.mjs`)**:
  - **90% Transparent Chessboard During Combat (`opacity = 0.10`, *"che si veda appena"*)**: In `ZurichSwampView.setCombatCinemaMode(true)`, the 64 black and white chessboard tiles switch to 90% transparency (`opacity = 0.10`, `depthWrite = false`, flattened to `0.02` wafer height) while hiding the solid stone foundation, island, and outer chunky border rims beneath the board, so the chessboard becomes a subtle ghost grid and all 3D chess characters remain at **100% solid opacity** on top.
  - **Cinema XXL (`+75%`, `videoBoost = 1.75`) Veo Backdrop**: Enlarged the 16:9 `VeoMagicCinemaMirror` by `+75%` (`defaultBoost = 1.75`) and positioned its plane strictly behind all 4 corners of the altar (`backdropDist = Math.max(5.6, maxAltarCornerDist + 0.65)`), so the video spans across the screen with minimal black side bars and extends all the way underneath the 90%-transparent chessboard.
  - **Live URL Tuning Parameters**: Added `?videoBoost=1.75` and `?boardAlpha=0.10` query parameters (plus `swampView.setCombatBoardAlpha(alpha)` and `vfxView.combatVideoBoost`) for instant live experimentation.

## [0.3.21] - 2026-10-11

- 🇬🇧🇮🇹👵 **English Default UI for Nonna Susan & One-Click `🇬🇧 EN` / `🇮🇹 IT` Flag Switcher (`HudListener.js`, `Registry.js`, `AIWorkerManager.js`, `BoardInteractionView.js`, `index.html`, `docs/spec/SPEC.md`)**:
  - **English Default Language (`lang = 'en'`)**: Set the game's default UI language to English so Nonna Susan can immediately read every screen, modal, tooltip, and toast in English out of the box (also added `Nonna Susan 👵🇬🇧` to the player profile selector).
  - **Dedicated `🇬🇧 EN` and `🇮🇹 IT` Flag Buttons**: Added side-by-side clickable British (`🇬🇧 EN`) and Italian (`🇮🇹 IT`) flag pills in three places:
    1. Top-right of the **Startup Game Setup Modal** (`#hud-setup-flag-en`, `#hud-setup-flag-it`) so players can switch languages before starting a match.
    2. Persistent **Bottom Action Dock** (`#hud-flag-en`, `#hud-flag-it`) with active gold border highlight.
    3. **Top HUD Bar** (`#hud-top-flag-en`, `#hud-top-flag-it`).
  - **Complete UI Localization**: Translated all previously Italian-only strings in `I18N.en` / `I18N.it` (Setup modal sides, factions, controls, hot-seat description, gallery/video/matrix/skeleton/swamp/trackpad buttons, WOW panel sliders, 6×6 Battle Matrix Explorer headers, FEN/PGN modal, AI hints, and capture preview hover toasts).
  - **All Sounds & Voice Lines Preserved**: Character voices (`AudioListener.js`, `VOICE_LINES.audioUrl`, `VOICE_LINES.quote`) and sound effects remain 100% untouched.

## [0.3.20] - 2026-10-11

- 🎥♟️✨ **Combat Camera ~5×5 Board Framing, 100% Visible 16:9 Veo Backdrop & Production Skeleton Removal (`VFXPoolView.js`, `VeoCinemaView.js`, `SkeletonRigHelper.js`, `PieceView.js`, `HudListener.js`, `justfile`)**:
  - **~5×5 Chessboard Combat Zoom**: Widened `VFXPoolView.updateCameraOrbit` (`dist = 4.90 - Math.sin(t * Math.PI) * 0.35`, `camY = 2.42 + Math.sin(t * Math.PI) * 0.16`, `targetY = 1.62`, `FOV = 45°`) so the combat camera frames roughly half the chessboard (~5×5 squares) around the two combatants while keeping neighboring pieces and board context visible.
  - **100% Unobstructed 16:9 Veo Video Backdrop**: Dynamically aligns `VeoMagicCinemaMirror` perpendicular to the camera sightline (`mirrorRoot.rotation.set(0, orbitAngle, 0)`) and scales it (`yBottom = Math.max(0.18, rayCenterY - 0.14 * hHalf)`, `yTopFrame = rayCenterY + 0.64 * hHalf`) so 100% of the 16:9 video and all 4 golden corner rosettes are visible behind the fighters from any camera angle without being clipped or covered by the top HUD bar or Skip pill.
  - **Yellow Skeleton Balls Removed in Production**: Removed the `else if (isMovingOrFighting)` override in [`src/views/SkeletonRigHelper.js`](src/views/SkeletonRigHelper.js) so yellow joint spheres and cyan bone sticks (`ArticulatedSkeletonRig`) stay strictly invisible (`rig.visible = false`) in production during idle, walking, and combat. Added opt-in debug/experiment flags (`?debug=1`, `?skeletons=1`, `?experiments=ToggleSkeleton,ShowSkeletons`, plus `just serve-debug` and `just serve experiments="ToggleSkeleton"`).

## [0.3.19] - 2026-10-11

- 🔄🐴 **Showcase 3D GLB Cache-Busting (`showcase/index.html`, `sw.js`)**:
  - Added `?v=0.3.19` cache-busting query strings to `knight-classic-cavallo.glb` and the Swamp Family `.glb` models in [`showcase/index.html`](showcase/index.html) and bumped `CACHE_NAME` to `carchess3d-offline-v11` in [`sw.js`](sw.js) so browsers immediately render the rotating `22,080`-triangle UV-textured Destriero Classico without stale cache hits.

## [0.3.18] - 2026-10-11

- 🐴🗿✨ **Destriero Classico (`knight-classic-cavallo.glb`) — High-Resolution Dual-Orthographic 3D Reconstruction & Seamless `1024×1024` UV Texture Atlas (`tools/model-pipeline/classic/reconstruct_knight_3d.py`)**:
  - Built [`tools/model-pipeline/classic/reconstruct_knight_3d.py`](tools/model-pipeline/classic/reconstruct_knight_3d.py) to reconstruct `assets/models/classic/knight-classic-cavallo.glb` (`22,080` triangles, `2.8 MB`, `1.35m` height, `min.y == 0.0`) directly from the aligned orthographic Front (`0°`) and Side (`90°`) views in `assets/characters/knight-classic-cavallo.jpg` using `rembg` neural segmentation, 3D Signed Distance Field visual-hull + gold-bridle relief carving, Taubin surface smoothing, and a boundary-matched `1024×1024` UV `baseColorTexture` PNG atlas.
  - Confirmed **Variante 1** (`assets/characters/knight-swamp-asinello.jpg`, rearing 40-tooth Eddie Murphy grin) as the official Swamp Knight (`Asinello Chiacchierone`) and removed the discarded second variant.

## [0.3.17] - 2026-10-11

- 💋🥀🌕 **`k_x_q` Kiss of Death Refinement — Throne-Free Open Moonlit Chessboard (`assets/battles/keyframes/k_x_q.png`, `assets/battles/videos/k_x_q.mp4`, `VFXPoolView.js`, `scripts/generate_nb_veo_battle.py`)**:
  - Regenerated `assets/battles/keyframes/k_x_q.png` and `assets/battles/videos/k_x_q.{mp4,webm}` **without any throne**: both King Riccardo and Queen Kate stand directly on the moonlit chessboard under the full moon as Riccardo blows the Black Rose Kiss of Death and Queen Kate withers into an ashen-pale lifeless gothic figurine swooning backward onto the board as her wand drops from her hand.
  - Hid `goldenThrone` and `dndPetrifyStatue` during `kiss_of_death_blight` in [`src/views/VFXPoolView.js`](src/views/VFXPoolView.js) so the 3D chessboard scene is also 100% throne-free.

## [0.3.16] - 2026-10-11

- 💋🥀💀 **`k_x_q` Re Riccardo vs Regina Kate — *"D&D Vampiric Kiss of Death & Avvizzimento Gotico"* (`Registry.js`, `BattleMatrix36.js`, `VFXPoolView.js`, `assets/battles/keyframes/k_x_q.png`, `assets/battles/videos/k_x_q.mp4`)**:
  - Updated `k_x_q` to a macabre-romantic Tim Burton / Gomez & Morticia Addams-inspired **D&D *Vampiric Kiss of Death / Blight* (`kiss_of_death_blight`)**: King Riccardo leans in under a full moon holding a Black Rose and blowing a stream of crimson-purple gothic hearts and black rose petals onto Queen Kate, who withers and drains of color into an ashen-pale lifeless gothic Corpse-Bride figurine slumped onto the Golden Throne.
  - Added 3D on-board Kiss of Death dip (`atkPitch = 0.36`, `defPitch = -0.68`) and progressive 3D withering/desaturation (`def.scale` shrinks thinner and mesh color drains to ashen-gray `0x6e6a7c`) in [`src/views/VFXPoolView.js`](src/views/VFXPoolView.js).
  - Regenerated `assets/battles/keyframes/k_x_q.png` and `assets/battles/videos/{k_x_q,n_x_p}.{mp4,webm}` from the updated Nano Banana 2.1 16:9 keyframes.

## [0.3.15] - 2026-10-11

- 🏺❄️🐧 **`n_x_p` Sacro Acquarius Refinement — Translucent Cyan-Blue Puffin Deep Behind the Ice Coffin (`VFXPoolView.js`, `assets/battles/keyframes/n_x_p.png`, `scripts/generate_nb_veo_battle.py`)**:
  - Updated the `n_x_p` Nano Banana 2.1 keyframe (`assets/battles/keyframes/n_x_p.png`) and prompt so the Pawn Puffin is tinted translucent icy cyan-blue (*"azzurro traslucido"*) and encased **deep behind** the thick refractive front wall of the hexagonal Ice Coffin (`Teca di Ghiaccio`), with internal reflections and hanging icicles in front of him.
  - Enhanced `createIceCoffinProp()` and `updateActiveChoreography()` in [`src/views/VFXPoolView.js`](src/views/VFXPoolView.js) to add a refractive front ice slab (`frontSlab`, `renderOrder = 19`, `depthWrite = false`), center the coffin directly over the defending Puffin (`def.position`), and tint the Puffin's 3D mesh translucent cyan-blue (`0x4dd0e1`, `emissive: 0x00bcd4`, `opacity: 0.68`) behind the ice wall before crumbling into diamond-ice crystals.

## [0.3.14] - 2026-10-11

- 🎬✨ **36/36 Complete 16:9 Battle Cinema Video Suite (`assets/battles/videos/`, `assets/battles/keyframes/`)**:
  - Upgraded the remaining 6 battle pairs (`r_x_k`, `r_x_q`, `r_x_b`, `p_x_n`, `p_x_r`, `p_x_p`) from old split-screen placeholders to `1280×720` 16:9 animated battle movies rendered directly from their cohesive Nano Banana 2.1 16:9 keyframes (`~1.0 MB` `.mp4` + `.webm`, `4.8s` duration so `scripts/generate_nb_veo_battle.py` will automatically replace them with 8s Veo 3.1 clips once the 30/day AI Studio Veo quota resets).
  - **All 36/36 (100%)** `Attacker × Defender` combinations now play cohesive 16:9 Nano Banana 2.1 / Veo 3.1 cinema scenes on the IMAX `VeoCinemaView` backdrop and in [`battles.html`](battles.html).

## [0.3.13] - 2026-10-11

- 🎬🍫💜🐟 **Stage 2 Veo 3.1 16:9 Battle Videos — Batch B (`q_x_*`, `r_x_*`, `p_x_*` — 30/36 Total) + Vertex AI Fallback (`assets/battles/videos/`, `scripts/generate_nb_veo_battle.py`)**:
  - Generated and bundled 10 additional 8-second `1280×720` 16:9 Veo 3.1 animated videos (`.mp4` + `.webm`) from their Nano Banana 2.1 initial keyframes:
    - **Queen Kate (`q_x_*` — 6/6 complete)**: `q_x_q` (`5.6 MB`), `q_x_b` (`4.7 MB`), `q_x_n` (`5.0 MB`), `q_x_r` (`4.2 MB`), `q_x_p` (`4.0 MB`) (plus `q_x_k` `5.8 MB`)
    - **Rook Pupurabbu (`r_x_*`)**: `r_x_r` (`3.3 MB`), `r_x_p` (`3.5 MB`) (plus `r_x_n` `2.8 MB`)
    - **Pawn Puffin (`p_x_*`)**: `p_x_k` (`3.3 MB`), `p_x_q` (`3.8 MB`), `p_x_b` (`2.9 MB`)
  - Added automatic Vertex AI (`veo-3.1-fast-generate-001` / `veo-3.1-generate-001` / `veo-3.0-fast-generate-001`) fallback in [`scripts/generate_nb_veo_battle.py`](scripts/generate_nb_veo_battle.py) when AI Studio daily per-model quota (`429 RESOURCE_EXHAUSTED`) is reached.

## [0.3.12] - 2026-10-11

- 🎬🏺🎲 **Stage 2 Veo 3.1 16:9 Battle Videos — Batch A (`n_x_p` Sacro Acquarius + All 6 `k_x_*` D&D Spells) (`assets/battles/videos/`)**:
  - Generated and bundled all 7 priority 8-second `1280×720` 16:9 Veo 3.1 animated videos (`.mp4` + `.webm`) from their Nano Banana 2.1 initial battle keyframes:
    - `n_x_p.{mp4,webm}`: **Knight Seby — Saint Seiya *"Sacro Acquarius & Teca di Ghiaccio Eterno"* vs Pawn Puffin** (`4.8 MB`) 🏺❄️
    - `k_x_p.{mp4,webm}`: **King Riccardo — D&D *"Fireball (`8d6` + Natural 20 `d20`)"* vs Pawn Puffin** (`3.7 MB`) 🔥🎲
    - `k_x_n.{mp4,webm}`: **King Riccardo — D&D *"Chain Lightning"* vs Knight Seby** (`3.7 MB`) ⚡⛓️
    - `k_x_b.{mp4,webm}`: **King Riccardo — D&D *"Meteor Swarm"* vs Bishop Ale** (`4.1 MB`) ☄️🌋
    - `k_x_r.{mp4,webm}`: **King Riccardo — D&D *"Summon Greater Comic Daemon with Pizza"* vs Rook Pupurabbu** (`3.1 MB`) 😈🍕
    - `k_x_k.{mp4,webm}`: **King Riccardo — D&D *"Disintegrate (`10d6+40`)"* vs Rival King Riccardo** (`3.2 MB`) 🟢✨
    - `k_x_q.{mp4,webm}`: **King Riccardo — D&D *"Flesh to Stone Petrification & Golden Throne"* vs Queen Kate** (`3.1 MB`) 🗿🚽👑

## [0.3.11] - 2026-10-11

- 📺🌌 **IMAX 16:9 Battle Cinema World Transformation (`ZurichSwampView.js`, `VeoCinemaView.js`, `VFXPoolView.js`, `docs/spec/SPEC.md`, `conductor/product.md`)**:
  - **Combat Theater Isolation (`ZurichSwampView.setCombatCinemaMode(true)`)**: Whenever a capture combat begins (`BATTLE_STARTED` / `WOW_ARENA_CLASH`), the surrounding 3D world clutter (`Grossmünster`, `ZurichSkyline`, `SwissAlps`, `EmeraldSwampMoat`, `WizardBraziers`, `SwampFireflies`, `SkyDome`) hides automatically and the background dims to a cinema theater void (`0x05070e`), keeping **only the 8×8 Chessboard (`CarvedStoneAltar`) and the 3D Chess Pieces** in the foreground.
  - **Near-Fullscreen 16:9 IMAX Veo Screen (`VeoCinemaView.js`)**: Expands `VeoCinemaView` into a giant IMAX backdrop directly behind the chessboard (`scale = 1.85×`) so the 16:9 Veo battle movie fills almost the entire viewport. Automatically restores the full Zurich Swamp world when combat finishes or is skipped.
- 🏺❄️ **Knight Seby vs Pawn Puffin (`n_x_p`) — Saint Seiya *"Sacro Acquarius & Teca di Ghiaccio Eterno"* (`Registry.js`, `BattleMatrix36.js`, `VFXPoolView.js`, `AudioListener.js`, `scripts/generate_nb_veo_battle.py`)**:
  - When Seby (`n`) captures a Pawn Puffin (`p`), he raises and clasps his hands high above his head like Aquarius Camus while a 3D celestial Water-Bearer Woman (`aquariusMaiden`) pours a freezing torrent from a giant Golden Amphora (`Anfora d'Oro`), encasing the Puffin inside an unbreakable diamond-blue Ice Coffin (`iceCoffin`, `sacro_acquarius_ice_coffin`) that crumbles into 64 pooled diamond-ice crystals (`diamond_ice_crystals`, `frozen_coffin_crumble`) with custom `synthSacroAcquariusIce()` WebAudio SFX.
- 🎲🔥 **King Riccardo ("Papino" `k`) — 6 Distinct Dungeons & Dragons (D&D) Spells (`k_x_*`) (`Registry.js`, `BattleMatrix36.js`, `CombatAnimationManager.js`, `VFXPoolView.js`, `scripts/generate_nb_veo_battle.py`)**:
  - Every King Riccardo (`k`) battle now casts a unique D&D spell in both the 3D on-board brawl and the 16:9 Nano Banana 2.1 + Veo 3.1 cinema pipeline:
    - `k_x_p` (vs Pawn Puffin): **D&D Fireball (`fireball`, 8d6 + Natural 20 d20)** 🔥🎲
    - `k_x_n` (vs Knight Seby): **D&D Chain Lightning (`chain_lightning`)** ⚡⛓️
    - `k_x_b` (vs Bishop Ale): **D&D Meteor Swarm (`meteor_swarm`, 9th-level)** ☄️🌋
    - `k_x_r` (vs Rook Pupurabbu): **D&D Summon Greater Comic Daemon (`summon_comic_daemon`, chubby red baby Balor with toy pitchfork & pizza slice)** 😈🍕
    - `k_x_k` (vs Rival King Riccardo): **D&D Disintegrate (`disintegrate`, 10d6+40 emerald laser ray turning the rival King into green arcane dust)** 🟢✨
    - `k_x_q` (vs Queen Kate): **D&D Flesh to Stone / Petrification + Golden Throne (`flesh_to_stone_petrification`)** 🗿🚽👑
  - Backfilled into [`docs/spec/SPEC.md`](docs/spec/SPEC.md), [`conductor/product.md`](conductor/product.md), and [`conductor/tracks/idle_animations_and_voices_20261011/spec.md`](conductor/tracks/idle_animations_and_voices_20261011/spec.md), and covered by unit tests in [`tests/combat.test.mjs`](tests/combat.test.mjs).

## [0.3.10] - 2026-10-11

- 😁🦷🐴 **Asinello Chiacchierone (`Knight`, `1.35m`) — Sorrisone Assurdo a 40 Denti (`tools/model-pipeline/swamp/gen_asinello_40teeth.py`, `assets/characters/knight-swamp-asinello.jpg`, `assets/characters/knight-swamp-asinello-2.jpg`)**:
  - Regenerated the Swamp Knight in two expressive comedy variants featuring a non-negotiable, ear-to-ear **40-tooth sparkling white grin**, raised cheeky eyebrow, crimson-and-gold tournament collar, and golden onion shoulder medallion, and updated the watertight 3D `.glb` mesh (`assets/models/swamp/knight-swamp-asinello.glb`, `18,288 tris`, `1.35m`).
- 🍪🌿🫒 **Zenzy Pan di Zenzero & Focaccina all'Italiana Promoted to Official Swamp Pawn (`Pawn`, `0.95m`)**:
  - Promoted Variant C (`assets/characters/pawn-swamp-zenzy.jpg` → `assets/characters/pawn-swamp-tappo.jpg`) to the primary Swamp Pawn across `SWAMP_REGISTRY`, `assets/families/swamp.json`, `showcase/index.html`, and `tools/model-pipeline/classic/gen_trellis2_batch.py`, and sculpted its 3D `.glb` (`assets/models/swamp/pawn-swamp-tappo.glb`, `17,068 tris`, `0.95m`) with white royal icing cuffs, purple gumdrop buttons, rosemary-focaccia morion helmet with Taggiasca olive crest, and candy-cane striped grissino halberd.
- 🐉🏰 **Perpetual 3D Helical Dragon Coiling on `Draghessa della Palude` (`src/views/PieceView.js`, `showcase/index.html`, `tools/model-pipeline/swamp/build_swamp_models.py`)**:
  - Upgraded `injectLocomotionShader` in `src/views/PieceView.js` and `makeView` in `showcase/index.html` (`uDragonCoilMode`) so the ruby-and-emerald Dragon on `rook-swamp-draghessa.glb` perpetually slithers, rotates, and constricts in a slow, inexorable 3D helical motion around the stationary mossy stone watchtower!
- 🧊🖥️ **GitHub Issue #20 for `pupurabbux` Home GPU TRELLIS.2 Batch Reconstruction (`tools/model-pipeline/classic/gen_trellis2_batch.py`)**:
  - Added PEP 723 inline `uv` script dependencies to `tools/model-pipeline/classic/gen_trellis2_batch.py` and filed [GHI #20](https://github.com/palladius/carchess3d/issues/20) so `pupurabbux` can reconstruct all 11 remaining high-res UV-textured Classic & Swamp `.glb` models in one command (`uv run tools/model-pipeline/classic/gen_trellis2_batch.py --family all`).

## [0.3.9] - 2026-10-11

- 🔍⚔️👑 **Merge `refactor_ui_cleanup_ux` (#19) — Auto-Zoom Close-Up Combat Camera, Zero Text Occlusion, Full-Screen 16:9 Video Backdrop, 3D King Capitulation & +50% Combat Duration (`VFXPoolView.js`, `VeoCinemaView.js`, `WowModeView.js`, `PieceView.js`, `HudListener.js`, `CombatAnimationManager.js`, `Registry.js`, `main.js`, `tests/combat.test.mjs`)**:
  - **Auto-Zoom Close-Up Combat Camera (`VFXPoolView.js`, `WowModeView.js`, `main.js`)**: During any capture or `⚔️ Lancia Sfida (Ale vs Seby)`, the camera smoothly auto-zooms (`FOV 46° → 30°`, `dist = 1.82m..2.10m`, `camY = 1.28m..1.44m`) onto the live midpoint of the two `1.22×`-scaled fighting pieces. Static board pieces on the active clash squares (`from`/`to`) are temporarily hidden via `pieceView.pieceBySquare`, while neighboring chess pieces (`"i pezzi vicini e poco altro!"`) remain visible around the brawl.
  - **Zero Text/UI Occlusion During Combat (`VFXPoolView.js`, `VeoCinemaView.js`, `HudListener.js`)**: Disabled the floating 3D `comicWordSprite` billboard (`CHARGE!` / `KAPOW!`) over the fighters' heads, lowered the dust cloud to pedestal level (`y = 0.16m`, `opacity = 0.35`), auto-hid the 310px `#hud-wow-panel` drawer during active combat, moved `#hud-comic-banner` to a compact top-right pill (`top: 52px; right: 14px`), and removed the bottom text box from the 16:9 cinema canvas.
  - **16:9 Video Discreet in Idle, Full-Screen Backdrop Behind the Board in Combat (`VeoCinemaView.js`)**: In `idle`, the 16:9 screen parks discreetly in the background (`scale = 0.65`, `(0, 3.65, -10.8)`); during `battle` or `checkmate`, it expands behind the auto-zoomed fighters (`scale = 1.85`, `(0, 2.45, -5.2)`).
  - **Spectacular 3D King Capitulation on Checkmate (`PieceView.js`, `VFXPoolView.js`, `BoardMapManager.js`, `HudListener.js`)**: `CHECKMATE` now triggers a 4.2s 3D Royal Capitulation sequence (`animateKingCapitulation` + `onCheckmate` golden throne & lightning VFX + celebratory jumps for surviving pieces) before displaying the Game Over modal.
  - **In-App 6×6 Family Capture Matrix & +50% Slower Combats (`Registry.js`, `CombatAnimationManager.js`, `HudListener.js`)**: Extended `DEFAULT_BATTLE_DURATION_MS` by +50% (`4000ms → 6000ms`, `videoEl.playbackRate = 1.0`) and added family selector tabs (`👨‍👩‍👦‍👦 Famiglia Carlesso`, `🏛️ Classici Carlessiani`, `🐸 Famiglia della Palude`) with asset badges (`📹 Veo MP4`, `🎞️ 3D MP4`, `🦴 GLB`, `🌟 Egg`).

## [0.3.8] - 2026-10-11

- 🎬🕵️‍♂️🤖 **Automated Daily UAT Playtest Suite & Adversarial Critic (`scripts/daily_uat_playtest.py`, `etc/prompts/daily_uat_prompt.md`, `just uat`, `just daily-uat`)**:
  - **Autonomous Adversarial Playtest & Screen Audit**:
    - Simulates an intelligent human tester playing as White against **CPU Easy** (Black) in headless Google Chrome via Playwright with WebGL hardware/software acceleration.
    - **Faction Orientation Verification**: Audits all 32 pieces on the 8×8 board to ensure White pieces strictly face North (`homeYaw ≈ 3.142 rad` towards rank 8) and Black pieces face South (`homeYaw ≈ 0.0 rad` towards rank 1), flagging any "all facing same direction" glitch.
    - **Black-Screen Audit**: Performs automatic luminance and contrast stddev pixel analysis on Camera 180° Inversion (`#hud-flip-btn`) and Top-Down view (`#hud-top-btn`) to guarantee the 3D scene remains vibrantly illuminated and never goes pitch-black.
    - **Interactive Subsystem Clicking**: Adversarially exercises 3D Articulated Skeletons (`#hud-skeletons-btn`), Shrek Swamp Moat party (`#hud-swamp-btn`), 6×6 Battle Matrix Modal (`#hud-matrix36-btn`), and WOW Mode Turntable & Arena (`#hud-mode2-btn`).
    - **Live Match Simulation**: Executes human opening moves (`e2-e4`, `g1-f3`, `d2-d4`), monitors Web Worker CPU Easy response latency (averaging ~460ms), triggers tactical captures, verifies the Comic Impact Banner (`#hud-comic-banner`), and exercises the cutscene skip button (`#hud-skip-btn`).
  - **Video Recording & Media Deliverables**:
    - Automatically records a full match session into `log/uat/uat_gameplay.mp4` and `uat_gameplay.webm` (strictly capped at `<= 60s` / 1 min duration) and renders an animated preview GIF `log/uat/uat_gameplay.gif`.
    - Captures 13 timestamped keyframe screenshots into `log/uat/*.png` and generates `log/uat/UAT_REPORT.md` and `uat_report.json`.
  - **GitHub Issue Integration (`gemini-uat`)**:
    - With `--publish-ghi` (or `just daily-uat`), creates or comments on a daily GitHub Issue titled `"Gemini UAT $YYYYMMDD"` (e.g. [`#18`](https://github.com/palladius/carchess3d/issues/18)) tagged with label `gemini-uat`, embedding the full UAT verification matrix, playability critique, and video assets.
  - **Customizable Prompt**:
    - Added [`etc/prompts/daily_uat_prompt.md`](etc/prompts/daily_uat_prompt.md) as the central prompt template for scheduled runs, allowing Riccardo to easily edit testing sequences, thresholds, or difficulty levels.
- 🐛🤖 **Fix CPU Opponent Disabled After Setup & Separate "Nuova Partita" (Reset) vs "Modifica Partita" (In-Place) (`src/listeners/HudListener.js`, `src/managers/AIWorkerManager.js`, `src/core/Registry.js`, `sw.js`, `tests/cpu-opponent.test.mjs`)**:
  - **Bug #1 Fix — Default Human vs CPU AI Now Moves Properly**:
    - Fixed `HudListener.applySetup()` emitting `OPPONENT_CHANGED` without `enabled`, which caused `AIWorkerManager`'s `OPPONENT_CHANGED` handler to set `this.enabled = Boolean(undefined) = false` and turn the match into Human vs Human.
    - Hardened `AIWorkerManager` so `OPPONENT_CHANGED` derives `enabled` from `e.enabled` or `e.mode !== 'hotseat' && cpuColor !== 'none'`.
  - **Bug #2 Fix & UX Split — Two Distinct Actions: "🔄 Nuova Partita" (Reset) vs "⚙️ Modifica Partita" (Senza Reset)**:
    - Fixed `HudListener.applySetup()` emitting `PROFILE_CHANGED` without `restoreBoard: false` before `board.reset()`, which had caused `ProfileStorageListener` to reload the saved mid-game FEN from `localStorage` and overwrite the reset board.
    - Wired `PieceManager.setWhiteFamily()` and `PieceManager.setRivalSetMode()` inside `applySetup()` so 3D factions update reliably both on new games and mid-game edits.
    - Split the bottom dock and Setup Modal into two distinct actions:
      1. **🔄 Nuova Partita (`#hud-new-btn` & `#hud-setup-start-btn`)**: Resets all 32 pieces to the initial board (`resetBoard: true`).
      2. **⚙️ Modifica Partita / 💾 Modifica Partita in Corso (`#hud-setup-btn` & `#hud-setup-apply-btn`)**: Updates White/Black factions, Human/AI control, and AI difficulty in-place on the active board without resetting the pieces (`resetBoard: false`).
  - **Service Worker Cache Bump (`sw.js`)**:
    - Bumped `CACHE_NAME` to `carchess3d-offline-v9` and switched HTML/JS/`VERSION` requests to network-first with offline cache fallback so GitHub Pages deployments take effect immediately.

## [0.3.7] - 2026-10-11

- 🏰🎮 **Startup Match Setup Modal, Auto-Hiding Top Bar, Footer Overlay & Quake-Style Console (`HudListener.js`, `AIWorkerManager.js`, `BoardInteractionView.js`, `main.js`, `Registry.js`, `tests/cpu-opponent.test.mjs`)**:
  - **Inizio Partita Setup Modal (`#hud-setup-modal`)**:
    - Interactive 2-column modal at game boot asking who plays White and who plays Black (Human vs Computer AI), with character profiles and CPU difficulty settings (`easy`, `medium`, `hard`).
    - Explicit default: ⚪ **Famiglia Carlesso** (Human, profile Ale/Riccardo) vs ⚫ **Scacchi Classici** with **AI Facile** (`easy`).
    - Can be reopened at any time via `⚙️ Nuova Partita` or `⚙️ Setup Fazioni` in the bottom action dock.
  - **Auto-Hiding Top Bar for Maximum 3D Viewport (`#hud-topbar.hidden`)**:
    - Once the match starts, the top navigation/status bar smoothly slides up and disappears (`translateY(-130%)`, `opacity: 0`), granting full screen immersion to the 3D board, the swamp, and the 16:9 cinema mirror.
    - Togglable back anytime via the `☰ Mostra Barra` button in the bottom dock or pressing hotkey `M`.
  - **Overlay Footer with Branding & Open Source Links (`.hud-bottombar`, `.hud-footer-brand`)**:
    - Bottom bar rendered in overlay/sovrimpressione featuring game branding (`🏰🚽 CarChess3D · Carlesso al Cesso`), direct GitHub repository link (`https://github.com/palladius/carchess3d`), 3D Gallery, and 36 Battles Matrix shortcuts alongside gameplay controls.
  - **Quake-Style Dropdown Terminal Console (`#hud-quake-console`)**:
    - Retro top-sliding terminal toggled via `~`, `` ` ``, `\`, `§`, or the `~_ Console` button in the dock.
    - Real-time logging of game events: moves, checks, checkmate, draws, luck meter bursts, loot drops, 3D brawls, and AI thinking/calculation time.
    - Interactive command prompt supporting `help`, `setup`, `topbar`, `fen`, `pgn`, `hint`, `reset`, `matrix`, `swamp`, `skeletons`, `clear`, and `close`.
  - **Multi-Side AI Worker Architecture (`AIWorkerManager.js`, `BoardInteractionView.js`)**:
    - Upgraded `AIWorkerManager` to support `cpuColor = 'b' | 'w' | 'both' | 'none'` with independent white/black difficulty levels, enabling AI vs AI demo matches and White CPU play. Gated mouse raycasting in `BoardInteractionView` so human clicks are safely ignored during CPU turns. Tested via `tests/cpu-opponent.test.mjs`.
## [0.3.6] - 2026-10-11

- 🐱🎭⛪ **Swamp Family Lineup Upgrade: Don Gatto Zorro-Vescovo (`Bishop`, `1.45m`) & Uomo Focaccina Ligure (`Pawn`, `0.95m`)**:
  - Generated and approved `assets/characters/bishop-swamp-gatto.jpg` (Variant 1, synced to `bishop-swamp-focaccina.jpg` for manifest compatibility): a swashbuckler ginger tabby cat wearing a black Zorro domino eye-mask, tall black-and-gold Papal Bishop Mitre with glowing ruby cross & sweeping yellow ostrich feather, black-and-gold embroidered Zorro cape with `"Z"` clasp, tall cuffed leather boots, golden swept-hilt rapier-crosier, and solemn Bishop blessing paw.
  - Promoted **Uomo Focaccina Ligure** (`assets/characters/pawn-swamp-focaccina.jpg`, synced to `pawn-swamp-tappo.jpg`) to the canonical Swamp **Pawn (`0.95m`)**, and added two alternate Italian fairytale Pawn portraits: **I 3 Porcellini della Palude** (`assets/characters/pawn-swamp-porcellini.jpg`) and **Zenzy Pan di Zenzero & Focaccina** (`assets/characters/pawn-swamp-zenzy.jpg`).
  - Rebuilt the watertight 3D `.glb` statues in `tools/model-pipeline/swamp/build_swamp_models.py` (`assets/models/swamp/bishop-swamp-focaccina.glb` `21,640 tris`, `1.45m`; `assets/models/swamp/pawn-swamp-tappo.glb` `16,032 tris`, `0.95m`) and updated `tools/model-pipeline/swamp/swamp_contact_sheet.png`.
- 🩸✨ **3D Miracolo di San Gennaro Blood Liquefaction Animation (`VFXPoolView.js`, `CombatAnimationManager.js`, `Registry.js`)**:
  - Implemented the bespoke 3D **Miracolo del Sangue di San Gennaro** (`san_gennaro_miracle` / `san_gennaro_blood_drops`) triggered when the Classic Bishop (**San Gennaro**) attacks: a golden Baroque reliquary ampoule (`sanGennaroAmpoule`) rises above the capture square, tilts side-to-side while its dark clotted blood core (`#3b0308`) liquefies and boils into glowing ruby-crimson (`#ff1744`) at `t >= 0.28`, and unleashes a 64-particle burst of crimson-ruby droplets and golden sparks with banner `"MIRACOLO DI SAN GENNARO! SANGUE SCIOLTO! 🩸✨"`.
- 🧊🏛️ **TRELLIS.2 3D Reconstruction Pipeline for Classic Family (`tools/model-pipeline/classic/gen_trellis2_batch.py`)**:
  - Added automated `microsoft/TRELLIS.2` image-to-3D reconstruction + contract normalizer (`faction_primary` / `faction_trim` material slots, `min.y = 0.0`, exact target height) and reconstructed `assets/models/classic/king-classic-re.glb` (`99,267 tris`, `1.80m`).

## [0.3.5] - 2026-10-11

- 🐴🐧🗣️ **Living Idle Animations & Hover/Select Character Voices (`idle_animations_and_voices_20261011`)**:
  - **Continuous Per-Character 3D Living Idle Motion (`src/views/PieceView.js`, `src/views/SkeletonRigHelper.js`)**:
    - Every living piece on the 8×8 board now moves organically even when standing still: Knight Seby's warhorse steps/trots gently in place and swishes its tail (`tail` bone), Pawn Puffins sway fluidly in an S-curve and wag their tail feathers (`tail` bone), Bishop Ale's shoulder dragon beats its wings (`leftWing`/`rightWing`) and waves its wand, Rook Pupurabbu squishes and breathes, and King Riccardo & Queen Kate breathe with regal poise.
    - Hovering or selecting a piece boosts its idle amplitude (`1.55×` on hover, `1.95×` on select) so characters visibly perk up under the cursor.
  - **Hover Creature SFX & Authentic Spoken Character Voice Lines (`src/core/Registry.js`, `src/listeners/AudioListener.js`, `src/listeners/HudListener.js`, `src/views/BoardInteractionView.js`)**:
    - Generated all 6 authentic character voice MP3s via `gemini-2.5-flash-preview-tts` ([`scripts/generate_voice_lines.py`](scripts/generate_voice_lines.py) → `assets/audio/voices/voice-{k,q,b,n,r,p}.mp3`):
      - **Seby (`n`)**: *"Dimmi papino!"* + hover horse snort (`🐴 Snort! Prrr!`)
      - **Ale (`b`)**: *"Agli ordini, Signore!"* + hover dragon whistle (`🐉 Fiuuu!`)
      - **Kate (`q`)**: *"This is an interesting choice..."* (sarcastic British English `en-GB`) + hover crystal chime (`♕ Hmm...`)
      - **Puffin (`p`)**: *"Piu piu! Eccomi, pronta guardia Puffin!"* + hover cute double chirp (`🐧 Piu-piu!`)
      - **Riccardo (`k`)**: *"Avanti tutta! Re Carlesso al comando!"* + hover royal sceptre hum (`♔ Zzt-hum!`)
      - **Pupurabbu (`r`)**: *"Boing boing! Super abbraccio Pupurabbu!"* + hover plushie boing (`🟣 Boing-pfiu!`)
    - Added [`tests/voices_idle.test.mjs`](tests/voices_idle.test.mjs) and synced [`docs/spec/SPEC.md`](docs/spec/SPEC.md) and [`sw.js`](sw.js) (`v7`).
- 🍌🎬 **All 36 Nano Banana 2.1 Battle Keyframes & 15 Veo 3.1 16:9 Videos (`scripts/generate_nb_veo_battle.py`, `assets/battles/prompts_36.json`)**:
  - **Stage 1**: Generated all **36/36** 16:9 initial battle keyframes (`assets/battles/keyframes/<atk>_x_<def>.png`, `1376×768`) using **Photo 1 (Attacker Left)** + **Photo 2 (Defender Right)** + side-by-side layout guide (`assets/battles/refs/<id>_ref.png`) via Nano Banana 2.1 (`gemini-3.1-flash-image-preview`).
  - **Stage 2**: Generated 15/36 full 8-second 16:9 Veo 3.1 (`veo-3.1-generate-preview`) battle videos with audio (`assets/battles/videos/<id>.{mp4,webm}`) including all 4 Easter Eggs (`n_x_r`, `r_x_n`, `k_x_q`, `q_x_k`), all 6 Bishop Ale battles (`b_x_*`), and all 6 Knight Seby battles (`n_x_*`).

## [0.3.4] - 2026-10-10

- 🔗🏷️ **Footer GitHub Links & Game Version Display (`src/listeners/HudListener.js`, `src/core/Registry.js`, `battles.html`, `showcase/index.html`, `tests/core.test.mjs`)**:
  - Added dedicated `.hud-footer-meta` row inside the game HUD `<footer class="hud-bottombar">` (and matching footers in [`battles.html`](battles.html) and [`showcase/index.html`](showcase/index.html)):
    - **`v0.3.4` Game Version Tag**: Displays current game version (`v${APP_VERSION}`), dynamically refreshed at runtime via `fetch('./VERSION')`.
    - **🐙 GitHub Code**: Direct clickable link to the repository source code (`https://github.com/palladius/carchess3d`).
    - **🐛 Open a Bug**: Direct clickable link to open a new GitHub Issue (`https://github.com/palladius/carchess3d/issues/new`).
  - Added unit test in [`tests/core.test.mjs`](tests/core.test.mjs) verifying `APP_VERSION`, `GITHUB_REPO_URL`, and `GITHUB_NEW_ISSUE_URL` match `VERSION` and repo endpoints.

## [0.3.3] - 2026-10-10

- 🍌📺 **Wire Nano Banana 16:9 Keyframes & `1.65×` Veo Playback (`BattleMatrix36.js`, `VeoCinemaView.js`, `battles.html`)**:
  - Added `keyframeUrl: assets/battles/keyframes/<id>.png` across all 36 entries in [`src/core/BattleMatrix36.js`](src/core/BattleMatrix36.js) and wired `poster="assets/battles/keyframes/<id>.png"` into the 6×6 video player in [`battles.html`](battles.html).
  - Updated [`src/views/VeoCinemaView.js`](src/views/VeoCinemaView.js) to preload and render the Nano Banana 16:9 Initial Battle Keyframe as Tier-2 fallback on the 16:9 Magic Cinema Mirror while the video buffers, and set `videoEl.playbackRate = 1.65` so the full 6–8s Veo 3.1 battle movie plays within the 4.0s 3D Scazzottata cutscene.

## [0.3.2] - 2026-10-10

- 🍌🎬 **2-Stage Generative AI Battle Cinema Pipeline (`Nano Banana 2.1` Keyframe → `Veo 3.1` I2V Video) (`scripts/generate_nb_veo_battle.py`, `assets/battles/keyframes/{b_x_n,n_x_b}.png`, `assets/battles/videos/{b_x_n,n_x_b}.{mp4,webm}`)**:
  - Added [`scripts/generate_nb_veo_battle.py`](scripts/generate_nb_veo_battle.py): composes the clean front portraits of Attacker (Left) + Defender (Right) + 16:9 side-by-side layout guide (`assets/battles/refs/<pair>_ref.png`) into a cohesive 16:9 Pixar-style starting frame via `gemini-nano-banana-2.1`, then animates that exact frame into a 16:9 `.mp4` + `.webm` battle movie via `veo-3.1-fast-generate-preview`.
  - Generated full-fidelity 16:9 Nano Banana 2.1 keyframes and Veo 3.1 I2V movies for **`b_x_n` (Bishop Ale & Red Dragon vs Knight Seby)** and **`n_x_b` (Knight Seby & Hot-Wheels Loop-Track vs Bishop Ale)**.

## [0.3.1] - 2026-10-10

- 🐛🧹 **Merge `refactor_ui_cleanup_ux` — Idempotent UI Clicks, Async GLTF Load-Token Guard & Mirror-Safe Camera Flip (`PieceManager.js`, `WowModeView.js`, `ZurichSwampView.js`, `CombatAnimationManager.js`, `HudListener.js`, `main.js`, `tests/pieces.test.mjs`)**:
  - **Idempotent `🐸 Palude` (`PieceManager.seedSwampParty` / `handlePieceCaptured`)**: Clicking `🐸 Palude` or opening `?demo=swamp` now calls `PieceManager.seedSwampParty()`, which is idempotent (`swampDemoPiece: true`) and never spawns duplicate dead pieces or deletes living pieces (`c1, g1, e2, b8, f8, h8`) from the 3D board. Covered by unit test in [`tests/pieces.test.mjs`](tests/pieces.test.mjs).
  - **WOW Mode Async Load-Token Guard & Skeleton Preservation (`WowModeView.js`)**: Added `_heroLoadToken` so rapid clicks on WOW character/variant buttons never attach stale GLTF hero roots out of order, while preserving 3D skeleton rigs (`SkeletonRigHelper`) and prevented `WowModeView.onArenaClash` from mutating Mode 1 `pieceView.pieceBySquare`.
  - **Duplicate Highlight Ring Cleanup (`ZurichSwampView.js`)**: Removed duplicate selection/check highlight rings from `ZurichSwampView` (now exclusively owned by `BoardInteractionView`).
  - **Mirror-Safe Camera Flip (`HudListener.js`, `main.js`)**: Flipping the camera (`🔄 Flip`) now parks at `z = -8.2m` in front of the `z = -10.2m` 16:9 Magic Cinema Mirror instead of clipping behind it, and added `CombatAnimationManager.isBusy()` alias for backward compatibility.

## [0.3.0] - 2026-10-10

- 🐝🎬 **Adversarial Swarm Complete — All 36 (`6×6`) Bespoke 3D Brawls, 72 16:9 Videos (`36 .mp4` + `36 .webm`), Interactive 6×6 Matrix Explorer & Visible 3D Skeletons (GitHub Issues `#10`–`#16` ✅)**:
  - **Issue `#11` (`@matrix36-choreo` & `@explorer6x6-ux`) — All 36 (`6 vs 6`) Animations & Videos + `battles.html` Explorer**:
    - Added [`src/core/BattleMatrix36.js`](src/core/BattleMatrix36.js) defining all 36 (`6 × 6`) combinations with bespoke bilingual titles, comic banners, attacker 3D weapons, Act 2 defender counter-attack moves (`defenderCounter`), and finisher reactions, plus [`tests/matrix36.test.mjs`](tests/matrix36.test.mjs).
    - Upgraded [`scripts/render_battle_videos.py`](scripts/render_battle_videos.py) and generated **all 36 `.mp4` and all 36 `.webm` 16:9 3-Act videos** (`assets/battles/videos/k_x_k.mp4` .. `p_x_p.mp4`, 72 video files total).
    - Built the standalone **[`battles.html`](battles.html) 6×6 Battle Matrix Explorer** (`https://palladius.github.io/carchess3d/battles.html`) and the in-game **`🎬 Matrice 6×6 (36 Scontri)`** modal in [`src/listeners/HudListener.js`](src/listeners/HudListener.js) with 1-click **`🥊 Scazzottata 3D + Cinema`**, built-in 16:9 `<video>` preview player, and **`▶️ Maratona 36 Scontri`**.
  - **Issue `#10` & `#15` (`@brawl3d-vfx`) — 3D Weapons, Defender Counter-Attacks, Floating 3D Comic Words & Shrek Swamp Splash**:
    - Attached 3D weapons & props (`buildFighterWeaponProp`) to both fighters in [`src/views/VFXPoolView.js`](src/views/VFXPoolView.js) (Puffin's Halberd + 3D Silver Fish, Ale's Amethyst Staff + Dragon Fireball stream, Seby's Twin Orange Turbo Boosters + orbiting race car, Pupurabbu's Giant Purple Plushie Boxing Gloves + Belly Aura, Kate's Golden-Lilac Choco Wand + Magic Shield, Riccardo's Lightning Sceptre + Golden Plunger-Crown).
    - Added active **Defender Counter-Attacks in Act 2** (`horse_rear_hoof_kick`, `dragon_flame_puff`, `halberd_fish_parry`, `plush_belly_bounce`, `lilac_choco_shield_spin`, `royal_sceptre_zap`), floating 3D comic impact words (`CHARGE!` → `CLANG! ⚔️` → `CONTRATTACCO! 💥` → `KAPOW! 🌪️` → `K.O.! 🐸💦`), hit-pulse camera shake, and a 3D emerald water-column splash (`swampKoSplash`) in Shrek's Swamp.
    - Updated [`src/views/VeoCinemaView.js`](src/views/VeoCinemaView.js) to play all 36 `<atk>_x_<def>.mp4`/`.webm` videos and render pair-specific titles & Act 2 counter-attack badges.
  - **Issue `#12` & `#14` (`@skeletons-locomotion`) — Visible 23-Joint 3D Articulated Skeletons & Footprints/Hoofprints**:
    - Added [`src/views/SkeletonRigHelper.js`](src/views/SkeletonRigHelper.js) and integrated it into [`src/views/PieceView.js`](src/views/PieceView.js) and [`src/views/WowModeView.js`](src/views/WowModeView.js): 23 articulated 3D bone/joint pivots (including Knight Seby's 4-legged warhorse skeleton and Bishop Ale's dragon wing skeleton), glowing footprint/hoofprint trails along `2.0s–2.2s` moves, **`🦴 Scheletri 3D`** HUD toggle, and sculpted 3D notched lily-pad leaves + pink lotus flowers under every Shrek Swamp swimmer.
  - **Issue `#13` & `#16` (`@explorer6x6-ux` & `@adversarial-critic`) — Mac Trackpad `_customWheelEvent` Fix, Legal Dots Hover Preview & Full Adversarial Audit**:
    - Fixed Three.js `OrbitControls._customWheelEvent` stripping `deltaX` & `ctrlKey` in [`src/views/BoardInteractionView.js`](src/views/BoardInteractionView.js) (caught by `@adversarial-critic`), added 3D floating capture hover preview badges (`"⚔️ ♙ Puffin vs ♙ Puffin"`), and added [`scripts/adversarial_swarm_audit.py`](scripts/adversarial_swarm_audit.py) verifying all 7 GitHub Issues (`#10`–`#16`) end-to-end.

## [0.2.7] - 2026-10-10

- ♔🏛️ **Pure Vanilla Classic Chess Family (`classic`) with San Gennaro Bishop & Torre Matildea Rook**:
  - Replaced the Carlessian-hybrid Classic pieces with a 100% pure traditional Staunton & Italian heritage chess set (`assets/characters/*-classic-{re,regina,vescovo,cavallo,torre,pedone}.jpg` via `gemini-nano-banana-2.1` + watertight 3D `.glb` models in `assets/models/classic/`):
    - **♔ Re Classico (`king-classic-re.glb`, `1.80m`)**: Fluted ivory marble & royal gold Staunton King with crimson velvet crown cushion & Cross Pattee finial.
    - **♕ Regina Classica (`queen-classic-regina.glb`, `1.65m`)**: Fluted Staunton Queen with 8-spike gold coronet, 8 ivory pearls & central golden orb.
    - **♗ San Gennaro (`bishop-classic-vescovo.glb`, `1.45m`)**: Neapolitan Baroque reliquary bust of St. Januarius (`Busto del Tesoro di San Gennaro`) with crimson-and-gold brocade cope, glowing ruby **Ampolla del Sangue** medallion on the chest, jewel-encrusted Baroque mitre (rubies, emeralds, pearls, cross), and golden pastoral crosier.
    - **♘ Destriero Classico (`knight-classic-cavallo.glb`, `1.35m`)**: Sculpted Staunton warhorse head with arched neck, scalloped marble mane & golden bridle.
    - **♖ Torre Matildea (`rook-classic-torre.glb`, `1.30m`)**: Renaissance fortress tower inspired by the **Torre Matildea / Castello Estense** of Ferrara & Lidi Ferraresi in warm terracotta brickwork, ivory marble corner quoins, overhanging corbel machicolations (`beccatelli e caditoie`), battlements & octagonal roof lantern.
    - **♙ Pedone Classico (`pawn-classic-pedone.glb`, `0.95m`)**: Pure turned Staunton Pawn with baluster shaft, double gold collar & smooth ivory sphere.
- 🐸♟️ **Playable Multi-Family Selector on the 3D Chessboard (`index.html`, `Registry.js`, `PieceManager.js`, `PieceView.js`, `HudListener.js`)**:
  - Wired all 3 piece families (`carlesso`, `swamp`, `classic`) + `stone` directly into the playable 3D chessboard via HUD topbar selectors (`#hud-white-select` for White, `#hud-rival-select` for Black) and URL query parameters (`?family=swamp`, `?family=classic`, `?white=...`, `?black=...`).
  - Updated `PieceView.attachGlbToPiece` to preserve multi-material untextured PBR colors on `swamp` and `classic` `.glb` models while dynamically tinting `faction_primary` and `faction_trim` slots by team color (White Ivory & Gold vs Black Obsidian & Silver).

## [0.2.6] - 2026-10-10

- 🐛🤖 **Fix: CPU opponent only moved once** (`src/main.js`, `src/managers/AIWorkerManager.js`, `src/managers/BoardMapManager.js`, `src/listeners/HudListener.js`):
  - Root cause: the ad-hoc CPU wiring in `main.js` called the non-existent `combat.isBusy()` inside the `MOVE_EXECUTED` handler, throwing `TypeError` during `bus.flush()` on every CPU turn. The first move only worked because the HUD called `ai.requestMove()` directly; afterwards the user had to re-select the CPU to force each move.
  - Per Niccolò rule #2/#3/#4, the "it is the CPU's turn → think → move" rule now lives in `AIWorkerManager` (reacts to `OPPONENT_CHANGED`, `MOVE_EXECUTED`, `BOARD_RESET`, `BATTLE_COMPLETED`, `BATTLE_SKIPPED`; queries `board`/`flow`/`combat.isActive()` read-only via `ctx`; generation-guarded timer, no double-think). `BoardMapManager` now applies `AI_MOVE_READY` itself (ignoring stale replies). `main.js` and `HudListener` no longer call the AI directly.
  - Spec drift fixed in `docs/spec/SPEC.md` (§Architecture › `ai/`): CPU turn-taking ownership is now documented.
  - TDD: added `tests/cpu-opponent.test.mjs` (5 headless regression tests: replies to every human move, takes a pending turn right after being enabled, stops on hotseat, waits for the capture cutscene, board ignores stale AI moves). Verified end-to-end in headless Chromium (3 consecutive CPU replies, zero page errors).
- 📐🏠 **Self-sufficient spec**: `docs/spec/SPEC.md` + `docs/spec/input_prompt.md` imported from `palladius/respec` (`carlesso-family/chess3d`, last respec commit `9c5c2a7`). `respec` is no longer a dependency: `AGENTS.md`/`GEMINI.md`, `README.md` and the `justfile` (`sync-assets` → `spec`) now point to the in-repo spec, which may be edited together with the code.

## [0.2.5] - 2026-10-10

- 🌐📖 **GitHub Pages Live Banner in `README.md` & GitHub Issues `#10`–`#16`**:
  - Added prominent live GitHub Pages links (`https://palladius.github.io/carchess3d/`, WOW Mode, 3D Brawl demo, Shrek Swamp demo, 3-Family Showcase, and Visual Progress Gallery) at the top of [`README.md`](README.md).
  - Created 7 tracked GitHub Issues (`#10`–`#16`) for every single gameplay/3D/UX requirement and launched the Adversarial Swarm to implement all 36 (`6×6`) bespoke 3D combat animations, all 36 `.mp4`/`.webm` 16:9 videos, the interactive 6×6 Battle Matrix Explorer, and visible 3D skeletal rigs.

## [0.2.4] - 2026-10-10

- 🥊⚔️ **3D Scazzottata / Real 3D Character Brawl (`VFXPoolView.js` + `CombatAnimationManager.js` + `PieceView.js`)**:
  - Replaced untextured stage proxy cones with the **two actual 3D `.glb` combatant statues** (`attackerFighter` vs `defenderFighter`) staged directly on the capture square across a `4.0s` 3-Act 3D Brawl:
    1. *Act 1 (Walk/Gallop Charge & Guard Stance)*: Attacker A charges in from `fromSquare` while Defender B turns to face them in a combat guard stance.
    2. *Act 2 (La Scazzottata 3D — 5 Physical Combat Exchanges)*: Attacker A and Defender B trade 5 rapid back-and-forth lunges, counter-attacks, mid-air whirlwind clashes, uppercuts, and signature finishers inside a swirling 3D cartoon brawl dust cloud + comic impact starburst (`KAPOW!`), framed by a close-up orbiting camera (`dist = 4.0m..4.6m`).
    3. *Act 3 (Knockout Launch into Shrek's Swamp & Victory Pose)*: Defender B is flattened/melted or launched spinning into the Enchanted Swamp moat while Attacker A celebrates on the captured square.
- 🏃‍♂️🐎 **2.0-Second Articulated Skeletal Piece Locomotion (`PieceView.js`)**:
  - Injected a real-time procedural skeletal limb & horse-gallop vertex shader (`injectLocomotionShader` on `MeshStandardMaterial.onBeforeCompile`) so every `.glb` statue's left/right legs, feet, horse hooves, arms, and weapons visibly stride and swing during movement and combat.
  - Upgraded board moves (`c2 -> c4`, `g1 -> f3`, etc.) to **`2.0s` (`2.2s` for Knight Seby)** with distinct character gaits: Pawn Puffin's 8-step Swiss-Guard waddle-march (`Camminata di Puffin`), Knight Seby's horse rear-up + 4-bound curved L-gallop (`Cavalcata di Seby`), Bishop Ale's 6-beat winged diagonal glide, Rook Pupurabbu's 5 squash-and-stretch plushie bounds, Queen Kate's royal stride & pirouette, and King Riccardo's solemn swagger.
- 🖐️🍎 **Mac Trackpad 2-Finger Rotate & Pinch Zoom Controls (`src/main.js` + `HudListener.js`)**:
  - Upgraded `OrbitControls._handleMouseWheel` so a two-finger swipe on the Mac trackpad (`deltaX`, `deltaY`) smoothly rotates the 3D camera left/right and up/down, while two-finger pinch (`ctrlKey` / Safari `gesturechange`) or `Cmd/Option/Ctrl + scroll` (plus keyboard `+`/`-` and new HUD `🔍+`, `🔍−`, `🖐️ 2-Dita: Ruota` buttons) zooms in and out.
- ♟️🧭 **White vs Black Army Facing Orientation (`PieceView.js`)**:
  - Oriented all 16 White pieces (`homeYaw = Math.PI`, facing North `-Z`) to directly confront all 16 Black pieces (`homeYaw = 0`, facing South `+Z`) across the chessboard.

## [0.2.3] - 2026-10-10

- 🎛️ **Showcase Multi-Family Selector & Live 3D Faction Material Tinting (`showcase/index.html`)**:
  - Merged interactive family tabs (`Tutte le Famiglie (18)`, `Famiglia Carlesso (6)`, `Classici Carlessiani (6)`, `Famiglia della Palude (6)`) to inspect all 18 2D Nano Banana 2.1 portraits and 3D `.glb` models in one unified gallery, keeping all 6 canonical Carlesso `.glb` models (`king-riccardo.glb`, `queen-kate.glb` + `queen-kate-wedding2016.glb`, `bishop-ale-1.glb` + `bishop-ale-rigged.glb`, `knight-seby.glb`, `rook-pupurabbu.glb`, `pawn-puffin.glb`).
  - Added live 3D faction material tinting controls (`Materiali Originali`, `Squadra Bianca (Avorio & Oro)`, `Squadra Nera (Ossidiana & Argento)`) that dynamically override `faction_primary` / `faction_trim` material slots (and apply fallback tinting + glTF PBR `metalness` clamping on textured TRELLIS.2 pieces).
  - Added `fable-5.1-high` Adversarial Art Critic score badges (`🟢`/`🟡`) per piece and quick-access buttons to the 6×4 turntable contact sheets (`classic_contact_sheet.png`, `swamp_contact_sheet.png`).
- 📦 **Carlesso Family Manifest (`assets/families/carlesso.json`)**:
  - Added declarative manifest for the primary `carlesso` family alongside `classic.json` and `swamp.json` under `assets/families/_contract.json`, wired to all 6 canonical `.glb` models.

## [0.2.2] - 2026-10-10

- 🌐🚀 **GitHub Pages Deployment**: added `.nojekyll` so GitHub Pages serves all static `.glb`, `.mp4`, `.webm`, and `_contract.json` assets directly without Jekyll filtering, and updated `sw.js` (`carchess3d-offline-v2`) to precache all 6 canonical 3D `.glb` family models.

## [0.2.1] - 2026-10-10

- ✍️🦖 Added [`docs/ARTICLE.md`](docs/ARTICLE.md): Carlessian-style engineering story & SRE telemetry post-mortem documenting how **CarChess3D** was built from scratch in 2 days (~4h 3D pipeline on Oct 9 + 2h 43m autonomous `/goal` sprint on Oct 10, with the first playable 10k-LOC 3D build reached in **38m 06s** via 4 parallel subagents).

## [0.2.0] - 2026-10-10

- 🏰🚽 **Complete v1 of CarChess3D ("Carlesso al Cesso" / "Scacchi di Famiglia")** executing `conductor/tracks/v1_carchess3d/plan.md` end-to-end across Phases 1–5 (`9.8 / 10` Adversarial Critic score in Round 3, `9.9 / 10` in Round 4).
- 📐 **Phase 1 — 2D Metric Spatial Blueprint & GLB Grounding**:
  - Generated [`docs/floorplan.svg`](docs/floorplan.svg) with exact meter coordinates (`8.0m × 8.0m` carved stone rune altar at `y = 0.00m`, `Ø 0.75m` pedestals, canonical piece hierarchy `0.90m..1.85m`, 4 corner braziers at `(±5.2m, 1.2m, ±5.2m)`, emerald swamp moat `r = 6..18m`, 16:9 Magic Cinema Mirror at `z = -10.2m, y = 3.65m` between the Grossmünster twin towers, St. Peter, Fraumünster, Limmat, and Swiss Alps at `z = -25m`).
  - Added [`src/utils/glbGrounding.js`](src/utils/glbGrounding.js) to automatically normalize every loaded `.glb` so `bbox.min.y === 0.00m` and height matches its canonical chess rank.
  - Vendored [`vendor/chess.js`](vendor/chess.js) + Three.js addons (`OrbitControls`, `SkeletonUtils`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`).
- 🧠 **Phase 2 — Headless Core & Niccolò Managers (`<= 300` LOC per file, zero DOM/Three.js in `src/core/`, `src/managers/`, `src/ai/`)**:
  - Implemented deterministic queued [`GameEventBus`](src/core/EventBus.js), `mulberry32` seeded PRNG ([`src/core/Rng.js`](src/core/Rng.js)), fixed `1/30s` [`GameLoop`](src/core/GameLoop.js), [`GameFlowManager`](src/managers/GameFlowManager.js), [`BoardMapManager`](src/managers/BoardMapManager.js), [`PieceManager`](src/managers/PieceManager.js), [`CombatAnimationManager`](src/managers/CombatAnimationManager.js), [`DropManager`](src/managers/DropManager.js) (🍀 Barra della Fortuna / Pity Timer `L_max = 12` verified with a 10,000-capture Monte-Carlo test), and non-blocking Web Worker CPU [`AIWorkerManager`](src/managers/AIWorkerManager.js) (`Easy` capture-maximizer, `Medium` minimax d=2, `Hard` alpha-beta d=4 with MVV-LVA & PSTs).
- 👑🐉 **Phase 3 — Full 32-Piece 3D `.glb` Carlesso Family Roster & glTF PBR Fix**:
  - Integrated all 6 canonical 3D `.glb` models from `main` (`king-riccardo.glb`, `queen-kate.glb`, `bishop-ale-1.glb` + rigged `bishop-ale-rigged.glb`, `knight-seby.glb`, `rook-pupurabbu.glb`, `pawn-puffin.glb`) into [`src/core/Registry.js`](src/core/Registry.js), [`src/views/PieceView.js`](src/views/PieceView.js), and [`src/views/WowModeView.js`](src/views/WowModeView.js).
  - Fixed the glTF 2.0 default `metallicFactor: 1.0` material darkening bug (`mat.metalness = 0.04; mat.roughness = 0.52; mat.emissiveMap = mat.map;`) so all 32 3D pieces display their vibrant Pixar colors.
  - Added 3D colored legal-move dots (`#00e676` + `#ffee58`) and rotating crimson capture target rings (`#ff3d00`) in [`src/views/BoardInteractionView.js`](src/views/BoardInteractionView.js).
- 🐸 **Shrek Swamp Splashing Captured Pieces ("Palude di Shrek")**:
  - Captured pieces dive along a high parabolic arc into the West/East emerald swamp moats (`x = ±6.2m..±7.2m, y = -0.28m`) and continuously bob, tilt, and paddle on green lily-pad rings surrounded by glowing concentric water ripples and rising green swamp bubbles (`?swamp_party=1` + `🐸 Palude Shrek` HUD button).
- 🎬 **Zero-HITL 16:9 Battle Cinema Videos (`assets/battles/videos/*.mp4` & `.webm`)**:
  - Added [`scripts/render_battle_videos.py`](scripts/render_battle_videos.py) and generated 3 browser-native 16:9 `1280×720` `.mp4` + `.webm` battle videos for Ale & Seby (`b_x_n.mp4`, `n_x_b.mp4`, `n_x_r.mp4`), projected live onto the 3D Magic Cinema Mirror in [`src/views/VeoCinemaView.js`](src/views/VeoCinemaView.js) with automatic Tier 2/3 60fps canvas fallback for any unrendered pair.
- 🎨📸 **Visual Progress Gallery & Critic Loop**:
  - Added [`progress.html`](progress.html), [`docs/VISUAL_PROGRESS.md`](docs/VISUAL_PROGRESS.md), and 25+ diagnostic screenshots across Rounds 1–4 in [`docs/visual-progress/`](docs/visual-progress/), plus offline PWA support ([`manifest.webmanifest`](manifest.webmanifest), [`sw.js`](sw.js)).

## [0.1.27] - 2026-10-10

- 🛤️ **Parallel Conductor Tracks (`classic_default_pieces_20261010` & `swamp_family_pieces_20261010`) + Fable 5.1 Adversarial Review & Art Critic Loop**:
  - Reviewed specs/plans and audited 2D/3D outputs with `fable-5.1-high` (`fable-reviewer` + `art-critic`) in a multi-agent Swarm with zero file collisions (`assets/families/_contract.json`, `CHANGELOG.d/`, per-family `docs/qa-scores.<family>.yaml`, and per-family `RUNNING_DOC.md`).
- 🗿🚽 **Carlessian Classic Family (`classic`)**:
  - Generated 6 Nano Banana 2.1 (`gemini-nano-banana-2.1`) 2D character portraits (`assets/characters/{king-classic-cesso,queen-classic-ciocco,bishop-classic-drago,knight-classic-turbo,rook-classic-puffo,pawn-classic-puffin}.jpg`, `art-critic` 2D avg **8.6/10 🟢**).
  - Sculpted 6 watertight, floor-grounded (`min.y = 0.0`, `0.95m → 1.80m`) 3D `.glb` models in `assets/models/classic/` with `faction_primary` / `faction_trim` material slots, 6×4 turntable contact sheet (`tools/model-pipeline/classic/classic_contact_sheet.png`), declarative manifest `assets/families/classic.json`, and `tests/test_classic_family.py`.
- 🐸🧅 **Swamp Parody Family (`swamp`)**:
  - Generated 6 IP-differentiated Nano Banana 2.1 (`gemini-nano-banana-2.1`) 2D character portraits (`assets/characters/{king-swamp-orco,queen-swamp-orchessa,bishop-swamp-focaccina,knight-swamp-asinello,rook-swamp-draghessa,pawn-swamp-tappo}.jpg`, `art-critic` 2D avg **8.7/10 🟢**).
  - Sculpted 6 watertight, floor-grounded (`min.y = 0.0`, `0.95m → 1.80m`) Chibi 3D `.glb` models in `assets/models/swamp/`, 6×4 turntable contact sheet (`tools/model-pipeline/swamp/swamp_contact_sheet.png`), declarative manifest `assets/families/swamp.json`, and `tests/test_swamp_family.py`.

## [0.1.26] - 2026-10-10

- 👑👱‍♀️ **Canonical Queen Kate Young 4c (`queen-kate.glb`)**: designated the Young 4c wavy-hair model (chosen by Kate & Riccardo) as the default canonical piece (`assets/models/queen-kate.glb`, MD5 `86cee880f66da2ed2c3c7ccf514d032d`), preserving the 2016 wedding updo as an alternative piece (`assets/models/queen-kate-wedding2016.glb`, MD5 `d5ba37e0d5d5622d2265f6a7f7031395`).
- ♗ **Canonical Bishop Ale Confirmed**: confirmed Bishop Ale v1 with mitre hat (`bishop-ale-1.glb`, MD5 `6b423e6daf1ed71f001c8912cc9035f7`) as canonical piece.
- 📋 **Provenance Registry 10/10**: updated `docs/models-provenance.yaml` with all 10 3D models and 27 source views with MD5 checksums; verified via `just test` and `just provenance`.
- 🌐 **Web Showcase Updated**: showcase updated to highlight Kate Young 4c as default winner with tab to compare Nozze 2016.

## [0.1.25] - 2026-10-10

- 🏰👾 **Rook Pupurabbu 3D Model (`rook-pupurabbu.glb`)**: generated textured 3D mesh via `microsoft/TRELLIS.2` from 360° turnaround dataset (`tools/model-pipeline/rook/`), featuring the adorable fluffy purple mascot leaning out and smiling from the crenellated purple stone tower. All default chess pieces of the Carlesso family now have complete 3D models!
- 📋 **Provenance Registry Coverage**: registered `rook-pupurabbu` in `docs/models-provenance.yaml` with MD5 `eb20ae6542bc25e6ce5cc9846a82dc4c` across all 4 concept views.
- 🌐 **Showcase Complete**: linked `rook-pupurabbu.glb` in `showcase/index.html` on port 8080.
- 📓 **Documentation**: documented Pupurabbu generation in `tools/model-pipeline/RUNNING_DOC.md` (§25).

## [0.1.24] - 2026-10-10

- 🐴⚔️ **Knight Sebastian 3D Model (`knight-seby.glb`)**: generated textured 3D mesh via `microsoft/TRELLIS.2` from 360° turnaround dataset (`tools/model-pipeline/seby/`), featuring golden-armored charger steed, golden plate armor, blue royal cape, raised left fist (modular weapon/power ready), and turned wooden pedestal.
- 📋 **Provenance Registry Expansion**: registered `knight-seby` in `docs/models-provenance.yaml` with target MD5 `c060099e14059ba7fc8fdb3e4403db94` and verified concept image MD5s across all views.
- 🌐 **Showcase Updated**: linked `knight-seby.glb` in `showcase/index.html` on port 8080.
- 📓 **Documentation**: documented Sebastian pipeline, parameters, and render results in `tools/model-pipeline/RUNNING_DOC.md` (§24).

## [0.1.23] - 2026-10-10

- 👑 **King Riccardo 3D Model (`king-riccardo.glb`)**: generated textured 3D mesh via `microsoft/TRELLIS.2` from turnaround concept (`king-riccardo-1.jpg`, front/side/back views) featuring imperial arched crown, blue ermine-trimmed cloak, golden royal orb, scepter, and authentic clean profile without glasses.
- 👱‍♀️ **Queen Kate Young Stylized 3D Model (`queen-kate-young.glb`)**: generated secondary 3D variant from the 4c turnaround concept with wavy flowing hair, purple frames, and royal gown. Showcase updated with interactive dual tabs for both Queen Kate interpretations.
- 📋 **Testable 3D Models Provenance Registry (`docs/models-provenance.yaml`)**: centralized registry documenting every 3D model, its MD5 checksum, target paths, source concept images, pipelines, and tools.
- 🧪 **Automated Provenance Checks**: integrated stdlib MD5 validation into `scripts/check.py` (`just test`), added standalone `scripts/test_provenance.py` and recipe `just provenance`.
- 🌐 **Web Showcase Live on Port 8080**: updated `showcase/index.html` with King Riccardo and Queen Kate (Nozze 2016 + Young 4c).

## [0.1.22] - 2026-10-10

- 👑 **Queen Kate 3D Model (`queen-kate.glb`)**: generated textured 3D mesh via `microsoft/TRELLIS.2` using authentic 2016 wedding updo hairstyle concept (`kate_wedding_v2_nb21`), chic round navy glasses, emerald green eyes, royal purple velvet gown with gold embroidery, amethyst ring, and wooden carved pedestal with brass nameplate.
- 🛠️ **3D Pipeline & Renders**: added `tools/model-pipeline/kate/gen_trellis2.py`, automated Blender EEVEE headless render script `render_preview.py` (`out/queen_kate_3d_preview.png`), and 36-frame 360° turntable animation script `render_turntable.py` (`out/queen_kate_turntable.gif` & `queen_kate_turntable_strip.png`). Copied canonical asset to `assets/models/queen-kate.glb` (3.7 MB, watertight).
- 🔑 **HF Token Whereabouts**: configured authenticated token management in `.env` supporting `HF_RICC_PROVE3D_CARLESSO` / `palladius` work account with ZeroGPU quota.
- 📓 **Documentation**: documented full generation run, endpoints, timings, and findings in `tools/model-pipeline/RUNNING_DOC.md` (§21).

## [0.1.21] - 2026-10-10

- 🛤️ **Merged Conductor Tracks (`classic_default_pieces_20261010` & `swamp_family_pieces_20261010`)**: added declarative family contract (`assets/families/_contract.json`) and parallel-safe specs/plans for the Staunton-Wizard Classic Stone set and the 100% IP-safe *Famiglia della Palude* (*Orco Brontolo, Principessa Orchessa, Asinello Chiacchierone, Mago Focaccina, Draghessa della Palude, Guardia Re Tappo*).

## [0.1.20] - 2026-10-10

- 🎼 **Conductor Plan Refinements (`/roastme` pre-flight, Forged with Argon ✨)**: updated `conductor/product.md` with canonical character variants (`bishop-ale-1.glb` + `bishop-ale-rigged.glb`, `kate_final_v1_nb21.png`, Seby 4-weapon HUD switcher), Bicolor Royal Pedestal + Rim Tint shader for mirror-match readability, 5-track adaptive Lyria 3 soundtrack (IT/EN vocal themes, calm swamp loop, dark combat loop, rare medieval heraldic Castling fanfare), CLI-only `docs/qa-scores.yaml` policy, and Mode 2 WOW Arena superseding `showcase/index.html`.
- 📦 Vendored offline runtime addons (`OrbitControls`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`, `MaskPass`, `ShaderPass`) under `vendor/three/addons/` and `chess.js` (`v1.0.0-beta.8` ESM) under `vendor/chess.js/`.
- 🌳 Added `.worktrees/` to `.gitignore` for isolated multi-agent branch execution.

## [0.1.19] - 2026-10-10

- 🔀 Merged `origin/vlm-critic` (branch commits `47c6c04` "v0.1.14" + `bbb28ea` "v0.1.15", renumbered here because `main` already used those numbers). Kept `UV_INDEX_URL` in `just critic`; branch RUNNING_DOC sections renumbered §18/§19 → §19/§20.
- 📋 Centralized QA Scoreboard in `docs/qa-scores.yaml` tracking scores, tiers (`TOP_QUALITY 🟢`, `ACCEPTABLE 🟡`, `FA_CAGARE 💩`), structural flaws, and aesthetic critiques.
- 🔍 Automatic synchronization in `tools/model-pipeline/critic/critic_vlm.py` to update the scoreboard whenever a model is evaluated.
- 💩 Query CLI `tools/model-pipeline/critic/scoreboard.py` with `--cagare` / `--worst` filter.
- ⚡ Added `just scores` and `just shittest` recipes to quickly isolate failing models and their exact flaws.
- 🐉 Modular Red Baby Dragon generation in `tools/model-pipeline/dragon/` (Nano Banana 2D turnaround views + Hunyuan3D-2 3D shape + procedural texturing).
- ♟️ Modular assembly script `tools/model-pipeline/rigging/assemble_modular_bishop.py` mounting clean dragon to Bishop Ale (`bishop-ale-1` base → `assets/models/bishop-ale-rigged.glb`) with dual 26-bone animations (`Idle` wing glide & `Click_Fire_Breath`).
- 📸 Improved studio lighting and neutral background in `render_contact_sheet.py`.
- 🔍 VLM Critic audit on modular bishop: face likeness increased from 4.0 to 6.8/10.

## [0.1.18] - 2026-10-10

- 🧪 Showcase: multiple 3D versions (Ale v1 / v2) are shown **side by side** again, inside the same-size 3D pane (labels instead of tabs; spacing and camera fit the real width of the loaded models). **Single click** on the 3D (not a drag) = fullscreen with all versions; the double-click handler is gone.

## [0.1.17] - 2026-10-10

- 🧪 Showcase: every card has the same size again (no more full-width Ale card) and every 3D model is normalised to the **same height** (spin radius capped for wide props), so all characters render at the same scale. Multiple 3D versions → `v1 / v2` tabs inside the normal 3D pane.

## [0.1.16] - 2026-10-10

- ♗ Ale 1 (con cappello) 3D **v2** via TRELLIS multi-image (front + 3/4 + NB 2.1 back, 39 s, seed 42) → `tools/model-pipeline/ale/out/ale1_hat_f_tq_back.glb`. **Rejected by Riccardo**: the dragon came out as two half-dragons. `assets/models/bishop-ale-1.glb` stays v1.
- 🧪 Showcase: 3D versions side by side (v1 left, v2 right, spinning in sync) in a full-width card; double click or ⛶ = fullscreen (Esc to exit); camera auto-fits the pane.
- 🔐 `scripts/check.py`: secret scan only covers committable files (`git ls-files --cached --others --exclude-standard`), so a gitignored `.env` no longer fails `just test`.
- 🧹 CHANGELOG: merged a duplicated `[0.1.11]` heading; this entry renumbered 0.1.14 → 0.1.16 when rebased onto `origin/main` (parallel sessions bumped the same numbers).

## [0.1.15] - 2026-10-10

- 🎯 Added ready-to-run autonomous `/goal` prompt in [`etc/prompts/GOAL_BUILD_CARCHESS3D.md`](etc/prompts/GOAL_BUILD_CARCHESS3D.md) combining `niccolo-game-design` (Managers + Queued Event Bus + `DropManager` 🍀 Luck Meter) with Geneviève's 5 Argon 3D Workflows (`floorplan.svg`, parallel subagents, `progress.html` + `?debug=1` sliders, and 4-angle Adversarial Critic loop ≥ 9/10).
- 🛤️ Created Conductor track `v1_carchess3d` (`conductor/tracks.md`, `conductor/tracks/v1_carchess3d/spec.md`, `conductor/tracks/v1_carchess3d/plan.md`) with locked `/roastme` decisions.

## [0.1.14] - 2026-10-10

- 🔀 Merged `origin/vlm-critic` into `main` with `conductor/` SDD setup (Forged with Argon ✨), reconciling version history, adding `UV_INDEX_URL=https://pypi.org/simple` to `just critic` for Derek compatibility, and removing the superseded root `tools/model-pipeline/critic_vlm.py` draft in favor of `tools/model-pipeline/critic/critic_vlm.py`.
- 🎼 **Conductor SDD Setup (Forged with Argon ✨)**: initialized `conductor/` (`index.md`, `product.md`, `product-guidelines.md`, `tech-stack.md`, `workflow.md`, and `code_styleguides/`), incorporating `ABORTED_CONDUCTOR_SPECS.md` (Mode 1 Playable Chessboard + Mode 2 3D WOW Mode & Turntable Inspector, rigged Bishop Ale `bishop-ale-rigged.glb`, and `niccolo-game-design` Managers + Typed Event Bus architecture).
- 🇨🇭🐸 **Zurich Enchanted Swamp & 16:9 Veo 3D Cinema**: defined the v1 scope (*Carlesso Family* vs *Classic Stone Wizard Chess* set, max 6×6 combinations), the special **Seby ↔ Pupurabbu** best-friends cuddle bond, the Lyria 3 bilingual (IT/EN) theme song for Ale & Seby, and the 16:9 background 3D Cinema screen projecting Veo battle clips tracked via `assets/battles/manifest.yaml` MD5 hashes.

## [0.1.13] - 2026-10-10

- 🤖 Added automated VLM & Geometric QA Critic in `tools/model-pipeline/critic/` (`critic_vlm.py`, `render_contact_sheet.py`).
- 📸 Blender headless 4-view contact sheet renderer with tracking camera.
- 🎯 Multimodal Gemini VLM evaluator auditing face likeness drift, companion/prop deformation, and back plausibility.
- 🛠️ Added `just critic <glb> <concept>` recipe.

## [0.1.12] - 2026-10-10

- 👸 Generated Final Canonical Queen Kate with Nano Banana 2.1 in `tools/model-pipeline/kate/final_queen_canonical/` (Option 3 authentic face, emerald green eyes, navy round glasses, royal purple gown, gold ring).

## [0.1.11] - 2026-10-10

- 👸 Generated 4 diverse authentic likeness alternatives for Queen Kate in `tools/model-pipeline/kate/wild_alternatives/` based exclusively on original version 4 + navy glasses.
- 🧪 Throwaway character showcase `showcase/index.html` (`just showcase`): one card per default character, 2D front/back + auto-rotating 3D GLB (Ale 1 con cappello 🏆, Puffin). Not the game.
- 📦 Vendored three.js r170 (`vendor/three/`: core + GLTFLoader + BufferGeometryUtils, MIT).
- 📓 RUNNING_DOC: corrected §13 (the Flash 2.5 "mitre hallucination" was asked for by the prompt) and added a caveat to §14 (NB 2.1 ran with a different prompt after a `PROHIBITED_CONTENT` block).

## [0.1.10] - 2026-10-10

- 👸 Generated Queen Kate merge edits (`merge_4e` and `merge_4g`): authentic facial likeness of 4 + youthful (~20s) glow + navy blue glasses.

## [0.1.9] - 2026-10-10

- 👸 Generated Queen Kate 4a, 4b, 4c edits with Nano Banana 2.1 in `tools/model-pipeline/kate/` (younger, radiant face + stylish navy blue glasses).
- 👑 Generated King Riccardo side profile variations without glasses in `tools/model-pipeline/king/side_profile_noglasses/`.

## [0.1.8] - 2026-10-10

- 👑 Generated 360° turnaround dataset for King Riccardo with Nano Banana 2.1 in `tools/model-pipeline/king/` (`front.png`, `side.png`, `back.png`, `threequarter.png`, `king_turnaround_sheet.png`).
- 🏰 Generated 360° turnaround dataset for Rook Pupurabbu with Nano Banana 2.1 in `tools/model-pipeline/rook/` (`front.png`, `side.png`, `back.png`, `threequarter.png`, `rook_turnaround_sheet.png`).
- 🧱 Added TRELLIS multi-image reconstruction pipelines for King Riccardo and Rook Pupurabbu.

## [0.1.7] - 2026-10-09

- 🍌 Generated complete 360° turnaround dataset for Unarmed Knight Sebastian with Nano Banana 2.1 (`front.png`, `side.png`, `side_left.png`, `back.png`, `threequarter.png`, `seby_turnaround_sheet.png`).

## [0.1.6] - 2026-10-09

- ⚔️ Generated 4 weapon variants for Knight Sebastian with Nano Banana 2.1 in `tools/model-pipeline/seby/weapon_variants/` (Lightsaber 🔵, Long Lance 🚩, Unarmed/Scary 👊, Epic Excalibur Sword ⚔️).

## [0.1.5] - 2026-10-09

- 🐴 Knight Sebastian pipeline in `tools/model-pipeline/seby/`: preprocessed front/3/4 views from concept #4/#5.
- 🍌 Generated 180° back views for Knight Sebastian with Nano Banana 2.1 (`back_nb_2.1.png`) and Nano Banana Pro (`back_nb_pro.png`).
- 🧱 Created `gen_textured.py` multi-image TRELLIS pipeline for Knight Sebastian.

## [0.1.4] - 2026-10-09

- 🗄️ Archived dragon bishop variant (`assets/models/archive/bishop-ale-2-dragon-rigged.glb`).
- ♗ Activated Bishop Ale #1 with mitre hat (`assets/models/bishop-ale-1.glb`) as main bishop.

## [0.1.3] - 2026-10-09

- 📖 Added `docs/3dgames.md`: practical 3D guide covering how to view `.glb`/`.gltf` models on Linux and in the browser (F3D, Blender CLI, Don McCurdy viewer, MIME associations).
- 🛠️ Added `just blender <model.glb>` recipe to immediately import and view GLB models in Blender from CLI.

## [0.1.2] - 2026-10-09

- 🐉 Rigged & animated Bishop Ale (`assets/models/bishop-ale-rigged.glb`) with a 26-bone armature and smooth segment-distance skinning.
- 🪽 Red Baby Dragon has independent bone chains (`Dragon_Wing_Base`, `Dragon_Wing_Tip`, `Dragon_Head`, `Dragon_Jaw`, `Dragon_Tail`) with continuous wing flapping and gliding (`Idle`) and interactive fire-breath attack (`Click_Fire_Breath`).
- 🎲 Installed `niccolo-game-design` skill in `.agents/skills/niccolo-game-design/`.
- 📓 Added section 11 in `RUNNING_DOC.md` for rigging and animation pipeline.

## [0.1.1] - 2026-10-09

- 🐧 `pawn-puffin.glb` upgraded to the **true multi-image** TRELLIS run (front + side + back, run C2): the back now has a black head and a striped uniform instead of an invented white blob.
- 🧪 RUNNING_DOC §10: view-set results (A vs B2/C2/D2) and grid; recommendation: front + back, + side if accurate, skip top.
- ♗ Generated 3D model for Bishop Ale #2 (`assets/models/bishop-ale-2.glb`) via TRELLIS multi-image pipeline.
- 🧱 Added `tools/model-pipeline/ale2/` pipeline script and preview artifacts (MP4, GIF, frame strip).
- 📓 Updated `RUNNING_DOC.md` with Ale 2 run details.

## [0.1.0] - 2026-10-09

- 🎉 Repo created: the implementation home of the
  [chess3d spec](https://github.com/palladius/respec/blob/main/carlesso-family/chess3d/SPEC.md).
- 🚽 Logo *Carlesso al Cesso* (badge) + 2 alternatives, made with Nano Banana Pro.
- 🖼️ All 2D character art copied from `respec` into `assets/characters/`.
- ♙♗ First TRELLIS draft models `assets/models/{pawn-puffin,bishop-ale-1}.glb`.
- 🧱 `tools/model-pipeline/`: image→3D experiments (Hunyuan3D-2, TRELLIS,
  Nano Banana extra views) and the lab notebook `RUNNING_DOC.md`, moved over
  from `respec`.
- 🧪 `just test` → `scripts/check.py` (GLB validity, naming, secret scan).
