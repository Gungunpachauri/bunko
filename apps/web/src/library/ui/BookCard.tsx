import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { Book, RoomId } from "@/library/data/books";
import type { Theme } from "@/library/themes/types";
import { coverDataUrl } from "@/library/three/textures";

export function BookCard({ book, theme, onClose, onRead, onConnections, roomTitle, skin = false }: {
  book: Book; theme: Theme; onClose: () => void; roomTitle?: string;
  /** Open the book; with a panel, the reader opens with Ask or Discuss showing. */
  onRead: (panel?: "ask" | "discuss") => void;
  /** Show the ideas and people in this book, and the other books that share them. */
  onConnections: () => void;
  /** Style the card in `theme` itself rather than inheriting the page's theme (Mixed mode). */
  skin?: boolean;
}) {
  // The book's real cover when it has one; otherwise a cover drawn in the theme's style.
  const drawn = useMemo(() => coverDataUrl(book, theme), [book, theme]);
  const [cover, setCover] = useState(book.coverUrl ?? drawn);
  const pct = Math.round(book.progress * 100);
  const page = Math.round(book.progress * book.pages);

  return (
    <motion.aside
      className="card"
      data-theme={skin ? theme.id : undefined}
      style={skin ? ({ ...theme.vars, "--font-display": theme.fonts.display, "--font-body": theme.fonts.body } as React.CSSProperties) : undefined}
      role="dialog"
      aria-label={book.title}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
    >
      <button className="card-close" onClick={onClose} aria-label="Close">×</button>
      <div className="card-head">
        {/* Covers come from our own API (or are drawn in the browser), so next/image adds nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="card-cover" src={cover} alt="" width={96} height={137} onError={() => setCover(drawn)} />
        <div>
          <div className="card-room">{roomTitle ?? theme.rooms[book.room as RoomId]?.title}</div>
          <h2 className="card-title">{book.title}</h2>
          <div className="card-author">{book.author}</div>
        </div>
      </div>
      <p className="card-desc">{book.description}</p>

      <div className="card-progress">
        <div className="card-progress-row">
          <span>{pct === 0 ? "Not started" : pct >= 100 ? "Finished" : `Page ${page} of ${book.pages}`}</span>
          <span>{pct}%</span>
        </div>
        <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="card-highlights">
        <div className="card-label">Highlights</div>
        {book.highlights.length ? (
          <ul>
            {book.highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
        ) : (
          <p className="card-empty">No highlights yet.</p>
        )}
      </div>

      <div className="card-actions">
        <button className="btn primary" onClick={() => onRead()}>Read</button>
        <button className="btn" onClick={() => onRead("ask")} title="Ask a question about this book">Ask</button>
        <button className="btn" onClick={() => onRead("discuss")} title="Talk about what you've read with your reading partner">Discuss</button>
      </div>
      <button className="btn card-connections" onClick={onConnections}>
        <span aria-hidden>✦</span> Connections <small>ideas this book shares with your others</small>
      </button>
    </motion.aside>
  );
}
