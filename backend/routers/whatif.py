"""What-if simulation and cohort re-scoring using the shared scoring engine."""
from __future__ import annotations

import math
from collections.abc import Mapping

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from common.auth import Caller, require_role
from common.db import db
from scoring.engine import WEIGHTS, evaluate

router = APIRouter(tags=["scoring"])

OVERRIDE_BOUNDS = {
    "attendance_pct": (0.0, 100.0),
    "coding": (0.0, 100.0),
    "aptitude": (0.0, 100.0),
    "mock": (1.0, 5.0),
    "internal_pct": (0.0, 100.0),
    "submit_rate": (0.0, 1.0),
}
COUNT_OVERRIDES = {"certifications", "hackathons"}
ALLOWED_OVERRIDES = frozenset(OVERRIDE_BOUNDS) | COUNT_OVERRIDES
RESCORE_PAGE_SIZE = 500


class WhatIf(BaseModel):
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(pattern=r"^\d{5}$")
    overrides: dict[str, float] = Field(default_factory=dict)

    @field_validator("overrides", mode="before")
    @classmethod
    def validate_overrides(cls, raw: object) -> dict[str, float]:
        if not isinstance(raw, dict):
            raise ValueError("overrides must be an object")
        unknown = set(raw) - ALLOWED_OVERRIDES
        if unknown:
            raise ValueError(f"Unsupported override(s): {', '.join(sorted(unknown))}")
        values: dict[str, float] = {}
        for key, value in raw.items():
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"{key} must be a number")
            number = float(value)
            if not math.isfinite(number):
                raise ValueError(f"{key} must be finite")
            bounds = OVERRIDE_BOUNDS.get(key)
            if bounds and not bounds[0] <= number <= bounds[1]:
                raise ValueError(f"{key} must be between {bounds[0]} and {bounds[1]}")
            if key in COUNT_OVERRIDES and number < 0:
                raise ValueError(f"{key} cannot be negative")
            values[key] = number
        return values


class Rescore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    weights: dict[str, float]

    @field_validator("weights", mode="before")
    @classmethod
    def validate_weights(cls, raw: object) -> dict[str, float]:
        if not isinstance(raw, dict) or not raw:
            raise ValueError("weights must be a non-empty object")
        unknown = set(raw) - set(WEIGHTS)
        if unknown:
            raise ValueError(f"Unsupported weight(s): {', '.join(sorted(unknown))}")
        values: dict[str, float] = {}
        for key, value in raw.items():
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"{key} must be a number")
            number = float(value)
            if not math.isfinite(number) or not 0 <= number <= 1:
                raise ValueError(f"{key} must be between 0 and 1")
            values[key] = number
        if not any(values.values()):
            raise ValueError("At least one weight must be greater than zero")
        return values


def _student_profile(student_id: str) -> Mapping:
    try:
        response = (db().table("scores").select("profile")
                    .eq("student_id", student_id).limit(1).execute())
    except Exception:
        raise HTTPException(503, "Student scoring data is temporarily unavailable") from None
    rows = response.data or []
    if not rows:
        raise HTTPException(404, "Student score was not found")
    profile = rows[0].get("profile")
    if not isinstance(profile, Mapping) or not isinstance(profile.get("metrics"), Mapping):
        raise HTTPException(503, "Student scoring data is incomplete")
    return profile


def _model_card() -> Mapping | None:
    try:
        response = (db().table("analytics").select("payload")
                    .eq("key", "model").limit(1).execute())
    except Exception:
        # The shared engine supports a rules-only fallback when no trained card is available.
        return None
    rows = response.data or []
    if not rows:
        return None
    card = rows[0].get("payload")
    return card if isinstance(card, Mapping) and card.get("features") else None


def _score_result(result: Mapping, previous_score: object) -> dict:
    try:
        original = float(previous_score)
        score = float(result["score"])
        if not math.isfinite(original) or not math.isfinite(score):
            raise ValueError("non-finite score")
        return {
            "score": score,
            "band": result["band"],
            "pillars": result["pillars"],
            "academic_risk": result["academic_risk"],
            "placement_risk": result["placement_risk"],
            "delta": round(score - original, 1),
        }
    except (KeyError, TypeError, ValueError, OverflowError):
        raise HTTPException(503, "Student scoring data is incomplete") from None


@router.post("/whatif")
def whatif(body: WhatIf, caller: Caller = Depends(require_role("admin", "faculty", "student"))):
    if caller.role == "student" and caller.student_id != body.student_id:
        raise HTTPException(403, "Students can only simulate their own score")

    profile = _student_profile(body.student_id)
    metrics = {**profile["metrics"], **body.overrides}
    try:
        result = evaluate(metrics, card=_model_card())
    except (TypeError, ValueError, OverflowError):
        raise HTTPException(503, "Student scoring data could not be evaluated") from None
    return _score_result(result, profile.get("score"))


@router.post("/rescore")
def rescore(body: Rescore, caller: Caller = Depends(require_role("admin", "faculty"))):
    weights = {**WEIGHTS, **body.weights}
    try:
        client = db()
        results = []
        offset = 0
        while True:
            response = (client.table("scores").select("student_id,profile")
                        .order("student_id").range(offset, offset + RESCORE_PAGE_SIZE - 1).execute())
            rows = response.data or []
            if not rows:
                break
            for row in rows:
                profile = row.get("profile")
                metrics = profile.get("metrics") if isinstance(profile, Mapping) else None
                if not isinstance(metrics, Mapping) or not row.get("student_id"):
                    raise HTTPException(503, "Cohort scoring data is incomplete")
                result = evaluate(metrics, weights=weights)
                results.append({"student_id": row["student_id"],
                                "score": result["score"], "band": result["band"]})
            offset += len(rows)
            if len(rows) < RESCORE_PAGE_SIZE:
                break
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Cohort scoring data is temporarily unavailable") from None
    return results
