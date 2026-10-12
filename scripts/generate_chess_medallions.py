#!/usr/bin/env python3
"""Generates 12 Classical Circular Staunton Chess Medallion SVGs (White & Black).

Designed for high-contrast visibility at both 24x24px (compact chips/pills)
and 256x256px+ (high-res display hero badges).
"""

import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
WHITE_DIR = ROOT / "assets/icons/chess/white"
BLACK_DIR = ROOT / "assets/icons/chess/black"

WHITE_DIR.mkdir(parents=True, exist_ok=True)
BLACK_DIR.mkdir(parents=True, exist_ok=True)

# Canonical Staunton Vector Paths (Centered in 100x100 viewBox, piece centered ~ Y: 22..78)
PIECE_PATHS = {
    "king": """
      <!-- King Cross -->
      <path d="M 47 18 H 53 V 24 H 59 V 30 H 53 V 36 H 47 V 30 H 41 V 24 H 47 Z" class="piece-accent" />
      <!-- King Crown & Arches -->
      <path d="M 33 46 C 33 34, 42 36, 50 36 C 58 36, 67 34, 67 46 C 67 52, 63 56, 61 60 H 39 C 37 56, 33 52, 33 46 Z" class="piece-body" />
      <!-- King Ermine Base & Collars -->
      <path d="M 36 60 H 64 V 66 H 36 Z" class="piece-accent" />
      <path d="M 30 66 C 30 66, 32 72, 36 74 H 64 C 68 72, 70 66, 70 66 Z" class="piece-body" />
      <path d="M 26 74 H 74 V 80 H 26 Z" class="piece-base" />
    """,
    "queen": """
      <!-- Queen Coronet 5 Points with Pearls -->
      <circle cx="28" cy="33" r="3" class="piece-accent" />
      <circle cx="39" cy="27" r="3" class="piece-accent" />
      <circle cx="50" cy="24" r="3.5" class="piece-accent" />
      <circle cx="61" cy="27" r="3" class="piece-accent" />
      <circle cx="72" cy="33" r="3" class="piece-accent" />
      <!-- Queen Coronet Flared Rays -->
      <path d="M 28 36 L 33 56 H 67 L 72 36 L 61 50 L 50 30 L 39 50 Z" class="piece-body" />
      <!-- Queen Corset & Waist -->
      <path d="M 33 56 C 34 62, 37 66, 40 68 H 60 C 63 66, 66 62, 67 56 Z" class="piece-body" />
      <!-- Queen Tiered Base -->
      <path d="M 34 68 H 66 V 73 H 34 Z" class="piece-accent" />
      <path d="M 26 73 H 74 V 80 H 26 Z" class="piece-base" />
    """,
    "bishop": """
      <!-- Bishop Top Gem / Crosslet -->
      <circle cx="50" cy="23" r="3" class="piece-accent" />
      <!-- Bishop Mitre Dome with Slit -->
      <path d="M 50 26 C 41 26, 35 34, 35 44 C 35 52, 40 58, 44 62 H 56 C 60 58, 65 52, 65 44 C 65 34, 59 26, 50 26 Z" class="piece-body" />
      <!-- Mitre Canonical Diagonal Cut -->
      <path d="M 48 34 L 56 46" stroke-width="2.5" class="piece-slit" />
      <!-- Bishop Collar Ring -->
      <path d="M 39 62 H 61 V 67 H 39 Z" class="piece-accent" />
      <!-- Bishop Base Pedestal -->
      <path d="M 33 67 C 33 71, 35 74, 38 75 H 62 C 65 74, 67 71, 67 67 Z" class="piece-body" />
      <path d="M 28 75 H 72 V 80 H 28 Z" class="piece-base" />
    """,
    "knight": """
      <!-- Knight Horse Head & Flowing Mane -->
      <path d="M 35 75 C 33 64, 35 52, 31 46 C 29 43, 31 38, 35 36 C 40 33, 44 34, 46 31 C 48 29, 48 25, 52 24 C 54 24, 55 26, 55 28 C 58 26, 63 26, 66 29 C 70 33, 68 40, 68 45 C 71 47, 72 52, 71 58 C 70 65, 68 70, 67 75 Z" class="piece-body" />
      <!-- Muzzle / Nostril / Jaw Line -->
      <path d="M 31 46 C 36 48, 41 47, 43 51 C 45 55, 42 59, 38 59" class="piece-accent" fill="none" stroke-width="2.5" />
      <!-- Ear & Eye -->
      <path d="M 46 31 L 49 24 L 52 28 Z" class="piece-accent" />
      <circle cx="58" cy="35" r="2.2" class="piece-accent" />
      <!-- Knight Base -->
      <path d="M 26 75 H 74 V 81 H 26 Z" class="piece-base" />
    """,
    "rook": """
      <!-- Rook Castle Crenellations (4 Merlons) -->
      <path d="M 31 30 H 38 V 37 H 44 V 30 H 56 V 37 H 62 V 30 H 69 V 42 H 31 Z" class="piece-body" />
      <!-- Machicolations Cornice -->
      <path d="M 29 42 H 71 V 47 H 29 Z" class="piece-accent" />
      <!-- Stone Tower Column Waist -->
      <path d="M 34 47 H 66 L 64 67 H 36 Z" class="piece-body" />
      <!-- Tiered Base Plinth -->
      <path d="M 31 67 H 69 V 73 H 31 Z" class="piece-accent" />
      <path d="M 26 73 H 74 V 80 H 26 Z" class="piece-base" />
    """,
    "pawn": """
      <!-- Pawn Spherical Polished Head -->
      <circle cx="50" cy="32" r="10" class="piece-body" />
      <!-- Pawn Double Ring Neck Collar -->
      <path d="M 41 45 H 59 V 49 H 41 Z" class="piece-accent" />
      <path d="M 43 49 H 57 V 52 H 43 Z" class="piece-accent" />
      <!-- Pawn Concave Body Stem -->
      <path d="M 44 52 C 44 58, 40 65, 36 71 H 64 C 60 65, 56 58, 56 52 Z" class="piece-body" />
      <!-- Pawn Stepped Plinth Base -->
      <path d="M 32 71 H 68 V 75 H 32 Z" class="piece-accent" />
      <path d="M 27 75 H 73 V 80 H 27 Z" class="piece-base" />
    """,
}


def build_svg(piece_key: str, color_mode: str) -> str:
    inner_markup = PIECE_PATHS[piece_key]

    if color_mode == "white":
        bg_grad = """
          <radialGradient id="marble_bg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="65%" stop-color="#f8f4ec"/>
            <stop offset="100%" stop-color="#e3d8c4"/>
          </radialGradient>
          <linearGradient id="rim_gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffe082"/>
            <stop offset="50%" stop-color="#d4af37"/>
            <stop offset="100%" stop-color="#996515"/>
          </linearGradient>
        """
        styles = """
          .medallion-rim { fill: url(#rim_gold); filter: drop-shadow(0 2px 5px rgba(0,0,0,0.45)); }
          .medallion-inner { fill: url(#marble_bg); }
          .piece-body { fill: #fcf9f2; stroke: #8a6a24; stroke-width: 1.4; filter: drop-shadow(0 1.5px 2px rgba(138,106,36,0.35)); }
          .piece-accent { fill: #e6b84a; stroke: #7c5812; stroke-width: 1.2; }
          .piece-base { fill: #d4af37; stroke: #664606; stroke-width: 1.4; }
          .piece-slit { stroke: #8a6a24; }
        """
    else:
        bg_grad = """
          <radialGradient id="obsidian_bg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#343844"/>
            <stop offset="65%" stop-color="#181b22"/>
            <stop offset="100%" stop-color="#0b0d12"/>
          </radialGradient>
          <linearGradient id="rim_silver" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="50%" stop-color="#b0bcc9"/>
            <stop offset="100%" stop-color="#566270"/>
          </linearGradient>
        """
        styles = """
          .medallion-rim { fill: url(#rim_silver); filter: drop-shadow(0 2px 5px rgba(0,0,0,0.6)); }
          .medallion-inner { fill: url(#obsidian_bg); }
          .piece-body { fill: #1d212b; stroke: #99a8b8; stroke-width: 1.4; filter: drop-shadow(0 1.5px 2px rgba(0,0,0,0.8)); }
          .piece-accent { fill: #7f91a6; stroke: #ced7e0; stroke-width: 1.2; }
          .piece-base { fill: #505c6c; stroke: #dce4ec; stroke-width: 1.4; }
          .piece-slit { stroke: #dce4ec; }
        """

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    {bg_grad}
    <filter id="medallion_depth" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <style>
    {styles}
  </style>
  <g filter="url(#medallion_depth)">
    <!-- Outer Rim -->
    <circle cx="50" cy="50" r="48" class="medallion-rim" />
    <!-- Beveled Edge -->
    <circle cx="50" cy="50" r="44" fill="none" stroke="{"#ffd54f" if color_mode == "white" else "#ffffff"}" stroke-width="0.8" opacity="0.6" />
    <!-- Inner Marble Field -->
    <circle cx="50" cy="50" r="43" class="medallion-inner" />
  </g>
  <!-- Classical Piece Motif -->
  <g>
    {inner_markup}
  </g>
</svg>
""".strip() + "\n"


for piece in ("king", "queen", "bishop", "knight", "rook", "pawn"):
    w_svg = build_svg(piece, "white")
    (WHITE_DIR / f"{piece}.svg").write_text(w_svg, encoding="utf-8")

    b_svg = build_svg(piece, "black")
    (BLACK_DIR / f"{piece}.svg").write_text(b_svg, encoding="utf-8")

print(f"✅ Generated 12 Classical Circular Staunton Medallions in {WHITE_DIR} & {BLACK_DIR}")
