# /// script
# requires-python = ">=3.10"
# dependencies = ["gradio_client"]
# ///
"""Send the puffin front view to the Hunyuan3D-2 HF Space (shape + texture)."""
import json
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client, handle_file

HERE = Path(__file__).parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
ENDPOINT = sys.argv[1] if len(sys.argv) > 1 else "/generation_all"

t0 = time.time()
client = Client("tencent/Hunyuan3D-2")
print(f"🦖 connected, submitting job to {ENDPOINT}…", flush=True)
result = client.predict(
    caption=None,
    image=handle_file(str(HERE / "puffin_front.png")),
    mv_image_front=None,
    mv_image_back=None,
    mv_image_left=None,
    mv_image_right=None,
    steps=30,
    guidance_scale=5.0,
    seed=1234,
    octree_resolution=256,
    check_box_rembg=True,
    num_chunks=8000,
    randomize_seed=False,
    api_name=ENDPOINT,
)
print(f"⏱️ done in {time.time() - t0:.0f}s", flush=True)

if ENDPOINT == "/generation_all":
    shape_path, textured_path, _html, stats, seed = result
else:
    shape_path, _html, stats, seed = result
    textured_path = None
def as_path(p):
    """Gradio may return a plain path or an update dict like {'value': path}."""
    if isinstance(p, dict):
        p = p.get("value") or p.get("path")
        if isinstance(p, dict):
            p = p.get("path")
    return p


print("🔎 raw result:", repr(result)[:600], flush=True)
for label, p in (("shape", as_path(shape_path)), ("textured", as_path(textured_path))):
    if p:
        dst = OUT / f"puffin_{label}{Path(p).suffix}"
        shutil.copy(p, dst)
        print(f"📦 {label}: {dst} ({dst.stat().st_size // 1024} KB)")
print("📊 stats:", json.dumps(stats, indent=2))
print("🌱 seed:", seed)
