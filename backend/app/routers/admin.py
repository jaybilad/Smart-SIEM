"""Routes API admin — lecture des données PostgreSQL."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.core.db import get_conn

router = APIRouter(prefix="/admin", tags=["admin"])

STATUS_LABEL = {
    "OPEN": "Ouvert",
    "IN_PROGRESS": "En cours",
    "RESOLVED": "Résolu",
    "CLOSED": "Clôturé",
}

STATUS_FILTER = {v: k for k, v in STATUS_LABEL.items()}
STATUS_FILTER["RÃ©solue"] = "RESOLVED"

RANGE_SECONDS = {
    "1h": 3600,
    "6h": 6 * 3600,
    "24h": 24 * 3600,
    "7j": 7 * 24 * 3600,
    "30j": 30 * 24 * 3600,
}


def _inc_id(uuid_val) -> str:
    return f"INC-{str(uuid_val).replace('-', '')[:8].upper()}"


def _fmt_time(ts) -> str:
    if ts is None:
        return "—"
    if isinstance(ts, str):
        return ts
    return ts.strftime("%H:%M")


def _fmt_datetime(ts) -> str:
    if ts is None:
        return "—"
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
    return {
        "id": _inc_id(row["id"]),
        "uuid": str(row["id"]),
        "title": row["title"],
        "description": row.get("description") or "—",
        "rule": row.get("rule_name") or "—",
        "sev": row["severity"],
        "status": STATUS_LABEL.get(row["status"], row["status"]),
        "src": str(row["source_ip"]) if row.get("source_ip") else "—",
        "target": row.get("target") or "—",
        "time": _fmt_time(row.get("created_at")),
        "created_at": _fmt_iso(row.get("created_at")),
        "assignee": row.get("assignee"),
    }


def _parse_search_query(query: str) -> dict[str, str]:
    filters: dict[str, str] = {}
    for part in query.split():
        if ":" in part:
            key, _, value = part.partition(":")
            filters[key.strip().lower()] = value.strip()
    return filters


@router.get("/dashboard")
def dashboard():
    with get_conn() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
              COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS')) AS active,
              COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS') AND severity = 'CRITICAL') AS critical
            FROM incidents
            """
        )
        inc_stats = cur.fetchone()

        cur.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM alerts
            WHERE created_at >= now() - interval '24 hours'
            """
        )
        alerts_24h = cur.fetchone()["cnt"]

        cur.execute(
            """
            SELECT logs_per_second
            FROM ingestion_metrics
            ORDER BY recorded_at DESC
            LIMIT 1
            """
        )
        ingest_row = cur.fetchone()
        ingestion_rate = ingest_row["logs_per_second"] if ingest_row else 0

        cur.execute(
            """
            SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(closed_at, updated_at) - created_at)) / 60) AS mttr
            FROM incidents
            WHERE status IN ('RESOLVED', 'CLOSED')
              AND COALESCE(closed_at, updated_at) IS NOT NULL
            """
        )
        mttr_row = cur.fetchone()
        mttr_minutes = round(mttr_row["mttr"]) if mttr_row and mttr_row["mttr"] else 0

        cur.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM incidents
            WHERE status IN ('RESOLVED', 'CLOSED')
            """
        )
        resolved_count = cur.fetchone()["cnt"]

        cur.execute(
            """
            SELECT
              to_char(date_trunc('hour', created_at), 'HH24"h"') AS t,
              COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS c,
              COUNT(*) FILTER (WHERE severity = 'HIGH') AS h,
              COUNT(*) FILTER (WHERE severity = 'WARNING') AS m
            FROM incidents
            WHERE created_at >= now() - interval '24 hours'
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
            GROUP BY severity
            """
        )
        sev_rows = cur.fetchall()
        sev_map = {r["severity"]: r["count"] for r in sev_rows}
        total_active = sum(sev_map.values()) or 1
        severity_distribution = [
            {
                "label": "CRITIQUE",
                "count": sev_map.get("CRITICAL", 0),
                "pct": round(sev_map.get("CRITICAL", 0) / total_active * 100),
            },
            {
                "label": "HIGH",
                "count": sev_map.get("HIGH", 0),
                "pct": round(sev_map.get("HIGH", 0) / total_active * 100),
            },
            {
                "label": "WARNING",
                "count": sev_map.get("WARNING", 0),
                "pct": round(sev_map.get("WARNING", 0) / total_active * 100),
            },
        ]

        cur.execute(
            """
            SELECT i.*, u.username AS assignee, ar.rule_name
            FROM incidents i
            LEFT JOIN users u ON u.id = i.assigned_to
            LEFT JOIN alerts a ON a.id = i.alert_id
            LEFT JOIN attack_rules ar ON ar.id = a.rule_id
            ORDER BY i.created_at DESC
            LIMIT 5
            """
        )
        recent = [_map_incident(r) for r in cur.fetchall()]

        cur.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM incidents
            WHERE status IN ('OPEN', 'IN_PROGRESS')
              AND severity = 'HIGH'
            """
        )
        high_open = cur.fetchone()["cnt"]

        cur.execute(
            """
            SELECT COUNT(DISTINCT l.host_id) AS cnt
            FROM logs l
            WHERE l.severity IN ('HIGH', 'CRITICAL')
              AND l."timestamp" >= now() - interval '24 hours'
            """
        )
        risky_hosts = cur.fetchone()["cnt"]

        cur.execute(
            """
            SELECT urs.risk_score AS max_score,
                   u.username AS top_user
            FROM user_risk_scores urs
            JOIN users u ON u.id = urs.user_id
            ORDER BY urs.risk_score DESC
            LIMIT 1
            """
        )
        risk_row = cur.fetchone()
        max_risk = risk_row["max_score"] if risk_row else 0
        top_risk_user = risk_row["top_user"] if risk_row else None

        cur.execute(
            """
            SELECT source_ip::text AS ip,
                   COUNT(*) AS count,
                   MAX(severity::text) AS sev
            FROM logs
            WHERE "timestamp" >= now() - interval '24 hours'
            GROUP BY source_ip
            ORDER BY COUNT(*) DESC
            LIMIT 5
            """
        )
        top_ips = cur.fetchall()

        cur.execute(
            """
            SELECT to_char(date_trunc('hour', "timestamp"), 'HH24"h"') AS t,
                   COUNT(*) AS v
            FROM logs
            WHERE "timestamp" >= now() - interval '24 hours'
            GROUP BY 1
            ORDER BY MIN("timestamp")
            """
        )
        log_volume = cur.fetchall()

    active = inc_stats["active"] or 0
    critical = inc_stats["critical"] or 0

    return {
        "stats": {
            "active_incidents": active,
            "critical_incidents": critical,
            "alerts_24h": alerts_24h,
            "ingestion_rate": ingestion_rate,
            "mttr_minutes": mttr_minutes,
            "resolved_count": resolved_count,
        },
        "trend": trend or [{"t": "00h", "c": 0, "h": 0, "m": 0}],
        "severity_distribution": severity_distribution,
        "recent_incidents": recent,
        "soc": {
            "high_open_incidents": high_open,
            "high_risk_hosts": risky_hosts,
            "ueba_max_score": max_risk,
            "ueba_top_user": top_risk_user,
            "log_volume": log_volume,
            "top_ips": [
                {
                    "ip": r["ip"],
                    "count": r["count"],
                    "sev": r["sev"],
                }
                for r in top_ips
            ],
        },
    }


@router.get("/incidents")
def incidents(status: str | None = Query(None)):
    sql = """
        SELECT i.*, u.username AS assignee
        FROM incidents i
        LEFT JOIN users u ON u.id = i.assigned_to
    """
    params: list[Any] = []
    if status and status != "Tous":
        db_status = STATUS_FILTER.get(status)
        if not db_status:
            raise HTTPException(400, f"Statut inconnu : {status}")
        sql += " WHERE i.status = %s"
        params.append(db_status)
    sql += " ORDER BY i.created_at DESC"

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, params)
        rows = cur.fetchall()

    return [_map_incident(r) for r in rows]


@router.patch("/incidents/{incident_id}/status")
def update_incident_status(incident_id: str, status: str = Query(...)):
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
                closed_at = CASE
                    WHEN %s IN ('RESOLVED', 'CLOSED') THEN COALESCE(closed_at, now())
                    ELSE NULL
                END
            WHERE id = %s
            RETURNING *
            """,
            [db_status, db_status, incident_id],
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Incident introuvable")
        conn.commit()

    return _map_incident(row)


@router.get("/logs/search")
def search_logs(
    q: str = Query(""),
    range: str = Query("24h"),
    limit: int = Query(50, le=500),
):
    seconds = RANGE_SECONDS.get(range, RANGE_SECONDS["24h"])
    filters = _parse_search_query(q)

    conditions = ['l."timestamp" >= now() - make_interval(secs => %s)']
    params: list[Any] = [seconds]

    event_type = filters.get("event_type")
    if event_type:
        conditions.append("l.event_type::text ILIKE %s")
        params.append(event_type.replace("*", "%"))

    src_ip = filters.get("src_ip") or filters.get("source_ip")
    if src_ip:
        conditions.append("l.source_ip::text ILIKE %s")
        params.append(src_ip.replace("*", "%"))

    severity = filters.get("sev") or filters.get("severity")
    if severity:
        conditions.append("l.severity::text = %s")
        params.append(severity.upper())

    user = filters.get("user")
    if user and user != "*":
        conditions.append('l."user" ILIKE %s')
        params.append(user.replace("*", "%"))

    if q.strip() and not filters:
        conditions.append(
            "(l.raw_message ILIKE %s OR l.event_type::text ILIKE %s OR l.\"user\" ILIKE %s OR l.source_ip::text ILIKE %s)"
        )
        like = f"%{q.strip()}%"
        params.extend([like, like, like, like])

    where = " AND ".join(conditions)

    with get_conn() as conn:
        cur = conn.cursor()

        cur.execute(
            f"""
            SELECT COUNT(*) AS total,
                   COUNT(DISTINCT l.source_ip) AS unique_sources,
                   COUNT(DISTINCT l."user") FILTER (WHERE l."user" IS NOT NULL) AS unique_users
            FROM logs l
            WHERE {where}
            """,
            params,
        )
        stats_row = cur.fetchone()

        cur.execute(
            f"""
            SELECT COUNT(DISTINCT a.id) AS triggered_rules
            FROM alerts a
            WHERE a.created_at >= now() - make_interval(secs => %s)
            """,
            [seconds],
        )
        triggered = cur.fetchone()["triggered_rules"]

        cur.execute(
            f"""
            SELECT to_char(date_trunc('hour', l."timestamp"), 'HH24"h"') AS h,
                   COUNT(*) AS v
            FROM logs l
            WHERE {where}
            GROUP BY 1
            ORDER BY MIN(l."timestamp")
            """,
            params,
        )
        volume = cur.fetchall()

        cur.execute(
            f"""
            SELECT l.id::text AS id,
                   l."timestamp" AS ts,
                   l.source_ip::text AS src,
                   COALESCE(l.destination_ip::text, '—') AS dst,
                   l.event_type::text AS event,
                   COALESCE(l."user", 'N/A') AS user,
                   COALESCE(l.raw_message, '—') AS detail,
                   l.severity::text AS sev,
                   COALESCE(h.hostname::text, 'N/A') AS machine
            FROM logs l
            LEFT JOIN hosts h ON h.id = l.host_id
            WHERE {where}
            ORDER BY l."timestamp" DESC
            LIMIT %s
            """,
            [*params, limit],
        )
        rows = cur.fetchall()

    return {
        "stats": {
            "total_events": stats_row["total"],
            "unique_sources": stats_row["unique_sources"],
            "unique_users": stats_row["unique_users"],
            "triggered_rules": triggered,
        },
        "volume": volume,
        "results": [
            {
                "id": r["id"],
                "ts": _fmt_iso(r["ts"]),
                "src": r["src"] or "—",
                "dst": r["dst"],
                "event": r["event"],
                "user": r["user"],
                "detail": r["detail"],
                "sev": r["sev"],
                "machine": r["machine"],
            }
            for r in rows
        ],
    }


@router.get("/playbooks")
def playbooks():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT p.id,
                   p.action_name,
                   p.description,
                   p.is_automatic,
                   COUNT(DISTINCT ia.id) AS triggers,
                   MAX(ia.execution_time) AS last_run,
                   MAX(ar.severity::text) AS top_severity,
                   ARRAY_REMOVE(ARRAY_AGG(DISTINCT ar.rule_name), NULL) AS rules
            FROM playbooks p
            LEFT JOIN incident_actions ia ON ia.playbook_id = p.id
            LEFT JOIN attack_rules ar ON ar.playbook_id = p.id
            GROUP BY p.id, p.action_name, p.description, p.is_automatic
            ORDER BY p.action_name
            """
        )
        rows = cur.fetchall()

    return [
        {
            "id": str(r["id"]),
            "name": r["action_name"],
            "desc": r.get("description") or "—",
            "auto": r["is_automatic"],
            "triggers": r["triggers"],
            "lastRun": r["last_run"].strftime("%Y-%m-%d") if r["last_run"] else "—",
            "sev": r.get("top_severity") or "HIGH",
            "rules": r.get("rules") or [],
        }
        for r in rows
    ]


@router.get("/ueba")
def ueba():
    with get_conn() as conn:
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) AS cnt FROM user_risk_scores")
        monitored = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) AS cnt FROM user_risk_scores WHERE risk_score > 80")
        critical = cur.fetchone()["cnt"]

        cur.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM anomalies
            WHERE detected_at >= now() - interval '7 days'
            """
        )
        anomalies_7d = cur.fetchone()["cnt"]

        cur.execute(
            """
            SELECT urs.*, u.username
            FROM user_risk_scores urs
            JOIN users u ON u.id = urs.user_id
            ORDER BY urs.risk_score DESC
            """
        )
        rows = cur.fetchall()

    return {
        "stats": {
            "monitored": monitored,
            "critical": critical,
            "anomalies_7d": anomalies_7d,
        },
        "rows": [
            {
                "user": r["username"],
                "score": r["risk_score"],
                "anomalies": r["anomalies_count"],
                "last": _fmt_time(r.get("last_activity_at")),
                "delta": f"+{r['delta_24h']}" if r["delta_24h"] > 0 else "0",
                "detail": r.get("summary") or "—",
                "model_version": r.get("model_version") or "—",
            }
            for r in rows
        ],
    }


@router.get("/users")
def users():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, username, role, scope,
                   CASE WHEN is_active THEN 'Actif' ELSE 'Inactif' END AS status,
                   last_login_at
            FROM users
            ORDER BY username
            """
        )
        rows = cur.fetchall()

    return [
        {
            "id": str(r["id"]),
            "username": r["username"],
            "role": r["role"],
            "scope": r["scope"],
            "status": r["status"],
            "last": _fmt_datetime(r.get("last_login_at")),
        }
        for r in rows
    ]


@router.get("/rules")
def rules():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT ar.*, p.action_name AS playbook
            FROM attack_rules ar
            LEFT JOIN playbooks p ON p.id = ar.playbook_id
            ORDER BY ar.rule_name
            """
        )
        rows = cur.fetchall()

    return [
        {
            "id": str(r["id"]),
            "name": r["rule_name"],
            "sev": r["severity"],
            "on": r["enabled"],
            "threshold": r["threshold"],
            "window": r["time_window_seconds"],
            "desc": r.get("description") or "",
            "playbook": r.get("playbook") or "—",
            "attack_type": r["attack_type"],
        }
        for r in rows
    ]


@router.get("/infra")
def infra():
    with get_conn() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT node_name, node_role, status, last_heartbeat_at
            FROM cluster_nodes
            ORDER BY node_name
            """
        )
        nodes = cur.fetchall()

        cur.execute(
            """
            SELECT used_gb, total_gb, alert_threshold_pct
            FROM storage_status
            ORDER BY recorded_at DESC
            LIMIT 1
            """
        )
        storage = cur.fetchone()

        cur.execute(
            """
            SELECT to_char(recorded_at, 'HH24:MI') AS t, logs_per_second AS v
            FROM ingestion_metrics
            ORDER BY recorded_at DESC
            LIMIT 10
            """
        )
        ingest = list(reversed(cur.fetchall()))

        cur.execute(
            """
            SELECT retention_days, sealed, sealed_at
            FROM retention_policies
            ORDER BY created_at DESC
            LIMIT 1
            """
        )
        retention = cur.fetchone()

        cur.execute(
            """
            SELECT occurred_at, actor_username, action, ip_address::text AS ip
            FROM audit_log
            ORDER BY occurred_at DESC
            LIMIT 20
            """
        )
        audit = cur.fetchall()

    healthy = sum(1 for n in nodes if n["status"] == "HEALTHY")
    cluster_status = "HEALTHY" if healthy == len(nodes) and nodes else "DEGRADED"

    used = float(storage["used_gb"]) if storage else 0
    total = float(storage["total_gb"]) if storage else 1
    pct = round(used / total * 100) if total else 0

    current_rate = ingest[-1]["v"] if ingest else 0

    return {
        "cluster": {
            "status": cluster_status,
            "active": healthy,
            "total": len(nodes),
            "nodes": [
                {
                    "name": n["node_name"],
                    "role": n["node_role"],
                    "status": n["status"],
                }
                for n in nodes
            ],
        },
        "storage": {
            "pct": pct,
            "used_tb": round(used / 1000, 1),
            "total_tb": round(total / 1000, 0),
            "available_tb": round((total - used) / 1000, 1),
            "alert_threshold_pct": storage["alert_threshold_pct"] if storage else 80,
        },
        "ingestion": {
            "current": current_rate,
            "history": ingest,
        },
        "retention": {
            "days": retention["retention_days"] if retention else 365,
            "sealed": retention["sealed"] if retention else False,
            "sealed_at": _fmt_iso(retention["sealed_at"]) if retention and retention.get("sealed_at") else None,
        },
        "audit_log": [
            {
                "ts": _fmt_iso(a["occurred_at"]),
                "user": a["actor_username"],
                "action": a["action"],
                "ip": a.get("ip") or "—",
            }
            for a in audit
        ],
    }
