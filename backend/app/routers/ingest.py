from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.log_ingestion import normalize_and_index_many
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
    host: Optional[str] = Field(None, description="Hote source")
    source_ip: Optional[str] = Field(None, description="Adresse IP source")
    destination_ip: Optional[str] = Field(None, description="Adresse IP destination")
    user: Optional[str] = Field(None, description="Utilisateur concerne")
    event_type: Optional[str] = Field(None, description="Type d'evenement SIEM")
    application: Optional[str] = Field(None, description="Application ou service")
    level: Optional[str] = Field(None, description="Niveau de severite brut")
    severity: Optional[str] = Field(None, description="Niveau de gravite normalise")
    status: Optional[str] = Field(None, description="Statut de l'evenement")
    data_volume: Optional[int] = Field(0, description="Volume de donnees associe")
    message: str = Field(..., description="Message brut du log")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Donnees additionnelles")

    @field_validator("message")
    @classmethod
    def message_must_not_be_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Le champ message ne peut pas etre vide.")
        return value


class BatchLogPayload(BaseModel):
    logs: List[LogPayload] = Field(..., description="Liste de logs a ingerer")


class IngestResponse(BaseModel):
    success: bool
    received: int
    indexed: int
    normalized: List[Dict[str, Any]]
    errors: List[Dict[str, Any]] = Field(default_factory=list)


router = APIRouter()


@router.post("", response_model=IngestResponse, summary="Ingestion generique de logs")
async def ingest_logs(payload: BatchLogPayload):
    if not payload.logs:
        raise HTTPException(status_code=400, detail="La liste de logs est vide.")

    normalized, errors = await normalize_and_index_many(
        [log.model_dump() for log in payload.logs],
        normalize_log,
    )
    return {
        "success": not errors,
        "received": len(payload.logs),
        "indexed": len(normalized),
        "normalized": normalized,
        "errors": errors,
    }


@router.post("/raw", response_model=IngestResponse, summary="Ingestion de logs JSON bruts")
async def ingest_raw_logs(logs: List[Dict[str, Any]] = Body(..., description="Liste de logs JSON bruts")):
    if not logs:
        raise HTTPException(status_code=400, detail="La liste de logs est vide.")

    normalized, errors = await normalize_and_index_many(logs, normalize_log)
    return {
        "success": not errors,
        "received": len(logs),
        "indexed": len(normalized),
        "normalized": normalized,
        "errors": errors,
    }


@router.post("/syslog", response_model=IngestResponse, summary="Ingestion de messages syslog")
async def ingest_syslog(payload: List[str] = Body(..., description="Liste de messages syslog bruts")):
    if not payload:
        raise HTTPException(status_code=400, detail="La liste de messages syslog est vide.")

    normalized, errors = await normalize_and_index_many(payload, normalize_syslog)
    return {
        "success": not errors,
        "received": len(payload),
        "indexed": len(normalized),
        "normalized": normalized,
        "errors": errors,
    }


@router.post("/cef", response_model=IngestResponse, summary="Ingestion de messages CEF")
async def ingest_cef(payload: List[str] = Body(..., description="Liste de messages CEF bruts")):
    if not payload:
        raise HTTPException(status_code=400, detail="La liste de messages CEF est vide.")

    normalized, errors = await normalize_and_index_many(payload, normalize_cef)
    return {
        "success": not errors,
        "received": len(payload),
        "indexed": len(normalized),
        "normalized": normalized,
        "errors": errors,
    }
