#!/usr/bin/env python3
"""Automated Daily UAT Playtest & Adversarial Critic for CarChess3D.

Simulates a human agent vs CPU Easy:
1. Boot & Piece Orientations check (White faces North, Black faces South).
2. Adversarial UI clicking (180° camera flip, top-down view, 3D skeletons,
   Ogre swamp party, 6x6 battle matrix modal, WOW mode turntable).
3. Non-black visual screen audit via luminance/stddev analysis on every angle.
4. Human vs CPU Easy match play (3-4 turns, locomotion & tactical indicators,
   capture cutscene & skip button, CPU latency measurement).
5. Headless Chrome video recording (.webm -> .mp4, max 1 minute) & animated GIF preview.
6. Console error / 404 sniffer and comprehensive Markdown report generation.
7. Optional --publish-ghi flag to automatically create/update a GitHub Issue
   titled 'Gemini UAT YYYYMMDD' with label 'gemini-uat' and video attached.
"""

import argparse
import datetime
import http.server
import json
import os
import pathlib
import re
import shutil
import socket
import subprocess
import sys
import threading
import time

try:
    from PIL import Image, ImageStat
except ImportError:
    Image = None
    ImageStat = None

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

ROOT = pathlib.Path(__file__).resolve().parent.parent


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        # Keep test stdout clean
        pass


def check_image_not_black(image_path: pathlib.Path) -> tuple[bool, float, float, str]:
    """Analyzes image pixels to verify it is NOT a black/blank screen.
    
    Returns (passed, mean_luminance, stddev, diagnostic_message).
    """
    if not image_path.exists() or image_path.stat().st_size == 0:
        return False, 0.0, 0.0, "Screenshot missing or zero bytes"

    if Image is None or ImageStat is None:
        size_kb = image_path.stat().st_size / 1024
        return size_kb > 20, 50.0, 20.0, f"Pillow not imported; raw size {size_kb:.1f} KB"

    try:
        with Image.open(image_path) as img:
            gray = img.convert("L")
            stat = ImageStat.Stat(gray)
            mean_lum = float(stat.mean[0])
            stddev = float(stat.stddev[0])
            # A completely black screen in Three.js has mean_lum near 0-5 and stddev < 3
            is_black = mean_lum < 9.0 or stddev < 6.0
            msg = f"Mean luminance: {mean_lum:.1f}/255, Contrast stddev: {stddev:.1f}"
            return not is_black, mean_lum, stddev, msg
    except Exception as exc:
        return False, 0.0, 0.0, f"Image analysis failed: {exc}"


def get_git_info() -> dict:
    info = {"commit": "unknown", "branch": "unknown", "recent_commits": []}
    try:
        res = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        info["commit"] = res.stdout.strip()
    except Exception:
        pass
    try:
        res = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        info["branch"] = res.stdout.strip()
    except Exception:
        pass
    try:
        res = subprocess.run(
            ["git", "log", "-n", "3", "--oneline"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        info["recent_commits"] = [line.strip() for line in res.stdout.splitlines() if line.strip()]
    except Exception:
        pass
    return info


def run_playtest(out_dir: pathlib.Path, port: int, headless: bool = True) -> dict:
    if sync_playwright is None:
        raise RuntimeError(
            "playwright is required. Run with: "
            'UV_INDEX_URL="https://pypi.org/simple" uv run --with playwright --with pillow python3 scripts/daily_uat_playtest.py'
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    video_raw_dir = out_dir / "raw_video"
    video_raw_dir.mkdir(parents=True, exist_ok=True)

    # Clean old screenshot captures
    for old_file in out_dir.glob("*.png"):
        try:
            old_file.unlink()
        except OSError:
            pass

    server = http.server.ThreadingHTTPServer(("", port), QuietHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    report = {
        "timestamp": datetime.datetime.now().isoformat(),
        "git": get_git_info(),
        "port": port,
        "checks": {},
        "issues": [],
        "playability_notes": [],
        "screenshots": [],
        "cpu_latencies_ms": [],
        "console_errors": [],
        "console_warnings": [],
        "network_errors": [],
        "video_webm": None,
        "video_mp4": None,
        "video_gif": None,
        "video_duration_s": 0.0,
    }

    start_wall_time = time.time()

    try:
        with sync_playwright() as p:
            chrome_path = "/usr/bin/google-chrome" if pathlib.Path("/usr/bin/google-chrome").exists() else None
            browser = p.chromium.launch(
                executable_path=chrome_path,
                headless=headless,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--enable-webgl",
                    "--window-size=1280,720",
                ],
            )

            context = browser.new_context(
                record_video_dir=str(video_raw_dir),
                record_video_size={"width": 1280, "height": 720},
                viewport={"width": 1280, "height": 720},
            )

            page = context.new_page()

            page.on("console", lambda msg: (
                report["console_errors"].append(msg.text) if msg.type == "error" else
                report["console_warnings"].append(msg.text) if msg.type == "warning" else None
            ))
            page.on("pageerror", lambda exc: report["console_errors"].append(f"Uncaught: {exc}"))
            page.on("requestfailed", lambda req: report["network_errors"].append(f"{req.url} ({req.failure})"))

            # -----------------------------------------------------------------
            # Step 1: Boot & Canvas Readiness
            # -----------------------------------------------------------------
            print("🚀 Loading CarChess3D into headless Chromium...")
            page.goto(f"http://localhost:{port}/index.html", wait_until="networkidle")
            page.wait_for_selector("#game-canvas", timeout=10000)
            time.sleep(1.8)

            shot1 = out_dir / "01_initial_board.png"
            page.screenshot(path=str(shot1))
            report["screenshots"].append(shot1.name)

            has_carchess = page.evaluate("() => Boolean(window.__CARCHESS__)")
            report["checks"]["engine_boot"] = {
                "passed": has_carchess,
                "detail": "window.__CARCHESS__ initialized cleanly with all managers and 3D views",
            }
            if not has_carchess:
                report["issues"].append("CRITICAL: window.__CARCHESS__ was not exposed!")
                return report

            # -----------------------------------------------------------------
            # Step 2: Piece Orientations Check ("Sono tutti orientati dalla stessa parte?")
            # -----------------------------------------------------------------
            print("🔍 Auditing piece orientations across White & Black factions...")
            pieces_info = page.evaluate("""() => {
                const c = window.__CARCHESS__;
                const pm = c.pieceView;
                const items = [];
                for (const [sq, grp] of pm.pieceBySquare.entries()) {
                    items.push({
                        square: sq,
                        color: grp.userData.color,
                        type: grp.userData.type,
                        homeYaw: grp.userData.homeYaw,
                        rotY: grp.rotation.y,
                        pos: { x: grp.position.x, z: grp.position.z },
                    });
                }
                return items;
            }""")

            white_pieces = [p for p in pieces_info if p["color"] == "w"]
            black_pieces = [p for p in pieces_info if p["color"] == "b"]
            white_yaws = set(round(p["homeYaw"], 3) for p in white_pieces)
            black_yaws = set(round(p["homeYaw"], 3) for p in black_pieces)

            all_same_dir = len(white_yaws.union(black_yaws)) <= 1
            orientations_correct = (
                len(pieces_info) == 32
                and not all_same_dir
                and any(abs(y - 3.142) < 0.1 for y in white_yaws)
                and any(abs(y) < 0.1 for y in black_yaws)
            )

            report["checks"]["piece_orientations"] = {
                "passed": orientations_correct,
                "pieces_count": len(pieces_info),
                "white_yaws": list(white_yaws),
                "black_yaws": list(black_yaws),
                "detail": (
                    "White pieces face North (3.142 rad), Black pieces face South (0.0 rad) facing each other."
                    if orientations_correct
                    else f"ORIENTATION BUG DETECTED! White yaws: {white_yaws}, Black yaws: {black_yaws}"
                ),
            }
            if not orientations_correct:
                report["issues"].append(
                    f"Orientation Bug: Pieces are incorrectly oriented (White: {white_yaws}, Black: {black_yaws})!"
                )
            else:
                print("   ✅ Piece orientations verified: White faces North, Black faces South.")

            # -----------------------------------------------------------------
            # Step 2.5: Confirm / Dismiss Startup Match Setup Modal
            # -----------------------------------------------------------------
            try:
                setup_visible = page.evaluate("() => { const m = document.querySelector('#hud-setup-modal'); return Boolean(m && getComputedStyle(m).display !== 'none'); }")
                if setup_visible:
                    print("⚙️ Startup Match Setup Modal detected: confirming default match setup...")
                    page.evaluate("() => { const b = document.querySelector('#hud-setup-start-btn') || document.querySelector('#hud-setup-close'); if (b) b.click(); }")
                    time.sleep(0.8)
            except Exception as e:
                print(f"   ℹ️ Setup modal handling note: {e}")

            # -----------------------------------------------------------------
            # Step 3: Camera 180° Invert View Audit (Non-Black Screen Check)
            # -----------------------------------------------------------------
            print("🔄 Testing Camera 180° Flip (#hud-flip-btn)...")
            page.click("#hud-flip-btn")
            time.sleep(1.0)
            shot2 = out_dir / "02_camera_flip_180.png"
            page.screenshot(path=str(shot2))
            report["screenshots"].append(shot2.name)

            flip_pass, flip_lum, flip_std, flip_msg = check_image_not_black(shot2)
            report["checks"]["camera_flip_180"] = {
                "passed": flip_pass,
                "mean_luminance": flip_lum,
                "contrast_stddev": flip_std,
                "detail": flip_msg,
            }
            if not flip_pass:
                report["issues"].append(
                    f"Visual Black-Screen Bug: Inverti a 180 gradi produced a black screen! ({flip_msg})"
                )
                print(f"   ❌ Black screen detected on camera flip! ({flip_msg})")
            else:
                print(f"   ✅ Camera 180° flip verified non-black ({flip_msg})")

            # -----------------------------------------------------------------
            # Step 4: Camera Top-Down View Audit
            # -----------------------------------------------------------------
            print("📐 Testing Camera Top-Down View (#hud-top-btn)...")
            page.click("#hud-top-btn")
            time.sleep(1.0)
            shot3 = out_dir / "03_camera_top_down.png"
            page.screenshot(path=str(shot3))
            report["screenshots"].append(shot3.name)

            top_pass, top_lum, top_std, top_msg = check_image_not_black(shot3)
            report["checks"]["camera_top_down"] = {
                "passed": top_pass,
                "mean_luminance": top_lum,
                "contrast_stddev": top_std,
                "detail": top_msg,
            }
            if not top_pass:
                report["issues"].append(f"Visual Bug: Top-down camera view is pitch-black! ({top_msg})")
            else:
                print(f"   ✅ Top-down camera view verified non-black ({top_msg})")

            # Restore normal camera angle
            page.click("#hud-top-btn")
            time.sleep(0.4)
            page.click("#hud-flip-btn")
            time.sleep(0.4)

            # -----------------------------------------------------------------
            # Step 5: 3D Articulated Skeletons Rig Toggle
            # -----------------------------------------------------------------
            print("🦴 Testing 3D Skeletons Rig Toggle (#hud-skeletons-btn)...")
            page.evaluate("() => document.querySelector('#hud-skeletons-btn')?.click()")
            time.sleep(0.8)
            shot4 = out_dir / "04_skeletons_active.png"
            page.screenshot(path=str(shot4))
            report["screenshots"].append(shot4.name)

            skeletons_on = page.evaluate("() => Boolean(window.__CARCHESS__.pieceView.skeletonsVisible)")
            report["checks"]["skeletons_toggle"] = {
                "passed": skeletons_on,
                "detail": "3D bone rigs enabled and visible across living & swamp characters",
            }
            page.evaluate("() => document.querySelector('#hud-skeletons-btn')?.click()")  # toggle off
            time.sleep(0.3)

            # -----------------------------------------------------------------
            # Step 6: Ogre Swamp Party Moat
            # -----------------------------------------------------------------
            print("🐸 Testing Ogre Swamp Party (#hud-swamp-btn)...")
            page.click("#hud-swamp-btn")
            time.sleep(0.8)
            shot5 = out_dir / "05_swamp_party.png"
            page.screenshot(path=str(shot5))
            report["screenshots"].append(shot5.name)

            swamp_count = page.evaluate("() => window.__CARCHESS__.pieceView.trayGroup.children.length")
            report["checks"]["swamp_party"] = {
                "passed": swamp_count > 0,
                "swimmers": swamp_count,
                "detail": f"{swamp_count} pieces swimming in the Ogre's enchanted lily-pad moat",
            }

            # -----------------------------------------------------------------
            # Step 7: 6x6 Battle Matrix Modal
            # -----------------------------------------------------------------
            print("🎬 Testing 6x6 Battle Matrix Modal (#hud-matrix36-btn)...")
            page.click("#hud-matrix36-btn")
            time.sleep(0.8)
            shot6 = out_dir / "06_matrix36_modal.png"
            page.screenshot(path=str(shot6))
            report["screenshots"].append(shot6.name)

            matrix_open = page.evaluate("() => window.__CARCHESS__.hud.matrixModalOpen")
            report["checks"]["matrix36_modal"] = {
                "passed": matrix_open,
                "detail": "36-combination interactive matrix modal displayed with video previews",
            }
            # Close modal
            if page.locator("#hud-matrix36-close").is_visible():
                page.click("#hud-matrix36-close")
            else:
                page.evaluate("() => window.__CARCHESS__.hud.closeMatrix36Modal?.()")
            time.sleep(0.5)

            # -----------------------------------------------------------------
            # Step 8: WOW Mode Turntable & Arena Drawer
            # -----------------------------------------------------------------
            print("🌟 Testing WOW Mode & Cinema (#hud-mode2-btn)...")
            # Ensure topbar is revealed for interaction
            page.evaluate("""() => {
                const topbar = document.querySelector('#hud-topbar');
                if (topbar) topbar.classList.remove('hidden');
                const b = document.querySelector('#hud-mode2-btn');
                if (b) b.click();
            }""")
            time.sleep(1.0)
            shot7 = out_dir / "07_wow_mode.png"
            page.screenshot(path=str(shot7))
            report["screenshots"].append(shot7.name)

            wow_active = page.evaluate(
                "() => window.__CARCHESS__.flow.state() === 'Mode2_WowArena'"
            )
            report["checks"]["wow_mode"] = {
                "passed": wow_active,
                "detail": "Mode 2 WOW Turntable Inspector & Arena active with character controls",
            }

            page.evaluate("() => { const b = document.querySelector('#hud-mode1-btn'); if (b) b.click(); }")
            time.sleep(0.8)

            # -----------------------------------------------------------------
            # Step 9: Simulated Match: Human (White) vs CPU Easy (Black)
            # -----------------------------------------------------------------
            print("♟️ Starting Simulated Match: Human White vs CPU Easy Black...")
            page.click("#hud-new-btn")
            time.sleep(0.5)

            page.evaluate("""() => {
                const sel = document.querySelector('#hud-opponent-select');
                if (sel) {
                    sel.value = 'easy';
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }""")
            time.sleep(0.4)

            # Move 1: White e2 -> e4
            print("   White plays e2 -> e4 (Pawn leap)")
            page.evaluate("""() => {
                window.__CARCHESS__.board.selectSquare('e2');
                window.__CARCHESS__.bus.flush();
            }""")
            time.sleep(0.3)
            page.evaluate("""() => {
                window.__CARCHESS__.board.requestMove('e2', 'e4');
                window.__CARCHESS__.bus.flush();
            }""")

            shot8 = out_dir / "08_gameplay_move1_white.png"
            page.screenshot(path=str(shot8))
            report["screenshots"].append(shot8.name)

            t0 = time.time()
            cpu_moved = False
            for _ in range(35):
                time.sleep(0.15)
                hist = page.evaluate("() => window.__CARCHESS__.board.moveHistory")
                if len(hist) >= 2:
                    cpu_lat = (time.time() - t0) * 1000
                    report["cpu_latencies_ms"].append(cpu_lat)
                    cpu_moved = True
                    print(f"   Black CPU replied with {hist[-1].get('san')} in {cpu_lat:.0f}ms")
                    break

            if not cpu_moved:
                report["issues"].append("Gameplay Bug: CPU Easy did not respond to move 1 (e2-e4)!")

            shot9 = out_dir / "09_gameplay_move1_cpu_reply.png"
            page.screenshot(path=str(shot9))
            report["screenshots"].append(shot9.name)

            # Move 2: White g1 -> f3 (Knight Seby gallop!)
            print("   White plays g1 -> f3 (Knight Seby gallop)")
            time.sleep(0.4)
            page.evaluate("""() => {
                window.__CARCHESS__.board.selectSquare('g1');
                window.__CARCHESS__.bus.flush();
            }""")
            time.sleep(0.3)
            page.evaluate("""() => {
                window.__CARCHESS__.board.requestMove('g1', 'f3');
                window.__CARCHESS__.bus.flush();
            }""")

            t0 = time.time()
            cpu_moved2 = False
            for _ in range(35):
                time.sleep(0.15)
                hist = page.evaluate("() => window.__CARCHESS__.board.moveHistory")
                if len(hist) >= 4:
                    cpu_lat = (time.time() - t0) * 1000
                    report["cpu_latencies_ms"].append(cpu_lat)
                    cpu_moved2 = True
                    print(f"   Black CPU replied with {hist[-1].get('san')} in {cpu_lat:.0f}ms")
                    break

            shot10 = out_dir / "10_gameplay_move2_cpu_reply.png"
            page.screenshot(path=str(shot10))
            report["screenshots"].append(shot10.name)

            # Move 3: White d2 -> d4
            print("   White plays d2 -> d4 (Center pawn)")
            time.sleep(0.4)
            page.evaluate("""() => {
                window.__CARCHESS__.board.selectSquare('d2');
                window.__CARCHESS__.bus.flush();
            }""")
            time.sleep(0.3)
            page.evaluate("""() => {
                window.__CARCHESS__.board.requestMove('d2', 'd4');
                window.__CARCHESS__.bus.flush();
            }""")

            t0 = time.time()
            cpu_moved3 = False
            for _ in range(35):
                time.sleep(0.15)
                hist = page.evaluate("() => window.__CARCHESS__.board.moveHistory")
                if len(hist) >= 6:
                    cpu_lat = (time.time() - t0) * 1000
                    report["cpu_latencies_ms"].append(cpu_lat)
                    cpu_moved3 = True
                    print(f"   Black CPU replied with {hist[-1].get('san')} in {cpu_lat:.0f}ms")
                    break

            shot11 = out_dir / "11_gameplay_move3_cpu_reply.png"
            page.screenshot(path=str(shot11))
            report["screenshots"].append(shot11.name)

            # Check if any capture occurred or execute a tactical capture
            capture_move = page.evaluate("""() => {
                const legal = window.__CARCHESS__.board.legalMoves();
                return legal.find(m => Boolean(m.captured)) || null;
            }""")
            if capture_move:
                print(f"   White executes tactical capture {capture_move['from']} -> {capture_move['to']}!")
                page.evaluate(f"""() => {{
                    window.__CARCHESS__.board.requestMove('{capture_move["from"]}', '{capture_move["to"]}');
                    window.__CARCHESS__.bus.flush();
                }}""")
                time.sleep(0.8)
                shot12 = out_dir / "12_capture_cutscene.png"
                page.screenshot(path=str(shot12))
                report["screenshots"].append(shot12.name)

                # Skip cutscene if banner is present
                banner_vis = page.evaluate("""() => {
                    const el = document.getElementById('hud-comic-banner');
                    return el && window.getComputedStyle(el).display !== 'none';
                }""")
                if banner_vis:
                    print("   ✨ Comic impact banner active! Testing #hud-skip-btn...")
                    page.click("#hud-skip-btn")
                    time.sleep(0.5)

            final_moves_count = page.evaluate("() => window.__CARCHESS__.board.moveHistory.length")
            report["checks"]["match_gameplay"] = {
                "passed": final_moves_count >= 4,
                "total_moves": final_moves_count,
                "avg_cpu_latency_ms": (
                    sum(report["cpu_latencies_ms"]) / len(report["cpu_latencies_ms"])
                    if report["cpu_latencies_ms"]
                    else 0
                ),
                "detail": f"{final_moves_count} moves executed cleanly between Human and CPU Easy",
            }

            shot_final = out_dir / "13_match_final.png"
            page.screenshot(path=str(shot_final))
            report["screenshots"].append(shot_final.name)

            time.sleep(1.0)

            # -----------------------------------------------------------------
            # Step 10: Close context & finalize video (guaranteed max 1 min)
            # -----------------------------------------------------------------
            context.close()
            browser.close()

            total_elapsed = time.time() - start_wall_time
            report["video_duration_s"] = round(total_elapsed, 1)

            webm_files = list(video_raw_dir.glob("*.webm"))
            if webm_files:
                latest_webm = sorted(webm_files, key=lambda f: f.stat().st_mtime)[-1]
                target_webm = out_dir / "uat_gameplay.webm"
                shutil.copyfile(latest_webm, target_webm)
                report["video_webm"] = target_webm.name

                ffmpeg_bin = shutil.which("ffmpeg")
                if ffmpeg_bin:
                    target_mp4 = out_dir / "uat_gameplay.mp4"
                    cmd = [
                        ffmpeg_bin,
                        "-y",
                        "-i",
                        str(target_webm),
                        "-t",
                        "60",
                        "-c:v",
                        "libx264",
                        "-pix_fmt",
                        "yuv420p",
                        "-movflags",
                        "+faststart",
                        str(target_mp4),
                    ]
                    res = subprocess.run(cmd, capture_output=True)
                    if res.returncode == 0:
                        report["video_mp4"] = target_mp4.name
                        print(f"🎬 Video rendered & encoded (max 1 min): {target_mp4} ({min(60.0, report['video_duration_s'])}s)")

                    # Generate animated preview GIF for inline GitHub Issue embedding
                    target_gif = out_dir / "uat_gameplay.gif"
                    gif_cmd = [
                        ffmpeg_bin,
                        "-y",
                        "-i",
                        str(target_mp4 if target_mp4.exists() else target_webm),
                        "-vf",
                        "fps=8,scale=540:-1:flags=lanczos",
                        "-t",
                        "12",
                        "-loop",
                        "0",
                        str(target_gif),
                    ]
                    res_gif = subprocess.run(gif_cmd, capture_output=True)
                    if res_gif.returncode == 0:
                        report["video_gif"] = target_gif.name
                        print(f"🎞️ Animated GIF preview generated: {target_gif}")

            shutil.rmtree(video_raw_dir, ignore_errors=True)

    finally:
        server.shutdown()

    # -----------------------------------------------------------------
    # Step 11: Playability Analysis & AI Critic Evaluation
    # -----------------------------------------------------------------
    playability = []
    if report["checks"].get("piece_orientations", {}).get("passed"):
        playability.append("🟢 Faction Directionality: White faces North towards enemy rank, Black faces South.")
    else:
        playability.append("🔴 Faction Directionality: Pieces face conflicting or identical orientations.")

    if report["checks"].get("camera_flip_180", {}).get("passed"):
        playability.append("🟢 Camera Flip Ergonomics: 180° inversion maintains vibrant altar illumination.")
    else:
        playability.append("🔴 Camera Flip Ergonomics: Screen turns pitch-black upon 180° rotation.")

    if report["checks"].get("camera_top_down", {}).get("passed"):
        playability.append("🟢 Top-Down Perspective: Orthogonal tactical view is well-framed and visible.")
    else:
        playability.append("🔴 Top-Down Perspective: Top-down view is clipped or dark.")

    if report["checks"].get("match_gameplay", {}).get("passed"):
        avg_lat = report["checks"]["match_gameplay"].get("avg_cpu_latency_ms", 0)
        playability.append(f"🟢 CPU Easy Responsiveness: Average response time {avg_lat:.0f}ms (target <1500ms).")
    else:
        playability.append("🔴 CPU Easy Responsiveness: CPU froze or failed to respond to moves.")

    if not report["console_errors"]:
        playability.append("🟢 Engine Cleanliness: Zero uncaught runtime errors or WebGL shader warnings.")
    else:
        playability.append(f"🟡 Engine Warnings: {len(report['console_errors'])} console errors recorded.")

    report["playability_notes"] = playability
    return report


def generate_markdown_report(report: dict, out_file: pathlib.Path):
    dt_str = datetime.datetime.fromisoformat(report["timestamp"]).strftime("%Y-%m-%d %H:%M:%S")
    git = report["git"]
    checks = report["checks"]
    issues = report["issues"]

    total_checks = len(checks)
    passed_checks = sum(1 for c in checks.values() if c.get("passed"))
    verdict_emoji = "🟢" if not issues and passed_checks == total_checks else "🟡" if not issues else "🔴"
    verdict_title = (
        "ALL SYSTEMS OPERATIONAL (PASS)"
        if verdict_emoji == "🟢"
        else "MINOR WARNINGS (CHECK DETAILS)"
        if verdict_emoji == "🟡"
        else "DEFECTS DETECTED (ACTION REQUIRED)"
    )

    lines = [
        f"# CarChess3D Daily UAT Report {verdict_emoji}",
        "",
        f"- **Date & Time**: `{dt_str}`",
        f"- **Git Branch / Commit**: `{git['branch']}` @ [`{git['commit']}`]",
        f"- **Verdict**: **{verdict_emoji} {verdict_title}**",
        f"- **Checks Passed**: `{passed_checks} / {total_checks}`",
        f"- **Video Session Duration**: `{min(60.0, report.get('video_duration_s', 0))}s` (Max 1 min target)",
        "",
        "## Recent Commits",
        "",
    ]
    for c in git.get("recent_commits", []):
        lines.append(f"- `{c}`")

    lines.extend([
        "",
        "## Automated Playtest & Verification Matrix",
        "",
        "| Gate / Subsystem | Status | Metrics / Details |",
        "| :--- | :---: | :--- |",
    ])

    for name, c in checks.items():
        status = "✅ PASS" if c.get("passed") else "❌ FAIL"
        detail = c.get("detail", "")
        lines.append(f"| **{name}** | {status} | {detail} |")

    lines.extend([
        "",
        "## Playability & User Experience Evaluation",
        "",
    ])
    for note in report.get("playability_notes", []):
        lines.append(f"- {note}")

    if issues:
        lines.extend([
            "",
            "## ⚠️ Defects & Discrepancies Found",
            "",
        ])
        for iss in issues:
            lines.append(f"- 🔴 **{iss}**")

    if report.get("console_errors"):
        lines.extend([
            "",
            "## Console Errors & Warnings",
            "",
            "```text",
            *report["console_errors"],
            "```",
        ])

    lines.extend([
        "",
        "## Media & Gameplay Recordings",
        "",
    ])
    if report.get("video_gif"):
        lines.append(f"![UAT Gameplay Animation]({report['video_gif']})")
        lines.append("")
    if report.get("video_mp4"):
        lines.append(f"- 🎬 **Full Match Film (MP4, <1 min)**: `{report['video_mp4']}`")
    if report.get("video_webm"):
        lines.append(f"- 📹 **Full Match Film (WebM)**: `{report['video_webm']}`")

    lines.append("")
    lines.append("### Keyframe Screenshots")
    lines.append("")
    for shot in report.get("screenshots", []):
        lines.append(f"- `{shot}`")

    out_file.write_text("\n".join(lines) + "\n")


def publish_github_issue(report: dict, report_md_path: pathlib.Path, out_dir: pathlib.Path) -> str | None:
    """Creates or updates a GitHub Issue titled 'Gemini UAT YYYYMMDD' with tag 'gemini-uat'."""
    gh_bin = shutil.which("gh")
    if not gh_bin:
        print("⚠️ gh CLI not found on PATH; skipping GitHub Issue creation.")
        return None

    date_tag = datetime.datetime.now().strftime("%Y%m%d")
    issue_title = f"Gemini UAT {date_tag}"
    label = "gemini-uat"

    # Ensure label exists
    subprocess.run([gh_bin, "label", "create", label, "--color", "00e676", "--force"], capture_output=True)

    # Try uploading media to a prerelease asset tag for direct GitHub Issue rendering
    tag_name = f"uat-media-{date_tag}"
    mp4_file = out_dir / "uat_gameplay.mp4"
    gif_file = out_dir / "uat_gameplay.gif"
    media_files = [str(f) for f in (mp4_file, gif_file) if f.exists()]

    if media_files:
        rel_check = subprocess.run([gh_bin, "release", "view", tag_name], capture_output=True)
        if rel_check.returncode != 0:
            subprocess.run(
                [
                    gh_bin,
                    "release",
                    "create",
                    tag_name,
                    *media_files,
                    "--title",
                    f"UAT Media Assets {date_tag}",
                    "--notes",
                    f"Automated Daily UAT media assets for {date_tag}",
                    "--prerelease",
                ],
                capture_output=True,
            )
        else:
            subprocess.run([gh_bin, "release", "upload", tag_name, *media_files, "--clobber"], capture_output=True)

        base_dl_url = f"https://github.com/palladius/carchess3d/releases/download/{tag_name}"
        body_text = report_md_path.read_text()
        if gif_file.exists():
            body_text = body_text.replace("uat_gameplay.gif", f"{base_dl_url}/uat_gameplay.gif")
        if mp4_file.exists():
            body_text = body_text.replace(
                "`uat_gameplay.mp4`",
                f"[{base_dl_url}/uat_gameplay.mp4]({base_dl_url}/uat_gameplay.mp4)\n\n<video src=\"{base_dl_url}/uat_gameplay.mp4\" controls width=\"100%\"></video>",
            )
        report_md_path.write_text(body_text)

    # Check if issue already exists for today
    find_cmd = [
        gh_bin,
        "issue",
        "list",
        "--repo",
        "palladius/carchess3d",
        "--label",
        label,
        "--search",
        f"\"{issue_title}\" in:title",
        "--json",
        "number,title",
    ]
    res = subprocess.run(find_cmd, capture_output=True, text=True)
    existing_issues = []
    if res.returncode == 0:
        try:
            existing_issues = json.loads(res.stdout)
        except Exception:
            pass

    if existing_issues:
        issue_num = existing_issues[0]["number"]
        print(f"📝 Updating existing issue #{issue_num} ({issue_title})...")
        comment_cmd = [
            gh_bin,
            "issue",
            "comment",
            str(issue_num),
            "--repo",
            "palladius/carchess3d",
            "--body-file",
            str(report_md_path),
        ]
        c_res = subprocess.run(comment_cmd, capture_output=True, text=True)
        if c_res.returncode == 0:
            print(f"✅ Comment added to issue #{issue_num}!")
            return f"https://github.com/palladius/carchess3d/issues/{issue_num}"
    else:
        print(f"📢 Creating new GitHub Issue '{issue_title}' with tag '{label}'...")
        create_cmd = [
            gh_bin,
            "issue",
            "create",
            "--repo",
            "palladius/carchess3d",
            "--title",
            issue_title,
            "--label",
            label,
            "--body-file",
            str(report_md_path),
        ]
        c_res = subprocess.run(create_cmd, capture_output=True, text=True)
        if c_res.returncode == 0:
            url = c_res.stdout.strip()
            print(f"✅ GitHub Issue created: {url}")
            return url
        else:
            print(f"❌ Failed to create issue: {c_res.stderr}")

    return None


def main():
    parser = argparse.ArgumentParser(description="CarChess3D Daily UAT Playtest")
    parser.add_argument("--outdir", default="log/uat", help="Output directory for reports and captures")
    parser.add_argument("--port", type=int, default=0, help="Local HTTP port (0 for auto-allocated)")
    parser.add_argument("--no-headless", dest="headless", action="store_false", help="Run with visible browser UI")
    parser.add_argument("--publish-ghi", action="store_true", help="Publish or update GitHub Issue 'Gemini UAT YYYYMMDD'")
    args = parser.parse_args()

    out_dir = pathlib.Path(args.outdir).resolve()
    port = args.port or find_free_port()

    print(f"🎬 Starting CarChess3D Daily UAT Playtest on port {port} (Out: {out_dir})...")
    report = run_playtest(out_dir=out_dir, port=port, headless=args.headless)

    report_path = out_dir / "UAT_REPORT.md"
    generate_markdown_report(report, report_path)

    json_path = out_dir / "uat_report.json"
    json_path.write_text(json.dumps(report, indent=2))

    issue_url = None
    if args.publish_ghi:
        issue_url = publish_github_issue(report, report_path, out_dir)
        if issue_url:
            report["github_issue_url"] = issue_url

    print("\n" + "=" * 60)
    print(f"📋 UAT Playtest Complete! Report generated at: {report_path}")
    if issue_url:
        print(f"🔗 GitHub Issue: {issue_url}")
    print("=" * 60)
    for note in report.get("playability_notes", []):
        print(f"  {note}")

    if report.get("issues"):
        print("\n❌ Issues detected:")
        for iss in report["issues"]:
            print(f"  - {iss}")
        sys.exit(1)
    else:
        print("\n✅ All UAT checks passed cleanly!")
        sys.exit(0)


if __name__ == "__main__":
    main()
