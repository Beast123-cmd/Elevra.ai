"""Weekly brief for the dean: the numbers are computed here from the database; Gemini only words them.

Not a router: admin.py exposes it as GET /admin/weekly-brief. The text must pass a fact check (every figure has to be
one of the computed numbers, no "will fail" framing, a length limit). Otherwise, or if Gemini is unavailable, a
deterministic template built from the same numbers is returned, and the response says which one it is.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timedelta, timezone

from common.llm import LlmUnavailable, generate_json

SLA_DAYS = 7
MAX_WORDS = 130
FORBIDDEN = ("will fail", "going to fail", "is doomed", "diagnos", "depress", "mental illness", "suicid")


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def compute_stats(students: list[dict], scores: list[dict], interventions: list[dict], now: datetime | None = None) -> dict:
    """students: student_id, department; scores: student_id, academic_risk, placement_risk, segment;
    interventions: student_id, status, followup_date, created_at, is_seeded."""
    now = now or datetime.now(timezone.utc)
    dept = {s["student_id"]: s["department"] for s in students}
    red = [s for s in scores if s["student_id"] in dept and "Red" in (s["academic_risk"], s["placement_risk"])]
    red_ids = {s["student_id"] for s in red}

    live = [i for i in interventions if not i.get("is_seeded")]
    cutoff = now - timedelta(days=SLA_DAYS)
    contacted = {i["student_id"] for i in live if i["status"] != "planned" and _parse(i["created_at"]) >= cutoff}
    ever = {i["student_id"] for i in live if i["status"] != "planned"}
    today = now.date().isoformat()
    overdue = [i for i in live if i["status"] != "done" and i.get("followup_date") and i["followup_date"] < today]

    by_dept = Counter(dept[s["student_id"]] for s in red)
    by_seg = Counter(s["segment"] for s in red if s.get("segment"))
    reached = len(red_ids & contacted)
    return {
        "students": len(dept),
        "red_academic": sum(1 for s in scores if s["student_id"] in dept and s["academic_risk"] == "Red"),
        "red_placement": sum(1 for s in scores if s["student_id"] in dept and s["placement_risk"] == "Red"),
        "red_total": len(red_ids),
        "red_contacted_7d": reached,
        "red_contacted_pct": round(100 * reached / len(red_ids), 1) if red_ids else 0.0,
        "red_never_contacted": len(red_ids - ever),
        "overdue_followups": len(overdue),
        "support_logged_7d": sum(1 for i in live if _parse(i["created_at"]) >= cutoff),
        "top_departments": [{"department": d, "red": n} for d, n in by_dept.most_common(2)],
        "top_segments": [{"segment": s, "red": n} for s, n in by_seg.most_common(2)],
    }


def template_brief(st: dict) -> str:
    parts = [f"{st['red_total']} of {st['students']} students currently need a check-in "
             f"({st['red_academic']} on academics, {st['red_placement']} on placement readiness)."]
    if st["red_total"]:
        parts.append(f"{st['red_contacted_7d']} of them ({st['red_contacted_pct']}%) were contacted in the last {SLA_DAYS} days; "
                     f"{st['red_never_contacted']} have not been contacted yet.")
    if st["overdue_followups"]:
        parts.append(f"{st['overdue_followups']} follow-ups are overdue.")
    if st["top_departments"]:
        top = st["top_departments"][0]
        parts.append(f"{top['department']} has the most students needing a check-in ({top['red']}).")
    parts.append(f"Mentors logged {st['support_logged_7d']} support actions this week.")
    parts.append("Suggested focus: reach the students who have not been contacted, starting with the busiest departments.")
    return " ".join(parts)


def _numbers(value) -> list[float]:
    return [float(x) for x in re.findall(r"\d+(?:\.\d+)?", str(value))]


def is_grounded(text: str, st: dict) -> bool:
    low = text.lower()
    if len(text.split()) > MAX_WORDS or any(f in low for f in FORBIDDEN):
        return False
    allowed = _numbers(json.dumps(st)) + [float(SLA_DAYS)]
    for m in re.finditer(r"\d+(?:\.\d+)?", text):
        v = float(m.group(0))
        if "." not in m.group(0) and v <= 3:
            continue  # "two departments", "top 2" are not facts worth policing
        if not any(abs(v - a) <= 0.06 for a in allowed):
            return False
    return True


def prompt(st: dict) -> str:
    return (
        "You write a short weekly summary for a college dean about student support.\n"
        "Rules:\n"
        "- One paragraph, at most 100 words, plain language, calm tone.\n"
        "- Use ONLY the numbers in FACTS and copy them exactly. Do not invent numbers, causes or events.\n"
        "- Say \"needs a check-in\" for flagged students; never predict that anyone will fail.\n"
        "- Say what changed or stands out, then end with one concrete priority for the week.\n"
        "- Respond as JSON: {\"brief\": \"...\"}\n\n"
        f"FACTS:\n{json.dumps(st, ensure_ascii=False)}"
    )


def make_brief(st: dict) -> dict:
    fallback = {"brief": template_brief(st), "source": "template"}
    reason = "AI returned nothing usable, showing the standard summary"
    for _ in range(2):
        try:
            data = generate_json(prompt(st), max_tokens=400)
        except LlmUnavailable:
            return {**fallback, "reason": "AI unavailable, showing the standard summary"}
        draft = data.get("brief")
        if not isinstance(draft, str) or not draft.strip():
            continue
        if not is_grounded(draft, st):
            reason = "AI wording failed the fact check, showing the standard summary"
            continue
        return {"brief": draft.strip(), "source": "ai"}
    return {**fallback, "reason": reason}
