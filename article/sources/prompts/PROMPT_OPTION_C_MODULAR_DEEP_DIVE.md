# TASK: Option C — Modular Deep Dive on "Ale v2 & Nozze 2016" (Clean Character + Separated Props)

## Context & Objectives
In CarChess3D (`carlesso-family/chess3d`), Riccardo identified the two lowest-quality models as:
1. **Bishop Ale #2 / v2** (`bishop-ale-2.glb` / `tools/model-pipeline/ale2/`): Contains fused limbs, distorted astrolabe/dragon artifacts ("two half dragons"), where the AI failed to separate the boy from the handheld prop.
2. **Queen Kate Nozze 2016** (`queen-kate-wedding2016.glb`): Muddy facial texture, bulky hair bun blending into neck/collar, and uneven hands/scepter.

We have already proven the winning architecture with **`bishop-ale-rigged.glb`**:
- When props (dragons, astrolabes, scepters, weapons) are generated as **separate clean 3D assets** and assembled via a deterministic Blender assembly script (`tools/model-pipeline/rigging/assemble_modular_bishop.py`), the result is orders of magnitude cleaner than monolithic one-shot AI generation.

Your mission is to perform a modular overhaul on **Bishop Ale #2** and **Queen Kate Nozze 2016**.

---

## Detailed Requirements

1. **Bishop Ale #2 Modular Remaster (`tools/model-pipeline/ale2/`)**:
   - Analyze existing sources: `assets/characters/bishop-ale-2.jpg`, `tools/model-pipeline/ale2/`.
   - **Step 1: Clean Body**: Generate or extract a clean Alessandro boy figure (without the astrolabe or dragon fused into his robe/arm).
   - **Step 2: Clean Astrolabe/Sphere**: Generate or model a clean brass astrolabe / armillary sphere prop.
   - **Step 3: Assembly Script (`assemble_modular_ale2.py`)**:
     - Loads clean Ale body and clean astrolabe.
     - Parents and positions the astrolabe cleanly in his open palm/fingers.
     - Smooths the robe seams.
     - Exports `assets/models/bishop-ale-2-remastered.glb`.
   - Render a 4-view contact sheet and run `critic_vlm.py` to compare against `bishop-ale-2.glb`.

2. **Queen Kate Nozze 2016 Geometry & Hair Clean-up**:
   - Inspect `tools/model-pipeline/kate/out/queen_kate.glb` and `assets/models/queen-kate-wedding2016.glb`.
   - Use Blender headless to:
     - Separate the hair chignon from the collar (clear neck contour).
     - Clean up the scepter / hands so they do not melt into the purple velvet dress.
     - Apply Laplacian / Surface Smooth to remove "marching cubes" bumpiness on the gown and skin while keeping hard edges on the wooden pedestal and golden embroidery.
     - Export `assets/models/queen-kate-wedding2016-remastered.glb`.

3. **Verification & Tests**:
   - Run `python3 scripts/check.py` and `just test` to verify geometric integrity (watertight, face count, valid glTF).
   - Generate before/after contact sheets (`render_contact_sheet.py`).
   - Run `critic_vlm.py` and verify higher scores in `docs/qa-scores.yaml`.
   - Document process and decisions in `tools/model-pipeline/RUNNING_DOC.md`.

---

## Deliverables
- `tools/model-pipeline/ale2/assemble_modular_ale2.py`: Modular assembly script.
- Remastered GLB models (`bishop-ale-2-remastered.glb`, `queen-kate-wedding2016-remastered.glb`).
- Side-by-side contact sheets demonstrating the elimination of fused artifacts.
- Entry in `tools/model-pipeline/RUNNING_DOC.md`.
