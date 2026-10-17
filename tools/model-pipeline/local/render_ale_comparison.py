import math
import os
import sys
from pathlib import Path
import bpy
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent.resolve()
ROOT = HERE.parent.parent.parent.resolve()

GLB_OLD = ROOT / "assets/models/bishop-ale-1.glb"
GLB_NEW_TEX = Path("/media/riccardo/TurboSebux/carchess3d/out/ale1_hy2_textured.glb")
GLB_SHAPE_700K = Path("/media/riccardo/TurboSebux/carchess3d/out/ale1_hy2_shape.glb")
GLB_SHAPE_60K = Path("/media/riccardo/TurboSebux/carchess3d/out/ale1_hy2_shape_60k.glb")
IMG_REF = ROOT / "tools/model-pipeline/ale/front.png"

OUT_DIR = HERE / "out"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR = OUT_DIR / "_tmp_comp"
TMP_DIR.mkdir(parents=True, exist_ok=True)

def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False
    
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.12, 0.14, 0.18, 1.0)
        bg.inputs[1].default_value = 1.0

    key = bpy.data.lights.new("Key", type='SUN')
    key.energy = 4.5
    key_obj = bpy.data.objects.new("Key", key)
    bpy.context.collection.objects.link(key_obj)
    key_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(35))

    fill = bpy.data.lights.new("Fill", type='SUN')
    fill.energy = 2.5
    fill_obj = bpy.data.objects.new("Fill", fill)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(35), math.radians(-30), math.radians(-45))

    rim = bpy.data.lights.new("Rim", type='SUN')
    rim.energy = 3.0
    rim_obj = bpy.data.objects.new("Rim", rim)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.rotation_euler = (math.radians(20), math.radians(10), math.radians(190))

    return scene

def render_model(glb_path, out_prefix, is_clay=False):
    scene = setup_scene()
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
    
    if is_clay:
        clay_mat = bpy.data.materials.new("Clay")
        clay_mat.use_nodes = True
        bsdf = clay_mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs['Base Color'].default_value = (0.85, 0.85, 0.85, 1.0)
            bsdf.inputs['Roughness'].default_value = 0.5
        for obj in mesh_objs:
            obj.data.materials.clear()
            obj.data.materials.append(clay_mat)
    else:
        for mat in bpy.data.materials:
            if mat.use_nodes:
                for n in mat.node_tree.nodes:
                    if n.type == 'VERTEX_COLOR' and not n.layer_name:
                        for obj in mesh_objs:
                            if mat.name in [m.name for m in obj.data.materials if m]:
                                if obj.data.color_attributes:
                                    n.layer_name = obj.data.color_attributes[0].name

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

    # Full body camera
    cam_data = bpy.data.cameras.new("Cam")
    cam_obj = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    cam_data.type = 'PERSP'
    cam_data.lens = 65.0

    target = bpy.data.objects.new("Target", None)
    bpy.context.collection.objects.link(target)
    target.location = center

    tt = cam_obj.constraints.new(type='TRACK_TO')
    tt.target = target
    tt.track_axis = 'TRACK_NEGATIVE_Z'
    tt.up_axis = 'UP_Y'

    scene.render.resolution_x = 512
    scene.render.resolution_y = 512

    # Render Front Full
    dist = max_dim * 2.3
    cam_obj.location = (center[0], center[1] - dist, center[2] + max_dim * 0.05)
    bpy.context.view_layer.update()
    scene.render.filepath = str(TMP_DIR / f"{out_prefix}_full_front.png")
    bpy.ops.render.render(write_still=True)

    # Render 3/4 Full
    rad45 = math.radians(40)
    cam_obj.location = (center[0] + dist * math.sin(rad45), center[1] - dist * math.cos(rad45), center[2] + max_dim * 0.05)
    bpy.context.view_layer.update()
    scene.render.filepath = str(TMP_DIR / f"{out_prefix}_full_tq.png")
    bpy.ops.render.render(write_still=True)

    # Face Closeup Camera
    # Face center roughly at upper 60-80% height
    face_z = min_b[2] + dims[2] * 0.62
    face_center = (center[0], center[1], face_z)
    target.location = face_center

    face_dist = max_dim * 0.95
    cam_obj.location = (center[0], center[1] - face_dist, face_z)
    bpy.context.view_layer.update()
    scene.render.filepath = str(TMP_DIR / f"{out_prefix}_face_front.png")
    bpy.ops.render.render(write_still=True)

    cam_obj.location = (center[0] + face_dist * math.sin(rad45), center[1] - face_dist * math.cos(rad45), face_z)
    bpy.context.view_layer.update()
    scene.render.filepath = str(TMP_DIR / f"{out_prefix}_face_tq.png")
    bpy.ops.render.render(write_still=True)

print("Rendering New Textured Model...")
render_model(GLB_NEW_TEX, "new_tex", is_clay=False)

print("Rendering Old In-Game Model...")
render_model(GLB_OLD, "old_model", is_clay=False)

print("Rendering 700k Clay Shape Closeup...")
render_model(GLB_SHAPE_700K, "shape_700k", is_clay=True)

print("Rendering 60k Clay Shape Closeup...")
render_model(GLB_SHAPE_60K, "shape_60k", is_clay=True)

