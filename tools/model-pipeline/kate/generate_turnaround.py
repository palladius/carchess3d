import os
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from google import genai
from google.genai import types

HERE = Path(__file__).parent
FRONT = HERE / "front.png"

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_front = Image.open(FRONT)

SUBJECT = (
    "Reference image: collectible 3D chess queen figurine of Kate (with her gorgeous, beloved 2016 wedding updo hairstyle, "
    "golden tiara, radiant smile, vivid emerald-green eyes, round navy-blue glasses, royal purple velvet gown with gold embroidery, "
    "and a golden ring with purple amethyst jewel on her hand, standing on a round dark wooden pedestal). "
    "Keep exact proportions, colors, facial likeness, gown, and lighting."
)

VIEWS = [
    (
        "threequarter",
        "Render this exact figurine from a 3/4 ISOMETRIC VIEW (camera rotated ~45 degrees, slightly elevated, "
        "orthographic product shot at the exact same scale and height). "
        "Show the elegant dynamic 3/4 angle of Queen Kate, her tiara, wedding updo hair, navy glasses, purple gown, and round wooden base."
    ),
    (
        "side",
        "Render this exact figurine from the EXACT 90-DEGREE SIDE PROFILE (orthographic product view). "
        "Show the graceful side profile of Queen Kate: the wedding updo bun and hairpins under the golden tiara, "
        "the side of the navy glasses on her nose bridge, smiling lips, purple gown drapery, and round wooden pedestal."
    ),
    (
        "back",
        "Render this exact figurine from DIRECTLY BEHIND (camera rotated 180 degrees around the figurine). "
        "Show the back of her beautiful wedding updo hairstyle with delicate tiara details, "
        "the back of the royal purple velvet gown cascading gracefully down to the pedestal, and the rear of the round dark wooden base."
    ),
]

print("Generating 360° turnaround views for Queen Kate (threequarter, side, back)...")

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
        if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
            for part in resp.candidates[0].content.parts:
                if part.inline_data:
                    dst = HERE / f"{view_name}.png"
                    Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                    print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
    except Exception as e:
        print(f"  ❌ Error on {view_name}: {e}", flush=True)

print("Done generating Queen Kate turnaround views!")
