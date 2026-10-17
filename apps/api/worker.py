"""RQ worker that processes uploaded books (used by Docker Compose; needs Linux/macOS)."""

from redis import Redis
from rq import Queue, Worker

from app.config import settings
from app.db import init_db

if __name__ == "__main__":
    if not settings.redis_url:
        raise SystemExit("REDIS_URL is not set; without it the API processes books itself.")
    init_db()
    conn = Redis.from_url(settings.redis_url)
    Worker([Queue("ingest", connection=conn)], connection=conn).work()
