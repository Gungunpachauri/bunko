"""Qdrant index of passages: one point per Chunk, with a dense and a BM25 vector.

Only positions live in the payload (book, genre, character offsets); the text stays in the database.
"""

import logging
import threading
from dataclasses import dataclass
from functools import cache

from qdrant_client import QdrantClient, models
from sqlalchemy import select

from ..config import settings
from ..db import SessionLocal
from ..models import Book, Chunk
from . import encoders

log = logging.getLogger(__name__)
DENSE, SPARSE = "dense", "bm25"
BATCH = 64

# The embedded Qdrant isn't safe to share between threads; the server is, and the lock costs little.
_lock = threading.RLock()
# Book ids being indexed right now, with how many passages are done.
indexing: dict[str, tuple[int, int]] = {}


@cache
def client() -> QdrantClient:
    if settings.qdrant_url:
        # The server image and the client library are versioned separately; the APIs used here are stable.
        return QdrantClient(url=settings.qdrant_url, check_compatibility=False)
    settings.qdrant_path.mkdir(parents=True, exist_ok=True)
    return QdrantClient(path=str(settings.qdrant_path))


def ensure_collection() -> None:
    c = client()
    with _lock:
        if c.collection_exists(settings.rag_collection):
            return
        c.create_collection(
            settings.rag_collection,
            vectors_config={DENSE: models.VectorParams(size=encoders.dense_dim(), distance=models.Distance.COSINE)},
            sparse_vectors_config={SPARSE: models.SparseVectorParams(modifier=models.Modifier.IDF)},
        )
        if settings.qdrant_url:  # payload indexes only matter (and only exist) on the server
            for field, kind in (("book_id", "keyword"), ("genre_id", "keyword"), ("char_start", "integer")):
                c.create_payload_index(settings.rag_collection, field, field_schema=kind)


def _embed_text(book: Book, chunk: Chunk) -> str:
    # Title and chapter give a passage context it lacks on its own ("he" → who, in which book).
    return f"{book.title} — {chunk.chapter_title}\n{chunk.text}"


def index_book(book_id: str) -> int:
    """(Re)index every passage of a book. Returns the number of passages indexed."""
    ensure_collection()
    with SessionLocal() as session:
        book = session.get(Book, book_id)
        if book is None or book.status != "ready":
            return 0
        chunks = session.scalars(select(Chunk).where(Chunk.book_id == book_id).order_by(Chunk.ordinal)).all()
        delete_book(book_id)
        indexing[book_id] = (0, len(chunks))
        try:
            for i in range(0, len(chunks), BATCH):
                batch = chunks[i:i + BATCH]
                texts = [_embed_text(book, c) for c in batch]
                dense = list(encoders.dense().passage_embed(texts, batch_size=BATCH))
                sparse = list(encoders.sparse().passage_embed(texts, batch_size=BATCH))
                points = [
                    models.PointStruct(
                        id=c.id,
                        vector={DENSE: d.tolist(), SPARSE: models.SparseVector(indices=s.indices.tolist(), values=s.values.tolist())},
                        payload={"book_id": book.id, "genre_id": book.genre_id, "ordinal": c.ordinal,
                                 "char_start": c.char_start, "char_end": c.char_end, "page": c.page},
                    )
                    for c, d, s in zip(batch, dense, sparse, strict=True)
                ]
                with _lock:
                    client().upsert(settings.rag_collection, points=points, wait=True)
                indexing[book_id] = (i + len(batch), len(chunks))
        finally:
            indexing.pop(book_id, None)
    log.info("indexed %s: %d passages", book_id, len(chunks))
    return len(chunks)


def delete_book(book_id: str) -> None:
    c = client()
    with _lock:
        if not c.collection_exists(settings.rag_collection):
            return
        c.delete(settings.rag_collection, points_selector=models.FilterSelector(filter=_book(book_id)), wait=True)


def indexed_count(book_id: str) -> int:
    c = client()
    with _lock:
        if not c.collection_exists(settings.rag_collection):
            return 0
        return c.count(settings.rag_collection, count_filter=_book(book_id), exact=True).count


def _book(book_id: str) -> models.Filter:
    return models.Filter(must=[models.FieldCondition(key="book_id", match=models.MatchValue(value=book_id))])


@dataclass
class Window:
    """Text of one book that retrieval may see: passages that start before `limit` (a character offset)."""

    book_id: str
    limit: int | None  # None → the whole book


def _window_filter(windows: list[Window]) -> models.Filter:
    def one(w: Window) -> models.Filter:
        must: list = [models.FieldCondition(key="book_id", match=models.MatchValue(value=w.book_id))]
        if w.limit is not None:
            must.append(models.FieldCondition(key="char_start", range=models.Range(lt=w.limit)))
        return models.Filter(must=must)

    if len(windows) == 1:
        return one(windows[0])
    return models.Filter(should=[one(w) for w in windows])


@dataclass
class Hit:
    chunk_id: int
    score: float


def hybrid_search(query: str, windows: list[Window], limit: int = 30) -> list[Hit]:
    """Dense + BM25 candidates inside the reading windows, merged with reciprocal rank fusion."""
    if not windows:
        return []
    ensure_collection()
    flt = _window_filter(windows)
    q_dense = encoders.embed_query(query).tolist()
    s = next(iter(encoders.sparse().query_embed(query)))
    q_sparse = models.SparseVector(indices=s.indices.tolist(), values=s.values.tolist())
    with _lock:
        res = client().query_points(
            settings.rag_collection,
            prefetch=[
                models.Prefetch(query=q_dense, using=DENSE, filter=flt, limit=limit * 2),
                models.Prefetch(query=q_sparse, using=SPARSE, filter=flt, limit=limit * 2),
            ],
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            limit=limit,
        )
    return [Hit(chunk_id=int(p.id), score=p.score) for p in res.points]
