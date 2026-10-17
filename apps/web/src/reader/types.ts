import type { Paper } from "@/reader/skins";

export interface ReaderLocation {
  /** EPUB: a CFI. PDF: the page number. */
  location: string;
  progress: number;
  chapterHref?: string | null;
  /** EPUB: how far through the chapter document the end of the visible page is (0–1). */
  chapterFraction?: number | null;
  /** Page within the current chapter (EPUB) or the book (PDF). */
  page: number;
  pageTotal: number;
  atStart: boolean;
  atEnd: boolean;
}

export interface TocItem {
  title: string;
  /** EPUB: an href inside the book. PDF: a page number. */
  target: string;
}

/** A cited passage to open and highlight. */
export interface PassageTarget {
  location: string;
  page: number;
  text: string;
}

export interface ReaderHandle {
  next: () => void;
  prev: () => void;
  goTo: (target: string) => void;
  showPassage: (p: PassageTarget) => void;
}

/** A saved highlight to draw on the page. */
export interface ReaderHighlight {
  id: string;
  location: string;
  color: string;
}

/** Text the reader selected, with where to show the highlight toolbar (viewport coordinates). */
export interface ReaderSelection {
  location: string;
  text: string;
  chapterHref: string | null;
  x: number;
  y: number;
}

export interface ReaderProps {
  fileUrl: string;
  /** Where to open: a saved position, or a jump target from search. */
  startAt?: string;
  paper: Paper;
  fontFamily: string;
  fontScale: number;
  /** Two facing pages instead of one. */
  spread: boolean;
  onLocation: (loc: ReaderLocation) => void;
  onToc: (toc: TocItem[]) => void;
  onReady: () => void;
  onError: (message: string) => void;
  /** Keys pressed while focus is inside the book (its iframe swallows them otherwise). */
  onKey: (key: string) => void;
  /** Highlights to draw, text selection, and clicks on a highlight. */
  highlights?: ReaderHighlight[];
  onSelect?: (s: ReaderSelection | null) => void;
  onHighlightClick?: (id: string, x: number, y: number) => void;
}
