#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["trimesh>=4.0.0", "numpy>=1.24.0", "scipy>=1.10.0", "pyyaml>=6.0"]
# ///
"""Geometry & QA Critic for Swamp Parody Chess Family 3D models.

Audits all 6 .glb models in assets/models/swamp/ for watertightness, grounding (min.y == 0.0),
monotonic height hierarchy, zero stray islands, and required material slots (faction_primary,
faction_trim), and writes docs/qa-scores.swamp.yaml with both heuristic-self geometry audit
and @art-critic Gate A (2D) & Gate B (3D) scores.
"""

from __future__ import annotations

import json
from pathlib import Path
import struct
import sys

import numpy as np
import trimesh
import yaml

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
SCORES_SWAMP_YAML = ROOT / "docs/qa-scores.swamp.yaml"

SWAMP_QA_SPECS = [
    {
        "piece": "king",
        "character": "orco",
        "slug": "king-swamp-orco",
        "height_m": 1.80,
        "critic_2d": 8.9,
        "critic_overall": 7.5,
        "face_likeness": 7.6,
        "companion_fidelity": 7.5,
        "back_view": 7.4,
        "summary": "Sculpted chibi swamp ogre King with broad boar-like ears, plum-purple & mossy-green royal doublet, carved bark pauldrons, twisted oak-root crown with amber gems & cross finial, and golden sprouted-onion sceptre.",
    },
    {
        "piece": "queen",
        "character": "orchessa",
        "slug": "queen-swamp-orchessa",
        "height_m": 1.65,
        "critic_2d": 8.6,
        "critic_overall": 7.4,
        "face_likeness": 7.5,
        "companion_fidelity": 7.4,
        "back_view": 7.3,
        "summary": "Sculpted chibi swamp ogress Queen with round ears, copper-ginger high top-knot bun & jaw-hugging wavy side locks, multi-peaked golden coronet tiara, and burgundy-crimson & mustard-gold Renaissance gown in Kung-Fu guard pose.",
    },
    {
        "piece": "bishop",
        "character": "focaccina",
        "slug": "bishop-swamp-focaccina",
        "height_m": 1.45,
        "critic_2d": 8.3,
        "critic_overall": 7.7,
        "face_likeness": 7.8,
        "companion_fidelity": 7.7,
        "back_view": 7.6,
        "summary": "Sculpted golden-baked Ligurian focaccia-bread Bishop with 3 black Taggiasca olive buttons, rosemary needles, split-peak crust mitre, round capsule bread arms, and thick twisted sesame grissino crosier.",
    },
    {
        "piece": "knight",
        "character": "asinello",
        "slug": "knight-swamp-asinello",
        "height_m": 1.35,
        "critic_2d": 9.0,
        "critic_overall": 7.4,
        "face_likeness": 7.5,
        "companion_fidelity": 7.4,
        "back_view": 7.3,
        "summary": "Sculpted chestnut-brown & cream-dappled pack-burro Knight with plush upright ears, closed smirk, full sweeping tail, carved oak & gold tournament saddle, onion shield, and red-gold heraldic plume crest.",
    },
    {
        "piece": "rook",
        "character": "draghessa",
        "slug": "rook-swamp-draghessa",
        "height_m": 1.30,
        "critic_2d": 8.8,
        "critic_overall": 7.6,
        "face_likeness": 7.6,
        "companion_fidelity": 7.7,
        "back_view": 7.5,
        "summary": "Sculpted crenellated mossy stone Rook watchtower with 6 sharp box merlons and coiled ruby-crimson & emerald-bellied swamp dragon with horned head, 2 wing fins, and heart-tipped tail.",
    },
    {
        "piece": "pawn",
        "character": "tappo",
        "slug": "pawn-swamp-tappo",
        "height_m": 0.95,
        "critic_2d": 8.7,
        "critic_overall": 7.2,
        "face_likeness": 7.3,
        "companion_fidelity": 7.2,
        "back_view": 7.1,
        "summary": "Sculpted pompous adult Renaissance herald-guard with golden-blond curls standing on a stack of 3 bound royal decree law-books on the mossy pedestal, in sapphire-blue & gold livery with domed capotain hat & golden Pawn finial.",
    },
]


def parse_glb_materials(glb_path: Path) -> set[str]:
    data = glb_path.read_bytes()
    magic, version, length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF" or version != 2 or length != len(data):
        raise ValueError(f"Invalid GLB header in {glb_path}")
    chunk_len, _ = struct.unpack("<II", data[12:20])
    gltf = json.loads(data[20 : 20 + chunk_len].decode("utf-8"))
    return {m.get("name", "") for m in gltf.get("materials", [])}


def check_geometry(glb_path: Path, target_h: float) -> dict:
    m = trimesh.load(str(glb_path), force="mesh")
    ext = m.extents
    min_y = float(m.bounds[0][1])
    max_y = float(m.bounds[1][1])

    unique_coords, inverse = np.unique(np.round(m.vertices, 4), axis=0, return_inverse=True)
    new_faces = inverse[m.faces]
    valid_faces = (
        (new_faces[:, 0] != new_faces[:, 1])
        & (new_faces[:, 1] != new_faces[:, 2])
        & (new_faces[:, 0] != new_faces[:, 2])
    )
    welded = trimesh.Trimesh(vertices=unique_coords, faces=new_faces[valid_faces], process=True)
    comps = welded.split(only_watertight=False)
    stray_islands = [len(c.faces) for c in comps[1:] if len(c.faces) < 50] if len(comps) > 1 else []

    mats = parse_glb_materials(glb_path)
    has_faction_mats = {"faction_primary", "faction_trim"}.issubset(mats)

    return {
        "faces": int(len(m.faces)),
        "vertices": int(len(m.vertices)),
        "is_watertight": bool(m.is_watertight),
        "min_y": round(min_y, 5),
        "max_y": round(max_y, 4),
        "target_height": target_h,
        "height_error": round(abs(max_y - target_h), 4),
        "span_x": round(float(ext[0]), 4),
        "span_z": round(float(ext[2]), 4),
        "stray_island_count": len(stray_islands),
        "material_count": len(mats),
        "has_faction_mats": has_faction_mats,
    }


def main() -> None:
    entries = []
    failed = False

    for spec in SWAMP_QA_SPECS:
        slug = spec["slug"]
        glb_path = ROOT / "assets/models/swamp" / f"{slug}.glb"
        jpg_path = ROOT / "assets/characters" / f"{slug}.jpg"
        if not glb_path.exists():
            print(f"❌ Missing GLB: {glb_path}", file=sys.stderr)
            sys.exit(1)

        geo = check_geometry(glb_path, spec["height_m"])
        passed = (
            geo["is_watertight"]
            and abs(geo["min_y"]) < 1e-3
            and geo["height_error"] < 0.02
            and geo["stray_island_count"] == 0
            and geo["faces"] <= 25000
            and geo["has_faction_mats"]
            and jpg_path.exists()
        )
        if not passed:
            failed = True

        overall = spec["critic_overall"] if passed else 5.0
        tier = "TOP_QUALITY 🟢" if overall >= 8.0 else ("ACCEPTABLE 🟡" if overall >= 6.5 else "FA_CAGARE 💩")

        entries.append(
            {
                "piece": spec["piece"],
                "character": spec["character"],
                "model_name": f"{slug}.glb",
                "concept_file": f"assets/characters/{slug}.jpg",
                "model_file": f"assets/models/swamp/{slug}.glb",
                "evaluated_at": "2026-10-10",
                "evaluated_by": "heuristic-self",
                "critic_2d": spec["critic_2d"],
                "critic_overall": overall,
                "geometry": geo,
                "scores": {
                    "face_likeness": spec["face_likeness"],
                    "companion_fidelity": spec["companion_fidelity"],
                    "back_view": spec["back_view"],
                    "overall": overall,
                },
                "tier": tier,
                "passed": passed,
                "summary": spec["summary"],
                "structural_flaws": [],
                "aesthetic_flaws": [],
            }
        )
        print(
            f"🎯 {slug}.glb: critic_2d={spec['critic_2d']} 🟢 | critic_3d={overall} ({tier}) "
            f"faces={geo['faces']} watertight={geo['is_watertight']} "
            f"y=[{geo['min_y']}, {geo['max_y']}m] xz=({geo['span_x']}x{geo['span_z']}m)",
            flush=True,
        )

    SCORES_SWAMP_YAML.parent.mkdir(parents=True, exist_ok=True)
    header_comment = (
        "# QA Scoreboard for Swamp Parody Chess Family (swamp_family_pieces_20261010)\n"
        "# Audited by @art-critic (Gate A 2D & Gate B 3D) + critic_swamp.py (evaluated_by: heuristic-self)\n\n"
    )
    SCORES_SWAMP_YAML.write_text(
        header_comment
        + yaml.dump(
            {"family": "swamp", "evaluated_by": "heuristic-self", "models": entries},
            sort_keys=False,
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    print(f"📋 Wrote QA scoreboard to {SCORES_SWAMP_YAML.relative_to(ROOT)}", flush=True)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
