"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { api, type ApiReadingMap } from "@/lib/api";
import { initialChoice } from "@/library/LibraryApp";
import { loadThemeFonts } from "@/library/three/textures";
import { getTheme } from "@/library/themes";
import { sound } from "@/lib/sound";
import { useAccess } from "@/lib/access";
import { Detail } from "@/components/ConnectionsDialog";
import { SoundToggle } from "@/components/SoundToggle";
import { layoutMap, type MapNode } from "@/map/layout";

/** The reading map: your books as bright stars, their ideas as small ones, lines where books share an idea. */
export default function ReadingMap() {
  const { visitor } = useAccess(); // mapping books is the owner's job on the public demo
  const router = useRouter();
  const [data, setData] = useState<ApiReadingMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const theme = useMemo(() => {
    const c = initialChoice();
    return getTheme(c === "mixed" ? undefined : c);
  }, []);
  useEffect(() => { loadThemeFonts(theme); }, [theme]);
  // Among the stars it's always the space hum.
  useEffect(() => { sound.setAmbience("space", 0.8); }, []);

  useEffect(() => {
    let alive = true;
    api.readingMap().then((d) => alive && setData(d)).catch((e) => alive && setError(String(e.message ?? e)));
    return () => { alive = false; };
  }, [tick]);

  const building = data?.books.some((b) => b.graph === "queued" || b.graph === "building");
  // While books are being mapped, refresh every 10 seconds so new stars appear.
  useEffect(() => {
    if (!building) return;
    const id = window.setTimeout(() => setTick((t) => t + 1), 10000);
    return () => window.clearTimeout(id);
  }, [building, data]);

  const { nodes, edges } = useMemo(() => (data ? layoutMap(data) : { nodes: [], edges: [] }), [data]);
  const byKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);
  const ideas = data?.ideas ?? [];
  const shared = ideas.filter((i) => i.books.length > 1).sort((a, b) => b.books.length - a.books.length || b.count - a.count);
  const lonely = ideas.filter((i) => i.books.length === 1);
  const unmapped = data?.books.filter((b) => b.graph !== "ready") ?? [];
  const titleOf = (id: string) => data?.books.find((b) => b.id === id)?.title.split(/[;:(]/)[0].trim() ?? "";

  const mapAll = async () => {
    try {
      await api.buildAllConnections();
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const vars = { ...theme.vars, "--font-display": theme.fonts.display, "--font-body": theme.fonts.body } as React.CSSProperties;
  const focus = selected?.key ?? hovered;
  const near = useMemo(() => {
    const s = new Set<string>();
    if (!focus) return s;
    s.add(focus);
    for (const e of edges) {
      if (e.a === focus) s.add(e.b);
      if (e.b === focus) s.add(e.a);
    }
    return s;
  }, [focus, edges]);

  // Labels are plain elements over the canvas, moved every frame by LabelProjector (no extra React roots).
  const labelEls = useRef(new Map<string, HTMLDivElement>());

  return (
    <div className="map-page" style={vars} data-theme={theme.id}>
      <Canvas camera={{ position: [0, 7, 44], fov: 45 }} dpr={[1, 1.75]} onPointerMissed={() => setSelected(null)}>
        <color attach="background" args={["#05040c"]} />
        <fog attach="fog" args={["#05040c", 45, 100]} />
        <Sky />
        <Edges nodes={byKey} edges={edges} near={near} />
        {nodes.map((n) => (
          <Star key={n.key} node={n} dim={!!focus && !near.has(n.key)} selected={selected?.key === n.key}
            onHover={(on) => setHovered(on ? n.key : null)} onPick={() => setSelected(n)} />
        ))}
        <ViewShift />
        <LabelProjector nodes={nodes} els={labelEls} />
        <OrbitControls enableDamping dampingFactor={0.08} autoRotate={!focus} autoRotateSpeed={0.35} minDistance={8} maxDistance={75} />
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.55} luminanceSmoothing={0.25} radius={0.6} />
        </EffectComposer>
      </Canvas>
      <div className="map-labels" aria-hidden>
        {nodes.map((n) => {
          const show = (n.kind === "book" || near.has(n.key) || (n.shared && !focus)) && !(focus && !near.has(n.key));
          return (
            <div key={n.key} ref={(el) => { if (el) labelEls.current.set(n.key, el); else labelEls.current.delete(n.key); }}
              className={`map-label map-label-${n.kind} ${show ? "" : "off"}`}>
              {n.label}
            </div>
          );
        })}
      </div>

      <aside className="map-panel" onWheel={(e) => e.stopPropagation()}>
        <div className="map-top">
          <button className="map-back" onClick={() => router.push("/")}>← Library</button>
          <SoundToggle className="map-back" />
        </div>
        <div className="conn-kicker">Reading map</div>
        <h1>What you&apos;ve read, and how it connects</h1>
        {error && <p className="conn-msg error">{error}</p>}
        {!data && !error && <p className="map-muted">Drawing your stars…</p>}

        {data && !selected && (
          <>
            <p className="map-muted">
              Bright stars are books, small ones are ideas. White ideas appear in more than one book.
              Drag to turn the sky, zoom in, and pick a star.
            </p>
            <div className="map-stats">
              <div><b>{data.books.length - unmapped.length}</b><span>books mapped</span></div>
              <div><b>{ideas.length}</b><span>ideas</span></div>
              <div><b>{shared.length}</b><span>shared ideas</span></div>
            </div>

            {shared.length > 0 && (
              <>
                <div className="conn-label">Where your books meet</div>
                <div className="conn-chips">
                  {shared.slice(0, 14).map((i) => (
                    <button key={i.id} className="conn-chip shared" onClick={() => setSelected(byKey.get(`i:${i.id}`) ?? null)}>
                      {i.name}<i>↔ {i.books.length}</i>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="conn-label">Gaps</div>
            <ul className="map-gaps">
              {lonely.length > 0 && <li><b>{lonely.length} ideas</b> appear in only one book so far. Reading related books would link them up.</li>}
              {unmapped.length > 0 && (
                <li>
                  <b>{unmapped.length} {unmapped.length === 1 ? "book isn't" : "books aren't"} mapped yet</b>
                  {building ? " (mapping now, new stars appear as they're ready)" : ""}: {unmapped.slice(0, 6).map((b) => b.title.split(/[;:(]/)[0].trim()).join(", ")}{unmapped.length > 6 ? "…" : ""}
                  {!building && !visitor && <button className="enter-btn map-build" onClick={mapAll}>Map all my books</button>}
                </li>
              )}
              {lonely.length === 0 && unmapped.length === 0 && <li>No gaps: every idea links at least two books.</li>}
            </ul>
          </>
        )}

        {selected?.kind === "idea" && (
          <div className="map-detail">
            <button className="map-close" onClick={() => setSelected(null)}>← All ideas</button>
            <Detail key={selected.key} summary={{ id: Number(selected.id), name: selected.label, description: data?.ideas.find((i) => i.id === selected.id)?.description ?? "" }} onClose={() => {}} />
          </div>
        )}
        {selected?.kind === "book" && data && (
          <div className="map-detail">
            <button className="map-close" onClick={() => setSelected(null)}>← All ideas</button>
            <h3 className="conn-name">{titleOf(String(selected.id))}</h3>
            <p className="conn-desc">{Math.round((data.books.find((b) => b.id === selected.id)?.progress ?? 0) * 100)}% read</p>
            <div className="conn-chips">
              {ideas.filter((i) => i.books.some((x) => x.book_id === selected.id)).map((i) => (
                <button key={i.id} className={`conn-chip ${i.books.length > 1 ? "shared" : ""}`} onClick={() => setSelected(byKey.get(`i:${i.id}`) ?? null)}>
                  {i.name}{i.books.length > 1 && <i>↔ {i.books.length - 1}</i>}
                </button>
              ))}
            </div>
            <button className="enter-btn map-build" onClick={() => router.push(`/read/${selected.id}`)}>Open the book</button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Star({ node, dim, selected, onHover, onPick }: {
  node: MapNode; dim: boolean; selected: boolean;
  onHover: (on: boolean) => void; onPick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const phase = useMemo(() => (typeof node.id === "number" ? node.id : node.label.length) * 0.37, [node]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    // A slow twinkle; the chosen star pulses.
    const t = clock.elapsedTime;
    const s = node.size * (selected ? 1.35 + Math.sin(t * 3) * 0.12 : 1 + Math.sin(t * 1.3 + phase) * 0.06);
    ref.current.scale.setScalar(s);
  });
  const color = useMemo(() => new THREE.Color(node.color).multiplyScalar(node.kind === "book" ? 1.45 : node.shared ? 1.5 : 1.0), [node]);
  return (
    <group position={node.pos}>
      <mesh ref={ref} onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(false); document.body.style.cursor = ""; }}
        onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <sphereGeometry args={[1, node.kind === "book" ? 24 : 12, node.kind === "book" ? 24 : 12]} />
        <meshBasicMaterial color={color} transparent opacity={dim ? 0.18 : 1} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Edges({ nodes, edges, near }: { nodes: Map<string, MapNode>; edges: ReturnType<typeof layoutMap>["edges"]; near: Set<string> }) {
  const geometry = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    for (const e of edges) {
      const a = nodes.get(e.a), b = nodes.get(e.b);
      if (!a || !b) continue;
      const lit = near.size === 0 || (near.has(e.a) && near.has(e.b));
      c.set(e.color).multiplyScalar(lit ? (near.size ? 1.1 : e.kind === "related" ? 0.35 : 0.28) : 0.05);
      pos.push(...a.pos, ...b.pos);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [nodes, edges, near]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} toneMapped={false} />
    </lineSegments>
  );
}

/** Faint background stars. */
function Sky() {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1600; i++) {
      const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = 45 + rnd() * 40;
      const s = Math.sqrt(1 - u * u);
      pts.push(Math.cos(t) * s * r, u * r, Math.sin(t) * s * r);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.12} color="#9aa4ff" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

/**
 * Centre the sky in the open space right of the panel, not behind it: shift the camera's view by half the
 * panel's width (the panel is 380px plus its 16px margin). On narrow screens the panel sits below, so no shift.
 */
function ViewShift() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const shift = size.width > 760 ? Math.min(380, size.width - 32) / 2 + 8 : 0;
    if (shift) cam.setViewOffset(size.width, size.height, -shift, 0, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** Each frame, put every label just above its star on screen, a little smaller when the star is far away. */
function LabelProjector({ nodes, els }: { nodes: MapNode[]; els: React.RefObject<Map<string, HTMLDivElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const n of nodes) {
      const el = els.current?.get(n.key);
      if (!el) continue;
      v.set(n.pos[0], n.pos[1] + n.size + (n.kind === "book" ? 0.7 : 0.35), n.pos[2]);
      const dist = camera.position.distanceTo(v);
      v.project(camera);
      if (v.z > 1) { el.style.visibility = "hidden"; continue; }
      el.style.visibility = "";
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      const scale = Math.max(0.55, Math.min(1.25, 26 / dist));
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`;
    }
  });
  return null;
}
