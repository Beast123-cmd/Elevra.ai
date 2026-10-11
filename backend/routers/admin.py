import secrets
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from common.auth import Caller, require_role
from common.db import db
from routers import weekly

router = APIRouter(prefix="/admin", tags=["admin"])


DEPARTMENTS = ("Comp", "IT", "ENTC", "AI&DS")


class NewUser(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: Literal["student", "faculty", "admin"]
    name: str = Field(min_length=1, max_length=120)
    student_id: str | None = None
    faculty_id: str | None = None
    # Only needed when the student / faculty record does not exist yet: the record is created with the login.
    department: Literal["Comp", "IT", "ENTC", "AI&DS"] | None = None
    year: int | None = Field(default=None, ge=1, le=4)
    batch: str | None = None
    section: str | None = None
    gender: str | None = None
    residence: Literal["Hostel", "Day Scholar"] | None = None
    mentor_faculty_id: str | None = None


class MentorChange(BaseModel):
    mentor_faculty_id: str


def _temp_password() -> str:
    return secrets.token_urlsafe(9)


def _all_rows(table: str, columns: str) -> list[dict]:
    """PostgREST returns at most 1000 rows per request, so page through the table."""
    out: list[dict] = []
    while True:
        chunk = db().table(table).select(columns).order(columns.split(",")[0]).range(len(out), len(out) + 999).execute().data
        out += chunk
        if len(chunk) < 1000:
            return out


def _next_id(table: str, column: str, prefix: str, width: int) -> str:
    """Next free id after the highest existing one (e.g. 41500 -> 41501, F50 -> F51)."""
    rows = _all_rows(table, column)  # PostgREST caps one request at 1000 rows; the cohort has 1500 students
    numbers = [int(r[column][len(prefix):]) for r in rows if str(r[column]).startswith(prefix) and str(r[column])[len(prefix):].isdigit()]
    return f"{prefix}{(max(numbers) + 1 if numbers else 1):0{width}d}"


def _exists(table: str, column: str, value: str) -> bool:
    return bool(db().table(table).select(column).eq(column, value).execute().data)


def _prepare_record(body: NewUser) -> tuple[str | None, str | None, str | None]:
    """Make sure the student / faculty record this login points at exists, creating it when details are given.

    Returns (student_id, faculty_id, created_record) where created_record is "students"/"faculty" if a row was
    inserted here, so it can be rolled back if the login itself cannot be created."""
    if body.role == "student":
        if body.student_id and not body.student_id.isdigit():
            raise HTTPException(422, "Student id must be digits only, e.g. 42178")
        if body.student_id and _exists("students", "student_id", body.student_id):
            return body.student_id, None, None
        if not body.department or not body.year:
            raise HTTPException(404, f"No student with id {body.student_id or '(new)'}. To create a new student record, "
                                     "choose a department and year.")
        sid = body.student_id or _next_id("students", "student_id", "", 5)
        mentor = body.mentor_faculty_id or None
        if mentor and not _exists("faculty", "faculty_id", mentor):
            raise HTTPException(404, f"No faculty with id {mentor}")
        year_end = 2027 + (3 - body.year)  # keeps the batch label consistent with the seeded cohort (year 3 -> 2025-2027)
        record = {"student_id": sid, "name": body.name.strip(), "email": body.email, "department": body.department,
                  "year": body.year, "batch": body.batch or f"{year_end - 3}-{year_end}", "section": body.section,
                  "gender": body.gender, "residence": body.residence, "mentor_faculty_id": mentor}
        try:
            db().table("students").insert(record).execute()
        except Exception as exc:
            raise HTTPException(409, f"Could not create the student record: {exc}")
        return sid, None, "students"
    if body.role == "faculty":
        if body.faculty_id and _exists("faculty", "faculty_id", body.faculty_id):
            return None, body.faculty_id, None
        if not body.department:
            raise HTTPException(404, f"No faculty with id {body.faculty_id or '(new)'}. To create a new faculty record, "
                                     "choose a department.")
        fid = body.faculty_id or _next_id("faculty", "faculty_id", "F", 2)
        try:
            db().table("faculty").insert({"faculty_id": fid, "name": body.name.strip(), "department": body.department,
                                          "email": body.email}).execute()
        except Exception as exc:
            raise HTTPException(409, f"Could not create the faculty record: {exc}")
        return None, fid, "faculty"
    return None, None, None


@router.post("/users")
def create_user(body: NewUser, _: Caller = Depends(require_role("admin"))):
    if _exists("users", "email", body.email):
        raise HTTPException(409, f"An account with {body.email} already exists")
    student_id, faculty_id, created_record = _prepare_record(body)

    def undo_record() -> None:  # a record we just inserted must not outlive a failed login
        if created_record == "students":
            db().table("students").delete().eq("student_id", student_id).execute()
        elif created_record == "faculty":
            db().table("faculty").delete().eq("faculty_id", faculty_id).execute()

    password = _temp_password()
    meta = {"role": body.role}
    if student_id:
        meta["student_id"] = student_id
    if faculty_id:
        meta["faculty_id"] = faculty_id
    try:
        created = db().auth.admin.create_user(
            {"email": body.email, "password": password, "email_confirm": True,
             "app_metadata": meta, "user_metadata": {"name": body.name}}
        )
    except Exception as exc:
        undo_record()
        raise HTTPException(400, f"Could not create the account: {exc}")
    user_id = created.user.id
    try:
        db().table("users").insert(
            {"id": user_id, "email": body.email, "role": body.role, "student_id": student_id, "faculty_id": faculty_id}
        ).execute()
    except Exception as exc:
        db().auth.admin.delete_user(user_id)  # do not leave a half-created login behind
        undo_record()
        raise HTTPException(500, f"Could not save the user record: {exc}")
    return {"user_id": user_id, "email": body.email, "role": body.role, "temp_password": password,
            "student_id": student_id, "faculty_id": faculty_id, "record_created": created_record is not None}


@router.post("/students/{student_id}/mentor")
def assign_mentor(student_id: str, body: MentorChange, _: Caller = Depends(require_role("admin"))):
    if not db().table("faculty").select("faculty_id").eq("faculty_id", body.mentor_faculty_id).execute().data:
        raise HTTPException(404, f"No faculty with id {body.mentor_faculty_id}")
    updated = db().table("students").update({"mentor_faculty_id": body.mentor_faculty_id}).eq("student_id", student_id).execute().data
    if not updated:
        raise HTTPException(404, f"No student with id {student_id}")
    return {"student_id": student_id, "mentor_faculty_id": body.mentor_faculty_id}


_weekly_cache: dict[str, tuple[float, dict]] = {}


@router.get("/weekly-brief")
def weekly_brief(_: Caller = Depends(require_role("admin"))):
    """Dean's weekly summary: numbers computed here, wording by Gemini when it passes the fact check."""
    hit = _weekly_cache.get("brief")
    if hit and time.time() - hit[0] < 300:
        return hit[1]
    stats = weekly.compute_stats(
        _all_rows("students", "student_id,department"),
        _all_rows("scores", "student_id,academic_risk,placement_risk,segment"),
        _all_rows("interventions", "id,student_id,status,followup_date,created_at,is_seeded"),
    )
    result = {"stats": stats, **weekly.make_brief(stats)}
    _weekly_cache["brief"] = (time.time(), result)
    return result
