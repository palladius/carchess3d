import os
import shutil
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from google import genai
from google.genai import types

HERE = Path(__file__).parent
FRONT = HERE / "weapon_variants/seby_unarmed_scary.png"

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_front = Image.open(FRONT)

SUBJECT = (
    "Reference image: collectible 3D chess knight figurine of Sebastian (a cute, cheerful young boy with sandy brown hair "
    "and blue eyes, wearing gleaming golden plate armor and flowing blue cape, riding a noble brown horse with ornate golden head armor "
    "on a round wooden pedestal). "
    "IMPORTANT: He is completely UNARMED (free open hands / clenched fist, no weapons held). "
    "Keep exact proportions, materials, golden armor reflections, soft studio lighting, plain grey background."
)

VIEWS = [
    (
        "side",
        "Render this exact unarmed figurine from the EXACT SIDE PROFILE (camera rotated 90 degrees to the right, "
        "orthographic product shot at the exact same height and scale). "
        "Show the complete 90-degree side profile of the boy riding the horse, the side of the golden armor, "
        "the profile of the horse head and neck, horse legs, and the round wooden base."
    ),
    (
        "side_left",
        "Render this exact unarmed figurine from the OPPOSITE SIDE PROFILE (camera rotated 90 degrees to the left, "
        "showing the other side of the boy, cape, and horse, orthographic product shot)."
    ),
]

print("Generating SIDE profile views (Di Fianco) with Nano Banana 2.1...")

for view_name, prompt in VIEWS:
    print(f"--> Generating '{view_name}' view with gemini-nano-banana-2.1...", flush=True)
    try:
        resp = client.models.generate_content(
            model="gemini-nano-banana-2.1",
            contents=[ref_front, SUBJECT + " " + prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = HERE / f"{view_name}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
    except Exception as e:
        print(f"  ❌ Error: {e}", flush=True)

print("Done generating side views!")
