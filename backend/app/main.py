from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.core.db import get_conn
from app.routers.admin import router as admin_router
from app.routers.ingest import router as ingest_router
from app.syslog_receiver.server import start_syslog_servers


@asynccontextmanager
async def lifespan(app: FastAPI):
    # start syslog servers in background (non-blocking)
    task = asyncio.create_task(start_syslog_servers(host="127.0.0.1", port=5514))
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="Smart SIEM API",
    description="API Smart SIEM — ingestion de logs et données admin PostgreSQL.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router, prefix="/api/logs", tags=["ingest"])
app.include_router(admin_router, prefix="/api", tags=["admin"])


@app.get("/", summary="Health check")
async def health_check():
    db_ok = False
    try:
        with get_conn() as conn:
            conn.cursor().execute("SELECT 1")
            db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "service": "smart-siem-log-ingestion",
        "database": "connected" if db_ok else "unavailable",
    }
