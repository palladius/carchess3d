"""Stdlib unittest suite for Character POV Showcase (Issue #22)."""

import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOWCASE_HTML_PATH = ROOT / "showcase/index.html"
BATTLES_HTML_PATH = ROOT / "battles.html"
POV_DATA_PATH = ROOT / "src/core/CharacterPovData.js"

CARLESSO_HERO_KEYS = ("n", "b", "k", "q", "r", "p")


class TestCharacterPovShowcase(unittest.TestCase):
    def test_character_pov_data_file_exists_and_declares_heroes(self):
        self.assertTrue(POV_DATA_PATH.exists(), "src/core/CharacterPovData.js must exist")
        content = POV_DATA_PATH.read_text(encoding="utf-8")
        for key in CARLESSO_HERO_KEYS:
            self.assertIn(f"'{key}'", content, f"Key {key} must be declared in CharacterPovData.js")

    def test_voice_files_referenced_in_pov_data_exist(self):
        content = POV_DATA_PATH.read_text(encoding="utf-8")
        audio_matches = re.findall(r"audio:\s*['\"]([^'\"]+)['\"]", content)
        self.assertGreaterEqual(len(audio_matches), 15, "Expected at least 15 voice audio clips")
        for rel_path in audio_matches:
            full_path = ROOT / rel_path
            self.assertTrue(full_path.exists(), f"Voice audio file not found on disk: {rel_path}")
            self.assertGreater(full_path.stat().st_size, 1000, f"Voice file too small: {rel_path}")

    def test_special_requested_catchphrases_present(self):
        content = POV_DATA_PATH.read_text(encoding="utf-8")
        self.assertIn("I'll bear that in mind", content, "Kate's catchphrase must be present")
        self.assertIn("Catchphrase!", content, "Pupurabbu's Blue Shirt Guy catchphrase must be present")

    def test_showcase_html_has_pov_elements(self):
        self.assertTrue(SHOWCASE_HTML_PATH.exists(), "showcase/index.html must exist")
        html = SHOWCASE_HTML_PATH.read_text(encoding="utf-8")
        self.assertIn('id="pov-section"', html)
        self.assertIn('id="hero-selector"', html)
        self.assertIn('id="soundboard-grid"', html)
        self.assertIn('id="netflix-video"', html)
        self.assertIn('id="episodes-shelf-carousel"', html)
        self.assertIn('id="attacks-cards-grid"', html)
        self.assertIn('id="defenses-cards-grid"', html)
        self.assertIn('id="netflix-screen-target-badge"', html)
        self.assertIn('data-mode="pov"', html)
        self.assertIn('data-mode="families"', html)

    def test_battles_html_links_to_pov_showcase(self):
        self.assertTrue(BATTLES_HTML_PATH.exists(), "battles.html must exist")
        html = BATTLES_HTML_PATH.read_text(encoding="utf-8")
        self.assertIn('showcase/index.html?view=pov', html)


if __name__ == "__main__":
    unittest.main()
