# 💼 DEREK_TODO.md — Cose da fare oggi sul computer di lavoro (Derek)

Ciao Riccardo! Quando arrivi al lavoro e apri **Derek** (la tua macchina corp), ecco l'elenco puntuale delle cose da estrarre, verificare e sincronizzare per completare il quadro di **CarChess3D**:

---

## 📋 Checklist Attività su Derek

### 1. 🔍 Estrazione Chat Logs & Prompt Interni
- [x] **Chat Antigravity / Gemini su Derek** *(Completato in [`DEREK_JETSKI_FORENSICS.md`](DEREK_JETSKI_FORENSICS.md) e nel Post-Mortem [`INVESTIGATION.md`](INVESTIGATION.md))*:
  Cerca se ci sono state conversazioni su Derek (in `~/.gemini/jetski/brain/` o via CLI) relative a:
  - Generazione di video con Veo (es. script interni, prompt per le battaglie 16:9).
  - Prompt di Nano Banana per i concept 2D iniziali dei bambini o delle guardie svizzere.
  - Test su Imagen / Lyria 3 per la colonna sonora.
- [x] **Esportazione log**: Estratte tutte le 41 sessioni (`13.100+` step, `760M+` token) e la timeline al secondo in [`INVESTIGATION.md`](INVESTIGATION.md).

### 2. 🎬 Recupero Asset Multimediali ad Alta Risoluzione
- [x] **Video Veo non ancora sincronizzati**:
  Tutti i 36 video `.mp4` certificati dal Video Critic (`>= 8.0/10`) sono committati in `assets/battles/` e tracciati in `docs/battles/video_audit.yaml`.
- [x] **Musica Lyria 3**:
  Tutte e 4 le tracce Lyria 3 (`chess-strings-theme.mp3`, `chess-strings-bg.mp3`, `combat-suspense.mp3`, `checkmate-jingle.mp3`) sono committate in `assets/audio/`.

### 3. 🌿 Sincronizzazione Git & Worktree
- [x] Sincronizzato e mergiato in `main` (`v0.3.74`).
- [x] Verificato che tutti i percorsi e i file generati su `pupurabbux` e `derek` (`article/`) siano unificati.

### 4. 📝 Revisione Finale dell'Articolo
- [ ] Leggi la bozza completa in `article/ARTICLE.md`.
- [ ] Aggiungi eventuali aneddoti o dettagli vissuti in prima persona durante il viaggio a Colmar per il 10° anniversario di matrimonio.
- [ ] Se hai scattato una foto reale a Colmar (tu e Kate brindando con Riesling o passeggiando a Petite Venise!), salvala in `article/assets/gallery/colmar_anniversary.jpg` per metterla come copertina romantica a contrasto con la scheda madre di casa! ❤️🍷

---

*Nota di Gemini: Pupurabbux ha lavorato tutta la notte e la mattina. I dati locali, le telemetrie git, i modelli 3D e i render 360° sono tutti organizzati in `./article/`.*
