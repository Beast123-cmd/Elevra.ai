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


class FakeCursor:
    """Emulates one batched execute() that returns several result sets, like psycopg's nextset()."""

    def __init__(self, conn):
        self.conn, self._i = conn, 0
        self._sets = [(None, []), (None, []), (None, []), (["set_config"], [("{}",)]), (["n"], [(1,)]), (None, [])]

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, script, params=None):
        self.conn.executed.append(script)
        if self.conn.error is not None:
            raise self.conn.error

    @property
    def description(self):
        cols = self._sets[self._i][0]
        return None if cols is None else [type("D", (), {"name": c})() for c in cols]

    def fetchall(self):
        return self._sets[self._i][1]

    def nextset(self):
        if self._i + 1 < len(self._sets):
            self._i += 1
            return True
        return None


class FakeConn:
    def __init__(self, error=None, broken=False):
        self.executed, self.rollbacks = [], 0
        self.error, self.broken, self.closed, self.autocommit = error, broken, False, True

    def cursor(self):
        return FakeCursor(self)

    def rollback(self):
        self.rollbacks += 1


class Connection(unittest.TestCase):
    def setUp(self):
        chat._conn = None

    def test_one_connection_is_reused_across_requests(self):
        made = []

        def make():
            made.append(FakeConn())
            return made[-1]

        with mock.patch.object(chat, "_open_connection", side_effect=make):
            for _ in range(3):
                chat.run_readonly("select 1 from student_unified_view")
        self.assertEqual(len(made), 1)

    def test_the_whole_read_only_block_is_one_round_trip(self):
        conn = FakeConn()
        with mock.patch.object(chat, "_open_connection", return_value=conn):
            cols, rows, truncated = chat.run_readonly("select 1 from student_unified_view", {"sub": "u1"})
        self.assertEqual(len(conn.executed), 1)
        script = conn.executed[0].lower()
        for needle in ("begin read only", "statement_timeout", "role authenticated", "request.jwt.claims", f"limit {ROW_CAP + 1}", "rollback"):
            self.assertIn(needle, script)
        self.assertLess(script.index("begin read only"), script.index("role authenticated"))
        self.assertLess(script.index("request.jwt.claims"), script.index("from student_unified_view"))
        self.assertEqual((cols, rows), (["n"], [[1]]), "the result is the wrapped query's, not the set_config row")

    def test_claims_travel_as_hex_so_nothing_in_them_can_break_out(self):
        import json

        claims = {"sub": "x'); drop table users; --"}
        conn = FakeConn()
        with mock.patch.object(chat, "_open_connection", return_value=conn):
            chat.run_readonly("select 1 from student_unified_view", claims)
        script = conn.executed[0]
        self.assertIn(json.dumps(claims).encode().hex(), script)
        self.assertNotIn("drop table", script)

    def test_warm_up_opens_one_connection_in_the_background(self):
        opened = mock.Mock(return_value=FakeConn())
        with mock.patch.object(chat, "_open_connection", opened):
            chat.warm_up()
            chat.warm_up()
            import time

            time.sleep(0.2)
        self.assertEqual(opened.call_count, 1)

    def test_a_dead_connection_is_replaced_and_the_query_retried_once(self):
        import psycopg

        dead = FakeConn(error=psycopg.OperationalError("server closed the connection"), broken=True)
        fresh = FakeConn()
        with mock.patch.object(chat, "_open_connection", side_effect=[dead, fresh]) as opened:
            cols, rows, truncated = chat.run_readonly("select 1 from student_unified_view")
        self.assertEqual(rows, [[1]])
        self.assertEqual(opened.call_count, 2)

    def test_a_query_timeout_is_not_retried_and_the_connection_survives(self):
        import psycopg

        conn = FakeConn(error=psycopg.errors.QueryCanceled("statement timeout"), broken=False)
        opened = mock.Mock(return_value=conn)
        with mock.patch.object(chat, "_open_connection", opened):
            with self.assertRaises(psycopg.errors.QueryCanceled):
                chat.run_readonly("select 1 from student_unified_view")
            self.assertEqual(opened.call_count, 1)
            self.assertGreaterEqual(conn.rollbacks, 1, "a failed batch must leave no open transaction behind")
            self.assertIs(chat._conn, conn, "a timed-out query must not throw away a healthy connection")


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
