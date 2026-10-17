export type RoomId = "fiction" | "selfhelp";

export interface Book {
  id: string;
  title: string;
  /** Short title used on narrow spines. */
  spineTitle: string;
  author: string;
  /** Genre id: the room the book lives in. */
  room: RoomId | (string & {});
  /** Unused by the generated layout; kept for the theme spine components. */
  row: 0 | 1;
  color: string;
  /** Spine size in design units (the shelf is 520 wide). */
  w: number;
  h: number;
  /** 0..1 reading progress. */
  progress: number;
  pages: number;
  description: string;
  highlights: string[];
  /** Month the book joined the library (see timeline.ts). */
  addedMonth?: number;
  finishedMonth?: number;
  format?: "epub" | "pdf";
  coverUrl?: string;
}
