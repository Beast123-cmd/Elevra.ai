"""Generate realistic, reproducible multi-source campus data without external dependencies."""
from __future__ import annotations

import csv
import random
from pathlib import Path

SEED = 42
DEPARTMENTS = ("Comp", "IT", "ENTC", "AI&DS")
DEPT_ALIASES = ("Computer", "COMP", "Comp Engg", "IT", "E&TC", "ENTC", "AIDS", "AI & DS")
SOURCE_NAMES = ("students", "academic", "attendance", "lms", "engagement", "placement", "skills", "feedback")
FIRST_NAMES = ("Aarav", "Vivaan", "Aditya", "Sai", "Arjun", "Ishaan", "Ananya", "Diya", "Priya", "Sneha", "Kavya", "Meera")
LAST_NAMES = ("Sharma", "Reddy", "Patel", "Iyer", "Nair", "Gupta", "Rao", "Kumar", "Singh", "Das", "Joshi", "Menon")
SKILLS = {"Comp": ("DSA", "Web development", "Databases"), "IT": ("DSA", "Cloud", "Databases"),
          "ENTC": ("Embedded systems", "Python", "VLSI"), "AI&DS": ("Python", "Machine learning", "Statistics")}


def _write(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def generate_all(out_dir: Path, n: int = 200, seed: int = SEED) -> dict[str, list[dict]]:
    if n < 1 or n > 1500:
        raise ValueError("n must be between 1 and 1500")
    rng = random.Random(seed)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    faculty = []
    by_dept: dict[str, list[str]] = {dept: [] for dept in DEPARTMENTS}
    for index in range(50):
        dept = DEPARTMENTS[index % len(DEPARTMENTS)]
        faculty_id = f"F{index + 1:02d}"
        faculty.append({"faculty_id": faculty_id, "name": f"Faculty {index + 1:02d}", "department": dept,
                        "email": f"{faculty_id.lower()}@campus.edu"})
        by_dept[dept].append(faculty_id)
    students = []
    traits = {}
    for index in range(n):
        student_id = f"{40000 + index:05d}"
        dept = DEPARTMENTS[index % len(DEPARTMENTS)]
        year = (2, 3, 4)[(index // len(DEPARTMENTS)) % 3]
        gender = "F" if rng.random() < 0.48 else "M"
        students.append({"student_id": student_id, "name": f"{FIRST_NAMES[rng.randrange(len(FIRST_NAMES))]} {LAST_NAMES[rng.randrange(len(LAST_NAMES))]}",
                         "email": f"{student_id}@campus.edu", "department": dept, "year": year,
                         "batch": f"{2027-year+1}-{2027}", "section": ("A", "B", "C")[index % 3],
                         "gender": gender, "residence": "Day Scholar" if rng.random() < 0.42 else "Hostel",
                         "mentor_faculty_id": by_dept[dept][(index // (len(DEPARTMENTS) * 3)) % len(by_dept[dept])]})
        ability, diligence = rng.gauss(0, 1), rng.gauss(0, 1)
        # Keep the guided-demo personas reproducible: one mentee needs an attendance check-in,
        # and one academically strong third-year has deliberately weaker placement readiness.
        if index == 4:
            ability, diligence = 1.15, 0.75
        if index == 8:
            ability, diligence = -0.15, -0.7
        traits[student_id] = {
            "ability": ability, "diligence": diligence,
            "career": 0.3 * ability + 0.95 * rng.gauss(0, 1),
            "low_attendance": index == 8 or rng.random() < 0.15,
            "drop": False if index == 4 else rng.random() < 0.13,
            "placement_lag": index == 4 or rng.random() < 0.18,
            "gender": gender,
        }
    by_id = {row["student_id"]: row for row in students}
    raw = {name: [] for name in SOURCE_NAMES}
    raw["students"] = [dict(row) for row in students]
    raw["faculty"] = faculty
    for row in students:
        if rng.random() < 0.01:
            raw["students"].append(dict(row))
    for row in students:
        sid, t = row["student_id"], traits[row["student_id"]]
        current_semester = 2 * row["year"] - 1
        alias = rng.choice(DEPT_ALIASES)
        for semester in range(1, current_semester + 1):
            completed = semester < current_semester
            for subject_index in range(1, 6):
                is_low = t["low_attendance"]
                base = 69 + 10 * t["ability"] + 5 * t["diligence"] - (8 if t["drop"] and semester == current_semester - 1 else 0)
                internal = max(0, min(40, round((base + rng.gauss(0, 9)) * 0.4)))
                external = ""
                if completed:
                    fail = rng.random() < (0.25 if is_low else 0.065)
                    total = max(0, min(100, round(base + rng.gauss(0, 11))))
                    external = "AB" if fail and rng.random() < 0.05 else max(0, min(60, total - internal))
                    if rng.random() < 0.004:
                        external = "NA"
                raw_id = f"SCA-{sid}"
                raw["academic"].append({" Student ID": raw_id, "semester": semester,
                    "department": alias if rng.random() < 0.12 else row["department"],
                    "subject_code": f"{row['department'][:2].upper()}{semester:02d}{subject_index}",
                    "internal_marks": internal, "external_marks": external})
        for semester, weeks in ((current_semester - 1, 16), (current_semester, 8)):
            if semester < 1:
                continue
            for week in range(1, weeks + 1):
                current_drop = t["drop"] and semester == current_semester
                attendance = 0.82 - (0.22 if t["low_attendance"] else 0) + 0.035 * t["diligence"]
                if current_drop and week >= 5:
                    attendance -= 0.08 * (week - 4)
                attendance = max(0.15, min(0.99, attendance + rng.gauss(0, 0.06)))
                lms_decay = max(0.12, 1 - 0.22 * max(0, week - 3)) if current_drop and week >= 4 else 1
                logins = max(0, int(rng.gauss(max(0.4, (4.1 + 1.1 * t["diligence"]) * lms_decay), 1.7)))
                due = 2 if week % 2 == 0 else 1
                submission_rate = max(0.05, min(1.0, 0.86 + 0.08 * t["diligence"] - (0.34 if current_drop and week >= 5 else 0)))
                submitted = sum(1 for _ in range(due) if rng.random() < submission_rate)
                for subject_index in range(1, 6):
                    held = 3
                    attended = sum(1 for _ in range(held) if rng.random() < attendance)
                    raw_att_id = f"sca{sid}"
                    if rng.random() < 0.005:
                        raw_att_id = f"SCA{sid} "
                    raw["attendance"].append({"student_id": raw_att_id, "semester": semester, "week": week,
                        "subject_code": f"{row['department'][:2].upper()}{semester:02d}{subject_index}", "held": held, "attended": attended})
                raw_lms_id = f"{sid}@campus.edu"
                if rng.random() < 0.05:
                    raw_lms_id = raw_lms_id.upper()
                minutes = max(0, logins * max(3, round(rng.gauss(24, 8))))
                if rng.random() < 0.006:
                    minutes = -minutes - 1
                raw["lms"].append({"student_id": raw_lms_id, "semester": semester, "week": week,
                    "logins": logins, "minutes": minutes, "assignments_due": due, "assignments_submitted": submitted})
        for skill in SKILLS[row["department"]]:
            value = max(5, min(100, 65 + 11 * t["ability"] + 8 * t["career"] + rng.gauss(0, 12)))
            scale = 10 if rng.random() < 0.5 else 100
            raw["skills"].append({"student_id": sid, "category": "technical", "skill": skill,
                                  "score": round(value / 10, 1) if scale == 10 else round(value, 1), "scale": scale})
        for skill in ("Communication", "Teamwork"):
            value = max(5, min(100, 68 + 7 * t["diligence"] + rng.gauss(0, 12)))
            scale = 10 if rng.random() < 0.5 else 100
            raw["skills"].append({"student_id": sid, "category": "soft", "skill": skill,
                                  "score": round(value / 10, 1) if scale == 10 else round(value, 1), "scale": scale})
        for activity in ("event", "club", "hackathon", "certification"):
            count = max(0, min(3, int(rng.gauss(1.0 + 0.35 * t["career"], 0.9))))
            for count_index in range(count):
                verified = rng.random() < 0.9
                raw["engagement"].append({"student_id": sid, "activity_type": activity,
                    "title": f"{activity.title()} {count_index + 1}", "date": f"2026-{rng.randint(1,9):02d}-{rng.randint(1,28):02d}",
                    "verified": "Y" if verified else "N"})
        if row["year"] >= 3:
            aptitude = max(5, min(100, 58 + 8 * t["ability"] + 8 * t["career"] + rng.gauss(0, 11)))
            coding = max(5, min(100, 55 + 7 * t["ability"] + 13 * t["career"] + rng.gauss(0, 13)))
            if t["placement_lag"]:
                coding = max(8, coding - 24)
                aptitude = max(10, aptitude - 10)
            mock = "" if rng.random() < 0.15 else max(1, min(5, round(3.2 + 0.7 * t["career"] + rng.gauss(0, 0.9))))
            raw["placement"].append({" Student ID": f"SCA-{sid} ", "Aptitude": round(aptitude),
                "Coding": round(coding), "Mock interview (1-5)": mock})
        if rng.random() < 0.9:
            satisfaction = max(1, min(5, round(3.5 + 0.35 * t["diligence"] + rng.gauss(0, 0.8))))
            faculty_rating = max(1, min(5, round(3.4 + 0.4 * t["diligence"] + 0.2 * t["ability"] + rng.gauss(0, 0.8))))
            raw["feedback"].append({"student_id": f"sca-{sid}", "satisfaction": f"{satisfaction}/5" if rng.random() < 0.08 else satisfaction,
                                    "faculty_rating": faculty_rating, "comment": "Synthetic feedback"})
    # Deliberate source-system duplicates exercise the same dedupe path used for real imports.
    for source, fraction in (("academic", .004), ("attendance", .002), ("lms", .01), ("engagement", .015)):
        count = max(1, round(len(raw[source]) * fraction))
        raw[source].extend(dict(row) for row in raw[source][:count])
    # A fraction of the per-subject summary source arrives as 0-1 ratios; the rest is percent.
    summary = []
    grouped = {}
    for row in raw["attendance"]:
        sid = re_normalize(row["student_id"])
        key = (sid, row["semester"], row["subject_code"])
        agg = grouped.setdefault(key, [0, 0])
        agg[0] += int(row["attended"]); agg[1] += int(row["held"])
    for (sid, semester, subject), (attended, held) in sorted(grouped.items()):
        pct = attended / held if held else 0
        summary.append({"student_id": sid, "semester": semester, "subject_code": subject,
                        "attendance": round(pct if rng.random() < .3 else pct * 100, 4)})
    raw["attendance_summary"] = summary
    raw["faculty"] = faculty
    file_columns = {
        "students": ["student_id", "name", "email", "department", "year", "batch", "section", "gender", "residence", "mentor_faculty_id"],
        "faculty": ["faculty_id", "name", "department", "email"],
        "academic": [" Student ID", "semester", "department", "subject_code", "internal_marks", "external_marks"],
        "attendance": ["student_id", "semester", "week", "subject_code", "held", "attended"],
        "attendance_summary": ["student_id", "semester", "subject_code", "attendance"],
        "lms": ["student_id", "semester", "week", "logins", "minutes", "assignments_due", "assignments_submitted"],
        "engagement": ["student_id", "activity_type", "title", "date", "verified"],
        "placement": [" Student ID", "Aptitude", "Coding", "Mock interview (1-5)"],
        "skills": ["student_id", "category", "skill", "score", "scale"],
        "feedback": ["student_id", "satisfaction", "faculty_rating", "comment"],
    }
    for name, rows in raw.items():
        _write(out_dir / f"{name}.csv", file_columns[name], rows)
    return raw


def re_normalize(value: str) -> str:
    import re
    match = re.search(r"(\d{5})", str(value))
    return match.group(1) if match else ""
