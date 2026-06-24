from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.normalizer import normalize_cef, normalize_log, normalize_syslog


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


@router.post("", response_model=IngestResponse, summary="Ingestion générique de logs")
async def ingest_logs(payload: BatchLogPayload):
    if not payload.logs:
        raise HTTPException(status_code=400, detail="La liste de logs est vide.")

    normalized = [normalize_log(log.model_dump()) for log in payload.logs]
    return {"success": True, "received": len(normalized), "normalized": normalized}


@router.post("/raw", response_model=IngestResponse, summary="Ingestion de logs JSON bruts")
async def ingest_raw_logs(logs: List[Dict[str, Any]] = Body(..., description="Liste de logs JSON bruts")):
    if not logs:
        raise HTTPException(status_code=400, detail="La liste de logs est vide.")

    normalized = [normalize_log(log) for log in logs]
    return {"success": True, "received": len(normalized), "normalized": normalized}


@router.post("/syslog", response_model=IngestResponse, summary="Ingestion de messages syslog")
async def ingest_syslog(payload: List[str] = Body(..., description="Liste de messages syslog bruts")):
    if not payload:
        raise HTTPException(status_code=400, detail="La liste de messages syslog est vide.")

    normalized = [normalize_syslog(raw) for raw in payload]
    return {"success": True, "received": len(normalized), "normalized": normalized}


@router.post("/cef", response_model=IngestResponse, summary="Ingestion de messages CEF")
async def ingest_cef(payload: List[str] = Body(..., description="Liste de messages CEF bruts")):
    if not payload:
        raise HTTPException(status_code=400, detail="La liste de messages CEF est vide.")

    normalized = [normalize_cef(raw) for raw in payload]
    return {"success": True, "received": len(normalized), "normalized": normalized}
