#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0.0", "python-dotenv>=1.0.0"]
# ///
"""Generate expressive character voice lines for CarChess3D using Gemini 2.5 TTS + FFmpeg pitch/EQ."""

import os
import re
import subprocess
import wave
from pathlib import Path

from dotenv import dotenv_values
from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parent.parent
VOICES_DIR = ROOT / "assets/audio/voices"

TTS_MODELS = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
]

CHARACTER_VOICES = {
    "n": {
        "name": "Knight Seby",
        "voice_name": "Puck",
        "prompt": (
            "Say in Italian in a cheerful, playful, affectionate young boy voice "
            "(like an excited 8-year-old son talking to his dad): "
            "\"Dimmi papino!\""
        ),
        "text": "Dimmi papino!",
        "ffmpeg_filter": "asetrate=24000*1.12,aresample=24000,atempo=0.95,volume=1.4",
    },
    "b": {
        "name": "Bishop Ale",
        "voice_name": "Puck",
        "prompt": (
            "Say in Italian in a bright, enthusiastic, heroic young boy wizard voice "
            "(like a proud 11-year-old boy saluting): "
            "\"Agli ordini, Signore!\""
        ),
        "text": "Agli ordini, Signore!",
        "ffmpeg_filter": "asetrate=24000*1.06,aresample=24000,atempo=0.98,volume=1.4",
    },
    "q": {
        "name": "Queen Kate",
        "voice_name": "Kore",
        "prompt": (
            "Say in a posh, dry, witty, delightfully sarcastic British English accent "
            "with an amused raised eyebrow: "
            "\"This... is an interesting choice.\""
        ),
        "text": "This is an interesting choice...",
        "ffmpeg_filter": "volume=1.4",
    },
    "p": {
        "name": "Pawn Puffin",
        "voice_name": "Zephyr",
        "prompt": (
            "Say in Italian in an adorably cute, squeaky, super-cheerful cartoon puffin voice: "
            "\"Piu piu! Eccomi, pronta guardia Puffin!\""
        ),
        "text": "Piu piu! Eccomi, pronta guardia Puffin!",
        "ffmpeg_filter": "asetrate=24000*1.28,aresample=24000,atempo=0.88,volume=1.45",
    },
    "k": {
        "name": "King Riccardo",
        "voice_name": "Charon",
        "prompt": (
            "Say in Italian in a warm, theatrical, proud Italian dad king voice: "
            "\"Avanti tutta! Re Carlesso al comando!\""
        ),
        "text": "Avanti tutta! Re Carlesso al comando!",
        "ffmpeg_filter": "volume=1.4",
    },
    "r": {
        "name": "Rook Pupurabbu",
        "voice_name": "Fenrir",
        "prompt": (
            "Say in Italian in a bubbly, bouncy, cuddly cartoon plush monster voice: "
            "\"Boing boing! Super abbraccio Pupurabbu!\""
        ),
        "text": "Boing boing! Super abbraccio Pupurabbu!",
        "ffmpeg_filter": "asetrate=24000*1.16,aresample=24000,atempo=0.92,volume=1.4",
    },
}


def load_api_key() -> str:
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
    raise RuntimeError("GEMINI_API_KEY not found")


def write_pcm_to_wav(pcm_bytes: bytes, wav_path: Path, sample_rate: int = 24000):
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)


def main():
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=load_api_key())

    for code, spec in CHARACTER_VOICES.items():
        out_mp3 = VOICES_DIR / f"voice-{code}.mp3"
        raw_wav = VOICES_DIR / f".tmp_voice_{code}.wav"
        print(f"🎙️ Generating voice for `{code}` ({spec['name']}): {spec['text']}")

        pcm_bytes = None
        for model_name in TTS_MODELS:
            try:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=spec["prompt"],
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                    voice_name=spec["voice_name"]
                                )
                            )
                        ),
                    ),
                )
                for cand in resp.candidates or []:
                    for part in (cand.content.parts if cand.content else []):
                        if part.inline_data and part.inline_data.data:
                            pcm_bytes = part.inline_data.data
                            break
                if pcm_bytes:
                    break
            except Exception as err:
                print(f"  ⚠️ TTS `{model_name}` failed for `{code}`: {err}")

        if not pcm_bytes:
            raise RuntimeError(f"Failed to synthesize audio for {code}")

        write_pcm_to_wav(pcm_bytes, raw_wav, sample_rate=24000)
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(raw_wav),
                "-af", spec["ffmpeg_filter"],
                "-c:a", "libmp3lame", "-b:a", "128k",
                str(out_mp3),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if raw_wav.exists():
            raw_wav.unlink()
        print(f"  ✅ Saved {out_mp3.relative_to(ROOT)} ({out_mp3.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
