# /// script
# requires-python = ">=3.10"
# dependencies = ["gradio_client"]
# ///
"""Generate textured 3D model for Rook Pupurabbu via TRELLIS multi-image."""
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


def save(label, p):
    p = as_path(p)
    if p and Path(p).exists():
        dst = OUT / f"{label}{Path(p).suffix}"
        shutil.copy(p, dst)
        print(f"📦 {label}: {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)


t0 = time.time()
token = os.environ.get("HF_TOKEN")
c = Client("trellis-community/TRELLIS", token=token, verbose=False)
c.predict(api_name="/start_session")

front_img = HERE / "front.png"
tq_img = HERE / "threequarter.png"
back_img = HERE / "back.png"

inputs = [{"image": handle_file(str(front_img)), "caption": None}]
if tq_img.exists():
    inputs.append({"image": handle_file(str(tq_img)), "caption": None})
if back_img.exists():
    inputs.append({"image": handle_file(str(back_img)), "caption": None})

# Switch to multiimage mode in TRELLIS Space
c.predict(api_name="/lambda_1")

# Preprocess images (bg removal)
print(f"Submitting {len(inputs)} views to TRELLIS (front, 3/4, back)...", flush=True)
pre = c.predict(
    images=inputs,
    api_name="/preprocess_images",
)
multi_p = [{"image": handle_file(as_path(m["image"])), "caption": None} for m in pre]
for i, m in enumerate(multi_p):
    shutil.copy(m["image"]["path"], OUT / f"trellis_preproc_{i}.png")
print("🧼 preprocessed (bg removed):", len(multi_p), "images", flush=True)

print("Starting 3D mesh + texture generation with TRELLIS...", flush=True)
res = c.predict(
    image=multi_p[0]["image"],
    multiimages=multi_p,
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
save("rook_pupurabbu_preview", video)
save("rook_pupurabbu", dl or glb)

# Copy final GLB to assets/models/rook-pupurabbu.glb
final_glb = OUT / "rook_pupurabbu.glb"
if final_glb.exists():
    assets_dest = Path(__file__).resolve().parent.parent.parent / "assets/models/rook-pupurabbu.glb"
    shutil.copy(final_glb, assets_dest)
    print(f"🏰 Copied to {assets_dest} ({assets_dest.stat().st_size // 1024} KB)")

print(f"⏱️ TRELLIS done in {time.time() - t0:.0f}s", flush=True)
