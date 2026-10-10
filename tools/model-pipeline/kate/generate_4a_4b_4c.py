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

EDITS = [
    (
        "4a",
        "STRICT EDIT OF VERSION 4: Make Queen Kate noticeably YOUNGER and add stylish NAVY BLUE GLASSES. "
        "Edit 4a: Chic modern dark navy blue spectacles that complement her cute youthful face. "
        "Smooth youthful skin, bright kind expressive eyes behind the navy frames, warm friendly smile, "
        "elegant hairstyle with golden queen crown, gorgeous royal gown with gold accents as in version 4, round wooden pedestal."
    ),
    (
        "4b",
        "STRICT EDIT OF VERSION 4: Make Queen Kate noticeably YOUNGER and add stylish NAVY BLUE GLASSES. "
        "Edit 4b: Subtle, elegant rounded navy blue eyeglasses. "
        "Radiant fresh youthful appearance (~30s), cheerful face, sparkling eyes, royal tiara, "
        "magnificent blue and gold queen robes matching the charm of version 4, on round dark wooden base."
    ),
    (
        "4c",
        "STRICT EDIT OF VERSION 4: Make Queen Kate noticeably YOUNGER and add stylish NAVY BLUE GLASSES. "
        "Edit 4c: Sophisticated designer navy blue framed glasses with a poised, regal yet youthful and cheerful expression. "
        "Fresh luminous face, bright smile, royal queen regalia, gold filigree gown, round wooden pedestal, studio lighting."
    ),
]

print("Generating 3 edits of Version 4: 4a, 4b, 4c (Younger + Navy Glasses)...")

for label, prompt in EDITS:
    print(f"--> Generating version {label} with gemini-nano-banana-2.1...", flush=True)
    try:
        resp = client.models.generate_content(
            model="gemini-nano-banana-2.1",
            contents=[ref_kate4, prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        saved = False
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = HERE / f"queen-kate-{label}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
                saved = True
        if not saved:
            print(f"  ❌ No image returned for {label}: {resp.candidates[0].finish_reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error for {label}: {e}", flush=True)

print("Done generating 4a, 4b, 4c!")
