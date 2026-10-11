"""What-if and re-score must give a mentor the same scope the database policies give them: their own mentees only."""
import asyncio
import unittest
from unittest import mock

from fastapi import HTTPException

from common.auth import Caller
from routers import whatif

FACULTY = Caller(user_id="u1", role="faculty", faculty_id="F01")
ADMIN = Caller(user_id="u2", role="admin")
STUDENT = Caller(user_id="u3", role="student", student_id="40008")
PROFILE = {"score": 50.0, "metrics": {"attendance_pct": 60.0}}
RESULT = {"score": 55.0, "band": "Needs Attention", "pillars": {}, "academic_risk": {}, "placement_risk": {}}


def run(coro):
    return asyncio.run(coro)


class WhatIfScope(unittest.TestCase):
    def call(self, caller, student_id, mentees=("40940",)):
        body = whatif.WhatIf(student_id=student_id, overrides={})
        with mock.patch.object(whatif, "_mentee_ids", return_value=set(mentees)), \
             mock.patch.object(whatif, "_student_profile", return_value=PROFILE), \
             mock.patch.object(whatif, "_model_card", return_value=None), \
             mock.patch.object(whatif, "evaluate", return_value=RESULT):
            return run(whatif.whatif(body, caller))

    def test_a_mentor_can_simulate_their_own_mentee(self):
        self.assertEqual(self.call(FACULTY, "40940")["score"], 55.0)

    def test_a_mentor_cannot_simulate_someone_elses_student(self):
        with self.assertRaises(HTTPException) as cm:
            self.call(FACULTY, "40001")
        self.assertEqual(cm.exception.status_code, 403)

    def test_a_mentor_with_no_mentees_is_refused(self):
        with self.assertRaises(HTTPException):
            self.call(FACULTY, "40940", mentees=())

    def test_admin_may_simulate_anyone_and_a_student_only_themselves(self):
        self.assertEqual(self.call(ADMIN, "40001")["score"], 55.0)
        self.assertEqual(self.call(STUDENT, "40008")["score"], 55.0)
        with self.assertRaises(HTTPException) as cm:
            self.call(STUDENT, "40001")
        self.assertEqual(cm.exception.status_code, 403)


class FakeTable:
    """Stands in for db().table('scores') paging through a fixed list."""
    def __init__(self, rows): self.rows, self.lo, self.hi = rows, 0, 0
    def select(self, *_): return self
    def order(self, *_): return self
    def range(self, lo, hi): self.lo, self.hi = lo, hi; return self
    def execute(self): return mock.Mock(data=self.rows[self.lo:self.hi + 1])


class RescoreScope(unittest.TestCase):
    ROWS = [{"student_id": sid, "profile": {"metrics": {"attendance_pct": 70}}} for sid in ("40001", "40002", "40940", "40941")]

    def rescore(self, caller, mentees):
        client = mock.Mock()
        client.table.return_value = FakeTable(self.ROWS)
        body = whatif.Rescore(weights={"academic": 0.5})
        with mock.patch.object(whatif, "db", return_value=client), \
             mock.patch.object(whatif, "_mentee_ids", return_value=set(mentees)), \
             mock.patch.object(whatif, "evaluate", return_value={"score": 60.0, "band": "On Track"}):
            return whatif.rescore(body, caller)

    def test_a_mentor_gets_only_their_mentees(self):
        out = self.rescore(FACULTY, ("40940", "40941"))
        self.assertEqual([r["student_id"] for r in out], ["40940", "40941"])

    def test_a_mentor_with_no_mentees_gets_nothing(self):
        self.assertEqual(self.rescore(FACULTY, ()), [])

    def test_admin_gets_everyone(self):
        self.assertEqual(len(self.rescore(ADMIN, ())), 4)


if __name__ == "__main__":
    unittest.main()
