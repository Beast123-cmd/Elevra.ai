"""One-paragraph mentor brief for a student.

Gemini writes it from that student's profile only. The text must pass a fact check (every figure it quotes has to
come from the profile, no "will fail" framing, a length limit); otherwise, or if Gemini is unavailable, a
deterministic template built from the same profile is returned. The caller is told which one they got.
"""
from __future__ import annotations

import json
import re
import time

from fastapi import APIRouter, Depends, HTTPException

from common import settings
from common.auth import Caller, require_role
from common.db import db
from common.llm import LlmUnavailable, generate_json

router = APIRouter(prefix="/briefs", tags=["briefs"])

MAX_WORDS = 140
CACHE_TTL_S = 600
FORBIDDEN = ("will fail", "going to fail", "is doomed", "diagnos", "depress", "mental illness", "suicid")
# Never guess a student's gender from their name: use the name or "they".
PRONOUNS = re.compile(r"\b(he|she|his|hers|her|him|himself|herself)\b", re.IGNORECASE)
_cache: dict[tuple, tuple[float, dict]] = {}


# ---------- facts and the deterministic fallback ----------
def _drivers(risk: dict, n: int = 2) -> str:
    items = [f"{d['label']} ({d['value']})" for d in (risk.get("drivers") or [])[:n]]
    return "; ".join(items)


def template_brief(p: dict) -> str:
    name, band = p["name"], p["band"]
    parts = [f"{name} ({p['department']}, year {p['year']}) has a success score of {p['score']:.1f} ({band}) "
             f"with {p.get('confidence', 100)}% data confidence."]
    acad, place = p["academic_risk"], p["placement_risk"]
    if acad["level"] in ("Red", "Amber"):
        parts.append(f"Academic risk is {acad['level']}, mainly because of {_drivers(acad)}.")
    if place["level"] == "Not assessed":
        parts.append("Placement readiness is not yet assessed.")
    elif place["level"] in ("Red", "Amber"):
        parts.append(f"Placement risk is {place['level']}, mainly because of {_drivers(place)}.")
    if p.get("engagement_drop"):
        parts.append("LMS activity has dropped sharply in recent weeks, an early sign worth asking about.")
    if p.get("declining"):
        parts.append("The score has been declining over the last two semesters.")
    flagged = acad["level"] in ("Red", "Amber") or place["level"] in ("Red", "Amber") or p.get("engagement_drop")
    if not flagged:
        parts.append(f"No risk flags this week; {name} appears to be on track.")
    actions = (p.get("actions") or [])[:3]
    if actions:
        parts.append("Suggested next steps: " + "; ".join(a.rstrip(".") for a in actions) + ".")
    parts.append("Treat these flags as a prompt for a conversation, not a judgement.")
    return " ".join(parts)


def _numbers(value) -> list[float]:
    return [float(x) for x in re.findall(r"\d+(?:\.\d+)?", str(value))]


def allowed_numbers(p: dict) -> list[float]:
    """Every figure the brief may quote: anything that appears in the student's own profile."""
    out: list[float] = []
    for key in ("student_id", "year", "batch", "score", "confidence"):
        out += _numbers(p.get(key, ""))
    out += [v for v in (p.get("pillars") or {}).values() if isinstance(v, (int, float))]
    for risk in (p["academic_risk"], p["placement_risk"]):
        out.append(float(risk.get("points", 0)))
        for d in risk.get("drivers") or []:
            # values ("47.5%") and the thresholds written in the labels ("below 40", "(65%)") are both profile facts
            out += _numbers(d.get("value", "")) + _numbers(d.get("label", "")) + [float(d.get("points", 0))]
    for action in p.get("actions") or []:
        out += _numbers(action)
    prob = (p.get("model") or {}).get("prob")
    if isinstance(prob, (int, float)):
        out += [prob * 100, round(prob * 100)]
    for h in p.get("history") or []:
        out += [x for x in (h.get("score"), h.get("sgpa")) if isinstance(x, (int, float))]
    for v in (p.get("metrics") or {}).values():
        if isinstance(v, (int, float)):
            out += [float(v), float(v) * 100]
    return out


def is_grounded(text: str, allowed: list[float]) -> bool:
    low = text.lower()
    if len(text.split()) > MAX_WORDS or any(f in low for f in FORBIDDEN) or PRONOUNS.search(text):
        return False
    for m in re.finditer(r"(\d+(?:\.\d+)?)(\s*%|\s*(?:backlogs?|points?))?", text):
        value, suffix = float(m.group(1)), m.group(2)
        bare_small_int = "." not in m.group(1) and value <= 12 and not suffix
        if bare_small_int:
            continue  # counts and weeks ("two follow-ups", "weeks 6 to 8") are not facts worth policing
        if not any(abs(value - a) <= 0.6 for a in allowed):
            return False
    return True


# ---------- generation ----------
def _facts(p: dict) -> dict:
    def risk(r):
        return {"level": r["level"], "drivers": [{"label": d["label"], "value": d["value"]} for d in (r.get("drivers") or [])[:4]]}

    return {
        "name": p["name"], "department": p["department"], "year": p["year"], "success_score": p["score"], "band": p["band"],
        "data_confidence_percent": p.get("confidence"), "segment": p.get("segment"),
        "early_warning_lms_drop": bool(p.get("engagement_drop")), "score_declining": bool(p.get("declining")),
        "pillar_scores_0_to_100": {k: (None if v is None else round(v, 1)) for k, v in (p.get("pillars") or {}).items()},
        "academic_risk": risk(p["academic_risk"]), "placement_risk": risk(p["placement_risk"]),
        "model_probability_of_academic_difficulty_percent": round(((p.get("model") or {}).get("prob") or 0) * 100),
        "recent_scores": [h["score"] for h in (p.get("history") or [])][-3:],
        "suggested_actions": (p.get("actions") or [])[:4],
    }


def build_prompt(p: dict) -> str:
    return (
        "You write a short brief for a college faculty mentor about one student.\n"
        "Rules:\n"
        "- One paragraph, at most 110 words, plain language.\n"
        "- Use ONLY the facts in FACTS. Do not invent numbers, causes, events or personal circumstances.\n"
        "- Never predict that the student will fail, and never speculate about health or family. Say a flag means "
        "\"needs a check-in\".\n"
        "- Refer to the student by name or as \"they\". Never use he, she, his, her or him.\n"
        "- Say what stands out, why (the listed drivers), and end with one concrete way to open the conversation.\n"
        "- Respond as JSON: {\"brief\": \"...\"}\n\n"
        f"FACTS:\n{json.dumps(_facts(p), ensure_ascii=False)}"
    )


def make_brief(p: dict) -> dict:
    key = (p["student_id"], round(float(p["score"]), 1), settings.GEMINI_MODEL)
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_S:
        return hit[1]
    fallback = {"brief": template_brief(p), "source": "template"}
    allowed, text, reason = allowed_numbers(p), None, "AI returned nothing usable, showing the standard summary"
    for _ in range(2):  # one retry: the model's wording varies, so a bad first draft is often fixed by a second
        try:
            data = generate_json(build_prompt(p), max_tokens=400)
        except LlmUnavailable:
            return {**fallback, "reason": "AI unavailable, showing the standard summary"}
        draft = data.get("brief")
        if not isinstance(draft, str) or not draft.strip():
            reason = "AI returned nothing usable, showing the standard summary"
            continue
        if not is_grounded(draft, allowed):
            reason = "AI wording failed the fact check, showing the standard summary"
            continue
        text = draft
        break
    if text is None:
        return {**fallback, "reason": reason}
    result = {"brief": text.strip(), "source": "ai"}
    _cache[key] = (time.time(), result)
    return result


# ---------- route ----------
@router.post("/{student_id}")
def student_brief(student_id: str, caller: Caller = Depends(require_role("faculty", "admin"))):
    scored = db().table("scores").select("profile").eq("student_id", student_id).limit(1).execute().data
    if not scored:
        raise HTTPException(404, f"No scored student with id {student_id}")
    if caller.role == "faculty":
        mentor = db().table("students").select("mentor_faculty_id").eq("student_id", student_id).limit(1).execute().data
        if not mentor or mentor[0]["mentor_faculty_id"] != caller.faculty_id:
            raise HTTPException(403, "This student is not one of your mentees")
    return {"student_id": student_id, **make_brief(scored[0]["profile"])}
