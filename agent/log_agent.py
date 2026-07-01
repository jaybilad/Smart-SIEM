import time
import socket
import requests
import sys
from typing import Generator

API_URL = "http://127.0.0.1:8000/api/logs/raw"
LOG_FILE = sys.argv[1] if len(sys.argv) > 1 else "/var/log/app/app.log"
SLEEP = 0.5


def tail(path: str) -> Generator[str, None, None]:
	with open(path, "r", encoding="utf-8", errors="ignore") as f:
		f.seek(0, 2)
		while True:
			line = f.readline()
			if not line:
				time.sleep(SLEEP)
				continue
			yield line


def send_line(line: str) -> None:
	payload = {
		"host": socket.gethostname(),
		"source_ip": socket.gethostbyname(socket.gethostname()),
		"log_type": "application",
		"raw_message": line.strip(),
	}
	try:
		requests.post(API_URL, json=[payload], timeout=3)
	except Exception:
		# naive retry: ignore for now
		pass


def main():
	for line in tail(LOG_FILE):
		send_line(line)


if __name__ == "__main__":
	main()

