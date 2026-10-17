import type { Theme } from "./types";
import { Glow, VGrad, SpineTitle, rng, range, shade, rectPath, circlePath, pointedArchPath } from "./art";

const C = {
  deep: "#1b1433",
  stone: "#4a4366",
  stoneDark: "#2f2a48",
  stoneLight: "#5d5680",
  gold: "#e3b75a",
  arcane: "#7fe3ff",
  candle: "#ffcf7a",
  wood: "#3a2418",
  violet: "#5a2f7a",
};
const FONT = "Cinzel, serif";
const BODY = "EB Garamond, serif";
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

function Stars({ W, H, n, seed }: { W: number; H: number; n: number; seed: number }) {
  const r = rng(seed);
  return (
    <g>
      {range(n).map((i) => (
        <circle key={i} cx={r() * W} cy={r() * H} r={r() * 1.6 + 0.3} fill="#fff" className={i % 4 === 0 ? "twinkle" : undefined}
          style={i % 4 === 0 ? { animationDelay: `${(i % 9) * 0.37}s` } : undefined} opacity={0.4 + r() * 0.6} />
      ))}
    </g>
  );
}

function Candle({ x, y, h = 50, id, delay = 0 }: { x: number; y: number; h?: number; id: string; delay?: number }) {
  return (
    <g className="float" style={{ animationDelay: `${delay}s` }}>
      <Glow id={id} cx={x} cy={y - 10} r={60} color={C.candle} opacity={0.55} className="flicker" />
      <rect x={x - 8} y={y} width={16} height={h} rx={3} fill="#efe6d2" />
      <path d={`M${x - 8} ${y + 4} q4 10 0 18`} stroke="#d9cdb4" strokeWidth={3} fill="none" />
      <path className="flicker" d={`M${x} ${y - 2} c-6 -8 -3 -18 0 -24 c3 6 6 16 0 24Z`} fill={C.candle} />
    </g>
  );
}

function Torch({ x, y, id }: { x: number; y: number; id: string }) {
  return (
    <g>
      <Glow id={id} cx={x} cy={y - 30} r={130} color="#ff9a4a" opacity={0.5} className="flicker" />
      <path d={`M${x - 14} ${y} h28 l-6 40 h-16Z`} fill="#2a2420" />
      <rect x={x - 3} y={y + 40} width={6} height={30} fill="#2a2420" />
      <path className="flicker" d={`M${x} ${y} c-16 -16 -8 -40 0 -54 c4 14 18 26 0 54Z`} fill="#ffb347" />
      <path d={`M${x} ${y - 4} c-6 -8 -3 -20 0 -26 c2 8 6 16 0 26Z`} fill="#fff0b0" />
    </g>
  );
}

function StoneBlocks({ w, y0, y1, seed }: { w: number; y0: number; y1: number; seed: number }) {
  const r = rng(seed);
  return (
    <g stroke={C.stoneDark} strokeWidth={3}>
      {range(Math.ceil((y1 - y0) / 56)).map((row) => {
        const y = y0 + row * 56;
        const off = row % 2 ? 60 : 0;
        return (
          <g key={row}>
            <line x1={0} x2={w} y1={y} y2={y} />
            {range(Math.ceil(w / 120) + 1).map((k) => <line key={k} x1={k * 120 + off} x2={k * 120 + off} y1={y} y2={y + 56} />)}
            {range(3).map((k) => <rect key={`s${k}`} x={r() * w} y={y + 4} width={40 + r() * 60} height={48} fill="#ffffff06" stroke="none" />)}
          </g>
        );
      })}
    </g>
  );
}

function RuneCircle({ cx, cy, r, id }: { cx: number; cy: number; r: number; id: string }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(1 0.3)`}>
      <Glow id={id} cx={0} cy={0} r={r * 1.4} color={C.arcane} opacity={0.35} className="pulse" />
      <circle r={r} fill="none" stroke={C.arcane} strokeWidth={5} opacity={0.85} />
      <circle r={r * 0.82} fill="none" stroke={C.arcane} strokeWidth={2} opacity={0.6} />
      <path d={range(6).map((i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return `${i ? "L" : "M"}${Math.cos(a) * r * 0.8} ${Math.sin(a) * r * 0.8}`; }).join(" ") + "Z"} fill="none" stroke={C.arcane} strokeWidth={2} opacity={0.6} />
      {range(16).map((i) => {
        const a = (i / 16) * Math.PI * 2;
        return <text key={i} x={Math.cos(a) * r * 0.91} y={Math.sin(a) * r * 0.91 + 8} textAnchor="middle" fontSize={24} fill={C.arcane} opacity={0.8}>{RUNES[i]}</text>;
      })}
    </g>
  );
}

function Banner({ x, y, h = 260 }: { x: number; y: number; h?: number }) {
  return (
    <g className="sway-slow" style={{ transformOrigin: `${x + 40}px ${y}px` }}>
      <rect x={x - 6} y={y - 8} width={92} height={10} rx={4} fill={C.gold} />
      <path d={`M${x} ${y} h80 v${h} l-40 -30 l-40 30Z`} fill={C.violet} />
      <path d={`M${x + 6} ${y} v${h - 8}`} stroke={C.gold} strokeWidth={2} />
      <path d={`M${x + 74} ${y} v${h - 8}`} stroke={C.gold} strokeWidth={2} />
      <path d={`M${x + 40} ${y + 60} l14 26 l28 4 l-20 20 l6 28 l-28 -14 l-28 14 l6 -28 l-20 -20 l28 -4Z`} fill={C.gold} />
    </g>
  );
}

function FloatingIsland({ x, y, s, tower }: { x: number; y: number; s: number; tower?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#241a3e">
      <path d="M-120 0 Q0 -20 120 0 L60 40 L20 110 L-10 60 L-60 50Z" />
      <path d="M-110 -2 Q0 -26 110 -2 Q0 8 -110 -2Z" fill="#2f3a4a" />
      {tower && (
        <g>
          <rect x={-20} y={-120} width={40} height={110} />
          <path d="M-30 -120 L0 -180 L30 -120Z" />
          <rect x={-5} y={-90} width={10} height={16} fill={C.candle} opacity={0.9} />
        </g>
      )}
    </g>
  );
}

function Backdrop() {
  const W = 3200;
  return (
    <svg width={W} height={900} viewBox={`0 0 ${W} 900`}>
      <defs>
        <VGrad id="fn-sky" stops={[[0, "#0b0820"], [0.6, "#2a1a4a"], [1, "#4a2a5a"]]} />
      </defs>
      <rect width={W} height={900} fill="url(#fn-sky)" />
      <Glow id="fn-neb1" cx={600} cy={300} r={500} color="#7a3aaa" opacity={0.3} />
      <Glow id="fn-neb2" cx={2200} cy={250} r={600} color="#2a8aaa" opacity={0.22} />
      <Stars W={W} H={700} n={260} seed={2} />
      <circle cx={1000} cy={220} r={120} fill="#f3eedd" />
      <Glow id="fn-moon" cx={1000} cy={220} r={300} color="#cfc8ff" opacity={0.3} />
      {[[960, 200, 20], [1050, 260, 14], [1030, 170, 9]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} fill="#ddd6c4" />)}
      <FloatingIsland x={420} y={460} s={0.9} tower />
      <FloatingIsland x={1700} y={380} s={0.6} />
      <FloatingIsland x={2700} y={480} s={1.1} tower />
      {/* distant castle on a mountain */}
      <path d="M1900 900 L2200 560 L2380 640 L2600 520 L2900 900Z" fill="#1e1636" />
      <g fill="#1e1636" transform="translate(2420 560)">
        {[[-60, 120], [-20, 170], [20, 140], [60, 110]].map(([x, h]) => (
          <g key={x}>
            <rect x={x - 12} y={-h} width={24} height={h} />
            <path d={`M${x - 16} ${-h} L${x} ${-h - 40} L${x + 16} ${-h}Z`} />
          </g>
        ))}
      </g>
      <path d="M0 820 Q800 760 1600 800 T3200 790 V900 H0Z" fill="#140f28" />
    </svg>
  );
}

function Room({ room, index }: { room: "fiction" | "selfhelp"; index: number }) {
  const id = `fn-r${index}`;
  if (room === "fiction") {
    const holes = [pointedArchPath(140, 200, 200, 430), pointedArchPath(1260, 200, 200, 430)];
    const wall = [rectPath(0, -500, 1600, 1280), ...holes].join(" ");
    return (
      <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
        <defs>
          <clipPath id={`${id}-clip`}><path d={wall} clipRule="evenodd" /></clipPath>
        </defs>
        <path d={wall} fill={C.stone} fillRule="evenodd" />
        <g clipPath={`url(#${id}-clip)`}><StoneBlocks w={1600} y0={-500} y1={780} seed={index + 3} /></g>
        {holes.map((d, i) => (
          <g key={i}>
            <path d={d} fill="none" stroke={C.stoneLight} strokeWidth={16} />
            <line x1={240 + i * 1120} x2={240 + i * 1120} y1={240} y2={630} stroke={C.stoneDark} strokeWidth={6} />
            <line x1={140 + i * 1120} x2={340 + i * 1120} y1={420} y2={420} stroke={C.stoneDark} strokeWidth={6} />
            <circle cx={240 + i * 1120} cy={300} r={30} fill="none" stroke={C.stoneDark} strokeWidth={6} />
          </g>
        ))}
        {/* vaulted ribs */}
        <path d="M0 40 Q400 -200 800 40 Q1200 -200 1600 40" stroke={C.stoneDark} strokeWidth={24} fill="none" />
        <Banner x={420} y={160} />
        <Banner x={1100} y={160} />
        <Torch x={460} y={560} id={`${id}-t1`} />
        <Torch x={1140} y={560} id={`${id}-t2`} />
        <rect x={0} y={780} width={1600} height={120} fill="#2a2440" />
        {range(14).map((i) => <line key={i} x1={i * 130} x2={i * 130 + (i * 130 - 800) * 0.15} y1={780} y2={900} stroke="#1b1630" strokeWidth={3} />)}
        <line x1={0} x2={1600} y1={830} y2={830} stroke="#1b1630" strokeWidth={3} />
        <RuneCircle cx={800} cy={850} r={360} id={`${id}-rc`} />
        <Candle x={260} y={60} id={`${id}-c1`} delay={0} />
        <Candle x={620} y={20} id={`${id}-c2`} delay={1.2} />
        <Candle x={980} y={40} id={`${id}-c3`} delay={0.6} />
        <Candle x={1360} y={70} id={`${id}-c4`} delay={1.8} />
      </svg>
    );
  }
  const holes = [circlePath(800, 40, 170), pointedArchPath(180, 260, 130, 360)];
  const wall = [rectPath(0, -500, 1600, 1280), ...holes].join(" ");
  const r = rng(13);
  const stars = range(9).map(() => [800 + (r() - 0.5) * 260, 40 + (r() - 0.5) * 260] as const);
  return (
    <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
      <defs>
        <clipPath id={`${id}-clip`}><path d={wall} clipRule="evenodd" /></clipPath>
      </defs>
      <path d={wall} fill={C.stone} fillRule="evenodd" />
      <g clipPath={`url(#${id}-clip)`}><StoneBlocks w={1600} y0={-500} y1={780} seed={index + 9} /></g>
      {/* rose window tracery with a constellation */}
      <circle cx={800} cy={40} r={170} fill="none" stroke={C.gold} strokeWidth={14} />
      <circle cx={800} cy={40} r={60} fill="none" stroke={C.gold} strokeWidth={4} opacity={0.7} />
      {range(8).map((i) => {
        const a = (i / 8) * Math.PI * 2;
        return <line key={i} x1={800 + Math.cos(a) * 60} y1={40 + Math.sin(a) * 60} x2={800 + Math.cos(a) * 170} y2={40 + Math.sin(a) * 170} stroke={C.gold} strokeWidth={4} opacity={0.7} />;
      })}
      <path d={`M${stars.map(([x, y]) => `${x} ${y}`).join(" L")}`} stroke={C.arcane} strokeWidth={1.5} fill="none" opacity={0.7} />
      {stars.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill={C.arcane} className="twinkle" style={{ animationDelay: `${i * 0.3}s` }} />)}
      <path d={pointedArchPath(180, 260, 130, 360)} fill="none" stroke={C.stoneLight} strokeWidth={12} />
      {/* telescope */}
      <g transform="translate(330 780)">
        <path d="M-30 0 L0 -140 L30 0 M0 -140 L0 0" stroke="#6a4a2a" strokeWidth={6} fill="none" />
        <g transform="translate(0 -150) rotate(-38)">
          <rect x={-90} y={-14} width={180} height={28} rx={6} fill="#a87a28" />
          <rect x={60} y={-18} width={40} height={36} rx={6} fill={C.gold} />
          <rect x={-100} y={-9} width={20} height={18} fill="#6a4a2a" />
        </g>
      </g>
      {/* armillary sphere */}
      <g transform="translate(1320 610)">
        <Glow id={`${id}-arm`} cx={0} cy={0} r={150} color={C.arcane} opacity={0.2} />
        <rect x={-6} y={60} width={12} height={110} fill="#a87a28" />
        <ellipse cx={0} cy={170} rx={50} ry={10} fill="#a87a28" />
        <circle r={80} fill="none" stroke={C.gold} strokeWidth={5} />
        <ellipse rx={80} ry={24} fill="none" stroke={C.gold} strokeWidth={4} transform="rotate(-20)" />
        <ellipse rx={24} ry={80} fill="none" stroke={C.gold} strokeWidth={4} transform="rotate(30)" />
        <circle r={14} fill={C.arcane} />
      </g>
      <rect x={0} y={780} width={1600} height={120} fill="#2a2440" />
      {range(14).map((i) => <line key={i} x1={i * 130} x2={i * 130 + (i * 130 - 800) * 0.15} y1={780} y2={900} stroke="#1b1630" strokeWidth={3} />)}
      <RuneCircle cx={800} cy={850} r={360} id={`${id}-rc`} />
      <Torch x={180} y={700} id={`${id}-t1`} />
      <Candle x={560} y={300} id={`${id}-c1`} delay={0.4} />
      <Candle x={1050} y={280} id={`${id}-c2`} delay={1.4} />
    </svg>
  );
}

function Threshold() {
  const arch = pointedArchPath(-110, 160, 220, 620);
  return (
    <svg width={300} height={1400} viewBox="-150 -500 300 1400" style={{ overflow: "visible" }}>
      <path d={[rectPath(-170, -500, 340, 1280), arch].join(" ")} fill={C.stoneDark} fillRule="evenodd" />
      {/* stairs spiralling up inside */}
      <path d={arch} fill="#120d24" />
      {range(9).map((i) => (
        <path key={i} d={`M${-100 + i * 6} ${770 - i * 52} h${150 - i * 10} l18 -12 h${-150 + i * 10}Z`} fill={i % 2 ? "#3a3358" : "#2f2a48"} />
      ))}
      <Glow id="fn-th-glow" cx={0} cy={260} r={160} color={C.arcane} opacity={0.3} className="pulse" />
      <path d={arch} fill="none" stroke={C.stoneLight} strokeWidth={14} />
      {range(10).map((i) => {
        const t = i / 9;
        const a = Math.PI * (1 - t);
        return <text key={i} x={Math.cos(a) * 130} y={330 - Math.sin(a) * 160} textAnchor="middle" fontSize={22} fill={C.arcane} className="twinkle" style={{ animationDelay: `${i * 0.25}s` }}>{RUNES[i + 8]}</text>;
      })}
    </svg>
  );
}

function Shelf() {
  return (
    <svg width={520} height={480} viewBox="0 0 520 480" style={{ overflow: "visible" }}>
      <rect x={0} y={0} width={520} height={480} fill="#24160f" />
      <path d="M150 0 Q260 -110 370 0Z" fill={C.wood} stroke={C.gold} strokeWidth={3} />
      <Glow id="fn-shelf-gem" cx={260} cy={-36} r={40} color={C.arcane} opacity={0.6} className="pulse" />
      <circle cx={260} cy={-36} r={10} fill={C.arcane} />
      <rect x={-12} y={-6} width={544} height={42} fill={C.wood} />
      <rect x={-12} y={-6} width={544} height={42} fill="none" stroke={C.gold} strokeWidth={2} />
      <rect x={0} y={236} width={520} height={20} fill={C.wood} />
      <line x1={0} x2={520} y1={238} y2={238} stroke={C.gold} strokeWidth={1.5} />
      <rect x={0} y={456} width={520} height={24} fill={C.wood} />
      <rect x={0} y={0} width={22} height={480} fill={C.wood} />
      <rect x={498} y={0} width={22} height={480} fill={C.wood} />
      <line x1={11} x2={11} y1={40} y2={470} stroke={C.gold} strokeWidth={1.5} />
      <line x1={509} x2={509} y1={40} y2={470} stroke={C.gold} strokeWidth={1.5} />
      <path d="M0 480 l-10 14 h42 l-10 -14Z M520 480 l10 14 h-42 l10 -14Z" fill={C.wood} />
      <ellipse cx={260} cy={490} rx={300} ry={10} fill="#00000050" />
    </svg>
  );
}

function Spine({ book }: { book: { id: string; w: number; h: number; color: string; spineTitle: string } }) {
  const { w, h, color } = book;
  const gid = `fn-sp-${book.id}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1">
          <stop offset="0" stopColor={shade(color, -0.3)} />
          <stop offset="0.45" stopColor={shade(color, 0.12)} />
          <stop offset="1" stopColor={shade(color, -0.45)} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} rx={4} fill={`url(#${gid})`} />
      {[10, 26, h - 36, h - 18].map((y) => (
        <g key={y}>
          <rect x={0} y={y} width={w} height={6} fill="#00000040" />
          <rect x={0} y={y} width={w} height={2} fill={C.gold} />
        </g>
      ))}
      <rect x={w * 0.16} y={40} width={w * 0.68} height={h - 86} rx={2} fill="#1b1433" opacity={0.75} />
      <rect x={w * 0.16 + 2} y={42} width={w * 0.68 - 4} height={h - 90} rx={2} fill="none" stroke={C.gold} strokeWidth={1} />
      <SpineTitle w={w} h={h - 46} y0={40} text={book.spineTitle} font={FONT} color={C.gold} size={13} weight={700} spacing={0.8} />
      <circle cx={w / 2} cy={h - 9} r={3.5} fill={C.arcane} />
    </svg>
  );
}

function Ornament({ row, w, h }: { row: 0 | 1; w: number; h: number }) {
  const cx = w / 2;
  if (row === 0) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <Glow id="fn-orb-glow" cx={cx} cy={h - 56} r={80} color={C.arcane} opacity={0.5} className="pulse" />
        <path d={`M${cx - 24} ${h} L${cx - 14} ${h - 24} H${cx + 14} L${cx + 24} ${h}Z`} fill={C.gold} />
        <circle cx={cx} cy={h - 56} r={34} fill="#bfefff" opacity={0.45} />
        <circle cx={cx} cy={h - 56} r={34} fill="none" stroke="#e9fbff" strokeWidth={2} opacity={0.7} />
        <path d={`M${cx - 14} ${h - 66} q8 -12 20 -10`} stroke="#fff" strokeWidth={3} fill="none" opacity={0.8} />
        <circle cx={cx + 6} cy={h - 50} r={8} fill={C.arcane} opacity={0.9} className="pulse" />
      </svg>
    );
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      {[[-28, "#c94aff", 50], [6, "#4affb0", 64], [36, "#ff6a4a", 40]].map(([dx, c, hh]) => {
        const x = cx + (dx as number), H = hh as number;
        return (
          <g key={dx as number}>
            <circle cx={x} cy={h - H * 0.35} r={H * 0.35} fill={c as string} opacity={0.75} />
            <circle cx={x} cy={h - H * 0.35} r={H * 0.35} fill="none" stroke="#e9e4ff" strokeWidth={2} opacity={0.6} />
            <rect x={x - 5} y={h - H} width={10} height={H * 0.32} fill="#e9e4ff" opacity={0.5} />
            <rect x={x - 6} y={h - H - 6} width={12} height={8} rx={2} fill="#8a5a3a" />
          </g>
        );
      })}
    </svg>
  );
}

function Foreground() {
  return (
    <svg width={3840} height={900} viewBox="0 0 3840 900" style={{ overflow: "visible" }}>
      {[[200, 140], [430, 90], [1240, 120], [1480, 70], [2040, 130], [2260, 80], [3180, 120], [3420, 80]].map(([x, y], i) => (
        <Candle key={x} x={x} y={y} h={60} id={`fn-fc${i}`} delay={(i * 0.7) % 3} />
      ))}
      {/* stray floating books */}
      {[[60, 700, -14], [1560, 640, 10], [1960, 720, 18], [3560, 660, -8]].map(([x, y, rot], i) => (
        <g key={i} className="float" style={{ animationDelay: `${i * 0.9}s` }}>
          <g transform={`translate(${x} ${y}) rotate(${rot})`}>
            <path d="M0 0 Q30 -12 60 0 Q90 -12 120 0 V70 Q90 58 60 70 Q30 58 0 70Z" fill="#efe6d2" />
            <path d="M60 0 V70" stroke="#b0a68a" strokeWidth={2} />
            {range(4).map((k) => <line key={k} x1={10} x2={50} y1={16 + k * 12} y2={14 + k * 12} stroke="#b0a68a" strokeWidth={2} />)}
            <path d="M-4 72 Q30 60 60 74 Q90 60 124 72 L124 78 Q90 66 60 80 Q30 66 -4 78Z" fill="#5a2f7a" />
          </g>
        </g>
      ))}
    </svg>
  );
}

function Facade() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <VGrad id="fn-esky" stops={[[0, "#0b0820"], [0.7, "#2a1a4a"], [1, "#3a2a5a"]]} />
        <linearGradient id="fn-tower" x1="0" x2="1">
          <stop offset="0" stopColor="#2a2440" />
          <stop offset="0.4" stopColor="#5d5680" />
          <stop offset="1" stopColor="#1e1a32" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill="url(#fn-esky)" />
      <Glow id="fn-eneb" cx={1200} cy={200} r={500} color="#7a3aaa" opacity={0.3} />
      <Stars W={1600} H={600} n={140} seed={8} />
      <circle cx={1280} cy={170} r={80} fill="#f3eedd" />
      <FloatingIsland x={240} y={300} s={0.8} tower />
      <FloatingIsland x={1380} y={420} s={0.5} />
      {/* tower */}
      <rect x={480} y={-20} width={640} height={800} fill="url(#fn-tower)" />
      <clipPath id="fn-tower-clip"><rect x={480} y={-20} width={640} height={800} /></clipPath>
      <g opacity={0.6} clipPath="url(#fn-tower-clip)"><StoneBlocks w={1600} y0={-20} y1={780} seed={5} /></g>
      {[[560, 140], [1000, 140]].map(([x, y]) => (
        <g key={x}>
          <path d={pointedArchPath(x, y, 50, 110)} fill={C.candle} opacity={0.85} />
          <path d={pointedArchPath(x, y, 50, 110)} fill="none" stroke={C.stoneDark} strokeWidth={6} />
        </g>
      ))}
      <rect x={460} y={60} width={680} height={30} fill={C.stoneDark} />
      {range(9).map((i) => <rect key={i} x={460 + i * 80} y={20} width={44} height={44} fill={C.stoneDark} />)}
      {/* door surround with glowing runes */}
      <path d={pointedArchPath(566, 210, 468, 570)} fill={C.stoneDark} />
      <Torch x={540} y={480} id="fn-et1" />
      <Torch x={1060} y={480} id="fn-et2" />
      {/* path and grass */}
      <rect x={0} y={780} width={1600} height={120} fill="#1a1530" />
      <path d="M700 780 L900 780 L1000 900 L600 900Z" fill="#3a3358" />
      {range(5).map((i) => <ellipse key={i} cx={800 + (i % 2 ? 30 : -30)} cy={800 + i * 22} rx={60 + i * 8} ry={8} fill="#4a4366" />)}
      {[[200, 0], [1400, 1]].map(([x, f]) => (
        <g key={x} transform={`translate(${x} 780) scale(${f ? -1 : 1} 1)`} fill="#1e2a2a">
          <circle cx={0} cy={-30} r={60} />
          <circle cx={70} cy={-20} r={44} />
          <circle cx={-60} cy={-14} r={40} />
        </g>
      ))}
    </svg>
  );
}

function FacadeFront() {
  // Stone spandrels that turn the rectangular door opening into a pointed arch.
  return (
    <g>
      <path d="M600 280 H1000 V460 H980 A306 306 0 0 0 800 300 A306 306 0 0 0 620 460 H600Z" fill={C.stoneDark} />
      <path d="M620 460 A306 306 0 0 1 800 300 A306 306 0 0 1 980 460" fill="none" stroke={C.gold} strokeWidth={5} />
      <circle cx={800} cy={330} r={10} fill={C.arcane} className="pulse" />
      {range(13).map((i) => {
        const a = Math.PI * (1 - i / 12);
        return (
          <text key={i} x={800 + Math.cos(a) * 208} y={470 - Math.sin(a) * 214} textAnchor="middle" fontSize={24} fill={C.arcane}
            className="twinkle" style={{ animationDelay: `${i * 0.2}s` }}>{RUNES[i]}</text>
        );
      })}
    </g>
  );
}

function Door({ side }: { side: "left" | "right" }) {
  return (
    <g>
      <rect width={180} height={480} fill="#4a2e22" />
      {range(5).map((i) => <rect key={i} x={i * 36} width={2} height={480} fill="#2e1a12" />)}
      {[120, 360].map((y) => (
        <g key={y}>
          <rect x={0} y={y} width={180} height={16} fill="#2a2420" />
          {range(5).map((i) => <circle key={i} cx={14 + i * 38} cy={y + 8} r={4} fill="#5a5048" />)}
        </g>
      ))}
      <g transform={`translate(${side === "left" ? 150 : 30} 250)`}>
        <circle r={16} fill="none" stroke={C.gold} strokeWidth={5} />
        <circle r={5} fill={C.gold} cy={-16} />
      </g>
    </g>
  );
}

function Librarian() {
  return (
    <svg width={100} height={110} viewBox="0 0 100 110">
      <path d="M30 34 L50 0 L70 34Z" fill={C.violet} />
      <path d="M48 14 l2 -5 l2 5 l5 0 l-4 3 l2 5 l-5 -3 l-5 3 l2 -5 l-4 -3Z" fill={C.gold} />
      <ellipse cx={50} cy={36} rx={30} ry={6} fill="#4a1f66" />
      <ellipse cx={50} cy={70} rx={30} ry={34} fill="#7a5a3a" />
      <ellipse cx={50} cy={82} rx={18} ry={20} fill="#c9a77a" />
      {range(3).map((i) => <path key={i} d={`M${40 + i * 8} ${76 + (i % 2) * 6} q4 4 8 0`} stroke="#8a6a4a" strokeWidth={2} fill="none" />)}
      <circle cx={38} cy={56} r={12} fill="#f3eedd" />
      <circle cx={62} cy={56} r={12} fill="#f3eedd" />
      <circle cx={38} cy={56} r={7} fill="#e3b75a" />
      <circle cx={62} cy={56} r={7} fill="#e3b75a" />
      <circle cx={38} cy={56} r={3.5} fill="#1b1433" />
      <circle cx={62} cy={56} r={3.5} fill="#1b1433" />
      <path d="M46 64 L50 72 L54 64Z" fill="#e3a03a" />
      <path d="M22 70 Q14 86 26 100 M78 70 Q86 86 74 100" stroke="#5a3e28" strokeWidth={6} fill="none" strokeLinecap="round" />
    </svg>
  );
}

export const fantasy: Theme = {
  id: "fantasy",
  name: "Fantasy",
  tagline: "A magic tower, one floor per genre, floating books and candles",
  vars: {
    "--bg": "#0d0a1c",
    "--ink": "#1b1433",
    "--paper": "#f3eedd",
    "--accent": "#6a3a9a",
    "--accent-2": "#e3b75a",
    "--muted": "#6a5a7a",
    "--card-bg": "#f1e6c8",
    "--card-edge": "#e3b75a",
    "--chip-bg": "rgba(13,10,28,.72)",
    "--chip-ink": "#f3eedd",
    "--sign-ink": "#f1d48a",
  },
  fonts: { display: FONT, body: BODY },
  rooms: {
    fiction: { title: "Fiction", subtitle: "Floor I · Hall of Tales" },
    selfhelp: { title: "Self-help", subtitle: "Floor II · Sanctum of Mind" },
  },
  entrance: {
    door: "swing",
    Facade,
    FacadeFront,
    Door,
    insideGlow: "#bfefff",
    title: "The Tower of Many Floors",
    hint: "Speak friend, and enter",
  },
  hall: { Backdrop, Room, Threshold, Shelf, Spine, Ornament, Foreground },
  particles: { kind: "sparkles", colors: ["#ffe9a8", "#7fe3ff", "#c9a8ff"], count: 60 },
  book3d: { coverStyle: "fantasy", paper: "#efe2bf", endpaper: "#1b1433", light: "#7fe3ff", ambient: 0.7 },
  librarian: { name: "Professor Hoot", Art: Librarian, greeting: "Hoo! Every floor holds a different kind of wisdom. Which shall we climb to tonight?" },
};
