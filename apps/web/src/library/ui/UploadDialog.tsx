"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { THEMES } from "@/library/themes";
import { ThemedSelect } from "@/components/ThemedSelect";

type Status = "waiting" | "uploading" | "processing" | "ready" | "failed";
interface Job {
  file: File;
  status: Status;
  bookId?: string;
  title?: string;
  error?: string;
}

const NEW = "__new__";

/** Add EPUB/PDF books to a room. A new genre name creates a new room, which rises from the water. */
export function UploadDialog({ open, onClose, genres, onChanged }: {
  open: boolean;
  onClose: () => void;
  genres: { id: string; title: string }[];
  onChanged: () => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [genre, setGenre] = useState<string>(genres[0]?.id ?? NEW);
  const [newGenre, setNewGenre] = useState("");
  const [theme, setTheme] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = jobs.some((j) => j.status === "uploading");

  useEffect(() => {
    if (open && !genres.some((g) => g.id === genre) && genre !== NEW) setGenre(genres[0]?.id ?? NEW);
  }, [open, genres, genre]);

  // Watch processing books until they're ready.
  useEffect(() => {
    if (!jobs.some((j) => j.status === "processing")) return;
    const id = window.setInterval(async () => {
      const updated = await Promise.all(jobs.map(async (j) => {
        if (j.status !== "processing" || !j.bookId) return j;
        try {
          const b = await api.book(j.bookId);
          if (b.status === "ready") return { ...j, status: "ready" as const, title: b.title };
          if (b.status === "failed") return { ...j, status: "failed" as const, error: b.error ?? "Could not read this file" };
        } catch {
          // try again next tick
        }
        return j;
      }));
      if (updated.some((j, i) => j.status !== jobs[i].status)) {
        setJobs(updated);
        onChanged();
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [jobs, onChanged]);

  const add = (files: FileList | null) => {
    if (!files) return;
    const ok = [...files].filter((f) => /\.(epub|pdf)$/i.test(f.name));
    setJobs((j) => [...j, ...ok.map((file) => ({ file, status: "waiting" as const }))]);
  };

  const start = async () => {
    const target = genre === NEW ? { newGenre: newGenre.trim(), theme: theme || undefined } : { genreId: genre };
    if (genre === NEW && !newGenre.trim()) return;
    for (let i = 0; i < jobs.length; i++) {
      if (jobs[i].status !== "waiting") continue;
      setJobs((js) => js.map((j, k) => (k === i ? { ...j, status: "uploading" } : j)));
      try {
        const b = await api.upload(jobs[i].file, target);
        setJobs((js) => js.map((j, k) => (k === i ? { ...j, status: "processing", bookId: b.id } : j)));
        onChanged();
      } catch (e) {
        setJobs((js) => js.map((j, k) => (k === i ? { ...j, status: "failed", error: e instanceof Error ? e.message : String(e) } : j)));
      }
    }
  };

  const close = () => {
    if (busy) return;
    setJobs((js) => js.filter((j) => j.status === "processing"));
    onClose();
  };

  const statusText: Record<Status, string> = {
    waiting: "Ready to upload", uploading: "Uploading…", processing: "Reading the book…", ready: "On the shelf", failed: "Failed",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}>
          <motion.div className="upload" role="dialog" aria-label="Add books" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="upload-head">
              <h2>Add books</h2>
              <button className="card-close" onClick={close} aria-label="Close">×</button>
            </div>
            <p className="upload-note">EPUB or PDF, from books you own or the public domain (Project Gutenberg works well).</p>

            <div
              className={`dropzone ${drag ? "on" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
              onClick={() => input.current?.click()}
            >
              <input ref={input} type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
              <strong>Drop files here</strong>
              <span>or click to choose</span>
            </div>

            <div className="upload-field">
              <span>Room</span>
              <ThemedSelect variant="field" label="Room" value={genre} onChange={setGenre}
                options={[...genres.map((g) => ({ value: g.id, label: g.title })), { value: NEW, label: "＋ New genre (a new room rises)" }]} />
            </div>
            {genre === NEW && (
              <div className="upload-row">
                <label className="upload-field">
                  <span>Genre name</span>
                  <input value={newGenre} onChange={(e) => setNewGenre(e.target.value)} placeholder="e.g. Space & Astronomy" />
                </label>
                <div className="upload-field">
                  <span>Style in Mixed mode</span>
                  <ThemedSelect variant="field" label="Style in Mixed mode" value={theme} onChange={setTheme}
                    options={[{ value: "", label: "Pick for me" }, ...THEMES.map((t) => ({ value: t.id, label: t.name }))]} />
                </div>
              </div>
            )}

            {jobs.length > 0 && (
              <ul className="upload-jobs">
                {jobs.map((j, i) => (
                  <li key={i} className={`job ${j.status}`}>
                    <span className="job-name">{j.title ?? j.file.name}</span>
                    <span className="job-status" title={j.error}>{j.status === "failed" ? j.error ?? statusText.failed : statusText[j.status]}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="card-actions">
              <button className="btn" onClick={close} disabled={busy}>Done</button>
              <button className="btn primary" onClick={start} disabled={busy || !jobs.some((j) => j.status === "waiting") || (genre === NEW && !newGenre.trim())}>
                Upload {jobs.filter((j) => j.status === "waiting").length || ""}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
