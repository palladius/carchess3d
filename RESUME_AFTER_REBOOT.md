# 🧊 RESUME_AFTER_REBOOT.md — Issue #20: 3D Models Reconstructed & Refined ✅

Tutti i modelli 3D per le famiglie **Classic** e **Swamp** sono stati generati, armonizzati e validati a norma `assets/families/_contract.json`.

---

## 📌 Issue #20 — Riepilogo Lavori Completati
- **Worktree:** `worktrees/carchess3d/generate_swamp_classic_models`
- **Branch:** `generate_swamp_classic_models`
- **Versione:** `v0.3.59`
- **Pull Request:** [PR #34](https://github.com/palladius/carchess3d/pull/34) (sincronizzata con `origin/generate_swamp_classic_models`)
- **Stato:** ✅ 100% COMPLETATO e validato da `just test` (50 GLB, 24 modelli nel provenance registry con hash MD5).

---

## 🏛️ Famiglia Classic (`assets/models/classic/`):
- [x] **King** (`king-classic-re.glb`): 1.80m, 99.2k tris, 4.0MB — `microsoft/TRELLIS.2` (marmo/oro con corona in velluto)
- [x] **Queen** (`queen-classic-regina.glb`): 1.65m, 99.5k tris, 3.5MB — `microsoft/TRELLIS.2`
- [x] **Bishop** (`bishop-classic-vescovo.glb`): 1.45m, 97.1k tris, 4.4MB — `microsoft/TRELLIS.2`
- [x] **Knight** (`knight-classic-cavallo.glb`): 1.35m, 22.1k tris, 2.8MB — Mode A Dual-Orthographic SDF
- [x] **Rook** (`rook-classic-torre.glb`): 1.30m, 20.2k tris, 2.7MB — Mode A 2D-to-3D SDF
- [x] **Pawn** (`pawn-classic-pedone.glb`): 0.95m, 13.3k tris, 1.8MB — Mode A 2D-to-3D SDF

---

## 🐸 Famiglia Swamp (`assets/models/swamp/`):
- [x] **King** (`king-swamp-orco.glb`): 1.80m, 24.1k tris, 644KB — Procedurale Chibi 3D (tunica, corona e proporzioni scacchistiche)
- [x] **Queen** (`queen-swamp-orchessa.glb`): 1.65m, 15.8k tris, 3.3MB — Mode A UV-Textured (Principessa Orchessa 3D fedele al concept)
- [x] **Bishop** (`bishop-swamp-focaccina.glb`): 1.45m, 21.6k tris, 578KB — Procedurale Chibi 3D (Don Gatto con mitria, stocco e stivali)
- [x] **Knight** (`knight-swamp-asinello.glb`): 1.35m, 18.2k tris, 489KB — Procedurale Chibi 3D (Asinello quadrupedale con sorriso a 40 denti)
- [x] **Rook** (`rook-swamp-draghessa.glb`): 1.30m, 20.8k tris, 554KB — Procedurale Chibi 3D (Torre merlata in pietra con draghetto rubino avvolto a 360°)
- [x] **Pawn** (`pawn-swamp-tappo.glb`): 0.95m, 17.0k tris, 455KB — Procedurale Chibi 3D (Zenzy / Tappo omino pan di zenzero con bastoncino)

---

## 📸 Showcase & Materiale per Articoli (`article/`):
- [x] Parked in `article/assets/before_after/` (15 immagini: banner 16:9, lineup affiancate, schede 3-panel).
- [x] Documento descrittivo: `article/SHOWCASE_BEFORE_AFTER.md`.
- [x] Regola ufficiale inserita in `AGENTS.md` / `GEMINI.md` e pushata su `origin/main` (`d6f9d27`).

---

## 🧪 Validazione
Tutti i contratti (`assets/families/_contract.json`), altezze, grounding `min.y == 0.0`, footprint `0.70m <= span <= 0.86m`, slot materiali e IP safety passano al 100%:
```bash
just test
```
