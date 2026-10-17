// The fixed layout every theme shares. Themes never move these; they only
// draw art around them. All numbers are design units (world is 900 tall).

import { BOOKS, ROOM_ORDER, type Book, type RoomId } from "./data/books";

export const WORLD_H = 900;
export const ROOM_W = 1600;
export const WORLD_W = ROOM_W * ROOM_ORDER.length;
export const FLOOR_Y = 780;

/** Parallax speeds: backdrop drifts slowly, foreground props pass faster. */
export const PARALLAX = { back: 0.35, mid: 1, front: 1.2 };

export const SHELF = {
  w: 520,
  h: 480,
  /** Left edge inside a room. */
  x: ROOM_W / 2 - 260,
  y: FLOOR_Y - 480,
  padX: 24,
  gap: 6,
  /** Bottom (the board books stand on) of each row, relative to shelf top. */
  rowBase: [236, 456] as const,
  rowTop: [36, 256] as const,
};

export interface Slot {
  book: Book;
  /** Position relative to the shelf's top-left. */
  x: number;
  y: number;
}

export interface OrnamentSlot {
  row: 0 | 1;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function roomSlots(room: RoomId | string, books: Book[] = BOOKS): { slots: Slot[]; ornaments: OrnamentSlot[] } {
  const slots: Slot[] = [];
  const ornaments: OrnamentSlot[] = [];
  for (const row of [0, 1] as const) {
    let x = SHELF.padX;
    for (const book of books.filter((b) => b.room === room && b.row === row)) {
      slots.push({ book, x, y: SHELF.rowBase[row] - book.h });
      x += book.w + SHELF.gap;
    }
    const ox = x + 14;
    const ow = SHELF.w - SHELF.padX - ox;
    ornaments.push({ row, x: ox, y: SHELF.rowTop[row] + 40, w: ow, h: SHELF.rowBase[row] - SHELF.rowTop[row] - 40 });
  }
  return { slots, ornaments };
}

export function roomCenterX(index: number) {
  return index * ROOM_W + ROOM_W / 2;
}
