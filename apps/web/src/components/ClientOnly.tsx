"use client";

import dynamic from "next/dynamic";

/** What shows while a page's code is still loading, so it never opens on a blank screen. */
export function Loading({ text }: { text: string }) {
  return <div className="app world loading-screen" role="status"><div className="loading-box"><p className="loading-text">{text}</p></div></div>;
}

// The library and reader use WebGL, canvas and browser storage, so they render only in the browser.
export const LibraryClient = dynamic(() => import("@/library/LibraryApp"), {
  ssr: false,
  loading: () => <Loading text="Opening the library…" />,
});

export const ReaderClient = dynamic(() => import("@/reader/ReaderApp"), {
  ssr: false,
  loading: () => <Loading text="Opening your book…" />,
});

export const MapClient = dynamic(() => import("@/map/ReadingMap"), {
  ssr: false,
  loading: () => <Loading text="Charting your stars…" />,
});
