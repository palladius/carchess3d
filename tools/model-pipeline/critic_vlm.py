# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai", "pillow", "pydantic"]
# ///
"""Automated VLM Critic: compares 2D character concept art with 3D renders.

Checks for:
1. Face likeness drift (faccia di Ale)
2. Companion/prop faithfulness (draghetto rosso)
3. Overall 3D reconstruction fidelity
"""

import json
import os
import sys
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field

HERE = Path(__file__).parent
ROOT = HERE.parent.parent

class CriticismResult(BaseModel):
    face_likeness_score: float = Field(description="Score 1-10 on likeness of the face compared to 2D art")
    face_critique: str = Field(description="Detailed critique of the face (eyes, mouth, cheeks, expression)")
    dragon_fidelity_score: float = Field(description="Score 1-10 on the red baby dragon recognition and anatomy")
    dragon_critique: str = Field(description="Detailed critique of the dragon (shape, wings, head, fusion with body)")
    structural_flaws: list[str] = Field(description="Structural issues (e.g. dragon fused into tunic, lost limbs)")
    aesthetic_flaws: list[str] = Field(description="Aesthetic issues (e.g. wrong colors, warped face, bad back)")
    passed: bool = Field(description="True if model passes minimum game quality bar, False otherwise")

def evaluate(concept_path: Path, render_front_path: Path, render_sheet_path: Path):
    client = genai.Client()
    
    prompt = """You are a Lead Character Artist and QA Critic for a 3D game.
Your task is to strictly audit a newly generated 3D model against its original 2D character concept art.

Compare the 2D Concept Image with the 3D Render Views.
Pay extreme attention to two critical areas:
1. The human face (Alessandro): Are the facial proportions, eyes, expression, and cuteness preserved, or is the 3D face distorted / looking like a different person?
2. The companion (Red Baby Dragon): In the 2D art, there is a distinct red baby dragon. In the 3D model, does it look like a distinct, recognisable cute dragon with head and wings, or has it devolved into a messy, unrecognisable blob fused into the chest/tunic?

Be brutally honest and specific. If the dragon doesn't look like a proper dragon or the face looks significantly different, fail the test (passed = false)."""

    img_concept = Image.open(concept_path)
    img_render = Image.open(render_sheet_path if render_sheet_path.exists() else render_front_path)

    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=[
            prompt,
            "2D Original Concept Art:", img_concept,
            "3D Rendered Output (Orthographic views):", img_render,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CriticismResult,
            temperature=0.2,
        ),
    )
    return response.parsed

if __name__ == "__main__":
    concept = ROOT / "assets/characters/bishop-ale-2.jpg"
    front = HERE / "rigging/out/view_front.png"
    sheet = HERE / "rigging/out/ale2_inspection_sheet.png"
    
    print(f"Running VLM Critic on {concept.name} vs 3D renders...")
    res = evaluate(concept, front, sheet)
    print(json.dumps(res.model_dump(), indent=2))
