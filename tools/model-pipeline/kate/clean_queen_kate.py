# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Clean up Queen Kate Nozze 2016 geometry:
- Separate hair chignon from collar (clear neck contour)
- Clean up scepter / hands so they do not melt into purple velvet dress
- Apply selective Laplacian / Surface Smooth on gown and skin while keeping hard edges on pedestal
- Ground model so min Z is 0.0
- Export assets/models/queen-kate-wedding2016-remastered.glb
"""
from pathlib import Path
import bpy
import bmesh
import numpy as np

HERE = Path(__file__).parent
ROOT = HERE.parent.parent.parent
SOURCE_GLB = ROOT / "assets/models/queen-kate-wedding2016.glb"
TARGET_GLB = ROOT / "assets/models/queen-kate-wedding2016-remastered.glb"

print(f"Resetting scene and loading {SOURCE_GLB}...")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))

mesh_obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
mesh_obj.name = "Queen_Kate_Wedding2016"
mesh = mesh_obj.data

# 1. Geometry adjustments in BMesh
bm = bmesh.new()
bm.from_mesh(mesh)

# Separate chignon from collar and straighten/separate scepter
for v in bm.verts:
    x, y, z = v.co
    # 1.1 Hair Chignon undercut & neck contour:
    # At rear (y > 0.04), neck level (0.16 <= z <= 0.25)
    if y > 0.04 and abs(x) < 0.12:
        if 0.18 <= z <= 0.24:
            factor = 1.0 - abs(z - 0.21) / 0.03
            v.co.y -= factor * 0.024  # Inset crease to define nape of neck
        elif 0.24 < z <= 0.34 and y > 0.07:
            v.co.z += 0.012  # Elevate lower curve of chignon
            v.co.y += 0.008

    # 1.2 Scepter & Hands forward separation:
    if abs(x) < 0.14 and -0.22 <= z <= 0.18:
        if y < -0.09:
            v.co.y -= 0.016  # Pull scepter & hands cleanly forward
        elif -0.09 <= y <= -0.04:
            v.co.y += 0.006  # Pull dress behind scepter slightly inward to create negative space

bm.to_mesh(mesh)
bm.free()
mesh.update()

# 2. Vertex Group for selective surface smoothing
vg = mesh_obj.vertex_groups.new(name="Smooth_Gown_Skin")
for v in mesh.vertices:
    x, y, z = v.co
    if y < -0.08 and abs(x) < 0.15 and -0.24 <= z <= 0.18:
        # Scepter: preserve crisp mechanical shaft edges
        w = 0.0
    elif z < -0.32:
        # Pedestal: preserve hard turned lathe edges
        w = 0.0
    elif z < -0.28:
        w = (z - (-0.32)) / 0.04
    else:
        w = 1.0
    vg.add([v.index], w, 'REPLACE')

# 3. Apply Smooth Modifier
mod = mesh_obj.modifiers.new(name="SurfaceSmooth", type='SMOOTH')
mod.factor = 0.40
mod.iterations = 3
mod.vertex_group = "Smooth_Gown_Skin"

bpy.ops.object.select_all(action='DESELECT')
mesh_obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_obj
bpy.ops.object.modifier_apply(modifier="SurfaceSmooth")

# 4. Grounding: translate so minimum Z is exactly 0.0
min_z = min(v.co[2] for v in mesh.vertices)
for v in mesh.vertices:
    v.co[2] -= min_z
mesh.update()

# 5. Export remastered GLB
TARGET_GLB.parent.mkdir(parents=True, exist_ok=True)
print(f"Exporting remastered Queen Kate to {TARGET_GLB}...")
bpy.ops.export_scene.gltf(filepath=str(TARGET_GLB), export_format='GLB')
print("✅ Export successful!")
