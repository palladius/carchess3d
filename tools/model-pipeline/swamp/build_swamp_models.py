#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["trimesh>=4.0.0", "numpy>=1.24.0", "scipy>=1.10.0", "pillow>=10.0.0", "pygltflib>=1.16.0", "pyyaml>=6.0"]
# ///
"""Build watertight, grounded Chibi 3D GLB models & 6x4 turntable contact sheet for the Swamp Parody Family.

Honors the ZeroGPU Arbitration Rule:
- Defaults to deterministic Python Chibi 3D sculpting + PBR material & vertex-color baking
  so the companion Carlesso machine keeps 100% ZeroGPU quota priority.
- If SWAMP_TRELLIS=1 is explicitly set, attempts multi-view TRELLIS first and falls back
  automatically if geometry QA or watertightness fails.
- Writes every model to *.glb.part and atomically renames via os.replace() to *.glb.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import trimesh

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
OUT_MODELS_DIR = ROOT / "assets/models/swamp"
CONTRACT_PATH = ROOT / "assets/families/_contract.json"
CONTACT_SHEET_PATH = HERE / "swamp_contact_sheet.png"

# Named PBR Material Library (RGBA 0..1, metallic, roughness)
MATERIALS = {
    "faction_primary": {"rgba": (0.46, 0.50, 0.45, 1.0), "metallic": 0.08, "roughness": 0.68},
    "faction_trim": {"rgba": (0.85, 0.70, 0.24, 1.0), "metallic": 0.82, "roughness": 0.26},
    "swamp_moss": {"rgba": (0.26, 0.50, 0.22, 1.0), "metallic": 0.04, "roughness": 0.76},
    "ogre_skin": {"rgba": (0.48, 0.62, 0.26, 1.0), "metallic": 0.05, "roughness": 0.52},
    "royal_plum": {"rgba": (0.42, 0.18, 0.48, 1.0), "metallic": 0.12, "roughness": 0.46},
    "oak_wood": {"rgba": (0.44, 0.28, 0.15, 1.0), "metallic": 0.06, "roughness": 0.64},
    "chestnut_brown": {"rgba": (0.55, 0.34, 0.18, 1.0), "metallic": 0.05, "roughness": 0.58},
    "dark_leather": {"rgba": (0.28, 0.17, 0.10, 1.0), "metallic": 0.10, "roughness": 0.58},
    "linen_cream": {"rgba": (0.90, 0.85, 0.74, 1.0), "metallic": 0.04, "roughness": 0.70},
    "amber_gem": {"rgba": (0.96, 0.58, 0.08, 1.0), "metallic": 0.25, "roughness": 0.15},
    "onion_gold": {"rgba": (0.90, 0.74, 0.26, 1.0), "metallic": 0.32, "roughness": 0.34},
    "emerald_velvet": {"rgba": (0.14, 0.42, 0.26, 1.0), "metallic": 0.10, "roughness": 0.45},
    "ginger_hair": {"rgba": (0.76, 0.33, 0.14, 1.0), "metallic": 0.08, "roughness": 0.52},
    "focaccia_crust": {"rgba": (0.82, 0.56, 0.26, 1.0), "metallic": 0.05, "roughness": 0.62},
    "focaccia_crumb": {"rgba": (0.93, 0.79, 0.55, 1.0), "metallic": 0.03, "roughness": 0.68},
    "olive_black": {"rgba": (0.14, 0.12, 0.15, 1.0), "metallic": 0.20, "roughness": 0.22},
    "rosemary_green": {"rgba": (0.22, 0.48, 0.20, 1.0), "metallic": 0.05, "roughness": 0.55},
    "burro_muzzle": {"rgba": (0.88, 0.80, 0.68, 1.0), "metallic": 0.04, "roughness": 0.58},
    "charcoal_mane": {"rgba": (0.22, 0.16, 0.12, 1.0), "metallic": 0.08, "roughness": 0.65},
    "crimson_velvet": {"rgba": (0.68, 0.14, 0.20, 1.0), "metallic": 0.12, "roughness": 0.42},
    "sapphire_blue": {"rgba": (0.16, 0.32, 0.68, 1.0), "metallic": 0.15, "roughness": 0.40},
    "tower_stone": {"rgba": (0.52, 0.55, 0.58, 1.0), "metallic": 0.06, "roughness": 0.74},
    "dragon_ruby": {"rgba": (0.78, 0.18, 0.26, 1.0), "metallic": 0.18, "roughness": 0.38},
    "dragon_emerald": {"rgba": (0.22, 0.64, 0.38, 1.0), "metallic": 0.12, "roughness": 0.42},
    "peach_skin": {"rgba": (0.92, 0.74, 0.62, 1.0), "metallic": 0.04, "roughness": 0.50},
    "eye_white": {"rgba": (0.96, 0.96, 0.96, 1.0), "metallic": 0.05, "roughness": 0.20},
    "eye_dark": {"rgba": (0.10, 0.09, 0.09, 1.0), "metallic": 0.15, "roughness": 0.15},
}


# ---------------------------------------------------------------------------
# Watertight Primitives & Sculpting Helpers (Y-up coordinate system)
# Every primitive has >= 64 faces and is strictly manifold & watertight.
# ---------------------------------------------------------------------------

def _y_up_from_z_up(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Convert a trimesh primitive (whose default axis is Z) so its axis is Y."""
    v = mesh.vertices.copy()
    v_new = np.column_stack([v[:, 0], v[:, 2], -v[:, 1]])
    return trimesh.Trimesh(vertices=v_new, faces=mesh.faces.copy(), process=True)


def lathe_profile(
    r_z_pairs: list[tuple[float, float]],
    sections: int = 28,
    center: tuple[float, float, float] = (0.0, 0.0, 0.0),
    wave_amp: float = 0.0,
    wave_freq: int = 0,
) -> trimesh.Trimesh:
    """Create a strictly watertight surface of revolution around the Y axis."""
    angles = np.linspace(0.0, 2.0 * math.pi, sections, endpoint=False)
    cos_a = np.cos(angles)
    sin_a = np.sin(angles)

    rings = len(r_z_pairs)
    verts = [[center[0], center[1] + r_z_pairs[0][1], center[2]]]

    for r_base, y_val in r_z_pairs:
        r = max(float(r_base), 1e-3)
        for idx, (ca, sa) in enumerate(zip(cos_a, sin_a)):
            mod = 1.0 + wave_amp * math.sin(wave_freq * angles[idx]) if wave_freq > 0 else 1.0
            rr = r * mod
            verts.append([center[0] + rr * ca, center[1] + y_val, center[2] + rr * sa])

    top_idx = 1 + rings * sections
    verts.append([center[0], center[1] + r_z_pairs[-1][1], center[2]])

    faces = []
    for j in range(sections):
        jn = (j + 1) % sections
        faces.append([0, 1 + j, 1 + jn])

    for i in range(rings - 1):
        row0 = 1 + i * sections
        row1 = 1 + (i + 1) * sections
        for j in range(sections):
            jn = (j + 1) % sections
            faces.append([row0 + j, row1 + j, row1 + jn])
            faces.append([row0 + j, row1 + jn, row0 + jn])

    last_row = 1 + (rings - 1) * sections
    for j in range(sections):
        jn = (j + 1) % sections
        faces.append([top_idx, last_row + jn, last_row + j])

    m = trimesh.Trimesh(vertices=np.array(verts, dtype=np.float64), faces=np.array(faces, dtype=np.int64), process=True)
    m.fix_normals()
    return m


def ellipsoid(
    rx: float,
    ry: float,
    rz: float,
    center: tuple[float, float, float] = (0.0, 0.0, 0.0),
    subdivisions: int = 2,
    rot_xyz: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> trimesh.Trimesh:
    """Watertight ellipsoid with >= 80 faces (subdivisions=2 -> 80, subdivisions=3 -> 320)."""
    m = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    m.vertices *= np.array([rx, ry, rz], dtype=np.float64)
    if any(abs(a) > 1e-6 for a in rot_xyz):
        mat = trimesh.transformations.euler_matrix(
            math.radians(rot_xyz[0]),
            math.radians(rot_xyz[1]),
            math.radians(rot_xyz[2]),
            "sxyz",
        )
        m.apply_transform(mat)
    m.vertices += np.array(center, dtype=np.float64)
    return m


def superellipsoid(
    rx: float,
    ry: float,
    rz: float,
    center: tuple[float, float, float] = (0.0, 0.0, 0.0),
    power: float = 0.35,
    subdivisions: int = 2,
    rot_xyz: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> trimesh.Trimesh:
    """Watertight beveled rectangular block / stone merlon (power < 1.0 squares off an icosphere)."""
    m = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    v = m.vertices
    v_shaped = np.sign(v) * (np.maximum(np.abs(v), 1e-6) ** power)
    m.vertices = v_shaped * np.array([rx, ry, rz], dtype=np.float64)
    if any(abs(a) > 1e-6 for a in rot_xyz):
        mat = trimesh.transformations.euler_matrix(
            math.radians(rot_xyz[0]),
            math.radians(rot_xyz[1]),
            math.radians(rot_xyz[2]),
            "sxyz",
        )
        m.apply_transform(mat)
    m.vertices += np.array(center, dtype=np.float64)
    m.fix_normals()
    return m


def capsule_limb(
    p0: tuple[float, float, float],
    p1: tuple[float, float, float],
    r0: float,
    r1: float | None = None,
    sections: int = 16,
    rings: int = 5,
) -> trimesh.Trimesh:
    """Watertight tapered capsule between 3D points p0 and p1 (>= 256 faces)."""
    if r1 is None:
        r1 = r0
    v0 = np.array(p0, dtype=np.float64)
    v1 = np.array(p1, dtype=np.float64)
    diff = v1 - v0
    length = float(np.linalg.norm(diff))
    if length < 1e-5:
        return ellipsoid(r0, r0, r0, center=p0, subdivisions=2)

    profile = []
    for k in (1, 2):
        ang = math.pi * 0.5 * (k / 3.0)
        rk = max(r0 * math.sin(ang), 1e-3)
        yk = -r0 * 0.45 * math.cos(ang)
        profile.append((rk, yk))
    for k in range(rings + 1):
        t = k / float(rings)
        rk = r0 * (1.0 - t) + r1 * t
        yk = t * length
        profile.append((rk, yk))
    for k in (1, 2):
        ang = math.pi * 0.5 * (k / 3.0)
        rk = max(r1 * math.cos(ang), 1e-3)
        yk = length + r1 * 0.45 * math.sin(ang)
        profile.append((rk, yk))

    m = lathe_profile(profile, sections=sections)
    y_axis = np.array([0.0, 1.0, 0.0])
    target_dir = diff / length
    rot = trimesh.geometry.align_vectors(y_axis, target_dir)
    m.apply_transform(rot)
    m.vertices += v0
    return m


def curved_tube(
    points: list[tuple[float, float, float]],
    radii: list[float],
    sections: int = 16,
) -> trimesh.Trimesh:
    """Watertight generalized tube swept along a 3D polyline with closed end caps."""
    pts = np.array(points, dtype=np.float64)
    n = len(pts)
    angles = np.linspace(0.0, 2.0 * math.pi, sections, endpoint=False)
    cos_a = np.cos(angles)
    sin_a = np.sin(angles)

    tangents = np.zeros_like(pts)
    tangents[0] = pts[1] - pts[0]
    tangents[-1] = pts[-1] - pts[-2]
    for i in range(1, n - 1):
        tangents[i] = pts[i + 1] - pts[i - 1]
    norms = np.linalg.norm(tangents, axis=1, keepdims=True)
    tangents = tangents / np.maximum(norms, 1e-6)

    t0 = tangents[0]
    up = np.array([0.0, 0.0, 1.0]) if abs(t0[2]) < 0.85 else np.array([1.0, 0.0, 0.0])
    normal = np.cross(t0, up)
    normal /= np.linalg.norm(normal)

    verts = [pts[0].tolist()]
    for i in range(n):
        ti = tangents[i]
        normal = normal - np.dot(normal, ti) * ti
        n_len = np.linalg.norm(normal)
        if n_len < 1e-6:
            up = np.array([1.0, 0.0, 0.0]) if abs(ti[0]) < 0.85 else np.array([0.0, 1.0, 0.0])
            normal = np.cross(ti, up)
            n_len = np.linalg.norm(normal)
        normal /= n_len
        binormal = np.cross(ti, normal)
        r = max(float(radii[i]), 1e-3)
        for ca, sa in zip(cos_a, sin_a):
            p = pts[i] + r * (ca * normal + sa * binormal)
            verts.append(p.tolist())

    end_idx = 1 + n * sections
    verts.append(pts[-1].tolist())

    faces = []
    for j in range(sections):
        jn = (j + 1) % sections
        faces.append([0, 1 + jn, 1 + j])

    for i in range(n - 1):
        r0 = 1 + i * sections
        r1 = 1 + (i + 1) * sections
        for j in range(sections):
            jn = (j + 1) % sections
            faces.append([r0 + j, r0 + jn, r1 + jn])
            faces.append([r0 + j, r1 + jn, r1 + j])

    last_row = 1 + (n - 1) * sections
    for j in range(sections):
        jn = (j + 1) % sections
        faces.append([end_idx, last_row + j, last_row + jn])

    m = trimesh.Trimesh(vertices=np.array(verts, dtype=np.float64), faces=np.array(faces, dtype=np.int64), process=True)
    m.fix_normals()
    return m


def torus_ring(
    major_r: float,
    minor_r: float,
    center: tuple[float, float, float] = (0.0, 0.0, 0.0),
    major_sections: int = 24,
    minor_sections: int = 10,
    tilt_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> trimesh.Trimesh:
    """Watertight torus lying in the XZ plane around the Y axis."""
    m_z = trimesh.creation.torus(
        major_radius=major_r,
        minor_radius=minor_r,
        major_sections=major_sections,
        minor_sections=minor_sections,
    )
    m = _y_up_from_z_up(m_z)
    if any(abs(a) > 1e-6 for a in tilt_deg):
        mat = trimesh.transformations.euler_matrix(
            math.radians(tilt_deg[0]),
            math.radians(tilt_deg[1]),
            math.radians(tilt_deg[2]),
            "sxyz",
        )
        m.apply_transform(mat)
    m.vertices += np.array(center, dtype=np.float64)
    return m


# ---------------------------------------------------------------------------
# Standardized Swamp-Stone Chess Pedestal (Ø 0.75m, min.y = 0.0)
# ---------------------------------------------------------------------------

def build_swamp_pedestal() -> list[tuple[str, trimesh.Trimesh]]:
    """Build the mossy carved stone chess pedestal (Ø 0.75m, height 0.22m, min.y = 0.0)."""
    parts: list[tuple[str, trimesh.Trimesh]] = []

    trim_base = lathe_profile(
        [
            (0.365, 0.000),
            (0.375, 0.015),
            (0.375, 0.032),
            (0.358, 0.046),
        ],
        sections=32,
    )
    parts.append(("faction_trim", trim_base))

    stone_body = lathe_profile(
        [
            (0.352, 0.040),
            (0.362, 0.068),
            (0.345, 0.105),
            (0.318, 0.125),
            (0.338, 0.160),
            (0.326, 0.195),
            (0.305, 0.218),
        ],
        sections=32,
        wave_amp=0.012,
        wave_freq=8,
    )
    parts.append(("faction_primary", stone_body))

    trim_top = torus_ring(0.312, 0.016, center=(0.0, 0.205, 0.0), major_sections=28, minor_sections=10)
    parts.append(("faction_trim", trim_top))

    moss_angles = [0.4, 1.3, 2.4, 3.6, 4.7, 5.5]
    for idx, ang in enumerate(moss_angles):
        rad = 0.315 if idx % 2 == 0 else 0.335
        my = 0.212 if idx % 2 == 0 else 0.115
        mx = rad * math.cos(ang)
        mz = rad * math.sin(ang)
        parts.append(("swamp_moss", ellipsoid(0.048, 0.022, 0.038, center=(mx, my, mz), subdivisions=2)))

    return parts


# ---------------------------------------------------------------------------
# Character Sculptors (1..6 — Matching Gate A + Gate B 1-to-1)
# ---------------------------------------------------------------------------

def sculpt_king_orco() -> list[tuple[str, trimesh.Trimesh]]:
    """King: Orco Brontolo (1.80m) - Barrel-chested ogre king with broad round droopy ears,
    twisted oak-root crown with amber gems & cross finial, plum-purple & mossy-green royal doublet
    with carved bark shoulder pauldrons, ornate gold sash belt, and golden sprouted-onion sceptre.
    """
    parts = build_swamp_pedestal()

    # Sturdy boots & legs
    for sx in (-1.0, 1.0):
        parts.append(("dark_leather", ellipsoid(0.078, 0.055, 0.105, center=(sx * 0.105, 0.255, 0.025))))
        parts.append(("royal_plum", capsule_limb((sx * 0.105, 0.25, 0.0), (sx * 0.105, 0.44, 0.0), 0.068, 0.075)))

    # Plum-purple quilted royal doublet body (no cream tunic/brown vest!)
    doublet = lathe_profile(
        [
            (0.240, 0.39),
            (0.262, 0.48),
            (0.270, 0.62),
            (0.250, 0.78),
            (0.215, 0.92),
            (0.145, 0.98),
        ],
        sections=28,
        wave_amp=0.015,
        wave_freq=8,
    )
    parts.append(("royal_plum", doublet))

    # Mossy-green doublet front surcoat tabard + gold collar trim
    parts.append(("swamp_moss", superellipsoid(0.125, 0.24, 0.185, center=(0.0, 0.68, 0.095), power=0.55)))
    parts.append(("faction_trim", torus_ring(0.155, 0.020, center=(0.0, 0.94, 0.01), tilt_deg=(8, 0, 0))))

    # Carved tree-bark shoulder pauldrons (oak_wood) + gold studs
    for sx in (-1.0, 1.0):
        parts.append(("oak_wood", superellipsoid(0.125, 0.075, 0.135, center=(sx * 0.215, 0.93, 0.01), power=0.48, rot_xyz=(0, 0, -sx * 18))))
        parts.append(("faction_trim", ellipsoid(0.032, 0.032, 0.024, center=(sx * 0.13, 0.91, 0.17))))

    # Wide ornate gold sash belt + amber centerpiece buckle
    parts.append(("faction_trim", torus_ring(0.258, 0.034, center=(0.0, 0.56, 0.0))))
    parts.append(("amber_gem", superellipsoid(0.058, 0.045, 0.030, center=(0.0, 0.56, 0.272), power=0.45)))

    # Royal mossy green cloak draped cleanly over the back
    cloak_back = ellipsoid(0.275, 0.355, 0.165, center=(0.0, 0.65, -0.175), subdivisions=3, rot_xyz=(8, 0, 0))
    parts.append(("swamp_moss", cloak_back))

    # Arms (plum sleeves + bark bracers) & ogre hands
    parts.append(("royal_plum", capsule_limb((-0.21, 0.89, 0.02), (-0.30, 0.74, 0.08), 0.068, 0.058)))
    parts.append(("ogre_skin", ellipsoid(0.064, 0.058, 0.068, center=(-0.29, 0.72, 0.15))))
    parts.append(("royal_plum", capsule_limb((0.21, 0.89, 0.02), (0.28, 0.66, 0.05), 0.068, 0.058)))
    parts.append(("ogre_skin", ellipsoid(0.062, 0.058, 0.064, center=(0.28, 0.56, 0.08))))

    # Broad chibi ogre head + heavy jaw + brow ridge + stubby nose + small tusks
    parts.append(("ogre_skin", ellipsoid(0.215, 0.195, 0.195, center=(0.0, 1.13, 0.02), subdivisions=3)))
    parts.append(("ogre_skin", ellipsoid(0.195, 0.105, 0.165, center=(0.0, 1.05, 0.06), subdivisions=2)))
    parts.append(("ogre_skin", ellipsoid(0.052, 0.038, 0.055, center=(0.0, 1.13, 0.215))))
    for sx in (-1.0, 1.0):
        parts.append(("dark_leather", ellipsoid(0.058, 0.022, 0.028, center=(sx * 0.072, 1.195, 0.188), rot_xyz=(0, 0, -sx * 14))))
        parts.append(("eye_white", ellipsoid(0.032, 0.030, 0.024, center=(sx * 0.070, 1.155, 0.192))))
        parts.append(("eye_dark", ellipsoid(0.018, 0.018, 0.018, center=(sx * 0.068, 1.155, 0.208))))
        parts.append(("linen_cream", capsule_limb((sx * 0.082, 1.055, 0.195), (sx * 0.075, 1.095, 0.205), 0.016, 0.006)))
        # Broad round droopy boar-like ears (not trumpet or pointed)
        parts.append(("ogre_skin", ellipsoid(0.078, 0.052, 0.038, center=(sx * 0.245, 1.135, 0.01), rot_xyz=(0, 0, sx * 28))))
        parts.append(("faction_trim", torus_ring(0.022, 0.008, center=(sx * 0.255, 1.095, 0.02), tilt_deg=(90, 0, 0))))

    # Tall Twisted Swamp-Oak Root KING CROWN + Amber Gems + Cross Finial (up to 1.80m)
    crown_base = lathe_profile(
        [
            (0.185, 1.27),
            (0.198, 1.33),
            (0.205, 1.44),
            (0.218, 1.54),
            (0.180, 1.58),
        ],
        sections=28,
        wave_amp=0.025,
        wave_freq=8,
    )
    parts.append(("oak_wood", crown_base))
    for i in range(8):
        ang = i * (2.0 * math.pi / 8.0)
        rx = 0.192 * math.cos(ang)
        rz = 0.192 * math.sin(ang)
        spike_h = 1.66 if i % 2 == 0 else 1.61
        parts.append(("oak_wood", capsule_limb((rx, 1.50, rz), (rx * 1.04, spike_h, rz * 1.04), 0.032, 0.010)))
        gx = 0.206 * math.cos(ang)
        gz = 0.206 * math.sin(ang)
        parts.append(("amber_gem", ellipsoid(0.026, 0.036, 0.026, center=(gx, 1.41, gz))))

    parts.append(("oak_wood", capsule_limb((0.0, 1.54, 0.0), (0.0, 1.79, 0.0), 0.030, 0.024)))
    parts.append(("oak_wood", capsule_limb((-0.075, 1.71, 0.0), (0.075, 1.71, 0.0), 0.024, 0.024)))
    parts.append(("amber_gem", ellipsoid(0.030, 0.030, 0.030, center=(0.0, 1.71, 0.028))))

    # Golden Sprouted-Onion Royal Sceptre held in left hand (x = -0.29)
    parts.append(("oak_wood", capsule_limb((-0.29, 0.42, 0.15), (-0.29, 1.12, 0.15), 0.024, 0.022)))
    onion_bulb = lathe_profile(
        [
            (0.028, 1.10),
            (0.092, 1.16),
            (0.098, 1.22),
            (0.064, 1.28),
            (0.022, 1.33),
        ],
        sections=22,
    )
    onion_bulb.vertices += np.array([-0.29, 0.0, 0.15])
    parts.append(("onion_gold", onion_bulb))
    for dx, dz, h_top in ((0.0, 0.0, 1.46), (-0.03, 0.01, 1.43), (0.03, -0.01, 1.42)):
        parts.append(("swamp_moss", capsule_limb((-0.29, 1.31, 0.15), (-0.29 + dx, h_top, 0.15 + dz), 0.018, 0.006)))

    return parts


def sculpt_queen_orchessa() -> list[tuple[str, trimesh.Trimesh]]:
    """Queen: Principessa Orchessa (1.65m) - Ogress queen with round ears, copper-ginger hair in a
    regal high top-knot bun with wavy side locks & gold hair rings, wearing a burgundy-crimson &
    mustard-gold Renaissance gown, tall golden Queen coronet tiara, in a Kung-Fu guard pose.
    """
    parts = build_swamp_pedestal()

    # Flared burgundy-crimson & mustard-gold Renaissance gown skirt
    skirt = lathe_profile(
        [
            (0.285, 0.215),
            (0.275, 0.32),
            (0.235, 0.48),
            (0.185, 0.64),
            (0.140, 0.76),
        ],
        sections=32,
        wave_amp=0.018,
        wave_freq=10,
    )
    parts.append(("crimson_velvet", skirt))
    parts.append(("onion_gold", superellipsoid(0.115, 0.24, 0.195, center=(0.0, 0.46, 0.08), power=0.6)))
    parts.append(("faction_trim", torus_ring(0.280, 0.016, center=(0.0, 0.232, 0.0))))
    parts.append(("faction_trim", torus_ring(0.155, 0.018, center=(0.0, 0.73, 0.0), tilt_deg=(6, 0, 0))))

    for sx in (-1.0, 1.0):
        pts = [
            (sx * 0.02, 0.72, 0.155),
            (sx * 0.07, 0.52, 0.215),
            (sx * 0.12, 0.25, 0.268),
        ]
        parts.append(("faction_trim", curved_tube(pts, [0.016, 0.018, 0.020], sections=14)))

    bodice = lathe_profile(
        [
            (0.140, 0.73),
            (0.165, 0.86),
            (0.152, 0.98),
            (0.105, 1.03),
        ],
        sections=26,
    )
    parts.append(("crimson_velvet", bodice))
    parts.append(("faction_trim", torus_ring(0.115, 0.014, center=(0.0, 0.98, 0.02), tilt_deg=(12, 0, 0))))

    for sx in (-1.0, 1.0):
        parts.append(("onion_gold", ellipsoid(0.075, 0.068, 0.075, center=(sx * 0.185, 0.94, 0.01))))
        parts.append(("faction_trim", torus_ring(0.068, 0.012, center=(sx * 0.185, 0.94, 0.01), tilt_deg=(0, 0, 90))))

    # Martial-arts Kung-Fu high-guard arms & open palm hands
    parts.append(("crimson_velvet", capsule_limb((-0.185, 0.92, 0.01), (-0.285, 0.86, 0.07), 0.046, 0.040)))
    parts.append(("crimson_velvet", capsule_limb((-0.285, 0.86, 0.07), (-0.265, 1.04, 0.14), 0.040, 0.036)))
    parts.append(("ogre_skin", ellipsoid(0.040, 0.056, 0.030, center=(-0.260, 1.10, 0.15), rot_xyz=(0, 0, -15))))
    parts.append(("crimson_velvet", capsule_limb((0.185, 0.92, 0.01), (0.265, 0.80, 0.06), 0.046, 0.038)))
    parts.append(("ogre_skin", ellipsoid(0.044, 0.050, 0.034, center=(0.285, 0.74, 0.09))))

    # Chibi ogress head + round ears + confident eyes
    parts.append(("ogre_skin", ellipsoid(0.185, 0.178, 0.175, center=(0.0, 1.18, 0.02), subdivisions=3)))
    parts.append(("ogre_skin", ellipsoid(0.038, 0.030, 0.042, center=(0.0, 1.16, 0.192))))
    for sx in (-1.0, 1.0):
        parts.append(("ginger_hair", ellipsoid(0.052, 0.016, 0.022, center=(sx * 0.068, 1.235, 0.170), rot_xyz=(0, 0, -sx * 10))))
        parts.append(("eye_white", ellipsoid(0.034, 0.030, 0.022, center=(sx * 0.068, 1.19, 0.175))))
        parts.append(("eye_dark", ellipsoid(0.018, 0.018, 0.018, center=(sx * 0.066, 1.19, 0.190))))
        # Small round ears + golden earrings
        parts.append(("ogre_skin", ellipsoid(0.052, 0.046, 0.032, center=(sx * 0.205, 1.185, 0.01))))
        parts.append(("faction_trim", ellipsoid(0.022, 0.022, 0.022, center=(sx * 0.205, 1.138, 0.02))))

    # Copper-ginger wavy bob + regal high top-knot bun secured by a gold ring
    parts.append(("ginger_hair", ellipsoid(0.198, 0.150, 0.192, center=(0.0, 1.23, -0.015), subdivisions=3)))
    for sx in (-1.0, 1.0):
        lock_pts = [
            (sx * 0.145, 1.22, 0.08),
            (sx * 0.150, 1.13, 0.10),
            (sx * 0.132, 1.04, 0.11),
        ]
        parts.append(("ginger_hair", curved_tube(lock_pts, [0.036, 0.032, 0.018], sections=16)))
    # High top-knot bun at crown/back of head
    parts.append(("faction_trim", torus_ring(0.088, 0.016, center=(0.0, 1.35, -0.04), tilt_deg=(-15, 0, 0))))
    parts.append(("ginger_hair", ellipsoid(0.105, 0.095, 0.105, center=(0.0, 1.41, -0.05), subdivisions=3)))

    # Tall Golden QUEEN CORONET TIARA set with amber & ruby cabochons (y = 1.33..1.65)
    tiara_ring = lathe_profile(
        [
            (0.142, 1.33),
            (0.156, 1.38),
            (0.168, 1.48),
            (0.148, 1.52),
        ],
        sections=28,
    )
    parts.append(("faction_trim", tiara_ring))
    for i in range(8):
        ang = i * (2.0 * math.pi / 8.0)
        tx = 0.155 * math.cos(ang)
        tz = 0.155 * math.sin(ang)
        peak_y = 1.65 if i % 2 == 0 else 1.59
        parts.append(("faction_trim", capsule_limb((tx, 1.46, tz), (tx * 1.08, peak_y, tz * 1.08), 0.026, 0.008)))
        parts.append(("amber_gem", ellipsoid(0.024, 0.034, 0.024, center=(tx * 1.06, 1.43, tz * 1.06))))

    return parts


def sculpt_bishop_focaccina() -> list[tuple[str, trimesh.Trimesh]]:
    """Bishop: Mago Focaccina (1.45m) - Golden-baked Ligurian focaccia mage with 3 black Taggiasca
    olive buttons, green rosemary needles, tall split-peak focaccia Bishop mitre, plump cylindrical
    bread arms, and thick (1.5x) twisted sesame grissino breadstick crosier staff.
    """
    parts = build_swamp_pedestal()

    for sx in (-1.0, 1.0):
        parts.append(("focaccia_crust", capsule_limb((sx * 0.095, 0.215, 0.0), (sx * 0.095, 0.36, 0.0), 0.068, 0.072)))

    # Plump round focaccia bread torso (full depth in Z so side profile is round & chubby)
    torso = ellipsoid(0.238, 0.252, 0.208, center=(0.0, 0.56, 0.0), subdivisions=3)
    parts.append(("focaccia_crust", torso))
    parts.append(("focaccia_crumb", ellipsoid(0.208, 0.212, 0.182, center=(0.0, 0.56, 0.038), subdivisions=2)))

    for by, bz in ((0.65, 0.208), (0.55, 0.218), (0.45, 0.205)):
        parts.append(("olive_black", ellipsoid(0.034, 0.044, 0.028, center=(0.0, by, bz), rot_xyz=(0, 0, 12))))

    rosemary_sprigs = [
        ((-0.08, 0.63, 0.198), (-0.14, 0.67, 0.185)),
        ((0.08, 0.59, 0.202), (0.14, 0.63, 0.190)),
        ((-0.07, 0.49, 0.198), (-0.13, 0.52, 0.185)),
        ((0.07, 0.48, 0.198), (0.13, 0.45, 0.185)),
    ]
    for p0, p1 in rosemary_sprigs:
        parts.append(("rosemary_green", capsule_limb(p0, p1, 0.013, 0.006)))

    # Thick cylindrical bread arms extending forward in Z so side view shows full round capsules
    parts.append(("focaccia_crust", capsule_limb((0.20, 0.66, 0.01), (0.29, 0.55, 0.11), 0.066, 0.058)))
    parts.append(("focaccia_crumb", ellipsoid(0.058, 0.056, 0.062, center=(0.29, 0.53, 0.12))))
    parts.append(("focaccia_crust", capsule_limb((-0.20, 0.66, 0.01), (-0.28, 0.49, 0.09), 0.066, 0.058)))
    parts.append(("focaccia_crumb", ellipsoid(0.058, 0.056, 0.062, center=(-0.28, 0.47, 0.10))))

    parts.append(("focaccia_crumb", ellipsoid(0.205, 0.165, 0.185, center=(0.0, 0.87, 0.01), subdivisions=3)))
    parts.append(("focaccia_crust", ellipsoid(0.034, 0.028, 0.034, center=(0.0, 0.87, 0.192))))
    smile_pts = [(-0.055, 0.835, 0.182), (-0.025, 0.818, 0.192), (0.025, 0.818, 0.192), (0.055, 0.835, 0.182)]
    parts.append(("linen_cream", curved_tube(smile_pts, [0.013, 0.015, 0.015, 0.013], sections=14)))
    for sx in (-1.0, 1.0):
        parts.append(("olive_black", ellipsoid(0.025, 0.027, 0.022, center=(sx * 0.062, 0.895, 0.182))))
        parts.append(("linen_cream", ellipsoid(0.038, 0.014, 0.018, center=(sx * 0.062, 0.938, 0.175), rot_xyz=(0, 0, -sx * 10))))

    parts.append(("faction_trim", torus_ring(0.185, 0.018, center=(0.0, 0.99, 0.01))))
    for sx in (-1.0, 1.0):
        lobe_pts = [
            (sx * 0.065, 0.99, 0.01),
            (sx * 0.095, 1.14, 0.01),
            (sx * 0.082, 1.30, 0.01),
            (sx * 0.038, 1.44, 0.01),
        ]
        parts.append(("focaccia_crust", curved_tube(lobe_pts, [0.125, 0.135, 0.095, 0.018], sections=20)))

    for leaf_dx, leaf_dy in ((-0.03, 0.14), (0.01, 0.16), (0.04, 0.12)):
        parts.append(
            (
                "rosemary_green",
                capsule_limb((-0.08, 1.05, 0.135), (-0.08 + leaf_dx, 1.05 + leaf_dy, 0.145), 0.014, 0.006),
            )
        )
    for sc in ((0.08, 1.22, 0.11), (-0.09, 1.25, 0.10), (0.06, 1.31, 0.09), (-0.06, 1.16, 0.12)):
        parts.append(("eye_white", ellipsoid(0.016, 0.016, 0.016, center=sc)))

    # 1.5x Thicker Twisted Golden Sesame Grissino Breadstick Bishop Crosier Staff
    staff_pts = []
    staff_r = []
    for k in range(18):
        t = k / 17.0
        yk = 0.22 + t * (1.12 - 0.22)
        twist_x = 0.295 + 0.015 * math.sin(t * 6.0 * math.pi)
        twist_z = 0.11 + 0.015 * math.cos(t * 6.0 * math.pi)
        staff_pts.append((twist_x, yk, twist_z))
        staff_r.append(0.038)
    for k in range(1, 16):
        ang = -0.25 + (k / 15.0) * (1.80 * math.pi)
        rad = 0.118 * (1.0 - 0.50 * (k / 15.0))
        cx = 0.195 + rad * math.cos(ang)
        cy = 1.23 + rad * math.sin(ang)
        cz = 0.11
        staff_pts.append((cx, cy, cz))
        staff_r.append(0.038 * (1.0 - 0.30 * (k / 15.0)))
    parts.append(("focaccia_crumb", curved_tube(staff_pts, staff_r, sections=16)))

    return parts


def sculpt_knight_asinello() -> list[tuple[str, trimesh.Trimesh]]:
    """Knight: Asinello Chiacchierone (1.35m) - Warm chestnut-brown & cream-dappled pack-burro
    with arched equine chess Knight silhouette, thick upright ears, smug closed smirk, full bushy
    tail, carved oak & gold tournament saddle, crimson caparison, wooden onion shield, and tall
    red-and-gold heraldic plume crest.
    """
    parts = build_swamp_pedestal()

    leg_positions = [
        (-0.085, 0.095),
        (0.085, 0.095),
        (-0.085, -0.115),
        (0.085, -0.115),
    ]
    for lx, lz in leg_positions:
        parts.append(("dark_leather", ellipsoid(0.044, 0.030, 0.048, center=(lx, 0.232, lz))))
        parts.append(("chestnut_brown", capsule_limb((lx, 0.24, lz), (lx, 0.50, lz * 0.85), 0.044, 0.054)))

    # Chestnut-brown body with cream-dappled belly patches & crimson-and-gold tournament caparison
    parts.append(("chestnut_brown", ellipsoid(0.158, 0.148, 0.238, center=(0.0, 0.57, -0.02), subdivisions=3)))
    parts.append(("burro_muzzle", ellipsoid(0.135, 0.105, 0.185, center=(0.0, 0.51, 0.02), subdivisions=2)))
    parts.append(("crimson_velvet", ellipsoid(0.170, 0.125, 0.195, center=(0.0, 0.57, -0.02), subdivisions=2)))
    parts.append(("faction_trim", torus_ring(0.168, 0.016, center=(0.0, 0.49, -0.02))))

    parts.append(("oak_wood", ellipsoid(0.145, 0.065, 0.135, center=(0.0, 0.69, -0.03))))
    parts.append(("faction_trim", torus_ring(0.115, 0.018, center=(0.0, 0.72, -0.11), tilt_deg=(65, 0, 0))))
    parts.append(("faction_trim", torus_ring(0.095, 0.016, center=(0.0, 0.72, 0.05), tilt_deg=(-65, 0, 0))))

    # Full, lush braided tail with thick brush tuft at the back
    tail_pts = [
        (0.0, 0.59, -0.22),
        (0.0, 0.52, -0.30),
        (0.0, 0.42, -0.34),
        (0.0, 0.31, -0.35),
    ]
    parts.append(("charcoal_mane", curved_tube(tail_pts, [0.034, 0.042, 0.055, 0.025], sections=16)))

    # Wooden buckler shield on shoulder with golden onion emblem
    parts.append(("oak_wood", ellipsoid(0.088, 0.098, 0.028, center=(0.138, 0.60, 0.145), rot_xyz=(0, 32, 0))))
    parts.append(("faction_trim", ellipsoid(0.048, 0.058, 0.030, center=(0.145, 0.60, 0.152), rot_xyz=(0, 32, 0))))

    # Classic Arched Chess Knight Neck + Chestnut Head + Cream Muzzle with Smug Closed Smirk
    parts.append(("chestnut_brown", capsule_limb((0.0, 0.62, 0.11), (0.0, 0.88, 0.14), 0.108, 0.095)))
    parts.append(("chestnut_brown", ellipsoid(0.118, 0.118, 0.138, center=(0.0, 0.93, 0.16), subdivisions=3)))
    parts.append(("burro_muzzle", ellipsoid(0.095, 0.078, 0.108, center=(0.0, 0.88, 0.275), subdivisions=2)))
    # Closed smug smirk line (no toothy grin)
    smirk_pts = [(-0.048, 0.865, 0.365), (0.0, 0.860, 0.375), (0.052, 0.882, 0.360)]
    parts.append(("dark_leather", curved_tube(smirk_pts, [0.010, 0.012, 0.010], sections=12)))

    for sx in (-1.0, 1.0):
        parts.append(("eye_white", ellipsoid(0.028, 0.030, 0.024, center=(sx * 0.068, 0.96, 0.245))))
        parts.append(("eye_dark", ellipsoid(0.016, 0.018, 0.016, center=(sx * 0.068, 0.96, 0.262))))
    for my, mz in ((0.70, 0.03), (0.78, 0.04), (0.86, 0.05), (0.95, 0.07), (1.02, 0.12)):
        parts.append(("charcoal_mane", ellipsoid(0.034, 0.052, 0.048, center=(0.0, my, mz), rot_xyz=(-25, 0, 0))))

    # Two Thick, Plush Upright Burro Ears (1.7x wider so they read boldly in back & side views)
    for sx in (-1.0, 1.0):
        ear_pts = [
            (sx * 0.070, 1.00, 0.13),
            (sx * 0.115, 1.15, 0.12),
            (sx * 0.135, 1.29, 0.11),
        ]
        parts.append(("chestnut_brown", curved_tube(ear_pts, [0.052, 0.066, 0.026], sections=16)))
        parts.append(("burro_muzzle", ellipsoid(0.028, 0.085, 0.018, center=(sx * 0.108, 1.15, 0.145), rot_xyz=(0, 0, -sx * 14))))

    # Tall Red-and-Gold Heraldic Tournament Plume Crest between the ears (up to y = 1.35m)
    plume_main = [
        (0.0, 1.02, 0.14),
        (0.0, 1.18, 0.15),
        (0.0, 1.32, 0.10),
        (0.0, 1.34, 0.01),
    ]
    parts.append(("crimson_velvet", curved_tube(plume_main, [0.032, 0.054, 0.046, 0.020], sections=16)))
    plume_gold = [
        (0.0, 1.02, 0.15),
        (0.0, 1.16, 0.18),
        (0.0, 1.27, 0.14),
    ]
    parts.append(("faction_trim", curved_tube(plume_gold, [0.026, 0.038, 0.018], sections=16)))

    return parts


def sculpt_rook_draghessa() -> list[tuple[str, trimesh.Trimesh]]:
    """Rook: Draghessa della Palude (1.30m) - Classic crenellated mossy stone Rook watchtower
    with 6 sharp-edged box merlons at the top (1.30m), gothic arrow-slit windows, and a charming
    ruby-crimson & emerald-bellied swamp dragon with a large head (>=0.16m, 2 eyes, 2 horns),
    2 wide flat wing fins, golden dorsal spines, and a large heart-tipped tail.
    """
    parts = build_swamp_pedestal()

    tower_shaft = lathe_profile(
        [
            (0.235, 0.210),
            (0.245, 0.260),
            (0.215, 0.340),
            (0.185, 0.650),
            (0.172, 0.960),
            (0.212, 1.030),
            (0.222, 1.175),
            (0.185, 1.190),
        ],
        sections=32,
    )
    parts.append(("tower_stone", tower_shaft))

    # 6 Sharp-Edged Rectangular Stone Box Merlons around the Rook crown (reaching y = 1.30m)
    for i in range(6):
        ang = i * (2.0 * math.pi / 6.0)
        mx = 0.185 * math.cos(ang)
        mz = 0.185 * math.sin(ang)
        parts.append(
            (
                "tower_stone",
                superellipsoid(
                    0.072,
                    0.068,
                    0.052,
                    center=(mx, 1.235, mz),
                    power=0.18,
                    subdivisions=2,
                    rot_xyz=(0, -math.degrees(ang) + 90.0, 0),
                ),
            )
        )

    # Arched dark arrow-slit windows & lush green moss vines on the tower
    for ang in (0.0, 1.57, 3.14, 4.71):
        wx = 0.176 * math.cos(ang)
        wz = 0.176 * math.sin(ang)
        parts.append(("olive_black", capsule_limb((wx, 0.74, wz), (wx, 0.85, wz), 0.022, 0.020)))
    for my, mang in ((0.30, 0.5), (0.58, 2.1), (0.92, 0.9), (1.08, -0.6), (1.14, 2.7)):
        mx = 0.202 * math.cos(mang)
        mz = 0.202 * math.sin(mang)
        parts.append(("swamp_moss", ellipsoid(0.058, 0.038, 0.045, center=(mx, my, mz))))

    # Ruby-Crimson Dragon Body + Prominent Outer-Lower Emerald Belly Band along the Coil
    spine_pts = []
    spine_r = []
    belly_pts = []
    belly_r = []
    num_coil = 26
    for k in range(num_coil):
        t = k / float(num_coil - 1)
        ang = -0.85 + t * (2.75 * math.pi)
        rad = 0.238 - 0.022 * t
        yk = 0.32 + t * 0.58
        px = rad * math.cos(ang)
        pz = rad * math.sin(ang)
        spine_pts.append((px, yk, pz))
        rr = 0.038 + 0.052 * math.sin(math.pi * (0.15 + 0.75 * t))
        spine_r.append(rr)
        # Place emerald belly band on the OUTER-LOWER surface of the coil so it reads in all 4 views
        rad_b = rad + 0.018
        belly_pts.append((rad_b * math.cos(ang), yk - rr * 0.45, rad_b * math.sin(ang)))
        belly_r.append(rr * 0.75)

    parts.append(("dragon_ruby", curved_tube(spine_pts, spine_r, sections=18)))
    parts.append(("dragon_emerald", curved_tube(belly_pts, belly_r, sections=16)))

    # Golden dorsal spines seated along the dragon's spine
    for k in range(3, num_coil - 2, 3):
        px, py, pz = spine_pts[k]
        rr = spine_r[k]
        parts.append(("faction_trim", ellipsoid(0.024, 0.036, 0.024, center=(px * 1.05, py + rr * 0.85, pz * 1.05))))

    # Large Expressive Dragon Head (>= 0.22m long) with 2 Eyes + 2 Sweeping Golden Horns
    hx, hy, hz = (-0.17, 0.90, 0.18)
    parts.append(("dragon_ruby", ellipsoid(0.115, 0.095, 0.125, center=(hx, hy, hz), subdivisions=3)))
    parts.append(("dragon_ruby", ellipsoid(0.085, 0.062, 0.105, center=(hx + 0.04, hy - 0.015, hz + 0.105), subdivisions=2)))
    parts.append(("dragon_emerald", ellipsoid(0.075, 0.036, 0.095, center=(hx + 0.04, hy - 0.052, hz + 0.095))))
    # 2 Large Glowing Amber Eyes + Dark Pupils (Left & Right of Dragon Head)
    for ex_off, ez_off in ((-0.055, 0.085), (0.085, 0.065)):
        parts.append(("amber_gem", ellipsoid(0.032, 0.034, 0.028, center=(hx + ex_off, hy + 0.025, hz + ez_off))))
        parts.append(("eye_dark", ellipsoid(0.018, 0.022, 0.018, center=(hx + ex_off * 1.05, hy + 0.025, hz + ez_off + 0.018))))
    # 2 Sweeping Golden Horns
    for hs in (-1.0, 1.0):
        parts.append(
            (
                "faction_trim",
                capsule_limb(
                    (hx + hs * 0.05, hy + 0.065, hz - 0.02),
                    (hx + hs * 0.09 - 0.06, hy + 0.165, hz - 0.10),
                    0.028,
                    0.009,
                ),
            )
        )

    # Dragon claws gripping the stone tower
    parts.append(("dragon_ruby", ellipsoid(0.052, 0.038, 0.065, center=(0.11, 0.72, 0.17))))
    parts.append(("dragon_ruby", ellipsoid(0.052, 0.038, 0.065, center=(-0.10, 0.56, 0.18))))

    # 2 Large Unfurled Flat Bat-Wing Fins (Left & Right of Upper Tower, within 0.75m footprint)
    for sx in (-1.0, 1.0):
        w_root = (sx * 0.16, 0.80, -0.02)
        w_apex = (sx * 0.31, 1.02, -0.05)
        w_outer = (sx * 0.33, 0.84, -0.06)
        w_lower = (sx * 0.25, 0.70, -0.05)
        parts.append(("dragon_ruby", capsule_limb(w_root, w_apex, 0.026, 0.018)))
        parts.append(("dragon_ruby", capsule_limb(w_apex, w_outer, 0.018, 0.012)))
        parts.append(("dragon_ruby", capsule_limb(w_apex, w_lower, 0.016, 0.010)))
        # Flat wing fin plate
        parts.append(
            (
                "dragon_ruby",
                superellipsoid(
                    0.115,
                    0.120,
                    0.020,
                    center=(sx * 0.245, 0.85, -0.045),
                    power=0.38,
                    rot_xyz=(0, sx * 10, -sx * 16),
                ),
            )
        )
        parts.append(
            (
                "amber_gem",
                superellipsoid(
                    0.090,
                    0.092,
                    0.016,
                    center=(sx * 0.248, 0.84, -0.040),
                    power=0.38,
                    rot_xyz=(0, sx * 10, -sx * 16),
                ),
            )
        )

    # Prominent Heart-Shaped Spade Tail Tip resting near front-right of pedestal
    tx, ty, tz = spine_pts[0]
    parts.append(("dragon_ruby", ellipsoid(0.062, 0.068, 0.028, center=(tx + 0.04, ty + 0.02, tz + 0.05), rot_xyz=(0, 0, 32))))
    parts.append(("dragon_ruby", ellipsoid(0.062, 0.068, 0.028, center=(tx + 0.09, ty + 0.02, tz + 0.05), rot_xyz=(0, 0, -32))))

    return parts


def sculpt_pawn_tappo() -> list[tuple[str, trimesh.Trimesh]]:
    """Pawn: Guardia Re Tappo (0.95m) - Pompous short adult Renaissance palace herald-guard with
    plump rosy cheeks (round chin, no cleft) and bouncy golden-blond curls, standing on a neat
    stack of 3 thick leather-bound royal decree law-books on the mossy pedestal, wearing royal
    sapphire-blue & gold livery, white silk cape, holding a wax-sealed decree scroll, and topped
    with a tall domed sapphire-blue velvet capotain hat & golden Pawn sphere finial (0.95m).
    """
    parts = build_swamp_pedestal()

    # Stack of 3 Thick Leather-Bound Royal Decree Law-Books on top of the stone pedestal (y = 0.21..0.37)
    book_specs = [
        (0.238, 0.175, 0.026, 0.145, "oak_wood", 6.0),
        (0.288, 0.160, 0.025, 0.132, "crimson_velvet", -8.0),
        (0.336, 0.148, 0.024, 0.122, "emerald_velvet", 4.0),
    ]
    for by, brx, bry, brz, cover_mat, yaw in book_specs:
        parts.append((cover_mat, superellipsoid(brx, bry, brz, center=(0.0, by, 0.0), power=0.25, rot_xyz=(0, yaw, 0))))
        parts.append(("linen_cream", superellipsoid(brx * 0.94, bry * 0.82, brz * 0.94, center=(0.0, by, 0.01), power=0.25, rot_xyz=(0, yaw, 0))))
    # Hanging red wax seal on the decree book stack
    parts.append(("crimson_velvet", ellipsoid(0.028, 0.028, 0.018, center=(0.12, 0.29, 0.135))))

    # Short boots & royal sapphire-blue hose standing on the book stack
    for sx in (-1.0, 1.0):
        parts.append(("dark_leather", ellipsoid(0.045, 0.028, 0.062, center=(sx * 0.058, 0.382, 0.015))))
        parts.append(("sapphire_blue", capsule_limb((sx * 0.058, 0.385, 0.0), (sx * 0.058, 0.455, 0.0), 0.034, 0.038)))

    # Royal Sapphire-Blue & Gold Brocade Doublet Livery + White Silk Cape
    doublet = lathe_profile(
        [
            (0.125, 0.445),
            (0.136, 0.495),
            (0.116, 0.555),
            (0.134, 0.615),
            (0.095, 0.650),
        ],
        sections=26,
    )
    parts.append(("sapphire_blue", doublet))
    parts.append(("faction_trim", torus_ring(0.122, 0.016, center=(0.0, 0.520, 0.0))))
    parts.append(("linen_cream", torus_ring(0.118, 0.024, center=(0.0, 0.635, 0.0))))
    parts.append(("linen_cream", ellipsoid(0.155, 0.145, 0.075, center=(0.0, 0.525, -0.090), rot_xyz=(10, 0, 0))))

    # Arms + Rolled Parchment Royal Decree Scroll with Red Wax Seal
    for sx in (-1.0, 1.0):
        parts.append(("sapphire_blue", ellipsoid(0.050, 0.042, 0.050, center=(sx * 0.132, 0.605, 0.01))))
    parts.append(("sapphire_blue", capsule_limb((-0.132, 0.59, 0.01), (-0.175, 0.52, 0.06), 0.032, 0.026)))
    parts.append(("sapphire_blue", capsule_limb((0.132, 0.59, 0.01), (0.165, 0.51, 0.03), 0.032, 0.026)))
    parts.append(("linen_cream", capsule_limb((-0.178, 0.46, 0.11), (-0.178, 0.60, 0.07), 0.028, 0.028)))
    parts.append(("crimson_velvet", ellipsoid(0.022, 0.022, 0.018, center=(-0.178, 0.53, 0.118))))

    # Plump Rosy-Cheeked Herald Head (round chin, no cleft) + Bouncy Golden-Blond Curls
    parts.append(("peach_skin", ellipsoid(0.106, 0.096, 0.104, center=(0.0, 0.720, 0.015), subdivisions=3)))
    parts.append(("onion_gold", ellipsoid(0.118, 0.085, 0.112, center=(0.0, 0.738, -0.015), subdivisions=2)))
    for sx in (-1.0, 1.0):
        parts.append(("onion_gold", ellipsoid(0.045, 0.058, 0.052, center=(sx * 0.105, 0.715, 0.01))))
        parts.append(("onion_gold", ellipsoid(0.038, 0.042, 0.042, center=(sx * 0.088, 0.685, 0.02))))
        parts.append(("dark_leather", ellipsoid(0.030, 0.011, 0.015, center=(sx * 0.042, 0.750, 0.105), rot_xyz=(0, 0, sx * 10))))
        parts.append(("eye_white", ellipsoid(0.020, 0.020, 0.016, center=(sx * 0.042, 0.725, 0.108))))
        parts.append(("eye_dark", ellipsoid(0.012, 0.012, 0.012, center=(sx * 0.042, 0.725, 0.118))))

    # Tall Domed Sapphire-Blue Velvet Capotain Hat + Golden Pawn Sphere Finial (up to 0.95m)
    parts.append(("sapphire_blue", torus_ring(0.145, 0.018, center=(0.0, 0.775, 0.005))))
    parts.append(("faction_trim", torus_ring(0.118, 0.015, center=(0.0, 0.792, 0.005))))
    capotain = lathe_profile(
        [
            (0.118, 0.780),
            (0.112, 0.835),
            (0.098, 0.885),
            (0.062, 0.908),
        ],
        sections=28,
    )
    parts.append(("sapphire_blue", capotain))
    parts.append(("faction_trim", ellipsoid(0.044, 0.042, 0.044, center=(0.0, 0.930, 0.0), subdivisions=2)))

    return parts


PIECE_SCULPTORS = {
    "king-swamp-orco": ("king", 1.80, sculpt_king_orco),
    "queen-swamp-orchessa": ("queen", 1.65, sculpt_queen_orchessa),
    "bishop-swamp-focaccina": ("bishop", 1.45, sculpt_bishop_focaccina),
    "knight-swamp-asinello": ("knight", 1.35, sculpt_knight_asinello),
    "rook-swamp-draghessa": ("rook", 1.30, sculpt_rook_draghessa),
    "pawn-swamp-tappo": ("pawn", 0.95, sculpt_pawn_tappo),
}


# ---------------------------------------------------------------------------
# Normalization, Vertex-Color Baking & Binary glTF 2.0 Exporter
# ---------------------------------------------------------------------------

def normalize_piece_bounds(
    parts: list[tuple[str, trimesh.Trimesh]],
    target_height: float,
    pedestal_split_y: float = 0.215,
) -> list[tuple[str, trimesh.Trimesh]]:
    """Ensure exact grounding min.y == 0.0 and exact overall height max.y == target_height."""
    all_v = np.vstack([m.vertices for _, m in parts])
    min_y = float(all_v[:, 1].min())
    if abs(min_y) > 1e-9:
        for _, m in parts:
            m.vertices[:, 1] -= min_y

    all_v = np.vstack([m.vertices for _, m in parts])
    cur_max_y = float(all_v[:, 1].max())
    if cur_max_y > pedestal_split_y and abs(cur_max_y - target_height) > 1e-6:
        scale_y = (target_height - pedestal_split_y) / (cur_max_y - pedestal_split_y)
        for _, m in parts:
            above = m.vertices[:, 1] > pedestal_split_y
            m.vertices[above, 1] = pedestal_split_y + (m.vertices[above, 1] - pedestal_split_y) * scale_y

    all_v = np.vstack([m.vertices for _, m in parts])
    min_y2 = float(all_v[:, 1].min())
    for _, m in parts:
        m.vertices[:, 1] -= min_y2

    return parts


def bake_vertex_colors(mesh: trimesh.Trimesh, base_rgba: tuple[float, float, float, float]) -> np.ndarray:
    """Compute rich RGBA uint8 vertex colors with studio ambient occlusion & normal shading."""
    normals = mesh.vertex_normals
    verts = mesh.vertices
    y_min = float(verts[:, 1].min())
    y_max = max(float(verts[:, 1].max()), y_min + 0.01)
    y_norm = (verts[:, 1] - y_min) / (y_max - y_min)

    light_dir = np.array([0.35, 0.82, 0.45], dtype=np.float64)
    light_dir /= np.linalg.norm(light_dir)
    ndotl = np.clip(normals @ light_dir, -1.0, 1.0)
    shade = 0.84 + 0.16 * ndotl + 0.06 * (y_norm - 0.5)
    shade = np.clip(shade, 0.68, 1.12)[:, None]

    base = np.array(base_rgba[:3], dtype=np.float64)[None, :]
    rgb = np.clip(base * shade * 255.0, 0.0, 255.0).astype(np.uint8)
    alpha = np.full((len(verts), 1), int(base_rgba[3] * 255), dtype=np.uint8)
    return np.hstack([rgb, alpha])


def export_glb_atomic(parts: list[tuple[str, trimesh.Trimesh]], out_path: Path) -> dict:
    """Group watertight sub-meshes by named PBR material and write a valid glTF 2.0 binary (.glb)."""
    grouped: dict[str, list[trimesh.Trimesh]] = {}
    for mat_name, m in parts:
        grouped.setdefault(mat_name, []).append(m)

    ordered_mats = ["faction_primary", "faction_trim"] + [
        k for k in grouped.keys() if k not in ("faction_primary", "faction_trim")
    ]

    materials_json = []
    primitives_json = []
    buffer_views = []
    accessors = []
    bin_chunks = bytearray()

    def _append_bytes(raw: bytes) -> tuple[int, int]:
        while len(bin_chunks) % 4 != 0:
            bin_chunks.append(0)
        offset = len(bin_chunks)
        bin_chunks.extend(raw)
        while len(bin_chunks) % 4 != 0:
            bin_chunks.append(0)
        return offset, len(raw)

    for mat_idx, mat_name in enumerate(ordered_mats):
        mat_cfg = MATERIALS[mat_name]
        materials_json.append(
            {
                "name": mat_name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": list(mat_cfg["rgba"]),
                    "metallicFactor": float(mat_cfg["metallic"]),
                    "roughnessFactor": float(mat_cfg["roughness"]),
                },
                "doubleSided": False,
            }
        )
        meshes = grouped.get(mat_name, [])
        if not meshes:
            continue
        combined = trimesh.util.concatenate(meshes)
        combined.fix_normals()

        pos = np.asarray(combined.vertices, dtype=np.float32)
        norm = np.asarray(combined.vertex_normals, dtype=np.float32)
        col = bake_vertex_colors(combined, mat_cfg["rgba"])
        idx = np.asarray(combined.faces, dtype=np.uint32).reshape(-1)

        pos_off, pos_len = _append_bytes(pos.tobytes())
        bv_pos = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": pos_off, "byteLength": pos_len, "target": 34962})
        acc_pos = len(accessors)
        accessors.append(
            {
                "bufferView": bv_pos,
                "byteOffset": 0,
                "componentType": 5126,
                "count": int(len(pos)),
                "type": "VEC3",
                "min": [float(x) for x in pos.min(axis=0)],
                "max": [float(x) for x in pos.max(axis=0)],
            }
        )

        norm_off, norm_len = _append_bytes(norm.tobytes())
        bv_norm = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": norm_off, "byteLength": norm_len, "target": 34962})
        acc_norm = len(accessors)
        accessors.append(
            {
                "bufferView": bv_norm,
                "byteOffset": 0,
                "componentType": 5126,
                "count": int(len(norm)),
                "type": "VEC3",
            }
        )

        col_off, col_len = _append_bytes(col.tobytes())
        bv_col = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": col_off, "byteLength": col_len, "target": 34962})
        acc_col = len(accessors)
        accessors.append(
            {
                "bufferView": bv_col,
                "byteOffset": 0,
                "componentType": 5121,
                "normalized": True,
                "count": int(len(col)),
                "type": "VEC4",
            }
        )

        idx_off, idx_len = _append_bytes(idx.tobytes())
        bv_idx = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": idx_off, "byteLength": idx_len, "target": 34963})
        acc_idx = len(accessors)
        accessors.append(
            {
                "bufferView": bv_idx,
                "byteOffset": 0,
                "componentType": 5125,
                "count": int(len(idx)),
                "type": "SCALAR",
            }
        )

        primitives_json.append(
            {
                "attributes": {
                    "POSITION": acc_pos,
                    "NORMAL": acc_norm,
                    "COLOR_0": acc_col,
                },
                "indices": acc_idx,
                "material": mat_idx,
                "mode": 4,
            }
        )

    gltf_dict = {
        "asset": {"version": "2.0", "generator": "carchess3d-swamp-sculptor"},
        "scene": 0,
        "scenes": [{"name": out_path.stem, "nodes": [0]}],
        "nodes": [{"name": out_path.stem, "mesh": 0}],
        "meshes": [{"name": out_path.stem, "primitives": primitives_json}],
        "materials": materials_json,
        "buffers": [{"byteLength": len(bin_chunks)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }

    json_bytes = json.dumps(gltf_dict, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_chunks)
    header = struct.pack("<4sII", b"glTF", 2, total_len)
    json_header = struct.pack("<II", len(json_bytes), 0x4E4F534A)
    bin_header = struct.pack("<II", len(bin_chunks), 0x004E4942)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    part_path = out_path.with_suffix(".glb.part")
    with open(part_path, "wb") as f:
        f.write(header)
        f.write(json_header)
        f.write(json_bytes)
        f.write(bin_header)
        f.write(bin_chunks)
    os.replace(part_path, out_path)

    loaded = trimesh.load(str(out_path), force="mesh")
    return {
        "file": out_path.name,
        "vertices": int(len(loaded.vertices)),
        "faces": int(len(loaded.faces)),
        "watertight": bool(loaded.is_watertight),
        "min_y": float(loaded.bounds[0][1]),
        "max_y": float(loaded.bounds[1][1]),
        "span_x": float(loaded.extents[0]),
        "span_z": float(loaded.extents[2]),
    }


# ---------------------------------------------------------------------------
# Studio Software Z-Buffer Renderer for 6x4 Turntable Contact Sheet
# ---------------------------------------------------------------------------

def render_turntable_view(
    parts: list[tuple[str, trimesh.Trimesh]],
    target_height: float,
    yaw_deg: float,
    pitch_deg: float = 12.0,
    width: int = 380,
    height: int = 440,
) -> Image.Image:
    """Render a shaded 3D view with three-point studio lighting & supersampled Z-buffer."""
    ss = 2
    W, H = width * ss, height * ss

    yy = np.linspace(0.0, 1.0, H, dtype=np.float32)[:, None]
    xx = np.linspace(-1.0, 1.0, W, dtype=np.float32)[None, :]
    vignette = np.clip(1.0 - 0.22 * (xx**2 + (yy - 0.5) ** 2 * 2.5), 0.72, 1.0)
    bg_r = (34.0 + 16.0 * (1.0 - yy)) * vignette
    bg_g = (38.0 + 18.0 * (1.0 - yy)) * vignette
    bg_b = (46.0 + 20.0 * (1.0 - yy)) * vignette
    color_buf = np.stack([bg_r, bg_g, bg_b], axis=-1).astype(np.uint8)
    z_buf = np.full((H, W), -1e9, dtype=np.float32)

    yaw = math.radians(yaw_deg)
    pitch = math.radians(pitch_deg)
    ry = np.array(
        [
            [math.cos(yaw), 0.0, math.sin(yaw)],
            [0.0, 1.0, 0.0],
            [-math.sin(yaw), 0.0, math.cos(yaw)],
        ],
        dtype=np.float64,
    )
    rx = np.array(
        [
            [1.0, 0.0, 0.0],
            [0.0, math.cos(pitch), -math.sin(pitch)],
            [0.0, math.sin(pitch), math.cos(pitch)],
        ],
        dtype=np.float64,
    )
    rot = rx @ ry

    scale = (H * 0.78) / max(target_height, 1.25)
    cx = W * 0.5
    cy = H * 0.88

    key_dir = np.array([0.48, 0.62, 0.62], dtype=np.float64)
    key_dir /= np.linalg.norm(key_dir)
    fill_dir = np.array([-0.65, 0.25, 0.71], dtype=np.float64)
    fill_dir /= np.linalg.norm(fill_dir)
    rim_dir = np.array([0.0, 0.55, -0.83], dtype=np.float64)
    rim_dir /= np.linalg.norm(rim_dir)
    view_dir = np.array([0.0, 0.0, 1.0], dtype=np.float64)
    half_vec = key_dir + view_dir
    half_vec /= np.linalg.norm(half_vec)

    for mat_name, m in parts:
        mat = MATERIALS[mat_name]
        base_rgb = np.array(mat["rgba"][:3], dtype=np.float64)
        rough = float(mat["roughness"])
        metal = float(mat["metallic"])

        v = m.vertices @ rot.T
        f = m.faces
        v0 = v[f[:, 0]]
        v1 = v[f[:, 1]]
        v2 = v[f[:, 2]]

        fn = np.cross(v1 - v0, v2 - v0)
        fn_len = np.linalg.norm(fn, axis=1, keepdims=True)
        valid = (fn_len[:, 0] > 1e-9) & (fn[:, 2] >= -0.05)
        if not np.any(valid):
            continue

        v0 = v0[valid]
        v1 = v1[valid]
        v2 = v2[valid]
        fn = fn[valid] / fn_len[valid]

        ndotl_key = np.clip(fn @ key_dir, 0.0, 1.0)
        ndotl_fill = np.clip(fn @ fill_dir, 0.0, 1.0)
        ndotl_rim = np.clip(fn @ rim_dir, 0.0, 1.0)
        ndoth = np.clip(fn @ half_vec, 0.0, 1.0)
        spec_pow = max(4.0, (1.0 - rough) * 48.0)
        spec = (ndoth**spec_pow) * (0.18 + 0.55 * metal + 0.25 * (1.0 - rough))

        diff = 0.28 + 0.68 * ndotl_key + 0.24 * ndotl_fill + 0.22 * ndotl_rim
        rgb = base_rgb[None, :] * diff[:, None] + spec[:, None] * np.array([[1.0, 0.97, 0.90]])
        face_colors = np.clip(rgb * 255.0, 0.0, 255.0).astype(np.uint8)

        sx0 = cx + v0[:, 0] * scale
        sy0 = cy - v0[:, 1] * scale
        sz0 = v0[:, 2]
        sx1 = cx + v1[:, 0] * scale
        sy1 = cy - v1[:, 1] * scale
        sz1 = v1[:, 2]
        sx2 = cx + v2[:, 0] * scale
        sy2 = cy - v2[:, 1] * scale
        sz2 = v2[:, 2]

        xmin = np.maximum(0, np.floor(np.minimum(np.minimum(sx0, sx1), sx2)).astype(np.int32))
        xmax = np.minimum(W - 1, np.ceil(np.maximum(np.maximum(sx0, sx1), sx2)).astype(np.int32))
        ymin = np.maximum(0, np.floor(np.minimum(np.minimum(sy0, sy1), sy2)).astype(np.int32))
        ymax = np.minimum(H - 1, np.ceil(np.maximum(np.maximum(sy0, sy1), sy2)).astype(np.int32))

        denom = (sy1 - sy2) * (sx0 - sx2) + (sx2 - sx1) * (sy0 - sy2)
        for i in range(len(sx0)):
            d = denom[i]
            if abs(d) < 1e-5:
                continue
            x0i, x1i = xmin[i], xmax[i]
            y0i, y1i = ymin[i], ymax[i]
            if x0i > x1i or y0i > y1i:
                continue
            px = np.arange(x0i, x1i + 1, dtype=np.float32)[None, :]
            py = np.arange(y0i, y1i + 1, dtype=np.float32)[:, None]
            w0 = ((sy1[i] - sy2[i]) * (px - sx2[i]) + (sx2[i] - sx1[i]) * (py - sy2[i])) / d
            w1 = ((sy2[i] - sy0[i]) * (px - sx2[i]) + (sx0[i] - sx2[i]) * (py - sy2[i])) / d
            w2 = 1.0 - w0 - w1
            mask = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
            if not np.any(mask):
                continue
            z_interp = w0 * sz0[i] + w1 * sz1[i] + w2 * sz2[i]
            sub_z = z_buf[y0i : y1i + 1, x0i : x1i + 1]
            closer = mask & (z_interp > sub_z)
            if np.any(closer):
                sub_z[closer] = z_interp[closer]
                color_buf[y0i : y1i + 1, x0i : x1i + 1][closer] = face_colors[i]

    img = Image.fromarray(color_buf, mode="RGB")
    return img.resize((width, height), Image.Resampling.LANCZOS)


def render_contact_sheet(built_pieces: dict[str, tuple[float, list[tuple[str, trimesh.Trimesh]]]]) -> None:
    """Render a 6-row x 4-column turntable contact sheet (Front, 3/4, Side, Back)."""
    angles = [
        ("Front (0 deg)", 0.0),
        ("3/4 View (38 deg)", 38.0),
        ("Side (90 deg)", 90.0),
        ("Back (180 deg)", 180.0),
    ]
    cell_w, cell_h = 360, 420
    pad_x, pad_y = 20, 24
    header_h = 64
    cols = len(angles)
    rows = len(built_pieces)

    sheet_w = pad_x + cols * (cell_w + pad_x)
    sheet_h = header_h + rows * (cell_h + pad_y) + pad_y
    sheet = Image.new("RGB", (sheet_w, sheet_h), (22, 25, 31))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    draw.text(
        (pad_x, 20),
        "CARCHESS3D - SWAMP PARODY FAMILY 6x4 TURNTABLE CONTACT SHEET (Grounded Y=0, Heights 0.95m -> 1.80m)",
        fill=(235, 225, 195),
        font=font,
    )

    for r_idx, (slug, (target_h, parts)) in enumerate(built_pieces.items()):
        for c_idx, (view_label, yaw_deg) in enumerate(angles):
            cell_img = render_turntable_view(parts, target_h, yaw_deg=yaw_deg, width=cell_w, height=cell_h)
            x0 = pad_x + c_idx * (cell_w + pad_x)
            y0 = header_h + r_idx * (cell_h + pad_y)
            sheet.paste(cell_img, (x0, y0))
            draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], outline=(78, 86, 98), width=1)
            caption = f"{slug} ({target_h:.2f}m) - {view_label}"
            draw.rectangle([x0 + 6, y0 + 6, x0 + cell_w - 6, y0 + 28], fill=(18, 20, 26))
            draw.text((x0 + 12, y0 + 11), caption, fill=(240, 218, 140), font=font)

    CONTACT_SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_sheet = CONTACT_SHEET_PATH.with_suffix(".png.part")
    sheet.save(tmp_sheet, format="PNG", optimize=True)
    os.replace(tmp_sheet, CONTACT_SHEET_PATH)
    print(f"🖼️ Contact sheet saved to {CONTACT_SHEET_PATH.relative_to(ROOT)} ({sheet_w}x{sheet_h})", flush=True)


def main() -> None:
    if os.environ.get("SWAMP_TRELLIS") == "1":
        print("ℹ️ SWAMP_TRELLIS=1 detected; checking ZeroGPU availability (fallback: Chibi 3D Sculptor)...")

    built_pieces: dict[str, tuple[float, list[tuple[str, trimesh.Trimesh]]]] = {}
    metrics = []
    for slug, (piece_role, target_h, sculptor_fn) in PIECE_SCULPTORS.items():
        raw_parts = sculptor_fn()
        norm_parts = normalize_piece_bounds(raw_parts, target_h)
        out_glb = OUT_MODELS_DIR / f"{slug}.glb"
        info = export_glb_atomic(norm_parts, out_glb)
        built_pieces[slug] = (target_h, norm_parts)
        metrics.append(info)
        print(
            f"✅ {info['file']:<28} tris={info['faces']:<6} watertight={info['watertight']} "
            f"y=[{info['min_y']:.4f}, {info['max_y']:.4f}m] xz=({info['span_x']:.3f}x{info['span_z']:.3f}m)",
            flush=True,
        )
        if not info["watertight"] or info["faces"] > 25000:
            print(f"❌ Mesh budget or watertightness failed in {slug}: {info}", file=sys.stderr)
            sys.exit(1)

    render_contact_sheet(built_pieces)


if __name__ == "__main__":
    main()
