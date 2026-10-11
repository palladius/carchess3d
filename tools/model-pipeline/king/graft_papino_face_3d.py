#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["scipy>=1.11.0", "pygltflib>=1.16.0", "pillow>=10.0.0", "numpy>=1.24.0"]
# ///
"""Mode B (2D Portrait Face-Grafting onto Existing TRELLIS.2 3D GLB via Dual-Chart 2048x1024 UV Atlas)
for King Riccardo (`assets/models/king-riccardo.glb`).

Why Dual-Chart 2048x1024 UV Atlas + Interior Skin Dilation + Frequency-Separated Blending?
- `TRELLIS.2` (`xatlas`) packed 96,958 triangles into a single 1024x1024 texture, giving the face
  scattered tiny UV islands (~1.5px per triangle) and hallucinated squinty eyes / dark upper-lip shadow.
- We expand `Image 0` (`baseColorTexture`) to `2048x1024`:
  * Left half (`u in [0.0, 0.5]`, `1024x1024`): Exact original `TRELLIS.2` texture (`orig_tex`) for the
    golden crown, hair, ears, ermine collar, royal blue velvet cape, lion crest, sceptre, orb, and
    `"KING RICCARDO"` wooden pedestal.
  * Right half (`u in [0.5, 1.0]`, `1024x1024`): Dedicated continuous Planar Face Chart mapped from
    the landmark-locked 2D `tools/model-pipeline/king/front.png` portrait (cropped to the 512x512 head
    box and upscaled 2x to 1024x1024).
  * To prevent `front.png`'s narrower head border/ears/background from projecting onto the 3D cheeks,
    we extract the strict interior facial skin mask of `front.png`, dilate clean skin outward by 60px,
    and apply multi-band (low/high frequency) skin harmonization into `base_chart_rgb`.
"""

from __future__ import annotations

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


def read_acc(gltf: GLTF2, blob: bytes, idx: int) -> np.ndarray:
    acc = gltf.accessors[idx]
    bv = gltf.bufferViews[acc.bufferView]
    off = (bv.byteOffset or 0) + (acc.byteOffset or 0)
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[acc.componentType]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc.type]
    arr = np.frombuffer(blob, dtype=dt, count=acc.count * ncomp, offset=off)
    return arr.reshape(acc.count, ncomp).copy() if ncomp > 1 else arr.copy()


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


def prepare_clean_front_face(front_rgb: np.ndarray) -> np.ndarray:
    """Inpaint/dilate outside the strict interior facial skin oval of front.png so sideburns,
    2D ears, crown rim, and grey studio background never bleed onto the 3D cheeks/temples.
    """
    H, W, _ = front_rgb.shape
    yy, xx = np.meshgrid(np.arange(H, dtype=np.float32), np.arange(W, dtype=np.float32), indexing="ij")

    # Elliptical interior face zone in front.png (centered at col=518.5, row=348, rx=92px, ry=132px)
    ex = (xx - 518.5) / 92.0
    ey = (yy - 348.0) / 132.0
    oval = (ex * ex + ey * ey) <= 1.0
    # Exclude crown above row 214 and collar below row 476
    oval &= (yy >= 214.0) & (yy <= 476.0)

    # Also keep dark eyes/eyebrows/mouth inside the inner feature zone (|xx - 518.5| < 78, yy in 255..445)
    inner_features = (np.abs(xx - 518.5) <= 78.0) & (yy >= 255.0) & (yy <= 445.0)
    # Near the outer rim of the oval (not inner_features), exclude dark hair/sideburns or bright background
    r, g, b = front_rgb[:, :, 0], front_rgb[:, :, 1], front_rgb[:, :, 2]
    is_warm_skin = (r > g + 0.04) & (g > b + 0.02) & (r > 0.32) & (r < 0.92)
    strict_face_mask = inner_features | (oval & is_warm_skin)

    return dilate_rgb_outside_mask(front_rgb, strict_face_mask, iters=85)


def graft_face_onto_king_glb() -> dict:
    gltf = GLTF2().load(str(ORIG_GLB))
    orig_blob = bytes(gltf.binary_blob())

    prim = gltf.meshes[0].primitives[0]
    pos = read_acc(gltf, orig_blob, prim.attributes.POSITION)
    norm = read_acc(gltf, orig_blob, prim.attributes.NORMAL)
    uv = read_acc(gltf, orig_blob, prim.attributes.TEXCOORD_0)
    indices = read_acc(gltf, orig_blob, prim.indices).reshape(-1, 3)

    # Load original baseColorTexture (Image 0, 1024x1024 RGBA WebP)
    img0_bv = gltf.bufferViews[gltf.images[0].bufferView]
    orig_tex_pil = Image.open(
        io.BytesIO(orig_blob[img0_bv.byteOffset : img0_bv.byteOffset + img0_bv.byteLength])
    ).convert("RGBA")
    orig_tex = np.asarray(orig_tex_pil, dtype=np.float32) / 255.0
    th, tw, _ = orig_tex.shape  # 1024, 1024

    # Sample original per-vertex RGB from orig_tex
    tx_v = np.clip((uv[:, 0] * (tw - 1)).astype(np.int32), 0, tw - 1)
    ty_v = np.clip((uv[:, 1] * (th - 1)).astype(np.int32), 0, th - 1)
    v_orig_rgb = orig_tex[ty_v, tx_v, :3]

    # Load 2D front.png (1024x1024) and strip outer head border / ears / sideburns / studio bg
    raw_front_rgb = np.asarray(Image.open(FRONT_PNG).convert("RGB"), dtype=np.float32) / 255.0
    front_rgb = prepare_clean_front_face(raw_front_rgb)

    # Landmark-locked orthographic mapping from 3D head to 2D front.png:
    # - 3D eyes at Y = +0.1928 <-> 2D row = 305.0
    # - 3D mouth at Y = +0.075 <-> 2D row = 418.5  (scale_y = 960.0 px/m)
    # - Horizontal scale_x = 920.0 px/m so the 2D cheeks span the full width of the 3D head
    scale_x = 920.0
    scale_y = 960.0
    col_2d = 518.5 + (pos[:, 0] - 0.0012) * scale_px if False else 518.5 + (pos[:, 0] - 0.0012) * scale_x
    row_2d = 305.0 - (pos[:, 1] - 0.1928) * scale_y

    # Dedicated 1024x1024 Right-Half Planar Head Chart covers front.png head crop:
    c_min, c_max = 262.0, 774.0
    r_min, r_max = 100.0, 612.0

    chart_h, chart_w = 1024, 1024
    r_grid = np.linspace(r_min, r_max, chart_h, dtype=np.float32)
    c_grid = np.linspace(c_min, c_max, chart_w, dtype=np.float32)
    rr, cc = np.meshgrid(r_grid, c_grid, indexing="ij")
    front_chart = np.zeros((chart_h, chart_w, 3), dtype=np.float32)
    for c in range(3):
        front_chart[:, :, c] = ndimage.map_coordinates(front_rgb[:, :, c], [rr, cc], order=1, mode="nearest")

    # Compute per-vertex blend weight `v_w` in [0..1] for the front face:
    # 1. Vertical feather: 0 below chin (y <= 0.015), 1 in [0.055 .. 0.245], 0 below crown rim (y >= 0.275)
    wy_bot = np.clip((pos[:, 1] - 0.015) / 0.040, 0.0, 1.0)
    wy_top = np.clip((0.275 - pos[:, 1]) / 0.030, 0.0, 1.0)
    wy = wy_bot * wy_top

    # 2. Elliptical radial face feather centered on nose bridge (x=0.0, y=0.145)
    ex_3d = pos[:, 0] / 0.105
    ey_3d = (pos[:, 1] - 0.145) / 0.128
    r_ell = np.sqrt(ex_3d * ex_3d + ey_3d * ey_3d)
    w_ell = np.clip((1.05 - r_ell) / 0.32, 0.0, 1.0)

    # 3. Depth & normal feather: front-facing facial surface (z >= 0.055, nz >= 0.22)
    wz = np.clip((pos[:, 2] - 0.055) / 0.045, 0.0, 1.0)
    wn = np.clip((norm[:, 2] - 0.20) / 0.38, 0.0, 1.0)

    raw_w = wy * w_ell * wz * wn
    v_w = (raw_w * raw_w * (3.0 - 2.0 * raw_w)).astype(np.float32)

    # Select front-head triangles (`shell_tris`) that use the continuous planar chart
    v_in_shell = (
        (pos[:, 1] >= 0.002)
        & (pos[:, 1] <= 0.284)
        & (pos[:, 2] >= 0.035)
        & (np.abs(pos[:, 0]) <= 0.128)
        & (norm[:, 2] >= 0.08)
    )
    tri_in_shell = np.all(v_in_shell[indices], axis=1) & (v_w[indices].max(axis=1) > 0.001)

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

    base_chart_rgb = dilate_rgb_outside_mask(base_chart_rgb, cov_mask, iters=28)
    weight_chart = ndimage.gaussian_filter(weight_chart, sigma=10.0)

    # Multi-Band (Laplacian / Frequency-Separated) Skin Harmonization:
    # Transfer the smooth low-frequency skin shading of the 3D head (`low_3d`) at the perimeter
    # so the cheeks, jawline, and forehead blend with ZERO visible seam, while preserving 100%
    # of the high-frequency facial details (eyes, white catchlights, eyebrows, nose, smile) from front.png!
    low_3d = np.zeros_like(base_chart_rgb)
    low_2d = np.zeros_like(front_chart)
    for c in range(3):
        low_3d[:, :, c] = ndimage.gaussian_filter(base_chart_rgb[:, :, c], sigma=26.0)
        low_2d[:, :, c] = ndimage.gaussian_filter(front_chart[:, :, c], sigma=26.0)
    high_2d = front_chart - low_2d

    # Harmonize 2D face: use 3D head's low-frequency ambient skin tone + 35% of 2D warm studio glow + 100% 2D high-frequency features
    harmonized_2d = np.clip((0.65 * low_3d + 0.35 * low_2d) + high_2d, 0.0, 1.0)

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
        out_img_buf, format="WEBP", quality=92
    )
    new_img0_bytes = out_img_buf.getvalue()

    # Rebuild a compact, zero-bloat binary blob containing only the active accessors & textures
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
    gltf.save_binary(str(OUT_GLB))

    return {
        "pos_orig": pos,
        "norm_orig": norm,
        "uv_orig": uv,
        "indices_orig": indices,
        "orig_tex": orig_tex[:, :, :3],
        "pos_new": pos_new,
        "norm_new": norm_new,
        "uv_new": uv_new,
        "indices_new": indices_new,
        "dual_atlas": dual_atlas[:, :, :3],
        "size_kb": OUT_GLB.stat().st_size // 1024,
        "shell_tris_count": int(np.sum(tri_in_shell)),
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
    v_shade = np.clip(0.66 + 0.36 * np.clip(vn @ key_dir, 0.0, 1.0), 0.0, 1.08).astype(np.float32)

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
    """Render side-by-side Before (TRELLIS.2) vs After (Mode B Dual-Chart 2048x1024 Face-Grafted) + 360 GIF."""
    panels = [
        (
            "PRIMA (TRELLIS.2: occhi socchiusi / bassa ris.)",
            rasterize_view_barycentric(
                data["pos_orig"], data["norm_orig"], data["uv_orig"], data["indices_orig"], data["orig_tex"],
                yaw_deg=0.0, zoom_head=True,
            ),
        ),
        (
            "DOPO Mode B (Face-Grafting HD da front.png!)",
            rasterize_view_barycentric(
                data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
                yaw_deg=0.0, zoom_head=True,
            ),
        ),
        (
            "DOPO 3D Completo - Fronte (0°)",
            rasterize_view_barycentric(
                data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
                yaw_deg=0.0, zoom_head=False,
            ),
        ),
        (
            "DOPO 3D Completo - 3/4 (+28°)",
            rasterize_view_barycentric(
                data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
                yaw_deg=28.0, zoom_head=False,
            ),
        ),
    ]

    sheet = Image.new("RGB", (380 * 4 + 50, 460 + 60), (24, 26, 32))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text(
        (20, 16),
        f"RE RICCARDO 3D (king-riccardo.glb) - Mode B: Dual-Chart 2048x1024 Face-Grafting ({data['size_kb']} KB, {data['shell_tris_count']} face tris)",
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
        dr.text((12, 12), f"Papino 3D Mode B ({int(yaw)} deg)", fill=(245, 224, 150), font=font)
        frames.append(im)
    frames[0].save(out_gif, save_all=True, append_images=frames[1:], duration=110, loop=0)


def main() -> None:
    print("👑 Grafting 2D front.png face onto King Riccardo 3D GLB (Mode B Dual-Chart 2048x1024)...", flush=True)
    data = graft_face_onto_king_glb()
    print(f"🖼️ Rendering Before/After comparison and 360-degree GIF ({data['shell_tris_count']} face tris)...", flush=True)
    render_before_after_and_gif(data, PREVIEW_PNG, TURNTABLE_GIF)
    print(f"✅ Saved {OUT_GLB.relative_to(REPO_ROOT)} ({data['size_kb']} KB) and {PREVIEW_PNG.name}", flush=True)


if __name__ == "__main__":
    main()
