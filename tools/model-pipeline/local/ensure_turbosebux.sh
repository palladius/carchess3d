#!/usr/bin/env bash
# Ensure TurboSebux (600 GB ext4 volume on Samsung T7) is mounted and ready.
# Safe and idempotent.
set -euo pipefail

TURBOSEBY_MOUNT="/media/riccardo/TurboSeby"
TURBOSEBUX_MOUNT="/media/riccardo/TurboSebux"
LOOP_FILE="$TURBOSEBY_MOUNT/tmp/data/TurboSebux.ext4"

echo "🔍 Checking TurboSebux status on $(hostname)..."

# 1. Check parent Samsung T7 mount
if ! mountpoint -q "$TURBOSEBY_MOUNT"; then
  echo "⚠️ $TURBOSEBY_MOUNT is not mounted. Attempting mount via fstab..."
  sudo mount "$TURBOSEBY_MOUNT" || {
    echo "❌ Failed to mount $TURBOSEBY_MOUNT. Is Samsung T7 plugged in?"
    exit 1
  }
fi

# 2. Check loop file existence
if [ ! -f "$LOOP_FILE" ]; then
  echo "❌ Loop image file not found at $LOOP_FILE!"
  exit 1
fi

# 3. Check TurboSebux ext4 mount
if ! mountpoint -q "$TURBOSEBUX_MOUNT"; then
  echo "⚠️ $TURBOSEBUX_MOUNT is not mounted. Mounting via loop..."
  sudo mkdir -p "$TURBOSEBUX_MOUNT"
  sudo mount "$TURBOSEBUX_MOUNT" || sudo mount -o loop,noatime "$LOOP_FILE" "$TURBOSEBUX_MOUNT"
fi

# 4. Check user home symlink
if [ ! -L "$HOME/TurboSebux" ]; then
  ln -sfn "$TURBOSEBUX_MOUNT" "$HOME/TurboSebux"
fi

# 5. Report status
AVAIL=$(df -h "$TURBOSEBUX_MOUNT" | awk 'NR==2 {print $4}')
echo "✅ TurboSebux is ready and mounted at $TURBOSEBUX_MOUNT ($AVAIL free)"
echo "   Symlink: ~/TurboSebux -> $TURBOSEBUX_MOUNT"
