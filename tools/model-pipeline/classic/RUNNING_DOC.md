# Running Doc: Carlessian Classic Chess Family (`classic_default_pieces_20261010`) 🗿🚽

## 1. Overview & Architecture

This document logs the end-to-end 2D and 3D asset generation pipeline for the **Carlessian Classic Chess Family (`classic`)**, built in strict isolation under `tools/model-pipeline/classic/` and registered declaratively via `assets/families/classic.json`.

- **2D Concept Art Generator:** `tools/model-pipeline/classic/gen_classic_portraits.py`
  - **Model:** `gemini-nano-banana-2.1` (`16:9` side-by-side Front + 3/4 Isometric turnaround sheets at `1376×768`)
  - **Output:** Flat JPEG portraits in `assets/characters/<piece>-classic-<slug>.jpg`
- **3D Deterministic Sculptor:** `tools/model-pipeline/classic/staunton_builder.py` & `tools/model-pipeline/classic/build_classic_pieces.py`
  - **Method:** Closed 2-manifold surface-of-revolution lathes (`revolve_profile`), parallel-transport 3D spine lofts (`loft_tube`), closed tori (`make_torus`), and subdivided superellipsoids (`make_ellipsoid` / `make_rounded_box`).
  - **Atomic Export:** Writes binary glTF 2.0 to `*.glb.part` and atomically renames via `os.replace()` to `assets/models/classic/<piece>-classic-<slug>.glb`.
- **Geometry & Turntable QA Critic:** `tools/model-pipeline/classic/critic_classic.py`
  - Renders a 2× supersampled Z-buffer PBR Blinn-Phong 6×4 turntable contact sheet (`tools/model-pipeline/classic/classic_contact_sheet.png`) and writes `docs/qa-scores.classic.yaml`.

---

## 2. 2D Nano Banana 2.1 Portrait Prompts & Parameters

All 6 portraits were generated with `model="gemini-nano-banana-2.1"` and `ImageConfig(aspect_ratio="16:9")`:

| Piece | Slug | Output File | Resolution | Signature Design Highlights |
| :--- | :--- | :--- | :--- | :--- |
| ♔ King | `king-classic-re` | `assets/characters/king-classic-re.jpg` | `1376×768` | Pure Staunton King in fluted ivory marble & royal gold, crimson velvet crown dome, golden **Cross Pattee** finial |
| ♕ Queen | `queen-classic-regina` | `assets/characters/queen-classic-regina.jpg` | `1376×768` | Pure fluted Staunton Queen in ivory marble & gold, **8-spike royal gold coronet** with 8 ivory pearls & central golden orb |
| ♗ Bishop | `bishop-classic-vescovo` | `assets/characters/bishop-classic-vescovo.jpg` | `1376×768` | **Busto di San Gennaro** (Patron Saint of Naples) reliquary bust in crimson-and-gold brocade cope, glowing ruby **Ampolla del Sangue** medallion on chest, jewel-encrusted Baroque mitre & golden pastoral crosier |
| ♘ Knight | `knight-classic-cavallo` | `assets/characters/knight-classic-cavallo.jpg` | `1376×768` | Pure sculpted **Staunton Warhorse** with arched neck, crisp jaw break, scalloped marble mane & brushed gold bridle |
| ♖ Rook | `rook-classic-torre` | `assets/characters/rook-classic-torre.jpg` | `1376×768` | **Torre Matildea / Rocca Estense** (Ferrara & Lidi Ferraresi) in warm terracotta brickwork, ivory marble corner quoins, overhanging corbel machicolations (`beccatelli e caditoie`), battlements & octagonal roof lantern |
| ♙ Pawn | `pawn-classic-pedone` | `assets/characters/pawn-classic-pedone.jpg` | `1376×768` | Pure iconic **Staunton Pawn** with stepped pedestal, concave baluster shaft, double gold collar & smooth ivory sphere top |

---

## 3. 3D `.glb` Model Metrics (`assets/models/classic/`)

All 6 `.glb` models strictly satisfy `assets/families/_contract.json`:
- Pedestal diameter: `0.75m`
- Grounding: `min.y == 0.0000m` (`abs(min.y) < 1e-3`)
- Watertight manifold: `is_watertight == True`, `stray_island_count == 0`
- Required named PBR material slots present on every piece: `faction_primary` (`#f5f0e6`) and `faction_trim` (`#d4af37`), plus accent materials (`accent_crimson`, `accent_emerald`, `accent_terracotta`, `accent_porcelain`, `accent_obsidian`).

| Piece | Model File | Height (`Y`) | Min `Y` | Triangles | Watertight | Stray Islands |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| ♔ King | `assets/models/classic/king-classic-re.glb` | `1.800m` | `0.0000m` | `17,072` | `True` | `0` |
| ♕ Queen | `assets/models/classic/queen-classic-regina.glb` | `1.650m` | `0.0000m` | `14,832` | `True` | `0` |
| ♗ Bishop | `assets/models/classic/bishop-classic-vescovo.glb` | `1.450m` | `0.0000m` | `19,744` | `True` | `0` |
| ♘ Knight | `assets/models/classic/knight-classic-cavallo.glb` | `1.350m` | `0.0000m` | `11,008` | `True` | `0` |
| ♖ Rook | `assets/models/classic/rook-classic-torre.glb` | `1.300m` | `0.0000m` | `20,784` | `True` | `0` |
| ♙ Pawn | `assets/models/classic/pawn-classic-pedone.glb` | `0.950m` | `0.0000m` | `9,648` | `True` | `0` |

---

## 4. Reproducible Commands

```bash
# 1. Generate 2D Nano Banana 2.1 portraits
UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy \
  uv run tools/model-pipeline/classic/gen_classic_portraits.py

# 2. Build 6 watertight 3D .glb models
UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy \
  uv run tools/model-pipeline/classic/build_classic_pieces.py

# 3. Run geometry QA & render 6x4 turntable contact sheet
UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy \
  uv run tools/model-pipeline/classic/critic_classic.py

# 4. Run repository sanity checks & unit tests
python3 scripts/check.py
python3 -m unittest tests/test_classic_family.py -v
```
