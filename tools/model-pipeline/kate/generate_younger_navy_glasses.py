import os
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from google import genai
from google.genai import types

HERE = Path(__file__).parent
SRC4 = Path("assets/characters/queen-kate-4.jpg")

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_kate4 = Image.open(SRC4)

out_dir = HERE / "younger_navy_glasses"
out_dir.mkdir(exist_ok=True)

PROMPT_BASE = (
    "Reference image: collectible 3D chess queen figurine of Kate from version 4. "
    "Keep the exact overall concept, charming collectible figurine format, royal gown style with elegant fabrics and gold filigree, "
    "regal queen crown/tiara, friendly warm personality, and round polished wooden pedestal on a clean neutral grey background. "
    "CRITICAL USER SPECIFICATIONS: "
    "1. MAKE HER NOTABLY YOUNGER: Fresh, radiant, youthful face (mid-30s youthful look, smooth glowing skin, cute bright expressive eyes, cheerful friendly smile). "
    "2. WITH NAVY GLASSES: She wears chic, modern, stylish NAVY BLUE framed eyeglasses (dark navy / deep blue frames) that sit comfortably and flatter her cute youthful face. "
)

RUNS = [
    (
        "var1_youthful_navy_nb21",
        "gemini-nano-banana-2.1",
        "Full front / 3-4 collectible figurine portrait. "
        "Youthful lovely face with chic dark navy blue eyeglasses, bright kind eyes, gentle smile, lovely hair under an ornate queen crown, "
        "magnificent royal queen gown, on a round wooden base."
    ),
    (
        "var2_youthful_navy_pro",
        "gemini-3-pro-image-preview",
        "Full collectible queen figurine shot. "
        "Younger fresh face with elegant navy blue glasses, youthful charm, beautiful hair, golden tiara, royal queen gown, round pedestal."
    ),
    (
        "var3_chic_navy_nb21",
        "gemini-nano-banana-2.1",
        "Turnaround / product front view of Queen Kate. "
        "Youthful cute face, stylish navy blue spectacles, radiant warm smile, royal queen regalia, centered in frame on wooden pedestal."
    ),
    (
        "var4_chic_navy_pro",
        "gemini-3-pro-image-preview",
        "High quality collectible chess queen figurine. "
        "Youthful glowing appearance, navy-blue framed glasses, queen crown, flowing royal gown, round pedestal, studio product photography."
    ),
]

print("Generating younger Queen Kate with navy glasses...")

for label, model_name, style_prompt in RUNS:
    print(f"--> Generating '{label}' with {model_name}...", flush=True)
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=[ref_kate4, PROMPT_BASE + " " + style_prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = out_dir / f"kate_{label}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
    except Exception as e:
        print(f"  ❌ Error with {label}: {e}", flush=True)

print("Done generating younger Queen Kate variants with navy glasses!")
