"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { READING_FONTS_URL } from "@/reader/skins";
import type { PassageTarget, ReaderHandle, ReaderHighlight, ReaderProps } from "@/reader/types";

/** Highlighter inks, see-through enough to read through on day and night paper. */
export const HIGHLIGHT_INK: Record<string, string> = {
  amber: "rgb(255, 190, 60)",
  rose: "rgb(255, 120, 150)",
  sage: "rgb(120, 200, 130)",
  sky: "rgb(100, 170, 255)",
};

/** Ignore a failed epub.js background task (the book was closed, or a link pointed nowhere). */
const quiet = (e: unknown) => console.debug("epub.js:", e);

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Elements in the chapter that hold the passage's paragraphs (matched by their opening words). */
function findPassage(doc: Document, text: string): HTMLElement[] {
  const paras = text.split("\n").map(norm).filter((p) => p.length > 0).slice(0, 8);
  const blocks = [...doc.body.querySelectorAll<HTMLElement>("p, li, blockquote, h1, h2, h3, h4, h5, h6, td, pre, div")];
  const found: HTMLElement[] = [];
  for (const para of paras) {
    const needle = para.slice(0, 60);
    // The smallest block containing the paragraph's opening (divs wrap everything, so prefer the innermost).
    const hit = blocks.filter((el) => norm(el.textContent ?? "").includes(needle))
      .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}

// epub.js has no bundled types for these pieces; keep the surface we use small and explicit.
interface Location {
  start: { cfi: string; href: string; index: number; displayed: { page: number; total: number } };
  atStart?: boolean;
  atEnd?: boolean;
}
interface Contents { document: Document; window: Window; cfiFromNode: (node: Node) => string }
interface Rendition {
  display: (target?: string) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  on: (ev: string, cb: (...a: never[]) => void) => void;
  spread: (mode: string, min?: number) => void;
  hooks: { content: { register: (fn: (c: Contents) => void) => void } };
  themes: {
    default: (rules: object) => void;
    override: (name: string, value: string, priority?: boolean) => void;
    fontSize: (s: string) => void;
  };
  getContents: () => Contents[];
  annotations: {
    highlight: (cfiRange: string, data?: object, cb?: (e: MouseEvent) => void, className?: string, styles?: object) => void;
    remove: (cfiRange: string, type: string) => void;
  };
  location?: { start: { href: string } };
  destroy: () => void;
}
interface EpubBook {
  renderTo: (el: HTMLElement, opts: object) => Rendition;
  ready: Promise<void>;
  loaded: { navigation: Promise<{ toc: { label: string; href: string; subitems?: { label: string; href: string }[] }[] }> };
  locations: { generate: (n: number) => Promise<unknown>; percentageFromCfi: (cfi: string) => number };
  spine: { spineItems: unknown[] };
  destroy: () => void;
}

export function EpubView({ fileUrl, startAt, paper, fontFamily, fontScale, spread, onLocation, onToc, onReady, onError, onKey, highlights, onSelect, onHighlightClick, ref }: ReaderProps & { ref: Ref<ReaderHandle> }) {
  const host = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | null>(null);
  const book = useRef<EpubBook | null>(null);
  // Latest props for epub.js callbacks, which are registered once.
  const cbs = useRef({ onLocation, onToc, onReady, onError, onKey, onSelect, onHighlightClick });
  const [rendered, setRendered] = useState(false);
  const drawn = useRef(new Map<string, ReaderHighlight>());
  const look = useRef({ paper, fontFamily, fontScale, spread });
  useLayoutEffect(() => {
    cbs.current = { onLocation, onToc, onReady, onError, onKey, onSelect, onHighlightClick };
    look.current = { paper, fontFamily, fontScale, spread };
  });

  const showPassage = async (p: PassageTarget) => {
    const r = rendition.current;
    if (!r) return;
    await r.display(p.location);
    const contents = r.getContents()[0];
    if (!contents) return;
    const els = findPassage(contents.document, p.text);
    if (!els.length) return;
    await r.display(contents.cfiFromNode(els[0]));
    // Re-find after the jump (the page may have re-rendered) and let the highlight fade on its own.
    const doc = r.getContents()[0]?.document;
    if (!doc) return;
    doc.querySelectorAll(".wl-cite").forEach((el) => el.classList.remove("wl-cite", "wl-cite-fade"));
    const marks = findPassage(doc, p.text);
    marks.forEach((el) => el.classList.add("wl-cite"));
    window.setTimeout(() => marks.forEach((el) => el.classList.add("wl-cite-fade")), 4500);
  };

  useImperativeHandle(ref, () => ({
    // epub.js rejects when the book is closed mid-turn or a target isn't in the book; neither should surface.
    next: () => void rendition.current?.next().catch(quiet),
    prev: () => void rendition.current?.prev().catch(quiet),
    goTo: (target: string) => void rendition.current?.display(target).catch(quiet),
    showPassage: (p: PassageTarget) => void showPassage(p).catch(quiet),
  }), []);


  const applyLook = () => {
    const r = rendition.current;
    if (!r) return;
    const { paper: p, fontFamily: f, fontScale: s } = look.current;
    r.themes.override("color", p.ink, true);
    r.themes.override("background", "transparent", true);
    r.themes.override("font-family", f, true);
    r.themes.fontSize(`${Math.round(s * 100)}%`);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ePub = (await import("epubjs")).default as unknown as (data: ArrayBuffer) => EpubBook;
        const data = await fetch(fileUrl).then((r) => {
          if (!r.ok) throw new Error(`Could not load the book (${r.status})`);
          return r.arrayBuffer();
        });
        if (cancelled || !host.current) return;
        const b = ePub(data);
        book.current = b;
        const r = b.renderTo(host.current, {
          width: "100%", height: "100%", flow: "paginated", spread: look.current.spread ? "always" : "none",
          gap: 96, allowScriptedContent: false,
        });
        rendition.current = r;

        // Reading fonts inside the iframe, and calm typography that lets the paper show through.
        r.hooks.content.register((c: Contents) => {
          const link = c.document.createElement("link");
          link.rel = "stylesheet";
          link.href = READING_FONTS_URL;
          c.document.head.appendChild(link);
        });
        r.themes.default({
          "body": { "line-height": "1.7 !important", "-webkit-font-smoothing": "antialiased", "text-rendering": "optimizeLegibility" },
          "p, li, blockquote, div, span, h1, h2, h3, h4, h5, h6, td": { "color": "inherit !important", "font-family": "inherit !important", "background-color": "transparent !important" },
          "h1, h2, h3": { "letter-spacing": "0.02em", "line-height": "1.25 !important", "margin": "0.6em 0 0.8em !important" },
          "*": { "background-color": "transparent !important", "border-color": "rgba(128,110,90,.25) !important" },
          "a": { "color": "inherit !important", "background": "none !important", "text-decoration-color": "rgba(128,110,90,.45) !important" },
          "img": { "max-width": "100% !important", "border-radius": "2px" },
          "::selection": { "background": "rgba(196, 140, 60, .3)" },
          // A cited passage: a warm highlighter wash that fades after a few seconds.
          ".wl-cite": { "background-color": "rgba(255, 196, 64, .34) !important", "box-shadow": "0 0 0 4px rgba(255, 196, 64, .34)", "border-radius": "2px", "transition": "background-color 2.5s ease, box-shadow 2.5s ease" },
          ".wl-cite.wl-cite-fade": { "background-color": "rgba(255, 196, 64, .12) !important", "box-shadow": "0 0 0 4px rgba(255, 196, 64, .12)" },
        });
        applyLook();

        r.on("keyup", ((e: KeyboardEvent) => cbs.current.onKey(e.key)) as never);

        let haveLocations = false;
        r.on("relocated", ((loc: Location) => {
          const cfi = loc.start.cfi;
          // Exact whole-book percentage once locations exist; until then, estimate from the chapter index.
          const chapters = Math.max(1, b.spine.spineItems.length);
          const { page, total } = loc.start.displayed;
          const estimate = (loc.start.index + (total > 0 ? (page - 1) / total : 0)) / chapters;
          const progress = haveLocations ? b.locations.percentageFromCfi(cfi) : estimate;
          // With two pages showing, the reader can see one page further.
          const seen = Math.min(total, page + (look.current.spread ? 1 : 0));
          cbs.current.onLocation({
            location: cfi, progress, chapterHref: loc.start.href, page, pageTotal: total,
            chapterFraction: total > 0 ? seen / total : null,
            atStart: !!loc.atStart, atEnd: !!loc.atEnd,
          });
        }) as never);

        await b.ready;
        const nav = await b.loaded.navigation;
        const flat = nav.toc.flatMap((t) => [t, ...(t.subitems ?? [])]);
        cbs.current.onToc(flat.map((t) => ({ title: t.label.trim(), target: t.href })));
        // Selecting text offers the highlight toolbar; clicking anywhere in the page dismisses it.
        r.on("selected", ((cfiRange: string, contents: Contents) => {
          const sel = contents.window.getSelection();
          const text = sel?.toString().trim() ?? "";
          if (!sel || !text || sel.rangeCount === 0) return;
          const box = sel.getRangeAt(0).getBoundingClientRect();
          const frame = (contents.window.frameElement as HTMLElement | null)?.getBoundingClientRect();
          cbs.current.onSelect?.({
            location: cfiRange, text, chapterHref: r.location?.start.href ?? null,
            x: (frame?.left ?? 0) + box.left + box.width / 2, y: (frame?.top ?? 0) + box.top,
          });
        }) as never);
        r.hooks.content.register((c: Contents) => {
          c.document.addEventListener("mousedown", () => cbs.current.onSelect?.(null));
        });

        await r.display(startAt || undefined);
        if (!cancelled) setRendered(true);
        cbs.current.onReady();
        // Work out whole-book percentages in the background (slow on long books).
        // Leaving the reader mid-way closes the book, and epub.js then fails on the pages it was still reading.
        b.locations.generate(1600).then(() => { haveLocations = true; }).catch(quiet);
      } catch (e) {
        if (!cancelled) cbs.current.onError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      rendition.current?.destroy();
      book.current?.destroy();
      rendition.current = null;
      book.current = null;
    };
    // The book loads once; look changes are applied below without reloading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(applyLook, [paper, fontFamily, fontScale]);

  // Keep the drawn highlights in step with the list: add new ones, recolour changed ones, remove deleted ones.
  useEffect(() => {
    const r = rendition.current;
    if (!r || !rendered) return;
    const want = new Map((highlights ?? []).map((h) => [h.id, h]));
    for (const [id, h] of drawn.current) {
      const next = want.get(id);
      if (!next || next.color !== h.color) {
        r.annotations.remove(h.location, "highlight");
        drawn.current.delete(id);
      }
    }
    for (const [id, h] of want) {
      if (drawn.current.has(id)) continue;
      r.annotations.highlight(h.location, { id }, (e: MouseEvent) => {
        const box = (e.target as Element | null)?.getBoundingClientRect();
        cbs.current.onHighlightClick?.(id, box ? box.left + box.width / 2 : e.clientX, box ? box.top : e.clientY);
      }, "wl-hl", { fill: HIGHLIGHT_INK[h.color] ?? HIGHLIGHT_INK.amber, "fill-opacity": "0.32", "mix-blend-mode": "normal" });
      drawn.current.set(id, h);
    }
  }, [highlights, rendered]);
  useEffect(() => { rendition.current?.spread(spread ? "always" : "none"); }, [spread]);

  return <div ref={host} className="book-text" />;
}
