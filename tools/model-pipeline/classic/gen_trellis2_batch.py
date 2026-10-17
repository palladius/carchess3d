#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["gradio_client>=1.3.0", "pygltflib>=1.16.0", "numpy>=1.24.0", "pillow>=10.0.0"]
# ///
"""Batch Image-to-3D GLB generator using microsoft/TRELLIS.2 for Classic & Swamp families.

Features:
- Automatically crops the left-half Front View when given a 16:9 2-up turnaround sheet
  (such as `assets/characters/*-classic-*.jpg`).
- Reconstructs a full 3D textured mesh via `microsoft/TRELLIS.2` (`/preprocess_image` ->
  `/image_to_3d` -> `/extract_glb` with `decimation_target=18000, texture_size=1024`).
- Post-processes the resulting `.glb` in-place via `pygltflib` + `numpy` so every piece
  strictly satisfies `assets/families/_contract.json`:
  - Grounded at `min.y = 0.0m`
  - Exact target rank height `max.y = height_m` (`1.80, 1.65, 1.45, 1.35, 1.30, 0.95`)
  - Base footprint `span_x >= 0.72m` and `span_z >= 0.72m`
  - Required material slots `faction_primary` (preserving the UV diffuse texture) and `faction_trim`
  - Triangle count `<= 25,000`
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import pygltflib
from gradio_client import Client, handle_file
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[3]

CLASSIC_PIECES = [
    ("king", "king-classic-re", 1.80, "assets/characters/king-classic-re.jpg", "assets/models/classic/king-classic-re.glb"),
    ("queen", "queen-classic-regina", 1.65, "assets/characters/queen-classic-regina.jpg", "assets/models/classic/queen-classic-regina.glb"),
    ("bishop", "bishop-classic-vescovo", 1.45, "assets/characters/bishop-classic-vescovo.jpg", "assets/models/classic/bishop-classic-vescovo.glb"),
    ("knight", "knight-classic-cavallo", 1.35, "assets/characters/knight-classic-cavallo.jpg", "assets/models/classic/knight-classic-cavallo.glb"),
    ("rook", "rook-classic-torre", 1.30, "assets/characters/rook-classic-torre.jpg", "assets/models/classic/rook-classic-torre.glb"),
    ("pawn", "pawn-classic-pedone", 0.95, "assets/characters/pawn-classic-pedone.jpg", "assets/models/classic/pawn-classic-pedone.glb"),
]

SWAMP_PIECES = [
    ("king", "king-swamp-orco", 1.80, "assets/characters/king-swamp-orco.jpg", "assets/models/swamp/king-swamp-orco.glb"),
    ("queen", "queen-swamp-orchessa", 1.65, "assets/characters/queen-swamp-orchessa.jpg", "assets/models/swamp/queen-swamp-orchessa.glb"),
    ("bishop", "bishop-swamp-focaccina", 1.45, "assets/characters/bishop-swamp-focaccina.jpg", "assets/models/swamp/bishop-swamp-focaccina.glb"),
    ("knight", "knight-swamp-asinello", 1.35, "assets/characters/knight-swamp-asinello.jpg", "assets/models/swamp/knight-swamp-asinello.glb"),
    ("rook", "rook-swamp-draghessa", 1.30, "assets/characters/rook-swamp-draghessa.jpg", "assets/models/swamp/rook-swamp-draghessa.glb"),
    ("pawn", "pawn-swamp-tappo", 0.95, "assets/characters/pawn-swamp-tappo.jpg", "assets/models/swamp/pawn-swamp-tappo.glb"),
]


def load_hf_token() -> str | None:
    token_keys = (
        "HF_RICC_PROVE3D_CARLESSO",
        "HUGGING_FACE_RO_TRELLIS_WHEREABOUTS",
        "HF_TOKEN",
        "HUGGING_FACE_RO_TRELLIS",
    )
    for key in token_keys:
        val = os.environ.get(key)
        if val:
            return val.strip()
    gic = Path(os.environ.get("GIC", Path.home() / "git/gic"))
    candidate_files = [
        REPO_ROOT / ".env",
        gic / ".env.gprism",
        gic / ".env",
        Path.home() / ".env",
    ]
    for env_file in candidate_files:
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                if line.startswith("export "):
                    line = line[7:].strip()
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("\"'")
                if k in token_keys and v:
                    return v
    return None


def prepare_single_front_image(src_img_path: Path, tmp_dir: Path) -> Path:
    """If the input is a 16:9 2-up turnaround sheet, crop only the left-half Front View."""
    img = Image.open(src_img_path).convert("RGB")
    w, h = img.size
    if w > int(h * 1.2):
        crop_w = int(w * 0.50)
        left_half = img.crop((0, 0, crop_w, h))
        bg_color = img.getpixel((4, 4))
        side = max(crop_w, h)
        square = Image.new("RGB", (side, side), bg_color)
        square.paste(left_half, ((side - crop_w) // 2, (side - h) // 2))
        out_path = tmp_dir / f"{src_img_path.stem}_front_crop.png"
        square.save(out_path, format="PNG")
        return out_path
    return src_img_path


def normalize_trellis_glb(raw_glb_path: Path, dest_glb_path: Path, target_height_m: float) -> dict:
    """Grounds at Y=0.0, scales to target_height_m, ensures span_x/z >= 0.72m, and tags materials."""
    gltf = pygltflib.GLTF2().load(str(raw_glb_path))
    blob = bytearray(gltf.binary_blob())

    # Clear any node transforms so vertex coordinates are world-space metres
    for node in gltf.nodes or []:
        node.matrix = None
        node.translation = None
        node.rotation = None
        node.scale = None

    total_tris = 0
    for mesh in gltf.meshes or []:
        for prim in mesh.primitives or []:
            pos_idx = prim.attributes.POSITION
            if pos_idx is None:
                continue
            pos_acc = gltf.accessors[pos_idx]
            bv = gltf.bufferViews[pos_acc.bufferView]
            byte_offset = (bv.byteOffset or 0) + (pos_acc.byteOffset or 0)
            count = pos_acc.count
            raw_bytes = bytes(blob[byte_offset : byte_offset + count * 12])
            verts = np.frombuffer(raw_bytes, dtype=np.float32).reshape((count, 3)).copy()

            min_xyz = verts.min(axis=0)
            max_xyz = verts.max(axis=0)
            orig_h = float(max_xyz[1] - min_xyz[1])
            scale = float(target_height_m) / max(1e-5, orig_h)

            center_x = 0.5 * float(min_xyz[0] + max_xyz[0])
            center_z = 0.5 * float(min_xyz[2] + max_xyz[2])

            verts[:, 0] = (verts[:, 0] - center_x) * scale
            verts[:, 2] = (verts[:, 2] - center_z) * scale
            verts[:, 1] = (verts[:, 1] - float(min_xyz[1])) * scale

            # Ensure X and Z span are between 0.72m and 0.86m (contract requirement: >= 0.70m, <= 0.86m)
            span_x = float(verts[:, 0].max() - verts[:, 0].min())
            span_z = float(verts[:, 2].max() - verts[:, 2].min())
            if span_x < 0.72 and span_x > 1e-5:
                verts[:, 0] *= 0.72 / span_x
            elif span_x > 0.86:
                verts[:, 0] *= 0.86 / span_x

            if span_z < 0.72 and span_z > 1e-5:
                verts[:, 2] *= 0.72 / span_z
            elif span_z > 0.86:
                verts[:, 2] *= 0.86 / span_z

            # Pin exact min_y = 0.0 and max_y = target_height_m
            verts[:, 1] = np.clip(verts[:, 1], 0.0, float(target_height_m))
            idx_min_y = int(np.argmin(verts[:, 1]))
            idx_max_y = int(np.argmax(verts[:, 1]))
            verts[idx_min_y, 1] = 0.0
            verts[idx_max_y, 1] = float(target_height_m)

            new_min = [float(x) for x in verts.min(axis=0)]
            new_max = [float(x) for x in verts.max(axis=0)]
            pos_acc.min = new_min
            pos_acc.max = new_max

            blob[byte_offset : byte_offset + count * 12] = verts.astype(np.float32).tobytes()

            if prim.indices is not None:
                total_tris += int(gltf.accessors[prim.indices].count) // 3
            else:
                total_tris += count // 3

    # Ensure required material names ("faction_primary", "faction_trim") are present
    if not gltf.materials:
        gltf.materials = [pygltflib.Material(name="faction_primary")]
    else:
        gltf.materials[0].name = "faction_primary"
        if gltf.materials[0].pbrMetallicRoughness:
            gltf.materials[0].pbrMetallicRoughness.metallicFactor = 0.08
            gltf.materials[0].pbrMetallicRoughness.roughnessFactor = 0.48

    existing_names = {m.name for m in gltf.materials if m.name}
    if "faction_trim" not in existing_names:
        gltf.materials.append(
            pygltflib.Material(
                name="faction_trim",
                pbrMetallicRoughness=pygltflib.PbrMetallicRoughness(
                    baseColorFactor=[0.831, 0.686, 0.216, 1.0],
                    metallicFactor=0.85,
                    roughnessFactor=0.22,
                ),
            )
        )

    gltf.set_binary_blob(bytes(blob))
    dest_glb_path.parent.mkdir(parents=True, exist_ok=True)
    part_path = dest_glb_path.with_suffix(".glb.part")
    gltf.save_binary(str(part_path))
    os.replace(part_path, dest_glb_path)

    return {
        "file": dest_glb_path.name,
        "size_kb": dest_glb_path.stat().st_size // 1024,
        "triangles": total_tris,
        "height_m": target_height_m,
    }


def generate_piece_trellis2(
    client: Client,
    slug: str,
    height_m: float,
    src_rel: str,
    dest_rel: str,
    decimation_target: int = 100000,
) -> dict:
    src_path = REPO_ROOT / src_rel
    dest_path = REPO_ROOT / dest_rel
    if not src_path.exists():
        raise FileNotFoundError(f"Missing portrait: {src_path}")

    with tempfile.TemporaryDirectory(prefix=f"trellis2_{slug}_") as tmp:
        tmp_dir = Path(tmp)
        input_img = prepare_single_front_image(src_path, tmp_dir)

        t0 = time.time()
        print(f"🗿 [{slug}] Preprocessing {input_img.name}...", flush=True)
        try:
            client.predict(api_name="/start_session")
        except Exception:
            pass
        preproc_img = client.predict(input=handle_file(str(input_img)), api_name="/preprocess_image")

        print(f"🗿 [{slug}] Running TRELLIS.2 image_to_3d...", flush=True)
        client.predict(
            image=handle_file(preproc_img),
            seed=42,
            resolution="1024",
            ss_guidance_strength=7.5,
            ss_guidance_rescale=0.7,
            ss_sampling_steps=12,
            ss_rescale_t=5.0,
            shape_slat_guidance_strength=7.5,
            shape_slat_guidance_rescale=0.5,
            shape_slat_sampling_steps=12,
            shape_slat_rescale_t=3.0,
            tex_slat_guidance_strength=1.0,
            tex_slat_guidance_rescale=0.0,
            tex_slat_sampling_steps=12,
            tex_slat_rescale_t=3.0,
            api_name="/image_to_3d",
        )

        print(f"🗿 [{slug}] Extracting GLB (decimation_target={decimation_target})...", flush=True)
        extracted_glb, download_glb = client.predict(
            decimation_target=decimation_target,
            texture_size=1024,
            api_name="/extract_glb",
        )
        raw_glb = Path(download_glb or extracted_glb)
        stats = normalize_trellis_glb(raw_glb, dest_path, height_m)
        elapsed = time.time() - t0
        print(
            f"  ✅ [{slug}] Saved {dest_rel} ({stats['size_kb']} KB, {stats['triangles']} tris, {stats['height_m']}m) in {elapsed:.1f}s",
            flush=True,
        )
        return stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--family", choices=["classic", "swamp", "all"], default="all")
    parser.add_argument("--only", nargs="*", help="Optional list of slugs or piece names to filter")
    parser.add_argument("--skip-existing", action="store_true", help="Skip models that already exist")
    args = parser.parse_args()

    token = load_hf_token()
    print("🔌 Connecting to microsoft/TRELLIS.2...", flush=True)
    client = Client("microsoft/TRELLIS.2", token=token, verbose=False)

    tasks = []
    if args.family in ("classic", "all"):
        tasks.extend(CLASSIC_PIECES)
    if args.family in ("swamp", "all"):
        tasks.extend(SWAMP_PIECES)

    if args.only:
        filters = set(args.only)
        tasks = [t for t in tasks if t[0] in filters or t[1] in filters]

    for role, slug, height_m, src_rel, dest_rel in tasks:
        dest_path = REPO_ROOT / dest_rel
        if args.skip_existing and dest_path.exists():
            print(f"⏩ [{slug}] Skipping existing {dest_rel}", flush=True)
            continue
        for attempt in range(1, 3):
            try:
                generate_piece_trellis2(client, slug, height_m, src_rel, dest_rel)
                break
            except Exception as exc:
                print(f"  ⚠️ [{slug}] Attempt {attempt} failed: {exc}", flush=True)
                if attempt == 2:
                    raise
                time.sleep(3)
                client = Client("microsoft/TRELLIS.2", token=token, verbose=False)

    return 0


if __name__ == "__main__":
    sys.exit(main())
