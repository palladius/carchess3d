# 🔍 CarChess3D — Visual Piece Recognition Benchmark & Blind VLM Audit (`0°` vs `30°`)

- **Benchmark Angles**:
  1. **`0°` Vertical Zenithal (`0deg`)**: Camera at `(0, 12.8, 0.01)` looking at `(0, 0, 0)`.
  2. **`30°` Semi-High (`30deg`)**: Camera at `(0, 11.08, 6.40)` looking at `(0, 0, 0)` ($\arctan(6.40 / 11.08) = 30.0^\circ$).
- **Opening Position Tested**: `1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Qe2 Qe7` (all 6 roles `K, Q, R, B, N, P` spread across center & back ranks).
- **Matchups Evaluated**: `carlesso` vs `classic`, `carlesso` vs `swamp`, and `carlesso` vs `carlesso` (Mirror Match).
- **Composite Contact Sheet**: [`docs/clarity_comparison_0deg_30deg.png`](clarity_comparison_0deg_30deg.png)

## 🏆 Leaderboard (Pixel Contrast Telemetry + Gemini VLM `gemini-flash-latest` Blind Recognizer)

| Rank | Mode | Composite (`/10`) | B/W Contrast | 0° Roles (`/10`) | 30° Roles (`/10`) | Kid Low-Fatigue | White Luma | Black Luma | Δ Luma (`W - B`) | Contrast Ratio |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 🥇 | **`s5`** — S5 (Hybrid All-In) | **9.50** | 10/10 | 10/10 | 9/10 | 9/10 | `153.98` | `73.11` | **`+80.88`** | `1.95x` |
| 🥈 | **`s1`** — S1 (Zenith 2D) | **8.50** | 9/10 | 10/10 | 7/10 | 8/10 | `157.54` | `71.98` | **`+85.56`** | `2.01x` |
| 🥉 | **`s2`** — S2 (3D GLB Add-Ons) | **8.50** | 9/10 | 8/10 | 9/10 | 8/10 | `146.07` | `61.77` | **`+84.3`** | `2.16x` |
| #4 | **`s4`** — S4 (Pedestal Wreath + Crest) | **8.50** | 9/10 | 8/10 | 9/10 | 8/10 | `139.2` | `72.41` | **`+66.79`** | `1.81x` |
| #5 | **`s3`** — S3 (Obsidian Contrast) | **5.25** | 6/10 | 4/10 | 6/10 | 5/10 | `137.26` | `64.8` | **`+72.46`** | `1.98x` |
| #6 | **`off`** — Off (Baseline) | **5.00** | 5/10 | 4/10 | 7/10 | 4/10 | `115.31` | `96.61` | **`+18.71`** | `1.22x` |

## 🇮🇹 Critiche Avversarie per Soluzione (`off`, `S1..S5`)

### 1. `s5` — S5 (Hybrid All-In) (Score: **9.50/10**)
- **Descrizione**: Hybrid Champion: Obsidian + 3D Add-Ons + Wreath + Crest + Auto-2D Zenith
- **Ruoli riconosciuti a 0° (Zenitale)**: `King, Queen, Rook, Bishop, Knight, Pawn`
- **Ruoli riconosciuti a 30° (Semi-Alta)**: `King, Queen, Rook, Bishop, Knight, Pawn`
- **Telemetria Mirror Match (`carlesso` vs `carlesso`)**:
  - `0°`: White Luma `160.74` vs Black Luma `68.63` (Δ `92.11`, Ratio `2.13x`, 2D Discs `32`)
  - `30°`: White Luma `147.37` vs Black Luma `63.61` (Δ `83.75`, Ratio `2.1x`, 3D Add-Ons `32`, Baked GLB Add-Ons `32`, Wreaths `32`, Billboards `32`)
- **Critica VLM (`gemini-flash-latest`)**: _La visuale a 0° con medaglioni 2D provvisti di glifi e sigle alfabetiche elimina ogni ambiguità anche nei mirror match più complessi. A 30° la combinazione di add-on 3D, ghirlande di piedistallo e stemmi fluttuanti mantiene una leggibilità eccezionale, sebbene nei settori centrali densi si percepisca una lieve saturazione visiva. Il contrasto cromatico tra bianco avorio dorato e nero ossidiana violaceo è netto, azzerando qualsiasi affaticamento cognitivo per i bambini._

### 2. `s1` — S1 (Zenith 2D) (Score: **8.50/10**)
- **Descrizione**: Zenith 2D Classic B/W Medallion Icons + Obsidian Contrast
- **Ruoli riconosciuti a 0° (Zenitale)**: `King, Queen, Rook, Bishop, Knight, Pawn`
- **Ruoli riconosciuti a 30° (Semi-Alta)**: `King, Queen, Rook, Bishop, Knight, Pawn`
- **Telemetria Mirror Match (`carlesso` vs `carlesso`)**:
  - `0°`: White Luma `161.36` vs Black Luma `68.55` (Δ `92.81`, Ratio `2.14x`, 2D Discs `32`)
  - `30°`: White Luma `153.59` vs Black Luma `65.26` (Δ `88.33`, Ratio `2.13x`, 3D Add-Ons `0`, Baked GLB Add-Ons `0`, Wreaths `0`, Billboards `0`)
- **Critica VLM (`gemini-flash-latest`)**: _A 0° la leggibilità è insuperabile grazie ai medaglioni 2D standardizzati con lettere e icone chiare. A 30°, tuttavia, i dischi orizzontali subiscono uno schiacciamento prospettico e parziali sovrapposizioni nelle retrovie, riducendo l'impatto tridimensionale. L'eccellente contrasto cromatico tra Bianco e Nero garantisce comunque zero ambiguità anche nelle partite speculari._

### 3. `s2` — S2 (3D GLB Add-Ons) (Score: **8.50/10**)
- **Descrizione**: Universal 3D Static Role Add-Ons + Obsidian Contrast
- **Ruoli riconosciuti a 0° (Zenitale)**: `King, Queen, Rook, Knight, Bishop, Pawn`
- **Ruoli riconosciuti a 30° (Semi-Alta)**: `King, Queen, Rook, Knight, Bishop, Pawn`
- **Telemetria Mirror Match (`carlesso` vs `carlesso`)**:
  - `0°`: White Luma `142.96` vs Black Luma `48.34` (Δ `94.62`, Ratio `2.55x`, 2D Discs `0`)
  - `30°`: White Luma `149.03` vs Black Luma `57.22` (Δ `91.8`, Ratio `2.31x`, 3D Add-Ons `32`, Baked GLB Add-Ons `32`, Wreaths `0`, Billboards `0`)
- **Critica VLM (`gemini-flash-latest`)**: _L'eccellente contrasto cromatico tra l'avorio dorato e l'ossidiana violacea rende immediata la distinzione delle fazioni anche nei mirror match. A 0° i simboli volumetrici apicali (croci, corone e teste equine) guidano chiaramente la lettura dei ruoli senza affaticare gli occhi. A 30° la silhouette complessiva guadagna ulteriore tridimensionalità, offrendo una leggibilità ludica ideale per un pubblico giovane._

### 4. `s4` — S4 (Pedestal Wreath + Crest) (Score: **8.50/10**)
- **Descrizione**: 3D Pedestal Role Wreath + Floating 2D Crest + Obsidian
- **Ruoli riconosciuti a 0° (Zenitale)**: `King, Queen, Rook, Bishop, Knight, Pawn`
- **Ruoli riconosciuti a 30° (Semi-Alta)**: `King, Queen, Rook, Bishop, Knight, Pawn`
- **Telemetria Mirror Match (`carlesso` vs `carlesso`)**:
  - `0°`: White Luma `132.9` vs Black Luma `57.83` (Δ `75.07`, Ratio `2.06x`, 2D Discs `0`)
  - `30°`: White Luma `145.8` vs Black Luma `63.29` (Δ `82.51`, Ratio `2.08x`, 3D Add-Ons `0`, Baked GLB Add-Ons `0`, Wreaths `32`, Billboards `32`)
- **Critica VLM (`gemini-flash-latest`)**: _L'integrazione di badge fluttuanti con icone 2D standardizzate risolve brillantemente l'ambiguità geometrica sia a 0° che a 30°, garantendo un riconoscimento immediato anche nei mirror match. Il contrasto cromatico tra l'ossidiana profonda dei Neri e l'avorio dorato dei Bianchi è netto e senza fraintendimenti. L'unico limite risiede nel leggero affollamento visivo dei billboard nelle mischie centrali, che può affaticare la lettura spaziale della scacchiera durante partite lunghe._

### 5. `s3` — S3 (Obsidian Contrast) (Score: **5.25/10**)
- **Descrizione**: True Obsidian Black vs Warm Ivory Contrast Only
- **Ruoli riconosciuti a 0° (Zenitale)**: `Pawn, Rook`
- **Ruoli riconosciuti a 30° (Semi-Alta)**: `Pawn, Knight, Bishop, Rook, King`
- **Telemetria Mirror Match (`carlesso` vs `carlesso`)**:
  - `0°`: White Luma `129.34` vs Black Luma `46.46` (Δ `82.88`, Ratio `2.4x`, 2D Discs `0`)
  - `30°`: White Luma `145.02` vs Black Luma `56.4` (Δ `88.62`, Ratio `2.28x`, 3D Add-Ons `0`, Baked GLB Add-Ons `0`, Wreaths `0`, Billboards `0`)
- **Critica VLM (`gemini-flash-latest`)**: _Il contrasto cromatico tra i due schieramenti risulta sufficiente ma la vista a 0 gradi soffre per la mancanza di indicatori grafici chiari sulle teste dei pezzi. La visuale a 30 gradi migliora la lettura delle silhouette principali, pur mantenendo qualche ambiguita tra figure maggiori._

### 6. `off` — Off (Baseline) (Score: **5.00/10**)
- **Descrizione**: Original 3D Models Only (Legacy Baseline)
- **Ruoli riconosciuti a 0° (Zenitale)**: `Rook, Knight, Pawn`
- **Ruoli riconosciuti a 30° (Semi-Alta)**: `King, Queen, Rook, Bishop, Knight, Pawn`
- **Telemetria Mirror Match (`carlesso` vs `carlesso`)**:
  - `0°`: White Luma `108.78` vs Black Luma `70.29` (Δ `38.49`, Ratio `1.46x`, 2D Discs `0`)
  - `30°`: White Luma `123.66` vs Black Luma `71.5` (Δ `52.16`, Ratio `1.62x`, 3D Add-Ons `0`, Baked GLB Add-Ons `0`, Wreaths `0`, Billboards `0`)
- **Critica VLM (`gemini-flash-latest`)**: _La vista zenitale a 0° soffre fortemente per l'assenza di indicatori 2D sui dischi, rendendo Re e Regina difficilmente distinguibili dalla sola sommità del copricapo. A 30° la silhouette tridimensionale migliora la leggibilità dei singoli pezzi, ma nel Mirror Match il basso contrasto di luminanza (solo 1.3x-1.5x) e le basette simili affaticano notevolmente gli occhi di un bambino._

