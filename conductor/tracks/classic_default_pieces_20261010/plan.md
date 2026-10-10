# Implementation Plan: `classic_default_pieces_20261010` — Carlessian Classic Chess Family

> **Forged with Argon** ✨ — Parallel-Safe Track for the "Classic Carlessiano" Set, incorporating `fable-5.1-high` zero-collision guardrails.

---

## Phase 1: Toolchain Preflight, TDD Validation Harness & Nano Banana 2D Cutie Portraits (`tools/model-pipeline/classic/`)

- [ ] Task: Run toolchain preflight & write failing validation tests (`tests/test_classic_family.py`)
    - [ ] Verify `uv`, Python `trimesh`/`numpy`/`pillow` (and optional portable `blender`), and `GEMINI_API_KEY` availability without modifying shared scripts in `tools/model-pipeline/nbviews/`.
    - [ ] Write `tests/test_classic_family.py` (`unittest` stdlib runner) asserting presence and naming parity of all 6 portraits (`assets/characters/<piece>-classic-<slug>.jpg`), 6 meshes (`assets/models/classic/<piece>-classic-<slug>.glb`), `assets/families/classic.json`, glTF 2.0 header + `POSITION` accessor grounding (`abs(min.y) < 1e-3`), monotonic height hierarchy (`pawn < rook < knight < bishop < queen < king`), and `<= 25,000` triangles.
- [ ] Task: Generate the 6 Nano Banana 2D Cutie Carlessian Classic portraits (`tools/model-pipeline/classic/gen_classic_portraits.py`)
    - [ ] Copy and parametrize Nano Banana helper into `tools/model-pipeline/classic/gen_classic_portraits.py` (never editing `tools/model-pipeline/nbviews/nb_views.py`).
    - [ ] Generate flat portraits in `assets/characters/`: `king-classic-cesso.jpg`, `queen-classic-ciocco.jpg`, `bishop-classic-drago.jpg`, `knight-classic-turbo.jpg`, `rook-classic-puffo.jpg`, and `pawn-classic-puffin.jpg`.
    - [ ] Log prompts, model IDs, and parameters in per-track `tools/model-pipeline/classic/RUNNING_DOC.md`.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Deterministic 3D Sculpting of the 6 Carlessian Classic `.glb` Pieces (`assets/models/classic/`)

- [ ] Task: Build reusable Staunton pedestal & lathe/CSG base library (`tools/model-pipeline/classic/staunton_builder.py`)
    - [ ] Create uniform pedestal ring (`Ø 0.75m`, grounded at `y = 0.0`) with named glTF PBR material slots (`faction_primary`, `faction_trim`) and atomic `.glb.part` → `.glb` writer.
- [ ] Task: Generate Royals & Majors `.glb` models (`tools/model-pipeline/classic/build_classic_pieces.py`)
    - [ ] Sculpt & atomically export `assets/models/classic/king-classic-cesso.glb` (`1.80m`, golden toilet-throne crown finial) and `assets/models/classic/queen-classic-ciocco.glb` (`1.65m`, chocolate-wave coronet + glasses).
    - [ ] Sculpt & atomically export `assets/models/classic/bishop-classic-drago.glb` (`1.45m`, dragon-scale mitre + amethyst finial) and `assets/models/classic/rook-classic-puffo.glb` (`1.30m`, Grossmünster battlements + peeking monster eyes).
- [ ] Task: Generate Minor Pieces & Pawns `.glb` models (`tools/model-pipeline/classic/build_classic_pieces.py`)
    - [ ] Sculpt & atomically export `assets/models/classic/knight-classic-turbo.glb` (`1.35m`, carved horse head + racing goggles + side turbo exhausts + loop-track rim).
    - [ ] Sculpt & atomically export `assets/models/classic/pawn-classic-puffin.glb` (`0.95m`, classic pawn + Swiss morion crest & plume).
- [ ] Task: Run parametrized geometry critic & render 6×4 turntable contact sheet (`tools/model-pipeline/classic/classic_contact_sheet.png`)
    - [ ] Verify watertightness, triangle count, and grounding via `tools/model-pipeline/classic/critic_classic.py` (writing scores to `docs/qa-scores.classic.yaml`).
    - [ ] Document metrics and contact sheet in `tools/model-pipeline/classic/RUNNING_DOC.md`.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Zero-Collision Declarative Family Manifest & Release Fragment (`assets/families/classic.json`)

- [ ] Task: Create and test declarative family manifest (`assets/families/classic.json`)
    - [ ] Populate bilingual labels (`it` / `en`), all 6 piece definitions (`model`, `portrait`, `height_m`, `attack_sig`, `victim_reaction`), and `faction_primary` / `faction_trim` material definitions.
    - [ ] Verify `tests/test_classic_family.py` and `just test` pass 100%.
- [ ] Task: Write isolated changelog fragment & verify track scope ownership
    - [ ] Write `CHANGELOG.d/classic_default_pieces_20261010.md` (leaving root `VERSION` and `CHANGELOG.md` untouched for the merge integrator so parallel tracks never conflict).
    - [ ] Verify `git status --porcelain` only touches paths declared in `metadata.json` `owns`.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
