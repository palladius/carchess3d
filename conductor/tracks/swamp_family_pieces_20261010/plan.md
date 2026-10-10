# Implementation Plan: `swamp_family_pieces_20261010` — Swamp Parody Chess Family ("Famiglia della Palude")

> **Forged with Argon** ✨ — Parallel-Safe Track for the Swamp Parody Set, incorporating `fable-5.1-high` IP-safety, ZeroGPU arbitration, and zero-collision guardrails.

---

## Phase 1: Toolchain Preflight, TDD IP-Safety & Geometry Harness + Nano Banana Turnarounds (`tools/model-pipeline/swamp/`)

- [ ] Task: Run toolchain preflight & write failing validation and IP-safety tests (`tests/test_swamp_family.py`)
    - [ ] Verify `uv`, Python `trimesh`/`numpy`/`pillow`, and `GEMINI_API_KEY` availability without touching shared `tools/model-pipeline/nbviews/` scripts.
    - [ ] Write `tests/test_swamp_family.py` (`unittest` stdlib runner) asserting all 6 flat character portraits (`assets/characters/<piece>-swamp-<slug>.jpg`), 6 `.glb` models (`assets/models/swamp/<piece>-swamp-<slug>.glb`), and `assets/families/swamp.json` exist, pass `scripts/check.py`, pass a strict IP-safety regex scan across `tools/model-pipeline/swamp/**` and `assets/families/swamp.json`, and satisfy `abs(min.y) < 1e-3` grounding.
- [ ] Task: Generate Nano Banana 2D cutie portraits & multi-view turnarounds (`tools/model-pipeline/swamp/gen_swamp_views.py`)
    - [ ] Generate views for `king-swamp-orco` (Orco Brontolo), `queen-swamp-orchessa` (Principessa Orchessa), and `knight-swamp-asinello` (Asinello Chiacchierone).
    - [ ] Generate views for `bishop-swamp-focaccina` (Mago Focaccina), `rook-swamp-draghessa` (Draghessa della Palude), and `pawn-swamp-tappo` (Guardia Re Tappo).
    - [ ] Save canonical portraits flat in `assets/characters/<piece>-swamp-<slug>.jpg` and log prompts in per-track `tools/model-pipeline/swamp/RUNNING_DOC.md`.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Decision-Tree 3D Generation & Chibi Pedestal Grounding (`assets/models/swamp/`)

- [ ] Task: Build Chibi 3D Sculptor + Optional `SWAMP_TRELLIS=1` Decision-Tree Pipeline (`tools/model-pipeline/swamp/build_swamp_models.py`)
    - [ ] Default to headless Python `trimesh`/Blender stylized chibi sculpting + UV projection so the companion Carlesso machine keeps 100% ZeroGPU quota priority; if `SWAMP_TRELLIS=1` is set, run multi-view TRELLIS into `tools/model-pipeline/swamp/out/` and automatically fall back to chibi sculpt if `critic_swamp.py` score `< 6` or mesh is non-watertight.
    - [ ] Mount all meshes onto standardized swamp-stone pedestals (`Ø 0.75m`, `min.y = 0.0`) with named `faction_primary` and `faction_trim` material slots, writing to `*.glb.part` before atomic rename.
- [ ] Task: Generate, refine, and validate all 6 `assets/models/swamp/<piece>-swamp-<slug>.glb` meshes
    - [ ] Atomically export `king-swamp-orco.glb` (`1.80m`), `queen-swamp-orchessa.glb` (`1.65m`), `bishop-swamp-focaccina.glb` (`1.45m`), `knight-swamp-asinello.glb` (`1.35m`), `rook-swamp-draghessa.glb` (`1.30m`), and `pawn-swamp-tappo.glb` (`0.95m`).
    - [ ] Run `tools/model-pipeline/swamp/critic_swamp.py` (writing scores to `docs/qa-scores.swamp.yaml`) and render the 6×4 turntable contact sheet (`tools/model-pipeline/swamp/swamp_contact_sheet.png`), logging metrics in `tools/model-pipeline/swamp/RUNNING_DOC.md`.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Zero-Collision Declarative Family Manifest & Release Fragment (`assets/families/swamp.json`)

- [ ] Task: Create and test declarative family manifest (`assets/families/swamp.json`)
    - [ ] Populate bilingual labels (`it` / `en`), all 6 piece definitions (`model`, `portrait`, `height_m`, `attack_sig`, `victim_reaction`), and `faction_primary` / `faction_trim` material definitions.
    - [ ] Verify `tests/test_swamp_family.py` and `just test` pass 100%.
- [ ] Task: Write isolated changelog fragment & verify track scope ownership
    - [ ] Write `CHANGELOG.d/swamp_family_pieces_20261010.md` (leaving root `VERSION` and `CHANGELOG.md` untouched for the merge integrator).
    - [ ] Verify `git status --porcelain` only touches paths declared in `metadata.json` `owns`.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
