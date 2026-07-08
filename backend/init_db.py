import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=False)

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("CATABASE_URL") or "postgresql://postgres:admin@localhost:5432/smart"
ROOT_DIR = BASE_DIR.parent
SCHEMA_FILE = ROOT_DIR / "Creation_Script.sql"
SEED_FILE = ROOT_DIR / "Insertion_Script.sql"


def run_sql_file(conn: psycopg.Connection, path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    conn.execute(sql)
    conn.commit()


def main() -> None:
    if not SCHEMA_FILE.exists() or not SEED_FILE.exists():
        raise SystemExit(f"Missing SQL files: {SCHEMA_FILE} / {SEED_FILE}")

    conn = psycopg.connect(DATABASE_URL)
    try:
        run_sql_file(conn, SCHEMA_FILE)
        run_sql_file(conn, SEED_FILE)
    finally:
        conn.close()

    print("Database initialized successfully")


if __name__ == "__main__":
    main()
