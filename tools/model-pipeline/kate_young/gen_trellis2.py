"""Generate 3D model for young stylized Kate (4c) using microsoft/TRELLIS.2."""
import os
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client, handle_file

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

# Load token from .env
token = None
repo_root = HERE.parents[2]
env_file = repo_root / ".env"
if env_file.exists():
    with open(env_file) as f:
        lines = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
        tokens = {l.split("=", 1)[0]: l.split("=", 1)[1].strip("\"'") for l in lines if "=" in l}
        token = tokens.get("HF_RICC_PROVE3D_CARLESSO") or tokens.get("HF_TOKEN") or tokens.get("HUGGING_FACE_RO_TRELLIS")

if not token:
    token = os.environ.get("HF_TOKEN") or os.environ.get("HF_RICC_PROVE3D_CARLESSO")

print(f"Connecting to microsoft/TRELLIS.2 with token ({token[:6]}...)...", flush=True)
c = Client("microsoft/TRELLIS.2", token=token, verbose=False)
c.predict(api_name="/start_session")

front_img = HERE / "front.png"
print(f"Preprocessing {front_img.name}...", flush=True)
p_img = c.predict(input=handle_file(str(front_img)), api_name="/preprocess_image")
print(f"Preprocessed image: {p_img}", flush=True)
shutil.copy(p_img, OUT / "trellis2_preproc.png")

t0 = time.time()
print("Starting 3D reconstruction with TRELLIS.2 (resolution 1024)...", flush=True)
preview = c.predict(
    image=handle_file(p_img),
    seed=42,
    resolution="1024",
    ss_guidance_strength=7.5,
    ss_guidance_rescale=0.7,
    ss_sampling_steps=12,
    ss_rescale_t=5.0,
    shape_slat_guidance_strength=7.5,
    shape_slat_guidance_rescale=0.5,
    shape_slat_sampling_steps=12,
    shape_slat_rescale_t=3.0,
    tex_slat_guidance_strength=1.0,
    tex_slat_guidance_rescale=0.0,
    tex_slat_sampling_steps=12,
    tex_slat_rescale_t=3.0,
    api_name="/image_to_3d",
)
print(f"Reconstruction complete in {time.time() - t0:.1f}s", flush=True)

print("Extracting GLB mesh with texture...", flush=True)
t1 = time.time()
extracted_glb, download_glb = c.predict(
    decimation_target=100000,
    texture_size=1024,
    api_name="/extract_glb",
)
print(f"GLB extracted in {time.time() - t1:.1f}s", flush=True)

target_glb = download_glb or extracted_glb
if target_glb and Path(target_glb).exists():
    out_glb = OUT / "queen_kate_young.glb"
    shutil.copy(target_glb, out_glb)
    print(f"📦 Saved out/queen_kate_young.glb ({out_glb.stat().st_size // 1024} KB)", flush=True)

    assets_dest = repo_root / "assets/models/queen-kate-young.glb"
    shutil.copy(out_glb, assets_dest)
    print(f"🏰 Copied to {assets_dest} ({assets_dest.stat().st_size // 1024} KB)", flush=True)
else:
    print("❌ Error: GLB output not found", file=sys.stderr)
