#!/usr/bin/env python3
"""Conform a Hunyuan3D-2 PBR textured GLB to the CarChess3D Family Contract (_contract.json).

Ensures:
1. Mesh decimated to <= target_faces (default 58,000) preserving PBR texture & UV islands.
2. Exact grounding at min_y == 0.000m and exact total height max_y == height_m.
3. Sleek 0.74m diameter faction pedestal & trim ring at the base (span_x >= 0.70m, span_z >= 0.70m)
   carrying the required `faction_primary` and `faction_trim` material slots.
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path


BLENDER_CONFORM_PY = r"""
import bpy
import bmesh
import math
import sys
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
in_glb = argv[0]
out_glb = argv[1]
target_height = float(argv[2])
target_faces = int(argv[3])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=in_glb)

mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
if not mesh_objs:
    sys.exit(2)

# Apply transforms on all imported mesh objects
bpy.ops.object.select_all(action='DESELECT')
for o in mesh_objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = mesh_objs[0]
bpy.ops.object.transform_multiply if hasattr(bpy.ops.object, "transform_multiply") else None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Decimate if above target_faces (preserving UVs)
total_faces = sum(len(o.data.polygons) for o in mesh_objs)
if total_faces > target_faces:
    ratio = max(0.05, min(1.0, target_faces / float(total_faces)))
    for o in mesh_objs:
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new(name="ContractDecimate", type='DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=mod.name)

# Compute current world bounding box (in Blender Z-up, glTF Y-up corresponds to Blender Z)
coords = []
for o in mesh_objs:
    mat = o.matrix_world
    for v in o.data.vertices:
        coords.append(mat @ v.co)
coords = np.array(coords)
min_b = coords.min(axis=0)
max_b = coords.max(axis=0)

cur_height = float(max_b[2] - min_b[2])
center_x = float((min_b[0] + max_b[0]) * 0.5)
center_y = float((min_b[1] + max_b[1]) * 0.5)

# Reserve bottom 0.035m for the faction base ring, scale figure to fit [0.025m .. target_height]
pedestal_top_z = 0.025
avail_height = target_height - pedestal_top_z
scale_factor = avail_height / max(cur_height, 1e-4)

for o in mesh_objs:
    for v in o.data.vertices:
        v.co.x = (v.co.x - center_x) * scale_factor
        v.co.y = (v.co.y - center_y) * scale_factor
        v.co.z = (v.co.z - float(min_b[2])) * scale_factor + pedestal_top_z
    o.data.update()

# Verify exact top Z == target_height
coords2 = []
for o in mesh_objs:
    for v in o.data.vertices:
        coords2.append(v.co)
coords2 = np.array(coords2)
actual_max_z = float(coords2[:, 2].max())
if abs(actual_max_z - target_height) > 1e-4:
    z_fix = (target_height - pedestal_top_z) / max(actual_max_z - pedestal_top_z, 1e-4)
    for o in mesh_objs:
        for v in o.data.vertices:
            v.co.z = pedestal_top_z + (v.co.z - pedestal_top_z) * z_fix
        o.data.update()

# Create faction_primary & faction_trim materials if not present
def get_or_create_mat(name, rgba, metallic, roughness):
    m = bpy.data.materials.get(name)
    if not m:
        m = bpy.data.materials.new(name=name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = rgba
            bsdf.inputs["Metallic"].default_value = metallic
            bsdf.inputs["Roughness"].default_value = roughness
    return m

mat_primary = get_or_create_mat("faction_primary", (0.96, 0.94, 0.90, 1.0), 0.06, 0.28)
mat_trim = get_or_create_mat("faction_trim", (0.83, 0.69, 0.22, 1.0), 0.78, 0.24)

# Create sleek 0.74m diameter pedestal disk (z = 0.000 .. 0.026) -> glTF span_x, span_z = 0.74m >= 0.70m
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.37, depth=0.026, location=(0.0, 0.0, 0.013))
ped_obj = bpy.context.active_object
ped_obj.name = "FactionPedestal"
ped_obj.data.materials.append(mat_primary)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for v in ped_obj.data.vertices:
    if abs(v.co.z) < 1e-4 or v.co.z < 0.0:
        v.co.z = 0.0
ped_obj.data.update()

# Create sleek gold/trim ring at radius 0.372m (z = 0.018 .. 0.032)
bpy.ops.mesh.primitive_torus_add(
    major_segments=48,
    minor_segments=12,
    major_radius=0.362,
    minor_radius=0.010,
    location=(0.0, 0.0, 0.022),
)
trim_obj = bpy.context.active_object
trim_obj.name = "FactionTrimRing"
trim_obj.data.materials.append(mat_trim)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for v in trim_obj.data.vertices:
    if v.co.z < 0.0:
        v.co.z = 0.0
trim_obj.data.update()

try:
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        export_apply=True,
        export_image_format='WEBP',
        export_image_quality=88,
    )
except TypeError:
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        export_apply=True,
    )
"""


def main():
    parser = argparse.ArgumentParser(description="Conform GLB to CarChess3D family contract")
    parser.add_argument("--in-glb", required=True, type=Path)
    parser.add_argument("--out-glb", required=True, type=Path)
    parser.add_argument("--height", required=True, type=float)
    parser.add_argument("--target-faces", default=58000, type=int)
    args = parser.parse_args()

    args.out_glb.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as tf:
        tf.write(BLENDER_CONFORM_PY)
        script_path = tf.name

    try:
        subprocess.run(
            [
                "blender",
                "-b",
                "--python",
                script_path,
                "--",
                str(args.in_glb),
                str(args.out_glb),
                str(args.height),
                str(args.target_faces),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    finally:
        Path(script_path).unlink(missing_ok=True)

    print(f"✅ Conformed {args.out_glb} (height={args.height:.2f}m, size={args.out_glb.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
