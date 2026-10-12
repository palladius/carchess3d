# 🏰🚽 CarChess3D: *Carlesso al Cesso* ♟️

> ### 🌐🚀 **[GIOCA SUBITO LIVE SU GITHUB PAGES → `https://palladius.github.io/carchess3d/`](https://palladius.github.io/carchess3d/)**
> - 🎮 **Partita 3D & Scazzottata**: [https://palladius.github.io/carchess3d/](https://palladius.github.io/carchess3d/)
> - 🎬 **Matrice Interattiva 6×6 (Tutti i 36 Scontri & Video 16:9)**: [https://palladius.github.io/carchess3d/battles.html](https://palladius.github.io/carchess3d/battles.html)
> - 🌟 **WOW Mode & Arena 6×6**: [https://palladius.github.io/carchess3d/?mode=wow](https://palladius.github.io/carchess3d/?mode=wow)
> - 🥊 **Demo Scazzottata 3D + Video 16:9 (Ale vs Seby)**: [https://palladius.github.io/carchess3d/?clash=b_n](https://palladius.github.io/carchess3d/?clash=b_n)
> - 🐸 **Demo Palude Incantata (Pezzi Catturati)**: [https://palladius.github.io/carchess3d/?swamp_party=1](https://palladius.github.io/carchess3d/?swamp_party=1)
> - 🏛️ **Showcase 3 Famiglie (18 Pezzi 3D `.glb`)**: [https://palladius.github.io/carchess3d/showcase/](https://palladius.github.io/carchess3d/showcase/)
> - 📸 **Visual Progress & Critic Gallery**: [https://palladius.github.io/carchess3d/progress.html](https://palladius.github.io/carchess3d/progress.html)
> - ✍️ **Articolo ("Come ho generato CarChess3D in 2 giorni")**: [`docs/ARTICLE.md`](docs/ARTICLE.md)

<p align="center">
  <img src="docs/logo/logo.png" alt="Carlesso al Cesso: a cartoon chess king on a golden toilet-throne" width="320">
</p>

A **3D chess game for the Carlesso family**, playable offline. The pieces are the
family and their pets: Riccardo is the king, Kate the queen, Ale the bishop
(with his red baby dragon), Seby the knight, Pupurabbu the rook and the Puffins
are the pawns. Every capture plays a cartoon animation. Plain Three.js PWA: runs
on localhost, in the browser and on Android, even in airplane mode. ✈️

- 📐 **Spec** (source of truth, lives in this repo):
  [`docs/spec/SPEC.md`](docs/spec/SPEC.md) — originally drafted in
  [`palladius/respec`](https://github.com/palladius/respec), now self-contained here.
- 🧱 **Image → 3D pipeline** (shared with the *Plastilina* spec):
  [`tools/model-pipeline/`](tools/model-pipeline/) with its
  [lab notebook](tools/model-pipeline/RUNNING_DOC.md)

## 🚦 Status

`v0.3.48` (2026-10-12). **The game is playable**: complete chess rules
(chess.js), hot-seat or vs CPU (Easy/Medium/Hard in a Web Worker), FEN/PGN,
local profiles with autosave, offline PWA, live on GitHub Pages.

- **3 families × 6 pieces = 18 3D characters**: Carlesso, Classic and the
  Swamp family. Each family can play White or Black, with an ivory/gold vs
  obsidian/silver overlay.
- **36 (6×6) Carlesso battles**: an in-place 3D brawl plus an 8 s 16:9 Veo
  video for every attacker × defender pair
  ([`battles.html`](https://palladius.github.io/carchess3d/battles.html)).
- **Character showcase** ([`showcase/`](https://palladius.github.io/carchess3d/showcase/)):
  3D turntable, voice lines (Gemini TTS), attack/defence films.
- Visible articulated skeletons, the swamp moat for captured pieces, WOW mode,
  string-quartet soundtrack (Lyria 3), Mac trackpad gestures, Mobile Lite 3D.
- Daily headless UAT playtest (`scripts/daily_uat_playtest.py`, issue #18).

| Piece | Carlesso | Classic | Swamp |
|---|---|---|---|
| ♔ King | 🟢 Riccardo | 🟢 TRELLIS.2 | 🟡 procedural |
| ♕ Queen | 🟢 Kate (+ wedding/young variants) | 🟡 procedural | 🟡 procedural |
| ♗ Bishop | 🟢 Ale (rigged, with dragon) | 🟡 procedural | 🟡 procedural |
| ♘ Knight | 🟢 Seby | 🟢 | 🟢 |
| ♖ Rook | 🟢 Pupurabbu | 🟡 procedural | 🟡 procedural |
| ♙ Pawn | 🟢 Puffin | 🟡 procedural | 🟡 procedural |

🟢 = image→3D reconstruction · 🟡 = procedural fallback, waiting for the GPU
(issue #20). Provenance: [`docs/models-provenance.yaml`](docs/models-provenance.yaml).

## 🚀 Quickstart

```bash
just          # list recipes
just test     # sanity checks (GLB validity, secret scan)
just serve    # static server on http://localhost:8000
```

## 🗂️ Layout

```
index.html, sw.js    game entry point + offline service worker (PWA)
src/                 core/ (EventBus, GameLoop, Registry), managers/, views/, listeners/, ai/worker.js
battles.html         6×6 battle matrix · showcase/ character POV page · progress.html visual log
assets/characters/   2D "cutie / Nano Banana" art, <piece>-<character>[-N].jpg
assets/models/       GLB pieces: Carlesso at the root, classic/ and swamp/ subfolders
assets/battles/      36 keyframes + Veo videos + prompts + video audit
assets/audio/        Lyria soundtrack + Gemini TTS voice lines
vendor/              Three.js + chess.js (vendored, offline)
tools/model-pipeline image→3D experiments: scripts next to their inputs/outputs
docs/spec/SPEC.md    the spec (source of truth) · docs/logo/ logos + prompt
tests/, scripts/     Node + Python test suites, UAT playtest, generators (`just test`)
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
