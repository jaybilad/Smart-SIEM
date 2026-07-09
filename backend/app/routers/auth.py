import hashlib
import hmac

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, field_validator

from app.core.db import get_conn
from app.core.security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginPayload(BaseModel):
    username: str
    password: str

    @field_validator("username", "password")
    @classmethod
    def _required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Champ obligatoire")
        return value


def _dashboard_path(role: str) -> str:
    if role == "Admin":
        return "/dashboard-admin"
    if role == "Analyste":
        return "/dashboard-soc"
    return "/dashboard-lecteur"


@router.post("/login")
def login(payload: LoginPayload, request: Request):
    username = payload.username.strip().lower()
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id,
                   username,
                   email,
                   role,
                   scope,
                   is_active,
                   password_hash
            FROM soc_users
            WHERE lower(username) = %s
            LIMIT 1
            """,
            [username],
        )
        user = cur.fetchone()
        if not user or not user["is_active"]:
            raise HTTPException(401, "Identifiants invalides")

        password_hash = hashlib.sha256(payload.password.encode("utf-8")).hexdigest()
        if not hmac_compare(password_hash, user["password_hash"]):
            raise HTTPException(401, "Identifiants invalides")

    user_payload = {
        "id": str(user["id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "scope": user["scope"],
    }
    token = create_access_token(
        subject=str(user["id"]),
        claims={"username": user["username"], "role": user["role"], "scope": user["scope"]},
    )
    request.state.audit_actor = user["username"]
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_payload,
        "redirect_to": _dashboard_path(user["role"]),
    }


def hmac_compare(left: str, right: str) -> bool:
    return hmac.compare_digest(left, right)


@router.get("/me")
def me(request: Request):
    payload = getattr(request.state, "user", None)
    if not payload:
        raise HTTPException(401, "Authentification requise")

    return {
        "id": payload.get("sub"),
        "username": payload.get("username"),
        "role": payload.get("role"),
        "scope": payload.get("scope"),
    }
