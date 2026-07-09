"""Routes API admin adaptees au nouveau schema PostgreSQL + logs Elasticsearch."""

import hashlib
import json
from ipaddress import ip_address
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, field_validator

from app.core.db import get_conn
from app.core.es_client import ElasticsearchError, count_logs, search_logs as es_search_logs
from app.services.audit import set_audit_action

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_SEVERITIES = {"INFO", "WARNING", "HIGH", "CRITICAL"}
VALID_ROLES = {"Admin", "Analyste", "Lecteur"}
VALID_SCOPES = {"Global", "Reseau_Interne", "Serveurs_Critiques", "Frontiere"}
MITRE_ATTACK_TYPE = {
    "T1110": "BRUTE_FORCE",
    "T1046": "NETWORK_SCANNING",
    "T1021": "LATERAL_MOVEMENT",
    "T1020": "DATA_EXFILTRATION",
    "T1078": "ANOMALOUS_LOGIN",
}

STATUS_LABEL = {
    "OPEN": "Ouvert",
    "IN_PROGRESS": "En cours",
    "RESOLVED": "Resolu",
    "CLOSED": "Cloture",
}
STATUS_FILTER = {v: k for k, v in STATUS_LABEL.items()}
STATUS_FILTER.update({"Résolu": "RESOLVED", "Clôturé": "CLOSED", "Tous": "Tous"})

RANGE_SECONDS = {"1h": 3600, "6h": 21600, "24h": 86400, "7j": 604800, "30j": 2592000}


def _inc_id(uuid_val) -> str:
    return f"INC-{str(uuid_val).replace('-', '')[:8].upper()}"


def _alert_id(uuid_val) -> str:
    return f"ALT-{str(uuid_val).replace('-', '')[:8].upper()}"


def _fmt_time(ts) -> str:
    if ts is None:
        return "-"
    if isinstance(ts, str):
        return ts
    return ts.strftime("%H:%M")


def _fmt_datetime(ts) -> str:
    if ts is None:
        return "-"
    if isinstance(ts, str):
        return ts
    return ts.strftime("%Y-%m-%d %H:%M")


def _fmt_iso(ts) -> str:
    if ts is None:
        return ""
    if isinstance(ts, str):
        return ts
    return ts.isoformat()


def _map_incident(row: dict) -> dict:
    target_type = row.get("target_type")
    return {
        "id": _inc_id(row["id"]),
        "uuid": str(row["id"]),
        "title": row["title"],
        "description": row.get("description") or "-",
        "rule": row.get("rule_name") or "-",
        "sev": row["severity"],
        "status": STATUS_LABEL.get(row["status"], row["status"]),
        "src": str(row["source_ip"]) if row.get("source_ip") else "-",
        "target": row.get("target") or "-",
        "time": _fmt_time(row.get("created_at")),
        "created_at": _fmt_iso(row.get("created_at")),
        "assignee": row.get("assignee"),
        "machine": row.get("target") if target_type == "HOST" else "-",
        "ueba": row.get("global_risk_score") or 0,
    }


def _map_user(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "username": row["username"],
        "role": row["role"],
        "scope": row["scope"],
        "status": "Actif" if row.get("is_active") else "Inactif",
        "last": _fmt_datetime(row.get("created_at")),
    }


def _map_alert(row: dict) -> dict:
    incident_id = row.get("linked_incident_id")
    return {
        "id": _alert_id(row["id"]),
        "uuid": str(row["id"]),
        "title": row["title"],
        "attackType": row["attack_type"],
        "sev": row["severity"],
        "confidence": min(max(row.get("score_impact") or 0, 0), 100),
        "status": row["status"],
        "createdAt": _fmt_iso(row.get("created_at")),
        "sourceIp": str(row["source_ip"]) if row.get("source_ip") else "-",
        "user": row.get("target_name") if row.get("target_type") == "USER" else "N/A",
        "target": row.get("target_name") or "-",
        "incidentId": _inc_id(incident_id) if incident_id else None,
        "incidentUuid": str(incident_id) if incident_id else None,
    }


def _parse_search_query(query: str) -> dict[str, str]:
    filters: dict[str, str] = {}
    for part in query.split():
        if ":" in part:
            key, _, value = part.partition(":")
            filters[key.strip().lower()] = value.strip()
    return filters


def _es_range(seconds: int) -> dict[str, Any]:
    return {"range": {"timestamp": {"gte": f"now-{seconds}s", "lte": "now"}}}


def _empty_es_search() -> dict[str, Any]:
    return {"hits": {"total": {"value": 0}, "hits": []}, "aggregations": {}}


def _safe_es_search(body: dict[str, Any]) -> dict[str, Any]:
    try:
        return es_search_logs(body)
    except ElasticsearchError:
        return _empty_es_search()


def _safe_es_count(body: dict[str, Any]) -> int:
    try:
        return count_logs(body)
    except ElasticsearchError:
        return 0


def _incident_select(where: str = "", order_limit: str = "") -> str:
    return f"""
        SELECT i.*,
               u.username AS assignee,
               cr.rule_name,
               mt.name AS target,
               mt.target_type,
               mt.global_risk_score
        FROM incidents i
        LEFT JOIN soc_users u ON u.id = i.assigned_to
        LEFT JOIN alerts a ON a.incident_id = i.id
        LEFT JOIN correlation_rules cr ON cr.id = a.rule_id
        LEFT JOIN monitored_targets mt ON mt.id = a.target_id
        {where}
        GROUP BY i.id, u.username, cr.rule_name, mt.name, mt.target_type, mt.global_risk_score
        {order_limit}
    """


def _incident_where(*clauses: str) -> str:
    all_clauses = ["i.is_deleted = false", *[clause for clause in clauses if clause]]
    return f"WHERE {' AND '.join(all_clauses)}"


def _alert_select(where: str = "", order_limit: str = "") -> str:
    return f"""
        SELECT a.*,
               CASE WHEN i.id IS NULL THEN NULL ELSE a.incident_id END AS linked_incident_id,
               i.source_ip,
               mt.name AS target_name,
               mt.target_type
        FROM alerts a
        LEFT JOIN incidents i ON i.id = a.incident_id AND i.is_deleted = false
        LEFT JOIN monitored_targets mt ON mt.id = a.target_id
        {where}
        {order_limit}
    """


def _uuid_lookup_clause(alias: str, value: str, display_prefix: str) -> tuple[str, list[Any]]:
    normalized = value.strip()
    if normalized.upper().startswith(f"{display_prefix}-"):
        prefix = normalized[len(display_prefix) + 1 :].replace("-", "").upper()
        if not prefix:
            raise HTTPException(400, "Identifiant invalide")
        return f"upper(replace({alias}.id::text, '-', '')) LIKE %s", [f"{prefix}%"]
    try:
        UUID(normalized)
    except ValueError as exc:
        raise HTTPException(400, "Identifiant invalide") from exc
    return f"{alias}.id = %s", [normalized]


class IncidentCreate(BaseModel):
    title: str
    description: str | None = None
    severity: str
    attack_type: str
    source_ip: str | None = None
    target: str | None = None
    assigned_to: UUID | None = None

    @field_validator("title", "severity", "attack_type")
    @classmethod
    def _required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Champ obligatoire")
        return value

    @field_validator("description", "source_ip", "target", mode="before")
    @classmethod
    def _blank_to_none(cls, value):
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("severity")
    @classmethod
    def _valid_severity(cls, value: str) -> str:
        value = value.upper()
        if value not in VALID_SEVERITIES:
            raise ValueError("Niveau de criticite invalide")
        return value

    @field_validator("attack_type")
    @classmethod
    def _normalize_attack_type(cls, value: str) -> str:
        return value.upper()

    @field_validator("source_ip")
    @classmethod
    def _valid_source_ip(cls, value: str | None) -> str | None:
        if value:
            try:
                ip_address(value)
            except ValueError as exc:
                raise ValueError("Adresse IP source invalide") from exc
        return value


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str
    scope: str
    is_active: bool = True

    @field_validator("username", "email", "password", "role", "scope")
    @classmethod
    def _required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Champ obligatoire")
        return value

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str) -> str:
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Email invalide")
        return value.lower()

    @field_validator("role")
    @classmethod
    def _valid_role(cls, value: str) -> str:
        if value not in VALID_ROLES:
            raise ValueError("Role invalide")
        return value

    @field_validator("scope")
    @classmethod
    def _valid_scope(cls, value: str) -> str:
        if value not in VALID_SCOPES:
            raise ValueError("Perimetre invalide")
        return value


class RuleCreate(BaseModel):
    name: str
    sev: str | None = None
    severity: str | None = None
    threshold: int = 1
    window: int = 60
    desc: str = ""
    playbook: str
    mitre_technique: str | None = None
    attack_type: str | None = None

    @field_validator("name", "playbook")
    @classmethod
    def _required_rule_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Champ obligatoire")
        return value

    @field_validator("threshold", "window")
    @classmethod
    def _positive_number(cls, value: int) -> int:
        if value < 1:
            raise ValueError("Valeur numerique invalide")
        return value

    @property
    def normalized_severity(self) -> str:
        value = (self.severity or self.sev or "WARNING").upper()
        if value not in VALID_SEVERITIES:
            raise HTTPException(400, "Niveau de criticite invalide")
        return value

    @property
    def normalized_attack_type(self) -> str:
        value = (self.attack_type or MITRE_ATTACK_TYPE.get(self.mitre_technique or "", "")).upper()
        if not value:
            raise HTTPException(400, "Type d'attaque obligatoire")
        return value


class RuleStatusUpdate(BaseModel):
    is_active: bool


@router.patch("/rules/{rule_id}/status")
def update_rule_status(rule_id: str, payload: RuleStatusUpdate, request: Request):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM correlation_rules WHERE id = %s", [rule_id])
        if not cur.fetchone():
            raise HTTPException(404, "Règle de corrélation introuvable")
        cur.execute(
            "UPDATE correlation_rules SET is_active = %s WHERE id = %s RETURNING id, is_active",
            [payload.is_active, rule_id],
        )
        row = cur.fetchone()
        conn.commit()
    set_audit_action(request, f"{'Activation' if row['is_active'] else 'Désactivation'} de la règle de corrélation {row['id']}")
    return {"id": str(row["id"]), "is_active": row["is_active"]}


@router.get("/dashboard")
def dashboard():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS')) AS active,
                   COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS') AND severity = 'CRITICAL') AS critical
            FROM incidents
            WHERE is_deleted = false
            """
        )
        inc_stats = cur.fetchone()
        cur.execute("SELECT COUNT(*) AS cnt FROM alerts WHERE created_at >= now() - interval '24 hours'")
        alerts_24h = cur.fetchone()["cnt"]
        cur.execute(
            """
            SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(closed_at, updated_at) - created_at)) / 60) AS mttr
            FROM incidents
            WHERE status IN ('RESOLVED', 'CLOSED')
              AND is_deleted = false
            """
        )
        mttr_row = cur.fetchone()
        cur.execute("SELECT COUNT(*) AS cnt FROM incidents WHERE status IN ('RESOLVED', 'CLOSED') AND is_deleted = false")
        resolved_count = cur.fetchone()["cnt"]
        cur.execute(
            """
            SELECT to_char(date_trunc('hour', created_at), 'HH24"h"') AS t,
                   COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS c,
                   COUNT(*) FILTER (WHERE severity = 'HIGH') AS h,
                   COUNT(*) FILTER (WHERE severity = 'WARNING') AS m
            FROM incidents
            WHERE created_at >= now() - interval '24 hours'
              AND is_deleted = false
            GROUP BY 1
            ORDER BY MIN(created_at)
            """
        )
        trend = cur.fetchall()
        cur.execute(
            """
            SELECT severity, COUNT(*) AS count
            FROM incidents
            WHERE status IN ('OPEN', 'IN_PROGRESS')
              AND is_deleted = false
            GROUP BY severity
            """
        )
        sev_map = {r["severity"]: r["count"] for r in cur.fetchall()}
        cur.execute(_incident_select(where=_incident_where(), order_limit="ORDER BY i.created_at DESC LIMIT 5"))
        recent = [_map_incident(r) for r in cur.fetchall()]
        cur.execute("SELECT COUNT(*) AS cnt FROM incidents WHERE status IN ('OPEN', 'IN_PROGRESS') AND severity = 'HIGH' AND is_deleted = false")
        high_open = cur.fetchone()["cnt"]
        cur.execute(
            """
            SELECT global_risk_score AS max_score, name AS top_user
            FROM monitored_targets
            ORDER BY global_risk_score DESC
            LIMIT 1
            """
        )
        risk_row = cur.fetchone()

    total_logs = _safe_es_count({"query": _es_range(RANGE_SECONDS["24h"])})
    es_summary = _safe_es_search(
        {
            "size": 0,
            "query": _es_range(RANGE_SECONDS["24h"]),
            "aggs": {
                "top_ips": {"terms": {"field": "source_ip", "size": 5}},
                "log_volume": {"date_histogram": {"field": "timestamp", "calendar_interval": "hour", "format": "HH'h'"}},
                "risky_hosts": {"cardinality": {"field": "host"}},
            },
        }
    )
    aggs = es_summary.get("aggregations", {})
    total_active = sum(sev_map.values()) or 1
    severity_distribution = [
        {"label": sev, "count": sev_map.get(sev, 0), "pct": round(sev_map.get(sev, 0) / total_active * 100)}
        for sev in ("CRITICAL", "HIGH", "WARNING")
    ]
    top_ips = [{"ip": b["key"], "count": b["doc_count"], "sev": "HIGH"} for b in aggs.get("top_ips", {}).get("buckets", [])]
    log_volume = [{"t": b.get("key_as_string"), "v": b["doc_count"]} for b in aggs.get("log_volume", {}).get("buckets", [])]

    return {
        "stats": {
            "active_incidents": inc_stats["active"] or 0,
            "critical_incidents": inc_stats["critical"] or 0,
            "alerts_24h": alerts_24h,
            "ingestion_rate": round(total_logs / RANGE_SECONDS["24h"], 2),
            "mttr_minutes": round(mttr_row["mttr"]) if mttr_row and mttr_row["mttr"] else 0,
            "resolved_count": resolved_count,
        },
        "trend": trend or [{"t": "00h", "c": 0, "h": 0, "m": 0}],
        "severity_distribution": severity_distribution,
        "recent_incidents": recent,
        "soc": {
            "high_open_incidents": high_open,
            "high_risk_hosts": aggs.get("risky_hosts", {}).get("value", 0),
            "ueba_max_score": risk_row["max_score"] if risk_row else 0,
            "ueba_top_user": risk_row["top_user"] if risk_row else None,
            "log_volume": log_volume,
            "top_ips": top_ips,
        },
    }


@router.get("/incidents")
def incidents(status: str | None = Query(None)):
    params: list[Any] = []
    clauses: list[str] = []
    if status and status != "Tous":
        db_status = STATUS_FILTER.get(status)
        if not db_status:
            raise HTTPException(400, f"Statut inconnu : {status}")
        clauses.append("i.status = %s")
        params.append(db_status)
    where = _incident_where(*clauses)
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(_incident_select(where=where, order_limit="ORDER BY i.created_at DESC"), params)
        rows = cur.fetchall()
    return [_map_incident(r) for r in rows]


@router.post("/incidents", status_code=201)
def create_incident(payload: IncidentCreate, request: Request):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM correlation_rules WHERE attack_type = %s LIMIT 1", [payload.attack_type])
        if not cur.fetchone():
            raise HTTPException(400, f"Type d'attaque inconnu : {payload.attack_type}")
        if payload.assigned_to:
            cur.execute("SELECT 1 FROM soc_users WHERE id = %s AND role = 'Analyste'", [payload.assigned_to])
            if not cur.fetchone():
                raise HTTPException(400, "L'incident ne peut etre assigne qu'a un analyste")
        description = payload.description
        if payload.target:
            description = f"{description or ''}\nCible: {payload.target}".strip()
        cur.execute(
            """
            INSERT INTO incidents (title, description, severity, status, source_ip, assigned_to, created_at, updated_at)
            VALUES (%s, %s, %s, 'OPEN', %s, %s, now(), now())
            RETURNING *
            """,
            [payload.title, description, payload.severity, payload.source_ip, payload.assigned_to],
        )
        row = cur.fetchone()
        assignee = None
        if row.get("assigned_to"):
            cur.execute("SELECT username FROM soc_users WHERE id = %s", [row["assigned_to"]])
            assignee = cur.fetchone()
        conn.commit()

    row["assignee"] = assignee["username"] if assignee else None
    set_audit_action(request, f"Creation de l'incident manuel {_inc_id(row['id'])} '{row['title']}'")
    return _map_incident(row)


@router.patch("/incidents/{incident_id}/status")
def update_incident_status(incident_id: str, request: Request, status: str = Query(...)):
    db_status = STATUS_FILTER.get(status)
    if not db_status:
        raise HTTPException(400, f"Statut inconnu : {status}")
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE incidents
            SET status = %s,
                updated_at = now(),
                closed_at = CASE WHEN %s IN ('RESOLVED', 'CLOSED') THEN COALESCE(closed_at, now()) ELSE NULL END
            WHERE id = %s
              AND is_deleted = false
            RETURNING *
            """,
            [db_status, db_status, incident_id],
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Incident introuvable")
        conn.commit()
    set_audit_action(request, f"Changement du statut de l'incident {_inc_id(row['id'])}")
    return _map_incident(row)


@router.post("/incidents/{incident_id}/delete")
def soft_delete_incident(incident_id: str, request: Request):
    clause, params = _uuid_lookup_clause("i", incident_id, "INC")
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""
            UPDATE incidents i
            SET is_deleted = true,
                updated_at = now()
            WHERE {clause}
              AND i.is_deleted = false
            RETURNING i.*
            """,
            params,
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Incident introuvable")
        conn.commit()
    set_audit_action(request, f"Suppression logique de l'incident {_inc_id(row['id'])}")
    return _map_incident(row)


@router.get("/logs/search")
def search_logs(q: str = Query(""), range: str = Query("24h"), limit: int = Query(50, le=500)):
    seconds = RANGE_SECONDS.get(range, RANGE_SECONDS["24h"])
    filters = _parse_search_query(q)
    must: list[dict[str, Any]] = [_es_range(seconds)]
    field_map = {"src_ip": "source_ip", "source_ip": "source_ip", "sev": "severity", "severity": "severity", "user": "username", "event_type": "event_type"}
    for key, field in field_map.items():
        value = filters.get(key)
        if value and value != "*":
            clause = {"wildcard": {field: value.replace("*", "").lower() + "*"}} if "*" in value else {"term": {field: value.upper() if field == "severity" else value}}
            must.append(clause)
    if q.strip() and not filters:
        must.append(
            {
                "multi_match": {
                    "query": q.strip(),
                    "fields": ["raw_message", "event_type", "username", "host", "source_ip"],
                    "lenient": True,
                }
            }
        )
    body = {
        "size": limit,
        "query": {"bool": {"must": must}},
        "sort": [{"timestamp": {"order": "desc"}}],
        "aggs": {
            "unique_sources": {"cardinality": {"field": "source_ip"}},
            "unique_users": {"cardinality": {"field": "username"}},
            "volume": {"date_histogram": {"field": "timestamp", "calendar_interval": "hour", "format": "HH'h'"}},
        },
    }
    response = _safe_es_search(body)
    aggs = response.get("aggregations", {})
    hits = response.get("hits", {})
    total = hits.get("total", {}).get("value", 0) if isinstance(hits.get("total"), dict) else hits.get("total", 0)
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(DISTINCT id) AS triggered_rules FROM alerts WHERE created_at >= now() - make_interval(secs => %s)", [seconds])
        triggered = cur.fetchone()["triggered_rules"]
    results = []
    for hit in hits.get("hits", []):
        src = hit.get("_source", {})
        results.append(
            {
                "id": hit.get("_id"),
                "ts": src.get("timestamp") or "",
                "src": src.get("source_ip") or "-",
                "dst": src.get("destination_ip") or "-",
                "event": src.get("event_type") or src.get("log_type") or "-",
                "user": src.get("username") or "N/A",
                "detail": src.get("raw_message") or "-",
                "sev": (src.get("severity") or "INFO").upper(),
                "machine": src.get("host") or "N/A",
            }
        )
    return {
        "stats": {
            "total_events": total,
            "unique_sources": aggs.get("unique_sources", {}).get("value", 0),
            "unique_users": aggs.get("unique_users", {}).get("value", 0),
            "triggered_rules": triggered,
        },
        "volume": [{"h": b.get("key_as_string"), "v": b["doc_count"]} for b in aggs.get("volume", {}).get("buckets", [])],
        "results": results,
    }


@router.get("/playbooks")
def playbooks():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT p.id, p.action_name, p.description, p.is_automatic,
                   COUNT(DISTINCT ia.id) AS triggers,
                   MAX(ia.execution_time) AS last_run,
                   MAX(cr.severity_enum::text) AS top_severity,
                   ARRAY_REMOVE(ARRAY_AGG(DISTINCT cr.rule_name), NULL) AS rules
            FROM playbooks p
            LEFT JOIN incident_actions ia ON ia.playbook_id = p.id
            LEFT JOIN correlation_rules cr ON cr.playbook_id = p.id
            GROUP BY p.id, p.action_name, p.description, p.is_automatic
            ORDER BY p.action_name
            """
        )
        rows = cur.fetchall()
    return [
        {"id": str(r["id"]), "name": r["action_name"], "desc": r.get("description") or "-", "auto": r["is_automatic"], "triggers": r["triggers"], "lastRun": r["last_run"].strftime("%Y-%m-%d") if r["last_run"] else "-", "sev": r.get("top_severity") or "HIGH", "rules": r.get("rules") or []}
        for r in rows
    ]


@router.get("/ueba")
def ueba():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS cnt FROM monitored_targets")
        monitored = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*) AS cnt FROM monitored_targets WHERE global_risk_score > 80")
        critical = cur.fetchone()["cnt"]
        cur.execute("SELECT COALESCE(SUM(anomalies_count), 0) AS cnt FROM monitored_targets")
        anomalies = cur.fetchone()["cnt"]
        cur.execute("SELECT * FROM monitored_targets ORDER BY global_risk_score DESC, name")
        rows = cur.fetchall()
    return {
        "stats": {"monitored": monitored, "critical": critical, "anomalies_7d": anomalies},
        "rows": [
            {"user": r["name"], "score": r["global_risk_score"], "anomalies": r["anomalies_count"], "last": _fmt_time(r.get("last_activity_at")), "delta": "0", "detail": r["target_type"], "model_version": "baseline"}
            for r in rows
        ],
    }


@router.get("/users")
def users():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, username, role, scope, is_active, created_at FROM soc_users ORDER BY username")
        rows = cur.fetchall()
    return [_map_user(r) for r in rows]


@router.post("/users", status_code=201)
def create_user(payload: UserCreate, request: Request):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM soc_users WHERE username = %s", [payload.username])
        if cur.fetchone():
            raise HTTPException(400, "Nom d'utilisateur deja utilise")
        cur.execute("SELECT 1 FROM soc_users WHERE email = %s", [payload.email])
        if cur.fetchone():
            raise HTTPException(400, "Email deja utilise")
        cur.execute("SELECT 1 FROM monitored_targets WHERE name = %s OR email = %s", [payload.username, payload.email])
        if cur.fetchone():
            raise HTTPException(400, "Cible surveillee deja existante pour cet utilisateur")
        password_hash = hashlib.sha256(payload.password.encode("utf-8")).hexdigest()
        cur.execute(
            """
            INSERT INTO soc_users (username, email, password_hash, role, scope, is_active, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, now())
            RETURNING id, username, role, scope, is_active, created_at
            """,
            [payload.username, payload.email, password_hash, payload.role, payload.scope, payload.is_active],
        )
        row = cur.fetchone()
        criticality = 3 if payload.role == "Admin" else 2 if payload.role == "Analyste" else 1
        target_status = "Actif" if payload.is_active else "Verrouille"
        cur.execute(
            """
            INSERT INTO monitored_targets (
                name,
                target_type,
                email,
                status,
                asset_criticality,
                global_risk_score,
                anomalies_count,
                last_activity_at,
                updated_at
            )
            VALUES (%s, 'USER', %s, %s, %s, 0, 0, now(), now())
            RETURNING id
            """,
            [payload.username, payload.email, target_status, criticality],
        )
        target_row = cur.fetchone()
        cur.execute(
            """
            INSERT INTO ueba_baselines (
                target_id,
                allowed_start_time,
                allowed_end_time,
                normal_daily_volume_mb
            )
            VALUES (%s, %s, %s, %s)
            """,
            [target_row["id"], "09:00", "18:00", 50.00],
        )
        conn.commit()
    set_audit_action(request, f"Creation du compte utilisateur '{row['username']}' et de sa cible surveillee")
    return _map_user(row)


@router.get("/rules")
def rules():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT cr.*, p.action_name AS playbook
            FROM correlation_rules cr
            LEFT JOIN playbooks p ON p.id = cr.playbook_id
            ORDER BY cr.rule_name
            """
        )
        rows = cur.fetchall()
    mapped = []
    for r in rows:
        try:
            condition = json.loads(r.get("rule_condition") or "{}")
        except json.JSONDecodeError:
            condition = {}
        mapped.append(
            {
                "id": str(r["id"]),
                "name": r["rule_name"],
                "sev": r["severity_enum"],
                "on": r["is_active"],
                "threshold": condition.get("threshold") or condition.get("unique_ports_threshold") or "-",
                "window": condition.get("time_window_seconds") or "-",
                "desc": r.get("rule_condition") or "",
                "playbook": r.get("playbook") or "-",
                "attack_type": r["attack_type"],
            }
        )
    return mapped


@router.post("/rules", status_code=201)
def create_rule(payload: RuleCreate, request: Request):
    attack_type = payload.normalized_attack_type
    severity = payload.normalized_severity
    rule_condition = json.dumps(
        {
            "threshold": payload.threshold,
            "time_window_seconds": payload.window,
            "description": payload.desc,
            "mitre_technique": payload.mitre_technique,
        },
        ensure_ascii=False,
    )
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM correlation_rules WHERE rule_name = %s", [payload.name])
        if cur.fetchone():
            raise HTTPException(400, "Nom de regle deja utilise")
        cur.execute("SELECT id FROM playbooks WHERE action_name = %s", [payload.playbook])
        playbook = cur.fetchone()
        if not playbook:
            raise HTTPException(400, "Playbook introuvable")
        cur.execute(
            """
            SELECT COALESCE(MAX(NULLIF(regexp_replace(rule_code, '\\D', '', 'g'), '')::int), 0) + 1 AS next_code
            FROM correlation_rules
            """
        )
        next_code = cur.fetchone()["next_code"]
        cur.execute(
            """
            INSERT INTO correlation_rules (
                rule_code,
                rule_name,
                attack_type,
                severity_enum,
                rule_condition,
                playbook_id
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            [f"RULE-{next_code:02d}", payload.name, attack_type, severity, rule_condition, playbook["id"]],
        )
        row = cur.fetchone()
        row["playbook"] = payload.playbook
        conn.commit()
    set_audit_action(request, f"Creation de la regle de correlation '{row['rule_name']}'")
    return {
        "id": str(row["id"]),
        "name": row["rule_name"],
        "sev": row["severity_enum"],
        "on": True,
        "threshold": payload.threshold,
        "window": payload.window,
        "desc": row["rule_condition"],
        "playbook": payload.playbook,
        "attack_type": row["attack_type"],
    }


@router.get("/alerts")
def alerts(status: str | None = Query(None), incident_id: str | None = Query(None)):
    params: list[Any] = []
    clauses: list[str] = []
    if status and status != "Tous":
        db_status = STATUS_FILTER.get(status, status if status in STATUS_LABEL else None)
        if not db_status:
            raise HTTPException(400, f"Statut inconnu : {status}")
        clauses.append("a.status = %s")
        params.append(db_status)
    if incident_id:
        clause, lookup_params = _uuid_lookup_clause("i", incident_id, "INC")
        clauses.append("i.id IS NOT NULL")
        clauses.append(clause)
        params.extend(lookup_params)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(_alert_select(where=where, order_limit="ORDER BY a.created_at DESC"), params)
        rows = cur.fetchall()
    return [_map_alert(r) for r in rows]


@router.patch("/alerts/{alert_id}/incident")
def assign_alert_incident(alert_id: str, request: Request, incident_id: str = Query(...)):
    alert_clause, alert_params = _uuid_lookup_clause("a", alert_id, "ALT")
    incident_clause, incident_params = _uuid_lookup_clause("i", incident_id, "INC")
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT i.id FROM incidents i WHERE {incident_clause} AND i.is_deleted = false LIMIT 1", incident_params)
        incident = cur.fetchone()
        if not incident:
            raise HTTPException(404, "Incident introuvable")
        cur.execute(
            f"""
            UPDATE alerts a
            SET incident_id = %s
            WHERE {alert_clause}
            RETURNING a.*
            """,
            [incident["id"], *alert_params],
        )
        updated = cur.fetchone()
        if not updated:
            raise HTTPException(404, "Alerte introuvable")
        cur.execute(_alert_select(where="WHERE a.id = %s"), [updated["id"]])
        row = cur.fetchone()
        conn.commit()
    set_audit_action(request, f"Rattachement de l'alerte {_alert_id(row['id'])} a l'incident {_inc_id(row['incident_id'])}")
    return _map_alert(row)


@router.get("/infra")
def infra():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT node_name, node_role, status, last_heartbeat_at FROM cluster_nodes ORDER BY node_name")
        nodes = cur.fetchall()
        cur.execute("SELECT used_gb, total_gb, alert_threshold_pct FROM storage_status ORDER BY recorded_at DESC LIMIT 1")
        storage = cur.fetchone()
        cur.execute("SELECT occurred_at, actor_username, action, ip_address::text AS ip FROM audit_logs ORDER BY occurred_at DESC LIMIT 20")
        audit = cur.fetchall()
    healthy = sum(1 for n in nodes if n["status"] == "HEALTHY")
    used = float(storage["used_gb"]) if storage else 0
    total = float(storage["total_gb"]) if storage else 1
    current_rate = round(_safe_es_count({"query": _es_range(3600)}) / 3600, 2)
    return {
        "cluster": {"status": "HEALTHY" if healthy == len(nodes) and nodes else "DEGRADED", "active": healthy, "total": len(nodes), "nodes": [{"name": n["node_name"], "role": n["node_role"], "status": n["status"]} for n in nodes]},
        "storage": {"pct": round(used / total * 100) if total else 0, "used_tb": round(used / 1000, 1), "total_tb": round(total / 1000, 0), "available_tb": round((total - used) / 1000, 1), "alert_threshold_pct": storage["alert_threshold_pct"] if storage else 80},
        "ingestion": {"current": current_rate, "history": []},
        "retention": {"days": 365, "sealed": False, "sealed_at": None},
        "audit_log": [{"ts": _fmt_iso(a["occurred_at"]), "user": a["actor_username"], "action": a["action"], "ip": a.get("ip") or "-"} for a in audit],
    }
