"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { HIGHLIGHT_INK } from "@/reader/EpubView";
import type { ReaderHandle, ReaderProps } from "@/reader/types";

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;

/**
 * A PDF highlight is stored as "page:start-end": character offsets into that page's text layer.
 * The page number alone also works as a jump target, so the highlights list can open it.
 */
const PDF_SPOT = /^(\d+):(\d+)-(\d+)$/;

/** Character offset of a point inside a text layer, counted over its text nodes. */
function offsetIn(layer: HTMLElement, node: Node, offset: number) {
  const r = document.createRange();
  r.setStart(layer, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** The DOM range covering characters start..end of a text layer. */
function rangeIn(layer: HTMLElement, start: number, end: number): Range | null {
  const walk = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let seen = 0;
  let begun = false;
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const len = n.textContent?.length ?? 0;
    if (!begun && start <= seen + len) {
      r.setStart(n, Math.max(0, start - seen));
      begun = true;
    }
    if (begun && end <= seen + len) {
      r.setEnd(n, Math.max(0, end - seen));
      return r;
    }
    seen += len;
  }
  return null;
}

interface Mark { id: string; color: string; page: number; boxes: { left: number; top: number; width: number; height: number }[] }

/** PDF pages laid onto the book's paper; two facing pages on wide screens. Text can be selected and highlighted. */
export function PdfView({ fileUrl, startAt, paper, fontScale, spread, onLocation, onToc, onReady, onError, highlights, onSelect, onHighlightClick, ref }: ReaderProps & { ref: Ref<ReaderHandle> }) {
  const host = useRef<HTMLDivElement>(null);
  const sheets = useRef<(HTMLDivElement | null)[]>([null, null]);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([null, null]);
  const layers = useRef<(HTMLDivElement | null)[]>([null, null]);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [page, setPage] = useState(() => Math.max(1, parseInt(startAt ?? "1", 10) || 1));
  // Bumped each time the text layers are rebuilt, so highlight marks are measured again.
  const [drawnAt, setDrawnAt] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]);
  const step = spread ? 2 : 1;
  const cbs = useRef({ onLocation, onToc, onReady, onError, onSelect, onHighlightClick });
  useLayoutEffect(() => { cbs.current = { onLocation, onToc, onReady, onError, onSelect, onHighlightClick }; });

  useImperativeHandle(ref, () => ({
    next: () => setPage((p) => (doc ? Math.min(doc.numPages, p + step) : p)),
    prev: () => setPage((p) => Math.max(1, p - step)),
    goTo: (target: string) => {
      const n = parseInt(target, 10);
      if (n > 0) setPage(spread && n % 2 === 0 ? Math.max(1, n - 1) : n);
    },
    // A citation opens its page.
    showPassage: (p) => setPage(spread && p.page % 2 === 0 ? Math.max(1, p.page - 1) : p.page),
  }), [doc, step, spread]);

  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        loaded = await pdfjs.getDocument({ url: fileUrl }).promise;
        if (cancelled) return;
        setDoc(loaded);
        setPage((p) => Math.min(loaded!.numPages, p));
        const outline = (await loaded.getOutline()) ?? [];
        const toc = await Promise.all(outline.map(async (o) => {
          try {
            const dest = typeof o.dest === "string" ? await loaded!.getDestination(o.dest) : o.dest;
            const idx = dest ? await loaded!.getPageIndex(dest[0] as never) : 0;
            return { title: o.title, target: String(idx + 1) };
          } catch {
            return null;
          }
        }));
        cbs.current.onToc(toc.filter((t): t is { title: string; target: string } => !!t));
        cbs.current.onReady();
      } catch (e) {
        if (!cancelled) cbs.current.onError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.loadingTask.destroy();
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!doc || !host.current) return;
    let cancelled = false;
    const tasks: { cancel: () => void }[] = [];
    const draw = async (n: number, slot: number, slots: number) => {
      const canvas = canvases.current[slot];
      const layer = layers.current[slot];
      const sheet = sheets.current[slot];
      if (!canvas || !layer || !sheet) return;
      layer.replaceChildren();
      if (n > doc.numPages) {
        sheet.style.visibility = "hidden";
        return;
      }
      sheet.style.visibility = "visible";
      sheet.dataset.page = String(n);
      const p = await doc.getPage(n);
      if (cancelled || !host.current) return;
      const base = p.getViewport({ scale: 1 });
      const box = host.current.getBoundingClientRect();
      const scale = Math.min((box.width / slots - 40) / base.width, (box.height - 24) / base.height) * fontScale;
      const dpr = window.devicePixelRatio || 1;
      const css = p.getViewport({ scale });
      const vp = p.getViewport({ scale: scale * dpr });
      canvas.width = vp.width;
      canvas.height = vp.height;
      sheet.style.width = `${css.width}px`;
      sheet.style.height = `${css.height}px`;
      const task = p.render({ canvas, viewport: vp });
      tasks.push(task);
      await task.promise.catch(() => {});
      if (cancelled) return;
      // The invisible, selectable text that sits exactly over the printed words.
      const { TextLayer } = await import("pdfjs-dist");
      layer.style.setProperty("--total-scale-factor", String(scale));
      const text = new TextLayer({ textContentSource: p.streamTextContent(), container: layer, viewport: css });
      tasks.push(text);
      await text.render().catch(() => {});
    };
    (async () => {
      const slots = spread ? 2 : 1;
      await Promise.all([draw(page, 0, slots), spread ? draw(page + 1, 1, slots) : Promise.resolve()]);
      if (cancelled) return;
      setDrawnAt((d) => d + 1);
      const last = Math.min(doc.numPages, page + step - 1);
      cbs.current.onLocation({
        location: String(page), progress: doc.numPages > 1 ? (last - 1) / (doc.numPages - 1) : 1,
        page: last, pageTotal: doc.numPages, atStart: page <= 1, atEnd: last >= doc.numPages,
      });
    })();
    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
    };
  }, [doc, page, fontScale, spread, step]);

  // Measure where each saved highlight on the visible pages sits.
  useEffect(() => {
    const next: Mark[] = [];
    sheets.current.forEach((sheet, slot) => {
      const layer = layers.current[slot];
      if (!sheet || !layer || sheet.style.visibility === "hidden") return;
      const shown = Number(sheet.dataset.page);
      const origin = sheet.getBoundingClientRect();
      for (const h of highlights ?? []) {
        const m = PDF_SPOT.exec(h.location);
        if (!m || Number(m[1]) !== shown) continue;
        const r = rangeIn(layer, Number(m[2]), Number(m[3]));
        if (!r) continue;
        const boxes = [...r.getClientRects()].filter((b) => b.width > 1 && b.height > 1)
          .map((b) => ({ left: b.left - origin.left, top: b.top - origin.top, width: b.width, height: b.height }));
        if (boxes.length) next.push({ id: h.id, color: h.color, page: shown, boxes });
      }
    });
    // Measuring needs the freshly drawn layout, so it runs here rather than during render.
    setMarks(next);
  }, [highlights, drawnAt]);

  // Selecting words on a page offers the highlight toolbar, like in EPUBs.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const down = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".pdf-mark")) cbs.current.onSelect?.(null);
    };
    const up = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || !text || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const layer = (range.startContainer.parentElement ?? null)?.closest<HTMLElement>(".pdf-text");
      if (!layer || !layer.contains(range.endContainer)) return; // only within one page
      const shown = layer.closest<HTMLElement>(".pdf-sheet")?.dataset.page;
      if (!shown) return;
      const start = offsetIn(layer, range.startContainer, range.startOffset);
      const end = offsetIn(layer, range.endContainer, range.endOffset);
      const box = range.getBoundingClientRect();
      cbs.current.onSelect?.({
        location: `${shown}:${start}-${end}`, text, chapterHref: shown,
        x: box.left + box.width / 2, y: box.top,
      });
    };
    el.addEventListener("mousedown", down);
    el.addEventListener("mouseup", up);
    return () => {
      el.removeEventListener("mousedown", down);
      el.removeEventListener("mouseup", up);
    };
  }, []);

  const night = parseInt(paper.bg.slice(1, 3), 16) < 0x50;
  return (
    <div ref={host} className={`book-text pdf ${spread ? "two" : "one"}`}>
      {(spread ? [0, 1] : [0]).map((slot) => (
        <div key={slot} ref={(el) => { sheets.current[slot] = el; }} className="pdf-sheet">
          <canvas ref={(el) => { canvases.current[slot] = el; }} className={`pdf-page ${night ? "night" : ""}`} />
          <div ref={(el) => { layers.current[slot] = el; }} className="pdf-text" />
          {/* Above the text so a highlight can be clicked; selection starts on unmarked words. */}
          <div className="pdf-marks">
            {marks.filter((m) => m.page === page + slot).flatMap((m) => m.boxes.map((b, i) => (
              <span key={`${m.id}-${i}`} className="pdf-mark"
                style={{ ...b, background: HIGHLIGHT_INK[m.color] ?? HIGHLIGHT_INK.amber }}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  cbs.current.onHighlightClick?.(m.id, r.left + r.width / 2, r.top);
                }} />
            )))}
          </div>
        </div>
      ))}
    </div>
  );
}
