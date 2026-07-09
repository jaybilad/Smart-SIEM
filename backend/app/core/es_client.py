import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

from app.core.config import (
    ELASTICSEARCH_LOG_INDEX,
    ELASTICSEARCH_PASSWORD,
    ELASTICSEARCH_URL,
    ELASTICSEARCH_USERNAME,
)


class ElasticsearchError(RuntimeError):
    pass


def _url(path: str) -> str:
    return f"{ELASTICSEARCH_URL.rstrip('/')}/{path.lstrip('/')}"


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if ELASTICSEARCH_USERNAME:
        token = f"{ELASTICSEARCH_USERNAME}:{ELASTICSEARCH_PASSWORD}".encode("utf-8")
        headers["Authorization"] = f"Basic {base64.b64encode(token).decode('ascii')}"
    return headers


def _request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = None if body is None else json.dumps(body, default=str).encode("utf-8")
    request = urllib.request.Request(_url(path), data=payload, method=method, headers=_headers())
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ElasticsearchError(f"Elasticsearch HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise ElasticsearchError(f"Elasticsearch indisponible: {exc.reason}") from exc


def _ensure_index(index: str = ELASTICSEARCH_LOG_INDEX) -> None:
    try:
        _request("HEAD", urllib.parse.quote(index))
        return
    except ElasticsearchError as exc:
        if "404" not in str(exc):
            raise

    mapping = {
        "mappings": {
            "properties": {
                "timestamp": {"type": "date"},
                "source_ip": {"type": "keyword"},
                "destination_ip": {"type": "keyword"},
                "host": {"type": "keyword"},
                "username": {"type": "keyword"},
                "event_type": {"type": "keyword"},
                "log_type": {"type": "keyword"},
                "severity": {"type": "keyword"},
                "status": {"type": "keyword"},
                "target_port": {"type": "integer"},
                "data_volume": {"type": "long"},
                "raw_message": {"type": "text"},
                "source": {"type": "keyword"},
                "perimeter": {"type": "keyword"},
                "metadata": {"type": "object"},
                "ingested_at": {"type": "date"},
            }
        }
    }
    _request("PUT", urllib.parse.quote(index), mapping)


def index_log(doc: dict[str, Any], index: str = ELASTICSEARCH_LOG_INDEX) -> str:
    _ensure_index(index)
    doc = _normalize_doc(doc)
    response = _request("POST", f"{urllib.parse.quote(index)}/_doc", doc)
    return str(response.get("_id", ""))


def search_logs(query: dict[str, Any], index: str = ELASTICSEARCH_LOG_INDEX) -> dict[str, Any]:
    return _request("POST", f"{urllib.parse.quote(index)}/_search", query)


def count_logs(query: dict[str, Any], index: str = ELASTICSEARCH_LOG_INDEX) -> int:
    response = _request("POST", f"{urllib.parse.quote(index)}/_count", query)
    return int(response.get("count", 0))


def _normalize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(doc)
    metadata = normalized.get("metadata") if isinstance(normalized.get("metadata"), dict) else {}
    if "username" not in normalized:
        normalized["username"] = normalized.get("user") or metadata.get("username") or metadata.get("user")
    if "event_type" not in normalized:
        normalized["event_type"] = normalized.get("log_type") or metadata.get("event_type")
    if "destination_ip" not in normalized:
        normalized["destination_ip"] = normalized.get("dest_ip") or metadata.get("destination_ip") or metadata.get("dst")
    if "target_port" not in normalized:
        normalized["target_port"] = metadata.get("target_port") or metadata.get("dpt")
    if "status" not in normalized:
        normalized["status"] = metadata.get("status")
    if "data_volume" not in normalized:
        normalized["data_volume"] = metadata.get("data_volume") or metadata.get("bytes")
    normalized.setdefault("perimeter", metadata.get("perimeter", "Global"))
    normalized.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    return normalized
