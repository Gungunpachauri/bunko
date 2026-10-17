// "Library over time": every genre and book has the month it arrived, so the
// world can be shown at any point in the library's history. The last month is "today".
import type { Book } from "./books";
import { todayOf, type Library } from "./library";

const NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthName(m: number) {
  return m <= 0 ? "·" : NAMES[(m - 1) % 12];
}

export const addedMonth = (b: Book) => b.addedMonth ?? 1;
export const finishedMonth = (b: Book) => b.finishedMonth ?? null;

/** Reading progress of a book at a (fractional) month, or null if it isn't on the shelf yet. */
export function progressAt(b: Book, month: number, today: number): number | null {
  const a = addedMonth(b);
  if (month < a) return null;
  const f = finishedMonth(b);
  if (f !== null) return Math.min(1, (month - a) / Math.max(0.5, f - a));
  return b.progress * Math.min(1, (month - a) / Math.max(0.5, today - a));
}

export function statsAt(lib: Library, month: number) {
  const today = todayOf(lib);
  const on = lib.books.filter((b) => progressAt(b, month, today) !== null);
  const prog = on.map((b) => progressAt(b, month, today)!);
  return {
    books: on.length,
    finished: prog.filter((p) => p >= 1).length,
    reading: prog.filter((p) => p > 0 && p < 1).length,
    pct: lib.books.length ? Math.round((prog.reduce((a, p) => a + p, 0) / lib.books.length) * 100) : 0,
    rooms: lib.genres.filter((g) => g.month <= month).length,
  };
}

/** The headline for a month: the most notable thing that happened in it. */
export function milestone(lib: Library, month: number): string {
  const m = Math.floor(month + 1e-6);
  const today = todayOf(lib);
  if (m <= 0) return "Still water. The library hasn't been founded yet.";
  const finished = lib.books.filter((b) => finishedMonth(b) === m);
  if (finished.length) return `Finished ${finished.map((b) => b.title).join(" and ")}. Its spine turns gold.`;
  const genre = lib.genres.find((g) => g.month === m);
  if (genre) {
    const i = lib.genres.indexOf(genre);
    const n = lib.books.filter((b) => b.room === genre.id && (b.addedMonth ?? 1) <= m).length;
    if (i === 0) return `${genre.title} rises from the water with its first ${n} books.`;
    return `A new genre: ${genre.title} rises from the water with ${n} books, and a bridge reaches it from ${lib.genres[i - 1].title}.`;
  }
  if (m === today) {
    const s = statsAt(lib, today);
    return `Today: ${s.books} books across ${s.rooms} rooms, ${s.finished} finished, ${s.pct}% of everything read.`;
  }
  const added = lib.books.filter((b) => addedMonth(b) === m);
  if (added.length) return `New on the shelves: ${added.map((b) => b.title).join(", ")}.`;
  return "A quiet month of reading. The trees keep growing.";
}
