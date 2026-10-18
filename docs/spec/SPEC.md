---
speck_version: "0.1"
mode: manual
idea_file: input_prompt.md
created_at: "2026-10-08T11:30:00Z"
assets_dir: "../../assets/characters/"
---

# Carlesso Family 3D Chess ("Scacchi di Famiglia")

## Problem Statement

Chess is a great family game, but standard chess apps are anonymous and
sterile: nothing about them says *our* family. The Carlesso family wants a
**playable 3D chess demo** where the pieces are the family members and their
magical companions, every capture is a small cartoon spectacle tied to *who*
captured, and the whole thing has a genuine 3D "wow" effect. It must run on a
laptop (localhost), in a browser, on Android, and **fully offline** (e.g. on a
plane).

> This repo hosts only the spec. The implementation lives in a separate git
> repository.

## Goals

- **Full, correct chess**: legal moves, check, checkmate, stalemate, castling,
  en passant, promotion, draw by threefold repetition / 50-move rule /
  insufficient material.
- **Family cast as pieces** (see *Cast*), rendered as cute 3D characters with
  a "cutie / Nano Banana" look.
- **Two selectable families** — *Carlesso* and an original fairy-tale *Swamp
  Family* — each playable as White **or** Black. Side colour is a **material
  overlay on the outfit** (ivory/gold vs obsidian/silver trims), never a
  different model.
- **3D board** with a **top-down default camera**, freely rotatable/zoomable
  (mouse + touch), with a "reset view" button.
- **Move highlighting**: hovering (desktop) or tapping/clicking (all devices)
  a piece shows **animated yellow circles** on reachable empty squares and
  **animated red rings** on capturable squares.
- **Attacker-specific capture animations** (2–4 s, skippable by tap/click).
- **Game modes**: 2 players on one device (hot-seat), or vs CPU with
  **Easy / Medium / Hard**.
- **Runs everywhere, offline**: localhost, desktop/mobile browsers, installable
  on Android; works with no network after first load.
- **Per-profile autosave, no login**: local profiles ("Chi gioca?" picker,
  no password) each with their own autosaved game in browser storage;
  optional FEN/PGN export/import to move a game across devices.
- **Wow factor**: soft shadows, warm lighting, bloom/glow, ambient particles,
  camera fly-in intro, squash-and-stretch piece moves, fireworks on checkmate.

## Non-Goals

- Online multiplayer, accounts, leaderboards, or any backend.
- A competitive-strength engine (Hard should challenge a family, not a GM).
- **No third-party logos, brand names, or copyrighted characters** in code,
  assets, or UI text: no Milka, Hot Wheels, Shrek, Donkey, Fiona, etc. Only
  evocative colours/shapes and original designs (see *IP Safety*).
- Native iOS app (the web/PWA version may still work on iOS Safari).
- Implementing anything inside this specs repo.

## Cast

### 👨‍👩‍👦‍👦 Carlesso Family

| Piece | Character | Look (cutie, chibi proportions) | Idle animation |
|---|---|---|---|
| ♔ King | **Riccardo** | Crown, ermine-trimmed royal cape, sceptre & orb | Sceptre tip sparkles |
| ♕ Queen | **Kate** | Crown, royal purple gown, glasses, ash-blonde hair | Elegant twirl |
| ♘ Knight ×2 | **Seby** | Silver armour, blue cape, lance, riding a wooden horse | Horse bobs |
| ♗ Bishop ×2 | **Ale** | Blue/gold mitre and robe, staff, red baby dragon on shoulder | Dragon puffs smoke |
| ♖ Rook ×2 | **Pupurabbu** | Giant, super-fluffy, soft purple/indigo monster with big sweet eyes (Seby's magical companion); no hat | Breathing, fur wobble |
| ♙ Pawn ×8 | **Swiss-Guard Puffin** | Puffin (Riccardo's totem) in blue/yellow/red striped uniform, morion helmet with red plume, halberd | Stands at attention, small sway |

Family faces must be recognisable (character-consistent) but stylised.

### 🐸 Swamp Family (original, fairy-tale parody — default rival)

Inspired by classic fairy-tale tropes, **not** by any specific film's
characters. Names and designs must be original.

| Piece | Character | Look |
|---|---|---|
| ♔ King | **Re Tappo** | Tiny pompous king, oversized crown and cape |
| ♕ Queen | **Principessa Orchessa** | Friendly green ogress princess, braid, martial-arts pose |
| ♘ Knight | **Principe Azzurro** | Vain prince on a white horse |
| ♗ Bishop | **Fata Madrina** | Plump fairy godmother with a wand |
| ♖ Rook | **Orco Brontolo** | Big green ogre, onion in hand, mud-caked boots |
| ♙ Pawn | **Asinelli Chiacchieroni** | Small, chatty grey donkeys with oversized teeth |

## Capture Animations

The animation is chosen by the **attacking** piece. The captured piece's model
is the "victim" and is removed at the end.

### Carlesso attackers

| Attacker | Animation |
|---|---|
| 👑 Riccardo (King) | Glowing rune circle on the victim's square, Riccardo raises his sceptre, magic orbs/lightning strike; victim levitates, spins and dissolves into sparkles. |
| 👸 Kate (Queen) | A chocolate wave coats the victim (material lerps to glossy milk-chocolate brown), drips fall, lilac confetti; then everything **melts** into a puddle that fades. Lilac/brown palette only, no brand marks. |
| 🐴 Seby (Knight) | A rain of tiny colourful die-cast-style toy cars (generic, unbranded) plus an orange loop-track ring; cars zoom around and bowl the victim over, which falls flat ("stecchito") with cartoon stars ✨. |
| 💎 Ale (Bishop) | The victim turns into a translucent gem (amethyst **or** ruby, random) inside a purple crystal display case; glow builds… then it **shatters into hundreds of shards** with physics-like trajectories. |
| 🟣 Pupurabbu (Rook) | Huge leap and **ground-pound**: shockwave ring, victim squashed flat like a pancake, then a big fluffy hug-poof cloud. |
| 🐧 Puffin (Pawn) | Charges with the halberd, then a cartoon "fish-slap" 🐟: victim spins off the board with a *pling*. |

### Swamp attackers

| Attacker | Animation |
|---|---|
| Re Tappo | Stamps foot, a giant royal decree scroll unrolls and flattens the victim. |
| Principessa Orchessa | Slow-motion martial-arts kick; victim flies off. |
| Principe Azzurro | Hair-flip, blinding sparkle, victim faints. |
| Fata Madrina | Wand swirl; victim turns into a pumpkin that rolls away. |
| Orco Brontolo | Enormous green swamp burp cloud; victim wilts and fades. |
| Asinelli | Double back-kick; victim bounces off the board. |

## Technical Plan / Approach

### Platform (decision: offline-first PWA, not Flutter)

- **Three.js** (WebGL) in plain ES modules, no build step required. Uses
  `OrbitControls`, `EffectComposer` + `UnrealBloomPass`,
  `MeshPhysicalMaterial` (transmission for gems/crystal).
- **Rules engine**: `chess.js` (or equivalent well-tested library).
- **All dependencies vendored** locally (no CDN) so it works offline.
- **PWA**: `manifest.webmanifest` + service worker caching every asset →
  installable on Android ("Install app"), launches full-screen, works in
  airplane mode. Note: service workers need `localhost` or HTTPS.
- Run locally with any static server (e.g. `just serve`). Optional later:
  wrap the same code in **Capacitor** for a sideloadable `.apk`.

### Architecture

- `rules/` — thin wrapper over the chess library (pure JS, unit-testable
  without WebGL): legal moves for a square, apply move, game status.
- `ai/` — CPU player in a **Web Worker** (UI never blocks):
  - **Easy**: random legal move, strongly preferring captures (more
    animations!).
  - **Medium**: minimax depth 2 with material evaluation.
  - **Hard**: alpha-beta, iterative deepening (depth ~4, ~1.5 s budget),
    material + piece-square tables, move ordering (captures first).
  - **Turn-taking is owned by the AI manager**, not by `main`/UI: it reacts to
    `OPPONENT_CHANGED` / `MOVE_EXECUTED` / `BATTLE_COMPLETED|SKIPPED` facts on the
    event bus, waits for capture cutscenes, and emits `AI_MOVE_READY`; the board
    manager applies that move (ignoring stale replies). The CPU must keep
    answering **every** human move for the whole game without re-selecting it.
- `scene/` — renderer, board, lights, camera, post-processing, particles,
  adaptive quality (reduce shadows/bloom/particle count on weak devices).
- `pieces/` — character models: procedural geometry (lathe/primitives) and/or
  lightweight glTF, plus a **portrait billboard/medallion** using the 2D
  cutie art from `carlesso-family/assets/`. Missing asset → emoji/initial
  fallback so the game never breaks.
- `fx/captures/` — one module per attacker type, common interface
  `play(attacker, victim, scene) → Promise`, skippable.
- `ui/` — HTML/CSS HUD: turn indicator, captured pieces tray (mini
  portraits), move list, new game, family/side picker, mode & difficulty,
  sound toggle, reset camera; promotion picker showing the cast portraits.
  The UI text defaults to **English (`🇬🇧 EN`)** (with a dedicated **Nonna Susan 👵🇬🇧** profile) and includes explicit **`🇬🇧 EN` / `🇮🇹 IT` flag buttons** in the startup modal header, top bar, and bottom dock to switch the interface between English and Italian at any time while keeping all character voice lines and audio untouched.
- Audio: synthesised with WebAudio + pre-recorded Chirp3 HD voice lines, mutable.

### Interaction

- Desktop: hover a piece = preview highlights; click = lock selection; click a
  highlighted square = move. Click elsewhere = deselect.
- Touch: tap = select/move; one-finger drag on empty space = rotate;
  pinch = zoom.
- Highlights: yellow pulsing circles (empty targets), red rotating rings
  (captures, including en passant target), glow on selected square, red
  pulsing aura on a king in check.
- Moves animate as an arc hop with squash-and-stretch (Pupurabbu bounces,
  Puffins march).

### Assets

- Location: **`carlesso-family/assets/`** in this repo (shared design
  reference, cutie/Nano Banana style). Naming: `<piece>-<character>[-N]`,
  `-1` = canonical, higher = alternatives: `king-riccardo-{1,2}`,
  `queen-kate-{1..5}`, `knight-seby-{1..5}`, `bishop-ale-{1,2}`,
  `rook-pupurabbu`, `pawn-puffin`; rival family as `<piece>-swamp-<name>`.
- These images are the canonical look; where the *Cast* table differs, the
  images win (e.g. Ale has a red baby dragon on his shoulder).
- Generated with the `characterconsistency-family-images` skill (reference
  photos + character descriptions for all four family members and
  Pupurabbu) and Nano Banana; transparent or plain backgrounds.
- The implementation repo copies them in at build time.
- Faces are fictional/stylised (not real likenesses) → safe to publish.
- Pupurabbu has no propeller cap; follow the provided reference images.

### IP Safety

- No trademarked names, logos, wordmarks, or recognisable character designs.
- **Be Googley**: the app (code, UI, data, generation prompts) must never name protected brands, franchises or characters (e.g. Shrek, Netflix, Saint Seiya, D&D, Hot Wheels); describe them generically. Docs may cite them; "Pixar-style" is allowed in generation prompts only (image quality). `just test` enforces a denylist (`etc/ip-denylist.txt`).
- "Chocolate" = generic glossy brown + lilac; "toy cars" = generic die-cast
  shapes in random colours; Swamp Family = original designs and names.
- All vendored libraries must be permissively licensed (MIT/BSD/Apache),
  with licences listed in the implementation repo.

## Acceptance Criteria

1. Opening `http://localhost:<port>` shows the 3D board from the top with a
   short camera fly-in; the view can be rotated/zoomed and reset.
2. Every rule in *Goals* works (verified by unit tests on the rules wrapper,
   incl. castling, en passant, promotion, mate, stalemate).
3. Hover/click/tap on a piece shows animated yellow circles on all legal
   empty targets and red rings on all legal captures — and nothing else.
4. Each of the 12 attacker types plays its own capture animation; tapping
   skips it; the board state is correct afterwards.
5. Both families can be chosen for either side (incl. same family vs
   itself); the White/Black overlay makes sides unambiguous at a glance.
6. Hot-seat and vs-CPU (Easy/Medium/Hard) both work; CPU never freezes the
   UI; Hard replies within ~2 s on a mid-range Android phone.
7. After one online load, the installed PWA works in airplane mode on
   Android Chrome.
8. Holds ≥ 30 fps on a mid-range Android phone (adaptive quality allowed).
9. No brand names/logos appear anywhere in assets, code, or UI.

## Alternatives Considered

- **Flutter**: great cross-platform story, but its 3D options
  (`flutter_scene` experimental, `three_dart` unmaintained) make bloom,
  transmission/crystal materials, and particle shattering much harder.
  Rejected for v1; a Flutter WebView shell remains possible.
- **Godot (web export)**: strong 3D, but heavier toolchain and large web
  bundles; overkill for a family demo.
- **Babylon.js**: comparable to Three.js; Three.js chosen for ecosystem and
  familiarity.

## Implementation Plan

1. Scaffold static app + vendored libs + PWA shell; board, camera, lights.
2. Rules wrapper + unit tests; click/tap selection and highlights.
3. Placeholder pieces → Carlesso characters (procedural + portraits).
4. Capture FX framework + the 6 Carlesso animations.
5. CPU worker (Easy → Medium → Hard).
6. Swamp Family models + their 6 animations; family/side picker.
7. Polish: intro, bloom, particles, audio, checkmate fireworks, adaptive
   quality; offline/Android testing.

## Living Idle Animations & Hover/Select Character Voices (v0.3.1 → v0.3.32)

- **Continuous Per-Character 3D Idle Motion**: Every living piece on the 8×8 board exhibits organic continuous movement even when no turn or capture is active (`PieceView.update` + `SkeletonRigHelper.updateSkeletonRigPose` + custom GLSL vertex shader `uIdlePhase` / `uIdleAmp` / `uPieceKind`):
  - **Knight (Seby)**: Warhorse steps/trots gently in place with alternating 4-hoof weight shift, head nod, and horse-tail swish (`tail` bone).
  - **Pawn (Puffin)**: Fluid S-curve body sway, head tilt, and rapid cute tail-feather wag (`tail` bone).
  - **Bishop (Ale)**: Shoulder baby dragon rhythmic wing-beat (`leftWing`/`rightWing`) and gentle magic-wand wave.
  - **Rook (Pupurabbu)**: Squishy plushie breathing and ear/cheek bounce.
  - **King (Riccardo) & Queen (Kate)**: Regal breathing and sceptre/crown poise.
  - Hovering or selecting a piece boosts its idle amplitude (`1.55×` on hover, `1.95×` on selection) for an immediate "perk-up" reaction.
- **Hover Creature Sound Effects & Anti-Spam (`PIECE_HOVERED`)**: Raycast pointer-hover emits `PIECE_HOVERED` with a per-square cooldown (`650 ms`) plus a **per-piece-type cooldown (`2800 ms` for Pawns `'p'`, `950 ms` for other pieces)** so sweeping across the 8 Puffin pawns never triggers a machine-gun burst of chirps (`BoardInteractionView` + `AudioListener.playHoverSfxWithAntiSpam`):
  - `n` (Seby): Horse snort & hoof paw (`🐴 Snort! Prrr!`)
  - `b` (Ale): Baby dragon whistle & wing flutter (`🐉 Fiuuu!`)
  - `p` (Puffin): Soft low-volume double chirp (`🐧 Piu-piu!`) alternating with a gentle breathy `"hmm-hmm / sbuffo"`
  - `r` (Pupurabbu): Soft plushie boing (`🟣 Boing-pfiu!`)
  - `q` (Kate): Sarcastic crystal chime (`♕ Hmm...`)
  - `k` (Riccardo): Warm royal sceptre hum (`♔ Zzt-hum!`)
- **Multi-Clip Character Voice Pool (`gemini-3.8-flash-tts`) & Smart Anti-Repetition Engine (`PIECE_SELECTED` → `VOICE_LINE_SPOKEN`)**:
  - Pre-generated 27 authentic character voice MP3s (`assets/audio/voices/voice-*.mp3`) via **`gemini-3.8-flash-tts`** (`scripts/generate_voice_lines.py`) using `speech_metadata.style` acting directions and inline expressive vocal tags (`<sigh>`, `<pff>`, `<giggle>`), with automatic `window.speechSynthesis` fallback:
    - **Queen Kate (`q`, 40yo British UK Woman — `en-gb-csagent-4` Winchester UK voice)**:
      - Signature sentences (`kind: 'signature'`): *"That's... interesting."*, *"Ok, Puffin McMuffin!"*, *"You... love me! I tell myself EVERY day!"*, *"Don't be FACETIOUS!"*
      - Higher-probability non-verbal reactions (`kind: 'mumble'`): *"Hmm-hmm..."* (`voice-q-hmm.mp3`), *"Pff... oh, honestly!"* (`voice-q-sbuffo.mp3`).
    - **Knight Seby (`n`, Young Trilingual Boy — `Puck` + pitch shift)**:
      - Signature sentences (`kind: 'signature'`): *"Dimmi papino!"*, *"Papinoooooo!!!"*, *"Papino, ti manco tantissimo!"* (3rd-language cute inversion of *I miss you*), *"My body, my choice!"* (in English), *"Mi scappa la cacca!"*, *"Mummy, can you clean my bottooooom?"* (with dragged-out final syllable).
      - Higher-probability non-verbal reactions (`kind: 'mumble'`): *"Mmh-hmm! Ehehe!"* (`voice-n-hmm.mp3`), *"Pff... uffaaa!"* (`voice-n-sbuffo.mp3`).
    - **Bishop Ale (`b`, 10yo Trilingual Boy Wizard — `Puck` + pitch shift)**:
      - Signature sentences (`kind: 'signature'`): *"Agli ordini, Signore!"*, *"Papino, ti manco tantissimo!"*, *"Papino, qual è il più forte?"*, *"Papino, quando mi compri un regalo?"*, *"Sei proprio un cafoNAZZO!"* (with rising comic emphasis on `-NAZZO!`).
      - Higher-probability non-verbal reactions (`kind: 'mumble'`): *"Mmh-hmm... vediamo!"* (`voice-b-hmm.mp3`), *"Pff... ma dai!"* (`voice-b-sbuffo.mp3`).
    - **King Riccardo (`k`), Rook Pupurabbu (`r`), Pawn Puffin (`p`)**:
      - Signature greetings (`voice-k.mp3`, `voice-r.mp3`, `voice-p.mp3`) paired with higher-probability short hums/sighs (`voice-k-hmm.mp3`, `voice-r-hmm.mp3`, `voice-p-hmm.mp3`).
  - **3-Layer Anti-Repetition Selector (`AudioListener.selectVoiceVariant`)**:
    1. **First-Touch Signature Guarantee**: The very first selection of a character in a session always plays a full `signature` sentence so the player hears their iconic personality immediately.
    2. **Higher-Probability Non-Verbal Reactions (`55%–65%` for heroes, `78%` for Puffin pawns) + Cooldown**: Subsequent selections within cooldown (`3.8 s` for heroes, `6.5 s` for pawns) or weighted random rolls favor short `mumble` clips (`hmm-hmm` / `sbuffo`) so selecting pieces back-to-back feels natural and never Fatigues the ear.
    3. **Shuffled Signature Deck + Ring-Buffer History (`recentVariantIdsByType`)**: Signature lines are dealt from a Fisher-Yates shuffled deck without replacement (guaranteeing every quote is heard before any quote can repeat) and filtered against the last `N` played variant IDs so **no clip ever plays twice in a row**. Emits `VOICE_LINE_SPOKEN` so the HUD toast displays the exact randomized quote spoken.
- **Lyria 3 Baroque-Symphonic String Chess Overture & Combat Soundtrack (`AudioListener.js`)**:
  - **Baroque String Octet & Symphonic Chess Overture (`assets/audio/chess-strings-theme.mp3`)**: 100% instrumental 30-second loop in E Dorian minor (`128 BPM`) generated via `lyria-3-clip-preview`, featuring a driving double string quartet (`4 violins, 2 violas, 2 cellos`) with crisp staccato/marcato eighth-note ostinatos, descending Dorian violin lines (`C# -> C -> B`), resonant cello counter-melodies, and theatrical symphonic grandeur, paired with a multi-voice E-Dorian String Octet WebAudio synthesizer fallback (`BAROQUE_VIOLIN_MELODY_HZ` + `BAROQUE_CELLO_STACCATO_HZ`).
  - **Fiery Combat Suspense Loop (`assets/audio/combat-suspense.mp3`)**: Automatically plays during `BATTLE_STARTED` and stops cleanly on `BATTLE_COMPLETED` / `BATTLE_SKIPPED`.

## 2-Stage 36-Combination Battle Cinema Pipeline & IMAX World Transformation (`Nano Banana 2.1 → Veo 3.1`)

- **Stage 1 (Nano Banana 2.1 16:9 Initial Keyframe)**: For each of the 36 `Attacker × Defender` combinations, `scripts/generate_nb_veo_battle.py` feeds **Photo 1 (Attacker on the LEFT)** + **Photo 2 (Defender on the RIGHT)** + a side-by-side 16:9 layout guide (`assets/battles/refs/<id>_ref.png`) into `gemini-3.1-flash-image-preview` to generate the 16:9 initial battle keyframe (`assets/battles/keyframes/<id>.png`).
- **Stage 2 (Veo 3.1 `firstFrame` + `lastFrame` 16:9 Battle Video & Adversarial Audit)**: Passes the Stage 1 initial keyframe (`assets/battles/keyframes/<id>.png`) as `image` (`firstFrame`) and the climax/aftermath keyframe (`assets/battles/keyframes/<id>_end.png`) as `lastFrame` into Vertex AI / AI Studio `veo-3.1-generate-001` (`durationSeconds: 8`, `generateAudio: true`) with the pair's choreography prompt (`assets/battles/prompts_36.json`) to generate an 8-second 16:9 `.mp4` and `.webm` video (`assets/battles/videos/<id>.{mp4,webm}`), synchronized with the in-place 3D board brawl (`PieceView` + `VFXPoolView` + `VeoCinemaView`).
  - **Adversarial Video Critic Audit & Archive Catalog (`docs/battles/video_audit.yaml` + `assets/battles/archive/`)**: Every battle video is audited across 4 temporal frames (`0.5s, 2.8s, 5.2s, 7.4s`) by an Adversarial Video Critic against a minimum quality threshold of `6.5 / 10`. Any video scoring `< 6.5` (e.g., static camera pans, duplicate character clones, vanishing/reappearing rook towers, or costume morphs) is preserved in `assets/battles/archive/videos/` (and replaced keyframes in `assets/battles/archive/keyframes/`) and documented in `docs/battles/video_audit.yaml` with its generation prompts, critic score, rejection reason, and `human_rescue_note`, while a clean `firstFrame` + `lastFrame` version is promoted to `assets/battles/videos/`.
- **Full-Viewport Chrome-Free 16:9 Netflix Maxischermo, 10-Second Timeline & Non-Linear Board Warp (`ZurichSwampView` + `VeoCinemaView` + `VFXPoolView` + `HudListener`)**:
  - **10.0s Combat Timeline (`1s Pre-Padding + 8s Full Veo Video + 1s Post-Padding = 10.0s`)**:
    - `0.0s .. 1.0s` (**1s Pre-Padding**): Camera zooms in, Netflix screen expands to full viewport, non-linear board/piece warp opens the arena, the 2 contenders step into a wide `2.28m` Left/Right 3/4 profile Face-Off stance, and the `<video>` is cued and held at Frame 0 (`0.0s`) so zero seconds of video are lost.
    - `1.0s .. 9.0s` (**8s Full Veo Video**): All `8.0s` of `assets/battles/videos/<id>.mp4` play uninterrupted (`0.0s -> 8.0s`, `loop = false`) while the screen stays at 100% full viewport size (`combatBlend = 1.0`).
    - `9.0s .. 10.0s` (**1s Post-Padding**): The video holds its final frame (`8.0s`) while the victorious 3D piece holds a calm Victory Pose on the conquered square for 1 full second, followed by a **`3.5s` Sliding-Window Exit** (`10.0s .. 13.5s`) that smoothly zooms the screen back to the "Cinema Vecchio" between the Grossmünster towers and restores the board, camera, HUD chrome, and soundtrack.
  - **Full-Viewport Chrome-Free Netflix Maxischermo (`videoBoost = 2.38`, `videoAlpha = 0.78`)**:
    - During combat, all HTML HUD chrome (`#hud-topbar` header, `.hud-bottombar` footer, banners, and toasts) and canvas text overlays hide automatically so the player enjoys a pure, unobstructed 16:9 movie (`19.04m × 10.71m` at `z = -4.65m`, filling ~93% of the viewport) with a 1.5% `#E50914` Netflix border and a discreet 3px bottom progress hairline.
    - The 16:9 Veo video is rendered at **`78%` alpha** (`?videoAlpha=0.78`) with a soft lower-center radial contrast cushion while the two 3D fighting pieces remain **100% solid** at **`1.52×` scale** in the foreground.
  - **Non-Linear Spatial Board & Neighbor Piece Transformation (`_applyArenaNonLinearWarp`)**: Non-fighting neighboring pieces are radially dilated outward from the duel center (`+1.52m` clearing) and scaled down non-linearly to `56%..70%`, giving the two `1.52×` protagonists a wide, readable foreground stage while keeping neighboring pieces visible around the perimeter.
  - **Measured Unbroken Video + Audio Exit on `Space` or `Click / Tap` (`BATTLE_SKIPPED`)**: Pressing `Space` (or `Enter`/`Escape`) or clicking/tapping anywhere on screen during combat triggers a smooth `2.5s` sliding-window exit where the `<video>` keeps playing while fading out in alpha and volume, the combat music cross-fades out over `2.5s`, the victorious piece glides onto `toSquare`, and the HUD chrome smoothly returns.
  - **Non-Looping Combat Music & Strictly `+15%` Volume Calibration (`AudioListener.js` — `v0.3.66`)**:
    - `combatAudioEl.loop` is set to `false` and `COMBAT_CUE_POINTS_S = [0.0, 8.0, 15.5]` guarantees at least `14.0s` of continuous forward orchestral music before the `30.77s` `assets/audio/combat-suspense.mp3` track ends (`cueS + 13.5 <= 29.5s`), eliminating mid-battle wrap-arounds or phrase repeats during the `10.0s` battle (`+ 3.5s` outro).
    - `COMBAT_MUSIC_PEAK_VOLUME` is calibrated to **strictly `+15%` (`1.15×`)** above `NORMAL_MUSIC_VOLUME` (`0.276` vs `0.24`), and the fallback procedural sequencer (`_stepCombatSequencer`) is through-composed over 102 steps (`10.0s`) without looping.
- **Bespoke Signature Choreography Highlights**:
  - **King Riccardo ("Papino" `k`) — 6 Distinct Dungeons & Dragons (D&D) Spells (`k_x_*`)**:
    - `k_x_p` (vs Pawn Puffin): **D&D Fireball (`fireball`, 8d6 + Natural 20 d20)** 🔥🎲
    - `k_x_n` (vs Knight Seby): **D&D Chain Lightning (`chain_lightning`)** ⚡⛓️
    - `k_x_b` (vs Bishop Ale): **D&D Meteor Swarm (`meteor_swarm`, 9th-level)** ☄️🌋
    - `k_x_r` (vs Rook Pupurabbu): **D&D Summon Greater Comic Daemon (`summon_comic_daemon`, chubby red baby Balor with toy pitchfork & pizza slice)** 😈🍕
    - `k_x_k` (vs Rival King Riccardo): **D&D Disintegrate (`disintegrate`, 10d6+40 emerald laser ray turning the rival King into green arcane dust)** 🟢✨
    - `k_x_q` (vs Queen Kate): **D&D Vampiric Kiss of Death & Gothic Blight (`kiss_of_death_blight`, throne-free moonlit chessboard where King Riccardo blows a Black Rose Kiss of Death and Queen Kate withers into an ashen-pale lifeless gothic figurine)** 💋🥀💀
  - **Knight Seby vs Pawn Puffin (`n_x_p`) — Saint Seiya "Sacro Acquarius & Teca di Ghiaccio Eterno"**:
    - Seby (`n`) starts with both hands clasped high above his head shouting *"Per il Sacro Acquarius!"* while the Pawn Puffin on the right is completely fine (`n_x_p_start.png`); next, the translucent Aquarius Maiden (`Fanciulla dell'Acquario`) materializes behind Seby with her Golden Amphora (`Anfora d'Oro`), shoots a freezing stream of water across the board, and gradually petrifies the Puffin into a pale cyan-blue translucent figure sealed deep behind the front wall of a diamond-blue Ice Coffin (`n_x_p_end.png`, `sacro_acquarius_ice_coffin`).
  - **Bishop Ale vs Queen Kate (`b_x_q`) — Saint Seiya "Teca Sacra di Tanzanite Blu-Viola"**:
    - Inspired by Saint Seiya's Amethyst Coffin and using Queen Kate's favourite gemstone (**Tanzanite** — pleochroic blue-violet with electric azure-blue reflections): Ale (`b`) casts a swirling blue-violet and azure Tanzanite beam (`b_x_q_start.png`) that crystallizes a towering translucent hexagonal Tanzanite Crystal Case (`Teca di Tanzanite`) around Mamma Kate (`q`), holding her safely petrified inside for two seconds before gently sliding the intact Tanzanite Teca into the emerald swamp moat (`b_x_q_end.png`, `ale_tanzanite_coffin_for_mom`) without ever shattering his mom.
  - **Knight Seby ↔ Rook Pupurabbu (`n_x_r`, `r_x_n`) — Best-Friends Cuddle (`mega_cuddle_bounce`)**: Non-lethal joyful cuddle storm with 3D purple hearts.
- **Unified Heroes POV Cinema (`./showcase/?view=pov` — `v0.3.64`)**:
  - All backstage character & battle movie browsing is unified into a **single entry point (`🎬 Cinema Eroi POV` / `🎬 Heroes POV Cinema` -> `./showcase/?view=pov`)** accessible from the top bar (`#hud-top-gallery-link`), the bottom dock (`#hud-dock-gallery` with `POV` badge), and the startup match setup modal (`#hud-setup-pov-link` / `#hud-setup-desktop-pov-link`).
  - Redundant in-app 6×6 matrix buttons (`#hud-matrix-btn`, `#hud-matrix36-btn`) and the legacy Mode 2 WOW inspector toggle (`#hud-mode1-btn`, `#hud-mode2-btn`) are removed from the HUD so players always land directly in the POV Cinema view (hero selector at the top defaulting to Knight Seby `'n'`, 3D turntable + voice soundboard on the top-left, main 16:9 cinema player on the top-right, and the 6 Attack [Red Risiko] + 6 Defense [Blue Risiko] movies at the bottom).

## Mobile Simplified UX ("Easy Adopter" Mode — v0.3.22)

- **Strictly Scoped to Mobile Phones (`isMobilePhoneViewport`)**: Activated only when `Math.min(width, height) < 600 && Math.max(width, height) <= 1024` (or via `?mobile=1`, disabled via `?desktop=1`/`?mobile=0`). iPads (`768×1024`) and Desktop viewports remain **100% untouched**.
- **Portrait ➔ Landscape Friendly Prompt (`#hud-rotate-overlay`)**: When a phone is held in Portrait (`height > width`), a friendly overlay invites the player to rotate the phone to Landscape so 16:9 battle movies and the 3D board fill the screen horizontally, with a 1-tap escape button (`📱 Play in vertical anyway →` / `📱 Gioca comunque in verticale →`) in case OS rotation lock is active.
- **1-Tap Quick Start Card (`#hud-mobile-quick-setup`)**: Replaces the 8-input desktop setup form on phones with a 1-screen Quick Start card: **Guest (`ospite`, Papino's Carlesso Team) vs Computer (`classic` Rivals)**, 3 mode pills (`🤖 Easy`, `🧠 Medium`, `👥 2P`), and a giant **`▶️ PLAY NOW! ✨` / `▶️ GIOCA SUBITO! ✨`** button (with an optional `"⚙️ Advanced options"` toggle).
- **Progressive Camera Onboarding (`Alto-Basso` ➔ `3D` on First Attack) & Portrait Aspect Framing**:
  - On mobile phones, the match starts in **Easy Top-Down (`Alto-Basso`)** camera mode (`topDownCamera = true`) so all 64 squares are large and effortless to tap for opening moves.
  - In Portrait orientation (`height > width`), camera distance scales by `portraitScale = clamp((height / width) * 0.72, 1.0, 1.55)` (`y = 20.67` in top-down portrait, `z = 16.5` in 3D portrait) so all 8 columns (`A`–`H`) fit inside narrow vertical smartphone screens without horizontal clipping.
  - Upon the **very first capture (`BATTLE_STARTED` ➔ `BATTLE_COMPLETED`)**, the game plays the 3D brawl + 16:9 Veo cinema and **automatically unlocks and stays in full 3D panoramic mode** (`topDownCamera = false`), with a persistent 1-tap toggle (`📐 View: Top` ⇄ `🎬 View: 3D`) in the compact mobile dock.
- **Mobile Top-Bar Toggle, 1-Tap Hard Reload & Self-Healing Cache Recovery (`v0.3.52`)**:
  - Mobile phones retain the top-right `☰` toggle button (`#hud-toggle-topbar-btn`) to expand/collapse `#hud-topbar` on demand, plus a dedicated `🔄 Reload` (`#hud-top-reload-btn`) button and native Android Chrome pull-to-refresh (no `overscroll-behavior: none` on `html, body`).
  - `index.html` runs an async pre-boot check before importing `./src/main.js`: when `?nocache=1` is present or when `./VERSION` differs from `localStorage.getItem('carchess3d_boot_ver')`, it automatically unregisters stale Service Workers, purges `CacheStorage`, and refreshes all live ES modules with `{ cache: 'reload' }`.
  - `nocache.html` detaches any active `navigator.serviceWorker.controller` before running `{ cache: 'reload' }` warm-fetches (preventing an active Service Worker from re-populating the cache it just deleted) and refreshes both `./` and `./index.html`.

## Mobile & Tablet WebGL 3D Rendering Pipeline (`v0.3.31` — Pixel 10 & Galaxy Tab S10 Ultra)

- **Direct `renderer.render` Bypass for `HalfFloatType` Bloom FBOs (`main.js`, `Registry.isMobileOrTabletDevice`)**:
  - On smartphones and Android/iPadOS tablets (`isMobileOrTablet`), `EffectComposer` + `UnrealBloomPass` (which allocates 13 full-resolution `HalfFloatType` `RGBA16F` framebuffers that overflow to `NaN`/`Inf` white or trigger `webglcontextlost` on mobile GPUs such as Pixel 10's Tensor G5 / PowerVR DXT) is bypassed by default in favor of direct `renderer.render(scene, camera)` with `ACESFilmicToneMapping` and an explicit `#0b1528` clear color (overrideable via `?bloom=1`).
- **Elimination of Hidden Transmission FBOs (`VFXPoolView.js`)**:
  - Replaced `MeshPhysicalMaterial({ transmission: 0.65 })` on gem shards with `MeshStandardMaterial({ transparent: true, opacity: 0.84 })` so Three.js never spawns a hidden full-screen multisampled `HalfFloatType` `_transmissionRenderTarget` pass on mobile GPUs.
- **Mobile Lite 3D Piece Mode (`PieceView.js`, `Registry.shouldUseMobileLite3D`)**:
  - On smartphones (`isMobilePhone`), `PieceView` defaults to **Mobile Lite 3D Mode** (`mobileLite3D = true`, overrideable with `?glb=1` for full `.glb` models or `?lite3d=1` on any device): renders the sculpted 3D Faction Pedestals, 3D Columns, Double-Sided 2D Cutie Portrait Medallions, and 3D Role Crowns (plus 3D Stone Warriors for Classic/Stone sets) in `< 15 ms` without downloading or cloning `30 MB` / `850,000` vertices of `.glb` meshes.
  - Custom `onBeforeCompile` vertex shaders (`injectLocomotionShader`) are skipped on mobile/tablet GPUs unless `?shaders=1`, and `syncPiecesFromManager()` deduplicates identical board/faction signatures so startup only builds the 32 pieces once.
- **Action Item — Mobile `LOD1` `.glb` Downsampling (`10×–20×` Polygon & Texture Reduction)**:
  - **Problem**: Desktop `.glb` characters (`assets/models/*.glb`) weigh `2–5 MB` each with `50k–97k` triangles and `2048×1024` / `2048×2048` uncompressed RGBA textures (`~850,000` triangles and `~180 MB` VRAM across all 32 pieces on the board), whereas on a `6.3"` smartphone screen each chess piece occupies only `~60×90` physical pixels (causing `15–20` sub-pixel triangles per screen pixel).
  - **Planned Solution (`assets/models/mobile/*.glb`)**: Generate a dedicated mobile `LOD1` asset set downsampled by **`10×–20×`** in triangle count (`~3,000–5,000` tris for heroes, `~1,500` tris for pawns via Quadric Error Metric decimation) and **`4×–16×`** in texture area (`512×512` WebP/JPEG baked atlas, `~150–300 KB` per `.glb`), and have `PieceView` load `assets/models/mobile/<piece>.glb` automatically on `isMobilePhone` so smartphones render the full 3D sculpted characters at `60 fps` with `< 5 MB` total download and `< 15 MB` VRAM.

## Visual Piece Recognition, True Obsidian vs Ivory Contrast & 5-Mode Clarity Engine (`v0.3.52` → `v0.3.74` — GHI #32)

- **Root Causes Addressed (`src/views/PieceClarityHelper.js`, `src/views/PieceView.js`)**:
  1. **Black Pedestal Top Plate (`topCyl`)**: Replaced legacy ice-white/silver (`0xdce7f7`) on the Black pedestal top face (`y = 0.18..0.22m`) with **Deep Matte Obsidian (`0x0d1017`, roughness `0.36`, metalness `0.12`)** and side trim rings in **Burnished Dark Steel (`0x4e5d6c`)** + **Cobalt-Violet (`0x7c4dff`)**, while White pedestals use **Warm Ivory Marble (`0xfffdf5`)** + **Gleaming Royal Gold (`0xffca28`)**. Pawns (`p`) use a `0.86×` pedestal radius for immediate footprint differentiation.
  2. **Black `.glb` Albedo & Shader Ivory Clamp (`applyBlackTeamGlbContrast` + `uIsBlackObsidian`)**: Darkens textured Black `.glb` models (`0x48506a`, `emissive = 0x140c2e`, `emissiveMap = null`), maps untextured `faction_primary` to `0x0d1017` and `faction_trim` to `0x7c4dff`, and clamps baked-in `.glb` bottom plinths (`vNormY < 0.15`) and high-luminance texels (`luma > 0.65`) in `injectLocomotionShader`.
  3. **Single Head-Juxtaposed Sculpted 3D Role Crowns (`S2` Default in 3D, `computeGroundedHeadAnchor`)**:
     - All 22 `.glb` models are kept free of duplicate baked add-on geometry (`tools/model-pipeline/bake_universal_role_addons.py --strip`), and `PieceView.attachGlbToPiece` computes the exact grounded 3D head apex (`computeGroundedHeadAnchor`) of each loaded `.glb` so the single `S2` 3D Role Crown is mounted inside `bodyContainer` directly on the character's head (`headTopY - 0.024m`) with zero mid-air gap and zero `BoxGeometry` cubes:
       - `k` (King): Imperial arched diadem + 8 cabochon jewels + 4 pearl arches + monde orb + flared pyramidal Cross Pattee finial.
       - `q` (Queen): Graceful 8-spire curved tiara coronet + 8 delicate proportionate pearls (`r = 0.015m`) + central sovereign jewel.
       - `b` (Bishop): Sculpted liturgical mitre (`LatheGeometry`) + lappets + tapered pastoral cross finial.
       - `n` (Knight): Corinthian warhorse crest with swept curved dorsal plume + aerodynamic bilateral side-crests.
       - `r` (Rook): Curved 6-merlon cylindrical mural crown + battlement molding.
       - `p` (Pawn): Braided circlet + Staunton finial sphere + tapered Swiss-Guard pike tip.
  4. **100% Square-Aligned `2D` Top-Cap Medallions (`y = 0.04m`) & Simplified Single-Icon Design (`A1`)**:
     - Pressing **`📐 2D`** (`#hud-top-btn`, `topDownCamera = true`) automatically toggles ON the 2D top-cap medallions (`showZenith2dDisc = true`) in any active clarity mode (`s1..s5`) and hides them when returning to `3D`.
     - Each `Zenithal2DClassicDisc` sits at **board level (`y = ZENITH_DISC_BOARD_Y = 0.04m`, identical across all 6 piece types)** while the 3D piece body/pedestal is hidden in 2D mode, eliminating height-dependent perspective parallax so every medallion sits 100% dead-center inside its square (`a1..h8`).
     - By default (`showRoleLetters = false`), each 2D medallion renders **ONLY ONE large, dead-centered classic chess icon (`♚ ♛ ♜ ♝ ♞ ♟`)** with no letters; an optional accessibility toggle (`#hud-setup-letters-toggle` / `?letters=1` / `?braille=1`) adds role letters + Braille (`K ⠇`, `Q ⠟`, `R ⠗`, `B ⠃`, `N ⠝`, `P ⠏`).
- **5 Combinable Clarity Modes (`?clarity=s2|s1|s3|s4|s5|off`, Default `s2`) & HUD Selector (`#hud-clarity-btn`)**:
  - **`s2` (Default 3D — Head-Mounted 3D Crowns/Crests + Obsidian Contrast)**: In 3D, keeps ONLY True Matte Obsidian vs Warm Ivory contrast + the single head-juxtaposed 3D role crown (`k, q, b, n, r, p`), with zero floating 2D badges; pressing `📐 2D` toggles the square-aligned 2D medallions.
  - **`s1` (Zenith 2D)**: Auto-switches to square-aligned 2D tournament medallions (`♚ ♛ ♜ ♝ ♞ ♟`) when camera polar angle `< 35°` or when `📐 2D` is active.
  - **`s3` (Obsidian Contrast)**: Pure Deep Matte Obsidian vs Warm Ivory material/shader contrast without 3D crowns or 2D overlays in 3D view.
  - **`s4` (Pedestal Wreath + Crest)**: Sculpted 3D Pedestal Role Wreath (`y = 0.04..0.24m`) + compact camera-facing Floating 2D Role Crest (`THREE.Sprite`).
  - **`s5` (Hybrid Full)**: Combines `s2 + s3 + s4` at 3D/semi-high angles (`>= 20°`) and automatically switches to `s1` 2D tournament medallions when looking nearly straight down (`< 20°` or in `📐 2D` mode). Evaluated by the Blind VLM Recognizer (`scripts/critic_recognizability.py`, [`docs/clarity_vlm_report.md`](../clarity_vlm_report.md)) at **9.50 / 10**.

## 3D Camera Controls, Mouse Wheel Zoom Default, Help Modal, New-Game Guard & Solid Ruby-Marble d20 (`v0.3.74`)

- **Mouse Wheel Zoom by Default (`src/core/Registry.js` `applyWheelZoomOrOrbit`, `src/main.js`)**:
  - Scrolling the mouse wheel (`deltaY < 0` / `deltaY > 0`) **zooms in/out by default** (`trackpadTwoFingerRotate = false`), matching standard 3D camera ergonomics since left-click + drag already orbits/tilts the camera.
  - Modifier keys: `Ctrl` / `Cmd` + wheel always zooms in/out; `Shift` + wheel pans the camera target; `Alt` + wheel (or `?trackpad=rotate` / `?wheel=rotate`) orbits/tilts the camera.
  - Keyboard `+` / `=` zooms in (`_dollyIn`), `-` / `_` zooms out (`_dollyOut`), and Arrow keys orbit/tilt the camera.
- **Interactive Help & Shortcuts Guide (`H` / `?`, `#hud-help-btn`, `#hud-help-modal`)**:
  - Pressing `H`, `h`, or `?` (or clicking the `?` icon in the bottom dock) toggles a bilingual (`IT` / `EN`) 4-quadrant Help & Controls cheat-sheet covering **Mouse & Trackpad 3D Camera**, **Keyboard Shortcuts (`H/?`, `+/-`, `Arrows`, `R`, `V`, `F`, `C`, `D`, `M`, `Space/Enter/Esc`, `~`)**, **Bottom Action Dock Icons**, and **Carlesso Family Lore & Tips**.
- **New Game Confirmation Modal (`🔄 Nuova`, `#hud-new-btn` → `#hud-confirm-new-modal`)**:
  - Clicking `🔄 Nuova` (`#hud-new-btn`) no longer wipes an active game immediately; instead it opens `#hud-confirm-new-modal` (`requestNewGame()`) asking for confirmation (`🔄 Sì, ricomincia da capo` / `Enter` vs `↩️ Annulla (continua partita)` / `Escape`) before calling `startNewGame()`.
- **Solid Ruby-Marble d20 (`🎲 Dado d20 Rubino`, `#hud-d20-btn`, `VFXPoolView.createRubyMarbleD20Prop`, `DropManager`)**:
  - Replaced the `0 / 12` luck progress bar in the HUD with a **Solid Ruby-Marble 20-Sided Die (`d20`)** featuring a slightly-translucent solid ruby-red marble shell (`opacity: 0.92`) over a solid deep-ruby core (`opacity: 0.98`), rose-white marble veins, silver-white bevelled edges, and crisp engraved white numerals (`1..20`).
  - Rolling on every capture (`DROP_SPAWNED`, where `golden_crit` guarantees a Natural `20` and unlocks a sticker) or on demand via clicking `#hud-d20-btn` / pressing `D` (`D20_ROLL_REQUESTED` → `D20_ROLLED`) physically tumbles and bounces the 3D 20-sided icosahedron across the chessboard (`triggerRubyD20Roll`) and animates the HUD Ruby d20 gem badge.

## Luxury Marble Chessboard & Full-Screen 180° Curved Zurich Panorama Cyclorama (`v0.3.84` → `v0.3.85`)

- **Bianco Carrara & Nero Marquina Luxury Marble Chessboard (`src/views/ZurichSwampView.js`)**:
  - The 64 chessboard squares (`1.0m × 1.0m`, `y = 0.0m`) use polished **Bianco Carrara (`0xfafbfd`, roughness `0.18`)** and **Nero Marquina (`0x111317`, roughness `0.14`)** procedural 512×512 marble textures with dark obsidian grout seams (`0x141820`) and silver-platinum altar trim (`0xcfd8dc`), eliminating the legacy yellowish-cream tiles and golden square borders.
- **Full-Screen 180° Wrap-Around Fairytale Zurich Panorama (`assets/environments/zurich_panorama.jpg`, `src/views/ZurichSwampView.js`, `src/views/VeoCinemaView.js`)**:
  - Replaced all blocky 3D primitive skyline boxes (`BoxGeometry`) and hid the legacy flat green moat circle (`EnchantedSwampMoat`) in favor of an unobstructed **full-screen 180-degree (`θ = 0 .. π`) wrap-around vertical cyclorama (`radiusX = 11.8m`, `z = -12.4m .. +2.5m`, `y = -2.95m .. -6.80m` at bottom up to `+10.85m .. +12.00m` at top, `fog: false`)** that fills **100% of the screen from top to bottom and left to right** with zero empty lower void and zero floor stretching.
  - Features the Nanobanana twilight panorama of Zurich (`Fraumünster`, `St. Peter` golden clock face, `Grossmünster Twin Towers`, `Limmat River`, `Münsterbrücke`, `Lake Zurich`, and snow-capped `Swiss Alps`), plus two Easter Eggs:
    1. **Google Zurich Hürlimann Areal (`Brandschenkestrasse 110`)**: Historic red-brick brewery & tall red-brick Hürlimann chimney tower with a glowing Google `G` beacon on the distant left hillside behind the first buildings.
    2. **`✦ MADE WITH ✦ / GEMINI 4 ARGON`**: Ornate golden cartouche mounted on the central arch of the Münsterbrücke bridge over the Limmat, positioned cleanly above the Black King & Queen crowns.
  - During normal chess play (`mode === 'idle'`, `cinemaBlend === 0`), `VeoMagicCinemaMirror` stays hidden (`visible = false`) so the 180° Zurich skyline is never obstructed, and smoothly materializes during capture battles and checkmates.

## Open Questions

- ~~Implementation repo~~ → **[palladius/carchess3d](https://github.com/palladius/carchess3d)** (public), deployed live on GitHub Pages at **https://palladius.github.io/carchess3d/**.

