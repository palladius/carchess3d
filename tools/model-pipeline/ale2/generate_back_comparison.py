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
    "Reference images: the SAME collectible chess bishop figurine of Alessandro (a cute, cheerful, smiling young boy "
    "dressed in ornate white and gold bishop vestments with green gemstone accents and gold trim, wearing a tall bishop's "
    "mitre hat with green gems, with a cute little red winged dragon companion perched on his shoulder/arm, "
    "holding a golden pastoral staff/crosier, standing on a round dark wooden pedestal). "
)

STYLE = (
    " Keep identical proportions, cheerful friendly cartoon style, colours, materials, pedestal and lighting. "
    "Plain uniform mid-grey studio background, soft even light, whole figurine fully visible and centred, "
    "orthographic-looking product shot. No text, no labels, no captions, no extra objects."
)

BACK_PROMPT = (
    "Render this exact same figurine seen from DIRECTLY BEHIND (camera rotated 180 degrees around it, "
    "same height and distance as the front view). Show the back of the bishop mitre hat with the two hanging ribbons (lappets/infulae), "
    "the back of the boy's brown hair, the back of the white and gold bishop cape and robes draped elegantly down to the pedestal, "
    "and the back of the little red dragon (showing its red scaly back, wings, and curled tail from behind). "
    "Show the back of the golden staff and the back of the wooden pedestal."
)

MODELS = [
    ("nb_2.1", "gemini-nano-banana-2.1"),
    ("nb_pro", "gemini-3-pro-image-preview"),
    ("nb_v1_flash", "gemini-2.5-flash-image"),
    ("nb_v2_flash", "gemini-3.1-flash-image"),
]

out_dir = HERE / "experiments_back"
out_dir.mkdir(exist_ok=True)

print(f"Starting comparison generation across {len(MODELS)} models...")

for label, model_name in MODELS:
    print(f"--> Generating with {label} ({model_name})...", flush=True)
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
                img_path = out_dir / f"back_{label}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(img_path)
                print(f"  ✅ Saved {img_path.name} ({img_path.stat().st_size // 1024} KB)", flush=True)
                saved = True
        if not saved:
            print(f"  ❌ No image returned: {resp.candidates[0].finish_reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error with {model_name}: {e}", flush=True)

print("Finished generating comparison!")
