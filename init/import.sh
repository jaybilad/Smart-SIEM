#!/usr/bin/env bash
set -euo pipefail

# Script d'initialisation : démarre les conteneurs, attend ES, puis importe les données seed
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Démarrage des conteneurs (Elasticsearch + Kibana)..."
docker compose up -d

echo "Attente d'Elasticsearch sur http://localhost:9200..."
for i in {1..60}; do
	if curl -s -u "${ES_USER:-elastic}:${ES_PASS:-changeme}" http://localhost:9200/_cluster/health | grep -q '"status":"green"\|"status":"yellow"'; then
		echo "Elasticsearch prêt."
		break
	fi
	echo "  Attente... ($i/60)"
	sleep 2
done

PYTHON=python3
if ! command -v "$PYTHON" >/dev/null 2>&1; then
	PYTHON=python
fi

echo "Exécution de l'import des données seed..."
# Utilise ES_USER/ES_PASS si fournis, sinon valeurs par défaut
ES_USER=${ES_USER:-elastic}
ES_PASS=${ES_PASS:-changeme}
ES_HOST_CRED=${ES_HOST_CRED:-http://${ES_USER}:${ES_PASS}@localhost:9200}
ES_HOST=${ES_HOST:-$ES_HOST_CRED} $PYTHON elasticsearch/import_seed.py --reset

echo "Kibana est disponible sur http://localhost:5601"
echo "Terminé."
