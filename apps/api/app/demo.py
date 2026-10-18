"""Build the public demo's library ahead of time, so a fresh server starts full and fast.

Downloads the classics shelf listed in app.seed from Project Gutenberg, reads and indexes every book, fetches the
search models, and, when an AI key is available, maps a few short books onto the reading map. The Hugging Face
Dockerfile runs it while building the image:

  python -m app.demo [--graph-minutes 15]
"""

import argparse
import logging
import time

from fastapi import HTTPException
from sqlalchemy import func, select

from . import graph
from .config import settings
from .db import SessionLocal, init_db
from .ingest.pipeline import ingest_book
from .models import Book, Chunk, Genre
from .rag import encoders, store
from .routes.books import resolve_genre
from .routes.library import add_gutenberg
from .seed import BOOKS, ROOMS, _have, _key

log = logging.getLogger("demo")


def fill_shelves() -> None:
    with SessionLocal() as db:
        for gid, (title, theme) in ROOMS.items():
            if db.get(Genre, gid) is None:
                resolve_genre(db, None, title, theme)
                db.commit()
        existing = [_key(t) for t in db.scalars(select(Book.title))]
        for genre, items in BOOKS.items():
            for gutenberg_id, title in items:
                if _have(title, existing):
                    continue
                book = None
                for attempt in range(3):
                    try:
                        book = add_gutenberg(db, gutenberg_id, genre)
                        break
                    except HTTPException as exc:
                        log.warning("download %s failed (%s), attempt %d", title, exc.detail, attempt + 1)
                        time.sleep(5)
                if book is None:
                    continue
                ingest_book(book.id)  # reads the book and indexes it for search
                log.info("on the shelf: %s", title.split("|")[0])
                time.sleep(1)  # be polite to gutenberg.org


def map_some(minutes: float) -> None:
    """Map the shortest books first until time runs out; the rest stay unmapped (the map shows them as gaps)."""
    if settings.llm == "none" or minutes <= 0:
        log.info("no AI key at build time: the reading map starts empty")
        return
    deadline = time.monotonic() + minutes * 60
    with SessionLocal() as db:
        sizes = db.execute(select(Book.id, Book.title, func.count(Chunk.id)).join(Chunk).where(Book.status == "ready")
                           .group_by(Book.id).order_by(func.count(Chunk.id))).all()
    for book_id, title, _ in sizes:
        if time.monotonic() > deadline:
            break
        log.info("mapping %s", title)
        graph.build_book(book_id)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--graph-minutes", type=float, default=15)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    init_db()
    # Fetch every model now, so the first visitor's question doesn't wait for downloads.
    encoders.dense(), encoders.sparse()
    if settings.rerank_model:
        encoders.reranker()
    fill_shelves()
    map_some(args.graph_minutes)
    with SessionLocal() as db:
        ready = db.scalar(select(func.count()).select_from(Book).where(Book.status == "ready"))
    log.info("demo library ready: %d books", ready)
    store.client().close()  # close the search index now, not while Python is shutting down
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
