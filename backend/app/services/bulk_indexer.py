import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List

_BUFFER: List[Dict[str, Any]] = []
_INDEXED: List[Dict[str, Any]] = []
_LOCK = asyncio.Lock()
_FLUSH_TASK = None

BATCH_SIZE = 10
FLUSH_INTERVAL = 1.0


async def _flush_locked():
    global _BUFFER, _INDEXED
    if not _BUFFER:
        return
    to_send = _BUFFER
    _BUFFER = []
    # simulate indexing by adding ingestion timestamp
    ts = datetime.now(timezone.utc).isoformat()
    for doc in to_send:
        doc.setdefault("ingested_at", ts)
        _INDEXED.append(doc)


async def _flusher_loop():
    try:
        while True:
            await asyncio.sleep(FLUSH_INTERVAL)
            async with _LOCK:
                await _flush_locked()
    except asyncio.CancelledError:
        # flush remaining
        async with _LOCK:
            await _flush_locked()
        raise


def _ensure_flusher():
    global _FLUSH_TASK
    if _FLUSH_TASK is None:
        loop = asyncio.get_running_loop()
        _FLUSH_TASK = loop.create_task(_flusher_loop())


async def enqueue_for_indexing(doc: Dict[str, Any]):
    async with _LOCK:
        _BUFFER.append(doc)
        if len(_BUFFER) >= BATCH_SIZE:
            await _flush_locked()
    # ensure flusher is running
    try:
        _ensure_flusher()
    except RuntimeError:
        # no running loop, caller should start flusher externally
        pass


def get_indexed_docs() -> List[Dict[str, Any]]:
    return list(_INDEXED)
