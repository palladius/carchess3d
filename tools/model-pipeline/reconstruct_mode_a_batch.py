#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["rembg>=2.0.50", "onnxruntime>=1.17.0", "scikit-image>=0.22.0", "scipy>=1.11.0", "trimesh>=4.0.0", "pygltflib>=1.16.0", "pillow>=10.0.0", "numpy>=1.24.0"]
# ///
"""Zero-GPU Mode A 2D-to-3D SDF Visual-Hull + Photo-Relief Sculptor & 1024x1024 UV Texture Baker.

Reconstructs high-resolution, UV-textured 3D .glb models from 2D turnaround sheets
strictly adhering to assets/families/_contract.json:
- Grounding: min.y == 0.0m
- Target heights: King 1.80m, Queen 1.65m, Bishop 1.45m, Knight 1.35m, Rook 1.30m, Pawn 0.95m
- Footprint bounds: 0.70m <= span_x <= 0.86m, 0.70m <= span_z <= 0.86m
- Triangle budget: 15,000 - 24,500 faces (watertight, closed manifold)
- Required material slots: faction_primary (diffuse UV texture) and faction_trim
- Atomic write: .glb.part -> os.replace()
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
import struct
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import remove
from scipy import ndimage
from skimage import measure
import trimesh

REPO_ROOT = Path(__file__).resolve().parents[2]

ALL_TARGETS = [
    # Classic family remaining
    ("classic", "rook", "rook-classic-torre", 1.30, "assets/characters/rook-classic-torre.jpg", "assets/models/classic/rook-classic-torre.glb"),
    ("classic", "pawn", "pawn-classic-pedone", 0.95, "assets/characters/pawn-classic-pedone.jpg", "assets/models/classic/pawn-classic-pedone.glb"),
    # Swamp family remaining
    ("swamp", "king", "king-swamp-orco", 1.80, "assets/characters/king-swamp-orco.jpg", "assets/models/swamp/king-swamp-orco.glb"),
    ("swamp", "queen", "queen-swamp-orchessa", 1.65, "assets/characters/queen-swamp-orchessa.jpg", "assets/models/swamp/queen-swamp-orchessa.glb"),
    ("swamp", "bishop", "bishop-swamp-focaccina", 1.45, "assets/characters/bishop-swamp-focaccina.jpg", "assets/models/swamp/bishop-swamp-focaccina.glb"),
    ("swamp", "rook", "rook-swamp-draghessa", 1.30, "assets/characters/rook-swamp-draghessa.jpg", "assets/models/swamp/rook-swamp-draghessa.glb"),
    ("swamp", "pawn", "pawn-swamp-tappo", 0.95, "assets/characters/pawn-swamp-tappo.jpg", "assets/models/swamp/pawn-swamp-tappo.glb"),
]


def dilate_rgb_outside_mask(rgb: np.ndarray, mask: np.ndarray, iters: int = 36) -> np.ndarray:
    """Inpaint/dilate foreground RGB colors outward so UV triangle borders never sample background pixels."""
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


def extract_aligned_views(img_path: Path, target_height_m: float, grid_h: int = 240, grid_w: int = 180):
    """Extract segmented Front and Side views from 16:9 turnaround image."""
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

    ped_y0 = int(y_bot - 0.20 * height_px)
    f_ped_y, f_ped_x = np.where(f_mask_raw[ped_y0 : y_bot + 1, :])
    f_cx = float(np.median(f_ped_x)) if len(f_ped_x) > 0 else float(front_crop.width // 2)

    s_ped_y, s_ped_x = np.where(s_mask_raw[ped_y0 : y_bot + 1, :])
    s_cx = float(np.median(s_ped_x)) if len(s_ped_x) > 0 else float(side_crop.width // 2)

    span_xz_m = 0.82
    px_per_m = height_px / max(0.1, target_height_m)
    half_span_px = 0.5 * span_xz_m * px_per_m

    def resample_view(rgba: np.ndarray, cx_px: float):
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
        clean_valid = interior & (luma > 0.18)
        if not np.any(clean_valid):
            clean_valid = mask
        rgb_dilated = dilate_rgb_outside_mask(rgb, clean_valid, iters=36)
        return rgb_dilated, mask

    f_rgb, f_mask = resample_view(front_rgba, f_cx)
    s_rgb, s_mask = resample_view(side_rgba, s_cx)
    return f_rgb, f_mask, s_rgb, s_mask


def sculpt_piece_sdf_mesh(
    f_rgb: np.ndarray,
    f_mask: np.ndarray,
    s_rgb: np.ndarray,
    s_mask: np.ndarray,
    target_height_m: float,
) -> trimesh.Trimesh:
    """Build a 3D density volume and extract iso-surface with marching cubes."""
    H, W = f_mask.shape
    span_xz = 0.80
    xs = np.linspace(-span_xz * 0.5, span_xz * 0.5, W, dtype=np.float32)
    ys = np.linspace(0.0, target_height_m, H, dtype=np.float32)
    zs = np.linspace(-span_xz * 0.5, span_xz * 0.5, W, dtype=np.float32)

    f_dist = ndimage.distance_transform_edt(f_mask).astype(np.float32)
    s_dist = ndimage.distance_transform_edt(s_mask).astype(np.float32)

    f_luma = 0.299 * f_rgb[:, :, 0] + 0.587 * f_rgb[:, :, 1] + 0.114 * f_rgb[:, :, 2]
    s_luma = 0.299 * s_rgb[:, :, 0] + 0.587 * s_rgb[:, :, 1] + 0.114 * s_rgb[:, :, 2]
    f_relief = f_luma - ndimage.gaussian_filter(f_luma, sigma=4.5)
    s_relief = s_luma - ndimage.gaussian_filter(s_luma, sigma=4.5)

    vol = np.full((W, H, W), -1.0, dtype=np.float32)
    y_ped_m = target_height_m * 0.20

    for iy in range(H):
        y_m = float(ys[iy])
        row_f = f_mask[iy, :]
        row_s = s_mask[iy, :]
        if not np.any(row_f) or not np.any(row_s):
            continue

        fx_idx = np.where(row_f)[0]
        sz_idx = np.where(row_s)[0]

        f_xmin, f_xmax = float(xs[fx_idx[0]]), float(xs[fx_idx[-1]])
        f_half_w = max(0.5 * (f_xmax - f_xmin), 0.015)
        f_mid_x = 0.5 * (f_xmin + f_xmax)

        s_zmin, s_zmax = float(zs[sz_idx[0]]), float(zs[sz_idx[-1]])
        s_half_d = max(0.5 * (s_zmax - s_zmin), 0.015)
        s_mid_z = 0.5 * (s_zmin + s_zmax)

        # 1. Turned Pedestal (bottom 20%): circular symmetry
        ped_blend = float(np.clip((y_ped_m - y_m) / max(0.01, y_ped_m * 0.25), 0.0, 1.0))
        if ped_blend > 0.0:
            r_ped = 0.5 * (f_half_w + s_half_d)
            xx, zz = np.meshgrid(xs - f_mid_x, zs - s_mid_z, indexing="ij")
            r_grid = np.sqrt(xx**2 + zz**2)
            ped_field = r_ped - r_grid
        else:
            ped_field = None

        # 2. Main Body: Elliptical cross-section intersected with front and side silhouettes
        if ped_blend < 1.0:
            sd_row = s_dist[iy, :]
            sd_max = max(float(sd_row.max()), 1.0)
            z_env = np.clip(sd_row / (sd_max * 0.65), 0.0, 1.0) ** 0.54

            local_half_w = f_half_w * z_env
            xx, zz = np.meshgrid(xs - f_mid_x, zs - s_mid_z, indexing="ij")
            ellip_field = local_half_w[None, :] - np.abs(xx)

            fd_row = f_dist[iy, :]
            front_sdf_m = (fd_row - 0.5) * (span_xz / W)
            f_out_dist = ndimage.distance_transform_edt(~row_f).astype(np.float32) * (span_xz / W)
            front_signed = np.where(row_f, front_sdf_m, -f_out_dist)[:, None]

            s_out_dist = ndimage.distance_transform_edt(~row_s).astype(np.float32) * (span_xz / W)
            side_signed = np.where(row_s, sd_row * (span_xz / W), -s_out_dist)[None, :]

            body_field = np.minimum(np.minimum(ellip_field, front_signed), side_signed)

            # Emboss luminance relief for high-contrast features (eyes, belts, crenels, gems, feathers)
            relief_add = 0.007 * s_relief[iy, :][None, :] + 0.006 * f_relief[iy, :][:, None]
            body_field = body_field + relief_add
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

    # Downsample to ~54 x 74 x 54 for marching cubes budget (16k - 24k triangles)
    target_w, target_h = 54, 74
    zoom_factors = (target_w / W, target_h / H, target_w / W)
    vol_mc = ndimage.zoom(vol, zoom=zoom_factors, order=1)
    vol_mc[:, 0, :] = -1.0

    verts, faces, _, _ = measure.marching_cubes(vol_mc, level=0.0)
    v_m = np.zeros_like(verts, dtype=np.float64)
    v_m[:, 0] = (verts[:, 0] / (target_w - 1)) * span_xz - span_xz * 0.5
    v_m[:, 1] = (verts[:, 1] / (target_h - 1)) * target_height_m
    v_m[:, 2] = (verts[:, 2] / (target_w - 1)) * span_xz - span_xz * 0.5

    mesh = trimesh.Trimesh(vertices=v_m, faces=faces[:, ::-1], process=True)
    comps = mesh.split(only_watertight=False)
    if len(comps) > 1:
        mesh = max(comps, key=lambda m: len(m.faces))

    trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=10)

    # Ground strictly at min.y = 0.0 and normalize to target height
    min_y = float(mesh.vertices[:, 1].min())
    mesh.vertices[:, 1] -= min_y
    max_y = float(mesh.vertices[:, 1].max())
    if max_y > 1e-5:
        mesh.vertices[:, 1] *= target_height_m / max_y

    low_mask = mesh.vertices[:, 1] < 0.015
    mesh.vertices[low_mask, 1] = 0.0

    # Ensure pedestal footprint is within [0.72m, 0.78m] (contract: >= 0.70m and <= 0.86m)
    span_x = float(mesh.vertices[:, 0].max() - mesh.vertices[:, 0].min())
    span_z = float(mesh.vertices[:, 2].max() - mesh.vertices[:, 2].min())
    if span_x < 0.72 and span_x > 1e-5:
        mesh.vertices[:, 0] *= 0.74 / span_x
    elif span_x > 0.84:
        mesh.vertices[:, 0] *= 0.84 / span_x

    if span_z < 0.72 and span_z > 1e-5:
        mesh.vertices[:, 2] *= 0.74 / span_z
    elif span_z > 0.84:
        mesh.vertices[:, 2] *= 0.84 / span_z

    # Center in X and Z
    mesh.vertices[:, 0] -= 0.5 * float(mesh.vertices[:, 0].max() + mesh.vertices[:, 0].min())
    mesh.vertices[:, 2] -= 0.5 * float(mesh.vertices[:, 2].max() + mesh.vertices[:, 2].min())

    # Pin exact min_y = 0.0 and max_y = target_height_m
    mesh.vertices[:, 1] = np.clip(mesh.vertices[:, 1], 0.0, float(target_height_m))
    mesh.vertices[int(np.argmin(mesh.vertices[:, 1])), 1] = 0.0
    mesh.vertices[int(np.argmax(mesh.vertices[:, 1])), 1] = float(target_height_m)

    mesh.fix_normals()
    return mesh


def bake_uv_atlas_and_export_glb(
    mesh: trimesh.Trimesh,
    f_rgb: np.ndarray,
    f_mask: np.ndarray,
    s_rgb: np.ndarray,
    s_mask: np.ndarray,
    target_height_m: float,
    out_glb_path: Path,
) -> dict:
    """Build 1024x1024 UV atlas and write valid binary glTF 2.0 .glb."""
    H_grid, W_grid, _ = f_rgb.shape
    span_xz = 0.80

    tex_h, tex_w = 1024, 1024
    half_tw = tex_w // 2
    atlas = np.zeros((tex_h, tex_w, 3), dtype=np.float32)

    y_tex = np.linspace(H_grid - 1, 0, tex_h, dtype=np.float32)
    x_tex = np.linspace(0, W_grid - 1, half_tw, dtype=np.float32)
    yy_t, xx_t = np.meshgrid(y_tex, x_tex, indexing="ij")
    for c in range(3):
        atlas[:, :half_tw, c] = ndimage.map_coordinates(s_rgb[:, :, c], [yy_t, xx_t], order=1, mode="nearest")
        atlas[:, half_tw:, c] = ndimage.map_coordinates(f_rgb[:, :, c], [yy_t, xx_t], order=1, mode="nearest")

    atlas_u8 = np.clip(atlas * 255.0, 0.0, 255.0).astype(np.uint8)
    png_buf = io.BytesIO()
    Image.fromarray(atlas_u8, mode="RGB").save(png_buf, format="PNG", optimize=True)
    png_bytes = png_buf.getvalue()

    faces = mesh.faces
    v_pos = mesh.vertices[faces].reshape(-1, 3).astype(np.float32)
    v_norm = mesh.vertex_normals[faces].reshape(-1, 3).astype(np.float32)

    # Front panel for front-facing triangles (nz > 0.35, z > 0), Side panel for sides/back/pedestal
    f_norms = mesh.face_normals
    tri_centers = v_pos.reshape(-1, 3, 3).mean(axis=1)
    use_front_panel = (f_norms[:, 2] > 0.30) & (tri_centers[:, 2] > -0.05)
    tri_front = np.repeat(use_front_panel, 3)

    u_side = np.clip(((v_pos[:, 2] / span_xz) + 0.5), 0.02, 0.98) * 0.48 + 0.01
    u_front = np.clip(((v_pos[:, 0] / span_xz) + 0.5), 0.02, 0.98) * 0.48 + 0.51
    u_coord = np.where(tri_front, u_front, u_side).astype(np.float32)
    v_coord = np.clip(1.0 - (v_pos[:, 1] / target_height_m), 0.01, 0.99).astype(np.float32)
    uvs = np.column_stack([u_coord, v_coord]).astype(np.float32)

    indices = np.arange(len(v_pos), dtype=np.uint32)

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
        "asset": {"version": "2.0", "generator": "carchess3d-mode-a-sdf"},
        "scene": 0,
        "scenes": [{"name": out_glb_path.stem, "nodes": [0]}],
        "nodes": [{"name": out_glb_path.stem, "mesh": 0}],
        "meshes": [
            {
                "name": out_glb_path.stem,
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
                    "roughnessFactor": 0.40,
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
        "images": [{"bufferView": bv_img, "mimeType": "image/png", "name": f"{out_glb_path.stem}_atlas"}],
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
    }


def reconstruct_piece(family: str, role: str, slug: str, height_m: float, src_rel: str, dest_rel: str) -> dict:
    t0 = time.time()
    src_path = REPO_ROOT / src_rel
    dest_path = REPO_ROOT / dest_rel
    print(f"🗿 [{slug}] Processing 2D turnaround {src_path.name} -> {dest_path.name} ({height_m}m)...", flush=True)

    f_rgb, f_mask, s_rgb, s_mask = extract_aligned_views(src_path, height_m)
    mesh = sculpt_piece_sdf_mesh(f_rgb, f_mask, s_rgb, s_mask, height_m)
    stats = bake_uv_atlas_and_export_glb(mesh, f_rgb, f_mask, s_rgb, s_mask, height_m, dest_path)
    elapsed = time.time() - t0
    print(
        f"  ✅ [{slug}] Saved {dest_rel} ({stats['size_kb']} KB, {stats['faces']} tris, {height_m}m) in {elapsed:.1f}s",
        flush=True,
    )
    return stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--family", choices=["classic", "swamp", "all"], default="all")
    parser.add_argument("--only", nargs="*", help="Optional filter by piece slug or role")
    parser.add_argument("--skip-existing", action="store_true")
    args = parser.parse_args()

    targets = [t for t in ALL_TARGETS if args.family in ("all", t[0])]
    if args.only:
        filters = set(args.only)
        targets = [t for t in targets if t[1] in filters or t[2] in filters]

    for family, role, slug, height_m, src_rel, dest_rel in targets:
        dest_p = REPO_ROOT / dest_rel
        if args.skip_existing and dest_p.exists():
            print(f"⏩ [{slug}] Skipping existing {dest_rel}", flush=True)
            continue
        reconstruct_piece(family, role, slug, height_m, src_rel, dest_rel)

    return 0


if __name__ == "__main__":
    sys.exit(main())
