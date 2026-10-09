import os
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image
from google import genai
from google.genai import types

HERE = Path(__file__).parent
FRONT = HERE / "front.png"
SEBY1 = Path("assets/characters/knight-seby-1.jpg")

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_horse = Image.open(FRONT)
ref_seby1 = Image.open(SEBY1)

SUBJECT_BASE = (
    "Reference image: collectible 3D chess knight figurine of Sebastian (a cute, smiling, heroic young boy with sandy brown hair, "
    "wearing gleaming golden plate armor with blue cape and accents, riding a noble brown horse with golden head armor on a round wooden pedestal). "
    "Keep the exact same face, hair, armor style, horse, round pedestal, cheerful cartoon proportions, lighting and clean studio background. "
)

HALBERD_PROMPTS = [
    (
        "halberd_tall_mounted",
        "Modify the weapon: Sebastian holds an IMPRESSIVE, TALL, EXTRA-LONG NOBLE HALBERD (medieval polearm / alabarda). "
        "The shaft is long and sturdy (made of polished dark wood with golden spiral bands), extending significantly above his head. "
        "The top head of the halberd features a gleaming battle axe blade on one side, a sharp spearhead spike pointing straight up, "
        "and a curved armor-piercing beak/hook on the reverse side, all crafted in ornate golden metal with blue gem inlays. "
        "He holds this majestic long halberd proudly aloft upright."
    ),
    (
        "halberd_super_long",
        "Modify the weapon: replace any short weapon with a GRAND TOURNAMENT CEREMONIAL HALBERD with an EXTRA LONG SHAFT. "
        "The polearm is notably tall, reaching high into the air with a large ornate golden axe blade, piercing top lance tip, "
        "and a flowing royal blue silk pennant ribbon fluttering just below the axe head. "
        "The proportion of the halberd is long, grand, and commanding."
    ),
    (
        "halberd_classic_standing",
        "Reference image 2 (knight-seby-1): Standing chess knight figurine of Sebastian holding an EXTRA-LONG golden halberd (alabarda) "
        "grounded beside him, extending well above his head, with a formidable axe-head, spear tip, and blue ribbon. "
        "Round wooden pedestal, clean grey background."
    ),
]

out_dir = HERE / "halberd_primary"
out_dir.mkdir(exist_ok=True)

print("Generating Primary Halberd (Alabarda Lunga) variants for Sebastian with Nano Banana 2.1 / Pro...")

for name, prompt_mod in HALBERD_PROMPTS:
    print(f"--> Generating variant '{name}' with gemini-nano-banana-2.1...", flush=True)
    try:
        resp = client.models.generate_content(
            model="gemini-nano-banana-2.1",
            contents=[ref_horse, ref_seby1, SUBJECT_BASE + prompt_mod],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = out_dir / f"seby_{name}_nb21.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
    except Exception as e:
        print(f"  ❌ Error with nb2.1: {e}", flush=True)

    print(f"--> Generating variant '{name}' with gemini-3-pro-image-preview...", flush=True)
    try:
        resp = client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[ref_horse, ref_seby1, SUBJECT_BASE + prompt_mod],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = out_dir / f"seby_{name}_pro.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
    except Exception as e:
        print(f"  ❌ Error with Pro: {e}", flush=True)

print("Done generating Primary Halberd variants!")
