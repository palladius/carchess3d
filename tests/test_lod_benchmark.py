#!/usr/bin/env python3
"""Unit tests for multi-tier LOD calculations and benchmark utilities."""
import unittest
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools/model-pipeline/lod"))

from decimate_lod import calculate_target_faces, classify_hardware_heuristic

class TestLodPipeline(unittest.TestCase):
    def test_target_faces_calculation(self):
        targets = calculate_target_faces(original_faces=100000)
        self.assertEqual(targets['low'], 10000)
        self.assertEqual(targets['medium'], 50000)
        self.assertEqual(targets['high'], 100000)

    def test_target_faces_calculation_clamps_small_models(self):
        targets = calculate_target_faces(original_faces=8000)
        self.assertLessEqual(targets['low'], 8000)
        self.assertLessEqual(targets['medium'], 8000)
        self.assertEqual(targets['high'], 8000)

    def test_hardware_heuristic_recommendation(self):
        self.assertEqual(classify_hardware_heuristic(device_type="mobile", memory_gb=4, cores=4), "low")
        self.assertEqual(classify_hardware_heuristic(device_type="tablet", memory_gb=6, cores=8), "medium")
        self.assertEqual(classify_hardware_heuristic(device_type="desktop", memory_gb=16, cores=16), "high")

if __name__ == "__main__":
    unittest.main()
