#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0.0", "pillow>=10.0.0", "python-dotenv>=1.0.0"]
# ///
"""Generate the 6 Nano Banana 2.1 2D portraits for the Vanilla Classic Chess Family (`classic`).

Pure, authentic classic Staunton / medieval chess pieces with ZERO Carlesso family references:
- King (`king-classic-re`): Regal Staunton King with 8-point crown and classic golden Cross Pattee finial
- Queen (`queen-classic-regina`): Elegant fluted Staunton Queen with 8-point royal coronet and pearls
- Bishop (`bishop-classic-vescovo`): Typical medieval churchman / ecclesiastical Bishop in clerical robes, golden stole, episcopal mitre with Latin cross, holding a golden pastoral crosier
- Knight (`knight-classic-cavallo`): Noble sculpted Staunton Warhorse head & arched mane with golden bridle
- Rook (`rook-classic-torre`): Pure medieval stone/marble crenellated castle fortress tower with battlements
- Pawn (`pawn-classic-pedone`): Pure classic turned Staunton Pawn with baluster shaft, gold collar, and polished sphere top

Usage:
    UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy \
        uv run tools/model-pipeline/classic/gen_classic_portraits.py [piece ...]
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
    "Side-by-side turnaround sheet showing two views of the EXACT SAME classic luxury 3D chess piece "
    "figurine: the FRONT VIEW on the left and the 3/4 ISOMETRIC VIEW on the right. "
    "Crafted in polished warm ivory marble (#f5f0e6) with gleaming brushed royal gold (#d4af37) accents "
    "and a round turned ivory-and-gold Staunton chess pedestal base (diameter 0.75x of square). "
    "High-end museum-grade luxury chess set render aesthetic, soft three-point studio photography lighting, "
    "subtle subsurface scattering on marble, crisp specular highlights on gold, clean neutral warm-grey "
    "seamless studio background, centered whole piece from base bottom to finial top. "
    "Strictly NO animals, NO monsters, NO dragons, NO birds, NO modern gadgets, NO text, NO labels, NO watermarks."
)

CLASSIC_PIECES = {
    "king": {
        "slug": "king-classic-re",
        "prompt": (
            "A majestic, traditional Vanilla Staunton Chess KING piece (tallest piece, 1.80m scale) carved in "
            "polished warm ivory marble with brushed royal gold pedestal and triple collar rings. "
            "Features a stately fluted marble column, an ornate 8-point scalloped royal gold King's crown wrapping "
            "a crimson-and-ivory royal cushion dome, and topped at the apex with a classic, noble, gleaming solid-gold "
            "CROSS PATTEE FINIAL (traditional royal Christian cross of a classic Staunton chess King). "
            "100% pure, timeless, regal vanilla chess King silhouette. " + COMMON_STYLE
        ),
    },
    "queen": {
        "slug": "queen-classic-regina",
        "prompt": (
            "An elegant, traditional Vanilla Staunton Chess QUEEN piece (1.65m scale) carved in polished warm "
            "ivory marble with brushed royal gold pedestal and triple collar rings. "
            "Features a gracefully fluted ivory marble column shaft, a smooth spherical marble dome, and a classic "
            "multi-pointed royal gold Queen's coronet crown with 8 sharp diadem peaks, each tipped with a gleaming "
            "ivory pearl, and a polished golden orb finial at the center apex. "
            "100% pure, timeless, regal vanilla chess Queen silhouette with zero glasses or modern props. " + COMMON_STYLE
        ),
    },
    "bishop": {
        "slug": "bishop-classic-vescovo",
        "prompt": (
            "A classic luxury Chess BISHOP piece inspired by the iconic Neapolitan Baroque reliquary bust of "
            "SAN GENNARO ('Busto di San Gennaro', 1.45m scale), mounted on a turned warm ivory marble and royal "
            "gold Staunton chess pedestal. He is sculpted as a noble, serene patron saint bishop bust in warm "
            "ivory marble and gilded gold, wearing an ornate crimson-and-gold brocade liturgical cope ('piviale') "
            "clasped at the center of his chest with the famous glowing ruby-red GLASS AMPOULE RELIQUARY OF SAN GENNARO'S "
            "BLOOD ('Ampolla del Sangue di San Gennaro' set in an ornate golden reliquary medallion). On his head sits "
            "a magnificent tall Baroque EPISCOPAL MITRE encrusted with gold filigree, red rubies, green emeralds, "
            "ivory pearls, and a golden Latin cross. Beside his right shoulder rises a gleaming golden PASTORAL CROSIER "
            "staff with a baroque spiral crook. 100% noble San Gennaro Bishop chess piece — NO dragon, NO monsters. "
            + COMMON_STYLE
        ),
    },
    "knight": {
        "slug": "knight-classic-cavallo",
        "prompt": (
            "A noble, traditional Vanilla Staunton Chess KNIGHT piece (1.35m scale): a masterfully carved warm "
            "ivory marble warhorse head, arched muscular neck, and flowing scalloped marble mane mounted on a turned "
            "ivory-and-gold Staunton chess pedestal. The warhorse features alert pointed ears, expressive carved eyes, "
            "flared nostrils, a defined jawline, and a classic medieval brushed-gold bridle and reins strap with golden "
            "rosette bosses. 100% pure, timeless Staunton warhorse Knight with zero goggles and zero pipes. "
            + COMMON_STYLE
        ),
    },
    "rook": {
        "slug": "rook-classic-torre",
        "prompt": (
            "A stately Italian Renaissance Chess ROOK castle tower piece inspired by the historic TORRE MATILDEA / "
            "ROCCA ESTENSE of Ferrara and the Lidi Ferraresi (1.30m scale), mounted on a turned warm ivory marble and "
            "brushed royal gold Staunton chess pedestal. The tower is crafted in warm ivory marble and subtle warm "
            "terracotta-rose Renaissance ashlar stone courses, featuring arched Italian Renaissance embrasure windows, "
            "a bold overhanging corbelled machicolation gallery ('beccatelli e caditoie estensi') trimmed in gold, "
            "classic notched Italian Ghibelline swallowtail battlements ('merli ghibellini a coda di rondine'), and a "
            "stepped octagonal Ferrarese Renaissance roof turret lantern at the top. 100% pure Italian architectural "
            "fortress tower chess Rook — NO monsters, NO creatures. " + COMMON_STYLE
        ),
    },
    "pawn": {
        "slug": "pawn-classic-pedone",
        "prompt": (
            "A pure, iconic Vanilla Staunton Chess PAWN piece (shortest piece, 0.95m scale) crafted in polished "
            "warm ivory marble with brushed royal gold trim rings. Features a turned stepped circular marble-and-gold "
            "pedestal base, a smooth concave-tapered baluster column shaft, a crisp double golden collar ring at the "
            "neck, and a perfectly smooth, unadorned spherical ivory marble ball head topped with a tiny golden finial "
            "bead. 100% pure, timeless, classic Staunton chess Pawn — NO face, NO beak, NO helmet, NO bird. "
            + COMMON_STYLE
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
