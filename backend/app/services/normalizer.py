import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

from pydantic import BaseModel, field_validator


class NormalizedLog(BaseModel):
    id: Optional[int | str] = None
    timestamp: Optional[str]
    host: Optional[str]
    source_ip: Optional[str]
    destination_ip: Optional[str] = None
    user: Optional[str] = None
    event_type: str
    severity: Optional[str]
    status: Optional[str] = None
    data_volume: int = 0
    raw_message: str
    source: Optional[str]
    metadata: Dict[str, Any] = {}

    @field_validator("event_type", mode="before")
    @classmethod
    def validate_event_type(cls, value: Any) -> str:
        event_type = normalize_event_type(value)
        if event_type not in EVENT_TYPES:
            return "INTERNAL_CONNECTION"
        return event_type

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, value: Any) -> str:
        severity = normalize_severity(value)
        if severity not in SEVERITY_LEVELS:
            return "info"
        return severity

    @field_validator("data_volume", mode="before")
    @classmethod
    def validate_data_volume(cls, value: Any) -> int:
        if value in (None, ""):
            return 0
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0


EVENT_TYPES = {
    "AUTH_SUCCESS",
    "AUTH_FAILED",
    "VPN_CONNECTION",
    "FILE_DOWNLOAD",
    "FILE_UPLOAD",
    "INTERNAL_CONNECTION",
    "SERVICE_STARTED",
    "SERVICE_STOPPED",
    "LOG_DELETION",
    "USER_CREATED",
    "USER_DISABLED",
    "MALWARE_DETECTED",
}

SEVERITY_LEVELS = {"critical", "high", "warning", "info"}

EVENT_TYPE_ALIASES = {
    "auth": "AUTH_SUCCESS",
    "auth_success": "AUTH_SUCCESS",
    "authentication_success": "AUTH_SUCCESS",
    "auth_failure": "AUTH_FAILED",
    "auth_failed": "AUTH_FAILED",
    "authentication_failure": "AUTH_FAILED",
    "vpn": "VPN_CONNECTION",
    "vpn_connection": "VPN_CONNECTION",
    "download": "FILE_DOWNLOAD",
    "file_download": "FILE_DOWNLOAD",
    "upload": "FILE_UPLOAD",
    "file_upload": "FILE_UPLOAD",
    "network": "INTERNAL_CONNECTION",
    "internal_connection": "INTERNAL_CONNECTION",
    "service_started": "SERVICE_STARTED",
    "service_stopped": "SERVICE_STOPPED",
    "log_deletion": "LOG_DELETION",
    "user_created": "USER_CREATED",
    "user_disabled": "USER_DISABLED",
    "malware": "MALWARE_DETECTED",
    "malware_detected": "MALWARE_DETECTED",
}

EVENT_DEFAULT_SEVERITY = {
    "AUTH_SUCCESS": "info",
    "AUTH_FAILED": "warning",
    "VPN_CONNECTION": "info",
    "FILE_DOWNLOAD": "info",
    "FILE_UPLOAD": "info",
    "INTERNAL_CONNECTION": "info",
    "SERVICE_STARTED": "info",
    "SERVICE_STOPPED": "warning",
    "LOG_DELETION": "high",
    "USER_CREATED": "info",
    "USER_DISABLED": "high",
    "MALWARE_DETECTED": "critical",
}

EVENT_DEFAULT_STATUS = {
    "AUTH_SUCCESS": "SUCCESS",
    "AUTH_FAILED": "FAILED",
    "VPN_CONNECTION": "CONNECTED",
    "FILE_DOWNLOAD": "SUCCESS",
    "FILE_UPLOAD": "SUCCESS",
    "INTERNAL_CONNECTION": "SUCCESS",
    "SERVICE_STARTED": "STARTED",
    "SERVICE_STOPPED": "STOPPED",
    "LOG_DELETION": "DELETED",
    "USER_CREATED": "CREATED",
    "USER_DISABLED": "DISABLED",
    "MALWARE_DETECTED": "DETECTED",
}


SYSLOG_PATTERN = re.compile(
    r"^<(?P<pri>\d{1,3})>?(?P<timestamp>[A-Z][a-z]{2}\s+\d{1,2}\s[0-9]{2}:[0-9]{2}:[0-9]{2})\s"
    r"(?P<host>[^ ]+)\s(?P<app>[^:]+):\s(?P<message>.*)$"
)

CEF_PATTERN = re.compile(
    r"^CEF:(?P<version>\d+)\|(?P<device_vendor>[^|]*)\|(?P<device_product>[^|]*)\|"
    r"(?P<device_version>[^|]*)\|(?P<signature_id>[^|]*)\|(?P<name>[^|]*)\|(?P<severity>[^|]*)\|(?P<extensions>.*)$"
)


CRITICALITY_RULES: List[tuple] = [
    (re.compile(r"attack|breach|malware|exploit", re.I), "critical"),
    (re.compile(r"delete|disabled|stopped|denied|unauthorized", re.I), "high"),
    (re.compile(r"failed|failure|invalid|error|exception", re.I), "warning"),
]

TYPE_RULES: List[tuple] = [
    (re.compile(r"malware|virus|trojan|ransomware", re.I), "MALWARE_DETECTED"),
    (re.compile(r"failed|failure|invalid|denied|unauthorized", re.I), "AUTH_FAILED"),
    (re.compile(r"auth|login|logon|password|sshd", re.I), "AUTH_SUCCESS"),
    (re.compile(r"vpn", re.I), "VPN_CONNECTION"),
    (re.compile(r"download", re.I), "FILE_DOWNLOAD"),
    (re.compile(r"upload", re.I), "FILE_UPLOAD"),
    (re.compile(r"service.*start|started", re.I), "SERVICE_STARTED"),
    (re.compile(r"service.*stop|stopped", re.I), "SERVICE_STOPPED"),
    (re.compile(r"log.*delete|delete.*log", re.I), "LOG_DELETION"),
    (re.compile(r"user.*created|created.*user", re.I), "USER_CREATED"),
    (re.compile(r"user.*disabled|disabled.*user", re.I), "USER_DISABLED"),
    (re.compile(r"connection|firewall|iptables|netfilter|pf|acl", re.I), "INTERNAL_CONNECTION"),
]


def _map_severity_from_pri(pri: int) -> str:
    # pri % 8 gives severity code per RFC
    severity_code = pri % 8
    severity_map = {0: "critical", 1: "critical", 2: "critical", 3: "warning", 4: "warning", 5: "info", 6: "info", 7: "info"}
    return severity_map.get(severity_code, "info")


def normalize_event_type(value: Any) -> str:
    if value is None:
        return "INTERNAL_CONNECTION"
    event_type = str(value).strip()
    if not event_type:
        return "INTERNAL_CONNECTION"
    upper_event_type = event_type.upper()
    if upper_event_type in EVENT_TYPES:
        return upper_event_type
    return EVENT_TYPE_ALIASES.get(event_type.lower(), upper_event_type)


def normalize_severity(value: Any) -> str:
    if value is None:
        return "info"
    severity = str(value).strip().lower()
    if severity in SEVERITY_LEVELS:
        return severity
    aliases = {
        "crit": "critical",
        "error": "high",
        "err": "high",
        "warn": "warning",
        "notice": "info",
        "debug": "info",
    }
    return aliases.get(severity, severity)


def parse_syslog_timestamp(raw_timestamp: str) -> Optional[str]:
    for fmt in ["%b %d %H:%M:%S", "%b  %d %H:%M:%S", "%Y-%m-%dT%H:%M:%S%z"]:
        try:
            dt = datetime.strptime(raw_timestamp, fmt)
            if "%Y" not in fmt:
                dt = dt.replace(year=datetime.now(timezone.utc).year)
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
    combined_text = " ".join(
        str(value)
        for value in [
            text,
            event.get("event_type"),
            event.get("status"),
            event.get("metadata", {}),
        ]
        if value
    )

    initial_event_type = normalize_event_type(event.get("event_type"))
    should_infer_event_type = (
        not event.get("event_type")
        or initial_event_type not in EVENT_TYPES
        or initial_event_type == "INTERNAL_CONNECTION"
    )
    if should_infer_event_type:
        for pat, event_type in TYPE_RULES:
            if pat.search(combined_text):
                event["event_type"] = event_type
                break
    else:
        event["event_type"] = initial_event_type
    event["event_type"] = normalize_event_type(event.get("event_type"))

    if not event.get("severity"):
        for pat, severity in CRITICALITY_RULES:
            if pat.search(combined_text):
                event["severity"] = severity
                break
    event["severity"] = normalize_severity(
        event.get("severity") or EVENT_DEFAULT_SEVERITY.get(event["event_type"], "info")
    )
    if event["severity"] not in SEVERITY_LEVELS:
        event["severity"] = EVENT_DEFAULT_SEVERITY.get(event["event_type"], "info")

    if not event.get("status"):
        event["status"] = EVENT_DEFAULT_STATUS.get(event["event_type"], "SUCCESS")
    else:
        event["status"] = str(event["status"]).strip().upper()

    if event.get("data_volume") in (None, ""):
        event["data_volume"] = 0
    return event


def _extract_user(raw: str) -> Optional[str]:
    patterns = [
        r"\buser(?:name)?[=\s:]+(?P<user>[A-Za-z0-9_.-]+)",
        r"\bfor\s+(?P<user>[A-Za-z0-9_.-]+)\s+from\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw, re.I)
        if match:
            return match.group("user")
    return None


def _extract_ip(raw: str, marker: str) -> Optional[str]:
    match = re.search(rf"\b{marker}\s+(?P<ip>\d{{1,3}}(?:\.\d{{1,3}}){{3}})\b", raw, re.I)
    if match:
        return match.group("ip")
    return None


def _normalize_timestamp(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    raw = str(value).strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return raw


def _enrich_event(event: Dict[str, Any]) -> Dict[str, Any]:
    if not event.get("timestamp"):
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
    if not event.get("host"):
        event["host"] = event.get("source_ip") or "unknown"
    if not event.get("source"):
        event["source"] = "ingest"
    if not event.get("metadata"):
        event["metadata"] = {}
    return event


def normalize_log(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = payload.copy()
    raw = payload.get("message") or payload.get("msg") or payload.get("raw_message") or ""
    source_ip = payload.get("source_ip") or _extract_ip(raw, "from")
    destination_ip = payload.get("destination_ip") or payload.get("dest_ip") or payload.get("dst_ip") or _extract_ip(raw, "to")
    host = payload.get("host") or payload.get("hostname")
    event_type = payload.get("event_type") or payload.get("log_type") or payload.get("type") or payload.get("application")
    severity = payload.get("severity") or payload.get("level")
    metadata = payload.get("metadata") or payload.get("fields") or {}
    timestamp = _normalize_timestamp(payload.get("timestamp"))

    event = {
        "id": payload.get("id"),
        "timestamp": timestamp,
        "host": host,
        "source_ip": source_ip,
        "destination_ip": destination_ip,
        "user": payload.get("user") or payload.get("username") or _extract_user(raw),
        "event_type": event_type,
        "severity": severity,
        "status": payload.get("status"),
        "data_volume": payload.get("data_volume", 0),
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
        "destination_ip": None,
        "user": None,
        "event_type": "INTERNAL_CONNECTION",
        "severity": None,
        "status": None,
        "data_volume": 0,
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
        event["metadata"]["application"] = match.groupdict().get("app") or "syslog"
        event["user"] = _extract_user(event["raw_message"])
        event["source_ip"] = event["source_ip"] or _extract_ip(event["raw_message"], "from")
        event["destination_ip"] = _extract_ip(event["raw_message"], "to")

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
        "destination_ip": None,
        "user": None,
        "event_type": "INTERNAL_CONNECTION",
        "severity": None,
        "status": None,
        "data_volume": 0,
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
        event["event_type"] = match.group("name")
        event["source_ip"] = event["source_ip"] or metadata.get("src")
        event["destination_ip"] = metadata.get("dst")
        event["user"] = metadata.get("suser") or metadata.get("duser")
        event["status"] = metadata.get("outcome") or metadata.get("status")
        event["data_volume"] = metadata.get("bytes") or metadata.get("out") or 0

    event = _tag_event(event)
    event = _enrich_event(event)
    _IN_MEMORY_QUEUE.append(event)
    return event


async def normalize_and_queue(raw_event: Dict[str, Any]) -> Dict[str, Any]:
    # Async wrapper kept for compatibility with older callers.
    normalized = normalize_log(raw_event)
    try:
        from app.services.log_ingestion import index_normalized_log

        await index_normalized_log(normalized)
    except Exception:
        # fallback: keep in memory queue already appended by normalize_log
        pass
    return normalized


def get_in_memory_queue() -> List[Dict[str, Any]]:
    return list(_IN_MEMORY_QUEUE)

