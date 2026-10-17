"""Fill the library with public-domain classics from Project Gutenberg.

Run with the API running:  python -m app.seed  [--api http://localhost:8000]
It downloads about 17 EPUBs from gutenberg.org, so it needs an internet connection.
Running it again skips books that are already in the library.
"""

import argparse
import re
import sys
import time

import httpx

# Genre id → (title, theme for Mixed mode) for rooms the seed may need to create.
ROOMS = {"space-astronomy": ("Space & Astronomy", "space")}

BOOKS = {
    "fiction": [
        (1342, "Pride and Prejudice"), (2701, "Moby-Dick"), (84, "Frankenstein"), (1260, "Jane Eyre"),
        (1184, "The Count of Monte Cristo"), (11, "Alice's Adventures in Wonderland"), (2500, "Siddhartha"),
    ],
    "selfhelp": [
        (2680, "Meditations"), (216, "Tao Te Ching|Tao Teh King"), (2388, "The Bhagavad Gita|The Song Celestial"), (205, "Walden"),
        (132, "The Art of War"), (45109, "The Enchiridion"), (4507, "As a Man Thinketh"),
    ],
    "space-astronomy": [
        (5001, "Relativity: The Special and General Theory"), (83, "From the Earth to the Moon"), (36, "The War of the Worlds"),
    ],
}


def _key(title: str) -> str:
    """Loose title key: lowercase letters and digits, no leading article."""
    t = re.sub(r"[^a-z0-9 ]", " ", title.lower())
    t = re.sub(r"^(the|a|an) ", "", t.strip())
    return re.sub(r"\s+", "", t)


def _have(title: str, existing: list[str]) -> bool:
    """Gutenberg's own titles are often longer ("Moby Dick; Or, The Whale"), so match on a shared start.
    A seed title may list alternatives separated by "|" ("Tao Te Ching|Tao Teh King")."""
    for alt in title.split("|"):
        k = _key(alt)
        if any(e.startswith(k) or k.startswith(e) for e in existing if e):
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000")
    args = parser.parse_args()
    with httpx.Client(base_url=args.api, timeout=180) as client:
        genres = {g["id"] for g in client.get("/api/genres").json()}
        for gid, (title, theme) in ROOMS.items():
            if gid not in genres and any(gid == g for g in BOOKS):
                client.post("/api/genres", json={"title": title, "theme": theme}).raise_for_status()
                print(f"room  {title} (new)")

        existing = [_key(b["title"]) for b in client.get("/api/library").json()["books"]]
        for genre, items in BOOKS.items():
            for gutenberg_id, title in items:
                title_shown = title.split("|")[0]
                if _have(title, existing):
                    print(f"skip  {title_shown} (already in the library)")
                    continue
                r = client.post("/api/import/gutenberg", json={"gutenberg_id": gutenberg_id, "genre_id": genre})
                ok = r.status_code == 201
                print(f"{'add ' if ok else 'FAIL'}  {title_shown}" + ("" if ok else f": {r.text}"))
                time.sleep(1)  # be polite to gutenberg.org
    return 0


if __name__ == "__main__":
    sys.exit(main())
