from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI

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
    title="Smart SIEM Log Ingestion API",
    description="API de réception et normalisation de logs multi-source.",
    version="0.1.0",
    lifespan=lifespan,
)


app.include_router(ingest_router, prefix="/api/logs", tags=["ingest"])


@app.get("/", summary="Health check")
async def health_check():
    return {"status": "ok", "service": "smart-siem-log-ingestion"}
