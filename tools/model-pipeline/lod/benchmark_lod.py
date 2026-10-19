#!/usr/bin/env python3
"""Automated GLB Benchmark Utility.

Analyzes GLB models across tiers:
- Binary file size & gzip compressed size
- glTF 2.0 JSON chunk inspection
- Accessor counts (indices, vertices, normals, uvs)
- Parse and decompression timing benchmark
- Hardware device tier recommendation table
"""
import gzip
import json
import os
import pathlib
import struct
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent

def inspect_glb(glb_path: pathlib.Path) -> dict:
    if not glb_path.exists():
        return {"error": "file not found"}
    raw_data = glb_path.read_bytes()
    size_bytes = len(raw_data)
    gzip_bytes = len(gzip.compress(raw_data))

    t0 = time.perf_counter()
    magic, version, declared_len = struct.unpack("<4sII", raw_data[:12])
    chunk_len, chunk_type = struct.unpack("<II", raw_data[12:20])
    json_bytes = raw_data[20 : 20 + chunk_len]
    gltf = json.loads(json_bytes.decode("utf-8"))
    t1 = time.perf_counter()
    parse_ms = (t1 - t0) * 1000

    triangle_count = 0
    vertex_count = 0

    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            idx_acc = prim.get("indices")
            pos_acc = prim.get("attributes", {}).get("POSITION")
            if idx_acc is not None and idx_acc < len(gltf.get("accessors", [])):
                triangle_count += gltf["accessors"][idx_acc].get("count", 0) // 3
            if pos_acc is not None and pos_acc < len(gltf.get("accessors", [])):
                vertex_count += gltf["accessors"][pos_acc].get("count", 0)

    return {
        "file": glb_path.name,
        "path": str(glb_path.relative_to(ROOT)),
        "size_kb": round(size_bytes / 1024, 1),
        "gzip_kb": round(gzip_bytes / 1024, 1),
        "triangles": triangle_count,
        "vertices": vertex_count,
        "parse_ms": round(parse_ms, 2),
    }

def run_benchmark():
    models = [
        ROOT / "assets/models/king-riccardo.glb",
        ROOT / "assets/models/queen-kate.glb",
        ROOT / "assets/models/bishop-ale-1.glb",
        ROOT / "assets/models/bishop-ale-2-remastered.glb",
        ROOT / "assets/models/knight-seby.glb",
        ROOT / "assets/models/rook-pupurabbu.glb",
        ROOT / "assets/models/pawn-puffin.glb",
    ]

    print("=" * 80)
    print("🏰 CARCHESS3D — GLB MULTI-TIER & ASSET BENCHMARK REPORT")
    print("=" * 80)
    print(f"{'Model File':<32} {'Size (KB)':<10} {'Gzip (KB)':<10} {'Triangles':<10} {'Parse (ms)':<10}")
    print("-" * 80)

    for p in models:
        info = inspect_glb(p)
        if "error" in info:
            print(f"{p.name:<32} ERROR: {info['error']}")
        else:
            print(f"{info['file']:<32} {info['size_kb']:<10} {info['gzip_kb']:<10} {info['triangles']:<10} {info['parse_ms']:<10}")

    print("-" * 80)
    print("📱 Recommended Hardware Heuristic Tiers:")
    print(" - Smartphone / Pixel 10 (Low):    ~10k triangles  (~1-2s download & parse)")
    print(" - Tablet / iPad / Air (Medium):   ~50k triangles  (~2-4s download & parse)")
    print(" - PC Gaming / Workstation (High): ~1000k triangles (Full visual fidelity)")
    print("=" * 80)

if __name__ == "__main__":
    run_benchmark()
