"""Local ONNX models, loaded once on first use (the first call downloads them into data/models)."""

import threading
from functools import cache

from ..config import settings

_lock = threading.Lock()

# Retrieval models trained with an instruction on the query side (passages are embedded as-is).
QUERY_PREFIX = {
    "snowflake/snowflake-arctic-embed-xs": "Represent this sentence for searching relevant passages: ",
    "snowflake/snowflake-arctic-embed-s": "Represent this sentence for searching relevant passages: ",
    "snowflake/snowflake-arctic-embed-m": "Represent this sentence for searching relevant passages: ",
    "BAAI/bge-small-en-v1.5": "Represent this sentence for searching relevant passages: ",
    "BAAI/bge-base-en-v1.5": "Represent this sentence for searching relevant passages: ",
    "intfloat/multilingual-e5-large": "query: ",
}


def _cache_dir() -> str:
    path = settings.models_dir or settings.data_dir / "models"
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


@cache
def dense():
    from fastembed import TextEmbedding

    with _lock:
        return TextEmbedding(settings.embed_model, cache_dir=_cache_dir())


@cache
def sparse():
    from fastembed import SparseTextEmbedding

    with _lock:
        return SparseTextEmbedding(settings.sparse_model, cache_dir=_cache_dir())


@cache
def reranker():
    if not settings.rerank_model:
        return None
    from fastembed.rerank.cross_encoder import TextCrossEncoder

    with _lock:
        return TextCrossEncoder(settings.rerank_model, cache_dir=_cache_dir())


def dense_dim() -> int:
    return len(embed_query("dimension probe"))


def embed_query(text: str):
    return next(iter(dense().query_embed(QUERY_PREFIX.get(settings.embed_model, "") + text)))
