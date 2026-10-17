"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, type ApiHighlight, type ApiReviewCard, type ApiReviewStats } from "@/lib/api";
import { sound } from "@/lib/sound";

const RATINGS = [
  { n: 1, label: "Again", hint: "Forgot" },
  { n: 2, label: "Hard", hint: "Barely" },
  { n: 3, label: "Good", hint: "Remembered" },
  { n: 4, label: "Easy", hint: "Instantly" },
] as const;

/** Review highlights with spaced repetition, and search everything you've highlighted. */
export function ReviewDialog({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<"review" | "search">("review");
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={onClose} onWheel={(e) => e.stopPropagation()}>
          <motion.div className="review" role="dialog" aria-label="Review highlights" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="review-tabs">
              <button className={tab === "review" ? "on" : ""} onClick={() => setTab("review")}>Review</button>
              <button className={tab === "search" ? "on" : ""} onClick={() => setTab("search")}>My highlights</button>
              <span className="hl-grow" />
              <button className="card-close" onClick={onClose} aria-label="Close">×</button>
            </div>
            {tab === "review" ? <Review onChanged={onChanged} onSearch={() => setTab("search")} /> : <Search onClose={onClose} />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Review({ onChanged, onSearch }: { onChanged: () => void; onSearch: () => void }) {
  const [queue, setQueue] = useState<ApiReviewCard[] | null>(null);
  const [stats, setStats] = useState<ApiReviewStats | null>(null);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.reviewQueue(), api.reviewStats()])
      .then(([q, s]) => { if (alive) { setQueue(q); setStats(s); } })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, []);

  const card = queue?.[0];
  const rate = useCallback(async (n: 1 | 2 | 3 | 4) => {
    if (!card) return;
    setShown(false);
    setQueue((q) => q?.slice(1) ?? null);
    setDone((d) => d + 1);
    try {
      const h = await api.rate(card.highlight.id, n);
      if (n >= 3) sound.play("chime");
      // "Again" keeps the card in this session (it's due again in minutes).
      if (new Date(h.due).getTime() - Date.now() < 15 * 60_000) {
        setQueue((q) => [...(q ?? []), { ...card, highlight: h }]);
      }
      if (queue && queue.length <= 1) api.reviewStats().then(setStats).catch(() => {});
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [card, queue, onChanged]);

  // Space shows the answer; 1–4 rate it. Caught before the library's own keys (which switch themes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!card || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        setShown(true);
      } else if (shown && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        rate(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [card, shown, rate]);

  if (error) return <p className="review-empty">{error}</p>;
  if (!queue) return <p className="review-empty">Gathering your highlights…</p>;
  if (!card) {
    return (
      <div className="review-done">
        <div className="review-check">✓</div>
        <h2>{done ? `${done} reviewed. All caught up.` : stats?.total ? "Nothing due right now." : "No highlights yet."}</h2>
        <p>
          {stats?.total
            ? <>You have {stats.total} highlight{stats.total === 1 ? "" : "s"}.{stats.next_in ? ` The next one comes back in ${stats.next_in}.` : ""} Highlights return just before you&apos;d forget them.</>
            : <>Select words while reading to highlight them. Each highlight comes back here the next day, then at growing intervals.</>}
        </p>
        {stats?.total ? <button className="enter-btn" onClick={onSearch}>Browse my highlights</button> : null}
      </div>
    );
  }

  const h = card.highlight;
  return (
    <div className="review-card">
      <div className="review-meta">
        <span>{h.book_title}</span>
        {h.chapter_title && <span>{h.chapter_title}</span>}
        <span className="review-count">{queue.length} left</span>
      </div>
      <p className="review-text">
        {shown ? <Reveal text={h.text} answer={card.answer} /> : <Blank prompt={card.prompt} />}
      </p>
      {shown && h.note && <p className="review-note">✎ {h.note}</p>}
      {!shown ? (
        <button className="review-show" onClick={() => setShown(true)}>
          {card.answer ? "Show the missing word" : "I remember it"} <kbd>Space</kbd>
        </button>
      ) : (
        <div className="review-rate">
          {RATINGS.map((r) => (
            <button key={r.n} className={`rate-${r.n}`} onClick={() => rate(r.n)}>
              <b>{r.label}</b>
              <small>{card.intervals[String(r.n)]} · {r.n}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Blank({ prompt }: { prompt: string }) {
  const [a, b] = prompt.split("_____");
  return b === undefined ? <>{prompt}</> : <>{a}<span className="review-blank">?</span>{b}</>;
}

function Reveal({ text, answer }: { text: string; answer: string | null }) {
  if (!answer) return <>{text}</>;
  const i = text.indexOf(answer);
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="review-answer">{answer}</mark>{text.slice(i + answer.length)}</>;
}

function Search({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ApiHighlight[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const id = window.setTimeout(() => {
      api.searchHighlights(q, ctrl.signal).then(setResults).catch(() => {});
    }, q ? 300 : 0);
    return () => { window.clearTimeout(id); ctrl.abort(); };
  }, [q]);

  return (
    <div className="review-search">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="What did I find important about…"
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      />
      <ul>
        {results?.length === 0 && <li className="review-empty">{q ? "Nothing close to that in your highlights." : "No highlights yet."}</li>}
        {results?.map((h) => (
          <li key={h.id}>
            <button onClick={() => { onClose(); router.push(`/read/${h.book_id}?loc=${encodeURIComponent(h.location)}`); }}>
              <span className="review-src">{h.book_title}{h.chapter_title ? ` · ${h.chapter_title}` : ""}</span>
              <span className="review-quote">{h.text}</span>
              {h.note && <span className="review-note">✎ {h.note}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
