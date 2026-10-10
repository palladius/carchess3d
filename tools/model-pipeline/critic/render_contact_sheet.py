import argparse
import math
import os
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
parser.add_argument("--res", type=int, default=384)
args = parser.parse_args(argv)

glb_path = Path(args.glb).resolve()
out_path = Path(args.out).resolve()
res = args.res

out_path.parent.mkdir(parents=True, exist_ok=True)
tmp_dir = out_path.parent / f"_tmp_render_{glb_path.stem}"
tmp_dir.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb_path))

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_denoising = False
scene.render.resolution_x = res
scene.render.resolution_y = res

mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
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

# Target empty at center
target = bpy.data.objects.new("Target", None)
bpy.context.collection.objects.link(target)
target.location = center

# Camera setup with Track To constraint
cam_data = bpy.data.cameras.new("CriticCam")
cam_obj = bpy.data.objects.new("CriticCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_data.type = 'PERSP'
cam_data.lens = 55.0

# Add Track To constraint
tt = cam_obj.constraints.new(type='TRACK_TO')
tt.target = target
tt.track_axis = 'TRACK_NEGATIVE_Z'
tt.up_axis = 'UP_Y'

# Background & Lighting
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs[0].default_value = (0.2, 0.2, 0.2, 1.0)  # neutral grey studio bg
    bg_node.inputs[1].default_value = 1.0

# Sunlight
sun_data = bpy.data.lights.new("Sun", type='SUN')
sun_data.energy = 4.0
sun_obj = bpy.data.objects.new("Sun", sun_data)
bpy.context.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(35))

# Orbit distance
dist = max_dim * 2.3

# 4 camera positions around the model
# 0: Front (-Y), 45: Three-quarter, 90: Profile, 180: Back (+Y)
angles = [
    ("front", 0),
    ("threequarter", 45),
    ("side", 90),
    ("back", 180),
]

rendered_files = []
for name, deg in angles:
    rad = math.radians(deg)
    cx = center[0] + dist * math.sin(rad)
    cy = center[1] - dist * math.cos(rad)
    cz = center[2] + max_dim * 0.20
    cam_obj.location = (cx, cy, cz)
    
    # Force scene update so constraint updates camera orientation
    bpy.context.view_layer.update()
    
    frame_path = tmp_dir / f"{name}.png"
    scene.render.filepath = str(frame_path)
    bpy.ops.render.render(write_still=True)
    rendered_files.append(frame_path)

# Glue 4 images into contact sheet
images = [Image.open(p) for p in rendered_files]
total_w = res * 4
sheet = Image.new("RGB", (total_w, res), (35, 35, 35))
for idx, im in enumerate(images):
    sheet.paste(im, (idx * res, 0))

sheet.save(out_path)
print(f"✅ Contact sheet saved: {out_path}")

for p in rendered_files:
    p.unlink(missing_ok=True)
tmp_dir.rmdir()
