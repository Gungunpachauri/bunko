import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";

/** The month the world is showing. Animated toward `target` every frame. */
export interface Growth {
  month: number;
  target: number;
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function GrowthDriver({ growth }: { growth: Growth }) {
  useFrame((_, dt) => {
    // Slow enough that a new room visibly rises when a genre is added.
    growth.month += (growth.target - growth.month) * Math.min(1, dt * 1.8);
    if (Math.abs(growth.target - growth.month) < 1e-3) growth.month = growth.target;
  });
  return null;
}

/** Lifts its children out of the water during month `at - 1` → `at`, with a ripple. */
export function Rise({ growth, at, depth = 9, radius = 10, ring: showRing = true, children }: {
  growth: Growth; at: number; depth?: number; radius?: number; ring?: boolean; children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const k = smooth(at - 1, at, growth.month);
    if (group.current) {
      group.current.position.y = (1 - k) * -depth + Math.sin(s.clock.elapsedTime * 3) * 0.04 * k * (1 - k) * 4;
      group.current.visible = k > 0.002;
    }
    const r = ring.current;
    if (r) {
      const active = showRing && k > 0.002 && k < 0.999;
      r.visible = active;
      r.scale.setScalar(radius * (0.6 + k * 1.1));
      (r.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.55;
    }
  });
  return (
    <>
      <group ref={group}>{children}</group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]} visible={false}>
        <ringGeometry args={[0.92, 1, 96]} />
        <meshBasicMaterial color="#fff6e0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

/** Scales children up with the months (trees grow). */
export function Grow({ growth, from = 0.25, children }: { growth: Growth; from?: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (g.current) g.current.scale.setScalar(from + (1 - from) * smooth(0, 12, growth.month));
  });
  return <group ref={g}>{children}</group>;
}
