#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "google-genai>=1.0.0",
#   "scipy>=1.11.0",
#   "pygltflib>=1.16.0",
#   "pillow>=10.0.0",
#   "numpy>=1.24.0",
#   "python-dotenv>=1.0.0",
# ]
# ///
"""Adversarial Biometric Likeness Generator + Critic Loop for King Riccardo (`king-riccardo.glb`).

Combines:
1. `nano-banana-ricc` 5 ground-truth reference photos of Riccardo
2. Photo-Anchored Template Seeding (`photo_seeded_template.png`) from `riccardosouthafrica.png`
   harmonized by `gemini-3-pro-image-preview` (no double-exposure blending!)
3. Piecewise-Linear 3D Facial Landmark Calibration + 3D Biometric Nose/Brow/Jaw Vertex Sculpting
   + Zero-Bleed 3D Silver Hair & Side Jawline Stubble (`graft_papino_face_3d.py`)
4. Multimodal Adversarial Biometric Critic (`gemini-3.1-pro-preview`) that iteratively scores and tunes
   2D + 3D parameters until likeness converges.
"""

from __future__ import annotations

from dataclasses import asdict
from io import BytesIO
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from dotenv import dotenv_values
from google import genai
from google.genai import types
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from graft_papino_face_3d import (  # noqa: E402
    BiometricGraftParams,
    PREVIEW_PNG,
    TURNTABLE_GIF,
    dilate_rgb_outside_mask,
    graft_face_onto_king_glb,
    rasterize_view_barycentric,
    render_before_after_and_gif,
)

OUT_DIR = HERE / "out" / "adversarial_likeness"
FRONT_PNG = HERE / "front.png"
SIDE_PNG = HERE / "side.png"
TQ_PNG = HERE / "threequarter.png"
BACK_PNG = HERE / "back.png"
TURNAROUND_PNG = HERE / "king_turnaround_sheet.png"
FINAL_GLB = REPO_ROOT / "assets/models/king-riccardo.glb"
CHAR_CARD_JPG = REPO_ROOT / "assets/characters/king-riccardo-1.jpg"


def load_api_key() -> str:
    if key := os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return key
    for env_path in (REPO_ROOT / ".env", Path.home() / "git/gic/.env", Path.home() / ".env"):
        if env_path.exists():
            vals = dotenv_values(env_path)
            if key := vals.get("GEMINI_API_KEY") or vals.get("GOOGLE_API_KEY"):
                return key
    out = subprocess.run(
        ["bash", "-ic", 'printf "KEY_START:%s:KEY_END" "$GEMINI_API_KEY"'],
        capture_output=True,
        text=True,
        check=False,
    ).stdout
    if "KEY_START:" in out and ":KEY_END" in out:
        extracted = out.split("KEY_START:", 1)[1].split(":KEY_END", 1)[0].strip()
        if extracted:
            return extracted
    raise RuntimeError("GEMINI_API_KEY not found in environment or ~/.env")


def get_skill_assets_dir() -> Path:
    p1 = Path.home() / ".gemini/config/plugins/palladius-public-goodies/skills/nano-banana-ricc/assets/riccardo"
    if p1.exists():
        return p1
    return Path.home() / ".gemini/config/skills/nano-banana-ricc/assets/riccardo"


def load_riccardo_ground_truth_photos() -> list[tuple[str, Image.Image]]:
    """Load the 5 ground-truth reference photos from the `nano-banana-ricc` skill, cropped to Riccardo's face."""
    skill_assets = get_skill_assets_dir()
    specs = [
        ("ricc-pineapple-pizza.png", (0.05, 0.04, 0.65, 0.68)),
        ("riccardosouthafrica.png", (0.35, 0.30, 0.62, 0.68)),
        ("ricc-za-lake.png", (0.28, 0.46, 0.58, 0.96)),
        ("ricc-za-view-with-kids.png", (0.66, 0.26, 0.96, 0.78)),
        ("ricc-za-wine-tasting.png", (0.16, 0.26, 0.40, 0.66)),
    ]
    refs: list[tuple[str, Image.Image]] = []
    for fname, (x0, y0, x1, y1) in specs:
        p = skill_assets / fname
        if p.exists():
            im = Image.open(p).convert("RGB")
            w, h = im.size
            crop = im.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1))).resize(
                (512, 512), Image.Resampling.LANCZOS
            )
            refs.append((fname, crop))
    if not refs:
        raise RuntimeError(f"Could not find nano-banana-ricc reference photos in {skill_assets}")
    return refs


def build_photo_seeded_template(template_im: Image.Image, out_path: Path) -> Image.Image:
    """Place Riccardo's actual frontal photograph from `riccardosouthafrica.png` into the head oval
    of the King figurine so Gemini 3 Pro Image starts from 100% real Riccardo's facial geometry.
    """
    if out_path.exists():
        return Image.open(out_path).convert("RGB")
    im_sa = Image.open(get_skill_assets_dir() / "riccardosouthafrica.png").convert("RGB")
    w, h = im_sa.size
    head_crop = im_sa.crop((int(w * 0.368), int(h * 0.305), int(w * 0.588), int(h * 0.665))).rotate(
        2.2, resample=Image.Resampling.BICUBIC
    )
    target_w, target_h = 342, 384
    head_resized = head_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)

    canvas = np.asarray(template_im.resize((1024, 1024), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    patch = np.asarray(head_resized, dtype=np.float32) / 255.0

    r_p, g_p, b_p = patch[:, :, 0], patch[:, :, 1], patch[:, :, 2]
    not_vineyard_green = ~((g_p > r_p * 1.03) & (g_p > b_p * 1.08))
    yy_p, xx_p = np.meshgrid(np.arange(target_h, dtype=np.float32), np.arange(target_w, dtype=np.float32), indexing="ij")
    in_face_oval_p = (((xx_p - target_w * 0.52) / (target_w * 0.44)) ** 2 + ((yy_p - target_h * 0.50) / (target_h * 0.46)) ** 2) <= 1.0
    valid_p = not_vineyard_green & in_face_oval_p
    patch = dilate_rgb_outside_mask(patch, valid_p, iters=45)

    xx_norm = np.linspace(0.0, 1.0, target_w, dtype=np.float32)[None, :, None]
    shadow_lift = 1.0 + 0.28 * np.clip((xx_norm - 0.44) / 0.42, 0.0, 1.0)
    patch = np.clip(patch * shadow_lift, 0.0, 1.0)

    x0 = 518 - int(target_w * 0.525)
    y0 = 305 - int(target_h * 0.465)
    patch_full = canvas.copy()
    patch_full[y0 : y0 + target_h, x0 : x0 + target_w] = patch

    yy, xx = np.meshgrid(np.arange(1024, dtype=np.float32), np.arange(1024, dtype=np.float32), indexing="ij")
    ex = (xx - 518.5) / 124.0
    ey = (yy - 348.0) / 134.0
    oval = np.clip((1.0 - np.sqrt(ex * ex + ey * ey)) / 0.20, 0.0, 1.0)
    w_top = np.clip((yy - 212.0) / 12.0, 0.0, 1.0)
    w_bot = np.clip((476.0 - yy) / 14.0, 0.0, 1.0)
    mask = ndimage.gaussian_filter(oval * w_top * w_bot, sigma=3.5)[:, :, None]

    out = np.clip((1.0 - mask) * canvas + mask * patch_full, 0.0, 1.0)
    im_out = Image.fromarray((out * 255.0).astype(np.uint8), mode="RGB")
    im_out.save(out_path, format="PNG")
    return im_out


def lock_crown_and_collar_only(gen_im: Image.Image, template_im: Image.Image) -> Image.Image:
    """Keep 100% of `gen_im`'s sharp photo-seeded face (`rows 214..488`) while locking the
    crown (`y <= 210`), ermine collar (`y >= 492`), and background to `template_im`.
    Avoids any double-exposure blending with `photo_seeded_im`!
    """
    gen_np = np.asarray(gen_im.resize((1024, 1024), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    tpl_np = np.asarray(template_im.resize((1024, 1024), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0

    yy, xx = np.meshgrid(np.arange(1024, dtype=np.float32), np.arange(1024, dtype=np.float32), indexing="ij")
    ex_out = (xx - 515.5) / 160.0
    ey_out = (yy - 350.0) / 145.0
    w_out = np.clip((1.08 - np.sqrt(ex_out * ex_out + ey_out * ey_out)) / 0.16, 0.0, 1.0)
    w_out *= np.clip((yy - 212.0) / 12.0, 0.0, 1.0) * np.clip((490.0 - yy) / 12.0, 0.0, 1.0)
    w_out = ndimage.gaussian_filter(w_out, sigma=3.5)[:, :, None]

    comp = np.clip((1.0 - w_out) * tpl_np + w_out * gen_np, 0.0, 1.0)
    return Image.fromarray((comp * 255.0).astype(np.uint8), mode="RGB")


def build_ground_truth_collage(refs: list[tuple[str, Image.Image]], out_path: Path) -> Image.Image:
    """Create a 380x460 panel showing all 5 real photos of Riccardo for side-by-side comparison."""
    panel = Image.new("RGB", (380, 460), (28, 31, 38))
    draw = ImageDraw.Draw(panel)
    font = ImageFont.load_default()
    draw.text((12, 8), "VERO RICCARDO (5 Foto nano-banana-ricc)", fill=(130, 255, 170), font=font)

    positions = [
        (10, 32, 175, 195),
        (195, 32, 175, 195),
        (10, 236, 114, 130),
        (133, 236, 114, 130),
        (256, 236, 114, 130),
    ]
    for (fname, im), (x, y, w, h) in zip(refs, positions):
        thumb = im.resize((w, h), Image.Resampling.LANCZOS)
        panel.paste(thumb, (x, y))
        draw.rectangle([x, y, x + w - 1, y + h - 1], outline=(100, 220, 140), width=1)

    draw.text(
        (12, 378),
        "Tratti Biometrici Chiave (Ground Truth):\n"
        "1. Occhi incassati sotto arcata sopraccigliare + ciuffo bianco\n"
        "2. Naso dritto con punta TONDA e carnosa (non appuntito)\n"
        "3. Velo di BARBETTA CORTISSIMA (2-3 gg) bianca/sale e pepe\n"
        "4. Sorriso largo a labbra sottili + tempie argento/bianche",
        fill=(230, 235, 245),
        font=font,
    )
    panel.save(out_path, format="PNG")
    return panel


def get_or_generate_likeness_front_portrait(
    client: genai.Client,
    refs: list[tuple[str, Image.Image]],
    photo_seeded_im: Image.Image,
    template_im: Image.Image,
    critic_feedback: str,
    iteration: int,
) -> Image.Image:
    """Load cached `raw_gen_front_iter_{iteration}.png` if already generated, or call `gemini-3-pro-image-preview`,
    and lock only crown/collar so the facial features remain 100% crisp.
    """
    cached_raw = OUT_DIR / f"raw_gen_front_iter_{iteration}.png"
    if cached_raw.exists():
        raw_gen = Image.open(cached_raw).convert("RGB")
        return lock_crown_and_collar_only(raw_gen, template_im)

    prompt = (
        "TASK: The last image is a photo-composite of the real man (Riccardo, shown in the first 5 reference photos) "
        "placed into his 3D King Riccardo chess figurine.\n"
        "Unify and studio-harmonize the last image into a seamless, photorealistic studio portrait of the figurine "
        "while preserving 100% of Riccardo's EXACT facial geometry and identity already present in the composite:\n"
        "1. KEEP HIS EXACT DEEP-SET HOODED BROWN EYES, masculine brow ridge, vertical glabella crease, and natural "
        "salt-and-pepper eyebrows (with the small white hair tuft on his left eyebrow) — do NOT enlarge or round his eyes!\n"
        "2. KEEP HIS EXACT BROAD, ROUNDED NOSE TIP and nostrils — do NOT make the nose thin or pointy!\n"
        "3. KEEP HIS EXACT THIN, WIDE, AFFECTIONATE CLOSED-LIP SMILE and pronounced nasolabial laugh lines!\n"
        "4. VERY SHORT 2-TO-3-DAY LIGHT WHITE/SILVER STUBBLE (`barba cortissima di 2-3 giorni`): NOT a thick full beard! "
        "Keep a very short, light, translucent 2-3 day white/silver stubble on the upper lip, chin, and lower cheeks "
        "where the warm rosy skin tone shows through.\n"
        "5. TEMPLES & CROWN: Short cropped silver-white / salt-and-pepper hair at the temples and sides, seamlessly "
        "connected to the ears and sitting naturally under the ornate golden crown. Keep the exact crown, blue velvet "
        "ermine cape, sceptre, orb, and KING RICCARDO wooden pedestal."
    )
    if critic_feedback:
        prompt += f"\n\nADVERSARIAL CRITIC REFINEMENTS FOR ITERATION {iteration}:\n{critic_feedback}"

    contents: list = [im for _, im in refs] + [photo_seeded_im, prompt]
    for model_name in ("gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"):
        try:
            print(
                f"  🎨 [Generator Iter {iteration}] Calling {model_name} with photo-seeded template + 5 nano-banana-ricc photos...",
                flush=True,
            )
            resp = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio="1:1"),
                ),
            )
            for part in resp.candidates[0].content.parts:
                if part.inline_data:
                    raw_gen = Image.open(BytesIO(part.inline_data.data)).convert("RGB")
                    raw_gen.save(cached_raw)
                    return lock_crown_and_collar_only(raw_gen, template_im)
        except Exception as exc:
            print(f"  ⚠️ Generator error on {model_name}: {exc}", flush=True)
    raise RuntimeError(f"Failed to generate 2D portrait on iteration {iteration}")


def render_adversarial_sheet(
    gt_panel: Image.Image,
    front_im: Image.Image,
    data: dict,
    iteration: int,
    out_path: Path,
) -> Image.Image:
    """Render a 6-panel biometric inspection sheet for the Adversarial Critic and user report."""
    front_crop = front_im.crop((230, 50, 800, 730)).resize((380, 460), Image.Resampling.LANCZOS)
    dr_fc = ImageDraw.Draw(front_crop)
    font = ImageFont.load_default()
    dr_fc.text((12, 10), f"Iter {iteration}: 2D Portrait (front.png)", fill=(255, 224, 130), font=font)

    p_3d_0 = rasterize_view_barycentric(
        data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
        yaw_deg=0.0, zoom_head=True,
    )
    ImageDraw.Draw(p_3d_0).text((12, 10), f"Iter {iteration}: 3D GLB Head (0 deg)", fill=(255, 224, 130), font=font)

    p_3d_32 = rasterize_view_barycentric(
        data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
        yaw_deg=32.0, zoom_head=True,
    )
    ImageDraw.Draw(p_3d_32).text((12, 10), f"Iter {iteration}: 3D GLB 3/4 (+32 deg)", fill=(255, 224, 130), font=font)

    p_3d_72 = rasterize_view_barycentric(
        data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
        yaw_deg=72.0, zoom_head=True,
    )
    ImageDraw.Draw(p_3d_72).text((12, 10), f"Iter {iteration}: 3D GLB Side (+72 deg)", fill=(255, 224, 130), font=font)

    p_3d_full = rasterize_view_barycentric(
        data["pos_new"], data["norm_new"], data["uv_new"], data["indices_new"], data["dual_atlas"],
        yaw_deg=0.0, zoom_head=False,
    )
    ImageDraw.Draw(p_3d_full).text((12, 10), f"Iter {iteration}: 3D GLB Full (0 deg)", fill=(255, 224, 130), font=font)

    panels = [gt_panel, front_crop, p_3d_0, p_3d_32, p_3d_72, p_3d_full]
    sheet = Image.new("RGB", (380 * 3 + 40, 460 * 2 + 70), (20, 22, 28))
    draw = ImageDraw.Draw(sheet)
    p = data["params"]
    draw.text(
        (16, 14),
        f"ADVERSARIAL BIOMETRIC LIKENESS CRITIQUE — ITERATION {iteration} "
        f"(scale_y={p['scale_y_lower']:.0f}/{p['scale_y_upper']:.0f}, jaw_slim={p['jaw_slim']:.3f}, nose_widen={p['nose_widen']:.2f})",
        fill=(245, 224, 150),
        font=font,
    )
    for idx, im in enumerate(panels):
        r_idx, c_idx = divmod(idx, 3)
        x_off = 10 + c_idx * 390
        y_off = 44 + r_idx * 470
        sheet.paste(im, (x_off, y_off))
    sheet.save(out_path, format="PNG")
    return sheet


CRITIC_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "silver_hair_and_temples": {"type": "NUMBER"},
        "white_stubble_beard_mustache": {"type": "NUMBER"},
        "eyes_eyebrows_forehead": {"type": "NUMBER"},
        "nose_and_smile_identity": {"type": "NUMBER"},
        "head_jaw_3d_proportions": {"type": "NUMBER"},
        "seamless_3d_blend": {"type": "NUMBER"},
        "overall_likeness_score": {"type": "NUMBER"},
        "verdict_summary_it": {"type": "STRING"},
        "flaws_detected": {"type": "ARRAY", "items": {"type": "STRING"}},
        "regenerate_2d": {"type": "BOOLEAN"},
        "prompt_corrections": {"type": "STRING"},
        "recommended_params": {
            "type": "OBJECT",
            "properties": {
                "scale_x": {"type": "NUMBER"},
                "scale_y_lower": {"type": "NUMBER"},
                "scale_y_upper": {"type": "NUMBER"},
                "row_eye_2d": {"type": "NUMBER"},
                "jaw_slim": {"type": "NUMBER"},
                "chin_taper": {"type": "NUMBER"},
                "nose_shorten": {"type": "NUMBER"},
                "nose_widen": {"type": "NUMBER"},
                "brow_overhang": {"type": "NUMBER"},
                "low_2d_ratio": {"type": "NUMBER"},
                "silver_hair_mix": {"type": "NUMBER"},
                "side_stubble_mix": {"type": "NUMBER"},
            },
            "required": [
                "scale_x",
                "scale_y_lower",
                "scale_y_upper",
                "row_eye_2d",
                "jaw_slim",
                "chin_taper",
                "nose_shorten",
                "nose_widen",
                "brow_overhang",
                "low_2d_ratio",
                "silver_hair_mix",
                "side_stubble_mix",
            ],
        },
    },
    "required": [
        "silver_hair_and_temples",
        "white_stubble_beard_mustache",
        "eyes_eyebrows_forehead",
        "nose_and_smile_identity",
        "head_jaw_3d_proportions",
        "seamless_3d_blend",
        "overall_likeness_score",
        "verdict_summary_it",
        "flaws_detected",
        "regenerate_2d",
        "prompt_corrections",
        "recommended_params",
    ],
}


def evaluate_with_adversarial_critic(
    client: genai.Client,
    refs: list[tuple[str, Image.Image]],
    sheet_im: Image.Image,
    current_params: BiometricGraftParams,
    iteration: int,
) -> dict:
    """Run the multimodal Adversarial Biometric Critic comparing the 5 real photos of Riccardo
    against the rendered 2D and 3D views in `sheet_im`.
    """
    critic_prompt = (
        f"You are an uncompromising Adversarial Biometric Facial Likeness Critic evaluating Iteration {iteration} "
        "of the 3D King Riccardo chess figurine (`king-riccardo.glb`).\n"
        "Compare the 5 real ground-truth photos of Riccardo against the 6-panel inspection sheet (especially "
        "Panels 2, 3, 4, 5, 6 showing the 2D portrait and the rendered 3D GLB model at 0 deg, +32 deg, and +72 deg!).\n\n"
        "KEY BIOMETRIC CHECKLIST FOR REAL RICCARDO:\n"
        "1. Eyes & Brow Ridge: Crisp, sharp (no double-exposure blur!), deep-set, slightly hooded warm brown smiling eyes "
        "under a strong brow ridge with vertical glabella crease and salt-and-pepper eyebrows (including the small white tuft on his left eyebrow).\n"
        "2. Nose: Straight bridge with a BROAD, ROUNDED, FLESHY TIP (not thin/pointy).\n"
        "3. Mouth & Stubble: Crisp thin, wide, affectionate closed-lip smile + VERY SHORT 2-to-3-day light white/silver stubble "
        "(NOT clean-shaven, and NOT a thick bushy beard) covering the upper lip, chin tip, and jawline.\n"
        "4. Hair & Temples: Short silver-white / salt-and-pepper hair at the temples and sides, with NO grey/blue bleed onto the crown, neck, or cheeks.\n"
        "5. 3D Head & Side Integration: Piecewise-linear vertical landmark alignment (`scale_y_lower` around 890-905, `scale_y_upper` around 1220-1260) "
        "so the forehead, eyebrows, nose tip, mouth, and chin stubble land at their exact 3D heights, plus clean side cheeks without eye-corner smudging.\n"
        f"- Current 3D params: {json.dumps(asdict(current_params))}\n"
        "Keep recommended_params within bounds:\n"
        "  scale_x in [855, 880], scale_y_lower in [885, 905], scale_y_upper in [1225, 1255], row_eye_2d in [319, 322], "
        "  jaw_slim in [0.038, 0.055], chin_taper in [0.020, 0.032], nose_shorten in [0.40, 0.54], nose_widen in [0.22, 0.32], "
        "  brow_overhang in [0.006, 0.010], low_2d_ratio in [0.94, 0.97], silver_hair_mix in [0.82, 0.90], "
        "  side_stubble_mix in [0.42, 0.56]."
    )
    contents: list = [im for _, im in refs] + [sheet_im, critic_prompt]
    for model_name in ("gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"):
        try:
            resp = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=CRITIC_SCHEMA,
                    temperature=0.1,
                ),
            )
            res = json.loads(resp.text)
            res["critic_model"] = model_name
            return res
        except Exception as exc:
            print(f"  ⚠️ Critic error on {model_name}: {exc}", flush=True)
    raise RuntimeError("All critic models failed")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=load_api_key())

    template_backup = OUT_DIR / "front_template_orig_clean_shaven.png"
    if not template_backup.exists():
        shutil.copy2(FRONT_PNG, template_backup)
    template_im = Image.open(template_backup).convert("RGB")

    refs = load_riccardo_ground_truth_photos()
    gt_panel = build_ground_truth_collage(refs, OUT_DIR / "riccardo_ground_truth_collage.png")
    photo_seeded_im = build_photo_seeded_template(template_im, OUT_DIR / "photo_seeded_template.png")

    history: list[dict] = []

    # Load Iter 0 and Iter 1 from previous run if available so we only re-evaluate Iter 2 and Iter 3 with the cylindrical + rounded-nose fix!
    prev_hist_path = OUT_DIR / "adversarial_history.json"
    if prev_hist_path.exists():
        try:
            old_h = json.loads(prev_hist_path.read_text())
            for entry in old_h:
                if entry.get("iteration") in (0, 1):
                    history.append(entry)
                    print(
                        f"🔎 [Iter {entry['iteration']} - Cached]: {entry['critique']['overall_likeness_score']:.1f}/10 — {entry['critique']['verdict_summary_it']}",
                        flush=True,
                    )
        except Exception:
            pass

    # Iteration 2: Piecewise-linear 3D landmark calibration + Hybrid Side-Cylindrical Unwrapping + 3D Rounded Nose & Brow Ridge
    iter2_params = BiometricGraftParams(
        scale_x=865.0,
        scale_y_lower=892.0,
        scale_y_upper=1240.0,
        row_eye_2d=320.0,
        col_center_2d=514.5,
        jaw_slim=0.045,
        chin_taper=0.025,
        forehead_broaden=0.020,
        nose_shorten=0.46,
        nose_widen=0.26,
        brow_overhang=0.0080,
        low_2d_ratio=0.96,
        silver_hair_mix=0.85,
        side_stubble_mix=0.48,
        cylindrical_wrap=0.112,
    )

    best_score = -1.0
    best_iter = 2
    best_front_im = Image.open(FRONT_PNG).convert("RGB")
    best_params = iter2_params

    cur_params = iter2_params
    critic_feedback = ""

    for it in (2, 3):
        cur_front_im = get_or_generate_likeness_front_portrait(
            client,
            refs,
            photo_seeded_im,
            template_im,
            critic_feedback,
            2,
        )
        iter_front_path = OUT_DIR / f"front_iter_{it}.png"
        cur_front_im.save(iter_front_path)

        iter_glb_path = OUT_DIR / f"king_iter_{it}.glb"
        print(
            f"  🗿 [Iter {it}] Sculpting 3D nose/brow/jaw + grafting 2048x1024 Dual-Chart atlas "
            f"(scale_y={cur_params.scale_y_lower:.0f}/{cur_params.scale_y_upper:.0f}, nose_shorten={cur_params.nose_shorten:.2f})...",
            flush=True,
        )
        iter_data = graft_face_onto_king_glb(cur_params, front_png_path=iter_front_path, out_glb_path=iter_glb_path)

        iter_sheet_path = OUT_DIR / f"adversarial_iter_{it}.png"
        iter_sheet = render_adversarial_sheet(gt_panel, cur_front_im, iter_data, it, iter_sheet_path)

        crit = evaluate_with_adversarial_critic(client, refs, iter_sheet, cur_params, it)
        score = float(crit["overall_likeness_score"])
        print(
            f"  📊 [Iter {it} Score]: {score:.1f}/10 "
            f"(Hair={crit['silver_hair_and_temples']:.1f}, Stubble={crit['white_stubble_beard_mustache']:.1f}, "
            f"Eyes/Brow={crit['eyes_eyebrows_forehead']:.1f}, Nose/Smile={crit['nose_and_smile_identity']:.1f}, "
            f"3D-Jaw/Nose={crit['head_jaw_3d_proportions']:.1f}, 3D-Blend={crit['seamless_3d_blend']:.1f}) — {crit['verdict_summary_it']}",
            flush=True,
        )
        history.append(
            {
                "iteration": it,
                "params": asdict(cur_params),
                "critique": crit,
                "sheet_path": str(iter_sheet_path.relative_to(REPO_ROOT)),
                "front_path": str(iter_front_path.relative_to(REPO_ROOT)),
            }
        )

        if score >= best_score:
            best_score = score
            best_iter = it
            best_front_im = cur_front_im
            best_params = BiometricGraftParams(**asdict(cur_params))

        if it == 2:
            rec = crit.get("recommended_params", {})
            cur_params = BiometricGraftParams(
                scale_x=float(np.clip(rec.get("scale_x", cur_params.scale_x), 855.0, 880.0)),
                scale_y_lower=float(np.clip(rec.get("scale_y_lower", cur_params.scale_y_lower), 885.0, 905.0)),
                scale_y_upper=float(np.clip(rec.get("scale_y_upper", cur_params.scale_y_upper), 1225.0, 1255.0)),
                row_eye_2d=float(np.clip(rec.get("row_eye_2d", cur_params.row_eye_2d), 319.0, 322.0)),
                col_center_2d=514.5,
                jaw_slim=float(np.clip(rec.get("jaw_slim", cur_params.jaw_slim), 0.038, 0.055)),
                chin_taper=float(np.clip(rec.get("chin_taper", cur_params.chin_taper), 0.020, 0.032)),
                forehead_broaden=cur_params.forehead_broaden,
                nose_shorten=float(np.clip(rec.get("nose_shorten", cur_params.nose_shorten), 0.40, 0.54)),
                nose_widen=float(np.clip(rec.get("nose_widen", cur_params.nose_widen), 0.22, 0.32)),
                brow_overhang=float(np.clip(rec.get("brow_overhang", cur_params.brow_overhang), 0.006, 0.010)),
                low_2d_ratio=float(np.clip(rec.get("low_2d_ratio", cur_params.low_2d_ratio), 0.94, 0.97)),
                silver_hair_mix=float(np.clip(rec.get("silver_hair_mix", cur_params.silver_hair_mix), 0.82, 0.90)),
                side_stubble_mix=float(np.clip(rec.get("side_stubble_mix", cur_params.side_stubble_mix), 0.42, 0.56)),
                cylindrical_wrap=cur_params.cylindrical_wrap,
            )
            critic_feedback = "; ".join(crit.get("flaws_detected", [])) + ". " + crit.get("prompt_corrections", "")

    print(f"\n🏆 Winning Iteration: Iter {best_iter} (Score {best_score:.1f}/10). Finalizing assets...", flush=True)
    best_front_im.save(FRONT_PNG)
    final_data = graft_face_onto_king_glb(best_params, front_png_path=FRONT_PNG, out_glb_path=FINAL_GLB)
    render_before_after_and_gif(final_data, PREVIEW_PNG, TURNTABLE_GIF)

    # Also update turnaround sheet and character card with the crisp winning front portrait
    old_side = Image.open(SIDE_PNG).convert("RGB")
    old_tq = Image.open(TQ_PNG).convert("RGB")
    old_back = Image.open(BACK_PNG).convert("RGB")
    w, h = best_front_im.size
    sheet = Image.new("RGB", (w * 4, h))
    sheet.paste(best_front_im, (0, 0))
    sheet.paste(old_side.resize((w, h), Image.Resampling.LANCZOS), (w, 0))
    sheet.paste(old_back.resize((w, h), Image.Resampling.LANCZOS), (w * 2, 0))
    sheet.paste(old_tq.resize((w, h), Image.Resampling.LANCZOS), (w * 3, 0))
    sheet.save(TURNAROUND_PNG)

    card = Image.new("RGB", (w * 2, h))
    card.paste(best_front_im, (0, 0))
    card.paste(old_tq.resize((w, h), Image.Resampling.LANCZOS), (w, 0))
    card.save(CHAR_CARD_JPG, format="JPEG", quality=92)

    log_path = OUT_DIR / "adversarial_history.json"
    log_path.write_text(json.dumps(history, indent=2, ensure_ascii=False))
    print(f"✅ Saved full adversarial critique log to {log_path.relative_to(REPO_ROOT)}", flush=True)


if __name__ == "__main__":
    main()
