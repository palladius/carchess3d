"""Render preview snapshot of queen_kate.glb using Blender headless."""
import math
import os
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parent
GLB_PATH = HERE / "out/queen_kate.glb"
OUT_IMG = HERE / "out/queen_kate_3d_preview.png"

# Delete all default objects safely
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import GLB
bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))

# Find mesh bounding box to frame camera
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not objs:
    print("No mesh objects found!")
    exit(1)

# Frame camera
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.film_transparent = False

# World background
world = bpy.data.worlds.new("StudioWorld")
scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs[0].default_value = (0.15, 0.15, 0.18, 1.0) # sleek dark studio grey

# Camera
cam_data = bpy.data.cameras.new(name="RenderCam")
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

# Position camera for nice 3/4 view
cam_obj.location = (0.8, -1.2, 0.7)
cam_obj.rotation_euler = (math.radians(65), 0, math.radians(33))

# Key light
light_data = bpy.data.lights.new(name="KeyLight", type='SUN')
light_data.energy = 4.5
light_obj = bpy.data.objects.new("KeyLight", light_data)
scene.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(30))

# Fill light
fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
fill_data.energy = 2.5
fill_obj = bpy.data.objects.new("FillLight", fill_data)
scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(-30), math.radians(-15), math.radians(150))

scene.render.filepath = str(OUT_IMG)
scene.render.image_settings.file_format = 'PNG'

bpy.ops.render.render(write_still=True)
print(f"✅ Rendered 3D preview: {OUT_IMG}")
