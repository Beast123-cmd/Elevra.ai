"""Practice analytics: the calculations, and who is allowed to see which student's practice."""
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest import mock

from fastapi import HTTPException

from common.auth import Caller
from routers import practice

NOW = datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)
TODAY = date(2026, 10, 12)
FACULTY = Caller(user_id="u1", role="faculty", faculty_id="F01")
ADMIN = Caller(user_id="u2", role="admin")


def session(category="sql", difficulty="easy", status="completed", score=70, started="2026-10-10T08:00:00+00:00",
            completed="2026-10-10T08:20:00+00:00", expires="2026-10-10T08:30:00+00:00"):
    return {"category": category, "difficulty": difficulty, "mode": "daily", "status": status, "score_percent": score if status == "completed" else None,
            "started_at": started, "completed_at": completed if status == "completed" else None, "expires_at": expires}


class TopicStats(unittest.TestCase):
    def topic(self, sessions, name):
        return next(t for t in practice.topic_stats(sessions, NOW) if t["category"] == name)

    def test_average_and_difficulty_split(self):
        t = self.topic([session(score=40), session(score=60), session(difficulty="hard", score=20)], "sql")
        self.assertEqual(t["completed"], 3)
        self.assertEqual(t["avg_score"], 40.0)
        self.assertEqual(t["by_difficulty"]["easy"], {"completed": 2, "avg_score": 50.0})
        self.assertEqual(t["by_difficulty"]["hard"]["avg_score"], 20.0)
        self.assertIsNone(t["by_difficulty"]["medium"]["avg_score"])

    def test_a_test_past_its_time_and_never_submitted_counts_as_given_up(self):
        t = self.topic([session(score=80), session(status="in_progress")], "sql")
        self.assertEqual((t["completed"], t["gave_up"], t["completion_rate"]), (1, 1, 50))

    def test_a_test_still_inside_its_time_is_not_counted_either_way(self):
        running = session(status="in_progress", expires="2026-10-12T11:00:00+00:00")
        t = self.topic([session(score=80), running], "sql")
        self.assertEqual((t["gave_up"], t["completion_rate"]), (0, 100))

    def test_a_topic_nobody_took_has_no_average(self):
        t = self.topic([session()], "cpp")
        self.assertEqual((t["completed"], t["avg_score"], t["completion_rate"]), (0, None, None))

    def test_every_topic_is_returned_in_a_fixed_order(self):
        self.assertEqual([t["category"] for t in practice.topic_stats([], NOW)], list(practice.CATEGORIES))


class Participation(unittest.TestCase):
    STUDENTS = [
        {"student_id": "1", "department": "Comp", "year": 2},
        {"student_id": "2", "department": "Comp", "year": 3},
        {"student_id": "3", "department": "IT", "year": 3},
        {"student_id": "4", "department": "IT", "year": None},
    ]

    def test_counts_this_week_against_last_week(self):
        practised = {"1": {TODAY}, "2": {TODAY - timedelta(days=6)}, "3": {TODAY - timedelta(days=7)}}
        out = practice.participation(self.STUDENTS, practised, {"1": {TODAY}}, TODAY)
        self.assertEqual((out["total_students"], out["practised_this_week"], out["practised_last_week"], out["checked_in_this_week"]), (4, 2, 1, 1))

    def test_day_seven_is_last_week_not_this_week(self):
        out = practice.participation(self.STUDENTS, {"1": {TODAY - timedelta(days=7)}}, {}, TODAY)
        self.assertEqual(out["practised_this_week"], 0)

    def test_split_by_department_and_year(self):
        out = practice.participation(self.STUDENTS, {"1": {TODAY}, "3": {TODAY}}, {}, TODAY)
        self.assertEqual(out["by_department"], [{"group": "Comp", "students": 2, "practised": 1}, {"group": "IT", "students": 2, "practised": 1}])
        self.assertIn({"group": "Unknown", "students": 1, "practised": 0}, out["by_year"])


class StudentSummary(unittest.TestCase):
    def summary(self, logins=(), attempts=(), sessions=()):
        return practice.student_summary(list(logins), list(attempts), list(sessions), TODAY, NOW)

    def test_streak_is_alive_if_they_checked_in_today_or_yesterday(self):
        self.assertEqual(self.summary(logins=[{"activity_date": "2026-10-12", "streak_days": 5}])["current_streak"], 5)
        self.assertEqual(self.summary(logins=[{"activity_date": "2026-10-11", "streak_days": 4}])["current_streak"], 4)

    def test_streak_is_zero_once_a_day_has_been_missed_but_the_best_is_kept(self):
        s = self.summary(logins=[{"activity_date": "2026-10-09", "streak_days": 9}])
        self.assertEqual((s["current_streak"], s["best_streak"]), (0, 9))

    def test_active_days_count_each_day_once_across_all_activity(self):
        s = self.summary(logins=[{"activity_date": "2026-10-12", "streak_days": 1}], attempts=[{"activity_date": "2026-10-12"}, {"activity_date": "2026-10-10"}],
                         sessions=[session(started="2026-10-10T08:00:00+00:00")])
        self.assertEqual((s["active_days_30"], s["last_active"]), (2, "2026-10-12"))

    def test_activity_older_than_30_days_is_not_counted(self):
        self.assertEqual(self.summary(attempts=[{"activity_date": "2026-08-01"}])["active_days_30"], 0)

    def test_a_late_night_session_belongs_to_the_next_ist_day(self):
        s = self.summary(sessions=[session(started="2026-10-11T20:00:00+00:00")])  # 01:30 IST on the 12th
        self.assertEqual(s["last_active"], "2026-10-12")

    def test_trend_needs_enough_tests_then_compares_recent_with_earlier(self):
        def tests(scores):
            return [session(score=sc, completed=f"2026-10-{10 - i:02d}T08:00:00+00:00") for i, sc in enumerate(scores)]
        self.assertIsNone(self.summary(sessions=tests([90, 80, 70]))["trend"])
        self.assertEqual(self.summary(sessions=tests([80, 80, 80, 50, 50, 50]))["trend"], "up")
        self.assertEqual(self.summary(sessions=tests([40, 40, 40, 70, 70, 70]))["trend"], "down")
        self.assertEqual(self.summary(sessions=tests([62, 60, 61, 60, 60, 60]))["trend"], "steady")

    def test_recent_tests_are_newest_first_and_hold_only_scores(self):
        s = self.summary(sessions=[session(score=10, completed="2026-10-01T08:00:00+00:00"), session(score=90, completed="2026-10-09T08:00:00+00:00")])
        self.assertEqual([t["score_percent"] for t in s["recent_tests"]], [90, 10])
        self.assertEqual(set(s["recent_tests"][0]), {"date", "category", "difficulty", "mode", "score_percent"})

    def test_a_student_who_never_practised_gets_empty_but_valid_numbers(self):
        s = self.summary()
        self.assertEqual((s["current_streak"], s["active_days_30"], s["tests_completed"], s["avg_score"], s["last_active"], s["recent_tests"]), (0, 0, 0, None, None, []))


class Access(unittest.TestCase):
    def test_a_mentor_cannot_open_someone_elses_student(self):
        with mock.patch.object(practice, "_is_mentee", return_value=False):
            with self.assertRaises(HTTPException) as cm:
                practice.student("40001", FACULTY)
        self.assertEqual(cm.exception.status_code, 403)

    def test_a_mentor_can_open_their_own_mentee(self):
        with mock.patch.object(practice, "_is_mentee", return_value=True), mock.patch.object(practice, "db") as database:
            database.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
            database.return_value.table.return_value.select.return_value.eq.return_value.gte.return_value.execute.return_value.data = []
            database.return_value.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []
            out = practice.student("40940", FACULTY)
        self.assertEqual(out["student_id"], "40940")
        self.assertEqual(out["tests_completed"], 0)

    def test_an_admin_asking_for_a_missing_student_gets_not_found(self):
        with mock.patch.object(practice, "_student_exists", return_value=False):
            with self.assertRaises(HTTPException) as cm:
                practice.student("nope", ADMIN)
        self.assertEqual(cm.exception.status_code, 404)

    def test_a_database_failure_is_reported_as_unavailable_not_a_crash(self):
        with mock.patch.object(practice, "_is_mentee", side_effect=RuntimeError("down")):
            with self.assertRaises(HTTPException) as cm:
                practice.student("40940", FACULTY)
        self.assertEqual(cm.exception.status_code, 503)

    def test_the_institution_wide_view_is_admin_only(self):
        route = next(r for r in practice.router.routes if r.path == "/practice/overview")
        names = {d.call.__qualname__ for d in route.dependant.dependencies}
        self.assertTrue(any("require_role" in n for n in names))
        with self.assertRaises(HTTPException) as cm:
            route.dependant.dependencies[0].call(FACULTY)
        self.assertEqual(cm.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
