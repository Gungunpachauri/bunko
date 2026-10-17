"""The discussion partner (LangGraph pipeline + one streamed LLM call per turn) with a stand-in model."""

import json

import pytest

from .test_api import upload
from .test_rag import ask, first


@pytest.fixture()
def fake_llm(monkeypatch):
    """Record what the model would be sent, and answer with a cited question."""
    calls = []

    async def stream_chat(system, messages, max_tokens=900):
        calls.append({"system": system, "messages": messages})
        for piece in ["I noticed the keeper counting masts [1]. ", "Why do you think he writes them down?"]:
            yield piece

    monkeypatch.setattr("app.routes.ask.stream_chat", stream_chat)
    monkeypatch.setattr("app.config.Settings.llm", property(lambda self: "gemini"))
    return calls


def book_and_chapters(client, files):
    book_id = upload(client, files["epub"], genre_id="fiction").json()["id"]
    return book_id, {t["title"]: t["location"] for t in client.get(f"/api/books/{book_id}/toc").json()}


def test_partner_opens_about_recent_pages_only(client, files, fake_llm):
    book_id, ch = book_and_chapters(client, files)
    spot = {"chapter_href": ch["Chapter I. The Harbour"], "chapter_fraction": 1.0}
    events = ask(client, f"/api/books/{book_id}/discuss", message=None, position=spot)

    passages = first(events, "citations")
    assert passages and all(p["location"] == ch["Chapter I. The Harbour"] for p in passages)
    answer = "".join(d["text"] for e, d in events if e == "delta")
    assert answer.endswith("?") and first(events, "done")["cited"] == [1]

    sent = fake_llm[0]
    assert "The Grey Harbour" in sent["system"] and "Never reveal" in sent["system"]
    assert "Start the conversation" in sent["messages"][-1]["content"]
    assert "white whale" not in json.dumps(sent)  # chapter II is past the reader's page


def test_partner_replies_with_evidence_and_keeps_turn_order(client, files, fake_llm):
    book_id, ch = book_and_chapters(client, files)
    spot = {"chapter_href": ch["Chapter II. The Whale"], "chapter_fraction": 1.0}
    history = [{"role": "assistant", "content": "Why does the tavern go quiet?"}]
    ask(client, f"/api/books/{book_id}/discuss", message="I think the sailor was lying about the whale",
        history=history, position=spot)

    msgs = fake_llm[0]["messages"]
    assert msgs[0]["role"] == "user"  # chat APIs need the user first, even when the partner opened
    assert [m["role"] for m in msgs[1:]] == ["assistant", "user"]
    assert "The reader says: I think the sailor was lying" in msgs[-1]["content"]
    assert "white whale" in msgs[-1]["content"]  # evidence for the reader's point was found
    assert "harbour lights appeared" not in msgs[-1]["content"]  # chapter III is still ahead


def test_partner_needs_a_model(client, files):
    book_id, _ = book_and_chapters(client, files)
    events = ask(client, f"/api/books/{book_id}/discuss", message=None)
    assert "needs an AI model" in first(events, "error")["message"]
