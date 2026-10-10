#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["trimesh>=4.0.0", "numpy>=1.24.0", "scipy>=1.10.0", "networkx>=3.0", "pygltflib>=1.16.0"]
# ///
"""Deterministic 3D sculptor for all 6 Carlessian Classic (`.glb`) chess pieces.

Matches the 6 Nano Banana 2.1 portraits in `assets/characters/<piece>-classic-<slug>.jpg`
1-to-1 in silhouette, props, and material colors while strictly satisfying `assets/families/_contract.json`.

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


def build_king_cesso() -> list[tuple[trimesh.Trimesh, str]]:
    """♔ King (`king-classic-cesso.glb`, 1.80m):
    - Pedestal with embossed golden/obsidian rune tablets around the lower marble torus
    - Scalloped 8-point gold crown band surrounding a visible inner ivory marble dome
    - Large (x1.35) Golden Royal Toilet-Throne finial with square cistern tank, porcelain seat, armrests & mini crown
    """
    parts = build_staunton_pedestal(extra_trim_mat="faction_trim", carve_runes=True)

    # 12 Embossed Rune Glyphs around the lower marble torus (y=0.105, r=0.335) so runes read at thumbnail scale
    for k in range(12):
        th = 2.0 * math.pi * k / 12.0
        rx = 0.334 * math.cos(th)
        rz = 0.334 * math.sin(th)
        rune_glyph = make_rounded_box(
            extents=(0.018, 0.042, 0.016),
            center=(rx, 0.105, rz),
            power=0.35,
            subdivisions=2,
            rot_y=-th,
        )
        parts.append((rune_glyph, "faction_trim"))

    # Tapered ivory marble column shaft (y=0.23..0.96)
    shaft_profile = [
        (0.235, 0.235),
        (0.220, 0.280),
        (0.182, 0.400),
        (0.156, 0.540),
        (0.145, 0.680),
        (0.152, 0.790),
        (0.180, 0.850),
        (0.160, 0.890),
        (0.190, 0.930),
        (0.168, 0.965),
    ]
    parts.append((revolve_profile(shaft_profile, n_theta=56), "faction_primary"))

    # Ornate gold collar rings along the shaft & neck
    parts.append((make_torus(0.228, 0.018, 0.022, 0.258, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.168, 0.016, 0.020, 0.805, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.200, 0.024, 0.022, 0.865, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.178, 0.015, 0.016, 0.968, n_major=48, n_minor=14), "faction_trim"))

    # Prominent Inner Ivory Marble Crown Cushion Dome (y=0.98..1.29) visible through & above crown valleys
    parts.append((make_ellipsoid((0.185, 0.155, 0.185), (0.0, 1.135, 0.0), subdivisions=3), "faction_primary"))

    # Scalloped 8-Point Gold Crown Band wrapping the marble dome (valleys dip to 1.11, peaks rise to 1.24)
    crown_profile = [
        (0.172, 0.970),
        (0.188, 1.020),
        (0.205, 1.075),
        (0.218, 1.125),
        (0.165, 1.135),
    ]

    def crown_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        if y >= 1.06:
            t = (y - 1.06) / 0.075
            # Deep scalloped 8-point crown peaks rising sharply while valleys stay low to expose marble dome
            wave = (0.5 + 0.5 * math.cos(8.0 * th)) ** 1.6
            spike = 0.115 * t * wave - 0.020 * t * (1.0 - wave)
            r_flare = 0.018 * t * wave
            return r + r_flare, y + spike, 0.0
        return r, y, 0.0

    parts.append((revolve_profile(crown_profile, n_theta=64, radial_mod=crown_mod), "faction_trim"))

    # === LARGE (x1.35) GOLDEN ROYAL TOILET-THRONE FINIAL (y=1.27..1.80) ===
    # 1. Toilet pedestal & sculpted golden bowl (y=1.27..1.51)
    bowl_profile = [
        (0.125, 1.270),
        (0.140, 1.298),
        (0.085, 1.350),
        (0.095, 1.385),
        (0.182, 1.445),
        (0.202, 1.490),
        (0.162, 1.508),
    ]

    def bowl_elongate(th: float, r: float, y: float) -> tuple[float, float, float]:
        z_shift = 0.045 * max(0.0, (y - 1.35) / 0.15)
        return r, y, z_shift * math.cos(th)

    parts.append((revolve_profile(bowl_profile, n_theta=44, radial_mod=bowl_elongate), "faction_trim"))

    # 2. Gleaming white porcelain toilet seat ring (y=1.515, thick & bright)
    seat_ring = make_torus(
        major_r=0.158,
        minor_r_radial=0.038,
        minor_r_vertical=0.024,
        y_center=1.515,
        n_major=40,
        n_minor=14,
        offset_xyz=(0.0, 0.0, 0.036),
    )
    parts.append((seat_ring, "accent_porcelain"))

    # 3. Crisp Square-Profile Golden Toilet Cistern/Tank at the back (z=-0.115, y=1.46..1.71)
    tank_box = make_rounded_box(
        extents=(0.310, 0.245, 0.135),
        center=(0.0, 1.585, -0.115),
        power=0.18,  # crisp square box profile!
        subdivisions=2,
    )
    parts.append((tank_box, "faction_trim"))

    # Square-edged Tank Top Golden Molding Lid
    tank_lid = make_rounded_box(
        extents=(0.338, 0.042, 0.155),
        center=(0.0, 1.705, -0.115),
        power=0.18,
        subdivisions=2,
    )
    parts.append((tank_lid, "faction_trim"))

    # 4. Raised Oval Porcelain-Rim Toilet Lid resting in front of tank (z=-0.035, y=1.52..1.70)
    raised_lid_back = make_ellipsoid(
        radii=(0.135, 0.115, 0.026),
        center=(0.0, 1.610, -0.036),
        subdivisions=2,
    )
    parts.append((raised_lid_back, "faction_trim"))
    raised_lid_inner = make_ellipsoid(
        radii=(0.105, 0.088, 0.022),
        center=(0.0, 1.610, -0.022),
        subdivisions=2,
    )
    parts.append((raised_lid_inner, "accent_porcelain"))

    # 5. Bold Royal Throne Armrests on left and right (x=±0.195, y=1.50..1.63)
    for side in (-1.0, 1.0):
        arm_spine = [
            (side * 0.165, 1.500, -0.065),
            (side * 0.198, 1.590, -0.020),
            (side * 0.198, 1.600, 0.075),
            (side * 0.170, 1.525, 0.105),
        ]
        arm_radii = [(0.025, 0.025), (0.028, 0.028), (0.028, 0.028), (0.022, 0.022)]
        parts.append((loft_tube(arm_spine, arm_radii, n_sides=18), "faction_trim"))
        # Large white porcelain armrest pommel spheres
        parts.append(
            (
                make_ellipsoid((0.036, 0.036, 0.036), (side * 0.198, 1.610, 0.085), subdivisions=2),
                "accent_porcelain",
            )
        )

    # 6. Golden flush lever on side of square cistern
    flush_handle = make_rounded_box(
        extents=(0.085, 0.032, 0.032),
        center=(0.185, 1.655, -0.115),
        power=0.35,
        subdivisions=2,
    )
    parts.append((flush_handle, "faction_trim"))

    # 7. Miniature Royal Crown finial perched on top of the toilet tank (y=1.715..1.80)
    mini_crown_prof = [
        (0.075, 1.712),
        (0.090, 1.745),
        (0.108, 1.780),
        (0.068, 1.798),
    ]

    def mini_crown_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        spike = 0.024 * max(0.0, (y - 1.745) / 0.052) * (0.5 + 0.5 * math.cos(6.0 * th))
        return r, y + spike, 0.0

    mini_crown = revolve_profile(mini_crown_prof, n_theta=36, radial_mod=mini_crown_mod)
    mini_crown.vertices[:, 2] -= 0.115
    parts.append((mini_crown, "faction_trim"))

    return parts


def build_queen_ciocco() -> list[tuple[trimesh.Trimesh, str]]:
    """♕ Queen (`queen-classic-ciocco.glb`, 1.65m): Fluted Staunton Queen + thick glasses + Swiss chocolate coronet."""
    parts = build_staunton_pedestal()

    # Fluted ivory marble gown shaft (y=0.235..0.98)
    shaft_profile = [
        (0.232, 0.235),
        (0.215, 0.300),
        (0.188, 0.440),
        (0.165, 0.600),
        (0.148, 0.760),
        (0.142, 0.880),
        (0.155, 0.955),
    ]

    def flute_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        if 0.26 <= y <= 0.93:
            env = math.sin((y - 0.26) / 0.67 * math.pi)
            flute = -0.010 * env * (0.5 - 0.5 * math.cos(20.0 * th))
            return r + flute, y, 0.0
        return r, y, 0.0

    parts.append((revolve_profile(shaft_profile, n_theta=64, radial_mod=flute_mod), "faction_primary"))

    # Triple gold collar rings (y=0.95..1.04)
    parts.append((make_torus(0.178, 0.022, 0.018, 0.962, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.164, 0.018, 0.015, 0.998, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.148, 0.015, 0.014, 1.030, n_major=48, n_minor=14), "faction_trim"))

    # Smooth Ivory Marble Head Sphere (y=1.03..1.33)
    head_sphere = make_ellipsoid((0.162, 0.155, 0.162), (0.0, 1.180, 0.0), subdivisions=3)
    parts.append((head_sphere, "faction_primary"))

    # === THICKENED (x1.5) TORTOISE-SHELL / OBSIDIAN EYEGLASSES SNUG AGAINST HEAD (y=1.18, z=+0.152) ===
    for side in (-1.0, 1.0):
        lens_rim = make_torus(
            major_r=0.056,
            minor_r_radial=0.017,
            minor_r_vertical=0.020,
            y_center=0.0,
            n_major=36,
            n_minor=12,
            tilt_x=math.pi * 0.5,
            offset_xyz=(side * 0.068, 1.182, 0.150),
        )
        parts.append((lens_rim, "accent_obsidian"))

        # Thick temple arm firmly anchored into the sides of the marble head sphere
        temple_spine = [
            (side * 0.120, 1.192, 0.142),
            (side * 0.158, 1.195, 0.075),
            (side * 0.160, 1.190, -0.025),
            (side * 0.142, 1.165, -0.075),
        ]
        temple_radii = [(0.015, 0.019), (0.014, 0.018), (0.014, 0.016), (0.012, 0.015)]
        parts.append((loft_tube(temple_spine, temple_radii, n_sides=16), "accent_obsidian"))

        # Golden hinge stud on the outer rim
        parts.append(
            (
                make_ellipsoid((0.018, 0.018, 0.018), (side * 0.124, 1.192, 0.148), subdivisions=2),
                "faction_trim",
            )
        )

    # Thick eyeglasses bridge anchored to head front
    bridge = make_rounded_box(
        extents=(0.048, 0.024, 0.028),
        center=(0.0, 1.195, 0.158),
        power=0.45,
        subdivisions=2,
    )
    parts.append((bridge, "accent_obsidian"))

    # === SWISS DARK-CHOCOLATE WAVE CORONET (y=1.28..1.55) ===
    choco_profile = [
        (0.145, 1.280),
        (0.165, 1.320),
        (0.182, 1.375),
        (0.198, 1.430),
        (0.210, 1.485),
        (0.165, 1.515),
    ]

    def choco_wave_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        wave_r = 0.009 * math.sin((y - 1.28) * 55.0 + 3.0 * math.cos(8.0 * th))
        if y >= 1.42:
            t = (y - 1.42) / 0.095
            spike_y = 0.048 * t * (0.5 + 0.5 * math.cos(8.0 * th))
            return r + wave_r, y + spike_y, 0.0
        return r + wave_r, y, 0.0

    parts.append((revolve_profile(choco_profile, n_theta=64, radial_mod=choco_wave_mod), "accent_choco"))

    # Inner dark-chocolate cushion dome (y=1.42..1.56)
    parts.append((make_ellipsoid((0.155, 0.085, 0.155), (0.0, 1.480, 0.0), subdivisions=2), "accent_choco"))

    # 8 Golden Chocolate-Truffle Pearls perched on the 8 coronet spikes
    for k in range(8):
        th = 2.0 * math.pi * k / 8.0
        px = 0.192 * math.cos(th)
        pz = 0.192 * math.sin(th)
        parts.append(
            (
                make_ellipsoid((0.027, 0.027, 0.027), (px, 1.542, pz), subdivisions=2),
                "faction_trim",
            )
        )

    # Central swirled golden-cocoa finial orb at apex (y=1.55..1.65)
    def swirl_deform(v: np.ndarray) -> np.ndarray:
        out = v.copy()
        ang = np.arctan2(out[:, 2], out[:, 0]) + out[:, 1] * 28.0
        scale = 1.0 + 0.08 * np.cos(6.0 * ang)
        out[:, 0] *= scale
        out[:, 2] *= scale
        return out

    finial_orb = make_ellipsoid(
        radii=(0.046, 0.054, 0.046),
        center=(0.0, 1.600, 0.0),
        subdivisions=2,
        deform_fn=swirl_deform,
    )
    parts.append((finial_orb, "faction_trim"))

    return parts


def build_bishop_drago() -> list[tuple[trimesh.Trimesh, str]]:
    """♗ Bishop (`bishop-classic-drago.glb`, 1.45m):
    - Pointed mitre with bold dark diagonal slit wedge (`accent_obsidian`) so slit is 100% readable
    - Distinct Ruby Dragon Head sphere (`r=0.065`) + snout + 2 tall golden horn cones + 2 golden/obsidian eyes
    - Sculpted triangular ruby Dragon Wing plate flaring left (`-X`) + tapered scaly tail curling right (`+X`)
    - Faceted purple Amethyst Crystal finial in a golden calyx
    """
    parts = build_staunton_pedestal()

    # Tapered ivory marble shaft (y=0.235..0.82)
    shaft_profile = [
        (0.228, 0.235),
        (0.205, 0.300),
        (0.168, 0.430),
        (0.142, 0.580),
        (0.132, 0.720),
        (0.152, 0.800),
    ]
    parts.append((revolve_profile(shaft_profile, n_theta=56), "faction_primary"))

    # Ornate triple gold collar rings (y=0.77..0.89)
    parts.append((make_torus(0.158, 0.016, 0.016, 0.780, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.192, 0.024, 0.020, 0.825, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.162, 0.016, 0.016, 0.870, n_major=48, n_minor=14), "faction_trim"))

    # Pointed Bishop Mitre (y=0.88..1.33) with deep diagonal scroll slit
    mitre_profile = [
        (0.148, 0.880),
        (0.178, 0.940),
        (0.198, 1.020),
        (0.196, 1.100),
        (0.172, 1.180),
        (0.128, 1.255),
        (0.068, 1.315),
        (0.035, 1.335),
    ]

    def mitre_slit_mod(th: float, r: float, y: float) -> tuple[float, float, float]:
        x0 = r * math.cos(th)
        z0 = r * math.sin(th)
        if z0 > -0.02 and 0.93 <= y <= 1.28:
            diag = (y - 1.10) - 0.60 * (x0 / max(r, 0.05))
            if abs(diag) < 0.075:
                depth = math.cos(diag / 0.075 * math.pi * 0.5) ** 2
                front_weight = max(0.0, math.sin(th) + 0.15) ** 1.2
                r_carved = r * (1.0 - 0.52 * min(1.0, depth * front_weight))
                return r_carved, y, 0.0
        return r, y, 0.0

    parts.append((revolve_profile(mitre_profile, n_theta=64, radial_mod=mitre_slit_mod), "faction_primary"))

    # Dark Obsidian Inset Wedge lining the diagonal mitre slit so the Bishop slit reads with high contrast!
    slit_spine = [
        (-0.125, 0.985, 0.125),
        (-0.065, 1.045, 0.155),
        (0.000, 1.105, 0.165),
        (0.065, 1.165, 0.150),
        (0.115, 1.220, 0.110),
    ]
    slit_radii = [
        (0.032, 0.028),
        (0.042, 0.035),
        (0.045, 0.038),
        (0.042, 0.035),
        (0.030, 0.026),
    ]
    parts.append((loft_tube(slit_spine, slit_radii, n_sides=20), "accent_obsidian"))

    # === RUBY-SCARLET DRAGON HEAD, HORNS, EYES, TRIANGULAR WING PLATE & COILED TAIL ===
    # 1. Prominent Dragon Head Sphere (r≈0.068) & Snout emerging from upper-middle of the slit
    dragon_head = make_ellipsoid(
        radii=(0.068, 0.062, 0.070),
        center=(0.032, 1.155, 0.210),
        subdivisions=2,
    )
    parts.append((dragon_head, "accent_ruby"))

    dragon_snout = make_ellipsoid(
        radii=(0.048, 0.040, 0.052),
        center=(0.040, 1.138, 0.265),
        subdivisions=2,
    )
    parts.append((dragon_snout, "accent_ruby"))

    # 2. Two Tall Golden Dragon Horn Cones + Expressive Golden/Obsidian Eyes on Dragon Head
    for side in (-1.0, 1.0):
        horn_spine = [
            (0.032 + side * 0.038, 1.195, 0.195),
            (0.036 + side * 0.058, 1.245, 0.172),
            (0.040 + side * 0.072, 1.292, 0.145),
        ]
        horn_radii = [(0.020, 0.020), (0.013, 0.013), (0.005, 0.005)]
        parts.append((loft_tube(horn_spine, horn_radii, n_sides=16), "faction_trim"))

        # Large golden eye sclera
        parts.append(
            (
                make_ellipsoid((0.022, 0.022, 0.018), (0.036 + side * 0.042, 1.168, 0.258), subdivisions=2),
                "faction_trim",
            )
        )
        # Dark obsidian pupil
        parts.append(
            (
                make_ellipsoid((0.012, 0.014, 0.012), (0.036 + side * 0.044, 1.168, 0.270), subdivisions=2),
                "accent_obsidian",
            )
        )

    # 3. Broad Triangular Ruby Dragon Wing Plate flaring out to the LEFT (-X) of the mitre
    wing_plate = make_rounded_box(
        extents=(0.210, 0.155, 0.036),
        center=(-0.145, 1.115, 0.175),
        power=0.55,
        subdivisions=2,
        rot_y=-0.25,
    )
    parts.append((wing_plate, "accent_ruby"))

    # Golden upper wing-bone strut along top edge of left wing
    wing_strut = [
        (-0.025, 1.135, 0.185),
        (-0.125, 1.185, 0.195),
        (-0.235, 1.175, 0.165),
    ]
    parts.append((loft_tube(wing_strut, [(0.018, 0.018), (0.016, 0.016), (0.010, 0.010)], n_sides=16), "faction_trim"))

    # 4. Thick Coiled Scaly Dragon Tail curling down and around the bottom-right (+X) of the mitre
    tail_spine = [
        (0.015, 1.105, 0.185),
        (0.005, 1.030, 0.205),
        (0.045, 0.950, 0.218),
        (0.115, 0.915, 0.205),
        (0.175, 0.945, 0.165),
        (0.185, 1.015, 0.125),
        (0.145, 1.055, 0.120),
    ]
    tail_radii = [
        (0.048, 0.046),
        (0.044, 0.042),
        (0.040, 0.038),
        (0.035, 0.032),
        (0.028, 0.026),
        (0.020, 0.018),
        (0.012, 0.010),
    ]

    def dragon_scales(idx: int, th: float) -> float:
        return 1.0 + 0.15 * math.cos(6.0 * th + idx * 1.1)

    parts.append((loft_tube(tail_spine, tail_radii, n_sides=24, ridge_fn=dragon_scales), "accent_ruby"))

    # === GOLDEN CALYX & GLOWING PURPLE AMETHYST CRYSTAL FINIAL (y=1.32..1.45) ===
    calyx_prof = [
        (0.048, 1.320),
        (0.070, 1.342),
        (0.080, 1.365),
        (0.056, 1.375),
    ]
    parts.append((revolve_profile(calyx_prof, n_theta=36), "faction_trim"))

    amethyst = make_rounded_box(
        extents=(0.120, 0.115, 0.120),
        center=(0.0, 1.402, 0.0),
        power=0.78,
        subdivisions=2,
        rot_y=math.pi * 0.25,
    )
    parts.append((amethyst, "accent_amethyst"))

    return parts


def build_knight_turbo() -> list[tuple[trimesh.Trimesh, str]]:
    """♘ Knight (`knight-classic-turbo.glb`, 1.35m):
    - Carved horse head with distinct muzzle/jaw break, flared nostrils & wide wavy mane
    - Front-mounted brass racing goggles with glowing cyan lenses
    - Twin chrome & gold turbo exhaust pipes swept BACKWARD 30° along the sides of the neck
    - Hot-orange loop-track base rim
    """
    parts: list[tuple[trimesh.Trimesh, str]] = []

    # 1. Bright Hot-Orange Loop-Track Base Rim at bottom of pedestal (y=0.00..0.055)
    track_rim_prof = [
        (0.365, 0.000),
        (0.375, 0.018),
        (0.375, 0.042),
        (0.345, 0.056),
    ]
    parts.append((revolve_profile(track_rim_prof, n_theta=56), "accent_orange"))

    # 2. Stepped Ivory Marble & Brushed Gold Pedestal above the orange track rim (y=0.05..0.34)
    ped_prof = [
        (0.340, 0.050),
        (0.352, 0.095),
        (0.325, 0.135),
        (0.265, 0.175),
        (0.285, 0.215),
        (0.235, 0.260),
        (0.245, 0.315),
        (0.215, 0.340),
    ]
    parts.append((revolve_profile(ped_prof, n_theta=56), "faction_primary"))
    parts.append((make_torus(0.338, 0.015, 0.012, 0.062, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.278, 0.018, 0.016, 0.185, n_major=48, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.242, 0.020, 0.024, 0.275, n_major=48, n_minor=14), "faction_trim"))

    # 3. Sculpted Staunton Horse Neck with distinct Jaw/Throatlatch Undercut & Tapered Muzzle
    neck_spine = [
        (0.0, 0.330, 0.000),
        (0.0, 0.460, -0.012),
        (0.0, 0.620, -0.032),
        (0.0, 0.780, -0.040),
        (0.0, 0.940, -0.025),
        (0.0, 1.080, 0.010),
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

    # Distinct equine cheek/jawbone mass + tapered bridge of nose & muzzle (creates crisp jaw break!)
    muzzle_spine = [
        (0.0, 1.095, 0.025),
        (0.0, 1.020, 0.125),
        (0.0, 0.915, 0.205),
        (0.0, 0.825, 0.262),
    ]
    muzzle_radii = [
        (0.126, 0.122),
        (0.092, 0.098),
        (0.072, 0.082),
        (0.082, 0.078),  # flared muzzle tip
    ]
    parts.append((loft_tube(muzzle_spine, muzzle_radii, n_sides=28), "faction_primary"))

    # Left & right sculpted jowl/cheekbone flares and flared nostrils
    for side in (-1.0, 1.0):
        cheek = make_ellipsoid(
            radii=(0.048, 0.072, 0.068),
            center=(side * 0.092, 1.005, 0.055),
            subdivisions=2,
        )
        parts.append((cheek, "faction_primary"))

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

    # Pointed Horse Ears (left and right, y=1.16..1.33)
    for side in (-1.0, 1.0):
        ear_spine = [
            (side * 0.085, 1.145, 0.015),
            (side * 0.098, 1.235, 0.020),
            (side * 0.090, 1.315, 0.025),
        ]
        ear_radii = [(0.038, 0.030), (0.030, 0.024), (0.012, 0.010)]
        parts.append((loft_tube(ear_spine, ear_radii, n_sides=18), "faction_primary"))

    # Full, Lush Wavy Scalloped Marble Mane (waving left/right along back of neck so back view is rich!)
    mane_spine = [
        (0.000, 1.245, 0.045),
        (0.018, 1.315, -0.015),
        (-0.018, 1.295, -0.098),
        (0.022, 1.180, -0.168),
        (-0.022, 1.020, -0.198),
        (0.020, 0.840, -0.202),
        (-0.018, 0.650, -0.188),
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

    # === VINTAGE BRASS & GLOWING CYAN RACING GOGGLES ON FRONT OF HORSE FACE (y=1.055, z=+0.205) ===
    goggle_strap = make_torus(
        major_r=0.132,
        minor_r_radial=0.018,
        minor_r_vertical=0.024,
        y_center=1.060,
        n_major=36,
        n_minor=12,
        tilt_x=0.22,
        offset_xyz=(0.0, 0.0, 0.038),
    )
    parts.append((goggle_strap, "accent_obsidian"))

    for side in (-1.0, 1.0):
        bezel = make_torus(
            major_r=0.054,
            minor_r_radial=0.016,
            minor_r_vertical=0.022,
            y_center=0.0,
            n_major=32,
            n_minor=12,
            tilt_x=math.pi * 0.36,
            offset_xyz=(side * 0.062, 1.055, 0.198),
        )
        parts.append((bezel, "faction_trim"))

        lens = make_ellipsoid(
            radii=(0.048, 0.040, 0.028),
            center=(side * 0.062, 1.055, 0.210),
            subdivisions=2,
        )
        parts.append((lens, "accent_cyan"))

    goggle_bridge = make_rounded_box(
        extents=(0.045, 0.024, 0.028),
        center=(0.0, 1.062, 0.212),
        power=0.45,
        subdivisions=2,
    )
    parts.append((goggle_bridge, "faction_trim"))

    # === TWIN CHROME & GOLD SIDE TURBO EXHAUST PIPES SWEPT BACKWARD 30° (matching 2D portrait!) ===
    for side in (-1.0, 1.0):
        for y_off, z_off in [(0.0, 0.030), (-0.060, -0.020)]:
            # Chrome manifold bend emerging from side of neck and sweeping backward (-Z)
            header_spine = [
                (side * 0.130, 0.535 + y_off, z_off),
                (side * 0.190, 0.540 + y_off, z_off - 0.025),
                (side * 0.225, 0.605 + y_off, z_off - 0.075),
            ]
            header_radii = [(0.025, 0.025), (0.023, 0.023), (0.023, 0.023)]
            parts.append((loft_tube(header_spine, header_radii, n_sides=18), "accent_steel"))

            # Ribbed golden turbo muffler barrel angled upward & swept backward 30° (-Z)
            muffler_spine = [
                (side * 0.218, 0.590 + y_off, z_off - 0.068),
                (side * 0.262, 0.700 + y_off, z_off - 0.135),
                (side * 0.298, 0.805 + y_off, z_off - 0.195),
            ]
            muffler_radii = [(0.030, 0.030), (0.032, 0.032), (0.028, 0.028)]
            parts.append((loft_tube(muffler_spine, muffler_radii, n_sides=20), "faction_trim"))

    return parts


def build_rook_puffo() -> list[tuple[trimesh.Trimesh, str]]:
    """♖ Rook (`rook-classic-puffo.glb`, 1.30m): Grossmünster masonry tower + smooth purple peeker + 4 paws."""
    parts = build_staunton_pedestal()

    # Tapered masonry castle tower with crisp deep battlements (y=0.235..1.05)
    tower_profile = [
        (0.235, 0.235),
        (0.218, 0.300),
        (0.198, 0.480),
        (0.184, 0.660),
        (0.176, 0.800),
        (0.210, 0.860),
        (0.228, 0.910),
        (0.228, 1.015),
        (0.175, 1.028),
    ]

    def masonry_and_battlements(th: float, r: float, y: float) -> tuple[float, float, float]:
        if 0.30 <= y <= 0.79:
            course = int((y - 0.30) / 0.07)
            horiz_groove = math.exp(-(((y - 0.30) % 0.07 - 0.035) / 0.008) ** 2)
            vert_phase = th * 8.0 + (course % 2) * math.pi
            vert_groove = max(0.0, math.cos(vert_phase)) ** 12
            r_mason = r - 0.005 * horiz_groove - 0.005 * vert_groove
            return r_mason, y, 0.0
        if y >= 0.915:
            merlon = math.tanh(4.5 * math.cos(6.0 * th))
            t = (y - 0.915) / 0.113
            y_castellated = y + 0.055 * t * merlon
            return r, y_castellated, 0.0
        return r, y, 0.0

    parts.append((revolve_profile(tower_profile, n_theta=72, radial_mod=masonry_and_battlements), "faction_primary"))

    # Upper gold tower ring below corbel (y=0.805)
    parts.append((make_torus(0.186, 0.018, 0.016, 0.805, n_major=48, n_minor=14), "faction_trim"))

    # === SMOOTH PURPLE MONSTER ("PUFFO / PUPURABBU") PEEKING OVER BATTLEMENTS (y=0.92..1.30) ===
    monster_head = make_ellipsoid(
        radii=(0.168, 0.195, 0.165),
        center=(0.0, 1.105, 0.0),
        subdivisions=3,
    )
    parts.append((monster_head, "accent_puffo"))

    # Two Big Expressive Monster Eyes facing +Z (x=±0.056, y=1.135, z=+0.150)
    for side in (-1.0, 1.0):
        parts.append(
            (
                make_ellipsoid((0.044, 0.048, 0.028), (side * 0.056, 1.135, 0.148), subdivisions=2),
                "accent_porcelain",
            )
        )
        parts.append(
            (
                make_ellipsoid((0.028, 0.030, 0.020), (side * 0.054, 1.135, 0.164), subdivisions=2),
                "accent_cyan",
            )
        )
        parts.append(
            (
                make_ellipsoid((0.016, 0.018, 0.015), (side * 0.053, 1.135, 0.174), subdivisions=2),
                "accent_obsidian",
            )
        )
        brow = make_rounded_box(
            extents=(0.064, 0.022, 0.028),
            center=(side * 0.058, 1.195, 0.150),
            power=0.5,
            subdivisions=2,
        )
        parts.append((brow, "accent_puffo"))

    # 4 Purple Paws gripping the stone merlons
    for px, pz in [(-0.125, 0.185), (0.125, 0.185), (-0.165, -0.115), (0.165, -0.115)]:
        paw = make_ellipsoid(
            radii=(0.050, 0.038, 0.052),
            center=(px, 1.038, pz),
            subdivisions=2,
        )
        parts.append((paw, "accent_puffo"))

    # Cheerful toothy grin on front of monster face
    for side in (-1.0, 1.0):
        tooth = make_rounded_box(
            extents=(0.024, 0.022, 0.018),
            center=(side * 0.038, 1.068, 0.164),
            power=0.5,
            subdivisions=2,
        )
        parts.append((tooth, "accent_porcelain"))

    return parts


def build_pawn_puffin() -> list[tuple[trimesh.Trimesh, str]]:
    """♙ Pawn (`pawn-classic-puffin.glb`, 0.95m):
    - Staunton Pawn + puffin beak with bold protruding dark obsidian & gold stripe rings
    - Steel & gold Swiss Guard morion helmet
    - Tapered crimson central plume + 2 sculpted side feather tufts
    """
    parts = build_staunton_pedestal()

    # Tapered ivory marble pawn shaft (y=0.235..0.52)
    shaft_profile = [
        (0.215, 0.235),
        (0.175, 0.290),
        (0.135, 0.380),
        (0.112, 0.470),
        (0.138, 0.515),
    ]
    parts.append((revolve_profile(shaft_profile, n_theta=48), "faction_primary"))

    # Double golden collar ring under the head (y=0.49..0.54)
    parts.append((make_torus(0.152, 0.020, 0.016, 0.505, n_major=44, n_minor=14), "faction_trim"))
    parts.append((make_torus(0.132, 0.015, 0.014, 0.535, n_major=44, n_minor=14), "faction_trim"))

    # Spherical Ivory Marble Puffin-Pawn Head (y=0.54..0.77)
    parts.append((make_ellipsoid((0.145, 0.132, 0.145), (0.0, 0.655, 0.0), subdivisions=3), "faction_primary"))

    # Glossy dark eyes + golden cheek rosettes
    for side in (-1.0, 1.0):
        parts.append(
            (
                make_ellipsoid((0.026, 0.028, 0.022), (side * 0.068, 0.665, 0.126), subdivisions=2),
                "accent_obsidian",
            )
        )
        parts.append(
            (
                make_ellipsoid((0.022, 0.020, 0.020), (side * 0.048, 0.625, 0.145), subdivisions=2),
                "faction_trim",
            )
        )

    # Prominent Sculpted Orange Puffin Beak pointing +Z (y=0.59..0.68, z=+0.12..+0.25)
    beak_spine = [
        (0.0, 0.642, 0.115),
        (0.0, 0.635, 0.165),
        (0.0, 0.620, 0.215),
        (0.0, 0.602, 0.252),
    ]
    beak_radii = [
        (0.048, 0.055),
        (0.036, 0.046),
        (0.024, 0.034),
        (0.010, 0.014),
    ]
    parts.append((loft_tube(beak_spine, beak_radii, n_sides=24), "accent_orange"))

    # Bold Protruding Puffin Beak Dark Band Stripe & Golden Base Band (clearly visible at thumbnail scale!)
    beak_dark_band = make_ellipsoid(
        radii=(0.042, 0.051, 0.022),
        center=(0.0, 0.629, 0.185),
        subdivisions=2,
    )
    parts.append((beak_dark_band, "accent_obsidian"))

    beak_gold_band = make_ellipsoid(
        radii=(0.049, 0.057, 0.018),
        center=(0.0, 0.638, 0.148),
        subdivisions=2,
    )
    parts.append((beak_gold_band, "faction_trim"))

    # === SILVER-STEEL & GOLD SWISS GUARD MORION HELMET (y=0.68..0.84) ===
    helmet_dome = make_ellipsoid((0.155, 0.105, 0.162), (0.0, 0.725, -0.005), subdivisions=2)
    parts.append((helmet_dome, "accent_steel"))

    morion_brim = make_torus(
        major_r=0.172,
        minor_r_radial=0.032,
        minor_r_vertical=0.012,
        y_center=0.705,
        n_major=48,
        n_minor=14,
        wave_cycles=2,
        wave_amp=0.035,
    )
    v_brim = morion_brim.vertices.copy()
    th_b = np.arctan2(v_brim[:, 2], v_brim[:, 0])
    v_brim[:, 1] = (v_brim[:, 1] - 0.705) - 0.035 * np.sin(2.0 * th_b) - 0.038 * np.cos(2.0 * th_b) + 0.705
    morion_brim = trimesh.Trimesh(vertices=v_brim, faces=morion_brim.faces, process=True)
    morion_brim.fix_normals()
    parts.append((morion_brim, "accent_steel"))

    # Ornate golden central morion comb / crest running front-to-back across helmet top
    crest_spine = [
        (0.0, 0.755, 0.125),
        (0.0, 0.815, 0.060),
        (0.0, 0.835, 0.000),
        (0.0, 0.810, -0.075),
        (0.0, 0.745, -0.135),
    ]
    crest_radii = [
        (0.018, 0.024),
        (0.022, 0.036),
        (0.024, 0.040),
        (0.022, 0.034),
        (0.016, 0.022),
    ]
    parts.append((loft_tube(crest_spine, crest_radii, n_sides=20), "faction_trim"))

    # === TAPERED CENTRAL CRIMSON PLUME + 2 SCULPTED SIDE FEATHER TUFTS (y=0.81..0.95) ===
    center_plume_spine = [
        (0.0, 0.815, 0.020),
        (0.0, 0.875, 0.012),
        (0.0, 0.930, -0.015),
        (0.0, 0.950, -0.060),
        (0.0, 0.910, -0.115),
    ]
    center_plume_radii = [
        (0.028, 0.032),
        (0.046, 0.056),
        (0.048, 0.062),
        (0.036, 0.048),
        (0.018, 0.024),
    ]
    parts.append((loft_tube(center_plume_spine, center_plume_radii, n_sides=22), "accent_crimson"))

    # 2 Sweeping Side Feather Tufts fanning left and right (matching the split-heart plume in 2D!)
    for side in (-1.0, 1.0):
        tuft_spine = [
            (side * 0.018, 0.820, 0.010),
            (side * 0.052, 0.880, 0.002),
            (side * 0.068, 0.932, -0.025),
            (side * 0.048, 0.918, -0.085),
        ]
        tuft_radii = [
            (0.022, 0.026),
            (0.038, 0.044),
            (0.034, 0.042),
            (0.016, 0.022),
        ]
        parts.append((loft_tube(tuft_spine, tuft_radii, n_sides=20), "accent_crimson"))

    return parts


PIECE_BUILDERS = [
    ("king", "king-classic-cesso", 1.80, build_king_cesso),
    ("queen", "queen-classic-ciocco", 1.65, build_queen_ciocco),
    ("bishop", "bishop-classic-drago", 1.45, build_bishop_drago),
    ("knight", "knight-classic-turbo", 1.35, build_knight_turbo),
    ("rook", "rook-classic-puffo", 1.30, build_rook_puffo),
    ("pawn", "pawn-classic-puffin", 0.95, build_pawn_puffin),
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
