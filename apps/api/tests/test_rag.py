"""Hybrid retrieval, spoiler-safe windows, cited answers over SSE, and the leak check."""

import json

from app.db import SessionLocal
from app.rag.spoilers import leaked_names

from .test_api import upload


def ask(client, url, **body):
    events = []
    with client.stream("POST", url, json=body) as r:
        assert r.status_code == 200, r.read()
        event = None
        for line in r.iter_lines():
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                events.append((event, json.loads(line[5:])))
    return events


def first(events, name):
    return next(data for ev, data in events if ev == name)


def chapter_href(client, book_id, title):
    return next(t["location"] for t in client.get(f"/api/books/{book_id}/toc").json() if t["title"] == title)


def test_book_is_indexed_and_answers_cite_passages(client, files):
    book_id = upload(client, files["epub"], genre_id="fiction").json()["id"]
    status = client.get("/api/rag/status").json()
    assert status["provider"] == "none" and status["indexed"] >= 1

    events = ask(client, f"/api/books/{book_id}/ask", question="Who counted the masts?", spoilers=True)
    cites = first(events, "citations")
    assert cites and any("lighthouse keeper" in c["text"] for c in cites[:2])
    answer = "".join(d["text"] for ev, d in events if ev == "delta")
    assert "[1]" in answer  # passages-only answers still cite
    assert first(events, "done")["cited"]


def test_retrieval_never_goes_past_the_reading_position(client, files):
    book_id = upload(client, files["epub"], genre_id="fiction").json()["id"]
    href = chapter_href(client, book_id, "Chapter I. The Harbour")
    spot = {"chapter_href": href, "chapter_fraction": 1.0}

    safe = first(ask(client, f"/api/books/{book_id}/ask", question="the white whale and the old sailor", position=spot), "citations")
    assert safe and all(c["location"] == href for c in safe)

    # The saved position is used when the reader doesn't send one.
    client.put(f"/api/books/{book_id}/position", json={"location": "x", "progress": 0.1, **spot})
    saved = first(ask(client, f"/api/books/{book_id}/ask", question="the white whale and the old sailor"), "citations")
    assert all(c["location"] == href for c in saved)

    # Allowing spoilers opens the whole book.
    full = first(ask(client, f"/api/books/{book_id}/ask", question="the white whale and the old sailor", spoilers=True), "citations")
    assert any("white whale" in c["text"] for c in full)


def test_library_question_spans_books(client, files):
    upload(client, files["epub"], genre_id="fiction")
    upload(client, files["pdf"], genre_id="selfhelp")
    events = ask(client, "/api/ask", question="Proxima Centauri, the nearest star", spoilers=True)
    assert any("Proxima" in c["text"] for c in first(events, "citations"))


def test_leak_check_flags_names_from_later_chapters(client, files):
    book_id = upload(client, files["epub"], genre_id="fiction").json()["id"]
    with SessionLocal() as s:
        from sqlalchemy import select

        from app.models import Chunk

        whale_at = s.scalar(select(Chunk.char_start).where(Chunk.book_id == book_id, Chunk.text.like("%white whale%")))
        # "Nobody" opens chapter II; the reader stopped before it.
        assert leaked_names(s, "Nobody saw the masts.", {book_id: whale_at}) == ["Nobody"]
        assert leaked_names(s, "Nobody saw the masts.", {book_id: whale_at + 10_000}) == []
