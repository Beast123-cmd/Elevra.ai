import unittest
from datetime import datetime, timezone
from unittest import mock

from common.llm import LlmUnavailable
from routers import weekly

NOW = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)
STUDENTS = [{"student_id": str(i), "department": "Comp" if i < 3 else "IT"} for i in range(5)]
SCORES = [
    {"student_id": "0", "academic_risk": "Red", "placement_risk": "Green", "segment": "Silent disengagers"},
    {"student_id": "1", "academic_risk": "Green", "placement_risk": "Red", "segment": "Placement-at-risk"},
    {"student_id": "2", "academic_risk": "Red", "placement_risk": "Red", "segment": "Silent disengagers"},
    {"student_id": "3", "academic_risk": "Amber", "placement_risk": "Green", "segment": "Steady middle"},
    {"student_id": "4", "academic_risk": "Green", "placement_risk": "Green", "segment": "Thriving"},
    {"student_id": "ghost", "academic_risk": "Red", "placement_risk": "Red", "segment": "x"},
]


def iv(student, status="done", created="2026-10-10T09:00:00Z", due=None, seeded=False):
    return {"student_id": student, "status": status, "followup_date": due, "created_at": created, "is_seeded": seeded}


class Stats(unittest.TestCase):
    def test_counts_and_coverage(self):
        st = weekly.compute_stats(STUDENTS, SCORES, [iv("0"), iv("1", "planned"), iv("2", created="2026-09-01T09:00:00Z")], NOW)
        self.assertEqual(st["students"], 5)
        self.assertEqual((st["red_academic"], st["red_placement"], st["red_total"]), (2, 2, 3))
        self.assertEqual(st["red_contacted_7d"], 1)          # student 0 only: planned is not contact, student 2's is old
        self.assertEqual(st["red_contacted_pct"], 33.3)
        self.assertEqual(st["red_never_contacted"], 1)       # student 1 (planned only); student 2 was contacted once
        self.assertEqual(st["top_departments"][0], {"department": "Comp", "red": 3})

    def test_seeded_history_does_not_count_and_students_without_a_record_are_ignored(self):
        st = weekly.compute_stats(STUDENTS, SCORES, [iv("0", seeded=True)], NOW)
        self.assertEqual(st["red_contacted_7d"], 0)
        self.assertEqual(st["support_logged_7d"], 0)
        self.assertEqual(st["red_total"], 3)  # "ghost" has no student record

    def test_overdue_followups(self):
        st = weekly.compute_stats(STUDENTS, SCORES, [iv("0", "planned", due="2026-10-09"), iv("1", "planned", due="2026-10-20"), iv("2", "done", due="2026-10-01")], NOW)
        self.assertEqual(st["overdue_followups"], 1)

    def test_empty_database_is_safe(self):
        st = weekly.compute_stats([], [], [], NOW)
        self.assertEqual(st["red_contacted_pct"], 0.0)
        self.assertIn("0 of 0", weekly.template_brief(st))


class Brief(unittest.TestCase):
    def setUp(self):
        self.st = weekly.compute_stats(STUDENTS, SCORES, [iv("0")], NOW)

    def test_template_quotes_only_computed_numbers_and_passes_its_own_check(self):
        t = weekly.template_brief(self.st)
        self.assertTrue(weekly.is_grounded(t, self.st))
        self.assertNotIn("fail", t.lower())

    def test_ai_text_with_the_right_numbers_is_used(self):
        text = "3 of 5 students need a check-in and 33.3% were reached this week. Priority: contact the 2 who have not been reached."
        with mock.patch.object(weekly, "generate_json", return_value={"brief": text}):
            self.assertEqual(weekly.make_brief(self.st)["source"], "ai")

    def test_invented_numbers_and_failure_framing_fall_back(self):
        for bad in ("412 students need a check-in.", "Many students will fail this term."):
            with mock.patch.object(weekly, "generate_json", return_value={"brief": bad}):
                r = weekly.make_brief(self.st)
            self.assertEqual(r["source"], "template", bad)
            self.assertIn("reason", r)

    def test_unavailable_ai_falls_back(self):
        with mock.patch.object(weekly, "generate_json", side_effect=LlmUnavailable("down")):
            self.assertEqual(weekly.make_brief(self.st)["source"], "template")


if __name__ == "__main__":
    unittest.main()
