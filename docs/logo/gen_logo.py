# /// script
# dependencies = ["google-genai"]
# ///
"""Generate carchess3d logo options with Nano Banana Pro (Gemini API)."""
import os
import sys
from google import genai

MODEL = os.environ.get("NB_MODEL", "gemini-3-pro-image-preview")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

BASE = (
    "Square app logo, cute 3D cartoon 'Nano Banana' toy style, soft studio lighting, "
    "clean flat pastel background, centered, bold readable silhouette, no third-party brands. "
)
PROMPTS = {
    "A_king_toilet": BASE + (
        "A chubby chess KING piece (ivory with gold trim, little crown with a cross on top) "
        "sitting proudly on a white porcelain toilet like it is a throne, reading a tiny "
        "newspaper with a chessboard pattern on it, smug happy face. A roll of toilet paper "
        "with a checkerboard pattern beside him. Funny but tasteful, nothing gross."
    ),
    "B_king_toilet_text": BASE + (
        "A chubby chess KING piece with a gold crown sitting on a white toilet as if it were a "
        "royal throne, holding a scepter shaped like a toilet plunger, checkerboard tiled "
        "bathroom floor. Below it, the playful bold rounded text 'CarChess3D'. "
        "Funny but tasteful, nothing gross."
    ),
    "C_badge": BASE + (
        "Circular badge emblem: a cartoon chess king piece on a golden toilet-throne, "
        "checkerboard ring around the badge with the text 'CARLESSO AL CESSO' on the top arc "
        "and 'CHESS 3D' on the bottom arc. Sticker style, thick outline. Nothing gross."
    ),
}

only = sys.argv[1:] or list(PROMPTS)
for name in only:
    resp = client.models.generate_content(model=MODEL, contents=PROMPTS[name])
    for part in resp.candidates[0].content.parts:
        if part.inline_data:
            path = f"{name}.png"
            open(path, "wb").write(part.inline_data.data)
            print("wrote", path)
