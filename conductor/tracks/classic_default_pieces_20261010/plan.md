# Implementation Plan: `classic_default_pieces_20261010` — Carlessian Classic Chess Family

> **Forged with Argon** ✨ — Parallel-Safe Track for the "Classic Carlessiano" Set, incorporating `fable-5.1-high` zero-collision guardrails.

---

## Phase 1: Toolchain Preflight, TDD Validation Harness & Nano Banana 2D Cutie Portraits (`tools/model-pipeline/classic/`)

- [x] Task: Run toolchain preflight & write failing validation tests (`tests/test_classic_family.py`)
    - [x] Verify `uv`, Python `trimesh`/`numpy`/`pillow` (and optional portable `blender`), and `GEMINI_API_KEY` availability without modifying shared scripts in `tools/model-pipeline/nbviews/`.
    - [x] Write `tests/test_classic_family.py` (`unittest` stdlib runner) asserting presence and naming parity of all 6 portraits (`assets/characters/<piece>-classic-<slug>.jpg`), 6 meshes (`assets/models/classic/<piece>-classic-<slug>.glb`), `assets/families/classic.json`, glTF 2.0 header + `POSITION` accessor grounding (`abs(min.y) < 1e-3`), monotonic height hierarchy (`pawn < rook < knight < bishop < queen < king`), and `<= 25,000` triangles.
- [x] Task: Generate the 6 Nano Banana 2D Cutie Carlessian Classic portraits (`tools/model-pipeline/classic/gen_classic_portraits.py`)
    - [x] Copy and parametrize Nano Banana helper into `tools/model-pipeline/classic/gen_classic_portraits.py` (never editing `tools/model-pipeline/nbviews/nb_views.py`).
    - [x] Generate flat portraits in `assets/characters/`: `king-classic-cesso.jpg`, `queen-classic-ciocco.jpg`, `bishop-classic-drago.jpg`, `knight-classic-turbo.jpg`, `rook-classic-puffo.jpg`, and `pawn-classic-puffin.jpg`.
    - [x] Log prompts, model IDs, and parameters in per-track `tools/model-pipeline/classic/RUNNING_DOC.md`.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Deterministic 3D Sculpting of the 6 Carlessian Classic `.glb` Pieces (`assets/models/classic/`)

- [x] Task: Build reusable Staunton pedestal & lathe/CSG base library (`tools/model-pipeline/classic/staunton_builder.py`)
    - [x] Create uniform pedestal ring (`Ø 0.75m`, grounded at `y = 0.0`) with named glTF PBR material slots (`faction_primary`, `faction_trim`) and atomic `.glb.part` → `.glb` writer.
- [x] Task: Generate Royals & Majors `.glb` models (`tools/model-pipeline/classic/build_classic_pieces.py`)
    - [x] Sculpt & atomically export `assets/models/classic/king-classic-cesso.glb` (`1.80m`, golden toilet-throne crown finial) and `assets/models/classic/queen-classic-ciocco.glb` (`1.65m`, chocolate-wave coronet + glasses).
    - [x] Sculpt & atomically export `assets/models/classic/bishop-classic-drago.glb` (`1.45m`, dragon-scale mitre + amethyst finial) and `assets/models/classic/rook-classic-puffo.glb` (`1.30m`, Grossmünster battlements + peeking monster eyes).
- [x] Task: Generate Minor Pieces & Pawns `.glb` models (`tools/model-pipeline/classic/build_classic_pieces.py`)
    - [x] Sculpt & atomically export `assets/models/classic/knight-classic-turbo.glb` (`1.35m`, carved horse head + racing goggles + side turbo exhausts + loop-track rim).
    - [x] Sculpt & atomically export `assets/models/classic/pawn-classic-puffin.glb` (`0.95m`, classic pawn + Swiss morion crest & plume).
- [x] Task: Run parametrized geometry critic & render 6×4 turntable contact sheet (`tools/model-pipeline/classic/classic_contact_sheet.png`)
    - [x] Verify watertightness, triangle count, and grounding via `tools/model-pipeline/classic/critic_classic.py` (writing scores to `docs/qa-scores.classic.yaml`).
    - [x] Document metrics and contact sheet in `tools/model-pipeline/classic/RUNNING_DOC.md`.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Zero-Collision Declarative Family Manifest & Release Fragment (`assets/families/classic.json`)

- [x] Task: Create and test declarative family manifest (`assets/families/classic.json`)
    - [x] Populate bilingual labels (`it` / `en`), all 6 piece definitions (`model`, `portrait`, `height_m`, `attack_sig`, `victim_reaction`), and `faction_primary` / `faction_trim` material definitions.
    - [x] Verify `tests/test_classic_family.py` and `just test` pass 100%.
- [x] Task: Write isolated changelog fragment & verify track scope ownership
    - [x] Write `CHANGELOG.d/classic_default_pieces_20261010.md` (leaving root `VERSION` and `CHANGELOG.md` untouched for the merge integrator so parallel tracks never conflict).
    - [x] Verify `git status --porcelain` only touches paths declared in `metadata.json` `owns`.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
