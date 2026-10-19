# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai", "pydantic", "numpy", "scipy"]
# ///
"""Automated Audio QA Critic for character voice lines in CarChess3D.

Performs:
1. Acoustic Signal Processing:
   - Peak level & digital clipping detection (peak >= -0.05 dBFS)
   - RMS energy curve analysis
   - Trailing glitch / artifact detector: detects anomalous energy rebounds/bursts (>18dB increase or spike > -25dB)
     occurring after a drop into silence (< -42dB) within the final 1.2s.
2. LLM Multimodal Acoustic & Linguistic QA (via `gemini-3.8-flash`):
   - Word-for-word transcript verification against expected text
   - Speaker persona analysis: authentic young boy vs adult female cartoon/anime voice actress trope
   - Naturalness scoring (1-10) and acoustic quality scoring (1-10)
   - Final pass/fail determination
"""

import argparse
import array
import dataclasses
import json
import math
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional, Literal

try:
    import numpy as np
except ImportError:
    np = None

try:
    from pydantic import BaseModel, Field
except ImportError:
    BaseModel = None
    Field = None

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

ROOT = Path(__file__).resolve().parent.parent.parent
VOICES_DIR = ROOT / "assets/audio/voices"


if BaseModel is not None:
    class LlmAudioCritique(BaseModel):
        actual_transcript: str = Field(description="Word-for-word transcript of what is actually spoken in the audio")
        transcript_matches: bool = Field(description="True if actual spoken words match expected transcript without hallucinated or dropped words")
        perceived_speaker_profile: str = Field(description="Perceived age, gender, and character profile of speaker")
        is_adult_woman_dubbing_trope: bool = Field(description="True if voice sounds like an adult female voice actress imitating/dubbing a young cartoon boy")
        is_authentic_male_boy: bool = Field(description="True if voice possesses genuine young male vocal cords / boy timbre")
        trailing_artifact_detected: bool = Field(description="True if there is an audible breath gasp, pop, click, or abrupt cutoff in the final 1.0 second")
        trailing_artifact_description: str = Field(description="Description of any defect detected in the final seconds, or 'None'")
        naturalness_score: float = Field(description="Naturalness score from 1.0 to 10.0")
        acoustic_quality_score: float = Field(description="Recording/acoustic clarity score from 1.0 to 10.0")
        passed: bool = Field(description="True if clip meets production quality standards for the requested character persona")
        critique_summary: str = Field(description="Summary verdict explaining the QA evaluation")
else:
    @dataclasses.dataclass
    class LlmAudioCritique:
        actual_transcript: str
        transcript_matches: bool
        perceived_speaker_profile: str
        is_adult_woman_dubbing_trope: bool
        is_authentic_male_boy: bool
        trailing_artifact_detected: bool
        trailing_artifact_description: str
        naturalness_score: float
        acoustic_quality_score: float
        passed: bool
        critique_summary: str

        def model_dump(self) -> dict[str, Any]:
            return dataclasses.asdict(self)

        @classmethod
        def model_validate(cls, data: dict[str, Any]) -> "LlmAudioCritique":
            return cls(**data)

        @classmethod
        def model_validate_json(cls, raw_json: str) -> "LlmAudioCritique":
            return cls(**json.loads(raw_json))


def load_audio_pcm(path: Path, sample_rate: int = 24000) -> tuple[Any, int]:
    """Decode audio file to mono float32 PCM using ffmpeg (numpy or stdlib array fallback)."""
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(path),
        "-f", "s16le", "-ac", "1", "-ar", str(sample_rate), "-"
    ]
    raw = subprocess.check_output(cmd)
    if np is not None:
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        return data, sample_rate
    pcm_s16 = array.array("h")
    pcm_s16.frombytes(raw)
    if sys.byteorder != "little":
        pcm_s16.byteswap()
    data_list = [s / 32768.0 for s in pcm_s16]
    return data_list, sample_rate


def inspect_acoustic_envelope(data: Any, sr: int) -> dict:
    """Analyze peak volume, clipping, and trailing burst/glitch defects."""
    total_dur = len(data) / sr
    if total_dur == 0:
        return {"error": "Empty audio"}

    if np is not None and isinstance(data, np.ndarray):
        peak_sample = float(np.max(np.abs(data)))
    else:
        peak_sample = max((abs(x) for x in data), default=0.0)
    peak_db = round(float(20.0 * math.log10(max(peak_sample, 1e-6))), 2)
    clipping = peak_db >= -0.05

    # 50ms frames with 25ms hop
    frame_len = int(sr * 0.05)
    hop = int(sr * 0.025)
    num_frames = (len(data) - frame_len) // hop + 1

    rms: list[float] = []
    times: list[float] = []
    for i in range(num_frames):
        chunk = data[i * hop : i * hop + frame_len]
        if np is not None and isinstance(chunk, np.ndarray):
            val = float(np.sqrt(np.mean(chunk**2)))
        else:
            val = math.sqrt(sum(x * x for x in chunk) / max(len(chunk), 1))
        db = 20.0 * math.log10(max(val, 1e-6))
        rms.append(db)
        times.append((i * hop + frame_len / 2) / sr)

    # Focus on the final 1.2 seconds for release transients
    cutoff_t = max(0.0, total_dur - 1.2)
    end_pairs = [(r, t) for r, t in zip(rms, times) if t >= cutoff_t]
    end_rms = [p[0] for p in end_pairs]
    end_times = [p[1] for p in end_pairs]

    trailing_glitch = False
    defect_info = None

    # Silence threshold: -42.0 dBFS
    silence_indices = [idx for idx, r in enumerate(end_rms) if r <= -42.0]
    if len(silence_indices) > 0:
        first_silence = silence_indices[0]
        subsequent_rms = end_rms[first_silence + 1 :]
        subsequent_times = end_times[first_silence + 1 :]
        if len(subsequent_rms) > 0:
            min_silence_val = float(min(end_rms[first_silence:]))
            max_after = float(max(subsequent_rms))
            max_idx = subsequent_rms.index(max_after)
            max_after_time = float(subsequent_times[max_idx])
            # Flag trailing spike if energy pops up by >= 18dB or exceeds -25dB after entering silence
            if (max_after - min_silence_val >= 18.0) and (max_after >= -25.0):
                trailing_glitch = True
                defect_info = {
                    "silence_time_s": round(float(end_times[first_silence]), 3),
                    "silence_db": round(min_silence_val, 1),
                    "spike_time_s": round(max_after_time, 3),
                    "spike_db": round(max_after, 1),
                    "delta_db": round(max_after - min_silence_val, 1),
                }

    passed = (not clipping) and (not trailing_glitch) and (total_dur >= 0.4)

    return {
        "duration_s": round(total_dur, 3),
        "peak_db": peak_db,
        "clipping": clipping,
        "trailing_glitch": trailing_glitch,
        "defect_info": defect_info,
        "passed": passed,
    }


def evaluate_llm_critic(
    audio_path: Path,
    expected_transcript: Optional[str] = None,
    persona_role: str = "male_boy",
    model_name: str = "gemini-3.8-flash",
) -> LlmAudioCritique:
    """Run multimodal audio QA using Gemini 3.8 Flash with structured Pydantic schema."""
    if genai is None:
        raise RuntimeError("google-genai package not installed")

    client = genai.Client()
    audio_file = client.files.upload(file=str(audio_path))

    role_instructions = {
        "male_boy": "The character is an authentic young male boy (7-10 years old). It MUST sound like a genuine boy with natural male vocal tract resonance, NOT like an adult female voice actress imitating a cartoon character.",
        "queen": "The character is Queen Kate, a witty, posh British woman (~40yo) with dry humor and warmth.",
        "king": "The character is King Riccardo, a warm, theatrical Italian dad (~40yo).",
        "monster": "The character is Pupurabbu, an energetic, cute cartoon monster.",
    }
    persona_guide = role_instructions.get(persona_role, f"Target persona: {persona_role}")

    prompt = f"""You are the Lead Audio QA Director inspecting a game voice line for CarChess3D.
Target Expected Transcript: "{expected_transcript or 'N/A'}"
Character Persona Requirement: {persona_guide}

Audit this recording thoroughly:
1. Listen to every word and verify if it matches the expected transcript.
2. Evaluate speaker profile: is it an authentic male boy, or does it fall into the 'adult female cartoon voice actress' dubbing trope?
3. Critically analyze the FINAL 1.0-1.5 SECONDS of the audio clip: is there ANY trailing glitch, pop, click, sharp inhalation/gasp, mouth click, or abrupt digital cutoff?
4. Grade naturalness and acoustic quality (1 to 10).
5. Set `passed` to True ONLY if the audio is free of trailing glitches/gasps and adheres to the persona.
"""

    models_to_try = [model_name, "gemini-3.5-flash", "gemini-3-flash-preview"]
    last_err = None

    for m in models_to_try:
        try:
            response = client.models.generate_content(
                model=m,
                contents=[audio_file, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=LlmAudioCritique,
                    temperature=0.1,
                ),
            )
            return LlmAudioCritique.model_validate_json(response.text)
        except Exception as e:
            last_err = e
            continue

    raise RuntimeError(f"All LLM audio critic models failed: {last_err}")


def audit_clip(
    audio_path: Path,
    expected_transcript: Optional[str] = None,
    persona_role: str = "male_boy",
    run_llm: bool = False,
) -> dict:
    """Audit single audio clip through signal processing and optional LLM critic."""
    pcm, sr = load_audio_pcm(audio_path)
    acoustic_res = inspect_acoustic_envelope(pcm, sr)

    report = {
        "file": str(audio_path),
        "filename": audio_path.name,
        "acoustic": acoustic_res,
        "llm": None,
        "passed": acoustic_res["passed"],
    }

    if run_llm:
        llm_res = evaluate_llm_critic(audio_path, expected_transcript, persona_role)
        report["llm"] = llm_res.model_dump()
        report["passed"] = acoustic_res["passed"] and llm_res.passed

    return report


def main():
    parser = argparse.ArgumentParser(description="CarChess3D Audio QA Critic")
    parser.add_argument("file", nargs="?", help="Path to audio file (.mp3 / .wav)")
    parser.add_argument("--expected", "-e", help="Expected transcript string")
    parser.add_argument("--persona", "-p", default="male_boy", help="Target persona profile")
    parser.add_argument("--llm", action="store_true", help="Run Gemini 3.8 Flash multimodal QA critic")
    parser.add_argument("--all", action="store_true", help="Audit all audio files in assets/audio/voices/")
    parser.add_argument("--json-out", help="Write report to JSON file")

    args = parser.parse_args()

    if args.all:
        reports = []
        for p in sorted(VOICES_DIR.glob("*.mp3")):
            rep = audit_clip(p, run_llm=args.llm)
            reports.append(rep)
            status = "✅ PASS" if rep["passed"] else "❌ FAIL"
            acoustic = rep["acoustic"]
            glitch_tag = " [GLITCH]" if acoustic["trailing_glitch"] else ""
            clip_tag = " [CLIPPING]" if acoustic["clipping"] else ""
            print(f"{status} {p.name:<30} {acoustic['duration_s']}s (peak: {acoustic['peak_db']}dB){glitch_tag}{clip_tag}")

        if args.json_out:
            Path(args.json_out).write_text(json.dumps(reports, indent=2))
        return

    if not args.file:
        parser.print_help()
        sys.exit(1)

    audio_path = Path(args.file)
    if not audio_path.exists():
        print(f"File not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    rep = audit_clip(audio_path, args.expected, args.persona, run_llm=args.llm)
    print(json.dumps(rep, indent=2))
    if not rep["passed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
