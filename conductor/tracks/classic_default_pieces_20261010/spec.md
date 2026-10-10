# Track Specification: `classic_default_pieces_20261010` — Carlessian Classic Chess Family ("Scacchi Classici Carlessiani")

> **Track ID:** `classic_default_pieces_20261010`
> **Type:** Feature (Parallel-Safe Asset & Declarative Family Manifest Track)
> **Architecture:** `niccolo-game-design` (Headless Managers + `PieceView` Material Tinting + Declarative `assets/families/classic.json`)
> **Reviewed by:** `fable-5.1-high` (Swarm Architecture & Parallel-Safety Review incorporated)

## 1. Overview

Creates the **Default / Classic Rival Chess Family (`classic`)** as a 100% isolated, parallel-safe track that runs undisturbed while the companion machine generates Carlesso family `.glb` meshes and another agent runs `swamp_family_pieces_20261010`. Combines **deterministic Python `trimesh`/portable-Blender procedural lathe + CSG sculpting** with **Nano Banana 2D cutie portraits** to deliver classic Staunton silhouettes infused with humorous **Carlessian & Zurich easter eggs**.

## 2. Proposed Upstream Spec Sync (`~/git/respec/carlesso-family/chess3d/SPEC.md`)

Per `AGENTS.md`, we do not edit `~/git/respec` from here; we propose adding this 2-line note under `## Cast` in `carlesso-family/chess3d/SPEC.md` to align `SPEC.md` and `conductor/product.md`:

```diff
+### 🗿 Classic Carlessian Stone Set (`classic` — fast deterministic rival set)
+Classic Staunton carved stone/marble silhouettes (`<piece>-classic-<slug>`) with subtle Carlessian/Zurich finials (Golden Toilet-Throne King, Choco-Crown Queen, Dragon-Scroll Bishop, Turbo-Goggle Knight, Grossmünster/Puffo Turret Rook, Swiss-Helm Pawn).
```

## 3. Functional Requirements

1. **6 Classic Pieces with Carlessian/Zurich 3D Signatures & Basename Parity (`assets/models/classic/<piece>-classic-<slug>.glb`):**
   - ♔ **King (`king-classic-cesso.glb`)**: Classic Staunton King (`1.80m`) topped with a miniature **Golden Royal Toilet-Throne finial** (*Carlesso al Cesso!* homage) on a rune-carved pedestal (`attack_sig: "royal_flush_quake"`).
   - ♕ **Queen (`queen-classic-ciocco.glb`)**: Fluted Staunton Queen (`1.65m`) coronet sculpted with **chocolate-wave pearls and miniature glasses engraving** (`attack_sig: "marble_choco_crush"`).
   - ♗ **Bishop (`bishop-classic-drago.glb`)**: Classic Bishop mitre (`1.45m`) with a **carved dragon-scale scroll slit and amethyst crystal finial** (`attack_sig: "rune_laser_cleave"`).
   - ♘ **Knight (`knight-classic-turbo.glb`)**: Carved Staunton Knight horse head (`1.35m`) wearing **vintage racing goggles, side turbo exhaust pipes, and a loop-track base trim** (`attack_sig: "stone_hoon_charge"`).
   - ♖ **Rook (`rook-classic-puffo.glb`)**: Carved stone castle turret (`1.30m`, Grossmünster-inspired battlements with **carved stone monster eyes peeking from the crenelations**, `attack_sig: "fortress_slam"`).
   - ♙ **Pawn (`pawn-classic-puffin.glb`)**: Classic spherical-collar Pawn (`0.95m`) topped with a **carved stone Swiss morion crest & plume** (`attack_sig: "pike_bonk"`).
2. **Nano Banana Cutie Portraits (`assets/characters/<piece>-classic-<slug>.jpg`):**
   - Stored flat in `assets/characters/` to strictly pass `scripts/check.py` (`^(?P<piece>[a-z]+)-[a-z0-9-]+?(-\d+)?\.jpg$`):
     - `king-classic-cesso.jpg`, `queen-classic-ciocco.jpg`, `bishop-classic-drago.jpg`, `knight-classic-turbo.jpg`, `rook-classic-puffo.jpg`, `pawn-classic-puffin.jpg`.
3. **Headless-Safe Material Contract & Victim Reaction:**
   - Each `.glb` exports two named material slots (`faction_primary` and `faction_trim`) so `PieceView` (never headless `PieceManager`, per `niccolo-game-design` Rule 6) tints White (**Ivory Marble & Gold**) vs Black (**Obsidian Basalt & Silver**).
   - Default `victim_reaction: "stone_shrapnel_shatter"` via `VFXPoolManager`.
   - **Veo Scope:** Veo 16:9 videos remain Carlesso-only in v1; `classic` captures use 3D on-board choreography + 2D versus keyframe card fallback on the 16:9 Cinema screen.
4. **Zero-Collision Declarative Registration (`assets/families/classic.json`):**
   - Instead of editing shared JS managers or `showcase/index.html`, this track ships `assets/families/classic.json` with bilingual labels (`label: { "it": "Classici Carlessiani 🗿🚽", "en": "Carlessian Classic 🗿🚽" }`), piece metadata, heights, and attack/victim IDs.

## 4. Non-Functional & Parallel Isolation Guardrails (`fable-5.1-high` G1–G4)

- **Strict File Ownership (`metadata.json` `owns`):**
  - Only touches `tools/model-pipeline/classic/**`, `assets/models/classic/**`, `assets/characters/*-classic-*.jpg`, `assets/families/classic.json`, `docs/qa-scores.classic.yaml`, `CHANGELOG.d/classic_default_pieces_20261010.md`, and `tests/test_classic_family.py`.
  - Never edits `VERSION`, `CHANGELOG.md`, `tools/model-pipeline/RUNNING_DOC.md` (writes to `tools/model-pipeline/classic/RUNNING_DOC.md`), `showcase/index.html`, or shared scripts in `tools/model-pipeline/nbviews/`.
- **Atomic `.glb` Writes:**
  - All generators write to `<name>.glb.part` and atomically `os.replace()` to `<name>.glb` so concurrent `just test` runs never see a partial `.glb`.
- **Toolchain Portability (`derek` preflight):**
  - Uses `uv run` with Python `trimesh` / `numpy` / `scipy` / `pillow` (or portable Blender in `~/opt/blender` if present) so 3D generation works 100% headless even on machines without root `/usr/bin/blender`.

## 5. Acceptance Criteria

- [ ] All 6 `.glb` models generated in `assets/models/classic/<piece>-classic-<slug>.glb` with `min.y == 0.0`, pedestal `Ø 0.75m`, height hierarchy `0.95m → 1.80m`, watertight, `<= 25k` faces, and named material slots (`faction_primary`, `faction_trim`).
- [ ] All 6 flat Nano Banana portraits in `assets/characters/<piece>-classic-<slug>.jpg` pass `scripts/check.py`.
- [ ] `assets/families/classic.json`, `tools/model-pipeline/classic/RUNNING_DOC.md`, and `CHANGELOG.d/classic_default_pieces_20261010.md` created and validated by `tests/test_classic_family.py`.
- [ ] 4-angle turntable contact sheet (`tools/model-pipeline/classic/classic_contact_sheet.png`) rendered; `just test` passes 100%.

## 6. Out of Scope

- Modifying Carlesso `.glb` meshes or `tools/model-pipeline/{ale,puffin2,seby,king,queen,rook}/`.
- Editing `src/managers/PieceManager.js` or `showcase/index.html` directly during parallel execution.
