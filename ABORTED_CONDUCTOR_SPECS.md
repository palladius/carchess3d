# 🏰🚽 CarChess3D: Specifications & Design Decisions (Conductor Handoff)

> **Status:** Scaffolding paused / aborted locally. Saved here for handoff to `gemini40` or another machine.
> **Date:** October 9, 2026
> **Project:** `carchess3d` (Carlesso al Cesso)
> **Stack:** Vanilla Three.js ES modules, zero build step, vendored dependencies, offline PWA.

---

## 1. High-Level Concept & The Two Core Modes

The user defined two distinct modes for the application:

### Mode 1: Game Mode (Playable 3D Chessboard)
* **Full 32 Pieces on Board**: Traditional 8x8 chessboard setup at game start (White/Gold team vs Black/Obsidian team).
* **Interactive & Rotatable**:
  * Full 360° orbit camera controls, pinch/scroll zoom, board orientation flip.
  * Click, select, and rotate pieces on demand.
* **Full Cartoon Juice & VFX**:
  * Parabolic jump arc moves with squash-and-stretch physics on landing.
  * Tile hover ripples and glowing target move indicators.
  * Explosive capture effects with comic dust bursts, spark particles, and subtle camera shake.
  * Comic reaction badges / pop-ups ("BAM!", "CHECK!").
* **Environment Atmosphere**:
  * Royal cartoon hall / toilet-throne sanctuary.
  * Dramatic stage spotlights, soft contact shadows, floating magical dust motes, subtle bloom.

### Mode 2: 3D WOW Mode (Interactive Showcase & Battle Arena)
* **Character Gallery (Turntable Inspector)**:
  * Close-up 3D inspection for all family characters (`Ale`, `Seby`, `Puffin`, `Riccardo`, `Kate`, `Pupurabbu`).
  * **Auto-rotate toggle**: All characters can rotate automatically on pedestals.
  * **Interactive manual rotation**: Click and drag to orbit and rotate characters freely in 360°.
  * **Animation triggers**: Play Idle, Attack, Dragon Fire Breath, Wing Flap, Emote/Victory animations.
* **Action Arena (Vignette Stage / Interactions)**:
  * Showcase pairwise combat interactions between characters (e.g. *Knight defeats Tower / Rook* with a unique cartoon animation sequence).
  * Cinematic framing with attacker & defender interaction vignettes.

---

## 2. Character Roster & 3D Piece Strategy

| Piece | Character | Asset Status | Current 3D Solution for Demo |
|---|---|---|---|
| ♔ **King** | Riccardo (Toilet-Throne) | 2D art (`king-riccardo-{1,2}`) | Stylized 3D pedestal + double-sided 2D circular portrait disc |
| ♕ **Queen** | Kate | 2D art (`queen-kate-{1..5}`) | Stylized 3D pedestal + double-sided 2D circular portrait disc |
| ♗ **Bishop** | Ale (+ red baby dragon) | 3D GLB ready | 🟢 `assets/models/bishop-ale-rigged.glb` (Rigged, wings gliding, fire breath) |
| ♘ **Knight** | Seby | 2D art (`knight-seby-{1..5}`) | Stylized 3D pedestal + double-sided 2D circular portrait disc |
| ♖ **Rook** | Pupurabbu | 2D art (`rook-pupurabbu`) | Stylized 3D pedestal + double-sided 2D circular portrait disc |
| ♙ **Pawn** | Puffin Guards | 3D GLB ready | 🟡 `assets/models/pawn-puffin.glb` (TRELLIS 3D model) |

> **Strategy for the 32 pieces:** For the demo, use fully modeled GLBs for Bishop Ale and Puffin pawns. For King, Queen, Knight, and Rook, use elegant procedural 3D chess pedestals topped with circular double-sided billboard portraits using the canonical art in `assets/characters/` until their GLBs are generated.

---

## 3. Architecture Blueprint (Niccolò Game Design)

The repository includes a design system in `.agents/skills/niccolo-game-design/`:

* **No God Object**: Split responsibilities into focused managers (≤ 300 LOC):
  * `GameFlowManager`: State machine (`Menu` → `GameMode` ⇄ `WowMode` → `GameOver`).
  * `BoardMapManager`: Owns the 8x8 grid, piece positions, valid move calculations, win/lose condition detection.
  * `PieceManager`: Manages the 32 piece instances, GLB loader caching, and pedestal generation.
  * `CombatAnimationManager`: Orchestrates capture sequences and 3D WOW Mode battle vignettes.
  * `VFXManager`: Particle systems (dust motes, capture explosions, spark rings, tile highlights).
* **Typed Event Bus**: Decouple logic from rendering. Visuals and audio subscribe to game events (`PIECE_SELECTED`, `MOVE_EXECUTED`, `PIECE_CAPTURED`, `CHECKMATE`).
* **Headless Simulation**: Rules run without Three.js dependency; Three.js acts strictly as the visual representation adapter.

---

## 4. Uncommitted Local Working State

When resuming on `gemini40`, note that the following files were in progress locally:
- Staged:
  - `assets/models/bishop-ale-2.glb`
  - `assets/models/bishop-ale-rigged.glb`
  - `docs/3dgames.md`
  - `.agents/skills/niccolo-game-design/`
- Unstaged:
  - `CHANGELOG.md`
  - `README.md`
  - `VERSION`
  - `justfile`
  - `tools/model-pipeline/RUNNING_DOC.md`
  - `docs/3dgames.md`
