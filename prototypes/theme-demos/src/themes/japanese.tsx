import type { Theme } from "./types";
import { Glow, VGrad, SpineTitle, rng, range, rectPath, circlePath } from "./art";

const C = {
  wood: "#5a3d27",
  darkWood: "#33241a",
  plaster: "#eadcbf",
  washi: "#f6ead0",
  tatami: "#c9b878",
  vermilion: "#c4513a",
  indigo: "#2f3a5a",
  pink: "#f3b9c6",
  glow: "#ffcf86",
};
const FONT = "Shippori Mincho, serif";

function CherryCluster({ x, y, r, seed }: { x: number; y: number; r: number; seed: number }) {
  const rand = rng(seed);
  return (
    <g>
      {range(14).map((i) => {
        const a = rand() * Math.PI * 2, d = rand() * r;
        return (
          <circle key={i} cx={x + Math.cos(a) * d} cy={y + Math.sin(a) * d * 0.7} r={r * (0.25 + rand() * 0.3)}
            fill={["#f6c6d0", "#f0aebf", "#fbd9e0"][i % 3]} opacity={0.85} />
        );
      })}
    </g>
  );
}

function CherryTree({ x, base, s, seed }: { x: number; base: number; s: number; seed: number }) {
  return (
    <g>
      <path d={`M${x} ${base} C${x - 6 * s} ${base - 60 * s} ${x + 10 * s} ${base - 90 * s} ${x - 4 * s} ${base - 140 * s}
        M${x - 2 * s} ${base - 100 * s} L${x - 50 * s} ${base - 150 * s} M${x} ${base - 110 * s} L${x + 46 * s} ${base - 160 * s}`}
        stroke="#4a3328" strokeWidth={8 * s} strokeLinecap="round" fill="none" />
      <CherryCluster x={x - 50 * s} y={base - 165 * s} r={46 * s} seed={seed} />
      <CherryCluster x={x + 46 * s} y={base - 170 * s} r={50 * s} seed={seed + 1} />
      <CherryCluster x={x} y={base - 190 * s} r={56 * s} seed={seed + 2} />
    </g>
  );
}

function Chochin({ x, y, cord = 120, color = C.vermilion, id }: { x: number; y: number; cord?: number; color?: string; id: string }) {
  return (
    <g className="sway" style={{ transformOrigin: `${x}px ${y - cord}px` }}>
      <line x1={x} y1={y - cord} x2={x} y2={y} stroke="#2a1d15" strokeWidth={2} />
      <Glow id={id} cx={x} cy={y + 55} r={120} color={C.glow} opacity={0.55} className="flicker" />
      <rect x={x - 22} y={y} width={44} height={10} rx={2} fill="#1f1611" />
      <ellipse cx={x} cy={y + 55} rx={36} ry={46} fill={color} />
      {range(5).map((i) => (
        <path key={i} d={`M${x - 36 + i * 0} ${y + 22 + i * 16} Q${x} ${y + 26 + i * 16} ${x + 36} ${y + 22 + i * 16}`}
          stroke="#00000033" strokeWidth={1.5} fill="none" transform={`scale(1 1)`} />
      ))}
      <ellipse cx={x} cy={y + 55} rx={14} ry={46} fill="#ffffff22" />
      <rect x={x - 22} y={y + 100} width={44} height={10} rx={2} fill="#1f1611" />
      <text x={x} y={y + 64} textAnchor="middle" fontFamily={FONT} fontSize={26} fill="#2a1d15">本</text>
    </g>
  );
}

function StoneLantern({ x, base, s = 1 }: { x: number; base: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${base}) scale(${s})`}>
      <rect x={-34} y={-24} width={68} height={24} fill="#8a8579" />
      <rect x={-12} y={-120} width={24} height={96} fill="#9a958a" />
      <rect x={-36} y={-140} width={72} height={22} fill="#8a8579" />
      <rect x={-28} y={-196} width={56} height={56} fill="#a29d91" />
      <rect x={-14} y={-184} width={28} height={30} fill={C.glow} className="flicker" />
      <path d="M-60 -196 L0 -236 L60 -196 Z" fill="#7d786d" />
      <circle cx={0} cy={-244} r={9} fill="#7d786d" />
    </g>
  );
}

function Shoji({ x, y, w, h, lit = 0.6 }: { x: number; y: number; w: number; h: number; lit?: number }) {
  const cols = Math.max(2, Math.round(w / 44));
  const rows = Math.max(4, Math.round(h / 52));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.washi} />
      <rect x={x} y={y} width={w} height={h} fill={C.glow} opacity={lit * 0.35} />
      {range(cols - 1).map((i) => (
        <rect key={`c${i}`} x={x + ((i + 1) * w) / cols - 1.5} y={y} width={3} height={h} fill={C.wood} />
      ))}
      {range(rows - 1).map((i) => (
        <rect key={`r${i}`} x={x} y={y + ((i + 1) * h) / rows - 1.5} width={w} height={3} fill={C.wood} />
      ))}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={C.darkWood} strokeWidth={8} />
    </g>
  );
}

function Tatami({ w }: { w: number }) {
  return (
    <g>
      <rect x={0} y={780} width={w} height={120} fill={C.tatami} />
      {range(60).map((i) => (
        <line key={i} x1={0} x2={w} y1={784 + i * 2} y2={784 + i * 2} stroke="#a8975c" strokeWidth={0.6} opacity={0.5} />
      ))}
      {[0, 400, 800, 1200, 1600].map((x) => (
        <rect key={x} x={x - 5} y={780} width={10} height={120} fill={C.indigo} />
      ))}
      <rect x={0} y={836} width={w} height={8} fill={C.indigo} />
      <rect x={0} y={772} width={w} height={10} fill={C.darkWood} />
    </g>
  );
}

function Backdrop() {
  const W = 3200;
  return (
    <svg width={W} height={900} viewBox={`0 0 ${W} 900`}>
      <defs>
        <VGrad id="jp-sky" stops={[[0, "#5b4b78"], [0.45, "#c98e93"], [0.75, "#f3c9a4"], [1, "#f8e2c0"]]} />
        <VGrad id="jp-far" stops={[[0, "#8b7e9f"], [1, "#c9a8b0"]]} />
      </defs>
      <rect width={W} height={900} fill="url(#jp-sky)" />
      <circle cx={760} cy={430} r={110} fill="#fbe7cc" opacity={0.85} />
      <path d={`M0 640 L380 500 L620 580 L1100 300 L1170 330 L1220 310 L1700 560 L2100 470 L2600 600 L3200 520 V900 H0Z`} fill="url(#jp-far)" opacity={0.85} />
      <path d="M1100 300 L1170 330 L1220 310 L1300 362 L1240 350 L1190 372 L1140 352 L1040 340 Z" fill="#f6eef0" />
      <path d={`M0 700 Q300 610 700 680 T1500 650 T2400 690 T3200 640 V900 H0Z`} fill="#6c6a84" opacity={0.75} />
      {/* pagoda */}
      <g transform="translate(2350 520)" fill="#4b4560">
        {range(5).map((i) => (
          <g key={i}>
            <path d={`M${-70 + i * 9} ${-i * 46} L${70 - i * 9} ${-i * 46} L${50 - i * 9} ${-i * 46 - 18} L${-50 + i * 9} ${-i * 46 - 18}Z`} />
            <rect x={-30 + i * 5} y={-i * 46 + 0} width={60 - i * 10} height={28} />
          </g>
        ))}
        <rect x={-2} y={-280} width={4} height={60} />
      </g>
      <path d={`M0 760 Q400 720 800 750 T1600 740 T2400 760 T3200 740 V900 H0Z`} fill="#5a6b52" />
      {[180, 520, 1350, 1800, 2150, 2700, 3050].map((x, i) => (
        <CherryTree key={x} x={x} base={790} s={1.1 + (i % 3) * 0.25} seed={i * 7 + 3} />
      ))}
    </svg>
  );
}

function Room({ room, index }: { room: "fiction" | "selfhelp"; index: number }) {
  const id = `jp-r${index}`;
  if (room === "fiction") {
    const wall = [rectPath(0, 220, 1600, 560), circlePath(190, 480, 130), rectPath(1250, 236, 170, 536)].join(" ");
    return (
      <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
        {/* ceiling */}
        <rect x={0} y={-500} width={1600} height={560} fill={C.darkWood} />
        {range(17).map((i) => <rect key={i} x={i * 100 - 4} y={-500} width={8} height={560} fill="#271b13" />)}
        <rect x={0} y={60} width={1600} height={30} fill={C.wood} />
        {/* ranma (transom) with lattice */}
        <rect x={0} y={90} width={1600} height={110} fill="#d8c7a3" />
        {[0, 1, 2, 3].map((k) => (
          <g key={k}>
            {range(18).map((i) => (
              <line key={i} x1={k * 400 + 30 + i * 19} y1={100} x2={k * 400 + 30 + i * 19} y2={190} stroke={C.wood} strokeWidth={3} />
            ))}
          </g>
        ))}
        <rect x={0} y={200} width={1600} height={22} fill={C.wood} />
        <path d={wall} fill={C.plaster} fillRule="evenodd" />
        {/* round window lattice */}
        <circle cx={190} cy={480} r={130} fill="none" stroke={C.darkWood} strokeWidth={10} />
        {range(5).map((i) => (
          <line key={i} x1={190 - 130 + (i + 1) * 43} y1={350} x2={190 - 130 + (i + 1) * 43} y2={610} stroke="#3d2a1c" strokeWidth={4} />
        ))}
        <line x1={60} y1={480} x2={320} y2={480} stroke="#3d2a1c" strokeWidth={4} />
        {/* open shoji on the right */}
        <Shoji x={1420} y={236} w={166} h={536} />
        <rect x={1250} y={236} width={170} height={536} fill="none" stroke={C.darkWood} strokeWidth={10} />
        {/* posts */}
        {[0, 380, 1220, 1580].map((x) => <rect key={x} x={x} y={200} width={22} height={580} fill={C.wood} />)}
        {/* hanging scroll */}
        <g>
          <rect x={430} y={250} width={74} height={300} fill="#efe6d2" stroke="#7a6550" strokeWidth={6} />
          <rect x={424} y={244} width={86} height={10} rx={4} fill="#3a2a1e" />
          <rect x={424} y={546} width={86} height={12} rx={4} fill="#3a2a1e" />
          <path d="M448 470 Q466 380 488 330 M452 470 Q470 420 482 400" stroke="#2b2420" strokeWidth={4} fill="none" />
          <circle cx={470} cy={300} r={12} fill={C.vermilion} />
        </g>
        {/* andon floor lamp */}
        <g>
          <Glow id={`${id}-andon`} cx={1150} cy={660} r={180} color={C.glow} opacity={0.5} className="flicker" />
          <rect x={1118} y={590} width={64} height={120} fill={C.washi} stroke={C.darkWood} strokeWidth={5} />
          <rect x={1118} y={590} width={64} height={120} fill={C.glow} opacity={0.5} className="flicker" />
          <line x1={1150} y1={590} x2={1150} y2={710} stroke={C.darkWood} strokeWidth={3} />
          <rect x={1112} y={710} width={76} height={8} fill={C.darkWood} />
          <rect x={1118} y={718} width={6} height={62} fill={C.darkWood} />
          <rect x={1176} y={718} width={6} height={62} fill={C.darkWood} />
        </g>
        {/* warm wash */}
        <Glow id={`${id}-warm`} cx={800} cy={520} r={700} color="#ffb76b" opacity={0.18} />
        <Tatami w={1600} />
        {/* zabuton cushion */}
        <ellipse cx={330} cy={820} rx={90} ry={22} fill="#8a3b3b" />
        <ellipse cx={330} cy={814} rx={80} ry={16} fill="#a24a46" />
      </svg>
    );
  }
  // Garden room: open veranda under the eaves, gold folding screen behind the shelf.
  return (
    <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
      <defs>
        <VGrad id={`${id}-gold`} stops={[[0, "#e7c67a"], [1, "#c99a45"]]} />
      </defs>
      {/* roof */}
      <rect x={0} y={-500} width={1600} height={480} fill="#3c3a3c" />
      {range(40).map((i) => <rect key={i} x={i * 40} y={-500} width={18} height={480} fill="#4a484b" />)}
      <path d="M0 -40 Q800 30 1600 -40 V40 Q800 110 0 40Z" fill={C.darkWood} />
      {range(32).map((i) => <rect key={i} x={i * 50 + 10} y={40} width={12} height={34 + Math.sin((i / 31) * Math.PI) * 30} fill="#2a1d15" />)}
      <path d="M0 40 Q800 110 1600 40 V60 Q800 130 0 60Z" fill={C.wood} />
      {/* posts */}
      {[60, 1504].map((x) => <rect key={x} x={x} y={60} width={36} height={720} fill={C.wood} />)}
      {/* byobu folding screen */}
      <g>
        {range(6).map((i) => (
          <g key={i}>
            <rect x={460 + i * 113} y={290} width={113} height={490} fill={`url(#${id}-gold)`} stroke="#4a3322" strokeWidth={5} />
            <rect x={460 + i * 113} y={290} width={113} height={490} fill={i % 2 ? "#00000012" : "#ffffff10"} />
          </g>
        ))}
        {/* painted waves and cloud */}
        <path d="M470 700 Q540 650 610 700 T750 700 T890 700 T1030 700 T1130 700 V770 H470Z" fill="#2f4d6b" opacity={0.85} />
        <path d="M470 720 Q540 690 610 720 T750 720 T890 720 T1030 720 T1130 720" stroke="#e8e0cc" strokeWidth={4} fill="none" />
        <path d="M520 360 q40 -30 80 0 q40 -30 80 0 q30 10 0 30 h-160 q-30 -10 0 -30Z" fill="#f2e2b8" opacity={0.8} />
        <path d="M900 480 q40 -40 140 -10 q-30 20 -60 10 q-40 30 -80 0Z" fill="#2f5a3a" opacity={0.7} />
      </g>
      {/* engawa deck and garden */}
      <rect x={0} y={780} width={1600} height={50} fill="#7a5638" />
      {range(16).map((i) => <rect key={i} x={i * 100} y={780} width={2} height={50} fill="#5a3d27" />)}
      <rect x={0} y={830} width={1600} height={70} fill="#d9d2c0" />
      {range(6).map((i) => (
        <path key={i} d={`M0 ${842 + i * 10} Q400 ${836 + i * 10} 800 ${842 + i * 10} T1600 ${842 + i * 10}`} stroke="#bdb5a1" strokeWidth={2} fill="none" />
      ))}
      {[[300, 866], [520, 878], [1180, 870], [1380, 880]].map(([x, y]) => (
        <ellipse key={x} cx={x} cy={y} rx={60} ry={14} fill="#8e8a80" />
      ))}
      <StoneLantern x={1330} base={830} />
      {/* bonsai pine */}
      <g transform="translate(250 780)">
        <path d="M0 0 C-10 -40 30 -70 10 -110 C0 -130 -30 -140 -50 -150" stroke="#4a3328" strokeWidth={14} fill="none" strokeLinecap="round" />
        <ellipse cx={-60} cy={-160} rx={70} ry={26} fill="#3f5a3a" />
        <ellipse cx={30} cy={-118} rx={56} ry={20} fill="#4a6b44" />
        <ellipse cx={-10} cy={-200} rx={40} ry={16} fill="#4a6b44" />
        <rect x={-50} y={-6} width={100} height={30} fill="#5d4a3c" />
      </g>
      <Glow id={`${id}-dusk`} cx={800} cy={300} r={800} color="#ffc48a" opacity={0.12} />
    </svg>
  );
}

function Threshold() {
  return (
    <svg width={300} height={1400} viewBox="-150 -500 300 1400" style={{ overflow: "visible" }}>
      <rect x={-130} y={-500} width={260} height={560} fill={C.darkWood} />
      <rect x={-130} y={60} width={260} height={30} fill={C.wood} />
      {[-130, 100].map((x) => <rect key={x} x={x} y={90} width={30} height={690} fill={C.wood} />)}
      <rect x={-140} y={150} width={280} height={24} fill={C.darkWood} />
      {/* noren curtain */}
      {[-100, -34, 32].map((x, i) => (
        <g key={x} className="sway-slow" style={{ transformOrigin: `${x + 33}px 174px`, animationDelay: `${i * 0.4}s` }}>
          <rect x={x} y={174} width={64} height={210} fill={C.indigo} />
        </g>
      ))}
      <circle cx={0} cy={270} r={36} fill="none" stroke="#efe6d2" strokeWidth={6} />
      <text x={0} y={282} textAnchor="middle" fontFamily={FONT} fontSize={34} fill="#efe6d2">道</text>
    </svg>
  );
}

function Shelf() {
  return (
    <svg width={520} height={480} viewBox="0 0 520 480" style={{ overflow: "visible" }}>
      <defs>
        <VGrad id="jp-back" stops={[[0, "#2a1d15"], [1, "#3a281c"]]} />
      </defs>
      <rect x={0} y={0} width={520} height={480} fill="url(#jp-back)" />
      {range(12).map((i) => <line key={i} x1={i * 44 + 20} y1={0} x2={i * 44 + 24} y2={480} stroke="#00000030" strokeWidth={2} />)}
      <rect x={-14} y={0} width={548} height={36} fill={C.wood} />
      <rect x={-14} y={30} width={548} height={6} fill="#00000040" />
      <rect x={0} y={236} width={520} height={20} fill={C.wood} />
      <rect x={0} y={456} width={520} height={24} fill={C.wood} />
      <rect x={0} y={0} width={20} height={480} fill={C.wood} />
      <rect x={500} y={0} width={20} height={480} fill={C.wood} />
      {[[8, 120], [8, 340], [506, 120], [506, 340]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={6} height={30} rx={2} fill="#b08a4a" />
      ))}
      <ellipse cx={260} cy={486} rx={300} ry={12} fill="#00000030" />
    </svg>
  );
}

function Spine({ book }: { book: { w: number; h: number; color: string; spineTitle: string } }) {
  const { w, h, color } = book;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect width={w} height={h} rx={3} fill={color} />
      <rect width={w * 0.18} height={h} fill="#ffffff14" />
      <rect x={w * 0.82} width={w * 0.18} height={h} fill="#00000026" />
      {range(Math.floor(h / 26)).map((i) => (
        <circle key={i} cx={5} cy={14 + i * 26} r={1.6} fill="#f1e4c8" opacity={0.7} />
      ))}
      <rect x={w * 0.2} y={16} width={w * 0.6} height={h * 0.66} fill="#f4ead6" />
      <SpineTitle w={w} h={h * 0.66} y0={16} text={book.spineTitle} font={FONT} color="#2a1d15" size={15} />
      <circle cx={w / 2} cy={h - 22} r={6} fill={C.vermilion} opacity={0.85} />
    </svg>
  );
}

function Ornament({ row, w, h }: { row: 0 | 1; w: number; h: number }) {
  const cx = w / 2;
  if (row === 0) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <path d={`M${cx - 18} ${h} Q${cx - 30} ${h - 50} ${cx - 10} ${h - 74} V${h - 86} H${cx + 10} V${h - 74} Q${cx + 30} ${h - 50} ${cx + 18} ${h}Z`} fill="#3f4f6a" />
        <path d={`M${cx} ${h - 86} C${cx - 10} ${h - 130} ${cx - 40} ${h - 150} ${cx - 50} ${h - 180}`} stroke="#4a3328" strokeWidth={3} fill="none" />
        <path d={`M${cx} ${h - 86} C${cx + 10} ${h - 120} ${cx + 30} ${h - 130} ${cx + 44} ${h - 150}`} stroke="#4a3328" strokeWidth={3} fill="none" />
        {[[-50, -180], [-36, -150], [44, -150], [30, -128], [-20, -126]].map(([dx, dy], i) => (
          <circle key={i} cx={cx + dx} cy={h + dy} r={7} fill={C.pink} />
        ))}
      </svg>
    );
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={cx - 44 + i * 6} y={h - 34 - i * 32} width={88 - i * 12} height={32} fill={["#8a6440", "#a27a50", "#6e4e33"][i]} stroke="#2a1d15" strokeWidth={1.5} />
          <line x1={cx - 44 + i * 6} x2={cx + 44 - i * 6} y1={h - 18 - i * 32} y2={h - 18 - i * 32} stroke={C.vermilion} strokeWidth={3} />
        </g>
      ))}
    </svg>
  );
}

function Foreground() {
  return (
    <svg width={3840} height={900} viewBox="0 0 3840 900" style={{ overflow: "visible" }}>
      {/* cherry branch reaching in from the top-left */}
      <path d="M-20 40 C120 70 220 40 330 110 M150 60 C200 20 240 0 300 -10" stroke="#3b2a22" strokeWidth={14} fill="none" strokeLinecap="round" />
      <CherryCluster x={300} y={110} r={70} seed={11} />
      <CherryCluster x={170} y={60} r={60} seed={12} />
      <CherryCluster x={300} y={-10} r={50} seed={13} />
      <Chochin x={420} y={150} cord={180} id="jp-f1" />
      <Chochin x={1290} y={130} cord={160} color="#f3eadb" id="jp-f2" />
      <Chochin x={2120} y={150} cord={180} id="jp-f3" />
      <Chochin x={3260} y={120} cord={150} color="#f3eadb" id="jp-f4" />
      {/* bamboo at the edges */}
      {[[1480, 0], [1540, 1], [3560, 2], [3620, 3]].map(([x, i]) => (
        <g key={x}>
          <rect x={x} y={300} width={22} height={600} fill="#4f6b3a" />
          {range(6).map((k) => <rect key={k} x={x - 2} y={340 + k * 90} width={26} height={5} fill="#3b5229" />)}
          <path d={`M${x + 11} ${360 + i * 30} q-60 -10 -90 20 q50 0 90 -20 M${x + 11} ${480 + i * 20} q60 -20 90 6 q-50 6 -90 -6`} fill="#5d7d42" />
        </g>
      ))}
      <path d="M1880 900 Q1900 760 1960 700 Q1940 800 1990 900Z M1960 900 Q2000 780 2060 740 Q2040 820 2050 900Z" fill="#3f5a32" />
    </svg>
  );
}

function Facade() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <VGrad id="jp-esky" stops={[[0, "#3f3558"], [0.55, "#b9808a"], [1, "#f1c9a0"]]} />
      </defs>
      <rect width={1600} height={900} fill="url(#jp-esky)" />
      <circle cx={1260} cy={200} r={60} fill="#fbe7cc" opacity={0.8} />
      <path d="M0 640 Q400 560 800 610 T1600 590 V900 H0Z" fill="#6c6a84" opacity={0.7} />
      <rect x={0} y={780} width={1600} height={120} fill="#cfc6b2" />
      {range(8).map((i) => <path key={i} d={`M0 ${800 + i * 12} Q800 ${790 + i * 12} 1600 ${800 + i * 12}`} stroke="#b8ae98" strokeWidth={2} fill="none" />)}
      {/* building */}
      <rect x={380} y={280} width={840} height={500} fill={C.plaster} />
      <Shoji x={440} y={330} w={160} h={420} lit={0.9} />
      <Shoji x={1000} y={330} w={160} h={420} lit={0.9} />
      {[380, 600, 980, 1200].map((x) => <rect key={x} x={x} y={260} width={24} height={520} fill={C.wood} />)}
      <rect x={360} y={260} width={880} height={28} fill={C.wood} />
      <path d="M220 270 Q300 236 380 200 L1220 200 Q1300 236 1380 270 L1300 270 Q1250 250 1220 240 L380 240 Q350 250 300 270Z" fill="#2b2a30" />
      <path d="M300 200 L420 110 L1180 110 L1300 200Z" fill="#3c3a42" />
      {range(36).map((i) => <rect key={i} x={430 + i * 21} y={112} width={10} height={86} fill="#47454e" />)}
      <path d="M380 110 L800 60 L1220 110Z" fill="#2b2a30" />
      {/* plaque */}
      <rect x={720} y={208} width={160} height={46} fill="#2a1d15" stroke="#b08a4a" strokeWidth={3} />
      <text x={800} y={243} textAnchor="middle" fontFamily={FONT} fontSize={30} fill="#e9d6a8">図書館</text>
      {/* steps */}
      <rect x={560} y={780} width={480} height={26} fill="#9a958a" />
      <rect x={530} y={806} width={540} height={26} fill="#8a8579" />
      <StoneLantern x={300} base={800} s={1.1} />
      <StoneLantern x={1300} base={800} s={1.1} />
      <CherryTree x={140} base={800} s={2.2} seed={41} />
      <CherryTree x={1480} base={800} s={2.4} seed={51} />
    </svg>
  );
}

function FacadeFront() {
  return (
    <g>
      <rect x={612} y={292} width={376} height={12} fill={C.darkWood} />
      <rect x={612} y={292} width={10} height={488} fill={C.darkWood} />
      <rect x={978} y={292} width={10} height={488} fill={C.darkWood} />
    </g>
  );
}

function Door({ side }: { side: "left" | "right" }) {
  return (
    <g>
      <Shoji x={0} y={0} w={180} h={480} lit={1} />
      <rect x={0} y={400} width={180} height={80} fill={C.wood} />
      <rect x={side === "left" ? 160 : 8} y={220} width={10} height={40} rx={4} fill="#2a1d15" />
    </g>
  );
}

function Librarian() {
  return (
    <svg width={110} height={100} viewBox="0 0 110 100">
      <path className="swish" style={{ transformOrigin: "78px 82px" }} d="M78 82 Q108 80 100 50 Q96 40 104 34" stroke="#f4efe6" strokeWidth={9} fill="none" strokeLinecap="round" />
      <ellipse cx={55} cy={74} rx={30} ry={22} fill="#f4efe6" />
      <ellipse cx={66} cy={68} rx={12} ry={10} fill="#d9883c" />
      <circle cx={46} cy={44} r={22} fill="#f4efe6" />
      <path d="M28 34 L30 14 L44 26Z" fill="#f4efe6" />
      <path d="M64 34 L62 14 L48 26Z" fill="#2a2420" />
      <path d="M50 26 Q60 22 64 34 Q58 30 50 30Z" fill="#2a2420" />
      <path d="M36 44 q4 4 8 0 M50 44 q4 4 8 0" stroke="#2a2420" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M45 52 l2 2 l2 -2" stroke="#c4513a" strokeWidth={2} fill="none" />
      <path d="M30 60 Q46 70 62 60" stroke={C.vermilion} strokeWidth={5} fill="none" />
      <circle cx={46} cy={68} r={4} fill="#e2b13c" />
    </svg>
  );
}

export const japanese: Theme = {
  id: "japanese",
  name: "Japanese",
  tagline: "Shoji doors, tatami rooms, lanterns, cherry petals",
  vars: {
    "--bg": "#1d1714",
    "--ink": "#2a1d15",
    "--paper": "#f6ead0",
    "--accent": "#c4513a",
    "--accent-2": "#2f3a5a",
    "--muted": "#7b6a58",
    "--card-bg": "#f7eedb",
    "--card-edge": "#5a3d27",
    "--chip-bg": "rgba(29,23,20,.72)",
    "--chip-ink": "#f6ead0",
  },
  fonts: { display: FONT, body: "Zen Kaku Gothic New, sans-serif" },
  rooms: {
    fiction: { title: "Fiction", subtitle: "Tatami room · 物語の間" },
    selfhelp: { title: "Self-help", subtitle: "Garden room · 庭の間" },
  },
  entrance: {
    door: "slide",
    Facade,
    FacadeFront,
    Door,
    insideGlow: "#ffd79a",
    title: "The Lantern Library",
    hint: "Slide the shoji to enter",
  },
  hall: { Backdrop, Room, Threshold, Shelf, Spine, Ornament, Foreground },
  particles: { kind: "petals", colors: ["#f8c8d4", "#f2a9bd", "#fde3ea"], count: 70 },
  book3d: { coverStyle: "japanese", paper: "#f5ecd7", endpaper: "#2f3a5a", light: "#ffcf86", ambient: 0.75 },
  librarian: { name: "Tama", Art: Librarian, greeting: "Nyaa. Welcome back. Shall I find you something gentle for the evening?" },
};

