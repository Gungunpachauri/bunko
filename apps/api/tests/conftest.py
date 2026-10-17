import os
import tempfile
from pathlib import Path

# Point the app at a throwaway data directory before it is imported.
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="wl-test-")
os.environ.pop("REDIS_URL", None)
os.environ.pop("DATABASE_URL", None)
# Tests never call a real LLM (answers fall back to cited passages) and use an embedded Qdrant.
os.environ["LLM_PROVIDER"] = "none"
os.environ["LLM_BACKUP"] = "none"
for _key in ("GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY"):
    os.environ[_key] = ""
os.environ.pop("QDRANT_URL", None)
# Share the real model cache so tests don't download models into every temp directory.
os.environ["MODELS_DIR"] = str(Path(__file__).resolve().parent.parent / "data" / "models")

import pymupdf  # noqa: E402
import pytest  # noqa: E402
from ebooklib import epub  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.ingest.pipeline import ingest_book  # noqa: E402
from app.main import app  # noqa: E402

CHAPTERS = [
    ("Chapter I. The Harbour", ["It was a grey morning when the ship came in. " * 6, "The lighthouse keeper counted the masts and wrote them down. " * 5]),
    ("Chapter II. The Whale", ["Nobody believed the old sailor when he spoke of the white whale. " * 8, "He laughed, and the tavern fell silent. " * 4]),
    ("Chapter III. Home", ["At last the harbour lights appeared through the fog. " * 7]),
]

# 1×1 PNG, enough for a cover.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)


def make_epub(path: Path, title: str = "The Grey Harbour", author: str = "A. Tester") -> Path:
    book = epub.EpubBook()
    book.set_identifier(f"id-{title}")
    book.set_title(title)
    book.add_author(author)
    book.add_metadata("DC", "description", "<p>A short test novel about a harbour and a whale.</p>")
    book.set_cover("cover.png", PNG)
    items = []
    for i, (heading, paras) in enumerate(CHAPTERS):
        c = epub.EpubHtml(title=heading, file_name=f"chap_{i + 1}.xhtml", lang="en")
        c.content = f"<html><body><h1>{heading}</h1>" + "".join(f"<p>{p}</p>" for p in paras) + "</body></html>"
        book.add_item(c)
        items.append(c)
    book.toc = items
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav", *items]
    epub.write_epub(str(path), book)
    return path


def make_pdf(path: Path, title: str = "Notes on Stars") -> Path:
    doc = pymupdf.open()
    for i in range(3):
        page = doc.new_page()
        text = f"Part {i + 1}. " + ("The nearest star is the Sun, and the next is Proxima Centauri. " * 12)
        page.insert_textbox(pymupdf.Rect(50, 50, 550, 800), text, fontsize=11)
    doc.set_metadata({"title": title, "author": "B. Astronomer"})
    doc.set_toc([[1, "Part One", 1], [1, "Part Two", 2], [1, "Part Three", 3]])
    doc.save(str(path))
    doc.close()
    return path


@pytest.fixture()
def client(monkeypatch):
    # Process uploads synchronously so tests can assert on the result.
    monkeypatch.setattr("app.routes.books.enqueue_ingest", ingest_book)
    monkeypatch.setattr("app.routes.library.enqueue_ingest", ingest_book)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def files(tmp_path):
    return {"epub": make_epub(tmp_path / "harbour.epub"), "pdf": make_pdf(tmp_path / "stars.pdf")}
