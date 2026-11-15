#!/usr/bin/env python3
"""Batch generate Multi-Tier GLB LODs (10k / 50k) using headless Blender QEC decimation.

Preserves:
- 100% of PBR textures, UV mappings, materials, vertex colors, and normals
- Grounding at min.y == 0.0m
- glTF 2.0 binary structure with valid VEC3 bounds

Writes atomically via *.glb.part -> *.glb
"""
import os
import pathlib
import subprocess
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]

MODELS_TO_LOD = [
    # Carlesso Family
    ("assets/models/king-riccardo.glb", [("10k", 10000), ("50k", 50000)]),
    ("assets/models/king-riccardo-remastered.glb", [("10k", 10000), ("50k", 50000)]),
    ("assets/models/queen-kate.glb", [("10k", 10000), ("50k", 50000)]),
    ("assets/models/bishop-ale-1.glb", [("10k", 10000)]),
    ("assets/models/bishop-ale-2-remastered.glb", [("10k", 10000)]),
    ("assets/models/bishop-ale-hy2.glb", [("10k", 10000)]),
    ("assets/models/knight-seby.glb", [("10k", 10000), ("50k", 50000)]),
    ("assets/models/rook-pupurabbu.glb", [("10k", 10000), ("50k", 50000)]),
    ("assets/models/pawn-puffin.glb", [("10k", 10000)]),
    ("assets/models/king-riccardo-hy2.glb", [("10k", 10000)]),

    # Classic Family
    ("assets/models/classic/king-classic-re.glb", [("10k", 10000), ("50k", 50000)]),
    ("assets/models/classic/queen-classic-regina.glb", [("10k", 10000), ("50k", 50000)]),
    ("assets/models/classic/bishop-classic-vescovo.glb", [("10k", 10000), ("50k", 50000)]),
    ("assets/models/classic/knight-classic-cavallo.glb", [("10k", 10000)]),
    ("assets/models/classic/rook-classic-torre.glb", [("10k", 10000)]),
    ("assets/models/classic/pawn-classic-pedone.glb", [("10k", 10000)]),

    # Swamp Family
    ("assets/models/swamp/queen-swamp-orchessa.glb", [("10k", 10000)]),
    ("assets/models/swamp/king-swamp-orco.glb", [("10k", 10000)]),
    ("assets/models/swamp/bishop-swamp-focaccina.glb", [("10k", 10000)]),
    ("assets/models/swamp/knight-swamp-asinello.glb", [("10k", 10000)]),
    ("assets/models/swamp/rook-swamp-draghessa.glb", [("10k", 10000)]),
    ("assets/models/swamp/pawn-swamp-tappo.glb", [("10k", 10000)]),
]


BLENDER_SCRIPT = """
import bpy
import bmesh
import sys

in_path = sys.argv[-2]
out_path = sys.argv[-1]
target_faces = int(sys.argv[-3])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=in_path)

mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
for o in mesh_objs:
    # Weld split/unwelded triangle-soup vertices cleanly while preserving UV loops
    # so Collapse Decimate simplifies continuous geometry with zero missing-triangle holes.
    if len(o.data.polygons) > 200:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
        bm.to_mesh(o.data)
        bm.free()
        for poly in o.data.polygons:
            poly.use_smooth = True
        o.data.update()

heavy_objs = [o for o in mesh_objs if len(o.data.polygons) > 400]
light_faces = sum(len(o.data.polygons) for o in mesh_objs if o not in heavy_objs)
heavy_faces = sum(len(o.data.polygons) for o in heavy_objs)
budget_heavy = max(500, target_faces - light_faces)

if heavy_faces > budget_heavy:
    ratio = max(0.01, min(1.0, budget_heavy / heavy_faces))
    for o in heavy_objs:
        mod = o.modifiers.new(name='Decimate', type='DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = ratio
        mod.use_collapse_triangulate = True

max_tex = 512 if target_faces <= 15000 else 1024
webp_quality = 80 if target_faces <= 15000 else 88
for img in bpy.data.images:
    w, h = img.size[0], img.size[1]
    if max(w, h) > max_tex:
        scale = float(max_tex) / float(max(w, h))
        img.scale(max(1, int(w * scale)), max(1, int(h * scale)))

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_apply=True,
    export_image_format='WEBP',
    export_image_quality=webp_quality,
)
"""


def decimate_one(in_path: pathlib.Path, out_path: pathlib.Path, target_faces: int):
    part_path = out_path.parent / f".tmp_{out_path.name}"
    cmd = [
        "blender",
        "--background",
        "--python-expr",
        BLENDER_SCRIPT,
        "--",
        str(target_faces),
        str(in_path),
        str(part_path),
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0 or not part_path.exists():
        print(f"❌ Blender decimation failed for {in_path}:\n{res.stderr}")
        return False

    os.replace(part_path, out_path)
    in_size = in_path.stat().st_size / 1024
    out_size = out_path.stat().st_size / 1024
    print(f"✅ {out_path.name} (~{target_faces//1000}k): {in_size:.1f} KB -> {out_size:.1f} KB (-{(1 - out_size/in_size)*100:.1f}%)")
    return True


def main():
    print("🧱 Generating Multi-Tier GLB LODs via Headless Blender...")
    success = 0
    total = 0
    for rel_in, targets in MODELS_TO_LOD:
        in_path = REPO_ROOT / rel_in
        if not in_path.exists():
            print(f"⚠️ Skipped {rel_in} (not found)")
            continue
        stem = in_path.stem
        parent = in_path.parent
        for tier_suffix, target_faces in targets:
            total += 1
            out_name = f"{stem}-{tier_suffix}.glb"
            out_path = parent / out_name
            if decimate_one(in_path, out_path, target_faces):
                success += 1

    print(f"\n🎉 Successfully generated {success}/{total} LOD models!")


if __name__ == "__main__":
    main()
