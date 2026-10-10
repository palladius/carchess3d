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

| Piece | Slug | Output File | Resolution | Signature Easter Egg Prompt Highlights |
| :--- | :--- | :--- | :--- | :--- |
| ♔ King | `king-classic-cesso` | `assets/characters/king-classic-cesso.jpg` | `1376×768` | Polished ivory marble & gold Staunton King, rune-engraved base, miniature **Golden Royal Toilet-Throne finial** with porcelain seat, cistern, armrests & mini crown |
| ♕ Queen | `queen-classic-ciocco` | `assets/characters/queen-classic-ciocco.jpg` | `1376×768` | Fluted ivory marble & gold Staunton Queen, sleek tortoise-shell eyeglasses, **Swiss dark-chocolate wave coronet** with 8 golden truffle pearls |
| ♗ Bishop | `bishop-classic-drago` | `assets/characters/bishop-classic-drago.jpg` | `1376×768` | Pointed ivory marble Bishop mitre with diagonal scroll slit, cute **ruby-scarlet dragon head, golden horns, wing & scaly tail** emerging from slit, **purple amethyst crystal finial** |
| ♘ Knight | `knight-classic-turbo` | `assets/characters/knight-classic-turbo.jpg` | `1376×768` | Carved ivory marble Staunton horse head & scalloped mane, **brass & glowing cyan racing goggles**, twin chrome/gold **side turbo exhausts**, **hot-orange loop-track base rim** |
| ♖ Rook | `rook-classic-puffo` | `assets/characters/rook-classic-puffo.jpg` | `1376×768` | Carved ivory marble Grossmünster masonry castle tower with gold rings & battlements, cute **purple monster ('Puffo / Pupurabbu')** peeking out with big blue eyes & paws on merlons |
| ♙ Pawn | `pawn-classic-puffin` | `assets/characters/pawn-classic-puffin.jpg` | `1376×768` | Ivory marble & gold Staunton Pawn, spherical head with **striped orange puffin beak**, **silver-steel & gold Swiss Guard morion helmet**, and **crimson feather plume** |

---

## 3. 3D `.glb` Model Metrics (`assets/models/classic/`)

All 6 `.glb` models strictly satisfy `assets/families/_contract.json`:
- Pedestal diameter: `0.75m`
- Grounding: `min.y == 0.0000m` (`abs(min.y) < 1e-3`)
- Watertight manifold: `is_watertight == True`, `stray_island_count == 0`
- Required named PBR material slots present on every piece: `faction_primary` (`#f5f0e6`) and `faction_trim` (`#d4af37`), plus character accent materials (`accent_porcelain`, `accent_choco`, `accent_ruby`, `accent_amethyst`, `accent_cyan`, `accent_orange`, `accent_steel`, `accent_puffo`, `accent_crimson`, `accent_obsidian`).

| Piece | Model File | Height (`Y`) | Min `Y` | Triangles | Watertight | Stray Islands |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| ♔ King | `assets/models/classic/king-classic-cesso.glb` | `1.800m` | `0.0000m` | `15,736` | `True` | `0` |
| ♕ Queen | `assets/models/classic/queen-classic-ciocco.glb` | `1.650m` | `0.0000m` | `17,040` | `True` | `0` |
| ♗ Bishop | `assets/models/classic/bishop-classic-drago.glb` | `1.450m` | `0.0000m` | `12,156` | `True` | `0` |
| ♘ Knight | `assets/models/classic/knight-classic-turbo.glb` | `1.350m` | `0.0000m` | `11,208` | `True` | `0` |
| ♖ Rook | `assets/models/classic/rook-classic-puffo.glb` | `1.300m` | `0.0000m` | `12,960` | `True` | `0` |
| ♙ Pawn | `assets/models/classic/pawn-classic-puffin.glb` | `0.950m` | `0.0000m` | `12,400` | `True` | `0` |

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
