# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Modular Assembly Pipeline for Bishop Ale #2 (Option C Remaster).

Addresses Riccardo's two key QA failures on bishop-ale-2.glb:
1. Eliminates fused props / 'two half dragons' artifacts by completely retracting the entire
   dragon, smoke, wings, and tail from the boy mesh across all heights.
2. Replaces collapsed staff disc with a pristine 8-spoked celestial navigation wheel astrolabe
   and sturdy grounded ceremonial crosier staff.
3. Preserves charming chibi facial profile while smoothing forehead marching-cubes noise; grounds pedestal at Z=0.
4. Mounts clean dragon companion on shoulder pad with clear negative space separation.
5. Exports canonical assets/models/bishop-ale-2-remastered.glb.
"""
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).parent
ROOT = HERE.parent.parent.parent
OUT = HERE / "out"
OUT.mkdir(parents=True, exist_ok=True)

SOURCE_GLB = ROOT / "assets/models/bishop-ale-2.glb"
DRAGON_GLB = ROOT / "tools/model-pipeline/dragon/out/dragon_clean.glb"
CLEAN_BODY_GLB = OUT / "ale_body_clean.glb"
CLEAN_ASTROLABE_GLB = OUT / "astrolabe_clean.glb"
TARGET_GLB = ROOT / "assets/models/bishop-ale-2-remastered.glb"

print("=" * 60)
print("🏰 Modular Remaster: Bishop Ale #2")
print("=" * 60)

# ---------------------------------------------------------------------------
# STEP 1: Extract & Clean Alessandro Boy Figure
# ---------------------------------------------------------------------------
print("Step 1: Extracting clean boy character body from monolithic mesh...")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))

mesh_obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
mesh_obj.name = "Alessandro_Body"

bm = bmesh.new()
bm.from_mesh(mesh_obj.data)

# 1.1 Weld UV split vertices
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# 1.2 Remove orphan floating face at pedestal base
orphan_faces = [f for f in bm.faces if any(v.co.z < -0.485 and abs(v.co.x) > 0.15 for v in f.verts)]
if orphan_faces:
    bmesh.ops.delete(bm, geom=orphan_faces, context='FACES')
    bm.verts.ensure_lookup_table()

# 1.3 Retract fused staff protrusion back into natural left sleeve cuff
staff_verts = [v for v in bm.verts if v.co.x > 0.21 and v.co.z < 0.26 and v.co.z > -0.34]
for v in staff_verts:
    v.co.x = 0.19 + (v.co.x - 0.21) * 0.10

# 1.4 Retract ALL fused dragon, smoke, wing, and tail lumps from boy mesh
retracted_dragon = []
for v in bm.verts:
    # Dragon lower wing and tail along upper right arm:
    if v.co.x < -0.21 and -0.12 < v.co.z < 0.12 and v.co.y > 0.03:
        v.co.x = -0.19 + (v.co.x - (-0.21)) * 0.12
        v.co.y = 0.03 + (v.co.y - 0.03) * 0.20
        retracted_dragon.append(v)
    # Dragon body at shoulder level:
    elif v.co.x < -0.15 and 0.08 < v.co.z < 0.28:
        v.co.x = -0.14 + (v.co.x - (-0.15)) * 0.10
        if v.co.y > 0.05:
            v.co.y = 0.05 + (v.co.y - 0.05) * 0.15
        retracted_dragon.append(v)
    # Dragon head, horns, and smoke puffs at neck/ear level:
    elif v.co.x < -0.13 and 0.28 <= v.co.z < 0.45:
        v.co.x = -0.125 + (v.co.x - (-0.13)) * 0.08
        if v.co.y < -0.05:
            v.co.y = -0.05 + (v.co.y - (-0.05)) * 0.10
        elif v.co.y > 0.05:
            v.co.y = 0.05 + (v.co.y - 0.05) * 0.10
        retracted_dragon.append(v)

print(f"Retracted {len(retracted_dragon)} fused dragon/smoke/wing vertices.")

# Smooth sleeve cuff and shoulder mantle drape
smooth_targets = staff_verts + retracted_dragon
for _ in range(4):
    bmesh.ops.smooth_vert(bm, verts=smooth_targets, factor=0.55)

# 1.5 Gentle smoothing on forehead and cheeks to eliminate marching-cubes noise
face_verts = [v for v in bm.verts if abs(v.co.x) < 0.09 and v.co.y < -0.10 and 0.32 < v.co.z < 0.44]
if face_verts:
    for _ in range(2):
        bmesh.ops.smooth_vert(bm, verts=face_verts, factor=0.30)

# 1.6 Grounding: translate so minimum Z is exactly 0.0
min_z = min(v.co.z for v in bm.verts)
for v in bm.verts:
    v.co.z -= min_z

bm.to_mesh(mesh_obj.data)
bm.free()
mesh_obj.data.update()

# Export clean body standalone
bpy.ops.export_scene.gltf(filepath=str(CLEAN_BODY_GLB), export_format='GLB')
print(f"✅ Clean body saved to {CLEAN_BODY_GLB}")

# ---------------------------------------------------------------------------
# STEP 2: Model 8-Spoked Celestial Navigation Wheel & Staff Prop
# ---------------------------------------------------------------------------
print("Step 2: Modeling 8-spoked celestial navigation wheel & staff prop...")
mat_brass = bpy.data.materials.new(name='Astrolabe_Brass')
mat_brass.use_nodes = True
b_node = mat_brass.node_tree.nodes.get('Principled BSDF')
b_node.inputs['Base Color'].default_value = (0.95, 0.78, 0.25, 1.0)
b_node.inputs['Metallic'].default_value = 0.92
b_node.inputs['Roughness'].default_value = 0.20

mat_core = bpy.data.materials.new(name='Celestial_Core')
mat_core.use_nodes = True
c_node = mat_core.node_tree.nodes.get('Principled BSDF')
c_node.inputs['Base Color'].default_value = (0.10, 0.35, 0.85, 1.0)
c_node.inputs['Metallic'].default_value = 0.70
c_node.inputs['Roughness'].default_value = 0.15
if 'Emission Color' in c_node.inputs:
    c_node.inputs['Emission Color'].default_value = (0.15, 0.45, 0.95, 1.0)
    c_node.inputs['Emission Strength'].default_value = 2.0
elif 'Emission' in c_node.inputs:
    c_node.inputs['Emission'].default_value = (0.15, 0.45, 0.95, 1.0)

ast_parts = []

CX, CY, CZ = 0.19, -0.045, 0.62

# 2.1 Outer Wheel Rim (bezel facing front, Y normal)
bpy.ops.mesh.primitive_torus_add(major_radius=0.052, minor_radius=0.0055, major_segments=48, minor_segments=16, location=(CX, CY, CZ), rotation=(math.radians(90), 0, 0))
rim = bpy.context.active_object
rim.data.materials.append(mat_brass)
bpy.ops.object.transform_apply(location=True, rotation=True)
ast_parts.append(rim)

# 2.2 Central Hub (raised boss)
bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.014, vertices=24, location=(CX, CY, CZ), rotation=(math.radians(90), 0, 0))
hub = bpy.context.active_object
hub.data.materials.append(mat_brass)
bpy.ops.object.transform_apply(location=True, rotation=True)
ast_parts.append(hub)

# Central glowing sapphire jewel
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.008, location=(CX, CY - 0.006, CZ))
jewel = bpy.context.active_object
jewel.data.materials.append(mat_core)
bpy.ops.object.transform_apply(location=True)
ast_parts.append(jewel)

# 2.3 8 Radial Spokes spaced evenly at 45-degree intervals
r_hub = 0.014
r_rim = 0.048
spoke_len = r_rim - r_hub
r_mid = (r_hub + r_rim) / 2.0

for i in range(8):
    angle = math.radians(i * 45)
    sx = CX + r_mid * math.sin(angle)
    sz = CZ + r_mid * math.cos(angle)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0035, depth=spoke_len, vertices=12, location=(sx, CY, sz), rotation=(0, -angle, 0))
    spoke = bpy.context.active_object
    spoke.data.materials.append(mat_brass)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    ast_parts.append(spoke)

# 2.4 Top Finial (suspension loop at 12 o'clock)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.006, location=(CX, CY, CZ + 0.056))
p = bpy.context.active_object
p.data.materials.append(mat_brass)
bpy.ops.object.transform_apply(location=True)
ast_parts.append(p)

bpy.ops.mesh.primitive_torus_add(major_radius=0.013, minor_radius=0.0028, location=(CX, CY, CZ + 0.069), rotation=(math.radians(90), 0, 0))
lp = bpy.context.active_object
lp.data.materials.append(mat_brass)
bpy.ops.object.transform_apply(location=True, rotation=True)
ast_parts.append(lp)

# 2.5 Tapered Socket Collar at 6 o'clock
bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.016, vertices=20, location=(CX, CY, CZ - 0.058))
col = bpy.context.active_object
col.data.materials.append(mat_brass)
bpy.ops.object.transform_apply(location=True)
ast_parts.append(col)

# 2.6 Ceremonial Staff Shaft (solid brass rod running straight to plinth)
shaft_depth = 0.415
shaft_z = (CZ - 0.065 + 0.135) / 2.0
bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=shaft_depth, vertices=24, location=(CX, CY, shaft_z))
shaft = bpy.context.active_object
shaft.data.materials.append(mat_brass)
bpy.ops.object.transform_apply(location=True)
ast_parts.append(shaft)

# 2.7 Decorative Hand-Grip Rings
bpy.ops.mesh.primitive_torus_add(major_radius=0.019, minor_radius=0.0030, location=(CX, CY, 0.445))
g1 = bpy.context.active_object
g1.data.materials.append(mat_brass)
bpy.ops.object.transform_apply(location=True)
ast_parts.append(g1)

bpy.ops.mesh.primitive_torus_add(major_radius=0.019, minor_radius=0.0030, location=(CX, CY, 0.385))
g2 = bpy.context.active_object
g2.data.materials.append(mat_brass)
bpy.ops.object.transform_apply(location=True)
ast_parts.append(g2)

# 2.8 Base Ferrule Pommel (rests securely on wooden plinth at Z=0.135)
bpy.ops.mesh.primitive_cylinder_add(radius=0.019, depth=0.018, vertices=20, location=(CX, CY, 0.143))
ferrule = bpy.context.active_object
ferrule.data.materials.append(mat_brass)
bpy.ops.object.transform_apply(location=True)
ast_parts.append(ferrule)

# Join all wheel and staff parts into a single clean mesh
bpy.ops.object.select_all(action='DESELECT')
for pt in ast_parts:
    pt.select_set(True)
bpy.context.view_layer.objects.active = rim
bpy.ops.object.join()
astrolabe = bpy.context.active_object
astrolabe.name = 'Astrolabe_Staff'
bpy.ops.object.shade_smooth()

# Export clean astrolabe standalone
bpy.ops.object.select_all(action='DESELECT')
astrolabe.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(CLEAN_ASTROLABE_GLB), export_format='GLB', use_selection=True)
print(f"✅ Clean astrolabe saved to {CLEAN_ASTROLABE_GLB}")

# ---------------------------------------------------------------------------
# STEP 3: Mount Clean Dragon Companion on Shoulder
# ---------------------------------------------------------------------------
drg = None
if DRAGON_GLB.exists():
    print(f"Step 3: Loading Dragon Companion from {DRAGON_GLB}...")
    bpy.ops.import_scene.gltf(filepath=str(DRAGON_GLB))
    drg_candidates = [o for o in bpy.data.objects if o.type == 'MESH' and o not in [mesh_obj, astrolabe]]
    if drg_candidates:
        drg = drg_candidates[0]
        drg.name = 'Dragon_Companion'
        if drg.parent:
            bpy.ops.object.select_all(action='DESELECT')
            drg.select_set(True)
            bpy.context.view_layer.objects.active = drg
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        
        # Position cleanly on right shoulder pad with clear negative space
        drg.scale = (0.50, 0.50, 0.50)
        drg.location = (-0.20, -0.01, 0.77)
        drg.rotation_euler = (math.radians(8), math.radians(2), math.radians(15))
        
        bpy.ops.object.select_all(action='DESELECT')
        drg.select_set(True)
        bpy.context.view_layer.objects.active = drg
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        
        if drg.data.materials:
            dm = drg.data.materials[0]
            if dm.use_nodes:
                for n in dm.node_tree.nodes:
                    if n.type == 'VERTEX_COLOR':
                        n.layer_name = 'Col'
        print("✅ Dragon perched cleanly on shoulder pad.")

# Delete any non-mesh objects (empties, armatures, etc.)
for o in list(bpy.data.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)

# Ensure transforms are fully applied on all meshes
for o in [mesh_obj, astrolabe] + ([drg] if drg else []):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---------------------------------------------------------------------------
# STEP 4: Export Canonical Remastered Model
# ---------------------------------------------------------------------------
print(f"Step 4: Exporting remastered model to {TARGET_GLB}...")
TARGET_GLB.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(TARGET_GLB),
    export_format='GLB',
)
print(f"✨ Successfully exported {TARGET_GLB}!")
