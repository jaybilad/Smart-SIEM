"""
Exporte les indices Elasticsearch vers des fichiers JSON.

Usage :
  cd elasticsearch
  python export_db.py
"""

from elasticsearch import Elasticsearch
import json
import os
from datetime import datetime

ES_URL = os.getenv("ES_HOST", "http://localhost:9200")
BASE_DIR = os.path.dirname(__file__)

INDICES = [
    ("logs", "logs.json", "Logs", "timestamp"),
    ("alerts", "alerts.json", "Alertes", "created_at"),
    ("incidents", "incidents.json", "Incidents", "created_at"),
    ("attack_rules", "attack_rules.json", "Règles de corrélation", None),
    ("playbooks", "playbooks.json", "Playbooks", None),
    ("users", "users.json", "Utilisateurs", "created_at"),
    ("hosts", "hosts.json", "Hôtes", "created_at"),
    ("alert_logs", "alert_logs.json", "Relation Alertes-Logs", "created_at"),
    ("incident_actions", "incident_actions.json", "Actions sur incidents", "created_at"),
]


def main():
    es = Elasticsearch([ES_URL], request_timeout=30)
    if not es.ping():
        print("Erreur : Elasticsearch inaccessible.")
        raise SystemExit(1)

    date_str = datetime.now().strftime("%Y-%m-%d_%H-%M")
    export_dir = os.path.join(BASE_DIR, f"exports_{date_str}")
    os.makedirs(export_dir, exist_ok=True)
    print(f"Dossier d'export : {export_dir}")

    total = 0
    summary = {"export_date": datetime.now().isoformat(), "total_documents": 0, "indices": {}}

    for index_name, filename, description, sort_field in INDICES:
        if not es.indices.exists(index=index_name):
            continue

        body = {"query": {"match_all": {}}, "size": 10000}
        if sort_field:
            body["sort"] = [{sort_field: {"order": "desc"}}]

        result = es.search(index=index_name, body=body)
        data = [{**hit["_source"], "_id": hit["_id"]} for hit in result["hits"]["hits"]]

        filepath = os.path.join(export_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"  {len(data)} document(s) -> {filename}")
        total += len(data)
        summary["indices"][index_name] = {
            "description": description,
            "count": len(data),
            "filename": filename,
        }

    summary["total_documents"] = total
    with open(os.path.join(export_dir, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\nExport terminé : {total} document(s) dans {export_dir}")


if __name__ == "__main__":
    main()
