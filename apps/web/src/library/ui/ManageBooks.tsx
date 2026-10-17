"use client";

import { useEffect, useState } from "react";
import { api, type ApiBook } from "@/lib/api";

/**
 * Every room and the books in it, with a way to remove them. Removing asks once more
 * ("Sure?") because it deletes the book file, its highlights and its place on the map.
 */
export function ManageBooks({ genres, books, onChanged }: {
  genres: { id: string; title: string }[];
  books: ApiBook[];
  onChanged: () => void;
}) {
  // The button waiting for a second click, e.g. "book:<id>", "all:<room>" or "room:<room>".
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirm) return;
    const id = window.setTimeout(() => setConfirm(null), 3500);
    return () => window.clearTimeout(id);
  }, [confirm]);

  const run = async (key: string, work: () => Promise<unknown>) => {
    if (confirm !== key) {
      setConfirm(key);
      return;
    }
    setConfirm(null);
    setBusy(key);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const label = (key: string, idle: string) => (busy === key ? "Removing…" : confirm === key ? "Sure?" : idle);

  if (!books.length && genres.length <= 1) {
    return <p className="manage-empty">Your library is empty. Switch to <b>Add books</b> to bring in your first one.</p>;
  }

  return (
    <div className="manage">
      {error && <p className="manage-error">{error}</p>}
      {genres.map((g) => {
        const list = books.filter((b) => b.genre_id === g.id);
        return (
          <section key={g.id} className="manage-room">
            <header>
              <h3>{g.title} <small>{list.length ? `${list.length} book${list.length > 1 ? "s" : ""}` : "empty"}</small></h3>
              {list.length > 0 ? (
                <button className={`manage-remove ${confirm === `all:${g.id}` ? "sure" : ""}`} disabled={!!busy}
                  onClick={() => run(`all:${g.id}`, async () => { for (const b of list) await api.deleteBook(b.id); })}>
                  {label(`all:${g.id}`, "Remove all")}
                </button>
              ) : genres.length > 1 ? (
                <button className={`manage-remove ${confirm === `room:${g.id}` ? "sure" : ""}`} disabled={!!busy}
                  onClick={() => run(`room:${g.id}`, () => api.deleteGenre(g.id))} title="Take this empty room out of the library">
                  {label(`room:${g.id}`, "Remove room")}
                </button>
              ) : null}
            </header>
            {list.length > 0 && (
              <ul>
                {list.map((b) => (
                  <li key={b.id}>
                    <span className="manage-title">
                      {b.title}
                      <small>{b.status === "processing" ? "Reading the book…" : b.status === "failed" ? "Couldn't read this file" : b.author}</small>
                    </span>
                    <button className={`manage-remove ${confirm === `book:${b.id}` ? "sure" : ""}`} disabled={!!busy}
                      onClick={() => run(`book:${b.id}`, () => api.deleteBook(b.id))} aria-label={`Remove ${b.title}`}>
                      {label(`book:${b.id}`, "Remove")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
