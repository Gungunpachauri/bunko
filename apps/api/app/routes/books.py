import shutil
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import graph
from ..config import settings
from ..db import get_session
from ..genres import mood_for, slugify, suggest_theme
from ..jobs import enqueue_ingest
from ..models import Book, Chunk, Genre, Position
from ..rag import store
from ..schemas import BookOut, PositionIn, PositionOut, TocEntry

router = APIRouter(prefix="/api/books", tags=["books"])
Db = Annotated[Session, Depends(get_session)]

FORMATS = {".epub": "epub", ".pdf": "pdf"}


def book_out(b: Book) -> BookOut:
    pos = b.position
    return BookOut(
        id=b.id, title=b.title, author=b.author, genre_id=b.genre_id, format=b.format, status=b.status, error=b.error,
        description=b.description, has_cover=b.has_cover, total_pages=b.total_pages, total_chars=b.total_chars,
        created_at=b.created_at,
        highlights=[h.text for h in b.highlights[-3:]][::-1], highlight_count=len(b.highlights),
        position=PositionOut(location=pos.location, progress=pos.progress, chapter_href=pos.chapter_href, updated_at=pos.updated_at) if pos else None,
    )


def get_book(db: Session, book_id: str) -> Book:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(404, "Book not found")
    return book


def resolve_genre(db: Session, genre_id: str | None, new_genre: str | None, theme: str | None) -> Genre:
    """Use an existing genre, or create a new one (which becomes a new room in the library)."""
    if new_genre and new_genre.strip():
        title = new_genre.strip()[:120]
        slug = slugify(title)
        existing = db.get(Genre, slug)
        if existing:
            return existing
        count = db.scalar(select(func.count()).select_from(Genre)) or 0
        genre = Genre(id=slug, title=title, mood=mood_for(count), theme=theme or suggest_theme(title))
        db.add(genre)
        db.flush()
        return genre
    genre = db.get(Genre, genre_id or "")
    if genre is None:
        raise HTTPException(400, "Pick an existing genre or name a new one")
    return genre


@router.post("", response_model=BookOut, status_code=201)
def upload_book(
    db: Db,
    file: Annotated[UploadFile, File()],
    genre_id: Annotated[str | None, Form()] = None,
    new_genre: Annotated[str | None, Form()] = None,
    theme: Annotated[str | None, Form()] = None,
    title: Annotated[str | None, Form()] = None,
    author: Annotated[str | None, Form()] = None,
) -> BookOut:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in FORMATS:
        raise HTTPException(415, "Only EPUB and PDF files are supported")
    genre = resolve_genre(db, genre_id, new_genre, theme)

    book_id = str(uuid.uuid4())
    file_name = f"{book_id}{ext}"
    dest = settings.books_dir / file_name
    limit = settings.max_upload_mb * 1024 * 1024
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out, length=1024 * 1024)
    if dest.stat().st_size > limit:
        dest.unlink(missing_ok=True)
        raise HTTPException(413, f"File is larger than {settings.max_upload_mb} MB")

    book = Book(
        id=book_id, title=(title or file.filename or "Untitled")[:500], author=(author or "Unknown")[:300],
        genre_id=genre.id, format=FORMATS[ext], file_name=file_name,
    )
    db.add(book)
    db.commit()
    enqueue_ingest(book.id)
    db.refresh(book)
    return book_out(book)


@router.get("/{book_id}", response_model=BookOut)
def read_book(book_id: str, db: Db) -> BookOut:
    return book_out(get_book(db, book_id))


@router.delete("/{book_id}", status_code=204)
def delete_book(book_id: str, db: Db) -> Response:
    book = get_book(db, book_id)
    (settings.books_dir / book.file_name).unlink(missing_ok=True)
    (settings.covers_dir / f"{book.id}.img").unlink(missing_ok=True)
    db.delete(book)
    db.commit()
    store.delete_book(book_id)
    graph.drop_orphans(db)  # ideas only this book mentioned leave the reading map too
    return Response(status_code=204)


@router.get("/{book_id}/file")
def book_file(book_id: str, db: Db) -> FileResponse:
    book = get_book(db, book_id)
    media = "application/epub+zip" if book.format == "epub" else "application/pdf"
    return FileResponse(settings.books_dir / book.file_name, media_type=media)


@router.get("/{book_id}/cover")
def book_cover(book_id: str, db: Db) -> Response:
    book = get_book(db, book_id)
    path = settings.covers_dir / f"{book.id}.img"
    if not book.has_cover or not path.exists():
        raise HTTPException(404, "No cover")
    data = path.read_bytes()
    media = "image/png" if data[:4] == b"\x89PNG" else "image/gif" if data[:3] == b"GIF" else "image/webp" if data[8:12] == b"WEBP" else "image/jpeg"
    return Response(data, media_type=media, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/{book_id}/toc", response_model=list[TocEntry])
def book_toc(book_id: str, db: Db) -> list[TocEntry]:
    get_book(db, book_id)
    rows = db.execute(
        select(Chunk.chapter_index, Chunk.chapter_title, Chunk.location, Chunk.page)
        .where(Chunk.book_id == book_id).order_by(Chunk.ordinal)
    ).all()
    seen: set[int] = set()
    out: list[TocEntry] = []
    for idx, title, loc, page in rows:
        if idx not in seen:
            seen.add(idx)
            out.append(TocEntry(chapter_index=idx, title=title, location=loc, page=page))
    return out


@router.get("/{book_id}/position", response_model=PositionOut | None)
def read_position(book_id: str, db: Db) -> PositionOut | None:
    pos = get_book(db, book_id).position
    return PositionOut(location=pos.location, progress=pos.progress, chapter_href=pos.chapter_href, updated_at=pos.updated_at) if pos else None


@router.put("/{book_id}/position", response_model=PositionOut)
def save_position(book_id: str, body: PositionIn, db: Db) -> PositionOut:
    book = get_book(db, book_id)
    pos = book.position
    if pos is None:
        pos = Position(book_id=book.id, location=body.location, progress=body.progress, chapter_href=body.chapter_href,
                       chapter_fraction=body.chapter_fraction)
        db.add(pos)
    else:
        pos.location, pos.progress, pos.chapter_href = body.location, body.progress, body.chapter_href
        pos.chapter_fraction = body.chapter_fraction
    db.commit()
    db.refresh(pos)
    return PositionOut(location=pos.location, progress=pos.progress, chapter_href=pos.chapter_href, updated_at=pos.updated_at)
