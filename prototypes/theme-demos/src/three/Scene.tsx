import { Canvas } from "@react-three/fiber";
import type { Book } from "../data/books";
import type { Theme } from "../themes/types";
import type { SpineRect } from "../ui/Hall";
import { Book3D } from "./Book3D";
import { Particles } from "./Particles";

export interface OpenBook {
  book: Book;
  from: SpineRect;
  direction: 1 | -1;
}

/** One transparent canvas over the page for all Three.js moments. */
export function Scene({ theme, bookTheme, open, reduced, onCardTime, onClosed }: {
  theme: Theme;
  /** Theme the opened book is drawn in (its room's theme in Mixed mode). */
  bookTheme?: Theme;
  open: OpenBook | null;
  reduced: boolean;
  onCardTime: () => void;
  onClosed: () => void;
}) {
  return (
    <div className="scene">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 12], fov: 35 }}
        gl={{ alpha: true, antialias: true }}
        style={{ pointerEvents: "none" }}
      >
        <ambientLight intensity={theme.book3d.ambient} />
        <directionalLight position={[3, 4, 8]} intensity={1.6} />
        <pointLight position={[-4, 2, 5]} intensity={30} color={theme.book3d.light} />
        {!reduced && <Particles key={theme.id} {...theme.particles} />}
        {open && (
          <Book3D
            key={open.book.id + (bookTheme ?? theme).id}
            book={open.book}
            theme={bookTheme ?? theme}
            from={open.from}
            direction={open.direction}
            reduced={reduced}
            onCardTime={onCardTime}
            onClosed={onClosed}
          />
        )}
      </Canvas>
    </div>
  );
}
