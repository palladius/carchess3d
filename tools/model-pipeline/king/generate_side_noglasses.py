#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0.0", "pillow>=10.0.0", "python-dotenv>=1.0.0"]
# ///
"""Generate clean-shaven, no-glasses 90-degree side profile for King Riccardo and update king_turnaround_sheet.png."""

from io import BytesIO
import os
from pathlib import Path
import subprocess

from dotenv import dotenv_values
from google import genai
from google.genai import types
from PIL import Image

HERE = Path(__file__).resolve().parent
FRONT = HERE / "front.png"
TQ = HERE / "threequarter.png"
BACK = HERE / "back.png"


def load_api_key() -> str:
    if key := os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return key
    for env_path in (Path.home() / "git/gic/.env", Path.home() / ".env"):
        if env_path.exists():
            vals = dotenv_values(env_path)
            if key := vals.get("GEMINI_API_KEY") or vals.get("GOOGLE_API_KEY"):
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


PROMPT_BASE = (
    "Reference images show the exact same collectible 3D chess King bobblehead figurine of Riccardo (Front view and 3/4 view). "
    "CRITICAL REQUIREMENTS: "
    "1. COMPLETELY CLEAN-SHAVEN FACE (ABSOLUTELY NO BEARD, NO MUSTACHE, NO GOATEE, NO STUBBLE — smooth clean-shaven skin identical to the reference images). "
    "2. NO GLASSES / ABSOLUTELY WITHOUT EYEGLASSES (natural unobstructed eyes with dark eyebrows). "
    "3. Same royal dark BLUE velvet cape with white spotted ermine fur lining and collar, blue and gold tunic with golden lion emblem, "
    "holding a vertical golden ceremonial sceptre and golden orb, ornate golden crown, standing on the round wooden KING RICCARDO pedestal. "
    "4. Plain warm neutral studio background, soft balanced studio lighting."
)


def main() -> None:
    client = genai.Client(api_key=load_api_key())
    ref_front = Image.open(FRONT).convert("RGB")
    ref_tq = Image.open(TQ).convert("RGB")
    ref_back = Image.open(BACK).convert("RGB")

    out_dir = HERE / "side_profile_noglasses"
    out_dir.mkdir(exist_ok=True)

    angle_prompt = (
        "Render from EXACT 90-DEGREE SIDE PROFILE (facing left, orthographic product view). "
        "CLEAN-SHAVEN AND NO GLASSES: show his natural clean-shaven side profile, nose, smiling lips, smooth chin/jawline, ear, golden crown, and royal blue velvet cape with white ermine fur collar."
    )

    for model_name in ("gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"):
        try:
            print(f"--> Generating clean-shaven no-glasses side profile with {model_name}...", flush=True)
            resp = client.models.generate_content(
                model=model_name,
                contents=[ref_front, ref_tq, PROMPT_BASE + " " + angle_prompt],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio="1:1"),
                ),
            )
            for part in resp.candidates[0].content.parts:
                if part.inline_data:
                    side_im = (
                        Image.open(BytesIO(part.inline_data.data))
                        .convert("RGB")
                        .resize(ref_front.size, Image.Resampling.LANCZOS)
                    )
                    dst = out_dir / "king_side_clean_shaven_90.png"
                    side_im.save(dst)
                    side_im.save(HERE / "side.png")
                    w, h = ref_front.size
                    sheet = Image.new("RGB", (w * 4, h))
                    sheet.paste(ref_front, (0, 0))
                    sheet.paste(side_im, (w, 0))
                    sheet.paste(ref_back.resize((w, h), Image.Resampling.LANCZOS), (w * 2, 0))
                    sheet.paste(ref_tq.resize((w, h), Image.Resampling.LANCZOS), (w * 3, 0))
                    sheet.save(HERE / "king_turnaround_sheet.png")
                    print("  ✅ Updated side.png and king_turnaround_sheet.png!", flush=True)
                    return
        except Exception as e:
            print(f"  ⚠️ Error with {model_name}: {e}", flush=True)


if __name__ == "__main__":
    main()
