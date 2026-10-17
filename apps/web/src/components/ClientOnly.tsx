"use client";

import dynamic from "next/dynamic";

// The library and reader use WebGL, canvas and browser storage, so they render only in the browser.
export const LibraryClient = dynamic(() => import("@/library/LibraryApp"), {
  ssr: false,
  loading: () => <div className="app world loading-screen"><div className="loading-box"><p>Opening the library…</p></div></div>,
});

export const ReaderClient = dynamic(() => import("@/reader/ReaderApp"), {
  ssr: false,
  loading: () => <div className="room" />,
});

export const MapClient = dynamic(() => import("@/map/ReadingMap"), {
  ssr: false,
  loading: () => <div className="map-page" />,
});
