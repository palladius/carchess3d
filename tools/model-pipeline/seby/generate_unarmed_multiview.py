import os
import shutil
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from google import genai
from google.genai import types

HERE = Path(__file__).parent
FRONT_UNARMED = HERE / "weapon_variants/seby_unarmed_scary.png"

# Copy as primary front.png and front_unarmed.png
shutil.copy(FRONT_UNARMED, HERE / "front_unarmed.png")
shutil.copy(FRONT_UNARMED, HERE / "front.png")

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_front = Image.open(FRONT_UNARMED)

SUBJECT = (
    "Reference image: collectible 3D chess knight figurine of Sebastian (a cute, cheerful, heroic young boy with sandy brown hair "
    "and bright blue eyes, wearing gleaming golden plate armor and a flowing blue cape, riding a noble brown horse with ornate golden head armor "
    "on a round polished wooden pedestal). "
    "CRITICAL: HE IS UNARMED (NO WEAPONS IN HANDS, free open/clenched hands, ready for martial poses / energy powers / dynamic prop equip). "
    "His left hand is held high in a heroic, determined open fist / power pose, and his right hand holds the horse's golden reins. "
    "Keep identical proportions, lighting, colors, materials, cartoon animated style, plain grey studio background."
)

VIEWS = [
    (
        "threequarter",
        "Render this exact unarmed figurine from a 3/4 ISOMETRIC VIEW (camera rotated ~45 degrees to the side and slightly elevated, "
        "same distance and scale as reference). Show the dynamic 3/4 angle of the boy, horse, golden armor, flowing cape, and free hands (no weapons)."
    ),
    (
        "back",
        "Render this exact unarmed figurine from DIRECTLY BEHIND (camera rotated 180 degrees around the figurine, same height and distance). "
        "Show the back of the boy's hair, golden shoulder armor, blue cape draped over the horse, rear of the horse and tail, "
        "and the back of the wooden pedestal. Both hands are completely free of weapons."
    ),
]

print("Generating 3/4 and Back views for UNARMED / FREE-HAND Knight Sebastian...")

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
                dst = HERE / f"{view_name}_unarmed.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                # Also save canonical view
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(HERE / f"{view_name}.png")
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
                saved = True
        if not saved:
            print(f"  ❌ No image returned: {resp.candidates[0].finish_reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error: {e}", flush=True)

print("Finished generating Unarmed / Free-Hand multi-views!")
