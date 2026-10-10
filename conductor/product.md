# Product Definition: CarChess3D — *Carlesso al Cesso* ("Scacchi di Famiglia")

> **Forged with Argon** ✨ — Initialized and architected with Conductor SDD (Argon Edition).

## 1. Vision & Concept

**CarChess3D** (*Carlesso al Cesso* / *Scacchi di Famiglia*) is a 100% offline-playable 3D chess game tailored for the Carlesso family (**Riccardo, Kate, Ale, and Seby**). It combines the cinematic spectacle of *Wizard Chess* (dynamic camera choreography, warm torch/brazier lighting, physical shaders, debris physics, and dramatic capture animations) with the charming **"cutie / Nano Banana"** aesthetic of the family members and their magical companions, reinforced by a **16:9 3D Magic Cinema Screen** behind the board that projects **Veo-generated battle videos** during captures.

The application runs everywhere without requiring a network connection after first load (on a plane, on a laptop via `localhost`, in desktop/mobile browsers, and installable as a fullscreen PWA on Android) using **plain Three.js ES modules (zero build step)**.

## 2. 3D Environment: The Enchanted Swamp of Zurich ("Swamp-on-the-Limmat")

The chessboard rests on an ancient stone altar with golden rune engravings and family motifs, set inside a fairy-tale 3D diorama blending two worlds:
- **Foreground (The Fairy-Tale Swamp):** Glowing emerald-green water, lily pads, warm lanterns and flaming braziers (in the style of *Wizard Chess*), twisted roots, and floating fireflies.
- **Background (Zurich as the Fairy-Tale Castle-City + 3D Cinema):** Instead of a generic castle, the stylized skyline of **Zurich** rises on the horizon — the twin towers of the **Grossmünster**, the giant clock spire of **St. Peter**, the **Fraumünster**, the Limmat river, blue-and-white Zurich/Swiss banners, and snow-capped Alps in the distance. Suspended between the Grossmünster towers behind the board is a golden-framed **16:9 3D Magic Cinema Mirror** that plays Veo battle clips during captures.

## 3. Cast & Scope (v1 vs v2 Roadmap)

To prevent a quadratic explosion of battle combinations ($12 \times 12 = 144$), **v1 focuses on two playable sets** (at most $6 \times 6 = 36$ combinations), playable as either **White** (Ivory/Gold pedestal and trims) or **Black** (Obsidian/Silver pedestal and trims), including mirror matches (*Carlesso vs Carlesso*):

1. **👨‍👩‍👦‍👦 The Carlesso Family (v1 Primary Cast)**
2. **🗿 Classic Stone/Marble Wizard Chess Set (v1 Default Rival)** — Carved stone/marble warriors inspired by *Wizard Chess* that shatter into stone shrapnel on capture.
3. **🐸 Swamp Family (v2 Roadmap)** — Original fairy-tale parody (*Re Tappo, Principessa Orchessa, Fata Madrina, Principe Azzurro, Orco Brontolo, Asinelli Chiacchieroni*), deferred to v2 once the v1 6×6 matrix and Veo pipeline are complete.

### 👨‍👩‍👦‍👦 Carlesso Family Cast
| Piece | Character | Look ("Cutie / Nano Banana") | Base Attack Signature |
|---|---|---|---|
| ♔ King | **Riccardo** | Crown, ermine-trimmed royal cape, sceptre & orb | Glowing rune circle under the victim; Riccardo raises his sceptre, magic orbs/lightning strike; victim levitates, spins, and dissolves into sparkles. |
| ♕ Queen | **Kate** | Crown, royal purple gown, glasses, ash-blonde hair | A glossy milk-chocolate wave (brown/lilac palette, zero brand marks) coats the victim amid lilac confetti, melting them into a sweet puddle. |
| ♗ Bishop ×2 | **Ale (+ red dragon)** | Blue/gold mitre and robe, staff, red baby dragon on shoulder | Encases the victim in a purple crystal display case and turns them into a translucent gem (amethyst or ruby) that **shatters into hundreds of physics shards** (*Wizard Chess* style). |
| ♘ Knight ×2 | **Seby** | Silver armour, blue cape, lance, riding a wooden horse | A rain of colourful generic die-cast toy cars on an orange loop-track ring zooms around the victim, bowling them over flat ("stecchito!") with cartoon stars ✨. |
| ♖ Rook ×2 | **Pupurabbu** | Giant, super-fluffy purple/indigo monster with sweet eyes (Seby's magical companion) | Huge leap and ground-pound shockwave ring, squashing the victim flat like a pancake inside a fluffy purple poof cloud. |
| ♙ Pawn ×8 | **Swiss-Guard Puffin** | Puffin in blue/yellow/red striped uniform, morion helmet with red plume, halberd | Charges with the halberd followed by a cartoon "fish-slap" 🐟 that sends the victim spinning off the board with a *pling*! |

## 4. Dual-Layer Capture System: 3D Board Choreography + 16:9 Veo 3D Cinema

Because procedural/WebGL 3D character animations have natural fidelity limits while AI video generation excels at rich character acting, **every capture combines two synchronized visual layers**:

1. **Foreground (3D On-Board Battle Matrix — Max 6×6 `Attacker × Defender`):**
   - **Orbiting Capture Camera:** The camera swoops down and orbits around the attacking and defending 3D pieces on the board so the player sees the clash from multiple angles while keeping the **16:9 3D Cinema Screen** visible in the background.
   - **Attacker Signature + Victim Reaction:** Each attacker triggers its signature 3D effect while the victim reacts in character (Ale's dragon puffs defensive smoke and his mitre spins off; Seby's wooden horse drops spinning toy wheels; Pupurabbu squeaks like a plushie into indigo fluff; Puffin loses his morion helmet; Classic Stone pieces shatter into rock shrapnel).
   - **Bespoke Family Easter Eggs:**
     - **♘ Seby ↔ ♖ Pupurabbu (Special Best-Friends Bond 💜):** Seby and his magical companion Pupurabbu *never* hurt each other! Capturing triggers a joyful **Mega Cuddle Bounce ("SUPER ABBRACCIO PUFFOSO! 💜")** with floating hearts before the captured friend happily hops to the tray.
     - **♘ Seby ↔ ♗ Ale:** Loop-track toy cars distracting Ale's red dragon vs Ale crystallizing Seby's wooden horse mid-jump.
     - **♔ Riccardo ↔ ♕ Kate:** Golden toilet-throne (*Carlesso al Cesso*) summon vs lilac-chocolate tsunami.
   - **Temporary Physics Debris:** Shards, toy cars, chocolate drops, feathers, and stone shrapnel bounce on the board and gently fade after 3–4 seconds.

2. **Background (The 16:9 Veo 3D Cinema & MD5 Asset Pipeline):**
   - Behind the chessboard, a 16:9 3D screen (`THREE.VideoTexture`) projects a pre-generated **Veo battle movie** for that specific `(attacker, defender)` pair, providing cinematic redundancy right behind the 3D pieces.
   - **Reproducible Pipeline (`Nano Banana Composite → Veo Video`):**
     - Input 1 (`attacker_img`) + Input 2 (`defender_img`) → **Nano Banana** generates a composite battle keyframe (`composite_img`) → **Veo** animates the battle into an `.mp4` clip.
   - **Declarative MD5 Tracking (`assets/battles/manifest.yaml`):**
     - Tracks every `(attacker, defender)` pair with `attacker_img`, `attacker_md5`, `defender_img`, `defender_md5`, `composite_img`, `composite_md5`, `prompt`, `veo_video`, and `status`.
     - **`just test` Validation (`scripts/check.py`):** Automatically hashes the source images and verifies them against `manifest.yaml`. If a character's starting image changes, `just test` flags the affected battle videos as `stale` ("Hey, the source image changed — regenerate the battle video!").

## 5. UX, Game Modes & Audio

- **Special Moves & Kid-Friendly UX:**
  - **Theater / Battle Gallery Mode:** HUD modal allowing Ale and Seby to pick any Attacker × Defender combo and watch the 3D clash + Veo Cinema anytime.
  - **Magical Puffin Promotion:** Golden beam transformation with cutie portrait picker.
  - **Special Castling:** Riccardo (King) and Pupurabbu (Rook) high-five / belly-bounce swap.
  - **Magic Hint Bulb:** One-tap move suggestion for kids.
- **Profiles & Game Modes:**
  - **2P Hot-Seat** and **vs CPU** (Web Worker: *Easy* capture-loving, *Medium* minimax d=2, *Hard* alpha-beta d=4).
  - Passwordless **"Chi gioca?"** profile selector (*Riccardo, Kate, Ale, Seby, Ospite*) with `localStorage` autosave and FEN/PGN export/import.
- **WebAudio SFX & Dual-Language Theme Song (IT 🇮🇹 / EN 🇬🇧):**
  - Procedural WebAudio SFX + comic impact bubbles (*"STECCHITO!"*, *"PUFFIN SLAP! 🐟"*, *"SUPER HUG! 💜"*).
  - **Lyria 3 Theme Song ("Ale & Seby, Eroi della Scacchiera / Heroes of the Board"):** Two loopable MP3 tracks (Italian and English vocals celebrating Ale, his red dragon, Seby, his race cars, and Pupurabbu) with a procedural WebAudio fallback.
