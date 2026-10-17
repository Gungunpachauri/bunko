// Small drawing helpers shared by the theme skins.

/** Deterministic pseudo-random generator, so the drawn theme art looks the same on every visit. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt))));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Soft radial glow. `id` must be unique on the page. */
export function Glow({ id, cx, cy, r, color, opacity = 0.8, className }: {
  id: string; cx: number; cy: number; r: number; color: string; opacity?: number; className?: string;
}) {
  return (
    <g className={className}>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
    </g>
  );
}

/** Vertical linear gradient def. */
export function VGrad({ id, stops }: { id: string; stops: [number, string, number?][] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stops.map(([o, c, op], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </linearGradient>
  );
}

/** Spine title text, rotated to read bottom-to-top like an English spine. */
export function SpineTitle({ w, h, text, font, color, size = 15, y0 = 0, y1 = 0, weight = 600, spacing = 0.5 }: {
  w: number; h: number; text: string; font: string; color: string; size?: number;
  y0?: number; y1?: number; weight?: number; spacing?: number;
}) {
  const cy = y0 + (h - y0 - y1) / 2;
  const maxLen = h - y0 - y1 - 16;
  return (
    <text
      x={0}
      y={0}
      transform={`translate(${w / 2} ${cy}) rotate(-90)`}
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      fontFamily={font}
      fontSize={Math.min(size, w * 0.32)}
      fontWeight={weight}
      letterSpacing={spacing}
      textLength={text.length * size * 0.56 > maxLen ? maxLen : undefined}
      lengthAdjust="spacingAndGlyphs"
    >
      {text}
    </text>
  );
}

/** Rectangle with a hole (evenodd) — used for walls with windows. */
export function rectPath(x: number, y: number, w: number, h: number) {
  return `M${x} ${y}h${w}v${h}h${-w}Z`;
}

export function circlePath(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

/** Rectangle with a semicircular top. */
export function archPath(x: number, y: number, w: number, h: number) {
  const r = w / 2;
  return `M${x} ${y + h}V${y + r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h}Z`;
}

/** Gothic pointed arch. */
export function pointedArchPath(x: number, y: number, w: number, h: number) {
  const r = w * 0.85;
  return `M${x} ${y + h}V${y + w * 0.55}A${r} ${r} 0 0 1 ${x + w / 2} ${y}A${r} ${r} 0 0 1 ${x + w} ${y + w * 0.55}V${y + h}Z`;
}
