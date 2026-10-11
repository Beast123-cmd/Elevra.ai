import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from common.auth import Caller, require_role
from common.db import db

router = APIRouter(prefix="/admin", tags=["admin"])


class NewUser(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: Literal["student", "faculty", "admin"]
    name: str
    student_id: str | None = None
    faculty_id: str | None = None


class MentorChange(BaseModel):
    mentor_faculty_id: str


def _temp_password() -> str:
    return secrets.token_urlsafe(9)


def _check_links(body: NewUser) -> None:
    """A student/faculty login must point at an existing student/faculty record."""
    if body.role == "student":
        if not body.student_id:
            raise HTTPException(422, "student_id is required for student accounts")
        found = db().table("students").select("student_id").eq("student_id", body.student_id).execute().data
        if not found:
            raise HTTPException(404, f"No student with id {body.student_id}")
    if body.role == "faculty":
        if not body.faculty_id:
            raise HTTPException(422, "faculty_id is required for faculty accounts")
        found = db().table("faculty").select("faculty_id").eq("faculty_id", body.faculty_id).execute().data
        if not found:
            raise HTTPException(404, f"No faculty with id {body.faculty_id}")


@router.post("/users")
def create_user(body: NewUser, _: Caller = Depends(require_role("admin"))):
    _check_links(body)
    password = _temp_password()
    meta = {"role": body.role}
    if body.role == "student":
        meta["student_id"] = body.student_id
    if body.role == "faculty":
        meta["faculty_id"] = body.faculty_id
    try:
        created = db().auth.admin.create_user(
            {"email": body.email, "password": password, "email_confirm": True,
             "app_metadata": meta, "user_metadata": {"name": body.name}}
        )
    except Exception as exc:
        raise HTTPException(400, f"Could not create the account: {exc}")
    user_id = created.user.id
    try:
        db().table("users").insert(
            {"id": user_id, "email": body.email, "role": body.role,
             "student_id": body.student_id if body.role == "student" else None,
             "faculty_id": body.faculty_id if body.role == "faculty" else None}
        ).execute()
    except Exception as exc:
        db().auth.admin.delete_user(user_id)  # do not leave a half-created login behind
        raise HTTPException(500, f"Could not save the user record: {exc}")
    return {"user_id": user_id, "email": body.email, "role": body.role, "temp_password": password}


@router.post("/students/{student_id}/mentor")
def assign_mentor(student_id: str, body: MentorChange, _: Caller = Depends(require_role("admin"))):
    if not db().table("faculty").select("faculty_id").eq("faculty_id", body.mentor_faculty_id).execute().data:
        raise HTTPException(404, f"No faculty with id {body.mentor_faculty_id}")
    updated = db().table("students").update({"mentor_faculty_id": body.mentor_faculty_id}).eq("student_id", student_id).execute().data
    if not updated:
        raise HTTPException(404, f"No student with id {student_id}")
    return {"student_id": student_id, "mentor_faculty_id": body.mentor_faculty_id}
