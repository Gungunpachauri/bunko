"""Spoiler safety: what the reader has read, and a check that an answer doesn't name what comes later."""

import re
import threading
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Book, Chunk, Genre


@dataclass
class Spot:
    """Where the reader is right now (sent by an open reader; otherwise the saved position is used)."""

    chapter_href: str | None = None
    chapter_fraction: float | None = None  # EPUB: end of the visible page within that chapter document
    page: int | None = None  # PDF: last visible page
    progress: float | None = None  # whole-book fallback


def reading_limit(session: Session, book: Book, spot: Spot | None) -> int:
    """Character offset the reader has reached. Passages starting at or after it are off limits."""
    total = max(book.total_chars, 1)
    if spot is None and book.position is not None:
        p = book.position
        spot = Spot(chapter_href=p.chapter_href, chapter_fraction=p.chapter_fraction, progress=p.progress,
                    page=int(p.location) if book.format == "pdf" and p.location.isdigit() else None)
    if spot is None:
        # Never opened: only the opening, like the blurb and first pages.
        return min(settings.unread_peek_chars, total)

    if book.format == "pdf" and spot.page:
        end = session.scalar(select(func.max(Chunk.char_end)).where(Chunk.book_id == book.id, Chunk.page <= spot.page))
        return int(end or 0)

    progress_limit = int((spot.progress or 0) * total)
    if spot.chapter_href:
        href = spot.chapter_href.split("#")[0]
        lo, hi = session.execute(
            select(func.min(Chunk.char_start), func.max(Chunk.char_end)).where(Chunk.book_id == book.id, Chunk.location == href)
        ).one()
        if lo is not None:
            if spot.chapter_fraction is not None:
                return int(lo + spot.chapter_fraction * (hi - lo))
            # Only the whole-book estimate: at least the chapter start, never past its end.
            return min(max(progress_limit, lo), hi)
    return progress_limit


# --- leak check -------------------------------------------------------------------------------------------

NAME = re.compile(r"\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b")
_first_seen: dict[str, dict[str, int]] = {}
_cache_lock = threading.Lock()


def _first_occurrences(session: Session, book_id: str) -> dict[str, int]:
    """Capitalised words and two-word names → character offset of their first appearance in the book."""
    with _cache_lock:
        if book_id in _first_seen:
            return _first_seen[book_id]
    seen: dict[str, int] = {}
    for start, text in session.execute(select(Chunk.char_start, Chunk.text).where(Chunk.book_id == book_id).order_by(Chunk.ordinal)):
        for m in NAME.finditer(text):
            for word in {m.group(0), m.group(0).split()[0]}:
                seen.setdefault(word, start + m.start())
    with _cache_lock:
        _first_seen[book_id] = seen
    return seen


def forget(book_id: str) -> None:
    with _cache_lock:
        _first_seen.pop(book_id, None)


def leaked_names(session: Session, answer: str, limits: dict[str, int], context: str = "") -> list[str]:
    """Names in the answer that the reader hasn't met yet: they appear in a searched book only after the reader's
    limit, and nowhere in what the reader has read of any searched book.

    Catches the classic leak where the model knows the book from training and mentions a later character.
    """
    candidates = {m.group(0) for m in NAME.finditer(answer)} | {m.group(0).split()[0] for m in NAME.finditer(answer)}
    later: set[str] = set()
    # Anything in the passages the model was given is fair game (they're all within the reader's reach).
    known: set[str] = {w for w in candidates if w in context}
    for book_id, limit in limits.items():
        first = _first_occurrences(session, book_id)
        for word in candidates:
            at = first.get(word)
            if at is None:
                continue
            (known if at < limit else later).add(word)
    found = later - known
    # "Lady Catherine" and "Catherine" → report the longest form once.
    return sorted(w for w in found if not any(w != o and w in o for o in found))


def story_limits(session: Session, limits: dict[str, int]) -> dict[str, int]:
    """Only stories can be spoiled: drop non-fiction books (essays, scripture, science) from the leak check,
    where a "later" word is just a later idea, not a plot twist."""
    from ..genres import is_narrative

    if not limits:
        return {}
    rows = session.execute(select(Book.id, Book.genre_id).where(Book.id.in_(list(limits)))).all()
    titles = {g.id: g.title for g in session.scalars(select(Genre).where(Genre.id.in_({r[1] for r in rows})))}
    return {bid: limits[bid] for bid, gid in rows if is_narrative(gid, titles.get(gid, ""))}
