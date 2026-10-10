#!/usr/bin/env python3
"""Deterministic 16:9 Battle Cinema Video Generator for all 36 (6x6) CarChess3D Matchups.

Generates all 36 (`6 x 6`) H.264 `.mp4` and VP8 `.webm` 16:9 battle clips in
`assets/battles/videos/<atk>_x_<def>.mp4` and `.webm` (`k, q, b, n, r, p` x `k, q, b, n, r, p`).

Each 2.6s clip (960x540 @ 20fps = 52 frames) renders:
- Actual Carlesso Family character portraits (`assets/characters/*.jpg`)
- Unique pair title & comic battle cry banner matching `src/core/BattleMatrix36.js`
- Act 1 (t = 0.00..0.32): Attacker Lunge & Weapon Charge
- Act 2 (t = 0.32..0.64): Defender Counter-Attack Clash + Comic Burst (`ZAP!`, `FIAMMA!`, `IMPENNATA!`, `BOING!`, `SCUDO!`, `PARATA!`)
- Act 3 (t = 0.64..1.00): Signature Finisher + Shrek Swamp K.O. Splash (or `n<->r` Mega Cuddle Hearts!)

Run via:
  UV_INDEX_URL=https://pypi.org/simple uv run --with pillow python3 scripts/render_battle_videos.py
"""
import concurrent.futures
import math
import os
import pathlib
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets/battles/videos"

W, H = 960, 540
FPS = 20
FRAMES = 52  # 2.60s 3-act choreography

PIECE_PORTRAITS = {
    "k": "assets/characters/king-riccardo-1.jpg",
    "q": "assets/characters/queen-kate-4.jpg",
    "b": "assets/characters/bishop-ale-1.jpg",
    "n": "assets/characters/knight-seby-4.jpg",
    "r": "assets/characters/rook-pupurabbu.jpg",
    "p": "assets/characters/pawn-puffin.jpg",
}

PIECE_NAMES = {
    "k": "RE RICCARDO",
    "q": "REGINA KATE",
    "b": "ALFIERE ALE",
    "n": "CAVALIERE SEBY",
    "r": "TORRE PUPURABBU",
    "p": "PEDONE PUFFIN",
}

DEFENDER_COUNTERS = {
    "k": ("ZAP! SCETTRO!", "Parata lampo reale!", (255, 215, 64)),
    "q": ("SCUDO LILLA!", "Barriera ciocco-lilla!", (206, 147, 216)),
    "b": ("FIAMMA DRAGO!", "Soffio di fuoco rosso!", (255, 112, 67)),
    "n": ("IMPENNATA!", "Calcio turbo destriero!", (255, 152, 0)),
    "r": ("BOING PANCIA!", "Rimbalzo super puffoso!", (179, 136, 255)),
    "p": ("PARATA PESCE!", "Alabarda & aringa!", (77, 208, 225)),
}

# All 36 bespoke (atk, def) -> (title, banner, weapon_theme)
BATTLES_36 = {
    # Row 1: King Riccardo (k)
    ("k", "k"): ("RE RICCARDO vs RE RICCARDO", "DOPPIO SCETTRO LAMPO! CORONA CONTRO CORONA!", "sceptre"),
    ("k", "q"): ("RE RICCARDO vs REGINA KATE", "CARLESSO AL CESSO! TRONO D'ORO REALE!", "throne"),
    ("k", "b"): ("RE RICCARDO vs ALFIERE ALE", "SCETTRO DI PAPA CONTRO FIAMMA DEL DRAGO!", "sceptre"),
    ("k", "n"): ("RE RICCARDO vs CAVALIERE SEBY", "MULTA REALE ALLA PISTA TURBO DI SEBY!", "sceptre"),
    ("k", "r"): ("RE RICCARDO vs TORRE PUPURABBU", "TUONO D'ORO SUL PELUCHE GIGANTE!", "sceptre"),
    ("k", "p"): ("RE RICCARDO vs PEDONE PUFFIN", "DECRETO REALE: PUFFIN NELLA PALUDE!", "sceptre"),
    # Row 2: Queen Kate (q)
    ("q", "k"): ("REGINA KATE vs RE RICCARDO", "CARLESSO AL CESSO! ONDA LILLA SUL TRONO D'ORO!", "throne"),
    ("q", "q"): ("REGINA KATE vs REGINA KATE", "DOPPIO VORTICE CIOCCO-LILLA IMPERIALE!", "choco"),
    ("q", "b"): ("REGINA KATE vs ALFIERE ALE", "MERENDA DI CIOCCOLATO PER IL DRAGHETTO DI ALE!", "choco"),
    ("q", "n"): ("REGINA KATE vs CAVALIERE SEBY", "PISTA TURBO INCOLLATA NEL CIOCCOLATO LILLA!", "choco"),
    ("q", "r"): ("REGINA KATE vs TORRE PUPURABBU", "PIOGGIA DI PRALINE LILLA SU PUPURABBU!", "choco"),
    ("q", "p"): ("REGINA KATE vs PEDONE PUFFIN", "PESCIOLINO DI CIOCCOLATO PER IL PUFFIN!", "choco"),
    # Row 3: Bishop Ale (b)
    ("b", "k"): ("ALFIERE ALE vs RE RICCARDO", "DRAGHETTO DI ALE CRISTALLIZZA LA CORONA REALE!", "crystal"),
    ("b", "q"): ("ALFIERE ALE vs REGINA KATE", "FIAMMA DEL DRAGO E GEMME VIOLA PER MAMMA KATE!", "crystal"),
    ("b", "b"): ("ALFIERE ALE vs ALFIERE ALE", "SCONTRO TRA DRAGHETTI ROSSI! PIOGGIA DI AMETISTE!", "crystal"),
    ("b", "n"): ("ALFIERE ALE vs CAVALIERE SEBY", "ALE vs SEBY: CRISTALLO DRAGO SUL CAVALLINO!", "crystal"),
    ("b", "r"): ("ALFIERE ALE vs TORRE PUPURABBU", "CRISTALLO DI FUOCO SUL GIGANTE PUPURABBU!", "crystal"),
    ("b", "p"): ("ALFIERE ALE vs PEDONE PUFFIN", "PESCE ARROSTO E GEMME PER IL PUFFIN!", "crystal"),
    # Row 4: Knight Seby (n)
    ("n", "k"): ("CAVALIERE SEBY vs RE RICCARDO", "SUPER LOOP ARANCIONE ATTORNO AL TRONO DI PAPA!", "turbo"),
    ("n", "q"): ("CAVALIERE SEBY vs REGINA KATE", "MACCHININE TURBO IN DERAPATA SULLA REGINA!", "turbo"),
    ("n", "b"): ("CAVALIERE SEBY vs ALFIERE ALE", "SEBY vs ALE: STECCHITO! MACCHININE CONTRO DRAGO!", "turbo"),
    ("n", "n"): ("CAVALIERE SEBY vs CAVALIERE SEBY", "DOPPIA PISTA HOT-WHEELS! DUE CAVALLI IN IMPENNATA!", "turbo"),
    ("n", "r"): ("CAVALIERE SEBY <3 PUPURABBU", "SEBY & PUPURABBU: SUPER ABBRACCIO PUFFOSO!", "cuddle"),
    ("n", "p"): ("CAVALIERE SEBY vs PEDONE PUFFIN", "BEEP BEEP PUFFIN! PASSA IL CAVALLO TURBO DI SEBY!", "turbo"),
    # Row 5: Rook Pupurabbu (r)
    ("r", "k"): ("TORRE PUPURABBU vs RE RICCARDO", "SALTO GIGANTE DI PUPURABBU SULLA CORONA D'ORO!", "plush"),
    ("r", "q"): ("TORRE PUPURABBU vs REGINA KATE", "BOMBOLONE PUFFOSO NEL VORTICE DI REGINA KATE!", "plush"),
    ("r", "b"): ("TORRE PUPURABBU vs ALFIERE ALE", "PANCIA GOMMOSA DI PUPURABBU SPEGNE IL DRAGO!", "plush"),
    ("r", "n"): ("PUPURABBU <3 CAVALIERE SEBY", "PUPURABBU & SEBY: SUPER ABBRACCIO PUFFOSO GIGANTE!", "cuddle"),
    ("r", "r"): ("TORRE PUPURABBU vs PUPURABBU", "DOPPIO BOING PUFFOSO! SCONTRO SUMO VIOLA!", "plush"),
    ("r", "p"): ("TORRE PUPURABBU vs PEDONE PUFFIN", "FRITTELLA DI PUFFIN SOTTO IL PELUCHE GIGANTE!", "plush"),
    # Row 6: Pawn Puffin (p)
    ("p", "k"): ("PEDONE PUFFIN vs RE RICCARDO", "ARINGA D'ARGENTO SUL BAFFO DI RE RICCARDO! PLING!", "halberd"),
    ("p", "q"): ("PEDONE PUFFIN vs REGINA KATE", "PUFFIN SLAP CONTRO LA BACCHETTA DI REGINA KATE!", "halberd"),
    ("p", "b"): ("PEDONE PUFFIN vs ALFIERE ALE", "SCHIAFFO DI TROTA SUL NASO DEL DRAGHETTO DI ALE!", "halberd"),
    ("p", "n"): ("PEDONE PUFFIN vs CAVALIERE SEBY", "ALTOLA GUARDIA SVIZZERA! PESCIATA ALLA PISTA TURBO!", "halberd"),
    ("p", "r"): ("PEDONE PUFFIN vs TORRE PUPURABBU", "PICCOLO PUFFIN FA VOLARE IL GIGANTE PUPURABBU!", "halberd"),
    ("p", "p"): ("PEDONE PUFFIN vs PEDONE PUFFIN", "DOPPIA GUARDIA SVIZZERA! SCHERMA DI PESCI D'ARGENTO!", "halberd"),
}


def load_font(size: int):
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if pathlib.Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def load_character_cutout(rel_path: str, border_col: tuple, target_h: int = 275) -> Image.Image:
    p = ROOT / rel_path
    img = Image.open(p).convert("RGBA")
    iw, ih = img.size
    if iw > ih * 1.25:
        box = (int(iw * 0.03), int(ih * 0.02), int(iw * 0.47), int(ih * 0.96))
        img = img.crop(box)
    cw, ch = img.size
    scale = target_h / max(1, ch)
    new_w = int(cw * scale)
    img = img.resize((new_w, target_h), Image.Resampling.LANCZOS)

    card = Image.new("RGBA", (new_w + 20, target_h + 20), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle(
        (3, 3, new_w + 17, target_h + 17),
        radius=22,
        fill=(18, 24, 42, 240),
        outline=border_col,
        width=5,
    )
    mask = Image.new("L", (new_w, target_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, new_w, target_h), radius=18, fill=255)
    card.paste(img, (10, 10), mask)
    return card


def draw_swamp_cinema_backdrop(t: float, theme: str) -> Image.Image:
    base = Image.new("RGBA", (W, H), (14, 20, 36, 255))
    draw = ImageDraw.Draw(base)

    theme_palettes = {
        "sceptre": ((34, 28, 12), (76, 56, 18)),
        "throne": ((44, 32, 10), (92, 68, 16)),
        "choco": ((42, 20, 48), (88, 42, 95)),
        "crystal": ((22, 18, 56), (68, 32, 96)),
        "turbo": ((46, 22, 18), (94, 46, 22)),
        "cuddle": ((58, 22, 68), (112, 44, 118)),
        "plush": ((36, 18, 58), (78, 38, 110)),
        "halberd": ((14, 34, 48), (28, 68, 86)),
    }
    top_c, bot_c = theme_palettes.get(theme, ((22, 24, 48), (52, 42, 82)))
    pulse = int(12 * math.sin(t * math.tau))

    for y in range(0, H, 6):
        u = y / H
        r = max(0, min(255, int(top_c[0] * (1 - u) + bot_c[0] * u + pulse)))
        g = max(0, min(255, int(top_c[1] * (1 - u) + bot_c[1] * u)))
        b = max(0, min(255, int(top_c[2] * (1 - u) + bot_c[2] * u - pulse)))
        draw.rectangle((0, y, W, y + 6), fill=(r, g, b, 255))

    # Shrek Enchanted Swamp glowing water strips on left & right moats
    horizon_y = 365
    draw.rectangle((0, horizon_y, W, H), fill=(16, 48, 34, 255))
    # Chessboard perspective center altar
    draw.polygon(
        [(130, H), (W - 130, H), (W - 220, horizon_y), (220, horizon_y)],
        fill=(22, 34, 46, 235),
        outline=(230, 184, 74, 210),
    )
    for col in range(-4, 5):
        x_top = W // 2 + col * 65
        x_bot = W // 2 + col * 130
        draw.line([(x_top, horizon_y), (x_bot, H)], fill=(230, 184, 74, 110), width=2)

    # Grossmünster Twin Towers silhouettes in background corners
    for tx in (62, W - 138):
        draw.rectangle((tx, 105, tx + 76, horizon_y), fill=(26, 30, 46, 225), outline=(230, 184, 74, 95), width=2)
        draw.polygon([(tx - 8, 105), (tx + 38, 42), (tx + 84, 105)], fill=(158, 58, 48, 235))

    return base


def draw_weapon_and_choreo(
    odraw: ImageDraw.ImageDraw,
    t: float,
    ang: float,
    atk: str,
    dfn: str,
    theme: str,
    ax: int,
    ay: int,
    aw: int,
    ah: int,
    dx: int,
    dy: int,
    dw: int,
    dh: int,
    font_med,
    font_sm,
):
    cx, cy = W // 2, H // 2 + 8
    ax_front = ax + aw - 10
    ay_mid = ay + ah // 2
    dx_front = dx + 10
    dy_mid = dy + dh // 2

    # =========================================================================
    # ACT 1 (t = 0.00 .. 0.34): ATTACKER WEAPON CHARGE & LUNGE
    # =========================================================================
    if t <= 0.42:
        p1 = min(1.0, t / 0.34)
        bx = int(ax_front + (cx - ax_front) * p1)
        by = int(ay_mid - math.sin(p1 * math.pi) * 28)
        if theme in ("sceptre", "throne"):
            # Golden lightning bolt & sceptre orb
            pts = [
                (ax_front, ay_mid - 15),
                (ax_front + 45, ay_mid - 42),
                (ax_front + 35, ay_mid - 10),
                (bx, by),
            ]
            odraw.line(pts, fill=(255, 235, 59, 250), width=7)
            odraw.ellipse((bx - 22, by - 22, bx + 22, by + 22), fill=(255, 213, 79, 235), outline=(255, 255, 255, 255), width=3)
        elif theme == "choco":
            # Lilac & Milk-Chocolate swirl stream
            for i in range(10):
                u = i / 9.0
                sx = int(ax_front + (bx - ax_front) * u)
                sy = int(ay_mid + math.sin(ang * 4 + i) * 20)
                col = (186, 104, 200, 235) if i % 2 == 0 else (109, 76, 65, 235)
                odraw.ellipse((sx - 16, sy - 16, sx + 16, sy + 16), fill=col, outline=(255, 213, 79, 220))
        elif theme == "crystal":
            # Red Dragon Firebreath stream
            for i in range(12):
                u = i / 11.0
                sx = int(ax_front + (bx - ax_front) * u)
                sy = int(ay_mid + math.sin(ang * 5 + i) * 16)
                r = 12 + int(u * 20)
                col = (255, 235, 59, 230) if i % 3 == 0 else (255, 87, 34, 225)
                odraw.ellipse((sx - r, sy - r, sx + r, sy + r), fill=col)
        elif theme == "turbo":
            # Orange Hot-Wheels track arc + toy race car
            odraw.arc((ax_front - 20, ay_mid - 70, bx + 60, ay_mid + 70), 190, 350, fill=(255, 109, 0, 250), width=12)
            odraw.rounded_rectangle((bx - 24, by - 12, bx + 24, by + 12), radius=6, fill=(255, 23, 68, 255), outline=(255, 255, 255, 255), width=2)
        elif theme in ("plush", "cuddle"):
            # Giant purple plush aura rings
            for k in range(3):
                rad = 24 + k * 18
                odraw.ellipse((bx - rad, by - rad, bx + rad, by + rad), outline=(224, 64, 251, 220 - k * 50), width=4)
        else:  # halberd
            # Swiss Guard Halberd + Silver Fish
            odraw.line([(ax_front - 10, ay_mid + 30), (bx + 20, by - 25)], fill=(255, 213, 79, 255), width=6)
            odraw.ellipse((bx - 24, by - 12, bx + 24, by + 12), fill=(129, 212, 250, 250), outline=(255, 255, 255, 255), width=2)

    # =========================================================================
    # ACT 2 (t = 0.32 .. 0.66): DEFENDER COUNTER-ATTACK & CLASH!
    # =========================================================================
    if 0.32 <= t <= 0.66:
        sfx_word, counter_desc, def_col = DEFENDER_COUNTERS[dfn]
        p2 = (t - 0.32) / 0.34
        pulse_r = int(58 + math.sin(p2 * math.pi) * 32)

        # Counter beam / shield from Defender (right) toward center clash point
        odraw.line(
            [(dx_front, dy_mid), (cx + 15, cy)],
            fill=(*def_col, 240),
            width=10,
        )
        odraw.ellipse(
            (cx - pulse_r, cy - pulse_r, cx + pulse_r, cy + pulse_r),
            fill=(26, 18, 48, 215),
            outline=(*def_col, 255),
            width=6,
        )
        # Starburst spikes around clash center
        for s in range(12):
            s_a = ang * 2 + s * (math.tau / 12)
            r_in = pulse_r - 8
            r_out = pulse_r + (28 if s % 2 == 0 else 12)
            odraw.line(
                [
                    (cx + int(math.cos(s_a) * r_in), cy + int(math.sin(s_a) * r_in)),
                    (cx + int(math.cos(s_a) * r_out), cy + int(math.sin(s_a) * r_out)),
                ],
                fill=(255, 235, 59, 255) if s % 2 == 0 else (*def_col, 255),
                width=4,
            )

        # Defender counter callout badge
        odraw.rounded_rectangle(
            (cx - 175, cy - 38, cx + 175, cy + 38),
            radius=16,
            fill=(20, 14, 38, 242),
            outline=(*def_col, 255),
            width=4,
        )
        odraw.text((cx - 152, cy - 28), f"CONTRATTACCO: {sfx_word}", font=font_med, fill=(*def_col, 255))
        odraw.text((cx - 152, cy + 4), counter_desc, font=font_sm, fill=(255, 255, 255, 245))

    # =========================================================================
    # ACT 3 (t = 0.62 .. 1.00): SIGNATURE FINISHER & SWAMP K.O. / CUDDLE!
    # =========================================================================
    if t >= 0.62:
        p3 = (t - 0.62) / 0.38
        tx_c, ty_c = dx + dw // 2, dy + dh // 2

        if theme == "cuddle":
            # Seby <-> Pupurabbu non-lethal Mega Cuddle Bounce: 24 bursting purple/pink hearts!
            for r_ring in range(3):
                rad = int(65 + r_ring * 48 + math.sin(ang * 2 + r_ring) * 14)
                odraw.ellipse(
                    (cx - rad, cy - rad, cx + rad, cy + rad),
                    outline=(255, 128, 171, 210 - r_ring * 50),
                    width=5,
                )
            for h_idx in range(22):
                h_ang = (h_idx / 22.0) * math.tau + ang * 0.6
                dist = 30 + ((t * 210 + h_idx * 29) % 210)
                hx = int(cx + math.cos(h_ang) * dist * 1.3)
                hy = int(cy + math.sin(h_ang) * dist - math.sin(ang + h_idx) * 18)
                hs = 12 + (h_idx % 3) * 4
                hcol = (234, 128, 252, 240) if h_idx % 2 == 0 else (255, 64, 129, 240)
                odraw.ellipse((hx - hs, hy - hs, hx, hy), fill=hcol)
                odraw.ellipse((hx, hy - hs, hx + hs, hy), fill=hcol)
                odraw.polygon([(hx - hs, hy - hs // 3), (hx + hs, hy - hs // 3), (hx, hy + hs)], fill=hcol)
        else:
            if theme == "throne":
                # Golden Toilet-Throne ("Carlesso al Cesso") + Royal Lightning Beams
                odraw.rounded_rectangle((tx_c - 58, ty_c - 65, tx_c + 58, ty_c + 55), radius=14, fill=(255, 213, 79, 230), outline=(255, 255, 255, 255), width=4)
                odraw.ellipse((tx_c - 48, ty_c - 10, tx_c + 48, ty_c + 42), fill=(255, 245, 157, 245), outline=(255, 160, 0, 255), width=4)
            elif theme == "sceptre":
                # Sky-to-Defender Golden Lightning Storm
                for b_i in range(-1, 2):
                    lx = tx_c + b_i * 34
                    odraw.line([(lx - 20, 60), (lx + 18, ty_c - 40), (lx - 12, ty_c + 10), (lx + 15, ty_c + 85)], fill=(255, 235, 59, 250), width=6)
            elif theme == "choco":
                # Lilac & Milk-Chocolate Tsunami Wave + Confetti
                for c_i in range(24):
                    c_a = c_i * 0.55 + p3 * 4.0
                    dist = 25 + p3 * (160 + (c_i % 4) * 30)
                    px = int(tx_c + math.cos(c_a) * dist)
                    py = int(ty_c + math.sin(c_a) * dist)
                    col = (206, 147, 216, 240) if c_i % 2 == 0 else (255, 213, 79, 240) if c_i % 3 == 0 else (121, 85, 72, 240)
                    odraw.rounded_rectangle((px - 12, py - 7, px + 12, py + 7), radius=4, fill=col)
            elif theme == "crystal":
                # Shattering Purple Amethyst & Ruby Shards
                for s in range(26):
                    s_ang = s * 0.65 + (s % 3) * 0.2
                    dist = 22 + p3 * (190 + (s % 5) * 32)
                    sx = int(tx_c + math.cos(s_ang) * dist)
                    sy = int(ty_c + math.sin(s_ang) * dist + (p3 ** 2) * 65)
                    sz = max(6, int(20 * (1.0 - p3 * 0.35)))
                    rot = s_ang + p3 * 5.0
                    poly = [(sx + int(math.cos(rot + k * 1.57) * sz), sy + int(math.sin(rot + k * 1.57) * sz)) for k in range(4)]
                    col = (224, 64, 251, 235) if s % 2 == 0 else (255, 64, 129, 235)
                    odraw.polygon(poly, fill=col, outline=(255, 255, 255, 240))
            elif theme == "turbo":
                # Orange Hot-Wheels Loop-Track ring + 6 zooming race cars
                rx, ry = 210, 118
                odraw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), outline=(255, 109, 0, 245), width=16)
                for c_idx in range(6):
                    c_ang = ang * 2.2 + (c_idx / 6.0) * math.tau
                    car_x = int(cx + math.cos(c_ang) * rx)
                    car_y = int(cy + math.sin(c_ang) * ry)
                    odraw.rounded_rectangle((car_x - 20, car_y - 10, car_x + 20, car_y + 10), radius=6, fill=(255, 23, 68, 255), outline=(255, 255, 255, 255), width=2)
            elif theme == "plush":
                # Purple Plush Ground-Pound Shockwave rings + Poof clouds
                for r_i in range(3):
                    rad = int(40 + p3 * 165 + r_i * 35)
                    odraw.ellipse((tx_c - rad, ty_c - rad // 2, tx_c + rad, ty_c + rad // 2), outline=(179, 136, 255, 230 - r_i * 60), width=6)
            else:  # halberd
                # Giant Silver Fish Slap impact + feathers
                odraw.ellipse((tx_c - 65, ty_c - 28, tx_c + 65, ty_c + 28), fill=(129, 212, 250, 245), outline=(255, 255, 255, 255), width=3)
                odraw.polygon([(tx_c - 65, ty_c), (tx_c - 105, ty_c - 32), (tx_c - 105, ty_c + 32)], fill=(79, 195, 247, 245))

            # Shrek Swamp Emerald Splash on right moat as Defender gets knocked into the swamp!
            if p3 > 0.35:
                sp = (p3 - 0.35) / 0.65
                sx_base, sy_base = W - 115, H - 95
                for w_i in range(10):
                    w_ang = -math.pi * 0.85 + (w_i / 9.0) * math.pi * 0.7
                    w_dist = sp * (85 + (w_i % 3) * 28)
                    wx = int(sx_base + math.cos(w_ang) * w_dist)
                    wy = int(sy_base + math.sin(w_ang) * w_dist + (sp ** 2) * 35)
                    odraw.ellipse((wx - 9, wy - 9, wx + 9, wy + 9), fill=(105, 240, 174, 240), outline=(255, 255, 255, 220))


def render_single_pair(task):
    atk, dfn, title, banner, theme = task
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pair_id = f"{atk}_x_{dfn}"
    mp4_path = OUT_DIR / f"{pair_id}.mp4"
    webm_path = OUT_DIR / f"{pair_id}.webm"

    atk_card = load_character_cutout(PIECE_PORTRAITS[atk], (255, 213, 79, 255), 268)
    def_card = load_character_cutout(PIECE_PORTRAITS[dfn], (144, 202, 249, 255), 268)
    font_title = load_font(24)
    font_banner = load_font(23)
    font_med = load_font(20)
    font_sm = load_font(16)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = pathlib.Path(tmpdir)
        for f_idx in range(FRAMES):
            t = f_idx / FRAMES
            ang = t * math.tau
            frame = draw_swamp_cinema_backdrop(t, theme)
            overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            odraw = ImageDraw.Draw(overlay)

            # 3-Act Fighter Card Positions
            if theme == "cuddle":
                hop = abs(math.sin(ang * 3)) * 34
                converge = math.sin(t * math.pi) * 115
                ax = int(85 + converge)
                ay = int(105 - hop)
                dx = int(W - 85 - def_card.width - converge)
                dy = int(105 - hop)
            else:
                if t < 0.34:
                    # Act 1: Attacker lunges right
                    lunge = math.sin((t / 0.34) * math.pi) * 105
                    ax = int(78 + lunge)
                    ay = int(105 - abs(math.sin(ang * 2)) * 16)
                    dx = int(W - 78 - def_card.width)
                    dy = int(108)
                elif t < 0.64:
                    # Act 2: Defender lunges left to counter-attack!
                    p2 = (t - 0.34) / 0.30
                    counter_lunge = math.sin(p2 * math.pi) * 95
                    ax = int(92 - math.sin(p2 * math.pi) * 24)
                    ay = int(108)
                    dx = int(W - 78 - def_card.width - counter_lunge)
                    dy = int(102 - abs(math.sin(ang * 3)) * 18)
                else:
                    # Act 3: Attacker Finisher -> Defender knocked toward Shrek's Swamp!
                    p3 = (t - 0.64) / 0.36
                    ax = int(125 + math.sin(p3 * math.pi) * 65)
                    ay = int(102)
                    knock_x = int(p3 * 110)
                    knock_y = int(-math.sin(p3 * math.pi) * 75 + (p3 ** 2) * 95)
                    dx = int(W - 78 - def_card.width + knock_x)
                    dy = int(108 + knock_y)

            frame.alpha_composite(atk_card, (ax, ay))

            if theme in ("turbo", "plush") and t > 0.66:
                squash_ratio = max(0.36, 1.0 - math.sin((t - 0.66) / 0.34 * math.pi) * 0.60)
                sq_h = max(50, int(def_card.height * squash_ratio))
                sq_w = int(def_card.width * (1.0 + (1.0 - squash_ratio) * 0.32))
                squashed = def_card.resize((sq_w, sq_h), Image.Resampling.LANCZOS)
                frame.alpha_composite(squashed, (dx - (sq_w - def_card.width) // 2, dy + (def_card.height - sq_h)))
            else:
                frame.alpha_composite(def_card, (dx, dy))

            draw_weapon_and_choreo(
                odraw,
                t,
                ang,
                atk,
                dfn,
                theme,
                ax,
                ay,
                atk_card.width,
                atk_card.height,
                dx,
                dy,
                def_card.width,
                def_card.height,
                font_med,
                font_sm,
            )

            # Top header bar inside 16:9 video
            act_label = (
                "ATTO 1: CARICA!"
                if t < 0.34
                else "ATTO 2: CONTRATTACCO!"
                if t < 0.64
                else "ATTO 3: FINISHER!"
            )
            odraw.rounded_rectangle((24, 12, W - 24, 58), radius=14, fill=(14, 20, 36, 232), outline=(255, 213, 79, 245), width=3)
            odraw.text((42, 22), f"[{pair_id.upper()}] {title}", font=font_title, fill=(255, 224, 130, 255))
            odraw.text((W - 265, 24), act_label, font=font_med, fill=(105, 240, 174, 255))

            # Bottom comic impact banner inside 16:9 video
            odraw.rounded_rectangle((48, H - 64, W - 48, H - 12), radius=18, fill=(255, 193, 7, 245), outline=(255, 255, 255, 255), width=3)
            odraw.text((72, H - 51), banner, font=font_banner, fill=(26, 15, 10, 255))

            frame.alpha_composite(overlay)
            frame.convert("RGB").save(tmp / f"frame_{f_idx:04d}.png")

        # Encode H.264 MP4 (browser-native yuv420p)
        cmd_mp4 = [
            "ffmpeg",
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(tmp / "frame_%04d.png"),
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "21",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "baseline",
            "-level",
            "3.1",
            "-movflags",
            "+faststart",
            str(mp4_path),
        ]
        subprocess.run(cmd_mp4, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Encode VP8 WebM sibling
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
            "-cpu-used",
            "5",
            "-b:v",
            "1.1M",
            "-crf",
            "16",
            str(webm_path),
        ]
        subprocess.run(cmd_webm, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    return (
        pair_id,
        mp4_path.stat().st_size // 1024,
        webm_path.stat().st_size // 1024,
    )


def main():
    tasks = [
        (atk, dfn, title, banner, theme)
        for (atk, dfn), (title, banner, theme) in BATTLES_36.items()
    ]
    workers = min(12, max(2, (os.cpu_count() or 4)))
    print(f"🎬 Rendering all {len(tasks)} (6x6) 16:9 battle MP4 + WebM pairs across {workers} workers...")
    with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as pool:
        for pair_id, mp4_kb, webm_kb in pool.map(render_single_pair, tasks):
            print(f"  ✅ {pair_id}: {mp4_kb} KB (.mp4) | {webm_kb} KB (.webm)")
    print("🏆 All 36 MP4 + 36 WebM 16:9 battle videos generated in assets/battles/videos/!")


if __name__ == "__main__":
    main()
