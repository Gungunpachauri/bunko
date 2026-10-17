"""Turn an uploaded file into a ready book: metadata, cover, and located passages."""

import logging
import traceback

from sqlalchemy import delete

from ..config import settings
from ..db import SessionLocal
from ..models import Book, Chunk
from .chunking import chunk_sections
from .epub import parse_epub
from .pdf import parse_pdf

log = logging.getLogger(__name__)


def ingest_book(book_id: str) -> None:
    """Runs in the RQ worker (Docker) or a background thread (local dev)."""
    with SessionLocal() as session:
        book = session.get(Book, book_id)
        if book is None:
            return
        path = settings.books_dir / book.file_name
        try:
            parsed = parse_epub(path) if book.format == "epub" else parse_pdf(path)
            passages, total_chars = chunk_sections(parsed.sections)
            if not passages:
                raise ValueError("No readable text found (a scanned PDF needs OCR, which isn't supported yet).")

            # Keep a title the user typed; fill in what they left blank from the file.
            if book.title in ("", book.file_name) or book.title.lower().endswith((".epub", ".pdf")):
                book.title = parsed.title[:500]
            if book.author in ("", "Unknown"):
                book.author = parsed.author[:300]
            book.description = parsed.description
            book.total_chars = total_chars
            book.total_pages = parsed.extra.get("page_count") or max(p.page for p in passages)

            if parsed.cover:
                (settings.covers_dir / f"{book.id}.img").write_bytes(parsed.cover)
                book.has_cover = True

            session.execute(delete(Chunk).where(Chunk.book_id == book.id))
            session.add_all(Chunk(book_id=book.id, **p.__dict__) for p in passages)
            book.status = "ready"
            book.error = None
            session.commit()
            log.info("ingested %s: %d passages", book.id, len(passages))
        except Exception as exc:  # noqa: BLE001  (any parse failure marks the book failed)
            session.rollback()
            book = session.get(Book, book_id)
            if book is not None:
                book.status = "failed"
                book.error = f"{type(exc).__name__}: {exc}"
                session.commit()
            log.error("ingest failed for %s\n%s", book_id, traceback.format_exc())
    _index(book_id)


def _index(book_id: str) -> None:
    """Make the book askable. A failure here leaves the book readable; it's retried on the next start."""
    from ..rag import spoilers, store

    try:
        spoilers.forget(book_id)
        store.index_book(book_id)
    except Exception:  # noqa: BLE001
        log.error("indexing failed for %s\n%s", book_id, traceback.format_exc())
