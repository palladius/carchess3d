# Changelog

## [0.1.15] - 2026-10-10

- 📋 Centralized QA Scoreboard in `docs/qa-scores.yaml` tracking scores, tiers (`TOP_QUALITY 🟢`, `ACCEPTABLE 🟡`, `FA_CAGARE 💩`), structural flaws, and aesthetic critiques.
- 🔍 Automatic synchronization in `tools/model-pipeline/critic/critic_vlm.py` to update the scoreboard whenever a model is evaluated.
- 💩 Query CLI `tools/model-pipeline/critic/scoreboard.py` with `--cagare` / `--worst` filter.
- ⚡ Added `just scores` and `just shittest` recipes to quickly isolate failing models and their exact flaws.

## [0.1.14] - 2026-10-10

- 🐉 Modular Red Baby Dragon generation in `tools/model-pipeline/dragon/` (Nano Banana 2D turnaround views + Hunyuan3D-2 3D shape + procedural texturing).
- ♟️ Modular assembly script `tools/model-pipeline/rigging/assemble_modular_bishop.py` mounting clean dragon to Bishop Ale rig with dual animations (`Idle` wing glide & `Click_Fire_Breath`).
- 📸 Improved studio lighting and neutral background in `render_contact_sheet.py`.
- 🔍 VLM Critic audit on modular bishop: face likeness increased from 4.0 to 6.8/10.

## [0.1.13] - 2026-10-10

- 🤖 Added automated VLM & Geometric QA Critic in `tools/model-pipeline/critic/` (`critic_vlm.py`, `render_contact_sheet.py`).
- 📸 Blender headless 4-view contact sheet renderer with tracking camera.
- 🎯 Multimodal Gemini VLM evaluator auditing face likeness drift, companion/prop deformation, and back plausibility.
- 🛠️ Added `just critic <glb> <concept>` recipe.

## [0.1.12] - 2026-10-10

- 👸 Generated Final Canonical Queen Kate with Nano Banana 2.1 in `tools/model-pipeline/kate/final_queen_canonical/` (Option 3 authentic face, emerald green eyes, navy round glasses, royal purple gown, gold ring).

## [0.1.11] - 2026-10-10

- 👸 Generated 4 diverse authentic likeness alternatives for Queen Kate in `tools/model-pipeline/kate/wild_alternatives/` based exclusively on original version 4 + navy glasses.

## [0.1.11] - 2026-10-10

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
