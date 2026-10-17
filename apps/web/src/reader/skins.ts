// How the reading room looks in each theme: the paper, ink and the world behind the book.
import type { ThemeId } from "@/library/themes/types";

export type Light = "day" | "dusk" | "night";
export type FontChoice = "garamond" | "literata" | "sans";

export interface Paper {
  bg: string;
  ink: string;
  /** Muted ink for running heads, page numbers and links. */
  soft: string;
  /** Colour of the stacked page edges. */
  edge: string;
}

export interface ReadingSkin {
  paper: Record<Light, Paper>;
  /** CSS background of the room the book sits in. */
  backdrop: Record<Light, string>;
  /** Small ornament shown in the chapter heading and the progress ribbon. */
  glyph: string;
  ribbon: string;
}

export const FONTS: Record<FontChoice, { label: string; family: string }> = {
  garamond: { label: "Garamond", family: "'EB Garamond', Garamond, Georgia, serif" },
  literata: { label: "Literata", family: "Literata, Georgia, serif" },
  sans: { label: "Sans", family: "'Zen Kaku Gothic New', 'Segoe UI', system-ui, sans-serif" },
};

/** Loaded inside the book's iframe, which can't see the page's fonts. */
export const READING_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap";

export const READING: Record<ThemeId, ReadingSkin> = {
  japanese: {
    paper: {
      day: { bg: "#f7f0e1", ink: "#2a201a", soft: "#8a7663", edge: "#e6dac2" },
      dusk: { bg: "#ecdcc0", ink: "#3a2a1e", soft: "#8c7258", edge: "#d9c6a4" },
      night: { bg: "#1f1a17", ink: "#e5d9c6", soft: "#9c8b78", edge: "#2c2520" },
    },
    backdrop: {
      day: "radial-gradient(ellipse at 50% 120%, #f1c9b8 0%, #c98e93 38%, #5b4b78 100%)",
      dusk: "radial-gradient(ellipse at 50% 120%, #f1a46f 0%, #8a4f5f 45%, #2e2440 100%)",
      night: "radial-gradient(ellipse at 50% 110%, #2e2440 0%, #120f1c 60%, #07060c 100%)",
    },
    glyph: "❀",
    ribbon: "#c4513a",
  },
  chinese: {
    paper: {
      day: { bg: "#f4ecd9", ink: "#2b2a28", soft: "#7d7566", edge: "#e2d8c0" },
      dusk: { bg: "#eadfc4", ink: "#33302b", soft: "#80765f", edge: "#d6c9a8" },
      night: { bg: "#1a1c1b", ink: "#ddd6c6", soft: "#8f897b", edge: "#262928" },
    },
    backdrop: {
      day: "linear-gradient(180deg, #d9d4c4 0%, #b9bcb6 45%, #6c726e 100%)",
      dusk: "linear-gradient(180deg, #e0b49a 0%, #8d7a72 50%, #3d423f 100%)",
      night: "linear-gradient(180deg, #1c2226 0%, #0e1214 100%)",
    },
    glyph: "◈",
    ribbon: "#9e2a2b",
  },
  vedic: {
    paper: {
      day: { bg: "#f2e2bd", ink: "#3b1e0e", soft: "#8a6a44", edge: "#dfc896" },
      dusk: { bg: "#e9d3a4", ink: "#40220f", soft: "#8a6638", edge: "#d6b97c" },
      night: { bg: "#22170f", ink: "#efdcb4", soft: "#a58a62", edge: "#2f2116" },
    },
    backdrop: {
      day: "radial-gradient(ellipse at 50% 120%, #f4b25a 0%, #d8692a 35%, #7a3a5a 75%, #2b2347 100%)",
      dusk: "radial-gradient(ellipse at 50% 120%, #ffb347 0%, #a5532f 40%, #2b1a12 100%)",
      night: "radial-gradient(ellipse at 50% 110%, #3a2214 0%, #160d08 65%, #0a0604 100%)",
    },
    glyph: "✺",
    ribbon: "#d0661c",
  },
  space: {
    paper: {
      day: { bg: "#eef0f7", ink: "#151a2e", soft: "#6c7392", edge: "#d9ddeb" },
      dusk: { bg: "#e3e2ee", ink: "#1c1a30", soft: "#6e6a8e", edge: "#cccadf" },
      night: { bg: "#0e1226", ink: "#d8def5", soft: "#7c86ab", edge: "#161b34" },
    },
    backdrop: {
      day: "radial-gradient(ellipse at 70% 20%, #3a2a6a 0%, #120d2a 45%, #05040d 100%)",
      dusk: "radial-gradient(ellipse at 70% 20%, #6a2a4a 0%, #1a0d24 50%, #05040d 100%)",
      night: "radial-gradient(ellipse at 70% 20%, #1a2a5a 0%, #080a1c 50%, #020208 100%)",
    },
    glyph: "✦",
    ribbon: "#ff8a3a",
  },
  fantasy: {
    paper: {
      day: { bg: "#f1e5c4", ink: "#2a1d12", soft: "#8a7350", edge: "#ddcc9c" },
      dusk: { bg: "#e6d4a8", ink: "#2e1f12", soft: "#86693f", edge: "#cfb77e" },
      night: { bg: "#19142a", ink: "#e9dfc3", soft: "#9a8fb5", edge: "#241d3a" },
    },
    backdrop: {
      day: "radial-gradient(ellipse at 50% 0%, #4a2a6a 0%, #1b1433 55%, #0b0820 100%)",
      dusk: "radial-gradient(ellipse at 50% 0%, #6a3a5a 0%, #241433 55%, #0b0820 100%)",
      night: "radial-gradient(ellipse at 50% 0%, #2a1a4a 0%, #0d0a1c 60%, #05040d 100%)",
    },
    glyph: "✧",
    ribbon: "#e3b75a",
  },
};

const ROMAN = /^(?:chapter|book|part|letter|canto|section)\s+([ivxlcdm\d]+)\.?$/i;

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s(“"'-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

/**
 * Gutenberg labels are messy ("I hope Mr. Bingley will like it. CHAPTER II.").
 * Split them into a short heading ("Chapter II") and an optional line under it.
 */
export function cleanChapter(label: string): { title: string; sub?: string } {
  const raw = label.replace(/\s+/g, " ").trim();
  const m = raw.match(/^(.*?)[\s.]*\b((?:chapter|book|part|letter|canto)\s+[ivxlcdm\d]+)\.?$/i);
  if (m && m[1]) {
    return { title: titleCase(m[2]).replace(/\b([ivxlcdm]+)\b/gi, (r) => r.toUpperCase()), sub: m[1].replace(/[.\s]+$/, "") };
  }
  if (ROMAN.test(raw)) return { title: titleCase(raw.replace(/\.$/, "")).replace(/\b([ivxlcdm]+)\b/gi, (r) => r.toUpperCase()) };
  const isShouty = raw === raw.toUpperCase() && /[A-Z]{3}/.test(raw);
  return { title: isShouty ? titleCase(raw) : raw };
}
