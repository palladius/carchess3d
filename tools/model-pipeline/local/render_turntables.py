import argparse
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from PIL import Image

argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1:]
else:
    argv = []

parser = argparse.ArgumentParser()
parser.add_argument("--glb", required=True)
parser.add_argument("--out", required=True)
parser.add_argument("--res", type=int, default=320)
parser.add_argument("--frames", type=int, default=24)
args = parser.parse_args(argv)

glb_path = Path(args.glb).resolve()
out_path = Path(args.out).resolve()
res = args.res
num_frames = args.frames

out_path.parent.mkdir(parents=True, exist_ok=True)
tmp_dir = out_path.parent / f"_tmp_turntable_{glb_path.stem}"
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
max_dim = max(dims)

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

frame_paths = []
step_deg = 360.0 / num_frames
for i in range(num_frames):
    deg = i * step_deg
    rad = math.radians(deg)
    cx = center[0] + dist * math.sin(rad)
    cy = center[1] - dist * math.cos(rad)
    cz = center[2] + max_dim * 0.12
    cam_obj.location = (cx, cy, cz)

    key_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(deg + 35))
    fill_obj.rotation_euler = (math.radians(35), math.radians(-30), math.radians(deg - 35))
    bpy.context.view_layer.update()

    fp = tmp_dir / f"frame_{i:03d}.png"
    scene.render.filepath = str(fp)
    bpy.ops.render.render(write_still=True)
    frame_paths.append(fp)

frames = [Image.open(p).convert("P", palette=Image.ADAPTIVE) for p in frame_paths]
frames[0].save(
    out_path,
    save_all=True,
    append_images=frames[1:],
    duration=80,
    loop=0,
    optimize=True
)
print(f"✅ Saved turntable GIF: {out_path} ({out_path.stat().st_size // 1024} KB)")

for p in frame_paths:
    p.unlink(missing_ok=True)
tmp_dir.rmdir()

