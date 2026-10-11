"""Deterministic, dependency-free early-warning model training and evaluation."""
from __future__ import annotations

import hashlib
import math
import random
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
        attendance_by_week = defaultdict(lambda: [0, 0])
        for row in weeks:
            attendance_by_week[row["week"]][0] += row["attended"]
            attendance_by_week[row["week"]][1] += row["held"]
        lms_by_week = {row["week"]: row for row in lms_weeks}
        weekly = []
        for week in range(1, 9):
            attended_week, held_week = attendance_by_week[week]
            lms_row = lms_by_week.get(week)
            weekly.append({"week": week, "logins": lms_row["logins"] if lms_row else None,
                           "attendance": 100 * attended_week / held_week if held_week else None})
        examples.append({"student_id": sid, "residence": student.get("residence"), "gender": student.get("gender"),
            "weekly": weekly, "features": {
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
    tn = len(labels) - tp - fp - fn
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {"auc": _auc(labels, probabilities), "precision": precision, "recall": recall,
            "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
            "pr_auc": _pr_auc(labels, probabilities),
            "brier": _mean([(prob - label) ** 2 for label, prob in zip(labels, probabilities)]) or 0.0,
            "threshold": threshold, "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn}}


def _pr_auc(labels, probabilities):
    positives = sum(labels)
    if not positives:
        return 0.0
    ordered = sorted(zip(probabilities, labels), reverse=True)
    true_positive = false_positive = previous_recall = area = 0
    index = 0
    while index < len(ordered):
        score = ordered[index][0]
        end = index
        while end < len(ordered) and ordered[end][0] == score:
            if ordered[end][1]:
                true_positive += 1
            else:
                false_positive += 1
            end += 1
        recall = true_positive / positives
        precision = true_positive / max(1, true_positive + false_positive)
        area += (recall - previous_recall) * precision
        previous_recall = recall
        index = end
    return area


def _gini(labels):
    if not labels:
        return 0.0
    rate = sum(labels) / len(labels)
    return 2 * rate * (1 - rate)


def _fit_tree(rows, max_depth=3, min_leaf=20, max_features=None, seed=0):
    """Fit a small CART classifier using deterministic Gini split selection."""
    feature_count = len(FEATURES)
    max_features = max_features or feature_count
    rng = random.Random(seed)
    nodes_created = 0

    def grow(members, depth):
        nonlocal nodes_created
        nodes_created += 1
        labels = [member[-1] for member in members]
        positive_rate = sum(labels) / len(labels)
        positive_total = sum(labels)
        node = {"prob": positive_rate, "n": len(members)}
        if depth >= max_depth or len(members) < min_leaf * 2 or positive_rate in (0.0, 1.0):
            return {**node, "leaf": True}
        features = list(range(feature_count))
        if max_features < feature_count:
            features = sorted(rng.sample(features, max_features))
        parent_impurity = _gini(labels)
        best = None
        for feature in features:
            ordered = sorted((member[feature], member[-1]) for member in members)
            left_positive = left_count = 0
            for split_index in range(1, len(ordered)):
                value, label = ordered[split_index - 1]
                left_count += 1
                left_positive += label
                right_count = len(ordered) - split_index
                if left_count < min_leaf or right_count < min_leaf or value == ordered[split_index][0]:
                    continue
                right_positive = positive_total - left_positive
                weighted_impurity = (2 * left_positive * (left_count - left_positive) / left_count
                    + 2 * right_positive * (right_count - right_positive) / right_count) / len(members)
                gain = parent_impurity - weighted_impurity
                threshold = (value + ordered[split_index][0]) / 2
                candidate = (gain, -feature, -threshold, feature, threshold)
                if best is None or candidate > best:
                    best = candidate
        if best is None or best[0] <= 1e-12:
            return {**node, "leaf": True}
        feature, threshold = best[3], best[4]
        left_rows = [member for member in members if member[feature] <= threshold]
        right_rows = [member for member in members if member[feature] > threshold]
        if not left_rows or not right_rows:
            return {**node, "leaf": True}
        return {**node, "leaf": False, "feature": feature, "threshold": threshold,
                "left": grow(left_rows, depth + 1), "right": grow(right_rows, depth + 1)}

    return grow(rows, 0), nodes_created


def _tree_probability(tree, features):
    node = tree
    while not node["leaf"]:
        node = node["left"] if features[node["feature"]] <= node["threshold"] else node["right"]
    return node["prob"]


def _fit_candidate(name, examples, seed=0):
    rows = [[example["features"][feature] for feature, _ in FEATURES] + [example["label"]]
            for example in examples]
    if name == "logistic_regression":
        means, stds, coef, intercept = _fit(rows)
        def predict(example):
            return _sigmoid(intercept + sum(coef[i] * (example["features"][feature] - means[i]) / stds[i]
                                            for i, (feature, _) in enumerate(FEATURES)))
        return predict, {"means": means, "stds": stds, "coef": coef, "intercept": intercept}
    if name == "decision_tree":
        tree, nodes = _fit_tree(rows, max_depth=3, min_leaf=max(8, len(rows) // 50), seed=seed)
        return lambda example: _tree_probability(tree, [example["features"][feature] for feature, _ in FEATURES]), {"tree": tree, "nodes": nodes}
    if name == "random_forest":
        forest = []
        tree_count = 25
        rng = random.Random(seed)
        for index in range(tree_count):
            bootstrap = [rows[rng.randrange(len(rows))] for _ in rows]
            tree, _ = _fit_tree(bootstrap, max_depth=4, min_leaf=max(8, len(rows) // 60),
                                max_features=math.ceil(math.sqrt(len(FEATURES))), seed=seed + index)
            forest.append(tree)
        def predict(example):
            features = [example["features"][feature] for feature, _ in FEATURES]
            return sum(_tree_probability(tree, features) for tree in forest) / len(forest)
        return predict, {"trees": forest, "tree_count": tree_count}
    raise ValueError(f"Unsupported model candidate: {name}")


def _stratified_holdout(examples, test_fraction=0.30):
    grouped = defaultdict(list)
    for example in examples:
        grouped[example["label"]].append(example)
    train, test = [], []
    for label, members in grouped.items():
        ordered = sorted(members, key=lambda row: hashlib.sha256(f"holdout:{row['student_id']}".encode()).digest())
        test_count = min(len(ordered) - 1, max(1, round(len(ordered) * test_fraction)))
        test.extend(ordered[:test_count])
        train.extend(ordered[test_count:])
    return train, test


def _stratified_folds(examples, fold_count=5):
    assignments = {}
    grouped = defaultdict(list)
    for example in examples:
        grouped[example["label"]].append(example)
    for members in grouped.values():
        ordered = sorted(members, key=lambda row: hashlib.sha256(f"fold:{row['student_id']}".encode()).digest())
        for index, example in enumerate(ordered):
            assignments[example["student_id"]] = index % fold_count
    return assignments


def train_model(clean: dict) -> dict:
    examples = historical_examples(clean)
    if len(examples) < 40 or len({row["label"] for row in examples}) < 2:
        raise ValueError(f"Insufficient labeled historical examples for a reliable holdout: {len(examples)}")
    train, test = _stratified_holdout(examples)
    if not train or not test or len({row["label"] for row in train}) < 2 or len({row["label"] for row in test}) < 2:
        raise ValueError("Deterministic student holdout must contain both outcome classes")
    labels = [row["label"] for row in test]
    threshold = 0.5
    baseline_scores = [6.5 - row["features"]["cgpa"] - 1e-9 for row in test]
    baseline = _metrics(labels, [_sigmoid(v) for v in baseline_scores], 0.5)
    model_names = ("logistic_regression", "decision_tree", "random_forest")
    fold_assignments = _stratified_folds(train)
    candidate_results = []
    candidate_artifacts = {}
    for model_name in model_names:
        predictor, artifact = _fit_candidate(model_name, train)
        test_probs = [predictor(row) for row in test]
        candidate_artifacts[model_name] = artifact
        fold_aucs = []
        for fold in range(5):
            fit_rows = [row for row in train if fold_assignments[row["student_id"]] != fold]
            validation_rows = [row for row in train if fold_assignments[row["student_id"]] == fold]
            if not fit_rows or not validation_rows or len({row["label"] for row in fit_rows}) < 2 or len({row["label"] for row in validation_rows}) < 2:
                continue
            fold_predictor, _ = _fit_candidate(model_name, fit_rows, seed=fold + 1)
            fold_probs = [fold_predictor(row) for row in validation_rows]
            fold_aucs.append(_auc([row["label"] for row in validation_rows], fold_probs))
        metrics = _metrics(labels, test_probs, threshold)
        metrics["cv_auc"] = _mean(fold_aucs) or 0.5
        metrics["cv_folds"] = len(fold_aucs)
        configurations = {
            "logistic_regression": {"optimizer": "full_batch_gradient_descent", "iterations": 1400, "l2": 0.02},
            "decision_tree": {"criterion": "gini", "max_depth": 3, "min_leaf": max(8, len(train) // 50)},
            "random_forest": {"trees": 25, "criterion": "gini", "max_depth": 4,
                              "features_per_split": math.ceil(math.sqrt(len(FEATURES)))},
        }
        candidate_results.append({"name": model_name, "configuration": configurations[model_name], "metrics": metrics})
    simplicity = {"logistic_regression": 2, "decision_tree": 1, "random_forest": 0}
    selected = max(candidate_results, key=lambda item: (item["metrics"]["cv_auc"], simplicity[item["name"]]))
    selected_name = selected["name"]
    artifact = candidate_artifacts[selected_name]
    probability, _ = _fit_candidate(selected_name, train)
    coef = artifact.get("coef", [0.0] * len(FEATURES))
    means = artifact.get("means", [_mean([row["features"][name] for row in train]) or 0.0
                                     for name, _ in FEATURES])
    stds = artifact.get("stds", [math.sqrt(_mean([(row["features"][name] - means[index]) ** 2 for row in train]) or 0) or 1.0
                                   for index, (name, _) in enumerate(FEATURES)])
    card_features = [{"name": name, "source": name, "label": label,
                      "coef": coef[i], "mean": means[i], "std": stds[i]}
                     for i, (name, label) in enumerate(FEATURES)]
    selected_metrics = selected["metrics"]
    fairness = []
    for group_type, field in (("residence", "residence"), ("gender", "gender")):
        for group in sorted({row.get(field) for row in test if row.get(field)}):
            members = [(row, probability(row)) for row in test if row.get(field) == group]
            member_labels = [row["label"] for row, _ in members]
            member_flags = [prob >= threshold for _, prob in members]
            true_positive = sum(flag and label for flag, label in zip(member_flags, member_labels))
            false_positive = sum(flag and not label for flag, label in zip(member_flags, member_labels))
            positives, negatives = sum(member_labels), len(member_labels) - sum(member_labels)
            fairness.append({"group_type": group_type, "group": group, "n": len(members),
                "flag_rate": sum(member_flags) / len(members) if members else None,
                "recall": true_positive / positives if positives else None,
                "fpr": false_positive / negatives if negatives else None})
    card_metrics = {"target": "Failed at least one subject based on observed final exam marks (synthetic cohort)",
        "train_window": "Previous completed semester, weeks 1–8 and internal marks -> same semester exam result",
        "n_train": len(train), "n_test": len(test), "base_rate": sum(labels) / len(labels), "threshold": threshold,
        **selected_metrics,
        "baseline": {"rule": "Prior CGPA < 6.5", **baseline}}
    card = {"algorithm": selected_name, "features": card_features, "intercept": artifact.get("intercept", 0.0),
            "metrics": card_metrics, "candidates": candidate_results,
            "selection_method": "Highest 5-fold stratified CV ROC AUC on training students; ties favor the simpler model.",
            "fairness": fairness, "provenance": "Synthetic data only; metrics are not evidence of real-world predictive performance."}
    if selected_name == "decision_tree":
        card["tree"] = artifact["tree"]
    elif selected_name == "random_forest":
        card["trees"] = artifact["trees"]
    return card
