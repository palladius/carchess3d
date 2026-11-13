# Lesson Learnt: Why Photographic Face-Grafting Fails in 3D (and How to Fix It)

This post-mortem documents one of the most insidious pitfalls encountered while sculpting the 3D figurines for **CarChess3D**: the "broken and blotchy (*butterata*) face" of King Riccardo.

![Forensic Comparison: Blotchy Face-Graft vs Clean PBR King Riccardo](assets/riccardo_clean_vs_broken_comparison.png)

## 1. The Initial Symptom

While the kids' figurines (Alessandro and Sebastian) looked smooth, soft, and seamlessly integrated into the game's stylized 3D aesthetic, the King piece (Riccardo) suffered from:
- Dark brown/black blotches and camouflage-like patches across the cheekbones, forehead, and nose.
- A "pitted/pockmarked" (*butterata*) skin texture that under dynamic 3D lighting looked like orange peel or UV crater scarring.
- A royal crown that single-image 3D generators extruded as a solid bucket cylinder rather than open imperial arches.

![Forensic Zoom on the Broken In-Game Face vs Clean 2D Concept](assets/riccardo_face_forensics.png)

## 2. Anatomy of a Technical Failure: The "Adversarial Face-Graft" Pipeline

Tracing the legacy scripts (`graft_papino_face_3d.py` and `clean_king_riccardo.py`) revealed three compounding architectural flaws:

### A. UV Fragmentation in Neural 3D Meshes ("Frankenstein Seams")
Meshes produced by neural pipelines (such as TRELLIS with `xatlas` unwrapping) shatter the surface into tens of thousands of disconnected micro-UV islands.
When a script projects a cropped 2D photograph onto only a frontal subset of triangles (`tri_in_shell`), the boundary between the photo-mapped triangles and the surrounding neural texture forms a jagged, saw-toothed seam across the cheeks and temples.

### B. The Destructive `remove_doubles` UV Collapse Bug
To make the mesh watertight, the post-processing script ran:
```python
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0012)
```
In glTF, vertices along UV seams share identical 3D spatial coordinates `(x, y, z)` but intentionally carry different `(u, v)` texture coordinates (e.g., one vertex maps the cheek at `U ≈ 0.8`, the duplicate maps the dark cloak or pedestal at `U ≈ 0.2`). Welding them purely by 3D distance collapsed the UV seam vertices together, stretching dark triangles from the crown, beard, and marble base straight across the face.

### C. High-Frequency Photographic Noise vs. Stylized 3D Lighting
A real-world smartphone photo contains pores, stubble, micro-wrinkles, and baked-in directional shadows. When mapped onto a stylized 3D mesh lit by real-time Three.js lights, those static baked shadows do not rotate with the camera and clash with the smooth cartoon geometry—causing the human eye to perceive craters, dirt, or scarring.

## 3. The Solution: Unified Stylized 2D Concept + Continuous Multi-View PBR Baking

The fix is not surgical photo-grafting onto fragmented UV islands, but a cohesive stylized pipeline:

1. **Cohesive Stylized 2D Concept**: Start from a clean, cartoon-stylized portrait (`assets/king_riccardo_clean_2d.png`) that captures facial likeness (warm smile, expressive brown eyes, clean contours) without high-frequency photographic skin noise.
2. **Continuous UV Unwrapping**: Rebuild a clean, unified UV atlas without arbitrary frontal shell cuts across the cheeks or forehead.
3. **Multi-View Diffusion Baking (Hunyuan3D-2 Paint on Local RTX 5080)**: Project and bake multi-view textures coherently in 3D space onto the 60,000-face decimated mesh, yielding a uniform PBR material.

| Clean 2D Target Concept | Clean 3D PBR Turntable (60k faces) |
| :---: | :---: |
| ![Clean 2D Concept](assets/king_riccardo_clean_2d.png) | ![Clean 3D Turntable](assets/riccardo_clean_turntable.gif) |

## 4. Summary of Results

| Metric | Legacy Version (Photo Face-Graft) | New Version (Clean Stylized PBR) |
| :--- | :--- | :--- |
| **Facial Skin** | Dark blotches, jagged zigzag UV seams | Smooth, warm, uniform stylized skin |
| **Eyes** | Hollow, dark, distorted sockets | Expressive, well-defined cartoon eyes |
| **Royal Crown** | Solid bucket or UV-stretched | Open perforated imperial arches |
| **Polygon Budget** | 96k faces (fragmented UV islands) | **60,000 faces** (optimal WebGL budget) |
