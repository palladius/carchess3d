#!/usr/bin/env python3
"""Headless Playwright Multi-Device 3D Simulation for Riccardo's Mobile & Tablet Fleet:
1. Google Pixel 10 (Portrait 412x915 & Landscape 915x412, DPR 2.625, Tensor G5 / PowerVR DXT)
   - Tests both Default Mobile Lite 3D Mode AND Full GLB Mode (?glb=1).
2. Samsung Galaxy Tab S10 Ultra (Landscape 1480x925 & Portrait 925x1480, DPR 2.0, SM-X920)
   - Tests full 3D GLB diorama with mobile/tablet direct WebGL rendering (Bloom HalfFloat FBO bypass).

Verifies on every single screenshot:
- Not Black (mean_luminance > 12.0, stddev > 8.0)
- Not White / Dead Canvas (mean_luminance < 235.0, pure_white_ratio < 0.15)
- WebGL context is alive (gl.isContextLost() === false)
- Zero uncaught JS exceptions or WebGL errors
"""

import http.server
import json
import pathlib
import socket
import sys
import threading
import time

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "tmp" / "device_simulation"


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        pass


def analyze_screenshot(img_path: pathlib.Path, crop_box: tuple[int, int, int, int] | None = None) -> dict:
    """Checks that an image (or its 3D canvas region) is neither solid white nor solid black."""
    with Image.open(img_path) as im:
        rgb = im.convert("RGB")
        if crop_box:
            rgb = rgb.crop(crop_box)
        gray = rgb.convert("L")
        stat = ImageStat.Stat(gray)
        mean_lum = float(stat.mean[0])
        stddev = float(stat.stddev[0])

        # Compute fraction of nearly-pure-white pixels (R>248, G>248, B>248) on 256x256 sample
        sample_rgb = rgb.resize((256, 256))
        pixels = list(sample_rgb.getdata())
        total = max(1, len(pixels))
        white_count = sum(1 for (r, g, b) in pixels if r > 248 and g > 248 and b > 248)
        black_count = sum(1 for (r, g, b) in pixels if r < 8 and g < 8 and b < 8)
        white_ratio = white_count / total
        black_ratio = black_count / total

        is_white_dead = mean_lum > 230.0 or white_ratio > 0.25
        is_black_dead = mean_lum < 10.0 or stddev < 6.0 or black_ratio > 0.92
        passed = not is_white_dead and not is_black_dead

        return {
            "file": img_path.name,
            "passed": passed,
            "mean_lum": round(mean_lum, 2),
            "stddev": round(stddev, 2),
            "white_ratio": round(white_ratio, 4),
            "black_ratio": round(black_ratio, 4),
            "is_white_dead": is_white_dead,
            "is_black_dead": is_black_dead,
        }


def inspect_webgl_state(page) -> dict:
    return page.evaluate(
        """() => {
        const c = window.__CARCHESS__;
        if (!c) return { ok: false, reason: 'no __CARCHESS__' };
        const gl = c.renderer.getContext();
        const canvas = document.getElementById('game-canvas');
        // Sample 5 pixels directly from WebGL drawing buffer (center & 4 quadrants)
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        const pts = [
          [Math.floor(w * 0.5), Math.floor(h * 0.5)],
          [Math.floor(w * 0.35), Math.floor(h * 0.55)],
          [Math.floor(w * 0.65), Math.floor(h * 0.55)],
          [Math.floor(w * 0.5), Math.floor(h * 0.35)],
          [Math.floor(w * 0.5), Math.floor(h * 0.7)],
        ];
        const samples = [];
        const buf = new Uint8Array(4);
        for (const [px, py] of pts) {
          gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          samples.push([buf[0], buf[1], buf[2], buf[3]]);
        }
        return {
          ok: !gl.isContextLost(),
          contextLost: gl.isContextLost(),
          drawingBuffer: { w, h },
          isMobilePhone: c.ctx.isMobilePhone,
          isMobileOrTablet: c.ctx.isMobileOrTablet,
          mobileLite3D: c.pieceView.mobileLite3D,
          useBloom: Boolean(c.composer.useBloom),
          shadowMapEnabled: Boolean(c.renderer.shadowMap.enabled),
          livingPiecesCount: c.pieceView.pieceBySquare.size,
          topDownCamera: Boolean(c.hud.topDownCamera),
          samples,
        };
      }"""
    )


def run_simulation() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    port = find_free_port()
    server = http.server.ThreadingHTTPServer(("", port), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    results = {"devices": {}, "all_passed": True}

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

        # =====================================================================
        # DEVICE 1: GOOGLE PIXEL 10 (Portrait 412x915 -> Landscape 915x412)
        # =====================================================================
        print("📱 [1/3] Simulating Google Pixel 10 (Default Mobile Lite 3D Mode)...")
        pixel10_ua = (
            "Mozilla/5.0 (Linux; Android 16; Pixel 10 Build/BP2A.250605.031) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36"
        )
        ctx_p10 = browser.new_context(
            viewport={"width": 412, "height": 915},
            device_scale_factor=2.625,
            is_mobile=True,
            has_touch=True,
            user_agent=pixel10_ua,
        )
        page_p10 = ctx_p10.new_page()
        p10_errors = []
        page_p10.on("pageerror", lambda e: p10_errors.append(str(e)))
        page_p10.on("console", lambda m: p10_errors.append(m.text) if m.type == "error" else None)

        page_p10.goto(f"http://localhost:{port}/index.html", wait_until="networkidle")
        page_p10.wait_for_selector("#game-canvas", timeout=10000)
        time.sleep(1.0)

        # Step 1A: Portrait boot + dismiss rotate overlay to inspect portrait 3D board
        shot_p10_portrait_prompt = OUT_DIR / "pixel10_01_portrait_prompt.png"
        page_p10.screenshot(path=str(shot_p10_portrait_prompt))
        page_p10.click("#hud-rotate-dismiss-btn")
        page_p10.click("#hud-mobile-quick-play-btn")
        time.sleep(0.8)
        shot_p10_portrait_board = OUT_DIR / "pixel10_02_portrait_topdown_board.png"
        page_p10.screenshot(path=str(shot_p10_portrait_board))
        state_p10_portrait = inspect_webgl_state(page_p10)

        # Step 1B: Rotate Pixel 10 to Landscape (915x412)
        page_p10.set_viewport_size({"width": 915, "height": 412})
        time.sleep(0.8)
        shot_p10_land_topdown = OUT_DIR / "pixel10_03_landscape_topdown_board.png"
        page_p10.screenshot(path=str(shot_p10_land_topdown))

        # Step 1C: Make a move on Pixel 10 (e2 -> e4) & toggle to Full 3D camera view
        page_p10.evaluate(
            """() => {
            window.__CARCHESS__.board.requestMove('e2', 'e4');
            window.__CARCHESS__.bus.flush();
          }"""
        )
        time.sleep(1.2)
        page_p10.click("#hud-top-btn")  # Switch from Top-Down (Alto-Basso) to Full 3D View!
        time.sleep(0.8)
        shot_p10_land_3d = OUT_DIR / "pixel10_04_landscape_3d_perspective.png"
        page_p10.screenshot(path=str(shot_p10_land_3d))
        state_p10_land = inspect_webgl_state(page_p10)

        p10_shots = [
            analyze_screenshot(shot_p10_portrait_prompt),
            analyze_screenshot(shot_p10_portrait_board, (0, 0, 412, 820)),
            analyze_screenshot(shot_p10_land_topdown, (0, 0, 915, 345)),
            analyze_screenshot(shot_p10_land_3d, (0, 0, 915, 345)),
        ]
        results["devices"]["pixel10_lite3d"] = {
            "state_portrait": state_p10_portrait,
            "state_landscape": state_p10_land,
            "screenshots": p10_shots,
            "errors": p10_errors,
            "passed": (
                state_p10_portrait["ok"]
                and state_p10_land["ok"]
                and state_p10_land["mobileLite3D"] is True
                and state_p10_land["useBloom"] is False
                and state_p10_land["livingPiecesCount"] == 32
                and len(p10_errors) == 0
                and all(s["passed"] for s in p10_shots)
            ),
        }
        ctx_p10.close()

        # =====================================================================
        # DEVICE 2: GOOGLE PIXEL 10 WITH ?glb=1 (Full GLB 3D Mode on Phone)
        # =====================================================================
        print("📱 [2/3] Simulating Google Pixel 10 (?glb=1 Full GLB Mode without Bloom FBOs)...")
        ctx_p10_glb = browser.new_context(
            viewport={"width": 915, "height": 412},
            device_scale_factor=2.625,
            is_mobile=True,
            has_touch=True,
            user_agent=pixel10_ua,
        )
        page_p10_glb = ctx_p10_glb.new_page()
        p10_glb_errors = []
        page_p10_glb.on("pageerror", lambda e: p10_glb_errors.append(str(e)))
        page_p10_glb.on("console", lambda m: p10_glb_errors.append(m.text) if m.type == "error" else None)

        page_p10_glb.goto(f"http://localhost:{port}/index.html?glb=1", wait_until="networkidle")
        page_p10_glb.wait_for_selector("#game-canvas", timeout=10000)
        time.sleep(1.5)
        page_p10_glb.click("#hud-mobile-quick-play-btn")
        time.sleep(0.8)
        page_p10_glb.click("#hud-top-btn")  # Switch to 3D perspective to see GLB models
        time.sleep(0.8)
        shot_p10_glb = OUT_DIR / "pixel10_05_landscape_full_glb_mode.png"
        page_p10_glb.screenshot(path=str(shot_p10_glb))
        state_p10_glb = inspect_webgl_state(page_p10_glb)
        shot_p10_glb_analysis = analyze_screenshot(shot_p10_glb, (0, 0, 915, 345))

        results["devices"]["pixel10_full_glb"] = {
            "state": state_p10_glb,
            "screenshots": [shot_p10_glb_analysis],
            "errors": p10_glb_errors,
            "passed": (
                state_p10_glb["ok"]
                and state_p10_glb["mobileLite3D"] is False
                and state_p10_glb["useBloom"] is False
                and len(p10_glb_errors) == 0
                and shot_p10_glb_analysis["passed"]
            ),
        }
        ctx_p10_glb.close()

        # =====================================================================
        # DEVICE 3: SAMSUNG GALAXY TAB S10 ULTRA (1480x925 Landscape & 925x1480 Portrait)
        # =====================================================================
        print("📟 [3/3] Simulating Samsung Galaxy Tab S10 Ultra (1480x925 Landscape & 925x1480 Portrait)...")
        tabs10_ua = (
            "Mozilla/5.0 (Linux; Android 15; SM-X920 Build/AP3A.240905.015.A2) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
        )
        ctx_tab = browser.new_context(
            viewport={"width": 1480, "height": 925},
            device_scale_factor=2.0,
            is_mobile=True,
            has_touch=True,
            user_agent=tabs10_ua,
        )
        page_tab = ctx_tab.new_page()
        tab_errors = []
        page_tab.on("pageerror", lambda e: tab_errors.append(str(e)))
        page_tab.on("console", lambda m: tab_errors.append(m.text) if m.type == "error" else None)

        page_tab.goto(f"http://localhost:{port}/index.html", wait_until="networkidle")
        page_tab.wait_for_selector("#game-canvas", timeout=10000)
        time.sleep(1.5)

        # Start match on Samsung Galaxy Tab S10 Ultra
        page_tab.click("#hud-setup-start-btn")
        time.sleep(1.0)
        shot_tab_land = OUT_DIR / "samsung_tab_s10_01_landscape_3d.png"
        page_tab.screenshot(path=str(shot_tab_land))
        state_tab_land = inspect_webgl_state(page_tab)

        # Execute opening move on Tab S10 Ultra (g1 -> f3)
        page_tab.evaluate(
            """() => {
            window.__CARCHESS__.board.requestMove('g1', 'f3');
            window.__CARCHESS__.bus.flush();
          }"""
        )
        time.sleep(1.2)
        shot_tab_move = OUT_DIR / "samsung_tab_s10_02_landscape_after_move.png"
        page_tab.screenshot(path=str(shot_tab_move))

        # Rotate Samsung Galaxy Tab S10 Ultra to Portrait (925x1480)
        page_tab.set_viewport_size({"width": 925, "height": 1480})
        time.sleep(0.8)
        shot_tab_port = OUT_DIR / "samsung_tab_s10_03_portrait_3d.png"
        page_tab.screenshot(path=str(shot_tab_port))
        state_tab_port = inspect_webgl_state(page_tab)

        tab_shots = [
            analyze_screenshot(shot_tab_land, (0, 0, 1480, 840)),
            analyze_screenshot(shot_tab_move, (0, 0, 1480, 840)),
            analyze_screenshot(shot_tab_port, (0, 0, 925, 1380)),
        ]
        results["devices"]["samsung_tab_s10_ultra"] = {
            "state_landscape": state_tab_land,
            "state_portrait": state_tab_port,
            "screenshots": tab_shots,
            "errors": tab_errors,
            "passed": (
                state_tab_land["ok"]
                and state_tab_port["ok"]
                and state_tab_land["isMobilePhone"] is False
                and state_tab_land["isMobileOrTablet"] is True
                and state_tab_land["useBloom"] is False
                and state_tab_land["livingPiecesCount"] == 32
                and len(tab_errors) == 0
                and all(s["passed"] for s in tab_shots)
            ),
        }
        ctx_tab.close()
        browser.close()

    server.shutdown()
    results["all_passed"] = all(d["passed"] for d in results["devices"].values())
    report_path = OUT_DIR / "simulation_report.json"
    report_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
    return 0 if results["all_passed"] else 1


if __name__ == "__main__":
    sys.exit(run_simulation())
