"""Ask about a book or across the library. Answers stream as Server-Sent Events:

  meta       {provider, model, scope, reached}         what's being searched and how far the reader is
  citations  [{n, book_id, chapter_title, location, page, char_start, text, ...}]
  delta      {text}                                     answer text as it's generated
  leak       {names}                                    names that only appear later in the book (hide them)
  done       {cited: [n, ...]}
  error      {message}
"""

import json
import logging
import re
import threading
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal, get_session
from ..models import Book, Chunk, Genre
from ..rag import store
from ..rag.answer import build_prompt, passage_json, passages_only_answer, retrieve
from ..rag.llm import LLMError, stream_chat
from ..rag.spoilers import Spot, leaked_names, story_limits

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["ask"])
Db = Annotated[Session, Depends(get_session)]
CITE = re.compile(r"\[(\d{1,2})\]")


class Turn(BaseModel):
    role: str
    content: str = Field(max_length=4000)


class SpotIn(BaseModel):
    chapter_href: str | None = None
    chapter_fraction: float | None = Field(default=None, ge=0, le=1)
    page: int | None = Field(default=None, ge=1)
    progress: float | None = Field(default=None, ge=0, le=1)


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    history: list[Turn] = []
    # Where an open reader is right now; without it the saved reading position is used.
    position: SpotIn | None = None
    # The reader can choose to allow text past their position (e.g. on a re-read).
    spoilers: bool = False


class LibraryAskIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    history: list[Turn] = []
    genre_id: str | None = None
    spoilers: bool = False


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _answer_stream(question: str, history: list[dict], scope: dict, spoilers: bool, **where) -> AsyncIterator[str]:
    with SessionLocal() as session:
        try:
            retrieval = await run_in_threadpool(retrieve, session, question, spoilers=spoilers, **where)
        except Exception as exc:  # noqa: BLE001  (surface retrieval failures to the reader)
            log.exception("retrieval failed")
            yield _sse("error", {"message": f"Search failed: {exc}"})
            return
        yield _sse("meta", {"provider": settings.llm, "model": settings.llm_model_name, "scope": scope,
                            "reached": retrieval.reached, "spoilers": spoilers})
        yield _sse("citations", [passage_json(p) for p in retrieval.passages])

        if settings.llm == "none" or not retrieval.passages:
            text = passages_only_answer(retrieval)
            yield _sse("delta", {"text": text})
        else:
            system, messages = build_prompt(question, retrieval, history, spoilers)
            parts: list[str] = []
            try:
                async for piece in stream_chat(system, messages):
                    parts.append(piece)
                    yield _sse("delta", {"text": piece})
            except LLMError as exc:
                yield _sse("error", {"message": str(exc)})
                return
            except Exception as exc:  # noqa: BLE001
                log.exception("llm failed")
                yield _sse("error", {"message": f"The AI model failed: {exc}"})
                return
            text = "".join(parts)

        valid = {p.n for p in retrieval.passages}
        cited = sorted({int(n) for n in CITE.findall(text)} & valid)
        # Passages-only answers quote allowed text verbatim, so only generated answers need the leak check.
        stories = story_limits(session, retrieval.limits)
        if stories and settings.llm != "none":
            context = "\n".join(p.text for p in retrieval.passages)
            names = await run_in_threadpool(leaked_names, session, text, stories, context)
            if names:
                yield _sse("leak", {"names": names})
        yield _sse("done", {"cited": cited})


def _stream(gen: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(gen, media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/books/{book_id}/ask")
async def ask_book(book_id: str, body: AskIn, db: Db) -> StreamingResponse:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(404, "Book not found")
    if book.status != "ready":
        raise HTTPException(409, "This book is still being processed")
    spot = Spot(**body.position.model_dump()) if body.position else None
    history = [t.model_dump() for t in body.history]
    return _stream(_answer_stream(body.question, history, {"book_id": book_id, "title": book.title}, body.spoilers,
                                  book_id=book_id, spot=spot))


@router.post("/ask")
async def ask_library(body: LibraryAskIn, db: Db) -> StreamingResponse:
    title = "your library"
    if body.genre_id:
        genre = db.get(Genre, body.genre_id)
        if genre is None:
            raise HTTPException(404, "Genre not found")
        title = genre.title
    history = [t.model_dump() for t in body.history]
    return _stream(_answer_stream(body.question, history, {"genre_id": body.genre_id, "title": title}, body.spoilers,
                                  genre_id=body.genre_id))


@router.get("/rag/status")
def rag_status(db: Db) -> dict:
    books = db.scalars(select(Book).where(Book.status == "ready")).all()
    indexed = sum(1 for b in books if store.indexed_count(b.id) > 0)
    return {
        "provider": settings.llm, "model": settings.llm_model_name, "backup": settings.llm_backup_name,
        "embed_model": settings.embed_model,
        "rerank_model": settings.rerank_model or None, "books": len(books), "indexed": indexed,
        "indexing": {bid: {"done": d, "total": t} for bid, (d, t) in store.indexing.items()},
    }


_reindex_lock = threading.Lock()


def _reindex_all(only_missing: bool) -> None:
    if not _reindex_lock.acquire(blocking=False):
        return
    try:
        with SessionLocal() as session:
            ids = session.scalars(select(Book.id).where(Book.status == "ready").order_by(Book.created_at)).all()
        for bid in ids:
            if only_missing and store.indexed_count(bid) > 0:
                continue
            try:
                store.index_book(bid)
            except Exception:  # noqa: BLE001
                log.exception("indexing %s failed", bid)
    finally:
        _reindex_lock.release()


@router.post("/rag/reindex", status_code=202)
def reindex(background: BackgroundTasks, all: bool = False) -> dict:
    """Index books that aren't indexed yet (or every book with ?all=true). Runs in the background."""
    background.add_task(_reindex_all, not all)
    return {"started": True}


@router.get("/passages/{chunk_id}")
def passage(chunk_id: int, db: Db) -> dict:
    """One passage with its location, so a citation from the Librarian can open the right book at the right place."""
    chunk = db.get(Chunk, chunk_id)
    if chunk is None:
        raise HTTPException(404, "Passage not found")
    book = db.get(Book, chunk.book_id)
    return {"n": 0, "chunk_id": chunk.id, "book_id": chunk.book_id, "book_title": book.title if book else "",
            "author": book.author if book else "", "chapter_title": chunk.chapter_title, "location": chunk.location,
            "page": chunk.page, "char_start": chunk.char_start, "text": chunk.text}


class RetrieveIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    book_id: str | None = None
    genre_id: str | None = None
    spoilers: bool = False
    k: int = Field(default=8, ge=1, le=20)


@router.post("/retrieve")
async def retrieve_passages(body: RetrieveIn, db: Db) -> dict:
    """Spoiler-safe passages without an LLM answer: for tools (the MCP server, the discussion partner) that do
    their own thinking. Uses the saved reading position of each book."""
    if body.book_id and db.get(Book, body.book_id) is None:
        raise HTTPException(404, "Book not found")
    r = await run_in_threadpool(retrieve, db, body.question, book_id=body.book_id, genre_id=body.genre_id,
                                spoilers=body.spoilers, k=body.k)
    return {"passages": [passage_json(p) for p in r.passages], "reached": r.reached}


class DiscussIn(BaseModel):
    # Empty → the partner opens the conversation about what the reader just read.
    message: str | None = Field(default=None, max_length=2000)
    history: list[Turn] = []
    position: SpotIn | None = None


@router.post("/books/{book_id}/discuss")
async def discuss(book_id: str, body: DiscussIn, db: Db) -> StreamingResponse:
    """The discussion partner (same event stream as /ask). Always spoiler-safe."""
    from ..rag.discuss import prepare

    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(404, "Book not found")
    if book.status != "ready":
        raise HTTPException(409, "This book is still being processed")
    spot = Spot(**body.position.model_dump()) if body.position else None
    history = [t.model_dump() for t in body.history]

    async def events() -> AsyncIterator[str]:
        with SessionLocal() as session:
            try:
                s = await run_in_threadpool(prepare, session, book_id, body.message, history, spot)
            except Exception as exc:  # noqa: BLE001
                log.exception("discussion prep failed")
                yield _sse("error", {"message": f"Couldn't prepare the discussion: {exc}"})
                return
            yield _sse("meta", {"provider": settings.llm, "model": settings.llm_model_name, "scope": {"book_id": book_id, "title": book.title},
                                "reached": {book_id: s["limit"] / max(book.total_chars, 1)}, "spoilers": False})
            yield _sse("citations", [passage_json(p) for p in s["passages"]])
            if settings.llm == "none":
                yield _sse("error", {"message": "The discussion partner needs an AI model. Add a Gemini key in apps/api/.env."})
                return
            parts: list[str] = []
            try:
                async for piece in stream_chat(s["system"], s["messages"], max_tokens=500):
                    parts.append(piece)
                    yield _sse("delta", {"text": piece})
            except LLMError as exc:
                yield _sse("error", {"message": str(exc)})
                return
            text = "".join(parts)
            context = "\n".join(p.text for p in s["passages"])
            stories = story_limits(session, {book_id: s["limit"]})
            names = await run_in_threadpool(leaked_names, session, text, stories, context) if stories else []
            if names:
                yield _sse("leak", {"names": names})
            valid = {p.n for p in s["passages"]}
            yield _sse("done", {"cited": sorted({int(n) for n in CITE.findall(text)} & valid)})

    return _stream(events())
