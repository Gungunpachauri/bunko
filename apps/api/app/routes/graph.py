"""Connections: a book's ideas and people, which other books share each idea, and where they agree or differ.

Everything is spoiler-safe: in stories, only mentions before the reader's position are shown or used.
"""

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import graph
from ..db import get_session
from ..genres import is_narrative
from ..models import Book, BookGraph, Chunk, Comparison, Concept, Mention, Relation
from ..rag.llm import LLMError, stream_chat
from ..rag.spoilers import reading_limit

router = APIRouter(prefix="/api", tags=["graph"])
Db = Annotated[Session, Depends(get_session)]


def _limits(db: Session) -> dict[str, int | None]:
    """How far each book may be shown: the reader's position for stories, everything (None) for non-fiction."""
    out: dict[str, int | None] = {}
    for b in db.scalars(select(Book).options(selectinload(Book.position), selectinload(Book.genre)).where(Book.status == "ready")):
        story = is_narrative(b.genre_id, b.genre.title if b.genre else "")
        out[b.id] = reading_limit(db, b, None) if story else None
    return out


def _visible(m_book: str, char_start: int, limits: dict[str, int | None]) -> bool:
    if m_book not in limits:
        return False
    lim = limits[m_book]
    return lim is None or char_start < lim


@router.get("/books/{book_id}/connections")
def connections(book_id: str, db: Db) -> dict:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(404, "Book not found")
    limits = _limits(db)
    titles = {b.id: b.title for b in db.scalars(select(Book))}

    here = [m for m in db.scalars(select(Mention).where(Mention.book_id == book_id)) if _visible(book_id, m.char_start, limits)]
    concept_ids = {m.concept_id for m in here}
    concepts = {c.id: c for c in db.scalars(select(Concept).where(Concept.id.in_(concept_ids)))} if concept_ids else {}
    count_here: dict[int, int] = {}
    for m in here:
        count_here[m.concept_id] = count_here.get(m.concept_id, 0) + 1

    # Other books mentioning the same ideas (also spoiler-safe for them).
    elsewhere: dict[int, dict[str, int]] = {}
    idea_ids = [cid for cid, c in concepts.items() if c.kind == "idea"]
    if idea_ids:
        for m in db.scalars(select(Mention).where(Mention.concept_id.in_(idea_ids), Mention.book_id != book_id)):
            if _visible(m.book_id, m.char_start, limits):
                per = elsewhere.setdefault(m.concept_id, {})
                per[m.book_id] = per.get(m.book_id, 0) + 1

    def concept_out(c: Concept) -> dict:
        also = sorted(({"book_id": bid, "title": titles.get(bid, ""), "count": n} for bid, n in elsewhere.get(c.id, {}).items()),
                      key=lambda x: -x["count"])
        return {"id": c.id, "name": c.name, "kind": c.kind, "description": c.description, "count": count_here.get(c.id, 0), "also_in": also}

    ideas = sorted((concept_out(c) for c in concepts.values() if c.kind == "idea"), key=lambda x: (-len(x["also_in"]), -x["count"], x["name"]))
    people = sorted((concept_out(c) for c in concepts.values() if c.kind != "idea"), key=lambda x: (-x["count"], x["name"]))

    links = []
    for r in db.scalars(select(Relation).where(Relation.book_id == book_id)):
        if _visible(book_id, r.char_start, limits) and r.source_id in concepts and r.target_id in concepts:
            links.append({"source": concepts[r.source_id].name, "target": concepts[r.target_id].name, "label": r.label})

    return {"status": graph.status(db, book_id), "ideas": ideas, "people": people, "links": links[:40],
            "spoiler_safe": limits.get(book_id) is not None}


@router.post("/books/{book_id}/connections/build", status_code=202)
def build_connections(book_id: str, db: Db) -> dict:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(404, "Book not found")
    if book.status != "ready":
        raise HTTPException(409, "This book is still being processed")
    graph.queue_book(book_id)
    return graph.status(db, book_id)


@router.post("/graph/build-all", status_code=202)
def build_all(db: Db) -> dict:
    """Queue every book whose connections haven't been built yet."""
    built = set(db.scalars(select(BookGraph.book_id).where(BookGraph.status.in_(("ready", "building", "queued")))))
    queued = [bid for bid in db.scalars(select(Book.id).where(Book.status == "ready")) if bid not in built]
    for bid in queued:
        graph.queue_book(bid)
    return {"queued": len(queued)}


@router.get("/graph/status")
def graph_status(db: Db) -> dict:
    rows = db.scalars(select(BookGraph)).all()
    return {r.book_id: {"status": r.status, "done": r.done, "total": r.total, "error": r.error} for r in rows}


def _passage(c: Chunk, book: Book, n: int) -> dict:
    return {"n": n, "chunk_id": c.id, "book_id": book.id, "book_title": book.title, "author": book.author,
            "chapter_title": c.chapter_title, "location": c.location, "page": c.page, "char_start": c.char_start,
            "text": c.text, "score": 0.0}


@router.get("/concepts/{concept_id}")
def concept_detail(concept_id: int, db: Db) -> dict:
    c = db.get(Concept, concept_id)
    if c is None:
        raise HTTPException(404, "Not found")
    limits = _limits(db)
    books: dict[str, dict] = {}
    for m in db.scalars(select(Mention).where(Mention.concept_id == concept_id).order_by(Mention.char_start)):
        if not _visible(m.book_id, m.char_start, limits):
            continue
        b = db.get(Book, m.book_id)
        chunk = db.get(Chunk, m.chunk_id) if m.chunk_id else None
        entry = books.setdefault(m.book_id, {"book_id": m.book_id, "title": b.title, "author": b.author, "mentions": []})
        entry["mentions"].append({
            "note": m.note, "chunk_id": m.chunk_id, "chapter_title": chunk.chapter_title if chunk else "",
            "page": chunk.page if chunk else None, "snippet": (" ".join(chunk.text.split())[:320] + "…") if chunk else "",
        })
    return {"id": c.id, "name": c.name, "kind": c.kind, "description": c.description,
            "books": sorted(books.values(), key=lambda x: -len(x["mentions"]))}


class CompareOut(BaseModel):
    text: str
    passages: list[dict]
    cached: bool


COMPARE_SYSTEM = """You compare what different books say about one idea, for a curious reader. Use plain, simple words.

- Use only the numbered passages; cite them like [2].
- Say where the books agree, then where they differ or emphasise something else. Be specific and quote short phrases.
- 4–7 sentences, no headings or lists. End with one short line on what reading them together teaches.
- Never reveal anything beyond these passages (the reader may not have finished the books)."""


@router.post("/concepts/{concept_id}/compare", response_model=CompareOut)
async def compare(concept_id: int, db: Db) -> CompareOut:
    c = db.get(Concept, concept_id)
    if c is None:
        raise HTTPException(404, "Not found")
    limits = _limits(db)
    per_book: dict[str, list[Mention]] = {}
    for m in db.scalars(select(Mention).where(Mention.concept_id == concept_id, Mention.chunk_id.is_not(None)).order_by(Mention.char_start)):
        if _visible(m.book_id, m.char_start, limits) and len(per_book.setdefault(m.book_id, [])) < 2:
            per_book[m.book_id].append(m)
    if len(per_book) < 2:
        raise HTTPException(409, "This idea appears in only one of the books you've read so far")
    chosen = [m for ms in per_book.values() for m in ms][:8]
    basis = ",".join(str(i) for i in sorted(m.id for m in chosen))

    saved = db.scalar(select(Comparison).where(Comparison.concept_id == concept_id, Comparison.basis == basis))
    if saved:
        return CompareOut(text=saved.text, passages=json.loads(saved.passages), cached=True)

    passages = []
    for n, m in enumerate(chosen, start=1):
        chunk, book = db.get(Chunk, m.chunk_id), db.get(Book, m.book_id)
        passages.append(_passage(chunk, book, n))
    context = "\n\n".join(f"[{p['n']}] {p['book_title']} by {p['author']} ({p['chapter_title'] or 'passage'})\n{p['text'][:1800]}" for p in passages)
    user = f"The idea: {c.name} ({c.description})\n\nPassages:\n\n{context}\n\nHow do these books agree and differ about {c.name}?"
    try:
        text = "".join([piece async for piece in stream_chat(COMPARE_SYSTEM, [{"role": "user", "content": user}], max_tokens=600)])
    except LLMError as exc:
        raise HTTPException(503, str(exc)) from exc
    db.add(Comparison(concept_id=concept_id, basis=basis, text=text, passages=json.dumps(passages)))
    db.commit()
    return CompareOut(text=text, passages=passages, cached=False)


@router.get("/graph/shared")
def shared_ideas(db: Db, limit: int = 30) -> list[dict]:
    """Ideas found in two or more books (spoiler-safe): the library's strongest cross-book links."""
    limits = _limits(db)
    titles = {b.id: b.title for b in db.scalars(select(Book))}
    per: dict[int, set[str]] = {}
    for m in db.scalars(select(Mention).join(Concept).where(Concept.kind == "idea")):
        if _visible(m.book_id, m.char_start, limits):
            per.setdefault(m.concept_id, set()).add(m.book_id)
    ids = [cid for cid, bs in per.items() if len(bs) >= 2]
    concepts = {c.id: c for c in db.scalars(select(Concept).where(Concept.id.in_(ids)))} if ids else {}
    out = [{"id": cid, "name": concepts[cid].name, "books": [{"book_id": b, "title": titles.get(b, "")} for b in per[cid]]}
           for cid in ids]
    return sorted(out, key=lambda x: -len(x["books"]))[:limit]



@router.get("/graph/map")
def reading_map(db: Db) -> dict:
    """Everything the reading map draws: books (big stars), the ideas they contain (small stars), and links.

    Spoiler-safe like the rest: for stories, only ideas from pages already read.
    """
    limits = _limits(db)
    books = db.scalars(select(Book).options(selectinload(Book.position), selectinload(Book.genre)).where(Book.status == "ready")).all()
    built = {r.book_id: r.status for r in db.scalars(select(BookGraph))}

    idea_books: dict[int, dict[str, int]] = {}
    for m in db.scalars(select(Mention).join(Concept).where(Concept.kind == "idea")):
        if _visible(m.book_id, m.char_start, limits):
            per = idea_books.setdefault(m.concept_id, {})
            per[m.book_id] = per.get(m.book_id, 0) + 1
    concepts = {c.id: c for c in db.scalars(select(Concept).where(Concept.id.in_(list(idea_books))))} if idea_books else {}

    links = []
    seen_pairs: set[tuple[int, int]] = set()
    for r in db.scalars(select(Relation)):
        if r.source_id in concepts and r.target_id in concepts and _visible(r.book_id, r.char_start, limits):
            pair = (min(r.source_id, r.target_id), max(r.source_id, r.target_id))
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                links.append({"source": r.source_id, "target": r.target_id, "label": r.label})

    return {
        "books": [{"id": b.id, "title": b.title, "author": b.author, "genre_id": b.genre_id,
                   "genre": b.genre.title if b.genre else "", "mood": b.genre.mood if b.genre else "#ffcf6a", "progress": b.position.progress if b.position else 0.0,
                   "graph": built.get(b.id, "none")} for b in books],
        "ideas": [{"id": cid, "name": concepts[cid].name, "description": concepts[cid].description,
                   "books": [{"book_id": bid, "count": n} for bid, n in per.items()], "count": sum(per.values())}
                  for cid, per in idea_books.items() if cid in concepts],
        "links": links,
    }
