#!/usr/bin/env python3
"""Deterministic 16:9 Battle Cinema Video Generator for CarChess3D (`assets/battles/videos/*.mp4`).

Generates 1280x720 @ 24fps H.264 `.mp4` battle clips for the 16:9 Magic Cinema Mirror
between the Grossmünster Twin Towers (`VeoCinemaView.js` Tier 1 `THREE.VideoTexture`):
1. `assets/battles/videos/b_x_n.mp4` — Bishop Ale & Red Dragon vs Knight Seby ("CRISTALLO DRAGO BAM! 💎🐉")
2. `assets/battles/videos/n_x_b.mp4` — Knight Seby vs Bishop Ale ("STECCHITO! PISTA TURBO! 🏎️✨")
3. `assets/battles/videos/n_x_r.mp4` — Knight Seby <-> Rook Pupurabbu ("SUPER ABBRACCIO PUFFOSO! 💜🤗")

Run via:
  UV_INDEX_URL=https://pypi.org/simple uv run --with pillow python3 scripts/render_battle_videos.py
"""
import math
import pathlib
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets/battles/videos"
CHARS_DIR = ROOT / "assets/characters"

W, H = 1280, 720
FPS = 24
FRAMES = 60  # 2.5s seamless action loop


def load_font(size: int):
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if pathlib.Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def load_character_cutout(rel_path: str, target_h: int = 430) -> Image.Image:
    p = ROOT / rel_path
    img = Image.open(p).convert("RGBA")
    iw, ih = img.size
    # Crop left character bust/full figure from 2-up sheet if wide
    if iw > ih * 1.25:
        box = (int(iw * 0.03), int(ih * 0.02), int(iw * 0.47), int(ih * 0.96))
        img = img.crop(box)
    cw, ch = img.size
    scale = target_h / max(1, ch)
    new_w = int(cw * scale)
    img = img.resize((new_w, target_h), Image.Resampling.LANCZOS)

    # Rounded card mask with glowing border
    card = Image.new("RGBA", (new_w + 24, target_h + 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle(
        (4, 4, new_w + 20, target_h + 20),
        radius=28,
        fill=(18, 24, 42, 235),
        outline=(255, 213, 79, 255),
        width=6,
    )
    mask = Image.new("L", (new_w, target_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, new_w, target_h), radius=22, fill=255)
    card.paste(img, (12, 12), mask)
    return card


def draw_swamp_cinema_backdrop(t: float, theme: str) -> Image.Image:
    base = Image.new("RGBA", (W, H), (14, 20, 36, 255))
    draw = ImageDraw.Draw(base)

    # Twilight sky & Enchanted Swamp gradient bands
    for y in range(0, H, 4):
        u = y / H
        if theme == "crystal":
            r = int(22 + 48 * u + 18 * math.sin(t * math.tau + u * 3))
            g = int(18 + 26 * u)
            b = int(58 + 75 * (1 - u))
        elif theme == "turbo":
            r = int(38 + 70 * u)
            g = int(22 + 35 * u)
            b = int(42 + 45 * (1 - u))
        else:  # cuddle
            r = int(68 + 65 * u)
            g = int(20 + 38 * (1 - u))
            b = int(92 + 70 * u)
        draw.rectangle((0, y, W, y + 4), fill=(max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)), 255))

    # Glowing chessboard perspective floor at bottom
    horizon_y = 490
    draw.polygon(
        [(0, H), (W, H), (W - 180, horizon_y), (180, horizon_y)],
        fill=(18, 42, 36, 210),
        outline=(230, 184, 74, 200),
    )
    for col in range(-4, 5):
        x_top = W // 2 + col * 95
        x_bot = W // 2 + col * 185
        draw.line([(x_top, horizon_y), (x_bot, H)], fill=(230, 184, 74, 110), width=2)

    # Grossmünster silhouettes in background corners
    for tx in (90, W - 190):
        draw.rectangle((tx, 140, tx + 100, horizon_y), fill=(26, 30, 46, 220), outline=(230, 184, 74, 90), width=2)
        draw.polygon([(tx - 10, 140), (tx + 50, 55), (tx + 110, 140)], fill=(158, 58, 48, 230))

    return base


def render_clip(filename: str, atk_img_rel: str, def_img_rel: str, title: str, subtitle: str, mode: str):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / filename

    atk_card = load_character_cutout(atk_img_rel, 390)
    def_card = load_character_cutout(def_img_rel, 390)
    font_title = load_font(38)
    font_sub = load_font(26)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = pathlib.Path(tmpdir)
        for f_idx in range(FRAMES):
            t = f_idx / FRAMES
            ang = t * math.tau
            frame = draw_swamp_cinema_backdrop(t, mode)
            overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            odraw = ImageDraw.Draw(overlay)

            # Compute dynamic attacker & defender positions
            if mode == "crystal":
                # Ale lunges right at t=0.2..0.5, dragon breathes fire, Seby crystallizes & shatters!
                lunge = math.sin(min(1.0, max(0.0, (t - 0.1) * 2.2)) * math.pi) * 95
                ax = int(110 + lunge)
                ay = int(145 + math.sin(ang * 2) * 10)
                shake = int(math.sin(ang * 12) * 14) if t > 0.45 else 0
                dx = int(W - 110 - def_card.width + shake)
                dy = int(145 + math.cos(ang * 2) * 10)
            elif mode == "turbo":
                # Seby zooms around with orange loop-track, bowling Ale flat!
                lunge = math.sin(min(1.0, max(0.0, (t - 0.1) * 2.0)) * math.pi) * 110
                ax = int(110 + lunge)
                ay = int(140 - abs(math.sin(ang * 3)) * 22)
                dx = int(W - 110 - def_card.width + (int(math.sin(ang * 10) * 16) if t > 0.5 else 0))
                dy = int(145)
            else:
                # Cuddle bounce: Seby & Pupurabbu hop to the center and hug!
                hop = abs(math.sin(ang * 3)) * 48
                converge = math.sin(t * math.pi) * 145
                ax = int(125 + converge)
                ay = int(150 - hop)
                dx = int(W - 125 - def_card.width - converge)
                dy = int(150 - hop)

            frame.alpha_composite(atk_card, (ax, ay))

            # If Ale gets bowled flat in turbo mode after t=0.58, squash defender card vertically!
            if mode == "turbo" and t > 0.55:
                squash_ratio = max(0.32, 1.0 - math.sin((t - 0.55) / 0.45 * math.pi) * 0.65)
                sq_h = max(60, int(def_card.height * squash_ratio))
                sq_w = int(def_card.width * (1.0 + (1.0 - squash_ratio) * 0.35))
                squashed = def_card.resize((sq_w, sq_h), Image.Resampling.LANCZOS)
                frame.alpha_composite(squashed, (dx - (sq_w - def_card.width) // 2, dy + (def_card.height - sq_h)))
            else:
                frame.alpha_composite(def_card, (dx, dy))

            # Mode-specific high-energy 2D/3D VFX choreography
            cx, cy = W // 2, H // 2 + 10
            if mode == "crystal":
                # 1. Dragon Fire Breath stream from Ale (left) to Seby (right)
                if 0.12 <= t <= 0.72:
                    beam_prog = min(1.0, (t - 0.12) / 0.35)
                    start_x, start_y = ax + atk_card.width - 20, ay + 150
                    end_x = int(start_x + (dx + def_card.width // 2 - start_x) * beam_prog)
                    end_y = dy + 190
                    for i in range(18):
                        u = i / 17.0
                        px = int(start_x + (end_x - start_x) * u)
                        py = int(start_y + (end_y - start_y) * u + math.sin(ang * 5 + i) * 18)
                        rad = int(16 + u * 36 + math.sin(ang * 8 + i) * 6)
                        col = (255, 235, 59, 220) if i % 3 == 0 else (255, 111, 0, 210) if i % 2 == 0 else (255, 45, 0, 195)
                        odraw.ellipse((px - rad, py - rad, px + rad, py + rad), fill=col)

                # 2. Purple Amethyst Crystal Case encasing Seby (t=0.35..0.68) -> Shattering Shards (t>0.65)
                tx_c, ty_c = dx + def_card.width // 2, dy + def_card.height // 2
                if 0.32 <= t <= 0.68:
                    c_alpha = int(195 * math.sin((t - 0.32) / 0.36 * math.pi))
                    pts = [
                        (tx_c, dy - 35),
                        (dx + def_card.width + 35, ty_c - 60),
                        (dx + def_card.width + 25, ty_c + 95),
                        (tx_c, dy + def_card.height + 35),
                        (dx - 25, ty_c + 95),
                        (dx - 35, ty_c - 60),
                    ]
                    odraw.polygon(pts, fill=(171, 71, 188, c_alpha), outline=(234, 128, 252, 255))
                    odraw.line([pts[0], pts[3]], fill=(255, 255, 255, 200), width=4)
                    odraw.line([pts[1], pts[4]], fill=(234, 128, 252, 190), width=3)

                if t >= 0.58:
                    burst = (t - 0.58) / 0.42
                    for s in range(36):
                        s_ang = s * 0.65 + (s % 3) * 0.2
                        dist = 30 + burst * (260 + (s % 5) * 45)
                        sx = int(tx_c + math.cos(s_ang) * dist)
                        sy = int(ty_c + math.sin(s_ang) * dist + (burst ** 2) * 95)
                        sz = max(8, int(26 * (1.0 - burst * 0.4)))
                        rot = s_ang + burst * 6.0
                        poly = [
                            (sx + int(math.cos(rot + k * 1.57) * sz), sy + int(math.sin(rot + k * 1.57) * sz))
                            for k in range(4)
                        ]
                        shard_col = (224, 64, 251, 235) if s % 2 == 0 else (255, 64, 129, 235)
                        odraw.polygon(poly, fill=shard_col, outline=(255, 255, 255, 240))

            elif mode == "turbo":
                # Orange Hot-Wheels Loop-Track ring + 8 zooming toy race cars + orbiting stars!
                loop_cx, loop_cy = W // 2 + 40, H // 2 + 15
                rx, ry = 310, 175
                # Outer & inner orange track bands
                odraw.ellipse(
                    (loop_cx - rx, loop_cy - ry, loop_cx + rx, loop_cy + ry),
                    outline=(255, 109, 0, 245),
                    width=22,
                )
                odraw.ellipse(
                    (loop_cx - rx + 6, loop_cy - ry + 6, loop_cx + rx - 6, loop_cy + ry - 6),
                    outline=(255, 214, 0, 235),
                    width=4,
                )
                car_colors = [
                    (255, 23, 68, 255),
                    (0, 229, 255, 255),
                    (118, 255, 3, 255),
                    (255, 234, 0, 255),
                    (213, 0, 249, 255),
                    (255, 145, 0, 255),
                ]
                for c_idx in range(8):
                    c_ang = ang * 2.0 + (c_idx / 8.0) * math.tau
                    car_x = int(loop_cx + math.cos(c_ang) * rx)
                    car_y = int(loop_cy + math.sin(c_ang) * ry)
                    col = car_colors[c_idx % len(car_colors)]
                    odraw.rounded_rectangle(
                        (car_x - 26, car_y - 14, car_x + 26, car_y + 14),
                        radius=8,
                        fill=col,
                        outline=(255, 255, 255, 255),
                        width=3,
                    )
                    # Wheels
                    odraw.ellipse((car_x - 20, car_y + 8, car_x - 8, car_y + 20), fill=(20, 20, 20, 255))
                    odraw.ellipse((car_x + 8, car_y + 8, car_x + 20, car_y + 20), fill=(20, 20, 20, 255))

                # Orbiting stars over Ale when squashed
                if t > 0.5:
                    for st in range(6):
                        st_a = ang * 3.0 + st * (math.tau / 6)
                        st_x = int(dx + def_card.width // 2 + math.cos(st_a) * 115)
                        st_y = int(dy + 95 + math.sin(st_a) * 38)
                        odraw.regular_polygon((st_x, st_y, 18), n_sides=5, rotation=int(t * 360), fill=(255, 235, 59, 255), outline=(255, 111, 0, 255))

            else:
                # Mega Cuddle Bounce: Rainbow heart aura + 32 bursting purple/pink hearts!
                for r_ring in range(3):
                    rad = int(90 + r_ring * 65 + math.sin(ang * 2 + r_ring) * 18)
                    odraw.ellipse(
                        (cx - rad, cy - rad, cx + rad, cy + rad),
                        outline=(255, 128, 171, 190 - r_ring * 45),
                        width=6,
                    )
                for h_idx in range(28):
                    h_ang = (h_idx / 28.0) * math.tau + ang * 0.5
                    dist = 45 + ((t * 260 + h_idx * 37) % 280)
                    hx = int(cx + math.cos(h_ang) * dist * 1.35)
                    hy = int(cy + math.sin(h_ang) * dist - math.sin(ang + h_idx) * 25)
                    hs = 16 + (h_idx % 3) * 6
                    hcol = (234, 128, 252, 235) if h_idx % 2 == 0 else (255, 64, 129, 235)
                    # Draw heart shape
                    odraw.ellipse((hx - hs, hy - hs, hx, hy), fill=hcol)
                    odraw.ellipse((hx, hy - hs, hx + hs, hy), fill=hcol)
                    odraw.polygon([(hx - hs, hy - hs // 3), (hx + hs, hy - hs // 3), (hx, hy + hs)], fill=hcol)

            # Top header bar inside video
            odraw.rounded_rectangle((40, 18, 660, 74), radius=18, fill=(14, 20, 36, 225), outline=(255, 213, 79, 240), width=3)
            odraw.text((64, 29), title, font=font_title, fill=(255, 224, 130, 255))

            # Bottom comic impact banner inside video
            odraw.rounded_rectangle((220, 628, 1060, 698), radius=24, fill=(255, 193, 7, 242), outline=(255, 255, 255, 255), width=4)
            odraw.text((290, 642), subtitle, font=font_title, fill=(26, 15, 10, 255))

            frame.alpha_composite(overlay)
            frame.convert("RGB").save(tmp / f"frame_{f_idx:04d}.png")

        # Encode to H.264 MP4 (browser-native yuv420p)
        cmd_mp4 = [
            "ffmpeg",
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(tmp / "frame_%04d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "baseline",
            "-level",
            "3.1",
            "-movflags",
            "+faststart",
            str(out_path),
        ]
        subprocess.run(cmd_mp4, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"🎬 Rendered 16:9 battle MP4:  {out_path.relative_to(ROOT)} ({out_path.stat().st_size // 1024} KB)")

        # Also encode VP8 WebM sibling for open-source Chromium builds without proprietary H.264
        webm_path = out_path.with_suffix(".webm")
        cmd_webm = [
            "ffmpeg",
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(tmp / "frame_%04d.png"),
            "-c:v",
            "libvpx",
            "-pix_fmt",
            "yuv420p",
            "-b:v",
            "1.5M",
            "-crf",
            "12",
            str(webm_path),
        ]
        subprocess.run(cmd_webm, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"🎬 Rendered 16:9 battle WebM: {webm_path.relative_to(ROOT)} ({webm_path.stat().st_size // 1024} KB)")


def main():
    render_clip(
        "b_x_n.mp4",
        "assets/characters/bishop-ale-1.jpg",
        "assets/characters/knight-seby-4.jpg",
        "ALFIERE ALE vs CAVALIERE SEBY",
        "CRISTALLO DRAGO BAM!",
        "crystal",
    )
    render_clip(
        "n_x_b.mp4",
        "assets/characters/knight-seby-4.jpg",
        "assets/characters/bishop-ale-1.jpg",
        "CAVALIERE SEBY vs ALFIERE ALE",
        "STECCHITO! PISTA TURBO!",
        "turbo",
    )
    render_clip(
        "n_x_r.mp4",
        "assets/characters/knight-seby-4.jpg",
        "assets/characters/rook-pupurabbu.jpg",
        "SEBY <3 PUPURABBU (ABBRACCIO)",
        "SUPER ABBRACCIO PUFFOSO!",
        "cuddle",
    )


if __name__ == "__main__":
    main()
