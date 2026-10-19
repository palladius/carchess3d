# Implementation Plan: `piece_visual_recognition_20261013` — Riconoscibilità Visiva Pezzi, Ossidiana vs Avorio & Swarm Avversariale (GHI #32)

## Phase 1: TDD Foundation & Modular Visual Clarity Architecture (`tests/piece_clarity.test.mjs` + `src/views/PieceClarityHelper.js`)

- [x] Task: Write failing unit tests for the 5 Clarity Modes (`s1..s5`), Obsidian/Ivory contrast, universal role add-ons, pedestal wreaths, and polar-angle `< 20°` zenithal 2D auto-switch (`tests/piece_clarity.test.mjs`)
    - [x] Test `resolveClarityConfig(mode, polarAngleDeg, topDownCamera, force2dIcons)` across `'off'`, `'s1'`, `'s2'`, `'s3'`, `'s4'`, `'s5'`.
    - [x] Test that Black pedestal top face and GLB tint use true Obsidian (`#0d1017`) rather than light silver/ivory (`0xdce7f7` / `0xb8c6f0`).
    - [x] Test that all 6 piece roles (`k, q, r, b, n, p`) build distinct 3D universal role add-ons, pedestal wreaths, floating 2D billboards, and zenithal 2D classic discs.
- [x] Task: Implement `src/views/PieceClarityHelper.js` and wire into `src/views/PieceView.js`
    - [x] Implement `S1` (Zenithal 2D Classic Icons `< 20°` + HUD toggle), `S2` (Universal 3D Role Add-Ons), `S3` (True Obsidian `#0d1017` Pedestal & GLB Ivory-Suppressor Shader), `S4` (Sculpted 3D Pedestal Role Wreath + Floating 2D Sprite Crest), and `S5` (Adaptive Hybrid Champion).
- [x] Task: Add HUD Clarity Selector (`#hud-clarity-btn`), bilingual `I18N` strings (`src/core/Registry.js`), and `ProfileStorageListener` persistence
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Static GLB Role Add-On Baker & Provenance Sync (`tools/model-pipeline/bake_universal_role_addons.py`)

- [x] Task: Build and run `tools/model-pipeline/bake_universal_role_addons.py` across all 3 families (`carlesso`, `classic`, `swamp`)
    - [x] Bake deterministic static 3D role signifier meshes (`UniversalRoleAddon_<type>`) into all `.glb` files in `assets/models/*.glb`, `assets/models/classic/*.glb`, and `assets/models/swamp/*.glb` while preserving UV textures, materials, and skeletal rigs.
    - [x] Update MD5 hashes in `docs/models-provenance.yaml` and log in `tools/model-pipeline/RUNNING_DOC.md`.
    - [x] Verify `just provenance` and `just test` pass 100%.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Adversarial Agent Swarm & Blind VLM Recognizer at `0°` and `30°` (`scripts/critic_recognizability.py`)

- [x] Task: Run Adversarial Agent Swarm to critique and refine `S1..S5` visual parameters and build `scripts/critic_recognizability.py`
    - [x] Capture automated Playwright screenshots at `0°` (Vertical Zenithal) and `30°` (Semi-High 30° from vertical) across `off` (baseline) and `s1..s5` for `Carlesso vs Classic`, `Carlesso vs Swamp`, and `Carlesso vs Carlesso`.
    - [x] Run Gemini VLM Blind Piece Recognition evaluation and generate `docs/clarity_comparison_0deg_30deg.png` + `docs/clarity_vlm_report.json`.
- [x] Task: Update `docs/spec/SPEC.md`, `VERSION`, `CHANGELOG.md`, and post the visual report to GitHub Issue #32
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
