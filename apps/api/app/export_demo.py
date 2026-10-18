"""Export a static showcase of Bunko: everything the website needs, saved as files it can serve without a server.

With the API running on your library:

  python -m app.export_demo [--api http://localhost:8010] [--out ../web/public/demo] [--skip "Monte Cristo"]

It saves the shelf, each book's file, cover and contents, the reading map and connections, and answers to the
questions the website suggests, asked of the real AI at each book's saved reading position. Answers already saved
are kept, so if the AI runs out of free quota part-way, run it again later to finish.
"""

import argparse
import json
import re
import shutil
import sys
import time
from pathlib import Path

import httpx

from .config import API_DIR

# The questions the website offers (reader, the book chat in the library, and the librarian).
BOOK_QUESTIONS = [
    "What has happened so far?",
    "Which characters have I met, and how are they connected?",
    "What are the main ideas so far?",
    "What is this book about so far?",
    "Explain the most important passage I've read",
]
EXTRA_QUESTIONS = {"Pride and Prejudice": ["Why does Elizabeth dislike Mr. Darcy?"]}
LIBRARY_QUESTIONS = [
    "Which books talk about habits and discipline?",
    "What do my books say about facing death?",
    "Compare the ideas of duty in my books",
]
# Words that mean the AI itself failed (its errors normally arrive as error events; this catches the rest).
FAILED = ("out of free quota", "frees up again", "rate limit")


def norm(q: str) -> str:
    """Matching key for a question; the website normalises the same way."""
    return re.sub(r"[^a-z0-9]+", " ", q.lower()).strip()


def save(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def record(client: httpx.Client, path: str, body: dict) -> list | None:
    """Ask once and keep the streamed events; None when the AI failed (so it's retried on the next run)."""
    events: list = []
    with client.stream("POST", path, json=body, timeout=180) as r:
        if r.status_code != 200:
            print(f"   ! {r.status_code} {r.read()[:200]!r}")
            return None
        buf = ""
        for chunk in r.iter_text():
            buf += chunk
            while "\n\n" in buf:
                block, buf = buf.split("\n\n", 1)
                ev = re.search(r"^event: (.*)$", block, re.M)
                data = re.search(r"^data: (.*)$", block, re.M)
                if ev and data:
                    events.append([ev.group(1), json.loads(data.group(1))])
    if any(e == "error" for e, _ in events):
        msg = next(d.get("message", "") for e, d in events if e == "error")
        print(f"   ! {msg[:160]}")
        return None
    text = "".join(d["text"] for e, d in events if e == "delta")
    if not text.strip() or any(f in text.lower()[:200] for f in FAILED):
        return None
    # Merge the streamed pieces into one, so the files stay small; the website replays it word by word.
    merged = [[e, d] for e, d in events if e != "delta"]
    at = next((i for i, (e, _) in enumerate(merged) if e in ("leak", "done")), len(merged))
    merged.insert(at, ["delta", {"text": text}])
    return merged


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--api", default="http://localhost:8010")
    p.add_argument("--out", default=str(API_DIR.parent / "web" / "public" / "demo"))
    p.add_argument("--skip", action="append", default=["Monte Cristo"], help="leave out books whose title contains this")
    p.add_argument("--no-ask", action="store_true", help="export everything except recorded answers")
    p.add_argument("--pause", type=float, default=4, help="seconds between questions (raise it if the free AI limit is hit)")
    args = p.parse_args()
    out = Path(args.out)
    api = httpx.Client(base_url=args.api, timeout=120)

    lib = api.get("/api/library").json()
    books = [b for b in lib["books"] if b["status"] == "ready" and not any(s.lower() in b["title"].lower() for s in args.skip)]
    keep = {b["id"] for b in books}
    spots: dict[str, dict] = {}
    for b in books:  # the demo has no highlights of its own
        b["highlights"], b["highlight_count"] = [], 0
        # A book you've opened but not really started gets a demo reading place a fifth of the way in, so its
        # answers have something to talk about. Only the export changes; your library keeps its own place.
        if b["position"] and b["position"]["progress"] < 0.03:
            toc = [t for t in api.get(f"/api/books/{b['id']}/toc").json() if t["location"]]
            chapters = list(dict.fromkeys(t["location"] for t in toc))
            if len(chapters) >= 3:
                i = max(1, round(len(chapters) * 0.2))
                spot = {"chapter_href": chapters[i], "chapter_fraction": 1.0}
                spots[b["id"]] = spot
                b["position"] = {**b["position"], "location": chapters[i], "chapter_href": chapters[i],
                                 "progress": round(i / len(chapters), 3), "updated_at": b["position"]["updated_at"]}
    used_genres = {b["genre_id"] for b in books}
    lib = {"genres": [g for g in lib["genres"] if g["id"] in used_genres], "books": books}
    save(out / "api" / "library.json", lib)
    print(f"shelf: {len(books)} books in {len(lib['genres'])} rooms")

    for b in books:
        bid = b["id"]
        save(out / "api" / "books" / bid / "toc.json", api.get(f"/api/books/{bid}/toc").json())
        conn = api.get(f"/api/books/{bid}/connections").json()
        for group in ("ideas", "people"):
            for c in conn.get(group, []):
                c["also_in"] = [x for x in c.get("also_in", []) if x["book_id"] in keep]
        save(out / "api" / "books" / bid / "connections.json", conn)
        f = out / "files" / bid
        if not f.exists():
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(api.get(f"/api/books/{bid}/file").content)
        if b["has_cover"]:
            r = api.get(f"/api/books/{bid}/cover")
            if r.status_code == 200:
                (out / "covers").mkdir(parents=True, exist_ok=True)
                (out / "covers" / bid).write_bytes(r.content)
    print("books: files, covers, contents and connections saved")

    graph = api.get("/api/graph/map").json()
    graph["books"] = [b for b in graph["books"] if b["id"] in keep]
    for idea in graph["ideas"]:
        idea["books"] = [x for x in idea["books"] if x["book_id"] in keep]
    graph["ideas"] = [i for i in graph["ideas"] if i["books"]]
    ideas = {i["id"] for i in graph["ideas"]}
    graph["links"] = [link for link in graph["links"] if link["source"] in ideas and link["target"] in ideas]
    save(out / "api" / "graph-map.json", graph)

    status = api.get("/api/rag/status").json()
    status["indexing"] = {}
    save(out / "api" / "rag-status.json", status)

    # Concepts shown on the map and in connections, and the passages they point to.
    concept_ids = set(ideas)
    for b in books:
        conn = json.loads((out / "api" / "books" / b["id"] / "connections.json").read_text(encoding="utf-8"))
        concept_ids |= {c["id"] for g in ("ideas", "people") for c in conn.get(g, [])}
    chunk_ids: set[int] = set()
    for cid in sorted(concept_ids):
        r = api.get(f"/api/concepts/{cid}")
        if r.status_code != 200:
            continue
        concept = r.json()
        concept["books"] = [x for x in concept["books"] if x["book_id"] in keep]
        chunk_ids |= {m["chunk_id"] for x in concept["books"] for m in x["mentions"] if m.get("chunk_id")}
        save(out / "api" / "concepts" / f"{cid}.json", concept)
    print(f"map: {len(graph['ideas'])} ideas, {len(concept_ids)} concepts")

    if not args.no_ask:
        asks_dir = out / "asks"
        jobs = [(b, q) for b in books for q in BOOK_QUESTIONS + EXTRA_QUESTIONS.get(b["title"], [])]
        for b in books:
            path = asks_dir / f"{b['id']}.json"
            rec = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"ask": {}, "discuss": None}
            for q in BOOK_QUESTIONS + EXTRA_QUESTIONS.get(b["title"], []):
                rec.setdefault("q", {})[norm(q)] = q  # the question as written, to list what can be asked
                if norm(q) in rec["ask"]:
                    continue
                print(f"ask   {b['title'][:40]}: {q}")
                events = record(api, f"/api/books/{b['id']}/ask", {"question": q, "history": [], "position": spots.get(b["id"])})
                if events:
                    rec["ask"][norm(q)] = events
                    save(path, rec)
                time.sleep(args.pause)  # stay inside free per-minute limits
            if not rec.get("discuss"):
                print(f"talk  {b['title'][:40]}")
                rec["discuss"] = record(api, f"/api/books/{b['id']}/discuss",
                                        {"message": None, "history": [], "position": spots.get(b["id"])})
                time.sleep(args.pause)
            rec["q"] = {k: v for k, v in rec["q"].items() if k in rec["ask"]}
            save(path, rec)
        path = asks_dir / "library.json"
        rec = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"ask": {}, "discuss": None}
        for q in LIBRARY_QUESTIONS:
            rec.setdefault("q", {})[norm(q)] = q
            if norm(q) not in rec["ask"]:
                print(f"ask   library: {q}")
                events = record(api, "/api/ask", {"question": q, "history": []})
                if events:
                    rec["ask"][norm(q)] = events
                    save(path, rec)
                time.sleep(args.pause)
        rec["q"] = {k: v for k, v in rec["q"].items() if k in rec["ask"]}
        save(path, rec)
        missing = sum(1 for b, q in jobs if norm(q) not in json.loads((asks_dir / f"{b['id']}.json").read_text(encoding="utf-8"))["ask"])
        print(f"answers: {len(jobs) - missing}/{len(jobs)} recorded" + (" (run again later for the rest)" if missing else ""))

    # Passages that recorded answers and connections can open.
    for f in (out / "asks").glob("*.json") if (out / "asks").exists() else []:
        rec = json.loads(f.read_text(encoding="utf-8"))
        for events in [*rec["ask"].values(), rec.get("discuss") or []]:
            for e, d in events:
                if e == "citations":
                    chunk_ids |= {c["chunk_id"] for c in d}
    for cid in sorted(chunk_ids):
        target = out / "api" / "passages" / f"{cid}.json"
        if not target.exists():
            r = api.get(f"/api/passages/{cid}")
            if r.status_code == 200 and r.json()["book_id"] in keep:
                save(target, r.json())
    print(f"passages: {len(chunk_ids)} saved")
    bundle(out)
    return 0


def bundle(out: Path) -> None:
    """Pack the many small files into a few (all passages, all ideas, one file per book) so the showcase stays tidy."""
    load = lambda f: json.loads(f.read_text(encoding="utf-8"))  # noqa: E731
    for name in ("passages", "concepts"):
        folder, target = out / "api" / name, out / "api" / f"{name}.json"
        data = load(target) if target.exists() else {}
        if folder.exists():
            data |= {f.stem: load(f) for f in folder.glob("*.json")}
            shutil.rmtree(folder)
        save(target, data)
    books = out / "api" / "books"
    if books.exists():
        for folder in (d for d in books.iterdir() if d.is_dir()):
            save(out / "books" / f"{folder.name}.json",
                 {"toc": load(folder / "toc.json"), "connections": load(folder / "connections.json")})
        shutil.rmtree(books)
    print(f"bundled: {sum(1 for f in out.rglob('*') if f.is_file())} files in the showcase")


if __name__ == "__main__":
    sys.exit(main())
