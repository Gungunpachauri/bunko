import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { rng } from "@/library/themes/art";
import type { Atmo } from "@/library/world/Environment";
import type { Journey, JourneyState } from "@/library/world/journey";
import type { WorldSkin } from "@/library/world/skins";
import { smooth, type Growth } from "@/library/world/Growth";

const dummy = new THREE.Object3D();

/** Lights drifting on (or above) the waterway: lanterns, diyas, orbs, candles. */
export function Floaters({ skin, atmo, growth, layout, today, region }: {
  skin: WorldSkin; atmo: Atmo; growth: Growth; layout: Journey; today: number;
  /** Mixed mode: keep this skin's lights around one room only. */
  region?: { x: number; z: number; r: number };
}) {
  const kind = skin.floaters;
  const rooms = layout.islands.length;
  const N = region ? 34 : (kind === "sky-lanterns" ? 60 : 80) + Math.max(0, rooms - 2) * 18;
  const zEnd = Math.min(-100, layout.islands[rooms - 1].pos.z - 34);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const items = useMemo(() => {
    const r = rng(17);
    const out: { x: number; z: number; y: number; ph: number; sp: number; s: number }[] = [];
    while (out.length < N) {
      let x = -30 + r() * 84, z = zEnd + r() * (15 - zEnd);
      if (region) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * region.r;
        x = region.x + Math.cos(a) * d;
        z = region.z + Math.sin(a) * d;
      }
      const nearIsland = layout.islands.some((c) => Math.hypot(x - c.pos.x, z - c.pos.z) < 11);
      const onPath = Math.abs(x) < 2.2 && z > -40;
      if (nearIsland || onPath) continue;
      const air = kind === "sky-lanterns" ? 4 + r() * 30 : kind === "candles" ? 2.5 + r() * 9 : kind === "motes" ? 1 + r() * 22 : 0.12;
      out.push({ x, z, y: air, ph: r() * 10, sp: 0.2 + r() * 0.5, s: 0.7 + r() * 0.6 });
    }
    return out;
  }, [N, kind, layout, zEnd, region?.x, region?.z, region?.r]); // eslint-disable-line react-hooks/exhaustive-deps

  const geo = useMemo(() => {
    switch (kind) {
      case "water-lanterns": return new THREE.BoxGeometry(0.34, 0.38, 0.34).translate(0, 0.19, 0);
      case "sky-lanterns": return new THREE.CylinderGeometry(0.32, 0.24, 0.6, 10);
      case "diyas": return new THREE.ConeGeometry(0.07, 0.24, 8).translate(0, 0.12, 0);
      case "motes": return new THREE.OctahedronGeometry(0.12, 0);
      case "candles": return new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10);
    }
  }, [kind]);
  const color = kind === "sky-lanterns" ? "#ff7a3a" : kind === "candles" ? "#ffe3a8" : skin.glow;

  useFrame((s) => {
    const m = mesh.current;
    if (!m) return;
    const t = s.clock.elapsedTime;
    items.forEach((it, i) => {
      let y = it.y + Math.sin(t * it.sp + it.ph) * (it.y > 1 ? 0.25 : 0.04);
      if (kind === "sky-lanterns") y = ((it.y + t * it.sp * 0.6) % 34) + 3;
      dummy.position.set(it.x + Math.sin(t * 0.1 + it.ph) * 0.5, y, it.z);
      dummy.rotation.set(0, it.ph, Math.sin(t + it.ph) * 0.05);
      const flick = kind === "diyas" ? 0.8 + 0.25 * Math.sin(t * 12 + it.ph * 5) : 1;
      // The waterway fills with lights as the year of reading goes on.
      const shown = smooth(0, 1, growth.month * 0.95 * N / today - i * 0.95 + 1);
      const sc = it.s * shown;
      dummy.scale.set(sc, sc * flick, sc);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.emissiveIntensity = 1.6 * atmo.lanterns + 0.3;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, N]} frustumCulled={false}>
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
    </instancedMesh>
  );
}

function pageTexture(paper: string) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 88;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 64, 88);
  ctx.fillStyle = "rgba(60,45,35,.35)";
  for (let y = 12; y < 80; y += 6) ctx.fillRect(8, y, y % 30 === 0 ? 30 : 48, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The genre transition: loose pages stream along the path between the two
 * rooms and spiral around the camera as it crosses.
 */
export function PageStorm({ skin, journey, atmo, layout, chapter }: { skin: WorldSkin; journey: JourneyState; atmo: Atmo; layout: Journey; chapter: number }) {
  const N = 320;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const tex = useMemo(() => pageTexture(skin.paper), [skin.paper]);
  const t0 = layout.progressToT(chapter - 1.1), t1 = layout.progressToT(chapter + 1.1);
  const pages = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: N }, () => ({
      u: r(), ang: r() * Math.PI * 2, rad: 0.9 + r() * 4.2, w: (0.4 + r() * 0.9) * (r() < 0.5 ? -1 : 1),
      flow: 0.008 + r() * 0.02, flut: r() * 10, s: 0.7 + r() * 0.5, lift: (r() - 0.5) * 1.5,
    }));
  }, []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tmpP = useMemo(() => new THREE.Vector3(), []);
  const tan = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const nrm = useMemo(() => new THREE.Vector3(), []);

  useFrame((s, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    const time = s.clock.elapsedTime;
    // The storm is strongest at the crossing and gone at the rooms.
    const away = Math.abs(journey.p - chapter);
    if (away > 1.6) {
      // Far from this crossing: keep the pages hidden and skip the work.
      if (m.visible) m.visible = false;
      return;
    }
    m.visible = true;
    const storm = Math.max(0, 1 - away / 1.05);
    const camT = layout.progressToT(journey.p);
    pages.forEach((pg, i) => {
      pg.u = (pg.u + pg.flow * dt * (1 + storm * 2)) % 1;
      pg.ang += pg.w * dt * (0.6 + storm * 1.6);
      const t = t0 + (t1 - t0) * pg.u;
      layout.camCurve.getPoint(t, tmpP);
      layout.camCurve.getTangent(t, tan);
      right.crossVectors(tan, up).normalize();
      nrm.crossVectors(right, tan).normalize();
      const rad = pg.rad * (0.7 + storm * 0.6);
      tmpP.addScaledVector(right, Math.cos(pg.ang) * rad).addScaledVector(nrm, Math.sin(pg.ang) * rad * 0.65 + pg.lift);
      dummy.position.copy(tmpP);
      dummy.rotation.set(Math.sin(time * 2 + pg.flut) * 1.2, pg.ang + time * 0.6, Math.cos(time * 1.7 + pg.flut) * 0.8);
      // Pages near the camera's place on the path show; distant ones shrink away.
      const near = 1 - Math.min(1, Math.abs(t - camT) / 0.16);
      const vis = Math.max(storm * 0.85, 0.08) * (0.25 + 0.75 * near);
      dummy.scale.setScalar(pg.s * vis);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.emissiveIntensity = 0.15 + atmo.night * 0.35;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <planeGeometry args={[0.28, 0.38]} />
      <meshStandardMaterial ref={mat} map={tex} emissive={skin.paper} emissiveMap={tex} emissiveIntensity={0.2} side={THREE.DoubleSide} roughness={0.9} />
    </instancedMesh>
  );
}
