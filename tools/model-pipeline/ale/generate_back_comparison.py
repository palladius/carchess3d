import os
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from google import genai
from google.genai import types

HERE = Path(__file__).parent
FRONT = HERE / "front.png"
TQ = HERE / "threequarter.png"

key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not key:
    raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY must be set in the environment")

client = genai.Client(api_key=key)

refs = [Image.open(FRONT), Image.open(TQ)]

SUBJECT = (
    "Reference images: the SAME collectible chess bishop figurine of Alessandro (a cute, handsome, smiling boy with "
    "big green eyes and brown hair, wearing a tall dark-blue bishop's mitre hat with gold border trim and a central gold "
    "cross/diamond motif, dressed in an ornate dark-blue bishop robe and cape with gold border trim and a gold diamond chest brooch, "
    "holding a rustic wooden staff/crook with both hands, with a cute little friendly red winged dragon perched on his left "
    "arm/shoulder, standing on a round pedestal composed of a white marble disc atop a dark turned wooden base). "
)

STYLE = (
    " Keep identical proportions, cheerful friendly cartoon style, exact colors, fabrics, pedestal and lighting. "
    "Plain uniform mid-grey studio background, soft even light, whole figurine fully visible and centred, "
    "orthographic-looking product shot. No text, no labels, no captions, no extra objects."
)

BACK_PROMPT = (
    "Render this exact same figurine seen from DIRECTLY BEHIND (camera rotated 180 degrees around it, "
    "same height and distance as the front view). "
    "- Mitre Hat: show the back of the tall dark-blue bishop's mitre hat with gold trim, and the two traditional "
    "hanging ribbons (lappets / infulae) draping down from the back rim of the hat over the neck. "
    "- Hair: brown hair fringe visible at the back of the neck below the mitre. "
    "- Robe & Cape: show the back of the dark-blue bishop cape draping smoothly down towards the pedestal, with gold border trim. "
    "- Dragon: the cute little red dragon is perched on the boy's left shoulder/arm (which is on the right side from the front, "
    "so seen from behind it MUST appear on the LEFT side of the image!). Render the dragon's red scaly back, wings, and curled tail "
    "with full 3D volume, shape, and depth. "
    "- Staff: the boy holds the wooden staff in front of his chest, so from behind it is mostly hidden or peeks out slightly. "
    "- Pedestal: show the round dark turned wooden pedestal with the white marble upper disc from behind."
)

MODELS = [
    ("nb_2.1", "gemini-nano-banana-2.1", "Nano Banana 2.1 (NEWEST!)"),
    ("nb_pro", "gemini-3-pro-image-preview", "Nano Banana Pro"),
    ("nb_v2_flash", "gemini-3.1-flash-image", "Nano Banana 2 (Flash 3.1)"),
    ("nb_v1_flash", "gemini-2.5-flash-image", "Nano Banana 1 (Flash 2.5)"),
]

out_dir = HERE / "experiments_back"
out_dir.mkdir(exist_ok=True)

print(f"Starting comparison generation for Ale CON CAPPELLO across {len(MODELS)} models...")

generated = {}

for label, model_name, title in MODELS:
    print(f"--> Generating with {label} ({model_name})...", flush=True)
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=[*refs, SUBJECT + BACK_PROMPT + STYLE],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        saved = False
        for part in resp.candidates[0].content.parts:
            if part.inline_data:
                img_path = out_dir / f"back_{label}.png"
                img = Image.open(BytesIO(part.inline_data.data)).convert("RGB")
                img.save(img_path)
                generated[label] = (img, title)
                print(f"  ✅ Saved {img_path.name} ({img_path.stat().st_size // 1024} KB)", flush=True)
                saved = True
                break
        if not saved:
            print(f"  ❌ No image returned: {resp.candidates[0].finish_reason}", flush=True)
    except Exception as e:
        print(f"  ❌ Error with {model_name}: {e}", flush=True)

# Generate comparison grid
print("Building comparison grid...")
cell_size = 800
header_height = 40
cols = 3
rows = 2

grid_w = cols * cell_size
grid_h = rows * (cell_size + header_height)
grid = Image.new("RGB", (grid_w, grid_h), (20, 24, 33))
draw = ImageDraw.Draw(grid)

try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
except Exception:
    font = ImageFont.load_default()

cells = [
    (Image.open(FRONT), "1. Reference: Front View"),
    (Image.open(TQ), "2. Reference: 3/4 View"),
    (generated.get("nb_2.1", (None, "3. Nano Banana 2.1 (NEWEST!)"))[0], "3. Nano Banana 2.1 (NEWEST!)"),
    (generated.get("nb_pro", (None, "4. Nano Banana Pro"))[0], "4. Nano Banana Pro"),
    (generated.get("nb_v2_flash", (None, "5. Nano Banana 2 (Flash 3.1)"))[0], "5. Nano Banana 2 (Flash 3.1)"),
    (generated.get("nb_v1_flash", (None, "6. Nano Banana 1 (Flash 2.5)"))[0], "6. Nano Banana 1 (Flash 2.5)"),
]

for idx, (img, title) in enumerate(cells):
    c = idx % cols
    r = idx // cols
    x = c * cell_size
    y = r * (cell_size + header_height)

    # Draw header bar
    draw.rectangle([x, y, x + cell_size, y + header_height], fill=(26, 32, 44))
    draw.text((x + 20, y + 8), title, fill=(240, 240, 245), font=font)

    # Paste image
    if img:
        resized = img.resize((cell_size, cell_size), Image.Resampling.LANCZOS)
        grid.paste(resized, (x, y + header_height))

grid_path = out_dir / "ale_hat_back_comparison_grid.jpg"
grid.save(grid_path, quality=92)
print(f"🎉 Saved comparison grid to {grid_path} ({grid_path.stat().st_size // 1024} KB)")
