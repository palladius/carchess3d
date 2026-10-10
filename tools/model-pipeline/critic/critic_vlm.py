# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai", "pillow", "pydantic", "trimesh", "numpy", "networkx", "scipy"]
# ///
"""Automated VLM + Geometric Critic for 3D chess pieces against 2D concept art.

Usage:
  uv run critic_vlm.py --glb path/to/model.glb --concept path/to/concept.jpg
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field
import numpy as np
import trimesh

HERE = Path(__file__).parent


class VlmCritique(BaseModel):
    face_likeness_score: float = Field(description="Score 1-10 on human face likeness and expression compared to 2D concept")
    face_critique: str = Field(description="Specific comments on the face, eyes, hair, expression")
    secondary_fidelity_score: float = Field(description="Score 1-10 on secondary companion, prop or pet (e.g. dragon, halberd, scepter)")
    secondary_critique: str = Field(description="Specific comments on secondary companion/prop recognition, shape, and separation")
    back_view_score: float = Field(description="Score 1-10 on back view plausibility, avoiding hallucinated/blurry blobs")
    back_critique: str = Field(description="Specific comments on back side consistency")
    structural_flaws: list[str] = Field(description="List of detected structural defects (fused props, missing limbs, warped geometry)")
    aesthetic_flaws: list[str] = Field(description="List of detected visual/aesthetic flaws (pinched textures, muddy colors, bad lighting)")
    passed: bool = Field(description="True if model passes minimum bar for game-ready character, False otherwise")


def check_geometry(glb_path: Path) -> dict:
    """Run fast deterministic geometry sanity checks with trimesh."""
    m = trimesh.load(str(glb_path), force="mesh")
    # In standard glTF, Y is up, but could be Z if Blender coordinates
    ext = m.extents
    tallest_axis_idx = int(np.argmax(ext))
    min_ground = float(m.bounds[0][tallest_axis_idx])
    
    # Check stray small islands
    unique_coords, inverse = np.unique(np.round(m.vertices, 4), axis=0, return_inverse=True)
    new_faces = inverse[m.faces]
    valid_faces = (new_faces[:, 0] != new_faces[:, 1]) & (new_faces[:, 1] != new_faces[:, 2]) & (new_faces[:, 0] != new_faces[:, 2])
    welded = trimesh.Trimesh(vertices=unique_coords, faces=new_faces[valid_faces], process=True)
    
    comps = welded.split(only_watertight=False)
    stray_islands = [len(c.faces) for c in comps[1:] if len(c.faces) < 50] if len(comps) > 1 else []
    
    return {
        "faces": int(len(m.faces)),
        "vertices": int(len(m.vertices)),
        "is_watertight": bool(m.is_watertight),
        "tallest_axis": "XYZ"[tallest_axis_idx],
        "height": round(float(ext[tallest_axis_idx]), 3),
        "min_ground_coord": round(min_ground, 3),
        "is_grounded_near_zero": abs(min_ground) < 0.05,
        "stray_island_count": len(stray_islands),
    }


def render_sheet(glb_path: Path, sheet_path: Path):
    """Render 4-view contact sheet using Blender script."""
    render_script = HERE / "render_contact_sheet.py"
    cmd = [
        "blender", "-b", "--python", str(render_script), "--",
        "--glb", str(glb_path),
        "--out", str(sheet_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def evaluate_vlm(concept_path: Path, sheet_path: Path) -> VlmCritique:
    """Query Gemini Vision API with structured evaluation."""
    client = genai.Client()
    prompt = """You are a Lead QA Character Artist inspecting a generated 3D collectible piece against 2D concept art.
Audit the 3D model (Front, 3/4, Profile, Back views) compared to the 2D original concept art.

Pay critical attention to:
1. Human face likeness (is it clearly the same character, or does it look like a distorted stranger?).
2. Secondary companion / props / pets (e.g. dragon, pet, wand, halberd). Are they cleanly separated and recognisable, or melted/amorphous?
3. Back view plausibility: Does the back look like a coherent 3D sculpture, or an AI hallucination / flat smudge?

Provide fair, rigorous ratings from 1 to 10."""

    img_concept = Image.open(concept_path)
    img_sheet = Image.open(sheet_path)

    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=[
            prompt,
            "2D Concept Art:", img_concept,
            "3D Renders (4-view contact sheet):", img_sheet,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=VlmCritique,
            temperature=0.2,
        ),
    )
    return response.parsed


def main():
    parser = argparse.ArgumentParser(description="Automated VLM & Geometry QA Critic")
    parser.add_argument("--glb", required=True, help="Path to 3D GLB model")
    parser.add_argument("--concept", required=True, help="Path to 2D character concept art")
    parser.add_argument("--out", help="Path to write JSON report")
    parser.add_argument("--min-score", type=float, default=6.5, help="Minimum acceptable score (default 6.5)")
    args = parser.parse_args()

    glb_p = Path(args.glb).resolve()
    concept_p = Path(args.concept).resolve()

    if not glb_p.exists():
        print(f"❌ Error: GLB not found at {glb_p}")
        sys.exit(1)
    if not concept_p.exists():
        print(f"❌ Error: Concept not found at {concept_p}")
        sys.exit(1)

    print(f"🔍 Auditing {glb_p.name} against {concept_p.name}...")
    
    # 1. Geometry check
    geo = check_geometry(glb_p)
    print(f"📐 Geometry: {geo['faces']} faces, watertight={geo['is_watertight']}, grounded={geo['is_grounded_near_zero']} (min={geo['min_ground_coord']})")

    # 2. Render contact sheet
    out_dir = HERE / "out"
    out_dir.mkdir(exist_ok=True)
    sheet_p = out_dir / f"{glb_p.stem}_critic_sheet.png"
    if not sheet_p.exists():
        print("📸 Rendering 4-view contact sheet...")
        render_sheet(glb_p, sheet_p)

    # 3. VLM Evaluation
    print("🤖 Evaluating visual quality with Gemini VLM...")
    vlm = evaluate_vlm(concept_p, sheet_p)

    report = {
        "model": glb_p.name,
        "concept": concept_p.name,
        "geometry": geo,
        "vlm": vlm.model_dump(),
    }

    # Print summary
    print("\n" + "=" * 60)
    print(f"🎯 VLM CRITIC REPORT: {glb_p.name}")
    print("=" * 60)
    print(f"👤 Face Likeness:      {vlm.face_likeness_score:.1f}/10 - {vlm.face_critique}")
    print(f"🐉 Companion/Prop:     {vlm.secondary_fidelity_score:.1f}/10 - {vlm.secondary_critique}")
    print(f"🔙 Back View:          {vlm.back_view_score:.1f}/10 - {vlm.back_critique}")
    print("-" * 60)
    if vlm.structural_flaws:
        print("⚠️ Structural Flaws:")
        for f in vlm.structural_flaws:
            print(f"  • {f}")
    if vlm.aesthetic_flaws:
        print("⚠️ Aesthetic Flaws:")
        for f in vlm.aesthetic_flaws:
            print(f"  • {f}")
    
    passed = (
        vlm.passed 
        and vlm.face_likeness_score >= args.min_score 
        and vlm.secondary_fidelity_score >= args.min_score
    )
    print("=" * 60)
    status_str = "✅ PASS" if passed else "❌ FAIL"
    print(f"Verdict: {status_str}")
    print("=" * 60 + "\n")

    if args.out:
        out_json = Path(args.out).resolve()
        out_json.write_text(json.dumps(report, indent=2))
        print(f"Report saved to {out_json}")

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
