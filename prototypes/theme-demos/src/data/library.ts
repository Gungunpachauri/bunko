// The user's library: genres (rooms) and books. Saved in this browser so it
// keeps growing between visits. In Phase 2 this comes from the backend instead.
import { useCallback, useEffect, useMemo, useState } from "react";
import { BOOKS, type Book } from "./books";
import { DEFAULT_GENRES, GENRE_POOL, poolBooks, type Genre } from "./genres";

export interface Library {
  genres: Genre[];
  books: Book[];
}

interface Saved {
  added: { id: string; month: number }[];
}

const KEY = "walkable-library:v1";
/** Month each original book joined, and the two finished ones. */
const ADDED: Record<string, number> = {
  pride: 1, moby: 1, frank: 1, genji: 2, jane: 2, shakuntala: 3, monte: 4, alice: 5, redchamber: 6, siddhartha: 9,
  meditations: 3, tao: 3, gita: 4, artofwar: 5, dhammapada: 5, enchiridion: 6, analects: 7, thinketh: 7, walden: 8, selfreliance: 10,
};
const FINISHED: Record<string, number> = { frank: 4, artofwar: 7 };

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    // storage unavailable: start fresh
  }
  return { added: [] };
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable: the library just won't persist
  }
}

function build(saved: Saved): Library {
  const genres = [...DEFAULT_GENRES];
  const books: Book[] = BOOKS.map((b) => ({ ...b, addedMonth: ADDED[b.id] ?? 1, finishedMonth: FINISHED[b.id] }));
  for (const a of saved.added) {
    const pool = GENRE_POOL.find((p) => p.id === a.id);
    if (!pool || genres.some((g) => g.id === a.id)) continue;
    genres.push({ id: pool.id, title: pool.title, month: a.month, mood: pool.mood, theme: pool.theme });
    books.push(...poolBooks(pool.id, a.month));
  }
  return { genres, books };
}

/** "Today" on the timeline: month 12 for the starting library, later as genres are added. */
export function todayOf(lib: Library) {
  return Math.max(12, ...lib.genres.map((g) => g.month));
}

export function useLibrary() {
  const [saved, setSaved] = useState<Saved>(load);
  useEffect(() => save(saved), [saved]);
  const library = useMemo(() => build(saved), [saved]);

  const nextGenre = GENRE_POOL.find((p) => !library.genres.some((g) => g.id === p.id)) ?? null;

  /** Adds the next placeholder genre one month after "today". Returns its id. */
  const addGenre = useCallback(() => {
    if (!nextGenre) return null;
    const month = todayOf(library) + 1;
    setSaved((s) => ({ added: [...s.added, { id: nextGenre.id, month }] }));
    return nextGenre.id;
  }, [library, nextGenre]);

  const reset = useCallback(() => setSaved({ added: [] }), []);

  return { library, addGenre, reset, nextGenre, canReset: saved.added.length > 0 };
}
