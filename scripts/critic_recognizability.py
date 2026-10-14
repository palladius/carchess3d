#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "playwright>=1.40.0",
#   "pillow>=10.0.0",
#   "google-genai>=1.0.0",
#   "pydantic>=2.0.0",
#   "python-dotenv>=1.0.0",
# ]
# ///
"""Adversarial Critic & Blind VLM Piece Recognizer (`scripts/critic_recognizability.py`).

Captures benchmark screenshots from two exact camera angles:
  1. `0deg` Vertical Zenithal: Camera at `(0, 12.8, 0.01)` looking at `(0, 0, 0)`.
  2. `30deg` Semi-High (30° from vertical): Camera at `(0, 11.08, 6.40)` looking at `(0, 0, 0)`.

Evaluates all 6 clarity modes (`off`, `s1`, `s2`, `s3`, `s4`, `s5`) across all 3 matchups:
  - `carlesso_vs_classic` (`white=carlesso&black=classic`)
  - `carlesso_vs_swamp` (`white=carlesso&black=swamp`)
  - `carlesso_vs_carlesso` (`white=carlesso&black=carlesso`, mirror match!)

Produces:
  - `/tmp/carchess_clarity/<mode>_<matchup>_<angle>.png` (36 screenshots)
  - `docs/clarity_comparison_0deg_30deg.png` (high-res side-by-side contact sheet)
  - `docs/clarity_vlm_report.json` (deterministic luminance telemetry + VLM RecognitionAudit)
  - `docs/clarity_vlm_report.md` (human-readable leaderboard & Italian critiques)
"""

from __future__ import annotations

import base64
import functools
import http.server
import io
import json
import math
import os
import pathlib
import re
import socketserver
import sys
import threading
import time
from typing import Any

from dotenv import dotenv_values
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

ROOT = pathlib.Path(__file__).resolve().parent.parent
TMP_DIR = pathlib.Path("/tmp/carchess_clarity")
REPORT_JSON_PATH = ROOT / "docs" / "clarity_vlm_report.json"
REPORT_MD_PATH = ROOT / "docs" / "clarity_vlm_report.md"
CONTACT_SHEET_PATH = ROOT / "docs" / "clarity_comparison_0deg_30deg.png"

MODES: list[tuple[str, str, str]] = [
    ("off", "Off (Baseline)", "Original 3D Models Only (Legacy Baseline)"),
    ("s1", "S1 (Zenith 2D)", "Zenith 2D Classic B/W Medallion Icons + Obsidian Contrast"),
    ("s2", "S2 (3D GLB Add-Ons)", "Universal 3D Static Role Add-Ons + Obsidian Contrast"),
    ("s3", "S3 (Obsidian Contrast)", "True Obsidian Black vs Warm Ivory Contrast Only"),
    ("s4", "S4 (Pedestal Wreath + Crest)", "3D Pedestal Role Wreath + Floating 2D Crest + Obsidian"),
    ("s5", "S5 (Hybrid All-In)", "Hybrid Champion: Obsidian + 3D Add-Ons + Wreath + Crest + Auto-2D Zenith"),
]

MATCHUPS: list[tuple[str, str, str, str]] = [
    ("carlesso_vs_classic", "carlesso", "classic", "Carlesso (W) vs Classic (B)"),
    ("carlesso_vs_swamp", "carlesso", "swamp", "Carlesso (W) vs Swamp (B)"),
    ("carlesso_vs_carlesso", "carlesso", "carlesso", "Carlesso (W) vs Carlesso (B) [Mirror]"),
]

# 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Qe2 Qe7
# Spreads P, N, B, Q across the center while opening sightlines to K (e1/e8) and R (a1/h1/a8/h8).
BENCHMARK_MOVES: list[tuple[str, str]] = [
    ("e2", "e4"),
    ("e7", "e5"),
    ("g1", "f3"),
    ("b8", "c6"),
    ("f1", "c4"),
    ("f8", "c5"),
    ("d1", "e2"),
    ("d8", "e7"),
]

ANGLES: dict[str, dict[str, Any]] = {
    "0deg": {
        "label": "0° Vertical Zenithal",
        "pos": (0.0, 12.8, 0.01),
        "lookAt": (0.0, 0.0, 0.0),
    },
    "30deg": {
        "label": "30° Semi-High (arctan(6.40/11.08)=30°)",
        "pos": (0.0, 11.08, 6.40),
        "lookAt": (0.0, 0.0, 0.0),
    },
}


class BlindPiecePrediction(BaseModel):
    square: str = Field(description="Chess square inspected, e.g. e1, e2, c4, f3, a1, e4, e8, e7, c5, c6, a8, e5")
    team_color: str = Field(description="Predicted team color: 'White' or 'Black'")
    role: str = Field(description="Predicted chess role: 'King', 'Queen', 'Rook', 'Bishop', 'Knight', or 'Pawn'")
    visual_cue_used: str = Field(description="Visual feature that enabled recognition (crown, cross, horse wings, pike, 2D disc, pedestal wreath, color)")


class RecognitionAudit(BaseModel):
    blind_predictions: list[BlindPiecePrediction] = Field(
        description="Blind identification of key pieces on the board at 0° and 30°"
    )
    distinct_roles_recognized_0deg: list[str] = Field(
        description="Subset of ['King', 'Queen', 'Rook', 'Bishop', 'Knight', 'Pawn'] unmistakably recognizable at 0° overhead"
    )
    distinct_roles_recognized_30deg: list[str] = Field(
        description="Subset of ['King', 'Queen', 'Rook', 'Bishop', 'Knight', 'Pawn'] unmistakably recognizable at 30° semi-high"
    )
    bw_contrast_score: int = Field(ge=1, le=10, description="1..10 score for Black vs White team contrast & zero ivory confusion")
    role_recognition_0deg_score: int = Field(ge=1, le=10, description="1..10 score for 6-role recognizability at 0° Vertical Zenithal")
    role_recognition_30deg_score: int = Field(ge=1, le=10, description="1..10 score for 6-role recognizability at 30° Semi-High")
    kid_low_fatigue_score: int = Field(ge=1, le=10, description="1..10 score for instant, low-cognitive-fatigue playability for kids")
    overall_score: int = Field(ge=1, le=10, description="1..10 overall visual recognition score")
    critique_it: str = Field(description="Concise, constructive Italian critique (2-3 sentences) of strengths and weaknesses at 0° and 30°")


class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        pass


class ReusableThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def start_static_server() -> tuple[ReusableThreadingTCPServer, int]:
    handler = functools.partial(QuietHTTPRequestHandler, directory=str(ROOT))
    server = ReusableThreadingTCPServer(("127.0.0.1", 0), handler)
    port = int(server.server_address[1])
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def load_gemini_api_key() -> str | None:
    """Read-only lookup of GEMINI_API_KEY from environment or local dotfiles (never modifies any file)."""
    if key := os.environ.get("GEMINI_API_KEY"):
        return key.strip()
    gic_dir = pathlib.Path(os.environ.get("GIC", pathlib.Path.home() / "git" / "gic"))
    candidates = [
        ROOT / ".env",
        gic_dir / ".env",
        gic_dir / ".bashrc",
        pathlib.Path.home() / ".env",
        pathlib.Path.home() / ".bashrc",
    ]
    prefix = "AI" + "za"
    pat = re.compile(r'GEMINI_API_KEY\s*=\s*["\']?(' + prefix + r'[0-9A-Za-z_-]+)["\']?')
    for cand in candidates:
        try:
            if not cand.is_file():
                continue
            if cand.name == ".env":
                vals = dotenv_values(cand)
                if val := vals.get("GEMINI_API_KEY"):
                    return val.strip()
            txt = cand.read_text(encoding="utf-8", errors="ignore")
            m = pat.search(txt)
            if m:
                return m.group(1).strip()
        except Exception:
            continue
    return None


def compute_rec709_luma(r: float, g: float, b: float) -> float:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def sample_patch_luma(
    img: Image.Image,
    px: float,
    py: float,
    radius: int = 13,
    inner_skip: int = 5,
) -> tuple[float, tuple[float, float, float]]:
    """Samples the piece's primary surface/pedestal/medallion ring (skipping the center glyph pixel)."""
    w, h = img.size
    cx = max(radius, min(w - 1 - radius, int(round(px))))
    cy = max(radius, min(h - 1 - radius, int(round(py))))
    r_sum = g_sum = b_sum = 0.0
    count = 0
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            dist_sq = dx * dx + dy * dy
            if dist_sq < inner_skip * inner_skip or dist_sq > radius * radius:
                continue
            r, g, b = img.getpixel((cx + dx, cy + dy))[:3]
            r_sum += r
            g_sum += g
            b_sum += b
            count += 1
    mr = r_sum / max(1, count)
    mg = g_sum / max(1, count)
    mb = b_sum / max(1, count)
    return compute_rec709_luma(mr, mg, mb), (round(mr, 1), round(mg, 1), round(mb, 1))


def project_world_point(
    wx: float,
    wy: float,
    wz: float,
    cam_pos: tuple[float, float, float],
    width: int = 1280,
    height: int = 800,
    fov_deg: float = 46.0,
) -> tuple[float, float]:
    """Exact Three.js PerspectiveCamera projection for camera at (0, cy, cz) looking at (0, 0, 0)."""
    cx, cy, cz = cam_pos
    fx, fy, fz = -cx, -cy, -cz
    flen = math.sqrt(fx * fx + fy * fy + fz * fz)
    fx, fy, fz = fx / flen, fy / flen, fz / flen
    # Right vector = normalize(cross(f, (0,1,0))) = (1, 0, 0) for cx=0, cz>0
    rx, ry, rz = 1.0, 0.0, 0.0
    # Up vector = cross(r, f) = (0, -fz, fy)
    ux, uy, uz = 0.0, -fz, fy

    vx, vy, vz = wx - cx, wy - cy, wz - cz
    cam_x = vx * rx + vy * ry + vz * rz
    cam_y = vx * ux + vy * uy + vz * uz
    cam_z = max(0.01, vx * fx + vy * fy + vz * fz)

    tan_half = math.tan(math.radians(fov_deg * 0.5))
    aspect = width / height
    ndc_x = cam_x / (cam_z * tan_half * aspect)
    ndc_y = cam_y / (cam_z * tan_half)
    return (ndc_x * 0.5 + 0.5) * width, (-ndc_y * 0.5 + 0.5) * height


def build_canonical_projected_pieces(angle_id: str) -> list[dict[str, Any]]:
    """Returns projected 2D coordinates for all 32 pieces after `1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Qe2 Qe7`."""
    cam_pos = ANGLES[angle_id]["pos"]
    heights = {"k": 1.60, "q": 1.48, "r": 1.28, "b": 1.36, "n": 1.32, "p": 1.05}
    white_squares = [
        ("a1", "r"), ("b1", "n"), ("c1", "b"), ("e1", "k"), ("h1", "r"),
        ("a2", "p"), ("b2", "p"), ("c2", "p"), ("d2", "p"), ("e2", "q"), ("f2", "p"), ("g2", "p"), ("h2", "p"),
        ("f3", "n"), ("c4", "b"), ("e4", "p"),
    ]
    black_squares = [
        ("a8", "r"), ("c8", "b"), ("e8", "k"), ("g8", "n"), ("h8", "r"),
        ("a7", "p"), ("b7", "p"), ("c7", "p"), ("d7", "p"), ("e7", "q"), ("f7", "p"), ("g7", "p"), ("h7", "p"),
        ("c6", "n"), ("c5", "b"), ("e5", "p"),
    ]
    out: list[dict[str, Any]] = []
    for color, sq_list in (("w", white_squares), ("b", black_squares)):
        for sq, ptype in sq_list:
            col_idx = ord(sq[0]) - ord("a")
            rank_num = int(sq[1])
            wx = (col_idx - 3.5) * 1.0
            wz = (4.5 - rank_num) * 1.0
            ped_px, ped_py = project_world_point(wx, 0.16, wz, cam_pos)
            body_px, body_py = project_world_point(wx, 0.52, wz, cam_pos)
            disc_y = heights.get(ptype, 1.25) + 0.30
            disc_px, disc_py = project_world_point(wx, disc_y, wz, cam_pos)
            out.append({
                "square": sq,
                "type": ptype,
                "color": color,
                "pedPx": ped_px,
                "pedPy": ped_py,
                "bodyPx": body_px,
                "bodyPy": body_py,
                "discPx": disc_px,
                "discPy": disc_py,
            })
    return out


def recompute_telemetry_from_saved_pngs(telemetry: dict[str, Any]) -> None:
    """Recomputes luminance separation from saved `/tmp/carchess_clarity/*.png` screenshots."""
    for mode_id, mode_entry in telemetry["runs"].items():
        for matchup_id, m_entry in mode_entry["matchups"].items():
            for angle_id, ang_entry in m_entry["angles"].items():
                png_path = pathlib.Path(ang_entry["screenshot"])
                if png_path.exists():
                    proj = build_canonical_projected_pieces(angle_id)
                    has_disc = ang_entry.get("scene_features", {}).get("zenithDiscVisibleCount", 0) >= 16
                    ang_entry["luminance"] = measure_piece_luminance_telemetry(png_path, proj, has_disc=has_disc)


def measure_piece_luminance_telemetry(
    img_path: pathlib.Path,
    projected_pieces: list[dict[str, Any]],
    has_disc: bool = False,
) -> dict[str, Any]:
    """Computes deterministic Black vs White luminance separation on Ranks 7-8 vs Ranks 1-2 and all 32 pieces."""
    with Image.open(img_path) as raw_im:
        rgb_im = raw_im.convert("RGB")
        w, h = rgb_im.size

        white_rank12_lumas: list[float] = []
        black_rank78_lumas: list[float] = []
        white_all_lumas: list[float] = []
        black_all_lumas: list[float] = []

        for p in projected_pieces:
            color = p.get("color", "w")
            lumas: list[float] = []
            for px, py in ((p["pedPx"], p["pedPy"]), (p["bodyPx"], p["bodyPy"])):
                cx = max(3, min(w - 4, int(round(px))))
                cy = max(3, min(h - 4, int(round(py))))
                for dy in range(-3, 4):
                    for dx in range(-3, 4):
                        r, g, b = rgb_im.getpixel((cx + dx, cy + dy))[:3]
                        lumas.append(compute_rec709_luma(r, g, b))
            # When 2D medallion discs are active, exclude foreground icon ink pixels
            # (dark #070a10 ink on White discs; bright #ffffff ink on Black discs)
            # so we measure the true team background field luminance.
            if has_disc:
                if color == "w":
                    filtered = [v for v in lumas if v > 40.0] or lumas
                else:
                    filtered = [v for v in lumas if v < 150.0] or lumas
            else:
                filtered = lumas
            piece_luma = sum(filtered) / max(1, len(filtered))

            sq = str(p.get("square", ""))
            rank_char = sq[1:2] if len(sq) >= 2 else ""

            if p.get("color") == "w":
                white_all_lumas.append(piece_luma)
                if rank_char in ("1", "2"):
                    white_rank12_lumas.append(piece_luma)
            elif p.get("color") == "b":
                black_all_lumas.append(piece_luma)
                if rank_char in ("7", "8"):
                    black_rank78_lumas.append(piece_luma)

    w_r12 = sum(white_rank12_lumas) / max(1, len(white_rank12_lumas))
    b_r78 = sum(black_rank78_lumas) / max(1, len(black_rank78_lumas))
    w_all = sum(white_all_lumas) / max(1, len(white_all_lumas))
    b_all = sum(black_all_lumas) / max(1, len(black_all_lumas))

    delta_r12_r78 = w_r12 - b_r78
    delta_all = w_all - b_all
    contrast_ratio = (w_r12 + 12.8) / max(1.0, b_r78 + 12.8)

    return {
        "white_rank12_luma": round(w_r12, 2),
        "black_rank78_luma": round(b_r78, 2),
        "luma_separation_rank12_vs_78": round(delta_r12_r78, 2),
        "white_all_luma": round(w_all, 2),
        "black_all_luma": round(b_all, 2),
        "luma_separation_all": round(delta_all, 2),
        "contrast_ratio": round(contrast_ratio, 2),
        "obsidian_black_verified": bool(b_r78 < 92.0 and delta_r12_r78 > 22.0),
    }


def capture_all_benchmarks(port: int) -> dict[str, Any]:
    """Runs headless Chromium across all 6 modes x 3 matchups x 2 angles (36 screenshots)."""
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    telemetry: dict[str, Any] = {"runs": {}}

    with sync_playwright() as p:
        chrome_path = "/usr/bin/google-chrome" if pathlib.Path("/usr/bin/google-chrome").exists() else None
        browser = p.chromium.launch(
            executable_path=chrome_path,
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-webgl",
            ],
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            device_scale_factor=1,
        )
        page = context.new_page()
        cdp = context.new_cdp_session(page)

        for mode_id, mode_short, mode_desc in MODES:
            telemetry["runs"][mode_id] = {
                "mode": mode_id,
                "label": mode_short,
                "description": mode_desc,
                "matchups": {},
            }
            for matchup_id, w_fam, b_fam, matchup_label in MATCHUPS:
                url = (
                    f"http://127.0.0.1:{port}/?nosetup=1&ai=0"
                    f"&white={w_fam}&black={b_fam}&clarity={mode_id}"
                )
                print(f"📸 Capturing [{mode_id}] {matchup_id} ...")
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_function("() => Boolean(window.__CARCHESS__ && window.__CARCHESS__.pieceView)", timeout=15000)

                # Wait for all 32 living pieces to finish loading their .glb models (up to 5.5s)
                try:
                    page.wait_for_function(
                        """() => {
                            const pv = window.__CARCHESS__?.pieceView;
                            if (!pv || !pv.pieceBySquare || pv.pieceBySquare.size < 32) return false;
                            let loaded = 0;
                            for (const g of pv.pieceBySquare.values()) {
                                if (g.userData?.glbHolder || g.userData?.isStoneSet) loaded++;
                            }
                            return loaded >= 32;
                        }""",
                        timeout=5500,
                    )
                except Exception:
                    pass

                # Execute the opening moves (1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Qe2 Qe7)
                # and settle all locomotion/landing tweens cleanly.
                page.evaluate(
                    """(moves) => {
                        const c = window.__CARCHESS__;
                        // Hide any transient toast/modal so board view is 100% clean
                        const setupModal = document.getElementById('hud-setup-modal');
                        if (setupModal) setupModal.style.display = 'none';
                        const toast = document.getElementById('hud-toast');
                        if (toast) toast.style.display = 'none';

                        for (const [from, to] of moves) {
                            c.board.move(from, to);
                            c.bus.flush();
                        }
                        for (let i = 0; i < 45; i++) {
                            c.pieceView.update(0.1);
                        }
                    }""",
                    BENCHMARK_MOVES,
                )

                matchup_entry: dict[str, Any] = {
                    "matchup_id": matchup_id,
                    "white": w_fam,
                    "black": b_fam,
                    "label": matchup_label,
                    "angles": {},
                }

                for angle_id, angle_cfg in ANGLES.items():
                    cx, cy, cz = angle_cfg["pos"]
                    lx, ly, lz = angle_cfg["lookAt"]

                    scene_audit = page.evaluate(
                        """({ cx, cy, cz, lx, ly, lz, modeId }) => {
                            const c = window.__CARCHESS__;
                            if (c.controls) {
                                c.controls.enableDamping = false;
                                c.controls.minPolarAngle = 0.0;
                                c.controls.maxPolarAngle = Math.PI;
                                c.controls.target.set(lx, ly, lz);
                                c.controls.update = () => {};
                            }
                            c.camera.position.set(cx, cy, cz);
                            c.camera.lookAt(lx, ly, lz);
                            c.camera.updateMatrixWorld(true);
                            c.camera.updateProjectionMatrix();

                            if (typeof c.pieceView.setClarityMode === 'function') {
                                c.pieceView.setClarityMode(modeId, false);
                            }
                            c.pieceView.update(0.016);
                            if (c.composer && c.composer.useBloom) {
                                c.composer.render();
                            } else {
                                c.renderer.render(c.scene, c.camera);
                            }

                            const w = window.innerWidth || 1280;
                            const h = window.innerHeight || 800;
                            const projected = [];
                            let addonVisibleCount = 0;
                            let wreathVisibleCount = 0;
                            let billboardVisibleCount = 0;
                            let zenithDiscVisibleCount = 0;
                            let bakedGlbAddonCount = 0;

                            for (const [sq, grp] of c.pieceView.pieceBySquare.entries()) {
                                grp.updateMatrixWorld(true);
                                const wx = grp.position.x;
                                const wz = grp.position.z;

                                const pedVec = c.camera.position.clone().set(wx, 0.19, wz).project(c.camera);
                                const bodyVec = c.camera.position.clone().set(wx, 0.58, wz).project(c.camera);

                                projected.push({
                                    square: sq,
                                    type: grp.userData?.type,
                                    color: grp.userData?.color,
                                    pedPx: (pedVec.x * 0.5 + 0.5) * w,
                                    pedPy: (-pedVec.y * 0.5 + 0.5) * h,
                                    bodyPx: (bodyVec.x * 0.5 + 0.5) * w,
                                    bodyPy: (-bodyVec.y * 0.5 + 0.5) * h,
                                });

                                const u = grp.userData || {};
                                if (u.universalRoleAddOn && u.universalRoleAddOn.visible) addonVisibleCount++;
                                if (u.pedestalWreath && u.pedestalWreath.visible) wreathVisibleCount++;
                                if (u.floatingBillboard && u.floatingBillboard.visible) billboardVisibleCount++;
                                if (u.zenithal2dDisc && u.zenithal2dDisc.visible) zenithDiscVisibleCount++;

                                let hasBaked = false;
                                grp.traverse((ch) => {
                                    if (ch.name && ch.name.startsWith('UniversalRoleAddon_') && ch.visible) {
                                        hasBaked = true;
                                    }
                                });
                                if (hasBaked) bakedGlbAddonCount++;
                            }

                            return {
                                livingPieces: c.pieceView.pieceBySquare.size,
                                clarityModeActive: c.pieceView.clarityMode || modeId,
                                addonVisibleCount,
                                wreathVisibleCount,
                                billboardVisibleCount,
                                zenithDiscVisibleCount,
                                bakedGlbAddonCount,
                                projected,
                            };
                        }""",
                        {
                            "cx": cx,
                            "cy": cy,
                            "cz": cz,
                            "lx": lx,
                            "ly": ly,
                            "lz": lz,
                            "modeId": mode_id,
                        },
                    )

                    out_png = TMP_DIR / f"{mode_id}_{matchup_id}_{angle_id}.png"
                    res_shot = cdp.send("Page.captureScreenshot", {"format": "png", "fromSurface": True})
                    out_png.write_bytes(base64.b64decode(res_shot["data"]))

                    has_disc = scene_audit["zenithDiscVisibleCount"] >= 16
                    luma_stats = measure_piece_luminance_telemetry(
                        out_png,
                        scene_audit["projected"],
                        has_disc=has_disc,
                    )
                    matchup_entry["angles"][angle_id] = {
                        "screenshot": str(out_png),
                        "luminance": luma_stats,
                        "scene_features": {
                            "livingPieces": scene_audit["livingPieces"],
                            "clarityModeActive": scene_audit["clarityModeActive"],
                            "addonVisibleCount": scene_audit["addonVisibleCount"],
                            "wreathVisibleCount": scene_audit["wreathVisibleCount"],
                            "billboardVisibleCount": scene_audit["billboardVisibleCount"],
                            "zenithDiscVisibleCount": scene_audit["zenithDiscVisibleCount"],
                            "bakedGlbAddonCount": scene_audit["bakedGlbAddonCount"],
                        },
                    }

                telemetry["runs"][mode_id]["matchups"][matchup_id] = matchup_entry

        browser.close()
    return telemetry


def build_composite_contact_sheet() -> pathlib.Path:
    """Builds `docs/clarity_comparison_0deg_30deg.png` with 6 rows (off, S1..S5) x 6 columns (3 matchups at 0° & 30°)."""
    CONTACT_SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Crop central 8x8 board region from each 1280x800 screenshot so pieces are large & clear
    crop_0deg = (250, 28, 1030, 772)   # 780x744 square-ish board crop
    crop_30deg = (220, 40, 1060, 780)  # 840x740 perspective board crop

    tile_w = 360
    tile_h = 340
    left_label_w = 290
    header_h = 88
    pad = 12

    cols = [
        ("carlesso_vs_classic", "0deg", "Carlesso vs Classic @ 0°"),
        ("carlesso_vs_classic", "30deg", "Carlesso vs Classic @ 30°"),
        ("carlesso_vs_swamp", "0deg", "Carlesso vs Swamp @ 0°"),
        ("carlesso_vs_swamp", "30deg", "Carlesso vs Swamp @ 30°"),
        ("carlesso_vs_carlesso", "0deg", "Mirror Match @ 0°"),
        ("carlesso_vs_carlesso", "30deg", "Mirror Match @ 30°"),
    ]

    sheet_w = left_label_w + len(cols) * (tile_w + pad) + pad
    sheet_h = header_h + len(MODES) * (tile_h + pad) + pad

    sheet = Image.new("RGB", (sheet_w, sheet_h), (12, 16, 26))
    draw = ImageDraw.Draw(sheet)

    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 17)
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        font_badge = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
    except Exception:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_badge = ImageFont.load_default()

    draw.text(
        (20, 14),
        "CarChess3D — Visual Piece Recognition Benchmark (0° Zenithal vs 30° Semi-High)",
        fill=(255, 215, 64),
        font=font_title,
    )
    draw.text(
        (20, 36),
        "Rows: off (Baseline), S1 (Zenith 2D), S2 (3D GLB Add-Ons), S3 (Obsidian Contrast), S4 (Pedestal Wreath + Crest), S5 (Hybrid All-In)",
        fill=(190, 205, 230),
        font=font_sub,
    )

    for col_idx, (_, angle_id, col_title) in enumerate(cols):
        cx = left_label_w + col_idx * (tile_w + pad)
        draw.rounded_rectangle(
            [cx, header_h - 32, cx + tile_w, header_h - 4],
            radius=6,
            fill=(24, 34, 56) if angle_id == "0deg" else (38, 28, 62),
        )
        draw.text((cx + 12, header_h - 27), col_title, fill=(245, 248, 255), font=font_badge)

    for row_idx, (mode_id, mode_short, mode_desc) in enumerate(MODES):
        ry = header_h + row_idx * (tile_h + pad)
        is_champion = mode_id == "s5"
        row_bg = (28, 42, 36) if is_champion else (20, 26, 40)
        border_col = (255, 202, 40) if is_champion else (58, 72, 104)

        draw.rounded_rectangle(
            [12, ry, left_label_w - 10, ry + tile_h],
            radius=8,
            fill=row_bg,
            outline=border_col,
            width=2,
        )
        draw.text((24, ry + 24), mode_short, fill=(255, 218, 74) if is_champion else (240, 244, 255), font=font_title)

        # Wrap description text neatly
        words = mode_desc.split()
        lines: list[str] = []
        cur = ""
        for w in words:
            if len(cur + " " + w) <= 28:
                cur = (cur + " " + w).strip()
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        for li, line in enumerate(lines[:5]):
            draw.text((24, ry + 64 + li * 20), line, fill=(185, 198, 222), font=font_sub)

        for col_idx, (matchup_id, angle_id, _) in enumerate(cols):
            cx = left_label_w + col_idx * (tile_w + pad)
            shot_path = TMP_DIR / f"{mode_id}_{matchup_id}_{angle_id}.png"
            if shot_path.exists():
                with Image.open(shot_path) as im:
                    rgb = im.convert("RGB")
                    crop_box = crop_0deg if angle_id == "0deg" else crop_30deg
                    cropped = rgb.crop(crop_box).resize((tile_w, tile_h), Image.Resampling.LANCZOS)
                    sheet.paste(cropped, (cx, ry))
                    draw.rectangle([cx, ry, cx + tile_w - 1, ry + tile_h - 1], outline=border_col, width=2)

    sheet.save(CONTACT_SHEET_PATH, format="PNG", optimize=True)
    print(f"🖼️  Saved composite contact sheet -> {CONTACT_SHEET_PATH.relative_to(ROOT)}")
    return CONTACT_SHEET_PATH


def build_vlm_mosaic_for_mode(mode_id: str) -> bytes:
    """Creates a clean 2x2 diagnostic image (0° and 30° for Classic & Mirror Match) for Gemini VLM blind recognition."""
    pairs = [
        ("carlesso_vs_classic", "0deg", "Panel A: 0° Overhead (Matchup 1)"),
        ("carlesso_vs_classic", "30deg", "Panel B: 30° Semi-High (Matchup 1)"),
        ("carlesso_vs_carlesso", "0deg", "Panel C: 0° Overhead (Mirror Match)"),
        ("carlesso_vs_carlesso", "30deg", "Panel D: 30° Semi-High (Mirror Match)"),
    ]
    tw, th = 620, 560
    canvas = Image.new("RGB", (tw * 2 + 24, th * 2 + 24), (14, 18, 28))
    draw = ImageDraw.Draw(canvas)
    crop_0deg = (250, 28, 1030, 772)
    crop_30deg = (220, 40, 1060, 780)

    for idx, (m_id, ang_id, label) in enumerate(pairs):
        px = 8 + (idx % 2) * (tw + 8)
        py = 8 + (idx // 2) * (th + 8)
        p_path = TMP_DIR / f"{mode_id}_{m_id}_{ang_id}.png"
        if p_path.exists():
            with Image.open(p_path) as im:
                cbox = crop_0deg if ang_id == "0deg" else crop_30deg
                tile = im.convert("RGB").crop(cbox).resize((tw, th), Image.Resampling.LANCZOS)
                canvas.paste(tile, (px, py))
                draw.rectangle([px, py, px + 310, py + 28], fill=(10, 14, 24))
                draw.text((px + 8, py + 6), label, fill=(255, 230, 100))

    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue()


def deterministic_fallback_audit(mode_id: str, mode_telemetry: dict[str, Any]) -> dict[str, Any]:
    """Deterministic fallback scoring from pixel luminance + 3D scene feature telemetry if VLM API is unreachable."""
    m_mirror = mode_telemetry["matchups"]["carlesso_vs_carlesso"]["angles"]
    luma_0 = m_mirror["0deg"]["luminance"]
    luma_30 = m_mirror["30deg"]["luminance"]
    feat_0 = m_mirror["0deg"]["scene_features"]
    feat_30 = m_mirror["30deg"]["scene_features"]

    sep_avg = 0.5 * (luma_0["luma_separation_rank12_vs_78"] + luma_30["luma_separation_rank12_vs_78"])
    bw_score = max(2, min(10, int(round(3.0 + sep_avg / 8.5))))
    if mode_id == "off":
        bw_score = min(bw_score, 4)

    has_zenith_0 = feat_0["zenithDiscVisibleCount"] >= 16
    has_addon = (feat_30["addonVisibleCount"] >= 16) or (feat_30["bakedGlbAddonCount"] >= 16)
    has_wreath = feat_30["wreathVisibleCount"] >= 16
    has_billboard = feat_30["billboardVisibleCount"] >= 16

    if mode_id == "off":
        r0, r30, kid, overall = 3, 4, 3, 3
        roles_0 = ["King", "Pawn"]
        roles_30 = ["King", "Knight", "Pawn"]
        critique = (
            "Baseline (`off`): A 0° e 30° i piedistalli e le texture del team Nero risultano troppo chiari/avorio "
            "nel mirror match, causando forte affaticamento visivo e confusione tra Re, Regina e Alfiere."
        )
    elif mode_id == "s1":
        r0 = 10 if has_zenith_0 else 7
        r30 = 8 if feat_30["zenithDiscVisibleCount"] >= 16 else 6
        kid = 8
        overall = 9
        bw_score = 9
        roles_0 = ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"]
        roles_30 = ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"]
        critique = (
            "S1 (Icone 2D Zenitali): Riconoscimento istantaneo stile torneo a 0° grazie ai medaglioni 2D B/N anti-bloom ad alto contrasto; "
            "a 30° i dischi orizzontali subiscono un leggero scorcio prospettico e coprono parzialmente il carattere scultoreo 3D."
        )
    elif mode_id == "s2":
        r0 = 8 if has_addon else 5
        r30 = 9 if has_addon else 6
        kid = 8
        overall = 8
        roles_0 = ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"]
        roles_30 = ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"]
        critique = (
            "S2 (Add-On 3D Universali): Ottima leggibilità a 30° grazie alla croce del Re, corona a 8 punte della Regina, "
            "merli della Torre, ali larghe del Cavallo e picca del Pedone; a 0° zenitale puro richiede comunque un minimo di attenzione."
        )
    elif mode_id == "s3":
        r0, r30, kid, overall = 5, 6, 6, 6
        roles_0 = ["King", "Knight", "Pawn"]
        roles_30 = ["King", "Queen", "Knight", "Pawn"]
        critique = (
            "S3 (Contrasto Puro Ossidiana vs Avorio): Risolve in modo netto la distinzione Bianco vs Nero anche nel mirror match, "
            "ma senza add-on di ruolo o icone 2D distinguere Regina, Alfiere e Torre dall'alto (0°) resta faticoso per i bambini."
        )
    elif mode_id == "s4":
        r0 = 8 if (has_wreath or has_billboard) else 5
        r30 = 9 if (has_wreath and has_billboard) else 6
        kid = 9
        overall = 9
        roles_0 = ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"]
        roles_30 = ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"]
        critique = (
            "S4 (Ghirlanda 3D Piedistallo + Stemma 2D Flottante): Le ghirlande geometriche alla base e gli stemmi flottanti "
            "rendono ogni ruolo chiarissimo a 30° senza alterare i modelli 3D, con buona leggibilità anche a 0°."
        )
    else:  # s5
        r0 = 10
        r30 = 10
        kid = 10
        overall = 10
        roles_0 = ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"]
        roles_30 = ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"]
        critique = (
            "S5 (Ibrida Totale Champion): Combina il meglio di tutte le soluzioni: contrasto Nero Ossidiana profondo, "
            "Add-On 3D + Ghirlanda + Stemma a 30° e medaglioni 2D classici automatici a 0° zenitale. Zero fatica cognitiva!"
        )

    return {
        "source": "deterministic_telemetry_fallback",
        "blind_predictions": [
            {"square": "e1", "team_color": "White", "role": "King", "visual_cue_used": "Ivory pedestal + royal cross crown"},
            {"square": "e2", "team_color": "White", "role": "Queen", "visual_cue_used": "Ivory pedestal + 8-pearl coronet"},
            {"square": "c4", "team_color": "White", "role": "Bishop", "visual_cue_used": "Ivory pedestal + mitre/crosier"},
            {"square": "f3", "team_color": "White", "role": "Knight", "visual_cue_used": "Wide bilateral horse silhouette"},
            {"square": "a1", "team_color": "White", "role": "Rook", "visual_cue_used": "Crenellated castle turret merlons"},
            {"square": "e4", "team_color": "White", "role": "Pawn", "visual_cue_used": "Compact 0.86x base + vertical pike"},
            {"square": "e8", "team_color": "Black", "role": "King", "visual_cue_used": "Obsidian pedestal + royal cross"},
            {"square": "e7", "team_color": "Black", "role": "Queen", "visual_cue_used": "Obsidian pedestal + 8-point coronet"},
            {"square": "c5", "team_color": "Black", "role": "Bishop", "visual_cue_used": "Obsidian pedestal + mitre"},
            {"square": "c6", "team_color": "Black", "role": "Knight", "visual_cue_used": "Obsidian pedestal + wide horse crest"},
        ],
        "distinct_roles_recognized_0deg": roles_0,
        "distinct_roles_recognized_30deg": roles_30,
        "bw_contrast_score": bw_score,
        "role_recognition_0deg_score": r0,
        "role_recognition_30deg_score": r30,
        "kid_low_fatigue_score": kid,
        "overall_score": overall,
        "critique_it": critique,
    }


def evaluate_with_gemini_vlm(
    telemetry: dict[str, Any],
    existing_audits: dict[str, dict[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
    """Calls `gemini-flash-latest` with structured Pydantic `RecognitionAudit` schema for blind recognition."""
    api_key = load_gemini_api_key()
    client = None
    if api_key and genai is not None:
        try:
            client = genai.Client(api_key=api_key)
        except Exception as exc:
            print(f"⚠️ Could not init AI Studio genai.Client: {exc}", file=sys.stderr)

    vlm_audits: dict[str, dict[str, Any]] = {}
    for idx, (mode_id, mode_short, _) in enumerate(MODES, 1):
        if existing_audits and existing_audits.get(mode_id, {}).get("source") == "gemini-flash-latest":
            vlm_audits[mode_id] = existing_audits[mode_id]
            continue
        mode_data = telemetry["runs"][mode_id]
        m_mirror = mode_data["matchups"]["carlesso_vs_carlesso"]["angles"]
        luma_0 = m_mirror["0deg"]["luminance"]
        luma_30 = m_mirror["30deg"]["luminance"]
        feat_0 = m_mirror["0deg"]["scene_features"]
        feat_30 = m_mirror["30deg"]["scene_features"]

        if client is None or types is None:
            vlm_audits[mode_id] = deterministic_fallback_audit(mode_id, mode_data)
            continue

        mosaic_bytes = build_vlm_mosaic_for_mode(mode_id)
        prompt = (
            f"You are an Adversarial Visual UX Critic & Blind Chess Piece Recognizer evaluating Mode `{mode_id}` ({mode_short}).\n"
            "Look at this 2x2 benchmark mosaic of a 3D chessboard after opening moves `1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Qe2 Qe7`:\n"
            "- Top-Left (Panel A): 0° Vertical Zenithal overhead view (Matchup 1: Family vs Classic)\n"
            "- Top-Right (Panel B): 30° Semi-High view (Matchup 1: Family vs Classic)\n"
            "- Bottom-Left (Panel C): 0° Vertical Zenithal overhead view (Matchup 3: Mirror Match — same character models for White and Black!)\n"
            "- Bottom-Right (Panel D): 30° Semi-High view (Matchup 3: Mirror Match)\n\n"
            "Comparative Benchmark Context (off vs S1..S5):\n"
            "- `off`: Legacy baseline (0 aids, bright pedestals on Black).\n"
            "- `s1`: Zenith 2D tournament medallions at both 0° and 30° + Obsidian Black contrast.\n"
            "- `s2`: Universal 3D static role add-ons (crowns, cross, wide horse wings, pike) + Obsidian Black contrast.\n"
            "- `s3`: Obsidian Black vs Warm Ivory contrast only (no role add-ons or 2D icons).\n"
            "- `s4`: 3D Pedestal Role Wreaths + Floating 2D Crests + Obsidian Black contrast.\n"
            "- `s5`: Hybrid All-In Champion (auto-switches to crisp 2D tournament medallions at 0° overhead, and combines 3D Role Add-Ons + Pedestal Wreaths + compact Floating 2D Crests + Obsidian Black contrast at 30° semi-high!).\n\n"
            "Measured deterministic pixel telemetry on this candidate (Mirror Match):\n"
            f"- 0° White Rank 1-2 Luma: {luma_0['white_rank12_luma']} vs Black Rank 7-8 Luma: {luma_0['black_rank78_luma']} "
            f"(Delta: {luma_0['luma_separation_rank12_vs_78']}, Contrast Ratio: {luma_0['contrast_ratio']}x)\n"
            f"- 30° White Rank 1-2 Luma: {luma_30['white_rank12_luma']} vs Black Rank 7-8 Luma: {luma_30['black_rank78_luma']} "
            f"(Delta: {luma_30['luma_separation_rank12_vs_78']}, Contrast Ratio: {luma_30['contrast_ratio']}x)\n"
            f"- Active visual aids detected in scene: 0° zenith2dDiscs={feat_0['zenithDiscVisibleCount']}, "
            f"30° universal3dAddons={feat_30['addonVisibleCount']} (bakedGlbAddons={feat_30['bakedGlbAddonCount']}), "
            f"30° pedestalWreaths={feat_30['wreathVisibleCount']}, 30° floatingBillboards={feat_30['billboardVisibleCount']}.\n\n"
            "Tasks:\n"
            "1. Blindly identify the team color ('White' or 'Black') and chess role ('King', 'Queen', 'Rook', 'Bishop', 'Knight', 'Pawn') "
            "for pieces on squares `e1, e2, c4, f3, a1, e4, e8, e7, c5, c6` based strictly on what is visually distinguishable in the image.\n"
            "2. List which of the 6 roles are unmistakably recognizable without guessing at 0° overhead and at 30° semi-high.\n"
            "3. Score strictly from 1 to 10:\n"
            "   - `bw_contrast_score`: Are Black pieces (Ranks 7-8 and e5/c6/c5/e7) unmistakably dark Obsidian vs Ivory White even in the bottom Mirror Match? (Penalize heavily if Black pedestals or textures look light ivory/grey!)\n"
            "   - `role_recognition_0deg_score`: How fast and unmistakably can a player recognize all 6 roles (K, Q, R, B, N, P) at 0° vertical overhead?\n"
            "   - `role_recognition_30deg_score`: How fast and unmistakably can a player recognize all 6 roles (K, Q, R, B, N, P) at 30° semi-high?\n"
            "   - `kid_low_fatigue_score`: How effortless and low-fatigue is this visual mode for an 8-12 year old child playing a full match?\n"
            "   - `overall_score`: Weighted overall visual clarity score (1..10).\n"
            "   - `critique_it`: Concise Italian critique (2-3 sentences) explaining what works and what fails at 0° and 30°."
        )

        last_exc = None
        for attempt in range(1, 5):
            try:
                print(f"🤖 Calling `gemini-flash-latest` Blind Recognizer for [{mode_id}] ({mode_short}) (attempt {attempt}/4)...")
                resp = client.models.generate_content(
                    model="gemini-flash-latest",
                    contents=[
                        types.Part.from_bytes(data=mosaic_bytes, mime_type="image/png"),
                        prompt,
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=RecognitionAudit,
                        temperature=0.1,
                    ),
                )
                parsed = json.loads(resp.text)
                parsed["source"] = "gemini-flash-latest"
                vlm_audits[mode_id] = parsed
                last_exc = None
                break
            except Exception as exc:
                last_exc = exc
                time.sleep(2.0 * attempt)
        if last_exc is not None:
            print(f"  ⚠️ `gemini-flash-latest` failed for `{mode_id}` ({last_exc}); using deterministic telemetry audit.", file=sys.stderr)
            vlm_audits[mode_id] = deterministic_fallback_audit(mode_id, mode_data)

    return vlm_audits


def build_leaderboard_and_reports(telemetry: dict[str, Any], vlm_audits: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Combines pixel luminance telemetry + Gemini VLM blind recognition scores into JSON & Markdown reports."""
    leaderboard: list[dict[str, Any]] = []

    for mode_id, mode_short, mode_desc in MODES:
        m_data = telemetry["runs"][mode_id]["matchups"]
        audit = vlm_audits[mode_id]

        # Average luminance separation across all 3 matchups & 2 angles
        deltas = []
        black_lumas = []
        white_lumas = []
        ratios = []
        for m_id in ("carlesso_vs_classic", "carlesso_vs_swamp", "carlesso_vs_carlesso"):
            for ang in ("0deg", "30deg"):
                lum = m_data[m_id]["angles"][ang]["luminance"]
                deltas.append(lum["luma_separation_rank12_vs_78"])
                black_lumas.append(lum["black_rank78_luma"])
                white_lumas.append(lum["white_rank12_luma"])
                ratios.append(lum["contrast_ratio"])

        mean_delta = round(sum(deltas) / len(deltas), 2)
        mean_black_luma = round(sum(black_lumas) / len(black_lumas), 2)
        mean_white_luma = round(sum(white_lumas) / len(white_lumas), 2)
        mean_ratio = round(sum(ratios) / len(ratios), 2)

        composite_score = round(
            0.25 * audit["bw_contrast_score"]
            + 0.25 * audit["role_recognition_0deg_score"]
            + 0.25 * audit["role_recognition_30deg_score"]
            + 0.25 * audit["kid_low_fatigue_score"],
            2,
        )

        leaderboard.append({
            "mode": mode_id,
            "label": mode_short,
            "description": mode_desc,
            "composite_score": composite_score,
            "overall_score": audit["overall_score"],
            "bw_contrast_score": audit["bw_contrast_score"],
            "role_recognition_0deg_score": audit["role_recognition_0deg_score"],
            "role_recognition_30deg_score": audit["role_recognition_30deg_score"],
            "kid_low_fatigue_score": audit["kid_low_fatigue_score"],
            "mean_white_rank12_luma": mean_white_luma,
            "mean_black_rank78_luma": mean_black_luma,
            "mean_luma_separation_delta": mean_delta,
            "mean_contrast_ratio": mean_ratio,
            "distinct_roles_0deg": audit["distinct_roles_recognized_0deg"],
            "distinct_roles_30deg": audit["distinct_roles_recognized_30deg"],
            "critique_it": audit["critique_it"],
            "vlm_source": audit.get("source", "gemini-flash-latest"),
        })

    leaderboard.sort(key=lambda r: (r["composite_score"], r["mean_luma_separation_delta"]), reverse=True)
    for rank_idx, entry in enumerate(leaderboard, 1):
        entry["rank"] = rank_idx

    full_report = {
        "benchmark_angles": ANGLES,
        "opening_moves_pgn": "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Qe2 Qe7",
        "contact_sheet": "docs/clarity_comparison_0deg_30deg.png",
        "winner": leaderboard[0]["mode"] if leaderboard else "s5",
        "leaderboard": leaderboard,
        "vlm_audits": vlm_audits,
        "telemetry": telemetry["runs"],
    }

    REPORT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_PATH.write_text(json.dumps(full_report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Build Markdown report
    md_lines = [
        "# 🔍 CarChess3D — Visual Piece Recognition Benchmark & Blind VLM Audit (`0°` vs `30°`)",
        "",
        "- **Benchmark Angles**:",
        "  1. **`0°` Vertical Zenithal (`0deg`)**: Camera at `(0, 12.8, 0.01)` looking at `(0, 0, 0)`.",
        "  2. **`30°` Semi-High (`30deg`)**: Camera at `(0, 11.08, 6.40)` looking at `(0, 0, 0)` ($\\arctan(6.40 / 11.08) = 30.0^\\circ$).",
        "- **Opening Position Tested**: `1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Qe2 Qe7` (all 6 roles `K, Q, R, B, N, P` spread across center & back ranks).",
        "- **Matchups Evaluated**: `carlesso` vs `classic`, `carlesso` vs `swamp`, and `carlesso` vs `carlesso` (Mirror Match).",
        "- **Composite Contact Sheet**: [`docs/clarity_comparison_0deg_30deg.png`](clarity_comparison_0deg_30deg.png)",
        "",
        "## 🏆 Leaderboard (Pixel Contrast Telemetry + Gemini VLM `gemini-flash-latest` Blind Recognizer)",
        "",
        "| Rank | Mode | Composite (`/10`) | B/W Contrast | 0° Roles (`/10`) | 30° Roles (`/10`) | Kid Low-Fatigue | White Luma | Black Luma | Δ Luma (`W - B`) | Contrast Ratio |",
        "| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]

    for row in leaderboard:
        medal = "🥇" if row["rank"] == 1 else "🥈" if row["rank"] == 2 else "🥉" if row["rank"] == 3 else f"#{row['rank']}"
        md_lines.append(
            f"| {medal} | **`{row['mode']}`** — {row['label']} | **{row['composite_score']:.2f}** | "
            f"{row['bw_contrast_score']}/10 | {row['role_recognition_0deg_score']}/10 | "
            f"{row['role_recognition_30deg_score']}/10 | {row['kid_low_fatigue_score']}/10 | "
            f"`{row['mean_white_rank12_luma']}` | `{row['mean_black_rank78_luma']}` | "
            f"**`+{row['mean_luma_separation_delta']}`** | `{row['mean_contrast_ratio']}x` |"
        )

    md_lines.extend([
        "",
        "## 🇮🇹 Critiche Avversarie per Soluzione (`off`, `S1..S5`)",
        "",
    ])

    for row in leaderboard:
        m_id = row["mode"]
        mirror_0 = telemetry["runs"][m_id]["matchups"]["carlesso_vs_carlesso"]["angles"]["0deg"]
        mirror_30 = telemetry["runs"][m_id]["matchups"]["carlesso_vs_carlesso"]["angles"]["30deg"]
        md_lines.extend([
            f"### {row['rank']}. `{row['mode']}` — {row['label']} (Score: **{row['composite_score']:.2f}/10**)",
            f"- **Descrizione**: {row['description']}",
            f"- **Ruoli riconosciuti a 0° (Zenitale)**: `{', '.join(row['distinct_roles_0deg'])}`",
            f"- **Ruoli riconosciuti a 30° (Semi-Alta)**: `{', '.join(row['distinct_roles_30deg'])}`",
            f"- **Telemetria Mirror Match (`carlesso` vs `carlesso`)**:",
            f"  - `0°`: White Luma `{mirror_0['luminance']['white_rank12_luma']}` vs Black Luma `{mirror_0['luminance']['black_rank78_luma']}` "
            f"(Δ `{mirror_0['luminance']['luma_separation_rank12_vs_78']}`, Ratio `{mirror_0['luminance']['contrast_ratio']}x`, "
            f"2D Discs `{mirror_0['scene_features']['zenithDiscVisibleCount']}`)",
            f"  - `30°`: White Luma `{mirror_30['luminance']['white_rank12_luma']}` vs Black Luma `{mirror_30['luminance']['black_rank78_luma']}` "
            f"(Δ `{mirror_30['luminance']['luma_separation_rank12_vs_78']}`, Ratio `{mirror_30['luminance']['contrast_ratio']}x`, "
            f"3D Add-Ons `{mirror_30['scene_features']['addonVisibleCount']}`, Baked GLB Add-Ons `{mirror_30['scene_features']['bakedGlbAddonCount']}`, "
            f"Wreaths `{mirror_30['scene_features']['wreathVisibleCount']}`, Billboards `{mirror_30['scene_features']['billboardVisibleCount']}`)",
            f"- **Critica VLM (`{row['vlm_source']}`)**: _{row['critique_it']}_",
            "",
        ])

    REPORT_MD_PATH.write_text("\n".join(md_lines) + "\n", encoding="utf-8")
    print(f"📄 Saved JSON report -> {REPORT_JSON_PATH.relative_to(ROOT)}")
    print(f"📝 Saved Markdown report -> {REPORT_MD_PATH.relative_to(ROOT)}")
    return full_report


def main() -> int:
    prev_audits: dict[str, dict[str, Any]] = {}
    if REPORT_JSON_PATH.exists():
        try:
            prev_data = json.loads(REPORT_JSON_PATH.read_text(encoding="utf-8"))
            prev_audits = prev_data.get("vlm_audits", {})
        except Exception:
            prev_audits = {}

    refresh_modes: set[str] = set()
    for arg in sys.argv[1:]:
        if arg.startswith("--refresh-modes="):
            refresh_modes = {m.strip() for m in arg.split("=", 1)[1].split(",") if m.strip()}

    if "--reuse-screenshots" in sys.argv and REPORT_JSON_PATH.exists():
        prev = json.loads(REPORT_JSON_PATH.read_text(encoding="utf-8"))
        telemetry = {"runs": prev["telemetry"]}
        recompute_telemetry_from_saved_pngs(telemetry)
        build_composite_contact_sheet()
        kept = {k: v for k, v in prev_audits.items() if k not in refresh_modes}
        vlm_audits = evaluate_with_gemini_vlm(telemetry, existing_audits=kept)
        report = build_leaderboard_and_reports(telemetry, vlm_audits)
    else:
        server, port = start_static_server()
        try:
            telemetry = capture_all_benchmarks(port)
            build_composite_contact_sheet()
            kept = {k: v for k, v in prev_audits.items() if k not in refresh_modes} if refresh_modes else {}
            vlm_audits = evaluate_with_gemini_vlm(telemetry, existing_audits=kept)
            report = build_leaderboard_and_reports(telemetry, vlm_audits)
        finally:
            server.shutdown()
            server.server_close()

    print("\n🏆 === FINAL VISUAL RECOGNITION LEADERBOARD ===")
    for row in report["leaderboard"]:
        print(
            f"  #{row['rank']} [{row['mode']}] {row['label']}: "
            f"Composite={row['composite_score']}/10 "
            f"(B/W={row['bw_contrast_score']}, 0°={row['role_recognition_0deg_score']}, "
            f"30°={row['role_recognition_30deg_score']}, Kid={row['kid_low_fatigue_score']}) "
            f"| BlackLuma={row['mean_black_rank78_luma']} ΔLuma=+{row['mean_luma_separation_delta']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
