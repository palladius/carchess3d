# 💼 DEREK_TODO.md — Cose da fare oggi sul computer di lavoro (Derek)

Ciao Riccardo! Quando arrivi al lavoro e apri **Derek** (la tua macchina corp), ecco l'elenco puntuale delle cose da estrarre, verificare e sincronizzare per completare il quadro di **CarChess3D**:

---

## 📋 Checklist Attività su Derek

### 1. 🔍 Estrazione Chat Logs & Prompt Interni
- [x] **Chat Antigravity / Gemini su Derek**:
  Estratte tutte le **54 sessioni di `derek`** in [`article/DEREK_JETSKI_FORENSICS.md`](DEREK_JETSKI_FORENSICS.md) e [`article/sources/derek_chats_list.md`](sources/derek_chats_list.md), e bonificate le **22 sessioni di `pupurabbux`** in [`article/sources/chats_list.md`](sources/chats_list.md).
- [x] **Esportazione log**: Indici JSON e Markdown sanificati in `article/sources/telemetry/chats_index.json` e `article/sources/telemetry/derek_chats_index.json`.

### 2. 🎬 Recupero Asset Multimediali ad Alta Risoluzione
- [x] **Video Veo non ancora sincronizzati**:
  Tutti i 72 file video (`36 .mp4` + `36 .webm`) sono versionati in `assets/battles/videos/` e auditati in `docs/battles/video_audit.yaml`.
- [x] **Musica Lyria 3**:
  Tutte le 4 tracce Lyria 3 (`chess-strings-theme.mp3`, `chess-strings-bg.mp3`, `combat-suspense.mp3`, `checkmate-jingle.mp3`) e le 31 clip vocali della famiglia sono versionate in `assets/audio/`.

### 3. 🌿 Sincronizzazione Git & Worktree
- [x] Branch `write_family_3d_article` mergiato in `main` (`v0.3.72`) e sincronizzato su `derek`.
- [x] Tutti i percorsi e gli showcase (`SHOWCASE_BEFORE_AFTER.md`, `SHOWCASE_VISUAL_CLARITY.md`, `DEREK_JETSKI_FORENSICS.md`) sono verificati e integrati in `article/ARTICLE.md`.

### 4. 📝 Revisione Finale dell'Articolo
- [x] Integrata la bozza completa in [`article/ARTICLE.md`](ARTICLE.md) unendo `pupurabbux` + `derek`, gli 8 loop agentici, il benchmark `S1..S5` e il **Daily UAT Review** con Antigravity ([`label:"gemini-uat"`](https://github.com/palladius/carchess3d/issues?q=state%3Aopen%20label%3A%22gemini-uat%22)).
- [x] Pubblicata in locale e in modalità "in sordina" (`_build: { list: never, render: always }`) su `ricc.rocks` (`zzo.ricc.rocks`).
- [ ] *(Opzionale per Riccardo)* Se hai scattato una foto reale a Colmar (tu e Kate brindando con Riesling o passeggiando a Petite Venise!), salvala in `article/assets/gallery/colmar_anniversary.jpg` per metterla come copertina romantica a contrasto con la scheda madre di casa! ❤️🍷

---

*Nota di Gemini: Pupurabbux ha lavorato tutta la notte e la mattina. I dati locali, le telemetrie git, i modelli 3D e i render 360° sono tutti organizzati in `./article/`.*
