# /// script
# requires-python = ">=3.10"
# dependencies = ["gradio_client"]
# ///
"""TRELLIS multi-view experiment: same seed, different view sets.

Usage: HF_TOKEN=... uv run gen_mv.py <label> <img1> [img2 ...]
The first image is the "main" one; all images go into multiimages.
Background removal is done via the Space's own /preprocess_images endpoint.
"""
import os
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client, handle_file

HERE = Path(__file__).parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
label, imgs = sys.argv[1], sys.argv[2:]


def as_path(p):
    if isinstance(p, dict):
        p = p.get("value") or p.get("path") or p.get("video")
        if isinstance(p, dict):
            p = p.get("path")
    return p


t0 = time.time()
c = Client("trellis-community/TRELLIS", token=os.environ.get("HF_TOKEN"), verbose=False)
c.predict(api_name="/start_session")
if len(imgs) > 1:
    # is_multiimage is a hidden gr.State(False), flipped only by the
    # "Multiple Images" tab-select handler (= /lambda_1). Without this call the
    # Space silently runs single-image mode and ignores multiimages!
    c.predict(api_name="/lambda_1")
files = [handle_file(str(Path(i).resolve())) for i in imgs]
pre = c.predict(images=[{"image": f, "caption": None} for f in files], api_name="/preprocess_images")
multi = [{"image": handle_file(as_path(m["image"])), "caption": None} for m in pre]
res = c.predict(
    image=multi[0]["image"],
    multiimages=multi,
    seed=42,
    ss_guidance_strength=7.5,
    ss_sampling_steps=12,
    slat_guidance_strength=3.0,
    slat_sampling_steps=12,
    multiimage_algo="stochastic",
    mesh_simplify=0.95,
    texture_size=1024,
    api_name="/generate_and_extract_glb",
)
video, glb, dl = res
shutil.copy(as_path(video), OUT / f"{label}.mp4")
shutil.copy(as_path(dl) or as_path(glb), OUT / f"{label}.glb")
print(f"✅ {label}: {len(imgs)} views, {time.time() - t0:.0f}s", flush=True)
