import re
from pathlib import Path

import pymupdf

from .chunking import ParsedBook, Section


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_pdf(path: Path) -> ParsedBook:
    doc = pymupdf.open(str(path))
    try:
        meta = doc.metadata or {}
        title = _clean(meta.get("title") or "") or path.stem
        author = _clean(meta.get("author") or "") or "Unknown"

        # The table of contents maps pages to chapters; without one, each page stands alone.
        toc = [(lvl, t, p) for lvl, t, p in doc.get_toc(simple=True) if lvl <= 2 and p >= 1]
        chapter_at: list[tuple[int, str]] = sorted(((p, _clean(t)) for _, t, p in toc), key=lambda x: x[0])

        sections: list[Section] = []
        for page_no in range(1, doc.page_count + 1):
            page = doc.load_page(page_no - 1)
            blocks = page.get_text("blocks", sort=True)
            paragraphs = [t for b in blocks if b[6] == 0 and (t := _clean(b[4]))]
            if not paragraphs:
                continue
            idx, chapter_title = 0, f"Page {page_no}"
            for i, (start, t) in enumerate(chapter_at):
                if start <= page_no:
                    idx, chapter_title = i, t
            sections.append(Section(chapter_index=idx, chapter_title=chapter_title[:300], location=str(page_no), paragraphs=paragraphs, page=page_no))

        first = next((p for s in sections for p in s.paragraphs if len(p) > 120), "")
        description = first[:280] + ("…" if len(first) > 280 else "")

        # Render the first page as the cover.
        cover = None
        if doc.page_count:
            pix = doc.load_page(0).get_pixmap(matrix=pymupdf.Matrix(0.6, 0.6))
            cover = pix.tobytes("png")
        return ParsedBook(title=title, author=author, description=description, sections=sections, cover=cover, cover_ext="png",
                          extra={"page_count": doc.page_count})
    finally:
        doc.close()
