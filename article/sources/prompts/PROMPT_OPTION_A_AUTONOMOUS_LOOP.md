# TASK: Option A — Autonomous VLM Feedback & Refinement Loop for 3D Pieces

## Context & Objectives
In CarChess3D (`carlesso-family/chess3d`), we generate 3D models from 2D turnaround concepts using TRELLIS.2 / TRELLIS on Hugging Face ZeroGPU.
Currently, generations are done one-shot, and some models (e.g. Kate Nozze 2016 `queen-kate-wedding2016.glb`, Ale v2 `bishop-ale-2.glb`) suffer from artifacts, fused props, or distorted faces.

We already built a QA Critic system in `tools/model-pipeline/critic/`:
- `critic_vlm.py`: Blender headless 4-view contact sheet + Trimesh geometric checks + Gemini Flash VLM scoring (Face likeness, Secondary companion, Back view, Flaws, Pass/Fail, QA Tier).
- `render_contact_sheet.py`: 4-view isometric/ortho render of any GLB.
- `scoreboard.py` / `docs/qa-scores.yaml`: Central scoreboard tracking quality tiers.

Your mission is to build the automated **Self-Correction & Refinement Loop** (`tools/model-pipeline/critic/refine_loop.py`) that systematically iterates, critiques, and selects the winning 3D model.

---

## Detailed Requirements

1. **Build `tools/model-pipeline/critic/refine_loop.py`**:
   - Takes CLI arguments:
     - `--character-id`: e.g. `queen-kate-wedding2016` or `bishop-ale-2`.
     - `--concept`: Path to 2D concept or turnaround image.
     - `--views-dir`: Path to processed views (front, side, threequarter, back).
     - `--max-iterations`: Default 3 to 5.
     - `--target-score`: Default 8.0 / 10.
     - `--output-dir`: Where candidate GLBs, contact sheets, and reports are saved.
   - For each iteration:
     - Generates a candidate 3D GLB by varying generation hyperparameters:
       - **Seeds**: Cycle through distinct seeds (e.g. `[42, 1337, 7, 2026, 999]`).
       - **Decimation targets**: `[100000, 150000, 200000]`.
       - **Texture size**: `[1024, 2048]`.
     - Calls `critic_vlm.py` to evaluate the candidate model.
     - Parses the VLM feedback:
       - If `overall_score >= target_score` and `passed == True`: **Early exit (Success!)**.
       - Otherwise: Records flaws and tries the next candidate.
   - At loop completion:
     - Identifies the highest-scoring candidate.
     - Copies the winner to the target destination.
     - Updates `docs/qa-scores.yaml` and prints a formatted summary table.

2. **Test on Kate Nozze 2016 (`queen-kate-wedding2016`)**:
   - Run the loop against the Nozze 2016 dataset in `tools/model-pipeline/kate/`.
   - Record the best iteration, its score, and contact sheet.

3. **Verification & Tests**:
   - Run `just test` and verify that no regressions occur.
   - Document results in `tools/model-pipeline/RUNNING_DOC.md`.

---

## Deliverables
- `tools/model-pipeline/critic/refine_loop.py`: Fully functional script.
- Test run report logged in `tools/model-pipeline/critic/out/`.
- Updated entry in `docs/qa-scores.yaml`.
- Documentation in `RUNNING_DOC.md`.
