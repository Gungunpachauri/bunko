"use client";

import { Canvas } from "@react-three/fiber";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ask, type ApiBook, type ApiCitation, type ApiGenre, type ApiHighlight, type HighlightColor, type ReaderSpot } from "@/lib/api";
import { initialChoice } from "@/library/LibraryApp";
import { getTheme } from "@/library/themes";
import { Particles } from "@/library/three/Particles";
import { coverDataUrl, loadThemeFonts } from "@/library/three/textures";
import { AskPanel, type AskSend } from "@/components/AskPanel";
import { sound, type AmbienceId } from "@/lib/sound";
import { useAccess } from "@/lib/access";
import { CommandPalette } from "@/components/CommandPalette";
import { SoundToggle } from "@/components/SoundToggle";
import { EpubView } from "@/reader/EpubView";
import { HighlightPopover, HighlightsDrawer, SelectionBar } from "@/reader/Highlights";
import { PdfView } from "@/reader/PdfView";
import { cleanChapter, FONTS, READING, type FontChoice, type Light } from "@/reader/skins";
import type { ReaderHandle, ReaderLocation, ReaderSelection, TocItem } from "@/reader/types";

const PREFS_KEY = "bunko:reader";
const OLD_PREFS_KEY = "walkable-library:reader"; // the name before Bunko; still read so settings carry over
interface Prefs { light: Light | null; font: FontChoice; size: number; layout: "auto" | "one" | "two" }
const DEFAULT_PREFS: Prefs = { light: null, font: "garamond", size: 1, layout: "auto" };

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? localStorage.getItem(OLD_PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Light follows the clock until you pick one. */
function clockLight(): Light {
  const h = new Date().getHours();
  return h >= 7 && h < 17 ? "day" : h >= 17 && h < 20 ? "dusk" : "night";
}

const base = (href: string) => href.split("#")[0].split("/").pop() ?? href;

type Place = { location: string; progress: number };
const placeKey = (bookId: string) => `bunko:place:${bookId}`;

/** A visitor's place in a book, kept in this browser. */
function readPlace(bookId: string): Place | null {
  try {
    const raw = localStorage.getItem(placeKey(bookId));
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

function writePlace(bookId: string, place: Place) {
  try {
    localStorage.setItem(placeKey(bookId), JSON.stringify(place));
  } catch {
    // storage unavailable: the place just isn't remembered
  }
}

export default function ReaderApp({ bookId, jumpTo, passageId, openPanel: startPanel }: {
  bookId: string; jumpTo?: string; passageId?: number;
  /** Open with the Ask or Discuss panel showing (from the book card in the library). */
  openPanel?: "ask" | "discuss";
}) {
  const router = useRouter();
  const [book, setBook] = useState<ApiBook | null>(null);
  const [genre, setGenre] = useState<ApiGenre | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [loc, setLoc] = useState<ReaderLocation | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [panel, setPanel] = useState<"none" | "contents" | "look" | "highlights">("none");
  const [highlights, setHighlights] = useState<ApiHighlight[]>([]);
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [editing, setEditing] = useState<{ id: string; x: number; y: number; fresh?: boolean } | null>(null);
  const [askSeed, setAskSeed] = useState<{ id: number; text: string } | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // On the public demo a visitor's place is kept in their own browser (the server's is the owner's),
  // and it's what their spoiler protection follows.
  const access = useAccess();
  const visitor = access.visitor;
  const [ownPlace] = useState(() => readPlace(bookId));
  const [recent, setRecent] = useState<{ id: string; title: string; author: string; progress: number }[]>([]);
  const [chrome, setChrome] = useState(true);
  const [flip, setFlip] = useState<{ dir: "next" | "prev"; n: number } | null>(null);
  const [opened, setOpened] = useState(false);
  const [wide, setWide] = useState(true);
  // The Ask panel: open, tucked aside while you look at a cited passage ("peek"), or closed.
  const [askState, setAskState] = useState<"closed" | "open" | "peek">(startPanel ? "open" : "closed");
  const [spoilers, setSpoilers] = useState(false);
  // The panel has two conversations: Ask (questions) and Discuss (the reading partner, started on first use).
  const [askMode, setAskMode] = useState<"ask" | "discuss">(startPanel ?? "ask");
  const [discussStarted, setDiscussStarted] = useState(startPanel === "discuss");
  // Looking at a cited passage elsewhere in the book: your real page is kept (not saved over) until you return.
  const [away, setAway] = useState<{ location: string; spot: ReaderSpot | null } | null>(null);
  const awayRef = useRef(away);
  useEffect(() => { awayRef.current = away; }, [away]);
  const view = useRef<ReaderHandle>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const idleTimer = useRef<number | undefined>(undefined);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.book(bookId), api.library()])
      .then(([b, lib]) => {
        if (!alive) return;
        if (b.status !== "ready") throw new Error(b.status === "failed" ? `This book couldn't be read: ${b.error}` : "This book is still being processed. Try again in a moment.");
        setBook(b);
        api.highlights(b.id).then((hs) => alive && setHighlights(hs)).catch(() => {});
        setGenre(lib.genres.find((g) => g.id === b.genre_id) ?? null);
        setRecent(lib.books.filter((x) => x.status === "ready" && x.id !== b.id)
          .sort((x, y) => (y.position?.updated_at ?? "").localeCompare(x.position?.updated_at ?? ""))
          .map((x) => ({ id: x.id, title: x.title, author: x.author, progress: x.position?.progress ?? 0 })));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, [bookId]);

  // The reading room follows your chosen theme (in Mixed mode, the theme of the book's room).
  const theme = useMemo(() => {
    const choice = initialChoice();
    return getTheme(choice === "mixed" ? genre?.theme : choice);
  }, [genre]);
  const skin = READING[theme.id];
  const light = prefs.light ?? clockLight();
  const paper = skin.paper[light];
  useEffect(() => { loadThemeFonts(theme); }, [theme]);
  // The room's background sound, quieter while reading.
  useEffect(() => { sound.setAmbience(theme.id as AmbienceId, 0.45); }, [theme]);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* not saved */ } }, [prefs]);

  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 900);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const spread = prefs.layout === "two" || (prefs.layout === "auto" && wide);

  // The cover swings open, then the reading room appears.
  useEffect(() => {
    const id = window.setTimeout(() => setOpened(true), reduced ? 0 : 1500);
    return () => window.clearTimeout(id);
  }, [reduced]);

  // Controls fade away while you read and come back when you move the mouse.
  const wake = useCallback(() => {
    setChrome(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setChrome(false), 2800);
  }, []);
  useEffect(() => {
    idleTimer.current = window.setTimeout(() => setChrome(false), 2800);
    window.addEventListener("mousemove", wake);
    return () => window.removeEventListener("mousemove", wake);
  }, [wake]);
  const showChrome = chrome || panel !== "none" || askState === "open" || !ready;

  const onLocation = useCallback((l: ReaderLocation) => {
    setLoc(l);
    if (awayRef.current) return; // browsing a citation; the bookmark stays where you were
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (visitor) {
        writePlace(bookId, { location: l.location, progress: l.progress });
        setSaved("saved");
        return;
      }
      setSaved("saving");
      try {
        await api.savePosition(bookId, {
          location: l.location, progress: Math.min(1, Math.max(0, l.progress)), chapter_href: l.chapterHref ?? null,
          chapter_fraction: l.chapterFraction ?? null,
        });
        setSaved("saved");
      } catch {
        setSaved("error");
      }
    }, 700);
  }, [bookId, visitor]);

  const turn = useCallback((dir: "next" | "prev") => {
    if (dir === "next" && loc?.atEnd) return;
    if (dir === "prev" && loc?.atStart) return;
    if (!reduced) setFlip((f) => ({ dir, n: (f?.n ?? 0) + 1 }));
    sound.play("page");
    if (dir === "next") view.current?.next();
    else view.current?.prev();
  }, [loc, reduced]);

  const onKey = useCallback((key: string) => {
    if (key === "ArrowRight" || key === "PageDown" || key === " ") turn("next");
    else if (key === "ArrowLeft" || key === "PageUp") turn("prev");
  }, [turn]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (paletteOpen) return;
      if (e.key === "Escape") {
        if (selection || editing) { setSelection(null); setEditing(null); }
        else if (askState === "open") setAskState("closed");
        else if (panel !== "none") setPanel("none");
        else router.push("/");
        return;
      }
      if (["ArrowRight", "ArrowLeft", "PageDown", "PageUp", " "].includes(e.key)) {
        e.preventDefault();
        onKey(e.key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen, panel, router, onKey, askState, selection, editing]);

  const chapters = useMemo(() => toc.map((t) => ({ ...t, ...cleanChapter(t.title) })), [toc]);
  const currentIdx = useMemo(() => {
    if (!loc?.chapterHref || !chapters.length) return -1;
    const b = base(loc.chapterHref);
    return chapters.findIndex((c) => base(c.target) === b);
  }, [loc, chapters]);
  const current = currentIdx >= 0 ? chapters[currentIdx] : null;

  // A visitor without a place of their own starts where the library's reader is (on the showcase, where the
  // recorded answers were asked).
  const startAt = jumpTo ?? (visitor ? ownPlace?.location ?? book?.position?.location : book?.position?.location);

  // What the reader has seen, for spoiler-safe answers: the end of the visible page.
  const spot = useMemo<ReaderSpot | null>(() => {
    if (!loc || !book) return null;
    if (book.format === "pdf") return { page: loc.page };
    return { chapter_href: loc.chapterHref ?? null, chapter_fraction: loc.chapterFraction ?? null, progress: loc.progress };
  }, [loc, book]);

  const sendAsk = useCallback<AskSend>((question, history, h, signal) =>
    ask.book(bookId, { question, history, position: away?.spot ?? spot, spoilers }, h, signal), [bookId, away, spot, spoilers]);
  const sendDiscuss = useCallback<AskSend>((message, history, h, signal) =>
    ask.discuss(bookId, { message: message || null, history, position: away?.spot ?? spot }, h, signal), [bookId, away, spot]);

  const openPanel = useCallback((mode: "ask" | "discuss") => {
    setPanel("none");
    setAskMode(mode);
    if (mode === "discuss") setDiscussStarted(true);
    setAskState("open");
  }, []);

  const openCitation = useCallback((c: ApiCitation) => {
    if (c.book_id !== bookId) {
      router.push(`/read/${c.book_id}?passage=${c.chunk_id}`);
      return;
    }
    setAskState("peek");
    setPanel("none");
    if (!awayRef.current && loc) {
      awayRef.current = { location: loc.location, spot };
      setAway(awayRef.current);
    }
    view.current?.showPassage({ location: c.location, page: c.page, text: c.text });
  }, [bookId, router, loc, spot]);

  const backToMyPage = useCallback(() => {
    const a = awayRef.current;
    if (!a) return;
    awayRef.current = null;
    setAway(null);
    view.current?.goTo(a.location);
  }, []);

  // Arriving from a citation elsewhere (the Librarian): open at that passage and highlight it.
  useEffect(() => {
    if (!ready || !passageId) return;
    api.passage(passageId).then((c) => c.book_id === bookId && view.current?.showPassage({ location: c.location, page: c.page, text: c.text })).catch(() => {});
  }, [ready, passageId, bookId]);
  const progress = loc?.progress ?? (visitor ? ownPlace?.progress ?? book?.position?.progress : book?.position?.progress) ?? 0;
  const pct = Math.round(progress * 100);
  const pagesLeft = loc ? Math.max(0, loc.pageTotal - loc.page) : 0;
  const Viewer = book?.format === "pdf" ? PdfView : EpubView;
  const cover = book?.has_cover ? api.coverUrl(book.id) : null;
  const drawnCover = useMemo(() => book ? coverDataUrl({
    id: book.id, title: book.title, spineTitle: book.title, author: book.author, room: book.genre_id, row: 0,
    color: "#5a3a52", w: 60, h: 170, progress: 0, pages: book.total_pages, description: "", highlights: [],
  }, theme) : null, [book, theme]);

  // ── Highlights ──────────────────────────────────────────────────────────
  const drawnHighlights = useMemo(() => highlights.map((h) => ({ id: h.id, location: h.location, color: h.color })), [highlights]);

  const addHighlight = useCallback(async (color: HighlightColor, withNote: boolean) => {
    const sel = selection;
    if (!sel || !book) return;
    setSelection(null);
    try {
      const h = await api.addHighlight(book.id, {
        location: sel.location, text: sel.text, chapter_href: sel.chapterHref,
        chapter_title: current ? `${current.title}${current.sub ? ` · ${current.sub}` : ""}` : null, color,
      });
      setHighlights((all) => [...all, h]);
      sound.play("chime");
      if (withNote) setEditing({ id: h.id, x: sel.x, y: sel.y, fresh: true });
    } catch {
      // the page stays as it was; the toolbar can be used again
    }
  }, [selection, book, current]);

  const saveHighlight = useCallback(async (id: string, patch: { note?: string; color?: HighlightColor }) => {
    const h = await api.updateHighlight(id, patch);
    setHighlights((all) => all.map((x) => (x.id === id ? h : x)));
  }, []);

  const removeHighlight = useCallback(async (id: string) => {
    setEditing(null);
    await api.deleteHighlight(id);
    setHighlights((all) => all.filter((x) => x.id !== id));
  }, []);

  const askAbout = useCallback((text: string) => {
    setSelection(null);
    setEditing(null);
    setPanel("none");
    setAskSeed({ id: Date.now(), text: `Explain this passage: “${text.length > 400 ? `${text.slice(0, 400)}…` : text}”` });
    setAskState("open");
  }, []);
  const editingHighlight = editing ? highlights.find((h) => h.id === editing.id) : undefined;

  const vars = {
    ...theme.vars,
    "--font-display": theme.fonts.display,
    "--font-body": theme.fonts.body,
    "--paper": paper.bg,
    "--card-bg": paper.bg,
    "--card-edge": paper.edge,
    "--muted": paper.soft,
    "--ink": paper.ink,
    "--soft": paper.soft,
    "--edge": paper.edge,
    "--ribbon": skin.ribbon,
  } as React.CSSProperties;

  return (
    <div className={`room light-${light}`} data-theme={theme.id} style={vars}>
      <div className="room-backdrop" style={{ background: skin.backdrop[light] }} />
      {!reduced && (
        <div className="room-particles">
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 12], fov: 35 }} gl={{ alpha: true }}>
            <Particles key={theme.id} {...theme.particles} count={Math.round(theme.particles.count * 0.55)} />
          </Canvas>
        </div>
      )}
      <div className="room-vignette" />

      <header className={`room-bar ${showChrome ? "" : "hide"}`}>
        <button className="room-btn" onClick={() => router.push("/")} title="Back to the library (Esc)">
          <span aria-hidden>←</span> <span className="room-btn-label">Library</span>
        </button>
        <div className="room-title">
          <strong>{book?.title ?? "Opening…"}</strong>
          <span>{current ? `${current.title}${current.sub ? ` · ${current.sub}` : ""}` : book?.author ?? ""}</span>
        </div>
        <div className="room-tools">
          <button className={`room-icon ${panel === "contents" ? "on" : ""}`} onClick={() => setPanel((p) => (p === "contents" ? "none" : "contents"))} title="Contents" disabled={!chapters.length}>☰</button>
          {book && !visitor && (
            <button className={`room-icon ${panel === "highlights" ? "on" : ""}`} onClick={() => setPanel((p) => (p === "highlights" ? "none" : "highlights"))} title="Highlights and notes">
              ✎{highlights.length > 0 && <i className="room-badge">{highlights.length}</i>}
            </button>
          )}
          <button className={`room-icon ${panel === "look" ? "on" : ""}`} onClick={() => setPanel((p) => (p === "look" ? "none" : "look"))} title="Reading appearance">Aa</button>
          <button className="room-icon" onClick={() => setPaletteOpen(true)} title="Search (Ctrl K)">⌕</button>
          <SoundToggle className="room-icon" compact />
          <button className={`room-ask ${askState !== "closed" ? "on" : ""}`} onClick={() => { if (askState === "open") setAskState("closed"); else openPanel(askMode); }} title="Ask about this book, or talk it over" disabled={!ready}>
            <span aria-hidden>{skin.glyph}</span> Ask
          </button>
        </div>
      </header>

      <main className="desk">
        <button className={`turn prev ${showChrome ? "" : "dim"}`} onClick={() => turn("prev")} aria-label="Previous page" disabled={!ready || loc?.atStart}>‹</button>
        <div className={`book ${spread ? "spread" : "single"}`}>
          <div className="edges left" style={{ width: `${4 + progress * 14}px` }} />
          <div className="pages">
            <div className="paper-grain" />
            {/* Waits to know who's reading, since that decides where the book opens. */}
            {book && access.known && !error && (
              <Viewer
                ref={view}
                fileUrl={api.fileUrl(book.id)}
                startAt={startAt}
                paper={paper}
                fontFamily={FONTS[prefs.font].family}
                fontScale={prefs.size}
                spread={spread}
                onLocation={onLocation}
                onToc={setToc}
                onReady={() => setReady(true)}
                onError={setError}
                onKey={onKey}
                highlights={visitor ? [] : drawnHighlights}
                onSelect={visitor ? undefined : (sel) => { setSelection(sel); if (sel) setEditing(null); }}
                onHighlightClick={(id, x, y) => { setSelection(null); setEditing({ id, x, y }); }}
              />
            )}
            {spread && <div className="gutter" />}
            {flip && <div key={flip.n} className={`flip ${flip.dir} ${spread ? "half" : "full"}`} onAnimationEnd={() => setFlip(null)} />}
            {error && (
              <div className="book-msg">
                <p>{error}</p>
                <button className="room-btn" onClick={() => router.push("/")}>Back to the library</button>
              </div>
            )}
            {!ready && !error && opened && <div className="book-msg subtle"><span className="quill">{skin.glyph}</span><p>Finding your page…</p></div>}
          </div>
          <div className="edges right" style={{ width: `${4 + (1 - progress) * 14}px` }} />
          <div className="bookmark" style={{ height: `${36 + progress * 30}px` }} />
        </div>
        <button className={`turn next ${showChrome ? "" : "dim"}`} onClick={() => turn("next")} aria-label="Next page" disabled={!ready || loc?.atEnd}>›</button>
      </main>

      {ready && loc && book?.format === "epub" && pagesLeft === 0 && askState === "closed" && !loc.atStart && (
        <button className="talk-pill" onClick={() => openPanel("discuss")}>
          <span aria-hidden>{skin.glyph}</span> End of the chapter. Talk about it?
        </button>
      )}
      <footer className={`room-foot ${showChrome ? "" : "hide"}`}>
        <span className="foot-chapter">
          {loc && book?.format !== "pdf" ? (pagesLeft === 0 ? "Last page of this chapter" : `${pagesLeft} ${pagesLeft === 1 ? "page" : "pages"} left in chapter`) : loc ? `Page ${loc.page} of ${loc.pageTotal}` : ""}
        </span>
        <div className="ribbon-track" aria-label={`${pct}% read`}>
          <div className="ribbon-fill" style={{ width: `${pct}%` }} />
          <span className="ribbon-mark" style={{ left: `${pct}%` }}>{skin.glyph}</span>
        </div>
        <span className="foot-pct">
          {pct}% <i className={`save-dot ${saved}`} title={saved === "saved" ? "Position saved" : saved === "error" ? "Couldn't save" : "Saving"} />
        </span>
      </footer>

      <AnimatePresence>
        {panel === "contents" && (
          <motion.aside className="drawer" initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="drawer-head">
              <span className="drawer-glyph">{skin.glyph}</span>
              <div><div className="drawer-kicker">Contents</div><div className="drawer-title">{book?.title}</div></div>
              <button className="room-icon" onClick={() => setPanel("none")} aria-label="Close">×</button>
            </div>
            <ol className="drawer-list">
              {chapters.map((c, i) => (
                <li key={i}>
                  <button className={i === currentIdx ? "on" : ""} onClick={() => { view.current?.goTo(c.target); setPanel("none"); }}>
                    <span className="chap-title">{c.title}</span>
                    {c.sub && <span className="chap-sub">{c.sub}</span>}
                  </button>
                </li>
              ))}
            </ol>
          </motion.aside>
        )}
        {panel === "highlights" && (
          <HighlightsDrawer
            highlights={highlights}
            glyph={skin.glyph}
            title={book?.title ?? ""}
            onClose={() => setPanel("none")}
            onOpen={(h) => { setPanel("none"); view.current?.goTo(h.location); }}
          />
        )}
        {panel === "look" && (
          <motion.div className="look-panel" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="look-label">Light</div>
            <div className="look-row">
              {(["day", "dusk", "night"] as const).map((l) => (
                <button key={l} className={`swatch ${light === l ? "on" : ""}`} onClick={() => setPrefs((p) => ({ ...p, light: l }))}>
                  <span className="swatch-chip" style={{ background: skin.paper[l].bg, color: skin.paper[l].ink }}>Aa</span>
                  {l === "day" ? "Day" : l === "dusk" ? "Dusk" : "Night"}
                </button>
              ))}
            </div>
            <button className="look-auto" onClick={() => setPrefs((p) => ({ ...p, light: null }))} disabled={prefs.light === null}>Follow the time of day</button>
            <div className="look-label">Typeface</div>
            <div className="look-row">
              {(Object.keys(FONTS) as FontChoice[]).map((f) => (
                <button key={f} className={`font-pick ${prefs.font === f ? "on" : ""}`} style={{ fontFamily: FONTS[f].family }} onClick={() => setPrefs((p) => ({ ...p, font: f }))}>
                  <span>Ag</span>{FONTS[f].label}
                </button>
              ))}
            </div>
            <div className="look-label">Size <b>{Math.round(prefs.size * 100)}%</b></div>
            <input className="look-range" type="range" min={0.8} max={1.6} step={0.05} value={prefs.size} onChange={(e) => setPrefs((p) => ({ ...p, size: Number(e.target.value) }))} />
            <div className="look-label">Pages</div>
            <div className="look-row seg">
              {(["auto", "one", "two"] as const).map((l) => (
                <button key={l} className={prefs.layout === l ? "on" : ""} onClick={() => setPrefs((p) => ({ ...p, layout: l }))}>
                  {l === "auto" ? "Auto" : l === "one" ? "One" : "Two"}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!opened && (
          <motion.div className="opening" exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <div className="opening-book">
              <div className="opening-page"><span>{skin.glyph}</span><em>{book?.title}</em></div>
              <div className="opening-cover">
                {/* The cover comes from our own API (or is drawn in the browser), so next/image adds nothing here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {(cover || drawnCover) && <img src={cover ?? drawnCover ?? ""} alt="" onError={(e) => { if (drawnCover) e.currentTarget.src = drawnCover; }} />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selection && (
        <SelectionBar x={selection.x} y={selection.y} onHighlight={addHighlight} onAsk={() => askAbout(selection.text)} />
      )}
      {editing && editingHighlight && (
        <HighlightPopover
          key={editing.id}
          highlight={editingHighlight}
          x={editing.x}
          y={editing.y}
          autoFocus={editing.fresh}
          onSave={(patch) => saveHighlight(editing.id, patch)}
          onDelete={() => removeHighlight(editing.id)}
          onAsk={() => askAbout(editingHighlight.text)}
          onClose={() => setEditing(null)}
        />
      )}

      {askState !== "closed" && book && (
        <AskPanel
          hidden={askMode !== "ask"}
          className={`ask-reader ${askState === "peek" ? "peek" : ""}`}
          kicker="Ask about"
          title={book.title}
          glyph={skin.glyph}
          send={sendAsk}
          seed={askSeed}
          onCite={openCitation}
          onClose={() => setAskState("closed")}
          note={spoilers ? <>Using the whole book. Spoilers allowed.</> : <>Knows the book up to your page ({pct}%). Nothing after it.</>}
          controls={
            <>
              <ModeTabs mode="ask" onChange={openPanel} />
              <label className="ask-switch">
                <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
                <span>I&apos;ve read it before. Allow spoilers.</span>
              </label>
            </>
          }
          suggestions={["What has happened so far?", "Which characters have I met, and how are they connected?", "What are the main ideas so far?"]}
        />
      )}
      {askState !== "closed" && book && discussStarted && (
        <AskPanel
          hidden={askMode !== "discuss"}
          opensConversation
          className={`ask-reader ${askState === "peek" ? "peek" : ""}`}
          kicker="Talk about"
          title={book.title}
          glyph={skin.glyph}
          send={sendDiscuss}
          onCite={openCitation}
          onClose={() => setAskState("closed")}
          placeholder="Say what you think…"
          note={<>Your reading partner asks questions and pushes back, using the text up to your page ({pct}%).</>}
          controls={<ModeTabs mode="discuss" onChange={openPanel} />}
          suggestions={[]}
        />
      )}
      {(askState === "peek" || away) && (
        <div className="ask-peek">
          {away && <button className="ask-peek-tab ghost" onClick={backToMyPage}>↩ Back to my page</button>}
          {askState === "peek" && (
            <button className="ask-peek-tab" onClick={() => setAskState("open")}>
              <span aria-hidden>{skin.glyph}</span> Back to the answer
            </button>
          )}
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        recent={recent}
        actions={[{ id: "library", title: "← Back to the library", sub: "Return to the 3D library" }]}
        onOpenBook={(id, target) => {
          if (id === bookId && target) view.current?.goTo(target);
          else router.push(`/read/${id}${target ? `?loc=${encodeURIComponent(target)}` : ""}`);
        }}
        onAction={() => router.push("/")}
      />
    </div>
  );
}

/** Switch the side panel between asking questions and the reading partner. */
function ModeTabs({ mode, onChange }: { mode: "ask" | "discuss"; onChange: (m: "ask" | "discuss") => void }) {
  return (
    <div className="ask-modes" role="tablist">
      <button role="tab" aria-selected={mode === "ask"} className={mode === "ask" ? "on" : ""} onClick={() => onChange("ask")}>Ask</button>
      <button role="tab" aria-selected={mode === "discuss"} className={mode === "discuss" ? "on" : ""} onClick={() => onChange("discuss")}>Discuss</button>
    </div>
  );
}
