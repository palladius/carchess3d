# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai", "pillow", "python-dotenv"]
# ///
"""Generate extra views (back / side / top) of the puffin with Nano Banana Pro.

Usage: uv run nb_views.py back side top
Reads GEMINI_API_KEY from $GIC/.env (never printed).
"""
import os
import sys
from io import BytesIO
from pathlib import Path

from dotenv import dotenv_values
from google import genai
from google.genai import types
from PIL import Image

HERE = Path(__file__).parent
REF = HERE.parent / "puffin2"
MODEL = os.environ.get("NB_MODEL", "gemini-3-pro-image-preview")

key = os.environ.get("GEMINI_API_KEY") or dotenv_values(Path(os.environ["GIC"]) / ".env").get("GEMINI_API_KEY")
client = genai.Client(api_key=key)

SUBJECT = (
    "Reference images: the SAME collectible chess pawn figurine (a cute puffin dressed as a Swiss Guard, "
    "steel morion helmet with red plume, blue-yellow-red striped uniform, brown belt, halberd held in its "
    "right hand, standing on a round dark wooden pedestal). "
)
STYLE = (
    " Keep identical proportions, colours, materials, pedestal and lighting. Plain uniform mid-grey studio "
    "background, soft even light, whole figurine fully visible and centred, orthographic-looking product shot. "
    "No text, no labels, no captions, no extra objects."
)
VIEWS = {
    "back": "Render this exact same figurine seen from DIRECTLY BEHIND (camera rotated 180 degrees around it, "
    "same height and distance as the front view). Show the back of the helmet and plume, the black feathered "
    "back of the head and neck, the back of the striped uniform, the tail feathers and the back of the pedestal. "
    "The halberd is in the figure's right hand, so from behind it appears on the RIGHT side of the image.",
    "side": "Render this exact same figurine in a PURE SIDE PROFILE, camera exactly 90 degrees to the figure's "
    "LEFT side, same height and distance: the beak points to the LEFT edge of the image. Show the profile of "
    "the big orange beak, the morion helmet's curved brim and crest in profile, the plume, the side of the "
    "striped uniform, feet and pedestal. The halberd is in the far hand, mostly behind the body.",
    "top": "Render this exact same figurine seen from ABOVE: camera high, looking down at about 60 degrees "
    "elevation from the front (bird's-eye three-quarter top view), same distance. Show the top of the morion "
    "helmet with its crest and the red plume from above, the face foreshortened below the brim, shoulders, "
    "the halberd tip and the round top surface of the wooden pedestal.",
}

refs = [Image.open(REF / "front.png"), Image.open(REF / "threequarter.png")]
OUTDIR = HERE / MODEL.replace("models/", "")
OUTDIR.mkdir(exist_ok=True)
for view in sys.argv[1:]:
    resp = client.models.generate_content(
        model=MODEL,
        contents=[*refs, SUBJECT + VIEWS[view] + STYLE],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio="1:1"),
        ),
    )
    saved = False
    for part in resp.candidates[0].content.parts:
        if part.inline_data:
            Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(OUTDIR / f"{view}.png")
            print(f"🍌 {OUTDIR.name}/{view}.png saved", flush=True)
            saved = True
    if not saved:
        print(f"❌ {view}: no image returned", resp.candidates[0].finish_reason, flush=True)
