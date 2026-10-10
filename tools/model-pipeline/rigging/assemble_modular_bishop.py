import math
import shutil
from pathlib import Path
import bpy
import numpy as np

HERE = Path(__file__).parent
OUT = HERE / "out"
ROOT = HERE.parent.parent.parent
TARGET_GLB = ROOT / "assets/models/bishop-ale-rigged.glb"

print("Resetting scene...")
bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Load Ale bishop base model (Ale 1 with mitre hat)
ale_glb = ROOT / "assets/models/bishop-ale-1.glb"
print(f"Loading Alessandro base: {ale_glb}...")
bpy.ops.import_scene.gltf(filepath=str(ale_glb))
ale_mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]
ale_mesh.name = "Alessandro_Body"

# 2. Load clean textured dragon model
dragon_glb = ROOT / "tools/model-pipeline/dragon/out/dragon_clean.glb"
print(f"Loading Dragon: {dragon_glb}...")
bpy.ops.import_scene.gltf(filepath=str(dragon_glb))
dragon_mesh = [o for o in bpy.data.objects if o.type == 'MESH' and o != ale_mesh][0]
dragon_mesh.name = "Dragon_Companion"

# Position the dragon gracefully perched on Alessandro's left arm/shoulder/staff
# Scale dragon appropriately (~28% of Ale's height)
dragon_mesh.scale = (0.75, 0.75, 0.75)
dragon_mesh.location = (0.16, -0.05, 0.14)
dragon_mesh.rotation_euler = (math.radians(10), math.radians(-5), math.radians(-25))
bpy.ops.object.select_all(action='DESELECT')
dragon_mesh.select_set(True)
bpy.context.view_layer.objects.active = dragon_mesh
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

print("Dragon perched onto shoulder.")

# 3. Create Armature
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm_obj = bpy.context.active_object
arm_obj.name = "Bishop_Ale_Armature"
arm_data = arm_obj.data
arm_data.name = "Bishop_Ale_Rig"

bpy.ops.armature.select_all(action='SELECT')
bpy.ops.armature.delete()

def add_bone(name, head, tail, parent_name=None):
    b = arm_data.edit_bones.new(name)
    b.head = head
    b.tail = tail
    if parent_name and parent_name in arm_data.edit_bones:
        b.parent = arm_data.edit_bones[parent_name]
    return b

# Alessandro humanoid chain
add_bone("Root", (0, 0, -0.50), (0, 0, -0.35))
add_bone("Pedestal", (0, 0, -0.50), (0, 0, -0.32), "Root")
add_bone("Hips", (0, 0, -0.32), (0, 0, -0.05), "Root")
add_bone("Spine", (0, 0, -0.05), (0, 0, 0.12), "Hips")
add_bone("Chest", (0, 0, 0.12), (0, 0, 0.24), "Spine")
add_bone("Neck", (0, 0, 0.24), (0, 0, 0.28), "Chest")
add_bone("Head", (0, 0, 0.28), (0, 0, 0.38), "Neck")
add_bone("Mitre", (0, 0, 0.38), (0, 0, 0.50), "Head")
# Arms
add_bone("Shoulder.L", (0.05, 0.0, 0.22), (0.12, 0.0, 0.20), "Chest")
add_bone("UpperArm.L", (0.12, 0.0, 0.20), (0.18, -0.05, 0.08), "Shoulder.L")
add_bone("LowerArm.L", (0.18, -0.05, 0.08), (0.20, -0.10, -0.05), "UpperArm.L")
add_bone("Hand.L", (0.20, -0.10, -0.05), (0.22, -0.12, -0.15), "LowerArm.L")

add_bone("Shoulder.R", (-0.05, 0.0, 0.22), (-0.12, 0.0, 0.20), "Chest")
add_bone("UpperArm.R", (-0.12, 0.0, 0.20), (-0.18, -0.05, 0.08), "Shoulder.R")
add_bone("LowerArm.R", (-0.18, -0.05, 0.08), (-0.20, -0.10, -0.05), "UpperArm.R")
add_bone("Hand.R", (-0.20, -0.10, -0.05), (-0.22, -0.12, -0.15), "LowerArm.R")

# Dragon Bones (positioned relative to dragon at (0.13, -0.06, 0.12))
d_pos = (0.13, -0.06, 0.12)
add_bone("Dragon_Root", (0.13, -0.06, 0.12), (0.13, -0.08, 0.18), "Chest")
add_bone("Dragon_Body", (0.13, -0.08, 0.18), (0.13, -0.10, 0.23), "Dragon_Root")
add_bone("Dragon_Neck", (0.13, -0.10, 0.23), (0.13, -0.13, 0.27), "Dragon_Body")
add_bone("Dragon_Head", (0.13, -0.13, 0.27), (0.13, -0.17, 0.29), "Dragon_Neck")
add_bone("Dragon_Jaw", (0.13, -0.15, 0.26), (0.13, -0.18, 0.25), "Dragon_Head")
add_bone("Dragon_Tail", (0.13, -0.04, 0.12), (0.13, 0.00, 0.07), "Dragon_Root")

# Dragon Wings
add_bone("Dragon_Wing_Base.L", (0.16, -0.08, 0.20), (0.23, -0.06, 0.24), "Dragon_Body")
add_bone("Dragon_Wing_Tip.L", (0.23, -0.06, 0.24), (0.32, -0.04, 0.27), "Dragon_Wing_Base.L")

add_bone("Dragon_Wing_Base.R", (0.10, -0.08, 0.20), (0.03, -0.06, 0.24), "Dragon_Body")
add_bone("Dragon_Wing_Tip.R", (0.03, -0.06, 0.24), (-0.06, -0.04, 0.27), "Dragon_Wing_Base.R")

bpy.ops.object.mode_set(mode='OBJECT')

# 4. Bind Armature with modifiers
for m_obj in [ale_mesh, dragon_mesh]:
    mod = m_obj.modifiers.new("Armature", 'ARMATURE')
    mod.object = arm_obj
    m_obj.parent = arm_obj

# Weight Alessandro mesh
ale_bones = ["Root", "Pedestal", "Hips", "Spine", "Chest", "Neck", "Head", "Mitre", 
             "Shoulder.L", "UpperArm.L", "LowerArm.L", "Hand.L",
             "Shoulder.R", "UpperArm.R", "LowerArm.R", "Hand.R"]
for bname in ale_bones:
    vg = ale_mesh.vertex_groups.new(name=bname)

coords_ale = np.array([v.co for v in ale_mesh.data.vertices])
for v_i, co in enumerate(coords_ale):
    z = co[2]
    if z < -0.32:
        ale_mesh.vertex_groups["Pedestal"].add([v_i], 1.0, 'REPLACE')
    elif z < -0.05:
        ale_mesh.vertex_groups["Hips"].add([v_i], 1.0, 'REPLACE')
    elif z < 0.12:
        ale_mesh.vertex_groups["Spine"].add([v_i], 1.0, 'REPLACE')
    elif z < 0.24:
        ale_mesh.vertex_groups["Chest"].add([v_i], 1.0, 'REPLACE')
    elif z < 0.35:
        ale_mesh.vertex_groups["Head"].add([v_i], 1.0, 'REPLACE')
    else:
        ale_mesh.vertex_groups["Mitre"].add([v_i], 1.0, 'REPLACE')

# Weight Dragon mesh
dragon_bones = ["Dragon_Root", "Dragon_Body", "Dragon_Neck", "Dragon_Head", "Dragon_Jaw", "Dragon_Tail",
                "Dragon_Wing_Base.L", "Dragon_Wing_Tip.L", "Dragon_Wing_Base.R", "Dragon_Wing_Tip.R"]
for bname in dragon_bones:
    dragon_mesh.vertex_groups.new(name=bname)

coords_drg = np.array([v.co for v in dragon_mesh.data.vertices])
for v_i, co in enumerate(coords_drg):
    x, y, z = co
    # Wings
    if x > 0.16:
        if x > 0.23:
            dragon_mesh.vertex_groups["Dragon_Wing_Tip.L"].add([v_i], 1.0, 'REPLACE')
        else:
            dragon_mesh.vertex_groups["Dragon_Wing_Base.L"].add([v_i], 1.0, 'REPLACE')
    elif x < 0.10:
        if x < 0.03:
            dragon_mesh.vertex_groups["Dragon_Wing_Tip.R"].add([v_i], 1.0, 'REPLACE')
        else:
            dragon_mesh.vertex_groups["Dragon_Wing_Base.R"].add([v_i], 1.0, 'REPLACE')
    elif z > 0.25:
        dragon_mesh.vertex_groups["Dragon_Head"].add([v_i], 1.0, 'REPLACE')
    elif z < 0.14:
        dragon_mesh.vertex_groups["Dragon_Tail"].add([v_i], 1.0, 'REPLACE')
    else:
        dragon_mesh.vertex_groups["Dragon_Body"].add([v_i], 1.0, 'REPLACE')

print("Skinning assigned to both meshes.")

# 5. Keyframe Animations
bpy.context.view_layer.objects.active = arm_obj
arm_obj.animation_data_create()

# ACTION 1: "Idle" (Wing Flap & Glide)
act_idle = bpy.data.actions.new(name="Idle")
arm_obj.animation_data.action = act_idle

for frame in range(0, 61, 5):
    t = frame / 60.0
    phase = 2 * math.pi * t
    
    # Alessandro: breathing
    p_spine = arm_obj.pose.bones["Spine"]
    p_spine.rotation_mode = 'XYZ'
    p_spine.rotation_euler = (math.sin(phase) * 0.02, 0, 0)
    p_spine.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    # Dragon: hovering
    p_droot = arm_obj.pose.bones["Dragon_Root"]
    p_droot.location = (0, 0, math.sin(phase * 2) * 0.015)
    p_droot.keyframe_insert(data_path="location", frame=frame)
    
    # Dragon Wings Flapping & Gliding
    if frame <= 30:
        flap_t = (frame / 30.0) * 4 * math.pi
        w_l = math.sin(flap_t) * 0.65
        w_lt = math.sin(flap_t - 0.5) * 0.45
    else:
        glide_t = ((frame - 30) / 30.0) * 2 * math.pi
        w_l = 0.20 + math.sin(glide_t) * 0.10
        w_lt = 0.15 + math.sin(glide_t) * 0.08
        
    p_wlb = arm_obj.pose.bones["Dragon_Wing_Base.L"]
    p_wlb.rotation_mode = 'XYZ'
    p_wlb.rotation_euler = (0, 0, w_l)
    p_wlb.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    p_wlt = arm_obj.pose.bones["Dragon_Wing_Tip.L"]
    p_wlt.rotation_mode = 'XYZ'
    p_wlt.rotation_euler = (0, 0, w_lt)
    p_wlt.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    p_wrb = arm_obj.pose.bones["Dragon_Wing_Base.R"]
    p_wrb.rotation_mode = 'XYZ'
    p_wrb.rotation_euler = (0, 0, -w_l)
    p_wrb.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    p_wrt = arm_obj.pose.bones["Dragon_Wing_Tip.R"]
    p_wrt.rotation_mode = 'XYZ'
    p_wrt.rotation_euler = (0, 0, -w_lt)
    p_wrt.keyframe_insert(data_path="rotation_euler", frame=frame)

# ACTION 2: "Click_Fire_Breath"
act_fire = bpy.data.actions.new(name="Click_Fire_Breath")
arm_obj.animation_data.action = act_fire

for f, r_rot, jaw_r, w_l, h_rot in [
    (0,  (0, 0, 0),         0.0,   0.0,  (0, 0, 0)),
    (20, (-0.2, 0, -0.4),   0.0,   0.4,  (-0.1, 0, -0.3)),
    (45, (-0.1, 0, -0.7),  -0.6,   1.1,  (0.2, 0, -0.6)),  # Peak Fire Breath!
    (70, (-0.1, 0, -0.3),  -0.1,   0.4,  (0.0, 0, -0.2)),
    (90, (0, 0, 0),         0.0,   0.0,  (0, 0, 0)),
]:
    p_droot = arm_obj.pose.bones["Dragon_Root"]
    p_droot.rotation_mode = 'XYZ'
    p_droot.rotation_euler = r_rot
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
    p_wrb.rotation_euler = (0, 0, -w_l)
    p_wrb.keyframe_insert(data_path="rotation_euler", frame=f)

arm_obj.animation_data.use_nla = True
nla_tracks = arm_obj.animation_data.nla_tracks
t1 = nla_tracks.new()
t1.name = "Idle_Track"
t1.strips.new("Idle", 0, act_idle)

t2 = nla_tracks.new()
t2.name = "FireBreath_Track"
t2.strips.new("Click_Fire_Breath", 0, act_fire)

arm_obj.animation_data.action = act_idle

# 6. Export Canonical GLB
print(f"Exporting canonical rigged bishop to {TARGET_GLB}...")
bpy.ops.export_scene.gltf(
    filepath=str(TARGET_GLB),
    export_format='GLB',
    export_skins=True,
    export_animations=True,
    export_nla_strips=True,
    export_def_bones=True,
)
print("✅ Export complete!")
