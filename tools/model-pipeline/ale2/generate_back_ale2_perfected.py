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
    "Reference images: the SAME collectible chess figurine of Alessandro (a cheerful, smiling boy with thick brown hair "
    "and no hat, dressed in an ornate royal blue velvet robe and cape with gold border embroidery and golden celestial star/planet motifs, "
    "holding a golden astrolabe staff in his left hand, with a cute small red dragon with green accents perched on his right shoulder, "
    "standing on a round dark wooden pedestal). "
)

STYLE = (
    " Keep identical proportions, cheerful friendly cartoon style, exact colors, fabrics, pedestal and lighting. "
    "Plain uniform mid-grey studio background, soft even light, whole figurine fully visible and centred, "
    "orthographic-looking product shot. No text, no labels, no captions, no extra objects."
)

BACK_PROMPT = (
    "Render this exact same figurine seen from DIRECTLY BEHIND (camera rotated 180 degrees around it, "
    "same height and distance as the front view). "
    "- Head: show the back of his thick brown styled hair (he wears NO hat). "
    "- Robe & Cape: show the back of the royal blue velvet cape draped over his back down to the pedestal, decorated with delicate golden star and constellation patterns, with hints of purple inner lining at the bottom/edges. "
    "- Dragon: the dragon is on the boy's right shoulder, so from behind it appears perched on the LEFT shoulder (show the dragon's red scaly back, wings, and curled tail). "
    "- Staff: the golden staff is in the boy's left hand, so from behind the staff appears on the RIGHT side. "
    "- Pedestal: show the round dark turned wooden pedestal from behind."
)

MODELS = [
    ("nb21_v2", "gemini-nano-banana-2.1"),
    ("nbpro_v2", "gemini-3-pro-image-preview"),
    ("nbflash_v2", "gemini-3.1-flash-image"),
]

out_dir = HERE / "experiments_back"
out_dir.mkdir(exist_ok=True)

print(f"Starting perfected back generation across {len(MODELS)} models...")

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

print("Finished perfected generation!")
