import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONTINUE_BOOK, ROOM_ORDER, type Book, type RoomId } from "./data/books";
import { THEMES, getTheme } from "./themes";
import { Scene, type OpenBook } from "./three/Scene";
import { loadThemeFonts } from "./three/textures";
import { BookCard } from "./ui/BookCard";
import { Entrance } from "./ui/Entrance";
import { Hall, type HallApi, type SpineRect } from "./ui/Hall";
import { Librarian } from "./ui/Librarian";

function themeFromHash() {
  return getTheme(window.location.hash.replace(/^#\/?/, ""));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export default function App() {
  const [theme, setTheme] = useState(themeFromHash);
  const [entered, setEntered] = useState(false);
  const [open, setOpen] = useState<OpenBook | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const reduced = usePrefersReducedMotion();
  const hall = useRef<HallApi | null>(null);

  useEffect(() => {
    loadThemeFonts(theme);
  }, [theme]);

  useEffect(() => {
    const on = () => {
      setTheme(themeFromHash());
      setEntered(false);
      setOpen(null);
      setCardVisible(false);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const switchTheme = (id: string) => {
    window.location.hash = `/${id}`;
  };

  const select = useCallback((book: Book, from: SpineRect) => {
    setCardVisible(false);
    setOpen({ book, from, direction: 1 });
  }, []);

  const close = useCallback(() => {
    setCardVisible(false);
    setOpen((o) => (o ? { ...o, direction: -1 } : o));
  }, []);

  const continueReading = () => {
    if (open) return;
    const api = hall.current;
    if (!api) return;
    api.goToRoom(ROOM_ORDER.indexOf(CONTINUE_BOOK.room as RoomId));
    setTimeout(() => {
      const rect = api.spineRect(CONTINUE_BOOK.id);
      if (rect) select(CONTINUE_BOOK, rect);
    }, reduced ? 50 : 900);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) close();
      const n = Number(e.key);
      if (!open && n >= 1 && n <= THEMES.length && !(e.target instanceof HTMLInputElement)) switchTheme(THEMES[n - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div
      className="app"
      data-theme={theme.id}
      style={{ ...theme.vars, "--font-display": theme.fonts.display, "--font-body": theme.fonts.body } as React.CSSProperties}
    >
      <Hall
        key={`hall-${theme.id}`}
        theme={theme}
        locked={!!open || !entered}
        hiddenBookId={open?.book.id ?? null}
        onSelect={select}
        apiRef={hall}
      />

      {open && <div className={`dim ${open.direction === 1 ? "on" : ""}`} onClick={close} />}

      <AnimatePresence>
        {!entered && <Entrance key={`door-${theme.id}`} theme={theme} reduced={reduced} onEntered={() => setEntered(true)} />}
      </AnimatePresence>

      <Scene
        theme={theme}
        open={open}
        reduced={reduced}
        onCardTime={() => setCardVisible(true)}
        onClosed={() => setOpen(null)}
      />

      <AnimatePresence>
        {open && cardVisible && <BookCard key={open.book.id} book={open.book} theme={theme} onClose={close} />}
      </AnimatePresence>

      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Bunko</span>
          <span className="brand-sub">Phase 1 · theme demos</span>
        </div>
        <nav className="theme-pills" aria-label="Themes">
          {THEMES.map((t, i) => (
            <button
              key={t.id}
              className={`pill ${t.id === theme.id ? "on" : ""}`}
              onClick={() => switchTheme(t.id)}
              title={`${t.tagline} (key ${i + 1})`}
            >
              {t.name}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          {entered && (
            <>
              <button className="chip" onClick={continueReading} disabled={!!open}>
                ▶ Continue reading
              </button>
              <button className="chip ghost" onClick={() => { setOpen(null); setCardVisible(false); setEntered(false); }}>
                Replay entrance
              </button>
              <a className="chip ghost" href={`./${window.location.hash}`} style={{ textDecoration: "none" }}>3D version</a>
            </>
          )}
        </div>
      </header>

      {entered && !open && (
        <p className="hint">Scroll, drag or use ← → to walk · click a book</p>
      )}
      {entered && !open && <Librarian key={`lib-${theme.id}`} theme={theme} />}
    </div>
  );
}
