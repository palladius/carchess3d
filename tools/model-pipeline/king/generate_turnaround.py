import os
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from google import genai
from google.genai import types

HERE = Path(__file__).parent
FRONT = HERE / "front.png"
TQ = HERE / "threequarter.png"

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_front = Image.open(FRONT)
ref_tq = Image.open(TQ)

SUBJECT = (
    "Reference images: collectible 3D chess king figurine of Riccardo (a friendly, bearded smiling man with dark hair, glasses, "
    "wearing an ornate golden royal crown, a magnificent crimson velvet cape trimmed with ermine fur, a royal blue and gold tunic, "
    "holding a golden ceremonial sceptre, standing on a round dark polished wooden pedestal). "
    "Keep exact proportions, colors, cartoon stylized look, soft studio lighting on neutral grey background."
)

VIEWS = [
    (
        "back",
        "Render this exact figurine seen from DIRECTLY BEHIND (camera rotated 180 degrees around the figurine, "
        "orthographic product shot at the exact same height and scale). "
        "Show the back of the golden crown, the back of his dark hair, the back of the luxurious crimson velvet royal cape with ermine fur trim "
        "draping down to the pedestal, and the back of the round wooden pedestal."
    ),
    (
        "side",
        "Render this exact figurine from the 90-DEGREE SIDE PROFILE (camera rotated 90 degrees, orthographic product shot). "
        "Show his side profile with glasses, crown, beard, royal robes, the vertical sceptre, and the round wooden pedestal."
    ),
]

print("Generating Back (180°) and Side (90°) views for King Riccardo with Nano Banana 2.1...")

for view_name, prompt in VIEWS:
    print(f"--> Generating '{view_name}' view...", flush=True)
    try:
        resp = client.models.generate_content(
            model="gemini-nano-banana-2.1",
            contents=[ref_front, ref_tq, SUBJECT + " " + prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        saved = False
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = HERE / f"{view_name}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
                saved = True
        if not saved:
            print(f"  ❌ No image returned: {resp.candidates[0].finish_reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error generating {view_name}: {e}", flush=True)

print("Done generating King Riccardo turnaround views!")
