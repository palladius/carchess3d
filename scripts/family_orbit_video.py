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
SECONDS = float(os.environ.get("SECONDS", "10"))
N = int(FPS * SECONDS)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

MOVES = [("d2","d4"),("a7","a6"),("e2","e4"),("h7","h6"),("f2","f4"),("a6","a5"),("g2","g4"),("h6","h5"),("b2","b4"),("a8","a7"),("c2","c4"),("h8","h7")]

# Orbit: center on the King/Queen pair, sweep from the right flank, across the front, to the left flank,
# easing in/out, with a gentle crane (height) and dolly (radius) breathing.
CX, CY, CZ = 0.3, 0.55, 3.5
def cam_at(t):  # t in [0,1]
    e = 0.5 - 0.5 * math.cos(math.pi * t)          # ease in-out
    theta = math.radians(-150 + 300 * e)           # -150° .. +150° around the back rank, facing it
    r = 3.6 - 0.9 * math.sin(math.pi * e)          # dolly in at the front
    y = 2.1 - 0.5 * math.sin(math.pi * e)          # lower at the front for eye-level faces
    x = CX + r * math.sin(theta)
    z = CZ - r * math.cos(theta)
    return (x, y, z)

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
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
        for (const el of document.body.querySelectorAll('div, nav, aside, footer, header')) {
            if (el.id && el.id.startsWith('hud') && !el.id.includes('canvas')) el.style.visibility = 'hidden';
        }
        c.controls.enabled = false; c.camera.fov = 55; c.camera.updateProjectionMatrix();
    }""")
    t0 = time.time()
    for i in range(N):
        x, y, z = cam_at(i / (N - 1))
        page.evaluate(f"""() => {{ const c = window.__CARCHESS__;
            c.camera.position.set({x:.4f}, {y:.4f}, {z:.4f}); c.controls.target.set({CX}, {CY}, {CZ});
            c.camera.lookAt({CX}, {CY}, {CZ}); c.controls.update(); }}""")
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
