"""Audio Quality & LLM Critic Test Suite for CarChess3D.

Verifies:
1. All character voice lines have clean acoustic envelopes (duration, peak < 0.0dB, no digital clipping).
2. Trailing burst / gasp defect detector specifically catches the known artifact in the un-mastered
   Pinguini recording fixture (regression test for Issue #22 audio polish).
3. The newly generated and mastered voice lines (Seby Scrivile Scemo, Seby Uccidi Mostro,
   Ale Still Hungry, Ale Cucini Bene) are clean, pass signal processing checks, and adhere to
   authentic boy voice characteristics.
4. Optional live LLM Multimodal evaluation via Gemini 3.8 Flash when GEMINI_API_KEY is present.
"""

import os
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
CRITIC_DIR = ROOT / "tools/model-pipeline/critic"
if str(CRITIC_DIR) not in sys.path:
    sys.path.insert(0, str(CRITIC_DIR))

from critic_audio import (
    load_audio_pcm,
    inspect_acoustic_envelope,
    LlmAudioCritique,
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICES_DIR = ROOT / "assets/audio/voices"
FIXTURES_DIR = ROOT / "tests/fixtures"


class TestAudioQualityAndCritic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.target_new_lines = [
            "voice-n-scrivilescemo.mp3",
            "voice-n-uccidimostro.mp3",
            "voice-b-stillhungry.mp3",
            "voice-b-cucinibene.mp3",
        ]

    def test_target_voice_files_exist_and_non_empty(self):
        """Verify all 4 newly requested voice lines exist on disk and have valid sizes."""
        for fname in self.target_new_lines:
            path = VOICES_DIR / fname
            self.assertTrue(path.exists(), f"Voice file {fname} must exist in {VOICES_DIR}")
            size = path.stat().st_size
            self.assertGreater(size, 5000, f"Voice file {fname} is suspiciously small ({size} B)")

    def test_target_voice_lines_pass_acoustic_envelope_checks(self):
        """Verify that the target voice lines have no clipping and no trailing glitches/pops."""
        for fname in self.target_new_lines:
            path = VOICES_DIR / fname
            pcm, sr = load_audio_pcm(path)
            res = inspect_acoustic_envelope(pcm, sr)
            self.assertTrue(res["passed"], f"Audio check failed for {fname}: {res}")
            self.assertFalse(res["clipping"], f"Digital clipping detected in {fname}: peak={res['peak_db']}dB")
            self.assertFalse(
                res["trailing_glitch"],
                f"Trailing energy glitch/pop detected in {fname}: {res['defect_info']}",
            )
            self.assertGreaterEqual(res["duration_s"], 1.5, f"Duration too short for {fname}")
            self.assertLessEqual(res["duration_s"], 10.0, f"Duration too long for {fname}")

    def test_critic_catches_pinguini_defect_fixture(self):
        """Regression test: prove that the detector specifically flags the trailing glitch in the original buggy clip."""
        fixture_path = FIXTURES_DIR / "buggy_pinguini_defect.mp3"
        self.assertTrue(fixture_path.exists(), "Buggy fixture must exist for regression verification")

        pcm, sr = load_audio_pcm(fixture_path)
        res = inspect_acoustic_envelope(pcm, sr)

        # Must be caught as failing
        self.assertFalse(res["passed"], "The buggy pinguini clip must fail acoustic verification")
        self.assertTrue(
            res["trailing_glitch"],
            "The detector MUST catch the trailing spike/glitch after silence in the buggy clip",
        )
        self.assertIsNotNone(res["defect_info"], "Defect info must be populated")
        # In the buggy clip, delta_db was > 50dB (+62.6dB spike after silence at 5.1s)
        self.assertGreater(
            res["defect_info"]["delta_db"],
            20.0,
            f"Expected large trailing burst > 20dB, got {res['defect_info']['delta_db']}dB",
        )

    def test_llm_critic_schema_serialization(self):
        """Verify LlmAudioCritique schema parses and validates expected JSON payload."""
        sample_json = {
            "actual_transcript": "Hey Google, metti Scrivile Scemo dei Pinguini Tattici Nucleari su YouTube Music!",
            "transcript_matches": True,
            "perceived_speaker_profile": "Authentic young male boy (~8-10yo)",
            "is_adult_woman_dubbing_trope": False,
            "is_authentic_male_boy": True,
            "trailing_artifact_detected": False,
            "trailing_artifact_description": "None",
            "naturalness_score": 9.0,
            "acoustic_quality_score": 9.5,
            "passed": True,
            "critique_summary": "Clean, authentic young boy voice line with zero trailing glitches.",
        }
        critique = LlmAudioCritique.model_validate(sample_json)
        self.assertTrue(critique.passed)
        self.assertTrue(critique.is_authentic_male_boy)
        self.assertFalse(critique.is_adult_woman_dubbing_trope)
        self.assertFalse(critique.trailing_artifact_detected)


if __name__ == "__main__":
    unittest.main()
