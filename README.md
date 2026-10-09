# 🏰🚽 CarChess3D: *Carlesso al Cesso* ♟️

<p align="center">
  <img src="docs/logo/logo.png" alt="Carlesso al Cesso: a cartoon chess king on a golden toilet-throne" width="320">
</p>

A **3D chess game for the Carlesso family**, playable offline. The pieces are the
family and their pets: Riccardo is the king, Kate the queen, Ale the bishop
(with his red baby dragon), Seby the knight, Pupurabbu the rook and the Puffins
are the pawns. Every capture plays a cartoon animation. Plain Three.js PWA: runs
on localhost, in the browser and on Android, even in airplane mode. ✈️

- 📐 **Spec** (source of truth):
  [`palladius/respec` → `carlesso-family/chess3d/SPEC.md`](https://github.com/palladius/respec/blob/main/carlesso-family/chess3d/SPEC.md)
- 🧱 **Image → 3D pipeline** (shared with the *Plastilina* spec):
  [`tools/model-pipeline/`](tools/model-pipeline/) with its
  [lab notebook](tools/model-pipeline/RUNNING_DOC.md)

## 🚦 Status

`v0.1.1`. Scaffold only: the first two character models exist; there is no
game code yet.

| Piece | Character | 2D art | 3D model |
|---|---|---|---|
| ♔ King | Riccardo | ✅ `king-riccardo-{1,2}` | ⏳ |
| ♕ Queen | Kate | ✅ `queen-kate-{1..5}` | ⏳ |
| ♗ Bishop | Ale (+ dragon) | ✅ `bishop-ale-{1,2}` | 🟡 [`bishop-ale-1.glb`](assets/models/bishop-ale-1.glb) (TRELLIS, single view) |
| ♘ Knight | Seby | ✅ `knight-seby-{1..5}` | ⏳ |
| ♖ Rook | Pupurabbu | ✅ `rook-pupurabbu` | ⏳ |
| ♙ Pawn | Puffin guard | ✅ `pawn-puffin` | ✅ [`pawn-puffin.glb`](assets/models/pawn-puffin.glb) (TRELLIS, 3 views: front+side+back) |

🟡 = first draft: free model, invented back side. Better versions are coming
from the multi-view runs.

## 🚀 Quickstart

```bash
just          # list recipes
just test     # sanity checks (GLB validity, secret scan)
just serve    # static server on http://localhost:8000
```

## 🗂️ Layout

```
assets/characters/   2D "cutie / Nano Banana" art, <piece>-<character>[-N].jpg
assets/models/       canonical GLB pieces used by the game
docs/logo/           logo (C, the badge) + the two alternatives, and the prompt
tools/model-pipeline image→3D experiments: scripts next to their inputs/outputs
scripts/check.py     stdlib-only sanity checks run by `just test`
```

## 🎨 Logos

| Official | Alt A | Alt B |
|---|---|---|
| <img src="docs/logo/logo.png" width="200"> | <img src="docs/logo/alt-daily-checkmate.png" width="200"> | <img src="docs/logo/alt-plunger-sceptre.png" width="200"> |
| *Carlesso al Cesso* | *Daily Checkmate* | *Plunger sceptre* |

Generated with Nano Banana Pro; the prompt is in [`docs/logo/gen_logo.py`](docs/logo/gen_logo.py).

## ⚖️ License & IP

Apache-2.0 (see [LICENSE](LICENSE)). The faces are fictional and stylised. No
third-party brands or characters (see the *IP Safety* section of the spec). 3D
drafts were generated with free public models (TRELLIS, Hunyuan3D-2) through
Hugging Face Spaces; check each model's licence before any commercial use.
