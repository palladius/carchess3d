# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""Rigging and animation pipeline for Bishop Alessandro and his Red Baby Dragon."""

import math
import os
import shutil
from pathlib import Path
import bpy
import numpy as np

HERE = Path(__file__).parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
ROOT = HERE.parent.parent.parent
SOURCE_GLB = ROOT / "assets/models/bishop-ale-2.glb"
TARGET_GLB = ROOT / "assets/models/bishop-ale-rigged.glb"

print(f"Loading {SOURCE_GLB}...")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))

mesh_obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
mesh_obj.name = "Bishop_Ale_Mesh"
mesh = mesh_obj.data

# 1. Analyze Vertex Colors & Dragon Region
mat = mesh_obj.data.materials[0]
tex_node = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'][0]
img = tex_node.image
pixels = np.array(img.pixels[:]).reshape((img.size[1], img.size[0], 4))

uv_layer = mesh.uv_layers.active.data
vert_colors = np.zeros((len(mesh.vertices), 3))
vert_counts = np.zeros(len(mesh.vertices))

for poly in mesh.polygons:
    for loop_index in poly.loop_indices:
        v_idx = mesh.loops[loop_index].vertex_index
        uv = uv_layer[loop_index].uv
        u = int(np.clip(uv[0] * img.size[0], 0, img.size[0] - 1))
        v = int(np.clip(uv[1] * img.size[1], 0, img.size[1] - 1))
        vert_colors[v_idx] += pixels[v, u, :3]
        vert_counts[v_idx] += 1

vert_counts[vert_counts == 0] = 1
vert_colors /= vert_counts[:, None]

is_red = (
    (vert_colors[:, 0] > vert_colors[:, 1] * 1.25)
    & (vert_colors[:, 0] > vert_colors[:, 2] * 1.25)
    & (vert_colors[:, 0] > 0.28)
)
vert_positions = np.array([v.co for v in mesh.vertices])

print(f"Total vertices: {len(mesh.vertices)}, Red (dragon) vertices: {is_red.sum()}")

# 2. Build Armature
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm_obj = bpy.context.active_object
arm_obj.name = "Bishop_Ale_Armature"
arm_data = arm_obj.data
arm_data.name = "Bishop_Ale_Rig"

bpy.ops.armature.select_all(action='SELECT')
bpy.ops.armature.delete()

bone_definitions = [
    # name, head, tail, parent, radius_influence, is_dragon
    ("Root", (0, 0, -0.50), (0, 0, -0.35), None, 0.40, False),
    ("Pedestal", (0, 0, -0.50), (0, 0, -0.32), "Root", 0.35, False),
    ("Hips", (0, 0, -0.32), (0, 0, -0.05), "Root", 0.30, False),
    ("Spine", (0, 0, -0.05), (0, 0, 0.12), "Hips", 0.25, False),
    ("Chest", (0, 0, 0.12), (0, 0, 0.24), "Spine", 0.25, False),
    ("Neck", (0, 0, 0.24), (0, 0, 0.28), "Chest", 0.15, False),
    ("Head", (0, 0, 0.28), (0, 0, 0.38), "Neck", 0.20, False),
    ("Mitre", (0, 0, 0.38), (0, 0, 0.50), "Head", 0.22, False),
    # Left Arm
    ("Shoulder.L", (0.05, 0.0, 0.22), (0.12, 0.0, 0.20), "Chest", 0.15, False),
    ("UpperArm.L", (0.12, 0.0, 0.20), (0.18, -0.05, 0.08), "Shoulder.L", 0.14, False),
    ("LowerArm.L", (0.18, -0.05, 0.08), (0.20, -0.10, -0.05), "UpperArm.L", 0.12, False),
    ("Hand.L", (0.20, -0.10, -0.05), (0.22, -0.12, -0.15), "LowerArm.L", 0.12, False),
    # Right Arm
    ("Shoulder.R", (-0.05, 0.0, 0.22), (-0.12, 0.0, 0.20), "Chest", 0.15, False),
    ("UpperArm.R", (-0.12, 0.0, 0.20), (-0.18, -0.05, 0.08), "Shoulder.R", 0.14, False),
    ("LowerArm.R", (-0.18, -0.05, 0.08), (-0.20, -0.10, -0.05), "UpperArm.R", 0.12, False),
    ("Hand.R", (-0.20, -0.10, -0.05), (-0.22, -0.12, -0.15), "LowerArm.R", 0.12, False),
    # Red Baby Dragon
    ("Dragon_Root", (0.05, -0.10, -0.02), (0.05, -0.12, 0.05), "Chest", 0.15, True),
    ("Dragon_Body", (0.05, -0.12, 0.05), (0.05, -0.14, 0.10), "Dragon_Root", 0.14, True),
    ("Dragon_Neck", (0.05, -0.14, 0.10), (0.05, -0.16, 0.15), "Dragon_Body", 0.10, True),
    ("Dragon_Head", (0.05, -0.16, 0.15), (0.05, -0.20, 0.18), "Dragon_Neck", 0.12, True),
    ("Dragon_Jaw", (0.05, -0.18, 0.14), (0.05, -0.22, 0.13), "Dragon_Head", 0.08, True),
    ("Dragon_Tail", (0.05, -0.08, -0.02), (0.05, -0.04, -0.08), "Dragon_Root", 0.10, True),
    # Dragon Wings
    ("Dragon_Wing_Base.L", (0.08, -0.11, 0.08), (0.16, -0.09, 0.12), "Dragon_Body", 0.14, True),
    ("Dragon_Wing_Tip.L", (0.16, -0.09, 0.12), (0.26, -0.06, 0.15), "Dragon_Wing_Base.L", 0.16, True),
    ("Dragon_Wing_Base.R", (0.02, -0.11, 0.08), (-0.06, -0.09, 0.12), "Dragon_Body", 0.14, True),
    ("Dragon_Wing_Tip.R", (-0.06, -0.09, 0.12), (-0.16, -0.06, 0.15), "Dragon_Wing_Base.R", 0.16, True),
]

for name, head, tail, parent_name, _, _ in bone_definitions:
    bone = arm_data.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent_name and parent_name in arm_data.edit_bones:
        bone.parent = arm_data.edit_bones[parent_name]

bpy.ops.object.mode_set(mode='OBJECT')

# 3. Compute Segment-Distance Skinning Weights
def point_segment_distance(p, a, b):
    ab = b - a
    ab_len_sq = np.dot(ab, ab)
    if ab_len_sq < 1e-8:
        return np.linalg.norm(p - a, axis=-1)
    ap = p - a
    t = np.clip(np.sum(ap * ab, axis=-1) / ab_len_sq, 0.0, 1.0)
    closest = a + t[..., None] * ab
    return np.linalg.norm(p - closest, axis=-1)

num_verts = len(mesh.vertices)
num_bones = len(bone_definitions)
weights_matrix = np.zeros((num_verts, num_bones))

for b_idx, (name, head, tail, _, radius, is_dragon) in enumerate(bone_definitions):
    h = np.array(head)
    t = np.array(tail)
    dists = point_segment_distance(vert_positions, h, t)
    
    # Base proximity weight with smooth cosine falloff
    scaled_d = np.clip(dists / radius, 0.0, 2.0)
    w = 1.0 / (1.0 + (scaled_d * 2.5) ** 3)
    
    # Priority boosting based on dragon vs non-dragon
    if is_dragon:
        # Boost influence on red vertices; attenuate on non-red
        w[is_red] *= 4.0
        w[~is_red] *= 0.1
    else:
        # Attenuate human bones on dragon vertices
        w[is_red] *= 0.05
    
    # Specific height-based gating for pedestal and mitre
    if name == "Pedestal":
        w[vert_positions[:, 2] > -0.30] = 0.0
        w[vert_positions[:, 2] < -0.35] *= 3.0
    elif name == "Mitre":
        w[vert_positions[:, 2] < 0.35] = 0.0
        w[vert_positions[:, 2] >= 0.38] *= 3.0
        
    weights_matrix[:, b_idx] = w

# Normalize and retain top 4 weights per vertex (WebGL standard)
weights_matrix[weights_matrix < 1e-4] = 0.0
row_sums = weights_matrix.sum(axis=1, keepdims=True)
row_sums[row_sums == 0] = 1.0
weights_matrix /= row_sums

# Top 4 sparsity
for i in range(num_verts):
    row = weights_matrix[i]
    if (row > 0).sum() > 4:
        top_indices = np.argsort(row)[-4:]
        mask = np.zeros_like(row, dtype=bool)
        mask[top_indices] = True
        row[~mask] = 0.0
        row /= row.sum()
        weights_matrix[i] = row

# Assign to Vertex Groups
mesh_obj.vertex_groups.clear()
for b_idx, (b_name, *_) in enumerate(bone_definitions):
    vg = mesh_obj.vertex_groups.new(name=b_name)
    w_col = weights_matrix[:, b_idx]
    non_zero_idx = np.where(w_col > 1e-4)[0]
    for v_idx in non_zero_idx:
        vg.add([int(v_idx)], float(w_col[v_idx]), 'REPLACE')

# Add Armature Modifier
mod = mesh_obj.modifiers.new("Armature", 'ARMATURE')
mod.object = arm_obj
mesh_obj.parent = arm_obj

print("Weighted skinning assigned successfully to 26 bones.")

# 4. Create Animation Clips
bpy.context.view_layer.objects.active = arm_obj
arm_obj.animation_data_create()

def set_keyframe(bone_name, prop, val, frame):
    pose_bone = arm_obj.pose.bones[bone_name]
    setattr(pose_bone, prop, val)
    pose_bone.keyframe_insert(data_path=prop, frame=frame)

# -------------------------------------------------------------
# ACTION 1: "Idle" (Breathing + Dragon Wing Glide/Flap Loop)
# 60 frames @ 30fps (2.0s loop)
# -------------------------------------------------------------
act_idle = bpy.data.actions.new(name="Idle")
arm_obj.animation_data.action = act_idle

for frame in range(0, 61, 5):
    t = frame / 60.0  # 0.0 to 1.0
    phase = 2 * math.pi * t
    
    # Alessandro: gentle breathing
    spine_rot = math.sin(phase) * 0.02
    chest_rot = math.sin(phase) * 0.03
    head_rot = math.sin(phase) * -0.015
    
    pose_bone = arm_obj.pose.bones["Spine"]
    pose_bone.rotation_mode = 'XYZ'
    pose_bone.rotation_euler = (spine_rot, 0, 0)
    pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    pose_bone = arm_obj.pose.bones["Chest"]
    pose_bone.rotation_mode = 'XYZ'
    pose_bone.rotation_euler = (chest_rot, 0, 0)
    pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    pose_bone = arm_obj.pose.bones["Head"]
    pose_bone.rotation_mode = 'XYZ'
    pose_bone.rotation_euler = (head_rot, 0, 0)
    pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    # Dragon: hovering bobbing
    dragon_z = math.sin(phase * 2) * 0.015
    dragon_pitch = math.sin(phase * 2) * 0.05
    
    p_droot = arm_obj.pose.bones["Dragon_Root"]
    p_droot.location = (0, 0, dragon_z)
    p_droot.rotation_mode = 'XYZ'
    p_droot.rotation_euler = (dragon_pitch, 0, 0)
    p_droot.keyframe_insert(data_path="location", frame=frame)
    p_droot.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    # Dragon Wings Flapping + Gliding
    # Subdivided into 2 phases: 0-30 flap beat, 30-60 glide spread
    if frame <= 30:
        # Active flap: 2 rapid wing beats
        flap_t = (frame / 30.0) * 4 * math.pi
        wing_l_roll = math.sin(flap_t) * 0.65  # ~37 deg
        wing_l_tip_roll = math.sin(flap_t - 0.5) * 0.45
        wing_r_roll = -wing_l_roll
        wing_r_tip_roll = -wing_l_tip_roll
    else:
        # Gliding: spread wide and gentle rocking
        glide_t = ((frame - 30) / 30.0) * 2 * math.pi
        wing_l_roll = 0.20 + math.sin(glide_t) * 0.10
        wing_l_tip_roll = 0.15 + math.sin(glide_t) * 0.08
        wing_r_roll = -wing_l_roll
        wing_r_tip_roll = -wing_l_tip_roll
        
    p_wlb = arm_obj.pose.bones["Dragon_Wing_Base.L"]
    p_wlb.rotation_mode = 'XYZ'
    p_wlb.rotation_euler = (0, 0, wing_l_roll)
    p_wlb.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    p_wlt = arm_obj.pose.bones["Dragon_Wing_Tip.L"]
    p_wlt.rotation_mode = 'XYZ'
    p_wlt.rotation_euler = (0, 0, wing_l_tip_roll)
    p_wlt.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    p_wrb = arm_obj.pose.bones["Dragon_Wing_Base.R"]
    p_wrb.rotation_mode = 'XYZ'
    p_wrb.rotation_euler = (0, 0, wing_r_roll)
    p_wrb.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    p_wrt = arm_obj.pose.bones["Dragon_Wing_Tip.R"]
    p_wrt.rotation_mode = 'XYZ'
    p_wrt.rotation_euler = (0, 0, wing_r_tip_roll)
    p_wrt.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    # Dragon Head and Tail micro movements
    p_dhead = arm_obj.pose.bones["Dragon_Head"]
    p_dhead.rotation_mode = 'XYZ'
    p_dhead.rotation_euler = (math.sin(phase * 2) * 0.08, 0, math.cos(phase) * 0.06)
    p_dhead.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    p_dtail = arm_obj.pose.bones["Dragon_Tail"]
    p_dtail.rotation_mode = 'XYZ'
    p_dtail.rotation_euler = (0, math.sin(phase * 2) * 0.15, 0)
    p_dtail.keyframe_insert(data_path="rotation_euler", frame=frame)

# -------------------------------------------------------------
# ACTION 2: "Click_Fire_Breath" (Dragon turns to viewer & breathes fire)
# 90 frames @ 30fps (3.0s interactive easter egg)
# -------------------------------------------------------------
act_fire = bpy.data.actions.new(name="Click_Fire_Breath")
arm_obj.animation_data.action = act_fire

keyframes_fire = [
    # (frame, root_pos, root_rot, jaw_rot, wing_l, wing_r, head_rot)
    (0,  (0, 0, 0),        (0, 0, 0),           0.0,   0.0,   0.0,   (0, 0, 0)),
    (15, (0, -0.03, 0.02), (-0.2, 0, -0.4),     0.0,   0.3,  -0.3,   (-0.1, 0, -0.3)),
    (30, (0, -0.05, 0.04), (-0.3, 0, -0.6),     0.0,   0.8,  -0.8,   (-0.2, 0, -0.5)),
    (45, (0, -0.08, 0.06), (-0.1, 0, -0.7),    -0.5,   1.1,  -1.1,   (0.2, 0, -0.6)),
    (60, (0, -0.09, 0.07), (-0.1, 0, -0.7),    -0.7,   1.2,  -1.2,   (0.3, 0, -0.6)),  # Peak fire breath!
    (75, (0, -0.04, 0.03), (-0.1, 0, -0.3),    -0.1,   0.4,  -0.4,   (0.0, 0, -0.2)),
    (90, (0, 0, 0),        (0, 0, 0),           0.0,   0.0,   0.0,   (0, 0, 0)),
]

for f, r_pos, r_rot, jaw_r, w_l, w_r, h_rot in keyframes_fire:
    p_droot = arm_obj.pose.bones["Dragon_Root"]
    p_droot.location = r_pos
    p_droot.rotation_mode = 'XYZ'
    p_droot.rotation_euler = r_rot
    p_droot.keyframe_insert(data_path="location", frame=f)
    p_droot.keyframe_insert(data_path="rotation_euler", frame=f)
    
    p_djaw = arm_obj.pose.bones["Dragon_Jaw"]
    p_djaw.rotation_mode = 'XYZ'
    p_djaw.rotation_euler = (jaw_r, 0, 0)
    p_djaw.keyframe_insert(data_path="rotation_euler", frame=f)
    
    p_wlb = arm_obj.pose.bones["Dragon_Wing_Base.L"]
    p_wlb.rotation_mode = 'XYZ'
    p_wlb.rotation_euler = (0, 0, w_l)
    p_wlb.keyframe_insert(data_path="rotation_euler", frame=f)
    
    p_wrb = arm_obj.pose.bones["Dragon_Wing_Base.R"]
    p_wrb.rotation_mode = 'XYZ'
    p_wrb.rotation_euler = (0, 0, w_r)
    p_wrb.keyframe_insert(data_path="rotation_euler", frame=f)
    
    p_dhead = arm_obj.pose.bones["Dragon_Head"]
    p_dhead.rotation_mode = 'XYZ'
    p_dhead.rotation_euler = h_rot
    p_dhead.keyframe_insert(data_path="rotation_euler", frame=f)

# Store both actions in NLA tracks so glTF exporter includes all animations
arm_obj.animation_data.use_nla = True
nla_tracks = arm_obj.animation_data.nla_tracks
track1 = nla_tracks.new()
track1.name = "Idle_Track"
track1.strips.new("Idle", 0, act_idle)

track2 = nla_tracks.new()
track2.name = "FireBreath_Track"
track2.strips.new("Click_Fire_Breath", 0, act_fire)

arm_obj.animation_data.action = act_idle

# 5. Export GLB
out_glb = OUT / "bishop-ale-rigged.glb"
print(f"Exporting rigged animated GLB to {out_glb}...")
bpy.ops.export_scene.gltf(
    filepath=str(out_glb),
    export_format='GLB',
    export_skins=True,
    export_animations=True,
    export_nla_strips=True,
    export_def_bones=True,
    export_current_frame=False,
    export_apply=False,
)

# Copy to canonical assets
shutil.copy(out_glb, TARGET_GLB)
print(f"✅ Exported canonical model: {TARGET_GLB} ({TARGET_GLB.stat().st_size // 1024} KB)")

# 6. Render preview animation turntable MP4
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in bpy.types.RenderEngine.bl_rna.properties['engine'].enum_items.keys() else 'BLENDER_EEVEE'
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.fps = 30
scene.frame_start = 0
scene.frame_end = 60

# Add Camera & Lights
cam_data = bpy.data.cameras.new(name="PreviewCam")
cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_obj.location = (0.7, -1.2, 0.4)
cam_obj.rotation_euler = (math.radians(75), 0, math.radians(30))

light_data = bpy.data.lights.new(name="Sun", type='SUN')
light_data.energy = 3.5
light_obj = bpy.data.objects.new("Sun", light_data)
bpy.context.collection.objects.link(light_obj)
light_obj.location = (1.5, -2.0, 3.0)
light_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(20))

fill_light_data = bpy.data.lights.new(name="Fill", type='SUN')
fill_light_data.energy = 1.8
fill_obj = bpy.data.objects.new("Fill", fill_light_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.location = (-2.0, 1.5, 2.0)
fill_obj.rotation_euler = (math.radians(-30), math.radians(-20), math.radians(120))

# Render frames and export video
scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format = 'MPEG4'
scene.render.ffmpeg.codec = 'H264'
scene.render.filepath = str(OUT / "bishop_ale_rigged_idle.mp4")

print("Rendering preview animation MP4...")
bpy.ops.render.render(animation=True)
print("✅ Preview render complete.")
