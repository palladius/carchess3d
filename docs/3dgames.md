# Guida Pratica ai File 3D e Modelli per Giochi 🏰🎮

> Guida introduttiva e pratica per visualizzare, ispezionare e comprendere i formati 3D (in particolare `.glb` e `.gltf`) su Linux (Ubuntu) e nel browser.

---

## 1. Cos'è un file `.glb` / `.gltf`?

Il formato **glTF** (*GL Transmission Format*, creato da Khronos Group) è spesso definito lo **"JPEG del 3D"**:
- È lo standard de facto moderno per il 3D sul Web, videogiochi e WebGL (Three.js, Babylon.js, Godot, Unity, Unreal Engine).
- **`.gltf`** (testo JSON): descrive la struttura della scena e punta a file esterni `.bin` (geometria) e immagini `.png`/`.jpg` (texture).
- **`.glb`** (binario compatto): include **tutto in un unico file** compresso (mesh, texture, materiali PBR, scheletro/rigging e animazioni).

---

## 2. Perché `open file.glb` dà errore su Linux?

Quando esegui:
```bash
open assets/models/pawn-puffin.glb
# oppure
xdg-open assets/models/pawn-puffin.glb
```
Ricevi l'errore:
```text
gio: Failed to find default application for content type 'model/gltf-binary'
```
Questo accade perché Linux non sa quale programma grafico associare al tipo MIME `model/gltf-binary` finché non installi un visualizzatore e imposti l'associazione.

---

## 3. Come aprire e visualizzare un file 3D

Ecco le opzioni migliori, dalla più immediata alla più avanzata:

### Opzione A: Nel Browser (Zero installazione, drag & drop) 🌐

Il modo più rapido per ispezionare un modello con texture, animazioni e illuminazione corretta:

1. **[Don McCurdy glTF Viewer](https://gltf-viewer.donmccurdy.com/)** *(Consigliatissimo per Three.js)*:
   - Trascina il file `.glb` nella finestra del browser.
   - Mostra statistiche (poligoni, texture), controlli animazione, wireframe e ispezione delle ossa.
2. **[Three.js Editor](https://threejs.org/editor/)**:
   - Editor 3D completo nel browser. `File > Import` o trascina il `.glb`.
3. **[Babylon.js Sandbox](https://sandbox.babylonjs.com/)**:
   - Drag & drop immediato con inspector per materiali e animazioni.

---

### Opzione B: Visualizzatore CLI/GUI leggero (`f3d`) ⚡

**F3D** (*Fast and minimalist 3D viewer*) è un visualizzatore desktop nativo leggerissimo per Linux, macOS e Windows:

1. **Installazione su Ubuntu**:
   ```bash
   sudo apt install f3d
   ```
2. **Uso da riga di comando**:
   ```bash
   f3d assets/models/pawn-puffin.glb
   # oppure per modelli animati / scheletri:
   f3d assets/models/bishop-ale-rigged.glb
   ```
3. **Associare `open` / doppio click a F3D**:
   ```bash
   xdg-mime default f3d.desktop model/gltf-binary
   ```
   Dopo questo comando, `open assets/models/pawn-puffin.glb` o il doppio clic dal file manager aprirà automaticamente F3D!

---

### Opzione C: In Blender (Modifica & Creazione 3D) 🎨

Blender è già installato sulla macchina (`/usr/bin/blender`).

#### Da CLI (Riga di comando diretta) ⚡
Se provi `blender file.glb`, Blender fallisce perché da riga di comando si aspetta solo file nativi `.blend`. 
Tuttavia puoi importare e aprire qualsiasi `.glb` da terminale con un comando Python incorporato:

```bash
blender --python-expr "import bpy; [bpy.data.objects.remove(o) for o in list(bpy.data.objects)]; bpy.ops.import_scene.gltf(filepath='assets/models/pawn-puffin.glb')"
```

💡 *Trucco: puoi creare un alias nel tuo `~/.bashrc` / `~/.zshrc`:*
```bash
alias blend-glb="blender --python-expr \"import bpy, sys; [bpy.data.objects.remove(o) for o in list(bpy.data.objects)]; bpy.ops.import_scene.gltf(filepath=sys.argv[-1])\" --"
# Poi ti basta:
blend-glb assets/models/bishop-ale-rigged.glb
```

#### Da Interfaccia Grafica
1. Avvia `blender`.
2. Cancella il cubo iniziale (`X > Delete`).
3. Menu: `File > Import > glTF 2.0 (.glb/.gltf)` e seleziona il file.
4. In alto a destra nella viewport 3D seleziona la modalità di rendering **Material Preview** (la sfera con sfumatura) per vedere colori e texture.
5. Premi `Space` per avviare le animazioni (se presenti).

---

### Opzione D: Direttamente dentro VS Code / Editor 💻

Se utilizzi VS Code / Cursor / Antigravity:
- Installa l'estensione **"3D Viewer for glTF"** o **"glTF Tools"**.
- Cliccando su qualsiasi file `.glb` o `.gltf` nella barra laterale si aprirà una vista 3D interattiva direttamente come scheda dell'editor.

---

## 4. Glossario Rapido del 3D per Principianti 📚

| Termine | Cos'è in parole semplici |
| :--- | :--- |
| **Mesh** | La forma geometrica 3D dell'oggetto, composta da vertici (*vertices*), spigoli (*edges*) e facce/poligoni (*faces*). |
| **PBR Material** | *Physically Based Rendering*: definisce come la luce riflette sull'oggetto (lucido, metallico, ruvido). |
| **Texture / UV Map** | L'immagine 2D "spalmata" sul modello 3D (come la carta da regalo su una scatola). |
| **Rigging / Armature** | Lo scheletro invisibile fatto di ossa (*bones*) inserito dentro il modello per poterlo muovere. |
| **Skinning / Weights** | Quanto ogni vertice della mesh si muove quando un determinato osso dello scheletro ruota. |
| **Keyframes / Animation** | Registrazione dei movimenti delle ossa nel tempo (es. `Idle`, `Walk`, `Attack`). |

---

## 5. Formati 3D a Confronto

- **`.glb` / `.gltf`**: Il formato standard per il web e Three.js. Supporta materiali moderni e animazioni in file piccoli.
- **`.obj` + `.mtl`**: Formato storico (anni '90). Solo geometria fissa e texture di base, niente animazioni o armature.
- **`.fbx`**: Formato proprietario di Autodesk. Molto usato nei motori AAA (Unreal, Unity), ma più pesante e meno compatibile con Three.js web puro.
- **`.blend`**: File di progetto nativo di Blender.
