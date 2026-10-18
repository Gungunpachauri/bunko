"""Public-demo protection. With ADMIN_KEY set, visitors may read, search and ask (within a daily limit),
and only requests carrying the key may add, change or remove anything. Without it, everything is open."""

import hmac
import re
import threading
from datetime import UTC, datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .config import settings

router = APIRouter(prefix="/api", tags=["access"])

# The only changes a visitor may send: questions and searches, which leave the library as it was.
ASKS = [re.compile(p) for p in (r"^/api/books/[^/]+/ask$", r"^/api/ask$", r"^/api/books/[^/]+/discuss$",
                                r"^/api/concepts/\d+/compare$")]
VISITOR_POSTS = [*ASKS, re.compile(r"^/api/retrieve$")]

READ_ONLY = "This is a public demo, so adding, changing and removing books is turned off. Run Bunko yourself to use everything."

_lock = threading.Lock()
_day = ""
_used: dict[str, int] = {}
_total = 0


def is_admin(request: Request) -> bool:
    if not settings.admin_key:
        return True
    given = request.headers.get("x-admin-key", "")
    return hmac.compare_digest(given.encode(), settings.admin_key.encode())


def _visitor(request: Request) -> str:
    # Hugging Face and Vercel sit behind a proxy, which passes the real address along.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _roll_day() -> None:
    global _day, _total
    today = datetime.now(UTC).date().isoformat()
    if today != _day:
        _day, _total = today, 0
        _used.clear()


def asks_left(request: Request) -> int | None:
    """Questions this visitor has left today; None when there's no limit."""
    if is_admin(request) or not settings.ask_limit_per_visitor:
        return None
    with _lock:
        _roll_day()
        return max(0, settings.ask_limit_per_visitor - _used.get(_visitor(request), 0))


def _take_ask(request: Request) -> str | None:
    """Count one question; the reason it's refused, if it is."""
    global _total
    with _lock:
        _roll_day()
        who = _visitor(request)
        if settings.ask_limit_total and _total >= settings.ask_limit_total:
            return "The demo has answered all the questions it can for today. Please come back tomorrow."
        if settings.ask_limit_per_visitor and _used.get(who, 0) >= settings.ask_limit_per_visitor:
            return (f"You've asked today's {settings.ask_limit_per_visitor} free questions in this demo. "
                    "Come back tomorrow, or run Bunko yourself for unlimited questions.")
        _used[who] = _used.get(who, 0) + 1
        _total += 1
    return None


async def guard(request: Request, call_next):
    """Middleware: let reads through; let visitors ask (counted); refuse every other change."""
    path = request.url.path
    if request.method in ("GET", "HEAD", "OPTIONS") or not path.startswith("/api") or is_admin(request):
        return await call_next(request)
    if not any(p.match(path) for p in VISITOR_POSTS):
        return JSONResponse({"detail": READ_ONLY}, status_code=403)
    if any(p.match(path) for p in ASKS):
        refused = _take_ask(request)
        if refused:
            return JSONResponse({"detail": refused}, status_code=429)
    return await call_next(request)


@router.get("/access")
def access(request: Request) -> dict:
    """What this visitor may do, so the website can hide what they can't."""
    admin = is_admin(request)
    return {"visitor": not admin, "demo": bool(settings.admin_key), "asks_left": asks_left(request),
            "ask_limit": settings.ask_limit_per_visitor or None}
