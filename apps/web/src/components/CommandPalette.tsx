"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type ApiSearch } from "@/lib/api";

export interface PaletteBook {
  id: string;
  title: string;
  author: string;
  progress: number;
}

type Item =
  | { kind: "book"; id: string; title: string; sub: string }
  | { kind: "passage"; id: string; title: string; sub: string; loc: string }
  | { kind: "room"; id: string; title: string; sub: string }
  | { kind: "action"; id: string; title: string; sub: string };

/**
 * Ctrl+K: jump straight to any book, room or passage without walking.
 * With an empty query it offers "Continue reading" and recently opened books.
 */
export function CommandPalette({ open, onClose, recent, rooms, actions, onOpenBook, onGoToRoom, onAction }: {
  open: boolean;
  onClose: () => void;
  recent: PaletteBook[];
  rooms?: { id: string; title: string }[];
  actions?: { id: string; title: string; sub: string }[];
  onOpenBook: (id: string, loc?: string) => void;
  onGoToRoom?: (id: string) => void;
  onAction?: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ApiSearch | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // Start fresh each time the palette opens (adjusting state while rendering, as React recommends).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQ("");
      setRes(null);
      setActive(0);
    }
  }
  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    // With an empty box the list shows recent books and actions, so old results are simply not used.
    if (!term) return;
    const ctl = new AbortController();
    const id = window.setTimeout(() => {
      api.search(term, ctl.signal).then(setRes).catch(() => {});
    }, 160);
    return () => {
      window.clearTimeout(id);
      ctl.abort();
    };
  }, [q]);

  const items: Item[] = useMemo(() => {
    if (!q.trim()) {
      return [
        ...(actions ?? []).map((a) => ({ kind: "action" as const, ...a })),
        ...recent.slice(0, 6).map((b) => ({
          kind: "book" as const, id: b.id, title: b.title,
          sub: `${b.author} · ${b.progress > 0 ? `${Math.round(b.progress * 100)}% read` : "not started"}`,
        })),
      ];
    }
    if (!res) return [];
    const localRooms = (rooms ?? []).filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()));
    return [
      ...localRooms.map((r) => ({ kind: "room" as const, id: r.id, title: r.title, sub: "Walk to this room" })),
      ...res.books.map((b) => ({ kind: "book" as const, id: b.id, title: b.title, sub: b.author })),
      ...res.passages.map((p) => ({ kind: "passage" as const, id: p.book_id, title: p.snippet, sub: `${p.book_title} · ${p.chapter_title}`, loc: p.location })),
    ];
  }, [q, res, recent, rooms, actions]);

  // A new list of results selects its first item.
  const [shownCount, setShownCount] = useState(items.length);
  if (items.length !== shownCount) {
    setShownCount(items.length);
    setActive(0);
  }

  const choose = (it: Item | undefined) => {
    if (!it) return;
    onClose();
    if (it.kind === "book") onOpenBook(it.id);
    else if (it.kind === "passage") onOpenBook(it.id, it.loc);
    else if (it.kind === "room") onGoToRoom?.(it.id);
    else onAction?.(it.id);
  };

  const onKey = (e: React.KeyboardEvent) => {
    // Stop here, or the page underneath also reacts (the reader treats Escape as "back to the library").
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[active]); }
  };

  const label = { book: "Book", passage: "Passage", room: "Room", action: "" } as const;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            className="palette"
            role="dialog"
            aria-label="Search the library"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              ref={input}
              className="palette-input"
              placeholder="Search books, authors, rooms and passages…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
            />
            <ul className="palette-list">
              {items.map((it, i) => (
                <li key={`${it.kind}-${it.id}-${i}`}>
                  <button className={`palette-item ${i === active ? "on" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => choose(it)}>
                    {label[it.kind] && <span className={`palette-kind kind-${it.kind}`}>{label[it.kind]}</span>}
                    <span className="palette-text">
                      <span className={`palette-title ${it.kind === "passage" ? "passage" : ""}`}>{it.title}</span>
                      <span className="palette-sub">{it.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
              {q.trim() && res && !items.length && <li className="palette-empty">Nothing matches “{q.trim()}”.</li>}
              {!q.trim() && !items.length && <li className="palette-empty">Your library is empty. Add a book to get started.</li>}
            </ul>
            <div className="palette-foot"><span>↑↓ to move</span><span>↵ to open</span><span>Esc to close</span></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
