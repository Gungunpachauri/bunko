"""Knowledge graph: the ideas, people and places in each book, and the ideas that books share.

Building one book (about 4–16 AI calls, run in the background):
  1. split the book into sections and take a few passages from each
  2. ask the AI for the main ideas, people and places in those passages, and how they relate
  3. store each one with the passage it came from. The AI is shown the ideas already in the library and reuses a
     name when it's the same idea ("self-mastery" → "self-control"); equal names are the same idea. That shared
     idea is what links books together.
"""

import logging
import re
import threading
import time

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .db import SessionLocal
from .genres import is_narrative
from .models import Book, BookGraph, Chunk, Concept, Genre, Mention, Relation

log = logging.getLogger(__name__)

PASSAGES_PER_SECTION = 4
PASSAGE_CHARS = 1400
SECTION_PAUSE_S = 1.5  # be gentle with free-tier rate limits
KNOWN_IDEAS_SHOWN = 150  # existing idea names offered to the AI for reuse
MAX_CONCEPTS = 8

SYSTEM = """You build a reader's knowledge graph from book passages. Reply with JSON only.

Return:
{{"concepts": [{{"name": str, "kind": "idea"|"person"|"place", "description": str, "passage": int, "note": str}}],
  "relations": [{{"source": str, "target": str, "label": str, "passage": int}}]}}

Rules:
- At most {max} concepts: only the ones that matter in these passages.
- {focus}
- "idea" names are short, general and reusable across books, lowercase, 1–3 words: "self-control", "fear of death", "social class", "ambition". Not plot events.
- If an idea matches one in "Ideas already in the library", use that exact name.
- "person"/"place" names as written in the book ("Elizabeth Bennet", "Netherfield").
- description: what the concept is, in one plain sentence (no spoilers beyond these passages).
- passage: the number of the passage it appears in. note: what that passage says about it, max 20 words.
- relations: up to 6 links between your concepts, label as a short verb phrase ("dislikes", "leads to", "teaches").
- Use only what the passages say."""

FOCUS_STORY = "This is a story: include the main characters and places, and the themes the passages explore."
FOCUS_IDEAS = "This is non-fiction: focus on its ideas and teachings; include people only if they are named thinkers or figures."


# --- names ----------------------------------------------------------------------------------------------

def normalise(name: str) -> str:
    n = re.sub(r"[^a-z0-9 ]+", " ", name.lower().replace("-", " ")).strip()
    n = re.sub(r"\s+", " ", n)
    words = n.split(" ")
    # Singular last word ("emotions" → "emotion"), leaving words like "loss" alone.
    if words and len(words[-1]) > 4 and words[-1].endswith("s") and not words[-1].endswith("ss"):
        words[-1] = words[-1][:-1]
    return " ".join(words)


def concept_key(name: str, kind: str, book_id: str) -> str:
    n = normalise(name)
    return n if kind == "idea" else f"{book_id}:{kind}:{n}"


# --- sections -------------------------------------------------------------------------------------------

def sections(chunks: list[Chunk]) -> list[list[Chunk]]:
    """Even slices of the book, a few passages from each (spread out, so a section isn't one scene)."""
    if not chunks:
        return []
    n = max(1, min(16, max(4, len(chunks) // 40), len(chunks)))
    size = len(chunks) / n
    out = []
    for i in range(n):
        part = chunks[int(i * size):int((i + 1) * size)] or chunks[-1:]
        step = max(1, len(part) // PASSAGES_PER_SECTION)
        out.append(part[::step][:PASSAGES_PER_SECTION])
    return out


# --- building -------------------------------------------------------------------------------------------

def _find_or_create(db: Session, name: str, kind: str, description: str, book_id: str) -> Concept:
    key = concept_key(name, kind, book_id)
    found = db.scalar(select(Concept).where(Concept.key == key))
    if found:
        return found
    c = Concept(key=key, name=name.strip()[:200], kind=kind, description=description.strip()[:600])
    db.add(c)
    db.flush()
    return c


def known_ideas(db: Session, limit: int = KNOWN_IDEAS_SHOWN) -> list[str]:
    """The library's most-mentioned idea names, so new books reuse them and connect."""
    rows = db.execute(select(Concept.name).join(Mention).where(Concept.kind == "idea")
                      .group_by(Concept.id).order_by(func.count(Mention.id).desc()).limit(limit)).all()
    return [r[0] for r in rows]


def build_book(book_id: str, llm=None) -> None:
    """Rebuild one book's part of the graph. `llm(system, user) -> dict` is injectable for tests."""
    from .rag.llm import complete_json

    ask = llm or (lambda system, user: complete_json(system, user, backup_first=True))
    with SessionLocal() as db:
        book = db.get(Book, book_id)
        if book is None or book.status != "ready":
            return
        genre = db.get(Genre, book.genre_id)
        story = is_narrative(book.genre_id, genre.title if genre else "")
        chunks = db.scalars(select(Chunk).where(Chunk.book_id == book_id).order_by(Chunk.ordinal)).all()
        parts = sections(list(chunks))
        state = db.get(BookGraph, book_id) or BookGraph(book_id=book_id)
        state.status, state.done, state.total, state.error = "building", 0, len(parts), None
        db.merge(state)
        db.execute(delete(Mention).where(Mention.book_id == book_id))
        db.execute(delete(Relation).where(Relation.book_id == book_id))
        db.commit()

        system = SYSTEM.format(max=MAX_CONCEPTS, focus=FOCUS_STORY if story else FOCUS_IDEAS)
        try:
            for i, part in enumerate(parts):
                text = "\n\n".join(f"[{n + 1}] ({c.chapter_title or 'passage'})\n{c.text[:PASSAGE_CHARS]}" for n, c in enumerate(part))
                known = known_ideas(db)
                hint = f"Ideas already in the library: {', '.join(known)}\n\n" if known else ""
                result = ask(system, f"Book: {book.title} by {book.author}\n\n{hint}Passages:\n\n{text}")
                _store(db, book_id, part, result)
                st = db.get(BookGraph, book_id)
                st.done = i + 1
                db.commit()
                if llm is None and i < len(parts) - 1:
                    time.sleep(SECTION_PAUSE_S)
            st = db.get(BookGraph, book_id)
            st.status = "ready"
            db.commit()
        except Exception as exc:  # noqa: BLE001  (keep what was built; the book can be retried)
            db.rollback()
            log.exception("graph build failed for %s", book_id)
            st = db.get(BookGraph, book_id)
            st.status, st.error = "failed", str(exc)[:500]
            db.commit()
        finally:
            drop_orphans(db)


def _store(db: Session, book_id: str, part: list[Chunk], result: dict) -> None:
    by_name: dict[str, Concept] = {}
    for item in (result.get("concepts") or [])[:MAX_CONCEPTS]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        kind = str(item.get("kind") or "idea").lower()
        if not name or kind not in ("idea", "person", "place") or len(name) > 80:
            continue
        idx = item.get("passage")
        chunk = part[idx - 1] if isinstance(idx, int) and 1 <= idx <= len(part) else part[0]
        concept = _find_or_create(db, name, kind, str(item.get("description") or ""), book_id)
        db.add(Mention(concept_id=concept.id, book_id=book_id, chunk_id=chunk.id, char_start=chunk.char_start,
                       note=str(item.get("note") or "")[:300]))
        by_name[normalise(name)] = concept
    for rel in (result.get("relations") or [])[:6]:
        if not isinstance(rel, dict):
            continue
        a, b = by_name.get(normalise(str(rel.get("source") or ""))), by_name.get(normalise(str(rel.get("target") or "")))
        label = str(rel.get("label") or "").strip()[:120]
        if a and b and a.id != b.id and label:
            idx = rel.get("passage")
            chunk = part[idx - 1] if isinstance(idx, int) and 1 <= idx <= len(part) else part[0]
            db.add(Relation(book_id=book_id, source_id=a.id, target_id=b.id, label=label, char_start=chunk.char_start))


def drop_orphans(db: Session) -> None:
    """Concepts no book mentions any more (after a rebuild or a deleted book)."""
    used = select(Mention.concept_id).distinct()
    db.execute(delete(Concept).where(Concept.id.not_in(used)))
    db.commit()


# --- background queue -----------------------------------------------------------------------------------

_queue: list[str] = []
_lock = threading.Lock()
_worker: threading.Thread | None = None


def queue_book(book_id: str) -> None:
    with SessionLocal() as db:
        state = db.get(BookGraph, book_id) or BookGraph(book_id=book_id)
        if state.status == "building":
            return
        state.status, state.error = "queued", None
        db.merge(state)
        db.commit()
    with _lock:
        if book_id not in _queue:
            _queue.append(book_id)
        _start()


def resume() -> None:
    """After a restart: carry on with books that were queued or half built."""
    with SessionLocal() as db:
        ids = db.scalars(select(BookGraph.book_id).where(BookGraph.status.in_(("queued", "building")))).all()
    with _lock:
        for bid in ids:
            if bid not in _queue:
                _queue.append(bid)
        if _queue:
            _start()


def _start() -> None:
    global _worker
    if _worker is None or not _worker.is_alive():
        _worker = threading.Thread(target=_run, daemon=True, name="graph-builder")
        _worker.start()


def _run() -> None:
    while True:
        with _lock:
            if not _queue:
                return
            book_id = _queue.pop(0)
        build_book(book_id)


def status(db: Session, book_id: str) -> dict:
    s = db.get(BookGraph, book_id)
    concepts = db.scalar(select(func.count(func.distinct(Mention.concept_id))).where(Mention.book_id == book_id)) or 0
    if s is None:
        return {"status": "none", "done": 0, "total": 0, "error": None, "concepts": concepts}
    return {"status": s.status, "done": s.done, "total": s.total, "error": s.error, "concepts": concepts}
