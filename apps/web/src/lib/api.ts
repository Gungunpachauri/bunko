// Thin client for the FastAPI backend.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010").replace(/\/$/, "");

export interface ApiGenre {
  id: string;
  title: string;
  mood: string;
  theme: string;
  created_at: string;
}

export interface ApiPosition {
  location: string;
  progress: number;
  chapter_href: string | null;
  updated_at: string;
}

export interface ApiBook {
  id: string;
  title: string;
  author: string;
  genre_id: string;
  format: "epub" | "pdf";
  status: "processing" | "ready" | "failed";
  error: string | null;
  description: string;
  has_cover: boolean;
  total_pages: number;
  total_chars?: number;
  created_at: string;
  position: ApiPosition | null;
  highlights?: string[];
  highlight_count?: number;
}

export type HighlightColor = "amber" | "rose" | "sage" | "sky";

export interface ApiHighlight {
  id: string;
  book_id: string;
  book_title: string;
  location: string;
  chapter_href: string | null;
  chapter_title: string;
  text: string;
  note: string;
  color: HighlightColor;
  char_start: number | null;
  created_at: string;
  due: string;
  reviews: number;
  score?: number | null;
}

export interface ApiReviewCard {
  highlight: ApiHighlight;
  prompt: string;
  answer: string | null;
  intervals: Record<string, string>;
}

export interface ApiReviewStats {
  total: number;
  due: number;
  next_in: string | null;
  due_this_week: number;
}

export interface ApiPassage {
  book_id: string;
  book_title: string;
  chapter_title: string;
  location: string;
  page: number;
  snippet: string;
}

export interface ApiSearch {
  books: ApiBook[];
  passages: ApiPassage[];
  genres: ApiGenre[];
}

export interface ApiTocEntry {
  chapter_index: number;
  title: string;
  location: string;
  page: number;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      // not JSON
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  library: () => req<{ genres: ApiGenre[]; books: ApiBook[] }>("/api/library"),
  book: (id: string) => req<ApiBook>(`/api/books/${id}`),
  toc: (id: string) => req<ApiTocEntry[]>(`/api/books/${id}/toc`),
  continueReading: () => req<ApiBook | null>("/api/continue"),
  search: (q: string, signal?: AbortSignal) => req<ApiSearch>(`/api/search?q=${encodeURIComponent(q)}`, { signal }),
  savePosition: (id: string, body: { location: string; progress: number; chapter_href?: string | null; chapter_fraction?: number | null }) =>
    req<ApiPosition>(`/api/books/${id}/position`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  deleteBook: (id: string) => req<void>(`/api/books/${id}`, { method: "DELETE" }),
  upload: (file: File, target: { genreId?: string; newGenre?: string; theme?: string }) => {
    const form = new FormData();
    form.append("file", file);
    if (target.newGenre) form.append("new_genre", target.newGenre);
    else if (target.genreId) form.append("genre_id", target.genreId);
    if (target.theme) form.append("theme", target.theme);
    return req<ApiBook>("/api/books", { method: "POST", body: form });
  },
  highlights: (bookId: string) => req<ApiHighlight[]>(`/api/books/${bookId}/highlights`),
  addHighlight: (bookId: string, body: { location: string; text: string; chapter_href?: string | null; chapter_title?: string | null; note?: string; color?: HighlightColor }) =>
    req<ApiHighlight>(`/api/books/${bookId}/highlights`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  updateHighlight: (id: string, body: { note?: string; color?: HighlightColor }) =>
    req<ApiHighlight>(`/api/highlights/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  deleteHighlight: (id: string) => req<void>(`/api/highlights/${id}`, { method: "DELETE" }),
  searchHighlights: (q: string, signal?: AbortSignal) => req<ApiHighlight[]>(`/api/highlights?q=${encodeURIComponent(q)}&limit=30`, { signal }),
  reviewQueue: () => req<ApiReviewCard[]>("/api/review/queue?limit=30"),
  reviewStats: () => req<ApiReviewStats>("/api/review/stats"),
  rate: (id: string, rating: 1 | 2 | 3 | 4) =>
    req<ApiHighlight>(`/api/review/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating }) }),
  connections: (bookId: string) => req<ApiConnections>(`/api/books/${bookId}/connections`),
  buildConnections: (bookId: string) => req<ApiGraphStatus>(`/api/books/${bookId}/connections/build`, { method: "POST" }),
  concept: (id: number) => req<ApiConcept>(`/api/concepts/${id}`),
  compare: (id: number) => req<{ text: string; passages: ApiCitation[]; cached: boolean }>(`/api/concepts/${id}/compare`, { method: "POST" }),
  readingMap: () => req<ApiReadingMap>("/api/graph/map"),
  buildAllConnections: () => req<{ queued: number }>("/api/graph/build-all", { method: "POST" }),
  passage: (chunkId: number) => req<ApiCitation>(`/api/passages/${chunkId}`),
  ragStatus: () => req<ApiRagStatus>("/api/rag/status"),
  fileUrl: (id: string) => `${API_URL}/api/books/${id}/file`,
  coverUrl: (id: string) => `${API_URL}/api/books/${id}/cover`,
};

// ── Ask (Phase 3): answers stream over Server-Sent Events ─────────────────

export interface ApiCitation {
  n: number;
  chunk_id: number;
  book_id: string;
  book_title: string;
  author: string;
  chapter_title: string;
  location: string;
  page: number;
  char_start: number;
  text: string;
}

export interface ApiRagStatus {
  provider: string;
  model: string | null;
  backup?: string | null;
  books: number;
  indexed: number;
  indexing: Record<string, { done: number; total: number }>;
}

export interface AskMeta {
  provider: string;
  model: string | null;
  scope: { title: string; book_id?: string; genre_id?: string | null };
  reached: Record<string, number>;
  spoilers: boolean;
}

export interface AskHandlers {
  onMeta?: (m: AskMeta) => void;
  onCitations?: (c: ApiCitation[]) => void;
  onDelta?: (text: string) => void;
  onLeak?: (names: string[]) => void;
  onDone?: (cited: number[]) => void;
  onError?: (message: string) => void;
}

export type AskTurn = { role: "user" | "assistant"; content: string };
export type ReaderSpot = { chapter_href?: string | null; chapter_fraction?: number | null; page?: number | null; progress?: number | null };

/** POST a question and dispatch the streamed events. Resolves when the answer is complete. */
export async function askStream(path: string, body: object, h: AskHandlers, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name !== "AbortError") h.onError?.("Couldn't reach the library server.");
    return;
  }
  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch { /* not JSON */ }
    h.onError?.(String(detail));
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    let chunk: ReadableStreamReadResult<string>;
    try {
      chunk = await reader.read();
    } catch {
      return; // aborted
    }
    if (chunk.done) break;
    buf += chunk.value;
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || data === undefined) continue;
      const payload = JSON.parse(data);
      if (event === "meta") h.onMeta?.(payload);
      else if (event === "citations") h.onCitations?.(payload);
      else if (event === "delta") h.onDelta?.(payload.text);
      else if (event === "leak") h.onLeak?.(payload.names);
      else if (event === "done") h.onDone?.(payload.cited);
      else if (event === "error") h.onError?.(payload.message);
    }
  }
}

export const ask = {
  book: (id: string, body: { question: string; history: AskTurn[]; position?: ReaderSpot | null; spoilers?: boolean }, h: AskHandlers, signal?: AbortSignal) =>
    askStream(`/api/books/${id}/ask`, body, h, signal),
  library: (body: { question: string; history: AskTurn[]; genre_id?: string | null }, h: AskHandlers, signal?: AbortSignal) =>
    askStream("/api/ask", body, h, signal),
  /** The discussion partner. No message → it opens the conversation about what you just read. */
  discuss: (id: string, body: { message: string | null; history: AskTurn[]; position?: ReaderSpot | null }, h: AskHandlers, signal?: AbortSignal) =>
    askStream(`/api/books/${id}/discuss`, body, h, signal),
};

// ── Connections (knowledge graph) ─────────────────────────────────────────

export interface ApiGraphStatus { status: "none" | "queued" | "building" | "ready" | "failed"; done: number; total: number; error: string | null; concepts: number }

export interface ApiConceptSummary {
  id: number;
  name: string;
  kind: "idea" | "person" | "place";
  description: string;
  count: number;
  also_in: { book_id: string; title: string; count: number }[];
}

export interface ApiConnections {
  status: ApiGraphStatus;
  ideas: ApiConceptSummary[];
  people: ApiConceptSummary[];
  links: { source: string; target: string; label: string }[];
  spoiler_safe: boolean;
}

export interface ApiConcept {
  id: number;
  name: string;
  kind: string;
  description: string;
  books: { book_id: string; title: string; author: string; mentions: { note: string; chunk_id: number | null; chapter_title: string; page: number | null; snippet: string }[] }[];
}

export interface ApiReadingMap {
  books: { id: string; title: string; author: string; genre_id: string; genre: string; mood: string; progress: number; graph: ApiGraphStatus["status"] }[];
  ideas: { id: number; name: string; description: string; count: number; books: { book_id: string; count: number }[] }[];
  links: { source: number; target: number; label: string }[];
}
