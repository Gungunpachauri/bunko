"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ask, type ApiCitation } from "@/lib/api";
import type { Theme } from "@/library/themes/types";
import { AskPanel, type AskSend } from "@/components/AskPanel";

export type BookChatMode = "ask" | "discuss";

/**
 * Ask about a book, or talk it over with the reading partner, without leaving the 3D library.
 * It takes the book card's place. It uses the saved reading position, so answers stay spoiler-safe.
 * Clicking a quote opens the book at that passage.
 */
export function BookChat({ book, theme, mode, onMode, onBack }: {
  book: { id: string; title: string; progress: number };
  theme: Theme;
  mode: BookChatMode;
  onMode: (m: BookChatMode) => void;
  onBack: () => void;
}) {
  const router = useRouter();
  // The reading partner starts talking when first opened; keep both conversations while switching tabs.
  const [discussStarted, setDiscussStarted] = useState(mode === "discuss");
  if (mode === "discuss" && !discussStarted) setDiscussStarted(true);

  const sendAsk = useCallback<AskSend>((question, history, h, signal) =>
    ask.book(book.id, { question, history }, h, signal), [book.id]);
  const sendDiscuss = useCallback<AskSend>((message, history, h, signal) =>
    ask.discuss(book.id, { message: message || null, history }, h, signal), [book.id]);
  const openCitation = useCallback((c: ApiCitation) => router.push(`/read/${c.book_id}?passage=${c.chunk_id}`), [router]);

  const pct = Math.round(book.progress * 100);
  const tabs = (
    <div className="ask-modes" role="tablist">
      <button role="tab" aria-selected={mode === "ask"} className={mode === "ask" ? "on" : ""} onClick={() => onMode("ask")}>Ask</button>
      <button role="tab" aria-selected={mode === "discuss"} className={mode === "discuss" ? "on" : ""} onClick={() => onMode("discuss")}>Discuss</button>
    </div>
  );
  const where = pct > 0 ? `up to where you are (${pct}%)` : "up to where you are (you haven't started yet, so just the opening)";

  return (
    <motion.div
      className="book-chat"
      data-theme={theme.id}
      style={{ ...theme.vars, "--font-display": theme.fonts.display, "--font-body": theme.fonts.body } as React.CSSProperties}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, transition: { duration: 0.18 } }}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button className="book-chat-back" onClick={onBack}>← Back to the book</button>
      <AskPanel
        hidden={mode !== "ask"}
        className="ask-library"
        kicker="Ask about"
        title={book.title}
        glyph="✦"
        send={sendAsk}
        onCite={openCitation}
        onClose={onBack}
        note={<>Answers use the book {where}. Nothing after it.</>}
        controls={tabs}
        suggestions={["What is this book about so far?", "What are the main ideas so far?", "Explain the most important passage I've read"]}
      />
      {discussStarted && (
        <AskPanel
          hidden={mode !== "discuss"}
          opensConversation
          className="ask-library"
          kicker="Talk about"
          title={book.title}
          glyph="✦"
          send={sendDiscuss}
          onCite={openCitation}
          onClose={onBack}
          placeholder="Say what you think…"
          note={<>Your reading partner asks questions and pushes back, using the book {where}.</>}
          controls={tabs}
          suggestions={[]}
        />
      )}
    </motion.div>
  );
}
