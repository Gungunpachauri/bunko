import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Theme } from "../themes/types";

export function Librarian({ theme }: { theme: Theme }) {
  const [open, setOpen] = useState(false);
  const { Art, name, greeting } = theme.librarian;
  return (
    <div className="librarian">
      <AnimatePresence>
        {open && (
          <motion.div
            className="bubble"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
          >
            <strong>{name}</strong>
            <p>{greeting}</p>
            <small>The librarian becomes the AI in Phase 4.</small>
          </motion.div>
        )}
      </AnimatePresence>
      <button className="librarian-btn" onClick={() => setOpen((o) => !o)} aria-label={`Talk to ${name}`}>
        <Art />
      </button>
    </div>
  );
}
