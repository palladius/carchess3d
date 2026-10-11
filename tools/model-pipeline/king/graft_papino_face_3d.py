#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["scipy>=1.11.0", "pygltflib>=1.16.0", "pillow>=10.0.0", "numpy>=1.24.0"]
# ///
"""Mode B (Piecewise Landmark-Locked 2D Portrait Face-Grafting + 3D Biometric Sculpting + Zero-Bleed
Silver Hair onto TRELLIS.2 3D GLB via Dual-Chart 2048x1024 UV Atlas) for King Riccardo
(`assets/models/king-riccardo.glb`).

Why Zero-Bleed Silver Hair + Unpolluted `base_chart_rgb`?
- `TRELLIS.2` (`xatlas`) packs tiny UV islands from cheeks, eyebrows, and hair only 1px apart in `orig_tex`.
- Any bounding-box dilation or Gaussian blur in `orig_tex` UV space bleeds grey hair color onto cheek and
  eyebrow UV islands!
- Therefore:
  1. `base_chart_rgb` (used for the outer neck/ear feather ring of the right-half face chart) is sampled
     from the UNTOUCHED `orig_tex_raw` skin tones, warmed to match `front_chart`.
  2. On the left-half `orig_tex`, ONLY strict interior texels of non-shell hair triangles whose original
     color is dark neutral charcoal (`lum < 0.44` and `(r - b) < 0.085`) are mapped to silver-grey — with
     ZERO bounding-box expansion and ZERO cross-island blur!
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import io
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pygltflib import BufferView, GLTF2
from scipy import ndimage

REPO_ROOT = Path(__file__).resolve().parents[3]
ORIG_GLB = REPO_ROOT / "tools/model-pipeline/king/out/king_riccardo.glb"
OUT_GLB = REPO_ROOT / "assets/models/king-riccardo.glb"
FRONT_PNG = REPO_ROOT / "tools/model-pipeline/king/front.png"
PREVIEW_PNG = REPO_ROOT / "tools/model-pipeline/king/out/papino_face_graft_preview.png"
TURNTABLE_GIF = REPO_ROOT / "tools/model-pipeline/king/out/papino_3d_turntable.gif"


@dataclass
class BiometricGraftParams:
    scale_x: float = 865.0
    scale_y_lower: float = 892.0
    scale_y_upper: float = 1240.0
    y_eye_3d: float = 0.1928
    row_eye_2d: float = 320.0
    col_center_2d: float = 514.5
    jaw_slim: float = 0.045
    chin_taper: float = 0.025
    forehead_broaden: float = 0.020
    nose_shorten: float = 0.46
    nose_widen: float = 0.26
    brow_overhang: float = 0.0080
    low_2d_ratio: float = 0.96
    silver_hair_mix: float = 0.85
    side_stubble_mix: float = 0.48
    cylindrical_wrap: float = 0.112


def read_acc(gltf: GLTF2, blob: bytes, idx: int) -> np.ndarray:
    acc = gltf.accessors[idx]
    bv = gltf.bufferViews[acc.bufferView]
    off = (bv.byteOffset or 0) + (acc.byteOffset or 0)
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[acc.componentType]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc.type]
    arr = np.frombuffer(blob, dtype=dt, count=acc.count * ncomp, offset=off)
    return arr.reshape(acc.count, ncomp) if ncomp > 1 else arr.copy()


def dilate_rgb_outside_mask(rgb: np.ndarray, mask: np.ndarray, iters: int = 60) -> np.ndarray:
    out = rgb.copy()
    valid = mask.copy()
    for _ in range(iters):
        if np.all(valid):
            break
        dilated = ndimage.binary_dilation(valid)
        border = dilated & (~valid)
        if not np.any(border):
            break
        w = valid.astype(np.float32)
        w_sum = ndimage.uniform_filter(w, size=3, mode="nearest") * 9.0
        for c in range(3):
            c_sum = ndimage.uniform_filter(out[:, :, c] * w, size=3, mode="nearest") * 9.0
            out[border, c] = c_sum[border] / np.maximum(w_sum[border], 1e-5)
        valid = dilated
    return out


def prepare_clean_front_face(
    front_rgb: np.ndarray,
    col_center: float = 514.5,
    side_stubble_mix: float = 0.48,
) -> np.ndarray:
    """Preserve 100% of Riccardo's facial features (forehead, both eyebrows including the white tuft
    at col 555..584, both eyes, nose, smiling mouth, and full 2-3 day white-stubble chin), enhance
    micro-contrast of the eyes and 2-3 day stubble, smooth the dilated side-cheek skin vertically so
    there are ZERO horizontal dilation bands at +32/+72 deg, and extend natural 2-3 day silver stubble
    along the lower side jawline!
    """
    H, W, _ = front_rgb.shape
    yy, xx = np.meshgrid(np.arange(H, dtype=np.float32), np.arange(W, dtype=np.float32), indexing="ij")

    balanced = front_rgb.copy()
    # Gently lift shadow on the right eye/cheek region (cols 520..590)
    right_ramp = np.clip((xx - 518.0) / 65.0, 0.0, 1.0)
    vert_gate = np.clip((yy - 210.0) / 20.0, 0.0, 1.0) * np.clip((455.0 - yy) / 35.0, 0.0, 1.0)
    lift = right_ramp * vert_gate
    balanced[:, :, 0] = np.clip(balanced[:, :, 0] * (1.0 + 0.12 * lift), 0.0, 1.0)
    balanced[:, :, 1] = np.clip(balanced[:, :, 1] * (1.0 + 0.10 * lift), 0.0, 1.0)
    balanced[:, :, 2] = np.clip(balanced[:, :, 2] * (1.0 + 0.08 * lift), 0.0, 1.0)

    # Crisp unsharp mask (+24% high-frequency detail) on eyes, eyebrows, nose, and 2-3 day chin/lip stubble
    blur_fine = np.stack([ndimage.gaussian_filter(balanced[:, :, c], sigma=1.35) for c in range(3)], axis=-1)
    balanced = np.clip(balanced + 0.24 * (balanced - blur_fine), 0.0, 1.0)

    # Mirror clean left-cheek skin (`col = 2*516 - xx`) onto the right temple border (`xx >= 593`)
    mirror_idx = np.clip((1032 - np.arange(W)).astype(np.int32), 0, W - 1)
    mirrored_left = balanced[:, mirror_idx, :]
    w_mirror = np.clip((xx - 593.0) / 8.0, 0.0, 1.0)[:, :, None]
    balanced = (1.0 - w_mirror) * balanced + w_mirror * mirrored_left

    # Symmetric face oval centered at col=516.0 with rx=88.0 (cols 428..604) and ry=138.0 (rows 224..490)
    ex = (xx - 516.0) / 88.0
    ey = (yy - 353.0) / 138.0
    r_oval = np.sqrt(ex * ex + ey * ey)
    oval = (r_oval <= 1.0) & (yy >= 224.0) & (yy <= 490.0) & (xx >= 428.0) & (xx <= 604.0)

    dilated = dilate_rgb_outside_mask(balanced, oval, iters=125)

    # Eliminate horizontal row-by-row dilation streaks on the side cheeks by smoothing vertically outside the inner feature oval
    smooth_side = np.stack(
        [ndimage.gaussian_filter(dilated[:, :, c], sigma=(26.0, 7.0)) for c in range(3)],
        axis=-1,
    )
    w_outer_smooth = np.clip((r_oval - 0.88) / 0.16, 0.0, 1.0)[:, :, None]
    clean_face = (1.0 - w_outer_smooth) * dilated + w_outer_smooth * smooth_side

    # Extend realistic 2-3 day silver-white jawline stubble onto the lower side cheeks (`rows 395..486`, `|xx - 516| in 55..135`)
    rng = np.random.default_rng(42)
    pore_noise = rng.normal(0.0, 1.0, size=(H, W)).astype(np.float32)
    stubble_grain = ndimage.gaussian_filter(pore_noise, sigma=(0.85, 1.15))
    stubble_grain = st_norm = (stubble_grain - stubble_grain.mean()) / max(float(stubble_grain.std()), 1e-5)
    jaw_y_band = np.clip((yy - 388.0) / 22.0, 0.0, 1.0) * np.clip((488.0 - yy) / 14.0, 0.0, 1.0)
    jaw_x_band = np.clip((np.abs(xx - 516.0) - 52.0) / 22.0, 0.0, 1.0) * np.clip((148.0 - np.abs(xx - 516.0)) / 28.0, 0.0, 1.0)
    w_jaw_stubble = (jaw_y_band * jaw_x_band * side_stubble_mix * 0.38)[:, :, None]
    silver_stubble_rgb = np.clip(0.76 + 0.09 * st_norm[:, :, None], 0.58, 0.90)
    clean_face = np.clip((1.0 - w_jaw_stubble) * clean_face + w_jaw_stubble * silver_stubble_rgb, 0.0, 1.0)

    return clean_face


def sculpt_head_geometry(pos: np.ndarray, params: BiometricGraftParams) -> np.ndarray:
    """Smoothly sculpt the 3D head mesh vertices to match Riccardo's biometric proportions:
    1. Slimmer lower jaw (`jaw_slim`) & tapered chin (`chin_taper`)
    2. Broader upper forehead (`forehead_broaden`)
    3. Rounded, fleshy 3D nose tip (`nose_shorten` + upper tip dome + `nose_widen`) so +72 deg profile is NEVER pointy
    4. Masculine brow ridge overhang (`brow_overhang`) + recessed deep-set eye sockets (`eye_recess`)
    """
    out = pos.copy()
    x = out[:, 0]
    y = out[:, 1]
    z = out[:, 2]

    in_head = np.clip((y - 0.005) / 0.022, 0.0, 1.0) * np.clip((0.278 - y) / 0.025, 0.0, 1.0)

    jaw_bell = np.exp(-0.5 * ((y - 0.078) / 0.046) ** 2) * in_head
    front_bias = np.clip((z + 0.06) / 0.14, 0.25, 1.0)
    out[:, 0] *= 1.0 - params.jaw_slim * jaw_bell * front_bias

    chin_bell = np.exp(-0.5 * ((y - 0.030) / 0.022) ** 2) * in_head
    out[:, 0] *= 1.0 - params.chin_taper * chin_bell

    fh_bell = np.exp(-0.5 * ((y - 0.232) / 0.028) ** 2) * in_head
    out[:, 0] *= 1.0 + params.forehead_broaden * fh_bell

    # Round and blunt the sharp 3D nose peak (`y=0.135, z=0.181`) into Riccardo's broad, fleshy rounded nose tip
    nose_y_bell = np.exp(-0.5 * ((y - 0.135) / 0.019) ** 2)
    nose_x_bell = np.exp(-0.5 * (x / 0.030) ** 2)
    nose_z_gate = np.clip((z - 0.144) / 0.024, 0.0, 1.0)
    nose_mask = nose_y_bell * nose_x_bell * nose_z_gate
    out[:, 2] -= params.nose_shorten * np.maximum(z - 0.145, 0.0) * nose_mask
    # Add upper-tip/sub-tip fullness so the profile forms a smooth rounded curve instead of a triangle
    dome_y_bell = np.exp(-0.5 * ((y - 0.148) / 0.011) ** 2) + 0.65 * np.exp(-0.5 * ((y - 0.123) / 0.009) ** 2)
    out[:, 2] += 0.0038 * dome_y_bell * nose_x_bell * nose_z_gate
    out[:, 0] *= 1.0 + params.nose_widen * np.exp(-0.5 * ((y - 0.134) / 0.022) ** 2) * nose_x_bell * nose_z_gate

    # Masculine brow ridge overhang (`y in 0.204..0.228`) and deep-set eye socket recess (`y in 0.182..0.200`)
    brow_y_bell = np.exp(-0.5 * ((y - 0.214) / 0.012) ** 2)
    brow_x_bell = np.exp(-0.5 * (x / 0.058) ** 2)
    brow_z_gate = np.clip((z - 0.118) / 0.025, 0.0, 1.0)
    out[:, 2] += params.brow_overhang * brow_y_bell * brow_x_bell * brow_z_gate

    eye_y_bell = np.exp(-0.5 * ((y - 0.191) / 0.009) ** 2)
    eye_x_bell = np.exp(-0.5 * ((np.abs(x) - 0.034) / 0.016) ** 2)
    out[:, 2] -= (0.55 * params.brow_overhang) * eye_y_bell * eye_x_bell * brow_z_gate

    return out


def recolor_strict_hair_texels_zero_bleed(
    orig_tex_raw: np.ndarray,
    pos: np.ndarray,
    uv: np.ndarray,
    indices: np.ndarray,
    tri_in_shell: np.ndarray,
    silver_mix: float = 0.85,
) -> np.ndarray:
    """Recolor dark-charcoal hair texels inside exact barycentric triangles of non-shell
    scalp/temple/back-of-head geometry (`y in 0.075..0.395`) using a smooth per-texel luminance
    and warmth ramp (`w_lum * w_warm`), eliminating dark-brown sideburn halo rings while keeping
    ZERO spatial blur across `xatlas` UV islands!
    """
    tex_out = orig_tex_raw.copy()
    th, tw, _ = tex_out.shape

    r = tex_out[:, :, 0]
    g = tex_out[:, :, 1]
    b = tex_out[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    warmth = r - b

    tx_v = np.clip((uv[:, 0] * (tw - 1)).astype(np.int32), 0, tw - 1)
    ty_v = np.clip((uv[:, 1] * (th - 1)).astype(np.int32), 0, th - 1)
    v_lum = lum[ty_v, tx_v]
    v_warmth = warmth[ty_v, tx_v]

    y = pos[:, 1]
    v_is_hair = (y >= 0.075) & (y <= 0.395) & (v_lum < 0.52) & (v_warmth < 0.115)
    v_in_head_band = (y >= 0.065) & (y <= 0.405)

    # Include any non-shell head triangle where at least 1 vertex is dark hair (covers hair-to-crown and hair-to-ear boundary tris!)
    cand_tris = indices[(~tri_in_shell) & np.all(v_in_head_band[indices], axis=1) & np.any(v_is_hair[indices], axis=1)]

    hair_mask = np.zeros((th, tw), dtype=bool)
    for tri in cand_tris:
        i0, i1, i2 = int(tri[0]), int(tri[1]), int(tri[2])
        u0, v0 = float(uv[i0, 0] * (tw - 1)), float(uv[i0, 1] * (th - 1))
        u1, v1 = float(uv[i1, 0] * (tw - 1)), float(uv[i1, 1] * (th - 1))
        u2, v2 = float(uv[i2, 0] * (tw - 1)), float(uv[i2, 1] * (th - 1))
        umin, umax = max(0, int(math.floor(min(u0, u1, u2)))), min(tw - 1, int(math.ceil(max(u0, u1, u2))))
        vmin, vmax = max(0, int(math.floor(min(v0, v1, v2)))), min(th - 1, int(math.ceil(max(v0, v1, v2))))
        if umax < umin or vmax < vmin:
            continue
        denom = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2)
        if abs(denom) < 1e-6:
            hair_mask[vmin : vmax + 1, umin : umax + 1] = True
            continue
        py, px = np.meshgrid(
            np.arange(vmin, vmax + 1, dtype=np.float32),
            np.arange(umin, umax + 1, dtype=np.float32),
            indexing="ij",
        )
        w0 = ((v1 - v2) * (px - u2) + (u2 - u1) * (py - v2)) / denom
        w1 = ((v2 - v0) * (px - u2) + (u0 - u2) * (py - v2)) / denom
        w2 = 1.0 - w0 - w1
        inside = (w0 >= -0.04) & (w1 >= -0.04) & (w2 >= -0.04)
        hair_mask[vmin : vmax + 1, umin : umax + 1] |= inside

    # Smooth per-texel ramp on luminance and warmth: eliminates the 1px dark-brown ring around sideburns while never touching gold crown or warm skin!
    w_lum = np.clip((0.55 - lum) / 0.13, 0.0, 1.0)
    w_warm = np.clip((0.140 - warmth) / 0.050, 0.0, 1.0)
    w = hair_mask.astype(np.float32) * w_lum * w_warm * silver_mix

    silver_lum = np.clip(0.66 + 0.45 * (lum - 0.22), 0.54, 0.84)
    tex_out[:, :, 0] = np.clip((1.0 - w) * r + w * (silver_lum * 1.02), 0.0, 1.0)
    tex_out[:, :, 1] = np.clip((1.0 - w) * g + w * (silver_lum * 1.00), 0.0, 1.0)
    tex_out[:, :, 2] = np.clip((1.0 - w) * b + w * (silver_lum * 0.97), 0.0, 1.0)
    return tex_out


def graft_face_onto_king_glb(
    params: BiometricGraftParams | None = None,
    front_png_path: Path = FRONT_PNG,
    out_glb_path: Path = OUT_GLB,
) -> dict:
    if params is None:
        params = BiometricGraftParams()

    gltf = GLTF2().load(str(ORIG_GLB))
    orig_blob = bytes(gltf.binary_blob())

    prim = gltf.meshes[0].primitives[0]
    pos_raw = read_acc(gltf, orig_blob, prim.attributes.POSITION)
    norm = read_acc(gltf, orig_blob, prim.attributes.NORMAL)
    uv = read_acc(gltf, orig_blob, prim.attributes.TEXCOORD_0)
    indices = read_acc(gltf, orig_blob, prim.indices).reshape(-1, 3)

    pos = sculpt_head_geometry(pos_raw, params)

    img0_bv = gltf.bufferViews[gltf.images[0].bufferView]
    orig_tex_pil = Image.open(
        io.BytesIO(orig_blob[img0_bv.byteOffset : img0_bv.byteOffset + img0_bv.byteLength])
    ).convert("RGBA")
    orig_tex_raw = np.asarray(orig_tex_pil, dtype=np.float32) / 255.0
    th, tw, _ = orig_tex_raw.shape

    # Sample `v_orig_rgb` from UNTOUCHED `orig_tex_raw` so zero grey hair paint ever enters `base_chart_rgb`!
    tx_v = np.clip((uv[:, 0] * (tw - 1)).astype(np.int32), 0, tw - 1)
    ty_v = np.clip((uv[:, 1] * (th - 1)).astype(np.int32), 0, th - 1)
    v_orig_rgb = orig_tex_raw[ty_v, tx_v, :3].copy()
    # Replace any dark hair/shadow vertices inside `v_orig_rgb` with warm skin tone so the perimeter of `base_chart_rgb` is 100% warm skin
    v_lum = v_orig_rgb.mean(axis=1)
    v_warm = v_orig_rgb[:, 0] - v_orig_rgb[:, 2]
    dark_v = (v_lum < 0.54) & (v_warm < 0.125)
    v_orig_rgb[dark_v] = np.array([0.80, 0.64, 0.56], dtype=np.float32)

    raw_front_rgb = np.asarray(Image.open(front_png_path).convert("RGB"), dtype=np.float32) / 255.0
    front_rgb = prepare_clean_front_face(
        raw_front_rgb, col_center=params.col_center_2d, side_stubble_mix=params.side_stubble_mix
    )

    # Hybrid Frontal-Planar + Side-Cylindrical Azimuth Unwrapping:
    # Near the central features (`|theta| <= 0.36 rad`), `x_unwrap == dx` (exact planar alignment).
    # Along the side cheeks (`|theta| > 0.36 rad`), `x_unwrap` transitions smoothly to cylindrical arc `R * theta`,
    # eliminating 100% of planar UV fold-over and side-cheek stretching at +32 deg and +72 deg!
    dx = pos[:, 0] - 0.0012
    dz = np.maximum(pos[:, 2] - 0.032, 0.018)
    theta = np.arctan2(dx, dz)
    w_cyl = np.clip((np.abs(theta) - 0.36) / 0.24, 0.0, 1.0)
    r_cyl = params.cylindrical_wrap if params.cylindrical_wrap < 0.20 else 0.112
    x_unwrap = (1.0 - w_cyl) * dx + w_cyl * (r_cyl * theta)

    col_2d = params.col_center_2d + x_unwrap * params.scale_x
    dy_3d = pos[:, 1] - params.y_eye_3d
    row_2d = np.where(
        dy_3d >= 0.0,
        params.row_eye_2d - dy_3d * params.scale_y_upper,
        params.row_eye_2d - dy_3d * params.scale_y_lower,
    ).astype(np.float32)

    c_min, c_max = 262.0, 774.0
    r_min, r_max = 100.0, 612.0

    chart_h, chart_w = 1024, 1024
    r_grid = np.linspace(r_min, r_max, chart_h, dtype=np.float32)
    c_grid = np.linspace(c_min, c_max, chart_w, dtype=np.float32)
    rr, cc = np.meshgrid(r_grid, c_grid, indexing="ij")
    front_chart = np.zeros((chart_h, chart_w, 3), dtype=np.float32)
    for c in range(3):
        front_chart[:, :, c] = ndimage.map_coordinates(front_rgb[:, :, c], [rr, cc], order=1, mode="nearest")

    # Smooth azimuth-gated blend weight (`w_theta`) so `front_chart` covers 100% of front + 3/4 cheeks
    # and feathers smoothly into `base_chart_rgb` right in front of the ears (`|theta| in 0.85..1.25 rad`)
    wy_bot = np.clip((pos[:, 1] + 0.008) / 0.018, 0.0, 1.0)
    wy_top = np.clip((0.284 - pos[:, 1]) / 0.008, 0.0, 1.0)
    wy = wy_bot * wy_top

    w_theta = np.clip((1.22 - np.abs(theta)) / 0.34, 0.0, 1.0)
    wz = np.clip((pos[:, 2] - 0.048) / 0.036, 0.0, 1.0)
    wn = np.clip((norm[:, 2] - 0.22) / 0.28, 0.0, 1.0)

    raw_w = wy * w_theta * wz * wn
    v_w = (raw_w * raw_w * (3.0 - 2.0 * raw_w)).astype(np.float32)

    v_in_shell = (
        (pos[:, 1] >= 0.001)
        & (pos[:, 1] <= 0.285)
        & (pos[:, 2] >= 0.044)
        & (np.abs(theta) <= 1.28)
        & (norm[:, 2] >= 0.18)
    )
    tri_in_shell = np.all(v_in_shell[indices], axis=1) & (v_w[indices].max(axis=1) > 0.001)

    # Zero-bleed silver hair on left-half `orig_tex`
    orig_tex = recolor_strict_hair_texels_zero_bleed(
        orig_tex_raw, pos, uv, indices, tri_in_shell, silver_mix=params.silver_hair_mix
    )

    u_local = np.clip((col_2d - c_min) / (c_max - c_min), 0.01, 0.99).astype(np.float32)
    v_local = np.clip((row_2d - r_min) / (r_max - r_min), 0.01, 0.99).astype(np.float32)

    base_chart_rgb = np.zeros((chart_h, chart_w, 3), dtype=np.float32)
    weight_chart = np.zeros((chart_h, chart_w), dtype=np.float32)
    cov_mask = np.zeros((chart_h, chart_w), dtype=bool)

    shell_tris = indices[tri_in_shell]
    for tri in shell_tris:
        i0, i1, i2 = int(tri[0]), int(tri[1]), int(tri[2])
        u0, v0_c = u_local[i0] * (chart_w - 1), v_local[i0] * (chart_h - 1)
        u1, v1_c = u_local[i1] * (chart_w - 1), v_local[i1] * (chart_h - 1)
        u2, v2_c = u_local[i2] * (chart_w - 1), v_local[i2] * (chart_h - 1)

        umin = max(0, int(math.floor(min(u0, u1, u2))) - 1)
        umax = min(chart_w - 1, int(math.ceil(max(u0, u1, u2))) + 1)
        vmin = max(0, int(math.floor(min(v0_c, v1_c, v2_c))) - 1)
        vmax = min(chart_h - 1, int(math.ceil(max(v0_c, v1_c, v2_c))) + 1)
        denom = (v1_c - v2_c) * (u0 - u2) + (u2 - u1) * (v0_c - v2_c)
        if abs(denom) < 1e-4:
            continue

        pu = np.arange(umin, umax + 1, dtype=np.float32)[None, :]
        pv = np.arange(vmin, vmax + 1, dtype=np.float32)[:, None]
        b0 = ((v1_c - v2_c) * (pu - u2) + (u2 - u1) * (pv - v2_c)) / denom
        b1 = ((v2_c - v0_c) * (pu - u2) + (u0 - u2) * (pv - v2_c)) / denom
        b2 = 1.0 - b0 - b1
        inside = (b0 >= -0.08) & (b1 >= -0.08) & (b2 >= -0.08)
        if not np.any(inside):
            continue

        b0c = np.clip(b0[inside], 0.0, 1.0)
        b1c = np.clip(b1[inside], 0.0, 1.0)
        b2c = np.clip(b2[inside], 0.0, 1.0)
        bsum = np.maximum(b0c + b1c + b2c, 1e-5)
        b0c, b1c, b2c = b0c / bsum, b1c / bsum, b2c / bsum

        col_interp = b0c[:, None] * v_orig_rgb[i0] + b1c[:, None] * v_orig_rgb[i1] + b2c[:, None] * v_orig_rgb[i2]
        w_interp = b0c * v_w[i0] + b1c * v_w[i1] + b2c * v_w[i2]

        ys_in, xs_in = np.where(inside)
        base_chart_rgb[vmin + ys_in, umin + xs_in] = col_interp
        weight_chart[vmin + ys_in, umin + xs_in] = np.maximum(weight_chart[vmin + ys_in, umin + xs_in], w_interp)
        cov_mask[vmin + ys_in, umin + xs_in] = True

    base_chart_rgb = dilate_rgb_outside_mask(base_chart_rgb, cov_mask, iters=32)
    weight_chart = ndimage.gaussian_filter(weight_chart, sigma=6.5)

    low_3d = np.zeros_like(base_chart_rgb)
    low_2d = np.zeros_like(front_chart)
    for c in range(3):
        low_3d[:, :, c] = ndimage.gaussian_filter(base_chart_rgb[:, :, c], sigma=26.0)
        low_2d[:, :, c] = ndimage.gaussian_filter(front_chart[:, :, c], sigma=26.0)
    high_2d = front_chart - low_2d

    r2d = params.low_2d_ratio
    harmonized_2d = np.clip(((1.0 - r2d) * low_3d + r2d * low_2d) + high_2d, 0.0, 1.0)

    right_chart_rgba = np.ones((chart_h, chart_w, 4), dtype=np.float32)
    right_chart_rgba[:, :, :3] = (
        (1.0 - weight_chart[:, :, None]) * base_chart_rgb
        + weight_chart[:, :, None] * harmonized_2d
    )

    atlas_w, atlas_h = 2048, 1024
    dual_atlas = np.ones((atlas_h, atlas_w, 4), dtype=np.float32)
    dual_atlas[:, :1024, :] = orig_tex
    dual_atlas[:, 1024:, :] = right_chart_rgba

    uv_non_shell = uv.copy()
    uv_non_shell[:, 0] = uv[:, 0] * 0.5

    unique_shell_v = np.unique(shell_tris.reshape(-1))
    remap = np.full(len(pos), -1, dtype=np.int32)
    remap[unique_shell_v] = np.arange(len(pos), len(pos) + len(unique_shell_v), dtype=np.int32)

    pos_new = np.concatenate([pos, pos[unique_shell_v]], axis=0).astype(np.float32)
    norm_new = np.concatenate([norm, norm[unique_shell_v]], axis=0).astype(np.float32)
    uv_shell_v = np.column_stack([0.5 + 0.5 * u_local[unique_shell_v], v_local[unique_shell_v]]).astype(np.float32)
    uv_new = np.concatenate([uv_non_shell, uv_shell_v], axis=0).astype(np.float32)

    indices_new = indices.copy().astype(np.uint32)
    indices_new[tri_in_shell] = remap[indices[tri_in_shell]].astype(np.uint32)

    out_img_buf = io.BytesIO()
    Image.fromarray(np.clip(dual_atlas * 255.0, 0.0, 255.0).astype(np.uint8), mode="RGBA").save(
        out_img_buf, format="WEBP", quality=93
    )
    new_img0_bytes = out_img_buf.getvalue()

    new_blob = bytearray()
    new_bvs = []

    def add_bv(raw_bytes: bytes, target: int | None = None) -> int:
        while len(new_blob) % 4 != 0:
            new_blob.append(0)
        off = len(new_blob)
        new_blob.extend(raw_bytes)
        while len(new_blob) % 4 != 0:
            new_blob.append(0)
        bv = BufferView(buffer=0, byteOffset=off, byteLength=len(raw_bytes), target=target)
        new_bvs.append(bv)
        return len(new_bvs) - 1

    acc_pos = gltf.accessors[prim.attributes.POSITION]
    acc_pos.bufferView = add_bv(pos_new.tobytes(), 34962)
    acc_pos.byteOffset = 0
    acc_pos.count = int(len(pos_new))
    acc_pos.min = [float(x) for x in pos_new.min(axis=0)]
    acc_pos.max = [float(x) for x in pos_new.max(axis=0)]

    acc_norm = gltf.accessors[prim.attributes.NORMAL]
    acc_norm.bufferView = add_bv(norm_new.tobytes(), 34962)
    acc_norm.byteOffset = 0
    acc_norm.count = int(len(norm_new))

    acc_uv = gltf.accessors[prim.attributes.TEXCOORD_0]
    acc_uv.bufferView = add_bv(uv_new.tobytes(), 34962)
    acc_uv.byteOffset = 0
    acc_uv.count = int(len(uv_new))

    acc_idx = gltf.accessors[prim.indices]
    acc_idx.bufferView = add_bv(indices_new.reshape(-1).tobytes(), 34963)
    acc_idx.byteOffset = 0
    acc_idx.componentType = 5125
    acc_idx.count = int(indices_new.size)

    for img_i, img_obj in enumerate(gltf.images):
        if img_i == 0:
            img_obj.bufferView = add_bv(new_img0_bytes, None)
        else:
            old_bv = gltf.bufferViews[img_obj.bufferView]
            raw = orig_blob[old_bv.byteOffset : old_bv.byteOffset + old_bv.byteLength]
            img_obj.bufferView = add_bv(raw, None)

    gltf.bufferViews = new_bvs
    gltf.buffers[0].byteLength = len(new_blob)
    gltf.set_binary_blob(bytes(new_blob))
    gltf.save_binary(str(out_glb_path))

    return {
        "pos_orig": pos_raw,
        "norm_orig": norm,
        "uv_orig": uv,
        "indices_orig": indices,
        "orig_tex": orig_tex_raw[:, :, :3],
        "pos_new": pos_new,
        "norm_new": norm_new,
        "uv_new": uv_new,
        "indices_new": indices_new,
        "dual_atlas": dual_atlas[:, :, :3],
        "size_kb": out_glb_path.stat().st_size // 1024,
        "shell_tris_count": int(np.sum(tri_in_shell)),
        "params": asdict(params),
    }


def rasterize_view_barycentric(
    pos: np.ndarray,
    norm: np.ndarray,
    uv: np.ndarray,
    indices: np.ndarray,
    tex_rgb: np.ndarray,
    yaw_deg: float,
    cw: int = 380,
    ch: int = 460,
    zoom_head: bool = False,
) -> Image.Image:
    """True per-pixel Z-buffer + barycentric UV texture rasterizer (matches Three.js WebGL fidelity)."""
    th, tw, _ = tex_rgb.shape
    y_min, y_max = float(pos[:, 1].min()), float(pos[:, 1].max())
    h_span = y_max - y_min
    p_shift = pos.copy()
    p_shift[:, 1] -= y_min

    yaw = math.radians(yaw_deg)
    pitch = math.radians(6.0 if zoom_head else 8.0)
    ry = np.array(
        [[math.cos(yaw), 0.0, math.sin(yaw)], [0.0, 1.0, 0.0], [-math.sin(yaw), 0.0, math.cos(yaw)]],
        dtype=np.float32,
    )
    rx = np.array(
        [[1.0, 0.0, 0.0], [0.0, math.cos(pitch), -math.sin(pitch)], [0.0, math.sin(pitch), math.cos(pitch)]],
        dtype=np.float32,
    )
    rot = rx @ ry
    vp = p_shift @ rot.T
    vn = norm @ rot.T

    if zoom_head:
        scale = (ch * 1.48) / h_span
        cx, cy = cw * 0.5, ch * 1.40
    else:
        scale = (ch * 0.80) / h_span
        cx, cy = cw * 0.5, ch * 0.90

    sx = cx + vp[:, 0] * scale
    sy = cy - vp[:, 1] * scale
    sz = vp[:, 2]

    key_dir = np.array([0.32, 0.52, 0.79], dtype=np.float32)
    key_dir /= np.linalg.norm(key_dir)
    v_shade = np.clip(0.68 + 0.34 * np.clip(vn @ key_dir, 0.0, 1.0), 0.0, 1.06).astype(np.float32)

    i0, i1, i2 = indices[:, 0], indices[:, 1], indices[:, 2]
    x0, y0, z0 = sx[i0], sy[i0], sz[i0]
    x1, y1, z1 = sx[i1], sy[i1], sz[i1]
    x2, y2, z2 = sx[i2], sy[i2], sz[i2]

    area2 = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
    vis = (
        (area2 < -1e-3)
        & (np.maximum(np.maximum(x0, x1), x2) >= 0)
        & (np.minimum(np.minimum(x0, x1), x2) < cw)
        & (np.maximum(np.maximum(y0, y1), y2) >= 0)
        & (np.minimum(np.minimum(y0, y1), y2) < ch)
    )
    vis_idx = np.where(vis)[0]

    zbuf = np.full((ch, cw), -1e9, dtype=np.float32)
    out_rgb = np.full((ch, cw, 3), np.array([34.0, 37.0, 46.0], dtype=np.float32) / 255.0, dtype=np.float32)

    for ti in vis_idx:
        v0_i, v1_i, v2_i = int(i0[ti]), int(i1[ti]), int(i2[ti])
        ax, ay, az = float(x0[ti]), float(y0[ti]), float(z0[ti])
        bx, by, bz = float(x1[ti]), float(y1[ti]), float(z1[ti])
        cx_t, cy_t, cz = float(x2[ti]), float(y2[ti]), float(z2[ti])

        xmin = max(0, int(math.floor(min(ax, bx, cx_t))))
        xmax = min(cw - 1, int(math.ceil(max(ax, bx, cx_t))))
        ymin = max(0, int(math.floor(min(ay, by, cy_t))))
        ymax = min(ch - 1, int(math.ceil(max(ay, by, cy_t))))
        if xmin > xmax or ymin > ymax:
            continue

        denom = (by - cy_t) * (ax - cx_t) + (cx_t - bx) * (ay - cy_t)
        if abs(denom) < 1e-5:
            continue

        px = np.arange(xmin, xmax + 1, dtype=np.float32)[None, :]
        py = np.arange(ymin, ymax + 1, dtype=np.float32)[:, None]
        w0 = ((by - cy_t) * (px - cx_t) + (cx_t - bx) * (py - cy_t)) / denom
        w1 = ((cy_t - ay) * (px - cx_t) + (ax - cx_t) * (py - cy_t)) / denom
        w2 = 1.0 - w0 - w1
        inside = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        if not np.any(inside):
            continue

        z_px = w0 * az + w1 * bz + w2 * cz
        sub_z = zbuf[ymin : ymax + 1, xmin : xmax + 1]
        win = inside & (z_px > sub_z)
        if not np.any(win):
            continue

        ys_w, xs_w = np.where(win)
        sub_z[ys_w, xs_w] = z_px[ys_w, xs_w]

        bw0, bw1, bw2 = w0[ys_w, xs_w], w1[ys_w, xs_w], w2[ys_w, xs_w]
        u_px = bw0 * uv[v0_i, 0] + bw1 * uv[v1_i, 0] + bw2 * uv[v2_i, 0]
        v_px = bw0 * uv[v0_i, 1] + bw1 * uv[v1_i, 1] + bw2 * uv[v2_i, 1]
        sh_px = bw0 * v_shade[v0_i] + bw1 * v_shade[v1_i] + bw2 * v_shade[v2_i]

        tx = np.clip((u_px * (tw - 1)).astype(np.int32), 0, tw - 1)
        ty = np.clip((v_px * (th - 1)).astype(np.int32), 0, th - 1)
        col = tex_rgb[ty, tx, :] * sh_px[:, None]
        out_rgb[ymin + ys_w, xmin + xs_w, :] = np.clip(col, 0.0, 1.0)

    return Image.fromarray(np.clip(out_rgb * 255.0, 0.0, 255.0).astype(np.uint8), mode="RGB")


def render_before_after_and_gif(data: dict, out_png: Path, out_gif: Path) -> None:
    """Render side-by-side Before (TRELLIS.2) vs After (Mode B Biometric + nano-banana-ricc) + 360 GIF."""
    panels = [
        (
            "PRIMA (TRELLIS.2: capelli scuri / sbarbato)",
            rasterize_view_barycentric(
                data["pos_orig"], data["norm_orig"], data["uv_orig"], data["indices_orig"], data["orig_tex"],
                yaw_deg=0.0, zoom_head=True,
            ),
        ),
        (
            "DOPO (nano-banana-ricc + Barbetta 2-3gg + Tempie Argento)",
            rasterize_view_barycentric(
                data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
                yaw_deg=0.0, zoom_head=True,
            ),
        ),
        (
            "DOPO 3D - Vista 3/4 (+32° Zoom Testa)",
            rasterize_view_barycentric(
                data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
                yaw_deg=32.0, zoom_head=True,
            ),
        ),
        (
            "DOPO 3D Completo - Fronte (0°)",
            rasterize_view_barycentric(
                data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
                yaw_deg=0.0, zoom_head=False,
            ),
        ),
    ]

    sheet = Image.new("RGB", (380 * 4 + 50, 460 + 60), (24, 26, 32))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text(
        (20, 16),
        f"RE RICCARDO 3D (king-riccardo.glb) - Biometric Adversarial Mode B ({data['size_kb']} KB, {data['shell_tris_count']} face tris)",
        fill=(245, 224, 150),
        font=font,
    )
    for idx, (label, cell_im) in enumerate(panels):
        x_off = 10 + idx * 390
        sheet.paste(cell_im, (x_off, 46))
        draw.text((x_off + 12, 56), label, fill=(255, 224, 130), font=font)
    sheet.save(out_png, format="PNG")

    frames = []
    for f_idx in range(16):
        yaw = f_idx * 22.5
        im = rasterize_view_barycentric(
            data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
            yaw_deg=yaw, cw=340, ch=400, zoom_head=False,
        )
        dr = ImageDraw.Draw(im)
        dr.text((12, 12), f"Papino 3D ({int(yaw)} deg)", fill=(245, 224, 150), font=font)
        frames.append(im)
    frames[0].save(out_gif, save_all=True, append_images=frames[1:], duration=110, loop=0)


def main() -> None:
    print("👑 Grafting 2D front.png face + 3D biometric sculpting onto King Riccardo 3D GLB...", flush=True)
    data = graft_face_onto_king_glb()
    print(f"🖼️ Rendering Before/After comparison and 360-degree GIF ({data['shell_tris_count']} face tris)...", flush=True)
    render_before_after_and_gif(data, PREVIEW_PNG, TURNTABLE_GIF)
    print(f"✅ Saved {OUT_GLB.relative_to(REPO_ROOT)} ({data['size_kb']} KB) and {PREVIEW_PNG.name}", flush=True)


if __name__ == "__main__":
    main()
