import unittest
from unittest import mock

from common.llm import LlmUnavailable
from routers import briefs

PROFILE = {
    "student_id": "41412", "name": "Diya Kumar", "department": "Comp", "year": 4, "batch": "2024-2027",
    "score": 50.1, "band": "Needs Attention", "confidence": 100, "segment": "Silent disengagers",
    "engagement_drop": True, "declining": True,
    "pillars": {"academic": 61.0, "attendance": 47.5, "lms": 47.2, "placement": 39.8, "skills": 43.0, "engagement": 0.0, "feedback": 88.0},
    "academic_risk": {"level": "Red", "points": 11, "drivers": [
        {"label": "Attendance below detention line (65%)", "value": "47.5%", "points": 4},
        {"label": "Early-warning model: elevated probability of academic difficulty", "value": "60.7%", "points": 3},
        {"label": "Active backlogs", "value": "1", "points": 2}]},
    "placement_risk": {"level": "Red", "points": 9, "drivers": [{"label": "Coding score below 40", "value": "30.0", "points": 2}]},
    "model": {"prob": 0.607, "factors": []},
    "actions": ["Attendance counselling and a check-in", "Mentor check-in within 48 hours"],
    "history": [{"semester": 5, "score": 58.2, "sgpa": 6.8}, {"semester": 6, "score": 55.0, "sgpa": 6.4}, {"semester": 7, "score": 50.1, "sgpa": None}],
}
YEAR2 = {**PROFILE, "year": 2, "pillars": {**PROFILE["pillars"], "placement": None},
         "placement_risk": {"level": "Not assessed", "points": 0, "drivers": []}, "engagement_drop": False, "declining": False}


class Template(unittest.TestCase):
    def test_mentions_the_key_facts_and_the_support_framing(self):
        t = briefs.template_brief(PROFILE)
        for needle in ("Diya Kumar", "50.1", "Needs Attention", "Red", "47.5%", "Attendance counselling"):
            self.assertIn(needle, t)
        self.assertIn("conversation", t)
        self.assertNotIn("will fail", t.lower())

    def test_year_two_student_has_no_placement_claims(self):
        t = briefs.template_brief(YEAR2)
        self.assertIn("not yet assessed", t.lower())
        self.assertNotIn("None", t)

    def test_healthy_student_gets_a_calm_brief(self):
        healthy = {**PROFILE, "band": "Thriving", "score": 82.0, "engagement_drop": False, "declining": False, "actions": [],
                   "academic_risk": {"level": "Green", "points": 0, "drivers": []},
                   "placement_risk": {"level": "Green", "points": 0, "drivers": []}}
        self.assertIn("on track", briefs.template_brief(healthy).lower())


class Grounding(unittest.TestCase):
    def setUp(self):
        self.allowed = briefs.allowed_numbers(PROFILE)

    def test_numbers_that_come_from_the_profile_pass(self):
        self.assertTrue(briefs.is_grounded("Diya scores 50.1 with attendance at 47.5% and a 61% model signal in year 4.", self.allowed))

    def test_invented_numbers_fail(self):
        self.assertFalse(briefs.is_grounded("Her attendance is 31% which is alarming.", self.allowed))
        self.assertFalse(briefs.is_grounded("She has 14 backlogs.", self.allowed))

    def test_thresholds_quoted_in_driver_labels_are_facts_too(self):
        # "Attendance below detention line (65%)" and "Coding score below 40" are in the profile's own driver labels
        self.assertTrue(briefs.is_grounded("Attendance is under the 65% detention line and coding is below 40.", self.allowed))
        self.assertFalse(briefs.is_grounded("Attendance is under the 70% line.", self.allowed), "a threshold that is not in the profile is invented")

    def test_numbers_in_suggested_actions_are_facts_too(self):
        p = {**PROFILE, "actions": ["Mentor check-in within 72 hours"]}
        self.assertTrue(briefs.is_grounded("Arrange a check-in within 72 hours.", briefs.allowed_numbers(p)))

    def test_small_counts_are_tolerated(self):
        self.assertTrue(briefs.is_grounded("Start with two conversations in weeks 6 to 8, and one follow-up.", self.allowed))

    def test_rounding_is_tolerated(self):
        self.assertTrue(briefs.is_grounded("The score is about 50 and attendance is 48%.", self.allowed))

    def test_forbidden_framing_fails(self):
        self.assertFalse(briefs.is_grounded("She will fail the semester.", self.allowed))
        self.assertFalse(briefs.is_grounded("This looks like a depression diagnosis.", self.allowed))

    def test_gendered_pronouns_fail_but_they_is_fine(self):
        for bad in ("Diya says she is struggling.", "His attendance is 47.5%.", "Speak with her this week.", "Ask him about it."):
            self.assertFalse(briefs.is_grounded(bad, self.allowed), bad)
        self.assertTrue(briefs.is_grounded("Diya says they are struggling; their attendance is 47.5%.", self.allowed))
        self.assertTrue(briefs.is_grounded("The mentor should check in; other students are fine.", self.allowed), "'other' contains 'her' but is not a pronoun")

    def test_too_long_fails(self):
        self.assertFalse(briefs.is_grounded("word " * 200, self.allowed))


class Generation(unittest.TestCase):
    def setUp(self):
        briefs._cache.clear()

    def test_good_ai_output_is_used(self):
        good = {"brief": "Diya Kumar (score 50.1) shows attendance of 47.5%; a check-in this week would help."}
        with mock.patch.object(briefs, "generate_json", return_value=good) as g:
            out = briefs.make_brief(PROFILE)
        self.assertEqual(out["source"], "ai")
        self.assertIn("47.5%", out["brief"])
        self.assertEqual(g.call_count, 1)

    def test_ungrounded_ai_output_falls_back_to_the_template(self):
        bad = {"brief": "Diya has 99% absenteeism and 7 backlogs."}
        with mock.patch.object(briefs, "generate_json", return_value=bad):
            out = briefs.make_brief(PROFILE)
        self.assertEqual(out["source"], "template")
        self.assertIn("Diya Kumar", out["brief"])

    def test_llm_failure_falls_back_to_the_template(self):
        with mock.patch.object(briefs, "generate_json", side_effect=LlmUnavailable("offline")):
            out = briefs.make_brief(PROFILE)
        self.assertEqual(out["source"], "template")
        self.assertTrue(out["brief"])

    def test_one_retry_absorbs_a_bad_first_draft(self):
        replies = [{"brief": "Diya has 99% absenteeism."}, {"brief": "Diya Kumar (score 50.1) needs a check-in about attendance of 47.5%."}]
        with mock.patch.object(briefs, "generate_json", side_effect=replies) as g:
            out = briefs.make_brief(PROFILE)
        self.assertEqual((out["source"], g.call_count), ("ai", 2))

    def test_two_bad_drafts_fall_back_after_exactly_two_attempts(self):
        with mock.patch.object(briefs, "generate_json", return_value={"brief": "Diya has 99% absenteeism."}) as g:
            out = briefs.make_brief(PROFILE)
        self.assertEqual((out["source"], g.call_count), ("template", 2))

    def test_an_outage_is_not_retried(self):
        with mock.patch.object(briefs, "generate_json", side_effect=LlmUnavailable("offline")) as g:
            briefs.make_brief(PROFILE)
        self.assertEqual(g.call_count, 1)

    def test_missing_or_non_string_brief_falls_back(self):
        for payload in ({}, {"brief": 5}, {"brief": "   "}):
            briefs._cache.clear()
            with mock.patch.object(briefs, "generate_json", return_value=payload):
                self.assertEqual(briefs.make_brief(PROFILE)["source"], "template")

    def test_result_is_cached_until_the_score_changes(self):
        good = {"brief": "Diya Kumar (score 50.1) needs a check-in about attendance of 47.5%."}
        with mock.patch.object(briefs, "generate_json", return_value=good) as g:
            briefs.make_brief(PROFILE)
            briefs.make_brief(PROFILE)
            self.assertEqual(g.call_count, 1)
            briefs.make_brief({**PROFILE, "score": 52.0})
            self.assertEqual(g.call_count, 2)

    def test_template_fallback_is_not_cached_so_ai_can_recover(self):
        with mock.patch.object(briefs, "generate_json", side_effect=LlmUnavailable("offline")):
            briefs.make_brief(PROFILE)
        good = {"brief": "Diya Kumar (score 50.1) needs a check-in about attendance of 47.5%."}
        with mock.patch.object(briefs, "generate_json", return_value=good):
            self.assertEqual(briefs.make_brief(PROFILE)["source"], "ai")

    def test_prompt_only_contains_the_students_own_facts(self):
        with mock.patch.object(briefs, "generate_json", return_value={"brief": "x"}) as g:
            briefs.make_brief(PROFILE)
        prompt = g.call_args.args[0]
        self.assertIn("Diya Kumar", prompt)
        self.assertNotIn("email", prompt.lower())


if __name__ == "__main__":
    unittest.main()


class Messages(unittest.TestCase):
    def test_every_kind_has_a_clean_template_draft(self):
        for kind in briefs.MESSAGE_KINDS:
            m = briefs.template_message(kind, PROFILE)
            self.assertIn("Diya Kumar", m)
            self.assertTrue(briefs.message_ok(m, briefs.allowed_numbers(PROFILE)), kind)
            self.assertNotRegex(m, r"\b(red|amber)\b|success score")

    def test_guardian_note_does_not_disclose_scores_or_risk(self):
        m = briefs.template_message("guardian_attendance", PROFILE)
        self.assertNotRegex(m, r"\d")
        self.assertIn("attendance", m)

    def test_ai_draft_is_used_when_it_passes_the_checks(self):
        with mock.patch.object(briefs, "generate_json", return_value={"message": "Hi Diya Kumar, can we talk for a few minutes this week? Your mentor"}):
            r = briefs.make_message("student_checkin", PROFILE)
        self.assertEqual(r["source"], "ai")

    def test_risk_colours_pronouns_and_invented_numbers_fall_back(self):
        for bad in ("Hi Diya, your status is Red, let us talk.", "Hi, she should come by.", "Hi Diya, your attendance is 12.3%.",
                    "Hi Diya, your success score is 50.1."):
            with mock.patch.object(briefs, "generate_json", return_value={"message": bad}):
                r = briefs.make_message("student_checkin", PROFILE)
            self.assertEqual(r["source"], "template", bad)
            self.assertIn("reason", r)

    def test_unavailable_ai_falls_back(self):
        with mock.patch.object(briefs, "generate_json", side_effect=LlmUnavailable("down")):
            r = briefs.make_message("placement_nudge", PROFILE)
        self.assertEqual(r["source"], "template")

    def test_too_long_draft_is_rejected(self):
        long = "Hi Diya Kumar " + "word " * 100
        with mock.patch.object(briefs, "generate_json", return_value={"message": long}):
            self.assertEqual(briefs.make_message("encouragement", PROFILE)["source"], "template")
