#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0.0", "pillow>=10.0.0", "python-dotenv>=1.0.0"]
# ///
"""Generate the 6 Nano Banana 2.1 2D portraits for the Carlessian Classic Chess Family (`classic`).

Usage:
    UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy \
        uv run tools/model-pipeline/classic/gen_classic_portraits.py [piece ...]

Reads GEMINI_API_KEY from env or $GIC/.env or $GIC/.bashrc (never printed).
Saves flat JPEGs in assets/characters/<piece>-classic-<slug>.jpg.
"""

import io
import os
import re
import sys
import time
from pathlib import Path

from dotenv import dotenv_values
from google import genai
from google.genai import types
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
CHARS_DIR = ROOT / "assets/characters"

PRIMARY_MODEL = os.environ.get("NB_MODEL", "gemini-nano-banana-2.1")
FALLBACK_MODELS = [
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image-preview",
]


def load_api_key() -> str:
    """Load GEMINI_API_KEY from environment or $GIC config files without printing it."""
    if key := os.environ.get("GEMINI_API_KEY"):
        return key
    gic_dir = Path(os.environ.get("GIC", Path.home() / "git/gic"))
    for candidate in (gic_dir / ".env", gic_dir / ".bashrc", Path.home() / ".env"):
        if candidate.is_file():
            vals = dotenv_values(candidate)
            if key := vals.get("GEMINI_API_KEY"):
                return key
            txt = candidate.read_text(errors="ignore")
            m = re.search(r'GEMINI_API_KEY=["\']?(AIza[0-9A-Za-z_-]+)["\']?', txt)
            if m:
                return m.group(1)
    raise RuntimeError("GEMINI_API_KEY not found in environment or ~/git/gic/")


COMMON_STYLE = (
    "Side-by-side character turnaround sheet showing two views of the EXACT SAME collectible 3D chess piece "
    "figurine: the FRONT VIEW on the left and the 3/4 ISOMETRIC VIEW on the right. "
    "Crafted in polished warm ivory marble (#f5f0e6) with gleaming brushed royal gold (#d4af37) collar rings "
    "and a round turned ivory-and-gold Staunton chess pedestal base (diameter 0.75x of square). "
    "High-end collectible designer vinyl/marble toy render aesthetic, soft three-point studio photography lighting, "
    "subtle subsurface scattering on marble, crisp specular highlights on gold and gems, clean neutral warm-grey "
    "seamless studio background, shallow depth of field, centered whole figurine from base bottom to finial top. "
    "Strictly NO text, NO labels, NO captions, NO watermarks."
)

CLASSIC_PIECES = {
    "king": {
        "slug": "king-classic-cesso",
        "prompt": (
            "A majestic Classic Staunton Chess KING piece (tallest piece, 1.80m scale) carved in polished warm "
            "ivory marble with royal gold pedestal and collar rings, storage of ancient runes carved around the base. "
            "At the very top of the scalloped royal gold King's crown, instead of a normal cross, sits an unmistakable, "
            "gleaming miniature GOLDEN ROYAL TOILET-THRONE FINIAL (ornate solid-gold royal toilet bowl with porcelain "
            "white inner rim, raised tank, royal crown-shaped flush handle, and tiny throne armrests — a humorous "
            "nod to 'Carlesso al Cesso!'). The silhouette is unmistakably a grand Staunton King chess piece topped "
            "with a glorious golden royal toilet-throne finial. " + COMMON_STYLE
        ),
    },
    "queen": {
        "slug": "queen-classic-ciocco",
        "prompt": (
            "An elegant Classic Staunton Chess QUEEN piece (1.65m scale) with a fluted ivory marble gown-like shaft "
            "and brushed gold collar rings. Perched cleanly on the front of the upper marble dome just below the "
            "coronet is a pair of sleek dark tortoise-shell and gold-rimmed eyeglasses. The Queen's multi-pointed "
            "coronet crown is sculpted from rich, glossy dark Swiss chocolate waves topped with shimmering golden "
            "chocolate-truffle pearls on each spike and a central gold-and-cocoa orb finial. Unmistakable Staunton "
            "Queen chess piece silhouette with stylish glasses and a chocolate-wave pearl coronet. " + COMMON_STYLE
        ),
    },
    "bishop": {
        "slug": "bishop-classic-drago",
        "prompt": (
            "A Classic Staunton Chess BISHOP piece (1.45m scale) carved in polished warm ivory marble with brushed "
            "royal gold pedestal and collar rings. The tall pointed ivory marble Bishop's mitre has a wide diagonal "
            "scroll slit, and poking boldly OUT of the mitre slit is a cute, vivid bright ruby-scarlet miniature "
            "dragon HEAD with expressive golden eyes, little golden horns, and one sculpted ruby-red dragon wing "
            "and coiled scaly tail resting on the mitre edge. At the top apex of the mitre sits a glowing faceted "
            "purple amethyst crystal finial orb set in gold. Unmistakable Staunton Bishop chess piece silhouette "
            "with a cute bright scarlet-red dragon head & wing peeking out of the mitre slit and a purple amethyst "
            "finial. Plain background at bottom edge with zero text, zero words, zero view titles. " + COMMON_STYLE
        ),
    },
    "knight": {
        "slug": "knight-classic-turbo",
        "prompt": (
            "A Classic Staunton Chess KNIGHT piece (1.35m scale): an expressive, nobly carved warm ivory marble "
            "horse head and arched sculpted mane mounted on a turned ivory-and-gold chess pedestal. The marble "
            "horse wears sleek vintage brass racing goggles with glowing cyan-blue lenses strapped over its forehead "
            "and eyes, twin polished gold-and-chrome turbo exhaust pipes jutting symmetrically from both sides of its "
            "neck, and a vibrant glossy hot-orange racing loop-track trim ring encircling the pedestal base. "
            "Unmistakable Staunton Knight horse chess piece with racing goggles, side turbo pipes, and orange track trim. "
            + COMMON_STYLE
        ),
    },
    "rook": {
        "slug": "rook-classic-puffo",
        "prompt": (
            "A Classic Staunton Chess ROOK castle turret piece (1.30m scale) carved in warm ivory marble and carved "
            "stone masonry blocks, inspired by Zurich's Grossmünster tower, with brushed gold base and collar trim rings. "
            "Peeking playfully right out of the top castle battlements between the stone merlons is a cute, fuzzy "
            "purple-blue monster head ('Puffo / Pupurabbu') with two big expressive sky-blue eyes, a cheerful toothy "
            "grin, and two little purple paws gripping the front stone crenelations. Unmistakable Staunton Rook castle "
            "tower silhouette with the cute purple monster peeking out of the top battlements. " + COMMON_STYLE
        ),
    },
    "pawn": {
        "slug": "pawn-classic-puffin",
        "prompt": (
            "A Classic Staunton Chess PAWN piece (shortest piece, 0.95m scale) with a turned warm ivory marble "
            "pedestal, tapered column shaft, and golden collar ring. The classic spherical Pawn top knob is sculpted "
            "as a cute round Puffin-Guard head with a bright orange-and-gold striped triangular puffin beak and glossy "
            "dark eyes, wearing a gleaming silver-and-gold Swiss Guard morion helmet with a curved brim, central crest, "
            "and a vibrant crimson-red feather plume on top. Unmistakable Staunton Pawn silhouette topped with the "
            "Swiss Guard morion helmet, red plume, and orange puffin beak. " + COMMON_STYLE
        ),
    },
}


def generate_piece_portrait(client: genai.Client, piece: str, meta: dict) -> tuple[str, Path]:
    """Generate and save a single piece portrait, trying primary then fallback models."""
    CHARS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = CHARS_DIR / f"{meta['slug']}.jpg"
    models_to_try = [PRIMARY_MODEL] + [m for m in FALLBACK_MODELS if m != PRIMARY_MODEL]

    last_err = None
    for model_name in models_to_try:
        for attempt in range(1, 3):
            try:
                print(f"🍌 [{piece}] Calling {model_name} (attempt {attempt})...", flush=True)
                resp = client.models.generate_content(
                    model=model_name,
                    contents=meta["prompt"],
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                        image_config=types.ImageConfig(aspect_ratio="16:9"),
                    ),
                )
                for candidate in resp.candidates or []:
                    if not candidate.content or not candidate.content.parts:
                        continue
                    for part in candidate.content.parts:
                        if part.inline_data and part.inline_data.data:
                            img = Image.open(io.BytesIO(part.inline_data.data)).convert("RGB")
                            tmp_path = out_path.with_suffix(".jpg.part")
                            img.save(tmp_path, format="JPEG", quality=92, optimize=True)
                            os.replace(tmp_path, out_path)
                            print(
                                f"✅ [{piece}] Saved {out_path.relative_to(ROOT)} "
                                f"({img.size[0]}x{img.size[1]}, model={model_name})",
                                flush=True,
                            )
                            return model_name, out_path
                last_err = RuntimeError(f"No inline image returned by {model_name}")
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                print(f"⚠️ [{piece}] {model_name} attempt {attempt} failed: {exc}", flush=True)
                time.sleep(2)
    raise RuntimeError(f"Failed to generate portrait for {piece}: {last_err}")


def main() -> None:
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(CLASSIC_PIECES.keys())
    api_key = load_api_key()
    client = genai.Client(api_key=api_key)

    for piece in targets:
        if piece not in CLASSIC_PIECES:
            raise SystemExit(f"Unknown piece '{piece}'. Choose from: {list(CLASSIC_PIECES)}")
        generate_piece_portrait(client, piece, CLASSIC_PIECES[piece])


if __name__ == "__main__":
    main()
