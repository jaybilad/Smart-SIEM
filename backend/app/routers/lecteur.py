from fastapi import APIRouter, Query

from app.core.db import get_conn
from app.routers.admin import RANGE_SECONDS, _es_range, _safe_es_count, _safe_es_search
from app.routers.admin import incidents as admin_incidents
from app.routers.admin import search_logs as admin_search_logs
from app.routers.admin import ueba as admin_ueba

router = APIRouter(prefix="/api/lecteur", tags=["lecteur"])


def _pct(part: int | float, total: int | float) -> int:
    return round((part / total) * 100) if total else 0


def _sla_rate(cur, severity: str, hours: int) -> int:
    cur.execute(
        """
        SELECT
          COUNT(*) FILTER (
            WHERE status IN ('RESOLVED', 'CLOSED')
              AND severity = %s
              AND closed_at >= date_trunc('month', now())
          ) AS total,
          COUNT(*) FILTER (
            WHERE status IN ('RESOLVED', 'CLOSED')
              AND severity = %s
              AND closed_at >= date_trunc('month', now())
              AND closed_at - created_at <= make_interval(hours => %s)
          ) AS within_sla
        FROM incidents
        WHERE is_deleted = false
        """,
        [severity, severity, hours],
    )
    row = cur.fetchone()
    return _pct(row["within_sla"] or 0, row["total"] or 0)


@router.get("/dashboard")
def lecteur_dashboard():
    with get_conn() as conn:
        cur = conn.cursor()

        total_logs = _safe_es_count({"query": _es_range(RANGE_SECONDS["24h"])})

        cur.execute("SELECT COUNT(*) FILTER (WHERE status IN ('OPEN','IN_PROGRESS')) AS cnt FROM incidents WHERE is_deleted = false")
        active_incidents = cur.fetchone()["cnt"]

        suspect_ips = _safe_es_count(
            {
                "query": {
                    "bool": {
                        "must": [
                            _es_range(RANGE_SECONDS["24h"]),
                            {"terms": {"severity": ["HIGH", "CRITICAL", "high", "critical"]}},
                        ]
                    }
                }
            }
        )

        cur.execute("SELECT COUNT(*) AS cnt FROM monitored_targets WHERE target_type = 'HOST'")
        assets = cur.fetchone()["cnt"]

        es_hourly = _safe_es_search(
            {
                "size": 0,
                "query": _es_range(RANGE_SECONDS["24h"]),
                "aggs": {
                    "hourly": {
                        "date_histogram": {"field": "timestamp", "calendar_interval": "hour", "format": "HH'h'"},
                        "aggs": {"auth": {"filter": {"terms": {"event_type": ["AUTH_FAILED", "AUTH_SUCCESS"]}}}},
                    }
                },
            }
        )
        hourly = [
            dict(h=b.get("key_as_string"), total=b["doc_count"], scope=b.get("auth", {}).get("doc_count", 0))
            for b in es_hourly.get("aggregations", {}).get("hourly", {}).get("buckets", [])
        ]

        cur.execute(
            """
            SELECT attack_type::text AS type, COUNT(*) AS count
            FROM alerts
            GROUP BY attack_type
            ORDER BY count DESC
            LIMIT 5
            """
        )
        top_alerts = [dict(type=row["type"], count=row["count"]) for row in cur.fetchall()]

        cur.execute("SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS cnt FROM incidents WHERE is_deleted = false")
        month_total = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) FILTER (WHERE closed_at >= date_trunc('month', now())) AS cnt FROM incidents WHERE is_deleted = false")
        month_resolved = cur.fetchone()["cnt"]

        resolution_rate = _pct(month_resolved, month_total)
        p1_sla = _sla_rate(cur, "CRITICAL", 4)
        p2_sla = _sla_rate(cur, "HIGH", 24)

        cur.execute("SELECT COUNT(*) AS cnt FROM monitored_targets WHERE target_type = 'HOST' AND status = 'Actif'")
        active_hosts = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) AS cnt FROM monitored_targets WHERE target_type = 'HOST'")
        total_hosts = cur.fetchone()["cnt"]
        coverage = _pct(active_hosts, total_hosts)

        cur.execute("SELECT COALESCE(SUM(anomalies_count), 0) AS cnt FROM monitored_targets")
        month_anomalies = cur.fetchone()["cnt"]

        compliance = [
            {"label": "Taux de resolution des incidents", "value": resolution_rate, "target": 85, "unit": "%", "up": True},
            {"label": "Respect SLA P1 (< 4 h)", "value": p1_sla, "target": 95, "unit": "%", "up": True},
            {"label": "Respect SLA P2 (< 24 h)", "value": p2_sla, "target": 95, "unit": "%", "up": True},
            {"label": "Couverture SIEM des assets", "value": coverage, "target": 90, "unit": "%", "up": True},
        ]

        es_top_ips = _safe_es_search(
            {
                "size": 0,
                "query": {"exists": {"field": "source_ip"}},
                "aggs": {"top_ips": {"terms": {"field": "source_ip", "size": 5}}},
            }
        )
        top_ips = [
            dict(ip=b["key"], count=b["doc_count"], sev="INFO")
            for b in es_top_ips.get("aggregations", {}).get("top_ips", {}).get("buckets", [])
        ]

    return {
        "kpis": {
            "total_logs": total_logs,
            "active_incidents": active_incidents,
            "suspect_ips": suspect_ips,
            "assets": assets,
        },
        "hourly": hourly,
        "top_alerts": top_alerts,
        "compliance": compliance,
        "audit_kpis": {
            "incidents_month": month_total,
            "resolved_month": month_resolved,
            "resolution_rate": resolution_rate,
            "anomalies_month": month_anomalies,
            "coverage": coverage,
        },
        "top_ips": top_ips,
    }


@router.get("/incidents")
def lecteur_incidents(status: str | None = Query(None)):
    return admin_incidents(status=status)


@router.get("/logs/search")
def lecteur_search_logs(
    q: str = Query(""),
    range: str = Query("24h"),
    limit: int = Query(50, le=500),
):
    return admin_search_logs(q=q, range=range, limit=limit)


@router.get("/ueba")
def lecteur_ueba():
    return admin_ueba()
