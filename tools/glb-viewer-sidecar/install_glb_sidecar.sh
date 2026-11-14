#!/usr/bin/env bash
set -euo pipefail

# Resolve physical directory of this script (even when invoked through a symlink)
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd -P "$SCRIPT_DIR/.." && pwd)"
DEST_DIR="${HOME}/.gemini/config/sidecars/glb-viewer"
PLUGIN_SIDECAR_DIR="${HOME}/.gemini/config/plugins/palladius-public-goodies/sidecars/glb-viewer"
SKILLS_DEST="${HOME}/.gemini/config/skills"
LEGACY_SKILLS_DEST="${HOME}/.gemini/skills"

if [[ ! -f "$SCRIPT_DIR/main.mjs" || ! -f "$SCRIPT_DIR/sidecar.json" ]]; then
  echo "❌ Error: main.mjs or sidecar.json not found in $SCRIPT_DIR" >&2
  exit 1
fi

install_into_dir() {
  local target_dir="$1"
  if [[ -L "$target_dir" ]]; then
    rm -f "$target_dir"
  fi
  mkdir -p "$target_dir/vendor"
  ln -f "$SCRIPT_DIR/sidecar.json" "$target_dir/sidecar.json"
  ln -f "$SCRIPT_DIR/main.mjs" "$target_dir/main.mjs"
  if [[ -d "$SCRIPT_DIR/vendor" ]]; then
    for f in "$SCRIPT_DIR"/vendor/*.js; do
      [[ -f "$f" ]] && ln -f "$f" "$target_dir/vendor/$(basename "$f")"
    done
  fi
}

# 1. Install into ~/.gemini/config/sidecars/glb-viewer
install_into_dir "$DEST_DIR"

# 2. Install into enabled plugin ~/.gemini/config/plugins/palladius-public-goodies/sidecars/glb-viewer
#    Antigravity 2.28+ automatically hot-starts UI sidecars placed inside an enabled plugin's sidecars/ folder!
if [[ -d "${HOME}/.gemini/config/plugins/palladius-public-goodies" ]]; then
  install_into_dir "$PLUGIN_SIDECAR_DIR"
fi

mkdir -p "$SKILLS_DEST" "$LEGACY_SKILLS_DEST"
ln -sfn "$SKILL_DIR" "$SKILLS_DEST/antigravity-glb-viewer"
ln -sfn "$SKILL_DIR" "$LEGACY_SKILLS_DEST/antigravity-glb-viewer"

echo "✅ Installed Antigravity GLB 3D Viewer sidecar:"
echo "   - $DEST_DIR"
echo "   - $PLUGIN_SIDECAR_DIR (auto-started by Antigravity via palladius-public-goodies plugin!)"
echo "👉 Click any .glb / .gltf file link in Antigravity to view it spinning in 360°!"
