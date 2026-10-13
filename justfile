set dotenv-load := false

# list recipes
list:
    @just -l

# sanity checks: GLB validity, asset naming, secret scan + stdlib unit tests
test:
    python3 scripts/check.py
    python3 -m unittest discover -s tests -p "test_*.py" -v

# serve the repo statically on http://localhost:8000 (pass experiments="ToggleSkeleton,..." or use serve-debug)
serve port="8000" experiments="":
    @if [ -n "{{experiments}}" ]; then echo "🧪 Experiments URL: http://localhost:{{port}}/?experiments={{experiments}}"; else echo "👉 http://localhost:{{port}}/"; fi
    python3 -m http.server {{port}}

# serve with debug mode & ToggleSkeleton experiment enabled (?debug=1&experiments=ToggleSkeleton)
serve-debug port="8000" experiments="ToggleSkeleton":
    @echo "🛠️ Debug + Experiments URL: http://localhost:{{port}}/?debug=1&experiments={{experiments}}"
    python3 -m http.server {{port}}

# throwaway character showcase (2D + auto-rotating 3D) on http://localhost:8000/showcase/
showcase port="8000":
    @echo "👉 http://localhost:{{port}}/showcase/"
    python3 -m http.server {{port}}

# local image->3D root (ext4 loop image on the external SSD in Riccardo's setup); override with LOCAL3D_ROOT
local3d_root := env_var_or_default("LOCAL3D_ROOT", "/media/riccardo/TurboSebux/carchess3d")

# set up the local GPU environment (phase 1: Hunyuan3D-2 shape). Everything under local3d_root
local3d-setup:
    LOCAL3D_ROOT={{local3d_root}} bash tools/model-pipeline/local/setup_local.sh

# image -> untextured GLB with Hunyuan3D-2 on the local GPU. e.g. just local3d-shape tools/model-pipeline/ale/front.png ale1_hy2 --octree 512
local3d-shape image label *args:
    HF_HOME={{local3d_root}}/hf-cache TMPDIR={{local3d_root}}/tmp U2NET_HOME={{local3d_root}}/hf-cache/u2net HY3DGEN_MODELS={{local3d_root}}/hf-cache/hy3dgen LOCAL3D_ROOT={{local3d_root}} \
      {{local3d_root}}/venv-hunyuan/bin/python tools/model-pipeline/local/hunyuan_shape.py {{image}} {{label}} {{args}}

# show where the spec lives (it is in-repo now: no external respec dependency)
spec:
    @echo "📐 Spec = docs/spec/SPEC.md (idea: docs/spec/input_prompt.md)"

# image -> 3D with TRELLIS on HF ZeroGPU (needs HF_TOKEN). e.g. just trellis my_run ../puffin2/front.png back.png
trellis label +images:
    cd tools/model-pipeline/nbviews && UV_INDEX_URL=https://pypi.org/simple timeout 600 uv run --quiet gen_mv.py {{label}} {{images}}

# extra views (back/side/top) with Nano Banana (needs GEMINI_API_KEY; NB_MODEL to pick the model)
nb-views:
    cd tools/model-pipeline/nbviews && UV_INDEX_URL=https://pypi.org/simple timeout 600 uv run --quiet nb_views.py

# open a GLB model in Blender from CLI with colors and textures enabled
blender glb:
    blender --background --python-expr "import bpy; [bpy.data.objects.remove(o) for o in list(bpy.data.objects)]; bpy.ops.import_scene.gltf(filepath='{{glb}}'); [setattr(o, 'hide_viewport', True) for o in bpy.data.objects if o.type == 'ARMATURE']; bpy.ops.wm.save_as_mainfile(filepath='/tmp/preview_carchess.blend')" 2>/dev/null && blender /tmp/preview_carchess.blend

# run automated VLM & geometric QA critic on a 3D model against its 2D concept
critic glb concept:
    UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy uv run tools/model-pipeline/critic/critic_vlm.py --glb {{glb}} --concept {{concept}}

# show 3D model QA scoreboard
scores:
    python3 tools/model-pipeline/critic/scoreboard.py

# filter models that suck / fail QA (< 6.0)
shittest:
    python3 tools/model-pipeline/critic/scoreboard.py --cagare

# verify 3D models provenance and MD5 registry
provenance:
    python3 scripts/test_provenance.py

# run headless Playwright UAT playtest with video recording & visual checks
uat *args:
    UV_INDEX_URL=https://pypi.org/simple uv run --with playwright --with pillow python3 scripts/daily_uat_playtest.py {{args}}

# run full daily UAT: unit tests, headless match vs CPU Easy, video (<1 min) & create/update GHI "Gemini UAT YYYYMMDD"
daily-uat:
    just test
    just uat --publish-ghi


