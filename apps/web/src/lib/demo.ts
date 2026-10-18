// The showcase build (NEXT_PUBLIC_STATIC_DEMO=1) runs with no server: everything comes from files exported by
// `python -m app.export_demo` into public/demo, and answers are replayed from questions asked of the real AI.

import type { ApiAccess, ApiBook, ApiGenre, ApiReviewStats, ApiSearch, AskHandlers } from "@/lib/api";

export const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";

export const DEMO_NOTE = "This showcase replays answers recorded from the real AI.";
const OFF = "This is the showcase version of Bunko, so this is turned off. Run Bunko yourself (see GitHub) to use everything.";

type Library = { genres: ApiGenre[]; books: ApiBook[] };
type Events = [string, unknown][];
type Recorded = { ask: Record<string, Events>; discuss: Events | null; q?: Record<string, string> };

const files = new Map<string, Promise<unknown>>();

function file<T>(path: string): Promise<T> {
  let p = files.get(path);
  if (!p) {
    p = fetch(`/demo/${path}`).then((r) => {
      if (!r.ok) throw new Error("Not part of the showcase demo");
      return r.json();
    });
    p.catch(() => files.delete(path)); // a failed fetch can be tried again
    files.set(path, p);
  }
  return p as Promise<T>;
}

const library = () => file<Library>("api/library.json");
const bookFile = (id: string) => file<{ toc: unknown; connections: unknown }>(`books/${id}.json`);

/** One entry from a bundle (all passages, or all ideas, live in a single file). */
async function entry(bundle: string, id: string) {
  const all = await file<Record<string, unknown>>(`api/${bundle}.json`);
  if (!(id in all)) throw new Error("Not part of the showcase demo");
  return all[id];
}

/** The website normalises questions the same way the exporter does, so a suggested question finds its answer. */
export const norm = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const demoUrls = {
  file: (id: string) => `/demo/files/${id}`,
  cover: (id: string) => `/demo/covers/${id}`,
};

/** Answer an API request from the exported files. */
export async function demoRequest(path: string, init?: RequestInit): Promise<unknown> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = new URL(path, "http://demo");
  const p = url.pathname;
  let m: RegExpExecArray | null;

  if (method !== "GET") throw new Error(OFF);
  if (p === "/api/access") return { visitor: true, demo: true, asks_left: null, ask_limit: null } satisfies ApiAccess;
  if (p === "/api/library") return library();
  if ((m = /^\/api\/books\/([^/]+)$/.exec(p))) {
    const book = (await library()).books.find((b) => b.id === m![1]);
    if (!book) throw new Error("Book not found");
    return book;
  }
  if ((m = /^\/api\/books\/([^/]+)\/toc$/.exec(p))) return (await bookFile(m[1])).toc;
  if ((m = /^\/api\/books\/([^/]+)\/connections$/.exec(p))) return (await bookFile(m[1])).connections;
  if ((m = /^\/api\/concepts\/(\d+)$/.exec(p))) return entry("concepts", m[1]);
  if ((m = /^\/api\/passages\/(\d+)$/.exec(p))) return entry("passages", m[1]);
  if (p === "/api/graph/map") return file("api/graph-map.json");
  if (p === "/api/rag/status") return file("api/rag-status.json");
  if (/^\/api\/books\/[^/]+\/highlights$/.test(p) || p === "/api/highlights" || p === "/api/review/queue") return [];
  if (p === "/api/review/stats") return { total: 0, due: 0, next_in: null, due_this_week: 0 } satisfies ApiReviewStats;
  if (p === "/api/continue") {
    const read = (await library()).books.filter((b) => b.position);
    read.sort((a, b) => (b.position!.updated_at).localeCompare(a.position!.updated_at));
    return read[0] ?? null;
  }
  if (p === "/api/search") {
    // Titles, authors and rooms by their words (passage search needs the server).
    const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
    const lib = await library();
    return {
      books: lib.books.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(q)).slice(0, 8),
      genres: lib.genres.filter((g) => g.title.toLowerCase().includes(q)).slice(0, 4),
      passages: [],
    } satisfies ApiSearch;
  }
  throw new Error("Not part of the showcase demo");
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  const id = window.setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { window.clearTimeout(id); resolve(); }, { once: true });
});

/** Replay a recorded answer as if it were streaming from the AI; questions that weren't recorded get a note. */
export async function demoAsk(path: string, body: { question?: string; message?: string | null }, h: AskHandlers, signal?: AbortSignal) {
  const book = /^\/api\/books\/([^/]+)\/(ask|discuss)$/.exec(path);
  const discuss = book?.[2] === "discuss";
  let rec: Recorded | null = null;
  try {
    rec = await file<Recorded>(`asks/${book ? book[1] : "library"}.json`);
  } catch {
    // nothing recorded for this book
  }
  const events = discuss
    ? (body.message ? null : rec?.discuss ?? null)
    : rec?.ask[norm(body.question ?? "")] ?? null;

  if (!events) {
    const offered = Object.values(rec?.q ?? {});
    const text = discuss
      ? `${DEMO_NOTE} The conversation stops here in the demo: run Bunko yourself to keep talking with your reading partner.`
      : offered.length
        ? `${DEMO_NOTE} Questions you can ask here:\n\n${offered.map((q) => `- ${q}`).join("\n")}\n\nRun Bunko yourself to ask anything.`
        : `${DEMO_NOTE} This book has no recorded answers yet. Run Bunko yourself to ask anything.`;
    await sleep(500, signal);
    h.onCitations?.([]);
    h.onDelta?.(text);
    h.onDone?.([]);
    return;
  }

  await sleep(700, signal); // the search step
  for (const [event, data] of events) {
    if (signal?.aborted) return;
    const d = data as Record<string, unknown>;
    if (event === "meta") h.onMeta?.(data as never);
    else if (event === "citations") h.onCitations?.(data as never);
    else if (event === "leak") h.onLeak?.(d.names as string[]);
    else if (event === "done") h.onDone?.(d.cited as number[]);
    else if (event === "delta") {
      // A few words at a time, like a model writing.
      const words = String(d.text).split(/(?<=\s)/);
      for (let i = 0; i < words.length; i += 3) {
        if (signal?.aborted) return;
        h.onDelta?.(words.slice(i, i + 3).join(""));
        await sleep(28, signal);
      }
    }
  }
}
