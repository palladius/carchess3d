#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["trimesh>=4.0.0", "numpy>=1.24.0", "scipy>=1.10.0", "networkx>=3.0", "pygltflib>=1.16.0"]
# ///
"""Deterministic 3D sculptor for all 6 Vanilla Classic (`.glb`) chess pieces.

Pure, authentic classic Staunton / medieval chess pieces with ZERO Carlesso family references:
- King (`king-classic-re.glb`, 1.80m): Staunton King with fluted shaft, 8-point crown over crimson velvet dome & Cross Pattee finial
- Queen (`queen-classic-regina.glb`, 1.65m): Fluted Staunton Queen with 8-spike royal gold coronet, 8 ivory pearls & golden orb finial
- Bishop (`bishop-classic-vescovo.glb`, 1.45m): Medieval Churchman / Ecclesiastical Bishop in pleated robe with golden stole, bearded face, tall Episcopal Mitre with embossed golden cross, and golden Pastoral Crosier staff
- Knight (`knight-classic-cavallo.glb`, 1.35m): Noble sculpted Staunton Warhorse with arched neck, scalloped mane, and golden bridle
- Rook (`rook-classic-torre.glb`, 1.30m): Pure medieval masonry castle tower with gothic arrow slits, corbel gallery, and 6 battlements (zero monster)
- Pawn (`pawn-classic-pedone.glb`, 0.95m): Pure iconic Staunton Pawn with turned baluster shaft, double gold collar, and smooth marble sphere top (zero bird/beak)

Usage:
    UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy \
        uv run tools/model-pipeline/classic/build_classic_pieces.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import trimesh

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from staunton_builder import (  # noqa: E402
    build_staunton_pedestal,
    export_piece_glb,
    loft_tube,
    make_ellipsoid,
    make_rounded_box,
    make_torus,
    revolve_profile,
)

ROOT = HERE.parent.parent.parent
MODELS_DIR = ROOT / "assets/models/classic"


def build_king_re() -> list[tuple[trimesh.Trimesh, str]]:
    """♔ King (`king-classic-re.glb`, 1.80m):
    - Classic Staunton pedestal & fluted ivory marble column shaft
    - Triple brushed-gold collar rings
    - Crimson royal velvet inner cushion dome (`accent_crimson`) wrapped by an 8-point scalloped golden crown
    - Classic solid-gold Cross Pattee (`Croce Reale`) finial at the apex (y=1.44..1.80)
    """
    parts = build_staunton_pedestal(extra_trim_mat="faction_trim", carve_runes=False)

    # Stately fluted ivory marble column shaft (y=0.235..1.02)
    shaft_profile = [
        (0.236, 0.235),
        (0.220, 0.290),
        (0.186, 0.430),
        (0.160, 0.590),
        (0.148, 0.750),
        (0.156, 0.870),
        (0.184, 0.935),
        (0.166, 0.980),
        (0.188, 1.025),
    ]

    def king_flutes(th: float, r: float, y: float) -> tuple[float, float, float]:
        if 0.28 <= y <= 0.85:
            env = math.sin((y - 0.28) / 0.57 * math.pi)
            flute = -0.008 * env * (0.5 - 0.5 * math.cos(16.0 * th))
            return r + flute, y, 0.0
        return r, y, 0.0

    parts.append((revolve_profile(shaft_profile, n_theta=64, radial_mod=king_flutes), "faction_primary"))

    # Ornate brushed-gold collar rings along shaft & neck
    parts.append((make_torus(0.228, 0.018, 0.020, 0.258, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.172, 0.018, 0.018, 0.880, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.204, 0.025, 0.022, 0.945, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.184, 0.016, 0.016, 1.028, n_major=48, n_minor=14), "faction_trim"))

    # Royal Crimson Velvet Cushion Dome inside the crown (y=1.08..1.42)
    parts.append((make_ellipsoid((0.182, 0.168, 0.182), (0.0, 1.255, 0.0), subdivisions=3), "accent_crimson"))

    # Scalloped 8-Point Royal Gold Crown Band wrapping the velvet cushion (y=1.03..1.38)
    crown_profile = [
        (0.176, 1.030),
        (0.194, 1.095),
        (0.212, 1.175),
        (0.224, 1.245),
        (0.172, 1.260),
    ]

    def crown_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        if y >= 1.16:
            t = (y - 1.16) / 0.10
            wave = (0.5 + 0.5 * math.cos(8.0 * th)) ** 1.6
            spike = 0.125 * t * wave - 0.018 * t * (1.0 - wave)
            r_flare = 0.020 * t * wave
            return r + r_flare, y + spike, 0.0
        return r, y, 0.0

    parts.append((revolve_profile(crown_profile, n_theta=64, radial_mod=crown_mod), "faction_trim"))

    # 8 Golden Crown Peak Pearls atop the 8 crown points
    for k in range(8):
        th = 2.0 * math.pi * k / 8.0
        px = 0.218 * math.cos(th)
        pz = 0.218 * math.sin(th)
        parts.append(
            (
                make_ellipsoid((0.024, 0.024, 0.024), (px, 1.382, pz), subdivisions=2),
                "faction_trim",
            )
        )

    # Golden Orb Mound at apex supporting the Royal Cross (y=1.39..1.48)
    parts.append((make_ellipsoid((0.072, 0.052, 0.072), (0.0, 1.430, 0.0), subdivisions=2), "faction_trim"))
    parts.append((make_torus(0.068, 0.014, 0.012, 1.425, n_major=36, n_minor=12), "faction_trim"))

    # === CLASSIC STAUNTON ROYAL CROSS PATTEE FINIAL (y=1.46..1.80) ===
    # Flared vertical cross beam
    vert_cross = make_rounded_box(
        extents=(0.078, 0.335, 0.062),
        center=(0.0, 1.632, 0.0),
        power=0.32,
        subdivisions=2,
    )
    v_vc = vert_cross.vertices.copy()
    flare_v = 1.0 + 0.38 * ((v_vc[:, 1] - 1.632) / 0.168) ** 2
    v_vc[:, 0] *= flare_v
    vert_cross = trimesh.Trimesh(vertices=v_vc, faces=vert_cross.faces, process=True)
    vert_cross.fix_normals()
    parts.append((vert_cross, "faction_trim"))

    # Flared horizontal cross arms (y=1.655)
    horiz_cross = make_rounded_box(
        extents=(0.285, 0.078, 0.062),
        center=(0.0, 1.655, 0.0),
        power=0.32,
        subdivisions=2,
    )
    v_hc = horiz_cross.vertices.copy()
    flare_h = 1.0 + 0.38 * (v_hc[:, 0] / 0.142) ** 2
    v_hc[:, 1] = 1.655 + (v_hc[:, 1] - 1.655) * flare_h
    horiz_cross = trimesh.Trimesh(vertices=v_hc, faces=horiz_cross.faces, process=True)
    horiz_cross.fix_normals()
    parts.append((horiz_cross, "faction_trim"))

    # Central ivory medallion jewel at the intersection of the cross
    parts.append((make_ellipsoid((0.036, 0.036, 0.038), (0.0, 1.655, 0.0), subdivisions=2), "faction_primary"))

    return parts


def build_queen_regina() -> list[tuple[trimesh.Trimesh, str]]:
    """♕ Queen (`queen-classic-regina.glb`, 1.65m):
    - Pure Staunton Queen with gracefully fluted ivory marble gown column
    - Triple golden collar rings
    - Classic 8-spike royal gold coronet with 8 ivory pearls on the spikes & golden orb finial
    """
    parts = build_staunton_pedestal()

    # Gracefully fluted ivory marble gown shaft (y=0.235..1.04)
    shaft_profile = [
        (0.232, 0.235),
        (0.214, 0.305),
        (0.184, 0.450),
        (0.158, 0.620),
        (0.142, 0.790),
        (0.138, 0.920),
        (0.158, 1.015),
    ]

    def flute_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        if 0.26 <= y <= 0.98:
            env = math.sin((y - 0.26) / 0.72 * math.pi)
            flute = -0.009 * env * (0.5 - 0.5 * math.cos(20.0 * th))
            return r + flute, y, 0.0
        return r, y, 0.0

    parts.append((revolve_profile(shaft_profile, n_theta=64, radial_mod=flute_mod), "faction_primary"))

    # Triple royal gold collar rings (y=1.01..1.11)
    parts.append((make_torus(0.184, 0.022, 0.018, 1.022, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.168, 0.018, 0.015, 1.060, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.152, 0.015, 0.014, 1.095, n_major=48, n_minor=14), "faction_trim"))

    # Smooth Ivory Marble Royal Dome inside the coronet (y=1.10..1.48)
    parts.append((make_ellipsoid((0.166, 0.175, 0.166), (0.0, 1.285, 0.0), subdivisions=3), "faction_primary"))

    # === CLASSIC 8-SPIKE ROYAL GOLD QUEEN CORONET (y=1.22..1.53) ===
    coronet_profile = [
        (0.162, 1.220),
        (0.178, 1.280),
        (0.194, 1.355),
        (0.208, 1.430),
        (0.160, 1.455),
    ]

    def coronet_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        if y >= 1.34:
            t = (y - 1.34) / 0.115
            wave = (0.5 + 0.5 * math.cos(8.0 * th)) ** 1.7
            spike_y = 0.085 * t * wave - 0.020 * t * (1.0 - wave)
            return r + 0.016 * t * wave, y + spike_y, 0.0
        return r, y, 0.0

    parts.append((revolve_profile(coronet_profile, n_theta=64, radial_mod=coronet_mod), "faction_trim"))

    # 8 Gleaming Ivory Pearls perched on the 8 coronet spikes
    for k in range(8):
        th = 2.0 * math.pi * k / 8.0
        px = 0.202 * math.cos(th)
        pz = 0.202 * math.sin(th)
        parts.append(
            (
                make_ellipsoid((0.026, 0.026, 0.026), (px, 1.535, pz), subdivisions=2),
                "accent_porcelain",
            )
        )

    # Central polished golden orb & petite finial at apex (y=1.47..1.65)
    parts.append((make_torus(0.056, 0.014, 0.012, 1.478, n_major=36, n_minor=12), "faction_trim"))
    parts.append((make_ellipsoid((0.062, 0.062, 0.062), (0.0, 1.545, 0.0), subdivisions=2), "faction_trim"))
    parts.append((make_ellipsoid((0.028, 0.036, 0.028), (0.0, 1.622, 0.0), subdivisions=2), "accent_porcelain"))

    return parts


def build_bishop_vescovo() -> list[tuple[trimesh.Trimesh, str]]:
    """♗ Bishop (`bishop-classic-vescovo.glb`, 1.45m):
    San Gennaro Neapolitan Baroque Reliquary Bust ('Alfiere San Gennaro'):
    - Turned ivory-and-gold Staunton pedestal (`y=0.00..0.24`)
    - Sculpted Baroque bust torso in crimson brocade (`accent_crimson`) with wide golden brocade borders (`faction_trim`)
    - Oval golden reliquary medallion on chest enclosing the glowing red Ampolla del Sangue di San Gennaro
    - Serene carved ivory marble face with gilded golden beard (`faction_trim`), nose & obsidian eyes
    - Tall jewel-encrusted Baroque Episcopal Mitre studded with rubies, emeralds (`accent_emerald`), pearls (`accent_porcelain`) & golden cross at apex (`1.45m`)
    - Golden Pastoral Crosier (`pastorale`) with Baroque spiral crook on the right side
    """
    parts = build_staunton_pedestal()

    # 1. Ivory marble lower bust plinth & golden collar (y=0.235..0.34)
    plinth_prof = [
        (0.225, 0.235),
        (0.195, 0.280),
        (0.175, 0.335),
    ]
    parts.append((revolve_profile(plinth_prof, n_theta=56), "faction_primary"))
    parts.append((make_torus(0.188, 0.018, 0.016, 0.335, n_major=48, n_minor=14), "faction_trim"))

    # 2. Sculpted Baroque Reliquary Bust Torso in Crimson Brocade (`accent_crimson`, y=0.33..0.78)
    bust_profile = [
        (0.172, 0.335),
        (0.215, 0.420),
        (0.242, 0.540),
        (0.232, 0.660),
        (0.185, 0.745),
        (0.128, 0.785),
    ]

    def bust_drape_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        # Broaden shoulders along X axis (cos(th)) and flatten front/back slightly like a baroque reliquary bust
        t = max(0.0, (y - 0.35) / 0.40)
        x_broad = 1.0 + 0.16 * t * (math.cos(th) ** 2)
        z_trim = 1.0 - 0.10 * t * (math.sin(th) ** 2)
        r_eff = r * (x_broad * (math.cos(th) ** 2) + z_trim * (math.sin(th) ** 2))
        return r_eff, y, 0.0

    parts.append((revolve_profile(bust_profile, n_theta=64, radial_mod=bust_drape_mod), "accent_crimson"))

    # Golden brocade shoulder & V-stole borders (`piviale` trim)
    for side in (-1.0, 1.0):
        stole_band = [
            (side * 0.115, 0.765, 0.085),
            (side * 0.085, 0.640, 0.168),
            (side * 0.042, 0.480, 0.192),
            (side * 0.032, 0.350, 0.172),
        ]
        stole_radii = [(0.026, 0.022), (0.028, 0.022), (0.026, 0.020), (0.022, 0.018)]
        parts.append((loft_tube(stole_band, stole_radii, n_sides=16), "faction_trim"))

        epaulette = make_ellipsoid(
            radii=(0.068, 0.045, 0.075),
            center=(side * 0.215, 0.635, 0.0),
            subdivisions=2,
        )
        parts.append((epaulette, "faction_trim"))

    # 3. Famous Ampolla del Sangue di San Gennaro Reliquary Medallion at Center of Chest (y=0.55, z=+0.198)
    reliquary_frame = make_torus(
        major_r=0.064,
        minor_r_radial=0.020,
        minor_r_vertical=0.024,
        y_center=0.0,
        n_major=36,
        n_minor=14,
        tilt_x=math.pi * 0.5,
        offset_xyz=(0.0, 0.555, 0.196),
    )
    parts.append((reliquary_frame, "faction_trim"))

    ampolla_vial = make_ellipsoid(
        radii=(0.046, 0.058, 0.028),
        center=(0.0, 0.555, 0.204),
        subdivisions=2,
    )
    parts.append((ampolla_vial, "accent_crimson"))

    # 4. Noble Carved Marble Face of San Gennaro with Gilded Golden Beard (y=0.77..1.00)
    parts.append((make_torus(0.132, 0.020, 0.016, 0.778, n_major=44, n_minor=14), "faction_trim"))
    head = make_ellipsoid((0.118, 0.128, 0.122), (0.0, 0.895, 0.010), subdivisions=3)
    parts.append((head, "faction_primary"))

    # Gilded golden beard & mustache (like the silver-and-gold bust of San Gennaro)
    beard = make_ellipsoid((0.092, 0.076, 0.075), (0.0, 0.828, 0.080), subdivisions=2)
    parts.append((beard, "faction_trim"))
    nose = make_ellipsoid((0.022, 0.034, 0.030), (0.0, 0.895, 0.132), subdivisions=2)
    parts.append((nose, "faction_primary"))

    for side in (-1.0, 1.0):
        mustache = make_ellipsoid((0.040, 0.016, 0.022), (side * 0.030, 0.862, 0.124), subdivisions=2)
        parts.append((mustache, "faction_trim"))
        eye = make_ellipsoid((0.015, 0.015, 0.014), (side * 0.042, 0.912, 0.120), subdivisions=2)
        parts.append((eye, "accent_obsidian"))
        brow = make_rounded_box(
            extents=(0.040, 0.013, 0.016),
            center=(side * 0.042, 0.934, 0.120),
            power=0.45,
            subdivisions=2,
        )
        parts.append((brow, "faction_trim"))

    # 5. Jewel-Encrusted Baroque Golden Episcopal Mitre of San Gennaro (y=0.97..1.37)
    parts.append((make_torus(0.134, 0.022, 0.018, 0.975, n_major=48, n_minor=14), "faction_trim"))

    mitre_profile = [
        (0.128, 0.975),
        (0.158, 1.045),
        (0.166, 1.135),
        (0.148, 1.225),
        (0.106, 1.305),
        (0.052, 1.358),
        (0.022, 1.375),
    ]

    def baroque_mitre_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        if y >= 1.08:
            t = (y - 1.08) / 0.295
            front_back = abs(math.sin(th))
            side_pinch = 1.0 - 0.18 * t * (math.cos(th) ** 2)
            peak_lift = 0.024 * t * (front_back ** 1.5)
            return r * side_pinch, y + peak_lift, 0.0
        return r, y, 0.0

    parts.append((revolve_profile(mitre_profile, n_theta=64, radial_mod=baroque_mitre_mod), "faction_trim"))

    # Central vertical golden filigree band + jewel cabochons (Emeralds, Rubies & Pearls) on the Mitre
    parts.append((make_ellipsoid((0.024, 0.030, 0.020), (0.0, 1.155, 0.162), subdivisions=2), "accent_emerald"))
    parts.append((make_ellipsoid((0.022, 0.026, 0.018), (0.0, 1.065, 0.156), subdivisions=2), "accent_crimson"))
    parts.append((make_ellipsoid((0.020, 0.024, 0.018), (0.0, 1.245, 0.140), subdivisions=2), "accent_crimson"))

    for side in (-1.0, 1.0):
        parts.append(
            (
                make_ellipsoid((0.022, 0.026, 0.018), (side * 0.072, 1.125, 0.142), subdivisions=2),
                "accent_porcelain",
            )
        )
        parts.append(
            (
                make_ellipsoid((0.020, 0.024, 0.018), (side * 0.064, 1.205, 0.128), subdivisions=2),
                "accent_emerald",
            )
        )
        parts.append(
            (
                make_ellipsoid((0.020, 0.022, 0.018), (side * 0.088, 1.045, 0.132), subdivisions=2),
                "accent_crimson",
            )
        )

    # Golden Latin Cross Finial at the Apex of San Gennaro's Mitre (y=1.37..1.45)
    cross_v = make_rounded_box(
        extents=(0.024, 0.082, 0.022),
        center=(0.0, 1.410, 0.0),
        power=0.32,
        subdivisions=2,
    )
    parts.append((cross_v, "faction_trim"))
    cross_h = make_rounded_box(
        extents=(0.068, 0.024, 0.022),
        center=(0.0, 1.418, 0.0),
        power=0.32,
        subdivisions=2,
    )
    parts.append((cross_h, "faction_trim"))

    # 6. Golden Baroque Pastoral Crosier (`Pastorale`) on Right Side (x=+0.175)
    staff_spine = [
        (0.155, 0.340, 0.055),
        (0.168, 0.620, 0.050),
        (0.178, 0.920, 0.045),
        (0.185, 1.160, 0.045),
    ]
    staff_radii = [(0.018, 0.018), (0.019, 0.019), (0.018, 0.018), (0.018, 0.018)]
    parts.append((loft_tube(staff_spine, staff_radii, n_sides=16), "faction_trim"))

    crook_spine = [
        (0.185, 1.155, 0.045),
        (0.212, 1.235, 0.045),
        (0.192, 1.315, 0.045),
        (0.140, 1.330, 0.045),
        (0.110, 1.280, 0.045),
        (0.140, 1.240, 0.045),
    ]
    crook_radii = [
        (0.020, 0.020),
        (0.019, 0.019),
        (0.018, 0.018),
        (0.016, 0.016),
        (0.014, 0.014),
        (0.018, 0.018),
    ]
    parts.append((loft_tube(crook_spine, crook_radii, n_sides=16), "faction_trim"))

    return parts


def build_knight_cavallo() -> list[tuple[trimesh.Trimesh, str]]:
    """♘ Knight (`knight-classic-cavallo.glb`, 1.35m):
    Pure, noble Classic Staunton Warhorse:
    - Turned ivory-and-gold Staunton pedestal (`y=0.00..0.34`)
    - Sculpted arched horse neck, crisp jaw/throatlatch break, cheekbones, flared nostrils & alert ears
    - Flowing scalloped marble mane along the back of the neck
    - Classic medieval brushed-gold bridle/headstall & cheek rosettes (zero goggles, zero exhaust pipes!)
    """
    parts = build_staunton_pedestal()

    # Additional stepped upper pedestal moulding (y=0.235..0.34)
    upper_ped = [
        (0.235, 0.235),
        (0.245, 0.285),
        (0.215, 0.340),
    ]
    parts.append((revolve_profile(upper_ped, n_theta=56), "faction_primary"))
    parts.append((make_torus(0.242, 0.020, 0.022, 0.275, n_major=48, n_minor=14), "faction_trim"))

    # Sculpted Staunton Warhorse Neck with crisp throatlatch undercut (y=0.33..1.09)
    neck_spine = [
        (0.0, 0.330, 0.000),
        (0.0, 0.460, -0.012),
        (0.0, 0.620, -0.032),
        (0.0, 0.780, -0.040),
        (0.0, 0.940, -0.025),
        (0.0, 1.085, 0.012),
    ]
    neck_radii = [
        (0.185, 0.195),
        (0.168, 0.182),
        (0.148, 0.172),
        (0.135, 0.162),
        (0.128, 0.152),
        (0.122, 0.135),
    ]
    parts.append((loft_tube(neck_spine, neck_radii, n_sides=32), "faction_primary"))

    # Equine head & tapered muzzle
    muzzle_spine = [
        (0.0, 1.100, 0.025),
        (0.0, 1.020, 0.125),
        (0.0, 0.915, 0.205),
        (0.0, 0.825, 0.262),
    ]
    muzzle_radii = [
        (0.126, 0.122),
        (0.092, 0.098),
        (0.072, 0.082),
        (0.082, 0.078),
    ]
    parts.append((loft_tube(muzzle_spine, muzzle_radii, n_sides=28), "faction_primary"))

    # Cheekbones, expressive eyes, flared nostrils & alert ears
    for side in (-1.0, 1.0):
        cheek = make_ellipsoid(
            radii=(0.048, 0.072, 0.068),
            center=(side * 0.092, 1.005, 0.055),
            subdivisions=2,
        )
        parts.append((cheek, "faction_primary"))

        # Noble sculpted horse eye
        eye = make_ellipsoid(
            radii=(0.020, 0.022, 0.022),
            center=(side * 0.084, 1.055, 0.098),
            subdivisions=2,
        )
        parts.append((eye, "accent_obsidian"))

        nostril_flare = make_ellipsoid(
            radii=(0.036, 0.034, 0.036),
            center=(side * 0.052, 0.838, 0.258),
            subdivisions=2,
        )
        parts.append((nostril_flare, "faction_primary"))

        nostril_pit = make_ellipsoid(
            radii=(0.018, 0.020, 0.018),
            center=(side * 0.056, 0.835, 0.282),
            subdivisions=2,
        )
        parts.append((nostril_pit, "accent_obsidian"))

        ear_spine = [
            (side * 0.085, 1.150, 0.015),
            (side * 0.098, 1.245, 0.020),
            (side * 0.090, 1.330, 0.025),
        ]
        ear_radii = [(0.038, 0.030), (0.030, 0.024), (0.012, 0.010)]
        parts.append((loft_tube(ear_spine, ear_radii, n_sides=18), "faction_primary"))

        # Classic Golden Bridle Rosette Boss at the bit corner (`x=±0.078, y=0.86, z=0.22`)
        parts.append(
            (
                make_ellipsoid((0.024, 0.024, 0.024), (side * 0.078, 0.865, 0.220), subdivisions=2),
                "faction_trim",
            )
        )

        # Classic Golden Bridle Cheek Strap running from bit rosette up to browband
        strap_spine = [
            (side * 0.078, 0.865, 0.220),
            (side * 0.095, 0.965, 0.145),
            (side * 0.095, 1.075, 0.065),
        ]
        strap_radii = [(0.014, 0.014), (0.014, 0.014), (0.014, 0.014)]
        parts.append((loft_tube(strap_spine, strap_radii, n_sides=14), "faction_trim"))

    # Golden noseband ring around the muzzle above the nostrils
    noseband = make_torus(
        major_r=0.082,
        minor_r_radial=0.014,
        minor_r_vertical=0.014,
        y_center=0.885,
        n_major=32,
        n_minor=12,
        tilt_x=0.65,
        offset_xyz=(0.0, 0.0, 0.215),
    )
    parts.append((noseband, "faction_trim"))

    # Full, Lush Scalloped Marble Mane along back of neck
    mane_spine = [
        (0.000, 1.255, 0.045),
        (0.015, 1.325, -0.015),
        (-0.015, 1.300, -0.098),
        (0.018, 1.180, -0.168),
        (-0.018, 1.020, -0.198),
        (0.016, 0.840, -0.202),
        (-0.015, 0.650, -0.188),
        (0.000, 0.460, -0.162),
    ]
    mane_radii = [
        (0.055, 0.050),
        (0.068, 0.062),
        (0.076, 0.070),
        (0.080, 0.074),
        (0.078, 0.072),
        (0.074, 0.068),
        (0.066, 0.060),
        (0.052, 0.048),
    ]

    def mane_scallops(idx: int, th: float) -> float:
        return 1.0 + 0.18 * math.cos(6.0 * th + idx * 1.5)

    parts.append((loft_tube(mane_spine, mane_radii, n_sides=28, ridge_fn=mane_scallops), "faction_primary"))

    return parts


def build_rook_torre() -> list[tuple[trimesh.Trimesh, str]]:
    """♖ Rook (`rook-classic-torre.glb`, 1.30m):
    Torre Matildea / Rocca Estense (Ferrara & Lidi Ferraresi):
    - Turned ivory-and-gold Staunton pedestal (`y=0.00..0.24`)
    - Tapered square-chamfered Ferrarese terracotta brick tower (`accent_terracotta`, `y=0.24..0.82`)
      with ivory marble corner quoins (`faction_primary`) & arched Renaissance windows (`accent_obsidian`)
    - Overhanging corbelled machicolation gallery (`beccatelli e caditoie estensi`, `y=0.80..0.92`)
    - Ivory marble parapet with 8 Ghibelline swallowtail battlements (`merli a coda di rondine`, `y=0.92..1.08`)
    - Octagonal Ferrarese Renaissance roof lantern turret & conical spire with golden finial (`y=1.02..1.30m`)
    """
    parts = build_staunton_pedestal()

    # 1. Lower & Upper Terracotta Ferrarese Tower Shaft (square-chamfered profile, y=0.24..0.82)
    lower_shaft = make_rounded_box(
        extents=(0.355, 0.255, 0.355),
        center=(0.0, 0.365, 0.0),
        power=0.22,
        subdivisions=2,
    )
    parts.append((lower_shaft, "accent_terracotta"))

    # Ivory marble stringcourse belt (`marcapiano`, y=0.495)
    belt_moulding = make_rounded_box(
        extents=(0.382, 0.032, 0.382),
        center=(0.0, 0.495, 0.0),
        power=0.20,
        subdivisions=2,
    )
    parts.append((belt_moulding, "faction_primary"))

    upper_shaft = make_rounded_box(
        extents=(0.325, 0.310, 0.325),
        center=(0.0, 0.660, 0.0),
        power=0.22,
        subdivisions=2,
    )
    parts.append((upper_shaft, "accent_terracotta"))

    # 4 Ivory Marble Corner Quoins (`bugnato d'angolo`) on the upper tower corners
    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            quoin = make_rounded_box(
                extents=(0.068, 0.295, 0.068),
                center=(sx * 0.142, 0.660, sz * 0.142),
                power=0.22,
                subdivisions=2,
            )
            parts.append((quoin, "faction_primary"))

    # 4 Arched Renaissance Windows (`finestre ad arco`) on the 4 faces of the upper shaft (y=0.655)
    for k in range(4):
        th = k * math.pi * 0.5
        wx = 0.162 * math.cos(th)
        wz = 0.162 * math.sin(th)
        win_frame = make_rounded_box(
            extents=(0.088, 0.135, 0.026),
            center=(wx, 0.655, wz),
            power=0.38,
            subdivisions=2,
            rot_y=-th,
        )
        parts.append((win_frame, "faction_primary"))
        win_void = make_rounded_box(
            extents=(0.048, 0.098, 0.032),
            center=(wx, 0.652, wz),
            power=0.38,
            subdivisions=2,
            rot_y=-th,
        )
        parts.append((win_void, "accent_obsidian"))

    # 2. Overhanging Estense Corbel Machicolation Gallery (`beccatelli e caditoie`, y=0.80..0.92)
    for side_idx in range(4):
        th = side_idx * math.pi * 0.5
        for offset in (-0.115, -0.038, 0.038, 0.115):
            bx = offset * math.cos(th) - 0.178 * math.sin(th)
            bz = offset * math.sin(th) + 0.178 * math.cos(th)
            corbel = make_rounded_box(
                extents=(0.034, 0.095, 0.052),
                center=(bx, 0.848, bz),
                power=0.28,
                subdivisions=2,
                rot_y=-th,
            )
            parts.append((corbel, "faction_primary"))

    # Golden frieze band above corbels (y=0.905)
    frieze = make_rounded_box(
        extents=(0.415, 0.026, 0.415),
        center=(0.0, 0.905, 0.0),
        power=0.18,
        subdivisions=2,
    )
    parts.append((frieze, "faction_trim"))

    # 3. Ivory Marble Parapet Wall & 8 Ghibelline Swallowtail Battlements (`merli`, y=0.915..1.075)
    parapet_base = make_rounded_box(
        extents=(0.405, 0.085, 0.405),
        center=(0.0, 0.955, 0.0),
        power=0.18,
        subdivisions=2,
    )
    parts.append((parapet_base, "faction_primary"))

    # 3 crenellated merlons per face (corners + midpoints) with golden top trim
    for mx in (-0.155, 0.0, 0.155):
        for mz in (-0.155, 0.0, 0.155):
            if mx == 0.0 and mz == 0.0:
                continue
            merlon = make_rounded_box(
                extents=(0.086, 0.088, 0.086),
                center=(mx, 1.032, mz),
                power=0.22,
                subdivisions=2,
            )
            parts.append((merlon, "faction_primary"))
            merlon_cap = make_rounded_box(
                extents=(0.090, 0.018, 0.090),
                center=(mx, 1.078, mz),
                power=0.22,
                subdivisions=2,
            )
            parts.append((merlon_cap, "faction_trim"))

    # 4. Octagonal Ferrarese Renaissance Roof Lantern Turret & Conical Spire (y=0.99..1.30m)
    lantern_prof = [
        (0.118, 0.990),
        (0.118, 1.030),
        (0.105, 1.040),
        (0.105, 1.145),
        (0.122, 1.160),
        (0.016, 1.258),
    ]
    parts.append((revolve_profile(lantern_prof, n_theta=8), "faction_primary"))
    parts.append((make_torus(0.116, 0.014, 0.012, 1.155, n_major=32, n_minor=12), "faction_trim"))
    parts.append((make_ellipsoid((0.026, 0.032, 0.026), (0.0, 1.276, 0.0), subdivisions=2), "faction_trim"))

    return parts


def build_pawn_pedone() -> list[tuple[trimesh.Trimesh, str]]:
    """♙ Pawn (`pawn-classic-pedone.glb`, 0.95m):
    Pure Iconic Vanilla Staunton Pawn (`Pedone Classico`):
    - Turned ivory-and-gold Staunton pedestal (`y=0.00..0.24`)
    - Graceful concave-tapered baluster column shaft (`y=0.235..0.58`)
    - Crisp double brushed-gold collar ring (`y=0.56..0.62`)
    - Smooth, unadorned spherical ivory marble ball head (`y=0.61..0.91`) topped with a petite golden finial button (`0.95m`)
    """
    parts = build_staunton_pedestal()

    # Smooth concave-tapered ivory marble baluster shaft (y=0.235..0.585)
    shaft_profile = [
        (0.218, 0.235),
        (0.182, 0.295),
        (0.142, 0.395),
        (0.116, 0.495),
        (0.108, 0.555),
        (0.136, 0.585),
    ]
    parts.append((revolve_profile(shaft_profile, n_theta=56), "faction_primary"))

    # Crisp double brushed-gold collar ring at the neck (y=0.575..0.620)
    parts.append((make_torus(0.158, 0.022, 0.018, 0.582, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.136, 0.016, 0.014, 0.615, n_major=48, n_minor=14), "faction_trim"))

    # Pure, smooth spherical Ivory Marble Pawn Ball Head (y=0.61..0.91)
    parts.append((make_ellipsoid((0.152, 0.150, 0.152), (0.0, 0.760, 0.0), subdivisions=3), "faction_primary"))

    # Petite classic golden finial button at the very top of the sphere (y=0.90..0.95)
    parts.append((make_torus(0.038, 0.010, 0.009, 0.905, n_major=32, n_minor=12), "faction_trim"))
    parts.append((make_ellipsoid((0.028, 0.024, 0.028), (0.0, 0.928, 0.0), subdivisions=2), "faction_trim"))

    return parts


PIECE_BUILDERS = [
    ("king", "king-classic-re", 1.80, build_king_re),
    ("queen", "queen-classic-regina", 1.65, build_queen_regina),
    ("bishop", "bishop-classic-vescovo", 1.45, build_bishop_vescovo),
    ("knight", "knight-classic-cavallo", 1.35, build_knight_cavallo),
    ("rook", "rook-classic-torre", 1.30, build_rook_torre),
    ("pawn", "pawn-classic-pedone", 0.95, build_pawn_pedone),
]


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    summary = []
    for piece, slug, height_m, builder_fn in PIECE_BUILDERS:
        out_glb = MODELS_DIR / f"{slug}.glb"
        parts = builder_fn()
        stats = export_piece_glb(parts, target_height_m=height_m, out_path=out_glb)
        summary.append(stats)
        print(
            f"🗿 [{piece}] {stats['file']}: {stats['faces']} tris, "
            f"height={stats['height_m']}m, min_y={stats['min_y']}, "
            f"watertight={stats['watertight']}, materials={stats['materials']}",
            flush=True,
        )
    (HERE / "build_summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
