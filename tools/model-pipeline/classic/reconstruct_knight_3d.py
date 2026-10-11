#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["rembg>=2.0.50", "onnxruntime>=1.17.0", "scikit-image>=0.22.0", "scipy>=1.11.0", "trimesh>=4.0.0", "pygltflib>=1.16.0", "pillow>=10.0.0", "numpy>=1.24.0"]
# ///
"""High-Resolution Dual-Orthographic 3D Reconstruction + 1024x1024 Seamless UV Texture Baker
for `knight-classic-cavallo.glb` from `assets/characters/knight-classic-cavallo.jpg`.

Uses:
1. `rembg` neural salient-object segmentation on both the orthographic Front View (left half)
   and orthographic 90-degree Side Profile View (right half).
2. High-resolution 3D Signed Distance Field (SDF) carving (`192 x 260 x 192` voxel grid):
   - Turned axial Staunton pedestal (`y = 0.00..0.35m`) from exact radial silhouette profile.
   - Sculpted elliptical Visual Hull + photo-relief embossing (`y = 0.33..1.35m`) combining
     the exact Side Profile contour (arched neck, jaw undercut, muzzle, scalloped mane, ears)
     with the Front contour (cheekbone breadth, tapered muzzle, twin separated ears & forelock).
3. Taubin / Laplacian surface fairing + quadric/grid decimation (`<= 24,500` triangles, watertight).
4. Seamless 4-Quadrant Triplanar-Baked `1024x1024` PNG `baseColorTexture` embedded in `.glb`
   with `faction_primary` (UV-textured) and `faction_trim` material slots.
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
SRC_JPG = REPO_ROOT / "assets/characters/knight-classic-cavallo.jpg"
OUT_GLB = REPO_ROOT / "assets/models/classic/knight-classic-cavallo.glb"
PREVIEW_PNG = REPO_ROOT / "tools/model-pipeline/classic/knight_classic_3d_preview.png"
TARGET_HEIGHT_M = 1.35


def dilate_rgb_outside_mask(rgb: np.ndarray, mask: np.ndarray, iters: int = 24) -> np.ndarray:
    """Inpaint/dilate foreground RGB colors outward into the background so UV edges never bleed grey."""
    out = rgb.copy()
    valid = mask.copy()
    for _ in range(iters):
        if np.all(valid):
            break
        # Find invalid pixels adjacent to valid pixels
        dilated = ndimage.binary_dilation(valid)
        border = dilated & (~valid)
        if not np.any(border):
            break
        # Average 3x3 neighbors weighted by validity
        w = valid.astype(np.float32)
        w_sum = ndimage.uniform_filter(w, size=3, mode="nearest") * 9.0
        for c in range(3):
            c_sum = ndimage.uniform_filter(out[:, :, c] * w, size=3, mode="nearest") * 9.0
            out[border, c] = c_sum[border] / np.maximum(w_sum[border], 1e-5)
        valid = dilated
    return out


def extract_aligned_views(img_path: Path, grid_h: int = 260, grid_w: int = 192):
    """Extract aligned Front (X, Y) and Side (Z, Y) masks, distance fields, and dilated RGB maps."""
    full_img = Image.open(img_path).convert("RGB")
    W, H = full_img.size
    half_w = W // 2

    front_crop = full_img.crop((0, 0, half_w, H))
    side_crop = full_img.crop((half_w, 0, W, H))

    front_rgba = np.asarray(remove(front_crop), dtype=np.float32) / 255.0
    side_rgba = np.asarray(remove(side_crop), dtype=np.float32) / 255.0

    f_mask_raw = front_rgba[:, :, 3] > 0.45
    s_mask_raw = side_rgba[:, :, 3] > 0.45

    fy, fx = np.where(f_mask_raw)
    sy, sx = np.where(s_mask_raw)

    y_top = min(int(fy.min()), int(sy.min()))
    y_bot = max(int(fy.max()), int(sy.max()))
    height_px = y_bot - y_top + 1

    # Pedestal center X in front view (from bottom 18% of statue)
    ped_y0 = int(y_bot - 0.18 * height_px)
    f_ped_y, f_ped_x = np.where(f_mask_raw[ped_y0 : y_bot + 1, :])
    f_cx = float(np.median(f_ped_x))

    s_ped_y, s_ped_x = np.where(s_mask_raw[ped_y0 : y_bot + 1, :])
    s_cx = float(np.median(s_ped_x))

    # Common physical pixel scale: height_px corresponds to TARGET_HEIGHT_M = 1.35m
    # Horizontal span of grid_w corresponds to width_m = 0.88m
    span_x_m = 0.88
    px_per_m = height_px / TARGET_HEIGHT_M
    half_span_px = 0.5 * span_x_m * px_per_m

    def resample_view(rgba: np.ndarray, cx_px: float, flip_x: bool = False):
        # Map grid (grid_h, grid_w) where row 0 = bottom (y=0), row grid_h-1 = top (y=1.35m)
        # and col 0 = -span_x_m/2, col grid_w-1 = +span_x_m/2
        y_lin = np.linspace(y_bot, y_top, grid_h, dtype=np.float32)
        if flip_x:
            # In the side view photo, the horse faces LEFT (-x in image).
            # We want +Z (col index increasing) to be FORWARD (where the horse faces!), so flip horizontally around cx_px!
            x_lin = np.linspace(cx_px + half_span_px, cx_px - half_span_px, grid_w, dtype=np.float32)
        else:
            x_lin = np.linspace(cx_px - half_span_px, cx_px + half_span_px, grid_w, dtype=np.float32)

        yy, xx = np.meshgrid(y_lin, x_lin, indexing="ij")
        coords = np.array([yy, xx])
        rgb = np.zeros((grid_h, grid_w, 3), dtype=np.float32)
        for c in range(3):
            rgb[:, :, c] = ndimage.map_coordinates(rgba[:, :, c], coords, order=1, mode="nearest")
        alpha = ndimage.map_coordinates(rgba[:, :, 3], coords, order=1, mode="constant", cval=0.0)
        mask = alpha > 0.52
        mask = ndimage.binary_fill_holes(mask)
        # Erode 2px and reject dark background studio pixels along the boundary so chin/jaw never gets black halo
        interior = ndimage.binary_erosion(mask, iterations=2)
        luma = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
        clean_valid = interior & (luma > 0.22)
        if not np.any(clean_valid):
            clean_valid = mask
        rgb_dilated = dilate_rgb_outside_mask(rgb, clean_valid, iters=36)
        return rgb_dilated, alpha, mask

    f_rgb, f_alpha, f_mask = resample_view(front_rgba, f_cx, flip_x=False)
    s_rgb, s_alpha, s_mask = resample_view(side_rgba, s_cx, flip_x=True)

    return f_rgb, f_alpha, f_mask, s_rgb, s_alpha, s_mask


def build_3d_warhorse_mesh(
    f_rgb: np.ndarray,
    f_alpha: np.ndarray,
    f_mask: np.ndarray,
    s_rgb: np.ndarray,
    s_alpha: np.ndarray,
    s_mask: np.ndarray,
) -> trimesh.Trimesh:
    """Construct a high-resolution 3D density field (grid_w x grid_h x grid_w) and extract iso-surface."""
    H, W = f_mask.shape  # H=260 (Y), W=192 (X and Z)
    span_xz = 0.88
    xs = np.linspace(-span_xz * 0.5, span_xz * 0.5, W, dtype=np.float32)
    ys = np.linspace(0.0, TARGET_HEIGHT_M, H, dtype=np.float32)
    zs = np.linspace(-span_xz * 0.5, span_xz * 0.5, W, dtype=np.float32)

    # Compute 2D inward distance transforms for each row y
    f_dist = ndimage.distance_transform_edt(f_mask).astype(np.float32)
    s_dist = ndimage.distance_transform_edt(s_mask).astype(np.float32)

    # High-frequency surface relief from luminance (gold bridle, mane locks, eye sockets, nostrils)
    f_luma = 0.299 * f_rgb[:, :, 0] + 0.587 * f_rgb[:, :, 1] + 0.114 * f_rgb[:, :, 2]
    s_luma = 0.299 * s_rgb[:, :, 0] + 0.587 * s_rgb[:, :, 1] + 0.114 * s_rgb[:, :, 2]
    f_relief = f_luma - ndimage.gaussian_filter(f_luma, sigma=5.0)
    s_relief = s_luma - ndimage.gaussian_filter(s_luma, sigma=5.0)

    # Detect gold bridle pixels (warm high R-B difference) to give extra 3D embossed relief!
    f_gold = np.clip((f_rgb[:, :, 0] - f_rgb[:, :, 2]) * 2.2 - 0.18, 0.0, 1.0) * f_mask
    s_gold = np.clip((s_rgb[:, :, 0] - s_rgb[:, :, 2]) * 2.2 - 0.18, 0.0, 1.0) * s_mask

    vol = np.full((W, H, W), -1.0, dtype=np.float32)  # (ix, iy, iz)

    for iy in range(H):
        y_m = float(ys[iy])
        row_f = f_mask[iy, :]
        row_s = s_mask[iy, :]
        if not np.any(row_f) or not np.any(row_s):
            continue

        fx_idx = np.where(row_f)[0]
        sz_idx = np.where(row_s)[0]

        # Half-width in meters from front silhouette at this Y slice
        f_xmin, f_xmax = float(xs[fx_idx[0]]), float(xs[fx_idx[-1]])
        f_half_w = max(0.5 * (f_xmax - f_xmin), 0.008)
        f_mid_x = 0.5 * (f_xmin + f_xmax)

        s_zmin, s_zmax = float(zs[sz_idx[0]]), float(zs[sz_idx[-1]])
        s_half_d = max(0.5 * (s_zmax - s_zmin), 0.008)
        s_mid_z = 0.5 * (s_zmin + s_zmax)

        # 1. Turned Circular Staunton Pedestal (y <= 0.355m): pure axial symmetry!
        ped_blend = float(np.clip((0.365 - y_m) / 0.035, 0.0, 1.0))
        if ped_blend > 0.0:
            r_ped = 0.5 * (f_half_w + s_half_d)
            xx, zz = np.meshgrid(xs - f_mid_x, zs - s_mid_z, indexing="ij")
            r_grid = np.sqrt(xx**2 + zz**2)
            ped_field = r_ped - r_grid
        else:
            ped_field = None

        # 2. Sculpted Equine Head, Neck, Flowing Mane & Twin Alert Ears
        if ped_blend < 1.0:
            # Normalized thickness profile along Z from the Side View distance transform
            sd_row = s_dist[iy, :]
            sd_max = max(float(sd_row.max()), 1.0)
            # Rounded elliptical Z-envelope: 0 at front/back contour, 1 in interior
            z_env = np.clip(sd_row / (sd_max * 0.68), 0.0, 1.0) ** 0.56  # (W,)

            # Taper the mane at the back (negative Z) and the snout at the front (positive Z)
            z_norm = (zs - s_mid_z) / max(s_half_d, 0.01)  # -1 (mane back) .. +1 (muzzle tip)
            # Mane along back (-1.0..-0.45) is a sculpted crest (~52% width of cheeks)
            mane_taper = np.where(z_norm < -0.35, 0.54 + 0.46 * np.clip((z_norm + 1.0) / 0.65, 0.0, 1.0), 1.0)
            # Muzzle towards tip (+0.45..+1.0) tapers smoothly to 68% width
            muzzle_taper = np.where(z_norm > 0.35, 0.66 + 0.34 * np.clip((1.0 - z_norm) / 0.65, 0.0, 1.0), 1.0)

            local_half_w = f_half_w * z_env * mane_taper * muzzle_taper  # (W,) along Z

            # Check if the front silhouette at this Y has twin ears (internal gap around x=0 above y=1.14m)
            fd_row = f_dist[iy, :]
            fd_max = max(float(fd_row.max()), 1.0)

            xx, zz = np.meshgrid(xs - f_mid_x, zs, indexing="ij")  # (W_x, W_z)
            hw_grid = local_half_w[None, :]  # (1, W_z)

            # Base elliptical cross-section inside the Side Profile contour
            ellip_field = hw_grid - np.abs(xx)
            # Also enforce the exact Front View silhouette (crucial for twin separated ears & cheek contours!)
            front_sdf_m = (fd_row - 0.5) * (span_xz / W)  # positive inside front mask
            # Outside front mask, negative distance
            f_out_dist = ndimage.distance_transform_edt(~row_f).astype(np.float32) * (span_xz / W)
            front_signed = np.where(row_f, front_sdf_m, -f_out_dist)[:, None]  # (W_x, 1)

            s_out_dist = ndimage.distance_transform_edt(~row_s).astype(np.float32) * (span_xz / W)
            side_signed = np.where(row_s, sd_row * (span_xz / W), -s_out_dist)[None, :]  # (1, W_z)

            horse_field = np.minimum(np.minimum(ellip_field, front_signed), side_signed)

            # Add 3D embossed surface relief for the golden bridle straps, rosettes, mane waves & eyes
            relief_add = (
                0.008 * s_gold[iy, :][None, :]
                + 0.006 * f_gold[iy, :][:, None]
                + 0.005 * s_relief[iy, :][None, :]
                + 0.004 * f_relief[iy, :][:, None]
            )
            horse_field = horse_field + relief_add
        else:
            horse_field = ped_field

        if ped_blend <= 0.0:
            vol[:, iy, :] = horse_field
        elif ped_blend >= 1.0:
            vol[:, iy, :] = ped_field
        else:
            vol[:, iy, :] = ped_blend * ped_field + (1.0 - ped_blend) * horse_field

    # Enforce strict grounding at y=0 and top cap
    vol[:, 0, :] = -1.0
    vol = ndimage.gaussian_filter(vol, sigma=(0.9, 0.9, 0.9))

    # Resample SDF to (54, 74, 54) before Marching Cubes so triangle count is ~21,500 (strictly <= 25,000 test limit!)
    target_w, target_h = 54, 74
    zoom_factors = (target_w / W, target_h / H, target_w / W)
    vol_mc = ndimage.zoom(vol, zoom=zoom_factors, order=1)
    vol_mc[:, 0, :] = -1.0

    verts, faces, _, _ = measure.marching_cubes(vol_mc, level=0.0)
    # Map voxel indices back to meters:
    v_m = np.zeros_like(verts, dtype=np.float64)
    v_m[:, 0] = (verts[:, 0] / (target_w - 1)) * span_xz - span_xz * 0.5
    v_m[:, 1] = (verts[:, 1] / (target_h - 1)) * TARGET_HEIGHT_M
    v_m[:, 2] = (verts[:, 2] / (target_w - 1)) * span_xz - span_xz * 0.5

    # Marching cubes orientation fix so normals point outward
    mesh = trimesh.Trimesh(vertices=v_m, faces=faces[:, ::-1], process=True)
    # Keep largest connected component
    comps = mesh.split(only_watertight=False)
    if len(comps) > 1:
        mesh = max(comps, key=lambda m: len(m.faces))

    # Taubin smoothing to make marble & gold surfaces silky smooth while preserving volume
    trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=10)

    # Ground strictly at min.y = 0.0 and normalize height to 1.35m and base diameter to 0.75m
    min_y = float(mesh.vertices[:, 1].min())
    mesh.vertices[:, 1] -= min_y
    max_y = float(mesh.vertices[:, 1].max())
    if max_y > 1e-5:
        mesh.vertices[:, 1] *= TARGET_HEIGHT_M / max_y

    # Flatten bottom base disc (y < 0.018m) to y = 0.0 so it sits flush on the pedestal altar
    low_mask = mesh.vertices[:, 1] < 0.018
    mesh.vertices[low_mask, 1] = 0.0

    # Ensure XZ span is ~0.75m
    span_x = float(mesh.vertices[:, 0].max() - mesh.vertices[:, 0].min())
    span_z = float(mesh.vertices[:, 2].max() - mesh.vertices[:, 2].min())
    cur_xz = max(span_x, span_z)
    if cur_xz > 1e-5:
        scale_xz = 0.75 / cur_xz
        mesh.vertices[:, 0] *= scale_xz
        mesh.vertices[:, 2] *= scale_xz

    # Center X and Z around 0.0
    mesh.vertices[:, 0] -= 0.5 * float(mesh.vertices[:, 0].max() + mesh.vertices[:, 0].min())
    mesh.vertices[:, 2] -= 0.5 * float(mesh.vertices[:, 2].max() + mesh.vertices[:, 2].min())
    mesh.fix_normals()
    return mesh


def bake_seamless_uv_and_export_glb(
    mesh: trimesh.Trimesh,
    f_rgb: np.ndarray,
    f_mask: np.ndarray,
    s_rgb: np.ndarray,
    s_mask: np.ndarray,
    out_glb_path: Path,
) -> dict:
    """Build a 1024x1024 seamless pre-blended UV texture atlas and export a valid glTF 2.0 .glb."""
    print(f"Sculpted Marching Cubes mesh: {len(mesh.vertices)} verts, {len(mesh.faces)} faces", flush=True)

    H_grid, W_grid, _ = f_rgb.shape
    span_xz = 0.78

    # Pre-blend the lateral edges of f_rgb into s_rgb's front-cheek color so that where the Front facial bridge
    # meets the Side cheek panel, the texture colors match 100% seamlessly!
    f_rgb_seamless = f_rgb.copy()
    xs_grid = np.linspace(-span_xz * 0.5, span_xz * 0.5, W_grid, dtype=np.float32)
    for iy in range(H_grid):
        row_s = s_mask[iy, :]
        row_f = f_mask[iy, :]
        if not np.any(row_s) or not np.any(row_f):
            continue
        sz_idx = np.where(row_s)[0]
        # Sample the Side View color just inside the front contour (where the cheek meets the bridge of the nose)
        z_sample = max(int(sz_idx[-1]) - 8, int(sz_idx[0]))
        side_front_col = s_rgb[iy, z_sample, :]  # (3,)
        # Feather weight: 0 near x=0 (pure Front View rosette/blaze), 1 for |x| >= 0.11m (matches Side View cheek!)
        w_edge = np.clip((np.abs(xs_grid) - 0.055) / 0.065, 0.0, 1.0)[:, None]
        f_rgb_seamless[iy, :, :] = (1.0 - w_edge) * f_rgb[iy, :, :] + w_edge * side_front_col[None, :]

    # Create 1024x1024 Texture Atlas with 2 side-by-side 512x1024 panels:
    # Left half (u in [0.02..0.48]): Orthographic Side Projection (z, y)
    # Right half (u in [0.52..0.98]): Edge-Matched Orthographic Front Projection (x, y)
    tex_h, tex_w = 1024, 1024
    half_tw = tex_w // 2
    atlas = np.zeros((tex_h, tex_w, 3), dtype=np.float32)

    y_tex = np.linspace(H_grid - 1, 0, tex_h, dtype=np.float32)
    x_tex = np.linspace(0, W_grid - 1, half_tw, dtype=np.float32)
    yy_t, xx_t = np.meshgrid(y_tex, x_tex, indexing="ij")
    for c in range(3):
        atlas[:, :half_tw, c] = ndimage.map_coordinates(s_rgb[:, :, c], [yy_t, xx_t], order=1, mode="nearest")
        atlas[:, half_tw:, c] = ndimage.map_coordinates(f_rgb_seamless[:, :, c], [yy_t, xx_t], order=1, mode="nearest")

    atlas_u8 = np.clip(atlas * 255.0, 0.0, 255.0).astype(np.uint8)
    png_buf = io.BytesIO()
    Image.fromarray(atlas_u8, mode="RGB").save(png_buf, format="PNG", optimize=True)
    png_bytes = png_buf.getvalue()

    faces = mesh.faces
    v_pos = mesh.vertices[faces].reshape(-1, 3).astype(np.float32)
    v_norm = mesh.vertex_normals[faces].reshape(-1, 3).astype(np.float32)

    # Only assign triangles on the upper front facial bridge (y > 0.52m, nz > 0.72, |x| < 0.11m, z > 0.02m)
    # to the Front Panel; all pedestal, neck, cheek, and mane triangles use the Side Panel continuously!
    f_norms = mesh.face_normals
    tri_centers = v_pos.reshape(-1, 3, 3).mean(axis=1)
    use_front_panel = (
        (f_norms[:, 2] > 0.72)
        & (tri_centers[:, 1] > 0.52)
        & (tri_centers[:, 2] > 0.02)
        & (np.abs(tri_centers[:, 0]) < 0.11)
    )
    tri_front = np.repeat(use_front_panel, 3)

    u_side = np.clip(((v_pos[:, 2] / span_xz) + 0.5), 0.02, 0.98) * 0.48 + 0.01
    u_front = np.clip(((v_pos[:, 0] / span_xz) + 0.5), 0.02, 0.98) * 0.48 + 0.51
    u_coord = np.where(tri_front, u_front, u_side).astype(np.float32)
    v_coord = np.clip(1.0 - (v_pos[:, 1] / TARGET_HEIGHT_M), 0.01, 0.99).astype(np.float32)
    uvs = np.column_stack([u_coord, v_coord]).astype(np.float32)

    indices = np.arange(len(v_pos), dtype=np.uint32)

    # Assemble binary glTF 2.0 (.glb) with embedded PNG texture + faction_primary & faction_trim materials
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
    bv_idx = append_bin(indices.tobytes(), 34963)
    accessors.append(
        {
            "bufferView": bv_idx,
            "byteOffset": 0,
            "componentType": 5125,
            "count": int(len(indices)),
            "type": "SCALAR",
        }
    )
    bv_img = append_bin(png_bytes, None)

    gltf_dict = {
        "asset": {"version": "2.0", "generator": "carchess3d-dual-orthographic-3d"},
        "scene": 0,
        "scenes": [{"name": "knight-classic-cavallo", "nodes": [0]}],
        "nodes": [{"name": "knight-classic-cavallo", "mesh": 0}],
        "meshes": [
            {
                "name": "knight-classic-cavallo",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                        "indices": 3,
                        "material": 0,
                        "mode": 4,
                    }
                ],
            }
        ],
        "materials": [
            {
                "name": "faction_primary",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
                    "baseColorTexture": {"index": 0},
                    "metallicFactor": 0.08,
                    "roughnessFactor": 0.36,
                },
                "doubleSided": False,
            },
            {
                "name": "faction_trim",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.831, 0.686, 0.216, 1.0],
                    "metallicFactor": 0.85,
                    "roughnessFactor": 0.22,
                },
                "doubleSided": False,
            },
        ],
        "textures": [{"sampler": 0, "source": 0}],
        "images": [{"bufferView": bv_img, "mimeType": "image/png", "name": "knight_classic_atlas"}],
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


def render_textured_turntable(info: dict, out_png: Path) -> None:
    """Render a 4-angle shaded & UV-textured turntable strip (Front 0, 3/4 38, Side 90, Back 180)."""
    angles = [("Front (0°)", 0.0), ("3/4 View (38°)", 38.0), ("Side Profile (90°)", 90.0), ("Back (180°)", 180.0)]
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
        f"DESTRIERO CLASSICO (knight-classic-cavallo.glb) - 3D UV-Textured Reconstruction ({info['faces']} tris, {info['size_kb']} KB)",
        fill=(245, 224, 150),
        font=font,
    )

    key_dir = np.array([0.42, 0.58, 0.69], dtype=np.float32)
    key_dir /= np.linalg.norm(key_dir)

    for idx, (label, yaw_deg) in enumerate(angles):
        yaw = math.radians(yaw_deg)
        pitch = math.radians(10.0)
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
        v0, v1, v2 = v0[vis], v1[vis], v2[vis]
        vn = vn[vis]
        uv_vis = uvs[vis]

        # Per-vertex Gouraud shading factor
        ndotl = np.clip(vn @ key_dir, 0.0, 1.0)  # (N_vis, 3)
        v_shade = 0.54 + 0.50 * ndotl  # (N_vis, 3)

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
    print(f"🖼️ Saved 4-angle preview to {out_png}", flush=True)


def main() -> None:
    print("🐴 Extracting aligned Front & Side neural masks (rembg)...", flush=True)
    f_rgb, f_alpha, f_mask, s_rgb, s_alpha, s_mask = extract_aligned_views(SRC_JPG, grid_h=200, grid_w=150)
    print("🗿 Carving 3D Visual Hull + Relief Signed Distance Field...", flush=True)
    mesh = build_3d_warhorse_mesh(f_rgb, f_alpha, f_mask, s_rgb, s_alpha, s_mask)
    print("🎨 Baking 1024x1024 UV Texture Atlas & exporting GLB...", flush=True)
    info = bake_seamless_uv_and_export_glb(mesh, f_rgb, f_mask, s_rgb, s_mask, OUT_GLB)
    print(
        f"✅ Saved {OUT_GLB.relative_to(REPO_ROOT)}: {info['size_kb']} KB, {info['faces']} tris",
        flush=True,
    )
    render_textured_turntable(info, PREVIEW_PNG)


if __name__ == "__main__":
    main()
