import bpy
import math
import numpy as np

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import GLTF
bpy.ops.import_scene.gltf(filepath='assets/models/bishop-ale-2.glb')
mesh_obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
mesh_obj.name = "Bishop_Ale_Mesh"

# Create Armature
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm_obj = bpy.context.active_object
arm_obj.name = "Bishop_Ale_Armature"
arm_data = arm_obj.data
arm_data.name = "Bishop_Ale_Rig"

# Remove default bone
bpy.ops.armature.select_all(action='SELECT')
bpy.ops.armature.delete()

# Helper to create bone
def create_bone(name, head, tail, parent_name=None):
    bone = arm_data.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent_name and parent_name in arm_data.edit_bones:
        bone.parent = arm_data.edit_bones[parent_name]
    return bone

# Create Bones (Z is up, Y is back/front, X is left/right)
# Root & Pedestal
create_bone("Root", (0, 0, -0.50), (0, 0, -0.35))
create_bone("Pedestal", (0, 0, -0.50), (0, 0, -0.32), "Root")

# Humanoid chain (Alessandro)
create_bone("Hips", (0, 0, -0.32), (0, 0, -0.05), "Root")
create_bone("Spine", (0, 0, -0.05), (0, 0, 0.12), "Hips")
create_bone("Chest", (0, 0, 0.12), (0, 0, 0.24), "Spine")
create_bone("Neck", (0, 0, 0.24), (0, 0, 0.28), "Chest")
create_bone("Head", (0, 0, 0.28), (0, 0, 0.38), "Neck")
create_bone("Mitre", (0, 0, 0.38), (0, 0, 0.50), "Head")

# Left Arm (holds staff/cape)
create_bone("Shoulder.L", (0.05, 0.0, 0.22), (0.12, 0.0, 0.20), "Chest")
create_bone("UpperArm.L", (0.12, 0.0, 0.20), (0.18, -0.05, 0.08), "Shoulder.L")
create_bone("LowerArm.L", (0.18, -0.05, 0.08), (0.20, -0.10, -0.05), "UpperArm.L")
create_bone("Hand.L", (0.20, -0.10, -0.05), (0.22, -0.12, -0.15), "LowerArm.L")

# Right Arm
create_bone("Shoulder.R", (-0.05, 0.0, 0.22), (-0.12, 0.0, 0.20), "Chest")
create_bone("UpperArm.R", (-0.12, 0.0, 0.20), (-0.18, -0.05, 0.08), "Shoulder.R")
create_bone("LowerArm.R", (-0.18, -0.05, 0.08), (-0.20, -0.10, -0.05), "UpperArm.R")
create_bone("Hand.R", (-0.20, -0.10, -0.05), (-0.22, -0.12, -0.15), "LowerArm.R")

# Red Baby Dragon chain
create_bone("Dragon_Root", (0.05, -0.10, -0.02), (0.05, -0.12, 0.05), "Chest")
create_bone("Dragon_Body", (0.05, -0.12, 0.05), (0.05, -0.14, 0.10), "Dragon_Root")
create_bone("Dragon_Neck", (0.05, -0.14, 0.10), (0.05, -0.16, 0.15), "Dragon_Body")
create_bone("Dragon_Head", (0.05, -0.16, 0.15), (0.05, -0.20, 0.18), "Dragon_Neck")
create_bone("Dragon_Jaw", (0.05, -0.18, 0.14), (0.05, -0.22, 0.13), "Dragon_Head")
create_bone("Dragon_Tail", (0.05, -0.08, -0.02), (0.05, -0.04, -0.08), "Dragon_Root")

# Dragon Wings
create_bone("Dragon_Wing_Base.L", (0.08, -0.11, 0.08), (0.16, -0.09, 0.12), "Dragon_Body")
create_bone("Dragon_Wing_Tip.L", (0.16, -0.09, 0.12), (0.26, -0.06, 0.15), "Dragon_Wing_Base.L")

create_bone("Dragon_Wing_Base.R", (0.02, -0.11, 0.08), (-0.06, -0.09, 0.12), "Dragon_Body")
create_bone("Dragon_Wing_Tip.R", (-0.06, -0.09, 0.12), (-0.16, -0.06, 0.15), "Dragon_Wing_Base.R")

bpy.ops.object.mode_set(mode='OBJECT')

print(f"Created Armature with {len(arm_data.bones)} bones")

# Select mesh and armature
bpy.ops.object.select_all(action='DESELECT')
mesh_obj.select_set(True)
arm_obj.select_set(True)
bpy.context.view_layer.objects.active = arm_obj

# Try automatic weights
try:
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    print("Auto skinning succeeded!")
except Exception as e:
    print(f"Auto skinning failed: {e}")

# Check vertex groups
print(f"Vertex groups on mesh: {len(mesh_obj.vertex_groups)}")
for vg in mesh_obj.vertex_groups:
    print(f" - {vg.name}")
