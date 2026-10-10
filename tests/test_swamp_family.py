import json
import pathlib
import re
import struct
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACT_PATH = ROOT / "assets/families/_contract.json"
SWAMP_MANIFEST_PATH = ROOT / "assets/families/swamp.json"

EXPECTED_PIECES = {
    "king": {
        "slug": "king-swamp-orco",
        "height_m": 1.80,
        "attack_sig": "swamp_onion_burp",
    },
    "queen": {
        "slug": "queen-swamp-orchessa",
        "height_m": 1.65,
        "attack_sig": "kungfu_slowmo_kick",
    },
    "bishop": {
        "slug": "bishop-swamp-focaccina",
        "height_m": 1.45,
        "attack_sig": "focaccina_crumb_bonk",
    },
    "knight": {
        "slug": "knight-swamp-asinello",
        "height_m": 1.35,
        "attack_sig": "asinello_back_kick",
    },
    "rook": {
        "slug": "rook-swamp-draghessa",
        "height_m": 1.30,
        "attack_sig": "dragon_heart_smoke",
    },
    "pawn": {
        "slug": "pawn-swamp-tappo",
        "height_m": 0.95,
        "attack_sig": "decree_scroll_flatten",
    },
}

# Hex-encoded prohibited third-party terms so no literal trademark appears in source
_BANNED_HEX = [
    "736872656b",
    "66696f6e61",
    "646f6e6b6579",
    "6369756368696e6f",
    "67696e6779",
    "6661727175616164",
    "64756c6f63",
    "647265616d776f726b73",
]
BANNED_RE = re.compile(
    r"\b(" + "|".join(bytes.fromhex(h).decode("ascii") for h in _BANNED_HEX) + r")\b",
    re.IGNORECASE,
)


def parse_glb_json(path: pathlib.Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError(f"{path} is too short ({len(data)} bytes)")
    magic, version, length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF" or version != 2 or length != len(data):
        raise ValueError(f"Invalid glTF header in {path}")
    chunk_len, chunk_type = struct.unpack("<II", data[12:20])
    if chunk_type != 0x4E4F534A:  # JSON
        raise ValueError(f"First chunk in {path} is not JSON")
    return json.loads(data[20 : 20 + chunk_len].decode("utf-8"))


class TestSwampFamily(unittest.TestCase):
    def test_ip_safety_across_swamp_files(self):
        scan_paths = [
            SWAMP_MANIFEST_PATH,
            ROOT / "docs/qa-scores.swamp.yaml",
            ROOT / "CHANGELOG.d/swamp_family_pieces_20261010.md",
            pathlib.Path(__file__),
        ]
        swamp_pipeline = ROOT / "tools/model-pipeline/swamp"
        if swamp_pipeline.exists():
            scan_paths.extend(
                p for p in swamp_pipeline.rglob("*")
                if p.is_file() and p.suffix in {".py", ".md", ".json", ".yaml", ".yml", ".txt"}
            )
        for p in scan_paths:
            if not p.exists():
                continue
            text = p.read_text(encoding="utf-8", errors="ignore")
            match = BANNED_RE.search(text)
            self.assertIsNone(
                match,
                f"Prohibited IP term found in {p.relative_to(ROOT)}",
            )

    def test_character_portraits_exist_and_valid_jpg(self):
        name_re = re.compile(r"^(?P<piece>[a-z]+)-[a-z0-9-]+?(-\d+)?\.jpg$")
        for piece, meta in EXPECTED_PIECES.items():
            jpg_path = ROOT / "assets/characters" / f"{meta['slug']}.jpg"
            self.assertTrue(jpg_path.exists(), f"Missing portrait: {jpg_path}")
            self.assertIsNotNone(name_re.match(jpg_path.name))
            raw = jpg_path.read_bytes()
            self.assertGreater(len(raw), 1024, f"Portrait too small: {jpg_path}")
            self.assertEqual(raw[:3], b"\xff\xd8\xff", f"Not a valid JPEG: {jpg_path}")

    def test_glb_models_grounding_height_and_materials(self):
        contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
        max_tris = contract["max_triangles_per_piece"]
        req_mats = set(contract["required_material_slots"])
        heights = {}

        for piece, meta in EXPECTED_PIECES.items():
            glb_path = ROOT / "assets/models/swamp" / f"{meta['slug']}.glb"
            self.assertTrue(glb_path.exists(), f"Missing GLB: {glb_path}")
            gltf = parse_glb_json(glb_path)

            mat_names = {m.get("name") for m in gltf.get("materials", [])}
            self.assertTrue(
                req_mats.issubset(mat_names),
                f"{glb_path.name} missing required materials {req_mats - mat_names}",
            )

            accessors = gltf.get("accessors", [])
            pos_mins = []
            pos_maxs = []
            total_indices = 0
            for mesh in gltf.get("meshes", []):
                for prim in mesh.get("primitives", []):
                    pos_idx = prim.get("attributes", {}).get("POSITION")
                    if pos_idx is not None:
                        acc = accessors[pos_idx]
                        if "min" in acc and "max" in acc:
                            pos_mins.append(acc["min"])
                            pos_maxs.append(acc["max"])
                    idx_acc = prim.get("indices")
                    if idx_acc is not None:
                        total_indices += accessors[idx_acc].get("count", 0)

            self.assertTrue(pos_mins, f"No POSITION accessors with min/max in {glb_path.name}")
            min_x = min(m[0] for m in pos_mins)
            min_y = min(m[1] for m in pos_mins)
            min_z = min(m[2] for m in pos_mins)
            max_x = max(m[0] for m in pos_maxs)
            max_y = max(m[1] for m in pos_maxs)
            max_z = max(m[2] for m in pos_maxs)

            tris = total_indices // 3
            self.assertGreater(tris, 100, f"Too few triangles in {glb_path.name}: {tris}")
            self.assertLessEqual(tris, max_tris, f"Triangle budget exceeded in {glb_path.name}: {tris}")

            self.assertLess(
                abs(min_y - contract["grounding_y_m"]),
                contract["grounding_tolerance_m"],
                f"{glb_path.name} not grounded at Y=0: min_y={min_y}",
            )
            self.assertAlmostEqual(
                max_y,
                meta["height_m"],
                delta=0.02,
                msg=f"{glb_path.name} height {max_y:.3f}m != target {meta['height_m']}m",
            )
            span_x = max_x - min_x
            span_z = max_z - min_z
            self.assertGreaterEqual(span_x, 0.70, f"{glb_path.name} X span too narrow: {span_x}")
            self.assertGreaterEqual(span_z, 0.70, f"{glb_path.name} Z span too narrow: {span_z}")
            heights[piece] = max_y

        self.assertLess(heights["pawn"], heights["rook"])
        self.assertLess(heights["rook"], heights["knight"])
        self.assertLess(heights["knight"], heights["bishop"])
        self.assertLess(heights["bishop"], heights["queen"])
        self.assertLess(heights["queen"], heights["king"])

    def test_swamp_family_manifest(self):
        self.assertTrue(SWAMP_MANIFEST_PATH.exists(), "Missing assets/families/swamp.json")
        manifest = json.loads(SWAMP_MANIFEST_PATH.read_text(encoding="utf-8"))
        self.assertEqual(manifest.get("id"), "swamp")
        self.assertIn("it", manifest.get("label", {}))
        self.assertIn("en", manifest.get("label", {}))
        self.assertIn("white", manifest.get("factions", {}))
        self.assertIn("black", manifest.get("factions", {}))

        pieces = manifest.get("pieces", {})
        self.assertEqual(set(pieces.keys()), set(EXPECTED_PIECES.keys()))
        for piece, expected in EXPECTED_PIECES.items():
            entry = pieces[piece]
            self.assertEqual(entry.get("slug"), expected["slug"])
            self.assertEqual(entry.get("model"), f"assets/models/swamp/{expected['slug']}.glb")
            self.assertEqual(entry.get("portrait"), f"assets/characters/{expected['slug']}.jpg")
            self.assertAlmostEqual(entry.get("height_m"), expected["height_m"], places=2)
            self.assertEqual(entry.get("attack_sig"), expected["attack_sig"])
            self.assertEqual(entry.get("victim_reaction"), "swamp_mud_poof")


if __name__ == "__main__":
    unittest.main()
