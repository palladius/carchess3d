"""Stdlib unittest suite for the Carlessian Classic Chess Family (`classic`)."""

import json
import pathlib
import struct
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACT_PATH = ROOT / "assets/families/_contract.json"
CLASSIC_JSON_PATH = ROOT / "assets/families/classic.json"
CHARS_DIR = ROOT / "assets/characters"
MODELS_DIR = ROOT / "assets/models/classic"

EXPECTED_PIECES = {
    "king": {
        "slug": "king-classic-cesso",
        "height_m": 1.80,
        "attack_sig": "royal_flush_quake",
    },
    "queen": {
        "slug": "queen-classic-ciocco",
        "height_m": 1.65,
        "attack_sig": "marble_choco_crush",
    },
    "bishop": {
        "slug": "bishop-classic-drago",
        "height_m": 1.45,
        "attack_sig": "rune_laser_cleave",
    },
    "knight": {
        "slug": "knight-classic-turbo",
        "height_m": 1.35,
        "attack_sig": "stone_hoon_charge",
    },
    "rook": {
        "slug": "rook-classic-puffo",
        "height_m": 1.30,
        "attack_sig": "fortress_slam",
    },
    "pawn": {
        "slug": "pawn-classic-puffin",
        "height_m": 0.95,
        "attack_sig": "pike_bonk",
    },
}


def parse_glb_json(path: pathlib.Path) -> dict:
    """Parse glTF 2.0 binary header and return the embedded JSON chunk dict."""
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError(f"{path.name}: file too short ({len(data)} B)")
    magic, version, total_len = struct.unpack("<4sII", data[:12])
    if magic != b"glTF":
        raise ValueError(f"{path.name}: invalid magic {magic!r}")
    if version != 2:
        raise ValueError(f"{path.name}: unsupported version {version}")
    if total_len != len(data):
        raise ValueError(f"{path.name}: declared length {total_len} != actual {len(data)}")
    chunk_len, chunk_type = struct.unpack("<II", data[12:20])
    if chunk_type != 0x4E4F534A:  # b"JSON"
        raise ValueError(f"{path.name}: first chunk is not JSON ({chunk_type:#x})")
    raw_json = data[20 : 20 + chunk_len].decode("utf-8")
    return json.loads(raw_json)


class TestClassicFamily(unittest.TestCase):
    """Validate Carlessian Classic 2D portraits, 3D GLB models, and family manifest."""

    @classmethod
    def setUpClass(cls):
        cls.contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))

    def test_portraits_exist_and_valid_jpeg(self):
        for piece, meta in EXPECTED_PIECES.items():
            jpg_path = CHARS_DIR / f"{meta['slug']}.jpg"
            self.assertTrue(jpg_path.is_file(), f"Missing 2D portrait: {jpg_path}")
            raw = jpg_path.read_bytes()
            self.assertGreater(len(raw), 10_000, f"Portrait too small: {jpg_path.name}")
            self.assertEqual(raw[:2], b"\xff\xd8", f"Not a valid JPEG header: {jpg_path.name}")

    def test_glb_models_exist_and_follow_contract(self):
        heights = {}
        max_tris = self.contract["max_triangles_per_piece"]
        req_mats = set(self.contract["required_material_slots"])
        tol = self.contract["grounding_tolerance_m"]

        for piece, meta in EXPECTED_PIECES.items():
            glb_path = MODELS_DIR / f"{meta['slug']}.glb"
            self.assertTrue(glb_path.is_file(), f"Missing 3D model: {glb_path}")
            gltf = parse_glb_json(glb_path)

            # Check named material slots
            mat_names = {m.get("name") for m in gltf.get("materials", [])}
            for req in req_mats:
                self.assertIn(
                    req,
                    mat_names,
                    f"{glb_path.name}: missing required material '{req}' (found {mat_names})",
                )

            # Aggregate POSITION min/max and triangle count across mesh primitives
            accessors = gltf.get("accessors", [])
            meshes = gltf.get("meshes", [])
            self.assertTrue(meshes, f"{glb_path.name}: no meshes in glTF")

            min_xyz = [float("inf"), float("inf"), float("inf")]
            max_xyz = [float("-inf"), float("-inf"), float("-inf")]
            total_tris = 0

            for mesh in meshes:
                for prim in mesh.get("primitives", []):
                    pos_idx = prim.get("attributes", {}).get("POSITION")
                    self.assertIsNotNone(pos_idx, f"{glb_path.name}: primitive missing POSITION")
                    pos_acc = accessors[pos_idx]
                    acc_min = pos_acc.get("min")
                    acc_max = pos_acc.get("max")
                    self.assertIsNotNone(acc_min, f"{glb_path.name}: POSITION accessor missing min")
                    self.assertIsNotNone(acc_max, f"{glb_path.name}: POSITION accessor missing max")
                    for i in range(3):
                        min_xyz[i] = min(min_xyz[i], float(acc_min[i]))
                        max_xyz[i] = max(max_xyz[i], float(acc_max[i]))

                    if "indices" in prim:
                        idx_acc = accessors[prim["indices"]]
                        total_tris += int(idx_acc["count"]) // 3
                    else:
                        total_tris += int(pos_acc["count"]) // 3

            # Grounding at y = 0.0
            self.assertLess(
                abs(min_xyz[1] - self.contract["grounding_y_m"]),
                tol,
                f"{glb_path.name}: min.y={min_xyz[1]:.5f} not grounded at 0.0",
            )

            # Target height check
            height_y = max_xyz[1] - min_xyz[1]
            heights[piece] = height_y
            self.assertAlmostEqual(
                height_y,
                meta["height_m"],
                places=2,
                msg=f"{glb_path.name}: height {height_y:.4f}m != expected {meta['height_m']}m",
            )

            # Triangle budget check (also ensure non-trivial sculpted detail >= 400 tris)
            self.assertLessEqual(
                total_tris,
                max_tris,
                f"{glb_path.name}: {total_tris} triangles exceeds budget {max_tris}",
            )
            self.assertGreaterEqual(
                total_tris,
                400,
                f"{glb_path.name}: {total_tris} triangles is too low-poly",
            )

        # Strict monotonic height hierarchy: pawn < rook < knight < bishop < queen < king
        order = ["pawn", "rook", "knight", "bishop", "queen", "king"]
        for a, b in zip(order, order[1:]):
            self.assertLess(
                heights[a],
                heights[b],
                f"Height hierarchy violated: {a} ({heights[a]:.3f}m) >= {b} ({heights[b]:.3f}m)",
            )

    def test_classic_family_manifest(self):
        self.assertTrue(CLASSIC_JSON_PATH.is_file(), f"Missing {CLASSIC_JSON_PATH}")
        manifest = json.loads(CLASSIC_JSON_PATH.read_text(encoding="utf-8"))
        self.assertEqual(manifest.get("id"), "classic")
        self.assertIn("it", manifest.get("label", {}))
        self.assertIn("en", manifest.get("label", {}))
        self.assertEqual(manifest.get("victim_reaction"), "stone_shrapnel_shatter")

        pieces = manifest.get("pieces", {})
        self.assertEqual(set(pieces.keys()), set(EXPECTED_PIECES.keys()))
        for piece, expected in EXPECTED_PIECES.items():
            entry = pieces[piece]
            self.assertEqual(entry.get("slug"), expected["slug"])
            self.assertEqual(entry.get("model"), f"assets/models/classic/{expected['slug']}.glb")
            self.assertEqual(entry.get("portrait"), f"assets/characters/{expected['slug']}.jpg")
            self.assertAlmostEqual(float(entry.get("height_m", 0)), expected["height_m"], places=2)
            self.assertEqual(entry.get("attack_sig"), expected["attack_sig"])
            self.assertEqual(entry.get("victim_reaction"), "stone_shrapnel_shatter")


if __name__ == "__main__":
    unittest.main()
