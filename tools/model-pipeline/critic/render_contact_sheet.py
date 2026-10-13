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

mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']

# Fix vertex color node layer name so Cycles renders vertex colors properly
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
scene.cycles.samples = 48
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

dist = max_dim * 2.35
cam_data = bpy.data.cameras.new("CriticCam")
cam_obj = bpy.data.objects.new("CriticCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_data.type = 'PERSP'
cam_data.lens = 50.0

tt = cam_obj.constraints.new(type='TRACK_TO')
tt.target = target
tt.track_axis = 'TRACK_NEGATIVE_Z'
tt.up_axis = 'UP_Y'

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs[0].default_value = (0.85, 0.85, 0.85, 1.0)
    bg_node.inputs[1].default_value = 1.3

key_sun = bpy.data.lights.new("KeySun", type='SUN')
key_sun.energy = 5.0
key_obj = bpy.data.objects.new("KeySun", key_sun)
bpy.context.collection.objects.link(key_obj)

fill_sun = bpy.data.lights.new("FillSun", type='SUN')
fill_sun.energy = 3.8
fill_obj = bpy.data.objects.new("FillSun", fill_sun)
bpy.context.collection.objects.link(fill_obj)

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
    cz = center[2] + max_dim * 0.08
    cam_obj.location = (cx, cy, cz)
    
    key_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(deg + 35))
    fill_obj.rotation_euler = (math.radians(40), math.radians(-20), math.radians(deg - 35))
    
    bpy.context.view_layer.update()
    
    frame_path = tmp_dir / f"{name}.png"
    scene.render.filepath = str(frame_path)
    bpy.ops.render.render(write_still=True)
    rendered_files.append(frame_path)

images = [Image.open(p) for p in rendered_files]
total_w = res * 4
sheet = Image.new("RGB", (total_w, res), (200, 200, 200))
for idx, im in enumerate(images):
    sheet.paste(im, (idx * res, 0))

sheet.save(out_path)
print(f"✅ Contact sheet saved: {out_path}")

for p in rendered_files:
    p.unlink(missing_ok=True)
tmp_dir.rmdir()
