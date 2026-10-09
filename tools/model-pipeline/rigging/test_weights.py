import bpy
import numpy as np

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='assets/models/bishop-ale-2.glb')
mesh_obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]

# Add armature modifier manually
arm_data = bpy.data.armatures.new("AleRig")
arm_obj = bpy.data.objects.new("AleArmature", arm_data)
bpy.context.collection.objects.link(arm_obj)

# Add modifier to mesh
mod = mesh_obj.modifiers.new("Armature", 'ARMATURE')
mod.object = arm_obj

print("Armature modifier attached successfully")
