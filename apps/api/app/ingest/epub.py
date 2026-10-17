import re
import warnings
from pathlib import Path

import ebooklib
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from ebooklib import epub

from .chunking import ParsedBook, Section

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
warnings.filterwarnings("ignore", category=UserWarning, module="ebooklib")
warnings.filterwarnings("ignore", category=FutureWarning, module="ebooklib")

BLOCK_TAGS = ["p", "h1", "h2", "h3", "h4", "li", "blockquote", "pre"]


def _meta(book: epub.EpubBook, name: str) -> str:
    vals = book.get_metadata("DC", name)
    return vals[0][0].strip() if vals and vals[0][0] else ""


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _cover(book: epub.EpubBook) -> tuple[bytes | None, str]:
    # EPUB 3 cover-image property, then EPUB 2 <meta name="cover">, then any image named "cover".
    for item in book.get_items_of_type(ebooklib.ITEM_COVER):
        return item.get_content(), Path(item.get_name()).suffix.lstrip(".") or "jpg"
    cover_id = next((m[1].get("content") for m in book.get_metadata("OPF", "meta") if m[1].get("name") == "cover"), None)
    if cover_id:
        item = book.get_item_with_id(cover_id)
        if item is not None:
            return item.get_content(), Path(item.get_name()).suffix.lstrip(".") or "jpg"
    for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
        if "cover" in item.get_name().lower():
            return item.get_content(), Path(item.get_name()).suffix.lstrip(".") or "jpg"
    return None, "png"


def parse_epub(path: Path) -> ParsedBook:
    book = epub.read_epub(str(path), options={"ignore_ncx": True})
    title = _meta(book, "title") or path.stem
    author = _meta(book, "creator") or "Unknown"
    description = _clean(BeautifulSoup(_meta(book, "description"), "lxml").get_text()) if _meta(book, "description") else ""

    sections: list[Section] = []
    for idref, _linear in book.spine:
        item = book.get_item_with_id(idref)
        if item is None or item.get_type() != ebooklib.ITEM_DOCUMENT:
            continue
        # The navigation document is a table of contents, not reading text.
        if isinstance(item, epub.EpubNav) or "nav" in (getattr(item, "properties", None) or []):
            continue
        soup = BeautifulSoup(item.get_content(), "lxml")
        if soup.find("nav", attrs={"epub:type": "toc"}) is not None:
            continue
        paragraphs = [t for el in soup.find_all(BLOCK_TAGS) if (t := _clean(el.get_text(" ")))]
        # Skip near-empty documents (title pages, copyright notes).
        if sum(len(p) for p in paragraphs) < 40:
            continue
        heading = soup.find(["h1", "h2", "h3"])
        chapter_title = _clean(heading.get_text(" ")) if heading else (soup.title.get_text().strip() if soup.title and soup.title.get_text().strip() else f"Section {len(sections) + 1}")
        sections.append(Section(chapter_index=len(sections), chapter_title=chapter_title[:300], location=item.get_name(), paragraphs=paragraphs))

    if not description and sections:
        first = next((p for s in sections for p in s.paragraphs if len(p) > 120), "")
        description = first[:280] + ("…" if len(first) > 280 else "")

    cover, ext = _cover(book)
    return ParsedBook(title=title, author=author, description=description, sections=sections, cover=cover, cover_ext=ext)
