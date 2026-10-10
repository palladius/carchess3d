#!/usr/bin/env bash
# Local image→3D environment (phase 1: Hunyuan3D-2 shape only, no CUDA compilation).
#
# Everything lives under $LOCAL3D_ROOT (an ext4 loop image on the external SSD in
# Riccardo's setup), so nothing is written to the nearly-full system disk and deleting
# that one directory removes it all. Idempotent: re-run safely.
#
#   LOCAL3D_ROOT=/media/riccardo/TurboSebux/carchess3d bash setup_local.sh
set -euo pipefail

: "${LOCAL3D_ROOT:?set LOCAL3D_ROOT, e.g. /media/riccardo/TurboSebux/carchess3d}"
mkdir -p "$LOCAL3D_ROOT"/{hf-cache,pip-cache,tmp,repos,out}

# Keep every cache off the system disk
export HF_HOME="$LOCAL3D_ROOT/hf-cache"
export PIP_CACHE_DIR="$LOCAL3D_ROOT/pip-cache"
export TMPDIR="$LOCAL3D_ROOT/tmp"
export TORCH_HOME="$LOCAL3D_ROOT/hf-cache/torch"
export U2NET_HOME="$LOCAL3D_ROOT/hf-cache/u2net"   # rembg weights
export PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.org/simple}"

VENV="$LOCAL3D_ROOT/venv-hunyuan"
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
PY="$VENV/bin/python"
"$PY" -m pip install -q --upgrade pip wheel setuptools

# PyTorch with CUDA 12.8 wheels: first builds with Blackwell (sm_120, RTX 50xx) kernels
if ! "$PY" -c "import torch, sys; sys.exit(0 if 'sm_120' in torch.cuda.get_arch_list() else 1)" 2>/dev/null; then
  "$PY" -m pip install -q torch torchvision --index-url https://download.pytorch.org/whl/cu128
fi

REPO="$LOCAL3D_ROOT/repos/Hunyuan3D-2"
[ -d "$REPO/.git" ] || git clone --depth 1 https://github.com/Tencent/Hunyuan3D-2 "$REPO"
# Shape-gen deps only (the texture stage needs compiled CUDA extensions: phase 2)
"$PY" -m pip install -q diffusers transformers accelerate einops omegaconf trimesh pymeshlab \
  opencv-python-headless rembg onnxruntime pygltflib tqdm huggingface_hub safetensors
"$PY" -m pip install -q -e "$REPO" --no-deps

"$PY" - <<'EOF'
import torch
cap = torch.cuda.get_device_capability()
x = torch.randn(2048, 2048, device="cuda")
torch.cuda.synchronize(); (x @ x).sum().item()
print(f"✅ torch {torch.__version__} cuda {torch.version.cuda} · {torch.cuda.get_device_name()} sm_{cap[0]}{cap[1]} · matmul OK")
import hy3dgen; print("✅ hy3dgen importable")
EOF
du -sh "$LOCAL3D_ROOT"
