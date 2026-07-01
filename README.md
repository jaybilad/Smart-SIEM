# Smart-SIEM

Collecter et normaliser les données de log pour les afficher sur une interface web qui nous permettra de les visualiser et d'agir en cas de menace ou alerte.

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (démarré)
- Python 3.10+

## Démarrage rapide

### 1. Cloner le projet

```bash
git clone https://github.com/jaybilad/Smart-SIEM.git
cd Smart-SIEM
```

### 2. Lancer Elasticsearch

```bash
docker compose up -d
```

Vérifier : http://localhost:9200

### 3. Importer les données de démo (BDD seed)

```bash
cd elasticsearch
python -m venv venv
# Windows :
venv\Scripts\activate
# Linux / macOS :
# source venv/bin/activate

pip install -r requirements.txt
python import_seed.py --reset
```

Données importées — **9 indices** (MLD complet, aligné sur `smart-siem/main.py`) :

| Indice | Description | Documents |
|--------|-------------|-----------|
| `logs` | Logs SIEM | 11 |
| `alerts` | Alertes détectées | 0 (vide, prêt à l'emploi) |
| `users` | Utilisateurs | 1 (admin) |
| `hosts` | Hôtes monitorés | 1 (webserver-01) |
| `attack_rules` | Règles de corrélation | 5 |
| `playbooks` | Playbooks SOAR | 3 |
| `incidents` | Incidents | 0 (vide) |
| `alert_logs` | Liaison alertes ↔ logs | 0 (vide) |
| `incident_actions` | Actions sur incidents | 0 (vide) |

Vérifier tous les indices : http://localhost:9200/_cat/indices?v

### 4. Lancer le backend API

```bash
cd ../backend
python -m venv venv
venv\Scripts\activate   # ou source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health check : http://localhost:8000/
- Swagger UI : http://localhost:8000/docs

## Structure du projet

```
Smart-SIEM/
├── backend/                 # API FastAPI
├── agent/                   # Agent de collecte de logs
├── elasticsearch/
│   ├── mappings/            # Schémas des indices ES
│   ├── seed/                # Données JSON partagées (BDD de démo)
│   ├── import_seed.py       # Script d'import dans ES
│   └── export_db.py         # Script d'export depuis ES
├── docs/                    # Documentation
├── docker-compose.yml       # Elasticsearch
└── .env.example             # Variables d'environnement
```

Voir [docs/architecture.md](docs/architecture.md) pour le détail complet.

## Commandes utiles

| Action | Commande |
|--------|----------|
| Arrêter Elasticsearch | `docker compose down` |
| Supprimer les données ES | `docker compose down -v` |
| Réimporter la BDD seed | `cd elasticsearch && python import_seed.py --reset` |
| Exporter la BDD actuelle | `cd elasticsearch && python export_db.py` |

## Configuration

Copier `.env.example` en `.env` et adapter les variables si besoin :

```bash
cp .env.example .env
```

En local, Elasticsearch est accessible sur `http://localhost:9200`.

Depuis la configuration actuelle le service est démarré avec la sécurité activée. Identifiants par défaut (uniquement pour le développement local) :

- **Utilisateur:** `elastic`
- **Mot de passe:** `changeme`

Kibana est exposé sur `http://localhost:5601`. Utilisez les mêmes identifiants pour vous connecter.

Le projet contient un script d'initialisation automatisé `init/import.sh` qui :

- démarre les conteneurs (`docker compose up -d`)
- attend qu'Elasticsearch soit prêt
- exécute `elasticsearch/import_seed.py --reset` en utilisant les identifiants `ES_USER` / `ES_PASS` (par défaut `elastic` / `changeme`).

Exemples :

```bash
# lancer tout et importer (Linux / WSL / macOS)
chmod +x init/import.sh
./init/import.sh

# ou manuellement sous PowerShell (Windows)
docker compose up -d
$env:ES_HOST = 'http://elastic:changeme@localhost:9200'
python elasticsearch/import_seed.py --reset
```

## Pour les nouveaux membres du groupe

1. `git clone` + `docker compose up -d`
2. `cd elasticsearch && pip install -r requirements.txt && python import_seed.py --reset`
3. `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`

Tout le monde obtient la même base de données de départ.
