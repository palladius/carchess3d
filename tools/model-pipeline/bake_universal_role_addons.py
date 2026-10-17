#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["trimesh>=4.0.0", "numpy>=1.24.0", "pygltflib>=1.16.0", "pyyaml>=6.0.0", "scipy>=1.10.0", "networkx>=3.0"]
# ///
"""Bake Universal Watertight 3D Role Signifiers (`UniversalRoleAddon_<type>`) into all `.glb` models.

Fulfills Idea #2B (Universal 3D Static Role Add-Ons across all skins & families):
- King (`k`): Royal single-diadem crown ring + prominent Cross Pattee finial at the top apex + 4 cardinal cross emblems at the base rim.
- Queen (`q`): 8-spike splayed royal coronet with 8 spherical pearls crowning the top + 8-star base studs.
- Rook (`r`): 6-merlon crenellated castle battlement turret crown + 6-buttress base fortress collar.
- Bishop (`b`): Tall Episcopal Cross / Crosier finial + sacred nimbus at the top apex + 4 diagonal mitre diamond studs at the base.
- Knight (`n`): Wide bilateral warhorse-crest / horseshoe-arch side wings (`±X`) that visibly widen the Knight's silhouette from above + dorsal mane crest + front/back horseshoe base emblem.
- Pawn (`p`): Vertical Swiss-Guard pike spearhead + Staunton sphere finial at the top + front/back pike chevron at the base.

Safety & Invariants:
- Preserves existing UV textures, materials, animations, and skeletal skins (`bishop-ale-rigged.glb`).
- Strictly preserves each model's existing `min_y` and `max_y` (`height_m`) and horizontal pedestal bounds so `groundAndNormalizeObject3D`, `test_classic_family.py`, and `test_swamp_family.py` pass with zero height drift.
- Idempotent: strips any previous `UniversalRoleAddon_*` node/mesh/buffer slice via `asset.extras` before baking, producing identical deterministic `.glb` binaries on repeated runs.
- Atomically writes via `<file>.glb.part` -> `os.replace()` and updates `docs/models-provenance.yaml`.

Usage:
    UV_INDEX_URL="https://pypi.org/simple" uv run tools/model-pipeline/bake_universal_role_addons.py
"""

from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path

import numpy as np
import pygltflib
import trimesh
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
PROVENANCE_PATH = REPO_ROOT / "docs/models-provenance.yaml"

TARGET_MODELS: list[tuple[str, str]] = [
    # Carlesso family (10 models in assets/models/)
    ("assets/models/king-riccardo.glb", "k"),
    ("assets/models/queen-kate.glb", "q"),
    ("assets/models/queen-kate-young.glb", "q"),
    ("assets/models/queen-kate-wedding2016.glb", "q"),
    ("assets/models/bishop-ale-1.glb", "b"),
    ("assets/models/bishop-ale-2.glb", "b"),
    ("assets/models/bishop-ale-rigged.glb", "b"),
    ("assets/models/knight-seby.glb", "n"),
    ("assets/models/rook-pupurabbu.glb", "r"),
    ("assets/models/pawn-puffin.glb", "p"),
    # Classic family (6 models in assets/models/classic/)
    ("assets/models/classic/king-classic-re.glb", "k"),
    ("assets/models/classic/queen-classic-regina.glb", "q"),
    ("assets/models/classic/bishop-classic-vescovo.glb", "b"),
    ("assets/models/classic/knight-classic-cavallo.glb", "n"),
    ("assets/models/classic/rook-classic-torre.glb", "r"),
    ("assets/models/classic/pawn-classic-pedone.glb", "p"),
    # Swamp family (6 models in assets/models/swamp/)
    ("assets/models/swamp/king-swamp-orco.glb", "k"),
    ("assets/models/swamp/queen-swamp-orchessa.glb", "q"),
    ("assets/models/swamp/bishop-swamp-focaccina.glb", "b"),
    ("assets/models/swamp/knight-swamp-asinello.glb", "n"),
    ("assets/models/swamp/rook-swamp-draghessa.glb", "r"),
    ("assets/models/swamp/pawn-swamp-tappo.glb", "p"),
]

FACTION_TRIM_RGBA = [0.85, 0.70, 0.24, 1.0]
FACTION_TRIM_METALLIC = 0.80
FACTION_TRIM_ROUGHNESS = 0.24


def file_md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def make_torus(
    major_r: float,
    minor_r_radial: float,
    minor_r_vertical: float,
    center: tuple[float, float, float],
    n_major: int = 36,
    n_minor: int = 12,
    wave_cycles: int = 0,
    wave_amp: float = 0.0,
    tilt_x: float = 0.0,
    tilt_z: float = 0.0,
) -> trimesh.Trimesh:
    """Create a closed, outward-oriented, watertight 2-manifold torus."""
    vertices = []
    for i in range(n_major):
        u = 2.0 * math.pi * i / n_major
        y_wave = wave_amp * math.cos(wave_cycles * u) if wave_cycles > 0 else 0.0
        for j in range(n_minor):
            v = 2.0 * math.pi * j / n_minor
            r = major_r + minor_r_radial * math.cos(v)
            x = r * math.cos(u)
            z = r * math.sin(u)
            y = minor_r_vertical * math.sin(v) + y_wave
            if abs(tilt_x) > 1e-6:
                cx_t, sx_t = math.cos(tilt_x), math.sin(tilt_x)
                y, z = cx_t * y - sx_t * z, sx_t * y + cx_t * z
            if abs(tilt_z) > 1e-6:
                cz_t, sz_t = math.cos(tilt_z), math.sin(tilt_z)
                x, y = cz_t * x - sz_t * y, sz_t * x + cz_t * y
            vertices.append([x + center[0], y + center[1], z + center[2]])

    faces = []
    for i in range(n_major):
        ip = (i + 1) % n_major
        for j in range(n_minor):
            jp = (j + 1) % n_minor
            a = i * n_minor + j
            b = ip * n_minor + j
            c = ip * n_minor + jp
            d = i * n_minor + jp
            faces.append([a, b, c])
            faces.append([a, c, d])

    mesh = trimesh.Trimesh(
        vertices=np.array(vertices, dtype=np.float64),
        faces=np.array(faces, dtype=np.int64),
        process=True,
    )
    mesh.fix_normals()
    return mesh


def make_ellipsoid(
    radii: tuple[float, float, float],
    center: tuple[float, float, float],
    subdivisions: int = 2,
) -> trimesh.Trimesh:
    """Create a closed watertight subdivided icosphere scaled to `radii` at `center`."""
    sphere = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    v = sphere.vertices.copy()
    v[:, 0] = v[:, 0] * radii[0] + center[0]
    v[:, 1] = v[:, 1] * radii[1] + center[1]
    v[:, 2] = v[:, 2] * radii[2] + center[2]
    mesh = trimesh.Trimesh(vertices=v, faces=sphere.faces.copy(), process=True)
    mesh.fix_normals()
    return mesh


def make_rounded_box(
    extents: tuple[float, float, float],
    center: tuple[float, float, float],
    power: float = 0.42,
    subdivisions: int = 2,
    rot_x: float = 0.0,
    rot_y: float = 0.0,
    rot_z: float = 0.0,
) -> trimesh.Trimesh:
    """Create a closed watertight superellipsoid / rounded box."""
    sphere = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    v = sphere.vertices.copy()
    v = np.sign(v) * (np.abs(v) ** power)
    v[:, 0] *= extents[0] * 0.5
    v[:, 1] *= extents[1] * 0.5
    v[:, 2] *= extents[2] * 0.5
    if abs(rot_z) > 1e-6:
        cz, sz = math.cos(rot_z), math.sin(rot_z)
        x, y = v[:, 0].copy(), v[:, 1].copy()
        v[:, 0] = cz * x - sz * y
        v[:, 1] = sz * x + cz * y
    if abs(rot_x) > 1e-6:
        cx_r, sx_r = math.cos(rot_x), math.sin(rot_x)
        y, z = v[:, 1].copy(), v[:, 2].copy()
        v[:, 1] = cx_r * y - sx_r * z
        v[:, 2] = sx_r * y + cx_r * z
    if abs(rot_y) > 1e-6:
        cy, sy = math.cos(rot_y), math.sin(rot_y)
        x, z = v[:, 0].copy(), v[:, 2].copy()
        v[:, 0] = cy * x + sy * z
        v[:, 2] = -sy * x + cy * z
    v[:, 0] += center[0]
    v[:, 1] += center[1]
    v[:, 2] += center[2]
    mesh = trimesh.Trimesh(vertices=v, faces=sphere.faces.copy(), process=True)
    mesh.fix_normals()
    return mesh


def combine_watertight(parts: list[trimesh.Trimesh]) -> trimesh.Trimesh:
    """De-collide vertices across distinct sub-meshes and concatenate into a single watertight Trimesh."""
    seen: set[tuple[int, int, int]] = set()
    clean_parts: list[trimesh.Trimesh] = []
    for idx, m in enumerate(parts):
        verts = m.vertices.copy()
        quant = np.round(verts * 10000.0).astype(np.int64)
        if any(tuple(row) in seen for row in quant):
            shift = np.array(
                [1.3e-4 * ((idx % 7) + 1), 0.9e-4 * ((idx % 5) + 1), -1.1e-4 * ((idx % 6) + 1)],
                dtype=np.float64,
            )
            verts = verts + shift
            quant = np.round(verts * 10000.0).astype(np.int64)
        for row in quant:
            seen.add(tuple(row))
        cm = trimesh.Trimesh(vertices=verts, faces=m.faces.copy(), process=True)
        cm.fix_normals()
        if not cm.is_watertight:
            raise RuntimeError(f"Sub-part {idx} is not watertight!")
        clean_parts.append(cm)

    combined = trimesh.util.concatenate(clean_parts)
    if not combined.is_watertight:
        raise RuntimeError("Combined UniversalRoleAddon mesh is not watertight!")
    return combined


def build_role_addon_mesh(
    role: str,
    min_xyz: np.ndarray,
    max_xyz: np.ndarray,
    r_top95: float,
) -> trimesh.Trimesh:
    """Build the watertight 3D role signifier mesh for `role` (`k, q, r, b, n, p`) inside `(min_xyz, max_xyz)`."""
    min_x, min_y, min_z = float(min_xyz[0]), float(min_xyz[1]), float(min_xyz[2])
    max_x, max_y, max_z = float(max_xyz[0]), float(max_xyz[1]), float(max_xyz[2])
    H = max_y - min_y
    cx = 0.5 * (min_x + max_x)
    cz = 0.5 * (min_z + max_z)
    rx_bound = 0.5 * (max_x - min_x)
    rz_bound = 0.5 * (max_z - min_z)
    r_bound = min(rx_bound, rz_bound)

    # Ensure the upper crown halo sits visibly outside the head while staying inside pedestal bounds
    r_crown = min(0.84 * r_bound, max(0.70 * r_bound, r_top95 * 1.04))
    r_base = 0.87 * r_bound

    parts: list[trimesh.Trimesh] = []

    if role == "k":
        # 1. Royal single-diadem crown ring around upper head/crown
        y_diadem = min_y + 0.835 * H
        parts.append(
            make_torus(
                major_r=r_crown,
                minor_r_radial=0.052 * r_bound,
                minor_r_vertical=0.026 * H,
                center=(cx, y_diadem, cz),
                n_major=40,
                n_minor=12,
                wave_cycles=4,
                wave_amp=0.012 * H,
            )
        )
        # 4 cardinal diadem jewel bosses
        for k in range(4):
            th = 0.5 * math.pi * k
            bx = cx + (r_crown + 0.02 * r_bound) * math.cos(th)
            bz = cz + (r_crown + 0.02 * r_bound) * math.sin(th)
            parts.append(
                make_ellipsoid(
                    radii=(0.062 * r_bound, 0.036 * H, 0.062 * r_bound),
                    center=(bx, y_diadem + 0.018 * H, bz),
                )
            )

        # 2. Prominent Cross Pattee finial perched at the top apex (wide X & Z arms visible from 0° and 30°)
        y_cross = min_y + 0.932 * H
        arm_span = 0.78 * r_bound
        parts.append(
            make_rounded_box(
                extents=(0.12 * r_bound, 0.125 * H, 0.12 * r_bound),
                center=(cx, min_y + 0.928 * H, cz),
            )
        )
        parts.append(
            make_rounded_box(
                extents=(arm_span, 0.052 * H, 0.115 * r_bound),
                center=(cx, y_cross, cz),
            )
        )
        parts.append(
            make_rounded_box(
                extents=(0.115 * r_bound, 0.052 * H, arm_span),
                center=(cx, y_cross, cz),
            )
        )
        # Flared Cross Pattee tips on X and Z
        for sign in (-1.0, 1.0):
            parts.append(
                make_rounded_box(
                    extents=(0.095 * r_bound, 0.072 * H, 0.165 * r_bound),
                    center=(cx + sign * 0.37 * r_bound, y_cross, cz),
                )
            )
            parts.append(
                make_rounded_box(
                    extents=(0.165 * r_bound, 0.072 * H, 0.095 * r_bound),
                    center=(cx, y_cross, cz + sign * 0.37 * r_bound),
                )
            )

        # 3. 4 cardinal cross emblems at the base rim
        y_base = min_y + 0.095 * H
        for k in range(4):
            th = 0.5 * math.pi * k
            bx = cx + r_base * math.cos(th)
            bz = cz + r_base * math.sin(th)
            parts.append(
                make_rounded_box(
                    extents=(0.15 * r_bound, 0.075 * H, 0.07 * r_bound),
                    center=(bx, y_base, bz),
                    rot_y=-th + 0.5 * math.pi,
                )
            )
            parts.append(
                make_rounded_box(
                    extents=(0.065 * r_bound, 0.105 * H, 0.07 * r_bound),
                    center=(bx, y_base, bz),
                    rot_y=-th + 0.5 * math.pi,
                )
            )

    elif role == "q":
        # 1. 8-spike splayed royal coronet ring
        y_coronet = min_y + 0.825 * H
        parts.append(
            make_torus(
                major_r=r_crown,
                minor_r_radial=0.048 * r_bound,
                minor_r_vertical=0.024 * H,
                center=(cx, y_coronet, cz),
                n_major=40,
                n_minor=12,
                wave_cycles=8,
                wave_amp=0.015 * H,
            )
        )
        # 8 splayed spikes + 8 large spherical pearls crowning the top
        r_pearl_ring = min(0.89 * r_bound, r_crown * 1.05)
        for k in range(8):
            th = 2.0 * math.pi * k / 8.0
            sx = cx + (0.5 * (r_crown + r_pearl_ring)) * math.cos(th)
            sz = cz + (0.5 * (r_crown + r_pearl_ring)) * math.sin(th)
            parts.append(
                make_rounded_box(
                    extents=(0.082 * r_bound, 0.105 * H, 0.082 * r_bound),
                    center=(sx, min_y + 0.885 * H, sz),
                    rot_y=-th,
                )
            )
            px = cx + r_pearl_ring * math.cos(th)
            pz = cz + r_pearl_ring * math.sin(th)
            parts.append(
                make_ellipsoid(
                    radii=(0.074 * r_bound, 0.042 * H, 0.074 * r_bound),
                    center=(px, min_y + 0.948 * H, pz),
                )
            )

        # 2. 8-star base studs around the pedestal rim
        y_base = min_y + 0.090 * H
        for k in range(8):
            th = 2.0 * math.pi * k / 8.0
            bx = cx + r_base * math.cos(th)
            bz = cz + r_base * math.sin(th)
            parts.append(
                make_rounded_box(
                    extents=(0.115 * r_bound, 0.055 * H, 0.115 * r_bound),
                    center=(bx, y_base, bz),
                    rot_y=-th + 0.25 * math.pi,
                )
            )

    elif role == "r":
        # 1. 6-merlon crenellated castle battlement turret crown
        y_turret = min_y + 0.825 * H
        r_turret = min(0.84 * r_bound, max(0.74 * r_bound, r_crown))
        parts.append(
            make_torus(
                major_r=r_turret,
                minor_r_radial=0.058 * r_bound,
                minor_r_vertical=0.030 * H,
                center=(cx, y_turret, cz),
                n_major=36,
                n_minor=12,
            )
        )
        for k in range(6):
            th = 2.0 * math.pi * k / 6.0
            mx = cx + r_turret * math.cos(th)
            mz = cz + r_turret * math.sin(th)
            parts.append(
                make_rounded_box(
                    extents=(0.14 * r_bound, 0.125 * H, 0.25 * r_bound),
                    center=(mx, min_y + 0.910 * H, mz),
                    power=0.35,
                    rot_y=-th,
                )
            )

        # 2. Base fortress collar with 6 matching castle buttresses
        y_base = min_y + 0.095 * H
        parts.append(
            make_torus(
                major_r=0.86 * r_bound,
                minor_r_radial=0.045 * r_bound,
                minor_r_vertical=0.025 * H,
                center=(cx, min_y + 0.065 * H, cz),
                n_major=36,
                n_minor=12,
            )
        )
        for k in range(6):
            th = 2.0 * math.pi * k / 6.0
            bx = cx + r_base * math.cos(th)
            bz = cz + r_base * math.sin(th)
            parts.append(
                make_rounded_box(
                    extents=(0.12 * r_bound, 0.105 * H, 0.20 * r_bound),
                    center=(bx, y_base, bz),
                    power=0.35,
                    rot_y=-th,
                )
            )

    elif role == "b":
        # 1. Tall Episcopal Cross / Crosier finial + sacred nimbus ring at top apex
        y_halo = min_y + 0.815 * H
        parts.append(
            make_torus(
                major_r=0.72 * r_bound,
                minor_r_radial=0.046 * r_bound,
                minor_r_vertical=0.025 * H,
                center=(cx, y_halo, cz),
                n_major=36,
                n_minor=12,
                wave_cycles=2,
                wave_amp=0.020 * H,
            )
        )
        # Upright Crosier / Episcopal shaft
        parts.append(
            make_rounded_box(
                extents=(0.105 * r_bound, 0.155 * H, 0.105 * r_bound),
                center=(cx, min_y + 0.912 * H, cz),
            )
        )
        # Diagonal X-crossbars (45° & 135° matching Bishop's diagonal movement!)
        for th in (0.25 * math.pi, 0.75 * math.pi):
            parts.append(
                make_rounded_box(
                    extents=(0.74 * r_bound, 0.048 * H, 0.095 * r_bound),
                    center=(cx, min_y + 0.928 * H, cz),
                    rot_y=th,
                )
            )
        # Sacred Crosier volute jewel at apex
        parts.append(
            make_ellipsoid(
                radii=(0.11 * r_bound, 0.045 * H, 0.11 * r_bound),
                center=(cx, min_y + 0.952 * H, cz),
            )
        )

        # 2. 4 diagonal mitre diamond studs at the base (45°, 135°, 225°, 315°)
        y_base = min_y + 0.095 * H
        for k in range(4):
            th = 0.25 * math.pi + 0.5 * math.pi * k
            bx = cx + r_base * math.cos(th)
            bz = cz + r_base * math.sin(th)
            parts.append(
                make_rounded_box(
                    extents=(0.13 * r_bound, 0.095 * H, 0.13 * r_bound),
                    center=(bx, y_base, bz),
                    rot_y=-th + 0.25 * math.pi,
                )
            )

    elif role == "n":
        # 1. WIDE bilateral warhorse-crest / horseshoe-arch side wings (±X)
        # Widens the Knight's upper/mid silhouette along ±X from 0° and 30°!
        for sign in (-1.0, 1.0):
            # 3 swept bilateral warhorse wing blades on ±X
            for tier, (y_frac, x_frac, z_span, h_frac) in enumerate(
                [
                    (0.66, 0.85, 0.52, 0.075),
                    (0.77, 0.89, 0.62, 0.080),
                    (0.88, 0.86, 0.48, 0.075),
                ]
            ):
                parts.append(
                    make_rounded_box(
                        extents=(0.16 * rx_bound, h_frac * H, z_span * rz_bound),
                        center=(cx + sign * x_frac * rx_bound, min_y + y_frac * H, cz),
                        rot_z=sign * 0.18,
                    )
                )
            # Bilateral warhorse cheek/crest finial near top
            parts.append(
                make_rounded_box(
                    extents=(0.18 * rx_bound, 0.105 * H, 0.22 * rz_bound),
                    center=(cx + sign * 0.68 * rx_bound, min_y + 0.925 * H, cz),
                    rot_z=sign * 0.25,
                )
            )

        # Dorsal scalloped warhorse mane crest at apex
        parts.append(
            make_rounded_box(
                extents=(0.16 * rx_bound, 0.095 * H, 0.56 * rz_bound),
                center=(cx, min_y + 0.940 * H, cz),
            )
        )

        # 2. Front/back horseshoe base emblem + lateral ±X hoof wings at base
        y_base = min_y + 0.090 * H
        for sign in (-1.0, 1.0):
            parts.append(
                make_rounded_box(
                    extents=(0.14 * rx_bound, 0.075 * H, 0.34 * rz_bound),
                    center=(cx + sign * 0.86 * rx_bound, y_base, cz),
                )
            )
            parts.append(
                make_rounded_box(
                    extents=(0.38 * rx_bound, 0.068 * H, 0.12 * rz_bound),
                    center=(cx, y_base, cz + sign * 0.86 * rz_bound),
                )
            )

    elif role == "p":
        # 1. Vertical Swiss-Guard pike spearhead + Staunton sphere finial at the top
        parts.append(
            make_torus(
                major_r=0.52 * r_bound,
                minor_r_radial=0.048 * r_bound,
                minor_r_vertical=0.028 * H,
                center=(cx, min_y + 0.815 * H, cz),
                n_major=32,
                n_minor=12,
            )
        )
        # Iconic Staunton sphere finial
        parts.append(
            make_ellipsoid(
                radii=(0.24 * r_bound, 0.062 * H, 0.24 * r_bound),
                center=(cx, min_y + 0.885 * H, cz),
            )
        )
        # Crossed Swiss-Guard pike spearhead blades + halberd axe wing
        parts.append(
            make_rounded_box(
                extents=(0.48 * r_bound, 0.115 * H, 0.09 * r_bound),
                center=(cx, min_y + 0.930 * H, cz),
            )
        )
        parts.append(
            make_rounded_box(
                extents=(0.09 * r_bound, 0.115 * H, 0.48 * r_bound),
                center=(cx, min_y + 0.930 * H, cz),
            )
        )
        parts.append(
            make_rounded_box(
                extents=(0.22 * r_bound, 0.085 * H, 0.11 * r_bound),
                center=(cx + 0.30 * r_bound, min_y + 0.895 * H, cz),
            )
        )

        # 2. Front & back pike chevron spearheads at the base
        y_base = min_y + 0.090 * H
        for sign in (-1.0, 1.0):
            parts.append(
                make_rounded_box(
                    extents=(0.24 * r_bound, 0.065 * H, 0.18 * r_bound),
                    center=(cx, y_base, cz + sign * 0.84 * rz_bound),
                    rot_y=0.25 * math.pi,
                )
            )
    else:
        raise ValueError(f"Unknown piece role: {role!r}")

    combined = combine_watertight(parts)

    # Strict bounding-box invariant guard: ensure addon vertices stay strictly inside
    # [min_xyz + eps, max_xyz - eps] so global min_y, max_y (height_m), and X/Z bounds
    # of every GLB remain 100% unchanged!
    v = combined.vertices.copy()
    eps_xz = 1e-3
    eps_y_low = 0.015 * H
    eps_y_high = 1e-3 * H
    v[:, 0] = np.clip(v[:, 0], min_x + eps_xz, max_x - eps_xz)
    v[:, 1] = np.clip(v[:, 1], min_y + eps_y_low, max_y - eps_y_high)
    v[:, 2] = np.clip(v[:, 2], min_z + eps_xz, max_z - eps_xz)
    combined.vertices = v
    combined.fix_normals()
    if not combined.is_watertight:
        raise RuntimeError(f"Clipped addon mesh for role {role} lost watertightness!")
    return combined


def extract_original_bounds(gltf: pygltflib.GLTF2, blob: bytes) -> tuple[np.ndarray, np.ndarray, float]:
    """Compute exact (min_xyz, max_xyz, r_top95) across all non-addon mesh primitives."""
    all_verts = []
    for mesh in gltf.meshes:
        if mesh.name and mesh.name.startswith("UniversalRoleAddon_"):
            continue
        for prim in mesh.primitives:
            pos_idx = prim.attributes.POSITION
            if pos_idx is None:
                continue
            acc = gltf.accessors[pos_idx]
            bv = gltf.bufferViews[acc.bufferView]
            offset = (bv.byteOffset or 0) + (acc.byteOffset or 0)
            stride = bv.byteStride or 12
            if stride == 12:
                arr = np.frombuffer(blob, dtype=np.float32, count=acc.count * 3, offset=offset).reshape(-1, 3)
            else:
                raw = np.frombuffer(blob, dtype=np.uint8, count=acc.count * stride, offset=offset).reshape(acc.count, stride)
                arr = np.frombuffer(raw[:, :12].tobytes(), dtype=np.float32).reshape(-1, 3)
            all_verts.append(arr.copy())

    v = np.vstack(all_verts)
    min_xyz = v.min(axis=0)
    max_xyz = v.max(axis=0)
    H = float(max_xyz[1] - min_xyz[1])
    cx = 0.5 * float(min_xyz[0] + max_xyz[0])
    cz = 0.5 * float(min_xyz[2] + max_xyz[2])
    top_mask = v[:, 1] >= (min_xyz[1] + 0.78 * H)
    if np.any(top_mask):
        r_top95 = float(np.percentile(np.hypot(v[top_mask, 0] - cx, v[top_mask, 2] - cz), 95))
    else:
        r_top95 = 0.30 * float(min(max_xyz[0] - min_xyz[0], max_xyz[2] - min_xyz[2]))
    return min_xyz, max_xyz, r_top95


def restore_pre_addon_state(gltf: pygltflib.GLTF2, blob: bytes) -> bytes:
    """If `UniversalRoleAddon_*` was already baked into `gltf`, restore exact pre-addon arrays and blob."""
    extras = getattr(gltf.asset, "extras", None)
    if isinstance(extras, dict) and "universal_role_addon" in extras:
        meta = extras["universal_role_addon"]
        blob = blob[: int(meta["orig_blob_len"])]
        del gltf.nodes[int(meta["orig_nodes"]) :]
        del gltf.meshes[int(meta["orig_meshes"]) :]
        del gltf.accessors[int(meta["orig_accessors"]) :]
        del gltf.bufferViews[int(meta["orig_bufferViews"]) :]
        del gltf.materials[int(meta["orig_materials"]) :]
        scene_idx = gltf.scene if gltf.scene is not None else 0
        gltf.scenes[scene_idx].nodes = list(meta["orig_scene_nodes"])
    else:
        # Remove any stray UniversalRoleAddon node references if present without extras
        for s in gltf.scenes:
            s.nodes = [
                ni for ni in s.nodes
                if not (gltf.nodes[ni].name and gltf.nodes[ni].name.startswith("UniversalRoleAddon_"))
            ]
    return blob


def bake_glb(glb_path: Path, role: str) -> dict:
    """Bake `UniversalRoleAddon_<role>` into `glb_path` atomically and idempotently."""
    gltf = pygltflib.GLTF2().load(str(glb_path))
    raw_blob = gltf.binary_blob() or b""
    raw_blob = restore_pre_addon_state(gltf, raw_blob)

    scene_idx = gltf.scene if gltf.scene is not None else 0
    if getattr(gltf.asset, "extras", None) is None or not isinstance(gltf.asset.extras, dict):
        gltf.asset.extras = {}
    gltf.asset.extras["universal_role_addon"] = {
        "role": role,
        "orig_blob_len": len(raw_blob),
        "orig_nodes": len(gltf.nodes),
        "orig_meshes": len(gltf.meshes),
        "orig_accessors": len(gltf.accessors),
        "orig_bufferViews": len(gltf.bufferViews),
        "orig_materials": len(gltf.materials),
        "orig_scene_nodes": list(gltf.scenes[scene_idx].nodes),
    }

    min_xyz, max_xyz, r_top95 = extract_original_bounds(gltf, raw_blob)
    addon_mesh = build_role_addon_mesh(role, min_xyz, max_xyz, r_top95)

    verts = np.asarray(addon_mesh.vertices, dtype=np.float32)
    norms = np.asarray(addon_mesh.vertex_normals, dtype=np.float32)
    faces = np.asarray(addon_mesh.faces, dtype=np.uint32)

    # Reuse existing untextured `faction_trim` material if present, otherwise append a new one
    mat_idx = None
    for idx, m in enumerate(gltf.materials):
        if m.name == "faction_trim":
            has_tex = (
                m.pbrMetallicRoughness is not None
                and m.pbrMetallicRoughness.baseColorTexture is not None
            )
            if not has_tex:
                mat_idx = idx
                break
    if mat_idx is None:
        mat_idx = len(gltf.materials)
        gltf.materials.append(
            pygltflib.Material(
                name="faction_trim",
                pbrMetallicRoughness=pygltflib.PbrMetallicRoughness(
                    baseColorFactor=FACTION_TRIM_RGBA,
                    metallicFactor=FACTION_TRIM_METALLIC,
                    roughnessFactor=FACTION_TRIM_ROUGHNESS,
                ),
                doubleSided=False,
            )
        )

    binary_blob = bytearray(raw_blob)

    def append_bytes(chunk: bytes, target: int) -> int:
        while len(binary_blob) % 4 != 0:
            binary_blob.append(0)
        offset = len(binary_blob)
        binary_blob.extend(chunk)
        bv_idx = len(gltf.bufferViews)
        gltf.bufferViews.append(
            pygltflib.BufferView(
                buffer=0,
                byteOffset=offset,
                byteLength=len(chunk),
                target=target,
            )
        )
        return bv_idx

    pos_bv = append_bytes(verts.tobytes(), pygltflib.ARRAY_BUFFER)
    norm_bv = append_bytes(norms.tobytes(), pygltflib.ARRAY_BUFFER)
    idx_bv = append_bytes(faces.reshape(-1).tobytes(), pygltflib.ELEMENT_ARRAY_BUFFER)

    pos_acc = len(gltf.accessors)
    gltf.accessors.append(
        pygltflib.Accessor(
            bufferView=pos_bv,
            byteOffset=0,
            componentType=pygltflib.FLOAT,
            count=len(verts),
            type=pygltflib.VEC3,
            min=[float(x) for x in verts.min(axis=0)],
            max=[float(x) for x in verts.max(axis=0)],
        )
    )

    norm_acc = len(gltf.accessors)
    gltf.accessors.append(
        pygltflib.Accessor(
            bufferView=norm_bv,
            byteOffset=0,
            componentType=pygltflib.FLOAT,
            count=len(norms),
            type=pygltflib.VEC3,
        )
    )

    idx_acc = len(gltf.accessors)
    gltf.accessors.append(
        pygltflib.Accessor(
            bufferView=idx_bv,
            byteOffset=0,
            componentType=pygltflib.UNSIGNED_INT,
            count=int(faces.size),
            type=pygltflib.SCALAR,
            min=[int(faces.min())],
            max=[int(faces.max())],
        )
    )

    addon_name = f"UniversalRoleAddon_{role}"
    mesh_idx = len(gltf.meshes)
    gltf.meshes.append(
        pygltflib.Mesh(
            name=addon_name,
            primitives=[
                pygltflib.Primitive(
                    attributes=pygltflib.Attributes(POSITION=pos_acc, NORMAL=norm_acc),
                    indices=idx_acc,
                    material=mat_idx,
                    mode=pygltflib.TRIANGLES,
                )
            ],
        )
    )

    node_idx = len(gltf.nodes)
    gltf.nodes.append(pygltflib.Node(name=addon_name, mesh=mesh_idx))
    gltf.scenes[scene_idx].nodes.append(node_idx)

    gltf.buffers[0].byteLength = len(binary_blob)
    gltf.set_binary_blob(bytes(binary_blob))

    part_path = glb_path.with_suffix(".glb.part")
    gltf.save_binary(str(part_path))
    os.replace(part_path, glb_path)

    return {
        "path": glb_path.relative_to(REPO_ROOT).as_posix(),
        "role": role,
        "addon_name": addon_name,
        "addon_verts": int(len(verts)),
        "addon_tris": int(len(faces)),
        "watertight": bool(addon_mesh.is_watertight),
        "height_m": round(float(max_xyz[1] - min_xyz[1]), 4),
        "size_bytes": glb_path.stat().st_size,
        "md5": file_md5(glb_path),
    }


def update_provenance_registry() -> int:
    """Recompute MD5 hashes and byte sizes in `docs/models-provenance.yaml` for all tracked models & sources."""
    if not PROVENANCE_PATH.exists():
        return 0
    data = yaml.safe_load(PROVENANCE_PATH.read_text(encoding="utf-8"))
    models = data.get("models", [])
    existing_by_path = {m.get("target_path"): m for m in models}

    # Ensure Classic and Swamp family models are also tracked in provenance registry
    extra_entries = [
        ("king-classic-re", "Vanilla Classic King (Re)", "king", "Re Classico", "assets/models/classic/king-classic-re.glb", "tools/model-pipeline/classic/gen_trellis2_batch.py", "assets/characters/king-classic-re.jpg"),
        ("queen-classic-regina", "Vanilla Classic Queen (Regina)", "queen", "Regina Classica", "assets/models/classic/queen-classic-regina.glb", "tools/model-pipeline/classic/build_classic_pieces.py", "assets/characters/queen-classic-regina.jpg"),
        ("bishop-classic-vescovo", "Vanilla Classic Bishop (Vescovo)", "bishop", "Vescovo Classico", "assets/models/classic/bishop-classic-vescovo.glb", "tools/model-pipeline/classic/build_classic_pieces.py", "assets/characters/bishop-classic-vescovo.jpg"),
        ("knight-classic-cavallo", "Vanilla Classic Knight (Cavallo)", "knight", "Destriero Classico", "assets/models/classic/knight-classic-cavallo.glb", "tools/model-pipeline/classic/reconstruct_knight_3d.py", "assets/characters/knight-classic-cavallo.jpg"),
        ("rook-classic-torre", "Vanilla Classic Rook (Torre)", "rook", "Torre Matildea", "assets/models/classic/rook-classic-torre.glb", "tools/model-pipeline/classic/build_classic_pieces.py", "assets/characters/rook-classic-torre.jpg"),
        ("pawn-classic-pedone", "Vanilla Classic Pawn (Pedone)", "pawn", "Pedone Classico", "assets/models/classic/pawn-classic-pedone.glb", "tools/model-pipeline/classic/build_classic_pieces.py", "assets/characters/pawn-classic-pedone.jpg"),
        ("king-swamp-orco", "Swamp King (Orco)", "king", "Orco", "assets/models/swamp/king-swamp-orco.glb", "tools/model-pipeline/swamp/build_swamp_models.py", "assets/characters/king-swamp-orco.jpg"),
        ("queen-swamp-orchessa", "Swamp Queen (Orchessa)", "queen", "Orchessa", "assets/models/swamp/queen-swamp-orchessa.glb", "tools/model-pipeline/swamp/build_swamp_models.py", "assets/characters/queen-swamp-orchessa.jpg"),
        ("bishop-swamp-focaccina", "Swamp Bishop (Don Gatto)", "bishop", "Don Gatto", "assets/models/swamp/bishop-swamp-focaccina.glb", "tools/model-pipeline/swamp/build_swamp_models.py", "assets/characters/bishop-swamp-focaccina.jpg"),
        ("knight-swamp-asinello", "Swamp Knight (Asinello)", "knight", "Asinello", "assets/models/swamp/knight-swamp-asinello.glb", "tools/model-pipeline/swamp/reconstruct_asinello_3d.py", "assets/characters/knight-swamp-asinello.jpg"),
        ("rook-swamp-draghessa", "Swamp Rook (Draghessa)", "rook", "Draghessa", "assets/models/swamp/rook-swamp-draghessa.glb", "tools/model-pipeline/swamp/build_swamp_models.py", "assets/characters/rook-swamp-draghessa.jpg"),
        ("pawn-swamp-tappo", "Swamp Pawn (Tappo / Guardia)", "pawn", "Tappo", "assets/models/swamp/pawn-swamp-tappo.glb", "tools/model-pipeline/swamp/build_swamp_models.py", "assets/characters/pawn-swamp-tappo.jpg"),
    ]
    for m_id, name, piece, char_name, t_path, script_path, jpg_path in extra_entries:
        if t_path not in existing_by_path:
            entry = {
                "id": m_id,
                "name": name,
                "piece": piece,
                "character": char_name,
                "status": "CANONICAL",
                "target_path": t_path,
                "size_bytes": 0,
                "md5": "",
                "pipeline": {
                    "tool": "Procedural Staunton / SDF + Universal Role Addon Baker",
                    "script": script_path,
                },
                "concept_sources": [
                    {
                        "role": "concept_turnaround_sheet",
                        "path": jpg_path,
                        "size_bytes": (REPO_ROOT / jpg_path).stat().st_size,
                        "md5": file_md5(REPO_ROOT / jpg_path),
                    }
                ],
            }
            models.append(entry)
            existing_by_path[t_path] = entry

    updated_count = 0
    for m in models:
        t_path = REPO_ROOT / m["target_path"]
        if t_path.exists():
            m["size_bytes"] = t_path.stat().st_size
            m["md5"] = file_md5(t_path)
            updated_count += 1
        for src in m.get("concept_sources", []):
            s_path = REPO_ROOT / src["path"]
            if s_path.exists():
                if "size_bytes" in src:
                    src["size_bytes"] = s_path.stat().st_size
                src["md5"] = file_md5(s_path)

    data["updated_at"] = "2026-10-14"
    header = (
        "# CarChess3D — 3D Models Provenance & Checksum Registry\n"
        "# Tracks exact concept sources, multi-view turnaround inputs, pipelines, and MD5 checksums.\n"
        "# Tested automatically via `python3 scripts/test_provenance.py` (and `just test`).\n\n"
    )
    PROVENANCE_PATH.write_text(
        header + yaml.dump(data, sort_keys=False, allow_unicode=True, default_flow_style=False),
        encoding="utf-8",
    )
    return updated_count


def strip_glb(glb_path: Path, role: str) -> dict:
    """Restore `glb_path` to its clean pre-addon state (removing baked `UniversalRoleAddon_*`)."""
    gltf = pygltflib.GLTF2().load(str(glb_path))
    raw_blob = gltf.binary_blob() or b""
    raw_blob = restore_pre_addon_state(gltf, raw_blob)
    if getattr(gltf.asset, "extras", None) and isinstance(gltf.asset.extras, dict):
        gltf.asset.extras.pop("universal_role_addon", None)
        if not gltf.asset.extras:
            gltf.asset.extras = None

    min_xyz, max_xyz, _ = extract_original_bounds(gltf, raw_blob)
    gltf.buffers[0].byteLength = len(raw_blob)
    gltf.set_binary_blob(bytes(raw_blob))

    part_path = glb_path.with_suffix(".glb.part")
    gltf.save_binary(str(part_path))
    os.replace(part_path, glb_path)

    return {
        "path": glb_path.relative_to(REPO_ROOT).as_posix(),
        "role": role,
        "stripped": True,
        "height_m": round(float(max_xyz[1] - min_xyz[1]), 4),
        "size_bytes": glb_path.stat().st_size,
        "md5": file_md5(glb_path),
    }


def main() -> None:
    import sys

    strip_mode = "--strip" in sys.argv
    if strip_mode:
        print(f"🧹 Stripping baked UniversalRoleAddon_* from {len(TARGET_MODELS)} GLB models...")
        results = []
        for rel_path, role in TARGET_MODELS:
            glb_path = REPO_ROOT / rel_path
            if not glb_path.exists():
                raise FileNotFoundError(f"Missing target GLB: {glb_path}")
            info = strip_glb(glb_path, role)
            results.append(info)
            print(
                f"  ✅ [{info['role'].upper()}] {info['path']:44s} "
                f"| stripped | height={info['height_m']:.3f}m | md5={info['md5'][:10]}..."
            )
        n_prov = update_provenance_registry()
        print(f"📜 Updated docs/models-provenance.yaml for {n_prov} models.")
        print(json.dumps({"stripped_count": len(results), "provenance_count": n_prov}, indent=2))
        return

    print(f"👑 Baking Universal 3D Role Signifiers into {len(TARGET_MODELS)} GLB models...")
    results = []
    for rel_path, role in TARGET_MODELS:
        glb_path = REPO_ROOT / rel_path
        if not glb_path.exists():
            raise FileNotFoundError(f"Missing target GLB: {glb_path}")
        info = bake_glb(glb_path, role)
        results.append(info)
        print(
            f"  ✅ [{info['role'].upper()}] {info['path']:44s} "
            f"| {info['addon_name']:20s} | +{info['addon_tris']:4d} tris | watertight={info['watertight']} | md5={info['md5'][:10]}..."
        )

    n_prov = update_provenance_registry()
    print(f"📜 Updated docs/models-provenance.yaml for {n_prov} models.")
    print(json.dumps({"baked_count": len(results), "provenance_count": n_prov}, indent=2))


if __name__ == "__main__":
    main()
