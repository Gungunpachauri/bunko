"""Background jobs: an RQ queue on Redis when configured (Docker), else a thread in the API (local dev)."""

import threading
from functools import lru_cache

from .config import settings
from .ingest.pipeline import ingest_book


@lru_cache
def _queue():
    from redis import Redis
    from rq import Queue

    return Queue("ingest", connection=Redis.from_url(settings.redis_url))


def enqueue_ingest(book_id: str) -> None:
    if settings.redis_url:
        _queue().enqueue(ingest_book, book_id, job_timeout=1800)
    else:
        threading.Thread(target=ingest_book, args=(book_id,), daemon=True).start()
