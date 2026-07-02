#!/usr/bin/env python3
"""
Smart SIEM Agent - Collecte sécurisée des logs
Version 1.0 - Format corrigé pour LogPayload
"""

import time
import os
import requests
import json
from datetime import datetime
import urllib3
import sys

# Désactive les avertissements SSL (certificats auto-signés en développement)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============================================
# CONFIGURATION
# ============================================

BACKEND_URL = "https://localhost:8000/api/logs/agent"  # ✅ URL correcte
API_KEY = "SIEM_SUPER_SECRET_KEY_2026"
LOG_FILE_PATH = "C:/smart-siem/logs_bruts/auth.log"

print("\n" + "="*60)
print("🤖 SMART SIEM AGENT - Démarrage")
print("="*60)
print(f"📡 Backend: {BACKEND_URL}")
print(f"🔑 API Key: {API_KEY[:10]}...")
print(f"📂 Fichier: {LOG_FILE_PATH}")
print("="*60 + "\n")

# ============================================
# FONCTION D'ENVOI
# ============================================

def send_log_to_backend(raw_line):
    """
    Envoie un log au backend avec le FORMAT EXACT attendu par LogPayload
    """
    
    # ✅ Format EXACT du modèle LogPayload du backend
    payload = {
        "source": "generic",  # Type de source (generic, json, syslog, cef, windows, network)
        "message": raw_line.strip(),  # ✅ Message brut
        "host": os.environ.get("COMPUTERNAME", "AGENT-01"),  # ✅ Nom d'hôte
        "application": "siem-agent",  # Application qui génère le log
        "level": "INFO",  # Sévérité
        "timestamp": datetime.utcnow().isoformat() + "Z",  # Format ISO 8601
        "metadata": {
            "agent_os": "windows",
            "agent_version": "1.0"
        }
    }
    
    # Headers avec authentification
    headers = {
        "X-API-Key": API_KEY,  # Clé d'authentification (sécurité)
        "Content-Type": "application/json"
    }
    
    try:
        # Envoie la requête HTTPS avec certificat auto-signé accepté
        response = requests.post(
            BACKEND_URL,
            json=payload,
            headers=headers,
            verify=False,  # Accepte les certificats auto-signés
            timeout=10
        )
        
        # Traitement de la réponse
        if response.status_code == 200:
            print(f"✅ Log envoyé avec succès")
            result = response.json()
            if result.get("success"):
                print(f"   Message: {result.get('message', 'OK')}")
        else:
            print(f"❌ Erreur {response.status_code}")
            print(f"   Réponse: {response.text[:100]}")
            
    except requests.exceptions.Timeout:
        print(f"⏱️ Timeout: Le backend n'a pas répondu à temps")
    except requests.exceptions.ConnectionError:
        print(f"🔌 Erreur de connexion: Vérifiez que le backend tourne sur {BACKEND_URL}")
    except Exception as e:
        print(f"⚠️  Erreur: {str(e)}")

# ============================================
# LECTURE EN TEMPS RÉEL DU FICHIER LOG
# ============================================

def main():
    """Boucle principale de surveillance"""
    
    # Crée le fichier s'il n'existe pas
    if not os.path.exists(LOG_FILE_PATH):
        os.makedirs(os.path.dirname(LOG_FILE_PATH), exist_ok=True)
        with open(LOG_FILE_PATH, "w") as f:
            f.write("")
        print(f"[+] Fichier créé: {LOG_FILE_PATH}\n")
    
    print(f"[+] En attente de nouveaux logs...\n")
    
    try:
        with open(LOG_FILE_PATH, "r", encoding="utf-8", errors="ignore") as f:
            # Se positionne à la fin du fichier (pour lire uniquement les nouveaux logs)
            f.seek(0, os.SEEK_END)
            
            while True:
                line = f.readline()
                
                # Si aucune nouvelle ligne, attends 1 seconde
                if not line:
                    time.sleep(1)
                    continue
                
                # Si la ligne n'est pas vide, l'envoie au backend
                if line.strip():
                    print(f"[🔍] Nouveau log: {line.strip()[:70]}...")
                    send_log_to_backend(line)
                    print()
                    
    except KeyboardInterrupt:
        print("\n\n[👋] Agent arrêté par l'utilisateur")
        sys.exit(0)
    except FileNotFoundError:
        print(f"[❌] ERREUR: Fichier non trouvé: {LOG_FILE_PATH}")
        sys.exit(1)
    except Exception as e:
        print(f"[❌] ERREUR FATALE: {e}")
        sys.exit(1)

# ============================================
# POINT D'ENTRÉE
# ============================================

if __name__ == "__main__":
    main()