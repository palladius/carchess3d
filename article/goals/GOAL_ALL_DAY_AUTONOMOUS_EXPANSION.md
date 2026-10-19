# 🚀 Prompt `/goal` — CarChess3D All-Day Autonomous Expansion & Polish

> **Come usare:** Copia e incolla l'intero blocco di testo sottostante nella chat di Antigravity / Gemini CLI per avviare una sessione di lavoro continuo e autonomo per tutta la giornata.

---

```text
/goal Esegui un'intera giornata di lavoro autonomo su CarChess3D ("Carlesso al Cesso") concentrandoti su: 1) espansione delle 36 animazioni cinematografiche di combattimento Veo/Canvas 16:9, 2) integrazione completa di tutte le varianti di skin 3D nel selettore HUD di gioco (Ale col cappello vs astrolabio vs drago animato; Kate giovane vs nozze 2016; Seby con spada laser vs alabarda vs sfera acquario), 3) affinamento della colonna sonora procedurale e dei trigger vocali bilingue, e 4) audit rigoroso con l'Adversarial Art Director Critic fino a mantenere un punteggio >= 9.5/10 su tutta la scacchiera.

REGOLE FERREE & GUARDRAILS:
- Lavora ESCLUSIVAMENTE in questo git worktree. Non toccare MAI file fuori dal repo, non toccare .env o .riccardo/.
- Ogni commit DEVE usare GIT_AUTHOR_EMAIL="132802+palladius@users.noreply.github.com" e includere il trailer "Co-authored-by: Gemini 4 Argon (Antigravity) <176961590+gemini-code-assist[bot]@users.noreply.github.com>".
- Zero build step, 100% Vanilla Three.js r170 ES Modules offline-first (PWA).
- Rispetta rigidamente l'architettura di Niccolò (.agents/skills/niccolo-game-design/SKILL.md):
  1. Un Manager = Una Sola Responsabilità (<= 300 LOC per file).
  2. Nessun God Manager. Le regole vivono con i dati che ispezionano.
  3. Comunicazione esclusivamente tramite GameEventBus a coda temporizzata a 1/30s.
  4. Core 100% headless (Node unit tests senza DOM e senza Three.js).
- IP Safety: Nessun brand protetto nei file dell'applicazione (codice, UI, modelli). Rispetta etc/ip-denylist.txt.
- Esegui `just test` dopo ogni traguardo. Mantieni 100% test passing, aggiorna CHANGELOG.md e incrementa VERSION.

PILASTRO 1 — INTEGRAZIONE VARIANTI SKINS 3D NEL MODALE SETUP DI GIOCO:
- Aggiorna `src/managers/PieceManager.js` e `src/listeners/HudListener.js` per permettere la selezione a caldo di:
  * Alfiere Ale: Canonico con Cappello (`bishop-ale-1.glb`), Ruota Celeste Astrolabio (`bishop-ale-2-remastered.glb`), Rigged Drago Animato (`bishop-ale-rigged.glb`).
  * Regina Kate: Giovane Wavy Blonde (`queen-kate.glb`), Nozze 2016 Remastered con Chignon e Occhiali Navy (`queen-kate-wedding2016-remastered.glb`).
  * Cavaliere Sebastian: Base Dorata, Spada Laser Plasma Blu, Alabarda Reale, Sfera d'Acquario.
- Verifica che il cambio skin ricalcoli bounding box e grounding a y = 0.00m senza glitch visivi.

PILASTRO 2 — MATRICE DI COMBATTIMENTO 6x6 & CINEMA 16:9 ZERO-HITL:
- Raffina `src/views/VeoCinemaView.js` e `src/managers/CombatAnimationManager.js`:
  * Assicura che tutti i 36 scontri (6x6) riproducano il video .mp4/.webm corretto su Maxischermo quando disponibile.
  * Per le combinazioni con fallback Canvas 2D, aggiungi effetti particellari a 60fps (onde d'urto, scintillio di rune, cuoricini per il Super Abbraccio Puffoso Seby-Pupurabbu).
  * Ottimizza i tempi di entrata/uscita cinematografica (1s pre-roll + 8s animazione + 1s post-roll), skippabile istantaneamente con Spazio, Invio, o tocco sullo schermo.

PILASTRO 3 — SOUNDBOARD INTERATTIVA & LIVING IDLE POSES:
- Espandi i trigger vocali in `src/listeners/AudioListener.js`:
  * Al tocco di un pezzo, riproduci battute caratteristiche non ripetitive ("Don't be FACETIOUS!", "clean my bottooooom?", "Sei proprio un cafoNAZZO!").
  * Mantieni il volume bilanciato con la sinfonia d'archi Lyria 3 in sottofondo (fade automatico durante il parlato e le catture).
  * Assicura il funzionamento offline su mobile e Safari iOS senza blocchi di WebAudio context.

PILASTRO 4 — LOOP ADVERSARIAL CRITIC & VERIFICA CONTINUA:
- Lancia subagenti paralleli per verificare:
  1. Unit test Node (`node --test tests/*.test.mjs`) e Python (`python3 scripts/check.py`).
  2. Bounding box, altezze canoniche, e contratti dei 50 modelli GLB.
  3. Esegui audit headless con screenshot a 4 viste (3/4, close-up, ground y=0, wireframe) correggendo ogni difetto geometrico o di luce.
- Continua a iterare autonomamente fino al completamento di tutti i pilastri!
```
