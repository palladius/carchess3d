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

# re-copy the 2D character art from the respec spec repo
sync-assets:
    cp -v {{respec}}/carlesso-family/assets/*.jpg assets/characters/

# image -> 3D with TRELLIS on HF ZeroGPU (needs HF_TOKEN). e.g. just trellis my_run ../puffin2/front.png back.png
trellis label +images:
    cd tools/model-pipeline/nbviews && UV_INDEX_URL=https://pypi.org/simple timeout 600 uv run --quiet gen_mv.py {{label}} {{images}}

# extra views (back/side/top) with Nano Banana (needs GEMINI_API_KEY; NB_MODEL to pick the model)
nb-views:
    cd tools/model-pipeline/nbviews && UV_INDEX_URL=https://pypi.org/simple timeout 600 uv run --quiet nb_views.py
