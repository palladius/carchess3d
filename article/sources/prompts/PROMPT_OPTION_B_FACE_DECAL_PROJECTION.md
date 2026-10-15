# TASK: Option B — Head & Face Decal Projection / UV Inpainting in Blender

## Context & Objectives
In CarChess3D (`carlesso-family/chess3d`), 3D models generated via TRELLIS.2 often have sound 3D body geometry and proportions, but the facial textures can suffer from AI blurring, melted features, muddy eyes, or distorted glasses (notably on Queen Kate Nozze 2016 `queen-kate-wedding2016.glb` and King Riccardo `king-riccardo.glb`).

In game development and VFX, the standard fix is **Decal Face Projection** (or *UV Camera Projective Inpainting*):
1. Take the crisp, high-resolution 2D face from the original concept art (sharp emerald eyes, clear navy frames, genuine expression).
2. Set up an orthographic camera in Blender facing the head of the 3D model.
3. Project the 2D face texture onto the forward-facing head polygons.
4. Soft-blend the boundary with an alpha feather mask so the hairline, jaw, and neck transition seamlessly into the original 3D texture.
5. Bake the composite texture back into the GLB's baseColor texture map and export the upgraded model.

Your mission is to build the automated Blender headless tool `tools/model-pipeline/tools/project_face.py` and test it on Queen Kate and King Riccardo.

---

## Detailed Requirements

1. **Build `tools/model-pipeline/tools/project_face.py`**:
   - Must run in Blender headless:
     ```bash
     blender -b -P tools/model-pipeline/tools/project_face.py -- \
       --glb assets/models/queen-kate-wedding2016.glb \
       --face tools/model-pipeline/kate/front.png \
       --out assets/models/queen-kate-wedding2016-restored.glb \
       --preview out/kate_wedding_face_compare.png
     ```
   - Algorithm steps:
     - Clear Blender scene (`bpy.ops.wm.read_factory_settings(use_empty=True)`).
     - Import target GLB (`bpy.ops.import_scene.gltf(filepath=...)`).
     - Detect head geometry: compute bounding box, isolate top ~25-35% of the Z-axis, forward facing (+Y or -Y normal).
     - Camera setup: position an orthographic camera centered on the head bounding box, framed tightly around the facial oval.
     - Secondary UV / Texture projection: project the high-res 2D face image from camera view onto the head vertices.
     - Alpha feathering: apply an elliptical/radial alpha falloff mask centered on the face (1.0 in center at eyes/nose/mouth, fading to 0.0 at perimeter near ears/hairline).
     - Texture Bake: bake the blended color onto the model's main PBR diffuse/baseColor image (`Image_0`), preserving roughness and metallic.
     - Export enhanced `.glb` cleanly.
     - Render before/after side-by-side comparison image (`--preview`).

2. **Test on Queen Kate Nozze 2016 (`queen-kate-wedding2016.glb`)**:
   - Extract/verify clean frontal face crop from `tools/model-pipeline/kate/front.png` or `assets/characters/kate_wedding_v2_nb21.png`.
   - Run `project_face.py` to produce `queen-kate-wedding2016-restored.glb`.
   - Generate before/after comparison image.

3. **Test on King Riccardo (`king-riccardo.glb`)**:
   - Use frontal face from `tools/model-pipeline/king/front.png` / `assets/characters/king-riccardo-1.jpg`.
   - Run `project_face.py` to produce `king-riccardo-restored.glb`.
   - Verify that eyes, beard, and crown remain sharp without seams.

4. **Verification & Tests**:
   - Run `just test` to ensure GLB integrity.
   - Run `critic_vlm.py` on before vs after models to measure the jump in `face_likeness_score`.
   - Document results and embed before/after renders in `tools/model-pipeline/RUNNING_DOC.md`.

---

## Deliverables
- `tools/model-pipeline/tools/project_face.py`: Reusable Blender headless face projection tool.
- Restored GLB candidate models with before/after comparison renders.
- VLM QA comparison score report demonstrating improvement.
- Entry in `tools/model-pipeline/RUNNING_DOC.md`.
