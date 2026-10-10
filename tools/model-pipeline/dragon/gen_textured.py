# /// script
# requires-python = ">=3.10"
# dependencies = ["gradio_client"]
# ///
"""Generate high-fidelity 3D model for the Red Baby Dragon via TRELLIS multi-image."""

import os
import shutil
import sys
import time
from pathlib import Path
from gradio_client import Client, handle_file

HERE = Path(__file__).parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

def as_path(p):
    if isinstance(p, dict):
        p = p.get("value") or p.get("path") or p.get("video")
        if isinstance(p, dict):
            p = p.get("path")
    return p

t0 = time.time()
token = os.environ.get("HF_TOKEN")
c = Client("trellis-community/TRELLIS", token=token, verbose=False)
c.predict(api_name="/start_session")
c.predict(api_name="/lambda_1")

img_paths = [HERE / "front.png", HERE / "side.png", HERE / "back.png"]
files = [handle_file(str(p.resolve())) for p in img_paths]

pre = c.predict(images=[{"image": f, "caption": None} for f in files], api_name="/preprocess_images")
multi = [{"image": handle_file(as_path(m["image"])), "caption": None} for m in pre]

for i, m in enumerate(multi):
    shutil.copy(m["image"]["path"], OUT / f"preproc_{i}.png")
print("🧼 Preprocessed (bg removed):", len(multi), "images", flush=True)

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
shutil.copy(as_path(video), OUT / "dragon_preview.mp4")
shutil.copy(as_path(dl) or as_path(glb), OUT / "dragon.glb")
print(f"✅ Dragon 3D generation complete in {time.time() - t0:.0f}s", flush=True)
