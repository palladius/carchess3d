# 🎯 `/goal` — Autonomous Adversarial 3D Reconstruction & Evaluation Swarm (`+30%` Quality Gate)

You are running in unattended **Autonomous `/goal` Mode** on `pupurabbux` (NVIDIA GeForce RTX 5080 + `~/TurboSebux/carchess3d` local Hunyuan3D-2 Shape & Paint pipeline).
Your mission is to autonomously reconstruct, decimate, texture, and verify the remaining 3D chess figurines (starting with the **Swamp Family**: Asinello Knight, Orco King, Orchessa Queen, Focaccina Bishop, Draghessa Rook, Tappo Pawn, followed by any sub-8.5 Classic/Carlesso pieces) using an **Adversarial Builder–Critic Swarm** that eliminates the human from the QA loop.

---

## 🏛️ 1. Architecture: Strict Separation of Powers (Builder vs. Critic Swarm)

Organize your work as an adversarial multi-agent loop with **strict role separation** (do not let the agent that generates a mesh grade its own work):

1. **🔨 Builder Agent(s) (`3d-builder`)**:
   - Generates or refines clean cartoon-stylized 2D concepts (avoiding noisy real-world photographic skin textures — see [`article/LESSON_LEARNT_FACE_GRAFTING.md`](../../article/LESSON_LEARNT_FACE_GRAFTING.md)).
   - Runs **Hunyuan3D-2 Shape** (`just local3d-shape`) on the local RTX 5080 GPU via `~/TurboSebux/carchess3d`.
   - Decimates raw ~700k meshes down to the **60,000-triangle WebGL budget** via Quadric Edge Collapse (Garland & Heckbert, 1997) while preserving open crowns/ears/props and grounding at `y = 0.00m`.
   - Runs **Hunyuan3D-2 Paint** (`just local3d-paint`) with continuous UV unwrapping (NEVER weld across UV seams with raw `bmesh.ops.remove_doubles` without preserving UV boundaries).
   - Generates multi-tier LODs (`-10k.glb` and `-50k.glb`) via `tools/model-pipeline/lod/generate_lod_tiers.py`.

2. **⚖️ Adversarial Critic Agent (`3d-eval-critic`, Read-Only Judge)**:
   - Runs [`tools/model-pipeline/critic/eval3d_benchmark.py`](../../tools/model-pipeline/critic/eval3d_benchmark.py) (`just eval3d <candidate.glb> --baseline <previous.glb> --concept <concept.jpg>`).
   - Evaluates the **6-Panel Forensic Contact Sheet** (`0° Front`, `45° 3/4`, `90° Profile`, `180° Back`, **`Panel 5: MACRO FACE/HEAD CLOSE-UP`**, and **`Panel 6: MACRO CLAY GEOMETRY`**).
   - Enforces the **Literature-Grounded `+30%` Improvement Gate** before allowing any model to be promoted to `assets/models/`.

---

## 📚 2. Scientific & Literature Grounding of the Evaluation Metric (`just eval3d`)

Every candidate 3D model is scored on a combined **Objective + Subjective Multimodal Benchmark** (`0.0 – 10.0`) implemented in [`tools/model-pipeline/critic/eval3d_benchmark.py`](../../tools/model-pipeline/critic/eval3d_benchmark.py):

1. **Objective Photometric & Geometric Metrics ($S_{\text{obj}}$, weight `45%`)**:
   - **Anti-Blotchiness / *"Anti-Butterato"* Laplacian Skin Smoothness** (*CarChess3D Face-Grafting Lesson Learnt, 2026*):
     Subtracts the normalized luminance of **Panel 6 (Macro Clay Geometry)** from **Panel 5 (Macro Textured Face)** to isolate pure texture artifacts from 3D shading, then measures the 80th-percentile gradient energy ($\nabla(L_{\text{tex}} - L_{\text{clay}})$) and local $8\times8$ patch deviation inside the facial ROI. Smooth stylized PBR skin scores $\ge 8.0/10$; blotchy photo-grafts or torn UV seams score $< 4.0/10$.
   - **Polygon Budget & Mesh Hygiene** (*Garland & Heckbert, SIGGRAPH 1997*):
     Target window `[15,000 .. 68,000]` triangles (`10.0/10`), penalizing bloated $>120\text{k}$ meshes or over-decimated $<5\text{k}$ placeholders, plus zero stray floating islands and strict `y = 0.00m` grounding.
   - **Multi-View Albedo & Silhouette Coherence** (*T³Bench, He et al. 2023*):
     Measures foreground coverage symmetry and RGB chrominance stability across `0° Front`, `90° Side`, and `180° Back` renders (penalizes unpainted black/grey backs or Janus twin-face artifacts).
   - **Upper Silhouette Articulation**:
     Measures contour perimeter complexity in the top 28% head/crown region (distinguishing perforated crowns, ears, and horns from solid extruded cylinders).

2. **Subjective Multimodal VLM Pairwise Judge ($S_{\text{subj}}$, weight `55%` when `GEMINI_API_KEY` is set)**:
   - Inspired by **GPTEval3D** (*Wu et al., CVPR 2024*), Gemini Multimodal inspects the 2D Concept, the **Baseline 6-Panel Sheet**, and the **Candidate 6-Panel Sheet** side by side, rating:
     - `candidate_face_cleanliness` (`0–10`)
     - `candidate_concept_likeness` (`0–10`)
     - `candidate_geometry_and_props` (`0–10`)
     - `candidate_back_coherence` (`0–10`)

3. **The Promotion Exit Gate (`+30%` Rule)**:
   A candidate `.glb` is accepted **ONLY IF**:
   - Its **Composite Score** or **Face Smoothness Score** improves by **$\ge +30.0\%$** over the existing baseline model (`overall_improvement_pct >= 30.0` or `face_smoothness_improvement_pct >= 30.0`), **OR**
   - Its absolute Composite Score reaches **$\ge 8.5/10$** with zero critical VLM defects.
   - If the gate fails (`exit code 1`), the Critic rejects the model with actionable root-cause feedback and the Builder must iterate (up to 3 attempts per piece).

---

## 🗺️ 3. Prioritized Work Queue (Piece-by-Piece Milestones)

Execute the following queue sequentially, committing and verifying after each piece:

1. **Milestone 1 — Swamp Knight (`knight-swamp-asinello.glb`)**:
   - Audit the local Hunyuan3D-2 PBR Asinello against the legacy low-poly `assets/models/swamp/knight-swamp-asinello.glb` with `just eval3d`, generate `-10k.glb` LOD, update `docs/models-provenance.yaml` (if tracked), and render 360° turntable GIF + 6-panel forensic comparison under `showcase/` and `article/assets/`.
2. **Milestone 2 — Swamp King (`king-swamp-orco.glb`)**:
   - Reconstruct the Swamp Ogre King at 60k faces using `just local3d-shape` + QEC decimation + `just local3d-paint` from `assets/characters/king-swamp-orco-1.jpg` (clean cartoon skin, expressive ogre ears, wooden crown, zero blotches). Verify $\ge +30\%$ improvement over baseline `assets/models/swamp/king-swamp-orco.glb`.
3. **Milestone 3 — Swamp Queen (`queen-swamp-orchessa.glb`)**:
   - Reconstruct Swamp Ogress Queen at 60k faces with clean PBR baking, verify $\ge +30\%$ improvement over baseline `assets/models/swamp/queen-swamp-orchessa.glb`.
4. **Milestone 4 — Swamp Bishop (`bishop-swamp-focaccina.glb`), Rook (`rook-swamp-draghessa.glb`), and Pawn (`pawn-swamp-tappo.glb`)**:
   - Complete the entire 6-piece Swamp Family lineup with 60k PBR meshes + 10k LODs, verifying every piece passes `just eval3d` with $\ge +30\%$ improvement.
5. **Milestone 5 — Showcase & Article Dossier (`article/SHOWCASE_SWAMP_3D_REMASTER.md`)**:
   - Generate a unified Before/After 6-piece Swamp Family comparison board and 360° turntable gallery, park all visual assets in `article/assets/` and `showcase/`, and update `docs/qa-scores.yaml`.

---

## 🛡️ 4. Non-Negotiable Guardrails & Exit Gates

- **Storage Hygiene**: Keep all heavy intermediate `.glb` and cache files on `~/TurboSebux/carchess3d` (`just turbosebux`). Never fill up `/`.
- **IP & Public Repo Safety**: Strictly obey `etc/ip-denylist.txt` (use generic Italian terms: *orco, orchessa, asinello, focaccina, draghessa, tappo*). Never commit secrets or literal `/home/<user>/` paths.
- **Continuous Verification**: After every promoted piece:
  1. Run `just eval3d` and archive the JSON report + 6-panel sheet.
  2. Run `just test` (must pass 100%: GLB bounds, provenance MD5s, Node & Python suites, IP denylist, secret scan).
  3. Bump `VERSION`, append a detailed entry to `CHANGELOG.md` with the exact `eval3d` before/after scores and `%` improvement, and `git commit && git push`.
