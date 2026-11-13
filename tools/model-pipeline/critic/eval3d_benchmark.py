#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai", "pillow", "pydantic", "trimesh", "numpy", "scipy", "pyyaml"]
# ///
"""Literature-Grounded 3D Asset Quality & Pairwise Improvement Benchmark (eval3d).

Inspired by:
- GPTEval3D (Wu et al., CVPR 2024): Multi-view + macro forensic rendering & VLM pairwise A/B judgment.
- T3Bench (He et al., 2023): Multi-angle quality & concept alignment scoring.
- Garland & Heckbert (1997) / Lévy et al. (2002): Mesh decimation & UV seam distortion forensics.
- CarChess3D 'Lesson Learnt: Face-Grafting' (2026): Anti-Blotchiness ('Anti-Butterato') Laplacian skin metric.

Usage:
  python3 tools/model-pipeline/critic/eval3d_benchmark.py \
      --candidate assets/models/king-riccardo.glb \
      --baseline tools/model-pipeline/king/out/king_riccardo_legacy_broken.glb \
      --concept assets/characters/king-riccardo-1.jpg \
      --min-improvement-pct 30.0
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent


BLENDER_FORENSIC_RENDER_PY = r"""
import bpy
import json
import math
import sys
import numpy as np
from pathlib import Path

argv = sys.argv[sys.argv.index("--") + 1:]
glb_path = Path(argv[0])
out_dir = Path(argv[1])
out_dir.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb_path))

mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
if not mesh_objs:
    sys.exit(2)

# Compute world-space bounding box, polygon count & PBR texture presence
coords = []
total_faces = 0
has_pbr_texture = len([img for img in bpy.data.images if img.size[0] > 64]) > 0
for obj in mesh_objs:
    mat = obj.matrix_world
    total_faces += len(obj.data.polygons)
    for v in obj.data.vertices:
        coords.append(mat @ v.co)
coords = np.array(coords)
min_b = coords.min(axis=0)
max_b = coords.max(axis=0)
center = (min_b + max_b) / 2.0
extents = max_b - min_b
height = float(extents[2])
radius = float(max(extents[0], extents[1]))

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.film_transparent = True

world = bpy.data.worlds.new("EvalWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.18, 0.20, 0.24, 1.0)
    bg.inputs[1].default_value = 1.0

for name, energy, rot in [
    ("Key", 3.8, (math.radians(55), 0.0, math.radians(-30))),
    ("Fill", 2.2, (math.radians(65), 0.0, math.radians(45))),
    ("Rim", 2.0, (math.radians(45), 0.0, math.radians(160))),
]:
    l_data = bpy.data.lights.new(name, type='SUN')
    l_data.energy = energy
    l_obj = bpy.data.objects.new(name, l_data)
    bpy.context.collection.objects.link(l_obj)
    l_obj.rotation_euler = rot

cam_data = bpy.data.cameras.new("EvalCam")
cam_data.type = 'ORTHO'
cam_obj = bpy.data.objects.new("EvalCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
scene.camera = cam_obj

def aim_camera(loc, target, ortho_scale):
    cam_obj.location = loc
    cam_data.ortho_scale = ortho_scale
    direction = target - np.array(loc)
    rot_quat = bpy.data.objects["EvalCam"].location
    import mathutils
    v_dir = mathutils.Vector(target) - mathutils.Vector(loc)
    cam_obj.rotation_euler = v_dir.to_track_quat('-Z', 'Y').to_euler()

# Detect front orientation (+Y vs -Y) by checking face detail or defaulting to -Y
dist = max(height, radius) * 2.5
full_scale = max(height, radius * 1.6) * 1.18
mid_target = [float(center[0]), float(center[1]), float(min_b[2] + height * 0.50)]
head_target = [float(center[0]), float(center[1]), float(min_b[2] + height * 0.72)]
head_scale = max(height * 0.42, radius * 0.75)

views = [
    ("front", [center[0], center[1] - dist, mid_target[2]], mid_target, full_scale),
    ("three_quarter", [center[0] + dist * 0.65, center[1] - dist * 0.75, mid_target[2] + height * 0.08], mid_target, full_scale),
    ("side", [center[0] + dist, center[1], mid_target[2]], mid_target, full_scale),
    ("back", [center[0], center[1] + dist, mid_target[2]], mid_target, full_scale),
    ("macro_head", [center[0], center[1] - dist, head_target[2]], head_target, head_scale),
]

for name, loc, tgt, scale in views:
    aim_camera(loc, tgt, scale)
    scene.render.filepath = str(out_dir / f"{name}.png")
    bpy.ops.render.render(write_still=True)

# 6th panel: Clay geometry macro head (removes texture to inspect pure 3D shape)
clay_mat = bpy.data.materials.new("ClayMat")
clay_mat.use_nodes = True
bsdf = clay_mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.78, 0.79, 0.82, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.45

for obj in mesh_objs:
    obj.data.materials.clear()
    obj.data.materials.append(clay_mat)

aim_camera([center[0], center[1] - dist, head_target[2]], head_target, head_scale)
scene.render.filepath = str(out_dir / "macro_clay.png")
bpy.ops.render.render(write_still=True)

meta = {
    "faces": int(total_faces),
    "has_pbr_texture": bool(has_pbr_texture),
    "min_bounds": [float(x) for x in min_b],
    "max_bounds": [float(x) for x in max_b],
    "height": height,
    "radius": radius,
}
(out_dir / "meta.json").write_text(json.dumps(meta, indent=2))
"""


def compute_image_forensics(render_dir: Path, meta: dict, concept_path: Optional[Path] = None) -> dict:
    """Compute objective T3Bench / Anti-Butterato photometric & geometric metrics."""
    macro_img = Image.open(render_dir / "macro_head.png").convert("RGBA")
    clay_img = Image.open(render_dir / "macro_clay.png").convert("RGBA")
    front_img = Image.open(render_dir / "front.png").convert("RGBA")
    back_img = Image.open(render_dir / "back.png").convert("RGBA")
    side_img = Image.open(render_dir / "side.png").convert("RGBA")

    has_pbr = bool(meta.get("has_pbr_texture", False))

    # 1. Mesh Budget & Hygiene Score (0..10)
    faces = meta.get("faces", 0)
    if 35000 <= faces <= 68000:
        poly_score = 10.0
    elif 5000 <= faces < 35000:
        poly_score = 5.5 + 4.5 * ((faces - 5000) / 30000.0)
    elif 68000 < faces <= 150000:
        poly_score = max(5.0, 10.0 - 5.0 * ((faces - 68000) / 82000.0))
    else:
        poly_score = 3.5

    # 2. Macro Head/Face Anti-Blotchiness ('Anti-Butterato') & PBR Texture Presence Score (0..10)
    arr = np.asarray(macro_img, dtype=np.float32) / 255.0
    clay_arr = np.asarray(clay_img, dtype=np.float32) / 255.0
    h, w, _ = arr.shape
    y0, y1 = int(h * 0.38), int(h * 0.68)
    x0, x1 = int(w * 0.35), int(w * 0.65)
    roi = arr[y0:y1, x0:x1]
    clay_roi = clay_arr[y0:y1, x0:x1]
    alpha_mask = roi[:, :, 3] > 0.5

    if np.sum(alpha_mask) > 100:
        lum = 0.299 * roi[:, :, 0] + 0.587 * roi[:, :, 1] + 0.114 * roi[:, :, 2]
        clay_lum = 0.299 * clay_roi[:, :, 0] + 0.587 * clay_roi[:, :, 1] + 0.114 * clay_roi[:, :, 2]
        diff_lum = lum - clay_lum
        gy, gx = np.gradient(diff_lum)
        grad_mag = np.hypot(gx, gy)[alpha_mask]
        high_freq_energy = float(np.percentile(grad_mag, 80))

        from PIL import ImageFilter as _IF
        diff_im = Image.fromarray(np.uint8(np.clip((diff_lum + 0.5) * 255.0, 0, 255)))
        smooth_diff = np.asarray(diff_im.filter(_IF.BoxBlur(4)), dtype=np.float32) / 255.0 - 0.5
        local_blotch = float(np.std((diff_lum - smooth_diff)[alpha_mask]))
        dark_crater_ratio = round(local_blotch, 4)

        if not has_pbr:
            # Untextured procedural placeholder: no 2048x2048 PBR texture atlas at all
            smoothness_score = 3.8
        else:
            smoothness_score = float(
                np.clip(11.5 - (high_freq_energy * 145.0) - (local_blotch * 85.0), 4.0, 10.0)
            )
    else:
        high_freq_energy = 0.2
        dark_crater_ratio = 0.2
        smoothness_score = 3.5

    # 3. 3D Geometric Sculpt Relief Score from Panel 6 Macro Clay (0..10)
    # Distinguishes detailed 60k sculpted relief (bricks, crowns, ears, wings) from smooth primitive cylinders
    clay_full_mask = clay_arr[:, :, 3] > 0.5
    if np.sum(clay_full_mask) > 200:
        c_lum = 0.299 * clay_arr[:, :, 0] + 0.587 * clay_arr[:, :, 1] + 0.114 * clay_arr[:, :, 2]
        c_gy, c_gx = np.gradient(c_lum)
        clay_relief = float(np.percentile(np.hypot(c_gx, c_gy)[clay_full_mask], 85))
        geom_sculpt_score = float(np.clip(3.2 + clay_relief * 290.0, 3.0, 10.0))
    else:
        geom_sculpt_score = 4.0

    # 4. Multi-View Albedo & Silhouette Coherence (0..10)
    def fg_stats(im: Image.Image):
        a = np.asarray(im, dtype=np.float32) / 255.0
        m = a[:, :, 3] > 0.5
        if np.sum(m) < 50:
            return 0.0, np.zeros(3)
        cov = float(np.mean(m))
        mean_rgb = a[:, :, :3][m].mean(axis=0)
        return cov, mean_rgb

    f_cov, f_rgb = fg_stats(front_img)
    b_cov, b_rgb = fg_stats(back_img)
    s_cov, s_rgb = fg_stats(side_img)

    sil_sym = 1.0 - abs(f_cov - b_cov) / max(f_cov, b_cov, 1e-4)
    rgb_drift = float(np.linalg.norm(f_rgb - b_rgb))
    mv_coherence_score = float(np.clip(10.0 * sil_sym - rgb_drift * 8.0, 1.0, 10.0))

    # 5. Color Fidelity vs 2D Concept (catches RGB channel drop / dark-background delight corruption)
    color_fidelity_score = 8.0
    if concept_path and concept_path.exists():
        c_im = Image.open(concept_path).convert("RGB")
        c_arr = np.asarray(c_im, dtype=np.float32) / 255.0
        ch, cw, _ = c_arr.shape
        # Central foreground crop of concept (avoid outer border)
        c_crop = c_arr[int(ch * 0.18):int(ch * 0.85), int(cw * 0.22):int(cw * 0.78)]
        bg_ref = c_arr[0, 0]
        fg_m = np.linalg.norm(c_crop - bg_ref, axis=-1) > 0.12
        if np.sum(fg_m) > 100 and np.linalg.norm(f_rgb) > 1e-3:
            c_rgb = c_crop[fg_m].mean(axis=0)
            # Cosine chroma similarity + channel balance check (penalizes dead blue channel < 0.05)
            cos_sim = float(np.dot(f_rgb, c_rgb) / (np.linalg.norm(f_rgb) * np.linalg.norm(c_rgb) + 1e-6))
            blue_ratio = float(f_rgb[2] / max(c_rgb[2], 0.05))
            blue_penalty = max(0.0, (0.45 - blue_ratio) * 14.0) if blue_ratio < 0.45 else 0.0
            color_fidelity_score = float(np.clip(cos_sim * 9.5 - blue_penalty, 1.0, 10.0))

    # 6. Crown / Upper Silhouette Perforation & Detail Index (0..10)
    top_band = arr[:int(h * 0.28), :, 3] > 0.5
    if np.sum(top_band) > 50:
        edges = np.abs(np.diff(top_band.astype(np.float32), axis=1)).sum()
        area = float(np.sum(top_band))
        perimeter_ratio = float(edges / max(math.sqrt(area), 1.0))
        detail_score = float(np.clip(4.0 + perimeter_ratio * 1.2, 1.0, 10.0))
    else:
        detail_score = 6.0

    objective_total = round(
        0.25 * smoothness_score
        + 0.20 * geom_sculpt_score
        + 0.20 * color_fidelity_score
        + 0.15 * poly_score
        + 0.10 * mv_coherence_score
        + 0.10 * detail_score,
        2,
    )

    return {
        "has_pbr_texture": has_pbr,
        "polygon_budget_score": round(poly_score, 2),
        "geometric_sculpt_score": round(geom_sculpt_score, 2),
        "color_fidelity_score": round(color_fidelity_score, 2),
        "face_smoothness_anti_blotch_score": round(smoothness_score, 2),
        "multiview_albedo_coherence_score": round(mv_coherence_score, 2),
        "silhouette_detail_score": round(detail_score, 2),
        "high_freq_blotch_energy": round(high_freq_energy, 4),
        "dark_crater_outlier_ratio": round(dark_crater_ratio, 4),
        "objective_score": objective_total,
    }


def compose_6panel_sheet(render_dir: Path, title: str, out_path: Path) -> Path:
    """Assemble 6-panel 1536x1060 forensic sheet."""
    panels = [
        ("1. Front (0°)", "front.png"),
        ("2. 3/4 View (45°)", "three_quarter.png"),
        ("3. Profile (90°)", "side.png"),
        ("4. Back (180°)", "back.png"),
        ("5. MACRO FACE (UV/Skin)", "macro_head.png"),
        ("6. MACRO CLAY (Pure Mesh)", "macro_clay.png"),
    ]
    W, H = 512, 512
    canvas = Image.new("RGB", (W * 3, H * 2 + 44), (24, 27, 34))
    draw = ImageDraw.Draw(canvas)
    draw.text((16, 12), title, fill=(255, 215, 80))

    for idx, (label, fname) in enumerate(panels):
        col = idx % 3
        row = idx // 3
        x, y = col * W, 44 + row * H
        p_img = Image.open(render_dir / fname).convert("RGBA")
        bg = Image.new("RGBA", p_img.size, (36, 40, 50, 255))
        comp = Image.alpha_composite(bg, p_img).convert("RGB")
        canvas.paste(comp, (x, y))
        draw.rectangle([x, y, x + W - 1, y + H - 1], outline=(70, 78, 95), width=2)
        draw.rectangle([x + 8, y + 8, x + 230, y + 32], fill=(15, 18, 24))
        draw.text((x + 14, y + 13), label, fill=(235, 240, 250))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path)
    return out_path


def evaluate_vlm_pairwise(
    concept_path: Optional[Path],
    candidate_sheet: Path,
    baseline_sheet: Optional[Path] = None,
) -> Optional[dict]:
    """Run GPTEval3D-style VLM evaluation when GEMINI_API_KEY is set."""
    if not os.environ.get("GEMINI_API_KEY"):
        return None
    try:
        from google import genai
        from google.genai import types
        from pydantic import BaseModel, Field

        class Eval3dVlmReport(BaseModel):
            candidate_face_cleanliness: float = Field(description="0-10 score: smooth stylized skin without blotches, UV seams, or dark craters")
            candidate_concept_likeness: float = Field(description="0-10 score: fidelity to 2D concept expression, proportions, and colors")
            candidate_geometry_and_props: float = Field(description="0-10 score: crown/hat/companion separation and 3D volume")
            candidate_back_coherence: float = Field(description="0-10 score: back view completeness without flat smudges or twin-face Janus bugs")
            baseline_overall_score: float = Field(description="0-10 overall score of the baseline model (0 if no baseline provided)")
            candidate_overall_score: float = Field(description="0-10 overall score of the candidate model")
            key_improvements: list[str] = Field(description="Concrete visual improvements observed in Candidate over Baseline")
            remaining_defects: list[str] = Field(description="Remaining visual or geometric defects in Candidate")

        client = genai.Client()
        contents = [
            "You are an Adversarial 3D Lead QA Critic (GPTEval3D protocol). "
            "Evaluate the 6-panel forensic sheet of the Candidate 3D model "
            "(Front, 3/4, Side, Back, Macro Face Close-Up, Macro Clay Geometry). "
            "Pay strict attention to Panel 5 (MACRO FACE) vs Panel 6 (MACRO CLAY): "
            "penalize any blotchy/pockmarked skin ('faccia butterata'), jagged UV seams, "
            "dark collapsed triangles, solid-bucket crowns, or melted secondary props."
        ]
        if concept_path and concept_path.exists():
            contents.extend(["2D Target Concept Art:", Image.open(concept_path)])
        if baseline_sheet and baseline_sheet.exists():
            contents.extend(["BASELINE (Previous) 3D Model 6-Panel Sheet:", Image.open(baseline_sheet)])
        contents.extend(["CANDIDATE (New) 3D Model 6-Panel Sheet:", Image.open(candidate_sheet)])

        resp = client.models.generate_content(
            model="gemini-flash-latest",
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=Eval3dVlmReport,
                temperature=0.1,
            ),
        )
        return resp.parsed.model_dump()
    except Exception as exc:
        print(f"⚠️ VLM critique skipped ({exc})", file=sys.stderr)
        return None


def render_and_score_one(glb_path: Path, work_dir: Path, label: str, concept_path: Optional[Path] = None) -> tuple[dict, Path]:
    sub_dir = work_dir / label
    sub_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as tf:
        tf.write(BLENDER_FORENSIC_RENDER_PY)
        script_path = tf.name
    try:
        subprocess.run(
            ["blender", "-b", "--python", script_path, "--", str(glb_path), str(sub_dir)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    finally:
        Path(script_path).unlink(missing_ok=True)

    meta = json.loads((sub_dir / "meta.json").read_text())
    metrics = compute_image_forensics(sub_dir, meta, concept_path)
    metrics["faces"] = meta["faces"]
    sheet_path = compose_6panel_sheet(
        sub_dir,
        f"{label}: {glb_path.name} ({meta['faces']:,} faces) | ObjScore={metrics['objective_score']:.2f}/10",
        work_dir / f"{label}_6panel.png",
    )
    return metrics, sheet_path


def main():
    parser = argparse.ArgumentParser(description="Literature-grounded 3D evaluation & +X%% improvement gate")
    parser.add_argument("--candidate", required=True, type=Path, help="Path to new candidate .glb")
    parser.add_argument("--baseline", type=Path, default=None, help="Path to previous baseline .glb for A/B delta")
    parser.add_argument("--concept", type=Path, default=None, help="Path to 2D concept image")
    parser.add_argument("--out-dir", type=Path, default=HERE / "out" / "eval3d", help="Directory for forensic sheets & JSON")
    parser.add_argument("--min-improvement-pct", type=float, default=30.0, help="Required %% improvement over baseline")
    parser.add_argument("--no-vlm", action="store_true", help="Run purely deterministic objective metrics without VLM")
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    cand_metrics, cand_sheet = render_and_score_one(args.candidate, args.out_dir, "candidate", args.concept)

    base_metrics = None
    base_sheet = None
    if args.baseline and args.baseline.exists():
        base_metrics, base_sheet = render_and_score_one(args.baseline, args.out_dir, "baseline", args.concept)

    vlm_report = None
    if not args.no_vlm:
        vlm_report = evaluate_vlm_pairwise(args.concept, cand_sheet, base_sheet)

    cand_composite = cand_metrics["objective_score"]
    base_composite = base_metrics["objective_score"] if base_metrics else None

    if vlm_report:
        cand_Composite_vlm = float(vlm_report["candidate_overall_score"])
        cand_composite = round(0.45 * cand_metrics["objective_score"] + 0.55 * cand_Composite_vlm, 2)
        if base_metrics and vlm_report.get("baseline_overall_score", 0) > 0:
            base_composite = round(
                0.45 * base_metrics["objective_score"] + 0.55 * float(vlm_report["baseline_overall_score"]), 2
            )

    improvement_pct = None
    smoothness_improvement_pct = None
    passed_gate = cand_composite >= 7.5

    if base_composite is not None and base_composite > 0:
        improvement_pct = round(((cand_composite - base_composite) / base_composite) * 100.0, 1)
        b_smooth = base_metrics["face_smoothness_anti_blotch_score"]
        c_smooth = cand_metrics["face_smoothness_anti_blotch_score"]
        smoothness_improvement_pct = round(((c_smooth - b_smooth) / max(b_smooth, 0.1)) * 100.0, 1)
        passed_gate = (
            improvement_pct >= args.min_improvement_pct
            or smoothness_improvement_pct >= args.min_improvement_pct
            or cand_composite >= 8.5
        )

    summary = {
        "candidate_glb": str(args.candidate),
        "baseline_glb": str(args.baseline) if args.baseline else None,
        "candidate_metrics": cand_metrics,
        "baseline_metrics": base_metrics,
        "vlm_report": vlm_report,
        "candidate_composite_score": cand_composite,
        "baseline_composite_score": base_composite,
        "overall_improvement_pct": improvement_pct,
        "face_smoothness_improvement_pct": smoothness_improvement_pct,
        "min_improvement_pct_target": args.min_improvement_pct,
        "passed_gate": passed_gate,
        "candidate_sheet": str(cand_sheet),
        "baseline_sheet": str(base_sheet) if base_sheet else None,
    }

    report_path = args.out_dir / f"eval3d_{args.candidate.stem}.json"
    report_path.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    sys.exit(0 if passed_gate else 1)


if __name__ == "__main__":
    main()
