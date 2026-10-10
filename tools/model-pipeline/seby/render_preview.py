"""Render preview snapshot of knight_seby.glb using Blender headless."""
import math
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parent
GLB_PATH = HERE / "out/knight_seby.glb"
OUT_IMG = HERE / "out/knight_seby_3d_preview.png"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.film_transparent = False

world = bpy.data.worlds.new("StudioWorld")
scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs[0].default_value = (0.15, 0.15, 0.18, 1.0)

cam_data = bpy.data.cameras.new(name="RenderCam")
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

cam_obj.location = (0.8, -1.2, 0.7)
cam_obj.rotation_euler = (math.radians(65), 0, math.radians(33))

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

scene.render.filepath = str(OUT_IMG)
scene.render.image_settings.file_format = 'PNG'

bpy.ops.render.render(write_still=True)
print(f"✅ Rendered 3D preview: {OUT_IMG}")
