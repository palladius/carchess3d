import os
import shutil
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from google import genai
from google.genai import types

HERE = Path(__file__).parent
FRONT_LIGHTSABER = HERE / "weapon_variants/seby_lightsaber.png"

# Copy as primary front.png
shutil.copy(FRONT_LIGHTSABER, HERE / "front_lightsaber.png")

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_front = Image.open(FRONT_LIGHTSABER)

SUBJECT = (
    "Reference image: collectible 3D chess knight figurine of Sebastian (a cute, cheerful young boy with sandy hair and blue eyes, "
    "wearing gleaming golden plate armor and vibrant blue cape, riding a noble brown horse with golden head armor on a round wooden pedestal, "
    "holding a radiant glowing blue LIGHTSABER / laser sword with energy glow aloft in his left hand). "
    "Keep exact same proportions, materials, colors, pedestal, cheerful cartoon style, soft studio lighting on grey background."
)

VIEWS = [
    (
        "threequarter",
        "Render this exact figurine from a 3/4 ISOMETRIC VIEW (camera rotated ~45 degrees to the side and slightly elevated, "
        "same distance and scale as reference). Show the dynamic side-angle of the boy, horse, golden armor, and glowing blue lightsaber blade."
    ),
    (
        "back",
        "Render this exact figurine from DIRECTLY BEHIND (camera rotated 180 degrees around the figurine, same height and distance). "
        "Show the back of his sandy hair, golden shoulder pauldrons, flowing blue cape draped over the horse's back, "
        "the brown horse's hindquarters and tail, the back of the round wooden base, and the glowing blue lightsaber held up seen from behind."
    ),
]

print("Generating 3/4 and Back views for Knight Sebastian with LIGHTSABER...")

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
        saved = False
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = HERE / f"{view_name}_lightsaber.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
                saved = True
        if not saved:
            print(f"  ❌ No image returned: {resp.candidates[0].finish_reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error: {e}", flush=True)

print("Finished generating lightsaber multi-views!")
