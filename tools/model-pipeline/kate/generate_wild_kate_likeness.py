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

out_dir = HERE / "wild_alternatives"
out_dir.mkdir(exist_ok=True)

# 5 distinct creative directions, all anchored on Kate 4's authentic face
VARIANTS = [
    (
        "alt1_pixar_cateye_nb21",
        "gemini-nano-banana-2.1",
        "Reference image: collectible 3D chess queen figurine of Kate from version 4. "
        "MANDATE: PRESERVE KATE'S REAL FACE AND FACIAL IDENTITY from the reference image (her actual nose shape, genuine smile, eye shape, and cheek structure). "
        "MODIFICATIONS: "
        "1. Rejuvenate her into a fresh, vibrant, twenty-something woman ('Kate ventenne') full of life and warmth. "
        "2. Add chic, stylish NAVY BLUE cat-eye framed eyeglasses that look gorgeous on her authentic face. "
        "3. Keep the charming royal gown, golden queen crown, and round wooden pedestal of the figurine on neutral grey background."
    ),
    (
        "alt2_modern_rectangular_pro",
        "gemini-3-pro-image-preview",
        "Reference image: Queen Kate version 4. "
        "Make an authentic edit: she must clearly be KATE (recognize her facial features, mouth, nose, and smiling eyes from the reference), "
        "just 15 years younger in her radiant 20s. "
        "Add sleek, modern dark NAVY BLUE rectangular spectacles. "
        "Delicate golden queen crown, flowing royal blue and gold gown, round wooden pedestal."
    ),
    (
        "alt3_cheerful_round_nb21",
        "gemini-nano-banana-2.1",
        "Reference image: Queen Kate version 4. "
        "Rejuvenate Kate into her early 20s while strictly retaining her recognizable facial likeness (her real nose, real friendly smile lines). "
        "She wears trendy, sophisticated ROUND navy-blue metal-rimmed eyeglasses. "
        "Expressive sparkling eyes, glowing youthful complexion, royal queen attire, wooden base."
    ),
    (
        "alt4_clay_figurine_nb21",
        "gemini-nano-banana-2.1",
        "Exact in-place style revision of Version 4: "
        "Keep the exact same collectible clay/vinyl figurine of Kate, maintaining her authentic facial likeness and proportions, "
        "but refreshed into a youthful, younger 25-year-old look with elegant dark NAVY BLUE eyeglasses. "
        "Warm friendly grin, royal tiara, ornate gown, round pedestal."
    ),
    (
        "alt5_royal_sapphire_pro",
        "gemini-3-pro-image-preview",
        "Reference image: Queen Kate version 4. "
        "A stunning, creative character concept of Kate as the Chess Queen: "
        "Her unmistakable face from the reference image, youthful and radiant in her 20s, "
        "wearing designer navy-blue framed glasses. "
        "Ornate golden crown with tiny sapphire gems, luxurious royal velvet gown with gold embroidery, round dark wooden base."
    ),
]

print("Generating 5 diverse, authentic alternatives for Queen Kate...")

for label, model_name, prompt in VARIANTS:
    print(f"--> Generating '{label}' using {model_name}...", flush=True)
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=[ref_kate4, prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        saved = False
        if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
            for part in resp.candidates[0].content.parts:
                if part.inline_data:
                    dst = out_dir / f"kate_{label}.png"
                    Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                    print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
                    saved = True
        if not saved:
            reason = resp.candidates[0].finish_reason if resp.candidates else "no candidates"
            print(f"  ❌ No image returned: {reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error with {label}: {e}", flush=True)

print("Finished generating 5 authentic alternatives!")
