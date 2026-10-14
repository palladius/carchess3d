"""Local texture/paint stage with Hunyuan3D-2 on GPU (RTX 5080).

Usage:
    python hunyuan_paint.py <mesh_glb> <image> <label> [--model tencent/Hunyuan3D-2] [--max-faces 60000]

Takes an input shape GLB and a reference character image, unwraps UVs, generates
multi-view diffusion projections, and bakes high-resolution PBR texture into
$LOCAL3D_ROOT/out/<label>_textured.glb.
"""
import argparse
import os
import time
from pathlib import Path

import torch
import trimesh
from PIL import Image

from hy3dgen.shapegen import FaceReducer
from hy3dgen.texgen import Hunyuan3DPaintPipeline

ap = argparse.ArgumentParser()
ap.add_argument("mesh", help="Path to input untextured GLB mesh")
ap.add_argument("image", help="Path to reference character portrait")
ap.add_argument("label", help="Output label")
ap.add_argument("--model", default="tencent/Hunyuan3D-2")
ap.add_argument("--subfolder", default="hunyuan3d-paint-v2-0-turbo")
ap.add_argument("--max-faces", type=int, default=60000, help="target face count before painting (default 60000, 0 = keep)")
args = ap.parse_args()

out_dir = Path(os.environ["LOCAL3D_ROOT"]) / "out"
out_dir.mkdir(parents=True, exist_ok=True)

t0 = time.time()
print(f"📦 Loading mesh {args.mesh}...")
scene_or_mesh = trimesh.load(args.mesh)
if isinstance(scene_or_mesh, trimesh.Scene):
    mesh = scene_or_mesh.dump()[0] if len(scene_or_mesh.dump()) == 1 else trimesh.util.concatenate(scene_or_mesh.dump())
else:
    mesh = scene_or_mesh

print(f"   Mesh has {len(mesh.faces):,} faces, {len(mesh.vertices):,} vertices")

if args.max_faces and len(mesh.faces) > args.max_faces:
    print(f"📉 Decimating mesh to {args.max_faces:,} faces for optimal game performance...")
    mesh = FaceReducer()(mesh, max_facenum=args.max_faces)
    print(f"   Decimated mesh has {len(mesh.faces):,} faces")

print(f"🖼️ Loading image {args.image}...")
image = Image.open(args.image)

print(f"🎨 Initializing Hunyuan3DPaintPipeline ({args.subfolder})...")
t1 = time.time()
pipe = Hunyuan3DPaintPipeline.from_pretrained(args.model, subfolder=args.subfolder)
print(f"   Model loaded in {time.time() - t1:.1f}s")

torch.cuda.reset_peak_memory_stats()
t2 = time.time()
print(f"🖌️ Painting mesh from multi-view projections...")
textured_mesh = pipe(mesh, image=image)
t3 = time.time()

out_glb = out_dir / f"{args.label}_textured.glb"
textured_mesh.export(out_glb)

print(
    f"✅ Saved textured model: {out_glb.name} ({out_glb.stat().st_size / (1024*1024):.1f} MB) · "
    f"faces: {len(textured_mesh.faces):,} · "
    f"paint time: {t3 - t2:.0f}s (total {time.time() - t0:.0f}s) · "
    f"peak VRAM: {torch.cuda.max_memory_allocated() / 2**30:.1f} GB"
)
