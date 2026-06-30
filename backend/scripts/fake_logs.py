import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


EVENT_TYPES = [
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
]

USERS = ["jeremy", "admin", "root", "alice", "bob", "service_backup", "guest"]
HOSTS = ["WEB-01", "WEB-02", "DB-01", "VPN-01", "FILES-01", "AD-01"]
SERVICES = ["nginx", "postgresql", "ssh", "backup-agent", "windows-defender"]
FILES = ["report.pdf", "payroll.xlsx", "config.yml", "backup.zip", "client_data.csv"]

SEVERITY_BY_EVENT = {
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

STATUS_BY_EVENT = {
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


def random_ip(private_prefix: str | None = None) -> str:
    if private_prefix:
        return f"{private_prefix}.{random.randint(1, 254)}"
    return random.choice(
        [
            f"10.0.{random.randint(0, 10)}.{random.randint(1, 254)}",
            f"172.16.{random.randint(0, 10)}.{random.randint(1, 254)}",
            f"192.168.{random.randint(0, 10)}.{random.randint(1, 254)}",
        ]
    )


def build_message(event_type: str, user: str, src: str, dst: str) -> str:
    file_name = random.choice(FILES)
    service = random.choice(SERVICES)
    messages = {
        "AUTH_SUCCESS": f"Successful login for {user} from {src}",
        "AUTH_FAILED": f"Invalid password for {user} from {src}",
        "VPN_CONNECTION": f"VPN connection established for {user} from {src}",
        "FILE_DOWNLOAD": f"{user} downloaded {file_name} from {dst}",
        "FILE_UPLOAD": f"{user} uploaded {file_name} to {dst}",
        "INTERNAL_CONNECTION": f"Internal connection from {src} to {dst}",
        "SERVICE_STARTED": f"Service {service} started on {dst}",
        "SERVICE_STOPPED": f"Service {service} stopped on {dst}",
        "LOG_DELETION": f"{user} deleted security logs on {dst}",
        "USER_CREATED": f"User account created: {user}",
        "USER_DISABLED": f"User account disabled: {user}",
        "MALWARE_DETECTED": f"Malware detected on {dst} for user {user}",
    }
    return messages[event_type]


def generate_log(log_id: int) -> dict:
    event_type = random.choices(
        EVENT_TYPES,
        weights=[18, 16, 8, 12, 8, 14, 6, 5, 3, 4, 3, 3],
        k=1,
    )[0]
    user = random.choice(USERS)
    source_ip = random_ip()
    destination_ip = random_ip("192.168.1")
    timestamp = datetime.now(timezone.utc) - timedelta(seconds=random.randint(0, 86400))
    data_volume = random.randint(0, 50_000_000) if event_type in {"FILE_DOWNLOAD", "FILE_UPLOAD"} else 0

    return {
        "id": log_id,
        "timestamp": timestamp.isoformat(),
        "host": random.choice(HOSTS),
        "source_ip": source_ip,
        "destination_ip": destination_ip,
        "user": user,
        "event_type": event_type,
        "severity": SEVERITY_BY_EVENT[event_type],
        "status": STATUS_BY_EVENT[event_type],
        "data_volume": data_volume,
        "raw_message": build_message(event_type, user, source_ip, destination_ip),
    }


def post_json(url: str, payload: object) -> dict:
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def chunks(items: list[dict], size: int):
    for index in range(0, len(items), size):
        yield items[index : index + size]


def main():
    parser = argparse.ArgumentParser(description="Generate fake SIEM logs and send them to the backend.")
    parser.add_argument("--count", type=int, default=100, help="Number of logs to generate")
    parser.add_argument("--batch-size", type=int, default=25, help="Number of logs per HTTP request")
    parser.add_argument("--backend-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--preview", action="store_true", help="Print logs without sending them")
    args = parser.parse_args()

    logs = [generate_log(log_id) for log_id in range(1, args.count + 1)]

    if args.preview:
        print(json.dumps(logs, indent=2))
        return

    endpoint = args.backend_url.rstrip("/") + "/api/logs/raw"
    total_indexed = 0
    for batch in chunks(logs, args.batch_size):
        try:
            response = post_json(endpoint, batch)
        except HTTPError as exc:
            print(f"HTTP error {exc.code}: {exc.read().decode('utf-8', errors='replace')}")
            raise SystemExit(1)
        except URLError as exc:
            print(f"Connection error: {exc.reason}")
            raise SystemExit(1)

        total_indexed += response.get("indexed", 0)
        print(f"Sent {len(batch)} log(s), indexed {response.get('indexed', 0)}")
        if response.get("errors"):
            print(json.dumps(response["errors"], indent=2))

    print(f"Done: generated {len(logs)} log(s), indexed {total_indexed}.")


if __name__ == "__main__":
    main()
