"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { ApiHighlight, HighlightColor } from "@/lib/api";
import { HIGHLIGHT_INK } from "@/reader/EpubView";
import { cleanChapter } from "@/reader/skins";

const COLORS: HighlightColor[] = ["amber", "rose", "sage", "sky"];

/** Keep a floating box inside the window. */
function place(x: number, y: number, w: number, h: number, below = false) {
  const left = Math.min(Math.max(12, x - w / 2), window.innerWidth - w - 12);
  const top = below || y - h - 14 < 60 ? Math.min(y + 30, window.innerHeight - h - 12) : y - h - 14;
  return { left, top, width: w };
}

/** Appears over selected text: pick a colour to highlight, add a note, or ask about it. */
export function SelectionBar({ x, y, onHighlight, onAsk }: {
  x: number; y: number;
  onHighlight: (color: HighlightColor, withNote: boolean) => void;
  onAsk: () => void;
}) {
  return (
    <motion.div className="hl-bar" style={place(x, y, 268, 44)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      onMouseDown={(e) => e.preventDefault()}>
      {COLORS.map((c) => (
        <button key={c} className="hl-dot" style={{ background: HIGHLIGHT_INK[c] }} onClick={() => onHighlight(c, false)} aria-label={`Highlight ${c}`} title="Highlight" />
      ))}
      <span className="hl-sep" />
      <button className="hl-act" onClick={() => onHighlight("amber", true)}>✎ Note</button>
      <button className="hl-act" onClick={onAsk}>Ask</button>
    </motion.div>
  );
}

/** Click a highlight: write or edit its note, change its colour, ask about it, or remove it. */
export function HighlightPopover({ highlight, x, y, autoFocus, onSave, onDelete, onAsk, onClose }: {
  highlight: ApiHighlight; x: number; y: number; autoFocus?: boolean;
  onSave: (patch: { note?: string; color?: HighlightColor }) => void;
  onDelete: () => void;
  onAsk: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState(highlight.note);
  const save = () => { if (note.trim() !== highlight.note) onSave({ note: note.trim() }); onClose(); };
  return (
    <motion.div className="hl-pop" style={place(x, y, 320, 230, true)} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
      <blockquote style={{ borderColor: HIGHLIGHT_INK[highlight.color] }}>{highlight.text}</blockquote>
      <textarea
        autoFocus={autoFocus}
        value={note}
        placeholder="Why does this matter to you?"
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
          if (e.key === "Escape") onClose();
        }}
      />
      <div className="hl-pop-row">
        {COLORS.map((c) => (
          <button key={c} className={`hl-dot ${highlight.color === c ? "on" : ""}`} style={{ background: HIGHLIGHT_INK[c] }} onClick={() => onSave({ color: c })} aria-label={c} />
        ))}
        <span className="hl-grow" />
        <button className="hl-act" onClick={onAsk}>Ask</button>
        <button className="hl-act danger" onClick={onDelete}>Remove</button>
        <button className="hl-act primary" onClick={save}>Done</button>
      </div>
    </motion.div>
  );
}

/** Every highlight in this book, in reading order. */
export function HighlightsDrawer({ highlights, glyph, title, onOpen, onClose }: {
  highlights: ApiHighlight[]; glyph: string; title: string;
  onOpen: (h: ApiHighlight) => void; onClose: () => void;
}) {
  return (
    <motion.aside className="drawer" initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="drawer-head">
        <span className="drawer-glyph">{glyph}</span>
        <div><div className="drawer-kicker">Highlights · {highlights.length}</div><div className="drawer-title">{title}</div></div>
        <button className="room-icon" onClick={onClose} aria-label="Close">×</button>
      </div>
      {highlights.length === 0 ? (
        <p className="hl-empty">Select any words on the page to highlight them. Highlights come back for review so they stay with you.</p>
      ) : (
        <ol className="hl-list">
          {highlights.map((h) => (
            <li key={h.id}>
              <button onClick={() => onOpen(h)}>
                <span className="hl-chap">{cleanChapter(h.chapter_title).title || "Highlight"}</span>
                <span className="hl-text" style={{ borderColor: HIGHLIGHT_INK[h.color] }}>{h.text}</span>
                {h.note && <span className="hl-note">{h.note}</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </motion.aside>
  );
}
