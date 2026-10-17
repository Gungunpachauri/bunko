"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import type { ReaderHandle, ReaderProps } from "@/reader/types";

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;

/** PDF pages laid onto the book's paper; two facing pages on wide screens. */
export function PdfView({ fileUrl, startAt, paper, fontScale, spread, onLocation, onToc, onReady, onError, ref }: ReaderProps & { ref: Ref<ReaderHandle> }) {
  const host = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLCanvasElement>(null);
  const right = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [page, setPage] = useState(() => Math.max(1, parseInt(startAt ?? "1", 10) || 1));
  const step = spread ? 2 : 1;
  const cbs = useRef({ onLocation, onToc, onReady, onError });
  useLayoutEffect(() => { cbs.current = { onLocation, onToc, onReady, onError }; });

  useImperativeHandle(ref, () => ({
    next: () => setPage((p) => (doc ? Math.min(doc.numPages, p + step) : p)),
    prev: () => setPage((p) => Math.max(1, p - step)),
    goTo: (target: string) => {
      const n = parseInt(target, 10);
      if (n > 0) setPage(n);
    },
    // PDF pages are drawn as images, so a citation opens its page (no paragraph highlight).
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
    const tasks: { cancel: () => void; promise: Promise<void> }[] = [];
    const draw = async (n: number, canvas: HTMLCanvasElement | null, slots: number) => {
      if (!canvas) return;
      if (n > doc.numPages) {
        canvas.style.visibility = "hidden";
        return;
      }
      canvas.style.visibility = "visible";
      const p = await doc.getPage(n);
      if (cancelled || !host.current) return;
      const base = p.getViewport({ scale: 1 });
      const box = host.current.getBoundingClientRect();
      const scale = Math.min((box.width / slots - 40) / base.width, (box.height - 24) / base.height) * fontScale;
      const dpr = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: scale * dpr });
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = `${vp.width / dpr}px`;
      canvas.style.height = `${vp.height / dpr}px`;
      const task = p.render({ canvas, viewport: vp });
      tasks.push(task);
      await task.promise.catch(() => {});
    };
    (async () => {
      const slots = spread ? 2 : 1;
      await Promise.all([draw(page, left.current, slots), spread ? draw(page + 1, right.current, slots) : Promise.resolve()]);
      if (cancelled) return;
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

  const night = parseInt(paper.bg.slice(1, 3), 16) < 0x50;
  return (
    <div ref={host} className={`book-text pdf ${spread ? "two" : "one"}`}>
      <canvas ref={left} className={`pdf-page ${night ? "night" : ""}`} />
      {spread && <canvas ref={right} className={`pdf-page ${night ? "night" : ""}`} />}
    </div>
  );
}
