import math
from pathlib import Path
import bpy
import numpy as np

HERE = Path(__file__).parent.resolve()
ROOT = HERE.parent.parent.parent.resolve()
OUT_DIR = HERE / "out" / "clean_comparison"
OUT_DIR.mkdir(parents=True, exist_ok=True)

models = [
    ("orig_trellis_clean", HERE / "out" / "king_riccardo.glb"),
    ("remastered_current", ROOT / "assets/models/king-riccardo-remastered.glb"),
]

for name, glb_path in models:
    if not glb_path.exists():
        print(f"Skipping {name}: {glb_path} does not exist")
        continue

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768

    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.18, 0.20, 0.25, 1.0)
        bg.inputs[1].default_value = 1.0

    key = bpy.data.lights.new("Key", type='SUN')
    key.energy = 4.0
    key_obj = bpy.data.objects.new("Key", key)
    bpy.context.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("Fill", type='SUN')
    fill.energy = 2.5
    fill_obj = bpy.data.objects.new("Fill", fill)
    bpy.context.collection.objects.link(fill_obj)

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

    # Face target
    face_z = min_b[2] + dims[2] * 0.65
    face_center = (center[0], center[1], face_z)

    target = bpy.data.objects.new("Target", None)
    bpy.context.collection.objects.link(target)
    target.location = face_center

    cam_data = bpy.data.cameras.new("Cam")
    cam_obj = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    cam_data.type = 'PERSP'
    cam_data.lens = 85.0

    tt = cam_obj.constraints.new(type='TRACK_TO')
    tt.target = target
    tt.track_axis = 'TRACK_NEGATIVE_Z'
    tt.up_axis = 'UP_Y'

    face_dist = max_dim * 0.95

    # Front closeup
    cam_obj.location = (center[0], center[1] - face_dist, face_z)
    key_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(25))
    fill_obj.rotation_euler = (math.radians(35), math.radians(-25), math.radians(-35))
    bpy.context.view_layer.update()
    scene.render.filepath = str(OUT_DIR / f"{name}_face_front.png")
    bpy.ops.render.render(write_still=True)

    # 3/4 closeup (+30 deg)
    rad = math.radians(30)
    cam_obj.location = (center[0] + face_dist * math.sin(rad), center[1] - face_dist * math.cos(rad), face_z)
    key_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(55))
    fill_obj.rotation_euler = (math.radians(35), math.radians(-25), math.radians(-5))
    bpy.context.view_layer.update()
    scene.render.filepath = str(OUT_DIR / f"{name}_face_tq.png")
    bpy.ops.render.render(write_still=True)

    # Full body front
    full_dist = max_dim * 2.3
    target.location = center
    cam_obj.location = (center[0], center[1] - full_dist, center[2] + max_dim * 0.05)
    bpy.context.view_layer.update()
    scene.render.filepath = str(OUT_DIR / f"{name}_full_front.png")
    bpy.ops.render.render(write_still=True)

print("Render complete!")
