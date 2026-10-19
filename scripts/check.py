#!/usr/bin/env python3
"""Stdlib-only sanity checks for carchess3d (run by `just test`).

1. Every .glb is a valid glTF 2.0 binary (magic, version, declared length, VEC3 bounds).
2. Every character image follows <piece>-<character>[-N].jpg.
3. docs/floorplan.svg exists and defines canonical metric coordinates.
4. assets/battles/manifest.yaml MD5 hashes match current character art.
5. Headless core & Niccolò architecture gates (zero DOM/Three.js in src/{core,managers,ai}, <=300 LOC per manager).
6. Node unit test suite (`node --test tests/*.test.mjs`) passes 100%.
7. No secrets or internal paths are committed.
"""
import hashlib
import json
import os
import pathlib
import fnmatch
import re
import shutil
import struct
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PIECES = {"king", "queen", "bishop", "knight", "rook", "pawn"}
SECRET_RE = re.compile(
    rb"hf_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|gh[op]_[A-Za-z0-9]{20,}|/usr/local/" + rb"google|/home/[a-z_][a-z0-9_-]*/"
)
TEXT_EXT = {".md", ".py", ".log", ".json", ".txt", ".toml", ".yaml", ".yml", ".js", ".mjs", ".html", ""}
failures = []


def check_glb(path):
    data = path.read_bytes()
    if len(data) < 20:
        return "too short"
    magic, version, length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF":
        return f"bad magic {magic!r}"
    if version != 2:
        return f"glTF version {version}"
    if length != len(data):
        return f"declared {length} B != actual {len(data)} B"
    chunk_len, chunk_type = struct.unpack("<II", data[12:20])
    if chunk_type != 0x4E4F534A:  # JSON
        return "missing JSON chunk"
    try:
        gltf = json.loads(data[20 : 20 + chunk_len].decode("utf-8"))
    except Exception as exc:
        return f"invalid JSON chunk: {exc}"
    has_bounds = any(
        acc.get("type") == "VEC3" and "min" in acc and "max" in acc
        for acc in gltf.get("accessors", [])
    )
    if not has_bounds:
        return "no VEC3 min/max bounds for y=0 grounding"
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

# Check floorplan.svg
floorplan = ROOT / "docs/floorplan.svg"
if not floorplan.exists():
    failures.append("missing docs/floorplan.svg")
else:
    fp_text = floorplan.read_text()
    for token in ("8.0m", "-10.0m", "-25.0m", "y = 0.0m"):
        if token not in fp_text:
            failures.append(f"docs/floorplan.svg missing canonical metric token: {token}")

# Check assets/battles/manifest.yaml MD5 hashes
manifest_path = ROOT / "assets/battles/manifest.yaml"
if manifest_path.exists():
    manifest_text = manifest_path.read_text()
    pairs = re.findall(
        r'attacker_img:\s*"([^"]+)"\s*\n\s*attacker_md5:\s*"([a-f0-9]{32})"\s*\n\s*defender_img:\s*"([^"]+)"\s*\n\s*defender_md5:\s*"([a-f0-9]{32})"',
        manifest_text,
    )
    if len(pairs) < 36:
        failures.append(f"assets/battles/manifest.yaml has {len(pairs)} pairs (expected 36)")
    for atk_img, atk_md5, def_img, def_md5 in pairs:
        for rel_img, expected_md5 in ((atk_img, atk_md5), (def_img, def_md5)):
            img_p = ROOT / rel_img
            if not img_p.exists():
                failures.append(f"manifest.yaml references missing image: {rel_img}")
            else:
                actual_md5 = hashlib.md5(img_p.read_bytes()).hexdigest()
                if actual_md5 != expected_md5:
                    failures.append(f"stale battle MD5 for {rel_img}: expected {expected_md5}, got {actual_md5}")

# Check docs/models-provenance.yaml MD5 tracking (from main)
prov_file = ROOT / "docs/models-provenance.yaml"
prov_count = 0
if prov_file.exists():
    current_target = None
    expected_md5 = None
    for line in prov_file.read_text().splitlines():
        line = line.strip()
        if line.startswith("target_path:"):
            current_target = line.split(":", 1)[1].strip().strip("\"'")
        elif line.startswith("md5:") and current_target:
            expected_md5 = line.split(":", 1)[1].strip().strip("\"'")
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

# Check Niccolò headless core & <= 300 LOC manager rule
for folder in ("src/core", "src/managers", "src/ai"):
    dir_path = ROOT / folder
    if not dir_path.exists():
        continue
    for js_file in sorted(dir_path.glob("*.js")):
        content = js_file.read_text()
        lines = content.splitlines()
        if folder == "src/managers" and len(lines) > 300:
            failures.append(f"Manager {js_file.relative_to(ROOT)} exceeds 300 LOC ({len(lines)} lines)")
        if re.search(r"\bfrom\s+['\"]three['\"]|\bdocument\.(getElementById|querySelector|createElement)\b", content):
            failures.append(f"Headless module {js_file.relative_to(ROOT)} imports Three.js or mutates DOM directly")


def find_node():
    if path := shutil.which("node"):
        return path
    nvm_dir = pathlib.Path.home() / ".nvm/versions/node"
    if nvm_dir.exists():
        candidates = sorted(nvm_dir.glob("*/bin/node"))
        if candidates:
            return str(candidates[-1])
    return None


tests_dir = ROOT / "tests"
test_files = sorted(tests_dir.glob("*.test.mjs")) if tests_dir.exists() else []
if test_files:
    node_bin = find_node()
    if not node_bin:
        failures.append("node binary not found to run tests/*.test.mjs")
    else:
        res = subprocess.run(
            [node_bin, "--test", *[str(p.relative_to(ROOT)) for p in test_files]],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        if res.returncode != 0:
            failures.append(f"Node unit tests failed:\n{res.stdout}\n{res.stderr}")


def committable_files():
    """Tracked + untracked-but-not-ignored files: what could end up in a commit."""
    try:
        out = subprocess.run(
            ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
            cwd=ROOT,
            capture_output=True,
            check=True,
        ).stdout
        return [ROOT / f for f in out.decode().split("\0") if f]
    except (OSError, subprocess.CalledProcessError):
        return [p for p in ROOT.rglob("*") if ".git" not in p.parts and "private" not in p.parts]


for p in committable_files():
    if not p.is_file() or p.suffix not in TEXT_EXT:
        continue
    if p.name == "check.py":
        continue
    if SECRET_RE.search(p.read_bytes()):
        failures.append(f"possible secret / internal path in {p.relative_to(ROOT)}")

# --- IP safety ("Be Googley", spec IP Safety, issue #24) -------------------
# etc/ip-denylist.txt: one term per line, optional "| glob, glob" = paths where it IS allowed.
# Spaces in a term also match "_" and "-" (so "sacro acquarius" catches sacro_acquarius).
IP_EXEMPT = ("docs/", "CHANGELOG", "conductor/", ".agents/", "tools/", "ABORTED", "AGENTS.md", "GEMINI.md",
             "etc/ip-denylist.txt", "scripts/check.py", "article/")
ip_rules = []
denylist = ROOT / "etc/ip-denylist.txt"
if denylist.exists():
    for line in denylist.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        term, _, allow = line.partition("|")
        words = [re.escape(w) for w in term.strip().split()]
        rx = re.compile(r"\b" + r"[\s_-]?".join(words) + r"\b", re.IGNORECASE)
        globs = [g.strip() for g in allow.split(",") if g.strip()]
        ip_rules.append((term.strip(), rx, globs))
ip_hits = 0
for p in committable_files():
    rel = p.relative_to(ROOT).as_posix()
    if not p.is_file() or p.suffix not in TEXT_EXT or rel.startswith(IP_EXEMPT):
        continue
    text = p.read_text(encoding="utf-8", errors="ignore")
    for term, rx, globs in ip_rules:
        if any(fnmatch.fnmatch(rel, g) for g in globs):
            continue
        for m in rx.finditer(text):
            ip_hits += 1
            if ip_hits <= 30:
                line_no = text.count("\n", 0, m.start()) + 1
                failures.append(f"IP denylist '{term}' in {rel}:{line_no} → use a generic description (spec: Be Googley)")
if ip_hits > 30:
    failures.append(f"... and {ip_hits - 30} more IP denylist hits")

print(
    f"🧪 {len(glbs)} GLB, {len(chars)} character images, {prov_count} provenance models, "
    f"floorplan.svg, manifest.yaml, {len(test_files)} Node test suites, {len(ip_rules)} IP denylist terms checked"
)
if failures:
    print("❌ " + "\n❌ ".join(failures))
    sys.exit(1)
print("✅ all good")
