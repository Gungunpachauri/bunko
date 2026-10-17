/** Thin line icons for the top bar, drawn to match each other (24px grid, 1.8 stroke). */

const base = { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconSearch = () => (
  <svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
);

/** A small constellation: the reading map. */
export const IconMap = () => (
  <svg {...base}><circle cx="5.5" cy="7" r="1.6" /><circle cx="17.5" cy="5.5" r="1.6" /><circle cx="12" cy="13" r="2" /><circle cx="18.5" cy="18.5" r="1.6" /><path d="M7 7.8l3.5 3.8M16.3 6.7l-3.2 4.6M13.6 14.4l3.6 3" /></svg>
);

/** Two cards: review. */
export const IconReview = () => (
  <svg {...base}><rect x="4" y="7" width="13" height="13" rx="2.5" /><path d="M8 4h9.5A2.5 2.5 0 0 1 20 6.5V16" /><path d="M8 13.5l2.2 2.2L14 11.8" /></svg>
);

/** A clock with a turning arrow: the library over time. */
export const IconTimeline = () => (
  <svg {...base}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4 4.5v3.2h3.2" /><path d="M12 8v4.2l2.8 1.8" /></svg>
);

export const IconPlus = () => (
  <svg {...base}><path d="M12 5v14M5 12h14" /></svg>
);

export const IconPlay = () => (
  <svg {...base} fill="currentColor" stroke="none"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
);
