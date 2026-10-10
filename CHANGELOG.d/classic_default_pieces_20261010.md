### Added — Carlessian Classic Chess Family (`classic_default_pieces_20261010`)

- **6 Nano Banana 2.1 (`gemini-nano-banana-2.1`) 2D Character Turnaround Portraits** (`assets/characters/<piece>-classic-<slug>.jpg`):
  - `king-classic-cesso.jpg` (1.80m Staunton King + rune pedestal + Golden Royal Toilet-Throne finial)
  - `queen-classic-ciocco.jpg` (1.65m fluted Staunton Queen + tortoise-shell glasses + Swiss dark-chocolate wave & golden pearl coronet)
  - `bishop-classic-drago.jpg` (1.45m Staunton Bishop mitre + ruby-scarlet dragon head & wing emerging from the diagonal slit + purple amethyst finial)
  - `knight-classic-turbo.jpg` (1.35m Staunton Knight horse head + brass/cyan racing goggles + twin side turbo exhausts + hot-orange loop-track base rim)
  - `rook-classic-puffo.jpg` (1.30m Zurich Grossmünster masonry castle turret + purple monster peeking over the crenelations)
  - `pawn-classic-puffin.jpg` (0.95m Staunton Pawn + striped orange puffin beak + steel/gold Swiss Guard morion helmet & crimson plume)
- **6 Deterministic Watertight 3D `.glb` Models** (`assets/models/classic/<piece>-classic-<slug>.glb`):
  - Built via `tools/model-pipeline/classic/staunton_builder.py` & `build_classic_pieces.py` with exact grounding (`min.y == 0.0`), `Ø 0.75m` pedestals, monotonic height hierarchy (`0.95m → 1.80m`), zero stray islands, and named PBR material slots (`faction_primary`, `faction_trim`, plus character accent materials).
- **Declarative Family Manifest & QA Harness**:
  - Added `assets/families/classic.json`, `docs/qa-scores.classic.yaml`, `tools/model-pipeline/classic/classic_contact_sheet.png`, `tools/model-pipeline/classic/RUNNING_DOC.md`, and `tests/test_classic_family.py`.
