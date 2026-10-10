# Implementation Plan: `v1_carchess3d` — CarChess3D (*Carlesso al Cesso*)

> **Forged with Argon** ✨ — Combining **Niccolò's Managers + Event Bus Architecture** (`.agents/skills/niccolo-game-design/`) with **Geneviève's 5 Argon 3D Workflows**.

---

## Phase 1: Spatial Blueprint (`floorplan.svg`), Concept Mocks & GLB Grounding (Geneviève §1 & §5)

- [x] **Task 1.1:** Generate 2D spatial blueprint `docs/floorplan.svg` (top-down + side elevation in meters: `8m × 8m` rune altar at `y=0`, square size `1.0m`, pedestal Ø `0.75m`, piece height hierarchy `0.9m..1.8m`, 4 corner braziers, emerald swamp moat `r=6..18m`, 16:9 Veo Magic Cinema Mirror `8m × 4.5m` at `z=-10m, y=4.5m` between Grossmünster towers, Zurich skyline backdrop at `z=-25m`).
- [x] **Task 1.2:** Generate Nano Banana 2D concept renders (`docs/concepts/zurich_swamp_overview.png` & `docs/concepts/board_closeup.png`) to lock in the *Wizard Chess* lighting + cutie character aesthetic.
- [x] **Task 1.3:** Vendor `vendor/chess.js` + Three.js addons (`OrbitControls.js`, post-processing bloom passes) and add GLB grounding/normalization utility (`y=0` floor alignment, uniform piece height scaling) with unit check in `scripts/check.py`.

## Phase 2: Headless Core & Niccolò Managers (`src/core/`, `src/managers/`, `src/ai/`)

- [x] **Task 2.1:** Implement `src/core/EventBus.js` (deferred queue `emit()` + once-per-tick `flush()`), `src/core/Rng.js` (`mulberry32` seeded PRNG), and `src/core/GameLoop.js` (fixed `1/30s` simulation step + `lateUpdate` + `render`), with unit tests (`tests/core.test.mjs`).
- [x] **Task 2.2:** Implement `src/managers/GameFlowManager.js` (`Boot → Mode1_Chess ⇄ Mode2_WowArena → CaptureCutscene → Checkmate/Draw`) and `src/managers/BoardMapManager.js` (wrapping `chess.js`: legal moves, check, checkmate, stalemate, draw, FEN/PGN, castling, en passant, promotion; owns Game Over / Victory rules), with unit tests (`tests/board-map.test.mjs`).
- [x] **Task 2.3:** Implement Niccolò's `src/managers/DropManager.js` (kid-friendly **🍀 Luck Meter / Pity Timer**: `L += pieceWeight` on capture, `L_max = 12`, soft/hard pity rolling `normal | shiny | golden_crit` capture spectacle tiers + collectible stickers, resetting on `golden_crit`), with 10,000-capture Monte-Carlo unit test (`tests/drop-manager.test.mjs`).
- [x] **Task 2.4:** Implement `src/ai/worker.js` and `src/managers/AIWorkerManager.js` (*Easy* capture-chaser, *Medium* minimax d=2, *Hard* alpha-beta iterative deepening d=4 with MVV-LVA and piece-square tables), with unit tests (`tests/ai.test.mjs`).

## Phase 3: Parallel Subagents — 3D World ("Swamp-on-the-Limmat") & Hybrid `PieceManager` (Geneviève §2)

- [x] **Task 3.1 (Subagent World):** Build `src/views/ZurichSwampView.js` — 8×8 carved stone altar with golden rune border, animated emerald swamp water + lily pads + fireflies, 4 flickering *Wizard Chess* braziers, Zurich fairy-tale skyline (Grossmünster twin towers, St. Peter clock face, Fraumünster spire, Limmat, Alps), and the golden-framed **16:9 3D Magic Cinema Screen** (`THREE.VideoTexture` + shader/keyframe fallback).
- [x] **Task 3.2 (Subagent Pieces):** Build `src/managers/PieceManager.js` & `src/views/PieceView.js` — declarative `CHARACTER_REGISTRY` loading `.glb` models (`bishop-ale-1.glb`, `bishop-ale-rigged.glb` with 26-bone `AnimationMixer`, `pawn-puffin.glb`), automatic luxury 3D pedestal + double-sided 2D cutie medallion fallback for pending TRELLIS pieces (`Riccardo`, `Kate`, `Seby`, `Pupurabbu`), White (Ivory/Gold) vs Black (Obsidian/Silver) material trims, and procedural *Classic Stone/Marble Wizard Chess* rival set.
- [x] **Task 3.3 (Subagent Board UX):** Build `src/views/BoardInteractionView.js` — raycast hover/tap selection, pulsing yellow circles on legal empty squares, rotating red rings on legal captures, red check aura on King, parabolic jump arcs with squash-and-stretch landing, and Riccardo↔Pupurabbu belly-bounce castling.

## Phase 4: Parallel Subagents — Dual-Layer 6×6 Captures, Mode 2 WOW Arena, HUD & Audio (Geneviève §2)

- [x] **Task 4.1 (Subagent Captures & VFX):** Build `src/managers/CombatAnimationManager.js` & `src/views/VFXPoolView.js` — object-pooled debris (amethyst/ruby crystal shards, die-cast toy cars on orange loop track, milk-chocolate wave & lilac confetti, purple poof cloud, halberd fish-slap 🐟, stone shrapnel), orbiting capture camera keeping the 16:9 Cinema in frame, **Seby ↔ Pupurabbu ("SUPER ABBRACCIO PUFFOSO! 💜")** cuddle override, **🍀 Golden Crit** overdrive, skippable via tap/`Space`/`Escape`, plus `assets/battles/manifest.yaml` MD5 tracking.
- [x] **Task 4.2 (Subagent Mode 2 WOW Arena):** Build `src/views/WowModeView.js` — **Turntable Character Inspector** (360° auto-rotate + manual drag, animation triggers for `Idle`, `Click_Fire_Breath`, attack signatures, switchable Ale #1 Hat vs Ale #2 Rigged Dragon) + **Action Arena / Battle Cinema Stage** (pick any `Attacker × Defender` pair and watch the 3D clash + 16:9 Veo Cinema on demand).
- [x] **Task 4.3 (Subagent HUD, Profiles & Audio):** Build `src/listeners/HudListener.js`, `src/listeners/ProfileStorageListener.js`, and `src/listeners/AudioListener.js` — bilingual `IT 🇮🇹 | EN 🇬🇧` toggle, `"Chi gioca?"` passwordless profiles (`Riccardo, Kate, Ale, Seby, Ospite`) with `localStorage` autosave + FEN/PGN modal, **🍀 Fortuna/Luck Bar**, **💡 Magic Hint Bulb**, promotion portrait modal, procedural WebAudio SFX, and Lyria 3 theme song player.

## Phase 5: Art Director's Seat (`progress.html` + Sliders), Adversarial 9/10 Critic & PWA (Geneviève §3 & §4)

- [x] **Task 5.1:** Build `?debug=1` on-screen **Art Director Control Panel** (live sliders for brazier warmth, sun elevation, bloom strength/threshold, water roughness, camera FOV/distance, piece scale) + `progress.html` milestone gallery.
- [ ] **Task 5.2:** Run iterative **Adversarial Art Director Critic Subagent** rounds over the 4 canonical screenshots (`1: 3/4 overview`, `2: close-up details`, `3: low-angle y=0 grounding check`, `4: wireframe collision check`), fixing visual flaws until scored **≥ 9/10**.
- [ ] **Task 5.3:** Add offline PWA support (`manifest.webmanifest`, `sw.js`), run full test suite (`just test` + Node unit tests), bump `VERSION`, and update `CHANGELOG.md`.
