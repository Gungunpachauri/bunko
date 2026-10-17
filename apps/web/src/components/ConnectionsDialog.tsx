"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, type ApiCitation, type ApiConcept, type ApiConceptSummary, type ApiConnections } from "@/lib/api";
import { Prose } from "@/components/AskPanel";

/** A book's ideas and people, the other books that share each idea, and where they agree or differ. */
export function ConnectionsDialog({ book, onClose }: { book: { id: string; title: string } | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {book && (
        <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={onClose} onWheel={(e) => e.stopPropagation()}>
          <motion.div className="connections" role="dialog" aria-label={`Connections: ${book.title}`} initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} onMouseDown={(e) => e.stopPropagation()}>
            <Connections key={book.id} bookId={book.id} title={book.title} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Connections({ bookId, title, onClose }: { bookId: string; title: string; onClose: () => void }) {
  const [data, setData] = useState<ApiConnections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApiConceptSummary | null>(null);
  const [tick, setTick] = useState(0);
  const building = data?.status.status === "queued" || data?.status.status === "building";

  useEffect(() => {
    let alive = true;
    api.connections(bookId).then((d) => alive && setData(d)).catch((e) => alive && setError(String(e.message ?? e)));
    return () => { alive = false; };
  }, [bookId, tick]);

  // While the AI reads the book, check back every few seconds.
  useEffect(() => {
    if (!building) return;
    const id = window.setTimeout(() => setTick((t) => t + 1), 3000);
    return () => window.clearTimeout(id);
  }, [building, data]);

  const start = async () => {
    try {
      await api.buildConnections(bookId);
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const st = data?.status;
  const empty = data && data.ideas.length === 0 && data.people.length === 0;

  return (
    <>
      <div className="conn-head">
        <div>
          <div className="conn-kicker">Connections</div>
          <h2>{title}</h2>
        </div>
        <button className="card-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {error && <p className="conn-msg error">{error}</p>}
      {!data && !error && <p className="conn-msg">Looking for connections…</p>}

      {data && (st?.status === "none" || st?.status === "failed") && (
        <div className="conn-start">
          <p>
            Find the main ideas and people in this book, and which of your other books talk about the same ideas.
            The AI reads it in short steps in the background (a few minutes). You can close this and come back.
          </p>
          {st?.status === "failed" && <p className="conn-msg error">Last try stopped: {st.error}</p>}
          <button className="enter-btn" onClick={start}>{st?.status === "failed" ? "Try again" : "Find connections"}</button>
        </div>
      )}

      {building && (
        <div className="conn-progress">
          <span>Reading the book for ideas… {st!.done}/{st!.total || "?"}</span>
          <div className="bar"><div className="bar-fill" style={{ width: `${st!.total ? (st!.done / st!.total) * 100 : 5}%` }} /></div>
        </div>
      )}

      {data && !empty && (
        <div className="conn-body">
          <div className="conn-list">
            {data.spoiler_safe && <p className="conn-note">Only from the pages you&apos;ve read, so nothing is spoiled.</p>}
            <Group title="Ideas" items={data.ideas} selected={selected} onPick={setSelected} />
            <Group title="People & places" items={data.people} selected={selected} onPick={setSelected} />
            {data.links.length > 0 && (
              <>
                <div className="conn-label">How they connect</div>
                <ul className="conn-links">
                  {data.links.slice(0, 12).map((l, i) => <li key={i}><b>{l.source}</b> {l.label} <b>{l.target}</b></li>)}
                </ul>
              </>
            )}
          </div>
          <div className="conn-detail">
            {selected ? <Detail key={selected.id} summary={selected} bookId={bookId} onClose={onClose} />
              : <p className="conn-msg">Pick an idea. Ideas marked ↔ also appear in your other books.</p>}
          </div>
        </div>
      )}
      {data && empty && st?.status === "ready" && <p className="conn-msg">No ideas found yet in the pages you&apos;ve read. Read on and check back.</p>}
    </>
  );
}

function Group({ title, items, selected, onPick }: { title: string; items: ApiConceptSummary[]; selected: ApiConceptSummary | null; onPick: (c: ApiConceptSummary) => void }) {
  if (!items.length) return null;
  return (
    <>
      <div className="conn-label">{title}</div>
      <div className="conn-chips">
        {items.map((c) => (
          <button key={c.id} className={`conn-chip ${selected?.id === c.id ? "on" : ""} ${c.also_in.length ? "shared" : ""}`} onClick={() => onPick(c)}
            title={c.also_in.length ? `Also in ${c.also_in.map((b) => b.title).join(", ")}` : c.description}>
            {c.name}{c.also_in.length > 0 && <i>↔ {c.also_in.length}</i>}
          </button>
        ))}
      </div>
    </>
  );
}

export function Detail({ summary, bookId, onClose }: { summary: Pick<ApiConceptSummary, "id" | "name" | "description">; bookId?: string; onClose: () => void }) {
  const router = useRouter();
  const [concept, setConcept] = useState<ApiConcept | null>(null);
  const [compare, setCompare] = useState<{ text: string; passages: ApiCitation[] } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.concept(summary.id).then((c) => alive && setConcept(c)).catch(() => {});
    return () => { alive = false; };
  }, [summary.id]);

  const open = (book: string, chunk: number | null) => {
    onClose();
    router.push(`/read/${book}${chunk ? `?passage=${chunk}` : ""}`);
  };
  const byN = useMemo(() => new Map((compare?.passages ?? []).map((p) => [p.n, p])), [compare]);
  const shared = (concept?.books.length ?? 0) > 1;

  const runCompare = async () => {
    setComparing(true);
    setError(null);
    try {
      setCompare(await api.compare(summary.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setComparing(false);
    }
  };

  // This book first, then the others.
  const books = concept ? [...concept.books].sort((a, b) => (a.book_id === bookId ? -1 : b.book_id === bookId ? 1 : 0)) : [];

  return (
    <div>
      <h3 className="conn-name">{summary.name}</h3>
      {summary.description && <p className="conn-desc">{summary.description}</p>}
      {shared && !compare && (
        <button className="enter-btn conn-compare" onClick={runCompare} disabled={comparing}>
          {comparing ? "Comparing the books…" : `Where do these ${concept!.books.length} books agree?`}
        </button>
      )}
      {error && <p className="conn-msg error">{error}</p>}
      {compare && (
        <div className="conn-answer">
          <Prose text={compare.text} hide={[]} byN={byN} onCite={(c) => open(c.book_id, c.chunk_id)} />
        </div>
      )}
      {books.map((b) => (
        <div key={b.book_id} className="conn-book">
          <div className="conn-book-title">{b.book_id === bookId ? "In this book" : b.title}</div>
          <ul>
            {b.mentions.slice(0, 4).map((m, i) => (
              <li key={i}>
                <button onClick={() => open(b.book_id, m.chunk_id)} title="Open the book at this passage">
                  {m.note || m.snippet}
                  {m.page ? <small> · p. {m.page}</small> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
