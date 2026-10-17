import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import type { Book } from "../data/books";
import { roomSlots, SHELF } from "../layout";
import type { Theme } from "../themes/types";
import type { SpineRect } from "../ui/Hall";
import type { Atmo } from "./Environment";
import type { WorldSkin } from "./skins";
import { addedMonth, finishedMonth } from "../data/timeline";
import { smooth, type Growth } from "./Growth";

/** Design units (the 2.5D layout) → metres. The shelf keeps exactly the same slots. */
const K = 3.2 / SHELF.w;
const W = SHELF.w * K;
const H = SHELF.h * K;
const D = 0.55;
const BOOK_D = 0.42;

/** Render the theme's own SVG spine into a texture so each skin keeps its spine art. */
function useSpineTexture(book: Book, theme: Theme) {
  const tex = useMemo(() => {
    const scale = 4;
    const c = document.createElement("canvas");
    c.width = book.w * scale;
    c.height = book.h * scale;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = book.color;
    ctx.fillRect(0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const markup = renderToStaticMarkup(<theme.hall.Spine book={book} />).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, c.width, c.height);
      t.needsUpdate = true;
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    return t;
  }, [book, theme]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Book3DOnShelf({ book, x, y, hidden, enabled, skin, theme, onPick, registry, growth }: {
  book: Book; x: number; y: number; hidden: boolean; enabled: () => boolean;
  skin: WorldSkin; theme: Theme; onPick: (book: Book, rect: SpineRect) => void;
  registry: Map<string, () => void>; growth: Growth;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const holder = useRef<THREE.Group>(null);
  const band = useRef<THREE.Mesh>(null);
  const added = addedMonth(book);
  const finished = finishedMonth(book);
  const [hover, setHover] = useState(false);
  const { camera, size } = useThree();
  const spine = useSpineTexture(book, theme);
  const mats = useMemo(() => {
    const cover = new THREE.MeshStandardMaterial({ color: book.color, roughness: 0.7 });
    const pages = new THREE.MeshStandardMaterial({ color: skin.paper, roughness: 0.95 });
    const face = new THREE.MeshStandardMaterial({ map: spine, roughness: 0.65 });
    return [cover, cover, pages, pages, face, cover];
  }, [book.color, skin.paper, spine]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);

  const w = book.w * K, h = book.h * K;
  useFrame((st, dt) => {
    // Books slide onto the shelf in the month they were added; finished ones get a gold band.
    const on = smooth(added - 0.7, added, growth.month);
    if (holder.current) {
      holder.current.scale.set(1, Math.max(0.001, on), 1);
      holder.current.visible = on > 0.01;
    }
    if (band.current) {
      const f = finished === null ? 0 : smooth(finished - 0.3, finished, growth.month);
      band.current.visible = f > 0.01;
      const mat = band.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = f * (2 + Math.sin(st.clock.elapsedTime * 2.5) * 0.6);
    }
    const m = mesh.current;
    if (!m) return;
    const k = Math.min(1, dt * 10);
    const tz = hover ? 0.2 : 0;
    m.position.z += (tz - m.position.z) * k;
    m.rotation.x += ((hover ? -0.07 : 0) - m.rotation.x) * k;
  });

  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => { document.body.style.cursor = ""; };
  }, [hover]);

  const pick = () => {
    const m = mesh.current;
    if (!m || !enabled() || growth.month < added) return;
    m.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(m);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const cx of [box.min.x, box.max.x]) for (const cy of [box.min.y, box.max.y]) {
      const v = new THREE.Vector3(cx, cy, box.max.z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * size.width, sy = (-v.y * 0.5 + 0.5) * size.height;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    setHover(false);
    onPick(book, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  };

  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    registry.set(book.id, () => pickRef.current());
    return () => { registry.delete(book.id); };
  }, [registry, book.id]);

  return (
    <group position={[x + w / 2, y, D / 2 - BOOK_D / 2 + 0.02]} ref={holder}>
     <group position={[0, h / 2, 0]}>
      <mesh
        ref={mesh}
        material={mats}
        visible={!hidden}
        onPointerOver={(e) => { if (!enabled()) return; e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => { e.stopPropagation(); pick(); }}
      >
        <boxGeometry args={[w * 0.98, h, BOOK_D]} />
      </mesh>
      <mesh ref={band} position={[0, -h / 2 + 0.12, BOOK_D / 2 + 0.004]} visible={false}>
        <boxGeometry args={[w * 0.9, 0.05, 0.006]} />
        <meshStandardMaterial color="#f2c55a" emissive="#ffcf5a" emissiveIntensity={0} toneMapped={false} />
      </mesh>
     </group>
    </group>
  );
}

export function Shelf3D({ room, books, theme, skin, atmo, hiddenBookId, enabled, onPick, registry, growth }: {
  room: string; books: Book[]; theme: Theme; skin: WorldSkin; atmo: Atmo; hiddenBookId: string | null;
  enabled: () => boolean; onPick: (book: Book, rect: SpineRect) => void; registry: Map<string, () => void>; growth: Growth;
}) {
  const { slots, ornaments } = useMemo(() => roomSlots(room, books), [room, books]);
  const orb = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => { if (orb.current) orb.current.emissiveIntensity = (1.5 + Math.sin(s.clock.elapsedTime * 2) * 0.3) * atmo.lanterns; });
  const wood = skin.wood;
  const frame = <meshStandardMaterial color={wood} roughness={0.7} />;
  const boardY = SHELF.rowBase.map((b) => H - b * K);
  return (
    <group position={[-W / 2, 0, 0]}>
      <mesh position={[W / 2, H / 2, -D / 2 + 0.02]}><boxGeometry args={[W, H, 0.04]} /><meshStandardMaterial color={new THREE.Color(wood).multiplyScalar(0.55)} roughness={0.9} /></mesh>
      <mesh position={[0.06, H / 2, 0]}><boxGeometry args={[0.12, H, D]} />{frame}</mesh>
      <mesh position={[W - 0.06, H / 2, 0]}><boxGeometry args={[0.12, H, D]} />{frame}</mesh>
      <mesh position={[W / 2, H - 0.11, 0]}><boxGeometry args={[W + 0.16, 0.22, D + 0.06]} />{frame}</mesh>
      {boardY.map((y) => <mesh key={y} position={[W / 2, y - 0.06, 0]}><boxGeometry args={[W, 0.12, D]} />{frame}</mesh>)}
      <mesh position={[W / 2, H + 0.02, D / 2 + 0.03]}><boxGeometry args={[W + 0.16, 0.03, 0.02]} /><meshStandardMaterial color={skin.trim} metalness={0.7} roughness={0.35} /></mesh>
      {slots.map(({ book, x, y }) => (
        <Book3DOnShelf
          key={book.id}
          book={book}
          x={x * K}
          y={H - (y + book.h) * K}
          hidden={hiddenBookId === book.id}
          enabled={enabled}
          skin={skin}
          theme={theme}
          onPick={onPick}
          registry={registry}
          growth={growth}
        />
      ))}
      {ornaments.map((o) => {
        const cx = (o.x + o.w / 2) * K;
        const base = H - SHELF.rowBase[o.row] * K;
        return o.row === 0 ? (
          <group key={o.row} position={[cx, base, 0]}>
            <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.1, 0.14, 0.24, 16]} /><meshStandardMaterial color={skin.trim} metalness={0.7} roughness={0.35} /></mesh>
            <mesh position={[0, 0.42, 0]}><sphereGeometry args={[0.17, 24, 16]} /><meshStandardMaterial ref={orb} color={skin.glow} emissive={skin.glow} emissiveIntensity={1.5} toneMapped={false} /></mesh>
          </group>
        ) : (
          <group key={o.row} position={[cx, base, 0]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[0, 0.05 + i * 0.1, 0]} rotation-y={i * 0.2}><boxGeometry args={[0.5 - i * 0.06, 0.09, 0.34]} /><meshStandardMaterial color={["#7a3b3b", skin.accent, "#2f3a5a"][i]} roughness={0.8} /></mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
