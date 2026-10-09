# Changelog

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
