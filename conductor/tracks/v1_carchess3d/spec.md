# Track Specification: `v1_carchess3d` — Playable 3D Chess, Mode 2 WOW Arena & Zurich Swamp Cinema

> **Track ID:** `v1_carchess3d`
> **Architecture:** `niccolo-game-design` (Managers + Queued Event Bus + Headless Core + Object Pools)
> **3D Methodology:** Geneviève's 5 Argon 3D Workflows (AI Studio 3D Developer Guide)

## 1. Locked `/roastme` Decisions (Oct 10, 2026)

1. **Git & Asset Baseline (`v0.1.14+`):** Synced with `main` (`vendor/three/` r170, `showcase/index.html`, `tools/model-pipeline/critic/`, and turnaround datasets for King Riccardo, Queen Kate, Knight Seby, and Rook Pupurabbu).
2. **Hybrid 3D Piece Strategy (Zero-Block Hot-Swap):**
   - `PieceManager` loads `.glb` meshes from `assets/models/` whenever present (`bishop-ale-1.glb`, `bishop-ale-rigged.glb`, `pawn-puffin.glb`) and automatically falls back to a procedural **Ivory/Gold (White)** or **Obsidian/Silver (Black)** luxury chess pedestal topped with a double-sided circular 2D cutie portrait medallion for pieces still rendering in TRELLIS on the companion machine.
   - As soon as new `.glb` files land in `assets/models/`, they hot-swap in via the declarative character registry with zero code changes.
3. **v1 Scope & Spec Alignment (`conductor/product.md` wins):**
   - **Environment:** *The Enchanted Swamp of Zurich ("Swamp-on-the-Limmat")* — stone rune altar, emerald water, *Wizard Chess* flaming braziers, Grossmünster twin towers framing the **16:9 3D Magic Cinema Mirror**, St. Peter clock spire, Fraumünster, and Alps.
   - **Graceful Veo Cinema Fallback:** When a specific `(attacker, defender)` `.mp4` is not yet generated in `assets/battles/videos/`, `VeoCinemaView` gracefully displays the 2D composite keyframe / split versus card with animated shader sparks and comic impact banners.
   - **v1 Cast:** *Carlesso Family* vs *Classic Stone/Marble Wizard Chess Set* (max $6 \times 6 = 36$ combinations). *Swamp Family* deferred to v2.
4. **Niccolò's `DropManager` with Kid-Friendly 🍀 Luck Meter (Pity Timer):**
   - Capturing pieces increases the active player's **Luck Meter (`L`, `L_max = 12`)** by piece weight (`Pawn = 1`, `Knight/Bishop = 3`, `Rook = 5`, `Queen = 9`).
   - Displayed as a glowing **🍀 Fortuna / Luck Bar** in the HUD for Ale & Seby.
   - Soft pity increases the chance of bonus capture flair; reaching hard pity (`L >= 12`) guarantees a **🌟 Critical Golden Capture Spectacle** (e.g., Golden Toilet-Throne Mega Strike, Rainbow Dragon Fire, Giant Fluffy Cuddle Nova + unlocking a collectible badge in the player's profile) and resets `L = 0` (`LUCK_RESET`).

## 2. Acceptance Criteria

- [ ] `docs/floorplan.svg` defines exact meter coordinates (`1 square = 1.0m`, `8x8m` board at `y = 0`, 16:9 Cinema at `z = -10, y = 4.5`, Zurich skyline at `z = -25`).
- [ ] All `.glb` models normalized or runtime-grounded so bounding-box `min.y === 0` (zero floating or sinking pieces).
- [ ] Headless managers (`GameEventBus`, `GameFlowManager`, `BoardMapManager`, `DropManager`, `AIWorkerManager`) pass 100% of Node/Python unit tests with zero DOM/Three.js imports.
- [ ] Mode 1 (Playable 8×8 3D Chess, 2P Hot-Seat + CPU Easy/Med/Hard, yellow/red move indicators, parabolic squash-and-stretch arcs, castling high-five, promotion modal, hint bulb) and Mode 2 (3D WOW Mode: Turntable Inspector + Battle Cinema Arena) both work smoothly.
- [ ] `progress.html` gallery + `?debug=1` live Art Director slider panel implemented.
- [ ] 4-angle headless screenshot critic (`3/4 overview`, `close-up`, `low-angle y=0 check`, `wireframe collision check`) rates the scene **≥ 9/10**.
- [ ] `just test` passes 100%.
