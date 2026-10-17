import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONTINUE_BOOK, type Book } from "./data/books";
import type { Genre } from "./data/genres";
import { todayOf, useLibrary, type Library } from "./data/library";
import { milestone, monthName, progressAt, statsAt } from "./data/timeline";
import { THEMES, getTheme, type Theme } from "./themes";
import { Scene, type OpenBook } from "./three/Scene";
import { loadThemeFonts } from "./three/textures";
import { BookCard } from "./ui/BookCard";
import type { SpineRect } from "./ui/Hall";
import { Librarian } from "./ui/Librarian";
import type { Growth } from "./world/Growth";
import { buildJourney, type JourneyState } from "./world/journey";
import type { TimeOfDay } from "./world/skins";
import { World } from "./world/World";

const TIMES: { id: TimeOfDay; label: string }[] = [
  { id: "dawn", label: "Morning mist" },
  { id: "dusk", label: "Golden hour" },
  { id: "night", label: "Night" },
];
const THEME_KEY = "walkable-library:theme";

/** A theme id, or "mixed" for one theme per genre. */
type Choice = Theme["id"] | "mixed";
const isChoice = (v: string | null | undefined): v is Choice => v === "mixed" || THEMES.some((t) => t.id === v);

/** The URL hash wins; otherwise what you picked last time; otherwise Japanese. */
function initialChoice(): Choice {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (isChoice(hash)) return hash;
  try {
    const saved = localStorage.getItem(THEME_KEY);
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

export default function WorldApp() {
  const [choice, setChoice] = useState<Choice>(initialChoice);
  const mixed = choice === "mixed";
  const [time, setTime] = useState<TimeOfDay>(timeFromClock);
  const [open, setOpen] = useState<OpenBook | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  const [toast, setToast] = useState<string | null>(null);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const journey = useRef<JourneyState>({ p: 0, target: 0, locked: false }).current;
  const registry = useRef(new Map<string, () => void>()).current;
  const snapTimer = useRef<number | undefined>(undefined);

  // The library grows as genres are added; the world layout is rebuilt from it.
  const { library, addGenre, reset, nextGenre, canReset } = useLibrary();
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
  const growth = useRef<Growth>({ month, target: month }).current;
  growth.target = month;

  journey.locked = !!open;
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
          setToast(`${g.title} rises from the water: a new room for ${library.books.filter((b) => b.room === g.id).length} books.`);
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
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setMonth((m) => Math.min(today, m + dt * 0.8));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, today]);

  useEffect(() => {
    if (playing && month >= today) setPlaying(false);
  }, [playing, month, today]);

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
  }, [growth, today]);
  const close = useCallback(() => {
    setCardVisible(false);
    setOpen((o) => (o ? { ...o, direction: -1 } : o));
  }, []);

  const continueReading = () => {
    if (open) return;
    const c = layout.roomChapter[CONTINUE_BOOK.room];
    goTo(c);
    const started = performance.now();
    const wait = () => {
      if (Math.abs(journey.p - c) < 0.01) registry.get(CONTINUE_BOOK.id)?.();
      else if (performance.now() - started < 8000) requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
  };

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
      if (e.key === "Escape") close();
      if (journey.locked || e.target instanceof HTMLInputElement) return;
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
  const hud = (() => {
    switch (ch.kind) {
      case "gate":
        return mixed
          ? { eyebrow: "Bunko · Mixed", title: "The Library of Many Worlds", body: "Every genre is built in its own culture. Cross the bridges to travel from one world to the next." }
          : { eyebrow: `Bunko · ${theme.name}`, title: theme.entrance.title, body: theme.tagline };
      case "room": {
        const s = roomStats(library, ch.genre.id);
        const t = roomText(themeFor(ch.genre.id), ch.genre);
        return {
          eyebrow: `Room ${String(ch.index + 1).padStart(2, "0")} · ${t.subtitle}`,
          title: t.title,
          body: `${s.total} books · ${s.reading} in progress · ${s.done} finished. Touch a spine to take it down.`,
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
        return {
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
        {open && cardVisible && (
          <BookCard key={open.book.id} book={open.book} theme={bookTheme} onClose={close} roomTitle={genreOfOpen ? roomText(bookTheme, genreOfOpen).title : undefined} skin />
        )}
      </AnimatePresence>

      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Bunko</span>
          <span className="brand-sub">Phase 1 · 3D journey</span>
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
          <button
            className="chip"
            onClick={() => { if (timeline) closeTimeline(); addGenre(); }}
            disabled={!!open || !nextGenre}
            title={nextGenre ? `Demo: add ${nextGenre.title} as if you'd uploaded books in a new genre` : "All demo genres added"}
          >
            ＋ {nextGenre ? `Add ${nextGenre.title}` : "All genres added"}
          </button>
          <button className={`chip ${timeline ? "on" : ""}`} onClick={timeline ? closeTimeline : openTimeline} disabled={!!open}>
            {timeline ? "Back to today" : "◷ Library over time"}
          </button>
          <button className="chip" onClick={continueReading} disabled={!!open || timeline}>▶ Continue reading</button>
          <a className="chip ghost" href={`?view=classic#/${theme.id}`}>2.5D</a>
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
            {ch.kind === "overlook" && (
              <div className="chapter-actions">
                <button className="enter-btn" onClick={continueReading}>Continue reading</button>
                <button className="chip" onClick={() => goTo(0)}>Back to the gate</button>
                {canReset && <button className="chip ghost" onClick={() => { reset(); goTo(0); }}>Reset demo genres</button>}
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
      {!open && !timeline && <Librarian key={`lib-${uiTheme.id}`} theme={uiTheme} />}

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
