"""Image → white 3D mesh with Hunyuan3D-2 (shape only), locally on the GPU.

Usage (inside $LOCAL3D_ROOT/venv-hunyuan, caches exported by `just local3d-shape`):
    python hunyuan_shape.py <image> <label> [--steps 50] [--octree 384] [--seed 42] [--model tencent/Hunyuan3D-2]

Writes $LOCAL3D_ROOT/out/<label>.glb and prints time, peak VRAM and face count.
"""
import argparse
import os
import time
from pathlib import Path

import torch
from PIL import Image

from hy3dgen.rembg import BackgroundRemover
from hy3dgen.shapegen import FaceReducer, FloaterRemover, DegenerateFaceRemover, Hunyuan3DDiTFlowMatchingPipeline

ap = argparse.ArgumentParser()
ap.add_argument("image")
ap.add_argument("label")
ap.add_argument("--model", default="tencent/Hunyuan3D-2")
ap.add_argument("--steps", type=int, default=50)
ap.add_argument("--octree", type=int, default=384, help="octree resolution (256 fast, 384 good, 512 max)")
ap.add_argument("--guidance", type=float, default=5.0)
ap.add_argument("--seed", type=int, default=42)
ap.add_argument("--max-faces", type=int, default=0, help="0 = keep full resolution")
args = ap.parse_args()

out_dir = Path(os.environ["LOCAL3D_ROOT"]) / "out"
out_dir.mkdir(parents=True, exist_ok=True)

t0 = time.time()
image = Image.open(args.image).convert("RGBA")
if image.getextrema()[3][0] == 255:          # fully opaque → matte it ourselves (lesson from §5)
    image = BackgroundRemover()(image.convert("RGB"))
image.save(out_dir / f"{args.label}_input_rgba.png")

pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(args.model)
torch.cuda.reset_peak_memory_stats()
t1 = time.time()
mesh = pipe(
    image=image,
    num_inference_steps=args.steps,
    octree_resolution=args.octree,
    guidance_scale=args.guidance,
    generator=torch.manual_seed(args.seed),
)[0]
t2 = time.time()

mesh = FloaterRemover()(mesh)
mesh = DegenerateFaceRemover()(mesh)
if args.max_faces:
    mesh = FaceReducer()(mesh, max_facenum=args.max_faces)

glb = out_dir / f"{args.label}.glb"
mesh.export(glb)
print(
    f"✅ {glb.name}: {len(mesh.faces):,} faces · gen {t2 - t1:.0f}s (total {time.time() - t0:.0f}s) · "
    f"peak VRAM {torch.cuda.max_memory_allocated() / 2**30:.1f} GB · "
    f"steps {args.steps} octree {args.octree} seed {args.seed}"
)
