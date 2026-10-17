import type { Theme } from "@/library/themes/types";
import { Glow, VGrad, SpineTitle, rng, range, rectPath, circlePath } from "@/library/themes/art";

const C = {
  paper: "#efe6d2",
  ink: "#2b2a28",
  red: "#9e2a2b",
  redDark: "#6e1c1d",
  jade: "#5c8a76",
  gold: "#c9a24b",
  wood: "#4a2a20",
  woodDark: "#2e1a14",
  wall: "#ece6d8",
  tile: "#55595e",
};
const FONT = "ZCOOL XiaoWei, Noto Serif SC, serif";
const HAN = "Noto Serif SC, serif";

/** Jagged ink-wash ridge. */
function ridge(seed: number, W: number, baseY: number, amp: number, step = 60) {
  const r = rng(seed);
  let d = `M0 900 L0 ${baseY}`;
  for (let x = 0; x <= W; x += step) {
    const peak = baseY - amp * (0.3 + r() * 0.7) * (0.5 + 0.5 * Math.sin(x / (step * 5) + seed));
    d += ` Q${x + step / 2} ${peak - amp * 0.25} ${x + step} ${peak}`;
  }
  return `${d} L${W} 900Z`;
}

function InkMountains({ W, id }: { W: number; id: string }) {
  return (
    <g>
      <defs>
        <VGrad id={`${id}-m1`} stops={[[0, "#9aa09b"], [1, "#d8d3c4", 0.2]]} />
        <VGrad id={`${id}-m2`} stops={[[0, "#6c726e"], [1, "#cfcabb", 0.3]]} />
        <VGrad id={`${id}-m3`} stops={[[0, "#3d423f"], [1, "#a9a597", 0.5]]} />
      </defs>
      <path d={ridge(3, W, 470, 260, 90)} fill={`url(#${id}-m1)`} />
      <rect y={560} width={W} height={60} fill="#efe9da" opacity={0.6} />
      <path d={ridge(8, W, 620, 200, 70)} fill={`url(#${id}-m2)`} />
      <rect y={690} width={W} height={50} fill="#efe9da" opacity={0.55} />
      <path d={ridge(15, W, 760, 140, 55)} fill={`url(#${id}-m3)`} />
    </g>
  );
}

function SilkLantern({ x, y, cord = 120, id }: { x: number; y: number; cord?: number; id: string }) {
  return (
    <g className="sway" style={{ transformOrigin: `${x}px ${y - cord}px` }}>
      <line x1={x} y1={y - cord} x2={x} y2={y} stroke="#2a1a14" strokeWidth={2} />
      <Glow id={id} cx={x} cy={y + 50} r={130} color="#ff8a5a" opacity={0.45} className="flicker" />
      <rect x={x - 18} y={y} width={36} height={10} fill={C.gold} />
      <ellipse cx={x} cy={y + 50} rx={50} ry={42} fill="#c0392b" />
      {[-30, -12, 12, 30].map((dx) => (
        <path key={dx} d={`M${x + dx * 0.4} ${y + 10} Q${x + dx * 1.3} ${y + 50} ${x + dx * 0.4} ${y + 90}`} stroke="#8e2219" strokeWidth={2} fill="none" />
      ))}
      <ellipse cx={x - 14} cy={y + 40} rx={14} ry={22} fill="#ffffff22" />
      <rect x={x - 18} y={y + 88} width={36} height={10} fill={C.gold} />
      <text x={x} y={y + 61} textAnchor="middle" fontFamily={HAN} fontSize={28} fill={C.gold}>書</text>
      {range(7).map((i) => <line key={i} x1={x - 9 + i * 3} y1={y + 98} x2={x - 9 + i * 3} y2={y + 140} stroke="#c0392b" strokeWidth={2} />)}
    </g>
  );
}

function Column({ x, y = 60, h = 720, w = 34 }: { x: number; y?: number; h?: number; w?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.red} />
      <rect x={x} y={y} width={w * 0.3} height={h} fill="#ffffff18" />
      <rect x={x + w * 0.75} y={y} width={w * 0.25} height={h} fill="#00000025" />
      <rect x={x - 8} y={y + h - 26} width={w + 16} height={26} fill="#8f8a80" />
    </g>
  );
}

function Lattice({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const s = 26;
  const cid = `cn-lat-${x}-${y}`;
  return (
    <g stroke={C.woodDark} strokeWidth={4} clipPath={`url(#${cid})`}>
      <clipPath id={cid}><rect x={x} y={y} width={w} height={h} /></clipPath>
      {range(Math.ceil(w / s)).map((i) => <line key={`v${i}`} x1={x + i * s} y1={y} x2={x + i * s} y2={y + h} />)}
      {range(Math.ceil(h / s)).map((i) => <line key={`h${i}`} x1={x} y1={y + i * s} x2={x + w} y2={y + i * s} />)}
      {range(Math.ceil(w / (s * 2))).map((i) =>
        range(Math.ceil(h / (s * 2))).map((j) => (
          <rect key={`${i}-${j}`} x={x + i * s * 2 + s / 2} y={y + j * s * 2 + s / 2} width={s} height={s} fill="none" transform={`rotate(45 ${x + i * s * 2 + s} ${y + j * s * 2 + s})`} strokeWidth={2.5} />
        )),
      )}
    </g>
  );
}

function octagon(cx: number, cy: number, r: number) {
  return range(8).map((i) => {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    return `${i ? "L" : "M"}${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  }).join(" ") + "Z";
}

function Scroll({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <rect x={x} y={y} width={60} height={300} fill="#f4ecd8" stroke="#7a6a4a" strokeWidth={5} />
      <rect x={x - 6} y={y - 8} width={72} height={10} rx={4} fill={C.woodDark} />
      <rect x={x - 6} y={y + 298} width={72} height={12} rx={4} fill={C.woodDark} />
      {[...text].map((ch, i) => (
        <text key={i} x={x + 30} y={y + 58 + i * 62} textAnchor="middle" fontFamily={HAN} fontSize={40} fontWeight={600} fill={C.ink}>{ch}</text>
      ))}
      <rect x={x + 20} y={y + 268} width={20} height={20} fill="#b5302e" />
    </g>
  );
}

function Backdrop() {
  const W = 3200;
  const r = rng(5);
  return (
    <svg width={W} height={900} viewBox={`0 0 ${W} 900`}>
      <defs>
        <VGrad id="cn-sky" stops={[[0, "#d9d4c4"], [0.6, "#efe9da"], [1, "#e8e1cf"]]} />
      </defs>
      <rect width={W} height={900} fill="url(#cn-sky)" />
      <circle cx={980} cy={260} r={70} fill="#c94a3a" opacity={0.85} />
      {range(9).map((i) => {
        const x = 300 + r() * 2600, y = 120 + r() * 160;
        return <path key={i} d={`M${x - 10} ${y} q10 -6 10 0 q0 -6 10 0`} stroke={C.ink} strokeWidth={2} fill="none" opacity={0.7} />;
      })}
      <InkMountains W={W} id="cn-bd" />
      {/* pagoda on a ridge */}
      <g transform="translate(2280 640)" fill="#3d423f">
        {range(7).map((i) => (
          <g key={i}>
            <path d={`M${-44 + i * 5} ${-i * 30} Q0 ${-i * 30 - 6} ${44 - i * 5} ${-i * 30} L${30 - i * 4} ${-i * 30 - 10} L${-30 + i * 4} ${-i * 30 - 10}Z`} />
            <rect x={-18 + i * 2} y={-i * 30 - 30} width={36 - i * 4} height={22} />
          </g>
        ))}
      </g>
      {/* cliff pine */}
      <g transform="translate(520 720)">
        <path d="M0 0 C20 -60 -10 -120 30 -170 M10 -120 L-60 -150 M25 -150 L90 -175" stroke={C.ink} strokeWidth={8} fill="none" strokeLinecap="round" />
        <ellipse cx={-60} cy={-158} rx={52} ry={14} fill="#2f3a33" />
        <ellipse cx={92} cy={-182} rx={58} ry={14} fill="#2f3a33" />
        <ellipse cx={30} cy={-182} rx={40} ry={12} fill="#2f3a33" />
      </g>
    </svg>
  );
}

function CaiHua({ w, y }: { w: number; y: number }) {
  return (
    <g>
      <rect x={0} y={y} width={w} height={50} fill="#2f5a55" />
      {range(Math.ceil(w / 80)).map((i) => (
        <g key={i}>
          <rect x={i * 80 + 6} y={y + 8} width={68} height={34} rx={17} fill={i % 2 ? "#3f7a6e" : "#2a4a6b"} />
          <circle cx={i * 80 + 40} cy={y + 25} r={9} fill={C.gold} />
        </g>
      ))}
      <rect x={0} y={y} width={w} height={4} fill={C.gold} />
      <rect x={0} y={y + 46} width={w} height={4} fill={C.gold} />
    </g>
  );
}

function TileFloor({ w }: { w: number }) {
  return (
    <g>
      <rect x={0} y={780} width={w} height={120} fill="#7d7c78" />
      {[800, 826, 856, 892].map((y) => <line key={y} x1={0} x2={w} y1={y} y2={y} stroke="#5f5e5a" strokeWidth={2} />)}
      {range(Math.ceil(w / 80) + 1).map((i) => (
        <line key={i} x1={i * 80} y1={780} x2={i * 80 + (i * 80 - w / 2) * 0.12} y2={900} stroke="#5f5e5a" strokeWidth={2} />
      ))}
      <rect x={0} y={772} width={w} height={10} fill={C.woodDark} />
    </g>
  );
}

function Room({ room, index }: { room: "fiction" | "selfhelp"; index: number }) {
  const id = `cn-r${index}`;
  if (room === "fiction") {
    const wall = [rectPath(0, 110, 1600, 670), rectPath(120, 280, 220, 280), octagon(1380, 420, 120)].join(" ");
    return (
      <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
        <rect x={0} y={-500} width={1600} height={560} fill={C.woodDark} />
        {range(17).map((i) => <rect key={i} x={i * 100} y={-500} width={40} height={560} fill="#3a2219" />)}
        <CaiHua w={1600} y={60} />
        <path d={wall} fill={C.wall} fillRule="evenodd" />
        <Lattice x={120} y={280} w={220} h={280} />
        <rect x={120} y={280} width={220} height={280} fill="none" stroke={C.woodDark} strokeWidth={12} />
        <clipPath id={`${id}-oct`}><path d={octagon(1380, 420, 120)} /></clipPath>
        <g stroke={C.woodDark} strokeWidth={5} clipPath={`url(#${id}-oct)`}>
          {range(5).map((i) => <line key={i} x1={1260 + i * 60} y1={300} x2={1260 + i * 60} y2={540} />)}
          <line x1={1260} y1={420} x2={1500} y2={420} />
        </g>
        <path d={octagon(1380, 420, 120)} fill="none" stroke="#8f8a80" strokeWidth={14} />
        <Scroll x={430} y={250} text="書山有路" />
        <Scroll x={1110} y={250} text="學海無涯" />
        {[40, 400, 1166, 1526].map((x) => <Column key={x} x={x} y={110} h={670} />)}
        <Glow id={`${id}-warm`} cx={800} cy={500} r={700} color="#ffb98a" opacity={0.14} />
        <TileFloor w={1600} />
        {/* porcelain vase on a stand */}
        <g transform="translate(260 780)">
          <rect x={-40} y={-30} width={80} height={30} fill={C.wood} />
          <path d="M-26 -30 C-50 -80 -40 -130 -14 -150 V-170 H14 V-150 C40 -130 50 -80 26 -30Z" fill="#f2f0ea" />
          <path d="M-36 -90 Q0 -110 36 -90 M-40 -70 Q0 -50 40 -70" stroke="#2b4a8a" strokeWidth={5} fill="none" />
          <circle cx={0} cy={-80} r={10} fill="none" stroke="#2b4a8a" strokeWidth={4} />
        </g>
      </svg>
    );
  }
  return (
    <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
      <defs>
        <VGrad id={`${id}-silk`} stops={[[0, "#e6dcc2"], [1, "#d4c7a6"]]} />
      </defs>
      {/* curved roof with upturned eaves */}
      <rect x={0} y={-500} width={1600} height={440} fill={C.tile} />
      {range(54).map((i) => <rect key={i} x={i * 30} y={-500} width={14} height={440} fill="#62676c" />)}
      <path d="M-40 -100 Q800 -20 1640 -100 L1640 -40 Q800 60 -40 -40Z" fill="#3e4247" />
      <path d="M-40 -40 Q800 60 1640 -40 L1640 10 Q800 110 -40 10Z" fill={C.redDark} />
      <CaiHua w={1600} y={40} />
      {[80, 1486].map((x) => <Column key={x} x={x} y={90} h={690} />)}
      {/* silk screen with ink landscape behind the shelf */}
      <rect x={470} y={280} width={660} height={500} fill={C.wood} />
      <rect x={486} y={296} width={628} height={484} fill={`url(#${id}-silk)`} />
      <g opacity={0.8}>
        <path d="M486 640 Q560 470 640 560 Q700 400 790 520 Q860 420 940 540 Q1020 450 1114 600 V780 H486Z" fill="#7a7f79" opacity={0.6} />
        <path d="M486 700 Q600 600 700 680 Q820 580 950 690 Q1040 640 1114 690 V780 H486Z" fill="#4a4f4b" opacity={0.7} />
        <circle cx={1030} cy={360} r={30} fill="#c94a3a" opacity={0.8} />
      </g>
      {/* balustrade */}
      <g>
        <rect x={0} y={690} width={1600} height={10} fill={C.red} />
        <rect x={0} y={760} width={1600} height={20} fill={C.red} />
        {range(33).map((i) => <rect key={i} x={i * 50} y={700} width={6} height={60} fill={C.redDark} />)}
      </g>
      <rect x={0} y={780} width={1600} height={120} fill="#6e4a32" />
      {range(12).map((i) => <line key={i} x1={0} x2={1600} y1={790 + i * 10} y2={790 + i * 10} stroke="#5a3c28" strokeWidth={2} />)}
      {/* tea table */}
      <g transform="translate(1300 780)">
        <rect x={-110} y={-70} width={220} height={16} fill={C.wood} />
        <rect x={-100} y={-54} width={14} height={54} fill={C.woodDark} />
        <rect x={86} y={-54} width={14} height={54} fill={C.woodDark} />
        <path d="M-30 -70 C-40 -100 -10 -110 0 -110 C10 -110 40 -100 30 -70Z" fill="#6b4a3a" />
        <path d="M30 -92 q22 -4 26 -18" stroke="#6b4a3a" strokeWidth={6} fill="none" />
        <rect x={-6} y={-118} width={12} height={8} fill="#6b4a3a" />
        {[-70, 60].map((x) => <path key={x} d={`M${x - 12} -70 L${x - 9} -84 H${x + 9} L${x + 12} -70Z`} fill="#e8e4da" />)}
        <path d="M-6 -120 q-6 -20 4 -36 q8 -12 0 -26" stroke="#ffffff88" strokeWidth={3} fill="none" className="float" />
      </g>
      {/* bamboo */}
      {[150, 190, 230].map((x, i) => (
        <g key={x}>
          <rect x={x} y={200 + i * 40} width={16} height={580 - i * 40} fill="#5a7a4a" />
          {range(6).map((k) => <rect key={k} x={x - 2} y={260 + i * 40 + k * 90} width={20} height={4} fill="#3e5a32" />)}
          <path d={`M${x + 8} ${300 + i * 60} q50 -20 80 10 q-40 4 -80 -10 M${x + 8} ${420 + i * 50} q-50 -16 -80 10 q40 4 80 -10`} fill="#4e7a40" />
        </g>
      ))}
    </svg>
  );
}

function Threshold() {
  const wall = [rectPath(-170, -500, 340, 1280), circlePath(0, 560, 200)].join(" ");
  return (
    <svg width={300} height={1400} viewBox="-150 -500 300 1400" style={{ overflow: "visible" }}>
      <path d={wall} fill={C.wall} fillRule="evenodd" />
      <circle cx={0} cy={560} r={200} fill="none" stroke="#8f8a80" strokeWidth={18} />
      <circle cx={0} cy={560} r={210} fill="none" stroke="#6f6a60" strokeWidth={3} />
      <rect x={-150} y={760} width={300} height={20} fill={C.wall} />
      <rect x={-200} y={30} width={400} height={30} fill={C.tile} />
      {range(14).map((i) => <circle key={i} cx={-195 + i * 30} cy={30} r={12} fill="#45494e" />)}
      <rect x={-50} y={250} width={100} height={60} fill={C.woodDark} stroke={C.gold} strokeWidth={3} />
      <text x={0} y={292} textAnchor="middle" fontFamily={HAN} fontSize={32} fill={C.gold}>靜心</text>
    </svg>
  );
}

function Shelf() {
  return (
    <svg width={520} height={480} viewBox="0 0 520 480" style={{ overflow: "visible" }}>
      <rect x={0} y={0} width={520} height={480} fill={C.woodDark} />
      {range(10).map((i) => <line key={i} x1={i * 52 + 20} y1={0} x2={i * 52 + 26} y2={480} stroke="#00000030" strokeWidth={2} />)}
      {/* everted flange top */}
      <path d="M-26 -6 Q-30 -26 -12 -18 L532 -18 Q550 -26 546 -6 L540 12 H-20Z" fill={C.wood} />
      <rect x={-6} y={8} width={532} height={28} fill={C.wood} />
      {/* key-fret apron */}
      <g stroke={C.gold} strokeWidth={2} fill="none" opacity={0.85}>
        {range(16).map((i) => <path key={i} d={`M${14 + i * 31} 30 v-14 h20 v10 h-10 v-5`} />)}
      </g>
      <rect x={0} y={236} width={520} height={20} fill={C.wood} />
      <rect x={0} y={456} width={520} height={24} fill={C.wood} />
      <rect x={0} y={0} width={22} height={480} fill={C.wood} />
      <rect x={498} y={0} width={22} height={480} fill={C.wood} />
      <path d="M0 480 h22 v10 q-6 6 -22 6Z M520 480 h-22 v10 q6 6 22 6Z" fill={C.wood} />
      <ellipse cx={260} cy={492} rx={300} ry={10} fill="#00000035" />
    </svg>
  );
}

function Spine({ book }: { book: { w: number; h: number; color: string; spineTitle: string } }) {
  const { w, h, color } = book;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect width={w} height={h} rx={2} fill={color} />
      <rect x={0} width={w * 0.14} height={h} fill="#00000030" />
      {range(5).map((i) => (
        <line key={i} x1={0} x2={w * 0.22} y1={14 + (i * (h - 28)) / 4} y2={14 + (i * (h - 28)) / 4} stroke="#efe6d2" strokeWidth={2} />
      ))}
      <line x1={w * 0.22} x2={w * 0.22} y1={10} y2={h - 10} stroke="#efe6d2" strokeWidth={1.5} opacity={0.8} />
      <rect x={w * 0.36} y={14} width={w * 0.5} height={h * 0.72} fill="#f1e9d6" />
      <rect x={w * 0.36 + 3} y={17} width={w * 0.5 - 6} height={h * 0.72 - 6} fill="none" stroke="#9e2a2b" strokeWidth={1} />
      <g transform={`translate(${w * 0.11} 0)`}>
        <SpineTitle w={w} h={h * 0.72} y0={14} text={book.spineTitle} font={FONT} color={C.ink} size={15} />
      </g>
    </svg>
  );
}

function Ornament({ row, w, h }: { row: 0 | 1; w: number; h: number }) {
  const cx = w / 2;
  if (row === 0) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect x={cx - 34} y={h - 14} width={68} height={14} fill={C.wood} />
        <path d={`M${cx - 18} ${h - 14} C${cx - 46} ${h - 60} ${cx - 40} ${h - 104} ${cx - 12} ${h - 120} V${h - 134} H${cx + 12} V${h - 120} C${cx + 40} ${h - 104} ${cx + 46} ${h - 60} ${cx + 18} ${h - 14}Z`} fill="#f4f2ec" />
        <path d={`M${cx - 34} ${h - 70} Q${cx} ${h - 92} ${cx + 34} ${h - 70}`} stroke="#2b4a8a" strokeWidth={4} fill="none" />
        <path d={`M${cx - 10} ${h - 50} q10 -18 20 0 q-10 14 -20 0`} fill="#2b4a8a" />
        <path d={`M${cx - 30} ${h - 100} Q${cx} ${h - 112} ${cx + 30} ${h - 100}`} stroke="#2b4a8a" strokeWidth={3} fill="none" />
      </svg>
    );
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {[[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1], [1, 2]].map(([i, j], k) => (
        <g key={k}>
          <rect x={cx - 48 + i * 30} y={h - 30 - j * 26} width={30} height={26} fill="#e9dcbc" stroke="#7a6a4a" strokeWidth={1.5} />
          <circle cx={cx - 33 + i * 30} cy={h - 17 - j * 26} r={9} fill="#d8c79c" stroke="#7a6a4a" strokeWidth={1.5} />
          <circle cx={cx - 33 + i * 30} cy={h - 17 - j * 26} r={3} fill={C.wood} />
        </g>
      ))}
      <path d={`M${cx + 40} ${h - 30} q8 10 2 30`} stroke={C.red} strokeWidth={3} fill="none" />
    </svg>
  );
}

function PlumBranch({ x, y, flip = 1 }: { x: number; y: number; flip?: number }) {
  const r = rng(x);
  return (
    <g transform={`translate(${x} ${y}) scale(${flip} 1)`}>
      <path d="M0 0 C-60 30 -120 20 -200 80 M-80 26 C-100 60 -110 90 -150 120 M-140 50 C-170 40 -200 30 -240 40" stroke={C.ink} strokeWidth={9} fill="none" strokeLinecap="round" />
      {range(18).map((i) => (
        <circle key={i} cx={-40 - r() * 200} cy={10 + r() * 110} r={5 + r() * 4} fill={i % 3 ? "#c9344a" : "#f2a0b0"} />
      ))}
    </g>
  );
}

function Foreground() {
  return (
    <svg width={3840} height={900} viewBox="0 0 3840 900" style={{ overflow: "visible" }}>
      <SilkLantern x={360} y={150} cord={180} id="cn-f1" />
      <SilkLantern x={1300} y={130} cord={160} id="cn-f2" />
      <SilkLantern x={2100} y={150} cord={180} id="cn-f3" />
      <SilkLantern x={3300} y={120} cord={150} id="cn-f4" />
      <PlumBranch x={1640} y={-10} />
      <PlumBranch x={3560} y={-10} />
      <g opacity={0.95}>
        {[[-10, 1], [3500, -1]].map(([x, f]) => (
          <g key={x} transform={`translate(${x} 900) scale(${f} 1)`}>
            {range(4).map((i) => <rect key={i} x={20 + i * 30} y={-500 + i * 60} width={14} height={500 - i * 60} fill="#3e5a32" />)}
            <path d="M40 -400 q80 -30 130 10 q-70 4 -130 -10 M70 -300 q90 -10 120 30 q-70 -6 -120 -30 M100 -200 q80 -40 140 0 q-80 10 -140 0" fill="#4e7a40" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function Facade() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <VGrad id="cn-esky" stops={[[0, "#cfc9b8"], [1, "#eee8d8"]]} />
      </defs>
      <rect width={1600} height={900} fill="url(#cn-esky)" />
      <circle cx={1240} cy={190} r={56} fill="#c94a3a" opacity={0.85} />
      <g transform="translate(0 -170)"><InkMountains W={1600} id="cn-fac" /></g>
      {/* long white wall */}
      <rect x={0} y={380} width={1600} height={400} fill={C.wall} />
      <rect x={0} y={360} width={1600} height={26} fill={C.tile} />
      {range(54).map((i) => <circle key={i} cx={i * 30} cy={360} r={11} fill="#45494e" />)}
      {[[160, 520], [1360, 520]].map(([x, y]) => (
        <g key={x}>
          <path d={octagon(x, y, 70)} fill="#c8c2b2" />
          <Lattice x={x - 50} y={y - 50} w={100} h={100} />
        </g>
      ))}
      {/* gate house */}
      <rect x={560} y={290} width={480} height={490} fill={C.wall} />
      <Column x={572} y={280} h={500} w={40} />
      <Column x={988} y={280} h={500} w={40} />
      <g transform="translate(560 0)">
        <CaiHua w={480} y={250} />
      </g>
      <path d="M400 250 Q480 230 520 160 L1080 160 Q1120 230 1200 250 L1180 262 Q1100 250 1060 220 L540 220 Q500 250 420 262Z" fill="#3e4247" />
      <path d="M520 160 L600 80 L1000 80 L1080 160Z" fill={C.tile} />
      {range(22).map((i) => <rect key={i} x={608 + i * 18} y={82} width={8} height={76} fill="#62676c" />)}
      <path d="M560 80 Q800 60 1040 80 L1060 70 Q800 44 540 70Z" fill="#3e4247" />
      <path d="M380 236 q-10 -30 20 -40 M1220 236 q10 -30 -20 -40" stroke="#3e4247" strokeWidth={10} fill="none" strokeLinecap="round" />
      {/* plaque */}
      <rect x={700} y={176} width={200} height={56} fill={C.woodDark} stroke={C.gold} strokeWidth={4} />
      <text x={800} y={218} textAnchor="middle" fontFamily={HAN} fontSize={36} fontWeight={600} fill={C.gold}>藏書閣</text>
      {/* stone lions */}
      {[480, 1120].map((x, i) => (
        <g key={x} transform={`translate(${x} 780) scale(${i ? -1 : 1} 1)`}>
          <rect x={-46} y={-40} width={92} height={40} fill="#8f8a80" />
          <path d="M-36 -40 V-110 Q-36 -150 0 -150 Q40 -150 40 -110 L36 -40Z" fill="#a39e93" />
          <circle cx={6} cy={-124} r={30} fill="#9a958a" />
          {range(8).map((k) => <circle key={k} cx={-14 + (k % 4) * 12} cy={-142 + Math.floor(k / 4) * 12} r={6} fill="#8a8579" />)}
          <circle cx={18} cy={-120} r={4} fill="#3b3b3b" />
          <circle cx={-20} cy={-56} r={14} fill="#8a8579" />
        </g>
      ))}
      <rect x={0} y={780} width={1600} height={120} fill="#8f8c84" />
      <rect x={560} y={780} width={480} height={24} fill="#a19d94" />
      <rect x={520} y={804} width={560} height={24} fill="#96928a" />
      <PlumBranch x={1700} y={40} flip={1} />
      <PlumBranch x={-100} y={40} flip={-1} />
    </svg>
  );
}

function Door({ side }: { side: "left" | "right" }) {
  return (
    <g>
      <rect width={180} height={480} fill="#a3302c" />
      <rect width={180} height={480} fill="none" stroke={C.redDark} strokeWidth={8} />
      <rect x={side === "left" ? 0 : 120} width={60} height={480} fill="#ffffff0d" />
      {range(7).map((r) => range(5).map((c) => (
        <circle key={`${r}-${c}`} cx={22 + c * 34} cy={40 + r * 62} r={7} fill={C.gold} />
      )))}
      <g transform={`translate(${side === "left" ? 156 : 24} 250)`}>
        <circle r={18} fill="#b48a3a" />
        <circle r={13} fill="none" stroke="#e1bf6a" strokeWidth={4} cy={18} />
      </g>
    </g>
  );
}

function FacadeFront() {
  return <rect x={612} y={292} width={376} height={10} fill={C.redDark} />;
}

function Librarian() {
  return (
    <svg width={100} height={110} viewBox="0 0 100 110">
      <line x1={46} y1={78} x2={44} y2={108} stroke="#2b2a28" strokeWidth={3} />
      <line x1={56} y1={78} x2={58} y2={108} stroke="#2b2a28" strokeWidth={3} />
      <ellipse cx={52} cy={66} rx={30} ry={16} fill="#f6f4ee" />
      <path d="M70 60 Q96 64 96 80 Q84 74 68 74Z" fill="#2b2a28" />
      <path d="M34 64 Q30 40 34 22" stroke="#2b2a28" strokeWidth={7} fill="none" strokeLinecap="round" />
      <circle cx={36} cy={18} r={9} fill="#f6f4ee" />
      <circle cx={38} cy={12} r={4} fill="#c0392b" />
      <path d="M28 18 L8 22 L28 22Z" fill="#7a7a6a" />
      <circle cx={36} cy={18} r={1.6} fill="#2b2a28" />
    </svg>
  );
}

export const chinese: Theme = {
  id: "chinese",
  name: "Chinese",
  tagline: "Moon gates, scroll shelves, ink-wash mountains, a tea pavilion",
  vars: {
    "--bg": "#d9d3c3",
    "--ink": "#2b2a28",
    "--paper": "#f6f0e2",
    "--accent": "#9e2a2b",
    "--accent-2": "#5c8a76",
    "--muted": "#6f685c",
    "--card-bg": "#f4eddd",
    "--card-edge": "#9e2a2b",
    "--chip-bg": "rgba(43,42,40,.72)",
    "--chip-ink": "#f4eddd",
  },
  fonts: { display: FONT, body: HAN },
  rooms: {
    fiction: { title: "Fiction", subtitle: "Scroll hall · 書廳" },
    selfhelp: { title: "Self-help", subtitle: "Tea pavilion · 茶亭" },
  },
  entrance: {
    door: "swing",
    Facade,
    FacadeFront,
    Door,
    insideGlow: "#ffd9a8",
    title: "The Pavilion of Scrolls",
    hint: "Push open the red gate",
  },
  hall: { Backdrop, Room, Threshold, Shelf, Spine, Ornament, Foreground },
  particles: { kind: "ink", colors: ["#f6f2e8", "#efe9dc", "#8a8f8a"], count: 26 },
  book3d: { coverStyle: "chinese", paper: "#f3ead4", endpaper: "#2f5a55", light: "#ffb98a", ambient: 0.85 },
  librarian: { name: "Old Crane", Art: Librarian, greeting: "A guest at the gate. Tea is warm — tell me what you are curious about today." },
};
