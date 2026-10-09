# Plastilina — Running Doc 🧱📓

A chronological lab notebook of every experiment run for the
[Plastilina spec](https://github.com/palladius/respec/blob/main/docs/llm-apps/plastilina/SPEC.md): tools, MCP calls, APIs, parameters, prompts,
results and lessons. **The goal is that anyone (human or agent) can pick up
the work from here and reproduce or extend it.**

- Spec: [SPEC.md](https://github.com/palladius/respec/blob/main/docs/llm-apps/plastilina/SPEC.md) · Original idea + follow-ups: [input_prompt.md](https://github.com/palladius/respec/blob/main/docs/llm-apps/plastilina/input_prompt.md)
- Moved here from `palladius/respec` on 2026-10-09: the chess pieces are the
  first real customer of the pipeline. Scripts live **next to their inputs and
  outputs** in `hunyuan/`, `puffin2/`, `ale/`, `nbviews/` (relative paths such
  as `../puffin2/front.png` work as-is).
- Generic image→3D tool (future, may split out): `palladius/image2model3d`

> [!CAUTION]
> **Never write secrets here.** Tokens and API keys are passed only through
> environment variables (`HF_TOKEN`, `GEMINI_API_KEY`). This repo is public.

---

## 0. How to resume (TL;DR)

```bash
# prerequisites: uv, ffmpeg; on the corp laptop use the public PyPI index
export UV_INDEX_URL="https://pypi.org/simple"
export HF_TOKEN=...          # free HF account token (read) → ZeroGPU quota
export GEMINI_API_KEY=...    # Gemini API (AI Studio) key, for Nano Banana

cd tools/model-pipeline/nbviews   # scripts live next to their outputs
# 1) image → textured 3D with TRELLIS (bg removal + N views, seed 42)
uv run gen_mv.py my_label front.png [back.png side.png ...]
# 2) extra views with Nano Banana (refs: front + 3/4)
NB_MODEL=gemini-nano-banana-2.1 uv run nb_views.py back side top
# 3) geometry checks (Critic section A) on a GLB
uv run critic_geo.py
```

Turntable GIF / contact sheet from the TRELLIS preview video (left half is
colour, right half is normals):

```bash
ffmpeg -i X.mp4 -vf "crop=512:512:0:0,select='not(mod(n\,15))',scale=320:-1,tile=8x1" -frames:v 1 X_frames.png
ffmpeg -i X.mp4 -vf "crop=512:512:0:0,fps=15,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" X.gif
```

---

## 1. 2026-10-08 — Spec written

- Created [SPEC.md](https://github.com/palladius/respec/blob/main/docs/llm-apps/plastilina/SPEC.md) + [input_prompt.md](https://github.com/palladius/respec/blob/main/docs/llm-apps/plastilina/input_prompt.md) by hand
  (repo convention: frontmatter + Problem/Goals/Non-Goals/…).
- Decisions from Riccardo (recorded in SPEC *Decisions*): local-first on
  pupurabbu (GPU) then Cloud Run + GPU; **€0 budget**, 10 min/project; v1
  skeletons VRM 1.0 + Godot humanoid (+ Mixamo names); impl repo
  `palladius/image2model3d`.
- Licence check (web search): Hunyuan3D-2 community licence excludes **EU,
  UK, South Korea** → OK in Switzerland.

## 2. 2026-10-08 — Test input: the Puffin Swiss-Guard pawn

- Source: Nano Banana turnaround sheet (front + "3/4 isometric", with
  captions), 2560×1429 →
  [`carlesso-family/assets/pawn-puffin.jpg`](../../assets/characters/pawn-puffin.jpg).
- Preprocess (Pillow): left half = front, right half = 3/4; cut bottom 14% to
  drop captions; pad to square with the background colour → `front.png`,
  `threequarter.png` (1280²).

## 3. 2026-10-08 — Hunyuan3D-2 HF Space (`tencent/Hunyuan3D-2`)

Called via `gradio_client` (`Client("tencent/Hunyuan3D-2")`, anonymous).

| Endpoint | Params | Result |
|---|---|---|
| `/generation_all` (shape + texture) | `image=front`, steps 30, guidance 5.0, seed 1234, octree 256, rembg on, chunks 8000 | ❌ server-side `NameError` (texgen broken on the Space) |
| `/shape_generation` | same | ✅ 8 s server time, `white_mesh.glb` 7 MB |

- Gotcha: returns a Gradio *update dict* `{'value': path, '__type__': 'update'}`
  instead of a plain path → unwrap.
- Mesh: 468,516 faces / 138,136 verts, **192,236 degenerate (zero-area)
  faces** → naive island count says "192k islands" (false positive).
- After `remove_degenerate`: 276,280 faces, **1 island, watertight**,
  symmetry error 1.3% of height, 9× over a 30k budget, centred at origin
  (not grounded), ~2 units tall.
- Visual: helmet, halberd, beak, pedestal recognisable; plume became two
  "bunny ears"; halberd fused to body; pedestal attached to feet.
- Software render (matplotlib, no Blender on this laptop) →
  `critic_geo.py`, `render_turntable.py`.

## 4. 2026-10-08 — Textured attempts, quota walls

| Space | Result |
|---|---|
| `trellis-community/TRELLIS` (anonymous) | ❌ "exceeded your ZeroGPU quota (120s requested vs 0s left)" |
| `tencent/Hunyuan3D-2.1` `/generation_all` | ❌ "requested GPU duration (270s) is larger than the maximum allowed" (needs PRO) |

→ Needed a (free) HF token. Note: `gradio_client` 2.x uses `token=`, not
`hf_token=`.

## 5. 2026-10-08 — TRELLIS with HF token ✅

`/start_session` → `/generate_and_extract_glb` with
`image=front`, `multiimages=[front, threequarter]`, seed 42,
ss_guidance 7.5 / 12 steps, slat_guidance 3.0 / 12 steps,
`multiimage_algo="stochastic"`, `mesh_simplify=0.95`, `texture_size=1024`.

- **v1 (no preprocessing) ❌**: the grey background was reconstructed as a
  **giant wall** behind the puffin (extents 1.0 × 0.97 × 0.49). The web UI
  mattes on upload; the API does not. → new spec check `geo.backdrop`.
- **v2 (call `/preprocess_image` + `/preprocess_images` first) ✅** — 38 s
  (⚠️ later found to be a *single-image* run, see §9):
  13,142 faces, 1024² texture, 1 island after merging UV-seam vertices,
  watertight, 1.6 MB GLB →
  [`carlesso-family/assets/3d/pawn-puffin.glb`](../../assets/models/pawn-puffin.glb).
- Critique: front very faithful; **back invented badly** (white smooth back,
  should be black head + striped uniform); plume reads as a heart from front.

## 6. 2026-10-09 — Ale the bishop (TRELLIS, front + 3/4)

- Source: [`carlesso-family/assets/bishop-ale-1.jpg`](../../assets/characters/bishop-ale-1.jpg) (no captions; halves) → [`3d/bishop-ale-1.glb`](../../assets/models/bishop-ale-1.glb).
- 33 s, 20,067 faces, 1 stray triangle, 1024² texture.
- Critique: mitre, green eyes, cape, pedestal 👍; **back plausible**; dragon
  migrated from left shoulder to chest/staff (`major`, `shape`, region
  `dragon`); face thinner in 3/4.
- Assets are public in this repo by Riccardo's choice (chess3d spec: fictional/stylised faces).

## 7. 2026-10-09 — Spec updated with 6 lessons

remove degenerate faces first · split turnaround sheets & strip captions ·
HF Spaces/ZeroGPU adapter for prototyping · separate pedestal/props before
rigging · always matte ourselves · `geo.backdrop` check.

## 8. 2026-10-09 — Nano Banana extra views (back / side / top)

**Question (Riccardo):** NB made front + 3/4 sheets. Should the reference
format be front/back instead? Do 3–4 views help or confuse the 3D model?

### 8.1 MCP attempt ❌

MCP server `imagen`, tool `nanobanana_image_generation` (accepts any model
ID, `images=[...]` refs, `aspect_ratio`, `output_directory`). Called with
`model="gemini-3-pro-image-preview"`, refs `[front.png, threequarter.png]`.
→ ❌ Vertex AI auth error `invalid_grant / invalid_rapt` (ADC needs re-auth).

### 8.2 Gemini API fallback ✅

`google-genai` with `GEMINI_API_KEY` (env), `generate_content(model, [ref1,
ref2, prompt])`, `response_modalities=["IMAGE"]`, `aspect_ratio="1:1"` →
[`nb_views.py`](nbviews/nb_views.py).

Image models listed by the API on 2026-10-09:
`gemini-2.5-flash-image` (Nano Banana) · `gemini-3-pro-image(-preview)` /
`nano-banana-pro-preview` (Nano Banana Pro) · `gemini-3.1-flash-image(-preview)`
(Nano Banana 2) · `gemini-3.1-flash-lite-image` (NB 2 Lite) ·
**`gemini-nano-banana-2.1` (Nano Banana 2.1, newest)**.

Prompts (subject + view + style, concatenated):

```text
SUBJECT: Reference images: the SAME collectible chess pawn figurine (a cute puffin dressed as a Swiss
Guard, steel morion helmet with red plume, blue-yellow-red striped uniform, brown belt, halberd held in
its right hand, standing on a round dark wooden pedestal).

BACK:  Render this exact same figurine seen from DIRECTLY BEHIND (camera rotated 180 degrees around it,
same height and distance as the front view). Show the back of the helmet and plume, the black feathered
back of the head and neck, the back of the striped uniform, the tail feathers and the back of the
pedestal. The halberd is in the figure's right hand, so from behind it appears on the RIGHT side of the
image.

SIDE:  Render this exact same figurine in a PURE SIDE PROFILE, camera exactly 90 degrees to the figure's
LEFT side, same height and distance: the beak points to the LEFT edge of the image. Show the profile of
the big orange beak, the morion helmet's curved brim and crest in profile, the plume, the side of the
striped uniform, feet and pedestal. The halberd is in the far hand, mostly behind the body.

TOP:   Render this exact same figurine seen from ABOVE: camera high, looking down at about 60 degrees
elevation from the front (bird's-eye three-quarter top view), same distance. Show the top of the morion
helmet with its crest and the red plume from above, the face foreshortened below the brim, shoulders,
the halberd tip and the round top surface of the wooden pedestal.

STYLE: Keep identical proportions, colours, materials, pedestal and lighting. Plain uniform mid-grey
studio background, soft even light, whole figurine fully visible and centred, orthographic-looking
product shot. No text, no labels, no captions, no extra objects.
```

**Nano Banana Pro results:** back ✅ excellent (black back of head, striped
uniform back, halberd on the correct side); side 🟡 closer to ~70° than a
pure 90° profile; top 🟡 only mild elevation (~25°, not 60°).

**Nano Banana 2.1 results** (`NB_MODEL=gemini-nano-banana-2.1`, same prompts):
back ✅ as good as Pro, slightly sharper; side 🟡 same ~70°; top ⚠️ higher
elevation but **rotated the subject** (beak to the right), ignoring "from the
front". → For now, no clear winner; Pro is more obedient on camera framing.

Gotcha: with both `GOOGLE_API_KEY` and `GEMINI_API_KEY` in the env the SDK
warns "Using GOOGLE_API_KEY" — pass `api_key=` explicitly.

## 9. 2026-10-09 — View-set experiment (TRELLIS, seed 42)

Same seed and settings as §5 v2; only the view set changes (NB Pro views).
Runner: [`gen_mv.py`](nbviews/gen_mv.py).

| Run | Views | Time | Faces | Verdict |
|---|---|---|---|---|
| A | front | 29 s | 13,134 | back invented (white) |
| B | front + back | 25 s | 13,104 | **identical to A** |
| C | front + side + back | 32 s | 13,176 | **identical to A** |
| E (§5 v2) | front + 3/4 | 38 s | 13,142 | **identical to A** |
| D | front + side + back + top | ❌ | | ZeroGPU quota ("try again in 4:34") |

### 🐛 Finding: the Space silently ignored the extra views

All runs looked the same, with the same white back even when given a perfect
NB back view. Reading the Space source
([`app.py`](https://huggingface.co/spaces/trellis-community/TRELLIS/blob/main/app.py),
L265 and L435–471): `is_multiimage` is a hidden `gr.State(False)` flipped
only by the *Multiple Images* tab-select handler, exposed as the parameterless
endpoint **`/lambda_1`**. Without calling it, `generate_and_extract_glb` runs
`pipeline.run(image)` (single image) and **ignores `multiimages`**.

- ⇒ §5 v2 and §6 (Ale) were also effectively **single-image** runs.
- Fix: `gen_mv.py` now calls `/lambda_1` after `/start_session` when >1 view.
- Lesson for the spec/Critic: **verify the backend actually consumed every
  view** (e.g. ablation: dropping a view must change the output).
- Re-run B2/C2/D2 in real multi-image mode: _pending quota reset (~17:35)_.

---

## Artifacts index (committed in `tools/model-pipeline/`)

Duplicated GLBs (B/C/E were identical to A) and the raw 468k-face Hunyuan
mesh were left out; the `*_frames.png` strips and `.mp4` previews remain.

| Folder | Content |
|---|---|
| `hunyuan/` | Hunyuan3D-2 shape-only run, clean GLB, matplotlib renders |
| `puffin2/` | TRELLIS puffin v1 (backdrop) + v2, frames, GIF, preprocessed images |
| `ale/` | Ale bishop run |
| `nbviews/` | Nano Banana views per model + view-set experiment outputs |
| `chess3dfamily/` | Montage of the source character sheets |

## Open items

- [ ] Revoke the HF token pasted in chat; store the new one in `$GIC/.env`.
- [ ] Re-auth Vertex ADC so the `imagen` MCP works again.
- [ ] pupurabbu GPU model / VRAM → local TRELLIS / Hunyuan3D-2.
- [ ] Normalise transform (ground at y=0, metres) — not done on any output yet.
