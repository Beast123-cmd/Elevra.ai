"""Regression checks for the local, dependency-free P0 data pipeline."""
from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from clean.clean import clean_all, normalize_id
from generate.generate import generate_all
from run import _build_payload
from scoring.engine import WEIGHTS, evaluate, pillars_from_metrics, success_score

BASE = {
    "cgpa": 8.0, "internal_pct": 75.0, "backlogs": 0, "attendance_pct": 88.0,
    "submit_rate": 0.9, "login_consistency": 1.0, "avg_minutes": 100.0,
    "login_trend": 0.0, "engagement_drop": 0, "aptitude": 70.0, "coding": 70.0,
    "mock": 4.0, "tech_skill": 75.0, "soft_skill": 70.0, "certifications": 1,
    "events": 2, "clubs": 1, "hackathons": 1, "satisfaction": 4.0,
    "faculty_rating": 4.0, "attendance_drop_pp": 0.0,
}


class ScoringTests(unittest.TestCase):
    def test_default_weights_and_missing_placement(self):
        self.assertAlmostEqual(sum(WEIGHTS.values()), 1.0)
        metrics = {**BASE, "aptitude": None, "coding": None, "mock": None}
        pillars = pillars_from_metrics(metrics)
        result = success_score(pillars)
        self.assertIsNone(pillars["placement"])
        self.assertEqual(result["confidence"], 80)
        self.assertEqual(result["missing"], ["placement"])
        self.assertEqual(evaluate(metrics)["placement_risk"]["level"], "Not assessed")

    def test_detention_rule_and_named_driver(self):
        result = evaluate({**BASE, "attendance_pct": 60})
        self.assertEqual(result["academic_risk"]["level"], "Red")
        self.assertTrue(result["academic_risk"]["drivers"][0]["label"].startswith("Attendance below detention"))

    def test_ordered_segments_and_whatif_monotonicity(self):
        star = evaluate({**BASE, "cgpa": 9.2, "internal_pct": 90, "aptitude": 40, "coding": 35, "mock": 2})
        silent = evaluate({**BASE, "engagement_drop": 1, "login_trend": -0.7})
        self.assertEqual(star["segment"], "Academic stars, placement unready")
        self.assertEqual(silent["segment"], "Silent disengagers")
        self.assertGreater(evaluate({**BASE, "coding": 80})["score"], evaluate({**BASE, "coding": 30})["score"])

    def test_non_finite_inputs_do_not_escape(self):
        result = evaluate({**BASE, "cgpa": float("nan"), "avg_minutes": float("inf")})
        json.dumps(result, allow_nan=False)


class PipelineTests(unittest.TestCase):
    def test_ids_normalize_all_specified_formats(self):
        self.assertEqual([normalize_id(value) for value in (" SCA-42178 ", "sca42178", "42178@CAMPUS.EDU")],
                         ["42178", "42178", "42178"])

    def test_generation_is_deterministic_and_cleans_to_unique_registry(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            left = generate_all(Path(first), n=60)
            generate_all(Path(second), n=60)
            files = sorted(path.name for path in Path(first).glob("*.csv"))
            self.assertIn("attendance_summary.csv", files)
            self.assertEqual(files, sorted(path.name for path in Path(second).glob("*.csv")))
            for name in files:
                one = hashlib.sha256((Path(first) / name).read_bytes()).digest()
                two = hashlib.sha256((Path(second) / name).read_bytes()).digest()
                self.assertEqual(one, two, name)
            clean, issues, stats = clean_all(left)
            self.assertEqual(len(clean["students"]), 60)
            self.assertEqual(len({row["student_id"] for row in clean["students"]}), 60)
            self.assertEqual(len(stats), 8)
            self.assertTrue(any(issue["issue"] == "Duplicate source row" for issue in issues))

    def test_payload_matches_database_contract_and_has_demo_personas(self):
        with tempfile.TemporaryDirectory() as raw_dir:
            raw = generate_all(Path(raw_dir), n=200)
            clean, issues, stats = clean_all(raw)
            payload = _build_payload(clean, issues, stats, 200)
        self.assertEqual(payload["summary"]["students"], 200)
        self.assertEqual(len(payload["scores"]), 200)
        self.assertEqual(len(payload["source_stats"]), 8)
        self.assertEqual(len(payload["analytics"]), 3)
        profiles = [row["profile"] for row in payload["scores"]]
        self.assertTrue(any(p["mentor_faculty_id"] == "F01" and p["academic_risk"]["level"] == "Red" for p in profiles))
        self.assertTrue(any(p["mentor_faculty_id"] == "F01" and p["segment"] == "Academic stars, placement unready" for p in profiles))
        self.assertTrue(all(p["placement_risk"]["level"] == "Not assessed" and p["confidence"] < 100
                            for p in profiles if p["year"] == 2))
        json.dumps(payload, allow_nan=False)


if __name__ == "__main__":
    unittest.main()
