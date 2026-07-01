"""Routes API SOC - gestion operationnelle des incidents."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.core.db import get_conn
from app.routers.admin import STATUS_LABEL, _fmt_iso, _inc_id
from app.routers.admin import dashboard as admin_dashboard
from app.routers.admin import incidents as admin_incidents
from app.routers.admin import playbooks as admin_playbooks
from app.routers.admin import search_logs as admin_search_logs
from app.routers.admin import update_incident_status as admin_update_incident_status
from app.routers.admin import users as admin_users

router = APIRouter(prefix="/api/soc", tags=["soc"])

VALID_EXECUTION_STATUSES = {"En attente", "Succès", "Échec"}
MANUAL_PLAYBOOK_NAME = "Action manuelle SOC"


class TakeIncidentPayload(BaseModel):
    analyst_id: UUID


class IncidentActionPayload(BaseModel):
    analyst_id: UUID
    action_note: str
    execution_status: str = "Succès"

    @field_validator("action_note")
    @classmethod
    def _valid_note(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("La note d'action est obligatoire")
        return value

    @field_validator("execution_status")
    @classmethod
    def _valid_execution_status(cls, value: str) -> str:
        value = value.strip()
        if value not in VALID_EXECUTION_STATUSES:
            raise ValueError("Statut d'execution invalide")
        return value


def _incident_lookup_clause(incident_id: str) -> tuple[str, list[Any]]:
    normalized = incident_id.strip()
    if normalized.upper().startswith("INC-"):
        prefix = normalized[4:].replace("-", "").upper()
        if not prefix:
            raise HTTPException(400, "Identifiant incident invalide")
        return "upper(replace(i.id::text, '-', '')) LIKE %s", [f"{prefix}%"]

    try:
        UUID(normalized)
    except ValueError as exc:
        raise HTTPException(400, "Identifiant incident invalide") from exc
    return "i.id = %s", [normalized]


def _get_incident(cur, incident_id: str) -> dict:
    clause, params = _incident_lookup_clause(incident_id)
    cur.execute(
        f"""
        SELECT i.*, u.username AS assignee, ar.rule_name
        FROM incidents i
        LEFT JOIN users u ON u.id = i.assigned_to
        LEFT JOIN alerts a ON a.id = i.alert_id
        LEFT JOIN attack_rules ar ON ar.id = a.rule_id
        WHERE {clause}
        LIMIT 1
        """,
        params,
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Incident introuvable")
    return row


def _get_authorized_analyst(cur, analyst_id: UUID) -> dict:
    cur.execute(
        """
        SELECT id, username, role
        FROM users
        WHERE id = %s
        """,
        [analyst_id],
    )
    user = cur.fetchone()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    if user["role"] not in {"Analyste", "Admin"}:
        raise HTTPException(403, "Utilisateur non autorise a traiter un incident")
    return user


def _ensure_manual_playbook(cur) -> dict:
    cur.execute(
        """
        SELECT id, action_name
        FROM playbooks
        WHERE action_name = %s
        ORDER BY id
        LIMIT 1
        """,
        [MANUAL_PLAYBOOK_NAME],
    )
    playbook = cur.fetchone()
    if playbook:
        return playbook

    cur.execute(
        """
        INSERT INTO playbooks (attack_type, action_name, description, is_automatic)
        VALUES (NULL, %s, %s, false)
        RETURNING id, action_name
        """,
        [MANUAL_PLAYBOOK_NAME, "Action manuelle ajoutee depuis le dashboard SOC."],
    )
    return cur.fetchone()


def _map_take_response(row: dict) -> dict:
    return {
        "id": _inc_id(row["id"]),
        "uuid": str(row["id"]),
        "title": row["title"],
        "status": STATUS_LABEL.get(row["status"], row["status"]),
        "assigned_to": row.get("assignee"),
        "updated_at": _fmt_iso(row.get("updated_at")),
    }


@router.get("/dashboard")
def dashboard():
    return admin_dashboard()


@router.get("/incidents")
def incidents(status: str | None = Query(None)):
    return admin_incidents(status=status)


@router.patch("/incidents/{incident_id}/status")
def update_incident_status(incident_id: str, status: str = Query(...)):
    return admin_update_incident_status(incident_id=incident_id, status=status)


@router.get("/logs/search")
def search_logs(q: str = Query(""), range: str = Query("24h"), limit: int = Query(50, le=500)):
    return admin_search_logs(q=q, range=range, limit=limit)


@router.get("/playbooks")
def playbooks():
    return admin_playbooks()


@router.get("/users")
def users():
    return admin_users()


@router.post("/incidents/{incident_id}/take")
def take_incident(incident_id: str, payload: TakeIncidentPayload):
    with get_conn() as conn:
        cur = conn.cursor()
        _get_incident(cur, incident_id)
        _get_authorized_analyst(cur, payload.analyst_id)

        clause, params = _incident_lookup_clause(incident_id)
        cur.execute(
            f"""
            UPDATE incidents i
            SET assigned_to = %s,
                status = 'IN_PROGRESS',
                updated_at = now(),
                closed_at = NULL
            WHERE {clause}
            RETURNING i.*
            """,
            [payload.analyst_id, *params],
        )
        updated = cur.fetchone()
        if not updated:
            raise HTTPException(404, "Incident introuvable")

        cur.execute("SELECT username FROM users WHERE id = %s", [updated["assigned_to"]])
        assignee = cur.fetchone()
        conn.commit()

    updated["assignee"] = assignee["username"] if assignee else None
    return {"success": True, "incident": _map_take_response(updated)}


@router.post("/incidents/{incident_id}/actions")
def add_incident_action(incident_id: str, payload: IncidentActionPayload):
    with get_conn() as conn:
        cur = conn.cursor()
        incident = _get_incident(cur, incident_id)
        analyst = _get_authorized_analyst(cur, payload.analyst_id)
        playbook = _ensure_manual_playbook(cur)

        cur.execute(
            """
            INSERT INTO incident_actions (
                incident_id,
                playbook_id,
                executed_by,
                execution_status,
                execution_time,
                action_note
            )
            VALUES (%s, %s, %s, %s, now(), %s)
            RETURNING id, incident_id, executed_by, execution_status, execution_time, action_note
            """,
            [
                incident["id"],
                playbook["id"],
                payload.analyst_id,
                payload.execution_status,
                payload.action_note,
            ],
        )
        action = cur.fetchone()
        conn.commit()

    return {
        "success": True,
        "action": {
            "id": str(action["id"]),
            "incident_id": str(action["incident_id"]),
            "executed_by": analyst["username"],
            "execution_status": action["execution_status"],
            "execution_time": _fmt_iso(action["execution_time"]),
            "action_note": action.get("action_note") or "",
        },
    }


@router.get("/incidents/{incident_id}/actions")
def incident_actions(incident_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        incident = _get_incident(cur, incident_id)
        cur.execute(
            """
            SELECT ia.id,
                   p.action_name,
                   ia.action_note,
                   COALESCE(u.username, 'SYSTEM') AS executed_by,
                   ia.execution_status,
                   ia.execution_time
            FROM incident_actions ia
            JOIN playbooks p ON p.id = ia.playbook_id
            LEFT JOIN users u ON u.id = ia.executed_by
            WHERE ia.incident_id = %s
            ORDER BY ia.execution_time ASC NULLS LAST, ia.id ASC
            """,
            [incident["id"]],
        )
        rows = cur.fetchall()

    return [
        {
            "id": str(row["id"]),
            "action_name": row["action_name"],
            "action_note": row.get("action_note") or "",
            "executed_by": row["executed_by"],
            "execution_status": row["execution_status"],
            "execution_time": _fmt_iso(row.get("execution_time")),
        }
        for row in rows
    ]
