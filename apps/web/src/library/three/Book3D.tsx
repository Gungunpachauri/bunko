import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Book } from "@/library/data/books";
import type { Theme } from "@/library/themes/types";
import type { SpineRect } from "@/library/ui/types";
import { coverCanvas, endpaperCanvas, pageCanvas, spineCanvas } from "@/library/three/textures";

const BW = 2.1; // width
const BH = 3.0; // height
const BD = 0.5; // thickness
const PAGES = 4;

// Timeline (seconds).
const T_PULL = 0.35;
const T_FLY = 1.15;
const T_OPEN = 1.95;
const T_END = 2.6;
export const CARD_AT = 1.35;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

interface Props {
  book: Book;
  theme: Theme;
  from: SpineRect;
  /** 1 = opening, -1 = closing. */
  direction: 1 | -1;
  reduced: boolean;
  onCardTime: () => void;
  onClosed: () => void;
}

/** The signature moment: the book slides off the shelf, turns, flies to you and opens. */
export function Book3D({ book, theme, from, direction, reduced, onCardTime, onClosed }: Props) {
  const { camera, size } = useThree();
  const group = useRef<THREE.Group>(null);
  const cover = useRef<THREE.Group>(null);
  const pages = useRef<(THREE.Group | null)[]>([]);
  const pageGeoms = useMemo(
    () => Array.from({ length: PAGES }, () => {
      const g = new THREE.PlaneGeometry(BW - 0.1, BH - 0.14, 18, 1);
      g.translate((BW - 0.1) / 2, 0, 0);
      return g;
    }),
    [],
  );
  const basePositions = useMemo(() => Float32Array.from(pageGeoms[0].attributes.position.array as Float32Array), [pageGeoms]);
  const t = useRef(reduced ? T_END : 0);
  const cardFired = useRef(false);
  const closedFired = useRef(false);

  const mats = useMemo(() => {
    const coverTex = tex(coverCanvas(book, theme));
    const spineTex = tex(spineCanvas(book, theme));
    const pageTex = tex(pageCanvas(book, theme));
    const endTex = tex(endpaperCanvas(theme));
    const color = new THREE.Color(book.color);
    const board = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
    const paper = new THREE.MeshStandardMaterial({ color: theme.book3d.paper, roughness: 0.95 });
    const paperEdge = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.book3d.paper).multiplyScalar(0.86), roughness: 1 });
    return {
      // Box face order: +x, -x, +y, -y, +z, -z
      front: [board, board, board, board, new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.7 }), new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.9 })],
      back: [board, board, board, board, new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.9 }), board],
      spine: [board, new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.7 }), board, board, board, board],
      block: [paperEdge, paperEdge, paperEdge, paperEdge, new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.95 }), paper],
      page: new THREE.MeshStandardMaterial({ color: theme.book3d.paper, roughness: 0.95, side: THREE.DoubleSide }),
    };
  }, [book, theme]);

  useEffect(() => () => {
    Object.values(mats).flat().forEach((m) => {
      const mm = m as THREE.MeshStandardMaterial;
      mm.map?.dispose();
      mm.dispose();
    });
    pageGeoms.forEach((g) => g.dispose());
  }, [mats, pageGeoms]);

  useEffect(() => {
    cardFired.current = direction === -1;
    closedFired.current = false;
    if (reduced && direction === -1) t.current = 0;
  }, [direction, reduced]);

  // Screen-space helpers at z = 0.
  const persp = camera as THREE.PerspectiveCamera;
  const visH = 2 * persp.position.z * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));
  const unit = visH / size.height;
  const visW = size.width * unit;
  const startX = (from.x + from.w / 2 - size.width / 2) * unit;
  const startY = -(from.y + from.h / 2 - size.height / 2) * unit;
  const startScale = (from.h * unit) / BH;
  const narrow = size.width < size.height * 0.95;
  const endScale = narrow ? Math.min(0.62, (visW * 0.42) / BW) : Math.min(1, (visH * 0.62) / BH);
  // Final spine position (the open book is centred on its spine).
  const endX = narrow ? 0 : -visW * 0.2;
  const endY = narrow ? visH * 0.13 : 0.05;

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const step = Math.min(dt, 1 / 30);
    t.current = Math.max(0, Math.min(T_END, t.current + step * direction * (direction === 1 ? 1 : 1.6)));
    const tt = t.current;

    if (direction === 1 && !cardFired.current && tt >= CARD_AT) {
      cardFired.current = true;
      onCardTime();
    }
    if (direction === -1 && !closedFired.current && tt <= 0) {
      closedFired.current = true;
      onClosed();
    }

    const pull = ease(seg(tt, 0, T_PULL));
    const fly = ease(seg(tt, T_PULL, T_FLY));
    const open = ease(seg(tt, T_FLY - 0.1, T_OPEN));

    // While on the shelf the spine faces us (rotation.y = π/2), then it turns to show the cover.
    // The group origin is the spine, so position it at the spine's screen spot.
    const s = lerp(startScale, endScale, fly);
    g.scale.setScalar(s);
    const idle = tt >= T_OPEN ? Math.sin(state.clock.elapsedTime * 1.2) * 0.04 : 0;
    g.position.set(
      lerp(startX, endX, fly),
      lerp(startY, endY, fly) + idle,
      lerp(0, 1.2, pull) * (1 - fly) + lerp(0, 0.6, fly),
    );
    g.rotation.y = lerp(Math.PI / 2, 0.06, fly) - pull * 0.08 * (1 - fly);
    g.rotation.x = lerp(0, -0.08, fly);
    g.rotation.z = lerp(0, -0.02, fly);

    if (cover.current) cover.current.rotation.y = -Math.PI * 0.97 * open;

    const pos = pageGeoms;
    pages.current.forEach((p, i) => {
      if (!p) return;
      const start = T_FLY + 0.15 + i * 0.12;
      const pt = ease(seg(tt, start, start + 0.55));
      const restAngle = Math.PI * (0.955 - i * 0.012);
      p.rotation.y = -restAngle * pt;
      // Bend the page while it turns.
      const bend = Math.sin(pt * Math.PI) * 0.45;
      const arr = pos[i].attributes.position.array as Float32Array;
      for (let v = 0; v < arr.length; v += 3) {
        const u = basePositions[v] / (BW - 0.1);
        arr[v + 2] = bend * Math.sin(u * Math.PI * 0.9) * u;
      }
      pos[i].attributes.position.needsUpdate = true;
    });
  });

  // Group origin sits on the spine edge (x = 0), the book extends to +x.
  return (
    <group ref={group}>
      <group position={[BW / 2, 0, 0]}>
        {/* back board */}
        <mesh material={mats.back} position={[0, 0, -BD / 2 + 0.025]} castShadow>
          <boxGeometry args={[BW, BH, 0.05]} />
        </mesh>
        {/* spine */}
        <mesh material={mats.spine} position={[-BW / 2 - 0.02, 0, 0]}>
          <boxGeometry args={[0.05, BH, BD]} />
        </mesh>
        {/* page block */}
        <mesh material={mats.block} position={[0.02, 0, -0.02]}>
          <boxGeometry args={[BW - 0.08, BH - 0.1, BD - 0.16]} />
        </mesh>
      </group>
      {/* turning pages, hinged at the spine */}
      {pageGeoms.map((geo, i) => (
        <group key={i} ref={(el) => { pages.current[i] = el; }} position={[0.02, 0, BD / 2 - 0.095 + (PAGES - i) * 0.004]}>
          <mesh geometry={geo} material={mats.page} />
        </group>
      ))}
      {/* front cover, hinged at the spine */}
      <group ref={cover} position={[0, 0, BD / 2 - 0.025]}>
        <mesh material={mats.front} position={[BW / 2, 0, 0]}>
          <boxGeometry args={[BW, BH, 0.05]} />
        </mesh>
      </group>
    </group>
  );
}
