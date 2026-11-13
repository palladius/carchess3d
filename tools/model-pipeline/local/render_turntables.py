#!/usr/bin/env python3
"""Render a 360-degree turntable GIF of a .glb model using headless Blender Cycles + outer PIL."""

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

BLENDER_TURNTABLE_FRAMES_PY = r"""
import bpy
import math
import sys
import numpy as np
from pathlib import Path

argv = sys.argv[sys.argv.index("--") + 1:]
glb_path = Path(argv[0])
tmp_dir = Path(argv[1])
res = int(argv[2])
num_frames = int(argv[3])

tmp_dir.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb_path))

mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
for mat in bpy.data.materials:
    if mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type == 'VERTEX_COLOR' and not n.layer_name:
                for obj in mesh_objs:
                    if mat.name in [m.name for m in obj.data.materials if m]:
                        if obj.data.color_attributes:
                            n.layer_name = obj.data.color_attributes[0].name

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = res
scene.render.resolution_y = res

coords = []
for obj in mesh_objs:
    mat = obj.matrix_world
    for v in obj.data.vertices:
        coords.append(mat @ v.co)
coords = np.array(coords)

min_b = coords.min(axis=0)
max_b = coords.max(axis=0)
center = (min_b + max_b) / 2.0
dims = max_b - min_b
max_dim = float(max(dims))

target = bpy.data.objects.new("Target", None)
bpy.context.collection.objects.link(target)
target.location = center

dist = max_dim * 2.3
cam_data = bpy.data.cameras.new("Cam")
cam_obj = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_data.type = 'PERSP'
cam_data.lens = 55.0

tt = cam_obj.constraints.new(type='TRACK_TO')
tt.target = target
tt.track_axis = 'TRACK_NEGATIVE_Z'
tt.up_axis = 'UP_Y'

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.15, 0.17, 0.22, 1.0)
    bg.inputs[1].default_value = 1.0

key = bpy.data.lights.new("Key", type='SUN')
key.energy = 4.5
key_obj = bpy.data.objects.new("Key", key)
bpy.context.collection.objects.link(key_obj)

fill = bpy.data.lights.new("Fill", type='SUN')
fill.energy = 2.5
fill_obj = bpy.data.objects.new("Fill", fill)
bpy.context.collection.objects.link(fill_obj)

step_deg = 360.0 / num_frames
for i in range(num_frames):
    deg = i * step_deg
    rad = math.radians(deg)
    cx = float(center[0]) + dist * math.sin(rad)
    cy = float(center[1]) - dist * math.cos(rad)
    cz = float(center[2]) + max_dim * 0.12
    cam_obj.location = (cx, cy, cz)

    key_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(deg + 35))
    fill_obj.rotation_euler = (math.radians(35), math.radians(-30), math.radians(deg - 35))
    bpy.context.view_layer.update()

    fp = tmp_dir / f"frame_{i:03d}.png"
    scene.render.filepath = str(fp)
    bpy.ops.render.render(write_still=True)
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--glb", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--res", type=int, default=320)
    parser.add_argument("--frames", type=int, default=20)
    args = parser.parse_args()

    glb_path = args.glb.resolve()
    out_path = args.out.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_dir = Path(tempfile.mkdtemp(prefix=f"turntable_{glb_path.stem}_"))

    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as tf:
        tf.write(BLENDER_TURNTABLE_FRAMES_PY)
        script_path = Path(tf.name)

    try:
        subprocess.run(
            [
                "blender",
                "-b",
                "--python",
                str(script_path),
                "--",
                str(glb_path),
                str(tmp_dir),
                str(args.res),
                str(args.frames),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        frame_paths = sorted(tmp_dir.glob("frame_*.png"))
        frames = [Image.open(p).convert("P", palette=Image.ADAPTIVE) for p in frame_paths]
        frames[0].save(
            out_path,
            save_all=True,
            append_images=frames[1:],
            duration=80,
            loop=0,
            optimize=True,
        )
        print(f"✅ Saved turntable GIF: {out_path} ({out_path.stat().st_size // 1024} KB)")
    finally:
        script_path.unlink(missing_ok=True)
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
