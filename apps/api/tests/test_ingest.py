from app.ingest.chunking import TARGET_CHARS, Section, chunk_sections
from app.ingest.epub import parse_epub
from app.ingest.pdf import parse_pdf


def test_epub_metadata_chapters_and_cover(files):
    book = parse_epub(files["epub"])
    assert book.title == "The Grey Harbour"
    assert book.author == "A. Tester"
    assert "harbour" in book.description.lower()
    assert [s.chapter_title for s in book.sections] == ["Chapter I. The Harbour", "Chapter II. The Whale", "Chapter III. Home"]
    assert book.sections[0].location.endswith("chap_1.xhtml")
    assert book.cover and book.cover.startswith(b"\x89PNG")


def test_pdf_pages_toc_and_cover(files):
    book = parse_pdf(files["pdf"])
    assert book.title == "Notes on Stars"
    assert [s.location for s in book.sections] == ["1", "2", "3"]
    assert [s.chapter_title for s in book.sections] == ["Part One", "Part Two", "Part Three"]
    assert book.extra["page_count"] == 3
    assert book.cover and book.cover.startswith(b"\x89PNG")


def test_chunks_stay_inside_sections_and_track_offsets():
    sections = [
        Section(0, "One", "a.xhtml", ["x" * 700, "y" * 700, "z" * 100]),
        Section(1, "Two", "b.xhtml", ["w" * 50]),
    ]
    passages, total = chunk_sections(sections)
    assert [p.location for p in passages] == ["a.xhtml", "a.xhtml", "b.xhtml"]
    assert passages[0].para_start == 0 and passages[0].para_end == 1
    assert len(passages[0].text) >= TARGET_CHARS
    # Offsets are contiguous across the whole book.
    assert passages[0].char_start == 0
    assert all(a.char_end == b.char_start for a, b in zip(passages, passages[1:]))
    assert passages[-1].char_end == total
