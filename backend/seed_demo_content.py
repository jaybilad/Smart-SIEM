import hashlib
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from app.core.config import ELASTICSEARCH_LOG_INDEX
from app.core.db import get_conn
from app.core.es_client import _ensure_index, _request

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=False)


def _utc(minutes_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()


def _seed_doc_id(seed_key: str) -> str:
    digest = hashlib.sha1(seed_key.encode("utf-8")).hexdigest()[:24]
    return f"demo-{digest}"


def _index_seed_log(doc: dict[str, Any]) -> str:
    seed_key = doc["metadata"]["seed_key"]
    doc_id = _seed_doc_id(seed_key)
    _ensure_index(ELASTICSEARCH_LOG_INDEX)
    path = f"{urllib.parse.quote(ELASTICSEARCH_LOG_INDEX)}/_doc/{urllib.parse.quote(doc_id)}"
    _request("PUT", path, doc)
    return doc_id


def _require_rows(rows: list[dict[str, Any]], table: str) -> None:
    if not rows:
        raise RuntimeError(
            f"Aucune donnee trouvee dans {table}. Initialise d'abord ta base locale "
            "avec Creation_Script.sql puis Insertion_Script.sql, ou lance backend/init_db.py."
        )


def _ensure_incident_and_alert(cur, spec: dict[str, Any], admin_user: dict[str, Any]) -> dict[str, Any]:
    cur.execute("SELECT * FROM monitored_targets WHERE name = %s", [spec["target_name"]])
    target = cur.fetchone()
    cur.execute("SELECT * FROM correlation_rules WHERE rule_code = %s", [spec["rule_code"]])
    rule = cur.fetchone()
    if not target or not rule:
        raise RuntimeError(f"Cible ou regle introuvable pour le scenario {spec['seed_key']}")

    cur.execute("SELECT * FROM incidents WHERE title = %s LIMIT 1", [spec["title"]])
    incident = cur.fetchone()
    if not incident:
        cur.execute(
            """
            INSERT INTO incidents (
                title, description, severity, status, source_ip,
                assigned_to, created_at, updated_at, closed_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, now() - make_interval(mins => %s), now(), %s)
            RETURNING *
            """,
            [
                spec["title"],
                spec["description"],
                spec["severity"],
                spec["status"],
                spec["source_ip"],
                admin_user["id"],
                spec["minutes_ago"],
                None,
            ],
        )
        incident = cur.fetchone()
        if spec["status"] in {"RESOLVED", "CLOSED"}:
            cur.execute("UPDATE incidents SET closed_at = now(), updated_at = now() WHERE id = %s RETURNING *", [incident["id"]])
            incident = cur.fetchone()

    cur.execute(
        """
        SELECT *
        FROM alerts
        WHERE incident_id = %s AND rule_id = %s AND target_id = %s
        LIMIT 1
        """,
        [incident["id"], rule["id"], target["id"]],
    )
    alert = cur.fetchone()
    if not alert:
        cur.execute(
            """
            INSERT INTO alerts (
                rule_id, incident_id, target_id, title, attack_type,
                severity, score_impact, status, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now() - make_interval(mins => %s))
            RETURNING *
            """,
            [
                rule["id"],
                incident["id"],
                target["id"],
                spec["title"],
                rule["attack_type"],
                spec["severity"],
                spec["score_impact"],
                spec["status"],
                spec["minutes_ago"],
            ],
        )
        alert = cur.fetchone()

    return {"incident": incident, "alert": alert, "target": target, "rule": rule}


def _build_logs(scenario: dict[str, Any], rows: dict[str, Any]) -> list[dict[str, Any]]:
    target = rows["target"]
    rule = rows["rule"]
    alert = rows["alert"]
    base = {
        "source_ip": scenario["source_ip"],
        "destination_ip": scenario["destination_ip"],
        "host": target["name"],
        "username": scenario["username"],
        "source": "seed_demo_content",
        "perimeter": scenario["perimeter"],
        "metadata": {
            "seed_scenario": scenario["seed_key"],
            "alert_id": str(alert["id"]),
            "incident_id": str(rows["incident"]["id"]),
            "target_id": str(target["id"]),
            "target_name": target["name"],
            "target_type": target["target_type"],
            "rule_id": str(rule["id"]),
            "rule_code": rule["rule_code"],
            "rule_name": rule["rule_name"],
            "attack_type": rule["attack_type"],
            "db_links": "alerts.incident_id -> incidents.id, alerts.target_id -> monitored_targets.id",
        },
    }

    logs = []
    for idx, event in enumerate(scenario["events"], start=1):
        metadata = {**base["metadata"], "seed_key": f"{scenario['seed_key']}-{idx:02d}"}
        logs.append(
            {
                **base,
                "timestamp": _utc(scenario["minutes_ago"] - idx),
                "event_type": event["event_type"],
                "log_type": event["log_type"],
                "severity": event["severity"],
                "status": event["status"],
                "target_port": event["target_port"],
                "data_volume": event["data_volume"],
                "raw_message": event["raw_message"].format(
                    user=scenario["username"],
                    src=scenario["source_ip"],
                    dst=scenario["destination_ip"],
                    host=target["name"],
                    rule=rule["rule_name"],
                ),
                "metadata": metadata,
            }
        )
    return logs


def seed_incidents_and_logs() -> None:
    scenarios = [
        {
            "seed_key": "vpn-bruteforce",
            "title": "Brute-force attempt against VPN gateway",
            "description": "Tentatives SSH/VPN repetees depuis une IP externe contre la passerelle VPN.",
            "severity": "HIGH",
            "status": "OPEN",
            "source_ip": "203.0.113.45",
            "destination_ip": "10.20.0.10",
            "target_name": "vpn-gateway",
            "username": "jack.bauer",
            "rule_code": "RULE-01",
            "score_impact": 80,
            "minutes_ago": 42,
            "perimeter": "Frontiere",
            "events": [
                {"event_type": "AUTH_FAILED", "log_type": "auth", "severity": "HIGH", "status": "failed", "target_port": 443, "data_volume": 620, "raw_message": "VPN login failed for {user} from {src} to {host}"},
                {"event_type": "AUTH_FAILED", "log_type": "auth", "severity": "HIGH", "status": "failed", "target_port": 443, "data_volume": 641, "raw_message": "VPN login failed for {user} from {src}; threshold matched by {rule}"},
                {"event_type": "AUTH_FAILED", "log_type": "auth", "severity": "HIGH", "status": "failed", "target_port": 443, "data_volume": 655, "raw_message": "Repeated VPN authentication failure for {user} on {host}"},
            ],
        },
        {
            "seed_key": "jack-after-hours",
            "title": "Anomalous login window for jack.bauer",
            "description": "Connexion reussie en dehors de la baseline UEBA du compte jack.bauer.",
            "severity": "WARNING",
            "status": "IN_PROGRESS",
            "source_ip": "198.51.100.77",
            "destination_ip": "10.20.1.21",
            "target_name": "jack.bauer",
            "username": "jack.bauer",
            "rule_code": "RULE-07",
            "score_impact": 45,
            "minutes_ago": 95,
            "perimeter": "Global",
            "events": [
                {"event_type": "AUTH_SUCCESS", "log_type": "auth", "severity": "WARNING", "status": "success", "target_port": 3389, "data_volume": 1820, "raw_message": "Successful login for {user} outside allowed hours from {src}"},
                {"event_type": "UEBA_ANOMALY", "log_type": "ueba", "severity": "WARNING", "status": "flagged", "target_port": 3389, "data_volume": 2100, "raw_message": "UEBA baseline deviation for {user}; rule {rule}"},
            ],
        },
        {
            "seed_key": "db-exfiltration",
            "title": "Suspicious data exfiltration from srv-db",
            "description": "Volume sortant anormal depuis le serveur de base de donnees critique.",
            "severity": "CRITICAL",
            "status": "OPEN",
            "source_ip": "10.20.2.15",
            "destination_ip": "185.199.110.153",
            "target_name": "srv-db",
            "username": "nina.myers",
            "rule_code": "RULE-03",
            "score_impact": 95,
            "minutes_ago": 18,
            "perimeter": "Serveurs_Critiques",
            "events": [
                {"event_type": "DATA_TRANSFER", "log_type": "network", "severity": "CRITICAL", "status": "success", "target_port": 443, "data_volume": 734003200, "raw_message": "Large outbound transfer from {host} to {dst} by {user}"},
                {"event_type": "DATA_EXFILTRATION", "log_type": "correlation", "severity": "CRITICAL", "status": "triggered", "target_port": 443, "data_volume": 912261120, "raw_message": "Correlation matched {rule} for {host}; destination {dst}"},
            ],
        },
        {
            "seed_key": "fw-scan",
            "title": "Horizontal port scan detected near firewall",
            "description": "Scan de ports lateral detecte sur le segment interne proche du pare-feu principal.",
            "severity": "INFO",
            "status": "RESOLVED",
            "source_ip": "10.20.4.88",
            "destination_ip": "10.20.0.1",
            "target_name": "fw-principal",
            "username": "edgar.stiles",
            "rule_code": "RULE-05",
            "score_impact": 25,
            "minutes_ago": 260,
            "perimeter": "Reseau_Interne",
            "events": [
                {"event_type": "PORT_SCAN", "log_type": "network", "severity": "INFO", "status": "blocked", "target_port": 22, "data_volume": 120, "raw_message": "Port scan sample from {src} to {host}:22"},
                {"event_type": "PORT_SCAN", "log_type": "network", "severity": "INFO", "status": "blocked", "target_port": 445, "data_volume": 144, "raw_message": "Port scan sample from {src} to {host}:445"},
            ],
        },
    ]

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, username FROM soc_users ORDER BY username")
        users = cur.fetchall()
        _require_rows(users, "soc_users")

        admin_user = next((u for u in users if u["username"] == "chloe.obrian"), users[0])
        scenario_rows = {
            scenario["seed_key"]: _ensure_incident_and_alert(cur, scenario, admin_user)
            for scenario in scenarios
        }

        cur.execute(
            """
            UPDATE monitored_targets
            SET global_risk_score = CASE name
                WHEN 'srv-db' THEN 92
                WHEN 'jack.bauer' THEN 84
                WHEN 'vpn-gateway' THEN 76
                WHEN 'fw-principal' THEN 38
                ELSE global_risk_score
            END,
            anomalies_count = CASE name
                WHEN 'srv-db' THEN 7
                WHEN 'jack.bauer' THEN 5
                WHEN 'vpn-gateway' THEN 4
                WHEN 'fw-principal' THEN 1
                ELSE anomalies_count
            END,
            last_activity_at = now(),
            updated_at = now()
            WHERE name IN ('srv-db', 'jack.bauer', 'vpn-gateway', 'fw-principal')
            """
        )

        cur.execute("SELECT id FROM playbooks WHERE action_name = 'block_source_ip' LIMIT 1")
        playbook = cur.fetchone()
        analyst = next((u for u in users if u["username"] == "edgar.stiles"), admin_user)
        if playbook:
            incident_id = scenario_rows["vpn-bruteforce"]["incident"]["id"]
            cur.execute(
                """
                INSERT INTO incident_actions (incident_id, playbook_id, executed_by, execution_status, execution_time)
                SELECT %s, %s, %s, 'Succes', now() - interval '30 minutes'
                WHERE NOT EXISTS (
                    SELECT 1 FROM incident_actions
                    WHERE incident_id = %s AND playbook_id = %s AND execution_status = 'Succes'
                )
                """,
                [incident_id, playbook["id"], analyst["id"], incident_id, playbook["id"]],
            )

        cur.execute(
            """
            INSERT INTO audit_logs (actor_username, action, ip_address)
            SELECT 'SYSTEM', 'Chargement du contenu demo: incidents, alertes et logs correles.', '127.0.0.1'
            WHERE NOT EXISTS (
                SELECT 1 FROM audit_logs
                WHERE action = 'Chargement du contenu demo: incidents, alertes et logs correles.'
            )
            """
        )
        conn.commit()

    indexed = 0
    links = 0
    with get_conn() as conn:
        cur = conn.cursor()
        for scenario in scenarios:
            rows = scenario_rows[scenario["seed_key"]]
            for doc in _build_logs(scenario, rows):
                elastic_id = _index_seed_log(doc)
                indexed += 1
                cur.execute(
                    """
                    INSERT INTO alert_logs (alert_id, elastic_log_id)
                    VALUES (%s, %s)
                    ON CONFLICT (alert_id, elastic_log_id) DO NOTHING
                    """,
                    [rows["alert"]["id"], elastic_id],
                )
                links += cur.rowcount
        conn.commit()

    print(
        f"Demo seed termine: {len(scenarios)} incidents/alertes verifies, "
        f"{indexed} logs indexes dans Elasticsearch, {links} nouvelles liaisons alert_logs."
    )


if __name__ == "__main__":
    seed_incidents_and_logs()
