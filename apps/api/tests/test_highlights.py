"""Phase 4: highlights and notes, meaning-based highlight search, and FSRS review."""

from datetime import UTC, datetime, timedelta

from app.db import SessionLocal
from app.models import Highlight
from app.review import cloze

from .test_api import upload


def make_book(client, files):
    book_id = upload(client, files["epub"], genre_id="fiction").json()["id"]
    toc = client.get(f"/api/books/{book_id}/toc").json()
    return book_id, {t["title"]: t["location"] for t in toc}


def highlight(client, book_id, href, text, note=""):
    r = client.post(f"/api/books/{book_id}/highlights",
                    json={"location": f"epubcfi(/6/4!/4/2,/1:0,/1:{len(text)})", "chapter_href": href, "text": text, "note": note})
    assert r.status_code == 201, r.text
    return r.json()


def test_highlight_is_located_noted_and_listed(client, files):
    book_id, hrefs = make_book(client, files)
    h = highlight(client, book_id, hrefs["Chapter I. The Harbour"], "The lighthouse keeper counted the masts and wrote them down.")
    assert h["char_start"] is not None and h["chapter_title"] == "Chapter I. The Harbour"
    # New highlights come up for review tomorrow, not straight away.
    assert datetime.fromisoformat(h["due"]) > datetime.now(UTC) + timedelta(hours=20)

    patched = client.patch(f"/api/highlights/{h['id']}", json={"note": "Counting as a way to stay calm", "color": "sage"}).json()
    assert patched["note"] == "Counting as a way to stay calm" and patched["color"] == "sage"

    listed = client.get(f"/api/books/{book_id}/highlights").json()
    assert [x["id"] for x in listed] == [h["id"]]
    book = client.get(f"/api/books/{book_id}").json()
    assert book["highlight_count"] == 1 and book["highlights"][0].startswith("The lighthouse keeper")

    assert client.delete(f"/api/highlights/{h['id']}").status_code == 204
    assert client.get(f"/api/books/{book_id}/highlights").json() == []


def test_search_finds_highlights_by_meaning(client, files):
    book_id, hrefs = make_book(client, files)
    highlight(client, book_id, hrefs["Chapter I. The Harbour"], "The lighthouse keeper counted the masts and wrote them down.")
    highlight(client, book_id, hrefs["Chapter II. The Whale"], "He laughed, and the tavern fell silent.", note="Laughter that frightens people")
    hits = client.get("/api/highlights", params={"q": "who keeps watch over the ships coming into port?"}).json()
    assert hits and hits[0]["text"].startswith("The lighthouse keeper")
    by_note = client.get("/api/highlights", params={"q": "laughter"}).json()
    assert by_note[0]["note"] == "Laughter that frightens people"
    assert client.get("/api/highlights", params={"q": "a recipe for sourdough bread"}).json() == []


def test_review_queue_and_scheduling(client, files):
    book_id, hrefs = make_book(client, files)
    h = highlight(client, book_id, hrefs["Chapter I. The Harbour"], "The lighthouse keeper counted the masts and wrote them down.")
    assert client.get("/api/review/queue").json() == []
    assert client.get("/api/review/stats").json()["due"] == 0

    with SessionLocal() as s:  # pretend a day has passed
        s.get(Highlight, h["id"]).due = datetime.now(UTC) - timedelta(minutes=1)
        s.commit()
    queue = client.get("/api/review/queue").json()
    assert len(queue) == 1
    card = queue[0]
    assert "_____" in card["prompt"] and card["answer"] and card["answer"] in h["text"]
    assert set(card["intervals"]) == {"1", "2", "3", "4"}

    after = client.post(f"/api/review/{h['id']}", json={"rating": 3}).json()
    assert after["reviews"] == 1 and datetime.fromisoformat(after["due"]) > datetime.now(UTC)
    assert client.get("/api/review/queue").json() == []
    assert client.post(f"/api/review/{h['id']}", json={"rating": 9}).status_code == 422


def test_cloze_blanks_a_telling_word():
    prompt, answer = cloze("Of my grandfather Verus I have learned to be gentle and meek, and to refrain from all anger.")
    assert answer == "Verus" and "_____" in prompt and "Verus" not in prompt
    assert cloze("Too short.") == ("Too short.", None)
