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

ref = Image.open(FRONT)

SUBJECT_BASE = (
    "Reference image: collectible chess knight figurine of Sebastian (a cute, smiling young boy in gleaming golden plate armor "
    "with a vibrant blue cape, riding a noble brown horse with ornate golden head barding on a round wooden pedestal). "
    "Keep the exact same boy, face, hair, armor style, horse, pedestal, cartoon proportions, lighting, and grey studio background. "
    "Full figurine centered in frame. "
)

VARIANTS = [
    (
        "lightsaber",
        "Modify the weapon in his raised hand: replace the short blade with a GLOWING BLUE LIGHTSABER (laser sword / beam saber) "
        "with a sleek metallic hilt and a radiant energy blade casting subtle blue illumination on his armor and face. "
        "He holds the lightsaber triumphantly in the air."
    ),
    (
        "long_lance",
        "Modify the weapon in his raised hand: replace the stubby blade with an impressive, tall, ornate TOURNAMENT JOUSTING LANCE "
        "(long noble cavalry lance with spiral blue and gold patterns and a small fluttering blue pennant flag at the tip). "
        "The lance extends proudly upwards."
    ),
    (
        "unarmed_scary",
        "Modify his arms/hands: REMOVE ALL WEAPONS completely (no sword, no spear, unarmed). "
        "His raised left hand is now a confident, heroic clenched fist of victory, looking fearless, powerful, and badass. "
        "His right hand firmly grips the golden reins of the horse."
    ),
    (
        "epic_sword",
        "Modify the weapon in his raised hand: replace the short blade with an elegant, properly proportioned EPIC LONG SWORD (Excalibur style), "
        "featuring a long gleaming silver-steel blade with a golden crossguard, sapphire pommel, and intricate runic engravings."
    ),
]

out_dir = HERE / "weapon_variants"
out_dir.mkdir(exist_ok=True)

print("Generating weapon variants for Knight Sebastian with Nano Banana 2.1...")

for name, prompt_mod in VARIANTS:
    print(f"--> Generating variant '{name}'...", flush=True)
    try:
        resp = client.models.generate_content(
            model="gemini-nano-banana-2.1",
            contents=[ref, SUBJECT_BASE + prompt_mod],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        saved = False
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = out_dir / f"seby_{name}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
                saved = True
        if not saved:
            print(f"  ❌ No image returned: {resp.candidates[0].finish_reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error generating {name}: {e}", flush=True)

print("Finished weapon variants!")
