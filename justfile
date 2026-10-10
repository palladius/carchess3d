set dotenv-load := false

respec := env_var_or_default("RESPEC_DIR", "~/git/respec")

# list recipes
list:
    @just -l

# sanity checks: GLB validity, asset naming, secret scan
test:
    python3 scripts/check.py

# serve the repo statically on http://localhost:8000 (service workers need localhost)
serve port="8000":
    python3 -m http.server {{port}}

# throwaway character showcase (2D + auto-rotating 3D) on http://localhost:8000/showcase/
showcase port="8000":
    @echo "👉 http://localhost:{{port}}/showcase/"
    python3 -m http.server {{port}}

# re-copy the 2D character art from the respec spec repo
sync-assets:
    cp -v {{respec}}/carlesso-family/assets/*.jpg assets/characters/

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

# test 3D model provenance and 2D source tracking
provenance:
    python3 scripts/test_provenance.py


