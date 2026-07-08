from ipaddress import ip_address
from typing import Any

from fastapi import Request

from app.core.db import get_conn


ACTION_LABELS = {
    ("POST", "/api/auth/login"): {
        "success": "Connexion reussie",
        "failure": "Tentative de connexion echouee",
    },
    ("POST", "/api/admin/incidents"): {
        "success": "Creation manuelle d'un incident",
        "failure": "Echec de creation manuelle d'un incident",
    },
    ("POST", "/api/admin/users"): {
        "success": "Creation d'un compte utilisateur",
        "failure": "Echec de creation d'un compte utilisateur",
    },
    ("POST", "/api/soc/incidents/{incident_id}/take"): {
        "success": "Prise en charge d'un incident",
        "failure": "Echec de prise en charge d'un incident",
    },
    ("POST", "/api/soc/incidents/{incident_id}/actions"): {
        "success": "Ajout d'une action de reponse sur incident",
        "failure": "Echec d'ajout d'une action de reponse sur incident",
    },
    ("POST", "/api/logs"): {
        "success": "Ingestion de logs applicatifs",
        "failure": "Echec d'ingestion de logs applicatifs",
    },
    ("POST", "/api/logs/raw"): {
        "success": "Ingestion de logs JSON bruts",
        "failure": "Echec d'ingestion de logs JSON bruts",
    },
    ("POST", "/api/logs/syslog"): {
        "success": "Ingestion de messages syslog",
        "failure": "Echec d'ingestion de messages syslog",
    },
    ("POST", "/api/logs/cef"): {
        "success": "Ingestion de messages CEF",
        "failure": "Echec d'ingestion de messages CEF",
    },
}


def _client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    candidate = forwarded_for.split(",", 1)[0].strip()
    if not candidate and request.client:
        candidate = request.client.host

    try:
        return str(ip_address(candidate)) if candidate else None
    except ValueError:
        return None


def _actor_username(request: Request) -> str:
    explicit_actor = getattr(request.state, "audit_actor", None)
    if explicit_actor:
        return str(explicit_actor)

    user: dict[str, Any] | None = getattr(request.state, "user", None)
    if user and user.get("username"):
        return str(user["username"])

    return "SYSTEM"


def set_audit_action(request: Request, action: str) -> None:
    request.state.audit_action = action


def _action_label(request: Request, status_code: int) -> str:
    explicit_action = getattr(request.state, "audit_action", None)
    if explicit_action and 200 <= status_code < 400:
        return str(explicit_action)

    route = request.scope.get("route")
    route_path = getattr(route, "path", request.url.path)
    labels = ACTION_LABELS.get((request.method, route_path)) or ACTION_LABELS.get((request.method, request.url.path))
    if not labels:
        candidates = {route_path, request.url.path}
        for (method, path), mapped_labels in ACTION_LABELS.items():
            if method != request.method:
                continue
            if any(candidate == path or candidate.endswith(path) or path.endswith(candidate) for candidate in candidates):
                labels = mapped_labels
                break
    outcome = "success" if 200 <= status_code < 400 else "failure"

    if labels:
        return labels[outcome]

    if request.method == "POST":
        return "Operation applicative enregistree" if outcome == "success" else "Echec d'operation applicative"
    if outcome == "success":
        return "Modification applicative enregistree"
    return "Echec de modification applicative"


def audit_post_request(request: Request, status_code: int) -> None:
    action = _action_label(request, status_code)

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO audit_logs (actor_username, action, ip_address)
            VALUES (%s, %s, %s)
            """,
            [_actor_username(request), action, _client_ip(request)],
        )
        conn.commit()
