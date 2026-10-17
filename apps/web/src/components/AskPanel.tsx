"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type ApiCitation, type ApiRagStatus, type AskHandlers, type AskMeta, type AskTurn } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: ApiCitation[];
  cited?: number[];
  leak?: string[];
  error?: string;
  meta?: AskMeta;
  pending?: boolean;
}

export type AskSend = (question: string, history: AskTurn[], h: AskHandlers, signal: AbortSignal) => Promise<void>;

interface Props {
  kicker: string;
  title: string;
  glyph: ReactNode;
  send: AskSend;
  onCite: (c: ApiCitation) => void;
  onClose: () => void;
  suggestions: string[];
  /** A line under the header, e.g. how far the reader is (spoiler-safe). */
  note?: ReactNode;
  /** Extra controls under the header (scope picker, spoiler switch). */
  controls?: ReactNode;
  placeholder?: string;
  className?: string;
  /** Text to put in the question box (e.g. "Explain: …" from a highlight); a new id replaces the draft. */
  seed?: { id: number; text: string };
  /** The panel speaks first (the discussion partner): it sends an empty question as soon as it opens. */
  opensConversation?: boolean;
  /** Hide without unmounting, so the conversation survives switching tabs. */
  hidden?: boolean;
}

const PROVIDER_NAMES: Record<string, string> = { gemini: "Gemini", groq: "Groq", openrouter: "OpenRouter", openai: "Local model", anthropic: "Claude" };

/** A conversation about books: streamed answers, citation chips that jump to the passage, spoiler notices. */
export function AskPanel({ kicker, title, glyph, send, onCite, onClose, suggestions, note, controls, placeholder, className = "", seed, opensConversation, hidden }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(seed?.text ?? "");
  const [seenSeed, setSeenSeed] = useState(seed?.id);
  if (seed && seed.id !== seenSeed) {
    setSeenSeed(seed.id);
    setDraft(seed.text);
  }
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ApiRagStatus | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    input.current?.focus();
    let alive = true;
    const poll = () => api.ragStatus().then((s) => alive && setStatus(s)).catch(() => {});
    poll();
    const id = window.setInterval(poll, 5000);
    return () => { alive = false; window.clearInterval(id); abort.current?.abort(); };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const update = (fn: (m: Message) => Message) =>
    setMessages((all) => (all.length ? [...all.slice(0, -1), fn(all[all.length - 1])] : all));

  const submit = async (q: string, opening = false) => {
    const question = q.trim();
    if ((!question && !opening) || busy) return;
    const history: AskTurn[] = messages.filter((m) => !m.error && !m.pending).map((m) => ({ role: m.role, content: m.content }));
    setMessages((all) => [...all, ...(opening ? [] : [{ role: "user" as const, content: question }]), { role: "assistant", content: "", pending: true }]);
    setDraft("");
    setBusy(true);
    abort.current = new AbortController();
    await send(question, history, {
      onMeta: (meta) => update((m) => ({ ...m, meta })),
      onCitations: (citations) => update((m) => ({ ...m, citations })),
      onDelta: (t) => update((m) => ({ ...m, content: m.content + t })),
      onLeak: (leak) => update((m) => ({ ...m, leak })),
      onDone: (cited) => update((m) => ({ ...m, cited })),
      onError: (error) => update((m) => ({ ...m, error })),
    }, abort.current.signal);
    update((m) => ({ ...m, pending: false }));
    setBusy(false);
  };

  // The discussion partner opens with a question about what you just read.
  const opened = useRef(false);
  useEffect(() => {
    if (!opensConversation || opened.current) return;
    // Marked inside the timer, so React's dev-mode double effect (run, clean up, run) still opens exactly once.
    const id = window.setTimeout(() => {
      if (opened.current) return;
      opened.current = true;
      submit("", true);
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opensConversation]);

  const indexingNow = status ? Object.values(status.indexing)[0] : undefined;
  const provider = status?.provider ?? "none";

  return (
    <aside className={`ask ${className}`} aria-label={title} hidden={hidden}>
      <div className="ask-head">
        <span className="ask-glyph">{glyph}</span>
        <div>
          <div className="ask-kicker">{kicker}</div>
          <div className="ask-title">{title}</div>
        </div>
        <button className="ask-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      {(note || controls) && (
        <div className="ask-sub">
          {note && <div className="ask-note">{note}</div>}
          {controls}
        </div>
      )}

      <div className="ask-scroll" ref={scroller}>
        {messages.length === 0 && !opensConversation && (
          <div className="ask-empty">
            <p>Ask anything about what you&apos;ve read. Every answer points to the exact passage.</p>
            <div className="ask-suggest">
              {suggestions.map((s) => <button key={s} onClick={() => submit(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => m.role === "user"
          ? <div key={i} className="ask-q">{m.content}</div>
          : <Answer key={i} m={m} onCite={onCite} />)}
      </div>

      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); submit(draft); }}>
        <textarea
          ref={input}
          rows={1}
          value={draft}
          placeholder={placeholder ?? "Ask about this book…"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation(); // keep arrow keys and space from turning pages
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(draft); }
            if (e.key === "Escape") onClose();
          }}
        />
        {busy
          ? <button type="button" className="ask-send" onClick={() => abort.current?.abort()} aria-label="Stop">■</button>
          : <button type="submit" className="ask-send" disabled={!draft.trim()} aria-label="Ask">↑</button>}
      </form>
      <div className="ask-status">
        {!status
          ? <>Only from your books.</>
          : indexingNow
          ? <>Indexing books for search… {Math.round((indexingNow.done / Math.max(1, indexingNow.total)) * 100)}% of the current book ({status!.indexed}/{status!.books} done)</>
          : provider === "none"
            ? <>Passages only. Add a free Gemini key in <code>apps/api/.env</code> for written answers.</>
            : <>Answers by {PROVIDER_NAMES[provider] ?? provider}{status?.model ? ` · ${status.model}` : ""}{status?.backup ? `, ${PROVIDER_NAMES[status.backup] ?? status.backup} as backup` : ""}. Only from your books.</>}
      </div>
    </aside>
  );
}

function Answer({ m, onCite }: { m: Message; onCite: (c: ApiCitation) => void }) {
  const byN = new Map((m.citations ?? []).map((c) => [c.n, c]));
  const cited = (m.cited?.length ? m.cited : [...new Set([...m.content.matchAll(/\[(\d{1,2})\]/g)].map((x) => Number(x[1])))])
    .map((n) => byN.get(n)).filter((c): c is ApiCitation => !!c);
  const thinking = m.pending && !m.content && !m.error;

  return (
    <div className="ask-a">
      {thinking && <div className="ask-thinking"><i /><i /><i /> {m.citations ? "Writing…" : "Searching your pages…"}</div>}
      {m.content && <Prose text={m.content} hide={m.leak ?? []} byN={byN} onCite={onCite} />}
      {m.leak?.length ? <div className="ask-leak">Hid a name that only appears later in the book. No spoilers.</div> : null}
      {m.error && <div className="ask-error">{m.error}</div>}
      {!m.pending && cited.length > 0 && (
        <div className="ask-sources">
          {cited.map((c) => (
            <button key={c.n} className="ask-source" onClick={() => onCite(c)}>
              <b>{c.n}</b>
              <span>
                <em>{c.book_title}</em>
                <small>{shortChapter(c.chapter_title)} · p. {c.page}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Light markdown: paragraphs, "- " lists, **bold**, *italic*, and [n] citation chips. */
export function Prose({ text, hide, byN, onCite }: { text: string; hide: string[]; byN: Map<number, ApiCitation>; onCite: (c: ApiCitation) => void }) {
  const inline = (s: string, key: string): ReactNode[] =>
    s.split(/(\[\d{1,2}\]|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
      const k = `${key}-${i}`;
      const cite = /^\[(\d{1,2})\]$/.exec(part);
      if (cite) {
        const c = byN.get(Number(cite[1]));
        return c
          ? <button key={k} className="ask-chip" onClick={() => onCite(c)} title={`${c.book_title} · p. ${c.page}`}>{cite[1]}</button>
          : null;
      }
      if (/^\*\*.+\*\*$/.test(part)) return <strong key={k}>{redact(part.slice(2, -2), hide)}</strong>;
      if (/^\*.+\*$/.test(part)) return <em key={k}>{redact(part.slice(1, -1), hide)}</em>;
      return <span key={k}>{redact(part, hide)}</span>;
    });

  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="ask-prose">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${i}-${j}`)}</li>)}</ul>;
        }
        return <p key={i}>{inline(b, String(i))}</p>;
      })}
    </div>
  );
}

function redact(s: string, hide: string[]): ReactNode {
  if (!hide.length) return s;
  const re = new RegExp(`\\b(${hide.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");
  return s.split(re).map((part, i) => (hide.includes(part) ? <span key={i} className="ask-redact" title="Appears later in the book">▒▒▒▒</span> : part));
}

/** Gutenberg chapter labels can be long ("Piling up the fire. CHAPTER XI."); keep the chapter number when there is one. */
export function shortChapter(label: string): string {
  const m = /\b(chapter|book|part|letter)\s+([ivxlcdm]+|\d+)\b/i.exec(label);
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2].toUpperCase()}`;
  return label.length > 40 ? `${label.slice(0, 38)}…` : label || "Passage";
}
