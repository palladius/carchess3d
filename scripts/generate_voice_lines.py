#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0.0", "python-dotenv>=1.0.0"]
# ///
"""Generate expressive character voice lines & non-verbal vocalizations (hmm-hmm / sbuffo)
for CarChess3D using Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`) + FFmpeg EQ/pitch.

Uses:
- `en-gb-csagent-4` (Extended Voice Library 35-40yo Winchester UK woman with dry wit & warmth) for Queen Kate (`q`).
- Native Italian `speech_metadata.style` + inline `<sigh>`, `<pff>`, `<giggle>`, `<short pause>` tags for Seby (`n`), Ale (`b`), Riccardo (`k`), Pupurabbu (`r`), and Puffin (`p`).
"""

import base64
import json
import os
import re
import subprocess
import sys
import urllib.request
import wave
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
VOICES_DIR = ROOT / "assets/audio/voices"

PRIMARY_MODEL = "gemini-3.8-flash-tts"
FALLBACK_MODEL = "gemini-3.8-flash-lite-tts"

VOICE_CLIPS = [
    # =========================================================================
    # QUEEN KATE (q) — 40-year-old British UK Woman (`en-gb-csagent-4`)
    # =========================================================================
    {
        "filename": "voice-q.mp3",
        "piece": "q",
        "voice_name": "en-gb-csagent-4",
        "transcript": "That's... <short pause> interesting.",
        "style": "40-year-old British UK woman speaking British English, posh, dry-witted, slightly sarcastic with an amused raised eyebrow",
        "ffmpeg_filter": "silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-q-mcmuffin.mp3",
        "piece": "q",
        "voice_name": "en-gb-csagent-4",
        "transcript": "Ok, <short pause> Puffin McMuffin!",
        "style": "40-year-old British UK woman speaking British English, warm, playful, affectionate and amused mum tone",
        "ffmpeg_filter": "silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-q-loveme.mp3",
        "piece": "q",
        "voice_name": "en-gb-csagent-4",
        "transcript": "You... <short pause> love me! <short pause> I tell myself EVERY day!",
        "style": "40-year-old British UK woman speaking British English, witty, playfully dramatic and self-assured with strong emphasis on EVERY",
        "ffmpeg_filter": "silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-q-hmm.mp3",
        "piece": "q",
        "voice_name": "en-gb-csagent-4",
        "transcript": "<sigh> Hmm-hmm...",
        "style": "40-year-old British UK woman, quiet amused thoughtful murmur and gentle sigh",
        "ffmpeg_filter": "silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-q-sbuffo.mp3",
        "piece": "q",
        "voice_name": "en-gb-csagent-4",
        "transcript": "<pff> Oh, honestly... <sigh>",
        "style": "40-year-old British UK woman speaking British English, dry amused eye-roll puff and soft sigh",
        "ffmpeg_filter": "silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB,volume=1.45",
    },

    # =========================================================================
    # KNIGHT SEBY (n) — Young Italian Child (7-8yo boy)
    # =========================================================================
    {
        "filename": "voice-n.mp3",
        "piece": "n",
        "voice_name": "Puck",
        "transcript": "Dimmi papino!",
        "style": "7-year-old Italian boy speaking native Italian, cheerful, affectionate, excited little son talking to his dad",
        "ffmpeg_filter": "asetrate=24000*1.13,aresample=24000,atempo=0.95,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-n-papinooo.mp3",
        "piece": "n",
        "voice_name": "Puck",
        "transcript": "Papinoooooo!!!",
        "style": "7-year-old Italian boy speaking native Italian, super excited, joyful, calling out affectionately to his dad with a big smile",
        "ffmpeg_filter": "asetrate=24000*1.14,aresample=24000,atempo=0.95,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-n-timanco.mp3",
        "piece": "n",
        "voice_name": "Puck",
        "transcript": "Ti manco tantissimo, papino!",
        "style": "7-year-old Italian boy speaking native Italian, sweet, tender, affectionate and playful little son voice",
        "ffmpeg_filter": "asetrate=24000*1.13,aresample=24000,atempo=0.95,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-n-mybody.mp3",
        "piece": "n",
        "voice_name": "Puck",
        "transcript": "My body, <short pause> my choice!",
        "style": "7-year-old cheeky young boy speaking playful English with lively energy and a mischievous grin",
        "ffmpeg_filter": "asetrate=24000*1.14,aresample=24000,atempo=0.95,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-n-cacca.mp3",
        "piece": "n",
        "voice_name": "Puck",
        "transcript": "Mi scappa la cacca!",
        "style": "7-year-old Italian boy speaking native Italian, funny urgent cheeky kid confession with a giggle",
        "ffmpeg_filter": "asetrate=24000*1.14,aresample=24000,atempo=0.96,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-n-hmm.mp3",
        "piece": "n",
        "voice_name": "Puck",
        "transcript": "<giggle> Mmh-hmm!",
        "style": "7-year-old Italian boy, cute quick playful hum and little giggle",
        "ffmpeg_filter": "asetrate=24000*1.14,aresample=24000,atempo=0.96,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-n-sbuffo.mp3",
        "piece": "n",
        "voice_name": "Puck",
        "transcript": "<pff> Uffaaa! <sigh>",
        "style": "7-year-old Italian boy speaking native Italian, playful dramatic kid puff and sigh",
        "ffmpeg_filter": "asetrate=24000*1.14,aresample=24000,atempo=0.95,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },

    # =========================================================================
    # BISHOP ALE (b) — 10-year-old Italian Boy Wizard
    # =========================================================================
    {
        "filename": "voice-b.mp3",
        "piece": "b",
        "voice_name": "Puck",
        "transcript": "Agli ordini, Signore!",
        "style": "10-year-old Italian boy speaking native Italian, bright, enthusiastic, heroic young wizard saluting proudly",
        "ffmpeg_filter": "asetrate=24000*1.06,aresample=24000,atempo=0.98,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-b-timanco.mp3",
        "piece": "b",
        "voice_name": "Puck",
        "transcript": "Ti manco tantissimo, papino!",
        "style": "10-year-old Italian boy speaking native Italian, warm, affectionate, cheerful son talking to his dad",
        "ffmpeg_filter": "asetrate=24000*1.06,aresample=24000,atempo=0.98,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-b-piuforte.mp3",
        "piece": "b",
        "voice_name": "Puck",
        "transcript": "Papino, qual è il più forte?",
        "style": "10-year-old Italian boy speaking native Italian, curious, eager gamer kid asking his dad who is the strongest hero",
        "ffmpeg_filter": "asetrate=24000*1.06,aresample=24000,atempo=0.98,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-b-regalo.mp3",
        "piece": "b",
        "voice_name": "Puck",
        "transcript": "Papino, quando mi compri un regalo?",
        "style": "10-year-old Italian boy speaking native Italian, cheeky, hopeful and playful kid asking his dad for a present",
        "ffmpeg_filter": "asetrate=24000*1.06,aresample=24000,atempo=0.98,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-b-cafonazzo.mp3",
        "piece": "b",
        "voice_name": "Puck",
        "transcript": "Cafonazzo!",
        "style": "10-year-old Italian boy speaking native Italian, funny, teasing, dramatic playful exclamation",
        "ffmpeg_filter": "asetrate=24000*1.06,aresample=24000,atempo=0.98,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-b-hmm.mp3",
        "piece": "b",
        "voice_name": "Puck",
        "transcript": "<throat-clearing> Mmh-hmm... vediamo!",
        "style": "10-year-old Italian boy speaking native Italian, thoughtful young chess strategist humming while studying the board",
        "ffmpeg_filter": "asetrate=24000*1.06,aresample=24000,atempo=0.98,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-b-sbuffo.mp3",
        "piece": "b",
        "voice_name": "Puck",
        "transcript": "<pff> Ma dai! <sigh>",
        "style": "10-year-old Italian boy speaking native Italian, playful cool older brother puff and sigh",
        "ffmpeg_filter": "asetrate=24000*1.06,aresample=24000,atempo=0.98,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },

    # =========================================================================
    # NON-VERBAL / SHORT VARIANTS FOR KING (k), ROOK (r), PAWN (p)
    # =========================================================================
    {
        "filename": "voice-k-hmm.mp3",
        "piece": "k",
        "voice_name": "it-it-tutor-2",
        "transcript": "<throat-clearing> Mmh-hmm... <sigh> vediamo un po'!",
        "style": "Warm theatrical Italian dad and chess king humming thoughtfully",
        "ffmpeg_filter": "silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.45",
    },
    {
        "filename": "voice-r-hmm.mp3",
        "piece": "r",
        "voice_name": "Fenrir",
        "transcript": "<giggle> Mmh-boing! <sigh>",
        "style": "Cute bouncy purple plush monster making a happy soft purr and boing sigh",
        "ffmpeg_filter": "asetrate=24000*1.16,aresample=24000,atempo=0.92,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.4",
    },
    {
        "filename": "voice-p-hmm.mp3",
        "piece": "p",
        "voice_name": "Zephyr",
        "transcript": "<sigh> Mmh... piu!",
        "style": "Cute sleepy cartoon puffin guard making a soft gentle sigh and tiny peep",
        "ffmpeg_filter": "asetrate=24000*1.22,aresample=24000,atempo=0.92,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,volume=1.35",
    },
]


def load_api_key() -> str:
    if key := os.environ.get("GEMINI_API_KEY"):
        return key
    gic_dir = Path(os.environ.get("GIC", Path.home() / "git/gic"))
    for candidate in (gic_dir / ".env", gic_dir / ".bashrc", Path.home() / ".env"):
        if candidate.is_file():
            txt = candidate.read_text(errors="ignore")
            m = re.search(r'GEMINI_API_KEY=["\']?(AIza[0-9A-Za-z_-]+)["\']?', txt)
            if m:
                return m.group(1)
            vals = dotenv_values(candidate)
            if key := vals.get("GEMINI_API_KEY"):
                return key
    raise RuntimeError("GEMINI_API_KEY not found")


def synthesize_gemini_38_tts(api_key: str, clip: dict) -> tuple[bytes, str]:
    for model_name in (PRIMARY_MODEL, FALLBACK_MODEL):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": clip["transcript"],
                            "speech_metadata": {
                                "style": clip["style"],
                            },
                        }
                    ],
                }
            ],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": clip["voice_name"],
                        }
                    }
                },
            },
        }
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
                raw_bytes = base64.b64decode(part["data"])
                mime = part.get("mimeType", "audio/wav")
                return raw_bytes, mime
        except Exception as err:
            print(f"  ⚠️ `{model_name}` failed for `{clip['filename']}`: {err}")
    raise RuntimeError(f"Failed to synthesize {clip['filename']}")


def write_pcm_to_wav(pcm_bytes: bytes, wav_path: Path, sample_rate: int = 24000):
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)


def main():
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    api_key = load_api_key()
    only_filter = set(sys.argv[1:]) if len(sys.argv) > 1 else None

    for clip in VOICE_CLIPS:
        if only_filter and clip["filename"] not in only_filter and clip["piece"] not in only_filter:
            continue
        out_mp3 = VOICES_DIR / clip["filename"]
        raw_wav = VOICES_DIR / f".tmp_{clip['filename']}.wav"
        print(
            f"🎙️ [{clip['piece'].upper()}] Generating `{clip['filename']}` "
            f"(voice={clip['voice_name']}): {clip['transcript']}"
        )

        audio_bytes, mime = synthesize_gemini_38_tts(api_key, clip)
        if "wav" in mime.lower() or audio_bytes[:4] == b"RIFF":
            raw_wav.write_bytes(audio_bytes)
        else:
            write_pcm_to_wav(audio_bytes, raw_wav, sample_rate=24000)

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(raw_wav),
                "-af",
                clip["ffmpeg_filter"],
                "-c:a",
                "libmp3lame",
                "-b:a",
                "128k",
                str(out_mp3),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if raw_wav.exists():
            raw_wav.unlink()

        dur = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(out_mp3),
            ],
            text=True,
        ).strip()
        print(f"  ✅ Saved {out_mp3.relative_to(ROOT)} ({out_mp3.stat().st_size} bytes, {float(dur):.2f}s)")


if __name__ == "__main__":
    main()
