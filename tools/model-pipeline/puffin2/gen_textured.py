# /// script
# requires-python = ">=3.10"
# dependencies = ["gradio_client"]
# ///
"""Textured puffin via free HF Spaces: TRELLIS (multi-image) and Hunyuan3D-2.1.

Usage: uv run gen_textured.py trellis|hunyuan21
"""
import json
import os
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client, handle_file

HERE = Path(__file__).parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
which = sys.argv[1]


def as_path(p):
    if isinstance(p, dict):
        p = p.get("value") or p.get("path") or p.get("video")
        if isinstance(p, dict):
            p = p.get("path")
    return p


def save(label, p):
    p = as_path(p)
    if p and Path(p).exists():
        dst = OUT / f"{which}_{label}{Path(p).suffix}"
        shutil.copy(p, dst)
        print(f"📦 {label}: {dst.name} ({dst.stat().st_size // 1024} KB)", flush=True)


t0 = time.time()
if which == "trellis":
    c = Client("trellis-community/TRELLIS", token=os.environ.get("HF_TOKEN"))
    c.predict(api_name="/start_session")
    front = handle_file(str(HERE / "front.png"))
    tq = handle_file(str(HERE / "threequarter.png"))
    # The web UI runs background removal on upload; via API we must do it explicitly.
    front_p = as_path(c.predict(image=front, api_name="/preprocess_image"))
    multi_p = c.predict(
        images=[{"image": front, "caption": None}, {"image": tq, "caption": None}],
        api_name="/preprocess_images",
    )
    multi_p = [{"image": handle_file(as_path(m["image"])), "caption": None} for m in multi_p]
    for i, m in enumerate(multi_p):
        shutil.copy(m["image"]["path"], OUT / f"trellis_preproc_{i}.png")
    print("🧼 preprocessed (bg removed):", front_p, flush=True)
    front = handle_file(front_p)
    res = c.predict(
        image=front,
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
    print("🔎", repr(res)[:400], flush=True)
    video, glb, dl = res
    save("preview", video)
    save("textured", dl or glb)
elif which == "hunyuan21":
    c = Client("tencent/Hunyuan3D-2.1", token=os.environ.get("HF_TOKEN"))
    res = c.predict(
        image=handle_file(str(HERE / "front.png")),
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
        api_name="/generation_all",
    )
    print("🔎", repr(res)[:400], flush=True)
    shape, textured, _html, stats, _seed = res
    save("shape", shape)
    save("textured", textured)
    print("📊", json.dumps(stats)[:600])
print(f"⏱️ {which} done in {time.time() - t0:.0f}s")
