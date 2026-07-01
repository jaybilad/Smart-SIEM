from fastapi import APIRouter, Query

from app.core.db import get_conn
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
        """,
        [severity, severity, hours],
    )
    row = cur.fetchone()
    return _pct(row["within_sla"] or 0, row["total"] or 0)


@router.get("/dashboard")
def lecteur_dashboard():
    with get_conn() as conn:
        cur = conn.cursor()

        cur.execute('SELECT COUNT(*) AS cnt FROM logs WHERE "timestamp" >= now() - interval \'24 hours\'')
        total_logs = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) FILTER (WHERE status IN ('OPEN','IN_PROGRESS')) AS cnt FROM incidents")
        active_incidents = cur.fetchone()["cnt"]

        cur.execute(
            """
            SELECT COUNT(DISTINCT source_ip) AS cnt
            FROM logs
            WHERE severity IN ('HIGH','CRITICAL')
              AND "timestamp" >= now() - interval '24 hours'
            """
        )
        suspect_ips = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) AS cnt FROM hosts")
        assets = cur.fetchone()["cnt"]

        cur.execute(
            """
            SELECT to_char(date_trunc('hour', "timestamp"), 'HH24"h"') AS h,
                   COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE event_type IN ('AUTH_FAILED','AUTH_SUCCESS')) AS scope
            FROM logs
            WHERE "timestamp" >= now() - interval '24 hours'
            GROUP BY date_trunc('hour', "timestamp")
            ORDER BY date_trunc('hour', "timestamp")
            """
        )
        hourly = [dict(h=row["h"], total=row["total"], scope=row["scope"]) for row in cur.fetchall()]

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

        cur.execute("SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS cnt FROM incidents")
        month_total = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) FILTER (WHERE closed_at >= date_trunc('month', now())) AS cnt FROM incidents")
        month_resolved = cur.fetchone()["cnt"]

        resolution_rate = _pct(month_resolved, month_total)
        p1_sla = _sla_rate(cur, "CRITICAL", 4)
        p2_sla = _sla_rate(cur, "HIGH", 24)

        cur.execute("SELECT COUNT(*) AS cnt FROM hosts WHERE status = 'Actif'")
        active_hosts = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) AS cnt FROM hosts")
        total_hosts = cur.fetchone()["cnt"]
        coverage = _pct(active_hosts, total_hosts)

        cur.execute("SELECT COUNT(*) AS cnt FROM anomalies WHERE detected_at >= date_trunc('month', now())")
        month_anomalies = cur.fetchone()["cnt"]

        compliance = [
            {"label": "Taux de resolution des incidents", "value": resolution_rate, "target": 85, "unit": "%", "up": True},
            {"label": "Respect SLA P1 (< 4 h)", "value": p1_sla, "target": 95, "unit": "%", "up": True},
            {"label": "Respect SLA P2 (< 24 h)", "value": p2_sla, "target": 95, "unit": "%", "up": True},
            {"label": "Couverture SIEM des assets", "value": coverage, "target": 90, "unit": "%", "up": True},
        ]

        cur.execute(
            """
            SELECT source_ip::text AS ip, COUNT(*) AS cnt, MAX(severity)::text AS sev
            FROM logs
            WHERE source_ip IS NOT NULL
            GROUP BY source_ip
            ORDER BY cnt DESC
            LIMIT 5
            """
        )
        top_ips = [dict(ip=row["ip"], count=row["cnt"], sev=row["sev"] or "INFO") for row in cur.fetchall()]

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
