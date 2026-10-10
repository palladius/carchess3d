#!/usr/bin/env python3
"""Test provenance registry: verifies all models and sources exist and MD5 hashes match."""
import hashlib
import sys
from pathlib import Path
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = REPO_ROOT / "docs/models-provenance.yaml"


def file_md5(p: Path) -> str:
    h = hashlib.md5()
    with open(p, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def main():
    if not REGISTRY_PATH.exists():
        print(f"❌ Registry file not found: {REGISTRY_PATH}")
        sys.exit(1)

    with open(REGISTRY_PATH) as f:
        data = yaml.safe_load(f)

    models = data.get("models", [])
    print(f"🔍 Validating {len(models)} 3D models in provenance registry...")

    errors = 0
    checked_models = 0
    checked_sources = 0

    for m in models:
        checked_models += 1
        m_id = m.get("id")
        target_path = REPO_ROOT / m.get("target_path")
        expected_md5 = m.get("md5")

        if not target_path.exists():
            print(f"❌ [{m_id}] Target model missing: {m.get('target_path')}")
            errors += 1
            continue

        real_md5 = file_md5(target_path)
        if expected_md5 and real_md5 != expected_md5:
            print(f"❌ [{m_id}] MD5 mismatch for {m.get('target_path')}: expected {expected_md5}, got {real_md5}")
            errors += 1
        else:
            print(f"  ✅ Model: {m.get('target_path')} (MD5: {real_md5})")

        # Check concept sources
        for src in m.get("concept_sources", []):
            checked_sources += 1
            src_path = REPO_ROOT / src.get("path")
            src_md5 = src.get("md5")

            if not src_path.exists():
                print(f"❌ [{m_id}] Source image missing: {src.get('path')}")
                errors += 1
                continue

            if src_md5:
                real_src_md5 = file_md5(src_path)
                if real_src_md5 != src_md5:
                    print(f"❌ [{m_id}] Source MD5 mismatch for {src.get('path')}: expected {src_md5}, got {real_src_md5}")
                    errors += 1

    if errors > 0:
        print(f"\n❌ Provenance check failed with {errors} error(s).")
        sys.exit(1)
    else:
        print(f"\n✨ All {checked_models} models and {checked_sources} sources validated successfully!")


if __name__ == "__main__":
    main()
