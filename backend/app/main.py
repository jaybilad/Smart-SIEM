from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.core.db import get_conn
from app.core.security import decode_access_token
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.ingest import router as ingest_router
from app.routers.lecteur import router as lecteur_router
from app.routers.soc import router as soc_router
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


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS" or path in {"/", "/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}:
        return await call_next(request)
    if path.startswith("/api/auth/login") or path.startswith("/api/logs"):
        return await call_next(request)

    protected_prefixes = {
        "/api/auth/me": {"Admin", "Analyste", "Lecteur"},
        "/api/admin": {"Admin"},
        "/api/soc": {"Admin", "Analyste"},
        "/api/lecteur": {"Admin", "Analyste", "Lecteur"},
    }
    required_roles = next((roles for prefix, roles in protected_prefixes.items() if path.startswith(prefix)), None)
    if required_roles is None:
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return JSONResponse(status_code=401, content={"detail": "Authentification requise"})

    try:
        payload = decode_access_token(token)
    except Exception as exc:
        detail = getattr(exc, "detail", "Token invalide")
        return JSONResponse(status_code=401, content={"detail": detail})

    role = payload.get("role")
    if role not in required_roles:
        return JSONResponse(status_code=403, content={"detail": "Droits insuffisants"})

    request.state.user = payload
    return await call_next(request)


app.include_router(ingest_router, prefix="/api/logs", tags=["ingest"])
app.include_router(auth_router)
app.include_router(admin_router, prefix="/api", tags=["admin"])
app.include_router(soc_router)
app.include_router(lecteur_router)


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
