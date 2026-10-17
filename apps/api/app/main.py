import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
import threading

from . import graph
from .routes import ask, books, highlights, library
from .routes import graph as graph_routes

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    # Index books added before the AI core existed (or while it was off); a no-op once everything is indexed.
    threading.Thread(target=ask._reindex_all, args=(True,), daemon=True).start()
    # Finish knowledge-graph builds that were interrupted by a restart.
    graph.resume()
    yield


app = FastAPI(title="Bunko API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(library.router)
app.include_router(books.router)
app.include_router(ask.router)
app.include_router(highlights.router)
app.include_router(graph_routes.router)
