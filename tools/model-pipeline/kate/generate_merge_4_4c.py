import os
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from google import genai
from google.genai import types

HERE = Path(__file__).parent
SRC4 = Path("assets/characters/queen-kate-4.jpg")
SRC4C = HERE / "queen-kate-4c.png"

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_4 = Image.open(SRC4)
ref_4c = Image.open(SRC4C)

out_dir = HERE / "merge_4_and_4c"
out_dir.mkdir(exist_ok=True)

PROMPT_BASE = (
    "Reference image 1 (original 4): Contains Kate's authentic, recognizable facial features, real nose, smile lines, and distinctive facial identity. "
    "Reference image 2 (version 4c): Contains the stylish navy blue glasses and fresh youthful polish that Kate loved. "
    "TASK: MERGE the two images into the perfect character portrait. "
    "Do NOT make her an unrecognisable generic model: restore Kate's authentic face, nose structure, smile shape, and recognizable caricature identity from Image 1, "
    "while rejuvenating her into a fresh, youthful twenty-something version ('figlia ventenne di 4' / youthful Kate in her 20s-30s), "
    "wearing the stylish dark NAVY BLUE GLASSES from Image 2. "
    "Keep the magnificent royal gown, golden queen crown, and round wooden pedestal of the collectible chess figurine on grey studio background."
)

RUNS = [
    (
        "merge_4d_balanced_nb21",
        "gemini-nano-banana-2.1",
        "Balanced 50/50 merge: authentic facial likeness of Kate from Image 1 (real nose, real mouth and smile), "
        "youthful smooth glow ('twenty-something daughter of 4'), wearing chic navy blue framed eyeglasses from Image 2."
    ),
    (
        "merge_4e_likeness_priority_nb21",
        "gemini-nano-banana-2.1",
        "Prioritize facial likeness to Image 1: clearly recognizable as the same woman from Image 1, "
        "just 15 years younger, with natural smile lines, authentic nose bridge, and wearing modern navy glasses."
    ),
    (
        "merge_4f_pro_perfection",
        "gemini-3-pro-image-preview",
        "Master blend using Gemini Pro: blend the authentic personality and facial contours of Image 1 "
        "with the youthful energy and stylish navy glasses of Image 2. Figurine centered on wooden pedestal."
    ),
    (
        "merge_4g_youthful_blend_pro",
        "gemini-3-pro-image-preview",
        "Subtle youthful caricature: authentic Kate from 4 rejuvenated into her 20s, with navy glasses from 4c, "
        "warm authentic smile, queen tiara, royal navy and gold robes, studio lighting."
    ),
]

print("Generating merge variants of 4 + 4c (Authentic Likeness + Youthful + Navy Glasses)...")

for label, model_name, nuance_prompt in RUNS:
    print(f"--> Generating '{label}' with {model_name}...", flush=True)
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=[ref_4, ref_4c, PROMPT_BASE + " " + nuance_prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = out_dir / f"queen-kate-{label}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
    except Exception as e:
        print(f"  ❌ Error with {label}: {e}", flush=True)

print("Done generating merge variants!")
