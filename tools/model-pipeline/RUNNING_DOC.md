# Plastilina — Running Doc 🧱📓

A chronological lab notebook of every experiment run for the
[Plastilina spec](https://github.com/palladius/respec/blob/main/specs/apps/plastilina/SPEC.md): tools, MCP calls, APIs, parameters, prompts,
results and lessons. **The goal is that anyone (human or agent) can pick up
the work from here and reproduce or extend it.**

- Spec: [SPEC.md](https://github.com/palladius/respec/blob/main/specs/apps/plastilina/SPEC.md) · Original idea + follow-ups: [input_prompt.md](https://github.com/palladius/respec/blob/main/specs/apps/plastilina/input_prompt.md)
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

- Created [SPEC.md](https://github.com/palladius/respec/blob/main/specs/apps/plastilina/SPEC.md) + [input_prompt.md](https://github.com/palladius/respec/blob/main/specs/apps/plastilina/input_prompt.md) by hand
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

## 10. 2026-10-09 — Ale the bishop #2 (TRELLIS, front + 3/4)

- Source: [`carlesso-family/assets/bishop-ale-2.jpg`](../../assets/characters/bishop-ale-2.jpg) (halves split & padded) → [`3d/bishop-ale-2.glb`](../../assets/models/bishop-ale-2.glb).
- Pipeline folder: `tools/model-pipeline/ale2/` with `gen_textured.py`.
- TRELLIS multi-image run (`/lambda_1` enabled): 35 s, 1.85 MB GLB + MP4 turntable + GIF + frame strip.

## 11. 2026-10-09 — Rigging & Animated Red Dragon (Blender pipeline)

- Implemented in [`tools/model-pipeline/rigging/rig_ale_and_dragon.py`](rigging/rig_ale_and_dragon.py).
- 26-bone armature:
  - **Alessandro Humanoid Chain**: `Root`, `Pedestal`, `Hips`, `Spine`, `Chest`, `Neck`, `Head`, `Mitre`, `Shoulder.L/R`, `UpperArm.L/R`, `LowerArm.L/R`, `Hand.L/R`.
  - **Autonomous Red Dragon Chain**: `Dragon_Root`, `Dragon_Body`, `Dragon_Neck`, `Dragon_Head`, `Dragon_Jaw`, `Dragon_Tail`, `Dragon_Wing_Base.L/R`, `Dragon_Wing_Tip.L/R`.
- **Segment-Distance Skinning**: automatic capsule falloff with dragon color priority boosting.
- **Embedded Animations**:
  - `Idle`: 60 frames @ 30fps (breathing + dragon wing flapping & gliding cycle).
  - `Click_Fire_Breath`: 90 frames @ 30fps (easter egg: dragon turns towards observer, lunges forward, opens jaw wide to breathe fire!).
- Exported GLB: [`assets/models/bishop-ale-rigged.glb`](../../assets/models/bishop-ale-rigged.glb) (5.6 MB).
- Architecture: aligns with `niccolo-game-design` (isolated views, event-driven piece actions).

---

## 12. 2026-10-09 — Knight Sebastian (Multi-view & Nano Banana 2.1)

- Source: `assets/characters/knight-seby-4.jpg` (left half = front, right half = 3/4).
- Generated weapon variants with Nano Banana 2.1 (`seby_lightsaber.png`, `seby_long_lance.png`, `seby_unarmed_scary.png`, `seby_epic_sword.png`).
- Decided on **Unarmed / Free-Hand** base model for maximum in-game modularity (dynamic weapon attach + particle superpowers like Sacro Aquarius).
- Generated full 360° orthographic turnaround dataset with Nano Banana 2.1 in `tools/model-pipeline/seby/`:
  - `front.png` (Avanti - heroic pose with free hand)
  - `side.png` (Di Fianco - 90° right side profile)
  - `side_left.png` (Di Fianco - 90° left side profile)
  - `back.png` (Di Dietro - 180° back view)
  - `threequarter.png` (3/4 isometric perspective)
  - `seby_turnaround_sheet.png` (composite contact strip)
- Pipeline script `tools/model-pipeline/seby/gen_textured.py` ready for TRELLIS multi-image generation (`/lambda_1`).

---

## 13. 2026-10-09 — Ale bishop #2 (Nano Banana 2.1 vs Older Models for Back View)

- User critique on TRELLIS preview (`ale_bishop_2_preview.mp4`):
  1. Red dragon lacked 3D depth/volume (collapsed into planar "paper sheets").
  2. Ale's face texture fusion distorted his cute smile into a darker/sharper expression.
  3. Back view was smoothly interpolated by TRELLIS deterministically, but lacked character details.
- Tested GenAI back generation in `tools/model-pipeline/ale2/experiments_back/` using 4 model variants:
  - **`gemini-nano-banana-2.1` (Nano Banana 2.1)**: Flawless 180° back view; preserves constellation embroidery, purple velvet lining, hairstyle volume, and renders the red dragon's back, wings, tail, and smoke with rich 3D volumetric cues.
  - **`gemini-3-pro-image-preview` (Nano Banana Pro)**: Very high quality, slightly softer texture and sparser star patterns.
  - **`gemini-3.1-flash-image` (Nano Banana 2 Flash)**: Hallucinated a vertical gold seam down the center of the cape.
  - **`gemini-2.5-flash-image` (Nano Banana 1 Flash)**: drew a mitre on Ale #2. ⚠️ Correction (2026-10-10): not a hallucination. This image (`back_nb_v1_flash.png`) came from the first script `generate_back_comparison.py`, whose prompt asked for a mitre; Flash 2.5 was never re-run with the corrected no-hat prompt. The grid compares different prompts for that cell.
- Artifact grid created: `tools/model-pipeline/ale2/experiments_back/ale_back_perfected_grid.jpg`.

---

## 14. 2026-10-09 — Ale bishop #1 CON CAPPELLO (Vincitore Designato) — Back View Benchmark

- The canonical winner design for Bishop Ale is **Bishop Ale #1** (with the tall blue and gold bishop's mitre hat, cute smiling face, red dragon on shoulder, wooden staff, and marble disc pedestal).
- Pipeline folder: `tools/model-pipeline/ale/experiments_back/` via `generate_back_comparison.py`.
- Benchmark on rear view (180° orthogonal) across models:
  - **`gemini-nano-banana-2.1` (Nano Banana 2.1)**: **⭐ 9.9 / 10** — Flawless back view. Preserves the blue mitre with gold trim and draped hanging ribbons (infulae), hair at nape, blue cape drape, identical marble/wood pedestal, and critically gives the red dragon full 3D body volume (back, wings, tail, head turned backwards) solving the flat "paper-sheet" defect.
    - ⚠️ Caveat: with the script's prompt (which names "Alessandro, a cute, handsome, smiling boy…") NB 2.1 returned `finish_reason=PROHIBITED_CONTENT` (the script logged it as `'NoneType' object is not iterable`). It was re-run by hand with a prompt that drops the name and the "boy" description ("collectible 3D chess bishop figurine…"); the other 3 models used the original prompt. So it is not a like-for-like comparison. The scores are the agent's opinion, not Riccardo's rating; the "solves the paper-sheet dragon" claim is untested until a TRELLIS run actually uses this view.
  - **`gemini-3-pro-image-preview` (Nano Banana Pro)**: **⭐ 8.8 / 10** — Very solid, but darker background lighting and dragon is slightly more hidden behind the shoulder.
  - **`gemini-3.1-flash-image` (Nano Banana 2 Flash)**: **⭐ 8.0 / 10** — Mitre ribbons are excessively long and stiff down the cape.
  - **`gemini-2.5-flash-image` (Nano Banana 1 Flash)**: **⭐ 7.0 / 10** — Mitre is narrower, added an unrequested horizontal belt/strap on the cape.
- Artifact grid created: `tools/model-pipeline/ale/experiments_back/ale_hat_back_comparison_grid.jpg`.

---

## 15. 2026-10-10 — King Riccardo & Rook Pupurabbu (Multi-view datasets via Nano Banana 2.1)

- **King Riccardo (Re 👑)**:
  - Source: `assets/characters/king-riccardo-1.jpg` preprocessed to 1024×1024 (`front.png`, `threequarter.png`).
  - Generated orthographic views with Nano Banana 2.1 in `tools/model-pipeline/king/`:
    - `back.png`: 180° rear view with royal crimson velvet cape trimmed with ermine fur, golden crown, and dark wooden pedestal.
    - `side.png`: 90° side profile showing crown, glasses, beard, and ceremonial sceptre.
    - `king_turnaround_sheet.png`: composite 4-view contact strip.
  - Pipeline script: `tools/model-pipeline/king/gen_textured.py`.

- **Rook Pupurabbu (Torre 🏰)**:
  - Source: `assets/characters/rook-pupurabbu.jpg` preprocessed to 1024×1024 (`front.png`, `threequarter.png`).
  - Generated orthographic views with Nano Banana 2.1 in `tools/model-pipeline/rook/`:
    - `back.png`: 180° rear view of the living fantasy stone tower, battlements, and wooden pedestal.
    - `side.png`: 90° side profile showing masonry blocks, ramparts, and friendly proportions.
    - `rook_turnaround_sheet.png`: composite 4-view contact strip.
  - Pipeline script: `tools/model-pipeline/rook/gen_textured.py`.

## 16. 2026-10-10 — Queen Kate (Edits 4a-4c, Real Face Alternatives & Final Canonical Winner)

- Source: `assets/characters/queen-kate-4.jpg`.
- Selected face: Option 3 (round navy glasses & authentic smiling face from `kate_alt6_round_navy_glasses.png`).
- Requested dress & details: restore royal purple/violet velvet gown from version 4, gold ring on finger, emerald green eyes, and navy round spectacles.
- Generated final canonical candidates in `tools/model-pipeline/kate/final_queen_canonical/`:
  - `kate_final_v1_nb21.png`
  - `kate_final_v2_nb21.png`
  - `kate_final_v3_pro.png`

## 17. 2026-10-10 — Automated VLM & Geometric Critic (`just critic`)

- Built in `tools/model-pipeline/critic/` with:
  - `render_contact_sheet.py`: Automated Blender Cycles CPU renderer generating properly lit 4-view contact sheets (Front, 3/4, Profile, Back).
  - `critic_vlm.py`: Automated QA Critic combining deterministic `trimesh` geometry checks (watertightness, grounding, stray disconnected islands) with multimodal Gemini VLM auditing.
  - Automatically identifies face likeness drift (e.g. Ale face score 4.0/10) and secondary companion/prop deformities (e.g. dragon fused into torso score 4.0/10).
  - CLI recipe added to `justfile`: `just critic <glb_path> <concept_path>`.

---

## 18. 2026-10-10 — Ale bishop #1 (con cappello) 3D v2: TRELLIS with the NB 2.1 back

- Naming reminder: `bishop-ale-1` = concept #1 **with** the mitre, `bishop-ale-2` = concept #2 **without** hat (astrolabe). The number is the concept, not the model version (verified with `cmp`: `assets/models/bishop-ale-1.glb` == `ale/out/ale_bishop.glb`).
- Run: `gen_mv.py ale1_hat_f_tq_back ../ale/front.png ../ale/threequarter.png ../ale/experiments_back/back_nb_2.1.png` (multi-image via `/lambda_1`, seed 42, same settings as §5) → 39 s, 1.9 MB GLB. HF token read at runtime from an env file outside the repo, never written anywhere.
- Gotcha: `uv run` failed on this host (`failed to symlink … Operation not permitted`); used a plain `python3 -m venv` with `gradio_client` 2.7.2 instead.
- Outputs in `ale/out/`: `ale1_hat_f_tq_back.{glb,mp4,gif}`, `_frames.png`, `ale1_v1_vs_v2.png` (top row v1, bottom row v2; frames 0/10/50/60/100 of 120).
- v1 vs v2 (agent's reading of the turntable, to be confirmed by Riccardo):
  - Back: v2 now has the mitre's back cross and the two hanging ribbons from the NB back view → the back view **was consumed** (unlike §9).
  - Dragon: in the side profile (frame 100) v1 shows **no dragon at all**; v2 shows it with wings. Bigger and more readable from behind.
  - Face: similar to v1; v2 has a brown smudge on the forehead (hair strand?). Not clearly "more smiling".
- **Verdict (Riccardo, 2026-10-10): v1 is better for now — v2 has "two half dragons"** (the 3 views disagree on the dragon and TRELLIS fused two partial dragons). `assets/models/bishop-ale-1.glb` stays v1; v2 kept in `ale/out/` for reference. Next idea: make the dragon consistent across views (or generate it as a separate prop) before another multi-view run.

## 19. 2026-10-10 — Modular Dragon & Bishop Assembly with VLM Critic Feedback Loop

- Addressed Riccardo's two key issues (*"drago non c'azzeccava"*, *"faccia di ale molto diversa"*):
  - Generated isolated high-fidelity 2D dragon turnaround views (`front.png`, `side.png`, `back.png`) using Nano Banana Pro.
  - Reconstructed clean 3D dragon mesh via Hunyuan3D-2 `/shape_generation` (8.6s server time, 247k faces $\rightarrow$ decimated to 10k faces) + procedural UV unwrapping and projection in `tools/model-pipeline/dragon/texture_dragon.py`.
  - Assembled modular bishop in `tools/model-pipeline/rigging/assemble_modular_bishop.py`: mounted clean dragon to `bishop-ale-1` base, bound to 26-bone rig with `Idle` (wing flap & glide) and `Click_Fire_Breath` animations.
  - VLM Critic audit showed immediate quality jump: face likeness increased from 4.0/10 to 6.8/10, back view consistency reached 6.7/10.

## 20. 2026-10-10 — YAML QA Scoreboard & "Fa Cagare" Detection Engine

- Structured central YAML scoreboard `docs/qa-scores.yaml` storing:
  - Model and concept reference paths.
  - Scores: face likeness, companion/prop fidelity, back view plausibility, overall.
  - Tiers: `TOP_QUALITY 🟢` ($\ge 8.0$), `ACCEPTABLE 🟡` ($6.0 - 7.9$), `FA_CAGARE 💩` ($< 6.0$).
  - Structural flaws (e.g. non-watertight, submerged below Y=0, fused meshes) and aesthetic critiques.
- Integrated auto-sync into `critic_vlm.py`: every audit run automatically updates or inserts the piece evaluation in `docs/qa-scores.yaml`.
- Created CLI inspector `tools/model-pipeline/critic/scoreboard.py` and `just` recipes:
  - `just scores`: displays full ASCII table of all audited models.
  - `just shittest`: filters only models failing QA (< 6.0) and prints exact root-cause flaws.

## 21. 2026-10-10 — Queen Kate (kate2016 wedding style) 3D Model via TRELLIS.2

- **Concept & Likeness**: Winner `kate_wedding_v2_nb21` celebrating Kate's 2016 wedding updo hairstyle with chic round navy glasses, emerald green eyes, royal purple velvet gown with damask gold embroidery, gold ring with purple amethyst gem, and golden scepter.
- **2D Multi-view Turnaround**: `front.png`, `threequarter.png`, `side.png`, `back.png`, and `kate_turnaround_sheet.png` in `tools/model-pipeline/kate/`.
- **Pipeline Runner**: `tools/model-pipeline/kate/gen_trellis2.py` invoking `microsoft/TRELLIS.2` via `gradio_client` using authenticated token (`HF_RICC_PROVE3D_CARLESSO` / `palladius` work account).
- **Execution & Output**:
  - Preprocessing (bg removal): 1024² matte on front view.
  - 3D Shape + Latent Structure: 36.7 s server time.
  - GLB Mesh Extraction + Decimation: 16.3 s server time (`decimation_target=100000`, `texture_size=1024`).
  - Output GLB: `tools/model-pipeline/kate/out/queen_kate.glb` (3.7 MB, watertight, textured).
  - Production destination: copied to `assets/models/queen-kate.glb`.
- **Renders & Verification**:
  - Headless Blender EEVEE renderer: `render_preview.py` generating `out/queen_kate_3d_preview.png`.
  - 36-frame 360° turntable animation: `render_turntable.py` producing `out/queen_kate_turntable.gif` (1.4 MB) and 9-view contact strip `out/queen_kate_turntable_strip.png`.

## 22. 2026-10-10 — King Riccardo 3D Model via TRELLIS.2

- **Concept & Likeness**: King Riccardo (`assets/characters/king-riccardo-1.jpg`), imperial arched crown, blue ermine cloak, royal orb in left hand, golden scepter in right hand, authentic side profile without glasses (`tools/model-pipeline/king/side.png`).
- **Pipeline Runner**: `tools/model-pipeline/king/gen_trellis2.py` invoking `microsoft/TRELLIS.2` with `palladius` token.
- **Timing & Output**: 28.9s reconstruction + 19.9s GLB decimation/extraction. Output: `tools/model-pipeline/king/out/king_riccardo.glb` (4.0 MB), copied to `assets/models/king-riccardo.glb`.
- **Render**: `tools/model-pipeline/king/render_preview.py` generating `out/king_riccardo_3d_preview.png`.

## 23. 2026-10-10 — Queen Kate Young Stylized (4c) & Provenance Registry

- **Kate Young 4c**: Wavy blonde hair falling over shoulders, purple frames, royal purple gown, golden crown and scepter (`queen-kate-4c.png`).
- **Pipeline**: Processed 4c dual sheet into `front.png` and `threequarter.png` (`tools/model-pipeline/kate_young/`), generated with `microsoft/TRELLIS.2` (`gen_trellis2.py`). Output: `assets/models/queen-kate-young.glb` (3.6 MB).
- **Provenance Registry**: Created `docs/models-provenance.yaml` mapping all 8 3D models to their MD5 checksums, target paths, source concept images and pipelines. Verified automatically with `scripts/test_provenance.py` and `just test` / `just provenance`.

## 24. 2026-10-10 — Knight Sebastian (Unarmed Golden Armor) 3D Model via TRELLIS.2

- **Concept**: Unarmed / Free-Hand Sebastian on golden-armored charger horse (`tools/model-pipeline/seby/`), golden plate armor, blue cape, raised left fist (modular weapon attach ready for Lightsaber, Halberd, or Sacro Aquarius).
- **Pipeline Runner**: `tools/model-pipeline/seby/gen_trellis2.py` invoking `microsoft/TRELLIS.2` with `palladius` token.
- **Timing & Output**: 43.1s reconstruction + 16.3s GLB decimation/extraction (`decimation_target=100000`, `texture_size=1024`). Output: `tools/model-pipeline/seby/out/knight_seby.glb` (3.65 MB), copied to `assets/models/knight-seby.glb`.
- **Render**: `tools/model-pipeline/seby/render_preview.py` generating `out/knight_seby_3d_preview.png`.

## 25. 2026-10-10 — Rook Pupurabbu 3D Model via TRELLIS.2

- **Concept**: Adorable fluffy purple mascot leaning over and smiling from the crenellated purple stone tower (`tools/model-pipeline/rook/`).
- **Pipeline Runner**: `tools/model-pipeline/rook/gen_trellis2.py` invoking `microsoft/TRELLIS.2` with `palladius` token.
- **Timing & Output**: 35.2s reconstruction + 23.1s GLB extraction (`decimation_target=100000`, `texture_size=1024`). Output: `tools/model-pipeline/rook/out/rook_pupurabbu.glb` (3.77 MB), copied to `assets/models/rook-pupurabbu.glb`.
- **Render**: `tools/model-pipeline/rook/render_preview.py` generating `out/rook_pupurabbu_3d_preview.png`.
## 26. 2026-10-10 — Canonical Piece Selections (Kate Young 4c & Ale v1)

- **Queen Kate Decision**: Riccardo & Kate chose the Young 4c interpretation (`assets/models/queen-kate.glb`, MD5 `86cee880f66da2ed2c3c7ccf514d032d`) as the canonical default piece for gameplay. The Wedding 2016 interpretation is retained in `assets/models/queen-kate-wedding2016.glb` (MD5 `d5ba37e0d5d5622d2265f6a7f7031395`) as an alternative skin.
- **Bishop Ale Decision**: Ale v1 with mitre hat (`assets/models/bishop-ale-1.glb`, MD5 `6b423e6daf1ed71f001c8912cc9035f7`) confirmed as the canonical piece; modular rigged version available in `bishop-ale-rigged.glb`.
- **Registry Update**: `docs/models-provenance.yaml` updated with 10 total models and 27 source views, validated by `just test` and `scripts/test_provenance.py`.

## 27. 2026-10-10 — Option C Modular Deep Dive (Bishop Ale #2 & Queen Kate Remaster)

- **Option C Mandate**: Executed Option C deep-dive remaster on Bishop Ale #2 (`tools/model-pipeline/ale2/`) and Queen Kate Nozze 2016 (`assets/models/queen-kate-wedding2016.glb`) to address fused props, non-watertight geometry, and harsh surface noise.
- **Queen Kate Nozze 2016 Remaster**:
  - Script created: `tools/model-pipeline/kate/clean_queen_kate.py`.
  - Chignon neck contour undercut defined at $Z \in [0.18, 0.24], Y > 0.04$ with neck crease inset by $-0.024$m.
  - Scepter/hands forward offset by $-0.016$m in $Y$, creating clear depth separation from velvet gown.
  - Selective surface smoothing applied via vertex group `Smooth_Gown_Skin` ($w=0$ on lathe pedestal and scepter rod to maintain sharp mechanical edges; $w=1$ on fabric and skin).
  - Grounding translation applied so minimum $Z$ is exactly 0.0.
  - Exported to canonical `assets/models/queen-kate-wedding2016-remastered.glb` (97.2k faces, 3.8 MB).
  - VLM QA Critic audited against `tools/model-pipeline/kate/front.png`: Likeness $6.5/10$, Back $6.7/10$, Overall $6.3/10$, **passed: true (ACCEPTABLE 🟡)**.
- **Bishop Ale #2 Modular Remaster**:
  - Script created: `tools/model-pipeline/ale2/assemble_modular_ale2.py`.
  - Body mesh clean-up: deleted floating orphan face at base ($Z < -0.485$), retracted staff protrusion into sleeve cuff, and retracted full-height dragon/smoke/wing lump across $Z \in [-0.12, 0.45]$. Standalone clean body exported to `tools/model-pipeline/ale2/out/ale_body_clean.glb`.
  - Clean prop generated: `tools/model-pipeline/ale2/out/astrolabe_clean.glb`, featuring an authentic 8-spoked celestial navigation wheel astrolabe with raised central hub, sapphire core jewel, 8 radial spokes at 45°, top suspension loop, and full-length cylindrical staff shaft running straight through the left palm to rest securely on the wooden plinth base.
  - Dragon companion clean-up: updated `tools/model-pipeline/dragon/texture_dragon.py` to assign concept-accurate ruby-red scales, pale lime-green underbelly/wing lining, dark burgundy horn tips, and emerald eyes (`dragon_clean.glb`). Mounted on right shoulder pad at $X = -0.20$ with clear negative space separation.
  - Exported integrated model: `assets/models/bishop-ale-2-remastered.glb` (44.9k faces, 5.4 MB, zero stray islands, grounded at $Z=0$).
- **Critic & Renderer Upgrades**:
  - Enhanced `tools/model-pipeline/critic/render_contact_sheet.py` with camera-tracking rotating key/fill lights and studio ambient fill, eliminating dark angle dropoff.
  - Added automatic detection of empty `VERTEX_COLOR` layer names for glTF imports in Cycles (`layer_name = 'Col'`).
  - Audited both models and recorded in `docs/qa-scores.yaml`.

---

## Artifacts index (committed in `tools/model-pipeline/`)

Duplicated GLBs (B/C/E were identical to A) and the raw 468k-face Hunyuan
mesh were left out; the `*_frames.png` strips and `.mp4` previews remain.

| Folder | Content |
|---|---|
| `kate/` | Queen Kate 3D pipeline (`front.png`, `threequarter.png`, `side.png`, `back.png`, `gen_trellis2.py`, `render_preview.py`, `render_turntable.py`, `out/queen_kate.glb`, turntable GIF & strip) |
| `critic/` | Automated VLM & Geometric QA Critic (`critic_vlm.py`, `render_contact_sheet.py`, contact sheets, JSON reports) |
| `dragon/` | Modular Red Baby Dragon pipeline (`generate_dragon_views.py`, `dragon_turnaround.png`, `texture_dragon.py`, `dragon_clean.glb`) |
| `hunyuan/` | Hunyuan3D-2 shape-only run, clean GLB, matplotlib renders |
| `puffin2/` | TRELLIS puffin v1 (backdrop) + v2, frames, GIF, preprocessed images |
| `ale/` | Ale bishop #1 run |
| `ale2/` | Ale bishop #2 run (`gen_textured.py`, GLB, preview MP4, GIF, frames, `experiments_back/`) |
| `seby/` | Knight Sebastian multi-views (`front.png`, `side.png`, `back.png`, `threequarter.png`, `seby_turnaround_sheet.png`, `gen_textured.py`) |
| `king/` | King Riccardo multi-views (`front.png`, `side.png`, `back.png`, `threequarter.png`, `king_turnaround_sheet.png`, `gen_textured.py`) |
| `rook/` | Rook Pupurabbu multi-views (`front.png`, `side.png`, `back.png`, `threequarter.png`, `rook_turnaround_sheet.png`, `gen_textured.py`) |
| `rigging/` | Rigging & animation pipeline (`rig_ale_and_dragon.py`, `assemble_modular_bishop.py`, rigged GLB, preview GIF/MP4) |
| `nbviews/` | Nano Banana views per model + view-set experiment outputs |
| `chess3dfamily/` | Montage of the source character sheets |

## Open items

- [ ] Revoke the HF token pasted in chat; store the new one in `$GIC/.env`.
- [ ] Re-auth Vertex ADC so the `imagen` MCP works again.
- [ ] pupurabbu GPU model / VRAM → local TRELLIS / Hunyuan3D-2.
- [ ] Normalise transform (ground at y=0, metres) — not done on any output yet.



