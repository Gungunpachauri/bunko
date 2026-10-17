import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ParticleKind } from "../themes/types";

/** Sprite textures drawn on canvas, one per particle kind. */
function spriteTexture(kind: ParticleKind) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  if (kind === "petals") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(32, 6);
    ctx.bezierCurveTo(58, 18, 52, 50, 32, 60);
    ctx.bezierCurveTo(12, 50, 6, 18, 32, 6);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(26, 4);
    ctx.lineTo(32, 14);
    ctx.lineTo(38, 4);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (kind === "ink") {
      g.addColorStop(0, "rgba(255,255,255,.9)");
      g.addColorStop(0.5, "rgba(255,255,255,.35)");
      g.addColorStop(1, "rgba(255,255,255,0)");
    } else if (kind === "bokeh") {
      g.addColorStop(0, "rgba(255,255,255,.95)");
      g.addColorStop(0.7, "rgba(255,255,255,.8)");
      g.addColorStop(0.85, "rgba(255,255,255,.25)");
      g.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.2, "rgba(255,255,255,.8)");
      g.addColorStop(1, "rgba(255,255,255,0)");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    if (kind === "sparkles") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(31, 4, 2, 56);
      ctx.fillRect(4, 31, 56, 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number;
  rx: number; ry: number; rz: number;
  sx: number; sy: number; sz: number;
  s: number; phase: number; color: THREE.Color; life: number;
}

/** Theme atmosphere: petals, ink mist, diya embers, city bokeh or arcane sparkles. */
export function Particles({ kind, colors, count }: { kind: ParticleKind; colors: string[]; count: number }) {
  const { camera, size } = useThree();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const books = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => spriteTexture(kind), [kind]);
  const persp = camera as THREE.PerspectiveCamera;
  const visH = 2 * persp.position.z * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));
  const visW = visH * (size.width / size.height);
  const bounds = useRef({ w: visW, h: visH });
  bounds.current = { w: visW, h: visH };

  const parts = useMemo<P[]>(() => {
    const pal = colors.map((c) => new THREE.Color(c));
    return Array.from({ length: count }, (_, i) => spawn(kind, pal[i % pal.length], true, { w: 14, h: 8 }));
  }, [kind, colors, count]);

  // Fantasy only: a few books drifting near the edges of the view.
  const floating = useMemo(() => (kind === "sparkles" ? Array.from({ length: 6 }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * (4.2 + Math.random() * 2), y: (i / 5 - 0.5) * 5, z: -2.5 - Math.random() * 2,
    phase: Math.random() * 6, spin: 0.12 + Math.random() * 0.15,
    color: new THREE.Color(["#5a2f6b", "#2f4a6b", "#6b3a2f", "#2f6b55"][i % 4]),
  })) : []), [kind]);

  useEffect(() => {
    if (books.current) floating.forEach((f, i) => books.current!.setColorAt(i, f.color));
    if (books.current?.instanceColor) books.current.instanceColor.needsUpdate = true;
  }, [floating]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  useFrame((state, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    const time = state.clock.elapsedTime;
    const { w, h } = bounds.current;
    parts.forEach((p, i) => {
      p.life += dt;
      switch (kind) {
        case "petals":
          p.x += (p.vx + Math.sin(time * 0.8 + p.phase) * 0.35) * dt;
          p.y += p.vy * dt;
          p.rx += p.sx * dt; p.ry += p.sy * dt; p.rz += p.sz * dt;
          break;
        case "ink":
          p.x += p.vx * dt;
          p.y += Math.sin(time * 0.2 + p.phase) * 0.03 * dt + p.vy * dt;
          break;
        case "embers":
          p.x += (p.vx + Math.sin(time * 2 + p.phase) * 0.2) * dt;
          p.y += p.vy * dt;
          break;
        case "bokeh":
          p.x += p.vx * dt;
          p.y += p.vy * dt + Math.sin(time * 0.3 + p.phase) * 0.02 * dt;
          break;
        case "sparkles":
          p.x += p.vx * dt + Math.sin(time * 0.4 + p.phase) * 0.05 * dt;
          p.y += p.vy * dt;
          break;
      }
      const out = p.y < -h / 2 - 1 || p.y > h / 2 + 1 || p.x < -w / 2 - 2 || p.x > w / 2 + 2;
      if (out) Object.assign(p, spawn(kind, p.color, false, { w, h }));

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      let s = p.s;
      let bright = 1;
      if (kind === "embers") {
        bright = 0.6 + 0.4 * Math.sin(time * 9 + p.phase);
        s *= Math.max(0.2, 1 - p.life / 6);
      }
      if (kind === "sparkles") bright = Math.pow(0.5 + 0.5 * Math.sin(time * 2.2 + p.phase * 3), 3);
      if (kind === "bokeh") bright = 0.6 + 0.4 * Math.sin(time * 0.7 + p.phase);
      if (kind === "ink") bright = 1;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      col.copy(p.color).multiplyScalar(bright);
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;

    const b = books.current;
    if (b) {
      floating.forEach((f, i) => {
        dummy.position.set(f.x + Math.sin(time * 0.3 + f.phase) * 0.3, f.y + Math.sin(time * 0.8 + f.phase) * 0.35, f.z);
        dummy.rotation.set(0.3 + Math.sin(time * 0.5 + f.phase) * 0.2, time * f.spin + f.phase, 0.2);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
      });
      b.instanceMatrix.needsUpdate = true;
    }
  });

  const additive = kind === "embers" || kind === "sparkles" || kind === "bokeh";
  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={tex}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          // Additive glow that leaves canvas alpha untouched, so it brightens the page
          // underneath instead of punching dark holes into it.
          blending={additive ? THREE.CustomBlending : THREE.NormalBlending}
          blendEquation={THREE.AddEquation}
          blendSrc={THREE.SrcAlphaFactor}
          blendDst={THREE.OneFactor}
          blendSrcAlpha={THREE.ZeroFactor}
          blendDstAlpha={THREE.OneFactor}
          opacity={kind === "ink" ? 0.16 : kind === "bokeh" ? 0.4 : 0.95}
        />
      </instancedMesh>
      {floating.length > 0 && (
        <instancedMesh ref={books} args={[undefined, undefined, floating.length]} frustumCulled={false}>
          <boxGeometry args={[0.42, 0.58, 0.12]} />
          <meshStandardMaterial roughness={0.6} emissive="#3a2a6b" emissiveIntensity={0.25} />
        </instancedMesh>
      )}
    </>
  );
}

function spawn(kind: ParticleKind, color: THREE.Color, initial: boolean, b: { w: number; h: number }): P {
  const r = Math.random;
  const p: P = {
    x: (r() - 0.5) * (b.w + 2), y: (r() - 0.5) * b.h, z: -3 + r() * 6,
    vx: 0, vy: 0, rx: r() * 6, ry: r() * 6, rz: r() * 6, sx: 0, sy: 0, sz: 0,
    s: 0.1, phase: r() * 10, color, life: 0,
  };
  switch (kind) {
    case "petals":
      p.vx = 0.15 + r() * 0.35;
      p.vy = -(0.35 + r() * 0.4);
      p.s = 0.12 + r() * 0.1;
      p.sx = (r() - 0.5) * 2.5; p.sy = (r() - 0.5) * 2.5; p.sz = (r() - 0.5) * 1.5;
      if (!initial) { p.y = b.h / 2 + 0.5; p.x = (r() - 0.6) * b.w; }
      break;
    case "ink":
      p.vx = (r() < 0.5 ? -1 : 1) * (0.05 + r() * 0.12);
      p.vy = 0;
      p.s = 2.5 + r() * 4;
      p.z = -4 + r() * 3;
      p.y = -b.h * 0.15 + (r() - 0.5) * b.h * 0.8;
      p.rx = p.ry = 0; p.rz = r() * 6;
      if (!initial) p.x = p.vx > 0 ? -b.w / 2 - 1.5 : b.w / 2 + 1.5;
      break;
    case "embers":
      p.vx = (r() - 0.5) * 0.15;
      p.vy = 0.25 + r() * 0.5;
      p.s = 0.05 + r() * 0.08;
      p.rx = p.ry = p.rz = 0;
      if (!initial) { p.y = -b.h / 2 - 0.3; p.life = 0; }
      else p.life = r() * 4;
      break;
    case "bokeh":
      p.vx = (r() - 0.5) * 0.08;
      p.vy = 0.02 + r() * 0.05;
      p.s = 0.08 + r() * 0.28;
      p.z = -4 + r() * 4;
      p.rx = p.ry = p.rz = 0;
      if (!initial) p.y = -b.h / 2 - 0.5;
      break;
    case "sparkles":
      p.vx = (r() - 0.5) * 0.05;
      p.vy = 0.03 + r() * 0.1;
      p.s = 0.08 + r() * 0.18;
      p.rx = p.ry = 0;
      if (!initial) p.y = -b.h / 2 - 0.5;
      break;
  }
  return p;
}
