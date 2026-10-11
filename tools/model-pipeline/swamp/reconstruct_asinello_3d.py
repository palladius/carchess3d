#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["rembg>=2.0.50", "onnxruntime>=1.17.0", "scikit-image>=0.22.0", "scipy>=1.11.0", "trimesh>=4.0.0", "pygltflib>=1.16.0", "pillow>=10.0.0", "numpy>=1.24.0"]
# ///
"""Mode A (2D-to-3D SDF + 40-Tooth Relief + 1024x1024 Seamless UV Baking) for
Asinello Chiacchierone (`assets/models/swamp/knight-swamp-asinello.glb`, 1.35m)
from `assets/characters/knight-swamp-asinello.jpg`.
"""

from __future__ import annotations

import io
import json
import math
import os
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from rembg import remove
from scipy import ndimage
from skimage import measure
import trimesh

REPO_ROOT = Path(__file__).resolve().parents[3]
SRC_JPG = REPO_ROOT / "assets/characters/knight-swamp-asinello.jpg"
OUT_GLB = REPO_ROOT / "assets/models/swamp/knight-swamp-asinello.glb"
PREVIEW_PNG = REPO_ROOT / "tools/model-pipeline/swamp/asinello_3d_preview.png"
TARGET_HEIGHT_M = 1.35


def dilate_rgb_outside_mask(rgb: np.ndarray, mask: np.ndarray, iters: int = 36) -> np.ndarray:
    """Inpaint/dilate foreground RGB colors outward into the background so UV edges never bleed dark slate."""
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


def extract_asinello_grid(img_path: Path, grid_h: int = 210, grid_w: int = 160):
    """Segment Asinello Chiacchierone with rembg and build clean front & wrap-around back RGB maps."""
    pil_img = Image.open(img_path).convert("RGB")
    rgba = np.asarray(remove(pil_img), dtype=np.float32) / 255.0
    raw_mask = rgba[:, :, 3] > 0.50

    fy, fx = np.where(raw_mask)
    y_top, y_bot = int(fy.min()), int(fy.max())
    height_px = y_bot - y_top + 1

    # Pedestal horizontal center from bottom 12% of statue
    ped_y0 = int(y_bot - 0.12 * height_px)
    _, ped_x = np.where(raw_mask[ped_y0 : y_bot + 1, :])
    cx_px = float(np.median(ped_x))

    span_xz_m = 0.92
    px_per_m = height_px / TARGET_HEIGHT_M
    half_span_px = 0.5 * span_xz_m * px_per_m

    y_lin = np.linspace(y_bot, y_top, grid_h, dtype=np.float32)
    x_lin = np.linspace(cx_px - half_span_px, cx_px + half_span_px, grid_w, dtype=np.float32)
    yy, xx = np.meshgrid(y_lin, x_lin, indexing="ij")
    coords = np.array([yy, xx])

    rgb = np.zeros((grid_h, grid_w, 3), dtype=np.float32)
    for c in range(3):
        rgb[:, :, c] = ndimage.map_coordinates(rgba[:, :, c], coords, order=1, mode="nearest")
    alpha = ndimage.map_coordinates(rgba[:, :, 3], coords, order=1, mode="constant", cval=0.0)
    mask = ndimage.binary_fill_holes(alpha > 0.50)

    interior = ndimage.binary_erosion(mask, iterations=2)
    luma = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    clean_valid = interior & (luma > 0.16)
    if not np.any(clean_valid):
        clean_valid = mask
    f_rgb = dilate_rgb_outside_mask(rgb, clean_valid, iters=40)

    # Synthesize a natural furry asinello grey-brown + dark mane + collar-strap Back panel
    # so the 180-degree rear view has cohesive fur instead of horizontal row bands!
    b_rgb = f_rgb.copy()
    ys_m = np.linspace(0.0, TARGET_HEIGHT_M, grid_h, dtype=np.float32)
    xs_norm = np.linspace(-1.0, 1.0, grid_w, dtype=np.float32)
    base_fur = np.array([0.46, 0.37, 0.31], dtype=np.float32)
    dark_mane = np.array([0.21, 0.16, 0.13], dtype=np.float32)
    collar_red = np.array([0.52, 0.15, 0.16], dtype=np.float32)
    collar_gold = np.array([0.74, 0.58, 0.25], dtype=np.float32)

    for iy in range(grid_h):
        y_m = float(ys_m[iy])
        if y_m <= 0.19:
            continue
        # Subtle vertical & horizontal fur shading
        fur_shade = 0.92 + 0.08 * np.cos(xs_norm * 2.2) + 0.03 * np.sin(xs_norm * 19.0 + iy * 0.25)
        row_col = base_fur[None, :] * fur_shade[:, None]

        # Dark asinello dorsal mane stripe along the center of the head/neck/back (y in 0.58..1.20)
        if 0.58 <= y_m <= 1.22:
            mane_w = np.exp(-((xs_norm / 0.18) ** 2))[:, None]
            row_col = (1.0 - 0.78 * mane_w) * row_col + (0.78 * mane_w) * dark_mane[None, :]

        # Continuation of the red & gold caparison collar strap around the neck/shoulders (y in 0.50..0.58)
        if 0.50 <= y_m <= 0.58:
            if abs(y_m - 0.54) > 0.028:
                row_col = 0.35 * row_col + 0.65 * collar_gold[None, :]
            else:
                row_col = 0.25 * row_col + 0.75 * collar_red[None, :]

        b_rgb[iy, :, :] = np.clip(row_col, 0.0, 1.0)

    return f_rgb, b_rgb, mask


def build_asinello_3d_mesh(f_rgb: np.ndarray, mask: np.ndarray) -> trimesh.Trimesh:
    """Sculpt 3D SDF volume from Asinello silhouette + anatomical Z-profile + 40-tooth/medallion relief."""
    H, W = mask.shape
    span_xz = 0.92
    xs = np.linspace(-span_xz * 0.5, span_xz * 0.5, W, dtype=np.float32)
    ys = np.linspace(0.0, TARGET_HEIGHT_M, H, dtype=np.float32)
    zs = np.linspace(-span_xz * 0.5, span_xz * 0.5, W, dtype=np.float32)

    # 2D inward distance transform (in meters)
    px_m = span_xz / W
    dist_in_m = ndimage.distance_transform_edt(mask).astype(np.float32) * px_m
    dist_out_m = ndimage.distance_transform_edt(~mask).astype(np.float32) * px_m
    front_signed = np.where(mask, dist_in_m, -dist_out_m)

    # High-frequency surface relief: 40 white teeth, expressive eyes, golden onion medallion & collar trim
    luma = 0.299 * f_rgb[:, :, 0] + 0.587 * f_rgb[:, :, 1] + 0.114 * f_rgb[:, :, 2]
    hi_relief = luma - ndimage.gaussian_filter(luma, sigma=4.0)
    # Teeth & golden trim relief boost
    teeth_boost = np.clip((luma - 0.62) * 2.5, 0.0, 1.0) * mask

    vol = np.full((W, H, W), -1.0, dtype=np.float32)

    for iy in range(H):
        y_m = float(ys[iy])
        row_m = mask[iy, :]
        if not np.any(row_m):
            continue
        x_idx = np.where(row_m)[0]
        xmin_m, xmax_m = float(xs[x_idx[0]]), float(xs[x_idx[-1]])
        half_w = max(0.5 * (xmax_m - xmin_m), 0.01)
        mid_x = 0.5 * (xmin_m + xmax_m)

        # 1. Turned circular mossy flagstone pedestal (y <= 0.175m)
        ped_blend = float(np.clip((0.185 - y_m) / 0.030, 0.0, 1.0))
        if ped_blend > 0.0:
            xx, zz = np.meshgrid(xs - mid_x, zs, indexing="ij")
            r_grid = np.sqrt(xx**2 + zz**2)
            ped_field = half_w - r_grid
        else:
            ped_field = None

        # 2. Organic 3D Asinello Body, Rearing Legs, 40-Tooth Head & Upright Ears
        if ped_blend < 1.0:
            d_row = dist_in_m[iy, :]  # (W,)
            d_max = max(float(d_row.max()), 0.012)

            # Anatomical Z-thickness cap and forward/backward centerline curve z_center(y):
            # - Hooves/legs (0.18..0.34m): slender legs (max half-depth 0.095m)
            # - Plump belly/chest (0.34..0.64m): rounded barrel (max half-depth 0.185m, z_center = -0.02m)
            # - Big charismatic head & 40-tooth snout (0.64..1.06m): projects forward (max half-depth 0.175m, z_center = +0.045m)
            # - Tall upright burro ears (1.06..1.35m): slender sculpted blades (max half-depth 0.055m, z_center = +0.01m)
            if y_m < 0.34:
                max_hz = 0.095
                z_center = -0.015
            elif y_m < 0.64:
                t_b = (y_m - 0.34) / 0.30
                max_hz = 0.095 + 0.090 * math.sin(t_b * math.pi * 0.85)
                z_center = -0.025 + 0.050 * t_b
            elif y_m < 1.06:
                t_h = (y_m - 0.64) / 0.42
                max_hz = 0.175 - 0.035 * (t_h**2)
                z_center = 0.030 + 0.035 * math.sin(t_h * math.pi)
            else:
                t_e = min((y_m - 1.06) / 0.29, 1.0)
                max_hz = 0.065 * (1.0 - 0.45 * t_e)
                z_center = 0.015 * (1.0 - t_e)

            # Smooth elliptical thickness envelope from 2D distance transform
            env = np.clip(d_row / (d_max * 0.72), 0.0, 1.0) ** 0.56
            hz_x = np.minimum(d_row * 1.15, max_hz * env)  # (W_x,)

            # Add 3D embossed relief on the front (+Z) side for the 40 teeth, snout, eyes & medallion
            rel_x = (0.012 * teeth_boost[iy, :] + 0.008 * hi_relief[iy, :]) * row_m

            xx, zz = np.meshgrid(xs, zs, indexing="ij")  # (W_x, W_z)
            z_front = z_center + hz_x[:, None] + rel_x[:, None]
            z_back = z_center - hz_x[:, None] * 0.88

            # Signed distance in Z: positive inside [z_back .. z_front]
            z_sdf = np.minimum(zz - z_back, z_front - zz)
            x_sdf = front_signed[iy, :][:, None]
            body_field = np.minimum(x_sdf, z_sdf)
        else:
            body_field = ped_field

        if ped_blend <= 0.0:
            vol[:, iy, :] = body_field
        elif ped_blend >= 1.0:
            vol[:, iy, :] = ped_field
        else:
            vol[:, iy, :] = ped_blend * ped_field + (1.0 - ped_blend) * body_field

    vol[:, 0, :] = -1.0
    vol = ndimage.gaussian_filter(vol, sigma=(0.85, 0.85, 0.85))

    # Resample SDF to (54, 74, 54) so Marching Cubes yields ~19,000-23,000 triangles (<= 25,000 test limit)
    target_w, target_h = 54, 74
    vol_mc = ndimage.zoom(vol, zoom=(target_w / W, target_h / H, target_w / W), order=1)
    vol_mc[:, 0, :] = -1.0

    verts, faces, _, _ = measure.marching_cubes(vol_mc, level=0.0)
    v_m = np.zeros_like(verts, dtype=np.float64)
    v_m[:, 0] = (verts[:, 0] / (target_w - 1)) * span_xz - span_xz * 0.5
    v_m[:, 1] = (verts[:, 1] / (target_h - 1)) * TARGET_HEIGHT_M
    v_m[:, 2] = (verts[:, 2] / (target_w - 1)) * span_xz - span_xz * 0.5

    mesh = trimesh.Trimesh(vertices=v_m, faces=faces[:, ::-1], process=True)
    comps = mesh.split(only_watertight=False)
    if len(comps) > 1:
        mesh = max(comps, key=lambda m: len(m.faces))

    trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=8)

    # Strict grounding at min.y = 0.0 and canonical height = 1.35m
    min_y = float(mesh.vertices[:, 1].min())
    mesh.vertices[:, 1] -= min_y
    max_y = float(mesh.vertices[:, 1].max())
    if max_y > 1e-5:
        mesh.vertices[:, 1] *= TARGET_HEIGHT_M / max_y

    low_mask = mesh.vertices[:, 1] < 0.018
    mesh.vertices[low_mask, 1] = 0.0

    # Normalize XZ base span to ~0.76m
    span_x = float(mesh.vertices[:, 0].max() - mesh.vertices[:, 0].min())
    span_z = float(mesh.vertices[:, 2].max() - mesh.vertices[:, 2].min())
    cur_xz = max(span_x, span_z)
    if cur_xz > 1e-5:
        scale_xz = 0.76 / cur_xz
        mesh.vertices[:, 0] *= scale_xz
        mesh.vertices[:, 2] *= scale_xz

    mesh.vertices[:, 0] -= 0.5 * float(mesh.vertices[:, 0].max() + mesh.vertices[:, 0].min())
    mesh.vertices[:, 2] -= 0.5 * float(mesh.vertices[:, 2].max() + mesh.vertices[:, 2].min())
    mesh.fix_normals()
    return mesh


def bake_asinello_uv_and_export_glb(
    mesh: trimesh.Trimesh,
    f_rgb: np.ndarray,
    b_rgb: np.ndarray,
    out_glb_path: Path,
) -> dict:
    """Bake 1024x1024 Front + Fur-Back UV atlas and export glTF 2.0 .glb with faction_primary & faction_trim."""
    H_grid, W_grid, _ = f_rgb.shape
    span_xz = 0.78

    tex_h, tex_w = 1024, 1024
    half_tw = tex_w // 2
    atlas = np.zeros((tex_h, tex_w, 3), dtype=np.float32)

    y_tex = np.linspace(H_grid - 1, 0, tex_h, dtype=np.float32)
    x_tex = np.linspace(0, W_grid - 1, half_tw, dtype=np.float32)
    yy_t, xx_t = np.meshgrid(y_tex, x_tex, indexing="ij")
    for c in range(3):
        # Left panel (u in 0..0.5): Front 40-tooth portrait
        atlas[:, :half_tw, c] = ndimage.map_coordinates(f_rgb[:, :, c], [yy_t, xx_t], order=1, mode="nearest")
        # Right panel (u in 0.5..1.0): Seamless chestnut fur & collar back
        atlas[:, half_tw:, c] = ndimage.map_coordinates(b_rgb[:, :, c], [yy_t, xx_t], order=1, mode="nearest")

    atlas_u8 = np.clip(atlas * 255.0, 0.0, 255.0).astype(np.uint8)
    png_buf = io.BytesIO()
    Image.fromarray(atlas_u8, mode="RGB").save(png_buf, format="PNG", optimize=True)
    png_bytes = png_buf.getvalue()

    faces = mesh.faces
    v_pos = mesh.vertices[faces].reshape(-1, 3).astype(np.float32)
    v_norm = mesh.vertex_normals[faces].reshape(-1, 3).astype(np.float32)

    f_norms = mesh.face_normals
    # Front-facing and side-facing triangles (nz >= -0.15) use the Front Panel (showing 40 teeth, eyes, onion buckler);
    # rear-facing triangles (nz < -0.15) use the Chestnut Fur Back Panel!
    use_front = f_norms[:, 2] >= -0.15
    tri_front = np.repeat(use_front, 3)

    u_front = np.clip(((v_pos[:, 0] / span_xz) + 0.5), 0.02, 0.98) * 0.48 + 0.01
    u_back = np.clip(((v_pos[:, 0] / span_xz) + 0.5), 0.02, 0.98) * 0.48 + 0.51
    u_coord = np.where(tri_front, u_front, u_back).astype(np.float32)
    v_coord = np.clip(1.0 - (v_pos[:, 1] / TARGET_HEIGHT_M), 0.01, 0.99).astype(np.float32)
    uvs = np.column_stack([u_coord, v_coord]).astype(np.float32)

    # Split triangles into faction_primary (body/head/pedestal) and faction_trim (bottom gold pedestal ring y < 0.06m)
    tri_y = v_pos.reshape(-1, 3, 3)[:, :, 1].mean(axis=1)
    trim_mask = tri_y < 0.055
    prim_mask = ~trim_mask

    prim_indices = np.where(np.repeat(prim_mask, 3))[0].astype(np.uint32)
    trim_indices = np.where(np.repeat(trim_mask, 3))[0].astype(np.uint32)

    bin_chunks = bytearray()
    buffer_views = []
    accessors = []

    def append_bin(raw: bytes, target: int | None = None) -> int:
        while len(bin_chunks) % 4 != 0:
            bin_chunks.append(0)
        off = len(bin_chunks)
        bin_chunks.extend(raw)
        while len(bin_chunks) % 4 != 0:
            bin_chunks.append(0)
        bv = {"buffer": 0, "byteOffset": off, "byteLength": len(raw)}
        if target is not None:
            bv["target"] = target
        idx = len(buffer_views)
        buffer_views.append(bv)
        return idx

    bv_pos = append_bin(v_pos.tobytes(), 34962)
    accessors.append(
        {
            "bufferView": bv_pos,
            "byteOffset": 0,
            "componentType": 5126,
            "count": int(len(v_pos)),
            "type": "VEC3",
            "min": [float(x) for x in v_pos.min(axis=0)],
            "max": [float(x) for x in v_pos.max(axis=0)],
        }
    )
    bv_norm = append_bin(v_norm.tobytes(), 34962)
    accessors.append(
        {
            "bufferView": bv_norm,
            "byteOffset": 0,
            "componentType": 5126,
            "count": int(len(v_norm)),
            "type": "VEC3",
        }
    )
    bv_uv = append_bin(uvs.tobytes(), 34962)
    accessors.append(
        {
            "bufferView": bv_uv,
            "byteOffset": 0,
            "componentType": 5126,
            "count": int(len(uvs)),
            "type": "VEC2",
        }
    )
    bv_idx_prim = append_bin(prim_indices.tobytes(), 34963)
    accessors.append(
        {
            "bufferView": bv_idx_prim,
            "byteOffset": 0,
            "componentType": 5125,
            "count": int(len(prim_indices)),
            "type": "SCALAR",
        }
    )
    bv_idx_trim = append_bin(trim_indices.tobytes(), 34963)
    accessors.append(
        {
            "bufferView": bv_idx_trim,
            "byteOffset": 0,
            "componentType": 5125,
            "count": int(len(trim_indices)),
            "type": "SCALAR",
        }
    )
    bv_img = append_bin(png_bytes, None)

    gltf_dict = {
        "asset": {"version": "2.0", "generator": "carchess3d-mode-a-sdf-uv"},
        "scene": 0,
        "scenes": [{"name": "knight-swamp-asinello", "nodes": [0]}],
        "nodes": [{"name": "knight-swamp-asinello", "mesh": 0}],
        "meshes": [
            {
                "name": "knight-swamp-asinello",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                        "indices": 3,
                        "material": 0,
                        "mode": 4,
                    },
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                        "indices": 4,
                        "material": 1,
                        "mode": 4,
                    },
                ],
            }
        ],
        "materials": [
            {
                "name": "faction_primary",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
                    "baseColorTexture": {"index": 0},
                    "metallicFactor": 0.05,
                    "roughnessFactor": 0.55,
                },
                "doubleSided": False,
            },
            {
                "name": "faction_trim",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.831, 0.686, 0.216, 1.0],
                    "metallicFactor": 0.80,
                    "roughnessFactor": 0.28,
                },
                "doubleSided": False,
            },
        ],
        "textures": [{"sampler": 0, "source": 0}],
        "images": [{"bufferView": bv_img, "mimeType": "image/png", "name": "asinello_40teeth_atlas"}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
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

    out_glb_path.parent.mkdir(parents=True, exist_ok=True)
    part_path = out_glb_path.with_suffix(".glb.part")
    with open(part_path, "wb") as f:
        f.write(header)
        f.write(json_header)
        f.write(json_bytes)
        f.write(bin_header)
        f.write(bin_chunks)
    os.replace(part_path, out_glb_path)

    return {
        "file": out_glb_path.name,
        "size_kb": out_glb_path.stat().st_size // 1024,
        "faces": int(len(mesh.faces)),
        "vertices": int(len(mesh.vertices)),
        "atlas_rgb": atlas,
        "v_pos": v_pos,
        "v_norm": v_norm,
        "uvs": uvs,
    }


def render_preview_and_gif(info: dict, out_png: Path, out_gif: Path) -> None:
    """Render both a 4-angle per-pixel UV+Gouraud preview PNG and a 24-frame 360-degree rotating GIF."""
    angles = [("Front (0°)", 0.0), ("3/4 Left (-32°)", -32.0), ("3/4 Right (+32°)", 32.0), ("Back (180°)", 180.0)]
    cell_w, cell_h = 400, 480
    ss = 2
    W, H = cell_w * ss, cell_h * ss

    atlas = info["atlas_rgb"]
    th, tw, _ = atlas.shape
    v_pos = info["v_pos"].reshape(-1, 3, 3)
    v_norm = info["v_norm"].reshape(-1, 3, 3)
    uvs = info["uvs"].reshape(-1, 3, 2)

    sheet = Image.new("RGB", (cell_w * 4 + 50, cell_h + 60), (24, 26, 32))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text(
        (20, 16),
        f"ASINELLO CHIACCHIERONE 40 DENTI (knight-swamp-asinello.glb) - Mode A 3D UV Reconstruction ({info['faces']} tris, {info['size_kb']} KB)",
        fill=(245, 224, 150),
        font=font,
    )

    key_dir = np.array([0.38, 0.56, 0.73], dtype=np.float32)
    key_dir /= np.linalg.norm(key_dir)

    for idx, (label, yaw_deg) in enumerate(angles):
        yaw = math.radians(yaw_deg)
        pitch = math.radians(8.0)
        ry = np.array(
            [[math.cos(yaw), 0.0, math.sin(yaw)], [0.0, 1.0, 0.0], [-math.sin(yaw), 0.0, math.cos(yaw)]],
            dtype=np.float32,
        )
        rx = np.array(
            [[1.0, 0.0, 0.0], [0.0, math.cos(pitch), -math.sin(pitch)], [0.0, math.sin(pitch), math.cos(pitch)]],
            dtype=np.float32,
        )
        rot = rx @ ry

        vp = v_pos @ rot.T
        vn = v_norm @ rot.T
        v0, v1, v2 = vp[:, 0, :], vp[:, 1, :], vp[:, 2, :]
        fn = np.cross(v1 - v0, v2 - v0)
        vis = fn[:, 2] > 0.0
        v0, v1, v2, vn, uv_vis = v0[vis], v1[vis], v2[vis], vn[vis], uvs[vis]

        ndotl = np.clip(vn @ key_dir, 0.0, 1.0)
        v_shade = 0.58 + 0.46 * ndotl

        color_buf = np.full((H, W, 3), 42, dtype=np.uint8)
        z_buf = np.full((H, W), -1e9, dtype=np.float32)

        scale = (H * 0.78) / TARGET_HEIGHT_M
        cx, cy = W * 0.5, H * 0.89

        sx0, sy0, sz0 = cx + v0[:, 0] * scale, cy - v0[:, 1] * scale, v0[:, 2]
        sx1, sy1, sz1 = cx + v1[:, 0] * scale, cy - v1[:, 1] * scale, v1[:, 2]
        sx2, sy2, sz2 = cx + v2[:, 0] * scale, cy - v2[:, 1] * scale, v2[:, 2]

        xmin = np.maximum(0, np.floor(np.minimum(np.minimum(sx0, sx1), sx2)).astype(np.int32))
        xmax = np.minimum(W - 1, np.ceil(np.maximum(np.maximum(sx0, sx1), sx2)).astype(np.int32))
        ymin = np.maximum(0, np.floor(np.minimum(np.minimum(sy0, sy1), sy2)).astype(np.int32))
        ymax = np.minimum(H - 1, np.ceil(np.maximum(np.maximum(sy0, sy1), sy2)).astype(np.int32))
        denom = (sy1 - sy2) * (sx0 - sx2) + (sx2 - sx1) * (sy0 - sy2)

        for i in range(len(sx0)):
            d = denom[i]
            if abs(d) < 1e-5:
                continue
            x0i, x1i, y0i, y1i = xmin[i], xmax[i], ymin[i], ymax[i]
            px = np.arange(x0i, x1i + 1, dtype=np.float32)[None, :]
            py = np.arange(y0i, y1i + 1, dtype=np.float32)[:, None]
            w0 = ((sy1[i] - sy2[i]) * (px - sx2[i]) + (sx2[i] - sx1[i]) * (py - sy2[i])) / d
            w1 = ((sy2[i] - sy0[i]) * (px - sx2[i]) + (sx0[i] - sx2[i]) * (py - sy2[i])) / d
            w2 = 1.0 - w0 - w1
            m = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
            if not np.any(m):
                continue
            z_int = w0 * sz0[i] + w1 * sz1[i] + w2 * sz2[i]
            sub_z = z_buf[y0i : y1i + 1, x0i : x1i + 1]
            closer = m & (z_int > sub_z)
            if np.any(closer):
                sub_z[closer] = z_int[closer]
                wc0, wc1, wc2 = w0[closer], w1[closer], w2[closer]
                u_p = wc0 * uv_vis[i, 0, 0] + wc1 * uv_vis[i, 1, 0] + wc2 * uv_vis[i, 2, 0]
                v_p = wc0 * uv_vis[i, 0, 1] + wc1 * uv_vis[i, 1, 1] + wc2 * uv_vis[i, 2, 1]
                sh_p = (wc0 * v_shade[i, 0] + wc1 * v_shade[i, 1] + wc2 * v_shade[i, 2])[:, None]
                tx_p = np.clip((u_p * (tw - 1)).astype(np.int32), 0, tw - 1)
                ty_p = np.clip((v_p * (th - 1)).astype(np.int32), 0, th - 1)
                rgb_p = np.clip(atlas[ty_p, tx_p, :] * sh_p * 255.0, 0.0, 255.0).astype(np.uint8)
                color_buf[y0i : y1i + 1, x0i : x1i + 1][closer] = rgb_p

        cell_img = Image.fromarray(color_buf, mode="RGB").resize((cell_w, cell_h), Image.Resampling.LANCZOS)
        x_off = 10 + idx * (cell_w + 10)
        sheet.paste(cell_img, (x_off, 46))
        draw.text((x_off + 12, 56), label, fill=(255, 224, 130), font=font)

    sheet.save(out_png, format="PNG")

    # Also render a 24-frame rotating GIF
    v_col = np.zeros_like(v_pos)
    for k in range(3):
        tx = np.clip((uvs[:, k, 0] * (tw - 1)).astype(np.int32), 0, tw - 1)
        ty = np.clip((uvs[:, k, 1] * (th - 1)).astype(np.int32), 0, th - 1)
        v_col[:, k, :] = atlas[ty, tx, :]
    tri_alb = v_col.mean(axis=1)
    tri_norm = v_norm.mean(axis=1)
    tri_norm /= np.maximum(np.linalg.norm(tri_norm, axis=1, keepdims=True), 1e-6)

    gw, gh = 360, 420
    g_scale = (gh * 0.78) / TARGET_HEIGHT_M
    gcx, gcy = gw * 0.5, gh * 0.89
    frames = []
    for f_idx in range(24):
        yaw = math.radians(f_idx * 15.0)
        pitch = math.radians(8.0)
        ry = np.array([[math.cos(yaw), 0.0, math.sin(yaw)], [0.0, 1.0, 0.0], [-math.sin(yaw), 0.0, math.cos(yaw)]], dtype=np.float32)
        rx = np.array([[1.0, 0.0, 0.0], [0.0, math.cos(pitch), -math.sin(pitch)], [0.0, math.sin(pitch), math.cos(pitch)]], dtype=np.float32)
        rot = rx @ ry
        vp = v_pos @ rot.T
        vn = tri_norm @ rot.T
        v0, v1, v2 = vp[:, 0, :], vp[:, 1, :], vp[:, 2, :]
        fn = np.cross(v1 - v0, v2 - v0)
        vis = fn[:, 2] > 0.0
        v0, v1, v2, vn, alb = v0[vis], v1[vis], v2[vis], vn[vis], tri_alb[vis]
        order = np.argsort((v0[:, 2] + v1[:, 2] + v2[:, 2]) * (1.0 / 3.0))
        v0, v1, v2, vn, alb = v0[order], v1[order], v2[order], vn[order], alb[order]
        shade = (0.58 + 0.46 * np.clip(vn @ key_dir, 0.0, 1.0))[:, None]
        cols = np.clip(alb * shade * 255.0, 0.0, 255.0).astype(np.uint8)
        im = Image.new("RGB", (gw, gh), (30, 33, 42))
        dr = ImageDraw.Draw(im)
        sx0, sy0 = gcx + v0[:, 0] * g_scale, gcy - v0[:, 1] * g_scale
        sx1, sy1 = gcx + v1[:, 0] * g_scale, gcy - v1[:, 1] * g_scale
        sx2, sy2 = gcx + v2[:, 0] * g_scale, gcy - v2[:, 1] * g_scale
        for i in range(len(sx0)):
            c = (int(cols[i, 0]), int(cols[i, 1]), int(cols[i, 2]))
            dr.polygon([(float(sx0[i]), float(sy0[i])), (float(sx1[i]), float(sy1[i])), (float(sx2[i]), float(sy2[i]))], fill=c)
        dr.text((12, 12), f"Asinello 3D 40 Denti ({f_idx * 15} deg)", fill=(245, 224, 150))
        frames.append(im)
    frames[0].save(out_gif, save_all=True, append_images=frames[1:], duration=90, loop=0)


def main() -> None:
    print("🫏 Extracting Asinello 40-tooth neural mask & fur wrap...", flush=True)
    f_rgb, b_rgb, mask = extract_asinello_grid(SRC_JPG)
    print("🗿 Sculpting 3D SDF Asinello + 40-Tooth Relief...", flush=True)
    mesh = build_asinello_3d_mesh(f_rgb, mask)
    print("🎨 Baking 1024x1024 UV Atlas & exporting knight-swamp-asinello.glb...", flush=True)
    info = bake_asinello_uv_and_export_glb(mesh, f_rgb, b_rgb, OUT_GLB)
    out_gif = PREVIEW_PNG.with_name("asinello_3d_turntable.gif")
    render_preview_and_gif(info, PREVIEW_PNG, out_gif)
    print(f"✅ Saved {OUT_GLB.relative_to(REPO_ROOT)}: {info['size_kb']} KB, {info['faces']} tris", flush=True)


if __name__ == "__main__":
    main()
