"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_URL, api, type ApiBook } from "@/lib/api";
import type { Book } from "@/library/data/books";
import type { Genre } from "@/library/data/genres";
import { todayOf, useLibrary, type Library } from "@/library/data/library";
import { milestone, monthName, progressAt, statsAt } from "@/library/data/timeline";
import { THEMES, getTheme, type Theme } from "@/library/themes";
import { Scene, type OpenBook } from "@/library/three/Scene";
import { loadThemeFonts } from "@/library/three/textures";
import { BookCard } from "@/library/ui/BookCard";
import type { SpineRect } from "@/library/ui/types";
import { Librarian } from "@/library/ui/Librarian";
import { CommandPalette } from "@/components/CommandPalette";
import { sound, type AmbienceId } from "@/lib/sound";
import { BookChat, type BookChatMode } from "@/library/ui/BookChat";
import { IconMap, IconPlay, IconPlus, IconReview, IconSearch, IconTimeline } from "@/components/icons";
import { SoundToggle } from "@/components/SoundToggle";
import { ConnectionsDialog } from "@/components/ConnectionsDialog";
import { ReviewDialog } from "@/library/ui/ReviewDialog";
import { UploadDialog } from "@/library/ui/UploadDialog";
import { roomSlots } from "@/library/layout";
import type { Growth } from "@/library/world/Growth";
import { buildJourney, type JourneyState } from "@/library/world/journey";
import type { TimeOfDay } from "@/library/world/skins";
import { World } from "@/library/world/World";

const TIMES: { id: TimeOfDay; label: string }[] = [
  { id: "dawn", label: "Morning mist" },
  { id: "dusk", label: "Golden hour" },
  { id: "night", label: "Night" },
];
export const THEME_KEY = "bunko:theme";
const OLD_THEME_KEY = "walkable-library:theme"; // the name before Bunko; still read so the choice carries over

/** A theme id, or "mixed" for one theme per genre. */
export type Choice = Theme["id"] | "mixed";
const isChoice = (v: string | null | undefined): v is Choice => v === "mixed" || THEMES.some((t) => t.id === v);

/** The URL hash wins; otherwise what you picked last time; otherwise Japanese. */
export function initialChoice(): Choice {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (isChoice(hash)) return hash;
  try {
    const saved = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(OLD_THEME_KEY);
    if (isChoice(saved)) return saved;
  } catch {
    // storage unavailable
  }
  return "japanese";
}

/** Lighting follows the real time of day by default. */
function timeFromClock(): TimeOfDay {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? "dawn" : h >= 12 && h < 19 ? "dusk" : "night";
}

/** Theme-specific room names for the original genres; a plain name for new ones. */
function roomText(theme: Theme, g: Genre) {
  const r = (theme.rooms as Record<string, { title: string; subtitle: string } | undefined>)[g.id];
  return { title: r?.title ?? g.title, subtitle: r?.subtitle ?? `${g.title} pavilion` };
}

function roomStats(lib: Library, genreId?: string) {
  const list = genreId ? lib.books.filter((b) => b.room === genreId) : lib.books;
  return {
    total: list.length,
    reading: list.filter((b) => b.progress > 0 && b.progress < 1).length,
    done: list.filter((b) => b.progress >= 1).length,
    pct: list.length ? Math.round((list.reduce((a, b) => a + b.progress, 0) / list.length) * 100) : 0,
  };
}

export default function LibraryApp() {
  const { library, raw, error, refresh } = useLibrary();
  if (!library) {
    return (
      <div className="app world loading-screen" data-theme="japanese">
        {error ? (
          <div className="loading-box">
            <h1>The library server isn&apos;t answering</h1>
            <p>Couldn&apos;t reach <code>{API_URL}</code> ({error}).</p>
            <p>Start it from <code>apps/api</code> with:</p>
            <pre>.venv/Scripts/python -m uvicorn app.main:app --port 8000</pre>
            <button className="enter-btn" onClick={() => refresh()}>Try again</button>
          </div>
        ) : (
          <div className="loading-box"><p>Opening the library…</p></div>
        )}
      </div>
    );
  }
  return <LibraryWorld library={library} rawBooks={raw?.books ?? []} refresh={refresh} />;
}

function LibraryWorld({ library, rawBooks, refresh }: { library: Library & { today: number }; rawBooks: ApiBook[]; refresh: () => void }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(initialChoice);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [connectionsFor, setConnectionsFor] = useState<{ id: string; title: string } | null>(null);
  // Ask / Discuss about the open book, right here in the library (it takes the card's place).
  const [bookChat, setBookChat] = useState<{ bookId: string; mode: BookChatMode } | null>(null);
  const [due, setDue] = useState(0);
  const refreshDue = useCallback(() => { api.reviewStats().then((st) => setDue(st.due)).catch(() => {}); }, []);
  useEffect(() => {
    refreshDue();
    window.addEventListener("focus", refreshDue);
    return () => window.removeEventListener("focus", refreshDue);
  }, [refreshDue]);
  const mixed = choice === "mixed";
  const [time, setTime] = useState<TimeOfDay>(timeFromClock);
  const [open, setOpen] = useState<OpenBook | null>(null);
  // Whether a book is out of the shelf right now (read by close(), which is created once).
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);
  const [cardVisible, setCardVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  const [toast, setToast] = useState<string | null>(null);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  // Live objects shared with the 3D scene, which reads and moves them every frame (created once, never replaced).
  const [journey] = useState<JourneyState>(() => ({ p: 0, target: 0, locked: false }));
  const [registry] = useState(() => new Map<string, () => void>());
  const snapTimer = useRef<number | undefined>(undefined);

  // The library grows as genres are added; the world layout is rebuilt from it.
  const today = todayOf(library);
  const layout = useMemo(() => buildJourney(library.genres), [library.genres]);
  const LAST = layout.last;

  // Mixed mode builds every genre's room in its own theme; otherwise all rooms share one.
  const themeFor = useCallback(
    (genreId: string) => (mixed ? getTheme(library.genres.find((g) => g.id === genreId)?.theme) : getTheme(choice)),
    [mixed, choice, library.genres],
  );
  /** Home theme: the gate, scenery and the HUD outside the rooms. */
  const theme = mixed ? themeFor(library.genres[0]?.id ?? "") : getTheme(choice);

  // "Library over time": the world normally shows today; the timeline replays its history.
  const [timeline, setTimeline] = useState(() => new URLSearchParams(window.location.search).has("timeline"));
  const [month, setMonth] = useState(() => (timeline ? 0 : today));
  const [playing, setPlaying] = useState(timeline);
  const [growth] = useState<Growth>(() => ({ month, target: month, today }));
  useLayoutEffect(() => {
    growth.target = month;
    growth.today = today;
  }, [growth, month, today]);

  journey.locked = !!open || paletteOpen || uploadOpen;
  const chapter = Math.min(LAST, Math.round(progress));
  const arrived = Math.abs(progress - chapter) < 0.22;

  useEffect(() => {
    (mixed ? THEMES : [theme]).forEach((t) => loadThemeFonts(t));
  }, [theme, mixed]);
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, choice); } catch { /* not saved */ }
  }, [choice]);
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const on = () => { setChoice(initialChoice()); setOpen(null); setCardVisible(false); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const goTo = useCallback((c: number) => {
    journey.target = Math.max(0, Math.min(LAST, c));
  }, [journey, LAST]);

  // When a genre is added, fly to the overlook first, then let its island rise in view.
  const genreCount = useRef(library.genres.length);
  const [holdRise, setHoldRise] = useState(false);
  // A ref as well as state: the effect below runs in the same commit and must see the hold at once.
  const holding = useRef(false);
  useEffect(() => {
    const n = library.genres.length;
    if (n > genreCount.current && !timeline) {
      holding.current = true;
      setHoldRise(true);
      goTo(LAST);
      const started = performance.now();
      const wait = () => {
        if (Math.abs(journey.p - LAST) < 0.05 || performance.now() - started > 9000) {
          const g = library.genres[n - 1];
          setToast(`${g.title} rises from the water: a new room in your library.`);
          holding.current = false;
          setHoldRise(false);
        } else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
    }
    genreCount.current = n;
  }, [library, LAST, goTo, journey, timeline]);

  // Outside the timeline the world always shows today, so new rooms rise as soon as they're added.
  useEffect(() => {
    if (!timeline && !holding.current) setMonth(today);
  }, [today, timeline, holdRise]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (timeline) goTo(LAST);
  }, [timeline, goTo, LAST]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let m = growth.target;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      m = Math.min(today, m + dt * 0.8);
      setMonth(m);
      // Playback stops by itself on reaching today.
      if (m >= today) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, today, growth]);

  const openTimeline = () => {
    setTimeline(true);
    setMonth(0);
    setPlaying(true);
  };
  const closeTimeline = () => {
    setTimeline(false);
    setPlaying(false);
    setMonth(today);
  };

  const select = useCallback((book: Book, from: SpineRect) => {
    setCardVisible(false);
    // In the timeline, the card shows how far along the book was in that month.
    const shown = growth.target < today ? { ...book, progress: progressAt(book, growth.target, today) ?? 0 } : book;
    setOpen({ book: shown, from, direction: 1 });
    sound.play("open");
  }, [growth, today]);
  const close = useCallback(() => {
    setCardVisible(false);
    setBookChat(null);
    if (openRef.current?.direction === 1) sound.play("close");
    setOpen((o) => (o ? { ...o, direction: -1 } : o));
  }, []);

  const openBook = useCallback((id: string, loc?: string) => {
    router.push(`/read/${id}${loc ? `?loc=${encodeURIComponent(loc)}` : ""}`);
  }, [router]);

  /** One click: straight into the reader at the last page you read. */
  const continueReading = async () => {
    try {
      const b = await api.continueReading();
      if (b) openBook(b.id);
      else setToast("Nothing to continue yet. Open a book from a shelf to start reading.");
    } catch {
      setToast("Couldn't reach the library server.");
    }
  };

  const goToRoom = useCallback((genreId: string) => {
    const c = layout.roomChapter[genreId];
    if (c !== undefined) goTo(c);
  }, [layout, goTo]);

  // Recently read books first, for the palette's empty state.
  const recent = useMemo(() => [...rawBooks]
    .filter((b) => b.status === "ready")
    .sort((a, b) => (b.position?.updated_at ?? b.created_at).localeCompare(a.position?.updated_at ?? a.created_at))
    .map((b) => ({ id: b.id, title: b.title, author: b.author, progress: b.position?.progress ?? 0 })), [rawBooks]);

  // Scroll, keys and touch walk the journey; it settles on the nearest chapter.
  useEffect(() => {
    const settle = () => {
      window.clearTimeout(snapTimer.current);
      snapTimer.current = window.setTimeout(() => goTo(Math.round(journey.target)), 420);
    };
    const onWheel = (e: WheelEvent) => {
      if (journey.locked) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      journey.target = Math.max(0, Math.min(LAST, journey.target + d * 0.0011));
      settle();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") close();
      const t = e.target as HTMLElement | null;
      if (journey.locked || (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) return;
      const next = ["ArrowDown", "ArrowRight", "PageDown", " ", "Enter"].includes(e.key);
      const prev = ["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key);
      if (next || prev) {
        e.preventDefault();
        goTo(Math.round(journey.target) + (next ? 1 : -1));
      }
      const n = Number(e.key);
      if (n >= 1 && n <= THEMES.length) window.location.hash = `/${THEMES[n - 1].id}`;
      if (n === THEMES.length + 1) window.location.hash = "/mixed";
    };
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null || journey.locked) return;
      const y = e.touches[0].clientY;
      journey.target = Math.max(0, Math.min(LAST, journey.target + (touchY - y) * 0.004));
      touchY = y;
      settle();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [journey, goTo, close, LAST]);

  const ch = layout.chapters[chapter];
  const all = roomStats(library);
  // In Mixed mode the HUD, librarian and particles take on the style of the room you're in.
  const uiTheme = !mixed
    ? theme
    : ch.kind === "room"
      ? themeFor(ch.genre.id)
      : ch.kind === "crossing"
        ? themeFor((progress > chapter ? ch.to : ch.from).id)
        : theme;
  // Background sound follows the room's theme (only if sound is on).
  useEffect(() => { sound.setAmbience(uiTheme.id as AmbienceId); }, [uiTheme.id]);
  const hud = (() => {
    switch (ch.kind) {
      case "gate":
        return mixed
          ? { eyebrow: "Bunko · Mixed", title: "The Library of Many Worlds", body: "Every genre is built in its own culture. Cross the bridges to travel from one world to the next, or press Ctrl K to jump anywhere." }
          : { eyebrow: `Bunko · ${theme.name}`, title: theme.entrance.title, body: `${theme.tagline}. Press Ctrl K to jump straight to any book.` };
      case "room": {
        const s = roomStats(library, ch.genre.id);
        const t = roomText(themeFor(ch.genre.id), ch.genre);
        const hidden = roomSlots(ch.genre.id, library.books).hidden;
        return {
          eyebrow: `Room ${String(ch.index + 1).padStart(2, "0")} · ${t.subtitle}`,
          title: t.title,
          body: s.total === 0
            ? "This shelf is empty. Use ＋ Add books to bring your first book here."
            : `${s.total} books · ${s.reading} in progress · ${s.done} finished. Touch a spine to take it down.${hidden ? ` ${hidden} more don't fit on the shelf; find them with Ctrl K.` : ""}`,
        };
      }
      case "crossing":
        return {
          eyebrow: "Interlude",
          title: "The crossing",
          body: mixed && themeFor(ch.from.id).id !== themeFor(ch.to.id).id
            ? `Leaving ${themeFor(ch.from.id).name} for ${themeFor(ch.to.id).name}: the bridge changes under your feet, and the gate ahead is the border into ${roomText(themeFor(ch.to.id), ch.to).title}.`
            : `Between ${roomText(themeFor(ch.from.id), ch.from).title} and ${roomText(themeFor(ch.to.id), ch.to).title} the pages come loose and drift with you. Walk through the gate.`,
        };
      case "overlook":
        return all.total === 0
          ? { eyebrow: "Your library", title: "Waiting for books", body: `${library.genres.length} empty rooms. Add your first EPUB or PDF, and give it a new genre to raise a new room from the water.` }
          : {
            eyebrow: "Your library",
            title: `${all.pct}% read`,
            body: `${all.total} books in ${library.genres.length} rooms · ${all.reading} in progress · ${all.done} finished. Every new genre raises a new room from the water.`,
          };
    }
  })();

  const timeLabel = TIMES.find((t) => t.id === time)!.label;
  const cycleTime = () => setTime(TIMES[(TIMES.findIndex((t) => t.id === time) + 1) % TIMES.length].id);
  const genreOfOpen = open ? library.genres.find((g) => g.id === open.book.room) : undefined;
  const bookTheme = genreOfOpen ? themeFor(genreOfOpen.id) : uiTheme;

  return (
    <div
      className={`app world time-${time}`}
      data-theme={uiTheme.id}
      style={{ ...uiTheme.vars, "--font-display": uiTheme.fonts.display, "--font-body": uiTheme.fonts.body } as React.CSSProperties}
    >
      <World
        key={`world-${choice}`}
        theme={theme}
        themeFor={themeFor}
        mixed={mixed}
        time={time}
        journey={journey}
        layout={layout}
        library={library}
        today={today}
        hiddenBookId={open?.book.id ?? null}
        onPick={select}
        onProgress={setProgress}
        reduced={reduced}
        registry={registry}
        growth={growth}
      />

      {open && <div className={`dim ${open.direction === 1 ? "on" : ""}`} onClick={close} />}

      <Scene theme={uiTheme} bookTheme={bookTheme} open={open} reduced={reduced} onCardTime={() => setCardVisible(true)} onClosed={() => setOpen(null)} />

      <AnimatePresence>
        {open && cardVisible && bookChat?.bookId === open.book.id ? (
          <BookChat key={`chat-${open.book.id}`} book={open.book} theme={bookTheme} mode={bookChat.mode}
            onMode={(mode) => setBookChat({ bookId: open.book.id, mode })} onBack={() => setBookChat(null)} />
        ) : open && cardVisible ? (
          <BookCard key={open.book.id} book={open.book} theme={bookTheme} onClose={close}
            onRead={(panel) => (panel ? setBookChat({ bookId: open.book.id, mode: panel }) : openBook(open.book.id))}
            onConnections={() => setConnectionsFor({ id: open.book.id, title: open.book.title })}
            roomTitle={genreOfOpen ? roomText(bookTheme, genreOfOpen).title : undefined} skin />
        ) : null}
      </AnimatePresence>

      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Bunko</span>
          <span className="brand-sub"><span lang="ja">文庫</span> · Your reading world</span>
        </div>
        <nav className="theme-pills" aria-label="Themes">
          {THEMES.map((t, i) => (
            <button key={t.id} className={`pill ${t.id === choice ? "on" : ""}`} onClick={() => { window.location.hash = `/${t.id}`; }} title={`${t.tagline} (key ${i + 1})`}>
              {t.name}
            </button>
          ))}
          <button className={`pill mixed ${mixed ? "on" : ""}`} onClick={() => { window.location.hash = "/mixed"; }} title={`Each genre in its own theme (key ${THEMES.length + 1})`}>
            ✦ Mixed
          </button>
        </nav>
        <div className="top-actions">
          <button className="search-btn" onClick={() => setPaletteOpen(true)} title="Search books, rooms and passages (Ctrl K)">
            <IconSearch /><span className="tool-label">Search</span><kbd>Ctrl K</kbd>
          </button>
          <nav className="toolbar" aria-label="Library tools">
            <button className="tool" onClick={() => router.push("/map")} disabled={!!open} title="Reading map: your books and ideas as stars">
              <IconMap /><span className="tool-label">Map</span>
            </button>
            <button className="tool" onClick={() => setReviewOpen(true)} disabled={!!open} title={due ? `Review highlights (${due} due)` : "Review your highlights"}>
              <IconReview /><span className="tool-label">Review</span>{due > 0 && <i className="tool-badge">{due}</i>}
            </button>
            <button className={`tool ${timeline ? "on" : ""}`} onClick={timeline ? closeTimeline : openTimeline} disabled={!!open}
              title={timeline ? "Back to today" : "Library over time"}>
              <IconTimeline /><span className="tool-label">{timeline ? "Today" : "Timeline"}</span>
            </button>
            <span className="tool-sep" aria-hidden />
            <button className="tool icon" onClick={() => { if (timeline) closeTimeline(); setUploadOpen(true); }} disabled={!!open} title="Add books" aria-label="Add books">
              <IconPlus />
            </button>
            <SoundToggle className="tool icon" />
          </nav>
          <button className="primary-btn" onClick={continueReading} disabled={!!open || timeline} title="Open the book you were last reading">
            <IconPlay /><span className="tool-label">Continue reading</span>
          </button>
        </div>
      </header>

      <button className="time-pill" onClick={cycleTime} title="Change the time of day">
        <span className="time-dot" />
        {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {timeLabel}
      </button>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!open && arrived && !timeline && (
          <motion.section
            key={`${uiTheme.id}-${chapter}-${ch.kind}`}
            className="chapter"
            initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.25 } }}
            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="chapter-eyebrow">{hud.eyebrow}</div>
            <h1 className="chapter-title">{hud.title}</h1>
            <p className="chapter-body">{hud.body}</p>
            {ch.kind === "gate" && <button className="enter-btn" onClick={() => goTo(1)}>Enter the library</button>}
            {ch.kind === "room" && roomStats(library, ch.genre.id).total === 0 && (
              <button className="enter-btn" onClick={() => setUploadOpen(true)}>＋ Add books</button>
            )}
            {ch.kind === "overlook" && (
              <div className="chapter-actions">
                <button className="enter-btn" onClick={continueReading}>Continue reading</button>
                <button className="chip" onClick={() => goTo(0)}>Back to the gate</button>
                <button className="chip" onClick={() => setUploadOpen(true)}>＋ Add books</button>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {!open && (
        <nav className="rail" aria-label="Chapters">
          {layout.chapters.map((c, i) => (
            <button key={`${c.kind}-${i}`} className={`rail-item ${c.kind === "crossing" ? "minor" : ""} ${i === chapter ? "on" : ""}`} onClick={() => goTo(i)}>
              <span className="rail-label">{c.kind === "room" ? roomText(themeFor(c.genre.id), c.genre).title : c.label}</span>
              <span className="rail-dot" />
            </button>
          ))}
          <div className="rail-track"><div className="rail-fill" style={{ height: `${(progress / LAST) * 100}%` }} /></div>
        </nav>
      )}

      {!open && chapter === 0 && arrived && !timeline && <div className="scroll-hint">Scroll to walk <span>↓</span></div>}
      {!open && !timeline && <Librarian key={`lib-${uiTheme.id}`} theme={uiTheme} genres={library.genres.map((g) => ({ id: g.id, title: g.title }))} />}

      <AnimatePresence>
        {timeline && !open && (
          <TimelinePanel
            library={library}
            today={today}
            month={month}
            playing={playing}
            onScrub={(m) => { setPlaying(false); setMonth(m); }}
            onPlay={() => { if (month >= today) setMonth(0); setPlaying((p) => !p); }}
          />
        )}
      </AnimatePresence>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        recent={recent}
        rooms={library.genres.map((g) => ({ id: g.id, title: roomText(themeFor(g.id), g).title }))}
        actions={[
          { id: "continue", title: "▶ Continue reading", sub: "Open the book you were last reading" },
          { id: "upload", title: "＋ Add books", sub: "Upload EPUB or PDF files" },
          { id: "map", title: "✧ Reading map", sub: "Your books and their ideas as a star map" },
          { id: "review", title: "✎ Review highlights", sub: due ? `${due} due now` : "Search and review what you highlighted" },
          { id: "overlook", title: "◎ Overlook", sub: "See the whole library from above" },
        ]}
        onOpenBook={openBook}
        onGoToRoom={goToRoom}
        onAction={(id) => {
          if (id === "continue") continueReading();
          else if (id === "upload") setUploadOpen(true);
          else if (id === "review") setReviewOpen(true);
          else if (id === "map") router.push("/map");
          else goTo(LAST);
        }}
      />
      <ConnectionsDialog book={connectionsFor} onClose={() => setConnectionsFor(null)} />
      <ReviewDialog open={reviewOpen} onClose={() => { setReviewOpen(false); refreshDue(); }} onChanged={() => { refreshDue(); refresh(); }} />
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        genres={library.genres.map((g) => ({ id: g.id, title: g.title }))}
        onChanged={refresh}
      />
    </div>
  );
}

function TimelinePanel({ library, today, month, playing, onScrub, onPlay }: {
  library: Library; today: number; month: number; playing: boolean; onScrub: (m: number) => void; onPlay: () => void;
}) {
  const m = Math.floor(month + 1e-6);
  const s = statsAt(library, month);
  return (
    <motion.section
      className="timeline"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <div className="timeline-head">
        <div>
          <div className="chapter-eyebrow">Library over time</div>
          <div className="timeline-month">
            {m === 0 ? "Before" : m === today ? "Today" : `Month ${m}`}
            <span>{m > 0 ? ` · ${monthName(m)}${m > 12 ? ` (year 2)` : ""}` : ""}</span>
          </div>
        </div>
        <dl className="timeline-stats">
          <div><dt>Rooms</dt><dd>{s.rooms}</dd></div>
          <div><dt>Books</dt><dd>{s.books}</dd></div>
          <div><dt>Finished</dt><dd>{s.finished}</dd></div>
          <div><dt>Read</dt><dd>{s.pct}%</dd></div>
        </dl>
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={m} className="timeline-caption" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}>
          {milestone(library, month)}
        </motion.p>
      </AnimatePresence>
      <div className="timeline-controls">
        <button className="timeline-play" onClick={onPlay} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
        <div className="timeline-track">
          <input type="range" min={0} max={today} step={0.01} value={month} onChange={(e) => onScrub(Number(e.target.value))} aria-label="Month" />
          <div className="timeline-ticks">
            {Array.from({ length: today + 1 }, (_, i) => (
              <button key={i} className={`${i <= m ? "past" : ""} ${library.genres.some((g) => g.month === i) ? "rise" : ""}`} onClick={() => onScrub(i)} title={i ? `Month ${i}` : "Before"}>
                {monthName(i)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
