# 🧊 RESUME_AFTER_REBOOT.md — Issue #20: 3D Models Reconstructed ✅

Tutti i modelli 3D in alta risoluzione UV-textured per le famiglie **Classic** e **Swamp** sono stati generati, verificati e registrati nel provenance registry.

---

## 📌 Issue #20 — Riepilogo Lavori Completati
- **Worktree:** `worktrees/carchess3d/generate_swamp_classic_models`
- **Branch:** `generate_swamp_classic_models`
- **Versione:** `v0.3.57`
- **Stato:** ✅ 100% COMPLETATO e validato da `just test` (24 modelli verificati con hash MD5). Pronta per commit o review.

---

## 🏛️ Famiglia Classic (`assets/models/classic/`):
- [x] **King** (`king-classic-re.glb`): 1.80m, 99.2k tris, 4.0MB — `microsoft/TRELLIS.2`
- [x] **Queen** (`queen-classic-regina.glb`): 1.65m, 99.5k tris, 3.5MB — `microsoft/TRELLIS.2`
- [x] **Bishop** (`bishop-classic-vescovo.glb`): 1.45m, 97.1k tris, 4.4MB — `microsoft/TRELLIS.2`
- [x] **Knight** (`knight-classic-cavallo.glb`): 1.35m, 22.1k tris, 2.8MB — Mode A Dual-Orthographic SDF
- [x] **Rook** (`rook-classic-torre.glb`): 1.30m, 20.2k tris, 2.7MB — Mode A 2D-to-3D SDF
- [x] **Pawn** (`pawn-classic-pedone.glb`): 0.95m, 13.3k tris, 1.8MB — Mode A 2D-to-3D SDF

---

## 🐸 Famiglia Swamp (`assets/models/swamp/`):
- [x] **King** (`king-swamp-orco.glb`): 1.80m, 21.6k tris, 3.0MB — Mode A 2D-to-3D SDF
- [x] **Queen** (`queen-swamp-orchessa.glb`): 1.65m, 15.8k tris, 2.2MB — Mode A 2D-to-3D SDF
- [x] **Bishop** (`bishop-swamp-focaccina.glb`): 1.45m, 12.4k tris, 1.8MB — Mode A 2D-to-3D SDF
- [x] **Knight** (`knight-swamp-asinello.glb`): 1.35m, 16.5k tris, 2.2MB — Mode A 2D-to-3D SDF + 40-Tooth Relief
- [x] **Rook** (`rook-swamp-draghessa.glb`): 1.30m, 16.7k tris, 2.4MB — Mode A 2D-to-3D SDF
- [x] **Pawn** (`pawn-swamp-tappo.glb`): 0.95m, 9.9k tris, 1.6MB — Mode A 2D-to-3D SDF

---

## 🧪 Validazione
Tutti i contratti (`assets/families/_contract.json`), altezze, grounding `min.y == 0.0`, footprint `0.70m <= span <= 0.86m`, slot materiali `faction_primary` (UV texture) e `faction_trim`, e IP safety sono stati verificati:
```bash
just test
```
