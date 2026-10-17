from datetime import datetime

from pydantic import BaseModel, Field


class GenreOut(BaseModel):
    id: str
    title: str
    mood: str
    theme: str
    created_at: datetime


class GenreIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    theme: str | None = None


class PositionOut(BaseModel):
    location: str
    progress: float
    chapter_href: str | None
    updated_at: datetime


class PositionIn(BaseModel):
    location: str = Field(min_length=1, max_length=500)
    progress: float = Field(ge=0, le=1)
    chapter_href: str | None = None
    chapter_fraction: float | None = Field(default=None, ge=0, le=1)


class BookOut(BaseModel):
    id: str
    title: str
    author: str
    genre_id: str
    format: str
    status: str
    error: str | None
    description: str
    has_cover: bool
    total_pages: int
    total_chars: int = 0
    # The newest few highlights (for the book card) and how many there are.
    highlights: list[str] = []
    highlight_count: int = 0
    created_at: datetime
    position: PositionOut | None


class LibraryOut(BaseModel):
    genres: list[GenreOut]
    books: list[BookOut]


class PassageHit(BaseModel):
    book_id: str
    book_title: str
    chapter_title: str
    location: str
    page: int
    snippet: str


class SearchOut(BaseModel):
    books: list[BookOut]
    passages: list[PassageHit]
    genres: list[GenreOut]


class TocEntry(BaseModel):
    chapter_index: int
    title: str
    location: str
    page: int


class GutenbergIn(BaseModel):
    gutenberg_id: int = Field(gt=0)
    genre_id: str
