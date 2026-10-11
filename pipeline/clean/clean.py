"""Normalize the generated source extracts into schema-ready records."""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

DEPARTMENT_MAP = {
    "computer": "Comp", "comp": "Comp", "comp engg": "Comp", "computer engineering": "Comp",
    "it": "IT", "information technology": "IT", "e&tc": "ENTC", "entc": "ENTC",
    "electronics and telecommunication": "ENTC", "aids": "AI&DS", "ai & ds": "AI&DS",
    "ai&ds": "AI&DS", "artificial intelligence and data science": "AI&DS",
}
VALID_ACTIVITIES = {"event", "club", "hackathon", "certification"}


def normalize_id(value: object) -> str | None:
    match = re.search(r"(\d{5})", "" if value is None else str(value))
    return match.group(1) if match else None


def _numeric(value: object, low: float | None = None, high: float | None = None) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.upper() in {"NA", "N/A", "NULL", "AB", "NAN"}:
        return None
    text = text.rstrip("%").strip()
    if "/" in text:
        text = text.split("/", 1)[0].strip()
    try:
        number = float(text)
    except ValueError:
        return None
    if not math.isfinite(number) or (low is not None and number < low) or (high is not None and number > high):
        return None
    return number


def clean_all(raw: dict[str, list[dict[str, Any]]]) -> tuple[dict[str, list[dict[str, Any]]], list[dict], list[dict]]:
    issues: Counter[tuple[str, str, str]] = Counter()
    registry: dict[str, dict] = {}
    for item in raw["students"]:
        sid = normalize_id(item.get("student_id"))
        if not sid:
            issues[("students", "Unparseable student ID", "Excluded row with no canonical ID")]+=1
            continue
        if str(item.get("student_id")) != sid:
            issues[("students", "Non-canonical student ID", "Normalized to the 5-digit registry ID")]+=1
        if sid in registry:
            issues[("students", "Duplicate registry row", "Kept first canonical record")]+=1
            continue
        student = dict(item)
        student["student_id"] = sid
        student["email"] = str(item.get("email", "")).strip().lower()
        student["department"] = DEPARTMENT_MAP.get(str(item.get("department", "")).strip().lower(), "")
        registry[sid] = student
    roster = set(registry)

    cleaned: dict[str, list[dict]] = {"students": list(registry.values()), "faculty": list(raw["faculty"])}
    for faculty in cleaned["faculty"]:
        faculty["department"] = DEPARTMENT_MAP.get(str(faculty.get("department", "")).lower(), "")
    for source in ("academic", "attendance", "lms", "engagement", "placement", "skills", "feedback"):
        output, seen = [], set()
        for original in raw[source]:
            row = dict(original)
            sid = normalize_id(row.get("student_id", row.get(" Student ID")))
            if not sid or sid not in roster:
                issues[(source, "Unknown or unparseable student ID", "Excluded row; all resolvable IDs retained")]+=1
                continue
            raw_id = row.get("student_id", row.get(" Student ID"))
            if str(raw_id) != sid:
                issues[(source, "Non-canonical student ID", "Normalized to the 5-digit registry ID")]+=1
            row["student_id"] = sid
            if source == "academic":
                dept_value = str(row.get("department", "")).strip().lower()
                dept = DEPARTMENT_MAP.get(dept_value)
                if not dept:
                    dept = registry[sid]["department"]
                    issues[(source, "Unrecognized department", "Mapped from the canonical student registry")]+=1
                elif dept != registry[sid]["department"]:
                    issues[(source, "Department alias or mismatch", "Mapped to the canonical registry department")]+=1
                row["department"] = dept
                internal = _numeric(row.get("internal_marks"), 0, 40)
                external_raw = row.get("external_marks")
                if str(external_raw).strip().upper() == "AB":
                    external = 0.0
                    row["absent"] = True
                    issues[(source, "Absent exam mark (AB)", "Recorded as zero external marks and flagged absent")]+=1
                else:
                    external = _numeric(external_raw, 0, 60)
                if internal is None and row.get("internal_marks") not in (None, ""):
                    issues[(source, "Invalid internal mark", "Set to missing; excluded from aggregate")]+=1
                if external is None and external_raw not in (None, ""):
                    issues[(source, "Missing or invalid external mark", "Set to missing; not treated as a pass")]+=1
                row["internal_marks"] = internal
                row["external_marks"] = external
                row["semester"] = int(row["semester"])
                key = (sid, row["semester"], row["subject_code"])
            elif source == "attendance":
                held = int(_numeric(row.get("held"), 0, 20) or 0)
                attended = int(_numeric(row.get("attended"), 0, 20) or 0)
                if attended > held:
                    issues[(source, "Attended count exceeded held count", "Capped attended count at classes held")]+=1
                    attended = held
                row.update(semester=int(row["semester"]), week=int(row["week"]), held=held, attended=attended)
                key = (sid, row["semester"], row["week"], row["subject_code"])
            elif source == "lms":
                row.update(semester=int(row["semester"]), week=int(row["week"]),
                           logins=int(_numeric(row.get("logins"), 0, 500) or 0),
                           assignments_due=int(_numeric(row.get("assignments_due"), 0, 100) or 0),
                           assignments_submitted=int(_numeric(row.get("assignments_submitted"), 0, 100) or 0))
                minutes = _numeric(row.get("minutes"), 0, 10000)
                if minutes is None and row.get("minutes") not in (None, ""):
                    issues[(source, "Invalid or negative session minutes", "Set to missing; retained engagement record")]+=1
                row["minutes"] = None if minutes is None else int(minutes)
                key = (sid, row["semester"], row["week"])
            elif source == "engagement":
                row["activity_type"] = str(row.get("activity_type", "")).strip().lower()
                verified = str(row.get("verified", "")).strip().upper() in {"Y", "YES", "TRUE", "1"}
                row["verified"] = verified
                if row["activity_type"] not in VALID_ACTIVITIES:
                    issues[(source, "Unknown activity type", "Excluded from verified activity totals")]+=1
                    continue
                key = (sid, row["activity_type"], row.get("title"), row.get("date"))
            elif source == "placement":
                for field, high in (("Aptitude", 100), ("Coding", 100), ("Mock interview (1-5)", 5)):
                    parsed = _numeric(row.get(field), 1 if field.startswith("Mock") else 0, high)
                    if row.get(field) not in (None, "") and parsed is None:
                        issues[(source, f"Invalid {field} value", "Set to missing; retained placement record")]+=1
                    row[field] = parsed
                row["Aptitude"], row["Coding"], row["Mock interview (1-5)"] = row["Aptitude"], row["Coding"], row["Mock interview (1-5)"]
                key = (sid,)
            elif source == "skills":
                score = _numeric(row.get("score"), 0, 100)
                scale = int(_numeric(row.get("scale"), 1, 100) or 100)
                if score is None:
                    issues[(source, "Invalid skill score", "Excluded invalid skill score")]+=1
                    continue
                if scale == 10:
                    score *= 10
                    issues[(source, "Mixed 0–10 score scale", "Rescaled skill score to 0–100")]+=1
                if score > 100:
                    issues[(source, "Out-of-range skill score", "Excluded score above 100")]+=1
                    continue
                row.update(score100=round(score, 2), category="technical" if row["category"] == "technical" else "soft")
                key = (sid, row["skill"])
            else:
                row["satisfaction"] = _numeric(row.get("satisfaction"), 1, 5)
                row["faculty_rating"] = _numeric(row.get("faculty_rating"), 1, 5)
                key = (sid,)
            if key in seen:
                issues[(source, "Duplicate source row", "Dropped duplicate after canonical ID resolution")]+=1
                continue
            seen.add(key)
            if source == "engagement" and not row["verified"]:
                issues[(source, "Unverified activity", "Retained for audit but excluded from scoring")]+=1
            output.append(row)
        cleaned[source] = output
    # The subject summary is a companion extract from the attendance system. Normalize its
    # mixed ratio/percentage units for the cleaning audit, while the canonical DB values are
    # independently derived from held/attended weekly records.
    fractional = 0
    for row in raw.get("attendance_summary", []):
        sid = normalize_id(row.get("student_id"))
        value = _numeric(row.get("attendance"), 0, 100)
        if sid not in roster or value is None:
            issues[("attendance", "Invalid attendance summary row", "Excluded from attendance summary audit")]+=1
        elif value <= 1:
            fractional += 1
    if fractional:
        issues[("attendance", "Fractional attendance units", "Converted values from 0–1 fractions to 0–100 percentages")]+=fractional
    quality = [{"source": source, "issue": issue, "rows_affected": count, "action": action}
               for (source, issue, action), count in sorted(issues.items())]
    stats = []
    id_formats = {"students": "5-digit registry ID", "academic": "SCA-<5-digit ID>",
                  "attendance": "sca<5-digit ID>", "lms": "email", "engagement": "5-digit ID",
                  "placement": "SCA-<5-digit ID> with whitespace", "skills": "5-digit ID", "feedback": "sca-<5-digit ID>"}
    for source in ("students", "academic", "attendance", "lms", "engagement", "placement", "skills", "feedback"):
        source_rows = raw[source]
        clean_rows = cleaned[source]
        covered = len({row["student_id"] for row in clean_rows})
        stats.append({"source": source, "file": f"{source}.csv", "id_format": id_formats[source],
                      "rows_in": len(source_rows), "rows_out": len(clean_rows),
                      "students_covered_pct": round(100 * covered / max(1, len(roster)), 1)})
    return cleaned, quality, stats
