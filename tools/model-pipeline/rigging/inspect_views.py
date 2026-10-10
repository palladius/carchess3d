import bpy
import math
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="assets/models/bishop-ale-2.glb")

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 512
scene.render.resolution_y = 512

cam_data = bpy.data.cameras.new("Cam")
cam_obj = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam_obj)
scene.camera = cam_obj

# Add Light
light_data = bpy.data.lights.new("Sun", type='SUN')
light_data.energy = 4.0
light_obj = bpy.data.objects.new("Sun", light_data)
bpy.context.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(45), math.radians(15), math.radians(35))

# Front view (looking along -Y in Blender coordinates or from -Y to +Y)
views = [
    ("front", (0, -1.8, 0), (math.radians(90), 0, 0)),
    ("back", (0, 1.8, 0), (math.radians(90), 0, math.radians(180))),
    ("left", (-1.8, 0, 0), (math.radians(90), 0, math.radians(-90))),
    ("right", (1.8, 0, 0), (math.radians(90), 0, math.radians(90))),
    ("bottom", (0, 0, -1.8), (0, 0, 0)),
    ("top", (0, 0, 1.8), (math.radians(180), 0, 0)),
]

for name, loc, rot in views:
    cam_obj.location = loc
    cam_obj.rotation_euler = rot
    scene.render.filepath = str(OUT / f"inspect_{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {name}")
