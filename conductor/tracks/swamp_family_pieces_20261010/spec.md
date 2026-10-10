# Track Specification: `swamp_family_pieces_20261010` — Swamp Parody Chess Family ("Famiglia della Palude")

> **Track ID:** `swamp_family_pieces_20261010`
> **Type:** Feature (Parallel-Safe Asset & Declarative Family Manifest Track)
> **Architecture:** `niccolo-game-design` (Headless Managers + `PieceView` Material Tinting + Declarative `assets/families/swamp.json`)
> **Reviewed by:** `fable-5.1-high` (Swarm Architecture, IP-Safety & Parallel-Safety Review incorporated)

## 1. Overview

Creates the **Swamp Parody Chess Family (`swamp`)** as an independent, parallel-safe track inspired by classic European fairy-tale swamp tropes. Uses a deterministic **Decision-Tree 3D Pipeline** (Nano Banana Multi-View Turnarounds → Chibi 3D Sculpt / Optional TRELLIS when `SWAMP_TRELLIS=1` so the companion Carlesso machine keeps ZeroGPU priority) and registers the family via an isolated `assets/families/swamp.json` manifest.

## 2. Proposed 6-Row Upstream Spec Sync (`~/git/respec/carlesso-family/chess3d/SPEC.md`)

Per `AGENTS.md`, we do not mutate `~/git/respec` directly from here; we propose this clean 6-row table update for `carlesso-family/chess3d/SPEC.md` (`### 🐸 Swamp Family`):

```diff
-| ♔ King | **Re Tappo** | Tiny pompous king, oversized crown and cape |
-| ♕ Queen | **Principessa Orchessa** | Friendly green ogress princess, braid, martial-arts pose |
-| ♘ Knight | **Principe Azzurro** | Vain prince on a white horse |
-| ♗ Bishop | **Fata Madrina** | Plump fairy godmother with a wand |
-| ♖ Rook | **Orco Brontolo** | Big green ogre, onion in hand, mud-caked boots |
-| ♙ Pawn | **Asinelli Chiacchieroni** | Small, chatty grey donkeys with oversized teeth |
+| ♔ King | **Orco Brontolo** | Grumpy lovable green swamp ogre with wooden-root crown & golden onion sceptre |
+| ♕ Queen | **Principessa Orchessa** | Friendly green ogress princess, braid, martial-arts Kung-Fu pose |
+| ♘ Knight | **Asinello Chiacchierone** | Chatty grey pack-mule/burro with oversized grin and wooden knight plume |
+| ♗ Bishop | **Mago Focaccina** | Golden baked focaccia/spiced-bread mage with rosemary/icing mitre & breadstick staff |
+| ♖ Rook | **Draghessa della Palude** | Friendly swamp dragon coiled around a mossy stone watchtower |
+| ♙ Pawn | **Guardie Re Tappo** | Tiny pompous guards with oversized renaissance hats standing on wooden stools |
```

## 3. Functional Requirements

1. **6-Piece Swamp Parody Roster (100% IP-Safe Slugs, Names & Original Designs, Basename Parity):**
   - ♔ **King — `Orco Brontolo` (`king-swamp-orco.jpg`, `assets/models/swamp/king-swamp-orco.glb`, `1.80m`)**: Big friendly green swamp ogre with wooden-root crown, brown tunic, holding a golden onion sceptre (`attack_sig: "swamp_onion_burp"`).
   - ♕ **Queen — `Principessa Orchessa` (`queen-swamp-orchessa.jpg`, `assets/models/swamp/queen-swamp-orchessa.glb`, `1.65m`)**: Fierce green ogress princess in an emerald gown, long braid, golden tiara, in a martial-arts kick stance (`attack_sig: "kungfu_slowmo_kick"`).
   - ♘ **Knight — `Asinello Chiacchierone` (`knight-swamp-asinello.jpg`, `assets/models/swamp/knight-swamp-asinello.glb`, `1.35m`)**: Energetic grey pack-burro (`asinello`, avoiding trademarked dub names) with oversized grin and wooden tournament saddle (`attack_sig: "asinello_back_kick"`).
   - ♗ **Bishop — `Mago Focaccina` (`bishop-swamp-focaccina.jpg`, `assets/models/swamp/bishop-swamp-focaccina.glb`, `1.45m`)**: Cute golden-baked Italian focaccia / spiced-bread mage with rosemary-and-olive (or sugar-icing) mitre and twisted grissino/candy bishop staff (`attack_sig: "focaccina_crumb_bonk"`).
   - ♖ **Rook — `Draghessa della Palude` (`rook-swamp-draghessa.jpg`, `assets/models/swamp/rook-swamp-draghessa.glb`, `1.30m`)**: Charming emerald-and-ruby swamp dragon coiled around a mossy stone turret (`attack_sig: "dragon_heart_smoke"`).
   - ♙ **Pawn ×8 — `Guardia Re Tappo` (`pawn-swamp-tappo.jpg`, `assets/models/swamp/pawn-swamp-tappo.glb`, `0.95m`)**: Tiny pompous ruler/guard with an oversized velvet cap standing on a wooden stepping-stool pedestal (`attack_sig: "decree_scroll_flatten"`).
2. **2D Multi-View Turnarounds (`tools/model-pipeline/swamp/` + flat `assets/characters/<piece>-swamp-<slug>.jpg`):**
   - Generate front, side, back, and 3/4 turnaround sheets via a local copy of the Nano Banana helper (`tools/model-pipeline/swamp/gen_swamp_views.py`).
   - Save canonical portraits flat in `assets/characters/<piece>-swamp-<slug>.jpg`.
3. **Resource-Arbitrated 3D Mesh Generation (`assets/models/swamp/<piece>-swamp-<slug>.glb`):**
   - **ZeroGPU Arbitration Rule (`fable-5.1-high` G3):** Because the companion machine has priority on the shared `HF_TOKEN` ZeroGPU quota for Carlesso pieces, `build_swamp_models.py` defaults to deterministic headless Python `trimesh`/Blender chibi-sculpting + UV texture projection, and only invokes remote TRELLIS if explicitly enabled via `SWAMP_TRELLIS=1` (falling back automatically if `critic_geo` score `< 6` or non-watertight).
   - Mounts every piece onto a standardized swamp-stone pedestal (`Ø 0.75m`, `min.y = 0.0`) with named material slots (`faction_primary`, `faction_trim`) for `PieceView` White/Black tinting.
   - Default `victim_reaction: "swamp_mud_poof"`. Veo 16:9 cinema videos remain Carlesso-only in v1; `swamp` uses 3D on-board choreography + 2D versus keyframe card fallback.
4. **Zero-Collision Declarative Registration (`assets/families/swamp.json`):**
   - Ships `assets/families/swamp.json` with bilingual labels (`label: { "it": "Famiglia della Palude 🐸🧅", "en": "Swamp Family 🐸🧅" }`), piece metadata, heights, and attack/victim IDs.

## 4. Non-Functional & Parallel Isolation Guardrails (`fable-5.1-high` G1–G4)

- **Strict IP Safety:** Zero third-party film trademarks in code, filenames, prompts, or UI labels.
- **Strict File Ownership (`metadata.json` `owns`):**
  - Only touches `tools/model-pipeline/swamp/**`, `assets/models/swamp/**`, `assets/characters/*-swamp-*.jpg`, `assets/families/swamp.json`, `docs/qa-scores.swamp.yaml`, `CHANGELOG.d/swamp_family_pieces_20261010.md`, and `tests/test_swamp_family.py`.
  - Writes `.glb.part` before atomic rename to `.glb`.

## 5. Acceptance Criteria

- [ ] All 6 flat `assets/characters/<piece>-swamp-<slug>.jpg` cutie portraits generated and passing `scripts/check.py` + IP-safety scan.
- [ ] All 6 `assets/models/swamp/<piece>-swamp-<slug>.glb` 3D models generated, grounded (`min.y = 0`), watertight, `<= 25k` faces, with named `faction_primary`/`faction_trim` materials.
- [ ] `assets/families/swamp.json`, `tools/model-pipeline/swamp/RUNNING_DOC.md`, and `CHANGELOG.d/swamp_family_pieces_20261010.md` created and passing `tests/test_swamp_family.py`.
- [ ] 6×4 turntable contact sheet (`tools/model-pipeline/swamp/swamp_contact_sheet.png`) rendered; `just test` passes 100%.

## 6. Out of Scope

- Modifying Carlesso `.glb` files, `classic` track files, or shared `VERSION` / `CHANGELOG.md`.
