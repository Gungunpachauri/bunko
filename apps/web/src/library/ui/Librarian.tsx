import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ask, type ApiCitation } from "@/lib/api";
import type { Theme } from "@/library/themes/types";
import { AskPanel, type AskSend } from "@/components/AskPanel";
import { ThemedSelect } from "@/components/ThemedSelect";

/** The librarian answers questions across the whole library (or one room), citing the books it quotes. */
export function Librarian({ theme, genres }: { theme: Theme; genres: { id: string; title: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [genre, setGenre] = useState<string>("");
  const { Art, name, greeting } = theme.librarian;

  const send = useCallback<AskSend>((question, history, h, signal) =>
    ask.library({ question, history, genre_id: genre || null }, h, signal), [genre]);
  const onCite = useCallback((c: ApiCitation) => router.push(`/read/${c.book_id}?passage=${c.chunk_id}`), [router]);

  return (
    <div className="librarian">
      <AnimatePresence>
        {open && (
          <motion.div
            className="librarian-chat"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <AskPanel
              className="ask-library"
              kicker={name}
              title="Ask the library"
              glyph={<span className="ask-art"><Art /></span>}
              send={send}
              onCite={onCite}
              onClose={() => setOpen(false)}
              placeholder="Ask across your books…"
              note={<>{greeting} I only use pages you&apos;ve reached, plus the opening of books you haven&apos;t started.</>}
              controls={
                <ThemedSelect label="Which books to search" value={genre} onChange={setGenre}
                  options={[{ value: "", label: "All rooms" }, ...genres.map((g) => ({ value: g.id, label: g.title }))]} />
              }
              suggestions={["Which books talk about habits and discipline?", "What do my books say about facing death?", "Compare the ideas of duty in my books"]}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <button className="librarian-btn" onClick={() => setOpen((o) => !o)} aria-label={`Ask ${name}`} title={`Ask ${name}`}>
        <Art />
      </button>
    </div>
  );
}

