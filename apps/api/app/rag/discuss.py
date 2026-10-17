"""The discussion partner: talks with the reader about what they just read, like a friend in a book club.

A small LangGraph pipeline prepares each turn, then one LLM call writes it (one call per message keeps free tiers
usable):

    START → where_am_i → (reader said something?) → find_evidence → compose → END
                                     └──────────── no: opening ───────────────┘

- where_am_i     the reading limit and the last pages before it ("what you just read")
- find_evidence  passages that bear on what the reader said, and their own highlights in this book
- compose        the prompt: open with one question, or answer, push back with quotes, and ask a follow-up
"""

from dataclasses import asdict
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Book, Chunk, Highlight
from .answer import Passage, retrieve
from .spoilers import Spot, reading_limit

RECENT_PASSAGES = 6


class DiscussState(TypedDict, total=False):
    session: Session
    book: Book
    message: str | None  # None → the partner opens the conversation
    history: list[dict]
    spot: Spot | None
    limit: int
    recent: list[Passage]
    related: list[Passage]
    highlights: list[Highlight]
    passages: list[Passage]
    system: str
    messages: list[dict]


def _passage(c: Chunk, book: Book, n: int = 0) -> Passage:
    return Passage(n=n, chunk_id=c.id, book_id=book.id, book_title=book.title, author=book.author,
                   chapter_title=c.chapter_title, location=c.location, page=c.page, char_start=c.char_start,
                   text=c.text, score=0.0)


def where_am_i(s: DiscussState) -> DiscussState:
    db, book = s["session"], s["book"]
    limit = reading_limit(db, book, s.get("spot"))
    recent = db.scalars(select(Chunk).where(Chunk.book_id == book.id, Chunk.char_start < limit)
                        .order_by(Chunk.char_start.desc()).limit(RECENT_PASSAGES)).all()
    return {"limit": limit, "recent": [_passage(c, book) for c in reversed(recent)]}


def find_evidence(s: DiscussState) -> DiscussState:
    """Passages (up to the reader's page) that support or challenge what the reader just said."""
    r = retrieve(s["session"], s["message"] or "", book_id=s["book"].id, spot=s.get("spot"), k=4)
    return {"related": r.passages}


def gather_highlights(s: DiscussState) -> DiscussState:
    db, book, limit = s["session"], s["book"], s["limit"]
    rows = db.scalars(select(Highlight).options(selectinload(Highlight.book)).where(Highlight.book_id == book.id)
                      .order_by(Highlight.created_at.desc()).limit(12)).all()
    # Only highlights from pages already read (a re-read could have marked later ones).
    seen = [h for h in rows if h.char_start is None or h.char_start < limit][:4]
    return {"highlights": seen}


SYSTEM = """You are a warm, sharp reading partner, like a good friend in a book club. You're discussing "{title}" by {author} with someone who has read up to a certain point.

How to talk:
- Base everything on the numbered passages (the reader's recent pages and related passages). Quote short phrases and cite them like [2].
- Never reveal or hint at anything after the reader's position, even if you know the book. No future events, twists or endings.
- Keep it short: 2–5 sentences, then ONE open question. No lists, no headings.
- Be a real partner, not a teacher: have opinions, notice details, and gently push back when the text supports a different view ("I'm not sure. Look at [3], where she says…").
- If they mention something you can't find in the passages, say so honestly.
{highlights}"""

OPENING = ("Start the conversation about what the reader just read (the recent pages). Pick one interesting moment, "
           "character choice, idea or line from those passages, point to it with a citation, and ask one thoughtful "
           "open question about it. Don't summarise the whole chapter.")


def compose(s: DiscussState) -> DiscussState:
    book = s["book"]
    passages: list[Passage] = []
    seen: set[int] = set()
    for p in [*s.get("recent", []), *s.get("related", [])]:
        if p.chunk_id not in seen:
            seen.add(p.chunk_id)
            passages.append(Passage(**{**asdict(p), "n": len(passages) + 1}))

    hl = s.get("highlights", [])
    highlights = ""
    if hl:
        lines = "\n".join(f'- "{h.text.strip()[:300]}"' + (f" (their note: {h.note.strip()[:200]})" if h.note else "") for h in hl)
        highlights = ("\nThe reader highlighted these lines; refer to them when it fits (\"you marked…\"):\n" + lines)

    system = SYSTEM.format(title=book.title, author=book.author, highlights=highlights)
    context = "\n\n".join(f"[{p.n}] ({p.chapter_title or 'passage'}, p. {p.page})\n{p.text}" for p in passages)
    turns = [{"role": m["role"], "content": m["content"][:2000]} for m in s.get("history", [])[-8:]
             if m.get("role") in ("user", "assistant") and m.get("content")]
    ask = OPENING if not s.get("message") else f"The reader says: {s['message']}"
    turns.append({"role": "user", "content": f"Passages:\n\n{context}\n\n{ask}"})
    # Chat APIs expect the first turn to be the user's; when the partner opened, that opening comes first in history.
    if turns[0]["role"] == "assistant":
        turns.insert(0, {"role": "user", "content": "Let's talk about what I just read."})
    return {"passages": passages, "system": system, "messages": turns}


def _route(s: DiscussState) -> str:
    return "find_evidence" if s.get("message") else "gather_highlights"


def _build():
    g = StateGraph(DiscussState)
    g.add_node("where_am_i", where_am_i)
    g.add_node("find_evidence", find_evidence)
    g.add_node("gather_highlights", gather_highlights)
    g.add_node("compose", compose)
    g.add_edge(START, "where_am_i")
    g.add_conditional_edges("where_am_i", _route, ["find_evidence", "gather_highlights"])
    g.add_edge("find_evidence", "gather_highlights")
    g.add_edge("gather_highlights", "compose")
    g.add_edge("compose", END)
    return g.compile()


graph = _build()


def prepare(session: Session, book_id: str, message: str | None, history: list[dict], spot: Spot | None) -> DiscussState:
    book = session.scalars(select(Book).options(selectinload(Book.position)).where(Book.id == book_id)).one()
    return graph.invoke({"session": session, "book": book, "message": (message or "").strip() or None,
                         "history": history, "spot": spot})
