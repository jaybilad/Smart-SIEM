import asyncio
import socket
from datetime import timezone
from typing import Tuple

from app.services.normalizer import normalize_syslog
from app.services import bulk_indexer


class SyslogUDPProtocol(asyncio.DatagramProtocol):
	def datagram_received(self, data: bytes, addr: Tuple[str, int]):
		source_ip = addr[0]
		try:
			raw = data.decode(errors="replace")
		except Exception:
			raw = str(data)
		event = normalize_syslog(raw, source_ip=source_ip)
		# enqueue for indexing
		try:
			asyncio.create_task(bulk_indexer.enqueue_for_indexing(event))
		except Exception:
			pass
		print("[SYSLOG UDP]", source_ip, event)


async def handle_tcp_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
	peer = writer.get_extra_info("peername")
	source_ip = peer[0] if peer else None
	try:
		while not reader.at_eof():
			line = await reader.readline()
			if not line:
				break
			try:
				raw = line.decode(errors="replace")
			except Exception:
				raw = str(line)
			event = normalize_syslog(raw, source_ip=source_ip)
			try:
				await bulk_indexer.enqueue_for_indexing(event)
			except Exception:
				pass
			print("[SYSLOG TCP]", source_ip, event)
	finally:
		writer.close()


async def start_syslog_servers(host: str = "0.0.0.0", port: int = 514):
	loop = asyncio.get_running_loop()
	print(f"Starting syslog UDP server on {host}:{port}")
	transport, _ = await loop.create_datagram_endpoint(
		lambda: SyslogUDPProtocol(), local_addr=(host, port)
	)

	print(f"Starting syslog TCP server on {host}:{port}")
	server = await asyncio.start_server(handle_tcp_client, host, port)

	async with server:
		await server.serve_forever()


def test_send_udp(message: str, target: Tuple[str, int] = ("127.0.0.1", 514)):
	s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
	s.sendto(message.encode(), target)
	s.close()

