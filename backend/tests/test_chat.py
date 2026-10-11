import unittest
from datetime import date
from decimal import Decimal
from unittest import mock

from common.llm import LlmUnavailable
from common.sqlguard import ROW_CAP, validate_sql
from routers import chat

GOOD_SQL = "select department, count(*) as n from student_unified_view group by department order by n desc"
EVIL_SQL = "select name from student_unified_view; drop table users"


def runner_returning(columns, rows):
    return mock.Mock(return_value=(columns, rows, False))


class Canned(unittest.TestCase):
    def test_every_canned_query_passes_the_guard(self):
        for kw, title, sql in chat.CANNED:
            with self.subTest(title=title):
                validate_sql(sql)

    def test_matching(self):
        cases = {
            "show academic risk by department": "Academic risk by department",
            "who are the top students needing attention": "Highest-priority students",
            "how many students are in each segment": "Students per segment",
            "which stars are not placement ready": "Strong academics, weak placement readiness",
            "attendance below 65 by dept": "Students below the 65% detention line",
            "what is the average score per department": "Average success score by department",
            "how many students show an early lms drop": "Early-warning LMS drop by department",
        }
        for question, title in cases.items():
            with self.subTest(question=question):
                self.assertEqual(chat.canned_for(question)[0], title)

    def test_unrelated_question_has_no_match(self):
        self.assertIsNone(chat.canned_for("what is the weather in Pune"))


class Flow(unittest.TestCase):
    def test_ai_sql_is_validated_run_and_returned(self):
        run = runner_returning(["department", "n"], [["Comp", 40], ["IT", 30]])
        with mock.patch.object(chat, "generate_json", return_value={"sql": GOOD_SQL, "explanation": "Students per department."}):
            out = chat.answer_question("students per department", run=run)
        self.assertEqual(out["source"], "ai")
        self.assertEqual(out["sql"], GOOD_SQL)
        self.assertEqual(out["row_count"], 2)
        run.assert_called_once()
        self.assertEqual(run.call_args.args[0], GOOD_SQL)

    def test_malicious_sql_is_never_executed(self):
        run = runner_returning([], [])
        with mock.patch.object(chat, "generate_json", return_value={"sql": EVIL_SQL, "explanation": "x"}):
            out = chat.answer_question("tell me something unrelated and sneaky", run=run)
        run.assert_not_called()
        self.assertEqual(out["source"], "none")
        self.assertIsNone(out["sql"])
        self.assertTrue(out["suggestions"])

    def test_rejected_sql_gets_one_repair_attempt_with_the_reason(self):
        run = runner_returning(["n"], [[5]])
        replies = [{"sql": "select email from student_unified_view", "explanation": "x"},
                   {"sql": "select count(*) as n from student_unified_view", "explanation": "Counts students."}]
        with mock.patch.object(chat, "generate_json", side_effect=replies) as g:
            out = chat.answer_question("how many students", run=run)
        self.assertEqual(g.call_count, 2)
        self.assertIn("rejected", g.call_args_list[1].args[0].lower())
        self.assertEqual(out["source"], "ai")
        self.assertEqual(out["rows"], [[5]])

    def test_after_two_bad_attempts_a_matching_canned_query_is_used(self):
        run = runner_returning(["department", "academic_risk", "students"], [["Comp", "Red", 10]])
        with mock.patch.object(chat, "generate_json", return_value={"sql": EVIL_SQL, "explanation": "x"}):
            out = chat.answer_question("academic risk by department", run=run)
        self.assertEqual(out["source"], "template")
        validate_sql(run.call_args.args[0])

    def test_llm_down_uses_canned_query(self):
        run = runner_returning(["segment", "students"], [["Steady middle", 800]])
        with mock.patch.object(chat, "generate_json", side_effect=LlmUnavailable("offline")):
            out = chat.answer_question("how many students are in each segment", run=run)
        self.assertEqual(out["source"], "template")
        self.assertIn("segment", out["sql"])
        self.assertTrue(out["answer"])

    def test_llm_down_and_no_match_returns_suggestions_not_an_error(self):
        run = runner_returning([], [])
        with mock.patch.object(chat, "generate_json", side_effect=LlmUnavailable("offline")):
            out = chat.answer_question("what is the weather in Pune", run=run)
        run.assert_not_called()
        self.assertEqual(out["source"], "none")
        self.assertGreaterEqual(len(out["suggestions"]), 3)

    def test_model_can_decline_unanswerable_questions(self):
        run = runner_returning([], [])
        with mock.patch.object(chat, "generate_json", return_value={"sql": None, "explanation": "That needs data we do not hold."}):
            out = chat.answer_question("what will placements look like in 2030", run=run)
        run.assert_not_called()
        self.assertEqual(out["answer"], "That needs data we do not hold.")
        self.assertEqual(out["source"], "ai")

    def test_database_errors_become_a_message_not_a_crash(self):
        run = mock.Mock(side_effect=RuntimeError("statement timeout"))
        with mock.patch.object(chat, "generate_json", return_value={"sql": GOOD_SQL, "explanation": "x"}):
            out = chat.answer_question("students per department", run=run)
        self.assertIn("couldn't run", out["answer"].lower())
        self.assertEqual(out["rows"], [])
        self.assertNotIn("statement timeout", out["answer"])

    def test_question_is_trimmed_and_length_limited(self):
        with self.assertRaises(ValueError):
            chat.answer_question("   ", run=runner_returning([], []))
        with self.assertRaises(ValueError):
            chat.answer_question("x" * (chat.MAX_QUESTION + 1), run=runner_returning([], []))

    def test_prompt_contains_the_question_but_no_student_data(self):
        with mock.patch.object(chat, "generate_json", return_value={"sql": None, "explanation": "n/a"}) as g:
            chat.answer_question("students per department", run=runner_returning([], []))
        prompt = g.call_args.args[0]
        self.assertIn("students per department", prompt)
        self.assertIn("student_unified_view", prompt)
        self.assertNotIn("email", prompt.lower().replace("never select email", ""))


class Shaping(unittest.TestCase):
    def test_rows_are_json_safe(self):
        cols, rows, truncated = chat.shape_result(["a", "b", "c"], [(Decimal("1.50"), date(2026, 10, 11), None)])
        self.assertEqual(rows, [[1.5, "2026-10-11", None]])
        self.assertFalse(truncated)

    def test_more_than_the_cap_is_truncated_and_flagged(self):
        cols, rows, truncated = chat.shape_result(["a"], [(i,) for i in range(ROW_CAP + 1)])
        self.assertEqual(len(rows), ROW_CAP)
        self.assertTrue(truncated)


if __name__ == "__main__":
    unittest.main()
