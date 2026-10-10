# Swamp Parody Chess Family — 2D & 3D Pipeline Running Log (`swamp_family_pieces_20261010`) 🐸🧅

## 1. Pipeline Overview & Resource Arbitration

- **Track**: `swamp_family_pieces_20261010` ("Famiglia della Palude / Swamp Family")
- **Contract**: `assets/families/_contract.json` (`pedestal_diameter_m = 0.75`, `grounding_y_m = 0.0`, `max_triangles_per_piece = 25000`, required materials `faction_primary` and `faction_trim`)
- **ZeroGPU Arbitration Rule**: Default 3D synthesis runs 100% locally via headless Python `trimesh` Chibi sculpting (`tools/model-pipeline/swamp/build_swamp_models.py`) so the companion Carlesso machine keeps 100% ZeroGPU quota priority unless `SWAMP_TRELLIS=1` is set.
- **IP-Safety Guardrail**: All character concepts, prompts, wardrobe palettes, and 3D meshes are 100% original fairy-tale swamp parodies audited by `@art-critic` (Gate A & Gate B) and `tests/test_swamp_family.py`.

---

## 2. Stage 1 — Nano Banana 2D Character Portraits (`tools/model-pipeline/swamp/gen_swamp_views.py`)

Command:
```bash
UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy \
  uv run tools/model-pipeline/swamp/gen_swamp_views.py
```

Shared studio cyclorama suffix:
> `Standing on a round mossy flagstone pedestal with a thin gold rim, dark slate studio backdrop, soft three-point lighting, no text. Masterpiece 3D collectible chibi vinyl-toy chess figurine, subtle subsurface scattering, shallow depth of field, whole figurine and round chess pedestal 100% visible from base to tip, no watermark, no labels, no extra props.`

| Piece | Slug | Output Portrait | Resolution | Key Design & Wardrobe Traits |
| :--- | :--- | :--- | :--- | :--- |
| ♔ King | `king-swamp-orco` | `assets/characters/king-swamp-orco.jpg` | `1024×1024` | *Orco Brontolo*: olive-green swamp ogre king with broad droopy boar-like ears, plum-purple & mossy-green quilted royal doublet with carved tree-bark shoulder pauldrons, twisted oak-root King crown with amber gems & cross finial, holding a golden sprouted-onion sceptre. |
| ♕ Queen | `queen-swamp-orchessa` | `assets/characters/queen-swamp-orchessa.jpg` | `1024×1024` | *Principessa Orchessa*: olive-green ogress queen with round ears, copper-ginger hair in a high top-knot bun with wavy side locks & gold hair rings, burgundy-crimson & mustard-gold brocade Renaissance gown, multi-peaked golden Queen coronet tiara, in an open-palm Kung-Fu guard stance. |
| ♗ Bishop | `bishop-swamp-focaccina` | `assets/characters/bishop-swamp-focaccina.jpg` | `1024×1024` | *Mago Focaccina*: golden-baked Italian Ligurian focaccia-bread wizard with dimpled crust, 3 black Taggiasca olive buttons, fresh rosemary needles, coarse sea-salt split-peak focaccia Bishop mitre, holding a thick twisted sesame grissino crosier staff. |
| ♘ Knight | `knight-swamp-asinello` | `assets/characters/knight-swamp-asinello.jpg` | `1024×1024` | *Asinello Chiacchierone*: warm chestnut-brown & cream-dappled Mediterranean pack-burro with arched Knight neck, thick upright furry ears, clever closed smirk, carved oak & gold tournament saddle, crimson caparison, wooden onion buckler & red-gold heraldic plume crest. |
| ♖ Rook | `rook-swamp-draghessa` | `assets/characters/rook-swamp-draghessa.jpg` | `1024×1024` | *Draghessa della Palude*: crenellated grey-stone Rook watchtower with 6 squared stone battlement merlons, arrow-slit windows, and a coiled ruby-crimson & emerald-bellied swamp dragon with unfurled bat-wings, golden dorsal spines & heart-tipped tail. |
| ♙ Pawn | `pawn-swamp-tappo` | `assets/characters/pawn-swamp-tappo.jpg` | `1024×1024` | *Guardia Re Tappo*: pompous short adult Renaissance palace herald-guard with plump rosy cheeks (round chin) and golden-blond curls, standing on a stack of 3 thick leather-bound royal decree law-books & scrolls, wearing royal sapphire-blue & silver-gold livery, white silk cape, holding a wax-sealed scroll, topped with a domed sapphire-blue velvet capotain hat & golden Pawn sphere finial. |

---

## 3. Stage 2 — Chibi 3D Sculptor & Turntable Contact Sheet (`tools/model-pipeline/swamp/build_swamp_models.py`)

Command:
```bash
UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy \
  uv run tools/model-pipeline/swamp/build_swamp_models.py
```

### Geometry & Contract Audit (`tools/model-pipeline/swamp/critic_swamp.py`)

| Model File | Role | Target Height (`Y`) | Measured `min.y` | Measured `max.y` | Triangles (`<= 25k`) | Watertight | Stray Islands | Faction Materials |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `king-swamp-orco.glb` | King | `1.80m` | `0.0000m` | `1.8000m` | `~23.9k` | `True` | `0` | `faction_primary`, `faction_trim` + 9 PBR slots |
| `queen-swamp-orchessa.glb` | Queen | `1.65m` | `0.0000m` | `1.6500m` | `~21.6k` | `True` | `0` | `faction_primary`, `faction_trim` + 7 PBR slots |
| `bishop-swamp-focaccina.glb` | Bishop | `1.45m` | `0.0000m` | `1.4500m` | `~15.7k` | `True` | `0` | `faction_primary`, `faction_trim` + 7 PBR slots |
| `knight-swamp-asinello.glb` | Knight | `1.35m` | `0.0000m` | `1.3500m` | `~16.2k` | `True` | `0` | `faction_primary`, `faction_trim` + 8 PBR slots |
| `rook-swamp-draghessa.glb` | Rook | `1.30m` | `0.0000m` | `1.3000m` | `~19.7k` | `True` | `0` | `faction_primary`, `faction_trim` + 7 PBR slots |
| `pawn-swamp-tappo.glb` | Pawn | `0.95m` | `0.0000m` | `0.9500m` | `~16.4k` | `True` | `0` | `faction_primary`, `faction_trim` + 9 PBR slots |

- **Turntable Contact Sheet**: `tools/model-pipeline/swamp/swamp_contact_sheet.png` (`1540×2752`, 6 rows × 4 columns: `Front 0 deg`, `3/4 View 38 deg`, `Side 90 deg`, `Back 180 deg`).
- **QA Scoreboard**: `docs/qa-scores.swamp.yaml`.
