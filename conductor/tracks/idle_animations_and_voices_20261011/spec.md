# Track Specification: Living Idle Animations & Hover/Select Character Voices (`idle_animations_and_voices_20261011`)

## 1. Overview & Motivation
Even when no move or capture is currently executing on the chessboard, the 32 pieces on the altar should feel **alive, organic, and responsive**:
1. **Living Per-Character 3D Idle Animations (`Idle` on the board)**:
   - Every character type (`k`, `q`, `b`, `n`, `r`, `p`) runs a continuous, distinct, non-robotic idle loop with a per-piece randomized phase offset (`idlePhase`) so the 32 pieces never move in stiff unison:
     - **Knight Seby (`n`)**: His golden warhorse gently steps/trots in place (`pawing hooves`), bobs its head, swishes its tail, and Seby's blue cape flutters softly.
     - **Pawn Puffin (`p`)**: Fluid, cute penguin/puffin body sway (`waddle-breathing`), rhythmic tail-feather wag (`tailWag`), subtle head tilt, and halberd/fish bob.
     - **Bishop Ale (`b`)**: His red shoulder dragon flaps its wings (`Idle_Track` + procedural wing/tail breathe), puffs tiny warm embers, and Ale's magic wand tip pulses with arcane light.
     - **Rook Pupurabbu (`r`)**: Squishy plush monster breathing (`scale.x/z` vs `scale.y` soft rhythm), happy ear/arm wiggle, and subtle bounce inside the purple rook tower.
     - **King Riccardo (`k`)**: Royal chest breathing, subtle golden lightning sceptre sway + orb shimmer, and occasional regal nod.
     - **Queen Kate (`q`)**: Poised royal breathing, elegant sceptre-wand float, and subtle glasses/coronet sparkle.
2. **Hover Creature SFX + Reactive Micro-Emote**:
   - Moving the pointer over any piece on the board (`PIECE_HOVERED`) triggers:
     - A reactive visual micro-emote (happy perk-up / head turn / glow ring) on the hovered piece.
     - A characteristic **creature / character hover sound effect** (with an `800ms` anti-spam cooldown per hover change):
       - **Seby (`n`)**: Horse *snort / whinny-puff* + hoof tap (`🐴 Snort!`).
       - **Ale (`b`)**: Magical whistle *"fiuuu"* + dragon wing flutter (`🐉 Fiuu!`).
       - **Puffin (`p`)**: Cute high-pitched puffin *peep-squeak* (`🐧 Piu-piu!`).
       - **Pupurabbu (`r`)**: Squishy plush *boing-purr* (`👾 Boing!`).
       - **Kate (`q`)**: Subtle royal crystal chime + amused *"Hmm..."* (`♕ Chime`).
       - **Riccardo (`k`)**: Warm royal sceptre hum + throat-clear (`♔ Zzt-hum`).
3. **Selection Spoken Voice Lines (`Chirp 3 HD / Gemini TTS` MP3s + WebSpeech/WebAudio Fallback) + 3D/HUD Speech Bubble**:
   - Clicking/selecting a piece (`PIECE_SELECTED`) plays its iconic spoken voice line from pre-generated `.mp3` assets in `assets/audio/voices/<piece>.mp3` (with automatic `window.speechSynthesis` / procedural WebAudio fallback) and displays a floating comic speech bubble above the piece:
     - **Knight Seby (`n`, Italian child/boy voice)**: *"Dimmi papino!"*
     - **Bishop Ale (`b`, Italian enthusiastic boy voice)**: *"Agli ordini, Signore!"*
     - **Queen Kate (`q`, sarcastic British `en-GB` female voice)**: *"This is an interesting choice..."*
     - **Pawn Puffin (`p`, super-cute high-pitched Italian voice)**: *"Piu piu! Guardia Puffin pronta, capi!"*
     - **King Riccardo (`k`, warm Italian dad king voice)**: *"Avanti tutta! Carlesso al comando!"*
     - **Rook Pupurabbu (`r`, bubbly cuddly Italian plush voice)**: *"Pupurabbu pronto al super rimbalzo!"*

---

## 2. Functional Requirements

### FR-1: Per-Character Living Idle Loops (`src/utils/SkeletonRigHelper.js` & `src/views/PieceView.js`)
- Enhance `SkeletonRigHelper.updateRig(rig, dt)` and `PieceView.update(dt)` so every piece (`k, q, b, n, r, p`) executes a multi-part organic idle animation when `rig.mode === 'idle'`:
  - **Knight (`n`)**: Alternating front-hoof pawing (`legFL` / `legFR` stepping in place), horse head nod, tail swish, and rider torso breathing.
  - **Pawn (`p`)**: Fluid S-curve body sway (`roll` + `yaw`), rapid cute tail-feather wag (`tailWag`), wing/arm flutter, and halberd bob.
  - **Bishop (`b`)**: Skeletal `Idle_Track` mixer blended with shoulder-dragon wing flap, wand-arm gentle wave, and glowing wand tip pulse.
  - **Rook (`r`)**: Elastic squash-and-stretch plush belly breathing (`1 + sin(t)*0.045`), arm wave, and joyful rock.
  - **King (`k`) & Queen (`q`)**: Regal breathing, sceptre/wand levitation sway, and cape/gown shimmer.
- Add a reactive **Hover Perk-Up (`setHovered(square)`)** in `PieceView` so the currently hovered piece perks up (`y` hop + gentle tilt toward camera + pedestal rim glow).

### FR-2: Hover Event & Anti-Spam Cooldown (`src/views/BoardInteractionView.js`)
- Track the currently hovered piece square in `BoardInteractionView._onPointerMove`.
- When pointer enters a piece (`square !== this._lastHoveredPieceSquare`), emit `PIECE_HOVERED` on `GameEventBus` with `{ square, piece: { type, color }, worldPos }` and notify `pieceView.setHoveredSquare(square)`.
- Enforce a clean cooldown (`>= 650ms` between hover audio triggers) so sweeping the mouse rapidly across the board feels playful and never spammy.

### FR-3: Pre-Generated Voice Line Assets + Procedural Creature SFX (`assets/audio/voices/` & `src/listeners/AudioListener.js`)
- Generate authentic `.mp3` voice clips under `assets/audio/voices/`:
  - `voice-n.mp3`: *"Dimmi papino!"* (Seby)
  - `voice-b.mp3`: *"Agli ordini, Signore!"* (Ale)
  - `voice-q.mp3`: *"This is an interesting choice..."* (Kate, British `en-GB` sarcastic delivery)
  - `voice-p.mp3`: *"Piu piu! Guardia Puffin pronta!"* (Puffin, cute pitch-shifted voice)
  - `voice-k.mp3`: *"Avanti tutta! Carlesso al comando!"* (Riccardo)
  - `voice-r.mp3`: *"Pupurabbu pronto al super rimbalzo!"* (Pupurabbu)
- In `AudioListener.js`:
  - Subscribe to `PIECE_HOVERED`: synthesize the character-specific creature sound (`playHoverCreatureSfx(pieceType)` — horse snort, whistle *fiuu*, puffin *piu-piu* squeak, plush *boing*, crystal chime, sceptre hum).
  - Subscribe to `PIECE_SELECTED`: play the pre-loaded `assets/audio/voices/voice-${type}.mp3` (with pitch/rate personality and `speechSynthesis` fallback if offline/blocked) + emit/display the character's spoken quote.

### FR-4: Floating Speech Bubble on Piece Selection (`src/listeners/HudListener.js`)
- When `PIECE_SELECTED` fires, display a cute non-intrusive floating comic speech pill (`💬 Seby: "Dimmi papino!"`, `💬 Kate: "This is an interesting choice..."`) near the HUD status / piece toast for `2.2s`.

---

## 3. Acceptance Criteria
1. All 32 pieces visibly move in place with character-specific organic idle animations even when no turn is being played (`Knight` horse steps in place, `Puffin` sways fluidly & wags tail, `Ale` dragon flaps wings, `Pupurabbu` breathes squishily).
2. Hovering a piece with the mouse triggers its distinct creature SFX (`snort`, `fiuu`, `peep`, `boing`) and a visual perk-up animation.
3. Selecting/clicking a piece plays its spoken voice line (`"Dimmi papino!"`, `"Agli ordini Signore!"`, `"This is an interesting choice..."`, cute Puffin line) and shows the speech bubble.
4. `just test` and `just provenance` pass 100% with zero regressions.
