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

refs = [Image.open(FRONT), Image.open(TQ)]

SUBJECT = (
    "Reference images: the SAME collectible chess knight figurine of Sebastian (a cute, smiling young boy with sandy brown hair "
    "and blue eyes, wearing gleaming golden plate armor and a vibrant blue cape, holding a golden sword aloft, "
    "riding a noble brown horse with ornate golden head armor/barding and a blue saddlecloth with gold trim, "
    "standing on a round polished wooden pedestal with 'SEBASTIAN - KNIGHT' engraved). "
)

STYLE = (
    "Keep identical proportions, friendly animated cartoon style, materials, colors, pedestal and studio lighting. "
    "Plain uniform neutral grey studio background, soft even light, whole figurine fully visible and centred, "
    "orthographic-looking product shot. No text, no extra characters."
)

BACK_PROMPT = (
    "Render this exact same chess knight figurine seen from DIRECTLY BEHIND (camera rotated 180 degrees around the figurine, "
    "at the exact same height, scale and distance as the front view). "
    "Show the back of the boy's sandy hair, the back of his golden shoulder armor, the flowing blue cape draped elegantly behind him, "
    "the rear of the horse including its brown hindquarters, tail, blue saddle blanket with gold border, and the back of the circular wooden pedestal. "
    "The raised arm and sword are seen from behind."
)

MODELS = [
    ("nb_2.1", "gemini-nano-banana-2.1"),
    ("nb_pro", "gemini-3-pro-image-preview"),
]

print(f"Generating back view for Knight Sebastian using Nano Banana 2.1...")

for label, model_name in MODELS:
    print(f"--> Requesting from {label} ({model_name})...", flush=True)
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=[*refs, SUBJECT + BACK_PROMPT + STYLE],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        saved = False
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                img_path = HERE / f"back_{label}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(img_path)
                print(f"  ✅ Saved {img_path.name} ({img_path.stat().st_size // 1024} KB)", flush=True)
                # Also save canonical back.png
                if label == "nb_2.1" or not (HERE / "back.png").exists():
                    Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(HERE / "back.png")
                    print(f"  ⭐ Saved canonical back.png", flush=True)
                saved = True
        if not saved:
            print(f"  ❌ No image in response: {resp.candidates[0].finish_reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error with {model_name}: {e}", flush=True)

print("Done generating back views!")
