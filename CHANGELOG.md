# Changelog

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
