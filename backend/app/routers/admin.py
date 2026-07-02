"""Routes API admin — lecture des données PostgreSQL."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.core.db import get_conn

router = APIRouter(prefix="/admin", tags=["admin"])

from elasticsearch import Elasticsearch
# Réutilise la même configuration sécurisée que dans ingest.py
es = Elasticsearch(
    "https://127.0.0.1:9200",
    http_auth=("elastic", "B1Ak4Zp6pWIFuTVjqudT"),
    ca_certs="C:/elasticsearch7/config/cert.pem",  # Modifie le chemin si nécessaire
    verify_certs=False,
)

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
    # 1. Gestion de la plage de temps pour Elasticsearch
    es_range = range.replace("j", "d")
    
    must_conditions = [
        {"range": {"timestamp": {"gte": f"now-{es_range}"}}}
    ]

    filters = _parse_search_query(q)

    if filters:
        if "event_type" in filters:
            must_conditions.append({"wildcard": {"event_type": f"*{filters['event_type'].lower()}*"}})
        if "src_ip" in filters or "source_ip" in filters:
            ip_val = filters.get("src_ip") or filters.get("source_ip")
            must_conditions.append({"wildcard": {"source_ip": f"*{ip_val}*"}})
        if "sev" in filters or "severity" in filters:
            sev_val = filters.get("sev") or filters.get("severity")
            must_conditions.append({"term": {"severity": sev_val.upper()}})
        if "user" in filters and filters["user"] != "*":
            must_conditions.append({"wildcard": {"username": f"*{filters['user'].lower()}*"}})
    elif q.strip():
        must_conditions.append({
            "multi_match": {
                "query": q.strip(),
                "fields": ["raw_message", "event_type", "username", "source_ip"],
                "fuzziness": "AUTO"
            }
        })

    es_query = {
        "query": {
            "bool": {
                "must": must_conditions
            }
        },
        "size": limit,
        "sort": [{"timestamp": {"order": "desc"}}]
    }

    # 2. Exécution de la recherche principale
    try:
        response = es.search(index="logs", body=es_query)
        hits = response["hits"]["hits"]
        total_events = response["hits"]["total"]["value"] if isinstance(response["hits"]["total"], dict) else response["hits"]["total"]
    except Exception as e:
        print(f"[❌ Erreur Elasticsearch Hits] {e}")
        hits = []
        total_events = 0

    # 3. Récupération des métriques agrégées ET du volume temporel (Axe X = 't')
    aggs_query = {
        "query": {"bool": {"must": must_conditions}},
        "size": 0,
        "aggs": {
            "unique_sources": {"cardinality": {"field": "source_ip.keyword"}},
            "unique_users": {"cardinality": {"field": "username.keyword"}},
            "log_volume": {
                "date_histogram": {
                    "field": "timestamp",
                    "fixed_interval": "1h" if range in ["1h", "6h", "24h"] else "1d",
                    "format": "HH'h'" if range in ["1h", "6h", "24h"] else "dd/MM"
                }
            }
        }
    }
    
    unique_sources = 0
    unique_users = 0
    volume = []
    
    try:
        aggs_res = es.search(index="logs", body=aggs_query)
        unique_sources = aggs_res["aggregations"]["unique_sources"]["value"] if "unique_sources" in aggs_res["aggregations"] else 0
        unique_users = aggs_res["aggregations"]["unique_users"]["value"] if "unique_users" in aggs_res["aggregations"] else 0
        
        # Extraction du volume pour alimenter le graphique Recharts
        if "log_volume" in aggs_res["aggregations"]:
            buckets = aggs_res["aggregations"]["log_volume"]["buckets"]
            volume = [{"t": b["key_as_string"], "v": b["doc_count"]} for b in buckets]
    except Exception as e:
        print(f"[❌ Erreur Elasticsearch Aggs] {e}")

    # 4. Requête PostgreSQL (Règles déclenchées)
    try:
        seconds = RANGE_SECONDS.get(range, RANGE_SECONDS["24h"])
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(DISTINCT a.id) AS triggered_rules
                    FROM alerts a
                    WHERE a.created_at >= now() - make_interval(secs => %s)
                    """,
                    [seconds],
                )
                triggered = cur.fetchone()["triggered_rules"]
    except Exception as e:
        print(f"[❌ Erreur PostgreSQL Alerts] {e}")
        triggered = 0

    # 5. Reconstruction du tableau de résultats attendu par le frontend
    results = []
    for hit in hits:
        source = hit["_source"]
        results.append({
            "id": hit["_id"],
            "ts": source.get("timestamp", ""),
            "src": source.get("source_ip", "—"),
            "dst": source.get("destination_ip", "—"),
            "event": source.get("event_type", "—"),
            "user": source.get("username", "N/A"),
            "detail": source.get("raw_message", "—"),
            "sev": source.get("severity", "—"),
            "machine": source.get("host", "N/A")
        })

    return {
        "stats": {
            "total_events": total_events,
            "unique_sources": unique_sources,
            "unique_users": unique_users,
            "triggered_rules": triggered,
        },
        "volume": volume,
        "results": results,
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
