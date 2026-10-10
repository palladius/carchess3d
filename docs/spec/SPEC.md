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
- Audio: synthesised with WebAudio (no audio files to license), mutable.

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

## Open Questions

- ~~Implementation repo~~ → **[palladius/carchess3d](https://github.com/palladius/carchess3d)** (public). Hosting (GitHub Pages vs localhost/APK) still open.
