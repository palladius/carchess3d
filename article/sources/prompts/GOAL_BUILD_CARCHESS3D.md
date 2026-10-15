# 🚀 `/goal` Prompt — CarChess3D (*Carlesso al Cesso*) Full Autonomous Build

> **How to use:** Copy-paste the `/goal` block below into your Agentic IDE / Antigravity chat to launch a long-horizon autonomous build of **CarChess3D** combining **Niccolò's Managers + Event Bus Architecture** (`.agents/skills/niccolo-game-design/SKILL.md`), **Geneviève's 5 Argon 3D Workflows**, and the **Conductor SDD Plan** (`conductor/tracks/v1_carchess3d/plan.md`).

---

## 📋 Copy-Paste `/goal` Command

```text
/goal Build the complete v1 of CarChess3D ("Carlesso al Cesso" / "Scacchi di Famiglia") in this git worktree by executing `conductor/tracks/v1_carchess3d/plan.md` end-to-end. Do NOT stop after a couple of rounds — iterate autonomously with parallel subagents, unit tests, and an Adversarial Art Director Critic subagent until every acceptance gate and a >= 9/10 visual rating are achieved.

STRICT GUARDRAILS:
- Work ONLY in the current git worktree. NEVER modify files in any other worktree or touch `.env` / `.riccardo/`.
- Every git commit MUST use `GIT_AUTHOR_EMAIL="132802+palladius@users.noreply.github.com" GIT_COMMITTER_EMAIL="132802+palladius@users.noreply.github.com"` (so GitHub links `palladius`) and include the trailer `Co-authored-by: Gemini 4 Argon (Antigravity) <176961590+gemini-code-assist[bot]@users.noreply.github.com>` at the end of the commit message.
- Zero build step, 100% offline-capable Vanilla Three.js ES Modules (`vendor/three/`) + vendored `vendor/chess.js`.
- Follow `.agents/skills/niccolo-game-design/SKILL.md` strictly:
  1. One Manager = One Responsibility (<= 300 LOC per file). No God Manager!
  2. Rules live with the data they inspect (`BoardMapManager` owns Checkmate, Stalemate, Draw, Castling, En Passant, Promotion).
  3. Communicate exclusively via a queued, deterministic `GameEventBus` (`emit()` enqueues past-tense facts; `flush()` dispatches once per fixed `1/30s` tick) and read-only `GameContext` queries.
  4. Listeners, not callers (`HudListener`, `AudioListener`, `ProfileStorageListener`, `VeoCinemaView` subscribe to events; managers never call DOM or `Sound.play()` directly).
  5. Headless simulation core (`src/core/`, `src/managers/`, `src/ai/` import zero DOM and zero Three.js, verified by Node unit tests).
  6. Data-driven registries (`CHARACTER_REGISTRY`, `BATTLE_MATRIX[attacker][defender]`) and pre-allocated Object Pools (`VFXPoolView`) instead of `if/else` ladders or per-frame allocations.
  7. Seeded PRNG (`mulberry32`) for deterministic tests and replays.
- 100% IP-safe and public-repo clean: no third-party brands (use generic glossy milk-chocolate & lilac confetti, generic die-cast toy cars on orange loop track, fairy-tale Swamp of Zurich), no secrets, no internal links. Run `just test` after every milestone.

PHASE 1 — 2D SPATIAL BLUEPRINT (`docs/floorplan.svg`), CONCEPT MOCKS & GLB GROUNDING:
1. Before writing 3D scene code, generate a precise top-down + side-elevation 2D spatial blueprint `docs/floorplan.svg` with exact meter dimensions:
   - 8x8 carved stone rune altar at `y = 0` (`8.0m x 8.0m`, `1.0m` per square, border `0.8m`).
   - Piece pedestal diameter `0.75m`; canonical piece height hierarchy (`Pawn = 0.9m`, `Rook = 1.2m`, `Knight = 1.35m`, `Bishop = 1.45m`, `Queen = 1.65m`, `King = 1.85m`).
   - 4 corner Wizard Chess flaming braziers at `(±5.2m, y = 1.2m, ±5.2m)`.
   - Foreground Enchanted Swamp emerald moat (`r = 6m..18m`) with lily pads, roots, and fireflies.
   - Background 16:9 3D Magic Cinema Mirror (`8.0m x 4.5m`, golden frame) suspended at `z = -10.0m, y = 4.5m` between the twin towers of the Zurich Grossmünster, with St. Peter clock spire, Fraumünster, Limmat river, and snow-capped Alps at `z = -25.0m`.
2. Vendor `vendor/chess.js` and required Three.js addons (`OrbitControls.js`, post-processing bloom passes).
3. Build a GLB grounding & normalization helper in `PieceView` that computes the bounding box of every loaded `.glb` (`bishop-ale-1.glb`, `bishop-ale-rigged.glb`, `pawn-puffin.glb`, and any newly dropped GLBs in `assets/models/`) and shifts/scales it so `bbox.min.y === 0` on the board surface and its height matches the canonical rank height.

PHASE 2 — NICCOLÒ HEADLESS CORE & TDD UNIT TESTS (`src/core/`, `src/managers/`, `src/ai/`):
Write failing Node unit tests (`node --test tests/*.test.mjs`) first, then implement:
1. `src/core/EventBus.js`, `src/core/Rng.js` (`mulberry32`), and `src/core/GameLoop.js` (fixed `1/30s` step + `lateUpdate` + `render`).
2. `src/managers/GameFlowManager.js`: State machine (`Boot -> Mode1_Chess <-> Mode2_WowArena -> CaptureCutscene -> Checkmate/Draw`).
3. `src/managers/BoardMapManager.js`: Headless 8x8 rules wrapper around `chess.js` (legal moves, check, checkmate, stalemate, threefold repetition, 50-move rule, insufficient material, castling, en passant, promotion, FEN/PGN import/export).
4. `src/managers/DropManager.js`: Kid-friendly "🍀 Barra della Fortuna" (Luck Meter / Pity Timer, `L_max = 12`). Every capture increments `L` by victim weight (`Pawn=1, Knight/Bishop=3, Rook=5, Queen=9`), shifting odds from `normal` -> `shiny` -> `golden_crit`, with hard pity at `L >= 12` guaranteeing a 🌟 Golden Critical Capture Spectacle + Collectible Family Sticker unlock and emitting `LUCK_RESET`. Verify with a 10,000-capture Monte-Carlo test.
5. `src/ai/worker.js` + `src/managers/AIWorkerManager.js`: Non-blocking Web Worker CPU with Easy (capture-maximizing for kids!), Medium (minimax depth 2), and Hard (alpha-beta pruning with iterative deepening depth ~4, MVV-LVA move ordering, piece-square tables, <1.5s budget).

PHASE 3 — PARALLEL SUBAGENTS: 3D WORLD, HYBRID PIECES & dual GAME MODES:
Split the 3D scene and UI implementation across parallel subagents aligned on `docs/floorplan.svg` coordinates and `EventBus` contracts:
- Subagent 1 (`src/views/ZurichSwampView.js` + `src/views/VeoCinemaView.js`):
  Build the Enchanted Swamp of Zurich diorama, dynamic lighting, flickering braziers, emerald water shader, floating fireflies, Zurich fairy-tale landmarks, and the 16:9 3D Magic Cinema Screen (`THREE.VideoTexture` with a graceful 3-tier fallback when an `.mp4` is not yet in `assets/battles/videos/`: Veo `.mp4` -> 2D composite keyframe with shader sparks -> split 2D cutie versus card with comic banner). Also create `assets/battles/manifest.yaml` with MD5 tracking verified by `scripts/check.py`.
- Subagent 2 (`src/managers/PieceManager.js` + `src/views/PieceView.js` + `src/views/BoardInteractionView.js`):
  Build the hybrid 32-piece factory: auto-load `.glb` models from `assets/models/` when available (including `AnimationMixer` support for `bishop-ale-rigged.glb` `Idle` wing-glide and `Click_Fire_Breath` clips, plus `bishop-ale-1.glb` and `pawn-puffin.glb`), and automatically fall back to a sculpted 3D chess pedestal topped with a double-sided circular 2D cutie portrait medallion (`assets/characters/`) for pieces whose `.glb` is not yet present. Support White (Ivory & Gold) vs Black (Obsidian & Silver) trims, plus the procedural Classic Stone/Marble Wizard Chess rival set. Implement raycast hover/tap selection, pulsing yellow empty-target circles, rotating red capture rings, King check aura, parabolic jump arcs with squash-and-stretch landing, and Riccardo <-> Pupurabbu belly-bounce castling.
- Subagent 3 (`src/managers/CombatAnimationManager.js` + `src/views/VFXPoolView.js`):
  Implement the 6x6 capture choreography + object-pooled physics debris:
  * King Riccardo: golden rune circle + sceptre lightning + levitate & sparkle dissolve (Golden Toilet-Throne summon on crit/Kate clash!).
  * Queen Kate: glossy milk-chocolate wave + lilac confetti melt.
  * Bishop Ale: purple crystal display case -> amethyst/ruby gem -> shatters into hundreds of physics shards.
  * Knight Seby: orange loop-track ring + zooming colourful die-cast toy cars bowling the victim flat ("STECCHITO! ✨").
  * Rook Pupurabbu: giant leap + ground-pound shockwave ring flattening victim like a pancake in a purple poof cloud.
  * Pawn Puffin: halberd charge + cartoon fish-slap 🐟 spinning victim off the board.
  * Bespoke Easter Egg: Knight Seby <-> Rook Pupurabbu NEVER hurt each other — trigger a joyful Mega Cuddle Bounce ("SUPER ABBRACCIO PUFFOSO! 💜") with floating hearts!
  * Orbiting capture camera that frames both clashing pieces on the board and the 16:9 Cinema Screen behind them; skippable anytime via click/tap/`Space`/`Escape`.
- Subagent 4 (`src/views/WowModeView.js` + `src/listeners/{HudListener,AudioListener,ProfileStorageListener}.js` + PWA):
  * Mode 2 (3D WOW Mode): (a) 360° Turntable Character Inspector for all 6 family characters with auto-rotate toggle, drag-to-orbit, and animation triggers (`Idle`, `Click_Fire_Breath`, Attack Signature, Victory Emote), plus (b) Action Arena / Battle Cinema picker allowing Ale & Seby to trigger any `Attacker x Defender` clash on demand.
  * Kid-friendly HUD: instant `IT 🇮🇹 | EN 🇬🇧` language toggle, `"Chi gioca?"` passwordless profile selector (`Riccardo, Kate, Ale, Seby, Ospite`) with `localStorage` autosave & FEN/PGN import/export, 🍀 Luck Meter bar, 💡 Magic Hint Bulb, and cutie portrait Pawn Promotion picker.
  * Audio: Procedural WebAudio synthesizer SFX + bilingual Lyria 3 theme song player (with procedural orchestral/chiptune fallback).
  * Offline PWA: `manifest.webmanifest` + `sw.js`.

PHASE 4 — ART DIRECTOR'S SEAT (`progress.html` + `?debug=1` SLIDERS):
1. Build a live `?debug=1` on-screen Art Director Control Panel with sliders for sun/brazier intensity & warmth, bloom strength/threshold, swamp water roughness, camera FOV/distance/angle, and piece scale.
2. Build `progress.html` to record milestone screenshots across rounds with clear version titles and notes.

PHASE 5 — ADVERSARIAL ART DIRECTOR CRITIC LOOP (ITERATE UNTIL >= 9/10):
Build this 3D scene over iterative rounds by invoking a strict Adversarial Art Director Critic subagent after each round.
At the end of every round, render 4 diagnostic screenshots of the live scene:
1. A 3/4 overview showing the overall composition (board, 32 pieces, Enchanted Swamp, Zurich skyline, and 16:9 Cinema Mirror).
2. A close-up showing surface details, pedestals, GLB textures, and portrait medallions.
3. A low-angle view checking that all 32 pieces, braziers, and props sit cleanly on the ground (`y = 0`) without floating or clipping.
4. A wireframe view proving clean 3D geometry and checking for bounding-box collisions.
Have the Adversarial Critic subagent inspect all 4 screenshots, list at least 3 specific visual flaws to fix (boxy shapes, floating parts, clipped shadows, unreadable contrast, or flat materials), and rate the scene out of 10. Fix every flaw, update `progress.html`, and keep iterating until:
- The Adversarial Critic rates the scene >= 9/10,
- All Node unit tests (`node --test`) pass with >80% core coverage, and
- `just test` passes 100%.
```
