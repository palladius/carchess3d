"""Family orbit video: same board setup as family_portrait_shot.py, then a smooth camera
orbit around the white back rank captured frame-by-frame and encoded with ffmpeg."""
import http.server, socketserver, threading, time, os, math, functools, subprocess, shutil
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "log", "family_orbit")
FRAMES = os.path.join(OUT, "frames")
shutil.rmtree(FRAMES, ignore_errors=True)
os.makedirs(FRAMES, exist_ok=True)
PORT = int(os.environ.get("PORT", "8772"))
FPS = 24
SECONDS = float(os.environ.get("SECONDS", "12"))
N = int(FPS * SECONDS)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

MOVES = [("d2","d4"),("a7","a6"),("e2","e4"),("h7","h6"),("f2","f4"),("a6","a5"),("g2","g4"),("h6","h5"),("b2","b4"),("a8","a7"),("c2","c4"),("h8","h7")]

# Demo-style camera choreography:
#   Phase 1 (t in [0, 0.22]): Start from a high, wide establishing view overlooking the Zurich
#     chessboard and Grossmünster skyline, then swoop down and dolly in toward the White back rank.
#   Phase 2 (t in [0.22, 1.00]): Smooth orbital sweep (-150° -> +150°) around the Carlesso family
#     (Seby 1.92m, Ale 1.55m, Dad 1.86m, Mum 1.68m, Ale 1.55m, Seby 1.92m + Pupurabbu 2.50m tower),
#     with a 1s hold right at the front portrait view (theta ≈ 0°) so all faces shine at eye level.
def smoothstep(a, b, x):
    u = max(0.0, min(1.0, (x - a) / (b - a)))
    return u * u * (3.0 - 2.0 * u)

def cam_at(t):  # t in [0, 1]
    if t < 0.22:
        # Phase 1: Wide aerial establishing shot -> swoop into right flank start of orbit (-150°)
        s = smoothstep(0.0, 0.22, t)
        theta_deg = -25.0 + (-150.0 - (-25.0)) * s
        theta = math.radians(theta_deg)
        r = 9.2 + (5.2 - 9.2) * s
        y = 5.4 + (2.45 - 5.4) * s
        cx = 0.0 + (0.3 - 0.0) * s
        cy = 0.55 + (0.95 - 0.55) * s
        cz = 0.8 + (3.5 - 0.8) * s
    else:
        # Phase 2: Full -150° .. +150° family orbit with front hold & eye-level dolly
        w = (t - 0.22) / 0.78
        e = 0.5 - 0.5 * math.cos(math.pi * w)          # ease in-out in [0, 1]
        u = 2.0 * e - 1.0                              # u in [-1, 1], 0 at front
        # Gentle plateau around u=0 so the camera lingers at the front family portrait (~1s hold)
        u_linger = 0.35 * u + 0.65 * (u ** 3)
        e_theta = 0.5 + 0.5 * u_linger
        theta = math.radians(-150.0 + 300.0 * e_theta) # -150° .. +150° around the back rank
        frontness = math.cos(0.5 * math.pi * u_linger) # 1.0 at the front, 0.0 at flanks
        r = 5.2 - 0.95 * frontness                     # r=4.25m at front -> frames all 6 family members + Pupurabbu!
        y = 2.45 - 0.55 * frontness                    # y=1.90m at front -> eye-level with 1.55m–1.92m pieces
        cx, cy, cz = 0.3, 0.95, 3.5

    x = cx + r * math.sin(theta)
    z = cz - r * math.cos(theta)
    return (x, y, z, cx, cy, cz)

with sync_playwright() as p:
    chrome_bin = "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
    gl_args = ["--use-gl=angle", "--use-angle=gl", "--enable-gpu-rasterization", "--enable-webgl", "--ignore-gpu-blocklist"] if chrome_bin else ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
    browser = p.chromium.launch(executable_path=chrome_bin, args=gl_args)
    page = browser.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
    page.goto(f"http://127.0.0.1:{PORT}/index.html?lang=en", wait_until="networkidle")
    page.wait_for_selector("#game-canvas", timeout=15000)
    time.sleep(2.5)
    page.evaluate("() => { const b = document.querySelector('#hud-setup-start-btn') || document.querySelector('#hud-setup-close'); if (b) b.click(); }")
    time.sleep(0.8)
    page.evaluate("""() => {
        const sel = document.querySelector('#hud-opponent-select');
        if (sel) { sel.value = 'hotseat'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        window.__CARCHESS__.bus.emit({ type: 'OPPONENT_CHANGED', mode: 'hotseat', enabled: false, difficulty: 'easy' });
        window.__CARCHESS__.bus.flush();
    }""")
    time.sleep(0.5)
    for frm, to in MOVES:
        page.evaluate(f"""() => {{ const c = window.__CARCHESS__;
            c.board.selectSquare('{frm}'); c.bus.flush(); c.board.requestMove('{frm}', '{to}'); c.bus.flush(); }}""")
        time.sleep(1.4)
    print("history:", page.evaluate("() => window.__CARCHESS__.board.moveHistory.map(m => m.san)"))
    time.sleep(6)
    page.evaluate("""() => {
        const c = window.__CARCHESS__;
        if (c.hud && c.hud.rootEl) c.hud.rootEl.style.visibility = 'hidden';
        document.querySelectorAll('#hud-top, #hud-dock, #hud-bottom, .hud-overlay, #hud-status, #hud-topbar, #hud-bottom-dock').forEach(e => e.style.display = 'none');
        for (const el of document.body.querySelectorAll('div, nav, aside, footer, header')) {
            if (el.id && el.id.startsWith('hud') && !el.id.includes('canvas')) el.style.visibility = 'hidden';
        }
        c.controls.enabled = false; c.camera.fov = 58; c.camera.updateProjectionMatrix();
    }""")
    t0 = time.time()
    for i in range(N):
        x, y, z, cx, cy, cz = cam_at(i / (N - 1))
        page.evaluate(f"""() => {{ const c = window.__CARCHESS__;
            c.camera.position.set({x:.4f}, {y:.4f}, {z:.4f}); c.controls.target.set({cx:.4f}, {cy:.4f}, {cz:.4f});
            c.camera.lookAt({cx:.4f}, {cy:.4f}, {cz:.4f}); c.controls.update(); }}""")
        time.sleep(0.08)
        page.screenshot(path=f"{FRAMES}/f_{i:04d}.png")
        if i % 24 == 0:
            print(f"frame {i}/{N} ({time.time()-t0:.0f}s)")
    browser.close()
srv.shutdown()

mp4 = os.path.join(OUT, "family_orbit.mp4")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{FRAMES}/f_%04d.png",
                "-vf", "scale=1280:-2", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", mp4], check=True)
gif = os.path.join(OUT, "family_orbit.gif")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp4,
                "-vf", "fps=12,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
                "-loop", "0", gif], check=True)
print("wrote", mp4, gif)
