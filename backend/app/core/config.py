# app/core/config.py

import os
from pathlib import Path
from dotenv import load_dotenv

# 🔧 FORCE LE CHEMIN ABSOLU - Solution Windows
env_path = Path(__file__).parent.parent.parent / ".env"  # Remonte jusqu'à backend/.env
print(f"📍 Cherche .env à: {env_path}")
print(f"   Existe: {env_path.exists()}")

load_dotenv(dotenv_path=env_path)

# Récupère DATABASE_URL
def _get_database_url() -> str:
    raw = os.getenv("DATABASE_URL")
    
    if raw:
        print(f"✅ DATABASE_URL trouvée depuis .env")
        return raw
    
    # Fallback si .env ne charge pas
    fallback = "postgresql://postgres:admin@localhost:5432/smart-siem"
    print(f"⚠️  DATABASE_URL non trouvée, utilise fallback: {fallback}")
    return fallback

DATABASE_URL = _get_database_url()

print(f"   URL finale: {DATABASE_URL.split('@')[0]}@***")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5174,http://127.0.0.1:5174").split(",")
    if origin.strip()
]