# Product Guidelines: CarChess3D — *Carlesso al Cesso*

> **Forged with Argon** ✨ — Brand, UX, and Engineering Guidelines (Argon Edition).

## 1. Brand Identity, Voice & Tone

- **Playful Family Warmth:** The game is a love letter to the Carlesso family (**Riccardo, Kate, Ale, and Seby**). Every interaction should feel celebratory, humorous, and welcoming to both kids and adults.
- **Bilingual First (IT 🇮🇹 / EN 🇬🇧):**
  - **Italian** is the default language, rich with family catchphrases (*"Carlesso al Cesso!"*, *"Stecchito!"*, *"Super Abbraccio Puffoso! 💜"*, *"Ciocco-Onda!"*, *"Puffin Slap! 🐟"*).
  - **Instant Language Toggle (`IT 🇮🇹 | EN 🇬🇧`)** in the top HUD bar switches all UI labels, comic impact bubbles, and the theme song vocals (**"Ale & Seby, Eroi della Scacchiera"** ↔ **"Ale & Seby, Heroes of the Board"**).
- **Zero-Violence Slapstick:** Battles are cartoon spectacles. Pieces are flattened like pancakes, crystallized into gems, spun off with a fish-slap, or showered with cuddles (**Seby ↔ Pupurabbu** never hurt each other!).

## 2. Visual Design ("Cutie meets *Wizard Chess*")

- **The Contrast Aesthetic:**
  - **Environment & HUD:** Inspired by *Wizard Chess* — dark translucent obsidian-and-gold floating HUD bars, glowing golden runes around the board border, warm flickering braziers, emerald swamp water, and the fairy-tale skyline of **Zurich** (*Grossmünster, St. Peter, Fraumünster, Limmat, Alps*).
  - **Characters:** High-saturation, glossy **"cutie / Nano Banana"** toy proportions mounted on clear faction pedestals (**Ivory & Gold** for White, **Obsidian & Silver** for Black) so board readability is never compromised.
- **Dual-Layer Capture Spectacle (3D Board + 16:9 Veo Cinema):**
  - During captures, the camera orbits the two clashing 3D pieces on the board while framing the **16:9 3D Magic Cinema Mirror** suspended behind the board, which projects the pre-rendered **Veo battle video** (`THREE.VideoTexture`).
  - Any capture animation (3D + Veo video) must last **2–4 seconds** and be **immediately skippable** via a single tap, click, or `Space`/`Escape`.
  - Temporary 3D physics debris (crystal shards, miniature cars, chocolate drops, feathers, stone shrapnel) bounces on the board and gently fades after 3–4 seconds.

## 3. Kid-Friendly UX Principles (Designed for Ale & Seby)

- **Theater / Battle Gallery Mode (`🎬 Battle Cinema`):** A dedicated button in the HUD lets Ale and Seby pick any Attacker × Defender pair and trigger the 3D battle + Veo Cinema on demand without waiting for that capture in a live game.
- **Magic Hint Bulb (`💡 Suggerimento`):** One tap highlights a recommended legal move with a sparkling trail so younger players never feel stuck.
- **Special Move Celebrations:**
  - **Castling (Arrocco):** Riccardo (King) and Pupurabbu (Rook) perform a celebratory high-five / belly-bounce swap.
  - **Pawn Promotion:** Reaching the 8th rank triggers a golden light beam and a large portrait modal showing the cutie art of Kate, Pupurabbu, Ale, and Seby.
- **Zero-Friction Profiles ("Chi gioca?"):** One-tap profile switching (*Riccardo, Kate, Ale, Seby, Ospite*) with instant `localStorage` autosave after every half-move.

## 4. Strict IP Safety & Public Repo Hygiene

- **100% Brand-Free:** Never use third-party trademarks, logos, or copyrighted character names in code, prompts, UI text, or 3D/video assets (no *Milka, Hot Wheels, Shrek, Fiona, Donkey, Duloc*, etc.). Use evocative generic terms (*glossy milk-chocolate & lilac confetti*, *die-cast toy cars on orange loop track*, *Zurich fairy-tale swamp*).
- **Zero Secrets & Zero Internal Paths:** API keys (`GEMINI_API_KEY`, `HF_TOKEN`) are passed strictly via environment variables. No internal hostnames, paths, or links may ever be committed (enforced by `scripts/check.py` via `just test`).
