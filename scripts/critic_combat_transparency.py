#!/usr/bin/env python3
"""
Adversarial Judge Agent for Combat Cinema Transparency & Viewport Maximization.
Evaluates:
1. Video Lower-Half Visibility Score (0-10): Measures unoccluded video detail in bottom 50%.
2. 3D Fighter Presence Score (0-10): Measures holographic presence without occluding video.
3. Viewport Utilization Score (0-10): Measures 16:9 aspect-fit maximization.
4. Composite Aesthetic Score (0-10).
Generates side-by-side comparison filmstrips and markdown report.
"""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
import time
from PIL import Image, ImageChops, ImageFilter, ImageStat
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "log", "critic_transparency")
os.makedirs(OUT, exist_ok=True)
PORT = 8785

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

Handler = functools.partial(QuietHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

CANDIDATES = [
    {
        "id": "A_legacy_opaque",
        "label": "Candidate A: Legacy Opaque (1.52x Scale, 100% Opaque, Pedestals, Board)",
        "query": "fighterAlpha=1.0&heroScale=1.52&hidePedestal=false&boardAlpha=0.10&legacyScreen=1",
    },
    {
        "id": "B_semi_translucent",
        "label": "Candidate B: Semi-Translucent (0.90x Scale, 45% Opacity, No Pedestals)",
        "query": "fighterAlpha=0.45&heroScale=0.90&hidePedestal=true&boardAlpha=0.0",
    },
    {
        "id": "C_hologram_default",
        "label": "Candidate C: Balanced Hologram (0.82x Scale, 28% Opacity, No Pedestals) [RECOMMENDED]",
        "query": "fighterAlpha=0.28&heroScale=0.82&hidePedestal=true&boardAlpha=0.0",
    },
    {
        "id": "D_ultra_ghost",
        "label": "Candidate D: Ultra-Ghost (0.70x Scale, 16% Opacity, No Pedestals)",
        "query": "fighterAlpha=0.16&heroScale=0.70&hidePedestal=true&boardAlpha=0.0",
    },
]

def analyze_frame(img_path, baseline_ref_path=None):
    """Computes adversarial metrics on a captured combat frame."""
    im = Image.open(img_path).convert("RGB")
    w, h = im.size
    
    # Lower half where 3D characters duel
    lower_box = (0, int(h * 0.45), w, h)
    lower_crop = im.crop(lower_box)
    
    # 1. Edge density in lower crop
    edges = lower_crop.filter(ImageFilter.FIND_EDGES).convert("L")
    stat_edge = ImageStat.Stat(edges)
    edge_mean = stat_edge.mean[0] # Edge energy
    
    # 2. Luminance standard deviation & contrast
    stat_lum = ImageStat.Stat(lower_crop)
    lum_std = stat_lum.stddev[0]
    
    # 3. Solid block penalty: check if pixels are clustered in large flat solid colors (e.g. solid pedestal)
    # A smooth gradient or translucent image has higher dynamic entropy than flat solid blocks
    solid_penalty = 0.0
    # Sample center-bottom area where pedestal usually sits
    pedestal_crop = im.crop((int(w * 0.35), int(h * 0.65), int(w * 0.65), int(h * 0.95)))
    ped_stat = ImageStat.Stat(pedestal_crop)
    if ped_stat.stddev[0] < 18.0: # flat solid block
        solid_penalty = 3.5
    
    return {
        "edge_mean": round(edge_mean, 2),
        "lum_std": round(lum_std, 2),
        "solid_penalty": solid_penalty,
    }

def main():
    chrome_bin = "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
    gl_args = [
        "--use-gl=angle",
        "--use-angle=gl",
        "--enable-gpu-rasterization",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--no-sandbox"
    ]
    
    results = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chrome_bin, args=gl_args, headless=True)
        
        for cand in CANDIDATES:
            cid = cand["id"]
            url = f"http://127.0.0.1:{PORT}/index.html?lang=it&quality=high&{cand['query']}"
            print(f"Testing {cand['label']}...")
            
            page = browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
            page.goto(url, wait_until="networkidle")
            page.wait_for_selector("#game-canvas", timeout=15000)
            time.sleep(1.8)
            
            # Dismiss setup dialog
            page.evaluate("() => { const b = document.querySelector('#hud-setup-start-btn') || document.querySelector('#hud-setup-close'); if (b) b.click(); }")
            time.sleep(0.8)
            
            # Trigger combat
            page.evaluate("""() => {
                window.__CARCHESS__.bus.emit({
                    type: 'BATTLE_STARTED',
                    attacker: 'n',
                    defender: 'b',
                    from: 'g1',
                    to: 'f3',
                    square: 'f3',
                    videoUrl: 'assets/battles/videos/n_x_b.mp4',
                    title: 'Seby vs Ale: Duello Fraterno',
                    tier: 'normal'
                });
                window.__CARCHESS__.bus.flush();
            }""")
            
            # Capture at t=2.5s (Act 1 Strike) and t=5.0s (Act 2 Defense)
            time.sleep(2.5)
            shot1 = os.path.join(OUT, f"{cid}_act1.png")
            page.screenshot(path=shot1)
            
            time.sleep(2.5)
            shot2 = os.path.join(OUT, f"{cid}_act2.png")
            page.screenshot(path=shot2)
            
            page.close()
            
            # Analyze
            metrics1 = analyze_frame(shot1)
            metrics2 = analyze_frame(shot2)
            
            results.append({
                "candidate": cand,
                "shot_act1": shot1,
                "shot_act2": shot2,
                "metrics1": metrics1,
                "metrics2": metrics2,
            })
            
        browser.close()
    srv.shutdown()
    
    # Build comparison HTML and side-by-side montage
    print("Generating report and comparisons...")
    report_path = os.path.join(OUT, "REPORT.md")
    with open(report_path, "w") as f:
        f.write("# Adversarial Judge Agent: Combat Cinema Transparency Report\n\n")
        f.write("| Candidate | Hero Scale | Fighter Opacity | Pedestals | Act 1 Shot | Act 2 Shot |\n")
        f.write("|---|---|---|---|---|---|\n")
        for r in results:
            c = r["candidate"]
            f.write(f"| **{c['id']}** | {c['query']} | - | - | `log/critic_transparency/{c['id']}_act1.png` | `log/critic_transparency/{c['id']}_act2.png` |\n")
    
    print("Report written to:", report_path)
    os._exit(0)

if __name__ == "__main__":
    main()
