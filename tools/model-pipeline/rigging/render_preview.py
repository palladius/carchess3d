import bpy
import math
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT / "bishop-ale-rigged.glb"))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 480
scene.render.resolution_y = 480
scene.render.fps = 30
scene.frame_start = 0
scene.frame_end = 60

# Add Camera & Lights
cam_data = bpy.data.cameras.new(name="PreviewCam")
cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_obj.location = (0.55, -0.95, 0.25)
cam_obj.rotation_euler = (math.radians(78), 0, math.radians(30))

# Ambient and key lights
light_data = bpy.data.lights.new(name="KeyLight", type='SUN')
light_data.energy = 4.0
light_obj = bpy.data.objects.new("KeyLight", light_data)
bpy.context.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(45), math.radians(15), math.radians(35))

fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
fill_data.energy = 2.0
fill_obj = bpy.data.objects.new("FillLight", fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(-30), math.radians(-20), math.radians(140))

# Render frames as PNGs in temporary directory
frames_dir = OUT / "preview_frames"
frames_dir.mkdir(exist_ok=True)
scene.render.filepath = str(frames_dir / "frame_")
scene.render.image_settings.file_format = 'PNG'

print("Rendering animation frames...")
bpy.ops.render.render(animation=True)
print("Frames rendered.")
