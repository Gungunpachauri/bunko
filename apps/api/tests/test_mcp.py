"""The MCP server's tools, routed through the test app instead of a running API."""

import pytest
from mcp.server.mcpserver.exceptions import ToolError

import mcp_server

from .test_api import upload


@pytest.fixture()
def tools(client, monkeypatch):
    monkeypatch.setattr(mcp_server, "_get", lambda path, **params: client.get(path, params={k: v for k, v in params.items() if v is not None}).json())
    monkeypatch.setattr(mcp_server, "_post", lambda path, body: client.post(path, json=body).json())
    return mcp_server


def test_tools_answer_from_the_library(client, files, tools):
    book_id = upload(client, files["epub"], genre_id="fiction", title="Harbour for MCP").json()["id"]
    href = next(t["location"] for t in client.get(f"/api/books/{book_id}/toc").json() if t["title"].startswith("Chapter I."))
    client.put(f"/api/books/{book_id}/position", json={"location": "x", "progress": 0.3, "chapter_href": href, "chapter_fraction": 1.0})

    assert "Harbour for MCP by A. Tester" in tools.list_books()
    assert "30% read" in tools.reading_status()

    found = tools.search_book("harbour for mcp", "who counted the masts?")
    assert "lighthouse keeper" in found and "[1]" in found
    # Spoiler-safe by default: chapter II is past the reader's page.
    assert "white whale" not in tools.search_book("harbour for mcp", "the white whale and the old sailor")
    assert "white whale" in tools.search_book("harbour for mcp", "the white whale and the old sailor", include_spoilers=True)

    client.post(f"/api/books/{book_id}/highlights", json={"location": "cfi", "chapter_href": href, "note": "calm counting",
                                                          "text": "The lighthouse keeper counted the masts and wrote them down."})
    assert "calm counting" in tools.my_highlights("who keeps watch over the ships?")

    with pytest.raises(ToolError, match="No book matching"):
        tools.search_book("no such book", "anything")
