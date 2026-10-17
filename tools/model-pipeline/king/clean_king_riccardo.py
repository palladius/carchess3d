# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Clean up King Riccardo geometry:
- Refine ermine cloak drape and royal blue robe with selective surface smoothing
- Inset collar crease at nape/shoulders for natural volume and shadow separation
- Sharpen the cross finials on the golden imperial orb and ceremonial scepter
- Weld UV-split vertices and eliminate stray floating crumbs (< 50 faces)
- Floor-ground model so minimum Z is exactly 0.0 (Y=0 in glTF 2.0)
- Export assets/models/king-riccardo-remastered.glb
"""
import math
import sys
from pathlib import Path
import bpy
import bmesh

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
SOURCE_GLB = ROOT / "assets/models/king-riccardo.glb"
TARGET_GLB = ROOT / "assets/models/king-riccardo-remastered.glb"

print("=" * 60)
print("🏰 Polish & Remaster: King Riccardo (Pillar 3)")
print("=" * 60)
print(f"Loading base model: {SOURCE_GLB}")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))

mesh_obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
mesh_obj.name = "King_Riccardo_Remastered"
mesh = mesh_obj.data

print(f"Base mesh: {len(mesh.vertices)} vertices, {len(mesh.polygons)} faces")

# ---------------------------------------------------------------------------
# STEP 1: Topology Cleanup & Stray Island Removal
# ---------------------------------------------------------------------------
print("Step 1: Welding coincident split seam vertices and pruning stray crumbs...")
bm = bmesh.new()
bm.from_mesh(mesh)

# 1.1 Weld duplicate coincident vertices from glTF UV splits
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0012)
bm.verts.ensure_lookup_table()
bm.edges.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# 1.2 Identify connected components and remove stray floating crumbs (< 50 faces)
visited_faces = set()
components = []
for f in bm.faces:
    if f not in visited_faces:
        comp = []
        queue = [f]
        visited_faces.add(f)
        while queue:
            curr = queue.pop()
            comp.append(curr)
            for edge in curr.edges:
                for linked_face in edge.link_faces:
                    if linked_face not in visited_faces:
                        visited_faces.add(linked_face)
                        queue.append(linked_face)
        components.append(comp)

components.sort(key=lambda c: len(c), reverse=True)
print(f"Connected face components found: {len(components)}")

stray_faces = [f for c in components if len(c) < 50 for f in c]
if stray_faces:
    print(f"Pruning {len(stray_faces)} stray floating faces across {sum(1 for c in components if len(c) < 50)} tiny crumbs...")
    bmesh.ops.delete(bm, geom=stray_faces, context='FACES')
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    bm.edges.ensure_lookup_table()

# ---------------------------------------------------------------------------
# STEP 2: Sculptural Refinement (Cloak Drape & Cross Finials)
# ---------------------------------------------------------------------------
print("Step 2: Refining ermine cloak drape and sharpening cross finials...")

# Coordinate reference centers:
x_scep, y_scep = -0.105, -0.104
x_orb, y_orb = 0.091, -0.094

for v in bm.verts:
    x, y, z = v.co

    # 2.1 Ermine collar undercut (crease at nape and upper shoulders):
    if y > 0.04 and 0.14 <= z <= 0.18:
        factor = 1.0 - abs(z - 0.16) / 0.02
        v.co.y -= factor * 0.015

    # 2.2 Cascading royal blue velvet cape drape folds:
    elif y > 0.04 and -0.30 <= z < 0.14:
        drape_fold = math.cos(x * 40.0) * 0.005 * max(0.0, (-0.05 - z) / 0.25)
        v.co.y += drape_fold

    # 2.3 Sharpen scepter finial (bulb and spearhead/cross point):
    if (x - x_scep) ** 2 + (y - y_scep) ** 2 < 0.035 ** 2:
        if 0.03 <= z <= 0.16:
            if z > 0.09:
                tip_t = (z - 0.09) / 0.06
                v.co.x = x_scep + (x - x_scep) * (1.0 - tip_t * 0.30)
                v.co.y = y_scep + (y - y_scep) * (1.0 - tip_t * 0.30)
                v.co.z += tip_t * 0.009
            elif 0.03 <= z <= 0.06:
                # Straighten collar ring below finial bulb
                rad = math.hypot(x - x_scep, y - y_scep)
                if rad > 0.005:
                    scale = 0.012 / max(rad, 1e-4)
                    v.co.x = x_scep + (x - x_scep) * (0.8 + 0.2 * scale)
                    v.co.y = y_scep + (y - y_scep) * (0.8 + 0.2 * scale)

    # 2.4 Sharpen golden imperial orb Maltese cross finial:
    if (x - x_orb) ** 2 + (y - y_orb) ** 2 < 0.035 ** 2:
        if -0.03 <= z <= 0.065:
            # Horizontal crossbar: sharpen front/back faces
            if -0.015 <= z <= 0.025:
                dist_y = y - y_orb
                if abs(dist_y) > 0.003:
                    v.co.y = y_orb + math.copysign(0.006 + (abs(dist_y) - 0.003) * 0.5, dist_y)
            # Top vertical crest: sharpen to a defined peak
            if z > 0.025:
                top_t = (z - 0.025) / 0.035
                v.co.z += top_t * 0.008
                v.co.x = x_orb + (x - x_orb) * (1.0 - top_t * 0.22)

bm.to_mesh(mesh)
bm.free()
mesh.update()

# ---------------------------------------------------------------------------
# STEP 3: Selective Surface Smoothing
# ---------------------------------------------------------------------------
print("Step 3: Applying selective surface smoothing (cloak, collar, and robe)...")
vg = mesh_obj.vertex_groups.new(name="Smooth_Cloak_Robe")

for v in mesh.vertices:
    x, y, z = v.co

    # Exclude scepter and finial (preserve crisp rod, ring, and sharp spearhead point)
    if (x - x_scep) ** 2 + (y - y_scep) ** 2 < 0.040 ** 2 and -0.32 <= z <= 0.20:
        w = 0.0
    # Exclude orb and cross (preserve spherical profile and sharp cross edges)
    elif (x - x_orb) ** 2 + (y - y_orb) ** 2 < 0.040 ** 2 and -0.22 <= z <= 0.15:
        w = 0.0
    # Exclude biometric face graft (preserve eyes, stubble, smile, and nose bridge)
    elif abs(x) < 0.08 and y < -0.04 and -0.02 <= z <= 0.25:
        w = 0.0
    # Exclude crown (preserve crisp arches, filigree, and royal crown cross)
    elif z > 0.26:
        w = 0.0
    # Exclude pedestal (preserve sharp lathe rings and KING RICCARDO lettering)
    elif z < -0.32:
        w = 0.0
    # Smooth transition towards pedestal
    elif z < -0.28:
        w = (z - (-0.32)) / 0.04
    # Cloak drape, ermine collar, and royal tunic
    else:
        w = 1.0

    vg.add([v.index], w, 'REPLACE')

mod = mesh_obj.modifiers.new(name="SurfaceSmooth", type='SMOOTH')
mod.factor = 0.45
mod.iterations = 4
mod.vertex_group = "Smooth_Cloak_Robe"

bpy.ops.object.select_all(action='DESELECT')
mesh_obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_obj
bpy.ops.object.modifier_apply(modifier="SurfaceSmooth")

# ---------------------------------------------------------------------------
# STEP 4: Floor Grounding at Z = 0
# ---------------------------------------------------------------------------
min_z = min(v.co[2] for v in mesh.vertices)
print(f"Step 4: Grounding model: translating by {-min_z:+.4f} so min Z is exactly 0.0...")
for v in mesh.vertices:
    v.co[2] -= min_z
mesh.update()

grounded_min_z = min(v.co[2] for v in mesh.vertices)
grounded_max_z = max(v.co[2] for v in mesh.vertices)
print(f"Grounding verified: Z min = {grounded_min_z:.6f}, Z max = {grounded_max_z:.6f} (height = {grounded_max_z - grounded_min_z:.4f}m)")

# ---------------------------------------------------------------------------
# STEP 5: Export Canonical Remastered GLB
# ---------------------------------------------------------------------------
TARGET_GLB.parent.mkdir(parents=True, exist_ok=True)
print(f"Step 5: Exporting remastered King Riccardo to {TARGET_GLB}...")
bpy.ops.export_scene.gltf(filepath=str(TARGET_GLB), export_format='GLB')
print("✅ Remastered export complete!")
