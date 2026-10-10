### Swamp Parody Chess Family (`swamp_family_pieces_20261010`) 🐸🧅

- **New Playable Family Manifest (`assets/families/swamp.json`)**: Added the 100% IP-safe **Famiglia della Palude / Swamp Family** roster with bilingual labels (`it`/`en`), standardized height hierarchy (`0.95m` → `1.80m`), and faction material slots (`faction_primary`, `faction_trim`).
- **Nano Banana 2D Character Portraits (`assets/characters/*-swamp-*.jpg`)**: Generated 6 glossy chibi collectible figurine portraits via `tools/model-pipeline/swamp/gen_swamp_views.py`:
  - ♔ `king-swamp-orco.jpg` (*Orco Brontolo* — Swamp Ogre King with oak-root crown & golden onion sceptre)
  - ♕ `queen-swamp-orchessa.jpg` (*Principessa Orchessa* — Warrior Ogress Queen with golden coronet & emerald gown)
  - ♗ `bishop-swamp-focaccina.jpg` (*Mago Focaccina* — Ligurian rosemary-and-olive focaccia mage with grissino crosier)
  - ♘ `knight-swamp-asinello.jpg` (*Asinello Chiacchierone* — Chatty grey pack-burro with medieval tournament crest)
  - ♖ `rook-swamp-draghessa.jpg` (*Draghessa della Palude* — Ruby-and-emerald swamp dragon coiled around a mossy stone Rook tower)
  - ♙ `pawn-swamp-tappo.jpg` (*Guardia Re Tappo* — Tiny pompous guard on a wooden stepping stool with oversized velvet beret knob)
- **Chibi 3D Sculpted GLB Models (`assets/models/swamp/*.glb`)**: Built and audited 6 watertight, grounded (`min.y == 0.0`) glTF 2.0 character meshes with `tools/model-pipeline/swamp/build_swamp_models.py`, verified by `tests/test_swamp_family.py` and rendered on the 6×4 turntable contact sheet (`tools/model-pipeline/swamp/swamp_contact_sheet.png`).
