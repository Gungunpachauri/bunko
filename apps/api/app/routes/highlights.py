"""Highlights and notes, searching them by meaning, and reviewing them with spaced repetition."""

import json
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_session
from ..models import Book, Chunk, Highlight
from ..review import cloze, human_interval, new_card, preview_intervals, review

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["highlights"])
Db = Annotated[Session, Depends(get_session)]
COLORS = {"amber", "rose", "sage", "sky"}
MIN_SCORE = 0.57


class HighlightIn(BaseModel):
    location: str = Field(min_length=1, max_length=1000)
    text: str = Field(min_length=1, max_length=5000)
    chapter_href: str | None = None
    chapter_title: str | None = Field(default=None, max_length=500)
    note: str = Field(default="", max_length=5000)
    color: str = "amber"


class HighlightPatch(BaseModel):
    note: str | None = Field(default=None, max_length=5000)
    color: str | None = None


class HighlightOut(BaseModel):
    id: str
    book_id: str
    book_title: str
    location: str
    chapter_href: str | None
    chapter_title: str
    text: str
    note: str
    color: str
    char_start: int | None
    created_at: datetime
    due: datetime
    reviews: int
    score: float | None = None


class ReviewCard(BaseModel):
    highlight: HighlightOut
    prompt: str
    answer: str | None
    intervals: dict[int, str]


class RatingIn(BaseModel):
    rating: int = Field(ge=1, le=4)  # 1 again · 2 hard · 3 good · 4 easy


def out(h: Highlight, score: float | None = None) -> HighlightOut:
    return HighlightOut(
        id=h.id, book_id=h.book_id, book_title=h.book.title if h.book else "", location=h.location,
        chapter_href=h.chapter_href, chapter_title=h.chapter_title, text=h.text, note=h.note, color=h.color,
        char_start=h.char_start, created_at=h.created_at, due=_aware(h.due), reviews=h.reviews, score=score,
    )


def _aware(d: datetime) -> datetime:
    # SQLite hands datetimes back without a timezone; everything here is stored in UTC.
    return d if d.tzinfo else d.replace(tzinfo=UTC)


norm = lambda s: re.sub(r"\W+", " ", s).strip().lower()  # noqa: E731


def _locate(db: Session, book_id: str, chapter_href: str | None, text: str) -> tuple[int | None, str]:
    """Character offset and chapter title of the highlight, by finding its opening words in the book's passages."""
    needle = norm(text)[:60]
    q = select(Chunk.char_start, Chunk.text, Chunk.chapter_title).where(Chunk.book_id == book_id)
    if chapter_href:
        q = q.where(Chunk.location == chapter_href.split("#")[0])
    for start, body, title in db.execute(q.order_by(Chunk.ordinal)):
        flat = norm(body)
        i = flat.find(needle)
        if i >= 0:
            return start + i, title
    return None, ""


def _embed(h: Highlight) -> None:
    try:
        from ..rag import encoders

        vec = next(iter(encoders.dense().passage_embed([f"{h.text}\n{h.note}".strip()])))
        h.embedding = json.dumps([round(float(x), 5) for x in vec])
    except Exception:  # noqa: BLE001  (search falls back to keywords)
        log.exception("could not embed highlight %s", h.id)


@router.get("/books/{book_id}/highlights", response_model=list[HighlightOut])
def list_book_highlights(book_id: str, db: Db) -> list[HighlightOut]:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(404, "Book not found")
    rows = db.scalars(select(Highlight).options(selectinload(Highlight.book)).where(Highlight.book_id == book_id)
                      .order_by(Highlight.char_start.is_(None), Highlight.char_start, Highlight.created_at))
    return [out(h) for h in rows]


@router.post("/books/{book_id}/highlights", response_model=HighlightOut, status_code=201)
def create_highlight(book_id: str, body: HighlightIn, db: Db) -> HighlightOut:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(404, "Book not found")
    char_start, found_title = _locate(db, book_id, body.chapter_href, body.text)
    card, due = new_card()
    h = Highlight(
        book_id=book_id, location=body.location, chapter_href=body.chapter_href,
        chapter_title=(body.chapter_title or found_title)[:500], text=body.text.strip(), note=body.note.strip(),
        color=body.color if body.color in COLORS else "amber", char_start=char_start, card=card, due=due,
    )
    _embed(h)
    db.add(h)
    db.commit()
    db.refresh(h)
    return out(h)


@router.patch("/highlights/{highlight_id}", response_model=HighlightOut)
def update_highlight(highlight_id: str, body: HighlightPatch, db: Db) -> HighlightOut:
    h = db.get(Highlight, highlight_id)
    if h is None:
        raise HTTPException(404, "Highlight not found")
    if body.note is not None and body.note.strip() != h.note:
        h.note = body.note.strip()
        _embed(h)
    if body.color in COLORS:
        h.color = body.color
    db.commit()
    db.refresh(h)
    return out(h)


@router.delete("/highlights/{highlight_id}", status_code=204)
def delete_highlight(highlight_id: str, db: Db) -> Response:
    h = db.get(Highlight, highlight_id)
    if h is None:
        raise HTTPException(404, "Highlight not found")
    db.delete(h)
    db.commit()
    return Response(status_code=204)


def search_highlights(db: Session, q: str | None, book_id: str | None = None, limit: int = 20) -> list[HighlightOut]:
    """By meaning and by words: "what did I find important about leadership?" finds notes on leading, not just the word."""
    stmt = select(Highlight).options(selectinload(Highlight.book))
    if book_id:
        stmt = stmt.where(Highlight.book_id == book_id)
    rows = db.scalars(stmt.order_by(Highlight.created_at.desc())).all()
    if not q or not q.strip():
        return [out(h) for h in rows[:limit]]

    terms = [t for t in norm(q).split() if len(t) > 2]
    scores: dict[str, float] = {}
    try:
        import numpy as np

        from ..rag import encoders

        qv = encoders.embed_query(q)
        for h in rows:
            if h.embedding:
                v = np.array(json.loads(h.embedding))
                scores[h.id] = float(np.dot(qv, v) / (np.linalg.norm(qv) * np.linalg.norm(v) + 1e-9))
    except Exception:  # noqa: BLE001
        log.exception("semantic highlight search failed; using keywords only")
    for h in rows:
        hay = norm(f"{h.text} {h.note} {h.chapter_title} {h.book.title if h.book else ''}")
        hits = sum(1 for t in terms if t in hay)
        scores[h.id] = scores.get(h.id, 0.0) + 0.08 * hits
    ranked = sorted(rows, key=lambda h: scores.get(h.id, 0.0), reverse=True)
    # The small embedding model scores unrelated text around 0.5 and related text from about 0.6, so keep matches
    # above that floor and close to the best one. A matching word adds 0.08, so exact terms always get through.
    top = scores.get(ranked[0].id, 0.0) if ranked else 0.0
    return [out(h, round(scores.get(h.id, 0.0), 3)) for h in ranked[:limit] if scores.get(h.id, 0.0) >= max(MIN_SCORE, top - 0.12)]


@router.get("/highlights", response_model=list[HighlightOut])
def find_highlights(db: Db, q: Annotated[str | None, Query(max_length=300)] = None, book_id: str | None = None,
                    limit: int = 20) -> list[HighlightOut]:
    return search_highlights(db, q, book_id, limit)


# --- review -----------------------------------------------------------------------------------------------

@router.get("/review/queue", response_model=list[ReviewCard])
def review_queue(db: Db, limit: int = 20) -> list[ReviewCard]:
    now = datetime.now(UTC)
    rows = db.scalars(select(Highlight).options(selectinload(Highlight.book)).where(Highlight.due <= now)
                      .order_by(Highlight.due).limit(limit)).all()
    cards = []
    for h in rows:
        prompt, answer = cloze(h.text)
        cards.append(ReviewCard(highlight=out(h), prompt=prompt, answer=answer, intervals=preview_intervals(h, now)))
    return cards


@router.post("/review/{highlight_id}", response_model=HighlightOut)
def review_highlight(highlight_id: str, body: RatingIn, db: Db) -> HighlightOut:
    h = db.get(Highlight, highlight_id)
    if h is None:
        raise HTTPException(404, "Highlight not found")
    review(h, body.rating)
    db.commit()
    db.refresh(h)
    return out(h)


@router.get("/review/stats")
def review_stats(db: Db) -> dict:
    now = datetime.now(UTC)
    total = db.scalar(select(func.count()).select_from(Highlight)) or 0
    due_now = db.scalar(select(func.count()).select_from(Highlight).where(Highlight.due <= now)) or 0
    soonest = db.scalar(select(func.min(Highlight.due)).where(Highlight.due > now))
    return {
        "total": total, "due": due_now,
        "next_in": human_interval(_aware(soonest) - now) if soonest else None,
        "due_this_week": db.scalar(select(func.count()).select_from(Highlight)
                                   .where(Highlight.due <= now + timedelta(days=7))) or 0,
    }
