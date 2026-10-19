#!/usr/bin/env python3
"""Multi-Tier GLB LOD Generator and Decimation Logic.

Calculates polygon/face targets for Low (~10k), Medium (~50k), and High (~1000k / full) tiers,
and classifies client hardware heuristics. Can be run standalone or imported by benchmarks.
"""
import math
import sys

TARGET_TIERS = {
    "low": 10000,       # ~10k for mobile phones & battery saving
    "medium": 50000,    # ~50k for iPads, tablets, low-end laptops
    "high": 1000000,    # ~1000k / full detail for modern desktop gaming rigs
}


def calculate_target_faces(original_faces: int) -> dict:
    """Calculate target face counts for low, medium, and high tiers.

    Clamps to original_faces if the original model has fewer triangles.
    """
    return {
        "low": min(original_faces, TARGET_TIERS["low"]),
        "medium": min(original_faces, TARGET_TIERS["medium"]),
        "high": original_faces,
    }


def classify_hardware_heuristic(device_type: str, memory_gb: float = 8.0, cores: int = 8) -> str:
    """Heuristic to recommend optimal default model tier based on device specs."""
    dev = device_type.lower()
    if "mobile" in dev or "phone" in dev:
        return "low"
    if "tablet" in dev or "ipad" in dev or memory_gb <= 4 or cores <= 4:
        return "medium"
    return "high"


if __name__ == "__main__":
    if len(sys.argv) > 1:
        faces = int(sys.argv[1])
        print(calculate_target_faces(faces))
    else:
        print("Usage: python3 decimate_lod.py <original_face_count>")
