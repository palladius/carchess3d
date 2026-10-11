# Implementation Plan: Living Idle Animations & Hover/Select Character Voices (`idle_animations_and_voices_20261011`)

## Phase 1: Per-Character Living 3D Idle Animations & Hover Micro-Emotes
- [x] **Task 1.1: Enrich `SkeletonRigHelper.js` with tail/wing/hoof idle joints & per-piece idle choreography**
  - [x] Write unit tests in `tests/voices_idle.test.mjs` verifying that `createArticulatedSkeletonRig` creates character-specific secondary appendages (`tail` for Pawn Puffin & Knight Seby's horse, `leftWing`/`rightWing` for Bishop Ale's shoulder dragon) and that `updateSkeletonRigPose` animates distinct idle patterns in living idle mode (Knight horse stepping in place, Puffin fluid body sway & tail wag, Rook squishy breathing).
  - [x] Update `src/views/SkeletonRigHelper.js` to implement rich, continuous, phase-randomized idle movements for `k, q, b, n, r, p` plus a `hovered` boost state.
- [x] **Task 1.2: Wire continuous idle & hover perk-up in `PieceView.js` and `BoardInteractionView.js`**
  - [x] Update `src/views/PieceView.js` (`update(dt)` and `setHoveredSquare(square)`) so every piece on the board has a unique `idlePhase` and perks up smoothly when hovered.
  - [x] Update `src/views/BoardInteractionView.js` to detect hovered pieces on `pointermove`, call `pieceView.setHoveredSquare(square)`, and emit `PIECE_HOVERED` on `GameEventBus` (with anti-spam cooldown).
- [x] **Task 1.3: Phase 1 Verification**
  - [x] Run `just test` and verify all unit & headless tests pass.

## Phase 2: Pre-Generated Character Voice MP3s (`Gemini TTS`) + Creature Hover SFX & Speech Bubbles
- [x] **Task 2.1: Generate authentic character voice MP3s (`assets/audio/voices/voice-{k,q,b,n,r,p}.mp3`)**
  - [x] Create `scripts/generate_voice_lines.py` (`gemini-2.5-flash-preview-tts`) to generate:
    - `assets/audio/voices/voice-n.mp3` (*"Dimmi papino!"*)
    - `assets/audio/voices/voice-b.mp3` (*"Agli ordini, Signore!"*)
    - `assets/audio/voices/voice-q.mp3` (*"This is an interesting choice..."*, British `en-GB` sarcastic voice)
    - `assets/audio/voices/voice-p.mp3` (*"Piu piu! Eccomi, pronta guardia Puffin!"*, cute high-pitched voice)
    - `assets/audio/voices/voice-k.mp3` (*"Avanti tutta! Re Carlesso al comando!"*)
    - `assets/audio/voices/voice-r.mp3` (*"Boing boing! Super abbraccio Pupurabbu!"*)
- [x] **Task 2.2: Implement Hover Creature SFX & Selection Voice Playback in `AudioListener.js` & `Registry.js`**
  - [x] Add `VOICE_LINES` metadata to `src/core/Registry.js` (quote in IT/EN, audio URL, hover SFX label).
  - [x] Enhance `src/listeners/AudioListener.js` to listen to `PIECE_HOVERED` (playing procedural horse `snort`, dragon whistle `fiuu`, puffin `peep-squeak`, plush `boing`, royal chime/hum) and `PIECE_SELECTED` (playing `assets/audio/voices/voice-${type}.mp3` with WebSpeech fallback).
  - [x] Enhance `src/listeners/HudListener.js` to show a floating comic speech bubble when a piece is hovered/selected (`💬 Seby: "Dimmi papino!"`, `💬 Kate: "This is an interesting choice..."`).
- [x] **Task 2.3: End-to-End Verification, Spec Sync & Release Bump**
  - [x] Add unit tests in `tests/voices_idle.test.mjs` verifying `VOICE_LINES` registry completeness and `PIECE_HOVERED` / `PIECE_SELECTED` bus contracts.
  - [x] Update `docs/spec/SPEC.md`, `sw.js`, `VERSION`, and `CHANGELOG.md`, and run `just test && just provenance`.
