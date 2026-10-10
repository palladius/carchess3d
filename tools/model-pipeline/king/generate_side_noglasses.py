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

out_dir = HERE / "side_profile_noglasses"
out_dir.mkdir(exist_ok=True)

PROMPT_BASE = (
    "Reference images: collectible 3D chess King figurine of Riccardo. "
    "CRITICAL REQUIREMENT: NO GLASSES / ABSOLUTELY WITHOUT EYEGLASSES (natural eyes with dark eyebrows, clean unobstructed face). "
    "He has a friendly, smiling cheerful face, neatly groomed dark beard and mustache, dark hair under an ornate golden crown. "
    "He wears a magnificent royal crimson velvet cape with ermine fur lining and collar, blue and gold tunic, "
    "holding a vertical golden ceremonial sceptre, standing on a round dark wooden pedestal. "
    "Plain neutral studio grey background, soft balanced studio lighting. "
)

RUNS = [
    (
        "profile_90_nb21",
        "gemini-nano-banana-2.1",
        "Render from EXACT 90-DEGREE SIDE PROFILE (orthographic product view). "
        "NO GLASSES: show his natural side profile, nose, smiling lips, trimmed beard line, ear, crown, and royal cape draping behind."
    ),
    (
        "profile_90_pro",
        "gemini-3-pro-image-preview",
        "Render from EXACT 90-DEGREE SIDE PROFILE (orthographic product view). "
        "NO GLASSES: natural eyes, smiling cheek, beard, crown, sceptre, and cape."
    ),
    (
        "angle_75_nb21",
        "gemini-nano-banana-2.1",
        "Render from a deep 75-80 DEGREE SIDE ANGLE (mostly side profile but revealing the friendly expression, natural eye without glasses, smile, and beard). "
        "Full figurine centered from crown to pedestal."
    ),
    (
        "angle_75_pro",
        "gemini-3-pro-image-preview",
        "Render from a deep 75-80 DEGREE SIDE ANGLE. "
        "NO GLASSES. Identical facial caricature likeness to the reference images: same nose, smile, beard, and crown."
    ),
]

print("Generating King Riccardo side views WITHOUT GLASSES...")

for label, model_name, angle_prompt in RUNS:
    print(f"--> Generating '{label}' with {model_name}...", flush=True)
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=[ref_front, ref_tq, PROMPT_BASE + " " + angle_prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = out_dir / f"king_side_{label}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
    except Exception as e:
        print(f"  ❌ Error with {label}: {e}", flush=True)

print("Done generating side views without glasses!")
