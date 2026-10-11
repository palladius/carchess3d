#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0.0", "pillow>=10.0.0", "python-dotenv>=1.0.0"]
# ///
"""2-Stage Generative AI Battle Cinema Pipeline for CarChess3D:
Stage 1 (Nano Banana): Photo 1 (Attacker on Left) + Photo 2 (Defender on Right)
                       -> 16:9 Cohesive Initial Battle Keyframe Image (`assets/battles/keyframes/<id>.png`)
Stage 2 (Veo 3.1 I2V): 16:9 Initial Battle Keyframe Image + Narrative Action Prompt
                       -> 16:9 Animated Battle Video (`assets/battles/videos/<id>.mp4` + `.webm`)

Usage:
    UV_INDEX_URL=https://pypi.org/simple UV_CACHE_DIR=/tmp/uv-cache UV_LINK_MODE=copy \
        uv run scripts/generate_nb_veo_battle.py b_x_n n_x_b
"""

import argparse
import io
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

from dotenv import dotenv_values
from google import genai
from google.genai import types
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
KEYFRAMES_DIR = ROOT / "assets/battles/keyframes"
VIDEOS_DIR = ROOT / "assets/battles/videos"
REFS_DIR = ROOT / "assets/battles/refs"

NB_MODELS = [
    os.environ.get("NB_MODEL", "gemini-nano-banana-2.1"),
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image-preview",
]

VEO_MODELS = [
    os.environ.get("VEO_MODEL", "veo-3.1-fast-generate-preview"),
    "veo-3.1-generate-preview",
    "veo-3.1-lite-generate-preview",
]

# Clean single-character front portraits for Photo 1 (Left) and Photo 2 (Right)
CHARACTER_SPECS = {
    "k": {
        "code": "k",
        "name": "King Riccardo",
        "it_name": "Re Riccardo",
        "photo": ROOT / "tools/model-pipeline/king/front.png",
        "fallback_photo": ROOT / "assets/characters/king-riccardo-1.jpg",
        "visual_desc": (
            "King Riccardo, a smiling Italian dad king chess figurine wearing an arched golden imperial crown, "
            "blue velvet royal cloak with white ermine trim, holding a golden lightning sceptre in his right hand "
            "and a golden royal orb in his left hand"
        ),
        "attack_desc": (
            "raises his glowing golden sceptre shooting crackling royal lightning bolts and summoning a gleaming "
            "golden throne beam"
        ),
        "counter_desc": "parries with a flash of golden royal lightning from his sceptre",
        "defeat_desc": "gets comical royal crown wobble and is launched spinning into the glowing green swamp moat",
    },
    "q": {
        "code": "q",
        "name": "Queen Kate",
        "it_name": "Regina Kate",
        "photo": ROOT / "tools/model-pipeline/kate_young/front.png",
        "fallback_photo": ROOT / "assets/characters/queen-kate-4.jpg",
        "visual_desc": (
            "Queen Kate, a smiling blonde queen chess figurine wearing stylish dark-blue glasses, a golden royal "
            "coronet crown, an ornate purple velvet gown with gold embroidery, holding a golden royal sceptre-wand"
        ),
        "attack_desc": (
            "waves her golden royal wand unleashing a giant glossy swirling tidal wave of milk chocolate and "
            "sparkling lilac-and-gold confetti"
        ),
        "counter_desc": "conjures a shimmering swirling shield of lilac stardust and glossy chocolate ribbons",
        "defeat_desc": "is swept off balance in a swirl of sparkles and splashes into the emerald swamp moat",
    },
    "b": {
        "code": "b",
        "name": "Bishop Ale",
        "it_name": "Alfiere Ale",
        "photo": ROOT / "tools/model-pipeline/ale/front.png",
        "fallback_photo": ROOT / "assets/characters/bishop-ale-1.jpg",
        "visual_desc": (
            "Bishop Ale, a cute smiling boy chess figurine with brown hair and bright green eyes, wearing a "
            "blue-and-gold bishop mitre hat and blue-and-gold robes, holding a wooden magic wand in his hands, "
            "with a cute small red baby dragon perched on his left shoulder"
        ),
        "attack_desc": (
            "waves his glowing magic wand while the cute red baby dragon on his shoulder breathes a spectacular "
            "stream of bright orange-gold dragon fire and shimmering purple amethyst crystals"
        ),
        "counter_desc": (
            "points his magic wand while the red baby dragon on his shoulder puffs a defensive burst of fiery sparks"
        ),
        "defeat_desc": "is knocked spinning off his pedestal in a shower of purple sparks into the emerald swamp moat",
    },
    "n": {
        "code": "n",
        "name": "Knight Seby",
        "it_name": "Cavaliere Seby",
        "photo": ROOT / "tools/model-pipeline/seby/front.png",
        "fallback_photo": ROOT / "assets/characters/knight-seby-4.jpg",
        "visual_desc": (
            "Knight Seby, a cute smiling blonde boy chess figurine with blue eyes, wearing gleaming golden plate "
            "knight armor and a flowing blue cape, riding a golden-armored warhorse"
        ),
        "attack_desc": (
            "rears up on his golden warhorse and charges forward while launching a glowing orange Hot-Wheels "
            "loop-the-loop race track and fast miniature turbo toy race cars"
        ),
        "counter_desc": "pops a dramatic wheelie on his golden warhorse and kicks up turbo race car sparks",
        "defeat_desc": "is bowled spinning off the chessboard with cartoon stars into the emerald swamp moat",
    },
    "r": {
        "code": "r",
        "name": "Rook Pupurabbu",
        "it_name": "Torre Pupurabbu",
        "photo": ROOT / "tools/model-pipeline/rook/front.png",
        "fallback_photo": ROOT / "assets/characters/rook-pupurabbu.jpg",
        "visual_desc": (
            "Rook Pupurabbu, an adorable round fluffy purple plush monster mascot with big friendly blue eyes "
            "and tiny white fangs, smiling and leaning out from the top of a crenellated purple stone castle rook tower"
        ),
        "attack_desc": (
            "leaps high out of his purple castle tower and performs a giant squishy purple plushie belly-slam "
            "ground-pound that sends out purple poof clouds and shockwaves"
        ),
        "counter_desc": "puffs up his giant squishy purple plush belly to bounce the attack with a big BOING",
        "defeat_desc": "bounces like a giant purple rubber ball right off the board into the emerald swamp moat",
    },
    "p": {
        "code": "p",
        "name": "Pawn Puffin",
        "it_name": "Pedone Puffin",
        "photo": ROOT / "tools/model-pipeline/puffin2/front.png",
        "fallback_photo": ROOT / "assets/characters/pawn-puffin.jpg",
        "visual_desc": (
            "Pawn Puffin, an adorable puffin bird chess figurine with a colourful orange beak, wearing a steel "
            "Swiss Guard morion helmet with a red plume and a blue-yellow-red striped Renaissance uniform, holding "
            "a medieval halberd and a shiny silver fish"
        ),
        "attack_desc": (
            "charges bravely forward with his Swiss Guard halberd and delivers a hilarious cartoon slap with a "
            "giant shiny silver herring fish"
        ),
        "counter_desc": "crosses his Swiss Guard halberd and holds up his shiny silver fish as a shield",
        "defeat_desc": "flaps his tiny wings in a puff of feathers and splashes into the emerald swamp moat",
    },
}

# Custom overrides for specific iconic matchups (including Ale vs Seby, Seby vs Ale, Easter Eggs)
CUSTOM_PAIR_PROMPTS = {
    "b_x_n": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (Bishop Ale, a cute Pixar-style boy chess "
            "piece with brown hair and green eyes wearing a blue-and-gold bishop mitre hat and robe, holding a magic "
            "wand, with a cute red baby dragon perched on his shoulder). Image 2 is the RIGHT character (Knight Seby, "
            "a cute Pixar-style blonde boy chess piece in golden knight armor and blue cape riding a golden-armored "
            "warhorse). Image 3 shows their exact LEFT vs RIGHT placement. "
            "Create a single cohesive 16:9 cinematic Pixar-style 3D starting frame of an epic magical battle on an "
            "enchanted stone chessboard surrounded by flaming torches and emerald swamp mist at twilight. "
            "On the LEFT side of the chessboard, Bishop Ale points his glowing magic wand toward Seby while the red "
            "baby dragon on Ale's shoulder opens its jaws with glowing fire embers, ready to unleash an epic attack "
            "that will defeat Seby. On the RIGHT side of the chessboard, Knight Seby on his golden warhorse faces "
            "left toward Ale, bracing for the spell. Keep both characters' faces, costumes, and proportions 100% "
            "faithful to the reference photos. Seamless wide 16:9 scene, no split-screen line, no text."
        ),
        "veo_prompt": (
            "Starting from this initial battle frame, animate an epic and funny Pixar-style 3D chess battle: "
            "Bishop Ale on the left waves his glowing magic wand casting sparkling blue-and-purple magic while the "
            "cute red baby dragon on his shoulder breathes a powerful stream of bright orange-gold dragon fire and "
            "purple amethyst crystals across the chessboard straight at Knight Seby on the right! Seby's golden "
            "warhorse rears up trying to counter with a toy race car, but the dragon's fire and crystals engulf "
            "Seby and knock him spinning comically off the chessboard into the glowing green swamp moat while Ale "
            "and his red dragon celebrate victoriously!"
        ),
    },
    "n_x_b": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (Knight Seby, a cute Pixar-style blonde boy "
            "chess piece in golden knight armor and blue cape riding a golden-armored warhorse). Image 2 is the RIGHT "
            "character (Bishop Ale, a cute Pixar-style boy chess piece with brown hair and green eyes wearing a "
            "blue-and-gold bishop mitre hat and robe, holding a magic wand, with a cute red baby dragon on his "
            "shoulder). Image 3 shows their exact LEFT vs RIGHT placement. "
            "Create a single cohesive 16:9 cinematic Pixar-style 3D starting frame of an epic battle on an enchanted "
            "stone chessboard surrounded by flaming torches at twilight. On the LEFT side, Knight Seby rears up on "
            "his golden warhorse facing right, summoning a glowing orange Hot-Wheels loop-track and miniature turbo "
            "toy race cars ready to charge and bowl over Ale. On the RIGHT side, Bishop Ale faces left with his "
            "magic wand and red shoulder dragon bracing for Seby's turbo charge. Keep both characters' faces, "
            "costumes, and proportions 100% faithful to the reference photos. Seamless wide 16:9 scene, no text."
        ),
        "veo_prompt": (
            "Starting from this initial battle frame, animate an epic and funny Pixar-style 3D chess battle: "
            "Knight Seby on the left charges forward on his golden warhorse while launching a glowing orange "
            "loop-the-loop race track and fast miniature turbo toy race cars across the chessboard toward Bishop Ale "
            "on the right! Ale's red shoulder dragon puffs a burst of sparks to defend, but Seby's zooming toy race "
            "cars and charging warhorse bowl Bishop Ale flat and send him spinning off the chessboard into the "
            "emerald swamp while Seby cheers victoriously on his rearing horse!"
        ),
    },
    "n_x_r": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (Knight Seby, a cute blonde boy in golden "
            "knight armor riding a golden warhorse). Image 2 is the RIGHT character (Rook Pupurabbu, a cute fluffy "
            "purple monster mascot in a purple stone rook tower). Image 3 shows their LEFT vs RIGHT placement. "
            "Create a single cohesive 16:9 Pixar-style 3D frame on an enchanted stone chessboard surrounded by warm "
            "lanterns and floating glowing purple hearts. On the LEFT, Knight Seby smiles joyfully reaching out from "
            "his golden horse toward his best friend Pupurabbu on the RIGHT, who opens his big fluffy purple arms "
            "wide for a giant happy cuddle hug! Keep both characters 100% faithful to the reference photos. No text."
        ),
        "veo_prompt": (
            "Starting from this initial frame, Knight Seby on the left and giant fluffy purple Rook Pupurabbu on the "
            "right hop joyfully toward the center of the chessboard and give each other a giant, bouncy, non-lethal "
            "mega cuddle hug surrounded by a storm of floating glowing purple and pink 3D hearts! Both best friends "
            "bounce happily together laughing in Pixar 3D animation style."
        ),
    },
    "r_x_n": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (Rook Pupurabbu, a cute fluffy purple "
            "monster mascot in a purple stone rook tower). Image 2 is the RIGHT character (Knight Seby, a cute blonde "
            "boy in golden knight armor riding a golden warhorse). Image 3 shows their LEFT vs RIGHT placement. "
            "Create a single cohesive 16:9 Pixar-style 3D frame on an enchanted stone chessboard surrounded by warm "
            "lanterns and floating glowing purple hearts. On the LEFT, fluffy purple Pupurabbu opens his giant plush "
            "arms wide with a big smile toward Knight Seby on the RIGHT, ready for a giant friendly cuddle hug! "
            "Keep both characters 100% faithful to the reference photos. No text."
        ),
        "veo_prompt": (
            "Starting from this initial frame, giant fluffy purple Rook Pupurabbu on the left and Knight Seby on the "
            "right bounce happily together at the center of the chessboard into a giant squishy non-lethal cuddle hug "
            "while dozens of glowing purple and pink 3D hearts float around them! Pixar 3D animation style."
        ),
    },
    "n_x_p": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (Knight Seby, a cute Pixar-style blonde boy "
            "in gleaming golden plate armor and blue cape). Image 2 is the RIGHT character (Pawn Puffin, a cute puffin "
            "bird in colorful Swiss Guard armor holding a halberd and a silver fish). Image 3 shows their exact LEFT "
            "vs RIGHT placement. Create a single cohesive 16:9 cinematic Pixar-style 3D starting battle frame on an "
            "enchanted chessboard at twilight, inspired by Saint Seiya Aquarius Camus ('Sacro Acquarius'). "
            "On the LEFT side, Knight Seby stands heroically raising and clasping both hands united high above his "
            "head! Directly behind and above Seby hovers a luminous celestial Water-Bearer Woman (the Maiden of "
            "Aquarius) tilting an enormous ornate Golden Amphora, from which pours a dazzling stream of glowing "
            "cyan-blue absolute-zero ice energy and snowflakes! On the RIGHT side, Pawn Puffin braces with his "
            "halberd as shimmering diamond-blue ice crystals begin to encase him in a towering translucent Ice Coffin "
            "('Teca di Ghiaccio'). Keep both characters 100% faithful to the reference photos. Seamless 16:9, no text."
        ),
        "veo_prompt": (
            "Starting from this initial battle frame, animate an epic Saint Seiya 'Sacro Acquarius' (Aurora Execution) "
            "3D battle: on the left, Knight Seby holds his hands united high above his head while the celestial "
            "Water-Bearer Woman behind him tilts her enormous Golden Amphora, then Seby swings his clasped hands down "
            "forward unleashing a blinding torrent of luminous cyan-blue ice energy across the chessboard! The cosmic "
            "ice stream completely freezes Pawn Puffin on the right inside a towering, translucent diamond-blue Ice "
            "Coffin ('Teca di Ghiaccio')! After a dramatic crystalline shimmer, the Ice Coffin and frozen Puffin "
            "crumble and shatter into thousands of sparkling diamond-ice crystals while Seby strikes a heroic pose!"
        ),
    },
    "k_x_p": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (King Riccardo in his golden crown, glasses, "
            "and blue ermine royal cloak holding a golden sceptre). Image 2 is the RIGHT character (Pawn Puffin in "
            "colorful Swiss Guard armor holding a halberd and silver fish). Image 3 shows their LEFT vs RIGHT "
            "placement. Create a single cohesive 16:9 Pixar-style 3D starting battle frame on an enchanted chessboard "
            "at twilight. On the LEFT, King Riccardo ('Papino') casts the classic Dungeons & Dragons 'Fireball' spell: "
            "a glowing golden 20-sided D&D die (d20 showing 20) floats beside his sceptre as he hurls a blazing "
            "swirling sphere of orange-gold D&D Fireball magic toward the right! On the RIGHT, Pawn Puffin holds up "
            "his halberd and silver fish in wide-eyed comic surprise. Keep both characters 100% faithful to the "
            "reference photos. Seamless 16:9 scene, no text."
        ),
        "veo_prompt": (
            "Starting from this initial frame, King Riccardo on the left rolls a glowing golden D&D d20 die and hurls "
            "a massive blazing orange-red D&D Fireball spell from his golden sceptre across the chessboard! The "
            "Fireball erupts in a spectacular, funny Pixar-style mushroom cloud of golden fire and sparks around Pawn "
            "Puffin on the right, comically singing his feathers and sending him flying into the emerald swamp moat!"
        ),
    },
    "k_x_n": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (King Riccardo in his golden crown, glasses, "
            "and blue ermine royal cloak holding a golden sceptre). Image 2 is the RIGHT character (Knight Seby, a "
            "cute blonde boy in golden knight armor riding a golden warhorse). Image 3 shows their LEFT vs RIGHT "
            "placement. Create a single cohesive 16:9 Pixar-style 3D starting battle frame on an enchanted chessboard "
            "at twilight. On the LEFT, King Riccardo ('Papino') casts the Dungeons & Dragons 'Chain Lightning' spell: "
            "multiple jagged, forking arcs of brilliant electric blue-and-gold Chain Lightning shoot from his raised "
            "golden sceptre, bouncing from one bolt to another across the board! On the RIGHT, Knight Seby on his "
            "rearing golden warhorse and his miniature race cars are surrounded by jumping electric arcs. Keep both "
            "characters 100% faithful to the reference photos. Seamless 16:9 scene, no text."
        ),
        "veo_prompt": (
            "Starting from this initial frame, King Riccardo on the left casts Dungeons & Dragons Chain Lightning from "
            "his golden sceptre! Dazzling jagged bolts of blue-and-gold electricity arc and bounce in a chain from one "
            "of Seby's miniature toy race cars to another and then zap Knight Seby and his golden warhorse on the "
            "right with funny cartoon electric sparks, sending Seby spinning off the board into the emerald swamp!"
        ),
    },
    "k_x_b": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (King Riccardo in his golden crown, glasses, "
            "and blue ermine royal cloak holding a golden sceptre). Image 2 is the RIGHT character (Bishop Ale, a cute "
            "boy in blue-and-gold bishop mitre hat and robe with a red baby dragon on his shoulder). Image 3 shows "
            "their LEFT vs RIGHT placement. Create a single cohesive 16:9 Pixar-style 3D starting battle frame on an "
            "enchanted chessboard at twilight. On the LEFT, King Riccardo ('Papino') raises his sceptre to the sky "
            "casting the 9th-level Dungeons & Dragons spell 'Meteor Swarm': four giant blazing volcanic meteors with "
            "fiery golden-red tails plummet diagonally down from a glowing D&D arcane circle in the twilight sky "
            "toward the right side of the board! On the RIGHT, Bishop Ale and his red shoulder dragon look up at the "
            "incoming meteors. Keep both characters 100% faithful to the reference photos. Seamless 16:9, no text."
        ),
        "veo_prompt": (
            "Starting from this initial frame, King Riccardo on the left commands a 9th-level Dungeons & Dragons "
            "Meteor Swarm with his golden sceptre! Four blazing volcanic meteors streak down from the sky with fiery "
            "trails and impact around Bishop Ale and his red baby dragon on the right in a spectacular shower of "
            "golden sparks and lava pebbles, launching Ale comically into the emerald swamp moat!"
        ),
    },
    "k_x_r": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (King Riccardo in his golden crown, glasses, "
            "and blue ermine royal cloak holding a golden sceptre). Image 2 is the RIGHT character (Rook Pupurabbu, a "
            "cute fluffy purple plush monster mascot in a purple stone rook tower). Image 3 shows their LEFT vs RIGHT "
            "placement. Create a single cohesive 16:9 Pixar-style 3D starting battle frame on an enchanted chessboard "
            "at twilight. On the LEFT, King Riccardo ('Papino') casts a comedic Dungeons & Dragons 'Summon Greater "
            "Demon' spell: from a glowing golden-red arcane rune circle in the center of the board pops a hilarious, "
            "chubby Pixar-style red baby Balor demon with tiny bat wings, a toy plastic pitchfork, and a slice of "
            "Italian pizza, grinning mischievously at Rook Pupurabbu on the RIGHT! Keep King Riccardo and Pupurabbu "
            "100% faithful to the reference photos. Seamless 16:9 scene, no text."
        ),
        "veo_prompt": (
            "Starting from this initial frame, King Riccardo on the left points his sceptre as his summoned chubby, "
            "funny Pixar-style red D&D demon holding a toy pitchfork and a slice of pizza hops across the chessboard "
            "and does a hilarious bouncy belly-bump and tickle-wrestle with giant fluffy purple Rook Pupurabbu on the "
            "right, bouncing Pupurabbu off the chessboard into the emerald swamp while the little demon munches its pizza!"
        ),
    },
    "k_x_k": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (White Team King Riccardo in his golden "
            "crown, glasses, and blue ermine royal cloak holding a golden sceptre). Image 2 is the RIGHT character "
            "(Rival Dark Obsidian Team King Riccardo). Image 3 shows their LEFT vs RIGHT placement. Create a single "
            "cohesive 16:9 Pixar-style 3D starting battle frame on an enchanted chessboard at twilight. On the LEFT, "
            "King Riccardo ('Papino') points his golden sceptre forward firing the iconic Dungeons & Dragons 6th-level "
            "'Disintegrate' spell: a razor-sharp, blindingly bright emerald-green laser ray of arcane energy (with "
            "glowing green D&D dice sparks) striking the Rival Dark King on the RIGHT, whose dark obsidian armor is "
            "beginning to dissolve into sparkling green arcane dust! Keep both characters 100% faithful to the "
            "reference photos. Seamless 16:9 scene, no text."
        ),
        "veo_prompt": (
            "Starting from this initial frame, King Riccardo on the left fires a continuous, dazzling emerald-green "
            "Dungeons & Dragons Disintegrate ray from his golden sceptre straight at the Rival Dark King on the right! "
            "The rival King comically dissolves from head to toe into a shimmering pile of glowing emerald-green "
            "arcane dust with only his crown clinking on top of the dust pile, while White King Riccardo grins!"
        ),
    },
    "k_x_q": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (King Riccardo in his golden crown, glasses, "
            "and blue ermine royal cloak holding a golden sceptre). Image 2 is the RIGHT character (Queen Kate in her "
            "blonde wavy hair, dark-blue glasses, golden crown, and purple velvet gown holding a golden wand). Image 3 "
            "shows their LEFT vs RIGHT placement. Create a single cohesive 16:9 Pixar-style 3D starting battle frame "
            "on an enchanted chessboard at twilight. On the LEFT, King Riccardo ('Papino') casts the Dungeons & "
            "Dragons 'Flesh to Stone' (Petrification) spell combined with a hilarious gleaming solid-gold royal "
            "toilet-throne ('Carlesso al Cesso'): an amber-gold petrifying basilisk rune beam shines from his sceptre "
            "onto Queen Kate on the RIGHT, whose purple gown is turning into comical carved gray-and-gold marble stone "
            "while the golden throne descends behind her! Keep both characters 100% faithful to the reference photos. "
            "Seamless 16:9 scene, no text."
        ),
        "veo_prompt": (
            "Starting from this initial frame, King Riccardo on the left waves his golden sceptre casting the Dungeons "
            "& Dragons Flesh to Stone Petrification ray while summoning a funny gleaming solid-gold royal throne! "
            "The amber-gold petrification beam turns Queen Kate on the right into a hilarious posed marble-and-gold "
            "statue seated on the golden throne, which then whirls off the chessboard in a shower of golden sparkles!"
        ),
    },
    "q_x_k": {
        "nb_prompt": (
            "Look at the reference images: Image 1 is the LEFT character (Queen Kate in her blonde wavy hair, "
            "dark-blue glasses, golden crown, and purple velvet gown holding a golden wand). Image 2 is the RIGHT "
            "character (King Riccardo in his golden crown and blue ermine royal cloak holding a golden sceptre). "
            "Image 3 shows their LEFT vs RIGHT placement. Create a single cohesive 16:9 Pixar-style 3D starting "
            "battle frame on an enchanted chessboard at twilight. On the LEFT, Queen Kate waves her golden wand "
            "conjuring a giant glossy wave of milk chocolate and lilac confetti to sweep away King Riccardo on the "
            "RIGHT, who tries to defend with his golden sceptre and a comical golden toilet-throne! Keep both "
            "characters 100% faithful to the reference photos. No text."
        ),
        "veo_prompt": (
            "Starting from this initial frame, Queen Kate on the left waves her golden wand unleashing a giant "
            "swirling wave of glossy milk chocolate and sparkling lilac confetti across the chessboard! King Riccardo "
            "on the right tries to block with his golden sceptre, but the chocolate wave sweeps him and his comical "
            "golden throne spinning off the board into the emerald swamp moat while Queen Kate bows victoriously!"
        ),
    },
}


def load_api_key() -> str:
    """Load GEMINI_API_KEY from environment or ~/git/gic/.env without printing it."""
    if key := os.environ.get("GEMINI_API_KEY"):
        return key
    gic_dir = Path(os.environ.get("GIC", Path.home() / "git/gic"))
    for candidate in (gic_dir / ".env", gic_dir / ".bashrc", Path.home() / ".env"):
        if candidate.is_file():
            vals = dotenv_values(candidate)
            if key := vals.get("GEMINI_API_KEY"):
                return key
            txt = candidate.read_text(errors="ignore")
            m = re.search(r'GEMINI_API_KEY=["\']?(AIza[0-9A-Za-z_-]+)["\']?', txt)
            if m:
                return m.group(1)
    raise RuntimeError("GEMINI_API_KEY not found in environment or ~/git/gic/.env")


def load_character_photo(code: str) -> Image.Image:
    spec = CHARACTER_SPECS[code]
    path = spec["photo"] if spec["photo"].exists() else spec["fallback_photo"]
    img = Image.open(path).convert("RGB")
    # If fallback turnaround sheet is wide, crop left half (front view)
    if img.width > img.height * 1.35:
        img = img.crop((0, 0, img.width // 2, img.height))
    return img


def build_side_by_side_guide(atk_code: str, def_code: str) -> Path:
    """Create a 16:9 (1600x900) side-by-side reference sheet with Photo 1 on Left and Photo 2 on Right."""
    REFS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REFS_DIR / f"{atk_code}_x_{def_code}_ref.png"
    left_img = load_character_photo(atk_code)
    right_img = load_character_photo(def_code)

    canvas = Image.new("RGB", (1600, 900), (24, 28, 38))
    target_h = 820
    lw = int(left_img.width * (target_h / left_img.height))
    rw = int(right_img.width * (target_h / right_img.height))
    left_resized = left_img.resize((lw, target_h), Image.Resampling.LANCZOS)
    right_resized = right_img.resize((rw, target_h), Image.Resampling.LANCZOS)

    canvas.paste(left_resized, (max(20, 400 - lw // 2), 40))
    canvas.paste(right_resized, (min(1580 - rw, 1200 - rw // 2), 40))
    canvas.save(out_path, "PNG")
    return out_path


def get_prompts_for_pair(atk_code: str, def_code: str) -> tuple[str, str]:
    pair_id = f"{atk_code}_x_{def_code}"
    if pair_id in CUSTOM_PAIR_PROMPTS:
        return CUSTOM_PAIR_PROMPTS[pair_id]["nb_prompt"], CUSTOM_PAIR_PROMPTS[pair_id]["veo_prompt"]

    atk = CHARACTER_SPECS[atk_code]
    dfd = CHARACTER_SPECS[def_code]
    same_char = atk_code == def_code
    right_note = (
        f"a mirror rival Dark Obsidian-and-Silver team version of {dfd['visual_desc']}"
        if same_char
        else dfd["visual_desc"]
    )

    nb_prompt = (
        f"Look at the reference images: Image 1 is the LEFT attacker ({atk['visual_desc']}). "
        f"Image 2 is the RIGHT defender ({right_note}). Image 3 shows their exact LEFT vs RIGHT placement. "
        f"Create a single cohesive 16:9 cinematic Pixar-style 3D starting frame of an epic magical chess battle "
        f"on an enchanted carved stone chessboard surrounded by glowing torches and emerald swamp mist at twilight. "
        f"On the LEFT side of the frame, {atk['name']} faces right and {atk['attack_desc']}, ready to defeat "
        f"{dfd['name']}. On the RIGHT side of the frame, {dfd['name']} faces left toward {atk['name']}, bracing "
        f"as they {dfd['counter_desc']}. Keep both characters' faces, costumes, and proportions 100% faithful to "
        f"the reference photos. Seamless wide 16:9 cinematic scene, no split-screen divider line, no text, no labels."
    )

    veo_prompt = (
        f"Starting from this exact initial frame, animate an epic, funny, family-friendly Pixar-style 3D chess battle: "
        f"On the left, {atk['name']} {atk['attack_desc']} straight across the chessboard at {dfd['name']} on the right! "
        f"In the middle of the clash, {dfd['name']} briefly tries to defend and {dfd['counter_desc']}, but "
        f"{atk['name']}'s signature attack overwhelms {dfd['name']}, who {dfd['defeat_desc']} while {atk['name']} "
        f"celebrates victoriously! Smooth 3D animation, vibrant magical particles, dramatic lighting."
    )
    return nb_prompt, veo_prompt


def generate_nanobanana_keyframe(client: genai.Client, atk_code: str, def_code: str, force: bool = False) -> Path:
    pair_id = f"{atk_code}_x_{def_code}"
    KEYFRAMES_DIR.mkdir(parents=True, exist_ok=True)
    out_png = KEYFRAMES_DIR / f"{pair_id}.png"
    if out_png.exists() and not force and out_png.stat().st_size > 20_000:
        print(f"  🍌 [Skip] Keyframe already exists: {out_png.relative_to(ROOT)}")
        return out_png

    left_img = load_character_photo(atk_code)
    right_img = load_character_photo(def_code)
    guide_path = build_side_by_side_guide(atk_code, def_code)
    guide_img = Image.open(guide_path).convert("RGB")
    nb_prompt, _ = get_prompts_for_pair(atk_code, def_code)

    last_err = None
    for model_name in NB_MODELS:
        try:
            print(f"  🍌 Stage 1 (Nano Banana `{model_name}`): generating 16:9 initial battle image for `{pair_id}`...")
            resp = client.models.generate_content(
                model=model_name,
                contents=[left_img, right_img, guide_img, nb_prompt],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio="16:9"),
                ),
            )
            for cand in resp.candidates or []:
                for part in (cand.content.parts if cand.content else []):
                    if part.inline_data and part.inline_data.data:
                        raw = part.inline_data.data
                        img = Image.open(io.BytesIO(raw)).convert("RGB")
                        img.save(out_png, "PNG")
                        print(f"  ✅ Saved Nano Banana 16:9 keyframe: {out_png.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")
                        return out_png
        except Exception as e:
            last_err = e
            print(f"  ⚠️ Nano Banana `{model_name}` error for `{pair_id}`: {e}", file=sys.stderr)
            time.sleep(2)

    raise RuntimeError(f"Failed to generate Nano Banana keyframe for {pair_id}: {last_err}")


def transcode_mp4_and_webm(raw_mp4: Path, final_mp4: Path, final_webm: Path):
    """Ensure browser-friendly H.264 MP4 + VP9 WebM for VeoCinemaView and battles.html."""
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(raw_mp4),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", "23",
            "-movflags", "+faststart",
            "-c:a", "aac", "-b:a", "128k",
            str(final_mp4),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(final_mp4),
            "-c:v", "libvpx-vp9", "-b:v", "1M", "-crf", "32", "-pix_fmt", "yuv420p",
            "-c:a", "libopus", "-b:a", "96k",
            str(final_webm),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def is_real_veo_video(mp4_path: Path) -> bool:
    """Return True if mp4_path exists and has duration >= 5.0s (Veo 3.1 videos are 8s; procedural fallbacks are 1.8s)."""
    if not mp4_path.exists() or mp4_path.stat().st_size < 500_000:
        return False
    try:
        out = subprocess.check_output(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(mp4_path),
            ],
            text=True,
        ).strip()
        return float(out) >= 5.0
    except Exception:
        return False


def generate_veo_video(
    client: genai.Client,
    atk_code: str,
    def_code: str,
    keyframe_png: Path,
    force: bool = False,
) -> tuple[Path, Path]:
    pair_id = f"{atk_code}_x_{def_code}"
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    final_mp4 = VIDEOS_DIR / f"{pair_id}.mp4"
    final_webm = VIDEOS_DIR / f"{pair_id}.webm"
    if not force and is_real_veo_video(final_mp4):
        print(f"  🎬 [Skip] Real Veo 3.1 video already exists: {final_mp4.relative_to(ROOT)}")
        return final_mp4, final_webm

    raw_mp4 = VIDEOS_DIR / f".tmp_{pair_id}_veo.mp4"
    _, veo_prompt = get_prompts_for_pair(atk_code, def_code)
    img_bytes = keyframe_png.read_bytes()

    last_err = None
    candidate_runs = [(client, m) for m in VEO_MODELS]
    vertex_project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")
    if not vertex_project:
        try:
            vertex_project = subprocess.check_output(
                ["gcloud", "config", "get-value", "project"],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
        except Exception:
            vertex_project = None
    if vertex_project:
        try:
            vclient = genai.Client(vertexai=True, project=vertex_project, location="us-central1")
            for vm in ("veo-3.1-fast-generate-001", "veo-3.1-generate-001", "veo-3.0-fast-generate-001"):
                candidate_runs.append((vclient, vm))
        except Exception:
            pass

    for active_client, veo_model in candidate_runs:
        try:
            backend_tag = "VertexAI" if getattr(active_client, "vertexai", False) else "AIStudio"
            print(f"  🎬 Stage 2 (Veo `{veo_model}` [{backend_tag}]): animating `{keyframe_png.name}` -> `{pair_id}.mp4`...")
            op = active_client.models.generate_videos(
                model=veo_model,
                prompt=veo_prompt,
                image=types.Image(image_bytes=img_bytes, mime_type="image/png"),
                config=types.GenerateVideosConfig(
                    aspect_ratio="16:9",
                    number_of_videos=1,
                ),
            )
            poll_count = 0
            while not op.done:
                poll_count += 1
                time.sleep(10)
                op = active_client.operations.get(op)
                print(f"    ⏳ Polling Veo for `{pair_id}` (attempt {poll_count})...")
                if poll_count > 60:
                    raise TimeoutError(f"Veo polling timed out for {pair_id}")

            if getattr(op, "error", None):
                raise RuntimeError(f"Veo operation error: {op.error}")

            gen_videos = getattr(op.response, "generated_videos", None) or []
            if not gen_videos:
                raise RuntimeError(f"Veo returned 0 videos for {pair_id}: {op.response}")

            video_obj = gen_videos[0].video
            if getattr(video_obj, "video_bytes", None):
                raw_mp4.write_bytes(video_obj.video_bytes)
            else:
                active_client.files.download(file=video_obj)
                video_obj.save(str(raw_mp4))

            transcode_mp4_and_webm(raw_mp4, final_mp4, final_webm)
            if raw_mp4.exists():
                raw_mp4.unlink()
            print(
                f"  ✅ Saved Veo 16:9 video: {final_mp4.relative_to(ROOT)} "
                f"({final_mp4.stat().st_size // 1024} KB) + {final_webm.name}"
            )
            return final_mp4, final_webm
        except Exception as e:
            last_err = e
            print(f"  ⚠️ Veo `{veo_model}` error for `{pair_id}`: {e}", file=sys.stderr)
            time.sleep(2)

    raise RuntimeError(f"Failed to generate Veo video for {pair_id}: {last_err}")


def export_prompts_manifest():
    keys = ["k", "q", "b", "n", "r", "p"]
    manifest = {}
    for a in keys:
        for d in keys:
            pid = f"{a}_x_{d}"
            nb_p, veo_p = get_prompts_for_pair(a, d)
            manifest[pid] = {
                "id": pid,
                "attacker": a,
                "defender": d,
                "attacker_name": CHARACTER_SPECS[a]["name"],
                "defender_name": CHARACTER_SPECS[d]["name"],
                "keyframe": f"assets/battles/keyframes/{pid}.png",
                "video": f"assets/battles/videos/{pid}.mp4",
                "nb_prompt": nb_p,
                "veo_prompt": veo_p,
            }
    out_json = ROOT / "assets/battles/prompts_36.json"
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    return out_json


def main():
    parser = argparse.ArgumentParser(description="Generate Nano Banana 16:9 Keyframe + Veo 3.1 Video for CarChess3D battles")
    parser.add_argument("pairs", nargs="*", help="Battle pair IDs (e.g., b_x_n n_x_b) or 'all' for all 36")
    parser.add_argument("--keyframe-only", action="store_true", help="Only run Stage 1 (Nano Banana keyframe)")
    parser.add_argument("--force-keyframe", action="store_true", help="Regenerate Nano Banana keyframe even if it exists")
    parser.add_argument("--force-video", action="store_true", help="Regenerate Veo video even if an 8s Veo video exists")
    args = parser.parse_args()

    export_prompts_manifest()

    keys = ["k", "q", "b", "n", "r", "p"]
    all_pairs = [f"{a}_x_{d}" for a in keys for d in keys]
    if not args.pairs:
        target_pairs = ["b_x_n", "n_x_b"]
    else:
        target_pairs = []
        for p in args.pairs:
            if p == "all":
                target_pairs.extend(all_pairs)
            else:
                target_pairs.append(p.lower().strip())

    client = genai.Client(api_key=load_api_key())
    for idx, pair_id in enumerate(target_pairs, 1):
        atk_code, def_code = pair_id.split("_x_")
        print(
            f"\n🚀 [{idx}/{len(target_pairs)}] === Processing Battle Pair `{pair_id}` "
            f"({CHARACTER_SPECS[atk_code]['name']} vs {CHARACTER_SPECS[def_code]['name']}) ==="
        )
        try:
            kf_path = generate_nanobanana_keyframe(client, atk_code, def_code, force=args.force_keyframe)
            if not args.keyframe_only:
                generate_veo_video(client, atk_code, def_code, kf_path, force=args.force_video)
        except Exception as err:
            print(f"  ❌ Error on `{pair_id}`: {err}", file=sys.stderr)


if __name__ == "__main__":
    main()

