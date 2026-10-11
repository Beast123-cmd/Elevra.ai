"""Single source of truth for student scores and transparent risk rules."""
from __future__ import annotations

import math
from collections.abc import Mapping

PILLARS = ("academic", "attendance", "lms", "placement", "skills", "engagement", "feedback")
WEIGHTS = {
    "academic": 0.25, "attendance": 0.15, "lms": 0.10, "placement": 0.20,
    "skills": 0.15, "engagement": 0.05, "feedback": 0.10,
}
BANDS = ((75.0, "Thriving"), (60.0, "On Track"), (45.0, "Needs Attention"), (0.0, "Critical"))


def _number(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return result if math.isfinite(result) else None


def _weighted_mean(parts: list[tuple[float | None, float]]) -> float | None:
    present = [(value, weight) for value, weight in parts if value is not None and weight > 0]
    total = sum(weight for _, weight in present)
    return None if total <= 0 else sum(value * weight for value, weight in present) / total


def _clip(value: float | None, low: float = 0.0, high: float = 100.0) -> float | None:
    return None if value is None else min(high, max(low, value))


def band_for(score: float) -> str:
    return next((label for threshold, label in BANDS if score >= threshold), BANDS[-1][1])


def pillars_from_metrics(metrics: Mapping[str, object]) -> dict[str, float | None]:
    get = lambda key: _number(metrics.get(key))
    cgpa, backlogs = get("cgpa"), get("backlogs")
    academic = _weighted_mean([(None if cgpa is None else cgpa * 10, 0.6), (get("internal_pct"), 0.4)])
    if academic is not None:
        academic -= 5 * (backlogs or 0)

    minutes = get("avg_minutes")
    lms = _weighted_mean([
        (get("submit_rate"), 0.5), (get("login_consistency"), 0.3),
        (None if minutes is None else min(max(minutes, 0) / 100, 1), 0.2),
    ])
    mock = get("mock")
    placement = _weighted_mean([
        (get("aptitude"), 0.35), (get("coding"), 0.40),
        (None if mock is None else mock / 5 * 100, 0.25),
    ])
    skills = _weighted_mean([
        (get("tech_skill"), 0.5), (get("soft_skill"), 0.3),
        (min(100.0, max(0.0, 25 * (get("certifications") or 0))), 0.2),
    ])
    satisfaction, faculty_rating = get("satisfaction"), get("faculty_rating")
    feedback = _weighted_mean([
        (None if satisfaction is None else (satisfaction - 1) / 4 * 100, 0.5),
        (None if faculty_rating is None else (faculty_rating - 1) / 4 * 100, 0.5),
    ])
    events, clubs, hackathons = (get(key) or 0 for key in ("events", "clubs", "hackathons"))
    engagement = min(100.0, max(0.0, 10 * events + 15 * clubs + 20 * hackathons))
    return {
        "academic": _clip(academic), "attendance": _clip(get("attendance_pct")),
        "lms": _clip(None if lms is None else lms * 100),
        "placement": _clip(placement), "skills": _clip(skills),
        "engagement": _clip(engagement), "feedback": _clip(feedback),
    }


def success_score(pillars: Mapping[str, object], weights: Mapping[str, object] = WEIGHTS) -> dict:
    clean_weights = {
        key: max(0.0, _number(weights.get(key)) or 0.0)
        for key in PILLARS
    }
    if sum(clean_weights.values()) <= 0:
        clean_weights = dict(WEIGHTS)
    present = {
        key: value for key, raw in pillars.items()
        if key in clean_weights and (value := _number(raw)) is not None and clean_weights[key] > 0
    }
    denominator = sum(clean_weights[key] for key in present)
    if denominator <= 0:
        # Keep an explicit neutral score for an entirely missing profile; confidence remains zero.
        return {"score": 0.0, "band": "Critical", "confidence": 0, "missing": list(PILLARS)}
    score = round(sum(clean_weights[key] * value for key, value in present.items()) / denominator, 1)
    confidence = round(100 * denominator / sum(clean_weights.values()))
    return {"score": score, "band": band_for(score), "confidence": confidence,
            "missing": [key for key in PILLARS if key not in present]}


def _driver(label: str, value: str, points: int) -> dict:
    return {"label": label, "value": value, "points": points}


def _risk(drivers: list[dict], hard_floor: bool = False) -> dict:
    points = sum(item["points"] for item in drivers)
    level = "Red" if hard_floor or points >= 6 else "Amber" if points >= 3 else "Green"
    ordered = sorted(drivers, key=lambda item: (-item["points"], item["label"]))
    if not ordered:
        ordered = [_driver("No elevated risk indicators", "Within current thresholds", 0)]
    return {"level": level, "points": points, "drivers": ordered}


def academic_risk(metrics: Mapping[str, object], probability: float = 0.0) -> dict:
    get = lambda key: _number(metrics.get(key))
    attendance, backlogs = get("attendance_pct"), get("backlogs") or 0
    cgpa, internal, submission = get("cgpa"), get("internal_pct"), get("submit_rate")
    drivers, hard = [], False
    if attendance is not None and attendance < 65:
        drivers.append(_driver("Attendance below detention line (65%)", f"{attendance:.1f}%", 4)); hard = True
    elif attendance is not None and attendance < 75:
        drivers.append(_driver("Attendance below 75% mandate", f"{attendance:.1f}%", 2))
    if backlogs >= 3:
        drivers.append(_driver("3+ active backlogs", f"{backlogs:.0f}", 4)); hard = True
    elif backlogs >= 1:
        drivers.append(_driver("Active backlogs", f"{backlogs:.0f}", 2))
    if cgpa is not None and cgpa < 6:
        drivers.append(_driver("CGPA below 6.0", f"{cgpa:.2f}", 2))
    if internal is not None and internal < 50:
        drivers.append(_driver("Internal marks below 50%", f"{internal:.1f}%", 2))
    if submission is not None and submission < 0.6:
        drivers.append(_driver("Assignment submission below 60%", f"{submission * 100:.1f}%", 1))
    if (_number(metrics.get("engagement_drop")) or 0) >= 1:
        trend = (_number(metrics.get("login_trend")) or 0) * 100
        drivers.append(_driver("LMS activity dropped sharply (weeks 6–8 vs 1–4)", f"{trend:+.1f}%", 2))
    if probability >= 0.6:
        drivers.append(_driver("Early-warning model: elevated probability of academic difficulty", f"{probability * 100:.1f}%", 3))
    elif probability >= 0.35:
        drivers.append(_driver("Early-warning model: moderate probability of academic difficulty", f"{probability * 100:.1f}%", 1))
    return _risk(drivers, hard)


def placement_risk(metrics: Mapping[str, object], placement_score: float | None) -> dict:
    if placement_score is None:
        return {"level": "Not assessed", "points": 0, "drivers": []}
    get = lambda key: _number(metrics.get(key))
    drivers = []
    if placement_score < 50:
        drivers.append(_driver("Placement readiness below 50", f"{placement_score:.1f}", 3))
    coding, aptitude, mock = get("coding"), get("aptitude"), get("mock")
    if coding is not None and coding < 40:
        drivers.append(_driver("Coding score below 40", f"{coding:.1f}", 2))
    if aptitude is not None and aptitude < 40:
        drivers.append(_driver("Aptitude score below 40", f"{aptitude:.1f}", 2))
    if mock is None or mock <= 2:
        drivers.append(_driver("Weak or no mock interview", "none taken" if mock is None else f"{mock:.1f}/5", 1))
    if (get("hackathons") or 0) + (get("certifications") or 0) == 0:
        drivers.append(_driver("No verified hackathons or certifications", "0", 1))
    skill = get("tech_skill")
    if skill is not None and skill < 50:
        drivers.append(_driver("Technical skill below 50", f"{skill:.1f}", 1))
    if (get("backlogs") or 0) >= 1:
        drivers.append(_driver("Active backlog may limit campus drive eligibility", f"{get('backlogs'):.0f}", 2))
    return _risk(drivers)


def evaluate(metrics: Mapping[str, object], weights: Mapping[str, object] = WEIGHTS,
             card: Mapping[str, object] | None = None) -> dict:
    pillars = pillars_from_metrics(metrics)
    score = success_score(pillars, weights)
    # Model inference is deliberately optional until a trained, validated model card is supplied.
    probability, factors = 0.0, []
    if card and card.get("features") and card.get("algorithm", "logistic_regression") == "logistic_regression":
        z = _number(card.get("intercept")) or 0.0
        for feature in card["features"]:
            value = _number(metrics.get(feature.get("source", feature.get("name", ""))))
            mean, std = _number(feature.get("mean")), _number(feature.get("std"))
            effect = 0.0 if value is None or mean is None or not std else (_number(feature.get("coef")) or 0.0) * (value - mean) / std
            z += effect
            factors.append({"feature": feature.get("name", ""), "label": feature.get("label", ""), "effect": round(effect, 3)})
        z = min(35.0, max(-35.0, z))
        probability = 1 / (1 + math.exp(-z))
        factors.sort(key=lambda row: -abs(row["effect"]))
        factors = factors[:3]
    elif card and card.get("features") and card.get("algorithm") in {"decision_tree", "random_forest"}:
        feature_values = []
        for feature in card["features"]:
            value = _number(metrics.get(feature.get("source", feature.get("name", ""))))
            feature_values.append(value if value is not None else (_number(feature.get("mean")) or 0.0))
        trees = card.get("trees", []) if card.get("algorithm") == "random_forest" else [card.get("tree", {})]
        effects = {}
        labels = {}
        probabilities = []
        for tree in trees:
            node = tree
            while node and not node.get("leaf"):
                index = node.get("feature")
                if not isinstance(index, int) or index < 0 or index >= len(card["features"]):
                    break
                feature = card["features"][index]
                left = feature_values[index] <= float(node["threshold"])
                child = node["left"] if left else node["right"]
                effect = float(child["prob"]) - float(node["prob"])
                name = str(feature.get("name", index))
                effects[name] = effects.get(name, 0.0) + effect / max(1, len(trees))
                labels[name] = (f"{feature.get('label', name)} {'≤' if left else '>'} "
                                f"{float(node['threshold']):.2f}")
                node = child
            if node:
                probabilities.append(float(node["prob"]))
        probability = sum(probabilities) / len(probabilities) if probabilities else 0.0
        factors = [{"feature": name, "label": labels[name], "effect": round(effect, 3)}
                   for name, effect in sorted(effects.items(), key=lambda item: -abs(item[1]))[:3]]
    academic = academic_risk(metrics, probability)
    placement = placement_risk(metrics, pillars["placement"])
    attendance_drop = _number(metrics.get("attendance_drop_pp")) or 0.0
    silent = (_number(metrics.get("engagement_drop")) or 0) >= 1 or attendance_drop >= 10
    if silent:
        segment = "Silent disengagers"
    elif (pillars["academic"] or -1) >= 75 and pillars["placement"] is not None and pillars["placement"] < 55:
        segment = "Academic stars, placement unready"
    elif (pillars["engagement"] or -1) >= 60 and (pillars["academic"] or -1) < 55:
        segment = "Engaged but struggling"
    elif pillars["skills"] is not None and pillars["skills"] >= 70 and pillars["attendance"] is not None and pillars["attendance"] < 75:
        segment = "Skilled but irregular"
    elif score["score"] >= 75 and pillars["placement"] is not None and pillars["placement"] >= 70:
        segment = "Placement-ready all-rounders"
    else:
        segment = "Steady middle"
    return {
        **score, "pillars": pillars, "academic_risk": academic, "placement_risk": placement,
        "model": {"prob": round(probability, 3), "factors": factors}, "segment": segment,
        "priority": round(academic["points"] + 0.6 * placement["points"] + max(0, 60 - score["score"]) / 10
                          + 2 * int(silent), 1),
    }
