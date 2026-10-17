# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Modular Assembly Pipeline for Knight Sebastian Weapons (Pillar 2).

Loads canonical base model assets/models/knight-seby.glb, detects his raised left fist,
ensures strict floor-grounding at Z=0, and builds three modular weapon variants:
1. Alabarda Reale (assets/models/knight-seby-halberd.glb)
2. Spada Laser / Beam Saber (assets/models/knight-seby-lightsaber.glb)
3. Sigillo dell'Acquario (assets/models/knight-seby-aurora.glb)

Follows IP safety (Be Googley), niccolo-game-design modular standards, and exports
valid glTF 2.0 binaries ready for in-game use and automated critic reviews.
"""
import argparse
import math
import subprocess
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
OUT = HERE / "out"
CRITIC_OUT = ROOT / "tools/model-pipeline/critic/out"
OUT.mkdir(parents=True, exist_ok=True)
CRITIC_OUT.mkdir(parents=True, exist_ok=True)

SOURCE_GLB = ROOT / "assets/models/knight-seby.glb"
TARGET_HALBERD = ROOT / "assets/models/knight-seby-halberd.glb"
TARGET_LIGHTSABER = ROOT / "assets/models/knight-seby-lightsaber.glb"
TARGET_AURORA = ROOT / "assets/models/knight-seby-aurora.glb"

RENDER_SCRIPT = ROOT / "tools/model-pipeline/critic/render_contact_sheet.py"

print("=" * 60)
print("⚔️ Knight Sebastian: Modular Weapons Assembly Pipeline")
print("=" * 60)

# ---------------------------------------------------------------------------
# Material Library
# ---------------------------------------------------------------------------
def create_materials():
    mats = {}

    # Royal Gold (burnished 24k ceremonial gold)
    m = bpy.data.materials.new("Royal_Gold")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.95, 0.78, 0.22, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.95
    bsdf.inputs["Roughness"].default_value = 0.20
    mats["gold"] = m

    # Royal Steel (gleaming battle-hardened chrome/steel)
    m = bpy.data.materials.new("Royal_Steel")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.88, 0.90, 0.94, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.98
    bsdf.inputs["Roughness"].default_value = 0.12
    mats["steel"] = m

    # Dark Wood (polished mahogany/walnut polearm shaft)
    m = bpy.data.materials.new("Dark_Wood")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.24, 0.12, 0.06, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.05
    bsdf.inputs["Roughness"].default_value = 0.35
    mats["wood"] = m

    # Sapphire Gem (deep royal blue glowing crystal)
    m = bpy.data.materials.new("Sapphire_Gem")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.08, 0.32, 0.90, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.80
    bsdf.inputs["Roughness"].default_value = 0.15
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (0.12, 0.40, 0.95, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 2.5
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (0.12, 0.40, 0.95, 1.0)
    mats["sapphire"] = m

    # Royal Blue Silk (flowing pennant ribbon)
    m = bpy.data.materials.new("Royal_Blue_Silk")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.08, 0.25, 0.85, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.15
    bsdf.inputs["Roughness"].default_value = 0.45
    mats["silk"] = m

    # Saber Black Grip (knurled rubberized ribs)
    m = bpy.data.materials.new("Saber_Black_Grip")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.08, 0.08, 0.09, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.20
    bsdf.inputs["Roughness"].default_value = 0.65
    mats["black_grip"] = m

    # Cyan Plasma Outer Beam
    m = bpy.data.materials.new("Plasma_Blade_Cyan")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.10, 0.72, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.10
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (0.15, 0.80, 1.0, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 6.0
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (0.15, 0.80, 1.0, 1.0)
    mats["plasma_cyan"] = m

    # White-Hot Plasma Core
    m = bpy.data.materials.new("Plasma_Blade_Core")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.95, 0.98, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.05
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (0.95, 0.98, 1.0, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 12.0
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (0.95, 0.98, 1.0, 1.0)
    mats["plasma_core"] = m

    # Celestial Sapphire Enamel
    m = bpy.data.materials.new("Sapphire_Enamel")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.06, 0.22, 0.80, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.85
    bsdf.inputs["Roughness"].default_value = 0.16
    mats["enamel"] = m

    # Diamond Ice Aurora (crystalline freezing starlight)
    m = bpy.data.materials.new("Diamond_Ice_Aurora")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.45, 0.90, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.15
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (0.35, 0.88, 1.0, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 4.5
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (0.35, 0.88, 1.0, 1.0)
    mats["ice_aurora"] = m

    # Star Crystal
    m = bpy.data.materials.new("Star_Crystal")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.85, 0.95, 1.0, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.50
    bsdf.inputs["Roughness"].default_value = 0.10
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (0.75, 0.92, 1.0, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 3.5
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (0.75, 0.92, 1.0, 1.0)
    mats["star_crystal"] = m

    return mats


# ---------------------------------------------------------------------------
# Base Model Loader & Grounder
# ---------------------------------------------------------------------------
def load_and_ground_base():
    """Loads knight-seby.glb, clears empty hierarchy, and grounds strictly at Z=0."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))

    mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
    if not mesh_objs:
        raise RuntimeError(f"No mesh found in {SOURCE_GLB}")
    mesh_obj = mesh_objs[0]
    mesh_obj.name = "Knight_Seby_Base"

    # Detach from world empty if parented
    if mesh_obj.parent:
        bpy.ops.object.select_all(action='DESELECT')
        mesh_obj.select_set(True)
        bpy.context.view_layer.objects.active = mesh_obj
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

    # Remove any non-mesh objects
    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)

    # Apply all transforms first
    bpy.ops.object.select_all(action='DESELECT')
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Floor-grounding: translate Z so min(Z) is exactly 0.0
    bm = bmesh.new()
    bm.from_mesh(mesh_obj.data)
    min_z = min(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z -= min_z
    bm.to_mesh(mesh_obj.data)
    bm.free()
    mesh_obj.data.update()

    # Detect exact clenched fist anchor:
    verts = np.array([v.co for v in mesh_obj.data.vertices])
    fist_idx = np.where(
        (verts[:, 0] > 0.17) &
        (verts[:, 2] > 0.65) &
        (verts[:, 2] < 0.82)
    )[0]
    if len(fist_idx) > 0:
        fist_center = verts[fist_idx].mean(axis=0)
    else:
        fist_center = np.array([0.200, -0.029, 0.750])

    print(f"✅ Base loaded & grounded at Z=0.0 (height={verts[:,2].max():.3f}m)")
    print(f"✊ Raised left fist anchor: ({fist_center[0]:.3f}, {fist_center[1]:.3f}, {fist_center[2]:.3f})")
    return mesh_obj, Vector(fist_center)


# ---------------------------------------------------------------------------
# Weapon 1: Alabarda Reale (Royal Halberd)
# ---------------------------------------------------------------------------
def build_halberd(fist_anchor, mats):
    """Constructs the majestic ceremonial polearm anchored to left fist and pedestal."""
    parts = []
    fx, fy, fz = fist_anchor.x, fist_anchor.y, fist_anchor.z

    # 1. Main Shaft (polished dark wood polearm rod from pedestal at Z=0.14 to head socket at Z=1.05)
    shaft_bottom_z = 0.140
    shaft_top_z = 1.050
    shaft_len = shaft_top_z - shaft_bottom_z
    shaft_mid_z = (shaft_bottom_z + shaft_top_z) / 2.0
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.009, depth=shaft_len, vertices=24,
        location=(fx, fy, shaft_mid_z)
    )
    shaft = bpy.context.active_object
    shaft.data.materials.append(mats["wood"])
    bpy.ops.object.transform_apply(location=True)
    parts.append(shaft)

    # 2. Base Ferrule Pommel (golden conical foot resting on pedestal at Z=0.14)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.015, radius2=0.005, depth=0.030, vertices=20,
        location=(fx, fy, shaft_bottom_z + 0.015),
        rotation=(0, math.radians(180), 0)
    )
    ferrule = bpy.context.active_object
    ferrule.data.materials.append(mats["gold"])
    bpy.ops.object.transform_apply(location=True, rotation=True)
    parts.append(ferrule)

    # 3. Decorative Gold Spiral Wrap Rings along shaft
    for ring_z in [0.35, 0.55, fz - 0.035, fz + 0.035, 0.90]:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.0125, minor_radius=0.003, major_segments=24, minor_segments=12,
            location=(fx, fy, ring_z)
        )
        r_obj = bpy.context.active_object
        r_obj.data.materials.append(mats["gold"])
        bpy.ops.object.transform_apply(location=True)
        parts.append(r_obj)

    # 4. Halberd Head Socket & Collar (Z = 1.03 .. 1.07)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.016, depth=0.040, vertices=24,
        location=(fx, fy, 1.050)
    )
    socket = bpy.context.active_object
    socket.data.materials.append(mats["gold"])
    bpy.ops.object.transform_apply(location=True)
    parts.append(socket)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.018, minor_radius=0.004, major_segments=24, minor_segments=12,
        location=(fx, fy, 1.070)
    )
    socket_ring = bpy.context.active_object
    socket_ring.data.materials.append(mats["gold"])
    bpy.ops.object.transform_apply(location=True)
    parts.append(socket_ring)

    # 5. Central Spear Spike (Lance Tip: Z = 1.07 .. 1.34, sharp 4-faceted diamond)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.015, radius2=0.001, depth=0.270, vertices=4,
        location=(fx, fy, 1.205),
        rotation=(0, 0, math.radians(45))
    )
    spike = bpy.context.active_object
    spike.data.materials.append(mats["steel"])
    bpy.ops.object.transform_apply(location=True, rotation=True)
    parts.append(spike)

    # Spike center ridge filigree
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.008, radius2=0.001, depth=0.180, vertices=4,
        location=(fx, fy, 1.160),
        rotation=(0, 0, 0)
    )
    spike_inner = bpy.context.active_object
    spike_inner.data.materials.append(mats["gold"])
    bpy.ops.object.transform_apply(location=True)
    parts.append(spike_inner)

    # 6. Crescent Battle Axe Blade (+X / rightward outer side)
    axe_mesh = bpy.data.meshes.new("Axe_Blade_Mesh")
    bm = bmesh.new()

    n_pts = 16
    v_front = []
    v_back = []
    y_thick = 0.004

    for i in range(n_pts + 1):
        t = i / n_pts
        angle = math.radians(-55 + t * 110)
        ox = fx + 0.020 + 0.078 * math.cos(angle)
        oz = 1.150 + 0.082 * math.sin(angle)
        ix = fx + 0.014 + 0.022 * math.cos(angle * 0.7)
        iz = 1.150 + 0.045 * math.sin(angle * 0.7)

        vf1 = bm.verts.new((ix, fy - y_thick, iz))
        vf2 = bm.verts.new((ox, fy - y_thick * 0.4, oz))
        vb1 = bm.verts.new((ix, fy + y_thick, iz))
        vb2 = bm.verts.new((ox, fy + y_thick * 0.4, oz))

        v_front.append((vf1, vf2))
        v_back.append((vb1, vb2))

    for i in range(n_pts):
        f1_curr, f2_curr = v_front[i]
        f1_next, f2_next = v_front[i + 1]
        b1_curr, b2_curr = v_back[i]
        b1_next, b2_next = v_back[i + 1]

        bm.faces.new([f1_curr, f2_curr, f2_next, f1_next])
        bm.faces.new([b1_next, b2_next, b2_curr, b1_curr])
        bm.faces.new([f2_curr, b2_curr, b2_next, f2_next])
        bm.faces.new([f1_next, b1_next, b1_curr, f1_curr])

    # Cap top & bottom horns cleanly
    bm.faces.new([v_front[0][0], v_back[0][0], v_back[0][1], v_front[0][1]])
    bm.faces.new([v_front[-1][1], v_back[-1][1], v_back[-1][0], v_front[-1][0]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(axe_mesh)
    bm.free()

    axe_obj = bpy.data.objects.new("Halberd_Axe_Blade", axe_mesh)
    bpy.context.collection.objects.link(axe_obj)
    axe_obj.data.materials.append(mats["gold"])
    parts.append(axe_obj)

    # Gleaming steel sharp edge trim on axe
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.0035, depth=0.080, vertices=16,
        location=(fx + 0.082, fy, 1.150),
        rotation=(0, math.radians(12), 0)
    )
    axe_edge = bpy.context.active_object
    axe_edge.data.materials.append(mats["steel"])
    bpy.ops.object.transform_apply(location=True, rotation=True)
    parts.append(axe_edge)

    # 7. Reverse Armor-Piercing War Hook (-X / leftward inner side)
    hook_mesh = bpy.data.meshes.new("War_Hook_Mesh")
    bm_h = bmesh.new()
    h_pts = 10
    v_hf = []
    v_hb = []
    hy_thick = 0.0035
    for i in range(h_pts + 1):
        t = i / h_pts
        hx = fx - 0.014 - 0.046 * t
        hz = 1.140 - 0.038 * (t ** 1.6)
        w = 0.012 * (1.0 - t * 0.85)

        vf1 = bm_h.verts.new((hx, fy - hy_thick, hz + w * 0.5))
        vf2 = bm_h.verts.new((hx, fy - hy_thick, hz - w * 0.5))
        vb1 = bm_h.verts.new((hx, fy + hy_thick, hz + w * 0.5))
        vb2 = bm_h.verts.new((hx, fy + hy_thick, hz - w * 0.5))
        v_hf.append((vf1, vf2))
        v_hb.append((vb1, vb2))

    for i in range(h_pts):
        bm_h.faces.new([v_hf[i][0], v_hf[i][1], v_hf[i+1][1], v_hf[i+1][0]])
        bm_h.faces.new([v_hb[i+1][0], v_hb[i+1][1], v_hb[i][1], v_hb[i][0]])
        bm_h.faces.new([v_hf[i][0], v_hf[i+1][0], v_hb[i+1][0], v_hb[i][0]])
        bm_h.faces.new([v_hf[i+1][1], v_hf[i][1], v_hb[i][1], v_hb[i+1][1]])

    # Watertight caps on hook base (t=0) and hook tip (t=1)
    bm_h.faces.new([v_hf[0][0], v_hb[0][0], v_hb[0][1], v_hf[0][1]])
    bm_h.faces.new([v_hf[-1][0], v_hf[-1][1], v_hb[-1][1], v_hb[-1][0]])

    bmesh.ops.recalc_face_normals(bm_h, faces=bm_h.faces)
    bm_h.to_mesh(hook_mesh)
    bm_h.free()

    hook_obj = bpy.data.objects.new("Halberd_War_Hook", hook_mesh)
    bpy.context.collection.objects.link(hook_obj)
    hook_obj.data.materials.append(mats["steel"])
    parts.append(hook_obj)

    # 8. Royal Sapphire Medallion Inlays (Front & Back)
    for sign in [-1, 1]:
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.0075, segments=16, ring_count=12,
            location=(fx + 0.002, fy + sign * 0.017, 1.140),
            scale=(1.0, 0.45, 1.35)
        )
        gem = bpy.context.active_object
        gem.data.materials.append(mats["sapphire"])
        bpy.ops.object.transform_apply(location=True, scale=True)
        parts.append(gem)

        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.0085, minor_radius=0.002,
            location=(fx + 0.002, fy + sign * 0.016, 1.140),
            rotation=(math.radians(90), 0, 0)
        )
        bezel = bpy.context.active_object
        bezel.data.materials.append(mats["gold"])
        bpy.ops.object.transform_apply(location=True, rotation=True)
        parts.append(bezel)

    # 9. Royal Blue Silk Ribbon (fluttering pennant below socket)
    ribbon_mesh = bpy.data.meshes.new("Silk_Ribbon_Mesh")
    bm_r = bmesh.new()
    r_steps = 14
    rib_verts = []
    for i in range(r_steps + 1):
        t = i / r_steps
        rz = 1.030 - 0.160 * t
        rx = fx + 0.014 + 0.028 * math.sin(t * math.pi * 1.5) + t * 0.015
        ry = fy - 0.010 + 0.018 * math.cos(t * math.pi * 1.8)
        w = 0.010 * (1.0 - t * 0.45)

        v1 = bm_r.verts.new((rx, ry - w, rz))
        v2 = bm_r.verts.new((rx, ry + w, rz))
        v3 = bm_r.verts.new((rx + 0.0025, ry + w, rz + 0.0025))
        v4 = bm_r.verts.new((rx + 0.0025, ry - w, rz + 0.0025))
        rib_verts.append((v1, v2, v3, v4))

        if i > 0:
            v1_p, v2_p, v3_p, v4_p = rib_verts[i - 1]
            bm_r.faces.new([v1_p, v2_p, v2, v1])
            bm_r.faces.new([v3_p, v4_p, v4, v3])
            bm_r.faces.new([v1_p, v1, v4, v4_p])
            bm_r.faces.new([v2, v2_p, v3_p, v3])

    # Watertight caps on ribbon top and bottom ends
    bm_r.faces.new([rib_verts[0][0], rib_verts[0][3], rib_verts[0][2], rib_verts[0][1]])
    bm_r.faces.new([rib_verts[-1][0], rib_verts[-1][1], rib_verts[-1][2], rib_verts[-1][3]])

    bmesh.ops.recalc_face_normals(bm_r, faces=bm_r.faces)
    bm_r.to_mesh(ribbon_mesh)
    bm_r.free()

    ribbon_obj = bpy.data.objects.new("Halberd_Silk_Ribbon", ribbon_mesh)
    bpy.context.collection.objects.link(ribbon_obj)
    ribbon_obj.data.materials.append(mats["silk"])
    parts.append(ribbon_obj)

    # Join all halberd parts into single clean weapon mesh
    bpy.ops.object.select_all(action='DESELECT')
    for pt in parts:
        pt.select_set(True)
    bpy.context.view_layer.objects.active = shaft
    bpy.ops.object.join()
    halberd_mesh = bpy.context.active_object
    halberd_mesh.name = "Alabarda_Reale"
    bpy.ops.object.shade_smooth()

    return halberd_mesh


# ---------------------------------------------------------------------------
# Weapon 2: Spada Laser / Beam Saber
# ---------------------------------------------------------------------------
def build_lightsaber(fist_anchor, mats):
    """Constructs the radiant blue energy beam saber anchored to left fist."""
    parts = []
    fx, fy, fz = fist_anchor.x, fist_anchor.y, fist_anchor.z

    # Dynamic heroic angle: tilted outward (+X) and slightly forward (-Y)
    rot_x = math.radians(-6)
    rot_y = math.radians(12)
    rot_mat = Euler((rot_x, rot_y, 0), 'XYZ').to_matrix().to_4x4()
    trans_mat = Matrix.Translation(Vector((fx, fy, fz)))
    world_mat = trans_mat @ rot_mat

    def add_local(obj):
        obj.matrix_world = world_mat @ obj.matrix_world
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        parts.append(obj)
        return obj

    # 1. Base Pommel Cap (local z = -0.075)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.015, depth=0.016, vertices=24,
        location=(0, 0, -0.075)
    )
    pommel = add_local(bpy.context.active_object)
    pommel.data.materials.append(mats["steel"])

    # Pommel D-Ring Loop
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.008, minor_radius=0.0025,
        location=(0, 0, -0.088),
        rotation=(math.radians(90), 0, 0)
    )
    dring = add_local(bpy.context.active_object)
    dring.data.materials.append(mats["steel"])

    # 2. Lower Grip Section with 5 Black Flute Rings (local z = -0.065 .. -0.010)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.013, depth=0.055, vertices=24,
        location=(0, 0, -0.038)
    )
    lower_grip = add_local(bpy.context.active_object)
    lower_grip.data.materials.append(mats["steel"])

    for gz in [-0.060, -0.048, -0.036, -0.024, -0.012]:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.0142, minor_radius=0.0022,
            location=(0, 0, gz)
        )
        grip_ring = add_local(bpy.context.active_object)
        grip_ring.data.materials.append(mats["black_grip"])

    # 3. Activation Clamp Matrix (local z = -0.010 .. 0.025)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.014, depth=0.030, vertices=24,
        location=(0, 0, 0.008)
    )
    clamp = add_local(bpy.context.active_object)
    clamp.data.materials.append(mats["steel"])

    # Golden switch box
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0.014, 0, 0.008),
        scale=(0.006, 0.012, 0.022)
    )
    switch_box = add_local(bpy.context.active_object)
    switch_box.data.materials.append(mats["gold"])

    # 4. Upper Hilt & Emitter Collar (local z = 0.025 .. 0.070)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.013, depth=0.040, vertices=24,
        location=(0, 0, 0.045)
    )
    upper_hilt = add_local(bpy.context.active_object)
    upper_hilt.data.materials.append(mats["steel"])

    # Angled Emitter Shroud (local z = 0.065 .. 0.085)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.016, depth=0.020, vertices=24,
        location=(0, 0, 0.075)
    )
    emitter = add_local(bpy.context.active_object)
    emitter.data.materials.append(mats["steel"])

    for angle_deg in [0, 180]:
        rad = math.radians(angle_deg)
        bpy.ops.mesh.primitive_cube_add(
            size=1.0,
            location=(math.cos(rad) * 0.015, math.sin(rad) * 0.015, 0.088),
            scale=(0.004, 0.004, 0.014)
        )
        prong = add_local(bpy.context.active_object)
        prong.data.materials.append(mats["black_grip"])

    # 5. Glowing Plasma Aperture Lens (local z = 0.085)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.012, depth=0.006, vertices=24,
        location=(0, 0, 0.086)
    )
    lens = add_local(bpy.context.active_object)
    lens.data.materials.append(mats["plasma_cyan"])

    # 6. Radiant Cyan Energy Beam Blade (local z = 0.088 .. 0.550, length = 0.462m)
    blade_len = 0.450
    blade_mid_z = 0.088 + blade_len / 2.0
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.011, depth=blade_len, vertices=24,
        location=(0, 0, blade_mid_z)
    )
    blade = add_local(bpy.context.active_object)
    blade.data.materials.append(mats["plasma_cyan"])

    # Rounded beam tip
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.011, segments=20, ring_count=12,
        location=(0, 0, 0.088 + blade_len)
    )
    blade_tip = add_local(bpy.context.active_object)
    blade_tip.data.materials.append(mats["plasma_cyan"])

    # 7. White-Hot Concentric Plasma Core (local z = 0.088 .. 0.540)
    core_len = blade_len - 0.010
    core_mid_z = 0.088 + core_len / 2.0
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.006, depth=core_len, vertices=20,
        location=(0, 0, core_mid_z)
    )
    core = add_local(bpy.context.active_object)
    core.data.materials.append(mats["plasma_core"])

    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.006, segments=16, ring_count=10,
        location=(0, 0, 0.088 + core_len)
    )
    core_tip = add_local(bpy.context.active_object)
    core_tip.data.materials.append(mats["plasma_core"])

    # Join all lightsaber parts into single clean weapon mesh
    bpy.ops.object.select_all(action='DESELECT')
    for pt in parts:
        pt.select_set(True)
    bpy.context.view_layer.objects.active = pommel
    bpy.ops.object.join()
    saber_mesh = bpy.context.active_object
    saber_mesh.name = "Spada_Laser"
    bpy.ops.object.shade_smooth()

    return saber_mesh


# ---------------------------------------------------------------------------
# Weapon 3: Sigillo dell'Acquario (Aquarius Celestial Urn & Aurora Cascade)
# ---------------------------------------------------------------------------
def build_aquarius_urn(fist_anchor, mats):
    """Constructs the celestial golden amphora & diamond aurora cascade stardust."""
    parts = []
    fx, fy, fz = fist_anchor.x, fist_anchor.y, fist_anchor.z

    # Dynamic outward and slightly forward pouring angle
    rot_x = math.radians(-6)
    rot_y = math.radians(8)
    rot_mat = Euler((rot_x, rot_y, 0), 'XYZ').to_matrix().to_4x4()
    trans_mat = Matrix.Translation(Vector((fx, fy, fz)))
    world_mat = trans_mat @ rot_mat

    def add_local(obj):
        obj.matrix_world = world_mat @ obj.matrix_world
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        parts.append(obj)
        return obj

    # 1. Base Pedestal Foot / Grip Plate (held securely in fist, local z = -0.020 .. 0.015)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.018, depth=0.035, vertices=24,
        location=(0, 0, -0.002)
    )
    foot = add_local(bpy.context.active_object)
    foot.data.materials.append(mats["gold"])

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.022, minor_radius=0.004,
        location=(0, 0, 0.015)
    )
    foot_rim = add_local(bpy.context.active_object)
    foot_rim.data.materials.append(mats["gold"])

    # 2. Lower Calyx Bell (local z = 0.015 .. 0.055)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.018, radius2=0.038, depth=0.040, vertices=24,
        location=(0, 0, 0.035)
    )
    calyx = add_local(bpy.context.active_object)
    calyx.data.materials.append(mats["gold"])

    # 3. Amphora Belly (Grecian urn main body: local z = 0.055 .. 0.170, max radius = 0.048)
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.046, segments=28, ring_count=18,
        location=(0, 0, 0.112),
        scale=(1.0, 1.0, 1.25)
    )
    belly = add_local(bpy.context.active_object)
    belly.data.materials.append(mats["gold"])

    # Central Constellation Band (Sapphire Enamel inlay around equator)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.0475, depth=0.026, vertices=28,
        location=(0, 0, 0.112)
    )
    enamel_band = add_local(bpy.context.active_object)
    enamel_band.data.materials.append(mats["enamel"])

    # 6 Gold Star Medallions studded around sapphire band
    for s in range(6):
        s_angle = math.radians(s * 60)
        sx = math.cos(s_angle) * 0.048
        sy = math.sin(s_angle) * 0.048
        bpy.ops.mesh.primitive_cone_add(
            radius1=0.005, radius2=0.001, depth=0.005, vertices=4,
            location=(sx, sy, 0.112),
            rotation=(0, math.radians(90), -s_angle)
        )
        star = add_local(bpy.context.active_object)
        star.data.materials.append(mats["gold"])

    # 4. Tapered Neck (local z = 0.165 .. 0.220)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.034, radius2=0.022, depth=0.055, vertices=24,
        location=(0, 0, 0.192)
    )
    neck = add_local(bpy.context.active_object)
    neck.data.materials.append(mats["gold"])

    # Neck collar ring
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.024, minor_radius=0.0035,
        location=(0, 0, 0.218)
    )
    neck_ring = add_local(bpy.context.active_object)
    neck_ring.data.materials.append(mats["gold"])

    # 5. Flared Scalloped Pouring Spout / Lip (local z = 0.220 .. 0.255)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.022, radius2=0.038, depth=0.035, vertices=24,
        location=(0, 0, 0.238)
    )
    spout = add_local(bpy.context.active_object)
    spout.data.materials.append(mats["gold"])

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.038, minor_radius=0.004,
        location=(0, 0, 0.255)
    )
    spout_lip = add_local(bpy.context.active_object)
    spout_lip.data.materials.append(mats["gold"])

    # 6. Twin Winged / Wave Handles (+X and -X sides arching from shoulder to neck)
    for sign in [-1, 1]:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.022, minor_radius=0.004, major_segments=24, minor_segments=12,
            location=(sign * 0.038, 0, 0.170),
            rotation=(0, math.radians(90), 0)
        )
        handle = add_local(bpy.context.active_object)
        handle.data.materials.append(mats["gold"])

    # 7. Effusion: Aurora Diamond Stardust Cascade (emerging from open mouth)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.028, radius2=0.006, depth=0.180, vertices=16,
        location=(0, 0, 0.345)
    )
    aurora_spire = add_local(bpy.context.active_object)
    aurora_spire.data.materials.append(mats["ice_aurora"])

    for i in range(4):
        angle = math.radians(i * 90 + 25)
        tx = math.cos(angle) * 0.016
        ty = math.sin(angle) * 0.016
        bpy.ops.mesh.primitive_cone_add(
            radius1=0.008, radius2=0.002, depth=0.140, vertices=8,
            location=(tx, ty, 0.330),
            rotation=(math.radians(12), math.radians(12), angle)
        )
        tendril = add_local(bpy.context.active_object)
        tendril.data.materials.append(mats["ice_aurora"])

    star_positions = [
        (0.014, 0.010, 0.285, 0.009),
        (-0.012, 0.014, 0.320, 0.008),
        (0.016, -0.012, 0.360, 0.011),
        (-0.010, -0.015, 0.395, 0.009),
        (0.008, 0.012, 0.430, 0.007),
        (0.000, 0.000, 0.450, 0.012),
    ]
    for sx, sy, sz, rad in star_positions:
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=rad, segments=8, ring_count=6,
            location=(sx, sy, sz),
            scale=(1.0, 1.0, 1.4)
        )
        c_obj = add_local(bpy.context.active_object)
        c_obj.data.materials.append(mats["star_crystal"])

    # Join all urn parts into single clean weapon mesh
    bpy.ops.object.select_all(action='DESELECT')
    for pt in parts:
        pt.select_set(True)
    bpy.context.view_layer.objects.active = foot
    bpy.ops.object.join()
    urn_mesh = bpy.context.active_object
    urn_mesh.name = "Sigillo_Acquario"
    bpy.ops.object.shade_smooth()

    return urn_mesh


# ---------------------------------------------------------------------------
# Assembly & Export Pipeline
# ---------------------------------------------------------------------------
def assemble_and_export(variant_name: str, target_path: Path):
    """Builds the complete modular Knight Sebastian with the specified weapon."""
    print(f"\n--- Assembling Variant: {variant_name} -> {target_path.name} ---")
    base_mesh, fist_anchor = load_and_ground_base()
    mats = create_materials()

    if variant_name == "halberd":
        weapon_mesh = build_halberd(fist_anchor, mats)
    elif variant_name == "lightsaber":
        weapon_mesh = build_lightsaber(fist_anchor, mats)
    elif variant_name == "aurora":
        weapon_mesh = build_aquarius_urn(fist_anchor, mats)
    else:
        raise ValueError(f"Unknown variant: {variant_name}")

    # Export standalone clean weapon to tools/model-pipeline/seby/out/
    standalone_path = OUT / f"weapon_{variant_name}.glb"
    bpy.ops.object.select_all(action='DESELECT')
    weapon_mesh.select_set(True)
    bpy.context.view_layer.objects.active = weapon_mesh
    bpy.ops.export_scene.gltf(
        filepath=str(standalone_path),
        export_format='GLB',
        use_selection=True
    )
    print(f"📦 Exported standalone weapon: {standalone_path.name}")

    # Ensure transforms are fully applied on both base and weapon
    for o in [base_mesh, weapon_mesh]:
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Double check strict floor grounding (Z >= 0.0)
    all_verts = np.concatenate([
        np.array([v.co for v in base_mesh.data.vertices]),
        np.array([v.co for v in weapon_mesh.data.vertices])
    ])
    overall_min_z = all_verts[:, 2].min()
    if abs(overall_min_z) > 1e-4:
        shift_z = overall_min_z
        for o in [base_mesh, weapon_mesh]:
            for v in o.data.vertices:
                v.co.z -= shift_z
            o.data.update()
        print(f"📐 Grounding adjusted by {-shift_z:.5f}m")

    # Export combined model
    target_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=str(target_path),
        export_format='GLB',
        use_selection=False
    )
    print(f"✨ Successfully exported {target_path} ({target_path.stat().st_size // 1024} KB)")


def render_sheet(glb_path: Path, sheet_path: Path):
    """Invokes render_contact_sheet.py for a GLB model."""
    print(f"📸 Rendering 4-view contact sheet for {glb_path.name} -> {sheet_path.name}...")
    cmd = [
        "blender", "-b", "--python", str(RENDER_SCRIPT), "--",
        "--glb", str(glb_path),
        "--out", str(sheet_path),
        "--res", "384"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"❌ Render failed:\n{res.stderr}")
    else:
        print(f"✅ Contact sheet saved: {sheet_path}")


def main():
    argv = sys.argv
    if "--" in argv:
        custom_args = argv[argv.index("--") + 1:]
    else:
        custom_args = []

    parser = argparse.ArgumentParser(description="Modular Sebastian Weapon Assembler")
    parser.add_argument(
        "--variant",
        choices=["halberd", "lightsaber", "aurora", "all"],
        default="all",
        help="Weapon variant to assemble (default: all)"
    )
    parser.add_argument(
        "--render",
        action="store_true",
        help="Automatically render 4-view contact sheet for each assembled variant"
    )
    args = parser.parse_args(custom_args)

    targets = {
        "halberd": TARGET_HALBERD,
        "lightsaber": TARGET_LIGHTSABER,
        "aurora": TARGET_AURORA,
    }

    selected = list(targets.keys()) if args.variant == "all" else [args.variant]
    for var in selected:
        target_glb = targets[var]
        assemble_and_export(var, target_glb)
        if args.render:
            critic_sheet = CRITIC_OUT / f"{target_glb.stem}_critic_sheet.png"
            render_sheet(target_glb, critic_sheet)
            local_sheet = OUT / f"{target_glb.stem}_sheet.png"
            if critic_sheet.exists():
                local_sheet.write_bytes(critic_sheet.read_bytes())

    print("\n" + "=" * 60)
    print("🎉 All requested Knight Sebastian weapon variants built successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
