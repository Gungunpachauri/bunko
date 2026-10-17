import re

THEMES = ["japanese", "chinese", "vedic", "space", "fantasy"]
MOODS = ["#b48aff", "#ff8fb8", "#e0b060", "#7fd4ff", "#ffcf6a", "#8a6aff", "#9ad46a", "#ff7a5a"]

# Which theme a new genre's room is built in (Mixed mode), guessed from its name.
_THEME_HINTS = [
    ("space", ["space", "astro", "cosmo", "physics", "science", "planet", "star"]),
    ("vedic", ["myth", "veda", "india", "spirit", "yoga", "relig", "self"]),
    ("chinese", ["philos", "history", "tao", "strategy", "classic"]),
    ("fantasy", ["fantasy", "poetry", "poem", "magic", "sci-fi", "fairy"]),
]


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60] or "genre"


def suggest_theme(title: str) -> str:
    t = title.lower()
    for theme, words in _THEME_HINTS:
        if any(w in t for w in words):
            return theme
    return "japanese"


def mood_for(index: int) -> str:
    return MOODS[index % len(MOODS)]


# Stories can be spoiled; essays, science and scripture can't. Used to decide how much of an unread or
# half-read book the librarian may search across the library.
_STORY_WORDS = ["fiction", "novel", "story", "stories", "fantasy", "myster", "thriller", "romance", "drama",
                "horror", "sci-fi", "adventure", "fairy", "manga", "comic", "crime"]


def is_narrative(genre_id: str, title: str = "") -> bool:
    t = f"{genre_id} {title}".lower()
    return any(w in t for w in _STORY_WORDS) and "non-fiction" not in t and "nonfiction" not in t
