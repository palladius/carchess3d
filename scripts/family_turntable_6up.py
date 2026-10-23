"""Render a 16:9 (1600x900) 8-second (192 frames @ 24 FPS) 6-up family turntable
showing the 6 highest-scoring Carlesso family figurines rotating 360° side by side:
  Riccardo (King) · Kate (Queen) · Ale (Bishop) · Seby (Knight) · Pupurabbu (Rook) · Puffin (Pawn)

Outputs:
  - article/assets/gallery/family_turntable_6up.mp4 (1600x900, 24 fps, crf 20)
  - article/assets/gallery/family_turntable_6up.gif (800x450, 12 fps, 128 colors, bayer dither, <= 8 MB)
"""
import functools
import http.server
import math
import os
import shutil
import socketserver
import subprocess
import threading
import time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "log", "family_turntable_6up")
FRAMES = os.path.join(OUT, "frames")
GALLERY_DIR = os.path.join(ROOT, "article", "assets", "gallery")
os.makedirs(GALLERY_DIR, exist_ok=True)
shutil.rmtree(FRAMES, ignore_errors=True)
os.makedirs(FRAMES, exist_ok=True)

PORT = int(os.environ.get("PORT", "8774"))
FPS = 24
SECONDS = float(os.environ.get("SECONDS", "8"))
N = int(FPS * SECONDS)  # 192 frames
PREVIEW_ONLY = os.environ.get("PREVIEW", "0") == "1"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(
    ("127.0.0.1", PORT), functools.partial(QuietHandler, directory=ROOT)
)
threading.Thread(target=srv.serve_forever, daemon=True).start()

with sync_playwright() as p:
    chrome_bin = (
        "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
    )
    gl_args = (
        [
            "--use-gl=angle",
            "--use-angle=gl",
            "--enable-gpu-rasterization",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
        ]
        if chrome_bin
        else [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
        ]
    )
    browser = p.chromium.launch(executable_path=chrome_bin, args=gl_args)
    page = browser.new_page(
        viewport={"width": 1600, "height": 900}, device_scale_factor=1
    )
    page.goto(
        f"http://127.0.0.1:{PORT}/index.html?lang=en&turntable=1",
        wait_until="networkidle",
    )
    page.wait_for_selector("#game-canvas", timeout=15000)
    time.sleep(1.5)

    # Dismiss any initial setup modal if present and hide all HUD chrome except #turntable-6up-labels
    page.evaluate(
        """() => {
        const b = document.querySelector('#hud-setup-start-btn') || document.querySelector('#hud-setup-close');
        if (b) b.click();
        const c = window.__CARCHESS__;
        if (c && c.hud && c.hud.rootEl) c.hud.rootEl.style.display = 'none';
        document.querySelectorAll('#hud-top, #hud-dock, #hud-bottom, .hud-overlay, #hud-status, #hud-topbar, #hud-bottom-dock').forEach(e => e.style.display = 'none');
        for (const el of document.body.querySelectorAll('div, nav, aside, footer, header')) {
            if (el.id && el.id.startsWith('hud') && !el.id.includes('canvas')) el.style.display = 'none';
        }
    }"""
    )

    # Wait until all 6 GLBs have finished loading & grounding
    for _ in range(40):
        ready = page.evaluate(
            """() => {
            const c = window.__CARCHESS__;
            if (!c || !c.pieceView) return 0;
            const sqs = ['e1', 'd1', 'c1', 'b1', 'a1', 'e2'];
            return sqs.filter(sq => {
                const g = c.pieceView.pieceBySquare.get(sq);
                return g && g.userData && g.userData.glbHolder;
            }).length;
        }"""
        )
        if ready == 6:
            break
        time.sleep(0.25)
    print(f"Loaded GLBs: {ready}/6")
    time.sleep(0.6)

    if PREVIEW_ONLY:
        for deg in (0, 90, 180, 270):
            rad = math.radians(deg)
            page.evaluate(f"() => window.__CARCHESS__.setTurntableAngle({rad:.6f})")
            time.sleep(0.12)
            out_png = os.path.join(OUT, f"preview_{deg:03d}.png")
            page.screenshot(path=out_png)
            print("Saved preview:", out_png)
    else:
        t0 = time.time()
        for i in range(N):
            rad = (2.0 * math.pi * i) / N
            page.evaluate(f"() => window.__CARCHESS__.setTurntableAngle({rad:.6f})")
            time.sleep(0.05)
            page.screenshot(path=f"{FRAMES}/f_{i:04d}.png")
            if i % 24 == 0:
                print(f"frame {i}/{N} ({time.time() - t0:.1f}s)")

    browser.close()
srv.shutdown()

if not PREVIEW_ONLY:
    mp4_path = os.path.join(GALLERY_DIR, "family_turntable_6up.mp4")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-framerate",
            str(FPS),
            "-i",
            f"{FRAMES}/f_%04d.png",
            "-vf",
            "scale=1600:900",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            mp4_path,
        ],
        check=True,
    )

    gif_path = os.path.join(GALLERY_DIR, "family_turntable_6up.gif")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            mp4_path,
            "-vf",
            "fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
            "-loop",
            "0",
            gif_path,
        ],
        check=True,
    )
    print(
        f"Wrote {mp4_path} ({os.path.getsize(mp4_path)/1e6:.2f} MB) and {gif_path} ({os.path.getsize(gif_path)/1e6:.2f} MB)"
    )
