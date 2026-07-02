import os

from dotenv import load_dotenv


load_dotenv()


# Supporte aussi une typo éventuelle dans le fichier .env (CATABASE_URL)
def _get_database_url() -> str:
    raw = os.getenv("DATABASE_URL") or os.getenv("CATABASE_URL")
    if raw:
        return raw
    return "postgresql://postgres:admin@localhost:5432/smart"


DATABASE_URL = _get_database_url()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "smart-siem-dev-secret-change-me")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5174,http://127.0.0.1:5174").split(",")
    if origin.strip()
]
