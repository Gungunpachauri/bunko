import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Book } from "../data/books";
import { ROOM_ORDER } from "../data/books";
import { FLOOR_Y, PARALLAX, ROOM_W, SHELF, WORLD_H, WORLD_W, roomCenterX, roomSlots } from "../layout";
import type { Theme } from "../themes/types";

export interface SpineRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  theme: Theme;
  /** Input is ignored while a book is open. */
  locked: boolean;
  hiddenBookId: string | null;
  onSelect: (book: Book, rect: SpineRect) => void;
  /** Lets the app ask the hall to walk to a room and find a spine. */
  apiRef: React.MutableRefObject<HallApi | null>;
}

export interface HallApi {
  goToRoom: (i: number) => void;
  spineRect: (bookId: string) => SpineRect | null;
}

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
}

export function Hall({ theme, locked, hiddenBookId, onSelect, apiRef }: Props) {
  const { w: vw, h: vh } = useViewport();
  const scale = Math.min(vh / WORLD_H, vw / 620);
  const viewW = vw / scale;
  const minX = Math.min(0, roomCenterX(0) - viewW / 2);
  const maxX = Math.max(WORLD_W - viewW, roomCenterX(ROOM_ORDER.length - 1) - viewW / 2);
  const roomX = (i: number) => Math.max(minX, Math.min(maxX, roomCenterX(i) - viewW / 2));
  const offsetY = vh - WORLD_H * scale;

  const backRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const x = useRef(roomX(0));
  const target = useRef(roomX(0));
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const spineEls = useRef(new Map<string, HTMLElement>());
  const [room, setRoom] = useState(0);
  const roomRef = useRef(0);
  const dragged = useRef(false);

  const clamp = (v: number) => Math.max(minX, Math.min(maxX, v));
  const clampRef = useRef(clamp);
  clampRef.current = clamp;

  // Keep position valid when the viewport changes.
  useEffect(() => {
    target.current = clamp(target.current);
    x.current = clamp(x.current);
  }, [minX, maxX]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop: ease toward the target and move each parallax layer.
  useLayoutEffect(() => {
    let raf = 0;
    let last = performance.now();
    let walked = 0;
    const place = (X: number, bob: number) => {
      if (backRef.current) backRef.current.style.transform = `translate3d(${-X * PARALLAX.back * scale}px, ${offsetY + bob * 0.3 * scale}px, 0) scale(${scale})`;
      if (midRef.current) midRef.current.style.transform = `translate3d(${-X * scale}px, ${offsetY + bob * scale}px, 0) scale(${scale})`;
      if (frontRef.current) frontRef.current.style.transform = `translate3d(${-X * PARALLAX.front * scale}px, ${offsetY + bob * 1.4 * scale}px, 0) scale(${scale})`;
    };
    place(x.current, 0);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const prev = x.current;
      x.current += (target.current - x.current) * Math.min(1, dt * 5);
      if (Math.abs(target.current - x.current) < 0.05) x.current = target.current;
      const speed = Math.abs(x.current - prev);
      walked += speed;
      // A gentle head-bob while walking.
      const bob = Math.min(1, speed / 6) * Math.sin(walked * 0.025) * 4;
      const X = x.current;
      place(X, bob);
      const r = Math.round((X + viewW / 2 - ROOM_W / 2) / ROOM_W);
      const ri = Math.max(0, Math.min(ROOM_ORDER.length - 1, r));
      if (ri !== roomRef.current) {
        roomRef.current = ri;
        setRoom(ri);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scale, offsetY, viewW]);

  const goToRoom = (i: number) => {
    target.current = roomX(Math.max(0, Math.min(ROOM_ORDER.length - 1, i)));
  };

  apiRef.current = {
    goToRoom,
    spineRect: (id) => {
      const el = spineEls.current.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    },
  };

  // Wheel, keyboard and drag to walk.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (lockedRef.current) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      target.current = clampRef.current(target.current + d * 1.2);
    };
    const onKey = (e: KeyboardEvent) => {
      if (lockedRef.current) return;
      if (e.key === "ArrowRight" || e.key === "d") goToRoom(roomRef.current + 1);
      if (e.key === "ArrowLeft" || e.key === "a") goToRoom(roomRef.current - 1);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }); // re-bind each render so goToRoom sees the current viewport

  const drag = useRef<{ startX: number; startT: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (locked || e.button !== 0) return;
    drag.current = { startX: e.clientX, startT: target.current };
    dragged.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 6) dragged.current = true;
    if (dragged.current) target.current = clamp(drag.current.startT - (dx / scale) * 1.4);
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const rooms = useMemo(() => ROOM_ORDER.map((id) => ({ id, ...roomSlots(id) })), []);
  const { Backdrop, Room, Threshold, Shelf, Spine, Ornament, Foreground } = theme.hall;

  return (
    <div
      className="hall"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div className="layer" ref={backRef} style={{ width: WORLD_W, height: WORLD_H }}>
        <Backdrop />
      </div>

      <div className="layer" ref={midRef} style={{ width: WORLD_W, height: WORLD_H }}>
        {rooms.map((r, i) => (
          <div key={r.id} className="room" style={{ left: i * ROOM_W, width: ROOM_W }}>
            <div className="room-art"><Room room={r.id} index={i} /></div>
            <div className="room-sign" style={{ left: ROOM_W / 2, top: SHELF.y - 120 }}>
              <div className="room-sign-title">{theme.rooms[r.id].title}</div>
              <div className="room-sign-sub">{theme.rooms[r.id].subtitle}</div>
            </div>
            <div className="shelf" style={{ left: SHELF.x, top: SHELF.y, width: SHELF.w, height: SHELF.h }}>
              <Shelf room={r.id} />
              {r.ornaments.map((o) => (
                <div key={o.row} className="ornament" style={{ left: o.x, top: o.y, width: o.w, height: o.h }}>
                  <Ornament row={o.row} room={r.id} w={o.w} h={o.h} />
                </div>
              ))}
              {r.slots.map(({ book, x, y }) => (
                <button
                  key={book.id}
                  ref={(el) => {
                    if (el) spineEls.current.set(book.id, el);
                    else spineEls.current.delete(book.id);
                  }}
                  className="spine"
                  style={{ left: x, top: y, width: book.w, height: book.h, visibility: hiddenBookId === book.id ? "hidden" : undefined }}
                  title={`${book.title} — ${book.author}`}
                  aria-label={`${book.title} by ${book.author}`}
                  onClick={(e) => {
                    if (dragged.current || locked) return;
                    const rr = e.currentTarget.getBoundingClientRect();
                    onSelect(book, { x: rr.left, y: rr.top, w: rr.width, h: rr.height });
                  }}
                >
                  <Spine book={book} />
                  {book.progress > 0 && book.progress < 1 && <span className="spine-ribbon" />}
                  {book.progress >= 1 && <span className="spine-done" title="Finished" />}
                </button>
              ))}
            </div>
          </div>
        ))}
        {rooms.slice(1).map((_, i) => (
          <div key={i} className="threshold" style={{ left: (i + 1) * ROOM_W }}>
            <Threshold />
          </div>
        ))}
        <div className="floor-shadow" style={{ top: FLOOR_Y, width: WORLD_W }} />
      </div>

      <div className="layer front" ref={frontRef} style={{ width: WORLD_W * PARALLAX.front, height: WORLD_H }}>
        <Foreground />
      </div>

      {!locked && (
        <nav className="room-nav">
          <button className="chip" disabled={room === 0} onClick={() => goToRoom(room - 1)}>
            ← {room > 0 ? theme.rooms[ROOM_ORDER[room - 1]].title : ""}
          </button>
          <div className="room-dots">
            {ROOM_ORDER.map((id, i) => (
              <button key={id} className={`dot ${i === room ? "on" : ""}`} onClick={() => goToRoom(i)} aria-label={theme.rooms[id].title} />
            ))}
          </div>
          <button className="chip" disabled={room === ROOM_ORDER.length - 1} onClick={() => goToRoom(room + 1)}>
            {room < ROOM_ORDER.length - 1 ? theme.rooms[ROOM_ORDER[room + 1]].title : ""} →
          </button>
        </nav>
      )}
    </div>
  );
}
