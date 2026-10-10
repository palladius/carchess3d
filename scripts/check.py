#!/usr/bin/env python3
"""Stdlib-only sanity checks for carchess3d (run by `just test`).

1. Every .glb is a valid glTF 2.0 binary (magic, version, declared length).
2. Every character image follows <piece>-<character>[-N].jpg.
3. No secrets or internal paths are committed.
"""
import pathlib
import re
import struct
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PIECES = {"king", "queen", "bishop", "knight", "rook", "pawn"}
SECRET_RE = re.compile(
    rb"hf_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|gh[op]_[A-Za-z0-9]{20,}|/usr/local/google"
)
TEXT_EXT = {".md", ".py", ".log", ".json", ".txt", ".toml", ".yaml", ".yml", ".js", ".html", ""}
failures = []


def check_glb(path):
    data = path.read_bytes()
    if len(data) < 12:
        return "too short"
    magic, version, length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF":
        return f"bad magic {magic!r}"
    if version != 2:
        return f"glTF version {version}"
    if length != len(data):
        return f"declared {length} B != actual {len(data)} B"
    return None


glbs = sorted(p for p in ROOT.rglob("*.glb") if ".git" not in p.parts)
for p in glbs:
    if err := check_glb(p):
        failures.append(f"GLB {p.relative_to(ROOT)}: {err}")

name_re = re.compile(r"^(?P<piece>[a-z]+)-[a-z0-9-]+?(-\d+)?\.jpg$")
chars = sorted((ROOT / "assets/characters").glob("*"))
for p in chars:
    m = name_re.match(p.name)
    if not m or m["piece"] not in PIECES:
        failures.append(f"bad character asset name: {p.name}")

def committable_files():
    """Tracked + untracked-but-not-ignored files: what could end up in a commit."""
    try:
        out = subprocess.run(
            ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
            cwd=ROOT, capture_output=True, check=True,
        ).stdout
        return [ROOT / f for f in out.decode().split("\0") if f]
    except (OSError, subprocess.CalledProcessError):  # no git: fall back to everything
        return [p for p in ROOT.rglob("*") if ".git" not in p.parts and "private" not in p.parts]


for p in committable_files():
    if not p.is_file() or p.suffix not in TEXT_EXT:
        continue
    if p.name == "check.py":
        continue
    if SECRET_RE.search(p.read_bytes()):
        failures.append(f"possible secret / internal path in {p.relative_to(ROOT)}")

# 4. Provenance registry verification
prov_file = ROOT / "docs/models-provenance.yaml"
prov_count = 0
if prov_file.exists():
    import hashlib
    current_target = None
    expected_md5 = None
    for line in prov_file.read_text().splitlines():
        line = line.strip()
        if line.startswith("target_path:"):
            current_target = line.split(":", 1)[1].strip().strip('"\'')
        elif line.startswith("md5:") and current_target:
            expected_md5 = line.split(":", 1)[1].strip().strip('"\'')
            t_path = ROOT / current_target
            if not t_path.exists():
                failures.append(f"provenance target missing: {current_target}")
            else:
                real_md5 = hashlib.md5(t_path.read_bytes()).hexdigest()
                if real_md5 != expected_md5:
                    failures.append(f"provenance MD5 mismatch for {current_target}: expected {expected_md5}, got {real_md5}")
                else:
                    prov_count += 1
            current_target = None
            expected_md5 = None

print(f"🧪 {len(glbs)} GLB, {len(chars)} character images, {prov_count} provenance models checked")
if failures:
    print("❌ " + "\n❌ ".join(failures))
    sys.exit(1)
print("✅ all good")
