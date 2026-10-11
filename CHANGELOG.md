# Changelog

## [0.3.8] - 2026-10-11

- 🎬🕵️‍♂️🤖 **Automated Daily UAT Playtest Suite & Adversarial Critic (`scripts/daily_uat_playtest.py`, `etc/prompts/daily_uat_prompt.md`, `just uat`, `just daily-uat`)**:
  - **Autonomous Adversarial Playtest & Screen Audit**:
    - Simulates an intelligent human tester playing as White against **CPU Easy** (Black) in headless Google Chrome via Playwright with WebGL hardware/software acceleration.
    - **Faction Orientation Verification**: Audits all 32 pieces on the 8×8 board to ensure White pieces strictly face North (`homeYaw ≈ 3.142 rad` towards rank 8) and Black pieces face South (`homeYaw ≈ 0.0 rad` towards rank 1), flagging any "all facing same direction" glitch.
    - **Black-Screen Audit**: Performs automatic luminance and contrast stddev pixel analysis on Camera 180° Inversion (`#hud-flip-btn`) and Top-Down view (`#hud-top-btn`) to guarantee the 3D scene remains vibrantly illuminated and never goes pitch-black.
    - **Interactive Subsystem Clicking**: Adversarially exercises 3D Articulated Skeletons (`#hud-skeletons-btn`), Shrek Swamp Moat party (`#hud-swamp-btn`), 6×6 Battle Matrix Modal (`#hud-matrix36-btn`), and WOW Mode Turntable & Arena (`#hud-mode2-btn`).
    - **Live Match Simulation**: Executes human opening moves (`e2-e4`, `g1-f3`, `d2-d4`), monitors Web Worker CPU Easy response latency (averaging ~460ms), triggers tactical captures, verifies the Comic Impact Banner (`#hud-comic-banner`), and exercises the cutscene skip button (`#hud-skip-btn`).
  - **Video Recording & Media Deliverables**:
    - Automatically records a full match session into `log/uat/uat_gameplay.mp4` and `uat_gameplay.webm` (strictly capped at `<= 60s` / 1 min duration) and renders an animated preview GIF `log/uat/uat_gameplay.gif`.
    - Captures 13 timestamped keyframe screenshots into `log/uat/*.png` and generates `log/uat/UAT_REPORT.md` and `uat_report.json`.
  - **GitHub Issue Integration (`gemini-uat`)**:
    - With `--publish-ghi` (or `just daily-uat`), creates or comments on a daily GitHub Issue titled `"Gemini UAT $YYYYMMDD"` (e.g. [`#18`](https://github.com/palladius/carchess3d/issues/18)) tagged with label `gemini-uat`, embedding the full UAT verification matrix, playability critique, and video assets.
  - **Customizable Prompt**:
    - Added [`etc/prompts/daily_uat_prompt.md`](etc/prompts/daily_uat_prompt.md) as the central prompt template for scheduled runs, allowing Riccardo to easily edit testing sequences, thresholds, or difficulty levels.

## [0.3.7] - 2026-10-11

- 🏰🎮 **Startup Match Setup Modal, Auto-Hiding Top Bar, Footer Overlay & Quake-Style Console (`HudListener.js`, `AIWorkerManager.js`, `BoardInteractionView.js`, `main.js`, `Registry.js`, `tests/cpu-opponent.test.mjs`)**:
  - **Inizio Partita Setup Modal (`#hud-setup-modal`)**:
    - Interactive 2-column modal at game boot asking who plays White and who plays Black (Human vs Computer AI), with character profiles and CPU difficulty settings (`easy`, `medium`, `hard`).
    - Explicit default: ⚪ **Famiglia Carlesso** (Human, profile Ale/Riccardo) vs ⚫ **Scacchi Classici** with **AI Facile** (`easy`).
    - Can be reopened at any time via `⚙️ Nuova Partita` or `⚙️ Setup Fazioni` in the bottom action dock.
  - **Auto-Hiding Top Bar for Maximum 3D Viewport (`#hud-topbar.hidden`)**:
    - Once the match starts, the top navigation/status bar smoothly slides up and disappears (`translateY(-130%)`, `opacity: 0`), granting full screen immersion to the 3D board, the swamp, and the 16:9 cinema mirror.
    - Togglable back anytime via the `☰ Mostra Barra` button in the bottom dock or pressing hotkey `M`.
  - **Overlay Footer with Branding & Open Source Links (`.hud-bottombar`, `.hud-footer-brand`)**:
    - Bottom bar rendered in overlay/sovrimpressione featuring game branding (`🏰🚽 CarChess3D · Carlesso al Cesso`), direct GitHub repository link (`https://github.com/palladius/carchess3d`), 3D Gallery, and 36 Battles Matrix shortcuts alongside gameplay controls.
  - **Quake-Style Dropdown Terminal Console (`#hud-quake-console`)**:
    - Retro top-sliding terminal toggled via `~`, `` ` ``, `\`, `§`, or the `~_ Console` button in the dock.
    - Real-time logging of game events: moves, checks, checkmate, draws, luck meter bursts, loot drops, 3D brawls, and AI thinking/calculation time.
    - Interactive command prompt supporting `help`, `setup`, `topbar`, `fen`, `pgn`, `hint`, `reset`, `matrix`, `swamp`, `skeletons`, `clear`, and `close`.
  - **Multi-Side AI Worker Architecture (`AIWorkerManager.js`, `BoardInteractionView.js`)**:
    - Upgraded `AIWorkerManager` to support `cpuColor = 'b' | 'w' | 'both' | 'none'` with independent white/black difficulty levels, enabling AI vs AI demo matches and White CPU play. Gated mouse raycasting in `BoardInteractionView` so human clicks are safely ignored during CPU turns. Tested via `tests/cpu-opponent.test.mjs`.

## [0.3.6] - 2026-10-11

- 🐱🎭⛪ **Swamp Family Lineup Upgrade: Don Gatto Zorro-Vescovo (`Bishop`, `1.45m`) & Uomo Focaccina Ligure (`Pawn`, `0.95m`)**:
  - Generated and approved `assets/characters/bishop-swamp-gatto.jpg` (Variant 1, synced to `bishop-swamp-focaccina.jpg` for manifest compatibility): a swashbuckler ginger tabby cat wearing a black Zorro domino eye-mask, tall black-and-gold Papal Bishop Mitre with glowing ruby cross & sweeping yellow ostrich feather, black-and-gold embroidered Zorro cape with `"Z"` clasp, tall cuffed leather boots, golden swept-hilt rapier-crosier, and solemn Bishop blessing paw.
  - Promoted **Uomo Focaccina Ligure** (`assets/characters/pawn-swamp-focaccina.jpg`, synced to `pawn-swamp-tappo.jpg`) to the canonical Swamp **Pawn (`0.95m`)**, and added two alternate Italian fairytale Pawn portraits: **I 3 Porcellini della Palude** (`assets/characters/pawn-swamp-porcellini.jpg`) and **Zenzy Pan di Zenzero & Focaccina** (`assets/characters/pawn-swamp-zenzy.jpg`).
  - Rebuilt the watertight 3D `.glb` statues in `tools/model-pipeline/swamp/build_swamp_models.py` (`assets/models/swamp/bishop-swamp-focaccina.glb` `21,640 tris`, `1.45m`; `assets/models/swamp/pawn-swamp-tappo.glb` `16,032 tris`, `0.95m`) and updated `tools/model-pipeline/swamp/swamp_contact_sheet.png`.
- 🩸✨ **3D Miracolo di San Gennaro Blood Liquefaction Animation (`VFXPoolView.js`, `CombatAnimationManager.js`, `Registry.js`)**:
  - Implemented the bespoke 3D **Miracolo del Sangue di San Gennaro** (`san_gennaro_miracle` / `san_gennaro_blood_drops`) triggered when the Classic Bishop (**San Gennaro**) attacks: a golden Baroque reliquary ampoule (`sanGennaroAmpoule`) rises above the capture square, tilts side-to-side while its dark clotted blood core (`#3b0308`) liquefies and boils into glowing ruby-crimson (`#ff1744`) at `t >= 0.28`, and unleashes a 64-particle burst of crimson-ruby droplets and golden sparks with banner `"MIRACOLO DI SAN GENNARO! SANGUE SCIOLTO! 🩸✨"`.
- 🧊🏛️ **TRELLIS.2 3D Reconstruction Pipeline for Classic Family (`tools/model-pipeline/classic/gen_trellis2_batch.py`)**:
  - Added automated `microsoft/TRELLIS.2` image-to-3D reconstruction + contract normalizer (`faction_primary` / `faction_trim` material slots, `min.y = 0.0`, exact target height) and reconstructed `assets/models/classic/king-classic-re.glb` (`99,267 tris`, `1.80m`).

## [0.3.5] - 2026-10-11

- 🐴🐧🗣️ **Living Idle Animations & Hover/Select Character Voices (`idle_animations_and_voices_20261011`)**:
  - **Continuous Per-Character 3D Living Idle Motion (`src/views/PieceView.js`, `src/views/SkeletonRigHelper.js`)**:
    - Every living piece on the 8×8 board now moves organically even when standing still: Knight Seby's warhorse steps/trots gently in place and swishes its tail (`tail` bone), Pawn Puffins sway fluidly in an S-curve and wag their tail feathers (`tail` bone), Bishop Ale's shoulder dragon beats its wings (`leftWing`/`rightWing`) and waves its wand, Rook Pupurabbu squishes and breathes, and King Riccardo & Queen Kate breathe with regal poise.
    - Hovering or selecting a piece boosts its idle amplitude (`1.55×` on hover, `1.95×` on select) so characters visibly perk up under the cursor.
  - **Hover Creature SFX & Authentic Spoken Character Voice Lines (`src/core/Registry.js`, `src/listeners/AudioListener.js`, `src/listeners/HudListener.js`, `src/views/BoardInteractionView.js`)**:
    - Generated all 6 authentic character voice MP3s via `gemini-2.5-flash-preview-tts` ([`scripts/generate_voice_lines.py`](scripts/generate_voice_lines.py) → `assets/audio/voices/voice-{k,q,b,n,r,p}.mp3`):
      - **Seby (`n`)**: *"Dimmi papino!"* + hover horse snort (`🐴 Snort! Prrr!`)
      - **Ale (`b`)**: *"Agli ordini, Signore!"* + hover dragon whistle (`🐉 Fiuuu!`)
      - **Kate (`q`)**: *"This is an interesting choice..."* (sarcastic British English `en-GB`) + hover crystal chime (`♕ Hmm...`)
      - **Puffin (`p`)**: *"Piu piu! Eccomi, pronta guardia Puffin!"* + hover cute double chirp (`🐧 Piu-piu!`)
      - **Riccardo (`k`)**: *"Avanti tutta! Re Carlesso al comando!"* + hover royal sceptre hum (`♔ Zzt-hum!`)
      - **Pupurabbu (`r`)**: *"Boing boing! Super abbraccio Pupurabbu!"* + hover plushie boing (`🟣 Boing-pfiu!`)
    - Added [`tests/voices_idle.test.mjs`](tests/voices_idle.test.mjs) and synced [`docs/spec/SPEC.md`](docs/spec/SPEC.md) and [`sw.js`](sw.js) (`v7`).
- 🍌🎬 **All 36 Nano Banana 2.1 Battle Keyframes & 15 Veo 3.1 16:9 Videos (`scripts/generate_nb_veo_battle.py`, `assets/battles/prompts_36.json`)**:
  - **Stage 1**: Generated all **36/36** 16:9 initial battle keyframes (`assets/battles/keyframes/<atk>_x_<def>.png`, `1376×768`) using **Photo 1 (Attacker Left)** + **Photo 2 (Defender Right)** + side-by-side layout guide (`assets/battles/refs/<id>_ref.png`) via Nano Banana 2.1 (`gemini-3.1-flash-image-preview`).
  - **Stage 2**: Generated 15/36 full 8-second 16:9 Veo 3.1 (`veo-3.1-generate-preview`) battle videos with audio (`assets/battles/videos/<id>.{mp4,webm}`) including all 4 Easter Eggs (`n_x_r`, `r_x_n`, `k_x_q`, `q_x_k`), all 6 Bishop Ale battles (`b_x_*`), and all 6 Knight Seby battles (`n_x_*`).

## [0.3.4] - 2026-10-10

- 🔗🏷️ **Footer GitHub Links & Game Version Display (`src/listeners/HudListener.js`, `src/core/Registry.js`, `battles.html`, `showcase/index.html`, `tests/core.test.mjs`)**:
  - Added dedicated `.hud-footer-meta` row inside the game HUD `<footer class="hud-bottombar">` (and matching footers in [`battles.html`](battles.html) and [`showcase/index.html`](showcase/index.html)):
    - **`v0.3.4` Game Version Tag**: Displays current game version (`v${APP_VERSION}`), dynamically refreshed at runtime via `fetch('./VERSION')`.
    - **🐙 GitHub Code**: Direct clickable link to the repository source code (`https://github.com/palladius/carchess3d`).
    - **🐛 Open a Bug**: Direct clickable link to open a new GitHub Issue (`https://github.com/palladius/carchess3d/issues/new`).
  - Added unit test in [`tests/core.test.mjs`](tests/core.test.mjs) verifying `APP_VERSION`, `GITHUB_REPO_URL`, and `GITHUB_NEW_ISSUE_URL` match `VERSION` and repo endpoints.
>>>>>>> origin/main

## [0.3.3] - 2026-10-10

- 🍌📺 **Wire Nano Banana 16:9 Keyframes & `1.65×` Veo Playback (`BattleMatrix36.js`, `VeoCinemaView.js`, `battles.html`)**:
  - Added `keyframeUrl: assets/battles/keyframes/<id>.png` across all 36 entries in [`src/core/BattleMatrix36.js`](src/core/BattleMatrix36.js) and wired `poster="assets/battles/keyframes/<id>.png"` into the 6×6 video player in [`battles.html`](battles.html).
  - Updated [`src/views/VeoCinemaView.js`](src/views/VeoCinemaView.js) to preload and render the Nano Banana 16:9 Initial Battle Keyframe as Tier-2 fallback on the 16:9 Magic Cinema Mirror while the video buffers, and set `videoEl.playbackRate = 1.65` so the full 6–8s Veo 3.1 battle movie plays within the 4.0s 3D Scazzottata cutscene.

## [0.3.2] - 2026-10-10

- 🍌🎬 **2-Stage Generative AI Battle Cinema Pipeline (`Nano Banana 2.1` Keyframe → `Veo 3.1` I2V Video) (`scripts/generate_nb_veo_battle.py`, `assets/battles/keyframes/{b_x_n,n_x_b}.png`, `assets/battles/videos/{b_x_n,n_x_b}.{mp4,webm}`)**:
  - Added [`scripts/generate_nb_veo_battle.py`](scripts/generate_nb_veo_battle.py): composes the clean front portraits of Attacker (Left) + Defender (Right) + 16:9 side-by-side layout guide (`assets/battles/refs/<pair>_ref.png`) into a cohesive 16:9 Pixar-style starting frame via `gemini-nano-banana-2.1`, then animates that exact frame into a 16:9 `.mp4` + `.webm` battle movie via `veo-3.1-fast-generate-preview`.
  - Generated full-fidelity 16:9 Nano Banana 2.1 keyframes and Veo 3.1 I2V movies for **`b_x_n` (Bishop Ale & Red Dragon vs Knight Seby)** and **`n_x_b` (Knight Seby & Hot-Wheels Loop-Track vs Bishop Ale)**.

## [0.3.1] - 2026-10-10

- 🐛🧹 **Merge `refactor_ui_cleanup_ux` — Idempotent UI Clicks, Async GLTF Load-Token Guard & Mirror-Safe Camera Flip (`PieceManager.js`, `WowModeView.js`, `ZurichSwampView.js`, `CombatAnimationManager.js`, `HudListener.js`, `main.js`, `tests/pieces.test.mjs`)**:
  - **Idempotent `🐸 Palude` (`PieceManager.seedSwampParty` / `handlePieceCaptured`)**: Clicking `🐸 Palude` or opening `?demo=swamp` now calls `PieceManager.seedSwampParty()`, which is idempotent (`swampDemoPiece: true`) and never spawns duplicate dead pieces or deletes living pieces (`c1, g1, e2, b8, f8, h8`) from the 3D board. Covered by unit test in [`tests/pieces.test.mjs`](tests/pieces.test.mjs).
  - **WOW Mode Async Load-Token Guard & Skeleton Preservation (`WowModeView.js`)**: Added `_heroLoadToken` so rapid clicks on WOW character/variant buttons never attach stale GLTF hero roots out of order, while preserving 3D skeleton rigs (`SkeletonRigHelper`) and prevented `WowModeView.onArenaClash` from mutating Mode 1 `pieceView.pieceBySquare`.
  - **Duplicate Highlight Ring Cleanup (`ZurichSwampView.js`)**: Removed duplicate selection/check highlight rings from `ZurichSwampView` (now exclusively owned by `BoardInteractionView`).
  - **Mirror-Safe Camera Flip (`HudListener.js`, `main.js`)**: Flipping the camera (`🔄 Flip`) now parks at `z = -8.2m` in front of the `z = -10.2m` 16:9 Magic Cinema Mirror instead of clipping behind it, and added `CombatAnimationManager.isBusy()` alias for backward compatibility.

## [0.3.0] - 2026-10-10

- 🐝🎬 **Adversarial Swarm Complete — All 36 (`6×6`) Bespoke 3D Brawls, 72 16:9 Videos (`36 .mp4` + `36 .webm`), Interactive 6×6 Matrix Explorer & Visible 3D Skeletons (GitHub Issues `#10`–`#16` ✅)**:
  - **Issue `#11` (`@matrix36-choreo` & `@explorer6x6-ux`) — All 36 (`6 vs 6`) Animations & Videos + `battles.html` Explorer**:
    - Added [`src/core/BattleMatrix36.js`](src/core/BattleMatrix36.js) defining all 36 (`6 × 6`) combinations with bespoke bilingual titles, comic banners, attacker 3D weapons, Act 2 defender counter-attack moves (`defenderCounter`), and finisher reactions, plus [`tests/matrix36.test.mjs`](tests/matrix36.test.mjs).
    - Upgraded [`scripts/render_battle_videos.py`](scripts/render_battle_videos.py) and generated **all 36 `.mp4` and all 36 `.webm` 16:9 3-Act videos** (`assets/battles/videos/k_x_k.mp4` .. `p_x_p.mp4`, 72 video files total).
    - Built the standalone **[`battles.html`](battles.html) 6×6 Battle Matrix Explorer** (`https://palladius.github.io/carchess3d/battles.html`) and the in-game **`🎬 Matrice 6×6 (36 Scontri)`** modal in [`src/listeners/HudListener.js`](src/listeners/HudListener.js) with 1-click **`🥊 Scazzottata 3D + Cinema`**, built-in 16:9 `<video>` preview player, and **`▶️ Maratona 36 Scontri`**.
  - **Issue `#10` & `#15` (`@brawl3d-vfx`) — 3D Weapons, Defender Counter-Attacks, Floating 3D Comic Words & Shrek Swamp Splash**:
    - Attached 3D weapons & props (`buildFighterWeaponProp`) to both fighters in [`src/views/VFXPoolView.js`](src/views/VFXPoolView.js) (Puffin's Halberd + 3D Silver Fish, Ale's Amethyst Staff + Dragon Fireball stream, Seby's Twin Orange Turbo Boosters + orbiting race car, Pupurabbu's Giant Purple Plushie Boxing Gloves + Belly Aura, Kate's Golden-Lilac Choco Wand + Magic Shield, Riccardo's Lightning Sceptre + Golden Plunger-Crown).
    - Added active **Defender Counter-Attacks in Act 2** (`horse_rear_hoof_kick`, `dragon_flame_puff`, `halberd_fish_parry`, `plush_belly_bounce`, `lilac_choco_shield_spin`, `royal_sceptre_zap`), floating 3D comic impact words (`CHARGE!` → `CLANG! ⚔️` → `CONTRATTACCO! 💥` → `KAPOW! 🌪️` → `K.O.! 🐸💦`), hit-pulse camera shake, and a 3D emerald water-column splash (`swampKoSplash`) in Shrek's Swamp.
    - Updated [`src/views/VeoCinemaView.js`](src/views/VeoCinemaView.js) to play all 36 `<atk>_x_<def>.mp4`/`.webm` videos and render pair-specific titles & Act 2 counter-attack badges.
  - **Issue `#12` & `#14` (`@skeletons-locomotion`) — Visible 23-Joint 3D Articulated Skeletons & Footprints/Hoofprints**:
    - Added [`src/views/SkeletonRigHelper.js`](src/views/SkeletonRigHelper.js) and integrated it into [`src/views/PieceView.js`](src/views/PieceView.js) and [`src/views/WowModeView.js`](src/views/WowModeView.js): 23 articulated 3D bone/joint pivots (including Knight Seby's 4-legged warhorse skeleton and Bishop Ale's dragon wing skeleton), glowing footprint/hoofprint trails along `2.0s–2.2s` moves, **`🦴 Scheletri 3D`** HUD toggle, and sculpted 3D notched lily-pad leaves + pink lotus flowers under every Shrek Swamp swimmer.
  - **Issue `#13` & `#16` (`@explorer6x6-ux` & `@adversarial-critic`) — Mac Trackpad `_customWheelEvent` Fix, Legal Dots Hover Preview & Full Adversarial Audit**:
    - Fixed Three.js `OrbitControls._customWheelEvent` stripping `deltaX` & `ctrlKey` in [`src/views/BoardInteractionView.js`](src/views/BoardInteractionView.js) (caught by `@adversarial-critic`), added 3D floating capture hover preview badges (`"⚔️ ♙ Puffin vs ♙ Puffin"`), and added [`scripts/adversarial_swarm_audit.py`](scripts/adversarial_swarm_audit.py) verifying all 7 GitHub Issues (`#10`–`#16`) end-to-end.

## [0.2.7] - 2026-10-10

- ♔🏛️ **Pure Vanilla Classic Chess Family (`classic`) with San Gennaro Bishop & Torre Matildea Rook**:
  - Replaced the Carlessian-hybrid Classic pieces with a 100% pure traditional Staunton & Italian heritage chess set (`assets/characters/*-classic-{re,regina,vescovo,cavallo,torre,pedone}.jpg` via `gemini-nano-banana-2.1` + watertight 3D `.glb` models in `assets/models/classic/`):
    - **♔ Re Classico (`king-classic-re.glb`, `1.80m`)**: Fluted ivory marble & royal gold Staunton King with crimson velvet crown cushion & Cross Pattee finial.
    - **♕ Regina Classica (`queen-classic-regina.glb`, `1.65m`)**: Fluted Staunton Queen with 8-spike gold coronet, 8 ivory pearls & central golden orb.
    - **♗ San Gennaro (`bishop-classic-vescovo.glb`, `1.45m`)**: Neapolitan Baroque reliquary bust of St. Januarius (`Busto del Tesoro di San Gennaro`) with crimson-and-gold brocade cope, glowing ruby **Ampolla del Sangue** medallion on the chest, jewel-encrusted Baroque mitre (rubies, emeralds, pearls, cross), and golden pastoral crosier.
    - **♘ Destriero Classico (`knight-classic-cavallo.glb`, `1.35m`)**: Sculpted Staunton warhorse head with arched neck, scalloped marble mane & golden bridle.
    - **♖ Torre Matildea (`rook-classic-torre.glb`, `1.30m`)**: Renaissance fortress tower inspired by the **Torre Matildea / Castello Estense** of Ferrara & Lidi Ferraresi in warm terracotta brickwork, ivory marble corner quoins, overhanging corbel machicolations (`beccatelli e caditoie`), battlements & octagonal roof lantern.
    - **♙ Pedone Classico (`pawn-classic-pedone.glb`, `0.95m`)**: Pure turned Staunton Pawn with baluster shaft, double gold collar & smooth ivory sphere.
- 🐸♟️ **Playable Multi-Family Selector on the 3D Chessboard (`index.html`, `Registry.js`, `PieceManager.js`, `PieceView.js`, `HudListener.js`)**:
  - Wired all 3 piece families (`carlesso`, `swamp`, `classic`) + `stone` directly into the playable 3D chessboard via HUD topbar selectors (`#hud-white-select` for White, `#hud-rival-select` for Black) and URL query parameters (`?family=swamp`, `?family=classic`, `?white=...`, `?black=...`).
  - Updated `PieceView.attachGlbToPiece` to preserve multi-material untextured PBR colors on `swamp` and `classic` `.glb` models while dynamically tinting `faction_primary` and `faction_trim` slots by team color (White Ivory & Gold vs Black Obsidian & Silver).

## [0.2.6] - 2026-10-10

- 🐛🤖 **Fix: CPU opponent only moved once** (`src/main.js`, `src/managers/AIWorkerManager.js`, `src/managers/BoardMapManager.js`, `src/listeners/HudListener.js`):
  - Root cause: the ad-hoc CPU wiring in `main.js` called the non-existent `combat.isBusy()` inside the `MOVE_EXECUTED` handler, throwing `TypeError` during `bus.flush()` on every CPU turn. The first move only worked because the HUD called `ai.requestMove()` directly; afterwards the user had to re-select the CPU to force each move.
  - Per Niccolò rule #2/#3/#4, the "it is the CPU's turn → think → move" rule now lives in `AIWorkerManager` (reacts to `OPPONENT_CHANGED`, `MOVE_EXECUTED`, `BOARD_RESET`, `BATTLE_COMPLETED`, `BATTLE_SKIPPED`; queries `board`/`flow`/`combat.isActive()` read-only via `ctx`; generation-guarded timer, no double-think). `BoardMapManager` now applies `AI_MOVE_READY` itself (ignoring stale replies). `main.js` and `HudListener` no longer call the AI directly.
  - Spec drift fixed in `docs/spec/SPEC.md` (§Architecture › `ai/`): CPU turn-taking ownership is now documented.
  - TDD: added `tests/cpu-opponent.test.mjs` (5 headless regression tests: replies to every human move, takes a pending turn right after being enabled, stops on hotseat, waits for the capture cutscene, board ignores stale AI moves). Verified end-to-end in headless Chromium (3 consecutive CPU replies, zero page errors).
- 📐🏠 **Self-sufficient spec**: `docs/spec/SPEC.md` + `docs/spec/input_prompt.md` imported from `palladius/respec` (`carlesso-family/chess3d`, last respec commit `9c5c2a7`). `respec` is no longer a dependency: `AGENTS.md`/`GEMINI.md`, `README.md` and the `justfile` (`sync-assets` → `spec`) now point to the in-repo spec, which may be edited together with the code.

## [0.2.5] - 2026-10-10

- 🌐📖 **GitHub Pages Live Banner in `README.md` & GitHub Issues `#10`–`#16`**:
  - Added prominent live GitHub Pages links (`https://palladius.github.io/carchess3d/`, WOW Mode, 3D Brawl demo, Shrek Swamp demo, 3-Family Showcase, and Visual Progress Gallery) at the top of [`README.md`](README.md).
  - Created 7 tracked GitHub Issues (`#10`–`#16`) for every single gameplay/3D/UX requirement and launched the Adversarial Swarm to implement all 36 (`6×6`) bespoke 3D combat animations, all 36 `.mp4`/`.webm` 16:9 videos, the interactive 6×6 Battle Matrix Explorer, and visible 3D skeletal rigs.

## [0.2.4] - 2026-10-10

- 🥊⚔️ **3D Scazzottata / Real 3D Character Brawl (`VFXPoolView.js` + `CombatAnimationManager.js` + `PieceView.js`)**:
  - Replaced untextured stage proxy cones with the **two actual 3D `.glb` combatant statues** (`attackerFighter` vs `defenderFighter`) staged directly on the capture square across a `4.0s` 3-Act 3D Brawl:
    1. *Act 1 (Walk/Gallop Charge & Guard Stance)*: Attacker A charges in from `fromSquare` while Defender B turns to face them in a combat guard stance.
    2. *Act 2 (La Scazzottata 3D — 5 Physical Combat Exchanges)*: Attacker A and Defender B trade 5 rapid back-and-forth lunges, counter-attacks, mid-air whirlwind clashes, uppercuts, and signature finishers inside a swirling 3D cartoon brawl dust cloud + comic impact starburst (`KAPOW!`), framed by a close-up orbiting camera (`dist = 4.0m..4.6m`).
    3. *Act 3 (Knockout Launch into Shrek's Swamp & Victory Pose)*: Defender B is flattened/melted or launched spinning into the Enchanted Swamp moat while Attacker A celebrates on the captured square.
- 🏃‍♂️🐎 **2.0-Second Articulated Skeletal Piece Locomotion (`PieceView.js`)**:
  - Injected a real-time procedural skeletal limb & horse-gallop vertex shader (`injectLocomotionShader` on `MeshStandardMaterial.onBeforeCompile`) so every `.glb` statue's left/right legs, feet, horse hooves, arms, and weapons visibly stride and swing during movement and combat.
  - Upgraded board moves (`c2 -> c4`, `g1 -> f3`, etc.) to **`2.0s` (`2.2s` for Knight Seby)** with distinct character gaits: Pawn Puffin's 8-step Swiss-Guard waddle-march (`Camminata di Puffin`), Knight Seby's horse rear-up + 4-bound curved L-gallop (`Cavalcata di Seby`), Bishop Ale's 6-beat winged diagonal glide, Rook Pupurabbu's 5 squash-and-stretch plushie bounds, Queen Kate's royal stride & pirouette, and King Riccardo's solemn swagger.
- 🖐️🍎 **Mac Trackpad 2-Finger Rotate & Pinch Zoom Controls (`src/main.js` + `HudListener.js`)**:
  - Upgraded `OrbitControls._handleMouseWheel` so a two-finger swipe on the Mac trackpad (`deltaX`, `deltaY`) smoothly rotates the 3D camera left/right and up/down, while two-finger pinch (`ctrlKey` / Safari `gesturechange`) or `Cmd/Option/Ctrl + scroll` (plus keyboard `+`/`-` and new HUD `🔍+`, `🔍−`, `🖐️ 2-Dita: Ruota` buttons) zooms in and out.
- ♟️🧭 **White vs Black Army Facing Orientation (`PieceView.js`)**:
  - Oriented all 16 White pieces (`homeYaw = Math.PI`, facing North `-Z`) to directly confront all 16 Black pieces (`homeYaw = 0`, facing South `+Z`) across the chessboard.

## [0.2.3] - 2026-10-10

- 🎛️ **Showcase Multi-Family Selector & Live 3D Faction Material Tinting (`showcase/index.html`)**:
  - Merged interactive family tabs (`Tutte le Famiglie (18)`, `Famiglia Carlesso (6)`, `Classici Carlessiani (6)`, `Famiglia della Palude (6)`) to inspect all 18 2D Nano Banana 2.1 portraits and 3D `.glb` models in one unified gallery, keeping all 6 canonical Carlesso `.glb` models (`king-riccardo.glb`, `queen-kate.glb` + `queen-kate-wedding2016.glb`, `bishop-ale-1.glb` + `bishop-ale-rigged.glb`, `knight-seby.glb`, `rook-pupurabbu.glb`, `pawn-puffin.glb`).
  - Added live 3D faction material tinting controls (`Materiali Originali`, `Squadra Bianca (Avorio & Oro)`, `Squadra Nera (Ossidiana & Argento)`) that dynamically override `faction_primary` / `faction_trim` material slots (and apply fallback tinting + glTF PBR `metalness` clamping on textured TRELLIS.2 pieces).
  - Added `fable-5.1-high` Adversarial Art Critic score badges (`🟢`/`🟡`) per piece and quick-access buttons to the 6×4 turntable contact sheets (`classic_contact_sheet.png`, `swamp_contact_sheet.png`).
- 📦 **Carlesso Family Manifest (`assets/families/carlesso.json`)**:
  - Added declarative manifest for the primary `carlesso` family alongside `classic.json` and `swamp.json` under `assets/families/_contract.json`, wired to all 6 canonical `.glb` models.

## [0.2.2] - 2026-10-10

- 🌐🚀 **GitHub Pages Deployment**: added `.nojekyll` so GitHub Pages serves all static `.glb`, `.mp4`, `.webm`, and `_contract.json` assets directly without Jekyll filtering, and updated `sw.js` (`carchess3d-offline-v2`) to precache all 6 canonical 3D `.glb` family models.

## [0.2.1] - 2026-10-10

- ✍️🦖 Added [`docs/ARTICLE.md`](docs/ARTICLE.md): Carlessian-style engineering story & SRE telemetry post-mortem documenting how **CarChess3D** was built from scratch in 2 days (~4h 3D pipeline on Oct 9 + 2h 43m autonomous `/goal` sprint on Oct 10, with the first playable 10k-LOC 3D build reached in **38m 06s** via 4 parallel subagents).

## [0.2.0] - 2026-10-10

- 🏰🚽 **Complete v1 of CarChess3D ("Carlesso al Cesso" / "Scacchi di Famiglia")** executing `conductor/tracks/v1_carchess3d/plan.md` end-to-end across Phases 1–5 (`9.8 / 10` Adversarial Critic score in Round 3, `9.9 / 10` in Round 4).
- 📐 **Phase 1 — 2D Metric Spatial Blueprint & GLB Grounding**:
  - Generated [`docs/floorplan.svg`](docs/floorplan.svg) with exact meter coordinates (`8.0m × 8.0m` carved stone rune altar at `y = 0.00m`, `Ø 0.75m` pedestals, canonical piece hierarchy `0.90m..1.85m`, 4 corner braziers at `(±5.2m, 1.2m, ±5.2m)`, emerald swamp moat `r = 6..18m`, 16:9 Magic Cinema Mirror at `z = -10.2m, y = 3.65m` between the Grossmünster twin towers, St. Peter, Fraumünster, Limmat, and Swiss Alps at `z = -25m`).
  - Added [`src/utils/glbGrounding.js`](src/utils/glbGrounding.js) to automatically normalize every loaded `.glb` so `bbox.min.y === 0.00m` and height matches its canonical chess rank.
  - Vendored [`vendor/chess.js`](vendor/chess.js) + Three.js addons (`OrbitControls`, `SkeletonUtils`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`).
- 🧠 **Phase 2 — Headless Core & Niccolò Managers (`<= 300` LOC per file, zero DOM/Three.js in `src/core/`, `src/managers/`, `src/ai/`)**:
  - Implemented deterministic queued [`GameEventBus`](src/core/EventBus.js), `mulberry32` seeded PRNG ([`src/core/Rng.js`](src/core/Rng.js)), fixed `1/30s` [`GameLoop`](src/core/GameLoop.js), [`GameFlowManager`](src/managers/GameFlowManager.js), [`BoardMapManager`](src/managers/BoardMapManager.js), [`PieceManager`](src/managers/PieceManager.js), [`CombatAnimationManager`](src/managers/CombatAnimationManager.js), [`DropManager`](src/managers/DropManager.js) (🍀 Barra della Fortuna / Pity Timer `L_max = 12` verified with a 10,000-capture Monte-Carlo test), and non-blocking Web Worker CPU [`AIWorkerManager`](src/managers/AIWorkerManager.js) (`Easy` capture-maximizer, `Medium` minimax d=2, `Hard` alpha-beta d=4 with MVV-LVA & PSTs).
- 👑🐉 **Phase 3 — Full 32-Piece 3D `.glb` Carlesso Family Roster & glTF PBR Fix**:
  - Integrated all 6 canonical 3D `.glb` models from `main` (`king-riccardo.glb`, `queen-kate.glb`, `bishop-ale-1.glb` + rigged `bishop-ale-rigged.glb`, `knight-seby.glb`, `rook-pupurabbu.glb`, `pawn-puffin.glb`) into [`src/core/Registry.js`](src/core/Registry.js), [`src/views/PieceView.js`](src/views/PieceView.js), and [`src/views/WowModeView.js`](src/views/WowModeView.js).
  - Fixed the glTF 2.0 default `metallicFactor: 1.0` material darkening bug (`mat.metalness = 0.04; mat.roughness = 0.52; mat.emissiveMap = mat.map;`) so all 32 3D pieces display their vibrant Pixar colors.
  - Added 3D colored legal-move dots (`#00e676` + `#ffee58`) and rotating crimson capture target rings (`#ff3d00`) in [`src/views/BoardInteractionView.js`](src/views/BoardInteractionView.js).
- 🐸 **Shrek Swamp Splashing Captured Pieces ("Palude di Shrek")**:
  - Captured pieces dive along a high parabolic arc into the West/East emerald swamp moats (`x = ±6.2m..±7.2m, y = -0.28m`) and continuously bob, tilt, and paddle on green lily-pad rings surrounded by glowing concentric water ripples and rising green swamp bubbles (`?swamp_party=1` + `🐸 Palude Shrek` HUD button).
- 🎬 **Zero-HITL 16:9 Battle Cinema Videos (`assets/battles/videos/*.mp4` & `.webm`)**:
  - Added [`scripts/render_battle_videos.py`](scripts/render_battle_videos.py) and generated 3 browser-native 16:9 `1280×720` `.mp4` + `.webm` battle videos for Ale & Seby (`b_x_n.mp4`, `n_x_b.mp4`, `n_x_r.mp4`), projected live onto the 3D Magic Cinema Mirror in [`src/views/VeoCinemaView.js`](src/views/VeoCinemaView.js) with automatic Tier 2/3 60fps canvas fallback for any unrendered pair.
- 🎨📸 **Visual Progress Gallery & Critic Loop**:
  - Added [`progress.html`](progress.html), [`docs/VISUAL_PROGRESS.md`](docs/VISUAL_PROGRESS.md), and 25+ diagnostic screenshots across Rounds 1–4 in [`docs/visual-progress/`](docs/visual-progress/), plus offline PWA support ([`manifest.webmanifest`](manifest.webmanifest), [`sw.js`](sw.js)).

## [0.1.27] - 2026-10-10

- 🛤️ **Parallel Conductor Tracks (`classic_default_pieces_20261010` & `swamp_family_pieces_20261010`) + Fable 5.1 Adversarial Review & Art Critic Loop**:
  - Reviewed specs/plans and audited 2D/3D outputs with `fable-5.1-high` (`fable-reviewer` + `art-critic`) in a multi-agent Swarm with zero file collisions (`assets/families/_contract.json`, `CHANGELOG.d/`, per-family `docs/qa-scores.<family>.yaml`, and per-family `RUNNING_DOC.md`).
- 🗿🚽 **Carlessian Classic Family (`classic`)**:
  - Generated 6 Nano Banana 2.1 (`gemini-nano-banana-2.1`) 2D character portraits (`assets/characters/{king-classic-cesso,queen-classic-ciocco,bishop-classic-drago,knight-classic-turbo,rook-classic-puffo,pawn-classic-puffin}.jpg`, `art-critic` 2D avg **8.6/10 🟢**).
  - Sculpted 6 watertight, floor-grounded (`min.y = 0.0`, `0.95m → 1.80m`) 3D `.glb` models in `assets/models/classic/` with `faction_primary` / `faction_trim` material slots, 6×4 turntable contact sheet (`tools/model-pipeline/classic/classic_contact_sheet.png`), declarative manifest `assets/families/classic.json`, and `tests/test_classic_family.py`.
- 🐸🧅 **Swamp Parody Family (`swamp`)**:
  - Generated 6 IP-differentiated Nano Banana 2.1 (`gemini-nano-banana-2.1`) 2D character portraits (`assets/characters/{king-swamp-orco,queen-swamp-orchessa,bishop-swamp-focaccina,knight-swamp-asinello,rook-swamp-draghessa,pawn-swamp-tappo}.jpg`, `art-critic` 2D avg **8.7/10 🟢**).
  - Sculpted 6 watertight, floor-grounded (`min.y = 0.0`, `0.95m → 1.80m`) Chibi 3D `.glb` models in `assets/models/swamp/`, 6×4 turntable contact sheet (`tools/model-pipeline/swamp/swamp_contact_sheet.png`), declarative manifest `assets/families/swamp.json`, and `tests/test_swamp_family.py`.

## [0.1.26] - 2026-10-10

- 👑👱‍♀️ **Canonical Queen Kate Young 4c (`queen-kate.glb`)**: designated the Young 4c wavy-hair model (chosen by Kate & Riccardo) as the default canonical piece (`assets/models/queen-kate.glb`, MD5 `86cee880f66da2ed2c3c7ccf514d032d`), preserving the 2016 wedding updo as an alternative piece (`assets/models/queen-kate-wedding2016.glb`, MD5 `d5ba37e0d5d5622d2265f6a7f7031395`).
- ♗ **Canonical Bishop Ale Confirmed**: confirmed Bishop Ale v1 with mitre hat (`bishop-ale-1.glb`, MD5 `6b423e6daf1ed71f001c8912cc9035f7`) as canonical piece.
- 📋 **Provenance Registry 10/10**: updated `docs/models-provenance.yaml` with all 10 3D models and 27 source views with MD5 checksums; verified via `just test` and `just provenance`.
- 🌐 **Web Showcase Updated**: showcase updated to highlight Kate Young 4c as default winner with tab to compare Nozze 2016.

## [0.1.25] - 2026-10-10

- 🏰👾 **Rook Pupurabbu 3D Model (`rook-pupurabbu.glb`)**: generated textured 3D mesh via `microsoft/TRELLIS.2` from 360° turnaround dataset (`tools/model-pipeline/rook/`), featuring the adorable fluffy purple mascot leaning out and smiling from the crenellated purple stone tower. All default chess pieces of the Carlesso family now have complete 3D models!
- 📋 **Provenance Registry Coverage**: registered `rook-pupurabbu` in `docs/models-provenance.yaml` with MD5 `eb20ae6542bc25e6ce5cc9846a82dc4c` across all 4 concept views.
- 🌐 **Showcase Complete**: linked `rook-pupurabbu.glb` in `showcase/index.html` on port 8080.
- 📓 **Documentation**: documented Pupurabbu generation in `tools/model-pipeline/RUNNING_DOC.md` (§25).

## [0.1.24] - 2026-10-10

- 🐴⚔️ **Knight Sebastian 3D Model (`knight-seby.glb`)**: generated textured 3D mesh via `microsoft/TRELLIS.2` from 360° turnaround dataset (`tools/model-pipeline/seby/`), featuring golden-armored charger steed, golden plate armor, blue royal cape, raised left fist (modular weapon/power ready), and turned wooden pedestal.
- 📋 **Provenance Registry Expansion**: registered `knight-seby` in `docs/models-provenance.yaml` with target MD5 `c060099e14059ba7fc8fdb3e4403db94` and verified concept image MD5s across all views.
- 🌐 **Showcase Updated**: linked `knight-seby.glb` in `showcase/index.html` on port 8080.
- 📓 **Documentation**: documented Sebastian pipeline, parameters, and render results in `tools/model-pipeline/RUNNING_DOC.md` (§24).

## [0.1.23] - 2026-10-10

- 👑 **King Riccardo 3D Model (`king-riccardo.glb`)**: generated textured 3D mesh via `microsoft/TRELLIS.2` from turnaround concept (`king-riccardo-1.jpg`, front/side/back views) featuring imperial arched crown, blue ermine-trimmed cloak, golden royal orb, scepter, and authentic clean profile without glasses.
- 👱‍♀️ **Queen Kate Young Stylized 3D Model (`queen-kate-young.glb`)**: generated secondary 3D variant from the 4c turnaround concept with wavy flowing hair, purple frames, and royal gown. Showcase updated with interactive dual tabs for both Queen Kate interpretations.
- 📋 **Testable 3D Models Provenance Registry (`docs/models-provenance.yaml`)**: centralized registry documenting every 3D model, its MD5 checksum, target paths, source concept images, pipelines, and tools.
- 🧪 **Automated Provenance Checks**: integrated stdlib MD5 validation into `scripts/check.py` (`just test`), added standalone `scripts/test_provenance.py` and recipe `just provenance`.
- 🌐 **Web Showcase Live on Port 8080**: updated `showcase/index.html` with King Riccardo and Queen Kate (Nozze 2016 + Young 4c).

## [0.1.22] - 2026-10-10

- 👑 **Queen Kate 3D Model (`queen-kate.glb`)**: generated textured 3D mesh via `microsoft/TRELLIS.2` using authentic 2016 wedding updo hairstyle concept (`kate_wedding_v2_nb21`), chic round navy glasses, emerald green eyes, royal purple velvet gown with gold embroidery, amethyst ring, and wooden carved pedestal with brass nameplate.
- 🛠️ **3D Pipeline & Renders**: added `tools/model-pipeline/kate/gen_trellis2.py`, automated Blender EEVEE headless render script `render_preview.py` (`out/queen_kate_3d_preview.png`), and 36-frame 360° turntable animation script `render_turntable.py` (`out/queen_kate_turntable.gif` & `queen_kate_turntable_strip.png`). Copied canonical asset to `assets/models/queen-kate.glb` (3.7 MB, watertight).
- 🔑 **HF Token Whereabouts**: configured authenticated token management in `.env` supporting `HF_RICC_PROVE3D_CARLESSO` / `palladius` work account with ZeroGPU quota.
- 📓 **Documentation**: documented full generation run, endpoints, timings, and findings in `tools/model-pipeline/RUNNING_DOC.md` (§21).

## [0.1.21] - 2026-10-10

- 🛤️ **Merged Conductor Tracks (`classic_default_pieces_20261010` & `swamp_family_pieces_20261010`)**: added declarative family contract (`assets/families/_contract.json`) and parallel-safe specs/plans for the Staunton-Wizard Classic Stone set and the 100% IP-safe *Famiglia della Palude* (*Orco Brontolo, Principessa Orchessa, Asinello Chiacchierone, Mago Focaccina, Draghessa della Palude, Guardia Re Tappo*).

## [0.1.20] - 2026-10-10

- 🎼 **Conductor Plan Refinements (`/roastme` pre-flight, Forged with Argon ✨)**: updated `conductor/product.md` with canonical character variants (`bishop-ale-1.glb` + `bishop-ale-rigged.glb`, `kate_final_v1_nb21.png`, Seby 4-weapon HUD switcher), Bicolor Royal Pedestal + Rim Tint shader for mirror-match readability, 5-track adaptive Lyria 3 soundtrack (IT/EN vocal themes, calm swamp loop, dark combat loop, rare medieval heraldic Castling fanfare), CLI-only `docs/qa-scores.yaml` policy, and Mode 2 WOW Arena superseding `showcase/index.html`.
- 📦 Vendored offline runtime addons (`OrbitControls`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`, `MaskPass`, `ShaderPass`) under `vendor/three/addons/` and `chess.js` (`v1.0.0-beta.8` ESM) under `vendor/chess.js/`.
- 🌳 Added `.worktrees/` to `.gitignore` for isolated multi-agent branch execution.

## [0.1.19] - 2026-10-10

- 🔀 Merged `origin/vlm-critic` (branch commits `47c6c04` "v0.1.14" + `bbb28ea` "v0.1.15", renumbered here because `main` already used those numbers). Kept `UV_INDEX_URL` in `just critic`; branch RUNNING_DOC sections renumbered §18/§19 → §19/§20.
- 📋 Centralized QA Scoreboard in `docs/qa-scores.yaml` tracking scores, tiers (`TOP_QUALITY 🟢`, `ACCEPTABLE 🟡`, `FA_CAGARE 💩`), structural flaws, and aesthetic critiques.
- 🔍 Automatic synchronization in `tools/model-pipeline/critic/critic_vlm.py` to update the scoreboard whenever a model is evaluated.
- 💩 Query CLI `tools/model-pipeline/critic/scoreboard.py` with `--cagare` / `--worst` filter.
- ⚡ Added `just scores` and `just shittest` recipes to quickly isolate failing models and their exact flaws.
- 🐉 Modular Red Baby Dragon generation in `tools/model-pipeline/dragon/` (Nano Banana 2D turnaround views + Hunyuan3D-2 3D shape + procedural texturing).
- ♟️ Modular assembly script `tools/model-pipeline/rigging/assemble_modular_bishop.py` mounting clean dragon to Bishop Ale (`bishop-ale-1` base → `assets/models/bishop-ale-rigged.glb`) with dual 26-bone animations (`Idle` wing glide & `Click_Fire_Breath`).
- 📸 Improved studio lighting and neutral background in `render_contact_sheet.py`.
- 🔍 VLM Critic audit on modular bishop: face likeness increased from 4.0 to 6.8/10.

## [0.1.18] - 2026-10-10

- 🧪 Showcase: multiple 3D versions (Ale v1 / v2) are shown **side by side** again, inside the same-size 3D pane (labels instead of tabs; spacing and camera fit the real width of the loaded models). **Single click** on the 3D (not a drag) = fullscreen with all versions; the double-click handler is gone.

## [0.1.17] - 2026-10-10

- 🧪 Showcase: every card has the same size again (no more full-width Ale card) and every 3D model is normalised to the **same height** (spin radius capped for wide props), so all characters render at the same scale. Multiple 3D versions → `v1 / v2` tabs inside the normal 3D pane.

## [0.1.16] - 2026-10-10

- ♗ Ale 1 (con cappello) 3D **v2** via TRELLIS multi-image (front + 3/4 + NB 2.1 back, 39 s, seed 42) → `tools/model-pipeline/ale/out/ale1_hat_f_tq_back.glb`. **Rejected by Riccardo**: the dragon came out as two half-dragons. `assets/models/bishop-ale-1.glb` stays v1.
- 🧪 Showcase: 3D versions side by side (v1 left, v2 right, spinning in sync) in a full-width card; double click or ⛶ = fullscreen (Esc to exit); camera auto-fits the pane.
- 🔐 `scripts/check.py`: secret scan only covers committable files (`git ls-files --cached --others --exclude-standard`), so a gitignored `.env` no longer fails `just test`.
- 🧹 CHANGELOG: merged a duplicated `[0.1.11]` heading; this entry renumbered 0.1.14 → 0.1.16 when rebased onto `origin/main` (parallel sessions bumped the same numbers).

## [0.1.15] - 2026-10-10

- 🎯 Added ready-to-run autonomous `/goal` prompt in [`etc/prompts/GOAL_BUILD_CARCHESS3D.md`](etc/prompts/GOAL_BUILD_CARCHESS3D.md) combining `niccolo-game-design` (Managers + Queued Event Bus + `DropManager` 🍀 Luck Meter) with Geneviève's 5 Argon 3D Workflows (`floorplan.svg`, parallel subagents, `progress.html` + `?debug=1` sliders, and 4-angle Adversarial Critic loop ≥ 9/10).
- 🛤️ Created Conductor track `v1_carchess3d` (`conductor/tracks.md`, `conductor/tracks/v1_carchess3d/spec.md`, `conductor/tracks/v1_carchess3d/plan.md`) with locked `/roastme` decisions.

## [0.1.14] - 2026-10-10

- 🔀 Merged `origin/vlm-critic` into `main` with `conductor/` SDD setup (Forged with Argon ✨), reconciling version history, adding `UV_INDEX_URL=https://pypi.org/simple` to `just critic` for Derek compatibility, and removing the superseded root `tools/model-pipeline/critic_vlm.py` draft in favor of `tools/model-pipeline/critic/critic_vlm.py`.
- 🎼 **Conductor SDD Setup (Forged with Argon ✨)**: initialized `conductor/` (`index.md`, `product.md`, `product-guidelines.md`, `tech-stack.md`, `workflow.md`, and `code_styleguides/`), incorporating `ABORTED_CONDUCTOR_SPECS.md` (Mode 1 Playable Chessboard + Mode 2 3D WOW Mode & Turntable Inspector, rigged Bishop Ale `bishop-ale-rigged.glb`, and `niccolo-game-design` Managers + Typed Event Bus architecture).
- 🇨🇭🐸 **Zurich Enchanted Swamp & 16:9 Veo 3D Cinema**: defined the v1 scope (*Carlesso Family* vs *Classic Stone Wizard Chess* set, max 6×6 combinations), the special **Seby ↔ Pupurabbu** best-friends cuddle bond, the Lyria 3 bilingual (IT/EN) theme song for Ale & Seby, and the 16:9 background 3D Cinema screen projecting Veo battle clips tracked via `assets/battles/manifest.yaml` MD5 hashes.

## [0.1.13] - 2026-10-10

- 🤖 Added automated VLM & Geometric QA Critic in `tools/model-pipeline/critic/` (`critic_vlm.py`, `render_contact_sheet.py`).
- 📸 Blender headless 4-view contact sheet renderer with tracking camera.
- 🎯 Multimodal Gemini VLM evaluator auditing face likeness drift, companion/prop deformation, and back plausibility.
- 🛠️ Added `just critic <glb> <concept>` recipe.

## [0.1.12] - 2026-10-10

- 👸 Generated Final Canonical Queen Kate with Nano Banana 2.1 in `tools/model-pipeline/kate/final_queen_canonical/` (Option 3 authentic face, emerald green eyes, navy round glasses, royal purple gown, gold ring).

## [0.1.11] - 2026-10-10

- 👸 Generated 4 diverse authentic likeness alternatives for Queen Kate in `tools/model-pipeline/kate/wild_alternatives/` based exclusively on original version 4 + navy glasses.
- 🧪 Throwaway character showcase `showcase/index.html` (`just showcase`): one card per default character, 2D front/back + auto-rotating 3D GLB (Ale 1 con cappello 🏆, Puffin). Not the game.
- 📦 Vendored three.js r170 (`vendor/three/`: core + GLTFLoader + BufferGeometryUtils, MIT).
- 📓 RUNNING_DOC: corrected §13 (the Flash 2.5 "mitre hallucination" was asked for by the prompt) and added a caveat to §14 (NB 2.1 ran with a different prompt after a `PROHIBITED_CONTENT` block).

## [0.1.10] - 2026-10-10

- 👸 Generated Queen Kate merge edits (`merge_4e` and `merge_4g`): authentic facial likeness of 4 + youthful (~20s) glow + navy blue glasses.

## [0.1.9] - 2026-10-10

- 👸 Generated Queen Kate 4a, 4b, 4c edits with Nano Banana 2.1 in `tools/model-pipeline/kate/` (younger, radiant face + stylish navy blue glasses).
- 👑 Generated King Riccardo side profile variations without glasses in `tools/model-pipeline/king/side_profile_noglasses/`.

## [0.1.8] - 2026-10-10

- 👑 Generated 360° turnaround dataset for King Riccardo with Nano Banana 2.1 in `tools/model-pipeline/king/` (`front.png`, `side.png`, `back.png`, `threequarter.png`, `king_turnaround_sheet.png`).
- 🏰 Generated 360° turnaround dataset for Rook Pupurabbu with Nano Banana 2.1 in `tools/model-pipeline/rook/` (`front.png`, `side.png`, `back.png`, `threequarter.png`, `rook_turnaround_sheet.png`).
- 🧱 Added TRELLIS multi-image reconstruction pipelines for King Riccardo and Rook Pupurabbu.

## [0.1.7] - 2026-10-09

- 🍌 Generated complete 360° turnaround dataset for Unarmed Knight Sebastian with Nano Banana 2.1 (`front.png`, `side.png`, `side_left.png`, `back.png`, `threequarter.png`, `seby_turnaround_sheet.png`).

## [0.1.6] - 2026-10-09

- ⚔️ Generated 4 weapon variants for Knight Sebastian with Nano Banana 2.1 in `tools/model-pipeline/seby/weapon_variants/` (Lightsaber 🔵, Long Lance 🚩, Unarmed/Scary 👊, Epic Excalibur Sword ⚔️).

## [0.1.5] - 2026-10-09

- 🐴 Knight Sebastian pipeline in `tools/model-pipeline/seby/`: preprocessed front/3/4 views from concept #4/#5.
- 🍌 Generated 180° back views for Knight Sebastian with Nano Banana 2.1 (`back_nb_2.1.png`) and Nano Banana Pro (`back_nb_pro.png`).
- 🧱 Created `gen_textured.py` multi-image TRELLIS pipeline for Knight Sebastian.

## [0.1.4] - 2026-10-09

- 🗄️ Archived dragon bishop variant (`assets/models/archive/bishop-ale-2-dragon-rigged.glb`).
- ♗ Activated Bishop Ale #1 with mitre hat (`assets/models/bishop-ale-1.glb`) as main bishop.

## [0.1.3] - 2026-10-09

- 📖 Added `docs/3dgames.md`: practical 3D guide covering how to view `.glb`/`.gltf` models on Linux and in the browser (F3D, Blender CLI, Don McCurdy viewer, MIME associations).
- 🛠️ Added `just blender <model.glb>` recipe to immediately import and view GLB models in Blender from CLI.

## [0.1.2] - 2026-10-09

- 🐉 Rigged & animated Bishop Ale (`assets/models/bishop-ale-rigged.glb`) with a 26-bone armature and smooth segment-distance skinning.
- 🪽 Red Baby Dragon has independent bone chains (`Dragon_Wing_Base`, `Dragon_Wing_Tip`, `Dragon_Head`, `Dragon_Jaw`, `Dragon_Tail`) with continuous wing flapping and gliding (`Idle`) and interactive fire-breath attack (`Click_Fire_Breath`).
- 🎲 Installed `niccolo-game-design` skill in `.agents/skills/niccolo-game-design/`.
- 📓 Added section 11 in `RUNNING_DOC.md` for rigging and animation pipeline.

## [0.1.1] - 2026-10-09

- 🐧 `pawn-puffin.glb` upgraded to the **true multi-image** TRELLIS run (front + side + back, run C2): the back now has a black head and a striped uniform instead of an invented white blob.
- 🧪 RUNNING_DOC §10: view-set results (A vs B2/C2/D2) and grid; recommendation: front + back, + side if accurate, skip top.
- ♗ Generated 3D model for Bishop Ale #2 (`assets/models/bishop-ale-2.glb`) via TRELLIS multi-image pipeline.
- 🧱 Added `tools/model-pipeline/ale2/` pipeline script and preview artifacts (MP4, GIF, frame strip).
- 📓 Updated `RUNNING_DOC.md` with Ale 2 run details.

## [0.1.0] - 2026-10-09

- 🎉 Repo created: the implementation home of the
  [chess3d spec](https://github.com/palladius/respec/blob/main/carlesso-family/chess3d/SPEC.md).
- 🚽 Logo *Carlesso al Cesso* (badge) + 2 alternatives, made with Nano Banana Pro.
- 🖼️ All 2D character art copied from `respec` into `assets/characters/`.
- ♙♗ First TRELLIS draft models `assets/models/{pawn-puffin,bishop-ale-1}.glb`.
- 🧱 `tools/model-pipeline/`: image→3D experiments (Hunyuan3D-2, TRELLIS,
  Nano Banana extra views) and the lab notebook `RUNNING_DOC.md`, moved over
  from `respec`.
- 🧪 `just test` → `scripts/check.py` (GLB validity, naming, secret scan).
