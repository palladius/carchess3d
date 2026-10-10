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
REF2 = Path("assets/characters/king-riccardo-2.jpg")

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=key)

ref_front = Image.open(FRONT)
ref_tq = Image.open(TQ)
ref_extra = Image.open(REF2)

out_dir = HERE / "side_profile_experiments"
out_dir.mkdir(exist_ok=True)

PROMPTS = [
    (
        "var1_strict_likeness_nb21",
        "gemini-nano-banana-2.1",
        "STRICT CHARACTER LIKENESS MANDATE: Maintain 100% exact facial likeness of Riccardo from the references! "
        "Same face shape, same nose, same dark rectangular glasses, same neatly trimmed dark beard and mustache, "
        "same friendly cheerful smiling mouth with smiling cheeks, same golden crown resting on his dark hair. "
        "Render the figurine seen from the 90-DEGREE SIDE PROFILE (orthographic product shot on plain grey background). "
        "Show his recognizable profile with glasses on nose bridge, beard line, ear, crown, royal red cape with ermine trim, "
        "vertical golden sceptre in hand, and round dark wooden pedestal."
    ),
    (
        "var2_slight_angle_nb21",
        "gemini-nano-banana-2.1",
        "Maintain PERFECT facial likeness of Riccardo (glasses, beard, nose, friendly smile, facial structure). "
        "Render from a deep 75-80 degree side view so his recognizable facial features (eyes behind glasses, smile, beard) "
        "are clearly visible and undeniably match the front and 3/4 views. "
        "Royal crimson and ermine cape, golden crown, round pedestal."
    ),
    (
        "var3_strict_likeness_pro",
        "gemini-3-pro-image-preview",
        "STRICT CHARACTER LIKENESS MANDATE: Exact caricature likeness of Riccardo. "
        "The face must be identical in side profile to the reference images: same nose bridge and glasses, same cheerful Italian face, "
        "same beard grooming, same smile lines. Orthographic 90-degree side profile on neutral grey studio background, "
        "full figurine centered from crown to wooden pedestal."
    ),
    (
        "var4_profile_pro",
        "gemini-3-pro-image-preview",
        "Side profile view (90 degrees rotation) of King Riccardo figurine. "
        "Carefully preserve the facial likeness: distinctive glasses, nose profile, trimmed beard, happy smiling expression, "
        "golden crown, royal red cape draping behind, golden sceptre in hand, round wooden pedestal."
    ),
    (
        "var5_photoconsistent_nb21",
        "gemini-nano-banana-2.1",
        "Orthographic side view of the SAME figurine of King Riccardo. "
        "Ensure the caricature portrait is fully consistent with reference 1 and 2: nose shape, glasses frames, "
        "beard curvature, smiling lips, ear, crown placement. Studio product photography on uniform grey background."
    ),
    (
        "var6_photoconsistent_pro",
        "gemini-3-pro-image-preview",
        "Side view (profile) of collectible King Riccardo chess piece. "
        "Preserve exact facial geometry and recognizable likeness of Riccardo: dark hair, glasses, beard, cheerful face, "
        "crown, royal attire, sceptre, circular wooden base."
    ),
]

print(f"Generating {len(PROMPTS)} side profile variations for King Riccardo...")

for label, model_name, prompt in PROMPTS:
    print(f"--> Generating '{label}' using {model_name}...", flush=True)
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=[ref_front, ref_tq, ref_extra, prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        saved = False
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                dst = out_dir / f"king_side_{label}.png"
                Image.open(BytesIO(part.inline_data.data)).convert("RGB").save(dst)
                print(f"  ✅ Saved {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)
                saved = True
        if not saved:
            print(f"  ❌ No image returned: {resp.candidates[0].finish_reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error with {label}: {e}", flush=True)

print("Finished generating side profile variations!")
