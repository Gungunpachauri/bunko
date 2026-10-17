// The real library, loaded from the API and shaped for the 3D world.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ThemeId } from "@/library/themes/types";
import { api, type ApiBook, type ApiGenre } from "@/lib/api";
import type { Book } from "@/library/data/books";
import type { Genre } from "@/library/data/genres";

export interface Library {
  genres: Genre[];
  books: Book[];
}

const PALETTE = ["#7a3b3b", "#28465e", "#3f4a35", "#6b4f7a", "#3e6f8a", "#5a3a52", "#7a5a2e", "#8c2f2f", "#9a6a2a", "#3d6b62", "#5b4a3a", "#2f5a4a", "#a0522d", "#40506b", "#5e3d5e"];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Whole months between two dates (the timeline counts months since the library began). */
function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function spineTitle(title: string) {
  const short = title.split(/[:;(]/)[0].trim();
  return short.length > 28 ? `${short.slice(0, 26)}…` : short;
}

function shape(data: { genres: ApiGenre[]; books: ApiBook[] }, risen: Set<string>): Library & { today: number } {
  const dates = [...data.genres.map((g) => g.created_at), ...data.books.map((b) => b.created_at)].map((d) => new Date(d));
  const start = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date();
  const monthOf = (iso: string) => monthsBetween(start, new Date(iso)) + 1;
  let today = Math.max(1, monthsBetween(start, new Date()) + 1);

  const genres: Genre[] = data.genres.map((g) => ({
    id: g.id, title: g.title, mood: g.mood, theme: g.theme as ThemeId,
    // A genre that appeared during this visit rises one "month" after today, so the world can animate it.
    month: risen.has(g.id) ? today + 1 : monthOf(g.created_at),
  }));
  if (genres.some((g) => g.month > today)) today += 1;

  const books: Book[] = data.books
    .filter((b) => b.status === "ready")
    .map((b) => {
      const h = hash(b.id + b.title);
      const progress = b.position?.progress ?? 0;
      const g = genres.find((x) => x.id === b.genre_id);
      return {
        id: b.id,
        title: b.title,
        spineTitle: spineTitle(b.title),
        author: b.author,
        room: b.genre_id,
        row: 0,
        color: PALETTE[h % PALETTE.length],
        w: 50 + Math.min(28, Math.round((b.total_pages || 200) / 28)),
        h: 150 + (h % 37),
        progress,
        pages: b.total_pages || 1,
        description: b.description || "No description yet.",
        highlights: b.highlights ?? [],
        addedMonth: Math.max(monthOf(b.created_at), g?.month ?? 1),
        finishedMonth: progress >= 0.995 && b.position ? monthOf(b.position.updated_at) : undefined,
        format: b.format,
        coverUrl: b.has_cover ? api.coverUrl(b.id) : undefined,
      };
    });
  return { genres, books, today };
}

/** "Today" on the timeline. */
export function todayOf(lib: Library & { today?: number }) {
  return lib.today ?? Math.max(1, ...lib.genres.map((g) => g.month));
}

export function useLibrary() {
  const [raw, setRaw] = useState<{ genres: ApiGenre[]; books: ApiBook[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);
  const [risen, setRisen] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const data = await api.library();
      if (known.current) {
        const fresh = data.genres.filter((g) => !known.current!.has(g.id)).map((g) => g.id);
        if (fresh.length) setRisen((s) => new Set([...s, ...fresh]));
      }
      known.current = new Set(data.genres.map((g) => g.id));
      setRaw(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    // Pick up books added elsewhere (another tab, the seed script) when you come back, and now and then.
    const onFocus = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const id = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(id);
    };
  }, [refresh]);

  // Keep polling while any book is still being processed.
  const processing = raw?.books.some((b) => b.status === "processing") ?? false;
  useEffect(() => {
    if (!processing) return;
    const id = window.setInterval(refresh, 2000);
    return () => window.clearInterval(id);
  }, [processing, refresh]);

  const library = useMemo(() => (raw ? shape(raw, risen) : null), [raw, risen]);
  return { library, raw, error, refresh, processing };
}
