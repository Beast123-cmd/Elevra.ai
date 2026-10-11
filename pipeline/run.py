"""Generate, clean, score, and export the reproducible Elevra.ai data set."""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from clean.clean import clean_all
from generate.generate import DEPARTMENTS, generate_all
from scoring.engine import PILLARS, WEIGHTS, evaluate, success_score

RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "pipeline" / "out"


def _mean(values):
    values = [float(value) for value in values if value is not None and math.isfinite(float(value))]
    return None if not values else sum(values) / len(values)


def _grade(total: float) -> float:
    for threshold, points in ((90, 10), (80, 9), (70, 8), (60, 7), (50, 6), (45, 5), (40, 4)):
        if total >= threshold:
            return float(points)
    return 0.0


def _build_payload(clean: dict, issues: list[dict], stats: list[dict], n_requested: int) -> dict:
    students = clean["students"]
    by_sid = {row["student_id"]: row for row in students}
    academic_by_student = defaultdict(list)
    for row in clean["academic"]:
        academic_by_student[row["student_id"]].append(row)
    attendance_by_student = defaultdict(list)
    for row in clean["attendance"]:
        attendance_by_student[row["student_id"]].append(row)
    lms_by_student = defaultdict(list)
    for row in clean["lms"]:
        lms_by_student[row["student_id"]].append(row)
    engagement_by_student = defaultdict(list)
    for row in clean["engagement"]:
        engagement_by_student[row["student_id"]].append(row)
    skills_by_student = defaultdict(list)
    for row in clean["skills"]:
        skills_by_student[row["student_id"]].append(row)
    placement_by_student = {row["student_id"]: row for row in clean["placement"]}
    feedback_by_student = {row["student_id"]: row for row in clean["feedback"]}

    academics_out, attendance_out, lms_out, engagement_out, placement_out, skills_out, feedback_out = [], [], [], [], [], [], []
    metrics_by_sid, weekly_by_sid, history_by_sid = {}, {}, {}
    current_sem_by_sid = {}
    for student in students:
        sid = student["student_id"]
        current_sem = 2 * int(student["year"]) - 1
        current_sem_by_sid[sid] = current_sem
        rows = sorted(academic_by_student[sid], key=lambda row: (row["semester"], row["subject_code"]))
        complete = [row for row in rows if row["semester"] < current_sem]
        semester_groups = defaultdict(list)
        for row in rows:
            semester_groups[row["semester"]].append(row)
        running_grade_points, running_subjects = [], []
        latest_backlogs = 0
        history = []
        for semester, semester_rows in sorted(semester_groups.items()):
            marks = []
            for row in semester_rows:
                internal = row["internal_marks"]
                external = row["external_marks"]
                total = None if internal is None and external is None else (internal or 0) + (external or 0)
                marks.append({"subject": row["subject_code"], "internal": internal, "external": external,
                              "total": total, "passed": None if total is None or semester == current_sem else total >= 40,
                              "absent": bool(row.get("absent", False))})
            if semester < current_sem:
                valid_totals = [mark["total"] for mark in marks if mark["total"] is not None]
                sem_points = [_grade(value) for value in valid_totals]
                running_grade_points.extend(sem_points)
                running_subjects.extend(valid_totals)
                latest_backlogs = sum(1 for value in valid_totals if value < 40)
                sgpa = _mean(sem_points)
                cgpa = _mean(running_grade_points)
                academics_out.append({"student_id": sid, "semester": semester, "sgpa": round(sgpa, 2) if sgpa is not None else None,
                                      "cgpa": round(cgpa, 2) if cgpa is not None else None,
                                      "backlogs": latest_backlogs, "subject_marks": marks})
                historical_pillars = {"academic": min(100, (sgpa or 0) * 10 - 5 * latest_backlogs)}
                score = success_score({**historical_pillars, **{key: None for key in PILLARS if key != "academic"}})
                history.append({"semester": semester, "score": score["score"], "sgpa": round(sgpa, 2) if sgpa is not None else None})
            else:
                # Current in-progress marks are retained for drill-down but do not affect cumulative GPA.
                academics_out.append({"student_id": sid, "semester": semester, "sgpa": None, "cgpa": None,
                                      "backlogs": latest_backlogs, "subject_marks": marks})
        history_by_sid[sid] = history

        att_rows = attendance_by_student[sid]
        current_att = [row for row in att_rows if row["semester"] == current_sem and 1 <= row["week"] <= 8]
        subject_totals = defaultdict(lambda: [0, 0])
        week_totals = defaultdict(lambda: [0, 0])
        for row in current_att:
            subject_totals[row["subject_code"]][0] += row["attended"]
            subject_totals[row["subject_code"]][1] += row["held"]
            week_totals[row["week"]][0] += row["attended"]
            week_totals[row["week"]][1] += row["held"]
        for subject, (attended, held) in subject_totals.items():
            attendance_out.append({"student_id": sid, "semester": current_sem, "subject": subject,
                                   "attendance_pct": round(100 * attended / held, 2) if held else None})
        attendance_pct = 100 * sum(v[0] for v in week_totals.values()) / max(1, sum(v[1] for v in week_totals.values()))
        early = [100 * a / h for week, (a, h) in week_totals.items() if week <= 4 and h]
        late = [100 * a / h for week, (a, h) in week_totals.items() if week >= 5 and h]
        attendance_drop = (_mean(early) or 0) - (_mean(late) or 0)

        lms_rows = [row for row in lms_by_student[sid] if row["semester"] == current_sem and row["week"] <= 8]
        lms_rows.sort(key=lambda row: row["week"])
        for row in lms_rows:
            lms_out.append({"student_id": sid, "semester": current_sem, "week": row["week"], "logins": row["logins"],
                            "minutes": row["minutes"], "assignments_done": row["assignments_submitted"],
                            "assignments_total": row["assignments_due"], "on_time": row["assignments_submitted"]})
        due = sum(row["assignments_due"] for row in lms_rows)
        submitted = sum(row["assignments_submitted"] for row in lms_rows)
        active_weeks = sum(1 for row in lms_rows if row["logins"] > 0)
        login_consistency = active_weeks / max(1, len(lms_rows))
        valid_minutes = [row["minutes"] for row in lms_rows if row["minutes"] is not None]
        early_logins = _mean([row["logins"] for row in lms_rows if row["week"] <= 4]) or 0
        late_logins = _mean([row["logins"] for row in lms_rows if row["week"] >= 6]) or 0
        login_trend = (late_logins - early_logins) / (early_logins + 1)
        engagement_drop = int(early_logins >= 2 and late_logins < 0.6 * early_logins)

        activities = engagement_by_student[sid]
        verified = [row for row in activities if row["verified"]]
        counts = CounterLike(row["activity_type"] for row in verified)
        engagement_out.extend({"student_id": sid, "type": row["activity_type"], "name": row["title"],
                              "date": row["date"], "verified": row["verified"]} for row in activities)
        skill_rows = skills_by_student[sid]
        for row in skill_rows:
            skills_out.append({"student_id": sid, "skill": row["skill"], "category": row["category"], "level": row["score100"]})
        tech = _mean([row["score100"] for row in skill_rows if row["category"] == "technical"])
        soft = _mean([row["score100"] for row in skill_rows if row["category"] == "soft"])
        placement = placement_by_sid = placement_by_student.get(sid)
        if placement is not None:
            placement_out.append({"student_id": sid, "aptitude": placement["Aptitude"], "coding": placement["Coding"],
                                  "mock_interview_avg": placement["Mock interview (1-5)"], "mock_count": int(placement["Mock interview (1-5)"] is not None)})
        feedback = feedback_by_student.get(sid)
        feedback_sem = current_sem - 1
        if feedback:
            feedback_out.append({"student_id": sid, "semester": feedback_sem, "satisfaction": feedback["satisfaction"],
                                 "faculty_rating": feedback["faculty_rating"], "comment": feedback["comment"]})
        current_marks = [row["internal_marks"] for row in rows if row["semester"] == current_sem and row["internal_marks"] is not None]
        cumulative_gpa = _mean(running_grade_points) if running_grade_points else None
        metrics = {
            "cgpa": cumulative_gpa, "internal_pct": 100 * _mean(current_marks) / 40 if current_marks else None,
            "backlogs": latest_backlogs, "attendance_pct": attendance_pct if current_att else None,
            "submit_rate": submitted / due if due else None, "login_consistency": login_consistency if lms_rows else None,
            "avg_minutes": _mean(valid_minutes), "login_trend": login_trend if lms_rows else None,
            "engagement_drop": engagement_drop if lms_rows else None,
            "aptitude": placement["Aptitude"] if placement else None, "coding": placement["Coding"] if placement else None,
            "mock": placement["Mock interview (1-5)"] if placement else None, "tech_skill": tech, "soft_skill": soft,
            "certifications": counts.get("certification", 0), "events": counts.get("event", 0),
            "clubs": counts.get("club", 0), "hackathons": counts.get("hackathon", 0),
            "satisfaction": feedback["satisfaction"] if feedback else None,
            "faculty_rating": feedback["faculty_rating"] if feedback else None,
            "attendance_drop_pp": attendance_drop,
        }
        metrics_by_sid[sid] = metrics
        weekly = []
        by_week_lms = {row["week"]: row for row in lms_rows}
        for week in range(1, 9):
            att, held = week_totals.get(week, (0, 0))
            lms = by_week_lms.get(week)
            weekly.append({"week": week, "logins": lms["logins"] if lms else None,
                           "attendance": round(100 * att / held, 1) if held else None,
                           "submit_rate": round(lms["assignments_submitted"] / lms["assignments_due"], 3)
                           if lms and lms["assignments_due"] else None})
        weekly_by_sid[sid] = weekly

    evaluations = {sid: evaluate(metrics) for sid, metrics in metrics_by_sid.items()}
    pillar_means = {pillar: _mean([evaluation["pillars"][pillar] for evaluation in evaluations.values()]) for pillar in PILLARS}
    score_mean = _mean([result["score"] for result in evaluations.values()]) or 0
    profiles, scores_out, score_history_out = [], [], []
    for student in students:
        sid = student["student_id"]
        result, metrics = evaluations[sid], metrics_by_sid[sid]
        contributions = []
        denominator = sum(WEIGHTS[p] for p in PILLARS if result["pillars"][p] is not None)
        for pillar in PILLARS:
            value, mean = result["pillars"][pillar], pillar_means[pillar]
            if value is not None and mean is not None and denominator:
                contributions.append({"pillar": pillar, "points": round(WEIGHTS[pillar] / denominator * (value - mean), 2)})
        contributions.sort(key=lambda item: (-abs(item["points"]), item["pillar"]))
        profile = {
            "student_id": sid, "name": student["name"], "department": student["department"], "year": int(student["year"]),
            "batch": student["batch"], "section": student["section"], "gender": student["gender"],
            "residence": student["residence"], "mentor_faculty_id": student["mentor_faculty_id"],
            "pillars": result["pillars"], "score": result["score"], "band": result["band"],
            "confidence": result["confidence"], "missing": result["missing"], "contributions": contributions,
            "academic_risk": result["academic_risk"], "placement_risk": result["placement_risk"],
            "model": result["model"], "segment": result["segment"], "priority": result["priority"],
            "actions": _actions(result), "engagement_drop": bool(metrics["engagement_drop"]),
            "declining": False, "metrics": metrics, "percentiles": {}, "weekly": weekly_by_sid[sid],
            "history": history_by_sid[sid],
        }
        profiles.append(profile)
        scores_out.append({"student_id": sid, "semester": current_sem_by_sid[sid], "success_score": result["score"],
            "band": result["band"], "confidence": result["confidence"],
            **result["pillars"], "academic_risk": result["academic_risk"]["level"],
            "academic_risk_prob": result["model"]["prob"], "placement_risk": result["placement_risk"]["level"],
            "segment": result["segment"], "priority": result["priority"], "declining": False,
            "engagement_drop": bool(metrics["engagement_drop"]), "drivers": {
                "academic": result["academic_risk"]["drivers"], "placement": result["placement_risk"]["drivers"],
                "contributions": contributions, "model": result["model"]["factors"]}, "profile": profile})
        for hist in history_by_sid[sid]:
            score_history_out.append({"student_id": sid, "semester": hist["semester"], "success_score": hist["score"]})

    dept_pillars = []
    for dept in DEPARTMENTS:
        members = [profile for profile in profiles if profile["department"] == dept]
        dept_pillars.append({"dept": dept, **{pillar: _mean([p["pillars"][pillar] for p in members]) or 0 for pillar in PILLARS}})
    band_names = ("Critical", "Needs Attention", "On Track", "Thriving")
    score_bands = [{"min": threshold, "name": name} for threshold, name in ((0, "Critical"), (45, "Needs Attention"), (60, "On Track"), (75, "Thriving"))]
    segment_labels = {
        "Silent disengagers": ("Sharp LMS drop or attendance falling at least 10 percentage points", "Mentor check-in within 48 hours"),
        "Academic stars, placement unready": ("Academic pillar at least 75 and placement pillar below 55", "Coding practice and two mock interviews"),
        "Engaged but struggling": ("Co-curricular pillar at least 60 and academic pillar below 55", "Remedial classes and mentoring"),
        "Skilled but irregular": ("Skills pillar at least 70 and attendance below 75", "Attendance counselling"),
        "Placement-ready all-rounders": ("Score at least 75 and placement pillar at least 70", "Advanced opportunities and peer mentoring"),
        "Steady middle": ("No higher-priority segment rule matched", "Monthly nudges"),
    }
    segment_counts = CounterLike(profile["segment"] for profile in profiles)
    segments = [{"name": name, "rule": segment_labels[name][0], "action": segment_labels[name][1], "count": segment_counts.get(name, 0)}
                for name in segment_labels]
    weekly_trend = []
    for dept in DEPARTMENTS:
        for week in range(1, 9):
            week_profiles = [profile for profile in profiles if profile["department"] == dept]
            weekly_trend.append({"week": week, "dept": dept,
                "logins": round(_mean([p["weekly"][week - 1]["logins"] for p in week_profiles]) or 0, 2),
                "attendance": round(_mean([p["weekly"][week - 1]["attendance"] for p in week_profiles]) or 0, 2)})
    cohort = {"generated_at": "2026-10-11T00:00:00Z", "current_week": 8, "n_students": len(students),
        "weights": WEIGHTS, "bands": score_bands,
        "pillar_labels": {"academic": "Academic", "attendance": "Attendance", "lms": "LMS engagement",
                          "placement": "Placement readiness", "skills": "Skills", "engagement": "Co-curricular", "feedback": "Feedback"},
        "pillar_means": {key: round(value, 2) for key, value in pillar_means.items() if value is not None},
        "dept_pillars": dept_pillars, "weekly_trend": weekly_trend, "lead_time": [], "segments": segments}
    insights = _build_insights(profiles, score_mean)
    model = {"features": [], "intercept": 0.0, "metrics": {
        "target": "Not trained: historical outcome model is a P1 task", "train_window": "not available",
        "n_train": 0, "n_test": 0, "base_rate": 0, "threshold": 0.6, "auc": 0.5,
        "cv_auc": 0.5, "precision": 0, "recall": 0, "f1": 0,
        "baseline": {"rule": "Prior CGPA < 6.5 (not evaluated)", "auc": 0.5, "precision": 0, "recall": 0, "f1": 0}},
        "fairness": []}
    payload = {
        "faculty": clean["faculty"], "students": students, "academics": academics_out, "attendance": attendance_out,
        "lms_activity": lms_out, "engagement": engagement_out, "placement": placement_out, "skills": skills_out,
        "feedback": feedback_out, "scores": scores_out, "score_history": score_history_out,
        "analytics": [{"key": "cohort", "payload": cohort}, {"key": "model", "payload": model}, {"key": "insights", "payload": insights}],
        "data_quality": issues, "source_stats": stats,
        "summary": {"students": len(students), "scores": len(scores_out), "requested_students": n_requested,
                    "raw_sources": len(stats), "cleaning_issues": sum(row["rows_affected"] for row in issues),
                    "mean_score": round(score_mean, 1), "risk_red": sum(p["academic_risk"]["level"] == "Red" for p in profiles)},
    }
    return payload


def CounterLike(values):
    counts = defaultdict(int)
    for value in values:
        counts[value] += 1
    return counts


def _actions(result: dict) -> list[str]:
    actions = []
    mapping = (("Attendance", "Attendance counselling and a check-in"), ("backlog", "Supplementary exam preparation and remedial classes"),
               ("CGPA", "Academic mentoring plan with fortnightly review"), ("Internal marks", "Subject faculty doubt sessions"),
               ("Assignment", "Assignment recovery plan with LMS reminders"), ("LMS activity", "Mentor check-in within 48 hours"),
               ("Coding", "Coding practice track"), ("Aptitude", "Aptitude training batch"), ("mock interview", "Take mock interviews"),
               ("No verified", "Join a verified hackathon or certification"), ("Technical skill", "Skill lab enrolment"))
    for driver in result["academic_risk"]["drivers"] + result["placement_risk"]["drivers"]:
        for key, action in mapping:
            if key.lower() in driver["label"].lower() and action not in actions:
                actions.append(action)
                break
    if not actions:
        actions.append("Monthly progress check-in")
    return actions[:4]


def _build_insights(profiles: list[dict], cohort_score: float) -> list[dict]:
    attendance_risk = [p for p in profiles if p["metrics"]["attendance_pct"] is not None and p["metrics"]["attendance_pct"] < 65]
    low_att_fail = sum(p["metrics"]["backlogs"] > 0 for p in attendance_risk) / max(1, len(attendance_risk))
    other = [p for p in profiles if p not in attendance_risk]
    other_fail = sum(p["metrics"]["backlogs"] > 0 for p in other) / max(1, len(other))
    drops = [p for p in profiles if p["engagement_drop"]]
    placement_missing = sum(p["placement_risk"]["level"] == "Not assessed" for p in profiles)
    return [
        {"id": "cohort-score", "title": "Cohort success score", "detail": f"Mean score is {cohort_score:.1f} across {len(profiles)} synthetic student profiles.", "severity": "info"},
        {"id": "attendance-checkin", "title": "Attendance needs attention", "detail": f"{len(attendance_risk)} students are below the 65% detention line; their observed backlog rate is {low_att_fail:.0%}, compared with {other_fail:.0%} for others.", "severity": "critical" if attendance_risk else "info"},
        {"id": "lms-drop", "title": "LMS engagement drop", "detail": f"{len(drops)} students show a sharp week 6–8 login decline and may benefit from a timely check-in.", "severity": "warning" if drops else "info"},
        {"id": "placement-coverage", "title": "Placement data coverage", "detail": f"{placement_missing} students have no placement assessment; their placement risk is marked Not assessed.", "severity": "info"},
        {"id": "early-warning-limit", "title": "Model validation is pending", "detail": "The current run uses transparent rule-based risk flags. The historical model remains untrained until the back-test task is completed.", "severity": "info"},
    ]


def run(n: int = 200, regenerate: bool = False) -> dict:
    raw = generate_all(RAW_DIR, n=n)
    clean, issues, stats = clean_all(raw)
    payload = _build_payload(clean, issues, stats, n)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUT_DIR / "seed.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":")), encoding="utf-8")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=1500, help="number of synthetic students (1–1500)")
    parser.add_argument("--regenerate", action="store_true", help="rewrite deterministic raw CSV sources")
    parser.add_argument("--no-db", action="store_true", help="write local outputs only")
    args = parser.parse_args()
    payload = run(n=args.n, regenerate=args.regenerate)
    print(json.dumps(payload["summary"], sort_keys=True))
    if not args.no_db:
        from seed import seed_database
        seed_database(payload)


if __name__ == "__main__":
    main()
