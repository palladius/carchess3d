import os
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from google import genai
from google.genai import types

HERE = Path(__file__).parent
FACE_REF = HERE / "wild_alternatives/kate_alt6_round_navy_glasses.png"
DRESS_REF = Path("assets/characters/queen-kate-4.jpg")

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_face = Image.open(FACE_REF)
ref_dress = Image.open(DRESS_REF)

out_dir = HERE / "final_queen_canonical"
out_dir.mkdir(exist_ok=True)

SUBJECT_BASE = (
    "Reference image 1 (Face reference): Use this EXACT lovely face, authentic warm smile, hairstyle, and stylish round NAVY BLUE eyeglasses. "
    "Reference image 2 (Dress & details reference): Use this exact ROYAL PURPLE / VIOLET gown with gold embroidery, and the golden ring with jewel on her finger. "
    "MANDATORY SPECIFICATIONS: "
    "1. EYES: Beautiful, clear, sparkling GREEN EYES (vibrant emerald green eyes behind the navy glasses). "
    "2. GLASSES: Chic round NAVY BLUE frames. "
    "3. GOWN: Magnificent ROYAL PURPLE / VIOLET velvet gown (vestito in viola) with exquisite gold filigree and embroidery. "
    "4. JEWELRY: An elegant golden ring on her hand/finger, and a delicate golden queen tiara/crown on her head. "
    "5. PEDESTAL: Collectible 3D chess queen figurine standing on a round dark polished wooden pedestal, studio lighting on clean neutral grey background."
)

RUNS = [
    (
        "kate_final_v1_nb21",
        "gemini-nano-banana-2.1",
        "Full figurine portrait. "
        "Keep the exact face and round navy glasses of Image 1 with emerald green eyes, "
        "dressed in the luxurious royal purple gown with golden ring on finger from Image 2."
    ),
    (
        "kate_final_v2_nb21",
        "gemini-nano-banana-2.1",
        "Collectible 3D chess queen figurine of Kate. "
        "Emerald green eyes, navy blue round spectacles, radiant friendly smile, purple velvet gown with gold trim, "
        "golden ring on hand, round wooden pedestal."
    ),
    (
        "kate_final_v3_pro",
        "gemini-3-pro-image-preview",
        "Master high-definition collectible figurine shot. "
        "The charming face from Image 1 with bright green eyes, navy glasses, "
        "luxurious purple velvet royal gown and golden ring from Image 2, golden crown, round wooden base."
    ),
]

print("Generating Final Canonical Queen Kate (Option 3 Face + Green Eyes + Purple Gown + Ring + Navy Glasses)...")

for label, model_name, nuance in RUNS:
    print(f"--> Generating '{label}' using {model_name}...", flush=True)
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=[ref_face, ref_dress, SUBJECT_BASE + " " + nuance],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        saved = False
        if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
            for part in resp.candidates[0].content.parts:
                if part.inline_data:
                    dst = out_dir / f"{label}.png"
                    Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                    print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
                    saved = True
        if not saved:
            reason = resp.candidates[0].finish_reason if resp.candidates else "no response"
            print(f"  ❌ No image returned: {reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error with {label}: {e}", flush=True)

print("Done generating Final Canonical Queen Kate!")
