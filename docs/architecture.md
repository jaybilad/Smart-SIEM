# Architecture Smart-SIEM

## 📋 Vue d'ensemble

**Smart-SIEM** est un système de gestion des événements de sécurité (SIEM) qui collecte, normalise et analyse les données de logs multi-sources. Le projet permet de visualiser les logs via une interface web et de détecter les menaces en temps réel.

**Stack technique** :
- Backend : FastAPI + Python
- Stockage : Elasticsearch
- Orchestration : Docker Compose
- Agents : Agent de collecte spécialisé

---

## 📁 Structure du projet

```
Smart-SIEM/
├── backend/                      # 🔧 API et logique métier principal
├── agent/                        # 📡 Agent de collecte et normalisation
├── elasticsearch/                # 🗄️  Configuration Elasticsearch
├── docs/                         # 📚 Documentation
├── docker-compose.yml            # 🐳 Orchestration des services
├── README.md                     # 📖 Intro du projet
└── .env.example                  # ⚙️  Variables d'environnement (template)
```

---

## 🔧 Détail des répertoires et fichiers

### **`backend/`** - API FastAPI et services métier

Le cœur de l'application. Gère la réception, normalisation et gestion des logs.

#### **Fichiers à la racine**
- **`Dockerfile`** : Image Docker pour conteneuriser l'API backend
- **`requirements.txt`** : Dépendances Python (FastAPI, Uvicorn, Pydantic, etc.)

#### **`backend/app/`** - Code application

- **`main.py`** : Point d'entrée FastAPI
  - Initialise l'application FastAPI
  - Configure le lifecycle (démarrage/arrêt)
  - Démarre les serveurs Syslog en arrière-plan
  - Enregistre les routers

#### **`backend/app/core/`** - Configuration et utilitaires fondamentaux

- **`config.py`** : Configuration centralisée de l'application (variables d'environnement)
- **`es_client.py`** : Client Elasticsearch pour les opérations avec ES
- **`security.py`** : Authentification, autorisation, gestion des tokens JWT

#### **`backend/app/models/`** - Modèles de données

Schémas Pydantic pour valider les données entrantes/sortantes.

#### **`backend/app/routers/`** - Endpoints API (par domaine métier)

Chaque fichier = un ensemble d'endpoints logiquement groupés.

- **`ingest.py`** : Réception et ingestion des logs
- **`auth.py`** : Authentification (login, tokens)
- **`users.py`** : Gestion des utilisateurs
- **`search.py`** : Recherche et récupération des logs stockés
- **`alerts.py`** : Gestion des alertes détectées
- **`rules.py`** : Gestion des règles de détection
- **`reports.py`** : Génération et consultation des rapports
- **`__init__.py`** : Fichier d'initialisation du package

#### **`backend/app/services/`** - Logique métier (réutilisable)

Chaque fichier encapsule une feature complexe.

- **`normalizer.py`** : Normalisation des logs (conversion en format standard)
- **`correlation_engine.py`** : Corrélation d'événements pour détecter les attaques
- **`bulk_indexer.py`** : Indexation en masse dans Elasticsearch (performance)
- **`report_generator.py`** : Génération de rapports (PDF, CSV, etc.)
- **`ueba.py`** : UEBA (User and Entity Behavior Analytics) - détection d'anomalies
- **`soar_playbooks.py`** : Playbooks d'automatisation de réponse aux incidents
- **`__init__.py`** : Fichier d'initialisation

#### **`backend/app/syslog_receiver/`** - Récepteur Syslog

- **`server.py`** : Serveur Syslog pour recevoir les logs en temps réel sur les ports 514 (UDP/TCP)

---

### **`agent/`** - Agent de collecte et normalisation

Agent autonome qui collecte les logs depuis diverses sources et les envoie au backend.

- **`log_agent.py`** : Script principal de l'agent
  - Collecte les logs depuis les sources (fichiers, APIs, syslog, etc.)
  - Normalise les logs avant envoi
  - Envoie au backend API
  
- **`requirements.txt`** : Dépendances spécifiques à l'agent

---

### **`elasticsearch/`** - Configuration Elasticsearch

Configurations et mappings pour structurer les données dans Elasticsearch.

#### **`ilm-policies/`** : Index Lifecycle Management
- Gère le cycle de vie des indices (création, archivage, suppression)
- Rotation automatique des indices selon l'âge/taille

#### **`mappings/`** : Schémas des indices
- Définit la structure et les types des champs indexés
- Optimise la performance des recherches

---

### **`docs/`** - Documentation

- **`architecture.md`** : Ce fichier - Documentation de la structure du projet
- **`README.md`** : Informations supplémentaires sur le projet

---

### **Fichiers à la racine**

- **`docker-compose.yml`** : Orchestration des services
  - Définit les conteneurs (backend, Elasticsearch, agent, etc.)
  - Configure les volumes, ports, variables d'environnement
  - Lance tout le stack avec `docker-compose up`

- **`README.md`** : Page d'accueil du projet
  - Description générale
  - Instructions de démarrage rapide
  - Liens vers la documentation

- **`.env.example`** : Template des variables d'environnement
  - Contient les variables clés à configurer
  - Renommer en `.env` et remplir avec vos valeurs

- **`.gitignore`** : Fichiers et répertoires à ignorer dans Git
  - `.env` (fichier sensible)
  - `__pycache__/` (fichiers compilés)
  - Autres fichiers temporaires

---

## 🔄 Flux de données - Architecture générale

```
Sources de logs (serveurs, applications, équipements réseau)
    ↓
[Agent | Syslog Receiver] ← Collecte
    ↓
Backend API (FastAPI)
    ├─→ Normalizer (normalisation des logs)
    ├─→ Bulk Indexer (indexation Elasticsearch)
    ├─→ Correlation Engine (détection de menaces)
    ├─→ UEBA (détection d'anomalies)
    └─→ SOAR Playbooks (réponse automatisée)
    ↓
Elasticsearch (stockage indexé)
    ↓
Utilisateurs (accès via API search, rapports, alertes)
```

---

## 🚀 Guide de démarrage pour nouveaux contributeurs

### 1. **Récupérer le projet**
```bash
git clone https://github.com/jaybilad/Smart-SIEM.git
cd Smart-SIEM
```

### 2. **Configurer l'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos configurations
```

### 3. **Lancer le stack complet**
```bash
docker-compose up -d
```

### 4. **Accéder à l'API**
```bash
# Health check
curl http://localhost:8000/

# Swagger UI (documentation interactive)
# http://localhost:8000/docs
```

### 5. **Structure du code**
- **Nouveau endpoint** ? → Créer dans `backend/app/routers/`
- **Nouvelle logique métier** ? → Créer dans `backend/app/services/`
- **Modification des modèles de données** ? → Ajouter dans `backend/app/models/`

---

## 📌 Points clés pour les contributeurs

| Domaine | Fichier/Dossier | Raison |
|---------|-----------------|--------|
| **Authentification** | `backend/app/core/security.py` | Point centralisé pour la sécurité |
| **Nouvelle API** | `backend/app/routers/<domaine>.py` | Garder les endpoints organisés par domaine |
| **Traitement de logs** | `backend/app/services/normalizer.py` | Logique réutilisable |
| **Elasticsearch** | `backend/app/core/es_client.py` | Unique client pour toutes les opérations |
| **Collecte logs** | `agent/log_agent.py` | Logique côté agent |
| **Configuration** | `.env` + `backend/app/core/config.py` | Variables centralisées |

---

## 🔒 Sécurité

- Authentification JWT dans `security.py`
- Variables sensibles dans `.env` (ne pas committer)
- Validation des données avec Pydantic
- Logs des opérations sensibles

---

## 📝 Notes pour le développement

- **Backend** : FastAPI auto-génère la documentation via `/docs` (Swagger)
- **Elasticsearch** : Indices nommés par type de source pour faciliter la gestion
- **Docker Compose** : Services interconnectés, à adapter selon votre infrastructure
- **Agent** : Peut être déployé sur plusieurs machines pour la collecte distribuée

---

*Dernière mise à jour : 2026-06-24*
