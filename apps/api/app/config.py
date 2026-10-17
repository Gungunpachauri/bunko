from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parent.parent

# Where each LLM provider is reached. Gemini, Groq and OpenRouter all speak the OpenAI chat API.
OPENAI_COMPATIBLE = {
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
}


class Settings(BaseSettings):
    """Runtime settings. Defaults run locally with no services; Docker Compose overrides them."""

    # apps/api/.env, wherever the server is started from.
    model_config = SettingsConfigDict(env_file=API_DIR / ".env", extra="ignore")

    data_dir: Path = API_DIR / "data"
    # SQLite for local dev; Docker Compose points this at Postgres.
    database_url: str = ""
    # When set, ingestion runs in an RQ worker; otherwise in a background thread of the API.
    redis_url: str | None = None
    cors_origins: list[str] = ["http://localhost:3000"]
    max_upload_mb: int = 200

    # --- AI: search, answers, discussion partner, knowledge graph ---
    # Qdrant server URL; empty → an embedded Qdrant stored under data_dir (no server needed).
    qdrant_url: str | None = None
    rag_collection_prefix: str = "passages"
    models_dir: Path | None = None  # where downloaded models are cached; default data_dir/models
    # Local ONNX models (fastembed), picked to run on a laptop CPU: indexing ~12 passages/s, reranking ~2 s/question.
    # With a GPU or more patience, BAAI/bge-small-en-v1.5 / intfloat/multilingual-e5-large (Hindi, Sanskrit) and
    # BAAI/bge-reranker-v2-m3 are stronger. Changing the embed model starts a fresh index automatically.
    embed_model: str = "snowflake/snowflake-arctic-embed-xs"
    sparse_model: str = "Qdrant/bm25"
    rerank_model: str = "jinaai/jina-reranker-v1-turbo-en"  # empty → skip reranking
    rerank_candidates: int = 20
    # gemini | groq | openrouter | openai (any OpenAI-compatible server: vLLM, Ollama) | anthropic | none.
    # Without a key the app still works: answers are the cited passages themselves.
    llm_provider: str = "gemini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-flash-latest"
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-120b"
    openrouter_api_key: str | None = None
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    llm_base_url: str | None = None  # provider "openai": e.g. http://localhost:11434/v1 for Ollama
    llm_api_key: str | None = None
    llm_model: str = "llama3.1"
    # Used automatically when the main provider is out of free quota or overloaded (only if its key is set).
    llm_backup: str = "groq"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5-5"
    # Unread books may still be searched across the library, but only their opening (like a book jacket).
    unread_peek_chars: int = 15000

    @property
    def db_url(self) -> str:
        return self.database_url or f"sqlite:///{(self.data_dir / 'library.db').as_posix()}"

    @property
    def books_dir(self) -> Path:
        return self.data_dir / "books"

    @property
    def covers_dir(self) -> Path:
        return self.data_dir / "covers"

    @property
    def rag_collection(self) -> str:
        """One collection per embedding model, so switching models never mixes incompatible vectors."""
        slug = "".join(ch if ch.isalnum() else "_" for ch in self.embed_model.split("/")[-1].lower())
        return f"{self.rag_collection_prefix}_{slug}"

    @property
    def qdrant_path(self) -> Path:
        return self.data_dir / "qdrant"

    def llm_endpoint(self, provider: str | None = None) -> tuple[str, str, str | None, str] | None:
        """(provider, base_url, api_key, model) for OpenAI-compatible providers; None when not configured."""
        p = provider or self.llm_provider
        if p in OPENAI_COMPATIBLE:
            key = getattr(self, f"{p}_api_key")
            return (p, OPENAI_COMPATIBLE[p], key, getattr(self, f"{p}_model")) if key else None
        if p == "openai" and self.llm_base_url:
            return (p, self.llm_base_url.rstrip("/"), self.llm_api_key, self.llm_model)
        return None

    def llm_endpoints(self) -> list[tuple[str, str, str | None, str]]:
        """The main OpenAI-compatible provider, then the backup; only the ones with a key."""
        out = []
        for p in (self.llm_provider, self.llm_backup):
            ep = self.llm_endpoint(p) if p and p not in {e[0] for e in out} else None
            if ep:
                out.append(ep)
        return out

    @property
    def llm(self) -> str:
        """The provider answering first: the chosen one, or the backup when the chosen one has no key."""
        if self.llm_provider == "anthropic" and self.anthropic_api_key:
            return "anthropic"
        eps = self.llm_endpoints()
        return eps[0][0] if eps else "none"

    @property
    def llm_model_name(self) -> str | None:
        if self.llm == "anthropic":
            return self.anthropic_model
        eps = self.llm_endpoints()
        return eps[0][3] if eps else None

    @property
    def llm_backup_name(self) -> str | None:
        """The backup provider, when it is set up and differs from the one answering first."""
        eps = self.llm_endpoints()
        return eps[1][0] if len(eps) > 1 else None


settings = Settings()
