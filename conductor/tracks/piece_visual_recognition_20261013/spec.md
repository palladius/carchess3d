# Track Specification: `piece_visual_recognition_20261013` — Eliminazione Fatigue Visiva, Contrasto Bianco/Nero Ossidiana & Significanti Universali di Ruolo (GHI #32)

> **Track ID:** `piece_visual_recognition_20261013`
> **Type:** Feature (UX / 3D Visual Clarity / GLB Pipeline / Adversarial VLM Critic)
> **GitHub Issue:** [#32 — 🔍 Modalità Chiarezza Visiva](https://github.com/palladius/carchess3d/issues/32)
> **Architecture:** `niccolo-game-design` (Headless Managers `<= 300` LOC + `PieceClarityHelper.js` / `PieceView.js` + `HudListener.js`)

## 1. Overview & Problem Statement

Durante le partite con i bambini, i modelli 3D delle 3 famiglie (`carlesso`, `swamp`, `classic`) sono bellissimi da vicino, ma **dall'alto (`0°` verticale)** o **semi-alto (`30°` dalla verticale)** generano una **fatigue mentale e visiva** per tre motivi precisi:
1. **Il Nero sembra Avorio/Bianco**: Il piatto superiore del piedistallo Nero (`topCyl`) usa `0xdce7f7` (bianco-argento ghiaccio) e i `.glb` texturizzati Neri usano un tint chiarissimo (`0xb8c6f0`) con emissive `0x7c90e8`, lasciando i bianchi/avorio delle texture e le basi interne `.glb` luminose.
2. **Mancanza di Significanti Statici Universali sui `.glb`**: Quando il `.glb` viene caricato, `PieceView.attachGlbToPiece` rimuove la corona di fallback (`buildRoleCrown`), lasciando visibile dall'alto solo la sommità della testa del personaggio (diversa per ogni skin).
3. **Vista Verticale priva di Icone 2D Classiche**: La modalità `📐 Vista dall'Alto (2D)` sposta la camera in verticale senza attivare icone 2D scacchistiche classiche ad alto contrasto (`♔ ♕ ♖ ♗ ♘ ♙`).

## 2. Functional Requirements (Le 5 Soluzioni Combinabili `S1..S5`)

Tutte le 5 soluzioni devono essere selezionabili via URL (`?clarity=s1|s2|s3|s4|s5|off`, default `s5`) e tramite il pulsante live **🔍 Chiarezza (`#hud-clarity-btn`)** nell'HUD:

1. **Soluzione `S1` (`zenith2d` — Auto-Switch Icone 2D Classiche B/N in Verticale + Toggle HUD)**:
   - Quando l'angolo polare della camera rispetto alla verticale è `< 20°` (o `topDownCamera === true`, o l'utente attiva il toggle 2D nell'HUD), mostra sopra/al posto dei pezzi dei **Medaglioni 2D Classici ad Altissimo Contrasto (`Ø 0.84m`)** con i simboli `♔ ♕ ♖ ♗ ♘ ♙` (Bianco: Avorio `#fffdf7` + Oro `#d4af37` con glifo inciso scuro; Nero: Ossidiana `#0b0e16` + Viola/Ciano `#b388ff` con glifo chiaro luminoso).
2. **Soluzione `S2` (`glb_addons` — Add-On Statici 3D Universali sui GLB — Runtime + Baked)**:
   - Ogni pezzo (sia `Carlesso`, sia `Swamp`, sia `Classic`) monta gli **stessi significanti 3D statici di ruolo** (sia a runtime in `PieceClarityHelper.js` sia fisicamente baked nei `.glb` tramite `tools/model-pipeline/bake_universal_role_addons.py`):
     - `♔` **Re**: Corona a Singolo Diadema + **Alta Croce Reale (`Cross Pattee`)** svettante sull'apice.
     - `♕` **Regina**: **Corona Multi-Punte Svasata (8 punte larghe con 8 perle)** ben visibile dall'alto.
     - `♖` **Torre**: **Corona Torrita a 6 Merli Quadrati** massicci.
     - `♗` **Alfiere**: **Mitra + Alta Croce / Pastorale Vescovile**.
     - `♘` **Cavallo**: **Cimiero Equino Largo (Doppia Testa di Destriero & Criniera Araldica)** esteso lateralmente.
     - `♙` **Pedone**: **Picca / Alabarda Verticale Alta + Sfera Staunton**.
3. **Soluzione `S3` (`obsidian_contrast` — Vera Base Ossidiana Nera vs Avorio & Contrasto GLB)**:
   - Piedistallo Nero in **Ossidiana Nera Profonda (`#0d1017`)** opaca anche sul piatto superiore `topCyl` (zero bianco/argento chiaro visto dall'alto!), con anelli laterali in **Viola-Cobalto (`#7c4dff`) / Bronzo Scuro**.
   - Shader e curva di contrasto sui `.glb` della squadra Nera: scurisce selettivamente i texel avorio/bianchi delle texture UV e forza a nero ossidiana (`#0d1017`) il plinto inferiore (`normY < 0.14`) baked dentro i `.glb`, preservando i tratti del viso.
4. **Soluzione `S4` (`wreath_billboard` — Ghirlanda 3D Scolpita sul Piedistallo + Stemma 2D Billboard)**:
   - Anello/Ghirlanda 3D specifica per ruolo scolpita sul perimetro esterno del piedistallo (`Ø 0.75m`, ridotta a `0.85×` per i Pedoni): 4 croci imperiali per il Re, stella a 8 punte con perle per la Regina, cinta muraria a 6 merli per la Torre, mitra/croce per l'Alfiere, grande ferro di cavallo `U` + profili equini per il Cavallo, punta di picca frontale per il Pedone.
   - Stemma 2D flottante (`THREE.Sprite`) sempre rivolto verso la camera sopra il pezzo.
5. **Soluzione `S5` (`hybrid_champion` — Combo Adattiva Totale, Default)**:
   - Combina `S3` (Ossidiana Nera vs Avorio) + `S2` (Add-on 3D Statici sui `.glb`) + `S4` (Ghirlanda Piedistallo + Badge) in vista 3D (`>= 20°`), e passa automaticamente a `S1` (Medaglioni 2D Classici Giganti) quando la camera scende sotto `20°` dalla verticale o si preme `📐 Vista dall'Alto (2D)`.

## 3. Adversarial Swarm & Blind VLM Recognizer (`0°` & `30°`)

- **Screenshot Harness & VLM Critic (`scripts/critic_recognizability.py`)**:
  - Cattura gli screenshot della scacchiera a **`0°` (zenitale verticale)** e **`30°` (semi-alto)** per `baseline` (`off`) e `s1..s5` attraverso i set `Carlesso vs Classic`, `Carlesso vs Swamp`, e `Carlesso vs Carlesso`.
  - Interroga `gemini-flash-latest` con schema strutturato Pydantic per misurare:
    1. `bw_contrast_score` (`1..10`) e `%` di distinzione Bianco vs Nero senza ambiguità avorio.
    2. `role_recognition_score` (`1..10`) e `%` di riconoscimento dei 6 ruoli (`K, Q, R, B, N, P`) a `0°` e `30°`.
    3. `low_fatigue_score` (`1..10`) per immediatezza visiva adatta ai bambini.
  - Genera il contact sheet comparativo `docs/clarity_comparison_0deg_30deg.png` e pubblica i risultati sulla GHI #32.

## 4. Acceptance Criteria

- [ ] `src/views/PieceClarityHelper.js` e `src/views/PieceView.js` implementano tutte le 5 soluzioni (`s1..s5` + `off`).
- [ ] Il piedistallo Nero e i `.glb` Neri non presentano più facce superiori bianco-argento né corpi avorio lavati; il contrasto Bianco (Avorio/Oro) vs Nero (Ossidiana `#0d1017`/Viola-Cobalto) è netto a `0°` e `30°`.
- [ ] Tutti i `.glb` delle 3 famiglie (`carlesso`, `classic`, `swamp`) includono gli add-on statici universali baked (`tools/model-pipeline/bake_universal_role_addons.py`) con `docs/models-provenance.yaml` aggiornato e `just provenance` + `just test` 100% verdi.
- [ ] Il bottone HUD `🔍` permette di cambiare modalità in tempo reale e la vista verticale (`< 20°` o `📐 2D`) mostra le icone 2D classiche B/N.
- [ ] `scripts/critic_recognizability.py` esegue il test a `0°` e `30°` e produce la classifica comparativa + contact sheet.
