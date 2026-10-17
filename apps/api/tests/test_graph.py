"""The knowledge graph (with a stand-in model): extraction, cross-book ideas, spoilers, comparisons."""

import pytest

from app import graph

from .test_api import upload


def fake_llm(system, user):
    """Ideas and people based on what each passage is about."""
    concepts, relations = [], []
    if "lighthouse keeper" in user:
        concepts += [{"name": "Patience", "kind": "idea", "description": "Waiting calmly.", "passage": 1, "note": "Counting the masts."},
                     {"name": "the lighthouse keeper", "kind": "person", "description": "Keeps the light.", "passage": 1, "note": "Writes down ships."}]
    if "white whale" in user:
        concepts += [{"name": "the old sailor", "kind": "person", "description": "Tells of a whale.", "passage": 1, "note": "Nobody believes him."}]
        relations += [{"source": "the old sailor", "target": "the old sailor", "label": "ignored"}]
    if "Proxima" in user:
        concepts += [{"name": "patience", "kind": "idea", "description": "Waiting.", "passage": 1, "note": "Light takes years to arrive."},
                     {"name": "astronomy", "kind": "idea", "description": "The study of stars.", "passage": 1, "note": "The nearest stars."}]
    return {"concepts": concepts, "relations": relations}


@pytest.fixture()
def library(client, files):
    story = upload(client, files["epub"], genre_id="fiction", title="Harbour Graph").json()["id"]
    essay = upload(client, files["pdf"], genre_id="selfhelp", title="Stars Graph").json()["id"]
    graph.build_book(story, llm=fake_llm)
    graph.build_book(essay, llm=fake_llm)
    toc = {t["title"]: t["location"] for t in client.get(f"/api/books/{story}/toc").json()}
    return story, essay, toc


def read_to(client, book_id, href):
    client.put(f"/api/books/{book_id}/position", json={"location": "x", "progress": 0.3, "chapter_href": href, "chapter_fraction": 1.0})


def test_shared_idea_links_two_books(client, library):
    story, essay, toc = library
    read_to(client, story, toc["Chapter III. Home"])  # read the whole story
    con = client.get(f"/api/books/{story}/connections").json()
    assert con["status"]["status"] == "ready"
    patience = next(i for i in con["ideas"] if i["name"].lower() == "patience")
    assert [b["title"] for b in patience["also_in"]] == ["Stars Graph"]  # "Patience" and "patience" are one idea
    assert {p["name"] for p in con["people"]} == {"the lighthouse keeper", "the old sailor"}

    shared = client.get("/api/graph/shared").json()
    assert any(s["name"].lower() == "patience" and len(s["books"]) == 2 for s in shared)


def test_people_from_later_chapters_stay_hidden(client, library):
    story, _, toc = library
    read_to(client, story, toc["Chapter I. The Harbour"])
    con = client.get(f"/api/books/{story}/connections").json()
    assert con["spoiler_safe"] is True
    assert {p["name"] for p in con["people"]} == {"the lighthouse keeper"}  # the old sailor is in chapter II
    sailor_id = next(c for c in client.get(f"/api/books/{story}/connections").json()["people"])["id"]
    detail = client.get(f"/api/concepts/{sailor_id}").json()
    assert detail["books"][0]["mentions"][0]["snippet"]


def test_compare_is_written_once_and_saved(client, library, monkeypatch):
    story, _, toc = library
    read_to(client, story, toc["Chapter I. The Harbour"])
    calls = []

    async def stream_chat(system, messages, max_tokens=900):
        calls.append(messages)
        yield "Both books value patience [1][2]."

    monkeypatch.setattr("app.routes.graph.stream_chat", stream_chat)
    pid = next(i for i in client.get(f"/api/books/{story}/connections").json()["ideas"] if i["name"].lower() == "patience")["id"]
    first = client.post(f"/api/concepts/{pid}/compare").json()
    assert first["text"].startswith("Both books") and not first["cached"]
    assert len({p["book_id"] for p in first["passages"]}) >= 2  # passages from at least two books
    again = client.post(f"/api/concepts/{pid}/compare").json()
    assert again["cached"] and len(calls) == 1

    keeper = next(p for p in client.get(f"/api/books/{story}/connections").json()["people"])["id"]
    assert client.post(f"/api/concepts/{keeper}/compare").status_code == 409  # a character lives in one book


def test_a_failed_build_is_reported(client, files):
    book = upload(client, files["epub"], genre_id="fiction", title="Harbour Broken").json()["id"]

    def broken(system, user):
        raise RuntimeError("model unavailable")

    graph.build_book(book, llm=broken)
    st = client.get(f"/api/books/{book}/connections").json()["status"]
    assert st["status"] == "failed" and "model unavailable" in st["error"]


def test_sections_spread_across_the_book():
    chunks = list(range(400))
    parts = graph.sections(chunks)  # type: ignore[arg-type]
    assert len(parts) == 10 and all(len(p) == 4 for p in parts) and parts[-1][0] >= 360
    assert graph.normalise("Self-Control") == graph.normalise("self control")
    assert graph.normalise("Emotions") == "emotion" and graph.normalise("loss") == "loss"


def test_reading_map_has_books_ideas_and_shared_links(client, library):
    story, essay, toc = library
    read_to(client, story, toc["Chapter III. Home"])
    m = client.get("/api/graph/map").json()
    ids = {b["id"]: b for b in m["books"]}
    assert ids[story]["graph"] == "ready" and ids[essay]["graph"] == "ready"
    patience = next(i for i in m["ideas"] if i["name"].lower() == "patience")
    assert {story, essay} <= {b["book_id"] for b in patience["books"]}
    assert all(i["name"] not in ("the old sailor", "the lighthouse keeper") for i in m["ideas"])  # only ideas, no people
