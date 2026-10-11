#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0.0", "pillow>=10.0.0", "python-dotenv>=1.0.0"]
# ///
"""Generate Asinello Chiacchierone (Swamp Knight) with an absurd, infectious 40-tooth ear-to-ear grin."""

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

PROMPTS = [
    (
        "knight-swamp-asinello",
        "3D Pixar-style fairytale chess piece figurine of 'Asinello Chiacchierone' (a hilarious, hyper-expressive talking pack-burro steed with Eddie Murphy stand-up comedy charisma) as the KNIGHT chess piece: "
        "an adorable grey-brown and warm chestnut furry burro with a lighter cream muzzle, standing in a dynamic rearing/prancing chess Knight pose on a circular mossy flagstone chess pedestal with a brushed gold rim. "
        "THE MOST IMPORTANT FEATURE: he is looking straight at the viewer with an ABSURD, MASSIVE, INFECTIOUS EAR-TO-EAR HOLLYWOOD GRIN showing 40 giant sparkling white teeth (upper and lower rows of huge gleaming white teeth in a hilarious open-lip comedy smile that completely conquers you!), "
        "paired with one high-arched cocky eyebrow, big expressive warm brown eyes bursting with cheeky charisma, and tall fuzzy upright burro ears! "
        "He wears a whimsical medieval tournament caparison collar in crimson and gold with a small wooden onion-emblem buckler on his shoulder. "
        "Single centered full-body 3D character statue on a dark slate studio backdrop, dramatic three-point studio rim lighting, masterpiece 3D collectible chess figurine, zero text or watermarks.",
    ),
    (
        "knight-swamp-asinello-2",
        "3D Pixar-style fairytale chess piece figurine of 'Asinello Chiacchierone' (an irresistibly funny, wisecracking fairytale burro steed with Eddie Murphy comedy energy) as the KNIGHT chess piece: "
        "a charismatic warm grey-and-cappuccino furry pack-burro with a cream belly and muzzle, posed proudly on a circular mossy flagstone chess pedestal with a brushed gold rim. "
        "NON-NEGOTIABLE HERO FEATURE: a GIANT, EXAGGERATED, INFECTIOUS 40-TOOTH EAR-TO-EAR BEAMING SMILE — lips pulled wide back showing two full rows of huge, gleaming, pearly-white cartoon teeth in the ultimate show-stopping comedy grin, "
        "with raised sassy eyebrows, wide joyful eyes, and long upright plush ears! "
        "He wears a medieval jousting saddle-blanket in royal plum and gold trim. "
        "Single centered full-body 3D character statue on a dark slate studio backdrop, warm studio rim lighting, zero text or watermarks.",
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

    for slug, prompt in PROMPTS:
        out_path = CHARS_DIR / f"{slug}.jpg"
        print(f"🎨 Generating {out_path.name}...", flush=True)
        img, used_model = generate_one_image(client, prompt)
        img.save(out_path, format="JPEG", quality=93, optimize=True)
        print(f"  ✅ Saved {out_path.relative_to(ROOT)} via {used_model} ({img.size[0]}x{img.size[1]})", flush=True)


if __name__ == "__main__":
    main()
