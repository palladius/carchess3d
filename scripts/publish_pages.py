#!/usr/bin/env python3
"""Build and publish a slim runtime-only `gh-pages` branch for CarChess3D.

Excludes offline model pipelines (`tools/`), blog/article assets (`article/`),
documentation screenshots (`docs/`), tests, and backup archives (`assets/*/archive/`,
`assets/battles/refs/`) so the published GitHub Pages site stays well below
GitHub Pages' 1 GB hard cap.
"""

from __future__ import annotations

import argparse
import os
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES_BUDGET_MB = 650

RUNTIME_ROOT_FILES = {
    "index.html",
    "battles.html",
    "sw.js",
    "manifest.webmanifest",
    "VERSION",
    ".nojekyll",
}

RUNTIME_ROOT_DIRS = (
    "src/",
    "vendor/",
    "showcase/",
    "assets/",
)

EXCLUDED_ASSET_PREFIXES = (
    "assets/battles/archive/",
    "assets/battles/refs/",
    "assets/models/archive/",
)


def is_pages_runtime_path(rel_posix: str) -> bool:
    """Return True iff `rel_posix` is needed by the live GitHub Pages web app."""
    if rel_posix in RUNTIME_ROOT_FILES:
        return True
    if not rel_posix.startswith(RUNTIME_ROOT_DIRS):
        return False
    if rel_posix.startswith(EXCLUDED_ASSET_PREFIXES):
        return False
    name = rel_posix.rsplit("/", 1)[-1]
    if name in (".DS_Store", "Thumbs.db") or name.endswith(".bak") or ".tmp." in name:
        return False
    return True


def git_ls_tree_head() -> list[tuple[str, str, str, int, str]]:
    """Return [(mode, type, sha, size, path), ...] for HEAD."""
    out = subprocess.run(
        ["git", "ls-tree", "-r", "-l", "-z", "HEAD"],
        cwd=ROOT,
        capture_output=True,
        check=True,
    ).stdout
    entries = []
    for rec in out.split(b"\0"):
        if not rec:
            continue
        meta, path_b = rec.split(b"\t", 1)
        parts = meta.decode("ascii").split()
        mode, obj_type, sha, size_s = parts[0], parts[1], parts[2], parts[3]
        size = int(size_s) if size_s.isdigit() else 0
        entries.append((mode, obj_type, sha, size, path_b.decode("utf-8")))
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish slim runtime-only gh-pages branch")
    parser.add_argument("--dry-run", action="store_true", help="Report size breakdown without pushing")
    parser.add_argument("--no-push", action="store_true", help="Commit local gh-pages ref without pushing")
    args = parser.parse_args()

    entries = git_ls_tree_head()
    kept = [e for e in entries if is_pages_runtime_path(e[4])]
    excluded = [e for e in entries if not is_pages_runtime_path(e[4])]

    kept_bytes = sum(e[3] for e in kept)
    excluded_bytes = sum(e[3] for e in excluded)
    kept_mb = kept_bytes / (1024 * 1024)
    excluded_mb = excluded_bytes / (1024 * 1024)

    print(f"📦 Pages runtime tree: {len(kept)} files, {kept_mb:.1f} MB (budget ≤ {PAGES_BUDGET_MB} MB)")
    print(f"🧹 Excluded non-runtime: {len(excluded)} files, {excluded_mb:.1f} MB")

    if kept_mb > PAGES_BUDGET_MB:
        print(f"❌ Pages runtime size {kept_mb:.1f} MB exceeds {PAGES_BUDGET_MB} MB budget!", file=sys.stderr)
        return 1

    if args.dry_run:
        return 0

    head_sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    version = (ROOT / "VERSION").read_text().strip() if (ROOT / "VERSION").exists() else "dev"

    with tempfile.NamedTemporaryFile(prefix="carchess_pages_idx_", delete=False) as tf:
        idx_path = tf.name
    os.unlink(idx_path)

    env = os.environ.copy()
    env["GIT_INDEX_FILE"] = idx_path
    try:
        # Ensure .nojekyll is present in the published tree
        nojekyll_sha = subprocess.run(
            ["git", "hash-object", "-w", "--stdin"],
            cwd=ROOT,
            input=b"",
            capture_output=True,
            check=True,
        ).stdout.decode().strip()

        index_lines = [f"{mode} {sha}\t{path}" for mode, _t, sha, _sz, path in kept]
        if not any(e[4] == ".nojekyll" for e in kept):
            index_lines.append(f"100644 {nojekyll_sha}\t.nojekyll")

        subprocess.run(
            ["git", "update-index", "--index-info"],
            cwd=ROOT,
            env=env,
            input=("\n".join(index_lines) + "\n").encode("utf-8"),
            check=True,
        )
        tree_sha = subprocess.check_output(["git", "write-tree"], cwd=ROOT, env=env, text=True).strip()
    finally:
        if os.path.exists(idx_path):
            os.unlink(idx_path)

    parent_args = []
    has_gh_pages = subprocess.run(
        ["git", "rev-parse", "--verify", "origin/gh-pages"],
        cwd=ROOT,
        capture_output=True,
    ).returncode == 0
    if has_gh_pages:
        parent_sha = subprocess.check_output(["git", "rev-parse", "origin/gh-pages"], cwd=ROOT, text=True).strip()
        parent_args = ["-p", parent_sha]

    msg = f"chore(pages): publish v{version} runtime site from {head_sha} ({kept_mb:.1f} MB)"
    commit_sha = subprocess.check_output(
        ["git", "commit-tree", tree_sha, *parent_args, "-m", msg],
        cwd=ROOT,
        text=True,
    ).strip()

    subprocess.run(["git", "update-ref", "refs/heads/gh-pages", commit_sha], cwd=ROOT, check=True)
    print(f"✅ Updated local gh-pages -> {commit_sha[:7]} ({kept_mb:.1f} MB)")

    if not args.no_push:
        subprocess.run(["git", "push", "origin", "gh-pages"], cwd=ROOT, check=True)
        print("🚀 Pushed gh-pages to origin!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
