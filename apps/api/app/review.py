"""Spaced repetition for highlights (FSRS), and the prompt shown on the front of each card."""

import re
from datetime import UTC, datetime, timedelta

from fsrs import Card, Rating, Scheduler

from .models import Highlight

# 90% target retention. No same-day learning steps: a highlight has already waited a day before its first review,
# so "Good" means days, not minutes. A card you forget later comes back once more in the same session (10 min).
scheduler = Scheduler(desired_retention=0.9, learning_steps=(), relearning_steps=(timedelta(minutes=10),))
RATINGS = {1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy}
# New highlights first come up the next day: you just read them.
FIRST_REVIEW_AFTER = timedelta(days=1)

STOPWORDS = set("""
a about above after again against all also am an and any are as at be because been before being below between both
but by can could did do does doing down during each else ever every few for from further had has have having he her
here hers herself him himself his how however i if in into is it its itself just least less let like made make many
may me might more most much must my myself never no nor not now of off often on once one only or other ought our ours
ourselves out over own perhaps rather said same say says shall she should since so some such than that the their
theirs them themselves then there therefore these they this those though through thus to too under until up upon us
very was we were what whatever when where whether which while who whom whose why will with within without would yet
you your yours yourself yourselves thou thee thy thine hath doth unto shalt wilt
""".split())


def new_card(now: datetime | None = None) -> tuple[str, datetime]:
    now = now or datetime.now(UTC)
    card = Card()
    card.due = now + FIRST_REVIEW_AFTER
    return card.to_json(), card.due


def review(h: Highlight, rating: int, now: datetime | None = None) -> None:
    now = now or datetime.now(UTC)
    card = Card.from_json(h.card) if h.card else Card()
    card, _log = scheduler.review_card(card, RATINGS[rating], review_datetime=now)
    h.card = card.to_json()
    h.due = card.due
    h.reviews += 1


def preview_intervals(h: Highlight, now: datetime | None = None) -> dict[int, str]:
    """What each rating would do ("10m", "3d"), shown on the buttons like a flashcard app."""
    now = now or datetime.now(UTC)
    out = {}
    for n, rating in RATINGS.items():
        card = Card.from_json(h.card) if h.card else Card()
        card, _ = scheduler.review_card(card, rating, review_datetime=now)
        out[n] = human_interval(card.due - now)
    return out


def human_interval(d: timedelta) -> str:
    s = max(0, d.total_seconds())
    if s < 3600:
        return f"{max(1, round(s / 60))}m"
    if s < 86400:
        return f"{round(s / 3600)}h"
    if s < 86400 * 45:
        return f"{round(s / 86400)}d"
    if s < 86400 * 365:
        return f"{round(s / 86400 / 30)}mo"
    return f"{s / 86400 / 365:.1f}y"


WORD = re.compile(r"[A-Za-z][A-Za-z'’-]{3,}")


def cloze(text: str) -> tuple[str, str | None]:
    """Blank out the most telling word: a name or the longest uncommon word. Returns (prompt, answer)."""
    words = list(WORD.finditer(text))
    if len(words) < 6:
        return text, None
    best, best_score = None, 0.0
    for i, m in enumerate(words):
        w = m.group(0).strip("'’-")
        if w.lower() in STOPWORDS or len(w) < 5:
            continue
        # Names mid-sentence are memorable; otherwise prefer long, specific words.
        sentence_start = m.start() == 0 or text[:m.start()].rstrip()[-1:] in ".!?\"“"
        score = len(w) + (8 if w[0].isupper() and not sentence_start else 0) + (1 if i > 2 else 0)
        if score > best_score:
            best, best_score = m, score
    if best is None:
        return text, None
    answer = best.group(0).strip("'’-")
    start = best.start() + best.group(0).index(answer)
    return text[:start] + "_____" + text[start + len(answer):], answer
