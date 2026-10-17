"""Split a book's paragraphs into passages that never cross a chapter or page boundary.

Every passage keeps its chapter, location (EPUB href or PDF page), paragraph range and
character offsets across the whole book, so later phases can cite it exactly and filter
retrieval to text before the reader's position.
"""

from dataclasses import dataclass, field

TARGET_CHARS = 1200
CHARS_PER_PAGE = 1800  # page estimate for EPUBs, which have no fixed pages


@dataclass
class Section:
    """A run of paragraphs that share one location (an EPUB chapter document or a PDF page)."""

    chapter_index: int
    chapter_title: str
    location: str
    paragraphs: list[str]
    page: int | None = None  # fixed page (PDF); None → estimate from offsets


@dataclass
class Passage:
    ordinal: int
    chapter_index: int
    chapter_title: str
    location: str
    page: int
    para_start: int
    para_end: int
    char_start: int
    char_end: int
    text: str


@dataclass
class ParsedBook:
    title: str
    author: str
    description: str
    sections: list[Section]
    cover: bytes | None = None
    cover_ext: str = "png"
    extra: dict = field(default_factory=dict)


def chunk_sections(sections: list[Section]) -> tuple[list[Passage], int]:
    passages: list[Passage] = []
    offset = 0
    for sec in sections:
        buf: list[str] = []
        start_para = 0
        start_char = offset
        for i, para in enumerate(sec.paragraphs):
            if not buf:
                start_para, start_char = i, offset
            buf.append(para)
            offset += len(para) + 1
            if sum(len(p) for p in buf) >= TARGET_CHARS:
                passages.append(_passage(len(passages), sec, start_para, i, start_char, offset, buf))
                buf = []
        if buf:
            passages.append(_passage(len(passages), sec, start_para, len(sec.paragraphs) - 1, start_char, offset, buf))
    return passages, offset


def _passage(ordinal: int, sec: Section, p0: int, p1: int, c0: int, c1: int, buf: list[str]) -> Passage:
    return Passage(
        ordinal=ordinal,
        chapter_index=sec.chapter_index,
        chapter_title=sec.chapter_title,
        location=sec.location,
        page=sec.page if sec.page is not None else c0 // CHARS_PER_PAGE + 1,
        para_start=p0,
        para_end=p1,
        char_start=c0,
        char_end=c1,
        text="\n".join(buf),
    )
