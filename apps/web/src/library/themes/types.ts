import type { ReactNode } from "react";
import type { Book, RoomId } from "@/library/data/books";

export type ThemeId = "japanese" | "chinese" | "vedic" | "space" | "fantasy";

export type ParticleKind = "petals" | "ink" | "embers" | "bokeh" | "sparkles";

/**
 * A skin. The layout (rooms, shelf, book slots, entrance door rectangle) is
 * fixed in layout.ts; a theme only supplies art, colours, fonts and character.
 */
export interface Theme {
  id: ThemeId;
  name: string;
  tagline: string;
  /** CSS custom properties applied at the app root. */
  vars: Record<`--${string}`, string>;
  fonts: { display: string; body: string };
  rooms: Record<RoomId, { title: string; subtitle: string }>;

  entrance: {
    door: "slide" | "swing";
    /** Exterior art, 1600×900. The door opening is x 620–980, y 300–780. */
    Facade: () => ReactNode;
    /** One door leaf, drawn at 0,0 with size 180×480. */
    Door: (p: { side: "left" | "right" }) => ReactNode;
    /** Optional art drawn over the doors (frames, arches, garlands). */
    FacadeFront?: () => ReactNode;
    insideGlow: string;
    title: string;
    hint: string;
  };

  hall: {
    /** Panorama behind everything, drawn 3200×900 (moves at 0.35×). */
    Backdrop: () => ReactNode;
    /** One room's walls and floor, 1600 wide; draw y from -500 to 900. */
    Room: (p: { room: RoomId; index: number }) => ReactNode;
    /** Divider between rooms, centred on x = 0, y from -500 to 900. */
    Threshold: () => ReactNode;
    /** Shelf frame, 520×480. */
    Shelf: (p: { room: RoomId }) => ReactNode;
    /** One spine, drawn at 0,0 with the book's w×h. */
    Spine: (p: { book: Book }) => ReactNode;
    /** Decorative object filling the end of a shelf row. */
    Ornament: (p: { row: 0 | 1; room: RoomId; w: number; h: number }) => ReactNode;
    /** Props in front of the shelves (moves at 1.2×), drawn 3840×900. */
    Foreground: () => ReactNode;
  };

  particles: { kind: ParticleKind; colors: string[]; count: number };

  book3d: {
    coverStyle: ThemeId;
    paper: string;
    endpaper: string;
    light: string;
    ambient: number;
  };

  librarian: { name: string; Art: () => ReactNode; greeting: string };
}
