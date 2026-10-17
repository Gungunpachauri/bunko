import type { Theme } from "./types";
import { Glow, VGrad, SpineTitle, rng, range, rectPath } from "./art";

const C = {
  sandal: "#e8cfa0",
  saffron: "#e07b24",
  brass: "#c99a3b",
  brassLight: "#f2d27a",
  terracotta: "#a5532f",
  deep: "#2b1a12",
  stone: "#c2a57c",
  stoneDark: "#8a7052",
  teak: "#6b3f22",
  leaf: "#4f6b3a",
  marigold: "#f39c1e",
};
const FONT = "Yatra One, serif";
const BODY = "Tiro Devanagari Sanskrit, serif";

function Diya({ x, y, s = 1, id }: { x: number; y: number; s?: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Glow id={id} cx={0} cy={-18} r={70} color="#ffb347" opacity={0.6} className="flicker" />
      <path d="M-22 0 Q-24 -14 0 -14 Q24 -14 22 0 Q0 8 -22 0Z" fill={C.terracotta} />
      <path d="M-22 -2 Q0 4 22 -2" stroke="#7a3a1e" strokeWidth={2} fill="none" />
      <path className="flicker" d="M0 -14 C-7 -22 -3 -34 0 -42 C3 -34 7 -22 0 -14Z" fill="#ffd27a" />
      <path d="M0 -16 C-3 -21 -1 -27 0 -31 C1 -27 3 -21 0 -16Z" fill="#fff4c8" />
    </g>
  );
}

function Shikhara({ x, base, s = 1, fill }: { x: number; base: number; s?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${base}) scale(${s})`} fill={fill}>
      <rect x={-60} y={-60} width={120} height={60} />
      <path d="M-44 -60 Q-40 -160 0 -200 Q40 -160 44 -60Z" />
      <ellipse cx={0} cy={-202} rx={16} ry={6} />
      <rect x={-2} y={-240} width={3} height={36} />
      <path d="M1 -240 L22 -232 L1 -224Z" fill="#e07b24" />
    </g>
  );
}

function Garland({ x1, x2, y, sag, seed }: { x1: number; x2: number; y: number; sag: number; seed: number }) {
  const r = rng(seed);
  const n = Math.round((x2 - x1) / 14);
  return (
    <g>
      {range(n + 1).map((i) => {
        const t = i / n;
        const x = x1 + (x2 - x1) * t;
        const yy = y + Math.sin(t * Math.PI) * sag;
        return <circle key={i} cx={x} cy={yy} r={8 + r() * 2} fill={i % 5 === 0 ? "#d9481c" : r() > 0.3 ? C.marigold : "#ffc93c"} />;
      })}
      {range(Math.floor(n / 6)).map((i) => {
        const t = (i * 6 + 3) / n;
        const x = x1 + (x2 - x1) * t;
        const yy = y + Math.sin(t * Math.PI) * sag;
        return (
          <g key={`h${i}`}>
            <line x1={x} y1={yy} x2={x} y2={yy + 40} stroke="#6b8a3a" strokeWidth={2} />
            <path d={`M${x} ${yy + 40} q-8 10 0 22 q8 -12 0 -22`} fill="#5d8a3a" />
          </g>
        );
      })}
    </g>
  );
}

function Bell({ x, y, cord = 60 }: { x: number; y: number; cord?: number }) {
  return (
    <g className="sway" style={{ transformOrigin: `${x}px ${y - cord}px` }}>
      <line x1={x} y1={y - cord} x2={x} y2={y} stroke="#5a3a1a" strokeWidth={2} />
      <path d={`M${x - 16} ${y + 34} Q${x - 16} ${y} ${x} ${y} Q${x + 16} ${y} ${x + 16} ${y + 34}Z`} fill={C.brass} />
      <rect x={x - 19} y={y + 32} width={38} height={5} rx={2} fill="#a87a28" />
      <circle cx={x} cy={y + 42} r={4} fill="#a87a28" />
      <path d={`M${x - 8} ${y + 8} Q${x - 10} ${y + 20} ${x - 8} ${y + 30}`} stroke="#fff3" strokeWidth={3} fill="none" />
    </g>
  );
}

function Pillar({ x, y = 110, h = 670, w = 44 }: { x: number; y?: number; h?: number; w?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.stone} />
      <rect x={x + w * 0.7} y={y} width={w * 0.3} height={h} fill="#00000022" />
      {[0.18, 0.42, 0.66].map((p) => (
        <g key={p}>
          <rect x={x - 4} y={y + h * p} width={w + 8} height={26} fill={C.stoneDark} />
          {range(4).map((i) => <circle key={i} cx={x + 6 + i * 11} cy={y + h * p + 13} r={3} fill={C.stone} />)}
        </g>
      ))}
      <rect x={x - 10} y={y + h - 40} width={w + 20} height={40} fill={C.stoneDark} />
      <path d={`M${x - 26} ${y} h${w + 52} l-14 26 h${-(w + 24)}Z`} fill={C.stoneDark} />
      <circle cx={x - 18} cy={y + 18} r={7} fill={C.stoneDark} />
      <circle cx={x + w + 18} cy={y + 18} r={7} fill={C.stoneDark} />
    </g>
  );
}

function Mandala({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return (
    <g stroke={color} fill="none" strokeWidth={3}>
      {[1, 0.78, 0.56, 0.3].map((k) => <circle key={k} cx={cx} cy={cy} r={r * k} />)}
      {range(16).map((i) => {
        const a = (i / 16) * Math.PI * 2;
        return <ellipse key={i} cx={cx + Math.cos(a) * r * 0.67} cy={cy + Math.sin(a) * r * 0.67} rx={r * 0.1} ry={r * 0.2} transform={`rotate(${(a * 180) / Math.PI + 90} ${cx + Math.cos(a) * r * 0.67} ${cy + Math.sin(a) * r * 0.67})`} />;
      })}
      {range(8).map((i) => {
        const a = (i / 8) * Math.PI * 2;
        return <circle key={i} cx={cx + Math.cos(a) * r * 0.43} cy={cy + Math.sin(a) * r * 0.43} r={r * 0.09} />;
      })}
    </g>
  );
}

function BrassLamp({ x, base, id }: { x: number; base: number; id: string }) {
  return (
    <g transform={`translate(${x} ${base})`}>
      <Glow id={id} cx={0} cy={-210} r={150} color="#ffb347" opacity={0.5} className="flicker" />
      <ellipse cx={0} cy={-6} rx={40} ry={10} fill="#a87a28" />
      <path d="M-30 -6 Q0 -40 30 -6Z" fill={C.brass} />
      <rect x={-5} y={-190} width={10} height={170} fill={C.brass} />
      {[-150, -100].map((y) => <ellipse key={y} cx={0} cy={y} rx={12} ry={6} fill="#a87a28" />)}
      <path d="M-40 -190 Q0 -170 40 -190 Q0 -200 -40 -190Z" fill={C.brass} />
      {[-34, 0, 34].map((dx) => (
        <path key={dx} className="flicker" d={`M${dx} -192 c-5 -8 -2 -18 0 -24 c2 6 5 16 0 24Z`} fill="#ffd27a" />
      ))}
      <path d="M-8 -226 Q0 -250 8 -226 Q0 -236 -8 -226Z" fill={C.brass} />
    </g>
  );
}

function Backdrop() {
  const W = 3200;
  return (
    <svg width={W} height={900} viewBox={`0 0 ${W} 900`}>
      <defs>
        <VGrad id="vd-sky" stops={[[0, "#2b2347"], [0.35, "#7a3a5a"], [0.6, "#d8692a"], [0.75, "#f4b25a"]]} />
        <VGrad id="vd-river" stops={[[0, "#c06a3a"], [0.3, "#5a4a5a"], [1, "#2b3446"]]} />
      </defs>
      <rect width={W} height={900} fill="url(#vd-sky)" />
      {range(40).map((i) => {
        const r = rng(i + 1);
        return <circle key={i} cx={r() * W} cy={r() * 250} r={r() * 1.6 + 0.4} fill="#fff" opacity={0.6} />;
      })}
      <circle cx={1350} cy={640} r={120} fill="#ffd27a" />
      <Glow id="vd-sun" cx={1350} cy={640} r={400} color="#ffcf7a" opacity={0.5} />
      {[[300, 0.9], [760, 1.3], [1950, 1.1], [2550, 1.5], [2950, 0.8]].map(([x, s]) => (
        <Shikhara key={x} x={x} base={660} s={s} fill="#3b2230" />
      ))}
      {/* palms */}
      {[520, 1100, 1700, 2300, 3100].map((x, i) => (
        <g key={x} transform={`translate(${x} 660)`} stroke="#2e1a26" fill="none" strokeLinecap="round">
          <path d={`M0 0 Q${10 + i * 3} -80 ${4 + i * 4} -170`} strokeWidth={8} />
          {range(6).map((k) => {
            const a = -Math.PI / 2 + (k - 2.5) * 0.5;
            return <path key={k} d={`M${4 + i * 4} -170 q${Math.cos(a) * 50} ${Math.sin(a) * 30} ${Math.cos(a) * 90} ${Math.sin(a) * 20 + 40}`} strokeWidth={5} />;
          })}
        </g>
      ))}
      <rect y={660} width={W} height={240} fill="url(#vd-river)" />
      {range(14).map((i) => <rect key={i} x={1350 - 120 + ((i * 37) % 240)} y={680 + i * 14} width={60 + ((i * 23) % 80)} height={3} fill="#ffd27a" opacity={0.5 - i * 0.03} />)}
      {/* ghat steps */}
      {[0, 2200].map((x0) => (
        <g key={x0}>
          {range(6).map((i) => <rect key={i} x={x0 + i * 30} y={660 + i * 22} width={900 - i * 60} height={22} fill={i % 2 ? "#6a4a3a" : "#5a3e30"} />)}
        </g>
      ))}
      {range(10).map((i) => <Diya key={i} x={400 + i * 290} y={760 + (i % 3) * 30} s={0.6} id={`vd-bd${i}`} />)}
    </svg>
  );
}

function StoneFloor({ w }: { w: number }) {
  return (
    <g>
      <rect x={0} y={780} width={w} height={120} fill="#b49870" />
      {range(Math.ceil(w / 160) + 1).map((i) => <line key={i} x1={i * 160} x2={i * 160 + (i * 160 - w / 2) * 0.1} y1={780} y2={900} stroke="#8a7052" strokeWidth={2} />)}
      <line x1={0} x2={w} y1={830} y2={830} stroke="#8a7052" strokeWidth={2} />
      <rect x={0} y={770} width={w} height={12} fill={C.stoneDark} />
    </g>
  );
}

function Rangoli({ x, y }: { x: number; y: number }) {
  const cols = ["#d9481c", "#f39c1e", "#2f7a5a", "#7a2f8a", "#f2f2f2"];
  return (
    <g transform={`translate(${x} ${y}) scale(1 0.32)`}>
      {[90, 70, 50, 30, 12].map((r, i) => <circle key={r} r={r} fill={cols[i]} />)}
      {range(12).map((i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={Math.cos(a) * 104} cy={Math.sin(a) * 104} r={10} fill={cols[i % 4]} />;
      })}
    </g>
  );
}

function Room({ room, index }: { room: "fiction" | "selfhelp"; index: number }) {
  const id = `vd-r${index}`;
  if (room === "fiction") {
    const wall = [rectPath(0, 110, 1600, 670), rectPath(84, 110, 316, 530), rectPath(1210, 110, 316, 530)].join(" ");
    return (
      <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
        <rect x={0} y={-500} width={1600} height={560} fill="#9a7f5c" />
        {range(8).map((i) => <Mandala key={i} cx={100 + i * 200} cy={-120} r={70} color="#7a6040" />)}
        <rect x={0} y={60} width={1600} height={50} fill={C.stoneDark} />
        {range(40).map((i) => <path key={i} d={`M${i * 40 + 6} 108 v-24 a14 14 0 0 1 28 0 v24`} fill="none" stroke="#6a5238" strokeWidth={3} />)}
        <path d={wall} fill={C.stone} fillRule="evenodd" />
        {/* parapet panels in the openings */}
        {[84, 1210].map((x) => (
          <g key={x}>
            <rect x={x} y={640} width={316} height={140} fill={C.stone} />
            {range(4).map((i) => (
              <g key={i}>
                <rect x={x + 14 + i * 76} y={660} width={64} height={100} fill="#b0926a" />
                <path d={`M${x + 46 + i * 76} 680 l18 30 l-18 30 l-18 -30Z`} fill="none" stroke={C.stoneDark} strokeWidth={3} />
              </g>
            ))}
            <rect x={x} y={630} width={316} height={14} fill={C.stoneDark} />
          </g>
        ))}
        <Mandala cx={800} cy={230} r={110} color="#9a7a52" />
        <Mandala cx={800} cy={230} r={60} color={C.brass} />
        {[40, 400, 1166, 1526].map((x) => <Pillar key={x} x={x} />)}
        <Glow id={`${id}-warm`} cx={800} cy={600} r={700} color="#ffb347" opacity={0.18} />
        <StoneFloor w={1600} />
        <BrassLamp x={480} base={780} id={`${id}-l1`} />
        <BrassLamp x={1120} base={780} id={`${id}-l2`} />
        <Rangoli x={250} y={850} />
        {range(7).map((i) => <Diya key={i} x={1250 + i * 50} y={860} s={0.7} id={`${id}-d${i}`} />)}
      </svg>
    );
  }
  // Gurukul under the banyan tree.
  const r = rng(77);
  return (
    <svg width={1600} height={1400} viewBox="0 -500 1600 1400" style={{ overflow: "visible" }}>
      {/* canopy */}
      <g>
        {range(70).map((i) => (
          <circle key={i} cx={r() * 1700 - 50} cy={-480 + r() * 560 - (i % 3) * 30} r={60 + r() * 90} fill={["#2f4a26", "#3a5a2e", "#24391e", "#456a34"][i % 4]} />
        ))}
      </g>
      {/* aerial roots */}
      {[120, 300, 380, 1240, 1330, 1480].map((x, i) => (
        <path key={x} d={`M${x} 40 Q${x + (i % 2 ? 10 : -10)} 400 ${x + 4} ${i % 3 === 0 ? 780 : 520 + i * 30}`} stroke="#5a4030" strokeWidth={4 + (i % 3)} fill="none" />
      ))}
      {/* trunk */}
      <path d="M-40 780 C40 700 70 500 40 300 C20 200 60 120 140 60 L-40 60Z" fill="#5a4030" />
      <path d="M40 780 C90 720 110 600 90 480" stroke="#4a3426" strokeWidth={10} fill="none" />
      <path d="M140 60 C220 30 320 40 420 10" stroke="#5a4030" strokeWidth={30} fill="none" strokeLinecap="round" />
      <path d="M140 60 C200 100 240 60 300 90" stroke="#5a4030" strokeWidth={14} fill="none" />
      {/* thatched hut wall behind the shelf */}
      <rect x={470} y={330} width={660} height={450} fill="#c08a5a" />
      {range(6).map((row) => range(14).map((c) => (
        <circle key={`${row}-${c}`} cx={500 + c * 46} cy={360 + row * 70} r={3} fill="#f6ead0" opacity={0.85} />
      )))}
      <path d="M500 400 l20 -30 l20 30Z M1080 400 l20 -30 l20 30Z" fill="#f6ead0" opacity={0.85} />
      <path d="M430 340 Q800 200 1170 340 L1150 360 Q800 240 450 360Z" fill="#c9a24b" />
      <path d="M430 340 Q800 200 1170 340" stroke="#a07a2a" strokeWidth={6} fill="none" />
      {range(30).map((i) => <line key={i} x1={450 + i * 24} y1={350 - Math.sin((i / 29) * Math.PI) * 100} x2={446 + i * 24} y2={366 - Math.sin((i / 29) * Math.PI) * 100} stroke="#8a6a2a" strokeWidth={2} />)}
      {/* earth floor and platform */}
      <rect x={0} y={780} width={1600} height={120} fill="#9a6a3a" />
      <rect x={0} y={770} width={1600} height={14} fill="#7a5230" />
      {range(30).map((i) => <circle key={i} cx={r() * 1600} cy={800 + r() * 90} r={2 + r() * 3} fill="#7a5230" />)}
      {/* havan kund and seats */}
      <g transform="translate(1330 830)">
        <Glow id={`${id}-fire`} cx={0} cy={-40} r={220} color="#ff8a2a" opacity={0.55} className="flicker" />
        <path d="M-60 0 L-46 -30 H46 L60 0Z" fill="#8a4a2a" />
        <path className="flicker" d="M-26 -30 C-30 -60 -10 -70 -4 -100 C6 -70 20 -66 14 -40 C24 -56 32 -50 26 -30Z" fill="#ffb347" />
        <path d="M-10 -30 C-12 -46 0 -54 2 -70 C8 -52 14 -46 10 -30Z" fill="#fff0b0" />
        {[-140, 140].map((x) => <ellipse key={x} cx={x} cy={10} rx={50} ry={12} fill="#c9a24b" />)}
      </g>
      <Bell x={420} y={60} cord={50} />
      <Bell x={1220} y={70} cord={70} />
      <Glow id={`${id}-dusk`} cx={800} cy={400} r={800} color="#ffb347" opacity={0.12} />
    </svg>
  );
}

function Threshold() {
  return (
    <svg width={300} height={1400} viewBox="-150 -500 300 1400" style={{ overflow: "visible" }}>
      <Pillar x={-130} y={160} h={620} w={40} />
      <Pillar x={90} y={160} h={620} w={40} />
      <path d="M-170 140 Q-180 100 -150 100 H150 Q180 100 170 140 Q160 120 140 124 H-140 Q-160 120 -170 140Z" fill={C.stoneDark} />
      <path d="M-160 80 Q-170 40 -140 40 H140 Q170 40 160 80 Q150 60 130 64 H-130 Q-150 60 -160 80Z" fill={C.stone} />
      <rect x={-140} y={64} width={280} height={36} fill={C.stone} />
      {range(7).map((i) => <circle key={i} cx={-120 + i * 40} cy={82} r={8} fill={C.stoneDark} />)}
      <Garland x1={-110} x2={110} y={170} sag={70} seed={9} />
      <Bell x={-60} y={150} cord={30} />
      <Bell x={60} y={150} cord={30} />
    </svg>
  );
}

function Shelf() {
  return (
    <svg width={520} height={480} viewBox="0 0 520 480" style={{ overflow: "visible" }}>
      <rect x={0} y={0} width={520} height={480} fill="#3b2414" />
      {range(12).map((i) => <line key={i} x1={i * 44 + 20} y1={0} x2={i * 44 + 22} y2={480} stroke="#00000030" strokeWidth={2} />)}
      <path d="M200 -10 Q260 -70 320 -10Z" fill={C.teak} />
      <circle cx={260} cy={-30} r={10} fill={C.brass} />
      <rect x={-14} y={-12} width={548} height={48} fill={C.teak} />
      {range(13).map((i) => <circle key={i} cx={14 + i * 41} cy={12} r={5} fill={C.brass} />)}
      <rect x={0} y={236} width={520} height={20} fill={C.teak} />
      <rect x={0} y={456} width={520} height={24} fill={C.teak} />
      <rect x={0} y={0} width={20} height={480} fill={C.teak} />
      <rect x={500} y={0} width={20} height={480} fill={C.teak} />
      {[[0, 36], [500, 36], [0, 446], [500, 446]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} h20 v20 l-10 -6 l-10 6Z`} fill={C.brass} />
      ))}
      <ellipse cx={260} cy={486} rx={300} ry={10} fill="#00000035" />
    </svg>
  );
}

function Spine({ book }: { book: { w: number; h: number; color: string; spineTitle: string } }) {
  const { w, h, color } = book;
  const leafW = w - 16;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {/* wooden boards either side of the palm-leaf stack */}
      <rect x={0} y={0} width={8} height={h} rx={2} fill={color} />
      <rect x={w - 8} y={0} width={8} height={h} rx={2} fill={color} />
      <rect x={8} y={3} width={leafW} height={h - 6} fill="#d9b56a" />
      {range(Math.floor(leafW / 3)).map((i) => (
        <line key={i} x1={9 + i * 3} x2={9 + i * 3} y1={3} y2={h - 3} stroke="#b38a40" strokeWidth={0.8} opacity={0.6} />
      ))}
      {/* cord through the holes */}
      {[0.22, 0.78].map((p) => (
        <g key={p}>
          <rect x={0} y={h * p - 3} width={w} height={6} fill="#8a1e1e" />
          <circle cx={w / 2} cy={h * p} r={4} fill="#3a0e0e" />
        </g>
      ))}
      <SpineTitle w={w} h={h * 0.78 - 8} y0={h * 0.22 + 8} text={book.spineTitle} font={FONT} color="#3b1e0e" size={15} weight={400} />
    </svg>
  );
}

function Ornament({ row, w, h }: { row: 0 | 1; w: number; h: number }) {
  const cx = w / 2;
  if (row === 0) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <Glow id="vd-orn-glow" cx={cx} cy={h - 70} r={90} color="#ffb347" opacity={0.6} className="flicker" />
        <ellipse cx={cx} cy={h - 4} rx={28} ry={6} fill="#a87a28" />
        <rect x={cx - 4} y={h - 50} width={8} height={46} fill={C.brass} />
        <path d={`M${cx - 30} ${h - 52} Q${cx} ${h - 30} ${cx + 30} ${h - 52} Q${cx} ${h - 62} ${cx - 30} ${h - 52}Z`} fill={C.brass} />
        <path className="flicker" d={`M${cx} ${h - 58} c-6 -10 -3 -22 0 -30 c3 8 6 20 0 30Z`} fill="#ffd27a" />
      </svg>
    );
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <path d={`M${cx - 20} ${h} Q${cx - 44} ${h - 30} ${cx - 20} ${h - 60} H${cx + 20} Q${cx + 44} ${h - 30} ${cx + 20} ${h}Z`} fill={C.brass} />
      <rect x={cx - 22} y={h - 66} width={44} height={8} rx={3} fill="#a87a28" />
      {[-30, -16, 0, 16, 30].map((dx) => (
        <path key={dx} d={`M${cx} ${h - 64} q${dx} -14 ${dx * 1.2} -34 q${-dx * 0.4} 16 ${-dx * 1.2} 34`} fill="#4f7a2a" />
      ))}
      <ellipse cx={cx} cy={h - 84} rx={18} ry={22} fill="#8a5a2a" />
      <path d={`M${cx - 10} ${h - 100} q10 -14 20 0`} stroke="#c9a24b" strokeWidth={3} fill="none" />
      <path d={`M${cx - 14} ${h - 30} h28`} stroke="#d9481c" strokeWidth={4} />
    </svg>
  );
}

function Foreground() {
  return (
    <svg width={3840} height={900} viewBox="0 0 3840 900" style={{ overflow: "visible" }}>
      <Garland x1={-40} x2={520} y={-10} sag={80} seed={1} />
      <Garland x1={1100} x2={1700} y={-10} sag={90} seed={2} />
      <Garland x1={1900} x2={2400} y={-10} sag={70} seed={3} />
      <Garland x1={3000} x2={3600} y={-10} sag={90} seed={4} />
      <Bell x={360} y={110} cord={90} />
      <Bell x={1500} y={120} cord={100} />
      <Bell x={2250} y={90} cord={80} />
      <Bell x={3400} y={120} cord={100} />
      {[60, 140, 1460, 1540, 1980, 2060, 3420, 3500].map((x, i) => <Diya key={x} x={x} y={890} s={1.2} id={`vd-fd${i}`} />)}
      {[[-30, 1], [3560, -1]].map(([x, f]) => (
        <g key={x} transform={`translate(${x} 900) scale(${f} 1)`} fill="#3a5a2a">
          {range(5).map((i) => <ellipse key={i} cx={40 + i * 26} cy={-60 - i * 40} rx={34} ry={18} transform={`rotate(${-30 - i * 8} ${40 + i * 26} ${-60 - i * 40})`} />)}
        </g>
      ))}
    </svg>
  );
}

function Facade() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <VGrad id="vd-esky" stops={[[0, "#2b2347"], [0.5, "#8a3f5a"], [0.85, "#e07b24"], [1, "#f4b25a"]]} />
      </defs>
      <rect width={1600} height={900} fill="url(#vd-esky)" />
      {range(50).map((i) => {
        const r = rng(i + 100);
        return <circle key={i} cx={r() * 1600} cy={r() * 300} r={r() * 1.6 + 0.4} fill="#fff" opacity={0.7} />;
      })}
      {/* banyan trees either side */}
      {[[-60, 1], [1660, -1]].map(([x, f]) => (
        <g key={x} transform={`translate(${x} 0) scale(${f} 1)`}>
          {range(24).map((i) => {
            const r = rng(i + 7);
            return <circle key={i} cx={r() * 420} cy={60 + r() * 300} r={50 + r() * 60} fill={["#2a3a22", "#334a28", "#1f2e1a"][i % 3]} />;
          })}
          <path d="M120 780 C150 600 160 400 200 300 L280 300 C260 420 260 600 300 780Z" fill="#4a3426" />
          {[220, 330, 380].map((rx) => <line key={rx} x1={rx} y1={300} x2={rx + 6} y2={760} stroke="#4a3426" strokeWidth={4} />)}
        </g>
      ))}
      {/* temple front */}
      <rect x={440} y={300} width={720} height={480} fill={C.stone} />
      {range(5).map((i) => <rect key={i} x={440} y={330 + i * 90} width={720} height={6} fill={C.stoneDark} opacity={0.6} />)}
      {/* gopuram tiers */}
      {range(5).map((i) => (
        <g key={i}>
          <rect x={500 + i * 40} y={240 - i * 46} width={600 - i * 80} height={48} fill={i % 2 ? C.stone : "#b0926a"} />
          {range(Math.floor((600 - i * 80) / 40)).map((k) => (
            <path key={k} d={`M${512 + i * 40 + k * 40} ${286 - i * 46} v-22 a12 12 0 0 1 24 0 v22`} fill="none" stroke={C.stoneDark} strokeWidth={3} />
          ))}
        </g>
      ))}
      <path d="M680 10 Q800 -40 920 10 L900 30 H700Z" fill={C.stoneDark} />
      {[740, 800, 860].map((x) => <path key={x} d={`M${x - 8} 12 Q${x} -20 ${x + 8} 12Z`} fill={C.brass} />)}
      {/* nested door frames */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={590 - i * 22} y={290 - i * 22} width={420 + i * 44} height={490 + i * 22} fill="none" stroke={i % 2 ? C.stoneDark : "#9a7f5c"} strokeWidth={16} />
      ))}
      <Mandala cx={800} cy={240} r={34} color={C.brassLight} />
      {/* steps with kolam */}
      <rect x={520} y={780} width={560} height={26} fill="#a78c66" />
      <rect x={480} y={806} width={640} height={26} fill="#97805e" />
      <rect x={0} y={832} width={1600} height={68} fill="#7a5a3a" />
      <Rangoli x={800} y={866} />
      {range(6).map((i) => <Diya key={i} x={490 + i * 20} y={804} s={0.6} id={`vd-ed${i}`} />)}
      {range(6).map((i) => <Diya key={i} x={1010 + i * 20} y={804} s={0.6} id={`vd-ee${i}`} />)}
      <BrassLamp x={470} base={780} id="vd-el1" />
      <BrassLamp x={1130} base={780} id="vd-el2" />
    </svg>
  );
}

function FacadeFront() {
  return (
    <g>
      <Garland x1={610} x2={990} y={300} sag={40} seed={21} />
      <Bell x={800} y={330} cord={30} />
    </g>
  );
}

function Door({ side }: { side: "left" | "right" }) {
  return (
    <g>
      <rect width={180} height={480} fill="#6b3f22" />
      {range(4).map((i) => (
        <rect key={i} x={16} y={16 + i * 116} width={148} height={102} fill="none" stroke="#4a2a14" strokeWidth={6} />
      ))}
      {range(4).map((i) => range(3).map((c) => (
        <circle key={`${i}-${c}`} cx={40 + c * 50} cy={67 + i * 116} r={8} fill={C.brass} />
      )))}
      <rect width={180} height={480} fill="none" stroke="#3b2414" strokeWidth={8} />
      <circle cx={side === "left" ? 160 : 20} cy={250} r={14} fill="none" stroke={C.brass} strokeWidth={5} />
    </g>
  );
}

function Librarian() {
  return (
    <svg width={110} height={100} viewBox="0 0 110 100">
      <ellipse cx={58} cy={90} rx={44} ry={6} fill="#3d5a6b" opacity={0.6} />
      <path d="M20 78 Q30 54 64 58 Q96 60 100 40 Q104 70 80 84 Q50 94 20 78Z" fill="#fbf8f0" />
      <path d="M58 64 Q80 62 94 46" stroke="#e6dfcf" strokeWidth={3} fill="none" />
      <path d="M34 70 Q24 50 30 30 Q34 14 46 14" stroke="#fbf8f0" strokeWidth={10} fill="none" strokeLinecap="round" />
      <circle cx={46} cy={16} r={9} fill="#fbf8f0" />
      <path d="M54 14 L68 18 L54 21Z" fill="#e07b24" />
      <circle cx={48} cy={14} r={1.8} fill="#2b1a12" />
      <path d="M40 8 L44 2 L48 8 L52 2 L54 8" stroke={C.brass} strokeWidth={2} fill="none" />
    </svg>
  );
}

export const vedic: Theme = {
  id: "vedic",
  name: "Vedic",
  tagline: "A gurukul under the banyan, stone pillars, palm-leaf manuscripts, diyas",
  vars: {
    "--bg": "#2b1a12",
    "--ink": "#3b1e0e",
    "--paper": "#fbeed2",
    "--accent": "#d0661c",
    "--accent-2": "#c99a3b",
    "--muted": "#7a5a3a",
    "--card-bg": "#f6e6c4",
    "--card-edge": "#c99a3b",
    "--chip-bg": "rgba(43,26,18,.75)",
    "--chip-ink": "#fbeed2",
  },
  fonts: { display: FONT, body: BODY },
  rooms: {
    fiction: { title: "Fiction", subtitle: "Pillared hall · कथा मण्डप" },
    selfhelp: { title: "Self-help", subtitle: "Banyan gurukul · वट गुरुकुल" },
  },
  entrance: {
    door: "swing",
    Facade,
    FacadeFront,
    Door,
    insideGlow: "#ffc46b",
    title: "The Banyan Ashram",
    hint: "Open the temple doors",
  },
  hall: { Backdrop, Room, Threshold, Shelf, Spine, Ornament, Foreground },
  particles: { kind: "embers", colors: ["#ffb347", "#ffd27a", "#ff7a2a"], count: 80 },
  book3d: { coverStyle: "vedic", paper: "#ecd9a8", endpaper: "#8a3a1e", light: "#ffb347", ambient: 0.8 },
  librarian: { name: "Hamsa", Art: Librarian, greeting: "Namaste. Like the swan that separates milk from water, I will help you find the essence of what you read." },
};
