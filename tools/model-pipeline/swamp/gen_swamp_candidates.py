#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0.0", "pillow>=10.0.0", "python-dotenv>=1.0.0"]
# ///
"""Generate 3 new Swamp/Fairytale 2D candidates via gemini-nano-banana-2.1:
1. bishop-swamp-gatto.jpg — Il Gatto con gli Stivali (Swashbuckler Cat) as Bishop
2. pawn-swamp-porcellini.jpg — I 3 Porcellini (Three Little Pigs) as Pawn
3. pawn-swamp-zenzy.jpg — Pan di Zenzero & Focaccina all'Italiana as Pawn
"""

from io import BytesIO
import os
from pathlib import Path
import subprocess

from dotenv import dotenv_values
from google import genai
from google.genai import types
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
CHARS_DIR = ROOT / "assets/characters"

MODEL_CANDIDATES = [
    os.environ.get("NB_MODEL", "gemini-nano-banana-2.1"),
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image-preview",
    "gemini-2.5-flash-image",
]

CANDIDATES = [
    (
        "bishop-swamp-gatto",
        "3D Pixar-style fairytale chess piece figurine of 'Don Gatto con gli Stivali — Zorro-Vescovo' as the BISHOP chess piece: "
        "a charismatic, swashbuckling orange-and-white tabby cat standing proudly on a circular mossy flagstone chess pedestal with a brushed gold rim. "
        "He wears a hilarious comic fusion of ZORRO and a CATHOLIC BISHOP: "
        "a sleek black silk Zorro domino eye-mask tied across his face with his HUGE glossy emerald-green kitten eyes shining through, "
        "a tall, ornate black-and-gold Papal/Bishop Mitre hat (Mitra Vescovile) adorned with a glowing ruby cross on the front AND a dramatic sweeping golden-yellow Zorro/cavalier ostrich feather tucked into the side of the mitre! "
        "He wears a flowing black velvet Zorro cape with gold baroque embroidery and a golden 'Z' clasp at the collar, a black leather sword belt with a gold buckle, and tall cuffed dark-brown leather buccaneer boots. "
        "With one white paw he makes a solemn yet mischievous 2-finger Bishop blessing gesture, while his other paw rests on the ornate golden swept-hilt of his rapier sword planted on the pedestal like a pastoral crosier! "
        "Single centered full-body 3D character statue on a dark slate studio backdrop, dramatic three-point rim lighting, masterpiece 3D collectible vinyl-toy chess figurine, zero text or watermarks.",
    ),
    (
        "pawn-swamp-porcellini",
        "3D Pixar-style fairytale chess piece figurine of 'I Tre Porcellini' (The Three Little Pigs) together as a single PAWN chess piece: "
        "three adorable, chubby, rosy-pink fairytale piglets huddled and stacked heroically together on a single circular mossy flagstone chess pedestal with a brushed gold rim. "
        "Each piglet wears a colorful Bavarian/Tyrolean alpine felt hat with a small feather (red, green, and blue vests): "
        "the center piglet stands front-and-center wearing a tiny pot-bellied knight helmet/hat and holding a red clay brick shield and mason's silver trowel; "
        "the left piglet peeks out holding a bundle of golden straw; the right piglet grins holding a bundle of wooden sticks like a spear. "
        "Single unified chess piece silhouette on one round pedestal, dark slate studio backdrop, warm Pixar studio lighting, zero text or watermarks.",
    ),
    (
        "pawn-swamp-zenzy",
        "3D Pixar-style fairytale chess piece figurine of 'Zenzy l'Uomo Pan di Zenzero & Focaccina all'Italiana' as a PAWN chess piece: "
        "an irresistibly funny, feisty golden-brown baked spiced gingerbread-and-focaccia cookie warrior standing on a circular mossy flagstone chess pedestal with a brushed gold rim. "
        "He has classic white royal-icing wavy eyebrows, a determined cute icing smile, white squiggly icing cuffs on his arms and legs, "
        "TWO BIG SHINY PURPLE GUMDROP CANDY BUTTONS on his chest, PLUS an Italian artisanal bakery twist: "
        "a crispy golden focaccia-crust Swiss-Guard morion helmet topped with a fresh green rosemary plume and a glossy black Taggiasca olive emblem, "
        "wielding a red-and-white striped peppermint candy-cane & sesame grissino halberd! "
        "Single centered full-body 3D character statue on a dark slate studio backdrop, warm bakery + magical rim lighting, zero text or watermarks.",
    ),
]


def load_api_key() -> str:
    if key := os.environ.get("GEMINI_API_KEY"):
        return key
    gic = Path(os.environ.get("GIC", Path.home() / "git/gic"))
    for env_path in (gic / ".env", Path.home() / ".env"):
        if env_path.exists():
            vals = dotenv_values(env_path)
            if key := vals.get("GEMINI_API_KEY"):
                return key
    out = subprocess.run(
        ["bash", "-ic", 'printf "KEY_START:%s:KEY_END" "$GEMINI_API_KEY"'],
        capture_output=True,
        text=True,
        check=False,
    ).stdout
    if "KEY_START:" in out and ":KEY_END" in out:
        extracted = out.split("KEY_START:", 1)[1].split(":KEY_END", 1)[0].strip()
        if extracted:
            return extracted
    raise RuntimeError("GEMINI_API_KEY not found in environment or ~/.env")


def generate_one_image(client: genai.Client, prompt: str) -> tuple[Image.Image, str]:
    seen = []
    last_err = None
    for model_name in MODEL_CANDIDATES:
        if model_name in seen:
            continue
        seen.append(model_name)
        try:
            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio="1:1"),
                ),
            )
            for candidate in resp.candidates or []:
                if not candidate.content or not candidate.content.parts:
                    continue
                for part in candidate.content.parts:
                    if part.inline_data and part.inline_data.data:
                        raw = part.inline_data.data
                        if isinstance(raw, str):
                            import base64
                            raw = base64.b64decode(raw)
                        img = Image.open(BytesIO(raw)).convert("RGB")
                        return img, model_name
        except Exception as exc:
            last_err = exc
            continue
    raise RuntimeError(f"All models failed ({seen}). Last error: {last_err}")


def main() -> None:
    api_key = load_api_key()
    client = genai.Client(api_key=api_key)
    CHARS_DIR.mkdir(parents=True, exist_ok=True)

    for slug, prompt in CANDIDATES:
        out_path = CHARS_DIR / f"{slug}.jpg"
        print(f"🎨 Generating {out_path.name}...", flush=True)
        img, used_model = generate_one_image(client, prompt)
        img.save(out_path, format="JPEG", quality=93, optimize=True)
        print(f"  ✅ Saved {out_path.relative_to(ROOT)} via {used_model} ({img.size[0]}x{img.size[1]})", flush=True)


if __name__ == "__main__":
    main()
