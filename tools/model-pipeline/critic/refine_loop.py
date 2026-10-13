# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "gradio_client",
#     "google-genai",
#     "pillow",
#     "pydantic",
#     "trimesh",
#     "numpy",
#     "networkx",
#     "scipy",
#     "pyyaml",
# ]
# ///
"""Autonomous VLM Feedback & Refinement Loop for 3D Pieces.

Automates hyperparameter exploration (seeds, decimation targets, texture size),
candidate generation via TRELLIS.2, automated Blender contact sheet rendering,
geometric checks, and Gemini Flash VLM evaluation to iteratively find the best 3D model.
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from gradio_client import Client, handle_file

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent

# Import critic functions from critic_vlm.py
sys.path.insert(0, str(HERE))
from critic_vlm import (  # noqa: E402
    SCORES_YAML,
    VlmCritique,
    check_geometry,
    evaluate_vlm,
    render_sheet,
    update_scoreboard,
)

PROVENANCE_YAML = ROOT / "docs/models-provenance.yaml"

DEFAULT_SEEDS = [42, 1337, 7, 2026, 999]
DEFAULT_DECIMATIONS = [100000, 150000, 200000]
DEFAULT_TEXTURE_SIZES = [1024, 2048]


@dataclass
class CandidateResult:
    iteration: int
    seed: int
    decimation_target: int
    texture_size: int
    glb_path: str
    sheet_path: str
    report_path: str
    face_score: float
    companion_score: float
    back_score: float
    overall_score: float
    passed: bool
    tier: str
    generation_time_s: float
    flaws: List[str]
    summary: str


def get_hf_token() -> Optional[str]:
    """Retrieve Hugging Face token securely from env or local .env files without logging."""
    for key in ["HF_TOKEN", "HF_RICC_PROVE3D_CARLESSO", "HUGGING_FACE_RO_TRELLIS"]:
        val = os.environ.get(key)
        if val:
            return val

    candidates = [
        ROOT / ".env",
        Path("/home/riccardo/git/carchess3d/.env"),
        Path.home() / ".env",
    ]
    for env_path in candidates:
        if env_path.exists():
            try:
                for line in env_path.read_text().splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k in ["HF_RICC_PROVE3D_CARLESSO", "HF_TOKEN", "HUGGING_FACE_RO_TRELLIS"] and v:
                            return v
            except Exception:
                continue
    return None


def generate_trellis2_candidate(
    client: Client,
    input_image: Path,
    seed: int,
    decimation_target: int,
    texture_size: int,
    out_glb_path: Path,
    preproc_cache_path: Optional[Path] = None,
) -> float:
    """Generate a single 3D GLB candidate using microsoft/TRELLIS.2."""
    t0 = time.time()

    # 1. Preprocess input image (background removal / matte)
    p_img_path = None
    if preproc_cache_path and preproc_cache_path.exists():
        p_img_path = str(preproc_cache_path)
    else:
        print(f"   🧼 Preprocessing {input_image.name}...", flush=True)
        res_pre = client.predict(input=handle_file(str(input_image)), api_name="/preprocess_image")
        if isinstance(res_pre, dict):
            p_img_path = res_pre.get("path") or res_pre.get("value")
        else:
            p_img_path = str(res_pre)

        if preproc_cache_path and p_img_path and Path(p_img_path).exists():
            shutil.copy(p_img_path, preproc_cache_path)

    # 2. 3D Shape and Texture Reconstruction
    print(f"   🧊 Reconstructing 3D structure (seed={seed})...", flush=True)
    client.predict(
        image=handle_file(p_img_path),
        seed=seed,
        resolution="1024",
        ss_guidance_strength=7.5,
        ss_guidance_rescale=0.7,
        ss_sampling_steps=12,
        ss_rescale_t=5.0,
        shape_slat_guidance_strength=7.5,
        shape_slat_guidance_rescale=0.5,
        shape_slat_sampling_steps=12,
        shape_slat_rescale_t=3.0,
        tex_slat_guidance_strength=1.0,
        tex_slat_guidance_rescale=0.0,
        tex_slat_sampling_steps=12,
        tex_slat_rescale_t=3.0,
        api_name="/image_to_3d",
    )

    # 3. Extract and Decimate GLB
    print(
        f"   📦 Extracting GLB (decimation={decimation_target}, texture={texture_size})...",
        flush=True,
    )
    extracted_glb, download_glb = client.predict(
        decimation_target=decimation_target,
        texture_size=texture_size,
        api_name="/extract_glb",
    )

    final_glb = download_glb or extracted_glb
    if isinstance(final_glb, dict):
        final_glb = final_glb.get("path") or final_glb.get("value")

    if not final_glb or not Path(final_glb).exists():
        raise RuntimeError("Failed to extract GLB from TRELLIS.2 endpoint.")

    out_glb_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(final_glb, out_glb_path)
    elapsed = time.time() - t0
    print(f"   ✅ GLB generated in {elapsed:.1f}s ({out_glb_path.stat().st_size // 1024} KB)")
    return elapsed


def update_provenance_registry(target_glb: Path, seed: int, decimation: int, tex_size: int):
    """Update docs/models-provenance.yaml if target_glb matches any registered model."""
    if not PROVENANCE_YAML.exists():
        return
    try:
        data = yaml.safe_load(PROVENANCE_YAML.read_text()) or {}
        models = data.get("models", [])
        rel_target = str(target_glb.resolve().relative_to(ROOT.resolve()))

        file_bytes = target_glb.read_bytes()
        new_md5 = hashlib.md5(file_bytes).hexdigest()
        new_size = len(file_bytes)

        updated = False
        for m in models:
            if m.get("target_path") == rel_target:
                m["md5"] = new_md5
                m["size_bytes"] = new_size
                pipe = m.setdefault("pipeline", {})
                pipe["seed"] = seed
                pipe["decimation_target"] = decimation
                pipe["texture_size"] = tex_size
                updated = True
                break

        if updated:
            PROVENANCE_YAML.write_text(yaml.dump(data, sort_keys=False, allow_unicode=True))
            print(f"📋 Provenance registry updated in {PROVENANCE_YAML} (MD5: {new_md5})")
    except Exception as e:
        print(f"⚠️ Warning: Could not update provenance registry: {e}")


def run_refinement_loop(
    character_id: str,
    concept_path: Path,
    views_dir: Optional[Path],
    max_iterations: int = 3,
    target_score: float = 8.0,
    output_dir: Optional[Path] = None,
    target_dest: Optional[Path] = None,
    seeds: Optional[List[int]] = None,
    decimations: Optional[List[int]] = None,
    texture_sizes: Optional[List[int]] = None,
    reuse_existing: bool = False,
    candidate_glbs: Optional[List[Path]] = None,
    engine: str = "trellis2",
) -> CandidateResult:
    """Run iterative generation, critique, and selection loop."""
    seeds = seeds or DEFAULT_SEEDS
    decimations = decimations or DEFAULT_DECIMATIONS
    texture_sizes = texture_sizes or DEFAULT_TEXTURE_SIZES

    if output_dir is None:
        output_dir = HERE / "out" / f"{character_id}_refine"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine input view for 3D reconstruction
    input_img = None
    if views_dir and views_dir.exists():
        for fname in ["front.png", "front.jpg", "front.jpeg"]:
            cand = views_dir / fname
            if cand.exists():
                input_img = cand
                break
    if not input_img:
        input_img = concept_path

    if candidate_glbs:
        max_iterations = min(max_iterations, len(candidate_glbs))

    print("\n" + "=" * 70)
    print(f"🚀 STARTING AUTONOMOUS REFINE LOOP: {character_id}")
    print("=" * 70)
    print(f"• Character ID:    {character_id}")
    print(f"• 2D Concept Art:  {concept_path}")
    print(f"• Input 3D Source: {input_img}")
    print(f"• Max Iterations:  {max_iterations}")
    print(f"• Target Score:    {target_score:.1f} / 10.0")
    print(f"• Output Dir:      {output_dir}")
    if candidate_glbs:
        print(f"• Provided GLBs:   {len(candidate_glbs)} candidates")
    print("=" * 70 + "\n")

    # Connect to TRELLIS.2 client if needed
    client = None
    if engine == "trellis2" and not candidate_glbs:
        token = get_hf_token()
        print("🔗 Connecting to microsoft/TRELLIS.2 on Hugging Face ZeroGPU...")
        try:
            client = Client("microsoft/TRELLIS.2", token=token, verbose=False)
            client.predict(api_name="/start_session")
            print("✅ Session active on microsoft/TRELLIS.2\n")
        except Exception as e:
            print(f"⚠️ Warning: Could not connect to TRELLIS.2: {e}")

    candidates: List[CandidateResult] = []
    preproc_cache = output_dir / "trellis2_preproc.png"

    for i in range(max_iterations):
        iter_num = i + 1
        seed = seeds[i % len(seeds)]
        decimation = decimations[i % len(decimations)]
        tex_size = texture_sizes[i % len(texture_sizes)]

        print(f"----------------------------------------------------------------------")
        print(f"🔄 ITERATION {iter_num}/{max_iterations}: seed={seed}, decimation={decimation}, texture={tex_size}")
        print(f"----------------------------------------------------------------------")

        cand_glb = output_dir / f"candidate_{iter_num}_seed{seed}.glb"
        cand_sheet = output_dir / f"candidate_{iter_num}_seed{seed}_sheet.png"
        cand_report_path = output_dir / f"candidate_{iter_num}_report.json"

        gen_time = 0.0
        # 1. Candidate Acquisition (Provided list, Existing cache, or TRELLIS.2 generation)
        if candidate_glbs and i < len(candidate_glbs):
            src_glb = candidate_glbs[i]
            print(f"   📦 Using provided candidate GLB: {src_glb.name}")
            shutil.copy(src_glb, cand_glb)
        elif reuse_existing and cand_glb.exists():
            print(f"   ⏩ Reusing existing GLB: {cand_glb.name}")
        else:
            if engine == "trellis2" and client is not None:
                try:
                    gen_time = generate_trellis2_candidate(
                        client=client,
                        input_image=input_img,
                        seed=seed,
                        decimation_target=decimation,
                        texture_size=tex_size,
                        out_glb_path=cand_glb,
                        preproc_cache_path=preproc_cache,
                    )
                except Exception as e:
                    print(f"   ❌ Generation failed on iteration {iter_num}: {e}")
                    if cand_glb.exists():
                        print(f"   ⏩ Falling back to existing cached candidate: {cand_glb.name}")
                    else:
                        continue
            else:
                if cand_glb.exists():
                    print(f"   ⏩ Using existing candidate: {cand_glb.name}")
                else:
                    print(f"   ❌ Error: No client or GLB available for iteration {iter_num}")
                    continue

        # 2. Geometric QA & Headless Blender Render
        print("   📐 Running geometric QA...")
        geo = check_geometry(cand_glb)
        print(f"      Faces: {geo['faces']}, Watertight: {geo['is_watertight']}, Grounded: {geo['is_grounded_near_zero']}")

        print("   📸 Rendering 4-view contact sheet (Cycles)...")
        render_sheet(cand_glb, cand_sheet)

        # 3. Gemini Flash VLM Evaluation
        print("   🤖 Evaluating likeness & fidelity with Gemini Flash VLM...")
        vlm = evaluate_vlm(concept_path, cand_sheet)

        tot = (vlm.face_likeness_score + vlm.secondary_fidelity_score + vlm.back_view_score) / 3.0
        tier = "TOP_QUALITY 🟢" if tot >= 8.0 else ("ACCEPTABLE 🟡" if tot >= 6.0 else "FA_CAGARE 💩")

        all_flaws = vlm.structural_flaws + vlm.aesthetic_flaws

        print(f"   📊 Results: Face={vlm.face_likeness_score:.1f}, Prop={vlm.secondary_fidelity_score:.1f}, Back={vlm.back_view_score:.1f} → Total={tot:.1f}/10 ({tier})")
        print(f"   💬 Critique: {vlm.face_critique}")
        if all_flaws:
            print(f"   ⚠️ Flaws detected ({len(all_flaws)}): {', '.join(all_flaws[:3])}...")

        # Save iteration report
        report_data = {
            "iteration": iter_num,
            "seed": seed,
            "decimation_target": decimation,
            "texture_size": tex_size,
            "model": cand_glb.name,
            "concept": concept_path.name,
            "generation_time_s": round(gen_time, 1),
            "geometry": geo,
            "vlm": vlm.model_dump(),
            "overall_score": round(tot, 1),
            "tier": tier,
        }
        cand_report_path.write_text(json.dumps(report_data, indent=2))

        cand_res = CandidateResult(
            iteration=iter_num,
            seed=seed,
            decimation_target=decimation,
            texture_size=tex_size,
            glb_path=str(cand_glb),
            sheet_path=str(cand_sheet),
            report_path=str(cand_report_path),
            face_score=vlm.face_likeness_score,
            companion_score=vlm.secondary_fidelity_score,
            back_score=vlm.back_view_score,
            overall_score=tot,
            passed=vlm.passed,
            tier=tier,
            generation_time_s=gen_time,
            flaws=all_flaws,
            summary=vlm.face_critique,
        )
        candidates.append(cand_res)

        # 4. Check for Early Exit
        if tot >= target_score and vlm.passed:
            print(f"\n🎉 EARLY EXIT TRIGGERED! Model passed bar with score {tot:.1f} >= {target_score:.1f}\n")
            break
        else:
            print(f"   ⏳ Did not reach target {target_score:.1f} (passed={vlm.passed}). Trying next candidate...\n")

    if not candidates:
        raise RuntimeError("No candidates were successfully generated or evaluated.")

    # 5. Identify Winner
    # Sort primarily by passed status, then overall_score, then face_score
    candidates.sort(key=lambda c: (1 if c.passed else 0, c.overall_score, c.face_score), reverse=True)
    winner = candidates[0]

    # Save winner artifacts
    winner_glb_dest = output_dir / f"{character_id}_winner.glb"
    winner_sheet_dest = output_dir / f"{character_id}_winner_sheet.png"
    shutil.copy(winner.glb_path, winner_glb_dest)
    shutil.copy(winner.sheet_path, winner_sheet_dest)

    # If target destination is specified, copy winner there
    if target_dest:
        target_dest = target_dest.resolve()
        target_dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(winner_glb_dest, target_dest)
        print(f"🏰 Copied winning model to {target_dest}")
        update_provenance_registry(
            target_dest,
            winner.seed,
            winner.decimation_target,
            winner.texture_size,
        )

    # 6. Update Scoreboard (docs/qa-scores.yaml)
    winner_report = json.loads(Path(winner.report_path).read_text())
    # Format model name as <character-id>.glb for standard scoreboard tracking
    winner_report["model"] = f"{character_id}.glb"
    update_scoreboard(winner_report)

    # 7. Write full summary JSON
    summary_path = output_dir / f"{character_id}_refine_summary.json"
    summary_payload = {
        "character_id": character_id,
        "concept": concept_path.name,
        "winner": asdict(winner),
        "all_candidates": [asdict(c) for c in candidates],
    }
    summary_path.write_text(json.dumps(summary_payload, indent=2))

    # 8. Print ASCII Summary Table
    print("\n" + "=" * 80)
    print(f"🏆 AUTONOMOUS REFINEMENT SUMMARY: {character_id}")
    print("=" * 80)
    print(f"{'Iter':<5} {'Seed':<6} {'Decim':<8} {'Tex':<6} {'Face':<6} {'Prop':<6} {'Back':<6} {'Total':<6} {'Tier':<14} {'Passed':<7} {'Status'}")
    print("-" * 80)
    for c in candidates:
        is_winner = (c.iteration == winner.iteration)
        status_tag = "WINNER 🏆" if is_winner else "Candidate"
        print(
            f"{c.iteration:<5} {c.seed:<6} {c.decimation_target:<8} {c.texture_size:<6} "
            f"{c.face_score:<6.1f} {c.companion_score:<6.1f} {c.back_score:<6.1f} "
            f"{c.overall_score:<6.1f} {c.tier:<14} {'Yes' if c.passed else 'No':<7} {status_tag}"
        )
    print("=" * 80)
    print(f"🎯 WINNING CANDIDATE: Iteration #{winner.iteration} (Seed {winner.seed})")
    print(f"   • Overall Score: {winner.overall_score:.1f} / 10.0 ({winner.tier})")
    print(f"   • Face Likeness: {winner.face_score:.1f} / 10.0")
    print(f"   • Companion/Prop:{winner.companion_score:.1f} / 10.0")
    print(f"   • Back Plausibility: {winner.back_score:.1f} / 10.0")
    print(f"   • Winner GLB:    {winner_glb_dest}")
    print(f"   • Winner Sheet:  {winner_sheet_dest}")
    print(f"   • Summary Log:   {summary_path}")
    print("=" * 80 + "\n")

    return winner


def main():
    parser = argparse.ArgumentParser(description="Autonomous VLM Feedback & Refinement Loop")
    parser.add_argument("--character-id", required=True, help="Character identifier (e.g. queen-kate-wedding2016)")
    parser.add_argument("--concept", required=True, help="Path to 2D concept or turnaround image")
    parser.add_argument("--views-dir", help="Path to processed turnaround views directory")
    parser.add_argument("--max-iterations", type=int, default=3, help="Maximum refinement iterations (default 3)")
    parser.add_argument("--target-score", type=float, default=8.0, help="Target QA score to stop early (default 8.0)")
    parser.add_argument("--output-dir", help="Directory where candidate GLBs, sheets, and reports are saved")
    parser.add_argument("--target-dest", help="Destination path to copy winning model")
    parser.add_argument("--reuse-existing", action="store_true", help="Reuse existing GLB files in output-dir if present")
    parser.add_argument("--candidate-glbs", nargs="+", help="Pre-existing candidate GLBs to evaluate")
    parser.add_argument("--engine", default="trellis2", choices=["trellis2"], help="3D generation engine (default trellis2)")
    args = parser.parse_args()

    concept_p = Path(args.concept).resolve()
    views_p = Path(args.views_dir).resolve() if args.views_dir else None
    out_dir = Path(args.output_dir).resolve() if args.output_dir else None
    target_d = Path(args.target_dest).resolve() if args.target_dest else None
    cand_glbs = [Path(p).resolve() for p in args.candidate_glbs] if args.candidate_glbs else None

    if not concept_p.exists():
        print(f"❌ Error: Concept file not found at {concept_p}")
        sys.exit(1)

    winner = run_refinement_loop(
        character_id=args.character_id,
        concept_path=concept_p,
        views_dir=views_p,
        max_iterations=args.max_iterations,
        target_score=args.target_score,
        output_dir=out_dir,
        target_dest=target_d,
        reuse_existing=args.reuse_existing,
        candidate_glbs=cand_glbs,
        engine=args.engine,
    )

    sys.exit(0 if winner.passed else 1)


if __name__ == "__main__":
    main()
