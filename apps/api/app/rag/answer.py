"""Retrieve → rerank → prompt. The route streams the answer; this module decides what the model may see."""

from dataclasses import asdict, dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..genres import is_narrative
from ..models import Book, Chunk
from . import encoders
from .spoilers import Spot, reading_limit
from .store import Window, hybrid_search

PER_BOOK_ACROSS_LIBRARY = 3


@dataclass
class Passage:
    n: int
    chunk_id: int
    book_id: str
    book_title: str
    author: str
    chapter_title: str
    location: str
    page: int
    char_start: int
    text: str
    score: float


@dataclass
class Retrieval:
    passages: list[Passage]
    # Reading limit per searched book (character offset); absent when spoilers are allowed.
    limits: dict[str, int]
    # Share of each searched book the reader has reached, for the "up to 34%" label.
    reached: dict[str, float]


def retrieve(session: Session, question: str, *, book_id: str | None = None, genre_id: str | None = None,
             spot: Spot | None = None, spoilers: bool = False, k: int = 8) -> Retrieval:
    q = select(Book).options(selectinload(Book.position), selectinload(Book.genre)).where(Book.status == "ready")
    if book_id:
        q = q.where(Book.id == book_id)
    elif genre_id:
        q = q.where(Book.genre_id == genre_id)
    books = {b.id: b for b in session.scalars(q)}

    limits: dict[str, int] = {}
    reached: dict[str, float] = {}
    windows: list[Window] = []
    for b in books.values():
        limit = reading_limit(session, b, spot if book_id else None)
        reached[b.id] = min(1.0, limit / max(b.total_chars, 1))
        # Across the library, only stories are held to your reading position; you can't spoil Marcus Aurelius.
        guarded = not spoilers and (book_id is not None or is_narrative(b.genre_id, b.genre.title if b.genre else ""))
        if guarded:
            limits[b.id] = limit
        windows.append(Window(b.id, limit if guarded else None))
    windows = [w for w in windows if w.limit is None or w.limit > 0]

    hits = hybrid_search(question, windows, limit=settings.rerank_candidates if settings.rerank_model else k * 2)
    if not hits:
        return Retrieval([], limits, reached)
    chunks = {c.id: c for c in session.scalars(select(Chunk).where(Chunk.id.in_([h.chunk_id for h in hits])))}
    ranked = [(chunks[h.chunk_id], h.score) for h in hits if h.chunk_id in chunks]

    rr = encoders.reranker()
    if rr is not None and ranked:
        scores = list(rr.rerank(question, [c.text for c, _ in ranked]))
        ranked = sorted(((c, float(s)) for (c, _), s in zip(ranked, scores, strict=True)), key=lambda t: t[1], reverse=True)

    picked: list[tuple[Chunk, float]] = []
    per_book: dict[str, int] = {}
    for c, s in ranked:
        # Across the library, keep one book from filling every slot.
        if not book_id and per_book.get(c.book_id, 0) >= PER_BOOK_ACROSS_LIBRARY:
            continue
        per_book[c.book_id] = per_book.get(c.book_id, 0) + 1
        picked.append((c, s))
        if len(picked) == k:
            break
    # Within one book, present passages in reading order; it reads more naturally to the model.
    if book_id:
        picked.sort(key=lambda t: t[0].char_start)

    passages = [
        Passage(n=i + 1, chunk_id=c.id, book_id=c.book_id, book_title=books[c.book_id].title, author=books[c.book_id].author,
                chapter_title=c.chapter_title, location=c.location, page=c.page, char_start=c.char_start, text=c.text, score=s)
        for i, (c, s) in enumerate(picked)
    ]
    return Retrieval(passages, limits, reached)


def passage_json(p: Passage) -> dict:
    return asdict(p)


SYSTEM = """You are the librarian of a personal reading library. You answer questions about the reader's books.

Rules:
- Use ONLY the numbered passages below. Do not use outside knowledge of these books, even if you know them well.
- Cite every claim with the passage number in square brackets, like [2] or [1][4]. Never cite a number that isn't listed.
- If the passages don't contain the answer, say so plainly and suggest what to look for instead. Don't guess.
{spoiler_rule}- Be warm and concise: usually 2–5 sentences, or a short list when comparing books. Quote short phrases when they help.
- Answer in the language of the question."""

SPOILER_RULE = (
    "- The reader has only read part of the book(s). The passages are everything they've read that is relevant. "
    "Never reveal, hint at or speculate about anything that happens later: no future events, deaths, twists, "
    "endings or characters not in the passages.\n"
)


def build_prompt(question: str, retrieval: Retrieval, history: list[dict], spoilers: bool) -> tuple[str, list[dict]]:
    system = SYSTEM.format(spoiler_rule="" if spoilers else SPOILER_RULE)
    blocks = []
    for p in retrieval.passages:
        where = f"{p.book_title}" + (f" — {p.chapter_title}" if p.chapter_title else "") + f", p. {p.page}"
        blocks.append(f"[{p.n}] ({where})\n{p.text}")
    context = "\n\n".join(blocks) if blocks else "(no passages found)"
    turns = [{"role": m["role"], "content": m["content"][:2000]} for m in history[-6:] if m.get("role") in ("user", "assistant")]
    turns.append({"role": "user", "content": f"Passages:\n\n{context}\n\nQuestion: {question}"})
    return system, turns


def passages_only_answer(retrieval: Retrieval) -> str:
    """What the reader gets when no LLM is configured: the best passages, cited, so the feature still works."""
    if not retrieval.passages:
        return "I couldn't find anything about that in what you've read so far."
    lines = ["No AI model is connected yet, so here are the passages that best match your question:", ""]
    for p in retrieval.passages[:4]:
        snippet = " ".join(p.text.split())
        snippet = snippet[:280] + ("…" if len(snippet) > 280 else "")
        lines.append(f"- “{snippet}” [{p.n}]")
    lines += ["", "Add a free Gemini key in apps/api/.env to get written answers."]
    return "\n".join(lines)
