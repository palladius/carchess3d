"""Render 360-degree turntable frames and GIF for Knight Sebastian 3D model."""
import math
import os
import shutil
import subprocess
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
GLB_PATH = PROJECT_ROOT / "assets/models/knight-seby.glb"
FRAMES_DIR = PROJECT_ROOT / "article/sources/screenshots/seby_frames"
GIF_PATH = PROJECT_ROOT / "article/assets/turntables/seby_cavaliere_turntable.gif"

if FRAMES_DIR.exists():
    shutil.rmtree(FRAMES_DIR)
FRAMES_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 400
scene.render.resolution_y = 400
scene.render.film_transparent = False

# World background (studio slate grey)
world = bpy.data.worlds.new("StudioWorld")
scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs[0].default_value = (0.16, 0.16, 0.19, 1.0)

# Lights
key_data = bpy.data.lights.new(name="KeyLight", type='SUN')
key_data.energy = 4.5
key_obj = bpy.data.objects.new("KeyLight", key_data)
scene.collection.objects.link(key_obj)
key_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(30))

fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
fill_data.energy = 2.5
fill_obj = bpy.data.objects.new("FillLight", fill_data)
scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(-30), math.radians(-15), math.radians(150))

# Mesh hierarchy
objs = [o for o in scene.objects if o.type == 'MESH']
root = bpy.data.objects.new("TurntableRoot", None)
scene.collection.objects.link(root)
for o in objs:
    o.parent = root

# Compute bounding box
min_z = min([o.matrix_world.translation.z for o in objs] or [0])
max_z = max([o.matrix_world.translation.z + o.dimensions.z for o in objs] or [1.35])
center_z = (min_z + max_z) / 2.0

# Camera
cam_data = bpy.data.cameras.new(name="TurnCam")
cam_obj = bpy.data.objects.new("TurnCam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

cam_dist = 2.4
cam_height = center_z + 0.35
cam_obj.location = (0, -cam_dist, cam_height)
cam_obj.rotation_euler = (math.radians(78), 0, 0)

num_frames = 24
for i in range(num_frames):
    angle = (2.0 * math.pi * i) / num_frames
    root.rotation_euler = (0, 0, angle)
    scene.render.filepath = str(FRAMES_DIR / f"frame_{i:03d}.png")
    bpy.ops.render.render(write_still=True)

# Generate GIF via ffmpeg
cmd = [
    "ffmpeg", "-y",
    "-framerate", "12",
    "-i", str(FRAMES_DIR / "frame_%03d.png"),
    "-vf", "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
    str(GIF_PATH)
]
subprocess.run(cmd, check=True)
print(f"Generated {GIF_PATH} successfully!")
