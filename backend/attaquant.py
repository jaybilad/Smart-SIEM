import requests
import time

# Notez le "https" et le chemin de votre routeur d'ingestion (ex: /ingest/agent ou /api/v1/ingest/agent selon votre main.py)
URL_TARGET = "https://localhost:8000/api/logs/agent" 
HEADERS = {
    "X-API-Key": "SIEM_SUPER_SECRET_KEY_2026",
    "Content-Type": "application/json"
}

IP_ATTACKER = "198.51.100.90"

print("[🔥] Lancement des requêtes d'attaque simulées vers le SIEM...")

for i in range(4):
    payload = {
        "source": "windows",
        "host": "serveur-cible",
        "application": "sshd",
        "level": "HIGH",
        "message": f"Failed password for m.legrand user from {IP_ATTACKER}"
    }
    try:
        # verify=False est indispensable pour accepter votre certificat auto-signé local
        r = requests.post(URL_TARGET, json=payload, headers=HEADERS, verify=False)
        print(f"[!] Tentative {i+1}/4 poussée avec succès.")
    except Exception as e:
        print(f"[❌] Erreur de communication : {e}")
    time.sleep(1)