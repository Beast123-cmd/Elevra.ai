"""Practice analytics for faculty and admin: how students use the mock tests, daily challenges and login streak.

The practice tables only let a student read their own rows, so faculty and admin read them here with the service-role
client and the same scope the rest of the product uses: an admin sees everyone, a mentor only their own mentees.
Only counts, scores and dates are returned: never the questions a student got wrong.

The calculations are plain functions with no database access, so they can be tested on their own.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Iterable

from fastapi import APIRouter, Depends, HTTPException

from common.auth import Caller, require_role
from common.db import db

router = APIRouter(prefix="/practice", tags=["practice"])

IST = timezone(timedelta(hours=5, minutes=30))  # the app's calendar day, same as the daily login reward
CATEGORIES = ("aptitude", "sql", "cpp", "mcq", "coding")
DIFFICULTIES = ("easy", "medium", "hard")
PAGE = 1000
TOPIC_WINDOW_DAYS = 90
RECENT_TESTS = 8
TREND_STEP = 5  # points between the recent and the earlier average before we call it a rise or a drop


# ---------------------------------------------------------------- calculations (no database)

def _stamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def ist_day(value: str | None) -> date | None:
    stamp = _stamp(value)
    return stamp.astimezone(IST).date() if stamp else None


def _day(value: str | date | None) -> date | None:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


def _mean(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


def topic_stats(sessions: Iterable[dict], now: datetime) -> list[dict]:
    """Per topic: how many tests were finished, the average score, and by difficulty. A test counts as given up when
    its time ran out without being submitted; tests still inside their time are not counted either way."""
    by_topic: dict[str, list[dict]] = {c: [] for c in CATEGORIES}
    for row in sessions:
        if row.get("category") in by_topic:
            by_topic[row["category"]].append(row)

    out = []
    for category in CATEGORIES:
        rows = by_topic[category]
        done = [r for r in rows if r.get("status") == "completed" and r.get("score_percent") is not None]
        gave_up = [r for r in rows if r.get("status") == "in_progress" and (_stamp(r.get("expires_at")) or now) <= now]
        finished = len(done) + len(gave_up)
        levels = {}
        for level in DIFFICULTIES:
            scores = [float(r["score_percent"]) for r in done if r.get("difficulty") == level]
            levels[level] = {"completed": len(scores), "avg_score": _mean(scores)}
        out.append({
            "category": category,
            "completed": len(done),
            "gave_up": len(gave_up),
            "avg_score": _mean([float(r["score_percent"]) for r in done]),
            "completion_rate": round(len(done) / finished * 100) if finished else None,
            "by_difficulty": levels,
        })
    return out


def participation(students: list[dict], practised: dict[str, set[date]], checked_in: dict[str, set[date]], today: date) -> dict:
    """Who practised (took a challenge or started a test) in the last 7 days, compared with the 7 days before."""
    this_week = {today - timedelta(days=i) for i in range(7)}
    last_week = {today - timedelta(days=i) for i in range(7, 14)}

    def active(days: dict[str, set[date]], student_id: str, window: set[date]) -> bool:
        return bool(days.get(student_id, set()) & window)

    def split(key: str) -> list[dict]:
        groups: dict[str, dict] = defaultdict(lambda: {"students": 0, "practised": 0})
        for s in students:
            label = str(s.get(key)) if s.get(key) is not None else "Unknown"
            groups[label]["students"] += 1
            groups[label]["practised"] += active(practised, s["student_id"], this_week)
        return [{"group": g, **v} for g, v in sorted(groups.items())]

    return {
        "total_students": len(students),
        "practised_this_week": sum(active(practised, s["student_id"], this_week) for s in students),
        "practised_last_week": sum(active(practised, s["student_id"], last_week) for s in students),
        "checked_in_this_week": sum(active(checked_in, s["student_id"], this_week) for s in students),
        "by_department": split("department"),
        "by_year": split("year"),
    }


def student_summary(logins: list[dict], attempts: list[dict], sessions: list[dict], today: date, now: datetime | None = None) -> dict:
    """One student's practice habit: streak, active days, and how their recent test scores are moving."""
    login_days = {d: int(r.get("streak_days") or 0) for r in logins if (d := _day(r.get("activity_date")))}
    attempt_days = {d for r in attempts if (d := _day(r.get("activity_date")))}
    session_days = {d for r in sessions if (d := ist_day(r.get("started_at")))}
    every_day = set(login_days) | attempt_days | session_days

    last_login = max(login_days, default=None)
    # a streak is still alive if they checked in today or yesterday (they can still extend it today)
    current_streak = login_days[last_login] if last_login and last_login >= today - timedelta(days=1) else 0
    window = {today - timedelta(days=i) for i in range(30)}

    completed = [r for r in sessions if r.get("status") == "completed" and r.get("score_percent") is not None]
    completed.sort(key=lambda r: _stamp(r.get("completed_at")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    recent = [{
        "date": (ist_day(r.get("completed_at")) or today).isoformat(),
        "category": r.get("category"), "difficulty": r.get("difficulty"), "mode": r.get("mode"),
        "score_percent": int(r["score_percent"]),
    } for r in completed[:RECENT_TESTS]]

    scores = [float(r["score_percent"]) for r in completed]
    trend = None
    if len(scores) >= 4:  # three recent tests against up to three before them
        recent_avg, earlier_avg = sum(scores[:3]) / 3, sum(scores[3:6]) / len(scores[3:6])
        diff = recent_avg - earlier_avg
        trend = "up" if diff >= TREND_STEP else "down" if diff <= -TREND_STEP else "steady"

    now = now or datetime.now(timezone.utc)
    gave_up = sum(1 for r in sessions if r.get("status") == "in_progress" and (_stamp(r.get("expires_at")) or now) <= now)
    return {
        "current_streak": current_streak,
        "best_streak": max(login_days.values(), default=0),
        "active_days_30": len(every_day & window),
        "last_active": max(every_day).isoformat() if every_day else None,
        "tests_completed": len(completed),
        "tests_gave_up": gave_up,
        "avg_score": _mean(scores[:RECENT_TESTS]),
        "trend": trend,
        "recent_tests": recent,
    }


# ---------------------------------------------------------------- database access

def _fetch_all(build: Callable[[int, int], object]) -> list[dict]:
    """Page through a Supabase query: `build(start, end)` returns the query limited to that row range."""
    rows: list[dict] = []
    start = 0
    while True:
        page = build(start, start + PAGE - 1).execute().data or []
        rows.extend(page)
        if len(page) < PAGE:
            return rows
        start += PAGE


def _unavailable() -> HTTPException:
    return HTTPException(503, "Practice data is not available right now")


def _is_mentee(faculty_id: str | None, student_id: str) -> bool:
    if not faculty_id:
        return False
    rows = (db().table("students").select("student_id").eq("student_id", student_id)
            .eq("mentor_faculty_id", faculty_id).limit(1).execute().data)
    return bool(rows)


def _student_exists(student_id: str) -> bool:
    return bool(db().table("students").select("student_id").eq("student_id", student_id).limit(1).execute().data)


def _day_sets(rows: list[dict], key: Callable[[dict], date | None]) -> dict[str, set[date]]:
    out: dict[str, set[date]] = defaultdict(set)
    for r in rows:
        d = key(r)
        if d and r.get("student_id"):
            out[r["student_id"]].add(d)
    return out


@router.get("/overview")
def overview(caller: Caller = Depends(require_role("admin"))):
    """Institution-wide: skill gaps by topic and who practised this week."""
    now = datetime.now(timezone.utc)
    today = now.astimezone(IST).date()
    since = (today - timedelta(days=13)).isoformat()
    topics_since = (now - timedelta(days=TOPIC_WINDOW_DAYS)).isoformat()
    t = db().table
    try:
        students = _fetch_all(lambda a, b: t("students").select("student_id,department,year").order("student_id").range(a, b))
        sessions = _fetch_all(lambda a, b: t("student_assessment_sessions")
                              .select("student_id,category,difficulty,status,score_percent,started_at,expires_at")
                              .gte("started_at", topics_since).order("started_at").range(a, b))
        attempts = _fetch_all(lambda a, b: t("student_daily_challenge_attempts")
                              .select("student_id,activity_date").gte("activity_date", since).order("id").range(a, b))
        logins = _fetch_all(lambda a, b: t("student_daily_logins")
                            .select("student_id,activity_date").gte("activity_date", since)
                            .order("activity_date").order("student_id").range(a, b))
    except Exception:
        raise _unavailable() from None

    practised = _day_sets(attempts, lambda r: _day(r.get("activity_date")))
    for student_id, days in _day_sets(sessions, lambda r: ist_day(r.get("started_at"))).items():
        practised[student_id] |= days
    checked_in = _day_sets(logins, lambda r: _day(r.get("activity_date")))
    return {
        "as_of": today.isoformat(),
        "topic_window_days": TOPIC_WINDOW_DAYS,
        "topics": topic_stats(sessions, now),
        "participation": participation(students, practised, checked_in, today),
    }


@router.get("/student/{student_id}")
def student(student_id: str, caller: Caller = Depends(require_role("faculty", "admin"))):
    """One student's practice habit. A mentor can only open their own mentees."""
    try:
        if caller.role == "faculty" and not _is_mentee(caller.faculty_id, student_id):
            raise HTTPException(403, "This student is not one of your mentees")
        if caller.role == "admin" and not _student_exists(student_id):
            raise HTTPException(404, "No student with that id")
        t = db().table
        since = (datetime.now(IST).date() - timedelta(days=29)).isoformat()
        logins = t("student_daily_logins").select("activity_date,streak_days").eq("student_id", student_id).execute().data or []
        attempts = t("student_daily_challenge_attempts").select("activity_date").eq("student_id", student_id).gte("activity_date", since).execute().data or []
        sessions = (t("student_assessment_sessions")
                    .select("category,difficulty,mode,status,score_percent,started_at,completed_at,expires_at")
                    .eq("student_id", student_id).order("started_at", desc=True).limit(200).execute().data or [])
    except HTTPException:
        raise
    except Exception:
        raise _unavailable() from None
    return {"student_id": student_id, **student_summary(logins, attempts, sessions, datetime.now(IST).date())}
