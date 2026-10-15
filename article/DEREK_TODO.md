# 💼 DEREK_TODO.md — Cose da fare oggi sul computer di lavoro (Derek)

Ciao Riccardo! Quando arrivi al lavoro e apri **Derek** (la tua macchina corp), ecco l'elenco puntuale delle cose da estrarre, verificare e sincronizzare per completare il quadro di **CarChess3D**:

---

## 📋 Checklist Attività su Derek

### 1. 🔍 Estrazione Chat Logs & Prompt Interni
- [ ] **Chat Antigravity / Gemini su Derek**:
  Cerca se ci sono state conversazioni su Derek (in `~/.gemini/antigravity/brain/` o via CLI) relative a:
  - Generazione di video con Veo (es. script interni, prompt per le battaglie 16:9).
  - Prompt di Nano Banana per i concept 2D iniziali dei bambini o delle guardie svizzere.
  - Test su Imagen / Lyria 3 per la colonna sonora.
- [ ] **Esportazione log**: Se trovi sessioni rilevanti su Derek, copia i file `transcript.jsonl` o gli snippet in una cartella di transito (es. Drive o branch privato).

### 2. 🎬 Recupero Asset Multimediali ad Alta Risoluzione
- [ ] **Video Veo non ancora sincronizzati**:
  Verifica se nella cartella di lavoro su Derek ci sono video di combattimento `.mp4` generati con Veo 2 / Veo non ancora committati sul repo pubblico (perché pesanti o in attesa di revisione).
- [ ] **Musica Lyria 3**:
  Controlla se ci sono versioni alternative o tracce estese della sinfonia barocca in Mi Dorico oltre a `assets/audio/chess-strings-bg.mp3`.

### 3. 🌿 Sincronizzazione Git & Worktree
- [ ] Esegui il pull del branch dell'articolo:
  ```bash
  git fetch origin
  git checkout write_family_3d_article
  git pull origin write_family_3d_article
  ```
- [ ] Verifica che i percorsi e i file generati stamattina su pupurabbux (`article/`) siano visibili anche su Derek.

### 4. 📝 Revisione Finale dell'Articolo
- [ ] Leggi la bozza completa in `article/ARTICLE.md`.
- [ ] Aggiungi eventuali aneddoti o dettagli vissuti in prima persona durante il viaggio a Colmar per il 10° anniversario di matrimonio.
- [ ] Se hai scattato una foto reale a Colmar (tu e Kate brindando con Riesling o passeggiando a Petite Venise!), salvala in `article/assets/gallery/colmar_anniversary.jpg` per metterla come copertina romantica a contrasto con la scheda madre di casa! ❤️🍷

---

*Nota di Gemini: Pupurabbux ha lavorato tutta la notte e la mattina. I dati locali, le telemetrie git, i modelli 3D e i render 360° sono tutti organizzati in `./article/`.*
