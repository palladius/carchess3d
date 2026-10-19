# 🏰🚽 CarChess3D: How a Fleet of Autonomous Agents Built a 3D Chess Game Starring My Family While I Celebrated My 10th Wedding Anniversary in Colmar

*By **Riccardo "Palladius" Carlesso** (`RiccardinoCM26 🦖`) — Developer Advocate, SRE at heart, dad to Alessandro (🐉) and Sebastian (🏎️)*  
*Powered by **Gemini 4 Argon (Antigravity)**, the **Niccolò Game Design** architecture, and a ruthless orchestra of adversarial critics.*  
*Zurich & Colmar, October 9–15, 2026 · Version `v0.3.74`*

![CarChess3D 16:9 Cinematic Banner: Classic Family vs Swamp Faction](assets/before_after/article_hero_banner_16x9.png)

---

## 🍕🌹 1. From a *Bufalina* in Naples to a 10th Anniversary in Colmar

I was in **Naples** on a Friday a few weeks ago to follow the adventures of [**Fabio Biondi's Gemini Day**](https://gdg.community.dev/events/details/google-gdg-napoli-presents-agentic-apps-con-google-gemini-sdk-e-typescript/) at Università Federico II when I bumped into a group of super-smart engineers. You know how it goes in Italy: two minutes of small talk, an espresso at the bar, and before you know it we are all sitting around a table having lunch together.

Over a steaming *pizza bufalina*, **Niccolò and his friends** let me in on their obsession: 3D games, real-time rendering, clean game architecture, and using **Tripo** and similar generative pipelines to turn flat 2D images into textured 3D objects. Since I had just built [**Pupurabbu 3D**](https://pupurabbu-3d-272932496670.europe-west6.run.app) ([source on GitLab](https://gitlab.com/palladius/pupurabbu-3d)) — a kid-friendly, Quake-style 3D explorer for my two boys — I was all ears.

Little did I know back at that pizzeria table that, just a few weeks later, I would:
1. **Package Niccolò's game-design wisdom into an agent skill** ([`niccolo-game-design`](https://github.com/palladius/gemini-cli-palladius-public-goodies/blob/main/skills/niccolo-game-design/SKILL.md), mirrored in this repo at [`.agents/skills/niccolo-game-design/SKILL.md`](../.agents/skills/niccolo-game-design/SKILL.md)), and
2. **Use Gemini 4 to generate a next-generation 3D Battle Chess game completely HANDS-OFF!**

How? **... keep reading! :)**

And all of it while I was away in **Colmar**, Alsace, celebrating my **10th wedding anniversary with my wife Kate**! 🥂🌹

![Riccardo and Kate celebrating their 10th wedding anniversary along the Petite Venise canal in Colmar, Alsace](assets/colmar_riccardo_kate_10th_anniversary.jpg)

While Kate and I were strolling along the half-timbered houses of *Petite Venise* — no laptop open at the dinner table, no frantic SSH debugging from a phone — 150 kilometers south, my home Linux rig **`pupurabbux`** (equipped with a 16 GB **NVIDIA GeForce RTX 5080**) and my office workstation **`derek`** were humming day and night.
Orchestrated by **Gemini 4 Argon** inside **Antigravity**, that adversarial swarm of subagents and multimodal critics was busy:
1. Sculpting, rigging, and assembling **50 high-resolution `.glb` 3D models** of our family and rival factions.
2. Compiling custom CUDA PTX kernels on the fly for the brand-new Blackwell `sm_120` GPU architecture.
3. Subjecting every single mesh, texture, and video frame to a merciless multimodal **Adversarial Art Director Critic**.
4. Writing over **121,000 lines of code**, headless unit tests, and Three.js WebGL shaders.

The result of that weekend? A complete, offline-first (PWA), zero-build-step 3D Battle Chess game set in the **Enchanted Swamp of Zurich (*Swamp-on-the-Limmat*)**: **[CarChess3D (🏰🚽 "Family Chess")](../index.html)**.

---

## ⏱️ 2. SRE Telemetry: Proving "Built in a Weekend" Down to the Second

As an old-school Site Reliability Engineer (SRE), marketing fairy tales don't impress me. I only trust hard numbers, immutable timestamps, and cryptographic git commit hashes.
Here is the exact telemetry extracted from `git log` and the **76 CarChess3D Antigravity sessions** across **`pupurabbux`** (`article/sources/chats_list.md`, 22 3D/GPU sessions) and **`derek`** (`article/sources/derek_chats_list.md` and [`article/DEREK_JETSKI_FORENSICS.md`](DEREK_JETSKI_FORENSICS.md), 54 orchestration, Swarm, and VLM Critic sessions):

```json
{
  "total_commits": 202,
  "kickoff_commit": "2026-10-09 15:34:37 +0200 (ff67ff8)",
  "latest_release": "v0.3.74 (69 incremental releases with 100% green `just test`)",
  "weekend_commits_oct9_11": 159,
  "commits_breakdown": {
    "Friday Oct 9 (Kickoff & 3D Pipeline)": 5,
    "Saturday Oct 10 (Autonomous /goal Sprint & Family Models)": 58,
    "Sunday Oct 11 (36 Battle Videos 16:9, Voices & Polish)": 96,
    "Monday–Thursday (Local RTX 5080 GPU, S1..S5 Clarity & Daily UAT)": 43
  },
  "antigravity_telemetry_derek": {
    "carchess_sessions": 54,
    "trajectory_steps": 16118,
    "human_prompts": 263,
    "avg_autonomous_steps_per_prompt": 55.4,
    "fresh_input_tokens": 46771223,
    "cache_read_tokens": 713281606,
    "context_cache_hit_ratio": "93.8%",
    "total_context_tokens": 760052829,
    "output_tokens_generated": 5341032
  },
  "verified_glb_models": 50,
  "node_unit_tests": "46 passed, 0 failed (duration: 6.85s)",
  "python_test_suites": "17 passed, 0 failed (duration: 0.38s)",
  "total_codebase_loc": "121,331 lines analyzed",
  "ip_safety_violations": 0
}
```

### ⚡ The `/goal` Sprint Stopwatch (Saturday, October 10)
At **10:31:42 CEST** on Saturday morning, right before heading out into the cobbled streets of Colmar, I launched a single `/goal` command inside an isolated git worktree (`etc/prompts/GOAL_BUILD_CARCHESS3D.md`). Here is the exact timeline recorded in the transcript:

| Phase | Time Window (CEST) | Duration | Deliverables Produced |
| :--- | :---: | :---: | :--- |
| **Phase 1: 2D Blueprint & Spatial Metric** | `10:31:42` → `10:40:59` | **9m 17s** | Metric [`docs/floorplan.svg`](assets/gallery/floorplan.svg) (`y=0.00m`), automatic `THREE.Box3` grounding utility. |
| **Phase 2: Headless Core & TDD** | `10:41:00` → `10:48:03` | **7m 03s** | `GameEventBus`, `Rng` (`mulberry32`), `BoardMapManager`, `DropManager` with a 10,000-capture Monte Carlo test. |
| **Phase 3 & 4: 4 Parallel Subagents** | `10:50:13` → `11:09:48` | **19m 35s** | **+10,081 lines of code written in 19 minutes** across 60 files (`ZurichSwampView`, `PieceView`, `VFXPoolView`, `HudListener`, PWA `sw.js`). |
| **Phase 5: Adversarial Critic Loop** | `11:13:00` → `12:18:33` | **65m 33s** | The Critic scores Round 1 at `6.2/10`, catches 5 defects (including the glTF `metallicFactor` trap), and iterates up to **9.9/10**! |

> 💡 **SRE Verdict**: From firing `/goal` (`10:31:42`) to a fully playable, unit-tested 3D WebGL chess game, **exactly 38 minutes and 6 seconds** elapsed.

### ⏳ How Long Can Gemini Actually Run Unattended?

The million-dollar question with AI coding agents is always: *"How long can they actually run on their own before hitting a wall or begging a human for help?"*

Looking at the raw Antigravity logs across both machines, here are the longest unattended autonomous runs:

| Session / Mission | Start Time (UTC) | Log Steps | Tool Calls | Subagents Spawned | Compute Span | Autonomous Outcome |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Kickoff & 3D Factory** (`940b9eac`) | Oct 09, 15:43 | **2,366** | **1,080** | **107 subagents** | 110h (session span) | Scaffold, multi-view generation, 26-bone Blender rigging, pipeline orchestration. |
| **MAIN Merger & Daily UAT Sentinel** (`83ee7dd5`) | Oct 10, 07:37 | **2,399** | **1,120** | — | 5 days continuous | Multi-machine git sync (`derek` ⇄ `pupurabbux`), English UI default, automated Playwright video UAT on GitHub Issues. |
| **Autonomous v1 `/goal` + 6×6 Swarm** (`31759f77`) | Oct 10, 08:31 | **2,667** | **1,240** | **15 workers** | 4 days | Complete v1 game in 38m, 5-worker 6×6 Swarm, 36 Veo 3.1 videos, family TTS voices & Lyria 3 strings. |
| **Issue #20: 12 GLB Reconstruction** (`18347678`) | Oct 13, 18:12 | **686** | **375** | — | **12h 12m non-stop** | High-resolution local GPU reconstruction of all 12 Classic and Swamp pieces on the RTX 5080. |

### 🍷🤖 Diario Parallelo Giorno per Giorno: Mentre Ero in Giro con Mia Moglie per Colmar (`<foto>`), Cosa Facevano i Loop Agentici (`XXh YYm`)?

Per dare il senso concreto di cosa significhi delegare un intero videogioco 3D a una flotta di agenti autonomi su due macchine (**`derek`** in ufficio e **`pupurabbux`** a casa con la RTX 5080), ecco il confronto minuto per minuto tra la nostra vita reale e i **10 Loop Agentici** (documentati al singolo secondo nel Post-Mortem SRE [`INVESTIGATION.md`](INVESTIGATION.md) e nel dossier [`DEREK_JETSKI_FORENSICS.md`](DEREK_JETSKI_FORENSICS.md)):

* **📅 Venerdì 9 Ottobre (Sera della Vigilia — `16h 33m` di Fabbrica 3D Notturna)**:
  Alle `19:43` chiudo il portatile per preparare le valigie per l'Alsazia `<foto: valigie_partenza_zurigo.jpg>`. Nel frattempo, per **16h 33m** (`17:41` → `10:17` del mattino dopo), `pupurabbux` scopre da solo il bug nascosto `/lambda_1` di TRELLIS, costruisce il Critic VLM automatico (`critic.py`), boccia da solo la prima versione dell'Alfiere Ale con `FA_CAGARE 💩` (*"ha due mezze teste di drago fuse nel busto!"*) e riassembla il personaggio con un'armatura scheletrica Blender a **26 ossa** ([`47c6c04`](https://github.com/palladius/carchess3d/commit/47c6c0467ba3cf9c4c8ef97021ca37c554b3a680)).
* **📅 Sabato 10 Ottobre Mattina (Passeggiata nella *Petite Venise* — `3h 12m` di Autonomia, 4 Loop Simultanei)**:
  Alle `10:31:42` lancio `/goal` e usciamo a camminare mano nella mano tra i canali e le case a graticcio di Colmar `<foto: colmar_petite_venise_con_kate.jpg>`. Mentre siamo in giro per **3h 12m** (`10:31` → `13:44`), i due computer eseguono 4 loop in parallelo:
  1. **Loop 1A (`0h 38m 06s`)**: 4 subagenti 3D paralleli scrivono **`+10.081` righe di codice** Three.js da zero al primo gioco 3D giocabile ([`d257880`](https://github.com/palladius/carchess3d/commit/d2578805cce92c153ad414c2de9bfa766f0728ed)).
  2. **Loop 1B (`1h 08m 37s`)**: L'*Adversarial Art Director* (`265ff1ca`) boccia il primo render (`6.2/10`), ripara il bug `metallicFactor = 1.0`, aggiunge la palude con ninfee e porta la scena a **`9.9/10`** ([`4c338a4`](https://github.com/palladius/carchess3d/commit/4c338a46cef710738eea383f6124c22c7fadfcfd)).
  3. **Loop 3 (`1h 54m 59s`)**: Uno Swarm cross-model con Claude `fable-5.1-high` (`@fable-reviewer`, `@art-critic`) + `@classic-builder` e `@swamp-builder` scolpisce due intere famiglie rivali (inclusi San Gennaro e la Torre Matildea, [`8ae3b86`](https://github.com/palladius/carchess3d/commit/8ae3b8626e71d4a3dfe8d98e189ea7fec985f37e)).
  4. **Loop 2 (`0h 56m 54s`)**: Tre agenti paralleli su `pupurabbux` restaurano in 3D la statuetta di **Regina Kate Nozze 2016** — proprio l'abito del matrimonio che stavamo festeggiando! ([`70f52da`](https://github.com/palladius/carchess3d/commit/70f52da0d5cbf6328fc3e65fadc3da40cbbe6749)).
* **📅 Sabato 10 Ottobre Pomeriggio & Sera (Brindisi col Riesling & Cena dei 10 Anni — `0h 47m` di Swarm + `10h 53m` di Cena)**:
  Mentre brindiamo con un calice di Riesling alsaziano `<foto: colmar_brindisi_riesling.jpg>`, mando dal telefono un solo messaggio: *"NON TAGLIARE angoli -> fai tutte le 36 combinazioni!"*. Uno Swarm nativo di **5 agenti** si divide le Issue `#10`–`#16` e in **0h 46m 46s** (`14:40` → `15:26`) consegna tutte le 36 coreografie 3D e gli scheletri a 23 giunti (`v0.3.0`), lasciandomi libero per **10h 53m** (`16:02` → `02:55`) per la cena romantica di anniversario `<foto: colmar_cena_anniversario.jpg>`.
* **📅 Domenica 11 Ottobre (Colazione con Kate & Rientro in Auto Colmar → Zurigo — `1h 46m` + `2h 38m` + `2h 09m`)**:
  Di notte, mentre dormiamo in hotel, il subagent `6b6faa1f` genera da solo tutti i **36/36 film 16:9** con Veo 3.1 in **1h 45m 51s** (`03:10` → `04:56`). A colazione `<foto: colmar_colazione_kate.jpg>` mostro i video a Kate, che nota subito alcune allucinazioni (*"qui la torre sparisce e riappare!"*): lancio il subagent `4930d699` (*Adversarial Video Critic*) che in **2h 38m 23s** (`08:28` → `11:06`) smonta tutti i 36 MP4 in strisce da 6 fotogrammi e li rigenera finché non superano tutti **`>= 8.0/10`**. Poi alle `14:19`, mettendomi al volante per tornare a Zurigo, scrivo: *"sono in viaggio -> crea un critic biometrico finché Re Riccardo non mi somiglia!"*. Mentre guido per **2h 09m** (`14:18` → `16:27`), il subagent `riccardo-likeness-critic` innesta la mia foto del Sudafrica sulla mesh 3D raggiungendo **`92/100`** di somiglianza biometrica ([`0597eaa`](https://github.com/palladius/carchess3d/commit/0597eaa5461e3228fc3dcfa501f53ead94850b99)).
* **📅 Martedì 13 – Mercoledì 14 Ottobre (La Notte della RTX 5080 a Luci Spente & Il Vero UAT coi Bimbi — `11h 50m` + `3h 22m`)**:
  Martedì sera alle `20:12` lancio sulla RTX 5080 di casa la ricostruzione ad alta risoluzione dei 12 modelli Classici e della Palude (`#20`). Alle `20:32`, vedendo la camera da letto illuminata dai LED della scheda video mentre Kate dorme, scrivo *"puoi spegnere le luci della nvidia?"*: l'agente spegne i LED e scolpisce mesh da 697k poligoni nel buio totale per **11h 50m 30s** fino alle `08:02` del mattino. Mercoledì pomeriggio arriva infine il **Vero UAT sul divano di casa** con Alessandro e Sebastian al tablet, mentre uno Swarm di 4 agenti lavora per **3h 21m 51s** (`0h 23m` di burst Swarm + benchmark VLM alla cieca) per aggiungere gli aiuti visivi `S1..S5`:

![Il Vero UAT: Alessandro e Sebastian giocano a CarChess3D sul tablet in salotto](assets/kids_playing_carchess3d.jpg)

---

## 👑👦👶 3. The Family Cuteness Factor: Who Is on the Board?

Instead of anonymous wooden horses and pawns, every piece in CarChess3D is an affectionate, slightly ridiculous caricature of our family:

| Chess Role | Character | Canonical 3D Model | Signature Detail & Catchphrase |
| :--- | :--- | :--- | :--- |
| **King 👑** | **King Riccardo (Dad)** | `king-riccardo.glb` | Royal crown, ermine-trimmed blue velvet cloak, scepter, and the unmistakable golden Toilet-Throne (the 🚽 pun that gives *CarChess* its name). |
| **Queen 👸** | **Queen Kate (Mum)** | `queen-kate.glb` | Navy eyeglasses, emerald eyes, gold-damask purple gown, amethyst ring, and her iconic line: *"Don't be FACETIOUS!"* |
| **Bishop 🐉** | **Bishop Ale (Alessandro)** | `bishop-ale-1.glb` / `bishop-ale-rigged.glb` | Blue-and-gold papal mitre with flowing *infulae*, cheeky grin, crosier staff, and an animated red baby dragon on his shoulder flapping its wings and yelling: *"Sei proprio un cafoNAZZO!"* |
| **Knight 🏎️** | **Knight Sebastian (Seby)** | `knight-seby.glb` | Gleaming gold plate armor atop his racehorse steed, raised fist with modular weapon socket (Blue Plasma Saber, Halberd, or Aquarium Orb), asking: *"Mummy, can you clean my bottooooom?"* |
| **Rook 🏰** | **Rook Pupurabbu** | `rook-pupurabbu.glb` | Seby's beloved fuzzy purple plushie peeking out with a huge smile from the battlements of a purple stone tower. |
| **Pawns 🐧** | **16 Swiss Guard Puffins** | `pawn-puffin.glb` | Atlantic puffins in striped papal Swiss Guard uniforms, steel morion helmets, red plumes, halberds, and a signature finisher: a **giant wet fish slap to the face** 🐟! |

### 💜 The Brotherly Easter Egg: The "Mega Fluffy Cuddle"
Inside the combat rules engine (`src/managers/CombatAnimationManager.js`), one hard-coded law is sacred: **Sebastian and his plushie Pupurabbu can never hurt each other**.
Whenever Knight Seby captures Rook Pupurabbu (or vice versa), there is no explosion and no knock-out: the two rush together into a **SUPER FLUFFY HUG! 💜🤗** while a shower of 3D pink hearts rains down over the board!

### 🐸 The Ogre's Swamp Party
Captured pieces don't vanish into a boring sidebar graveyard. They fly along a parabolic arc, splash into the **Enchanted Swamp** beneath the Grossmünster towers, and **bob happily on floating lily pads** amid glowing ripples and swamp fireflies!

![Swamp Party with captured pieces floating on lily pads](assets/gallery/swamp_party.png)

### 👨‍👦‍👦 The Real UAT (*User Acceptance Testing*): Ale & Seby on the Tablet
No automated test suite can beat the final sign-off from the actual customers: here are **Alessandro (🐉)** and **Sebastian (🏎️)** heads-down on the tablet playing CarChess3D, with the 3D pieces on the board and the swamp lily pads glowing in the background!

![Alessandro and Sebastian playing CarChess3D on the tablet](assets/kids_playing_carchess3d.jpg)

---

## 🎠 4. WOW Gallery: The Carlesso Family Figurines

These are the 2D concept turnarounds (front + 3/4 view) generated with **Nano Banana 2.1** from real family photos. They are the "ground truth" every 3D engine had to chase:

| Dad (King Riccardo 🚽👑) | Mum (Queen Kate 👸💜) |
| :---: | :---: |
| ![King Riccardo concept turnaround](assets/concept/king_riccardo_turnaround.jpg) | ![Queen Kate concept turnaround](assets/concept/queen_kate_turnaround.jpg) |
| *Royal crown, ermine-trimmed cloak, scepter and golden "Riccardo" plaque* | *Purple damask gown, gold ring, and navy glasses* |

| Bishop Ale & His Dragon (🐉💎) | Knight Seby on His Steed (🏎️✨) |
| :---: | :---: |
| ![Bishop Ale concept turnaround](assets/concept/bishop_ale_turnaround.jpg) | ![Knight Seby concept turnaround](assets/concept/knight_seby_turnaround.jpg) |
| *Episcopal mitre, crozier and shoulder dragon* | *Silver armor, blue cape and wooden lance on his warhorse* |

| Pawn Puffin (Swiss Guard 🐧🛡️) | Rook Pupurabbu (Purple Fluffy Tower 🏰💜) |
| :---: | :---: |
| ![Pawn Puffin concept turnaround](assets/concept/pawn_puffin_turnaround.jpg) | ![Rook Pupurabbu concept turnaround](assets/concept/rook_pupurabbu_turnaround.jpg) |
| *Morion helmet with red plume and halberd* | *A fluffy purple monster peeking out of a stone keep* |
---

## 🔬 5. Technical Deep Dive: Sculpting 3D Pieces from Family Photos

Turning a casual smartphone photo into a watertight, UV-textured, metrically grounded `.glb` ready for 60 FPS WebGL on mobile required a four-engine assembly line:

```mermaid
graph TD
    A["Real Family Photo"] -->|Nano Banana 2.1 Prompting| B["4-View Orthographic Turnaround (Front, Side, Back, 3/4)"]
    B -->|Strategic Routing| C{"3D Engine Selection"}
    C -->|Cloud ZeroGPU| D["TRELLIS.2 Multi-Image (/lambda_1 fix)"]
    C -->|Local GPU pupurabbux RTX 5080| E["Hunyuan3D-2 Shape DiT (32s)"]
    C -->|Parody / Classic Pieces| F["Mode A: Dual-Orthographic SDF + Taubin"]
    E --> G["Quadric Edge Collapse Decimation (697k -> 60k faces)"]
    D --> H["VLM & Geometric Critic Audit"]
    G --> H
    F --> H
    H -->|Defects or Generic Face?| I{"Critic Verdict"}
    I -->|Top Quality >= 8.0| J["Approved in assets/models/*.glb"]
    I -->|Rejected 'FA_CAGARE'| K["Mode B: Planar Face-Grafting 2048x1024"]
    I -->|Props Fused into Torso| L["Mode C: Blender Modular Remaster & Rigging"]
    K --> J
    L --> J
```

### Step 1: From Smartphone Photo to 4-View Orthographic Turnaround with Nano Banana 2.1
3D diffusion models hate wide-angle perspective distortion. Using **Nano Banana 2.1 (`gemini-nano-banana-2.1`)** and **Nano Banana Pro (`gemini-3-pro-image-preview`)**, we generated strict orthographic sheets:
- **Front (0°)**: symmetrical heroic pose.
- **Side (90°)**: pure lateral profile (essential for King Riccardo's nose/crown profile and the Swamp Donkey's snout).
- **Back (180°)**: full rear view (preventing 3D models from having flat, hallucinated, or unpainted backs).
- **3/4 Isometric**: volumetric depth reference.

### Step 2: The Four 3D Reconstruction Engines

#### Engine 1: Cloud Multi-View Diffusion (TRELLIS) and the Undocumented `/lambda_1` Bug
TRELLIS produces great PBR meshes, but we uncovered a nasty bug in its Gradio backend: calling the API via Python silently ignored every image after the first because the internal `is_multiimage = gr.State(False)` flag was only toggled when a human clicked the "Multiple Images" tab in the browser UI — which fired an undocumented endpoint named **`/lambda_1`**.
Once our script (`gen_mv.py`) explicitly invoked `/lambda_1` right after `/start_session`, TRELLIS finally fused front, side, and back views together!

#### Engine 2: Local GPU Pivot on `pupurabbux` (NVIDIA RTX 5080 + TurboSebux)
When Hugging Face ZeroGPU hit quota limits (*"Exceeded ZeroGPU quota"*), the agent didn't stall waiting for a credit card. It pivoted autonomously to my home PC's local hardware:
- **External Samsung T7 SSD**: mounted a 600 GB ext4 loop volume at `<external-ssd>` so root `/` wouldn't fill up.
- **Hunyuan3D-2 Shape**: generated complete meshes locally in **32 seconds** using just **5.6 GB of VRAM** on the RTX 5080.
- **Blackwell `sm_120` CUDA PTX JIT Fix**: Because prebuilt PyTorch/rasterizer wheels didn't yet include native binaries for NVIDIA's new Blackwell `sm_120` architecture (`cudaErrorNoKernelImageForDevice`), the agent recompiled `custom_rasterizer_kernel` with `TORCH_CUDA_ARCH_LIST="9.0+PTX"`, leveraging the NVIDIA driver's PTX JIT compiler.

#### Engine 3: What on Earth Is "Quadric Edge Collapse" (10× Decimation)? 📐
A raw Marching Cubes mesh out of Hunyuan3D-2 has **697,264 triangles (12.5 MB)** per piece. Multiply that by 32 pieces on the board (**22+ million polygons**) and any mobile browser crashes instantly.
We integrated **Quadric Edge Collapse (QEC)** (Garland & Heckbert, 1997):
- Every vertex $v$ gets a $4 \times 4$ symmetric error matrix $Q$ representing the sum of squared distances to all incident triangle planes: $E(v) = v^T Q v$.
- Contracting an edge $(v_1, v_2) \to \bar{v}$ simply adds their matrices ($\bar{Q} = Q_1 + Q_2$) and places $\bar{v}$ at the point minimizing $\bar{v}^T \bar{Q} \bar{v}$.
- **Result**: from **697,264 faces down to 60,000 faces** (12.5 MB → 1.0 MB) in **9.9 seconds**, preserving 100% of facial contours and crown ridges while stripping 91.4% of redundant flat-surface triangles!

#### Engine 4: Mode B Biometric Face-Grafting ($2048 \times 1024$ Dual-Chart WebP Atlas)
My initial King mesh looked like a generic, clean-shaven doll. When I complained (*"Better, but it still doesn't look like me! Build an adversarial likeness critic using my 5 reference photos!"*), the agent built a **Biometric Likeness Critic (`riccardo-likeness-critic`)** scoring **8 facial landmarks** (hooded smiling brown eyes, vertical glabellar crease, white tuft on the left eyebrow, rounded nose tip, wide grin, 2-day salt-and-pepper stubble, silver temples, no glasses) and implemented **Mode B Planar Face-Grafting**:
- Expanded the UV atlas to $2048 \times 1024$: the left half ($u \in [0, 0.5]$) keeps the original 3D robe/crown texture, while the right half ($u \in [0.5, 1.0]$) projects my real South Africa photo onto the 1,483 facial triangles with multi-band Laplacian skin harmonization ($\sigma = 26.0$).

### 📸 Three-Stage Visual Evolution: The Classic King (Issue #20)

Here is the actual inspection card comparing the 2D turnaround, the legacy procedural placeholder, and the reconstructed 3D mesh:

![Classic King Evolution: 2D Concept -> Low-Poly Procedural -> Reconstructed 3D](assets/gallery/classic_king_evolution_card_en.png)

And here are my two favourite reconstructions, the **Classic Rook** (*Matilda's Tower*, Mode A Dual-Orthographic SDF) and the **Classic Bishop** (*Don Spadaccino*, TRELLIS.2 multi-view), each shown as **Concept Art → Procedural placeholder → Reconstructed 3D** (full Before/After lineups of both factions in [`article/SHOWCASE_BEFORE_AFTER.md`](https://github.com/palladius/carchess3d/blob/main/article/SHOWCASE_BEFORE_AFTER.md)):

![Classic Rook Evolution: 2D Concept -> Low-Poly Procedural -> Reconstructed 3D](assets/gallery/classic_rook_evolution_card_en.png)

![Classic Bishop Evolution: 2D Concept -> Low-Poly Procedural -> Reconstructed 3D](assets/gallery/classic_bishop_evolution_card_en.png)

---

## 🤖💩 6. The Adversarial Critic Loop: Separation of Powers

Left to themselves, generative pipelines happily ship deformed meshes or broken shaders. To prevent this, we enforced a strict **separation of powers**:
- **Builder Agents** (write code, sculpt 3D models, render videos).
- **Adversarial Critic Agents** (isolated read-only verifiers armed with Gemini VLM, Claude Fable 5.1 High, and Blender Cycles/EEVEE).

After every 3D build, a headless script shoots a 4-camera contact sheet (`3/4 Overview`, `Close-Up`, `Ground Test y=0.00m`, and `Wireframe`) and updates `docs/qa-scores.yaml`:
- `TOP_QUALITY 🟢` ($\ge 8.0/10$)
- `ACCEPTABLE 🟡` ($6.0 - 7.9/10$)
- **`FA_CAGARE 💩`** ($< 6.0/10$ — literally *"it sucks"* in Italian)

If a model gets stamped `FA_CAGARE 💩`, `just shittest` fails the build and forces a modular rebuild — which is how **Bishop Ale v2** (rejected at `4.0/10` because multi-view fusion produced *"two half-dragons fused into his chest"*) was rebuilt into a clean 26-bone modular rig!

### 🧪🎬 L'Agente UAT Giornaliero che Gioca a Scacchi da Solo e Apre GitHub Issue col Film della Partita ([#36](https://github.com/palladius/carchess3d/issues/36))

I test unitari in Node.js e Python sono fondamentali, ma in un videogioco 3D con WebGL, shader custom, Service Worker e Web Worker AI il vero nemico è la regressione silenziosa: la telecamera che ruotando a `180°` finisce dentro un muro mostrando uno schermo nero, i pezzi bianchi e neri che guardano nella stessa direzione, o il computer che smette di rispondere dopo una cattura.

Così, alle `03:29` di domenica 11 ottobre, ho dato allo Standing MAIN Merger un prompt folle:
> *"Fai un cron GIORNALIERO che fa unit test, dà un'occhiata al codice overall e prova a fare una partita lui (integration test) e registra un video del suo UAT (max 1 minuto) facendo cose normali e cose pazze tipo cliccare 10 volte un bottone per vedere se si rompe... e genera una GHI chiamata `Gemini UAT $YYYYMMDD` col film della partita attaccato!"*

Il risultato è [`scripts/daily_uat_playtest.py`](../scripts/daily_uat_playtest.py) (`just daily-uat`), che ogni mattina lancia Google Chrome in modalità WebGL, registra un video di 60 secondi mentre gioca contro `CPU Easy`, misura la luminanza e la deviazione standard dei pixel su ogni inquadratura per certificare l'assenza di black screen, carica i file `.mp4` e `.gif` su una GitHub Release taggata `uat-media-$YYYYMMDD` e pubblica un report automatico come **[GitHub Issue #36 — `Gemini UAT 20261015`](https://github.com/palladius/carchess3d/issues/36)** (e la capostipite [#18 — `Gemini UAT 20261011`](https://github.com/palladius/carchess3d/issues/18)):

![Registrazione reale dell'Agente UAT Giornaliero (GitHub Issue #36) mentre ruota la camera, attiva gli scheletri 3D, tuffa i pezzi nella palude e gioca contro la CPU](assets/gallery/daily_uat_gameplay_20261015.gif)

Ecco i **9 gate automatici (`9 / 9 PASS`)** eseguiti e certificati nell'Issue [#36](https://github.com/palladius/carchess3d/issues/36):

| Gate / Sottosistema | Esito | Metriche Reali Misurate dall'Agente (`2026-10-15 10:27 CEST`) |
| :--- | :---: | :--- |
| **`engine_boot`** | ✅ PASS | `window.__CARCHESS__` inizializzato con tutti i manager e le viste 3D |
| **`piece_orientations`** | ✅ PASS | Bianchi orientati a Nord (`3.142 rad`), Neri orientati a Sud (`0.0 rad`) faccia a faccia |
| **`camera_flip_180`** | ✅ PASS | Luminanza media: `93.4/255`, Contrasto `stddev: 69.0` (zero black screen) |
| **`camera_top_down`** | ✅ PASS | Luminanza media: `84.2/255`, Contrasto `stddev: 72.2` |
| **`skeletons_toggle`** | ✅ PASS | Armature ossee 3D visibili sui pezzi vivi e nella palude |
| **`swamp_party`** | ✅ PASS | 6 pezzi che nuotano e beccheggiano sulle ninfee del fossato |
| **`matrix36_modal`** | ✅ PASS | Matrice interattiva `6×6` (36 combinazioni) e link `./showcase/?view=pov` verificati |
| **`wow_mode`** | ✅ PASS | Mode 2 WOW Turntable Inspector & Arena attiva con controlli personaggio |
| **`match_gameplay`** | ✅ PASS | 8 mosse giocate tra Agente UAT e `CPU Easy` (latenza media CPU: **`458 ms`** vs target `< 1500 ms`) |

---

## 🐝🎬👁️ 7. Inside the 8 Autonomous Antigravity Loops, Multi-Agent Swarms & Daily UAT

Beyond the 3D asset factory on `pupurabbux`, **Antigravity** on **`derek`** ran **8 major autonomous loops** (full forensic dossier in [`article/DEREK_JETSKI_FORENSICS.md`](DEREK_JETSKI_FORENSICS.md)):

```mermaid
flowchart TD
    U["🦖 RiccardinoCM26 on derek"] --> L1["🚀 Loop 1: /goal Full Autonomous Build v1 (31759f77)\n4 Parallel 3D Subagents + 4-Round VLM Critic (6.2 -> 9.9/10)"]
    U --> L2["🐝 Loop 2: 5-Worker Native Swarm 6x6 (Issues #10-#16)\n4 File-Isolated Builders + 1 Read-Only Adversarial Swarm Critic"]
    U --> L3["🎬 Loop 3: 36-Battle Nano Banana + Veo 3.1 + Video Critic\nSubagent 6b6faa1f (Gen) + Subagent 4930d699 (Audit >= 8/10)"]
    U --> L4["🗿 Loop 4: Multi-Model Swarm (Fable 5.1 + Argon) + Mode A/B 3D\nClassic & Swamp + Biometric Likeness Critic (8 facial traits)"]
    U --> L5["⏱️ Loop 5: Standing MAIN Merger & Cron Sentinel (83ee7dd5)\n5m/60m Sync derek ⇄ pupurabbux + Daily Playwright UAT Video"]
    U --> L6["🍿 Loop 6: Cinema XXL 16:9 + 10s Pacing (1s+8s+1s) + Audio +15%\nPlaywright Multi-Angle Camera Sim + Zero-Loop Sequencer"]
    U --> L7["📱 Loop 7: Pixel 10 & Tab S9 Ultra WebGL + SW Self-Healing\nDe-Poisoning nocache.html + Lazy GLB Cache + Portrait Scale"]
    U --> L8["👁️ Loop 8: 5-Agent Piece Clarity & Blind VLM Recognizer Swarm\nS1..S5 Visual Aids + Blind VLM Role/Color Accuracy Benchmark"]
```

### 1. 🐝 The 5-Worker Native Swarm "Zero-Corner-Cutting" (`Issues #10–#16`)
When I told the agent *"Do NOT cut corners — open an issue for every gap and run an adversarial swarm, even if it takes two days!"*, the orchestrator spawned **5 concurrent Swarm workers** on a shared message board with **strict per-file ownership** so merge conflicts were mathematically impossible:
- **`@matrix36-choreo`**: sole owner of `BattleMatrix36.js` and all **72 video files (`36 .mp4` + `36 .webm`)**.
- **`@brawl3d-vfx`**: owner of `CombatAnimationManager.js` — 3-Act 3D comic brawl (`CHARGE!` → `COUNTERATTACK!` → `K.O.!` into the swamp lily pads).
- **`@skeletons-locomotion`**: owner of `SkeletonRigHelper.js` — **23 articulated 3D joints**, 8-step walk cycle (`2.0s`), and knight gallop (`2.2s`).
- **`@explorer6x6-ux`**: owner of `battles.html` and `HudListener.js`.
- **`@adversarial-critic`**: **Read-Only Verifier** running `scripts/adversarial_swarm_audit.py` to audit the other 4 workers before granting the green light.

### 2. 🎬 The 36 Nano Banana 2.1 + Veo 3.1 Battle Videos & Kate's Adversarial Video Critic (`>= 8.0/10`)
Whenever a piece is captured, the surrounding 3D world dims, the chessboard fades to `90%` transparency (`alpha = 0.10`), the HUD disappears, and a giant **16:9 Cinema XXL screen (`videoBoost = 1.75`)** rises behind the two fighters with a **`10.0s` timeline (`1s pre-roll + 8s Veo video + 1s post-roll`)** and **`+15%` zero-loop combat music**.
When I showed the first batch of 36 Veo videos to my wife Kate, she immediately spotted hallucinations: towers vanishing mid-clip or a second Puffin materializing out of thin air. So we spawned an **Adversarial Video Critic** subagent (`4930d699`) that extracted a **6-frame contact strip (`t = 0.0s..7.5s`)** for all 36 `.mp4` videos, checked for 4 forbidden defects, logged every score in `docs/battles/video_audit.yaml`, and regenerated every rejected clip until all 36 scored `>= 8.0/10`!

![16:9 Battle Filmstrip generated with Nano Banana 2.1 + Veo 3.1](assets/gallery/mp4_filmstrip.png)

### 3. 👁️ The 5-Agent Visual Clarity Swarm (`S1..S5`) & Blind VLM Recognizer (`Issue #32`)
Playing with the kids on the tablet revealed a real UX issue: from overhead (`0°` zenithal and `30°` semi-high), the figurines were so richly detailed that telling White from Black — especially in a *Carlesso vs. Carlesso* mirror match — caused visual fatigue.
A 5-agent Swarm built **5 combinable visual clarity modes (`S1..S5`)** in `PieceClarityHelper.js` (Deep Matte Obsidian vs. Warm Ivory pedestals, universal 3D role add-ons baked into all 22 `.glb` files, pedestal role wreaths, and zenithal 2D tournament medallions) and tested them with a **Blind VLM Recognizer** (`gemini-flash-latest` asked *blindly* to identify piece roles and colors across 36 renders). Recognition jumped from **`5.00/10` (`Off`) to `9.50/10` (`S5 Hybrid All-In`)** with a `2.13×` luminance contrast ratio (full report in [`article/SHOWCASE_VISUAL_CLARITY.md`](SHOWCASE_VISUAL_CLARITY.md)):

![0° vs 30° Visual Clarity Benchmark: Off vs S1..S5 evaluated by the Blind VLM Recognizer](assets/clarity_comparison_0deg_30deg.png)

### 4. 🧪🤖 Autonomous "Daily UAT Review" with Antigravity on GitHub Issues ([`label:"gemini-uat"`](https://github.com/palladius/carchess3d/issues?q=state%3Aopen%20label%3A%22gemini-uat%22))
One of my absolute favorite engineering workflows in this project is the **fully autonomous Daily UAT Review** powered by **Antigravity**:
- Every day, a standing scheduled task in Antigravity runs `just daily-uat` (`scripts/daily_uat_playtest.py` + `etc/prompts/daily_uat_prompt.md`).
- The agent launches headless Chromium via Playwright, verifies **9 functional and visual gates** (`engine_boot`, `piece_orientations`, `camera_flip_180`, `camera_top_down`, `skeletons_toggle`, `swamp_party`, `matrix36_modal`, `wow_mode`, `match_gameplay`), plays an actual chess match against CPU Easy through a capture cutscene, performs **monkey-testing** (like rapidly clicking the `🐸 Swamp` button 10 times in a row to verify that exactly 6 pieces swim on lily pads without duplicating or crashing WebGL), and records a **complete `< 60s` gameplay film (MP4 + GIF)**.
- Finally, it uploads the video assets to a dedicated release tag (`uat-media-YYYYMMDD`) and automatically opens or updates a GitHub Issue tagged **`gemini-uat`**!
- You can browse all live daily reports, telemetry tables, and AI-recorded gameplay films directly on GitHub:
  👉 **[GitHub Issues: `state:open label:"gemini-uat"`](https://github.com/palladius/carchess3d/issues?q=state%3Aopen%20label%3A%22gemini-uat%22)** (see [Issue #18 — `Gemini UAT 20261011`](https://github.com/palladius/carchess3d/issues/18) and [Issue #36 — `Gemini UAT 20261015`](https://github.com/palladius/carchess3d/issues/36)).

![Automated Daily UAT Playtest Recording (Antigravity + Playwright)](https://github.com/palladius/carchess3d/releases/download/uat-media-20261015/uat_gameplay.gif)

---

## 💛 8. Niccolò's Game Architecture (`niccolo-game-design`)

To avoid the dreaded "AI Spaghetti Monster" (a monolithic 5,000-line `game.js` tangled in `if/else` chains), CarChess3D strictly enforces the 7 laws of the **Niccolò Game Design** skill:

1. **One Manager = One Responsibility ($\le 300$ LOC per file)**:
   - `BoardMapManager.js`: owns all chess rules (check, checkmate, stalemate, castling, en passant, promotion).
   - `DropManager.js`: owns the kid-friendly **🍀 Luck Meter (Pity Timer)** — every capture adds luck points by piece value (`Pawn=1, Knight/Bishop=3, Rook=5, Queen=9`), guaranteeing a 100% *Golden Crit* sticker drop at 12 points!
   - `CombatAnimationManager.js`: looks up `BATTLE_MATRIX[attacker][defender]` declaratively with zero `if/else` ladders.
2. **100% Headless Core**:
   `src/core/`, `src/managers/`, and `src/ai/` contain zero references to `document`, `window`, or `THREE`. They run in pure Node.js in under 1.5 seconds with full test coverage.
3. **Deterministic Queued `GameEventBus`**:
   Events describe past facts (`PIECE_CAPTURED`, `LUCK_CHANGED`), are queued by `emit()`, and are flushed once per fixed tick ($1/30\text{s}$) by `flush()`, eliminating re-entrancy bugs and race conditions.
4. **Listeners, Never Callers**:
   3D views, WebAudio, HUD, and localStorage subscribe to events. Game logic managers never call `sound.play()` or mutate DOM nodes directly.

---

## 🎮 9. Try It Yourself in 10 Seconds

Zero heavy installs, zero bundlers, zero Webpack or Vite:

```bash
# Clone the repo and start the static server
just serve
```

Or play directly online on GitHub Pages:
- 🏰 **CarChess3D Full Game**: [`https://palladius.github.io/carchess3d/`](https://palladius.github.io/carchess3d/)
- 🐸 **Swamp Party with Captured Pieces**: [`https://palladius.github.io/carchess3d/?swamp_party=1`](https://palladius.github.io/carchess3d/?swamp_party=1)
- 🟢 **Legal Move Dots & Capture Reticles**: [`https://palladius.github.io/carchess3d/?demo_moves=1`](https://palladius.github.io/carchess3d/?demo_moves=1)
- 🎬 **Heroes POV Cinema & Family Soundboard**: [`https://palladius.github.io/carchess3d/showcase/?view=pov`](https://palladius.github.io/carchess3d/showcase/?view=pov)
- 📸 **Visual Progress Gallery (Round 1 → Round 4)**: [`https://palladius.github.io/carchess3d/progress.html`](https://palladius.github.io/carchess3d/progress.html)

---

## 🥂 10. Conclusion: Engineering in the Age of Autonomous Swarms

Two years ago, building a custom 3D video game starring your own family — complete with watertight textured meshes, skeletal rigging, event-driven architecture, a Web Worker chess AI, 36 AI battle cutscenes, baroque string music, and bilingual voice acting — would have taken an indie studio four months and tens of thousands of euros.

Today, combining frontier models like **Gemini 4 Argon**, **Antigravity**'s multi-agent orchestration, solid SRE guardrails, and ruthless adversarial critics, the entire universe came together over **a single anniversary weekend** while the human was clinking Riesling glasses in Colmar.

The best technology isn't the one that chains you to a screen — it's the one that works quietly in the background, leaving you free to live your life with the people you love.

*Have a great match, from the Carlesso Family!* 🦖👑👸🐉🏎️💜🐧
