# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai", "pillow"]
# ///
"""Generate high-fidelity orthographic turnaround views for the Red Baby Dragon."""

import io
import os
import sys
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image

HERE = Path(__file__).parent
ROOT = HERE.parent.parent.parent

client = genai.Client()
MODEL = os.environ.get("NB_MODEL", "gemini-3-pro-image-preview")

# Source references from bishop concept arts where dragon appears
ref1 = Image.open(ROOT / "assets/characters/bishop-ale-1.jpg")
ref2 = Image.open(ROOT / "assets/characters/bishop-ale-2.jpg")

SUBJECT = (
    "Reference images show the red baby dragon companion from the chess set. "
    "Focus EXCLUSIVELY on this cute collectible red baby dragon figurine (no humans, no boy, just the dragon alone). "
    "The dragon has ruby red scales, yellow-orange soft belly scales, two small dark horns, big emerald green expressive eyes, "
    "a cute friendly snout, two small articulated leathery dragon wings spread out, and a small tail with a spaded tip. "
)

STYLE = (
    "Style: 3D vinyl collectible toy, highly tactile, Pixar/Nintendo miniature style, soft studio lighting, "
    "solid neutral medium-grey background (#808080), centred in frame, orthographic product shot. "
    "No text, no labels, no humans."
)

VIEWS = {
    "front": (
        "Render the full red baby dragon from DIRECT FRONT (camera eye-level, 0 degrees). "
        "Show its cute face smiling, looking straight ahead, wings spread symmetrically to the left and right, "
        "front paws forward, standing on its hind legs/tail. Clean silhouette."
    ),
    "side": (
        "Render the exact same red baby dragon in PURE SIDE PROFILE (camera rotated 90 degrees to its right side). "
        "Snout points strictly to the LEFT. Show the side profile of the head, horn, profile of the folded/spread wing, "
        "curved back, belly, and tail extending to the right."
    ),
    "back": (
        "Render the exact same red baby dragon from DIRECTLY BEHIND (camera rotated 180 degrees). "
        "Show the back of the head, back ridge scales, the dorsal side of both wings, and the tail."
    ),
}

for name, prompt_view in VIEWS.items():
    out_file = HERE / f"{name}.png"
    if out_file.exists():
        print(f"⏩ {out_file.name} already exists, skipping.")
        continue
    print(f"🎨 Generating {name} view for Red Baby Dragon with {MODEL}...")
    resp = client.models.generate_content(
        model=MODEL,
        contents=[ref1, ref2, SUBJECT + prompt_view + " " + STYLE],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio="1:1"),
        ),
    )
    for part in resp.candidates[0].content.parts:
        if part.inline_data:
            im = Image.open(io.BytesIO(part.inline_data.data))
            im.save(out_file)
            print(f"✅ Saved {out_file.name} ({im.size})")
            break
