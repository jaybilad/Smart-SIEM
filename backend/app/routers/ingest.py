from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
import re
import time
import subprocess

from fastapi import APIRouter, Body, HTTPException, Header
from pydantic import BaseModel, Field, field_validator
from elasticsearch import Elasticsearch

from app.services.normalizer import normalize_cef, normalize_log, normalize_syslog
from app.core.db import get_conn  # Connexion Postgres pour injecter l'incident

# ==============================================================================
# 1. CONNEXION SÉCURISÉE À ELASTICSEARCH
# ==============================================================================

es = Elasticsearch(
    "https://127.0.0.1:9200",
    http_auth=("elastic", "B1Ak4Zp6pWIFuTVjqudT"),
    ca_certs="C:/elasticsearch7/config/cert.pem",  # Utilise notre certificat
    verify_certs=False,       # ne vérifie pas car certificat non officiellement correcte
)

# Compteur en mémoire pour suivre l'attaque en direct pendant la soutenance
failed_login_counter = {}

class LogSource(str, Enum):
    generic = "generic"
    json = "json"
    syslog = "syslog"
    cef = "cef"
    windows = "windows"
    network = "network"

class LogPayload(BaseModel):
    source: LogSource = Field(..., description="Origine du log")
    timestamp: Optional[datetime] = Field(None, description="Date/heure du log")
    host: Optional[str] = Field(None, description="Hôte source")
    application: Optional[str] = Field(None, description="Application ou service qui a généré le log")
    level: Optional[str] = Field(None, description="Niveau de sévérité")
    message: str = Field(..., description="Message brut du log")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Données additionnelles structurées")

    @field_validator("message")
    def message_must_not_be_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Le champ message ne peut pas être vide.")
        return value

class BatchLogPayload(BaseModel):
    logs: List[LogPayload] = Field(..., description="Liste de logs à ingérer")

class IngestResponse(BaseModel):
    success: bool
    received: int
    normalized: List[Dict[str, Any]]

router = APIRouter()

def execute_soar_block_ip(ip_suspecte):
    """Playbook SOAR : Blocage pare-feu en direct"""
    print(f"[🛡️ SOAR] Déclenchement automatique du Playbook : Blocage de l'IP {ip_suspecte}")
    commande = f'New-NetFirewallRule -DisplayName "SIEM Auto-Block {ip_suspecte}" -Direction Inbound -Action Block -RemoteAddress {ip_suspecte}'
    try:
        subprocess.run(["powershell", "-Command", commande], check=True)
        print(f"[✅ SOAR] Succès ! L'IP {ip_suspecte} est bloquée sur l'infrastructure.")
    except Exception as e:
        print(f"[❌ SOAR] Erreur d'exécution de l'isolation réseau : {e}")

# --- NOUVEL ENDPOINT DÉDIÉ À L'AGENT DE SÉCURITÉ ---
@router.post("/agent", summary="Ingestion sécurisée depuis l'Agent custom")
async def ingest_agent_logs(payload: LogPayload, x_api_key: str = Header(None)):
    # 1. Sécurité (TLS + Clé d'API) exigée par votre cahier des charges
    if x_api_key != "SIEM_SUPER_SECRET_KEY_2026":
        raise HTTPException(status_code=403, detail="Clé API non valide ou manquante.")

    msg = payload.message
    
    # 2. Pipeline de normalisation : Extraction de l'IP source
    ip_match = re.search(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', msg)
    ip_source = ip_match.group(0) if ip_match else (payload.host or "127.0.0.1")

    # 3. UEBA & Pipeline : Extraction dynamique du VRAI nom d'utilisateur impliqué
    user_match = re.search(r'(?:user|for)\s+([a-zA-Z0-9._-]+)', msg, re.IGNORECASE)
    username = user_match.group(1) if user_match else "unknown_user"

    # Initialisation des variables globales de contrôle pour éviter les erreurs d'exécution
    actuel_score = 0
    trigger_soar = False

    # 4. Moteur de corrélation SIEM (Détection de Brute Force)
    if "failed" in msg.lower() or "erreur" in msg.lower():
        now = time.time()
        if ip_source not in failed_login_counter:
            failed_login_counter[ip_source] = []
        
        # Conserver uniquement les tentatives des 30 dernières secondes
        failed_login_counter[ip_source] = [t for t in failed_login_counter[ip_source] if now - t < 30]
        failed_login_counter[ip_source].append(now)

        # Si le seuil de 3 tentatives est atteint : levée d'incident + UEBA + SOAR
        if len(failed_login_counter[ip_source]) >= 3:
            print(f"[🚨 INTERNE] Corrélation : Seuil d'alertes dépassé pour l'IP {ip_source} (Utilisateur: {username}) !")
            pts_points = 25  # Brute Force = +25 au score de risque
            
            try:
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        # A. Injection de l'incident lié à l'utilisateur dans PostgreSQL
                        cur.execute(
                            """
                            INSERT INTO incidents (title, description, severity, status, source_ip, target, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, now(), now())
                            RETURNING id;
                            """,
                            (
                                "Attaque Brute Force Détectée",
                                f"Tentatives d'accès répétées sur l'hôte {payload.host or 'Inconnu'} pour l'utilisateur '{username}'.",
                                "CRITICAL",
                                "OPEN",
                                ip_source,
                                username
                            )
                        )
                        
                        # FIX COMPATIBILITÉ TUPLE / DICTIONNAIRE
                        db_res = cur.fetchone()
                        if isinstance(db_res, dict):
                            incident_id = db_res.get('id')
                        else:
                            incident_id = db_res[0]
                            
                        print(f"[💾] Incident #{incident_id} enregistré avec succès dans PostgreSQL.")
                        
                        # B. Logique UEBA : Incrémentation du score de risque dans la table 'user_risk_scores'
                        print(f"[DEBUG] Recherche du user_id associé au username '{username}'...")
                        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
                        user_result = cur.fetchone()
                        
                        if user_result:
                            user_id = user_result.get('id') if isinstance(user_result, dict) else user_result[0]
                            
                            # On vérifie si une entrée existe déjà dans la table user_risk_scores
                            cur.execute("SELECT risk_score, anomalies_count FROM user_risk_scores WHERE user_id = %s", (user_id,))
                            risk_row = cur.fetchone()
                            
                            if risk_row:
                                current_score = risk_row.get('risk_score', 0) if isinstance(risk_row, dict) else risk_row[0]
                                current_anomalies = risk_row.get('anomalies_count', 0) if isinstance(risk_row, dict) else risk_row[1]
                                
                                new_score = min(current_score + pts_points, 100)
                                new_anomalies = current_anomalies + 1
                                
                                print(f"[DEBUG UEBA] Score existant pour {username} : {current_score}/100. Nouvelle anomalie.")
                                
                                cur.execute(
                                    """
                                    UPDATE user_risk_scores 
                                    SET risk_score = %s,
                                        anomalies_count = %s,
                                        delta_24h = delta_24h + %s,
                                        last_activity_at = now(),
                                        summary = %s,
                                        computed_at = now()
                                    WHERE user_id = %s
                                    """,
                                    (new_score, new_anomalies, pts_points, f"Activité anormale répétée : Brute Force détecté ({new_anomalies} anomalies)", user_id)
                                )
                            else:
                                new_score = min(pts_points, 100)
                                print(f"[DEBUG UEBA] Premier enregistrement de score de risque pour {username}.")
                                
                                cur.execute(
                                    """
                                    INSERT INTO user_risk_scores (user_id, risk_score, anomalies_count, delta_24h, last_activity_at, summary, model_version, computed_at)
                                    VALUES (%s, %s, 1, %s, now(), %s, 'UEBA v3.1', now())
                                    """,
                                    (user_id, new_score, pts_points, "Première détection d'attaque Brute Force")
                                )
                                
                            conn.commit()
                            actuel_score = new_score
                            print(f"[✅ UEBA] Table user_risk_scores mise à jour pour '{username}' : {actuel_score}/100")
                        else:
                            print(f"[❌ UEBA] L'utilisateur '{username}' N'EXISTE PAS dans la table users !")
                            actuel_score = 0

                # C. Évaluation du seuil critique UEBA (Déclenchement automatique du SOAR)
                if actuel_score >= 100:
                    print(f"[💥 CRITIQUE UEBA] L'entité '{username}' a atteint le score maximal ({actuel_score}/100).")
                    trigger_soar = True
                else:
                    print(f"[🛡️ SOAR] Risque modéré pour '{username}' ({actuel_score}/100). Pas de blocage réseau immédiat.")

            except Exception as db_err:
                print(f"[❌] ERREUR D'ÉCRITURE BDD : {type(db_err).__name__}")
                print(f"    Message: {db_err}")
                import traceback
                traceback.print_exc()

            # D. Exécution du playbook SOAR si le seuil critique UEBA est franchi
            if trigger_soar:
                execute_soar_block_ip(ip_source)

    # ==============================================================================
    # 5. CONFORMATION STRICTE AU MAPPING DE L'INDEX "logs" D'ELASTICSEARCH
    # ==============================================================================
    formatted_log = {
        "timestamp": payload.timestamp.isoformat() if payload.timestamp else datetime.utcnow().isoformat() + "Z",
        "host": payload.host or "WEB-01",
        "host_type": "WEB_SERVER" if "web" in (payload.host or "").lower() else "WORKSTATION",
        "source_ip": ip_source,
        "destination_ip": "10.0.0.15",  # Adresse cible fictive de l'infrastructure
        "username": username,
        "event_type": "AUTH_FAILED" if ("failed" in msg.lower() or "erreur" in msg.lower()) else "USER_ACTIVITY",
        "severity": payload.level or "HIGH",
        "status": "FAILED" if ("failed" in msg.lower() or "erreur" in msg.lower()) else "SUCCESS",
        "data_volume": 0,
        "raw_message": msg
    }
    
    try:
        print(f"[DEBUG] Tentative d'indexation dans 'logs'...")
        print(f"[DEBUG] Document: {formatted_log}")
        es.index(index="logs", document=formatted_log)
        print(f"[📦 Elasticsearch] Log structuré enregistré avec succès dans l'index 'logs'")
    except Exception as es_err:
        print(f"[❌ Elasticsearch] Erreur lors du stockage du log : {es_err}")
        print(f"    Type: {type(es_err).__name__}")
        print(f"    Message: {str(es_err)}")
        import traceback
        traceback.print_exc() 

    return {"success": True, "message": "Log traité, indexé et analysé par le moteur UEBA"}

# --- VOS ENDPOINTS EXISTANTS PRÉSERVÉS ---
@router.post("", response_model=IngestResponse, summary="Ingestion générique de logs")
async def ingest_logs(payload: BatchLogPayload):
    if not payload.logs:
        raise HTTPException(status_code=400, detail="La liste de logs est vide.")
    
    normalized = []
    for log in payload.logs:
        log_dict = log.model_dump()
        if log_dict.get("timestamp"):
            log_dict["timestamp"] = log_dict["timestamp"].isoformat()
        norm = normalize_log(log_dict)
        normalized.append(norm)
        try:
            es.index(index="logs", document=norm)
        except Exception:
            pass
            
    return {"success": True, "received": len(normalized), "normalized": normalized}

@router.post("/raw", response_model=IngestResponse, summary="Ingestion de logs JSON bruts")
async def ingest_raw_logs(logs: List[Dict[str, Any]] = Body(..., description="Liste de logs JSON bruts")):
    if not logs:
        raise HTTPException(status_code=400, detail="La liste de logs est vide.")
    
    normalized = []
    for log in logs:
        norm = normalize_log(log)
        normalized.append(norm)
        try:
            es.index(index="logs", document=norm)
        except Exception:
            pass
    return {"success": True, "received": len(normalized), "normalized": normalized}

@router.post("/syslog", response_model=IngestResponse, summary="Ingestion de messages syslog")
async def ingest_syslog(payload: List[str] = Body(..., description="Liste de messages syslog bruts")):
    if not payload:
        raise HTTPException(status_code=400, detail="La liste de messages syslog est vide.")
    
    normalized = []
    for raw in payload:
        norm = normalize_syslog(raw)
        normalized.append(norm)
        try:
            es.index(index="logs", document=norm)
        except Exception:
            pass
    return {"success": True, "received": len(normalized), "normalized": normalized}

@router.post("/cef", response_model=IngestResponse, summary="Ingestion de messages CEF")
async def ingest_cef(payload: List[str] = Body(..., description="Liste de messages CEF bruts")):
    if not payload:
        raise HTTPException(status_code=400, detail="La liste de messages CEF est vide.")
    
    normalized = []
    for raw in payload:
        norm = normalize_cef(raw)
        normalized.append(norm)
        try:
            es.index(index="logs", document=norm)
        except Exception:
            pass
    return {"success": True, "received": len(normalized), "normalized": normalized}