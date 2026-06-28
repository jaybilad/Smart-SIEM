import asyncio
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Tuple

from app.core.config import ES_LOGS_INDEX
from app.core.es_client import get_es_client
from app.services.normalizer import normalize_cef, normalize_log, normalize_syslog

Normalizer = Callable[..., Dict[str, Any]]


async def index_normalized_log(document: Dict[str, Any]) -> Dict[str, Any]:
    doc = dict(document)
    doc["ingested_at"] = datetime.now(timezone.utc).isoformat()

    def _index() -> Dict[str, Any]:
        es = get_es_client()
        doc_id = doc.get("id")
        kwargs: Dict[str, Any] = {"index": ES_LOGS_INDEX, "document": doc}
        if doc_id is not None:
            kwargs["id"] = str(doc_id)
        response = es.index(**kwargs)
        return {"_id": response.get("_id"), "result": response.get("result")}

    result = await asyncio.to_thread(_index)
    return {**doc, "elasticsearch": result}


async def normalize_and_index_log(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = normalize_log(payload)
    return await index_normalized_log(normalized)


async def normalize_and_index_syslog(raw_message: str, source_ip: str | None = None) -> Dict[str, Any]:
    normalized = normalize_syslog(raw_message, source_ip=source_ip)
    return await index_normalized_log(normalized)


async def normalize_and_index_cef(raw_message: str, source_ip: str | None = None) -> Dict[str, Any]:
    normalized = normalize_cef(raw_message, source_ip=source_ip)
    return await index_normalized_log(normalized)


async def normalize_and_index_many(
    items: Iterable[Any],
    normalizer: Normalizer = normalize_log,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    indexed: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    for item in items:
        try:
            if normalizer in (normalize_syslog, normalize_cef):
                normalized = normalizer(item)
            else:
                normalized = normalizer(item)
            indexed.append(await index_normalized_log(normalized))
        except Exception as exc:
            errors.append({"item": item, "error": str(exc)})

    return indexed, errors
