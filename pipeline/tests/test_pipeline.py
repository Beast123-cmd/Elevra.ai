"""Regression checks for the data pipeline and scoring API."""
from __future__ import annotations

import hashlib
import inspect
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from clean.clean import clean_all, normalize_id
from generate.generate import DEFAULT_STUDENT_COUNT, generate_all
from run import _build_payload, build_parser, run
from seed import _student_profiles_match, _write_sql
from scoring.engine import WEIGHTS, evaluate, pillars_from_metrics, success_score
from scoring.model import historical_examples, train_model

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))
from common.auth import Caller, current_caller
from routers import whatif as whatif_router

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

    def test_tree_model_cards_produce_probability_and_explanation(self):
        feature = {"name": "attendance_pct", "source": "attendance_pct",
            "label": "Attendance", "mean": 75, "std": 10}
        tree = {"prob": 0.4, "n": 100, "leaf": False,
            "feature": 0, "threshold": 65, "left": {"prob": 0.8, "n": 25, "leaf": True},
            "right": {"prob": 0.25, "n": 75, "leaf": True}}
        card = {"algorithm": "decision_tree", "features": [feature], "tree": tree}
        result = evaluate({**BASE, "attendance_pct": 60}, card=card)
        self.assertEqual(result["model"]["prob"], 0.8)
        self.assertIn("Attendance ≤ 65.00", result["model"]["factors"][0]["label"])
        forest = evaluate({**BASE, "attendance_pct": 60}, card={**card, "algorithm": "random_forest", "trees": [tree, tree]})
        self.assertEqual(forest["model"]["prob"], 0.8)

    def test_ordered_segments_and_whatif_monotonicity(self):
        star = evaluate({**BASE, "cgpa": 9.2, "internal_pct": 90, "aptitude": 40, "coding": 35, "mock": 2})
        silent = evaluate({**BASE, "engagement_drop": 1, "login_trend": -0.7})
        self.assertEqual(star["segment"], "Academic stars, placement unready")
        self.assertEqual(silent["segment"], "Silent disengagers")
        self.assertGreater(evaluate({**BASE, "coding": 80})["score"], evaluate({**BASE, "coding": 30})["score"])

    def test_non_finite_inputs_do_not_escape(self):
        result = evaluate({**BASE, "cgpa": float("nan"), "avg_minutes": float("inf")})
        json.dumps(result, allow_nan=False)


class WhatIfApiTests(unittest.TestCase):
    class FakeQuery:
        def __init__(self, database, table):
            self.database = database
            self.table_name = table
            self.student_id = None
            self.page = None

        def select(self, _columns):
            return self

        def eq(self, key, value):
            if key == "student_id":
                self.student_id = value
            return self

        def limit(self, _limit):
            return self

        def order(self, _column):
            return self

        def range(self, start, end):
            self.page = (start, end + 1)
            return self

        def execute(self):
            rows = self.database.tables.get(self.table_name, [])
            if self.student_id:
                rows = [row for row in rows if row.get("student_id") == self.student_id]
            if self.page:
                rows = rows[self.page[0]:self.page[1]]
            return SimpleNamespace(data=rows)

    class FakeDatabase:
        def __init__(self, **tables):
            self.tables = tables

        def table(self, name):
            return WhatIfApiTests.FakeQuery(self, name)

    @staticmethod
    def _client(caller):
        app = FastAPI()
        app.include_router(whatif_router.router)
        app.dependency_overrides[current_caller] = lambda: caller
        return TestClient(app)

    def test_whatif_validates_supported_ranges_and_rejects_unknown_metrics(self):
        self.assertEqual(whatif_router.WhatIf(student_id="42178", overrides={"submit_rate": 0.8}).overrides,
                         {"submit_rate": 0.8})
        for payload in (
            {"student_id": "42178", "overrides": {"cgpa": 8.0}},
            {"student_id": "42178", "overrides": {"attendance_pct": 101}},
            {"student_id": "42178", "overrides": {"submit_rate": float("nan")}},
            {"student_id": "42178", "overrides": {"coding": True}},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                whatif_router.WhatIf(**payload)
        with self.assertRaises(ValueError):
            whatif_router.WhatIf(student_id="SCA-42178")

    def test_whatif_limits_student_scope_and_returns_delta(self):
        metrics = {"cgpa": 8.0, "internal_pct": 75, "backlogs": 0, "attendance_pct": 80,
                   "submit_rate": 0.8, "coding": 70, "aptitude": 70, "mock": 4,
                   "tech_skill": 70, "soft_skill": 70, "certifications": 1,
                   "events": 1, "clubs": 1, "hackathons": 1, "satisfaction": 4,
                   "faculty_rating": 4}
        profile = {"score": 60.0, "metrics": metrics}
        database = self.FakeDatabase(scores=[{"student_id": "42178", "profile": profile}], analytics=[])
        student = Caller(user_id="u1", role="student", student_id="42178")
        body = whatif_router.WhatIf(student_id="42178", overrides={"coding": 90})
        with patch.object(whatif_router, "db", return_value=database):
            result = whatif_router.whatif(body, student)
            self.assertGreater(result["score"], profile["score"])
            self.assertEqual(result["delta"], round(result["score"] - profile["score"], 1))
            with self.assertRaises(whatif_router.HTTPException) as raised:
                whatif_router.whatif(whatif_router.WhatIf(student_id="42179"), student)
        self.assertEqual(raised.exception.status_code, 403)

    def test_http_routes_enforce_role_scope_and_payload_validation(self):
        student = self._client(Caller(user_id="u1", role="student", student_id="42178"))
        self.assertEqual(student.post("/rescore", json={"weights": {"academic": 0.5}}).status_code, 403)
        self.assertEqual(student.post("/whatif", json={
            "student_id": "42179", "overrides": {"coding": 90},
        }).status_code, 403)
        self.assertEqual(student.post("/whatif", json={
            "student_id": "42178", "overrides": {"cgpa": 8},
        }).status_code, 422)

    def test_rescore_uses_default_weights_for_omitted_pillars_and_pages_results(self):
        database = self.FakeDatabase(scores=[
            {"student_id": f"{sid:05d}", "profile": {"metrics": {"cgpa": 8, "internal_pct": 75}}}
            for sid in range(42178, 42181)
        ])
        with patch.object(whatif_router, "db", return_value=database), \
                patch.object(whatif_router, "RESCORE_PAGE_SIZE", 2):
            result = whatif_router.rescore(whatif_router.Rescore(weights={"academic": 0.5}),
                                            Caller(user_id="admin", role="admin"))
        self.assertEqual(len(result), 3)
        self.assertEqual([row["student_id"] for row in result], ["42178", "42179", "42180"])
        self.assertTrue(all(row["band"] in {"Critical", "Needs Attention", "On Track", "Thriving"}
                            and isinstance(row["score"], float) for row in result))


class PipelineTests(unittest.TestCase):
    def test_default_cohort_size_is_consistent(self):
        self.assertEqual(DEFAULT_STUDENT_COUNT, 1500)
        self.assertEqual(inspect.signature(generate_all).parameters["n"].default, DEFAULT_STUDENT_COUNT)
        self.assertEqual(inspect.signature(run).parameters["n"].default, DEFAULT_STUDENT_COUNT)
        self.assertEqual(build_parser().parse_args([]).n, DEFAULT_STUDENT_COUNT)

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

    def test_existing_student_sources_stay_stable_when_cohort_grows(self):
        with tempfile.TemporaryDirectory() as smaller_dir, tempfile.TemporaryDirectory() as larger_dir:
            smaller, _, _ = clean_all(generate_all(Path(smaller_dir), n=60))
            larger, _, _ = clean_all(generate_all(Path(larger_dir), n=120))
        smaller_ids = {row["student_id"] for row in smaller["students"]}
        self.assertEqual(smaller["students"], [row for row in larger["students"] if row["student_id"] in smaller_ids])
        for table in ("academic", "attendance", "lms", "engagement", "placement", "skills", "feedback"):
            left = sorted(json.dumps(row, sort_keys=True) for row in smaller[table])
            right = sorted(json.dumps(row, sort_keys=True) for row in larger[table]
                           if row["student_id"] in smaller_ids)
            self.assertEqual(left, right, table)

    def test_cohort_replacement_is_scoped_and_student_guard_detects_mismatch(self):
        student = {"student_id": "40000", "name": "Synthetic Student", "department": "Comp", "year": 2,
                   "batch": "2026-2027", "section": "A", "gender": "F", "residence": "Hostel",
                   "mentor_faculty_id": "F01", "email": "40000@campus.edu"}
        payload = {"students": [student], "interventions": [{"student_id": "40000", "faculty_id": "F01",
            "type": "Mentoring call", "note": "Synthetic seeded example.", "status": "done",
            "followup_date": None, "score_before": 60, "score_after": 66, "is_seeded": True}]}
        self.assertTrue(_student_profiles_match([dict(student)], payload))
        changed = {**student, "name": "Unexpected Student"}
        self.assertFalse(_student_profiles_match([changed], payload))
        normal_path = _write_sql(payload)
        try:
            normal_sql = normal_path.read_text(encoding="utf-8")
        finally:
            normal_path.unlink(missing_ok=True)
        self.assertNotIn("DELETE FROM public.engagement", normal_sql)
        sql_path = _write_sql(payload, replace_existing_cohort=True)
        try:
            sql = sql_path.read_text(encoding="utf-8")
        finally:
            sql_path.unlink(missing_ok=True)
        self.assertIn("DELETE FROM public.engagement WHERE student_id IN ('40000');", sql)
        self.assertNotIn("DELETE FROM public.students", sql)
        self.assertIn("DELETE FROM public.interventions WHERE is_seeded = TRUE;", sql)
        self.assertIn("INSERT INTO public.interventions", sql)
        self.assertLess(sql.index("DELETE FROM public.scores"), sql.index("INSERT INTO public.students"))

    def test_payload_matches_database_contract_and_has_demo_personas(self):
        with tempfile.TemporaryDirectory() as raw_dir:
            raw = generate_all(Path(raw_dir), n=200)
            clean, issues, stats = clean_all(raw)
            payload = _build_payload(clean, issues, stats, 200)
        self.assertEqual(payload["summary"]["students"], 200)
        self.assertEqual(len(payload["scores"]), 200)
        self.assertEqual(len(payload["source_stats"]), 8)
        self.assertEqual(len(payload["analytics"]), 3)
        model = next(row["payload"] for row in payload["analytics"] if row["key"] == "model")
        self.assertEqual(model["metrics"]["n_train"] + model["metrics"]["n_test"], 200)
        self.assertEqual(len(model["features"]), 7)
        self.assertIn("synthetic", model["metrics"]["target"])
        self.assertEqual({row["name"] for row in model["candidates"]},
                         {"logistic_regression", "decision_tree", "random_forest"})
        self.assertEqual(model["algorithm"], max(model["candidates"],
                         key=lambda row: (row["metrics"]["cv_auc"],
                                          {"logistic_regression": 2, "decision_tree": 1, "random_forest": 0}[row["name"]]))["name"])
        self.assertEqual({row["group_type"] for row in model["fairness"]}, {"residence", "gender"})
        self.assertEqual(len(payload["analytics"][0]["payload"]["lead_time"]), 8)
        self.assertEqual(len(payload["interventions"]), 200)
        self.assertEqual({row["type"] for row in payload["interventions"]},
                         {"Mentoring call", "Remedial classes", "Coding bootcamp", "Attendance counselling", "Mock interviews"})
        self.assertTrue(any(row["profile"]["model"]["prob"] > 0 for row in payload["scores"]))
        profiles = [row["profile"] for row in payload["scores"]]
        self.assertTrue(all({"attendance", "cgpa", "lms"}.issubset(profile["percentiles"])
                            for profile in profiles))
        self.assertTrue(all(0 <= value <= 100 for profile in profiles for value in profile["percentiles"].values()))
        self.assertTrue(all(profile["declining"] == (len(profile["history"]) >= 3 and
                            profile["history"][-1]["score"] - profile["history"][-3]["score"] <= -10)
                            for profile in profiles))
        self.assertTrue(any(p["mentor_faculty_id"] == "F01" and p["academic_risk"]["level"] == "Red" for p in profiles))
        self.assertTrue(any(p["mentor_faculty_id"] == "F01" and p["segment"] == "Academic stars, placement unready" for p in profiles))
        self.assertTrue(all(p["placement_risk"]["level"] == "Not assessed" and p["confidence"] < 100
                            for p in profiles if p["year"] == 2))
        json.dumps(payload, allow_nan=False)

    def test_historical_model_is_deterministic_and_rejects_small_cohorts(self):
        with tempfile.TemporaryDirectory() as raw_dir:
            raw = generate_all(Path(raw_dir), n=200)
            clean, _, _ = clean_all(raw)
            first = train_model(clean)
            second = train_model(clean)
            self.assertEqual(first, second)
            self.assertGreater(first["metrics"]["auc"], 0.5)
            self.assertGreater(first["metrics"]["n_test"], 0)
            examples = historical_examples(clean)
            low_attendance = [row["label"] for row in examples if row["features"]["attendance_pct"] < 65]
            other_students = [row["label"] for row in examples if row["features"]["attendance_pct"] >= 65]
            self.assertGreater(sum(low_attendance) / len(low_attendance), sum(other_students) / len(other_students))
            drop_rates = {}
            for outcome in (0, 1):
                members = [row for row in examples if row["label"] == outcome]
                drops = []
                for row in members:
                    early = sum(week["logins"] or 0 for week in row["weekly"][:4]) / 4
                    late = sum(week["logins"] or 0 for week in row["weekly"][5:8]) / 3
                    drops.append(int(early >= 2 and late < 0.6 * early))
                drop_rates[outcome] = sum(drops) / len(drops)
            self.assertGreaterEqual(drop_rates[1], 2 * drop_rates[0])
            small = {key: value[:30] if isinstance(value, list) else value for key, value in clean.items()}
            with self.assertRaises(ValueError):
                train_model(small)


if __name__ == "__main__":
    unittest.main()
