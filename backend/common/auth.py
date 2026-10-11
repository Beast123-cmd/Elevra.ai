from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException

from common.db import db


@dataclass
class Caller:
    user_id: str
    role: str
    student_id: str | None = None
    faculty_id: str | None = None


def current_caller(authorization: str = Header(default="")) -> Caller:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Missing bearer token")
    try:
        user = db().auth.get_user(token).user
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    if user is None:
        raise HTTPException(401, "Invalid or expired token")
    meta = user.app_metadata or {}
    return Caller(user_id=user.id, role=meta.get("role", ""), student_id=meta.get("student_id"),
                  faculty_id=meta.get("faculty_id"))


def require_role(*roles: str):
    def dep(caller: Caller = Depends(current_caller)) -> Caller:
        if caller.role not in roles:
            raise HTTPException(403, "Not allowed for this role")
        return caller

    return dep
