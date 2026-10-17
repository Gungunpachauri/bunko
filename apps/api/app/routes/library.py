import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..db import get_session
from ..genres import mood_for, slugify, suggest_theme
from ..jobs import enqueue_ingest
from ..models import Book, Chunk, Genre, Position
from ..schemas import BookOut, GenreIn, GenreOut, GutenbergIn, LibraryOut, PassageHit, SearchOut
from .books import book_out

router = APIRouter(prefix="/api", tags=["library"])
Db = Annotated[Session, Depends(get_session)]


def genre_out(g: Genre) -> GenreOut:
    return GenreOut(id=g.id, title=g.title, mood=g.mood, theme=g.theme, created_at=g.created_at)


@router.get("/health")
def health() -> dict:
    return {"ok": True, "queue": "redis" if settings.redis_url else "thread"}


@router.get("/library", response_model=LibraryOut)
def library(db: Db) -> LibraryOut:
    """Everything the 3D world needs in one call: rooms (genres) and their books with reading positions."""
    genres = db.scalars(select(Genre).order_by(Genre.created_at, Genre.id)).all()
    books = db.scalars(select(Book).options(selectinload(Book.position), selectinload(Book.highlights))
                       .order_by(Book.created_at)).all()
    return LibraryOut(genres=[genre_out(g) for g in genres], books=[book_out(b) for b in books])


@router.get("/genres", response_model=list[GenreOut])
def list_genres(db: Db) -> list[GenreOut]:
    return [genre_out(g) for g in db.scalars(select(Genre).order_by(Genre.created_at, Genre.id))]


@router.post("/genres", response_model=GenreOut, status_code=201)
def create_genre(body: GenreIn, db: Db) -> GenreOut:
    slug = slugify(body.title)
    if db.get(Genre, slug):
        raise HTTPException(409, "That genre already exists")
    count = db.scalar(select(func.count()).select_from(Genre)) or 0
    genre = Genre(id=slug, title=body.title.strip(), mood=mood_for(count), theme=body.theme or suggest_theme(body.title))
    db.add(genre)
    db.commit()
    return genre_out(genre)


@router.get("/continue", response_model=BookOut | None)
def continue_reading(db: Db) -> BookOut | None:
    """The book you read most recently and haven't finished (falls back to the most recent of all)."""
    q = select(Book).join(Position).options(selectinload(Book.position)).order_by(Position.updated_at.desc())
    book = db.scalars(q.where(Position.progress < 0.995).limit(1)).first() or db.scalars(q.limit(1)).first()
    return book_out(book) if book else None


def _snippet(text: str, q: str, width: int = 180) -> str:
    i = text.lower().find(q.lower())
    if i < 0:
        return text[:width] + ("…" if len(text) > width else "")
    start = max(0, i - width // 3)
    end = min(len(text), start + width)
    return ("…" if start else "") + text[start:end] + ("…" if end < len(text) else "")


@router.get("/search", response_model=SearchOut)
def search(db: Db, q: Annotated[str, Query(min_length=1, max_length=200)], limit: int = 8) -> SearchOut:
    """Ctrl+K: titles, authors, genres and passages. Plain text matching for now; Phase 3 adds semantic search."""
    term = f"%{q.strip()}%"
    books = db.scalars(
        select(Book).options(selectinload(Book.position))
        .where(or_(Book.title.ilike(term), Book.author.ilike(term))).order_by(Book.title).limit(limit)
    ).all()
    genres = db.scalars(select(Genre).where(Genre.title.ilike(term)).limit(4)).all()
    rows = db.execute(
        select(Chunk, Book.title).join(Book, Chunk.book_id == Book.id)
        .where(Book.status == "ready", Chunk.text.ilike(term)).order_by(Book.title, Chunk.ordinal).limit(limit * 3)
    ).all()
    passages: list[PassageHit] = []
    per_book: dict[str, int] = {}
    for chunk, title in rows:
        # At most three passages per book so one book can't fill the list.
        if per_book.get(chunk.book_id, 0) >= 3 or len(passages) >= limit:
            continue
        per_book[chunk.book_id] = per_book.get(chunk.book_id, 0) + 1
        passages.append(PassageHit(book_id=chunk.book_id, book_title=title, chapter_title=chunk.chapter_title,
                                   location=chunk.location, page=chunk.page, snippet=_snippet(chunk.text, q.strip())))
    return SearchOut(books=[book_out(b) for b in books], passages=passages, genres=[genre_out(g) for g in genres])


@router.post("/import/gutenberg", response_model=BookOut, status_code=201)
def import_gutenberg(body: GutenbergIn, db: Db) -> BookOut:
    """Download a public-domain EPUB from Project Gutenberg and add it to a genre."""
    genre = db.get(Genre, body.genre_id)
    if genre is None:
        raise HTTPException(400, "Unknown genre")
    url = f"https://www.gutenberg.org/ebooks/{body.gutenberg_id}.epub3.images"
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=60, headers={"User-Agent": "bunko/0.1"})
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Could not download from Project Gutenberg: {exc}") from exc
    if not resp.content.startswith(b"PK"):
        raise HTTPException(502, "Project Gutenberg did not return an EPUB")

    book_id = str(uuid.uuid4())
    file_name = f"{book_id}.epub"
    (settings.books_dir / file_name).write_bytes(resp.content)
    book = Book(id=book_id, title=f"gutenberg-{body.gutenberg_id}.epub", genre_id=genre.id, format="epub", file_name=file_name)
    db.add(book)
    db.commit()
    enqueue_ingest(book.id)
    db.refresh(book)
    return book_out(book)

