# Product Definition: CarChess3D — *Carlesso al Cesso* ("Scacchi di Famiglia")

> **Forged with Argon** ✨ — Initialized and architected with Conductor SDD (Argon Edition).

## 1. Vision & Concept

**CarChess3D** (*Carlesso al Cesso* / *Scacchi di Famiglia*) is a 100% offline-playable 3D chess game tailored for the Carlesso family (**Riccardo, Kate, Ale, and Seby**). It combines the cinematic spectacle of *Wizard Chess* (dynamic camera choreography, warm torch/brazier lighting, physical shaders, debris physics, and dramatic capture animations) with the charming **"cutie / Nano Banana"** aesthetic of the family members and their magical companions, reinforced by a **16:9 3D Magic Cinema Screen** behind the board that projects **Veo-generated battle videos** during captures.

The application runs everywhere without requiring a network connection after first load (on a plane, on a laptop via `localhost`, in desktop/mobile browsers, and installable as a fullscreen PWA on Android) using **plain Three.js ES modules (zero build step)** and the **`niccolo-game-design`** Managers + Typed Event Bus architecture.

## 2. Two Core Modes (`GameFlowManager`)

1. **Mode 1: Game Mode (Playable 3D Chessboard):**
   - Full 32 pieces on the 8×8 board (White/Ivory-Gold team vs Black/Obsidian-Silver team).
   - 360° orbit camera, pinch/scroll zoom, board orientation flip, top-down toggle, and parabolic jump arcs with *squash-and-stretch* landing physics.
   - Dual-layer capture spectacle (3D on-board battle + 16:9 background Veo Cinema) with comic pop-ups (*"BAM!"*, *"STECCHITO!"*, *"PUFFIN SLAP! 🐟"*).
2. **Mode 2: 3D WOW Mode (Interactive Character Gallery & Battle Arena — supersedes `showcase/index.html`):**
   - **Turntable Character Inspector:** Close-up 360° inspection of all family characters (`Ale`, `Seby`, `Puffin`, `Riccardo`, `Kate`, `Pupurabbu`) on rotating pedestals with manual drag rotation and animation triggers (*Idle*, *Attack*, *Dragon Wing Glide*, *Click_Fire_Breath*, *Victory Emote*). Replaces the temporary `showcase/index.html` viewer directly inside the game's Mode 2 (while `docs/qa-scores.yaml` remains a CLI-only QA tool via `just scores` / `just shittest`).
   - **Action Arena (Battle Cinema Stage):** Pick any `Attacker × Defender` combination and trigger the 3D clash + 16:9 Veo video on demand without waiting for that capture in a live chess match.

## 3. 3D Environment: The Enchanted Swamp of Zurich ("Swamp-on-the-Limmat")

The chessboard rests on an ancient stone altar with golden rune engravings and family motifs, set inside a fairy-tale 3D diorama blending two worlds:
- **Foreground (The Fairy-Tale Swamp):** Glowing emerald-green water, lily pads, warm lanterns and flaming braziers (in the style of *Wizard Chess*), twisted roots, and floating fireflies.
- **Background (Zurich as the Fairy-Tale Castle-City + 3D Cinema):** Instead of a generic castle, the stylized skyline of **Zurich** rises on the horizon — the twin towers of the **Grossmünster**, the giant clock spire of **St. Peter**, the **Fraumünster**, the Limmat river, blue-and-white Zurich/Swiss banners, and snow-capped Alps in the distance. Suspended between the Grossmünster towers behind the board is a golden-framed **16:9 3D Magic Cinema Mirror** that plays Veo battle clips during captures.

## 4. Cast & Scope (v1 vs v2 Roadmap)

To prevent a quadratic explosion of battle combinations ($12 \times 12 = 144$), **v1 focuses on two playable sets** (at most $6 \times 6 = 36$ combinations), playable as either **White** (Ivory/Gold pedestal and trims) or **Black** (Obsidian/Silver pedestal and trims), including mirror matches (*Carlesso vs Carlesso*):

1. **👨‍👩‍👦‍👦 The Carlesso Family (v1 Primary Cast)**
2. **🗿 Classic Stone/Marble Wizard Chess Set (v1 Default Rival)** — Carved stone/marble warriors inspired by *Wizard Chess* that shatter into stone shrapnel on capture.
3. **🐸 Swamp Family (v2 Roadmap)** — Original fairy-tale parody (*Re Tappo, Principessa Orchessa, Fata Madrina, Principe Azzurro, Orco Brontolo, Asinelli Chiacchieroni*), deferred to v2 once the v1 6×6 matrix and Veo pipeline are complete.

### 👨‍👩‍👦‍👦 Carlesso Family Cast & Current 3D Asset Status
| Piece | Character | 3D / 2D Asset Status | Base Attack Signature |
|---|---|---|---|
| ♔ King | **Riccardo** | `king-riccardo-{1,2}.jpg` + turnaround in `tools/model-pipeline/king/` (3D pedestal + portrait medallion until GLB) | Glowing rune circle under the victim; Riccardo raises his sceptre, magic orbs/lightning strike; victim levitates, spins, and dissolves into sparkles. |
| ♕ Queen | **Kate** | Canonical `tools/model-pipeline/kate/final_queen_canonical/kate_final_v1_nb21.png` (emerald eyes, navy glasses, royal purple gown) | A glossy milk-chocolate wave (brown/lilac palette, zero brand marks) coats the victim amid lilac confetti, melting them into a sweet puddle. |
| ♗ Bishop ×2 | **Ale (+ red dragon)** | ✅ `bishop-ale-1.glb` (with mitre hat 🏆 on board) + `bishop-ale-rigged.glb` (26-bone animated dragon for Mode 2 WOW Turntable & fire-breath attack) | Encases the victim in a purple crystal display case and turns them into a translucent gem (amethyst or ruby) that **shatters into hundreds of physics shards** (*Wizard Chess* style). |
| ♘ Knight ×2 | **Seby** | 360° turnaround views + **HUD 4-Weapon Switcher** (`👊 Scary Unarmed`, `⚔️ Epic Excalibur`, `🔵 Lightsaber`, `🚩 Long Lance`) in `tools/model-pipeline/seby/` | A rain of colourful generic die-cast toy cars on an orange loop-track ring zooms around the victim, bowling them over flat ("stecchito!") with cartoon stars ✨. |
| ♖ Rook ×2 | **Pupurabbu** | `rook-pupurabbu.jpg` + turnaround in `tools/model-pipeline/rook/` (3D pedestal + portrait medallion until GLB) | Huge leap and ground-pound shockwave ring, squashing the victim flat like a pancake inside a fluffy purple poof cloud. |
| ♙ Pawn ×8 | **Swiss-Guard Puffin** | ✅ `pawn-puffin.glb` (TRELLIS multi-view C2: front + side + back) | Charges with the halberd followed by a cartoon "fish-slap" 🐟 that sends the victim spinning off the board with a *pling*! |

### 🎨 Faction Readability (White vs Black on Textured GLBs)
Every piece keeps its natural cutie facial colours while sitting on a **Bicolor Royal Pedestal** (**Ivory & Gold** for White vs **Obsidian & Silver** for Black) with a **glowing ground ring** and a subtle **faction rim/outfit tint shader** (warm gold vs deep obsidian-violet), making even *Carlesso vs Carlesso* mirror matches unambiguous at a glance.

## 5. Dual-Layer Capture System: 3D Board Choreography + IMAX 16:9 Veo 3D Cinema

Every capture combines two synchronized visual layers orchestrated by `CombatAnimationManager`:

1. **Foreground (3D On-Board Battle Matrix — Max 6×6 `Attacker × Defender`):**
   - **IMAX Battle Cinema World Transformation (`ZurichSwampView.setCombatCinemaMode(true)`):** During combat (`BATTLE_STARTED` / `WOW_ARENA_CLASH`), the surrounding 3D world clutter (Grossmünster towers, Zurich skyline, Swiss Alps, emerald swamp moat, corner braziers, fireflies, sky dome) hides automatically, leaving **only the 8×8 Chessboard (`CarvedStoneAltar`) and the 3D Chess Pieces** in the foreground against a dark cinema theater void (`0x05070e`), while the **16:9 Veo Cinema Screen (`VeoCinemaView`)** moves right behind the board (`(0, 2.75, -4.65)`) at near-fullscreen IMAX scale (`1.55×`, `12.4m × 7.0m`).
   - **Attacker Signature + Victim Reaction:** Each attacker triggers its signature 3D effect while the victim reacts in character (Ale's dragon puffs defensive smoke and his mitre spins off; Seby's wooden horse drops spinning toy wheels; Pupurabbu squeaks like a plushie into indigo fluff; Puffin loses his morion helmet; Classic Stone pieces shatter into rock shrapnel).
   - **Bespoke Family Easter Eggs:**
     - **♔ Riccardo ("Papino" `k`) — 6 Distinct Dungeons & Dragons (D&D) Spells (`k_x_*`):**
       - `k_x_p`: **D&D Fireball (`fireball`, 8d6 + Natural 20 d20)** 🔥🎲
       - `k_x_n`: **D&D Chain Lightning (`chain_lightning`)** ⚡⛓️
       - `k_x_b`: **D&D Meteor Swarm (`meteor_swarm`, 9th-level)** ☄️🌋
       - `k_x_r`: **D&D Summon Greater Comic Daemon (`summon_comic_daemon`, chubby red baby Balor with toy pitchfork & pizza slice)** 😈🍕
       - `k_x_k`: **D&D Disintegrate (`disintegrate`, 10d6+40 emerald laser ray turning rival King into green arcane dust)** 🟢✨
       - `k_x_q`: **D&D Flesh to Stone / Petrification + Golden Throne (`flesh_to_stone_petrification`)** 🗿🚽👑
     - **♘ Seby vs ♙ Puffin (`n_x_p`) — Saint Seiya "Sacro Acquarius & Teca di Ghiaccio Eterno":** Seby unites his hands overhead like Aquarius Camus while a celestial Water-Bearer Woman (`Fanciulla dell'Acquario`) pours freezing cosmos from a giant Golden Amphora (`Anfora d'Oro`), sealing the Puffin inside an unbreakable diamond-blue Ice Coffin (`Teca di Ghiaccio`) that crumbles into diamond-ice crystals (`sacro_acquarius_ice_coffin`).
     - **♘ Seby ↔ ♖ Pupurabbu (Special Best-Friends Bond 💜):** Seby and his magical companion Pupurabbu *never* hurt each other! Capturing triggers a joyful **Mega Cuddle Bounce ("SUPER ABBRACCIO PUFFOSO! 💜")** with floating hearts before the captured friend happily hops to the tray.
     - **♘ Seby ↔ ♗ Ale:** Loop-track toy cars distracting Ale's red dragon vs Ale crystallizing Seby's wooden horse mid-jump.
   - **Temporary Physics Debris:** Shards, diamond-ice crystals, toy cars, chocolate drops, feathers, and stone shrapnel bounce on the board and gently fade after 3–4 seconds.

2. **Background (The Near-Fullscreen 16:9 Veo 3D Cinema & MD5 Asset Pipeline):**
   - Behind the chessboard, a 16:9 3D screen (`THREE.VideoTexture`) projects a pre-generated **Veo 3.1 battle movie** for that specific `(attacker, defender)` pair (`assets/battles/videos/<atk>_x_<def>.mp4`), expanding to near-fullscreen IMAX scale (`12.4m × 7.0m`) during combat so the Veo animation is never lost in background clutter.
   - **Reproducible 2-Stage Pipeline (`Nano Banana 2.1 Initial Keyframe → Veo 3.1 Video`):**
     - Input 1 (`attacker_img` Left) + Input 2 (`defender_img` Right) + 16:9 layout reference → **Nano Banana 2.1 (`gemini-3.1-flash-image-preview`)** generates the 16:9 initial battle keyframe (`assets/battles/keyframes/<id>.png`) → **Veo 3.1 (`veo-3.1-generate-preview`)** animates the battle into an 8s 16:9 `.mp4`/`.webm` clip (`scripts/generate_nb_veo_battle.py`).
   - **Declarative MD5 Tracking (`assets/battles/manifest.yaml`):**
     - Tracks every `(attacker, defender)` pair with `attacker_img`, `attacker_md5`, `defender_img`, `defender_md5`, `composite_img`, `composite_md5`, `prompt`, `veo_video`, and `status`.
     - **`just test` Validation (`scripts/check.py`):** Automatically hashes the source images and verifies them against `manifest.yaml`. If a character's starting image changes, `just test` flags the affected battle videos as `stale` ("Hey, the source image changed — regenerate the battle video!").

## 6. UX, Game Modes & 5-Track Dynamic Lyria 3 Soundtrack

- **Special Moves & Kid-Friendly UX:**
  - **Seby Weapon Switcher (`⚔️ Arma di Seby`):** Toggle between *Scary Unarmed*, *Epic Excalibur*, *Lightsaber*, and *Long Lance* right from the HUD/WOW Mode.
  - **Magical Puffin Promotion:** Golden beam transformation with cutie portrait picker.
  - **Special Castling (Arrocco):** Riccardo (King) and Pupurabbu (Rook) high-five / belly-bounce swap accompanied by the rare medieval heraldic fanfare.
  - **Magic Hint Bulb:** One-tap move suggestion for kids.
- **Profiles & Game Modes:**
  - **2P Hot-Seat** and **vs CPU** (Web Worker: *Easy* capture-loving, *Medium* minimax d=2, *Hard* alpha-beta d=4).
  - Passwordless **"Chi gioca?"** profile selector (*Riccardo, Kate, Ale, Seby, Ospite*) with `localStorage` autosave and FEN/PGN export/import.
- **WebAudio SFX & 5-Track Adaptive Lyria 3 Soundtrack (`assets/audio/`):**
  - Procedural WebAudio SFX + comic impact bubbles (*"STECCHITO!"*, *"PUFFIN SLAP! 🐟"*, *"SUPER HUG! 💜"*).
  - **5 Lyria 3 Generated Tracks (switched dynamically by `AudioListener` on game events, with WebAudio fallback):**
    1. 🇮🇹 **`theme-it.mp3` ("Ale & Seby, Eroi della Scacchiera"):** Heroic Italian vocal anthem for Ale (red dragon) & Seby (race cars + Pupurabbu).
    2. 🇬🇧 **`theme-en.mp3` ("Ale & Seby, Heroes of the Board"):** Heroic English vocal anthem.
    3. 🌿 **`bgm-calm-swamp.mp3` (Calm Match Loop):** Relaxing, magical fairy-tale lute/harp/flute background loop played while thinking on the Zurich Swamp board.
    4. ⚔️ **`bgm-battle-clash.mp3` (Combat Capture Theme):** Dark, fast-paced cinematic orchestral percussion track that crossfades in whenever a capture animation begins!
    5. 🎺 **`jingle-castling-heraldic.mp3` (Rare Medieval Castling Fanfare):** Super-rare royal heraldic medieval trumpet & timpani fanfare triggered exclusively when Castling (*Arrocco*) is performed!
