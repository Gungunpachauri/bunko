import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(UTC)


class Genre(Base):
    """A genre is a room in the walkable library."""

    __tablename__ = "genres"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # slug
    title: Mapped[str] = mapped_column(String(120))
    # Air colour in the 3D world, and the theme the room is built in (Mixed mode).
    mood: Mapped[str] = mapped_column(String(9), default="#ff9a5a")
    theme: Mapped[str] = mapped_column(String(32), default="japanese")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    books: Mapped[list["Book"]] = relationship(back_populates="genre")


class Book(Base):
    __tablename__ = "books"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(500))
    author: Mapped[str] = mapped_column(String(300), default="Unknown")
    genre_id: Mapped[str] = mapped_column(ForeignKey("genres.id"))
    format: Mapped[str] = mapped_column(String(8))  # "epub" | "pdf"
    file_name: Mapped[str] = mapped_column(String(300))
    has_cover: Mapped[bool] = mapped_column(default=False)
    description: Mapped[str] = mapped_column(Text, default="")
    # "processing" → "ready" | "failed"
    status: Mapped[str] = mapped_column(String(16), default="processing")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_chars: Mapped[int] = mapped_column(Integer, default=0)
    total_pages: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    genre: Mapped[Genre] = relationship(back_populates="books")
    chunks: Mapped[list["Chunk"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    position: Mapped["Position | None"] = relationship(back_populates="book", cascade="all, delete-orphan", uselist=False)
    highlights: Mapped[list["Highlight"]] = relationship(back_populates="book", cascade="all, delete-orphan",
                                                         order_by="Highlight.created_at")


class Chunk(Base):
    """A passage of a book. Every chunk knows exactly where it lives, for citations and spoiler-safe retrieval later."""

    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)
    ordinal: Mapped[int] = mapped_column(Integer)
    chapter_index: Mapped[int] = mapped_column(Integer, default=0)
    chapter_title: Mapped[str] = mapped_column(String(500), default="")
    # EPUB: the chapter document's href; PDF: the 1-based page number as text.
    location: Mapped[str] = mapped_column(String(500))
    page: Mapped[int] = mapped_column(Integer, default=1)
    para_start: Mapped[int] = mapped_column(Integer, default=0)
    para_end: Mapped[int] = mapped_column(Integer, default=0)
    # Character offsets across the whole book.
    char_start: Mapped[int] = mapped_column(Integer, default=0)
    char_end: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text)

    book: Mapped[Book] = relationship(back_populates="chunks")


class Position(Base):
    """Where the reader is in a book (one per book: this is a personal library)."""

    __tablename__ = "positions"

    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    # EPUB: a CFI; PDF: the page number as text.
    location: Mapped[str] = mapped_column(String(500))
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    chapter_href: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # How far through that chapter the end of the visible page is (0–1). EPUB only; makes spoiler limits exact.
    chapter_fraction: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    book: Mapped[Book] = relationship(back_populates="position")


class Concept(Base):
    """An idea, theme, person or place in the knowledge graph.

    Ideas and themes are shared across books ("self-control" in Meditations and the Gita is one concept).
    People and places belong to one book (two books' "William" are different people).
    """

    __tablename__ = "concepts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Normalised name used for matching ("self control"); for people/places prefixed with the book id.
    key: Mapped[str] = mapped_column(String(300), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(16))  # idea | person | place
    description: Mapped[str] = mapped_column(Text, default="")
    embedding: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list, for merging near-synonyms

    mentions: Mapped[list["Mention"]] = relationship(back_populates="concept", cascade="all, delete-orphan")


class Mention(Base):
    """A concept showing up in a passage of a book, with what the book says about it there."""

    __tablename__ = "mentions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"), index=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[int | None] = mapped_column(ForeignKey("chunks.id", ondelete="SET NULL"), nullable=True)
    char_start: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str] = mapped_column(Text, default="")  # one line: what this book says about the concept here

    concept: Mapped[Concept] = relationship(back_populates="mentions")


class Relation(Base):
    """Two concepts linked inside one book ("Elizabeth — dislikes — Darcy", "anger — weakens — judgement")."""

    __tablename__ = "relations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    target_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(120))
    char_start: Mapped[int] = mapped_column(Integer, default=0)


class BookGraph(Base):
    """Progress of building one book's part of the knowledge graph."""

    __tablename__ = "book_graphs"

    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(String(16), default="queued")  # queued | building | ready | failed
    done: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Comparison(Base):
    """A saved "where do these books agree or disagree about X?" answer (books can only add to it, so it's cached)."""

    __tablename__ = "comparisons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"), index=True)
    # Which passages it was written from (sorted mention ids), so it's redone when new ones appear.
    basis: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)
    passages: Mapped[str] = mapped_column(Text)  # JSON list of the cited passages
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Highlight(Base):
    """A passage the reader marked, with an optional note. Each highlight is also a spaced-repetition card."""

    __tablename__ = "highlights"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)
    # EPUB: a CFI range; PDF: the page number as text.
    location: Mapped[str] = mapped_column(String(1000))
    chapter_href: Mapped[str | None] = mapped_column(String(500), nullable=True)
    chapter_title: Mapped[str] = mapped_column(String(500), default="")
    text: Mapped[str] = mapped_column(Text)
    note: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(16), default="amber")
    # Where it sits in the book's text (matched against the passages), for ordering and spoiler-safe use.
    char_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Dense embedding of text + note (JSON list), for "what did I find important about …" searches.
    embedding: Mapped[str | None] = mapped_column(Text, nullable=True)
    # FSRS card state (JSON) and when it is next due for review.
    card: Mapped[str] = mapped_column(Text, default="")
    due: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    reviews: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    book: Mapped[Book] = relationship(back_populates="highlights")


DEFAULT_GENRES = [
    {"id": "fiction", "title": "Fiction", "mood": "#ff9a5a", "theme": "japanese"},
    {"id": "selfhelp", "title": "Self-help", "mood": "#6fc2c8", "theme": "vedic"},
]


def ensure_default_genres(session: Session) -> None:
    if session.scalar(select(Genre.id).limit(1)) is not None:
        return
    for g in DEFAULT_GENRES:
        session.add(Genre(**g))
    session.commit()
