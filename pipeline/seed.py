"""Idempotently load a local pipeline payload into Supabase Postgres and Auth."""
from __future__ import annotations

import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"
DEMO_USERS = ("admin", "faculty", "student_red", "student_star")


def _load_env() -> dict[str, str]:
    result = dict(os.environ)
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            match = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$", line)
            if match and not match.group(1).startswith("#"):
                result.setdefault(match.group(1), match.group(2).strip().strip("\"'"))
    return result


def _sql_value(value: object, jsonb: bool = False) -> str:
    if value is None:
        return "NULL"
    if jsonb:
        text = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        return "'" + text.replace("'", "''") + "'::jsonb"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            return "NULL"
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


TABLES = {
    "faculty": ("faculty_id", "name", "department", "email"),
    "students": ("student_id", "name", "department", "year", "batch", "section", "gender", "residence", "mentor_faculty_id", "email"),
    "academics": ("student_id", "semester", "sgpa", "cgpa", "backlogs", "subject_marks"),
    "attendance": ("student_id", "semester", "subject", "attendance_pct"),
    "lms_activity": ("student_id", "semester", "week", "logins", "minutes", "assignments_done", "assignments_total", "on_time"),
    "placement": ("student_id", "aptitude", "coding", "mock_interview_avg", "mock_count"),
    "skills": ("student_id", "skill", "category", "level"),
    "feedback": ("student_id", "semester", "satisfaction", "faculty_rating", "comment"),
    "scores": ("student_id", "semester", "success_score", "band", "confidence", "academic", "attendance", "lms", "placement", "skills", "engagement", "feedback", "academic_risk", "academic_risk_prob", "placement_risk", "segment", "priority", "declining", "engagement_drop", "drivers", "profile"),
    "score_history": ("student_id", "semester", "success_score"),
    "analytics": ("key", "payload"),
    "source_stats": ("source", "file", "id_format", "rows_in", "rows_out", "students_covered_pct"),
}
CONFLICTS = {
    "faculty": ("faculty_id",), "students": ("student_id",), "academics": ("student_id", "semester"),
    "attendance": ("student_id", "semester", "subject"), "lms_activity": ("student_id", "semester", "week"),
    "placement": ("student_id",), "skills": ("student_id", "skill"), "feedback": ("student_id", "semester"),
    "scores": ("student_id",), "score_history": ("student_id", "semester"), "analytics": ("key",),
    "source_stats": ("source",),
}
JSON_COLUMNS = {"academics": {"subject_marks"}, "scores": {"drivers", "profile"}, "analytics": {"payload"}}


def _insert_sql(table: str, rows: list[dict]) -> str:
    if not rows:
        return ""
    columns = TABLES[table]
    values = []
    for row in rows:
        values.append("(" + ",".join(_sql_value(row.get(column), column in JSON_COLUMNS.get(table, set()))
                                      for column in columns) + ")")
    conflict = CONFLICTS[table]
    updates = [column for column in columns if column not in conflict]
    action = ("DO UPDATE SET " + ",".join(f"{column}=EXCLUDED.{column}" for column in updates)
              if updates else "DO NOTHING")
    return (f"INSERT INTO public.{table} ({','.join(columns)}) VALUES\n" + ",\n".join(values)
            + f"\nON CONFLICT ({','.join(conflict)}) {action};\n")


def _write_sql(payload: dict, replace_existing_cohort: bool = False) -> Path:
    lines = ["BEGIN;", "SET LOCAL statement_timeout = '90s';"]
    # Cleaning logs describe the active source snapshot, so replace that snapshot atomically.
    lines.append("DELETE FROM public.data_quality;")
    # Pipeline-owned intervention examples are rebuilt atomically; live rows are preserved.
    lines.append("DELETE FROM public.interventions WHERE is_seeded = TRUE;")
    if replace_existing_cohort:
        student_ids = sorted({row["student_id"] for row in payload["students"]})
        id_list = ",".join(_sql_value(student_id) for student_id in student_ids)
        for table in ("academics", "attendance", "lms_activity", "engagement", "placement", "skills",
                      "feedback", "scores", "score_history"):
            lines.append(f"DELETE FROM public.{table} WHERE student_id IN ({id_list});")
    for table in ("faculty", "students", "academics", "attendance", "lms_activity", "placement", "skills", "feedback", "scores", "score_history", "analytics", "source_stats"):
        lines.append(_insert_sql(table, payload.get(table, [])))
    intervention_rows = payload.get("interventions", [])
    if intervention_rows:
        columns = ("student_id", "faculty_id", "type", "note", "status", "followup_date", "score_before", "score_after", "is_seeded")
        tuples = ",\n".join("(" + ",".join(_sql_value(row.get(column)) for column in columns) + ")"
                             for row in intervention_rows)
        lines.append(f"INSERT INTO public.interventions ({','.join(columns)}) VALUES\n" + tuples + ";")
    # Engagement has no natural unique key in the frozen schema. Insert only unseen events so reruns are safe.
    events = payload.get("engagement", [])
    if events:
        tuples = ",\n".join("(" + ",".join(_sql_value(row.get(key)) for key in ("student_id", "type", "name", "date", "verified")) + ")"
                              for row in events)
        lines.append("INSERT INTO public.engagement (student_id,type,name,date,verified) SELECT v.student_id,v.type,v.name,"
                     "v.date::date,v.verified FROM (VALUES\n" + tuples
                     + ") AS v(student_id,type,name,date,verified) WHERE NOT EXISTS (SELECT 1 FROM public.engagement e "
                       "WHERE e.student_id=v.student_id AND e.type=v.type AND e.name=v.name AND e.date=v.date::date);")
    quality_rows = payload.get("data_quality", [])
    if quality_rows:
        tuples = ",\n".join("(" + ",".join(_sql_value(row[key]) for key in ("source", "issue", "rows_affected", "action")) + ")"
                              for row in quality_rows)
        lines.append("INSERT INTO public.data_quality (source,issue,rows_affected,action) VALUES\n" + tuples + ";")
    lines.append("COMMIT;")
    handle = tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".sql", prefix="elevra-seed-", delete=False)
    try:
        handle.write("\n".join(line for line in lines if line))
        handle.flush()
    finally:
        handle.close()
    return Path(handle.name)


def _auth_request(url: str, key: str, method: str, path: str, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url.rstrip("/") + path, data=data, method=method,
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            content = response.read()
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Supabase Auth admin request failed ({error.code}): {detail}") from None


def _demo_specs(payload: dict, password: str) -> list[dict]:
    profiles = [row["profile"] for row in payload["scores"]]
    faculty_red = [p for p in profiles if p["mentor_faculty_id"] == "F01" and p["academic_risk"]["level"] == "Red"]
    faculty_star = [p for p in profiles if p["mentor_faculty_id"] == "F01" and p["segment"] == "Academic stars, placement unready"]
    if not faculty_red or not faculty_star:
        raise RuntimeError("Required demo personas were not generated under mentor F01")
    red = max(faculty_red, key=lambda p: (p["priority"], p["student_id"]))
    star = max(faculty_star, key=lambda p: (p["pillars"]["academic"] or 0, p["student_id"]))
    return [
        {"email": "admin@demo.edu", "role": "admin", "metadata": {"role": "admin"}},
        {"email": "faculty1@demo.edu", "role": "faculty", "metadata": {"role": "faculty", "faculty_id": "F01"}},
        {"email": "student.red@demo.edu", "role": "student", "metadata": {"role": "student", "student_id": red["student_id"]}},
        {"email": "student.star@demo.edu", "role": "student", "metadata": {"role": "student", "student_id": star["student_id"]}},
    ]


def _ensure_demo_users(payload: dict, env: dict[str, str]) -> list[dict]:
    url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    key, password = env.get("SUPABASE_SERVICE_ROLE_KEY", ""), env.get("DEMO_PASSWORD", "") or env.get("NEXT_PUBLIC_DEMO_PASSWORD", "")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for seeding")
    if not password:
        raise RuntimeError("DEMO_PASSWORD is required to seed the four demo accounts")
    existing = _auth_request(url, key, "GET", "/auth/v1/admin/users?page=1&per_page=1000")
    user_map = {user.get("email", "").lower(): user for user in existing.get("users", [])}
    linked = []
    for spec in _demo_specs(payload, password):
        user = user_map.get(spec["email"])
        if user:
            user = _auth_request(url, key, "PUT", "/auth/v1/admin/users/" + urllib.parse.quote(user["id"], safe=""),
                                 {"app_metadata": spec["metadata"]})
        else:
            user = _auth_request(url, key, "POST", "/auth/v1/admin/users",
                                 {"email": spec["email"], "password": password, "email_confirm": True,
                                  "app_metadata": spec["metadata"]})
        linked.append({"id": user["id"], "email": spec["email"], "role": spec["role"],
                       "student_id": spec["metadata"].get("student_id"),
                       "faculty_id": spec["metadata"].get("faculty_id")})
    return linked


def _upsert_user_rows(users: list[dict], database_url: str) -> None:
    tuples = []
    for user in users:
        values = (user["id"], user["email"], user["role"], user.get("student_id"), user.get("faculty_id"))
        tuples.append("(" + ",".join(_sql_value(value) for value in values) + ")")
    query = ("INSERT INTO public.users (id,email,role,student_id,faculty_id) VALUES\n" + ",\n".join(tuples)
             + "\nON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,role=EXCLUDED.role,"
               "student_id=EXCLUDED.student_id,faculty_id=EXCLUDED.faculty_id;")
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".sql", prefix="elevra-users-", delete=False) as handle:
        handle.write("BEGIN;\n" + query + "\nCOMMIT;\n")
        path = Path(handle.name)
    try:
        _run_psql(database_url, path)
    finally:
        path.unlink(missing_ok=True)


def _psycopg(database_url: str, arguments: list[str]) -> subprocess.CompletedProcess:
    """Stand-in for the two psql calls this script makes (-c <query> and -f <file>) on machines without psql."""
    import psycopg  # already a backend dependency
    try:
        with psycopg.connect(database_url, autocommit=True, connect_timeout=15) as conn:
            if "-f" in arguments:
                conn.execute(Path(arguments[arguments.index("-f") + 1]).read_text(encoding="utf-8"))
                return subprocess.CompletedProcess(arguments, 0, "", "")
            row = conn.execute(arguments[arguments.index("-c") + 1]).fetchone()
            return subprocess.CompletedProcess(arguments, 0, "" if row is None else str(row[0]) + chr(10), "")
    except Exception as exc:
        return subprocess.CompletedProcess(arguments, 1, "", str(exc))


def _psql(database_url: str, arguments: list[str], timeout: int = 30) -> subprocess.CompletedProcess:
    parsed = urllib.parse.urlparse(database_url)
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname or not parsed.username:
        raise RuntimeError("SUPABASE_DB_URL must be a valid PostgreSQL connection URL")
    if shutil.which("psql") is None:
        return _psycopg(database_url, arguments)
    password = urllib.parse.unquote(parsed.password or "")
    if not password:
        raise RuntimeError("SUPABASE_DB_URL is missing its database password")
    escape_pgpass = lambda value: value.replace("\\", "\\\\").replace(":", "\\:")
    pgpass = tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", prefix="elevra-pgpass-", delete=False)
    pgpass_path = Path(pgpass.name)
    try:
        os.chmod(pgpass_path, 0o600)
        pgpass.write(":".join(escape_pgpass(value) for value in
                               (parsed.hostname, str(parsed.port or 5432),
                                urllib.parse.unquote(parsed.path.lstrip("/")) or "postgres",
                                urllib.parse.unquote(parsed.username), password)) + "\n")
        pgpass.flush()
    finally:
        pgpass.close()
    env = os.environ.copy()
    env["PGPASSFILE"] = str(pgpass_path)
    query = urllib.parse.parse_qs(parsed.query)
    env["PGSSLMODE"] = query.get("sslmode", ["require"])[0]
    command = ["psql", "-h", parsed.hostname, "-p", str(parsed.port or 5432), "-U",
               urllib.parse.unquote(parsed.username), "-d", urllib.parse.unquote(parsed.path.lstrip("/")) or "postgres",
               "-X", "-v", "ON_ERROR_STOP=1", *arguments]
    try:
        return subprocess.run(command, capture_output=True, text=True, timeout=timeout, env=env)
    finally:
        pgpass_path.unlink(missing_ok=True)


def _run_psql(database_url: str, sql_path: Path) -> None:
    result = _psql(database_url, ["-f", str(sql_path)], timeout=120)
    if result.returncode:
        raise RuntimeError(f"Postgres seed failed: {result.stderr.strip()[-1500:]}")


def _existing_students(database_url: str) -> list[dict]:
    fields = ",".join(f"'{column}',s.{column}" for column in TABLES["students"])
    query = ("SELECT COALESCE(json_agg(json_build_object(" + fields
             + ") ORDER BY s.student_id)::text, '[]') FROM public.students s")
    result = _psql(database_url, ["-At", "-c", query])
    if result.returncode:
        raise RuntimeError("Could not verify existing student profiles before seeding")
    try:
        return json.loads(result.stdout.strip())
    except json.JSONDecodeError:
        raise RuntimeError("Could not parse existing student profiles before seeding") from None


def _student_profiles_match(existing: list[dict], payload: dict) -> bool:
    expected_by_id = {row["student_id"]: row for row in payload["students"]}
    if len(expected_by_id) != len(payload["students"]):
        return False
    columns = TABLES["students"]
    for actual in existing:
        expected = expected_by_id.get(actual.get("student_id"))
        if expected is None or any(actual.get(column) != expected.get(column) for column in columns):
            return False
    return True


def seed_database(payload: dict, create_demo_users: bool = True, replace_existing_cohort: bool = False,
                  progress: Callable[[str], None] | None = None) -> None:
    report = progress or (lambda _message: None)
    env = _load_env()
    database_url = env.get("SUPABASE_DB_URL", "")
    if not database_url:
        raise RuntimeError("SUPABASE_DB_URL is required for database seeding")
    api_url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    project_ref = urllib.parse.urlparse(api_url).hostname.split(".")[0] if urllib.parse.urlparse(api_url).hostname else ""
    if not project_ref or project_ref not in database_url:
        raise RuntimeError("Configured Supabase API URL and database connection do not identify the same project")
    if create_demo_users:
        if not env.get("SUPABASE_SERVICE_ROLE_KEY"):
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required to create demo accounts")
        if not (env.get("DEMO_PASSWORD") or env.get("NEXT_PUBLIC_DEMO_PASSWORD")):
            raise RuntimeError("DEMO_PASSWORD is required to create demo accounts")
        # Validate Auth connectivity before the database transaction, without creating any users yet.
        report("Checking Supabase Auth connection")
        _auth_request(api_url, env["SUPABASE_SERVICE_ROLE_KEY"], "GET", "/auth/v1/admin/users?page=1&per_page=1")
    # Protect existing data: this seed expects the fresh, empty schema verified before the first run.
    report("Checking target database and existing cohort")
    check = _psql(database_url, ["-At", "-c", "select count(*) from public.students"])
    if check.returncode:
        raise RuntimeError("Could not verify the target database before seeding")
    current = int(check.stdout.strip())
    expected_ids = {row["student_id"] for row in payload["students"]}
    # Allow repeat runs for exactly this generated cohort, while refusing to overwrite unrelated students.
    existing_ids = set()
    replace = False
    if current:
        existing_students = _existing_students(database_url)
        existing_ids = {student["student_id"] for student in existing_students}
        profiles_match = _student_profiles_match(existing_students, payload)
        same_cohort = existing_ids == expected_ids
        safe_extension = bool(existing_ids) and existing_ids < expected_ids and profiles_match
        if same_cohort and profiles_match:
            replace = replace_existing_cohort
        elif replace_existing_cohort and safe_extension:
            replace = True
        else:
            raise RuntimeError("Target already contains a different student cohort; refusing to mix seed data")
    sql_path = _write_sql(payload, replace_existing_cohort=replace)
    try:
        report("Writing pipeline tables in one database transaction")
        _run_psql(database_url, sql_path)
    finally:
        sql_path.unlink(missing_ok=True)
    report("Pipeline tables updated")
    if create_demo_users:
        report("Creating or updating demo accounts")
    users = _ensure_demo_users(payload, env) if create_demo_users else []
    if users:
        _upsert_user_rows(users, database_url)
    print(json.dumps({"seeded_students": len(expected_ids), "demo_accounts": len(users),
                      "data_quality_rows": len(payload.get("data_quality", []))}, sort_keys=True), flush=True)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-demo-users", action="store_true", help="load synthetic data without creating Auth accounts")
    parser.add_argument("--replace-existing-cohort", action="store_true",
                        help="replace generated source and score rows for this verified cohort")
    args = parser.parse_args()
    payload_path = ROOT / "pipeline" / "out" / "seed.json"
    if not payload_path.exists():
        raise SystemExit("Run pipeline/run.py --n <student-count> --regenerate --no-db first")
    seed_database(json.loads(payload_path.read_text(encoding="utf-8")),
                  create_demo_users=not args.skip_demo_users,
                  replace_existing_cohort=args.replace_existing_cohort)
