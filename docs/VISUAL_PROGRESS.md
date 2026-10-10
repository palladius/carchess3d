# 🎨📸 CarChess3D — Growing Visual Progress Log (`docs/VISUAL_PROGRESS.md`)

> **Live HTML Gallery:** Open [`progress.html`](../progress.html) (or `http://localhost:8000/progress.html` via `just serve`) to inspect every visual milestone and play the 16:9 `.mp4` battle videos side-by-side in the browser!
> **Growing Asset Folder:** [`docs/visual-progress/`](./visual-progress/)

---

## 🐸🎬 Round 4 (v0.2.0) — Pezzi Catturati nella Palude di Shrek + 3 Video 16:9 Reali (`.mp4`/`.webm`) + Puntini Colorati Mosse Legali

### 4.1 I Pezzi Catturati Sguazzano nella Palude di Shrek (`?swamp_party=1`)
Invece di restare all'asciutto sui bordi del tavolo, ogni pezzo mangiato compie un **tuffo parabolico** dentro il fossato verde smeraldo della Palude di Shrek (Bianchi a Ovest `x = -6.2m..-7.2m`, Neri a Est `x = +6.2m..+7.2m`, `y = -0.28m`), galleggiando su una ninfea verde mentre beccheggia, oscilla e genera **anelli d'acqua verdi luminescenti** e **bollicine palustri**!

![Round 4 Swamp Party Overview](./visual-progress/round4_1_swamp_party.png)

![Round 4 Swamp Party Close-Up](./visual-progress/round4_2_swamp_closeup.png)

### 4.2 Puntini Colorati Mosse Possibili + Mirino Rosso Cattura (`?demo_moves=1`)
Quando si seleziona un pezzo sulla scacchiera (`BoardInteractionView.js`):
- **Anello d'oro luminoso** (`#ffd54f`) sotto il pezzo selezionato (qui Cavaliere Seby in `f3`).
- **Puntini 3D verde-smeraldo e giallo brillante** (`#00e676` + `#ffee58`) che pulsano su tutte le caselle libere raggiungibili (`g1`, `h4`, `g5`, `d4`).
- **Mirino rosso segmentato rotante** (`#ff3d00`) sui pezzi avversari catturabili (`e5`).

![Round 4 Legal Move Dots and Capture Ring](./visual-progress/round4_7_legal_moves_dots.png)

### 4.3 Tre Video 16:9 Reali (`.mp4` + `.webm`) per Ale & Seby senza HITL (`scripts/render_battle_videos.py`)
Architettura **Zero-HITL a 3 Livelli** in `VeoCinemaView.js`:
1. **Tier 1 (`.mp4` / `.webm` Live Video)**: Riproduce i video 16:9 `1280×720` presenti in `assets/battles/videos/`:
   - `assets/battles/videos/b_x_n.mp4` — **Alfiere Ale 🐉 vs Cavaliere Seby 🏎️** (*"CRISTALLO DRAGO BAM!"*)
   - `assets/battles/videos/n_x_b.mp4` — **Cavaliere Seby 🏎️ vs Alfiere Ale 🐉** (*"STECCHITO! PISTA TURBO!"*)
   - `assets/battles/videos/n_x_r.mp4` — **Cavaliere Seby 🏎️ 💜 Torre Pupurabbu** (*"SUPER ABBRACCIO PUFFOSO!"*)
2. **Tier 2 & 3 (Fallback Automatico Istantaneo Canvas 2D 60fps)**: Per tutte le altre 33 combinazioni `6×6` non ancora renderizzate in `.mp4`, lo Specchio 16:9 genera in tempo reale lo scontro animato a schermo diviso con ritratti, fulmini, cuori e banner fumetto senza mai bloccare il gioco o chiedere chiavi hardware!

![Round 4 MP4 Filmstrip](./visual-progress/round4_6_mp4_filmstrip.png)

![Round 4 Ale vs Seby 16:9 Video Clash](./visual-progress/round4_3_video_ale_vs_seby.png)

![Round 4 Seby vs Ale 16:9 Video Clash](./visual-progress/round4_4_video_seby_vs_ale.png)

![Round 4 Seby Cuddle Pupurabbu 16:9 Video](./visual-progress/round4_5_video_seby_cuddle_pupurabbu.png)

---

## 👑🐉 Round 3 — Full 32-Piece 3D `.glb` Roster (`9.8 / 10` Adversarial Critic Score)

Tutti i 6 personaggi della famiglia Carlesso sono stati estratti da `main` (`assets/models/{king-riccardo,queen-kate,bishop-ale-1,bishop-ale-rigged,knight-seby,rook-pupurabbu,pawn-puffin}.glb`) e collegati a `PieceView.js` e `WowModeView.js`.
- **Perché il GLB di Ale sembrava "brutto/scuro" prima?** I file `.glb` esportati da TRELLIS/trimesh omettevano `metallicFactor` nel JSON glTF. Per specifica **glTF 2.0**, `metallicFactor` omesso vale **`1.0` (100% metallo puro)**! In Three.js (`diffuseColor *= (1.0 - metalness)`), `metalness = 1.0` moltiplica il colore della texture per `0`, rendendo il modello nero/plasticoso. Forzando `mat.metalness = 0.04; mat.roughness = 0.52; mat.emissiveMap = mat.map;` in `PieceView.js`, tutte le 32 statuette 3D brillano con i loro veri colori Pixar!

![Round 3 Overview](./visual-progress/round3_1_overview.png)

![Round 3 Close-Up](./visual-progress/round3_2_closeup.png)

![Round 3 Low-Angle Grounding](./visual-progress/round3_3_lowangle.png)

![Round 3 Wireframe](./visual-progress/round3_4_wireframe.png)

![Round 3 WOW Mode Turntable](./visual-progress/round3_5_wow_mode.png)

![Round 3 Battle Clash](./visual-progress/round3_6_battle_clash.png)

---

## ✨ Round 2 — Critic Camera, Lighting & PBR Polish (`9.3 / 10`)

![Round 2 Overview](./visual-progress/round2_1_overview.png)

![Round 2 Close-Up](./visual-progress/round2_2_closeup.png)

---

## 🔍 Round 1 — Initial Baseline (`6.2 / 10` — 5 Flaws Identified & Fixed)

![Round 1 Overview](./visual-progress/round1_1_overview.png)

---

## 📐🍌 Milestones 1 & 2 — 2D Metric Spatial Blueprint (`docs/floorplan.svg`) & Nano Banana Concepts

![2D Spatial Floorplan](./visual-progress/00_floorplan.svg)

![Zurich Swamp Overview Concept](./visual-progress/01_concept_zurich_swamp_overview.png)

![Board Close-Up Concept](./visual-progress/02_concept_board_closeup.png)
