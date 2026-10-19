"""Family portrait screenshot: advance pawns d,e,f,g 2->4 and shoot the white back rank up close."""
import http.server, socketserver, threading, time, os, sys, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "log", "family_portrait")
os.makedirs(OUT, exist_ok=True)
PORT = 8771

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Q, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

# camera presets to try: (pos, target)
SHOTS = {
    "t_fov70_front": ((0.3, 1.6, 1.2), (0.3, 0.6, 3.5), 70),
    "u_fov80_front": ((0.3, 1.5, 1.3), (0.3, 0.65, 3.5), 80),
    "v_fov70_right": ((1.4, 1.6, 1.1), (0.2, 0.6, 3.5), 70),
    "w_back_fov60": ((0.3, 2.0, -0.3), (0.3, 0.55, 3.5), 60),
}

MOVES = [("d2","d4"),("a7","a6"),("e2","e4"),("h7","h6"),("f2","f4"),("a6","a5"),("g2","g4"),("h6","h5"),("b2","b4"),("a8","a7"),("c2","c4"),("h8","h7")]

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
    page.goto(f"http://127.0.0.1:{PORT}/index.html?lang=en", wait_until="networkidle")
    page.wait_for_selector("#game-canvas", timeout=15000)
    time.sleep(2.5)
    page.evaluate("() => { const b = document.querySelector('#hud-setup-start-btn') || document.querySelector('#hud-setup-close'); if (b) b.click(); }")
    time.sleep(0.8)
    # human vs human hotseat so black can make quiet moves
    page.evaluate("""() => {
        const sel = document.querySelector('#hud-opponent-select');
        if (sel) { sel.value = 'hotseat'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        window.__CARCHESS__.bus.emit({ type: 'OPPONENT_CHANGED', mode: 'hotseat', enabled: false, difficulty: 'easy' });
        window.__CARCHESS__.bus.flush();
    }""")
    time.sleep(0.5)
    for frm, to in MOVES:
        page.evaluate(f"""() => {{
            const c = window.__CARCHESS__;
            c.board.selectSquare('{frm}'); c.bus.flush();
            c.board.requestMove('{frm}', '{to}'); c.bus.flush();
        }}""")
        time.sleep(1.4)
    hist = page.evaluate("() => window.__CARCHESS__.board.moveHistory.map(m => m.san)")
    print("history:", hist)
    time.sleep(6)  # let GLBs settle / walk animations finish
    # hide HUD chrome
    page.evaluate("""() => {
        const r = window.__CARCHESS__.hud && window.__CARCHESS__.hud.rootEl; if (r) r.style.visibility = 'hidden';
        document.querySelectorAll('#hud-top, #hud-dock, #hud-bottom, .hud-overlay, #hud-status, #hud-topbar, #hud-bottom-dock').forEach(e => e.style.display = 'none');
        for (const el of document.body.querySelectorAll('div, nav, aside, footer, header')) {
            if (el.id && el.id.startsWith('hud') && !el.id.includes('canvas')) el.style.visibility = 'hidden';
        }
    }""")
    for name, (pos, tgt, fov) in SHOTS.items():
        page.evaluate(f"""() => {{
            const c = window.__CARCHESS__;
            c.controls.enabled = false; c.camera.fov = {fov}; c.camera.updateProjectionMatrix();
            c.camera.position.set({pos[0]}, {pos[1]}, {pos[2]});
            c.controls.target.set({tgt[0]}, {tgt[1]}, {tgt[2]});
            c.camera.lookAt({tgt[0]}, {tgt[1]}, {tgt[2]});
            c.controls.update();
        }}""")
        time.sleep(1.2)
        page.screenshot(path=f"{OUT}/{name}.png")
        print("shot", name)
    browser.close()
srv.shutdown()
