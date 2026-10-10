#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0.0", "pillow>=10.0.0", "python-dotenv>=1.0.0"]
# ///
"""Generate 2D cutie collectible chess portraits & turnarounds for the Swamp Parody Family.

Uses Nano Banana (gemini-nano-banana-2.1 / gemini-3-pro-image-preview / gemini-3.1-flash-image-preview)
and writes canonical 1:1 JPEG portraits to:
  assets/characters/<piece>-swamp-<slug>.jpg
plus reference views under:
  tools/model-pipeline/swamp/views/<piece>-swamp-<slug>/
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
import os
from pathlib import Path
import subprocess
import sys

from dotenv import dotenv_values
from google import genai
from google.genai import types
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
CHARS_DIR = ROOT / "assets/characters"
VIEWS_DIR = HERE / "views"

MODEL_CANDIDATES = [
    os.environ.get("NB_MODEL", "gemini-nano-banana-2.1"),
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image-preview",
    "gemini-2.5-flash-image",
]

SHARED_STUDIO_SUFFIX = (
    "Standing on a round mossy flagstone pedestal with a thin gold rim, dark slate studio "
    "backdrop, soft three-point lighting, no text. Masterpiece 3D collectible chibi vinyl-toy "
    "chess figurine, subtle subsurface scattering, shallow depth of field, whole figurine and "
    "round chess pedestal 100% visible from base to tip, no watermark, no labels, no extra props."
)

SWAMP_PIECES = {
    "king-swamp-orco": {
        "piece": "king",
        "name_it": "Orco Brontolo",
        "name_en": "Grumpy Swamp Ogre King",
        "prompt": (
            "A collectible chibi chess KING figurine of 'Orco Brontolo', an original barrel-chested, "
            "lovable grumpy olive-green swamp ogre king with a broad friendly face, thick eyebrows, "
            "small lower tusks, and two broad round droopy boar-like ears (not tubular or pointed). "
            "On his head sits a tall, unmistakable royal CHESS KING CROWN carved from twisted ancient "
            "swamp-oak roots studded with glowing amber resin gems and a wooden cross finial at the "
            "apex. He wears a regal plum-purple and mossy-green quilted velvet royal doublet with "
            "carved tree-bark shoulder pauldrons, a wide ornate gold sash belt, and a mossy forest-green "
            "royal cloak. In his left hand he holds upright a gleaming golden sprouted-onion royal "
            "sceptre. Unmistakable tall King chess piece silhouette."
        ),
    },
    "queen-swamp-orchessa": {
        "piece": "queen",
        "name_it": "Principessa Orchessa",
        "name_en": "Warrior Ogress Queen",
        "prompt": (
            "A collectible chibi chess QUEEN figurine of 'Principessa Orchessa', an original fierce "
            "yet warm-hearted olive-green swamp ogress queen with two small round ears, rosy cheeks, "
            "confident amber eyes, and copper-ginger hair styled in a regal high top-knot bun with "
            "short wavy side locks secured by golden hair rings (no long braid). On her head sits a "
            "tall, unmistakable multi-peaked golden CHESS QUEEN CORONET TIARA set with ruby and amber "
            "cabochons. She wears a regal burgundy-crimson and warm mustard-gold brocade Renaissance "
            "gown with puffed sleeves, poised in a dynamic, balanced martial-arts Kung-Fu open-palm "
            "high-guard stance. Unmistakable Queen chess piece silhouette."
        ),
    },
    "bishop-swamp-focaccina": {
        "piece": "bishop",
        "name_it": "Mago Focaccina",
        "name_en": "Ligurian Focaccia Bread Bishop Mage",
        "prompt": (
            "A collectible chibi chess BISHOP figurine of 'Mago Focaccina', an original whimsical "
            "golden-baked Italian Ligurian focaccia-bread wizard with a plump, dimpled golden-brown "
            "artisan bread-crust body, rosy flour-dusted cheeks, a cheerful piped white-cream smile, "
            "and three glossy black Taggiasca olive buttons down his chest surrounded by green rosemary "
            "needles (strictly artisanal Italian herb focaccia aesthetic, zero candy gumdrops). "
            "On his head he wears a tall, classic pointed split-peak CHESS BISHOP MITRE HAT crafted "
            "from toasted golden crust with sparkling coarse sea-salt crystals and a sprig of fresh "
            "green rosemary. In his right hand he holds a tall twisted golden sesame grissino "
            "breadstick Bishop crosier staff with a thick curled spiral top. Unmistakable Bishop silhouette."
        ),
    },
    "knight-swamp-asinello": {
        "piece": "knight",
        "name_it": "Asinello Chiacchierone",
        "name_en": "Chatty Pack-Burro Knight",
        "prompt": (
            "A collectible chibi chess KNIGHT figurine of 'Asinello Chiacchierone', an original "
            "cheerful warm chestnut-brown and cream-dappled Mediterranean miniature pack-burro "
            "standing proud with the classic arched neck silhouette of a CHESS KNIGHT steed. He has "
            "rich chestnut-brown fur with cream dapples, a tan muzzle with a clever, smug closed-mouth "
            "smirk (mouth closed, no teeth showing), big expressive amber eyes, a dark-brown mane, "
            "and two thick upright furry brown burro ears. He wears medieval tournament knight barding: "
            "a carved oak and polished brass saddle, a crimson-and-gold caparison cloth, a small wooden "
            "buckler shield with a golden onion emblem on his shoulder, and a tall red-and-gold "
            "heraldic knight plume crest between his ears. Unmistakable Knight chess piece silhouette."
        ),
    },
    "rook-swamp-draghessa": {
        "piece": "rook",
        "name_it": "Draghessa della Palude",
        "name_en": "Swamp Dragon & Mossy Watchtower Rook",
        "prompt": (
            "A collectible chibi chess ROOK figurine of 'Draghessa della Palude': a sturdy, classic "
            "crenellated medieval grey-stone CHESS ROOK WATCHTOWER with six distinct squared stone "
            "battlement merlons at the crown, arched gothic arrow-slit windows, and lush green swamp "
            "moss vines. Coiled affectionately around the stone Rook tower is an original cute, "
            "friendly ruby-crimson and emerald-bellied swamp dragon with golden dorsal ridges, two "
            "unfurled leathery bat-wings, warm amber eyes with a gentle reptilian smile (natural "
            "reptile snout, zero cosmetics), and a long tail curling around the base of the tower "
            "ending in a heart-shaped spade tip. Unmistakable crenellated Rook tower silhouette."
        ),
    },
    "pawn-swamp-tappo": {
        "piece": "pawn",
        "name_it": "Guardia Re Tappo",
        "name_en": "Pompous Scroll-Stack Guard Pawn",
        "prompt": (
            "A collectible chibi chess PAWN vinyl toy figurine of 'Guardia Re Tappo', an original "
            "comically short, pompous adult Renaissance palace herald-guard with plump rosy cheeks "
            "(smooth round chin, no cleft chin), arched eyebrows, and bouncy golden-blond curls, "
            "standing proudly on top of a neat stack of three thick leather-bound royal decree "
            "law-books and parchment scrolls placed on the mossy stone chess pedestal so he can look "
            "taller. He wears royal sapphire-blue and silver-gold brocade doublet livery, a short "
            "white silk cape, and a tall domed sapphire-blue velvet Renaissance capotain hat topped "
            "with a prominent round golden brass sphere finial knob — forming the classic rounded "
            "top-knob silhouette of a CHESS PAWN. In his hand he holds a rolled parchment royal "
            "decree scroll with a red wax seal. Unmistakable compact Pawn chess silhouette."
        ),
    },
}


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


def generate_piece_assets(client: genai.Client, slug: str, extra_views: bool = False) -> dict:
    meta = SWAMP_PIECES[slug]
    full_prompt = f"{meta['prompt']} {SHARED_STUDIO_SUFFIX}"
    img, used_model = generate_one_image(client, full_prompt)

    CHARS_DIR.mkdir(parents=True, exist_ok=True)
    piece_view_dir = VIEWS_DIR / slug
    piece_view_dir.mkdir(parents=True, exist_ok=True)

    jpg_path = CHARS_DIR / f"{slug}.jpg"
    tmp_path = CHARS_DIR / f".{slug}.jpg.part"
    img.save(tmp_path, format="JPEG", quality=93, optimize=True)
    os.replace(tmp_path, jpg_path)

    front_png = piece_view_dir / "front.png"
    img.save(front_png, format="PNG")

    if extra_views:
        turnaround_prompt = (
            f"Reference character: {meta['prompt']} "
            "Render a 4-view character turnaround sheet (front view, 3/4 view, side profile view, "
            "and back view) of this exact same collectible chibi chess figurine on its mossy stone "
            "pedestal with identical colors, props, and proportions on a dark slate studio background."
        )
        try:
            sheet_img, _ = generate_one_image(client, turnaround_prompt)
            sheet_img.save(piece_view_dir / "turnaround.png", format="PNG")
        except Exception as exc:
            print(f"⚠️ Optional turnaround for {slug} skipped: {exc}", flush=True)

    print(f"🍌 {slug}.jpg saved ({img.size[0]}x{img.size[1]}) via {used_model}", flush=True)
    return {"slug": slug, "model": used_model, "size": img.size, "path": str(jpg_path.relative_to(ROOT))}


def main():
    parser = argparse.ArgumentParser(description="Generate Swamp Family Nano Banana 2D portraits")
    parser.add_argument("slugs", nargs="*", help="Specific piece slugs to generate (default: all 6)")
    parser.add_argument("--extra-views", action="store_true", help="Also generate turnaround sheet per piece")
    parser.add_argument("--workers", type=int, default=2, help="Parallel generation workers")
    args = parser.parse_args()

    target_slugs = args.slugs or list(SWAMP_PIECES.keys())
    api_key = load_api_key()
    client = genai.Client(api_key=api_key)

    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {
            pool.submit(generate_piece_assets, client, slug, args.extra_views): slug
            for slug in target_slugs
        }
        for fut in as_completed(futs):
            slug = futs[fut]
            try:
                res = fut.result()
                results.append(res)
            except Exception as exc:
                print(f"❌ Failed {slug}: {exc}", file=sys.stderr, flush=True)
                sys.exit(1)

    print(f"✅ Generated {len(results)}/{len(target_slugs)} Swamp Parody character portraits.")


if __name__ == "__main__":
    main()
