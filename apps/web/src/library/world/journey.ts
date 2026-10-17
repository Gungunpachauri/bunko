import * as THREE from "three";
import type { Genre } from "@/library/data/genres";

/**
 * The world layout is generated from the genre list, so the library grows as
 * genres are added: islands zig-zag away from the entrance gate, each joined
 * to the previous one by a bridge with a portal on it. Every theme uses the
 * same layout; skins only change how the pieces look.
 */

export type Chapter =
  | { kind: "gate"; label: string }
  | { kind: "room"; label: string; genre: Genre; index: number }
  | { kind: "crossing"; label: string; from: Genre; to: Genre; index: number }
  | { kind: "overlook"; label: string };

export interface Island {
  genre: Genre;
  pos: THREE.Vector3;
  /** Side (+1 right, −1 left) the bridges use, so trees can avoid it. */
  bridgeSide: number;
}

export interface Crossing {
  from: THREE.Vector3;
  to: THREE.Vector3;
  portal: THREE.Vector3;
  yaw: number;
  /** Chapter index of the crossing (camera stands on the bridge). */
  chapter: number;
  /** Month the bridge appears: when the room it leads to rises. */
  month: number;
}

export interface Journey {
  chapters: Chapter[];
  last: number;
  camCurve: THREE.CatmullRomCurve3;
  lookCurve: THREE.CatmullRomCurve3;
  progressToT: (p: number) => number;
  gate: THREE.Vector3;
  islands: Island[];
  crossings: Crossing[];
  roomChapter: Record<string, number>;
  /** Centre and length of the island chain, for scenery and the overlook. */
  center: THREE.Vector3;
  span: number;
  /** Colour of the air at a point on the journey (genre moods blend between rooms). */
  moodAt: (p: number, out: THREE.Color) => THREE.Color;
}

/** Shared, mutable camera state (read every frame, so kept out of React state). */
export interface JourneyState {
  p: number;
  target: number;
  locked: boolean;
}

const STEP = 24;
const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildJourney(genres: Genre[]): Journey {
  const n = Math.max(1, genres.length);
  const gate = P(0, 0, -14);
  const islands: Island[] = genres.map((genre, i) => ({
    genre,
    pos: P((i % 2) * STEP, 0, -42 - STEP * i),
    // Island 0 sends its bridge right; every later island receives and sends on the same front side.
    bridgeSide: i === 0 ? 1 : (i - 1) % 2 === 0 ? -1 : 1,
  }));

  type Pt = { cam: THREE.Vector3; look: THREE.Vector3; station?: true };
  const path: Pt[] = [
    { cam: P(0, 2.4, 12), look: P(0, 4.4, -14), station: true },
    { cam: P(0, 2.7, -4), look: P(0, 2.8, -30) },
    { cam: P(0, 2.6, -20), look: P(0, 2.4, -42) },
  ];
  const chapters: Chapter[] = [{ kind: "gate", label: "The gate" }];
  const crossings: Crossing[] = [];
  const roomChapter: Record<string, number> = {};

  islands.forEach((isl, i) => {
    const C = isl.pos;
    path.push({ cam: C.clone().add(P(0, 2.25, 4.7)), look: C.clone().add(P(0, 2.12, -1.2)), station: true });
    roomChapter[isl.genre.id] = chapters.length;
    chapters.push({ kind: "room", label: isl.genre.title, genre: isl.genre, index: i });

    const next = islands[i + 1];
    if (!next) return;
    const s = i % 2 === 0 ? 1 : -1;
    const B = next.pos;
    const rel = (x: number, y: number, z: number) => C.clone().add(P(s * x, y, z));
    path.push({ cam: rel(5.5, 3.0, 4.2), look: rel(12, 3.4, -4) });
    path.push({ cam: rel(11.5, 3.5, -2.5), look: rel(19.5, 3.7, -12.8), station: true });
    path.push({ cam: rel(18.5, 3.5, -11.5), look: B.clone().add(P(0, 2.5, 0)) });
    const from = rel(8, 0, 2), to = rel(22, 0, -16);
    const d = to.clone().sub(from);
    crossings.push({
      from, to, portal: rel(15, 0, -7), yaw: Math.atan2(d.x, d.z),
      chapter: chapters.length, month: next.genre.month,
    });
    chapters.push({ kind: "crossing", label: `To ${next.genre.title}`, from: isl.genre, to: next.genre, index: i });
  });

  // Back out of the last room, then rise above the whole chain.
  const L = islands[islands.length - 1]?.pos ?? P(0, 0, -42);
  const zFirst = -42, zLast = L.z;
  const span = Math.abs(zLast - zFirst) + STEP;
  const cx = n > 1 ? STEP / 2 : 0;
  const center = P(cx, 0, (zFirst + zLast) / 2);
  path.push({ cam: L.clone().add(P(0, 3.2, 13)), look: L.clone().add(P(0, 2.6, 2)) });
  // A raised three-quarter view that pulls back as the chain of rooms grows.
  const dir = P(1, 0.55, 0.45).normalize();
  const dist = span * 0.95 + 20;
  // Aim a little left of centre so the rooms sit to the right of the chapter text.
  const k = span * 0.12;
  path.push({ cam: center.clone().addScaledVector(dir, dist), look: center.clone().add(P(-2 - 0.367 * k, 0, 0.816 * k)), station: true });
  chapters.push({ kind: "overlook", label: "The overlook" });

  const camCurve = new THREE.CatmullRomCurve3(path.map((p) => p.cam), false, "centripetal");
  const lookCurve = new THREE.CatmullRomCurve3(path.map((p) => p.look), false, "centripetal");
  const stations = path.map((p, i) => (p.station ? i : -1)).filter((i) => i >= 0);
  const last = stations.length - 1;

  const progressToT = (p: number) => {
    const c = Math.max(0, Math.min(last, p));
    const i = Math.min(last - 1, Math.floor(c));
    const f = c - i;
    const idx = stations[i] + f * (stations[i + 1] - stations[i]);
    return idx / (path.length - 1);
  };

  const rooms = chapters.flatMap((c, i) => (c.kind === "room" ? [{ at: i, color: new THREE.Color(c.genre.mood) }] : []));
  const moodAt = (p: number, out: THREE.Color) => {
    if (!rooms.length) return out.set("#ffffff");
    if (p <= rooms[0].at) return out.copy(rooms[0].color);
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i], b = rooms[i + 1];
      if (p <= b.at) {
        // Hold each room's colour near the room, blend across the crossing.
        const f = THREE.MathUtils.smoothstep(p, a.at + 0.3, b.at - 0.3);
        return out.copy(a.color).lerp(b.color, f);
      }
    }
    return out.copy(rooms[rooms.length - 1].color);
  };

  return { chapters, last, camCurve, lookCurve, progressToT, gate, islands, crossings, roomChapter, center, span, moodAt };
}
