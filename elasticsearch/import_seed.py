"""
Crée tous les indices Smart-SIEM (MLD) et importe les données seed.

Logique alignée sur smart-siem/main.py → create_all_indices().

Usage :
  cd elasticsearch
  python import_seed.py --reset

Variables d'environnement : ES_HOST, ES_USER, ES_PASSWORD
"""

from elasticsearch import Elasticsearch, helpers
import argparse
import json
import os
import sys
import time

BASE_DIR = os.path.dirname(__file__)
MAPPINGS_DIR = os.path.join(BASE_DIR, "mappings")
SEED_DIR = os.path.join(BASE_DIR, "seed")
ES_URL = os.getenv("ES_HOST", "http://localhost:9200")
ES_USER = os.getenv("ES_USER", "elastic")
ES_PASSWORD = os.getenv("ES_PASSWORD", "changeme")

# Ordre de création (9 indices du MLD)
INDICES = [
    "logs",
    "alerts",
    "users",
    "hosts",
    "attack_rules",
    "playbooks",
    "incidents",
    "alert_logs",
    "incident_actions",
]


def wait_for_es(es: Elasticsearch, retries: int = 30) -> bool:
    print(f"Connexion à Elasticsearch ({ES_URL})...")
    for i in range(retries):
        try:
            if es.ping():
                print("Elasticsearch est prêt.")
                return True
        except Exception:
            pass
        print(f"  Attente... ({i + 1}/{retries})")
        time.sleep(2)
    return False


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def bulk_import(es: Elasticsearch, index: str, documents: list) -> int:
    actions = []
    for doc in documents:
        doc = dict(doc)
        doc_id = doc.pop("_id", None)
        action = {"_index": index, "_source": doc}
        if doc_id:
            action["_id"] = doc_id
        actions.append(action)

    if not actions:
        return 0

    success, errors = helpers.bulk(es, actions, raise_on_error=False)
    if errors:
        print(f"  {len(errors)} erreur(s) dans '{index}'")
        for err in errors[:3]:
            print(f"    {err}")
    return success


def main():
    parser = argparse.ArgumentParser(description="Initialiser tous les indices Smart-SIEM")
    parser.add_argument("--reset", action="store_true", help="Supprimer les indices avant import")
    args = parser.parse_args()

    es = Elasticsearch([ES_URL], basic_auth=(ES_USER, ES_PASSWORD), request_timeout=30)
    if not wait_for_es(es):
        print("Erreur : Elasticsearch inaccessible. Depuis la racine : docker compose up -d")
        sys.exit(1)

    print(f"\nMappings : {MAPPINGS_DIR}")
    print(f"Seed     : {SEED_DIR}\n")

    total_docs = 0
    created_indices = 0

    for index_name in INDICES:
        mapping_file = os.path.join(MAPPINGS_DIR, f"{index_name}.json")
        seed_file = os.path.join(SEED_DIR, f"{index_name}.json")

        if not os.path.exists(mapping_file):
            print(f"  Mapping absent : mappings/{index_name}.json (ignoré)")
            continue

        if args.reset and es.indices.exists(index=index_name):
            es.indices.delete(index=index_name)
            print(f"  Index '{index_name}' supprimé")

        if not es.indices.exists(index=index_name):
            mapping = load_json(mapping_file)
            es.indices.create(index=index_name, body=mapping)
            created_indices += 1
            print(f"  Index '{index_name}' créé")
        else:
            print(f"  Index '{index_name}' existe déjà")

        if os.path.exists(seed_file):
            documents = load_json(seed_file)
            count = bulk_import(es, index_name, documents)
            print(f"    -> {count} document(s) importe(s)")
            total_docs += count
        else:
            print(f"    -> 0 document (pas de seed/{index_name}.json)")

    print(f"\nTerminé : {created_indices} index créé(s), {total_docs} document(s) importé(s).")
    print("Vérifier tous les indices : http://localhost:9200/_cat/indices?v")


if __name__ == "__main__":
    main()
