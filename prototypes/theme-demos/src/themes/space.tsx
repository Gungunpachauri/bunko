import type { Theme } from "./types";
import { Glow, SpineTitle, rng, range, shade, rectPath, circlePath } from "./art";

const C = {
  void: "#05040d",
  hull: "#1a1f33",
  hullLight: "#2a3150",
  hullDark: "#10131f",
  cyan: "#5fd0ff",
  amber: "#ffb35a",
  violet: "#8a6aff",
  white: "#e8ecff",
};
const FONT = "Orbitron, sans-serif";
const BODY = "Space Grotesk, sans-serif";

function Stars({ W, H, n, seed }: { W: number; H: number; n: number; seed: number }) {
  const r = rng(seed);
  return (
    <g>
      {range(n).map((i) => (
        <circle key={i} cx={r() * W} cy={r() * H} r={r() * 1.5 + 0.3} fill={i % 7 ? "#fff" : "#9fd4ff"} opacity={0.35 + r() * 0.65}
          className={i % 5 === 0 ? "twinkle" : undefined} style={i % 5 === 0 ? { animationDelay: `${(i % 11) * 0.3}s` } : undefined} />
      ))}
    </g>
  );
}

/** Black hole with a tilted accretion disk and a photon ring. */
function BlackHole({ x, y, s = 1, id }: { x: number; y: number; s?: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <defs>
        <linearGradient id={`${id}-disk`} x1="0" x2="1">
          <stop offset="0" stopColor="#ff5a2a" stopOpacity="0" />
          <stop offset="0.25" stopColor="#ff8a3a" />
          <stop offset="0.5" stopColor="#fff2c8" />
          <stop offset="0.75" stopColor="#ff8a3a" />
          <stop offset="1" stopColor="#ff5a2a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Glow id={`${id}-halo`} cx={0} cy={0} r={260} color="#ff9a4a" opacity={0.35} />
      {/* back half of the disk, bent over the top by gravity */}
      <ellipse cx={0} cy={0} rx={110} ry={96} fill="none" stroke={`url(#${id}-disk)`} strokeWidth={14} opacity={0.75} />
      <ellipse cx={0} cy={0} rx={300} ry={46} fill="none" stroke={`url(#${id}-disk)`} strokeWidth={30} opacity={0.9} />
      <circle cx={0} cy={0} r={74} fill="#000" />
      <circle cx={0} cy={0} r={78} fill="none" stroke="#ffe2a8" strokeWidth={3} opacity={0.9} />
      {/* front half of the disk crosses in front of the shadow */}
      <path d="M-300 0 A300 46 0 0 0 300 0" fill="none" stroke={`url(#${id}-disk)`} strokeWidth={30} />
    </g>
  );
}

function Planet({ x, y, r, color, ring = false }: { x: number; y: number; r: number; color: string; ring?: boolean }) {
  return (
    <g>
      {ring && <ellipse cx={x} cy={y} rx={r * 2} ry={r * 0.45} fill="none" stroke="#d9c7a0" strokeWidth={r * 0.18} opacity={0.6} />}
      <circle cx={x} cy={y} r={r} fill={color} />
      <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r} fill="#ffffff10" />
      <path d={`M${x - r} ${y} A${r} ${r} 0 0 0 ${x + r} ${y}`} fill="#00000040" />
      {ring && <path d={`M${x - r * 2} ${y} A${r * 2} ${r * 0.45} 0 0 0 ${x + r * 2} ${y}`} fill="none" stroke="#d9c7a0" strokeWidth={r * 0.18} opacity={0.75} />}
    </g>
  );
}

function Backdrop() {
  const W = 3200;
  return (
    <svg width={W} height={900} viewBox={`0 0 ${W} 900`}>
      <rect width={W} height={900} fill={C.void} />
      <Glow id="sp-neb1" cx={700} cy={300} r={520} color="#6a2aaa" opacity={0.35} />
      <Glow id="sp-neb2" cx={2300} cy={500} r={640} color="#1a6a9a" opacity={0.3} />
      <Glow id="sp-neb3" cx={1500} cy={150} r={380} color="#aa3a6a" opacity={0.18} />
      <Stars W={W} H={900} n={360} seed={3} />
      <BlackHole x={1150} y={360} s={1.1} id="sp-bh" />
      <Planet x={2500} y={230} r={60} color="#c98a5a" ring />
      <Planet x={2680} y={330} r={16} color="#8a9ab0" />
      <Planet x={300} y={620} r={34} color="#3a6a8a" />
    </svg>
  );
}

function Grating({ w }: { w: number }) {
  return (
    <g>
      <rect x={0} y={780} width={w} height={120} fill="#12152a" />
      {range(Math.ceil(w / 60) + 1).map((i) => <line key={i} x1={i * 60} x2={i * 60 + (i * 60 - w / 2) * 0.16} y1={780} y2={900} stroke="#22284a" strokeWidth={2} />)}
      {[804, 836, 874].map((y) => <line key={y} x1={0} x2={w} y1={y} y2={y} stroke="#22284a" strokeWidth={2} />)}
      <rect x={0} y={776} width={w} height={4} fill={C.cyan} opacity={0.8} />
    </g>
  );
}

function Panels({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      {range(Math.ceil(w / 120)).map((i) => range(Math.ceil(h / 140)).map((j) => (
        <rect key={`${i}-${j}`} x={x + i * 120 + 4} y={y + j * 140 + 4} width={112} height={132} rx={6} fill="none" stroke="#2a3150" strokeWidth={2} />
      )))}
    </g>
  );
}

function Room({ room, index }: { room: "fiction" | "selfhelp"; index: number }) {
  const id = `sp-r${index}`;
  if (room === "fiction") {
    const wall = [rectPath(0, -500, 1600, 1280), rectPath(80, 170, 340, 460), rectPath(1180, 170, 340, 460)].join(" ");
    return (
      <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
        <path d={wall} fill={C.hull} fillRule="evenodd" />
        <Panels x={0} y={-500} w={1600} h={1280} />
        {[80, 1180].map((x) => (
          <g key={x}>
            <rect x={x} y={170} width={340} height={460} rx={24} fill="none" stroke={C.hullLight} strokeWidth={22} />
            <rect x={x} y={170} width={340} height={460} rx={24} fill="none" stroke={C.cyan} strokeWidth={2} opacity={0.7} />
            <line x1={x + 170} x2={x + 170} y1={170} y2={630} stroke={C.hullLight} strokeWidth={8} />
          </g>
        ))}
        {/* holographic ring display above the shelf */}
        <g opacity={0.85}>
          <Glow id={`${id}-holo`} cx={800} cy={170} r={140} color={C.cyan} opacity={0.35} className="pulse" />
          <ellipse cx={800} cy={170} rx={90} ry={22} fill="none" stroke={C.cyan} strokeWidth={2} />
          <ellipse cx={800} cy={170} rx={60} ry={14} fill="none" stroke={C.cyan} strokeWidth={1.5} opacity={0.7} />
        </g>
        {[200, 800, 1400].map((x) => <rect key={x} x={x - 120} y={40} width={240} height={10} rx={5} fill={C.white} opacity={0.85} />)}
        <Glow id={`${id}-wash`} cx={800} cy={60} r={600} color={C.cyan} opacity={0.08} />
        <Grating w={1600} />
      </svg>
    );
  }
  const wall = [rectPath(0, -500, 1600, 1280), circlePath(800, 40, 230), rectPath(90, 220, 220, 400), rectPath(1290, 220, 220, 400)].join(" ");
  return (
    <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
      <path d={wall} fill={C.hull} fillRule="evenodd" />
      <Panels x={0} y={-500} w={1600} h={1280} />
      <circle cx={800} cy={40} r={230} fill="none" stroke={C.hullLight} strokeWidth={26} />
      <circle cx={800} cy={40} r={230} fill="none" stroke={C.violet} strokeWidth={2} opacity={0.8} />
      {/* hydroponic pods */}
      {[200, 1400].map((x) => (
        <g key={x}>
          <rect x={x - 110} y={220} width={220} height={400} rx={30} fill="none" stroke={C.hullLight} strokeWidth={16} />
          <rect x={x - 100} y={230} width={200} height={380} rx={24} fill="#3aff9a" opacity={0.07} />
          {range(5).map((k) => (
            <path key={k} d={`M${x - 60 + k * 30} 600 q${(k % 2 ? 1 : -1) * 20} -120 0 -${200 + (k % 3) * 60}`} stroke="#5adf8a" strokeWidth={5} fill="none" />
          ))}
          <Glow id={`${id}-pod${x}`} cx={x} cy={420} r={160} color="#5adf8a" opacity={0.2} />
        </g>
      ))}
      <Grating w={1600} />
    </svg>
  );
}

function Threshold() {
  return (
    <svg width={300} height={1400} viewBox="-150 -500 300 1400" style={{ overflow: "visible" }}>
      <path d={[rectPath(-170, -500, 340, 1280), "M-110 780 V200 L-60 130 H60 L110 200 V780Z"].join(" ")} fill={C.hullDark} fillRule="evenodd" />
      <path d="M-110 780 V200 L-60 130 H60 L110 200 V780" fill="none" stroke={C.hullLight} strokeWidth={18} />
      <path d="M-110 780 V200 L-60 130 H60 L110 200 V780" fill="none" stroke={C.amber} strokeWidth={2} />
      {range(8).map((i) => <path key={i} d={`M${-150} ${300 + i * 60} l20 -20 h12 l-20 20Z`} fill={C.amber} opacity={0.8} />)}
      {range(8).map((i) => <path key={`r${i}`} d={`M${118} ${300 + i * 60} l20 -20 h12 l-20 20Z`} fill={C.amber} opacity={0.8} />)}
      <circle cx={0} cy={110} r={8} fill="#5aff9a" className="pulse" />
    </svg>
  );
}

function Shelf() {
  return (
    <svg width={520} height={480} viewBox="0 0 520 480" style={{ overflow: "visible" }}>
      <rect x={0} y={0} width={520} height={480} fill="#0b0e1c" />
      {range(13).map((i) => <line key={i} x1={i * 40 + 20} x2={i * 40 + 20} y1={0} y2={480} stroke="#16203a" strokeWidth={1} />)}
      {range(12).map((i) => <line key={`h${i}`} x1={0} x2={520} y1={i * 40 + 20} y2={i * 40 + 20} stroke="#16203a" strokeWidth={1} />)}
      {[[0, 0, 520, 36], [0, 236, 520, 20], [0, 456, 520, 24], [0, 0, 20, 480], [500, 0, 20, 480]].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={C.hullLight} />
      ))}
      {[36, 256].map((y) => <rect key={y} x={20} y={y} width={480} height={2} fill={C.cyan} opacity={0.9} />)}
      <rect x={-2} y={-2} width={524} height={484} fill="none" stroke={C.cyan} strokeWidth={1.5} opacity={0.6} />
      <ellipse cx={260} cy={486} rx={300} ry={8} fill={C.cyan} opacity={0.12} />
    </svg>
  );
}

function Spine({ book }: { book: { id: string; w: number; h: number; color: string; spineTitle: string } }) {
  const { w, h, color } = book;
  const gid = `sp-sp-${book.id}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1">
          <stop offset="0" stopColor={shade(color, -0.6)} />
          <stop offset="0.5" stopColor={shade(color, -0.25)} />
          <stop offset="1" stopColor={shade(color, -0.7)} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} rx={3} fill={`url(#${gid})`} />
      <rect y={12} width={w} height={3} fill={C.cyan} opacity={0.9} />
      <rect y={h - 15} width={w} height={3} fill={C.amber} opacity={0.9} />
      <SpineTitle w={w} h={h - 30} y0={18} text={book.spineTitle.toUpperCase()} font={FONT} color={C.white} size={11} weight={700} spacing={1.4} />
      <circle cx={w / 2} cy={h - 6} r={2} fill="#fff" />
    </svg>
  );
}

function Ornament({ row, w, h }: { row: 0 | 1; w: number; h: number }) {
  const cx = w / 2;
  if (row === 0) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <rect x={cx - 18} y={h - 10} width={36} height={10} rx={3} fill={C.hullLight} />
        <rect x={cx - 2} y={h - 40} width={4} height={30} fill={C.hullLight} />
        <Planet x={cx} y={h - 70} r={24} color="#c98a5a" ring />
      </svg>
    );
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <path d={`M${cx} ${h - 120} q22 30 18 80 h-36 q-4 -50 18 -80Z`} fill="#e8ecff" />
      <circle cx={cx} cy={h - 76} r={8} fill={C.cyan} />
      <path d={`M${cx - 18} ${h - 50} l-14 30 h14Z M${cx + 18} ${h - 50} l14 30 h-14Z`} fill="#d0503a" />
      <path className="flicker" d={`M${cx - 10} ${h - 40} q10 40 20 0Z`} fill={C.amber} />
    </svg>
  );
}

function Foreground() {
  return (
    <svg width={3840} height={900} viewBox="0 0 3840 900" style={{ overflow: "visible" }}>
      {[[300, 120], [1300, 90], [2150, 130], [3250, 100]].map(([x, y], i) => (
        <g key={x} className="float" style={{ animationDelay: `${i * 0.8}s` }}>
          <Glow id={`sp-fg${i}`} cx={x} cy={y} r={70} color={C.cyan} opacity={0.4} />
          <rect x={x - 26} y={y - 10} width={52} height={20} rx={4} fill={C.hullLight} />
          <rect x={x - 70} y={y - 6} width={36} height={12} fill="#3a5aaa" />
          <rect x={x + 34} y={y - 6} width={36} height={12} fill="#3a5aaa" />
          <circle cx={x} cy={y} r={5} fill={C.cyan} />
        </g>
      ))}
      {[[0, 1], [3520, -1], [1880, 1]].map(([x, f]) => (
        <g key={x} transform={`translate(${x} 900) scale(${f} 1)`}>
          <path d="M0 0 V-130 L110 -170 V0Z" fill={C.hullDark} />
          <rect x={14} y={-150} width={80} height={46} rx={4} fill={C.cyan} opacity={0.25} />
          <rect x={22} y={-140} width={40} height={4} fill={C.cyan} />
          <rect x={22} y={-128} width={60} height={4} fill={C.cyan} opacity={0.6} />
        </g>
      ))}
    </svg>
  );
}

function Facade() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <rect width={1600} height={900} fill={C.void} />
      <Glow id="sp-ef1" cx={400} cy={200} r={500} color="#6a2aaa" opacity={0.35} />
      <Glow id="sp-ef2" cx={1300} cy={300} r={500} color="#1a6a9a" opacity={0.3} />
      <Stars W={1600} H={900} n={220} seed={9} />
      <BlackHole x={1180} y={210} s={0.9} id="sp-ebh" />
      {/* station hull */}
      <path d="M300 900 V300 L460 180 H1140 L1300 300 V900Z" fill={C.hull} />
      <Panels x={300} y={180} w={1000} h={720} />
      <path d="M300 300 L460 180 H1140 L1300 300" fill="none" stroke={C.cyan} strokeWidth={3} opacity={0.6} />
      <rect x={640} y={208} width={320} height={52} rx={8} fill={C.hullDark} stroke={C.cyan} strokeWidth={2} />
      <text x={800} y={243} textAnchor="middle" fontFamily={FONT} fontSize={22} fontWeight={700} letterSpacing={8} fill={C.cyan}>LIBRARY · STATION</text>
      {/* door frame with chevrons */}
      <rect x={596} y={276} width={408} height={504} rx={10} fill={C.hullDark} />
      {range(7).map((i) => <path key={i} d={`M575 ${330 + i * 64} l20 -16 v10 l-12 10 l12 10 v10Z`} fill={C.amber} />)}
      {range(7).map((i) => <path key={`r${i}`} d={`M1025 ${330 + i * 64} l-20 -16 v10 l12 10 l-12 10 v10Z`} fill={C.amber} />)}
      {/* landing pad */}
      <rect x={0} y={780} width={1600} height={120} fill="#0d1022" />
      <path d="M520 780 L1080 780 L1260 900 L340 900Z" fill="#161b34" />
      {range(9).map((i) => <circle key={i} cx={360 + i * 110} cy={860} r={5} fill={i % 2 ? C.cyan : C.amber} className="pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
      <Planet x={180} y={180} r={40} color="#3a6a8a" />
    </svg>
  );
}

function FacadeFront() {
  return (
    <g>
      <rect x={612} y={292} width={376} height={6} fill={C.cyan} opacity={0.9} />
      <rect x={612} y={292} width={4} height={488} fill={C.cyan} opacity={0.6} />
      <rect x={984} y={292} width={4} height={488} fill={C.cyan} opacity={0.6} />
    </g>
  );
}

function Door({ side }: { side: "left" | "right" }) {
  return (
    <g>
      <rect width={180} height={480} fill="#2a3150" />
      {range(4).map((i) => <rect key={i} x={14} y={16 + i * 116} width={152} height={100} rx={6} fill="none" stroke="#3a4570" strokeWidth={3} />)}
      {range(6).map((i) => (
        <path key={i} d={side === "left" ? `M180 ${200 + i * 14} l-40 0 l-10 7 l10 7 l40 0Z` : `M0 ${200 + i * 14} l40 0 l10 7 l-10 7 l-40 0Z`} fill={i % 2 ? "#1a1f33" : C.amber} />
      ))}
      <rect x={side === "left" ? 176 : 0} width={4} height={480} fill={C.cyan} opacity={0.9} />
    </g>
  );
}

function Librarian() {
  return (
    <svg width={96} height={110} viewBox="0 0 96 110">
      <line x1={48} y1={14} x2={48} y2={2} stroke="#c9d0e8" strokeWidth={3} />
      <circle cx={48} cy={3} r={4} fill={C.amber} className="pulse" />
      <circle cx={48} cy={42} r={30} fill="#e8ecff" />
      <path d="M26 42 a22 18 0 0 1 44 0 a22 14 0 0 1 -44 0Z" fill="#141a33" />
      <path d="M32 36 q8 -8 18 -6" stroke={C.cyan} strokeWidth={3} fill="none" opacity={0.8} />
      <circle cx={40} cy={44} r={3.5} fill={C.cyan} />
      <circle cx={56} cy={44} r={3.5} fill={C.cyan} />
      <rect x={28} y={70} width={40} height={32} rx={12} fill="#c9d0e8" />
      <rect x={38} y={80} width={20} height={8} rx={3} fill={C.violet} />
      <path d="M28 80 q-12 6 -10 18 M68 80 q12 6 10 18" stroke="#c9d0e8" strokeWidth={7} fill="none" strokeLinecap="round" />
    </svg>
  );
}

export const space: Theme = {
  id: "space",
  name: "Space",
  tagline: "A library station orbiting a black hole, among the stars",
  vars: {
    "--bg": "#05040d",
    "--ink": "#e8ecff",
    "--paper": "#e8ecff",
    "--accent": "#ff8a3a",
    "--accent-2": "#5fd0ff",
    "--muted": "#9aa3c7",
    "--card-bg": "#11142a",
    "--card-edge": "#3a4580",
    "--chip-bg": "rgba(8,8,22,.72)",
    "--chip-ink": "#e8ecff",
    "--sign-ink": "#e8ecff",
  },
  fonts: { display: FONT, body: BODY },
  rooms: {
    fiction: { title: "Fiction", subtitle: "Observation deck" },
    selfhelp: { title: "Self-help", subtitle: "Zero-g garden" },
  },
  entrance: {
    door: "slide",
    Facade,
    FacadeFront,
    Door,
    insideGlow: "#bfe4ff",
    title: "Event Horizon Library",
    hint: "Docking clearance granted",
  },
  hall: { Backdrop, Room, Threshold, Shelf, Spine, Ornament, Foreground },
  particles: { kind: "sparkles", colors: ["#ffffff", "#9fd4ff", "#ffcf8a"], count: 70 },
  book3d: { coverStyle: "space", paper: "#e9ecf5", endpaper: "#0b0d22", light: "#9fc4ff", ambient: 0.75 },
  librarian: { name: "Nova", Art: Librarian, greeting: "Welcome aboard. The black hole is beautiful tonight, and a little hungry. Shall we read something about it?" },
};
