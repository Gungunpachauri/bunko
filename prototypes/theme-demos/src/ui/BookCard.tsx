import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { Book, RoomId } from "../data/books";
import type { Theme } from "../themes/types";
import { coverDataUrl } from "../three/textures";

const SOON: Record<string, string> = {
  Read: "The reader (EPUB/PDF with position tracking) arrives in Phase 2.",
  Ask: "Spoiler-safe answers with page citations arrive in Phase 3.",
  Connections: "The cross-book knowledge graph arrives in Phase 4.",
};

export function BookCard({ book, theme, onClose, roomTitle, skin = false }: {
  book: Book; theme: Theme; onClose: () => void; roomTitle?: string;
  /** Style the card in `theme` itself rather than inheriting the page's theme (Mixed mode). */
  skin?: boolean;
}) {
  const cover = useMemo(() => coverDataUrl(book, theme), [book, theme]);
  const [note, setNote] = useState<string | null>(null);
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
        <img className="card-cover" src={cover} alt="" width={96} height={137} />
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
        {(["Read", "Ask", "Connections"] as const).map((a, i) => (
          <button key={a} className={i === 0 ? "btn primary" : "btn"} onClick={() => setNote(SOON[a])}>
            {a}
          </button>
        ))}
      </div>
      {note && <p className="card-note">{note}</p>}
    </motion.aside>
  );
}
