"""MCP server: lets Claude Desktop, Claude Code or Cursor use your library.

It talks to the running library API (so the API must be running) and offers a few tools: list your books, search
one book or the whole library, find your highlights, and see what you're reading. Searches are spoiler-safe: only
text up to where you've read, unless the AI is asked to include spoilers.

Run by an AI app (see README "Use your library from Claude"):
    apps/api/.venv/Scripts/python apps/api/mcp_server.py
"""

import os

import httpx
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

API = os.environ.get("WALKABLE_API_URL", "http://localhost:8010").rstrip("/")

server = MCPServer(
    name="bunko",
    title="Bunko",
    instructions=(
        "The user's personal library of books they own and read. Use these tools to answer questions from their own "
        "books, highlights and notes. Searches only return text up to where the user has read (no spoilers); set "
        "include_spoilers only if the user explicitly asks. Always mention the book and chapter or page you quote."
    ),
)


def _get(path: str, **params) -> object:
    try:
        r = httpx.get(f"{API}{path}", params={k: v for k, v in params.items() if v is not None}, timeout=60)
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError as exc:
        raise ToolError(f"The library app isn't running (nothing at {API}). Start its API first.") from exc


def _post(path: str, body: dict) -> object:
    try:
        r = httpx.post(f"{API}{path}", json=body, timeout=120)
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError as exc:
        raise ToolError(f"The library app isn't running (nothing at {API}). Start its API first.") from exc


def _library() -> dict:
    return _get("/api/library")  # type: ignore[return-value]


def _find_book(name: str) -> dict:
    """A book by (part of) its title or author."""
    books = [b for b in _library()["books"] if b["status"] == "ready"]
    q = name.strip().lower()
    exact = [b for b in books if b["title"].lower() == q]
    partial = exact or [b for b in books if q in b["title"].lower()] or [b for b in books if q in b["author"].lower()]
    if not partial:
        titles = "; ".join(b["title"] for b in books)
        raise ToolError(f"No book matching '{name}'. The library has: {titles}")
    return min(partial, key=lambda b: len(b["title"]))


def _passages(passages: list[dict]) -> str:
    if not passages:
        return "Nothing relevant found in what the user has read so far."
    out = []
    for p in passages:
        where = p["book_title"] + (f" — {p['chapter_title']}" if p["chapter_title"] else "") + f", p. {p['page']}"
        out.append(f"[{p['n']}] {where}\n{p['text'].strip()}")
    return "\n\n".join(out)


def _pct(x: float | None) -> str:
    return f"{round((x or 0) * 100)}%"


@server.tool(title="List my books")
def list_books() -> str:
    """List every book in the library: title, author, room (genre), how far the user has read, and highlight count."""
    lib = _library()
    rooms = {g["id"]: g["title"] for g in lib["genres"]}
    lines = []
    for b in lib["books"]:
        progress = _pct(b["position"]["progress"]) if b.get("position") else "not started"
        status = "" if b["status"] == "ready" else f" ({b['status']})"
        lines.append(f"- {b['title']} by {b['author']} · {rooms.get(b['genre_id'], b['genre_id'])} · {progress}"
                     f" · {b.get('highlight_count', 0)} highlights{status}")
    return f"{len(lib['books'])} books:\n" + "\n".join(lines)


@server.tool(title="What am I reading?")
def reading_status() -> str:
    """The books the user is reading now (most recent first), with how far they are."""
    books = [b for b in _library()["books"] if b.get("position")]
    if not books:
        return "The user hasn't started any book yet."
    books.sort(key=lambda b: b["position"]["updated_at"], reverse=True)
    lines = []
    for b in books:
        state = "finished" if b["position"]["progress"] >= 0.995 else f"{_pct(b['position']['progress'])} read"
        lines.append(f"- {b['title']} by {b['author']}: {state} (last opened {b['position']['updated_at'][:10]})")
    return "\n".join(lines)


@server.tool(title="Search one book")
def search_book(book: str, query: str, include_spoilers: bool = False) -> str:
    """Find passages in one book (by title, or part of it) that answer a question. Spoiler-safe: only up to where
    the user has read, unless include_spoilers is true (only if the user asks for it). Cite the [n] passages."""
    b = _find_book(book)
    r = _post("/api/retrieve", {"question": query, "book_id": b["id"], "spoilers": include_spoilers})
    reached = r["reached"].get(b["id"], 0)  # type: ignore[index]
    head = f"{b['title']} by {b['author']}" + ("" if include_spoilers else f" (searched up to {_pct(reached)}, where the user is)")
    return head + "\n\n" + _passages(r["passages"])  # type: ignore[index]


@server.tool(title="Search my library")
def search_library(query: str, room: str | None = None) -> str:
    """Find passages across all books (or one room/genre, e.g. "Self-help") about a topic. Stories are only
    searched up to where the user has read; non-fiction is searched in full. Cite the [n] passages."""
    genre_id = None
    if room:
        rooms = {g["title"].lower(): g["id"] for g in _library()["genres"]}
        genre_id = rooms.get(room.strip().lower()) or next((gid for t, gid in rooms.items() if room.lower() in t), None)
        if genre_id is None:
            return f"No room called '{room}'. Rooms: {', '.join(t.title() for t in rooms)}"
    r = _post("/api/retrieve", {"question": query, "genre_id": genre_id})
    return _passages(r["passages"])  # type: ignore[index]


@server.tool(title="Find my highlights")
def my_highlights(query: str | None = None, book: str | None = None) -> str:
    """The user's own highlights and notes. With a query, finds them by meaning ("what did I find important about
    leadership?"); without one, lists the most recent. Optionally limit to one book."""
    book_id = _find_book(book)["id"] if book else None
    rows = _get("/api/highlights", q=query, book_id=book_id, limit=20)
    if not rows:
        return "No highlights found." if query else "The user hasn't highlighted anything yet."
    out = []
    for h in rows:  # type: ignore[union-attr]
        where = h["book_title"] + (f" — {h['chapter_title']}" if h["chapter_title"] else "")
        note = f"\n  Note: {h['note']}" if h["note"] else ""
        out.append(f"- \"{h['text'].strip()}\" ({where}){note}")
    return "\n".join(out)


if __name__ == "__main__":
    server.run("stdio")
