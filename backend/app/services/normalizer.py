import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

from pydantic import BaseModel


class NormalizedLog(BaseModel):
    timestamp: Optional[str]
    source_ip: Optional[str]
    host: Optional[str]
    log_type: Optional[str]
    severity: Optional[str]
    raw_message: str
    source: Optional[str]
    metadata: Dict[str, Any] = {}


SYSLOG_PATTERN = re.compile(
    r"^<(?P<pri>\d{1,3})>?(?P<timestamp>[A-Z][a-z]{2}\s+\d{1,2}\s[0-9]{2}:[0-9]{2}:[0-9]{2})\s"
    r"(?P<host>[^ ]+)\s(?P<app>[^:]+):\s(?P<message>.*)$"
)

CEF_PATTERN = re.compile(
    r"^CEF:(?P<version>\d+)\|(?P<device_vendor>[^|]*)\|(?P<device_product>[^|]*)\|"
    r"(?P<device_version>[^|]*)\|(?P<signature_id>[^|]*)\|(?P<name>[^|]*)\|(?P<severity>[^|]*)\|(?P<extensions>.*)$"
)


CRITICALITY_RULES: List[tuple] = [
    (re.compile(r"failed|denied|unauthorized|error|exception", re.I), "warning"),
    (re.compile(r"attack|breach|malware|exploit", re.I), "critical"),
]

TYPE_RULES: List[tuple] = [
    (re.compile(r"sshd|login|authentication|logon|auth", re.I), "auth"),
    (re.compile(r"firewall|iptables|netfilter|pf|acl", re.I), "network"),
    (re.compile(r"kernel|systemd|cron|boot", re.I), "system"),
]


def _map_severity_from_pri(pri: int) -> str:
    # pri % 8 gives severity code per RFC
    severity_code = pri % 8
    severity_map = {0: "critical", 1: "critical", 2: "critical", 3: "warning", 4: "warning", 5: "info", 6: "info", 7: "info"}
    return severity_map.get(severity_code, "info")


def parse_syslog_timestamp(raw_timestamp: str) -> Optional[str]:
    for fmt in ["%b %d %H:%M:%S", "%b  %d %H:%M:%S", "%Y-%m-%dT%H:%M:%S%z"]:
        try:
            dt = datetime.strptime(raw_timestamp, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            continue
    return datetime.now(timezone.utc).isoformat()


def parse_cef_extensions(extensions: str) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    for pair in re.finditer(r"(?P<key>[^=\s]+)=(?P<value>[^\n]+?)(?=\s+[^=\s]+=|$)", extensions):
        key = pair.group("key")
        value = pair.group("value").strip()
        if value.isdigit():
            data[key] = int(value)
        else:
            try:
                data[key] = float(value)
            except ValueError:
                data[key] = value
    return data


_IN_MEMORY_QUEUE: List[Dict[str, Any]] = []


def _tag_event(event: Dict[str, Any]) -> Dict[str, Any]:
    text = event.get("raw_message", "")
    # severity tagging
    for pat, tag in CRITICALITY_RULES:
        if pat.search(text):
            event["severity"] = tag
            break
    event.setdefault("severity", event.get("severity", "info"))

    # type tagging
    for pat, t in TYPE_RULES:
        if pat.search(text):
            event["log_type"] = t
            break
    event.setdefault("log_type", event.get("log_type", "application"))
    return event


def _enrich_event(event: Dict[str, Any]) -> Dict[str, Any]:
    event.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    event.setdefault("host", event.get("source_ip", event.get("host", "unknown")))
    event.setdefault("source", event.get("source", "ingest"))
    event.setdefault("metadata", event.get("metadata", {}))
    return event


def normalize_log(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = payload.copy()
    raw = payload.get("message") or payload.get("msg") or payload.get("raw_message") or ""
    source_ip = payload.get("source_ip")
    host = payload.get("host") or payload.get("hostname")
    log_type = payload.get("log_type") or payload.get("type") or payload.get("application")
    severity = payload.get("severity") or payload.get("level")
    metadata = payload.get("metadata") or payload.get("fields") or {}
    timestamp = payload.get("timestamp")

    event = {
        "timestamp": timestamp,
        "source_ip": source_ip,
        "host": host,
        "log_type": log_type,
        "severity": severity,
        "raw_message": raw,
        "source": payload.get("source", "generic"),
        "metadata": metadata,
    }

    event = _tag_event(event)
    event = _enrich_event(event)

    normalized = NormalizedLog(**event)
    # For testing, push to in-memory queue
    _IN_MEMORY_QUEUE.append(normalized.model_dump())
    return normalized.model_dump()


def normalize_syslog(raw_message: str, source_ip: Optional[str] = None) -> Dict[str, Any]:
    raw = raw_message.strip()
    match = SYSLOG_PATTERN.match(raw)
    event = {
        "timestamp": None,
        "source_ip": source_ip,
        "host": None,
        "log_type": "syslog",
        "severity": None,
        "raw_message": raw,
        "source": "syslog",
        "metadata": {},
    }
    if match:
        pri = match.groupdict().get("pri")
        if pri and pri.isdigit():
            event["severity"] = _map_severity_from_pri(int(pri))
        ts = match.groupdict().get("timestamp")
        if ts:
            event["timestamp"] = parse_syslog_timestamp(ts)
        event["host"] = match.groupdict().get("host")
        event["raw_message"] = match.groupdict().get("message")
        event["log_type"] = match.groupdict().get("app") or "syslog"

    event = _tag_event(event)
    event = _enrich_event(event)
    _IN_MEMORY_QUEUE.append(event)
    return event


def normalize_cef(raw_message: str, source_ip: Optional[str] = None) -> Dict[str, Any]:
    raw = raw_message.strip()
    match = CEF_PATTERN.match(raw)
    event = {
        "timestamp": None,
        "source_ip": source_ip,
        "host": None,
        "log_type": "cef",
        "severity": None,
        "raw_message": raw,
        "source": "cef",
        "metadata": {},
    }
    if match:
        metadata = parse_cef_extensions(match.group("extensions"))
        event["metadata"] = {
            "device_vendor": match.group("device_vendor"),
            "device_product": match.group("device_product"),
            "device_version": match.group("device_version"),
            "signature_id": match.group("signature_id"),
            "name": match.group("name"),
            "extensions": metadata,
        }
        event["raw_message"] = f"{match.group('device_vendor')} {match.group('device_product')} {match.group('name')}"
        event["severity"] = match.group("severity")

    event = _tag_event(event)
    event = _enrich_event(event)
    _IN_MEMORY_QUEUE.append(event)
    return event


async def normalize_and_queue(raw_event: Dict[str, Any]) -> Dict[str, Any]:
    # Async wrapper for compatibility with syslog receiver
    normalized = normalize_log(raw_event)
    try:
        from app.services import bulk_indexer

        await bulk_indexer.enqueue_for_indexing(normalized)
    except Exception:
        # fallback: keep in memory queue already appended by normalize_log
        pass
    return normalized


def get_in_memory_queue() -> List[Dict[str, Any]]:
    return list(_IN_MEMORY_QUEUE)

