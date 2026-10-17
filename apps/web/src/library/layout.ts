// The fixed shelf layout every theme shares, in design units (the shelf is 520 wide).
import type { Book, RoomId } from "@/library/data/books";

export const SHELF = {
  w: 520,
  h: 480,
  padX: 24,
  gap: 6,
  /** Bottom (the board books stand on) of each row, relative to shelf top. */
  rowBase: [236, 456] as const,
  rowTop: [36, 256] as const,
};

/** Most books a shelf shows; the rest are still reachable with Ctrl+K. */
export const MAX_PER_ROW = 9;
const ORNAMENT_W = 96;

export interface Slot {
  book: Book;
  /** Position relative to the shelf's top-left, and the (possibly slimmed) width. */
  x: number;
  y: number;
  w: number;
}

export interface OrnamentSlot {
  row: 0 | 1;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Splits a room's books across the two shelf rows. Rows with space left get a decorative
 * object at the end; full rows slim their spines so every book still fits.
 */
export function roomSlots(room: RoomId | string, books: Book[]): { slots: Slot[]; ornaments: OrnamentSlot[]; hidden: number } {
  const list = books.filter((b) => b.room === room);
  const shown = list.slice(0, MAX_PER_ROW * 2);
  const half = Math.ceil(shown.length / 2);
  const rows = [shown.slice(0, half), shown.slice(half)] as const;
  const inner = SHELF.w - SHELF.padX * 2;
  const slots: Slot[] = [];
  const ornaments: OrnamentSlot[] = [];

  rows.forEach((rowBooks, r) => {
    const row = r as 0 | 1;
    const natural = rowBooks.reduce((a, b) => a + b.w, 0) + SHELF.gap * Math.max(0, rowBooks.length - 1);
    const roomForOrnament = natural + 14 + ORNAMENT_W <= inner;
    const scale = roomForOrnament || natural <= inner ? 1 : (inner - SHELF.gap * (rowBooks.length - 1)) / (natural - SHELF.gap * (rowBooks.length - 1));
    let x = SHELF.padX;
    for (const book of rowBooks) {
      const w = book.w * scale;
      slots.push({ book, x, y: SHELF.rowBase[row] - book.h, w });
      x += w + SHELF.gap;
    }
    const ox = x + 14;
    const ow = roomForOrnament ? SHELF.w - SHELF.padX - ox : 0;
    ornaments.push({ row, x: ox, y: SHELF.rowTop[row] + 40, w: ow, h: SHELF.rowBase[row] - SHELF.rowTop[row] - 40 });
  });
  return { slots, ornaments, hidden: list.length - shown.length };
}
