"""Deterministic, dependency-free early-warning model training and evaluation."""
from __future__ import annotations

import hashlib
import math
from collections import defaultdict
FEATURES = (
    ("cgpa", "Prior CGPA"), ("backlogs", "Prior backlogs"),
    ("attendance_pct", "Attendance (weeks 1–8)"), ("submit_rate", "Assignment submission rate"),
    ("login_consistency", "LMS active-week consistency"), ("login_trend", "LMS login trend"),
    ("internal_pct", "Internal marks (%)"),
)


def _mean(values):
    values = [float(v) for v in values if v is not None and math.isfinite(float(v))]
    return sum(values) / len(values) if values else None


def _grade(total):
    for threshold, grade in ((90, 10), (80, 9), (70, 8), (60, 7), (50, 6), (45, 5), (40, 4)):
        if total >= threshold:
            return grade
    return 0


def historical_examples(clean: dict) -> list[dict]:
    """Build one student-level example: target-semester weeks 1–8 -> that semester's exam result."""
    academics, attendance, lms = (defaultdict(list) for _ in range(3))
    for row in clean["academic"]:
        academics[row["student_id"]].append(row)
    for row in clean["attendance"]:
        attendance[row["student_id"]].append(row)
    for row in clean["lms"]:
        lms[row["student_id"]].append(row)
    examples = []
    for student in clean["students"]:
        sid = student["student_id"]
        target_sem = 2 * int(student["year"]) - 2
        target_rows = [r for r in academics[sid] if r["semester"] == target_sem]
        outcomes = [(r["internal_marks"] or 0) + (r["external_marks"] or 0)
                    for r in target_rows if r["external_marks"] is not None]
        if not outcomes:
            continue
        prior_rows = [r for r in academics[sid] if r["semester"] < target_sem and
                      r["internal_marks"] is not None and r["external_marks"] is not None]
        prior_totals = [r["internal_marks"] + r["external_marks"] for r in prior_rows]
        if not prior_totals:
            continue
        weeks = [r for r in attendance[sid] if r["semester"] == target_sem and 1 <= r["week"] <= 8]
        lms_weeks = sorted((r for r in lms[sid] if r["semester"] == target_sem and 1 <= r["week"] <= 8),
                           key=lambda r: r["week"])
        held, attended = sum(r["held"] for r in weeks), sum(r["attended"] for r in weeks)
        due = sum(r["assignments_due"] for r in lms_weeks)
        if not held or not due or len(lms_weeks) < 6:
            continue
        early = _mean([r["logins"] for r in lms_weeks if r["week"] <= 4]) or 0
        late = _mean([r["logins"] for r in lms_weeks if r["week"] >= 6]) or 0
        internal = _mean([r["internal_marks"] for r in target_rows if r["internal_marks"] is not None])
        if internal is None:
            continue
        examples.append({"student_id": sid, "features": {
            "cgpa": _mean([_grade(v) for v in prior_totals]),
            "backlogs": sum(v < 40 for v in prior_totals),
            "attendance_pct": 100 * attended / held,
            "submit_rate": sum(r["assignments_submitted"] for r in lms_weeks) / due,
            "login_consistency": sum(r["logins"] > 0 for r in lms_weeks) / len(lms_weeks),
            "login_trend": (late - early) / (early + 1),
            "internal_pct": 100 * internal / 40,
        }, "label": int(any(v < 40 for v in outcomes) or any(r.get("absent") for r in target_rows))})
    return examples


def _sigmoid(z):
    z = max(-35.0, min(35.0, z))
    return 1 / (1 + math.exp(-z))


def _auc(labels, scores):
    positives, negatives = sum(labels), len(labels) - sum(labels)
    if not positives or not negatives:
        return 0.5
    ordered = sorted(zip(scores, labels))
    rank_sum, index = 0.0, 0
    while index < len(ordered):
        end = index + 1
        while end < len(ordered) and ordered[end][0] == ordered[index][0]:
            end += 1
        rank_sum += ((index + 1 + end) / 2) * sum(label for _, label in ordered[index:end])
        index = end
    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def _fit(rows, iterations=1400, learning_rate=0.08, regularization=0.02):
    means = [_mean([row[i] for row in rows]) or 0.0 for i in range(len(FEATURES))]
    stds = []
    for i, mean in enumerate(means):
        std = math.sqrt(_mean([(row[i] - mean) ** 2 for row in rows]) or 0)
        stds.append(std if std > 1e-9 else 1.0)
    x = [[(row[i] - means[i]) / stds[i] for i in range(len(FEATURES))] for row in rows]
    y = [row[-1] for row in rows]
    coef, intercept = [0.0] * len(FEATURES), 0.0
    for step in range(iterations):
        grad = [0.0] * len(coef)
        bias_grad = 0.0
        for vector, label in zip(x, y):
            error = _sigmoid(intercept + sum(a * b for a, b in zip(coef, vector))) - label
            bias_grad += error
            for j, value in enumerate(vector):
                grad[j] += error * value
        rate = learning_rate / (1 + step / 700)
        intercept -= rate * bias_grad / len(y)
        coef = [w - rate * (grad[j] / len(y) + regularization * w) for j, w in enumerate(coef)]
    return means, stds, coef, intercept


def _metrics(labels, probabilities, threshold):
    predicted = [p >= threshold for p in probabilities]
    tp = sum(p and y for p, y in zip(predicted, labels))
    fp = sum(p and not y for p, y in zip(predicted, labels))
    fn = sum(not p and y for p, y in zip(predicted, labels))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {"auc": _auc(labels, probabilities), "precision": precision, "recall": recall,
            "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0}


def train_model(clean: dict) -> dict:
    examples = historical_examples(clean)
    if len(examples) < 40 or len({row["label"] for row in examples}) < 2:
        raise ValueError(f"Insufficient labeled historical examples for a reliable holdout: {len(examples)}")
    train, test = [], []
    for example in examples:
        bucket = int.from_bytes(hashlib.sha256(example["student_id"].encode()).digest()[:4], "big") % 10
        (test if bucket < 3 else train).append(example)
    if not train or not test or len({row["label"] for row in train}) < 2 or len({row["label"] for row in test}) < 2:
        raise ValueError("Deterministic student holdout must contain both outcome classes")
    matrix = [[row["features"][name] for name, _ in FEATURES] + [row["label"]] for row in train]
    means, stds, coef, intercept = _fit(matrix)
    def probability(example):
        vector = example["features"]
        return _sigmoid(intercept + sum(coef[i] * (vector[name] - means[i]) / stds[i]
                                        for i, (name, _) in enumerate(FEATURES)))
    labels = [row["label"] for row in test]
    probs = [probability(row) for row in test]
    threshold = 0.5
    metrics = _metrics(labels, probs, threshold)
    baseline_scores = [6.5 - row["features"]["cgpa"] for row in test]
    baseline = _metrics(labels, [_sigmoid(v) for v in baseline_scores], 0.5)
    # Five deterministic folds are evaluated within the training partition.
    fold_aucs = []
    for fold in range(5):
        fit_rows = [row for row in train if int.from_bytes(hashlib.sha256(row["student_id"].encode()).digest()[4:8], "big") % 5 != fold]
        val_rows = [row for row in train if int.from_bytes(hashlib.sha256(row["student_id"].encode()).digest()[4:8], "big") % 5 == fold]
        if not fit_rows or not val_rows or len({r["label"] for r in fit_rows}) < 2 or len({r["label"] for r in val_rows}) < 2:
            continue
        fm, fs, fc, fi = _fit([[r["features"][name] for name, _ in FEATURES] + [r["label"]] for r in fit_rows])
        fold_probs = [_sigmoid(fi + sum(fc[i] * (r["features"][name] - fm[i]) / fs[i]
                                        for i, (name, _) in enumerate(FEATURES))) for r in val_rows]
        fold_aucs.append(_auc([r["label"] for r in val_rows], fold_probs))
    card_features = [{"name": name, "source": name, "label": label, "coef": coef[i], "mean": means[i], "std": stds[i]}
                     for i, (name, label) in enumerate(FEATURES)]
    card_metrics = {"target": "Failed at least one subject based on observed final exam marks (synthetic cohort)",
        "train_window": "Previous completed semester, weeks 1–8 and internal marks -> same semester exam result",
        "n_train": len(train), "n_test": len(test), "base_rate": sum(labels) / len(labels), "threshold": threshold,
        **metrics, "cv_auc": _mean(fold_aucs) or 0.5,
        "baseline": {"rule": "Prior CGPA < 6.5", **baseline}}
    return {"features": card_features, "intercept": intercept, "metrics": card_metrics,
            "fairness": [], "provenance": "Synthetic data only; metrics are not evidence of real-world predictive performance."}
