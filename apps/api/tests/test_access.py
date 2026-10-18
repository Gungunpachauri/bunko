"""Public-demo mode: visitors read and ask (within a daily limit); only the admin key changes the library."""

import pytest

from app import access
from app.config import settings

from .test_api import upload


@pytest.fixture()
def demo(monkeypatch):
    monkeypatch.setattr(settings, "admin_key", "secret")
    monkeypatch.setattr(settings, "ask_limit_per_visitor", 2)
    monkeypatch.setattr(settings, "ask_limit_total", 0)
    monkeypatch.setattr(access, "_day", "")  # a fresh day of counts


ADMIN = {"X-Admin-Key": "secret"}


def test_everything_is_open_without_an_admin_key(client):
    assert client.get("/api/access").json() == {"visitor": False, "demo": False, "asks_left": None, "ask_limit": None}


def test_visitors_can_read_but_not_change(client, files, demo):
    assert client.get("/api/library").status_code == 200
    assert client.get("/api/access").json()["visitor"] is True

    refused = upload(client, files["epub"], genre_id="fiction")
    assert refused.status_code == 403 and "public demo" in refused.json()["detail"]
    assert client.post("/api/genres", json={"title": "Poetry"}).status_code == 403
    assert client.delete("/api/genres/fiction").status_code == 403

    # The owner, with the key, can do everything.
    with open(files["epub"], "rb") as fh:
        r = client.post("/api/books", files={"file": ("h.epub", fh)}, data={"genre_id": "fiction"}, headers=ADMIN)
    assert r.status_code == 201
    book_id = r.json()["id"]
    assert client.put(f"/api/books/{book_id}/position", json={"location": "x", "progress": 0.1}).status_code == 403
    assert client.delete(f"/api/books/{book_id}").status_code == 403
    assert client.delete(f"/api/books/{book_id}", headers=ADMIN).status_code == 204


def test_visitors_get_a_daily_number_of_questions(client, demo):
    assert client.get("/api/access").json()["asks_left"] == 2
    for _ in range(2):
        assert client.post("/api/ask", json={"question": "what is courage?"}).status_code == 200
    assert client.get("/api/access").json()["asks_left"] == 0
    over = client.post("/api/ask", json={"question": "one more?"})
    assert over.status_code == 429 and "free questions" in over.json()["detail"]
    # Searching without an AI answer is free, and the owner is never limited.
    assert client.post("/api/retrieve", json={"question": "courage"}).status_code == 200
    assert client.post("/api/ask", json={"question": "mine?"}, headers=ADMIN).status_code == 200
