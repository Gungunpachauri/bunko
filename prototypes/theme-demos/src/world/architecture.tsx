// Procedural architecture, one look per theme, all built from primitives so the
// demo needs no model files. Everything faces +z and stands on y = 0.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThemeId } from "../themes/types";
import { rng } from "../themes/art";
import type { WorldSkin } from "./skins";
import type { Atmo } from "./Environment";
import { Grow, type Growth } from "./Growth";

type V3 = [number, number, number];

// ── geometry helpers ────────────────────────────────────────────────────────

/** Curved pagoda roof: a lathe with a concave profile and upturned eaves. */
function roofGeo(radius: number, height: number, segments: number, upturn: number) {
  const pts: THREE.Vector2[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    pts.push(new THREE.Vector2(radius * u, height * Math.pow(1 - u, 1.8) + upturn * Math.pow(u, 8)));
  }
  pts.push(new THREE.Vector2(radius * 0.96, upturn * 0.6 - 0.18));
  pts.push(new THREE.Vector2(0, -0.1));
  return new THREE.LatheGeometry(pts.reverse(), segments, Math.PI / segments);
}

/** Temple tower (shikhara): bulging, ribbed profile. */
function shikharaGeo(radius: number, height: number) {
  const pts: THREE.Vector2[] = [];
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const v = i / N;
    const r = radius * Math.pow(Math.max(0, 1 - v * v), 0.65) * (1 + 0.04 * Math.sin(v * 40));
    pts.push(new THREE.Vector2(Math.max(0.01, r), v * height));
  }
  return new THREE.LatheGeometry(pts, 8);
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.03) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 32 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function pointedArch(path: THREE.Path | THREE.Shape, w: number, spring: number, apex: number, cx = 0) {
  path.moveTo(cx - w / 2, 0);
  path.lineTo(cx - w / 2, spring);
  path.quadraticCurveTo(cx - w / 2, apex - (apex - spring) * 0.15, cx, apex);
  path.quadraticCurveTo(cx + w / 2, apex - (apex - spring) * 0.15, cx + w / 2, spring);
  path.lineTo(cx + w / 2, 0);
  path.lineTo(cx - w / 2, 0);
}

function Glowing({ color, intensity = 2, atmo }: { color: string; intensity?: number; atmo: Atmo }) {
  const m = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (m.current) m.current.emissiveIntensity = intensity * atmo.lanterns;
  });
  return <meshStandardMaterial ref={m} color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />;
}

// ── gates ───────────────────────────────────────────────────────────────────

export function Gate({ theme, skin, atmo, position, rotationY = 0, scale = 1 }: {
  theme: ThemeId; skin: WorldSkin; atmo: Atmo; position: V3; rotationY?: number; scale?: number;
}) {
  const geo = useMemo(() => {
    if (theme === "japanese") {
      const s = new THREE.Shape();
      const W = 5.2;
      s.moveTo(-W, 7.2);
      s.quadraticCurveTo(0, 6.75, W, 7.2);
      s.lineTo(W + 0.15, 7.75);
      s.quadraticCurveTo(0, 7.25, -W - 0.15, 7.75);
      s.lineTo(-W, 7.2);
      return { kasagi: extrude(s, 0.6) };
    }
    if (theme === "chinese") {
      const s = new THREE.Shape();
      s.moveTo(-4.6, 0); s.lineTo(4.6, 0); s.lineTo(4.6, 7.2); s.lineTo(-4.6, 7.2); s.lineTo(-4.6, 0);
      const h = new THREE.Path();
      h.absarc(0, 3.3, 2.9, 0, Math.PI * 2, false);
      s.holes.push(h);
      return { wall: extrude(s, 0.7, 0.02) };
    }
    if (theme === "fantasy") {
      const s = new THREE.Shape();
      s.moveTo(-4.2, 0); s.lineTo(4.2, 0); s.lineTo(4.2, 9); s.lineTo(-4.2, 9); s.lineTo(-4.2, 0);
      const h = new THREE.Path();
      pointedArch(h, 5.4, 4.6, 7.8);
      s.holes.push(h);
      return { arch: extrude(s, 1.2, 0.05) };
    }
    return {};
  }, [theme]);

  return (
    <group position={position} rotation-y={rotationY} scale={scale}>
      {theme === "japanese" && (
        <>
          {[-3, 3].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh position={[0, 3.4, 0]}><cylinderGeometry args={[0.26, 0.32, 6.8, 20]} /><meshStandardMaterial color={skin.trim} roughness={0.6} /></mesh>
              <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.38, 0.38, 0.6, 20]} /><meshStandardMaterial color="#1a1412" /></mesh>
            </group>
          ))}
          <mesh position={[0, 5.6, 0]}><boxGeometry args={[7.6, 0.38, 0.32]} /><meshStandardMaterial color={skin.trim} roughness={0.6} /></mesh>
          <mesh position={[0, 6.4, 0]}><boxGeometry args={[0.36, 1.2, 0.3]} /><meshStandardMaterial color={skin.trim} /></mesh>
          <mesh geometry={geo.kasagi} position={[0, -0.55, 0]}><meshStandardMaterial color={skin.trim} roughness={0.55} /></mesh>
          <mesh geometry={geo.kasagi} position={[0, 0.02, 0]} scale={[1.02, 1, 1.1]}><meshStandardMaterial color="#1a1412" /></mesh>
        </>
      )}
      {theme === "chinese" && (
        <>
          <mesh geometry={geo.wall}><meshStandardMaterial color={skin.stone} roughness={0.95} /></mesh>
          <mesh position={[0, 3.3, 0]}><torusGeometry args={[2.95, 0.14, 12, 64]} /><meshStandardMaterial color={skin.trim} /></mesh>
          <mesh position={[0, 7.35, 0]}><boxGeometry args={[10, 0.32, 1.3]} /><meshStandardMaterial color={skin.roof} /></mesh>
          <mesh position={[0, 7.6, 0]}><boxGeometry args={[10.4, 0.18, 0.5]} /><meshStandardMaterial color="#2a2d31" /></mesh>
          {[-5.1, 5.1].map((x) => (
            <mesh key={x} position={[x, 7.75, 0]} rotation-z={x > 0 ? -0.5 : 0.5}><boxGeometry args={[0.8, 0.14, 0.4]} /><meshStandardMaterial color="#2a2d31" /></mesh>
          ))}
        </>
      )}
      {theme === "vedic" && (
        <>
          {[-3, 3].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh position={[0, 3.2, 0]}><boxGeometry args={[0.7, 6.4, 0.7]} /><meshStandardMaterial color={skin.stone} roughness={0.9} /></mesh>
              {[1.4, 3, 4.6].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.86, 0.22, 0.86]} /><meshStandardMaterial color="#8a7052" /></mesh>)}
              <mesh position={[0, 6.6, 0]}><boxGeometry args={[1.1, 0.4, 1.1]} /><meshStandardMaterial color="#8a7052" /></mesh>
            </group>
          ))}
          {[6.9, 7.8].map((y, i) => (
            <group key={y} position={[0, y, 0]}>
              <mesh><boxGeometry args={[8.4 - i * 0.6, 0.38, 0.6]} /><meshStandardMaterial color={skin.stone} roughness={0.9} /></mesh>
              {[-1, 1].map((sx) => (
                <mesh key={sx} position={[sx * (4.3 - i * 0.3), 0.15, 0]} rotation-y={Math.PI / 2}>
                  <torusGeometry args={[0.32, 0.1, 8, 20, Math.PI * 1.5]} /><meshStandardMaterial color={skin.stone} />
                </mesh>
              ))}
            </group>
          ))}
          <Garland from={[-2.7, 6.4, 0.4]} to={[2.7, 6.4, 0.4]} sag={1.3} atmo={atmo} />
          {[-1.2, 1.2].map((x) => (
            <group key={x} position={[x, 6.6, 0]}>
              <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[0.012, 0.012, 1, 4]} /><meshStandardMaterial color="#3a2a1a" /></mesh>
              <mesh position={[0, -1.15, 0]}><coneGeometry args={[0.22, 0.4, 16, 1, true]} /><meshStandardMaterial color={skin.trim} metalness={0.8} roughness={0.3} side={THREE.DoubleSide} /></mesh>
            </group>
          ))}
        </>
      )}
      {theme === "space" && (
        <>
          {/* ring gate: a metal torus with a glowing inner edge and chevrons */}
          <mesh position={[0, 3.3, 0]}><torusGeometry args={[3.15, 0.34, 20, 96]} /><meshStandardMaterial color={skin.stone} metalness={0.85} roughness={0.3} /></mesh>
          <mesh position={[0, 3.3, 0]}><torusGeometry args={[2.86, 0.05, 8, 96]} /><Glowing color={skin.glow} intensity={3} atmo={atmo} /></mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2 + Math.PI / 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 3.15, 3.3 + Math.sin(a) * 3.15, 0.3]} rotation-z={a}>
                <boxGeometry args={[0.5, 0.22, 0.12]} /><Glowing color={i === 0 ? "#ff8a3a" : skin.glow} intensity={2.4} atmo={atmo} />
              </mesh>
            );
          })}
          {[-2.4, 2.4].map((x) => (
            <mesh key={x} position={[x, 0.35, 0]} rotation-z={x > 0 ? -0.35 : 0.35}><boxGeometry args={[1.2, 0.7, 1.2]} /><meshStandardMaterial color={skin.wood} metalness={0.7} roughness={0.4} /></mesh>
          ))}
        </>
      )}
      {theme === "fantasy" && (
        <>
          <mesh geometry={geo.arch}><meshStandardMaterial color={skin.stone} roughness={0.9} /></mesh>
          <mesh position={[0, 8.1, 0.65]}><circleGeometry args={[0.4, 6]} /><Glowing color={skin.glow} intensity={3} atmo={atmo} /></mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (0.1 + (i / 8) * 0.8);
            return (
              <mesh key={i} position={[Math.cos(a) * 3.4, 4.8 + Math.sin(a) * 3.2, 0.62]} rotation-z={a - Math.PI / 2}>
                <planeGeometry args={[0.18, 0.4]} /><Glowing color={skin.glow} intensity={2.5} atmo={atmo} />
              </mesh>
            );
          })}
        </>
      )}
    </group>
  );
}

function Garland({ from, to, sag, atmo }: { from: V3; to: V3; sag: number; atmo: Atmo }) {
  const geo = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -sag, 0));
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 40, 0.11, 8, false);
  }, [from, to, sag]);
  return <mesh geometry={geo}><Glowing color="#f39c1e" intensity={0.5} atmo={atmo} /></mesh>;
}

/** Shimmering veil inside the crossing portal; the camera flies through it. */
export function PortalVeil({ position, rotationY, color, shape }: { position: V3; rotationY: number; color: string; shape: "circle" | "rect" | "arch" }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ time: { value: 0 }, color: { value: new THREE.Color(color) } }), [color]);
  useFrame((s) => { if (mat.current) mat.current.uniforms.time.value = s.clock.elapsedTime; });
  const geo = useMemo(() => {
    if (shape === "circle") return new THREE.CircleGeometry(2.85, 64).translate(0, 3.3, 0);
    if (shape === "arch") { const s = new THREE.Shape(); pointedArch(s, 5.3, 4.6, 7.7); return new THREE.ShapeGeometry(s, 24); }
    return new THREE.PlaneGeometry(5.6, 6.6).translate(0, 3.3, 0);
  }, [shape]);
  return (
    <mesh geometry={geo} position={position} rotation-y={rotationY}>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          uniform float time; uniform vec3 color; varying vec3 vP;
          void main(){
            float r = length(vP.xy - vec2(0.0, 3.4));
            float bands = 0.5 + 0.5 * sin(r * 5.0 - time * 2.2);
            float sweep = 0.5 + 0.5 * sin(vP.x * 1.7 + vP.y * 1.1 + time * 0.9);
            float a = (0.10 + 0.22 * bands * sweep) * smoothstep(4.2, 0.5, r);
            gl_FragColor = vec4(color * 1.6, a);
          }`}
      />
    </mesh>
  );
}

// ── pavilions ───────────────────────────────────────────────────────────────

/** Each genre's pavilion glows from inside with a pale version of the genre's mood colour. */
export function Pavilion({ theme, skin, atmo, mood }: { theme: ThemeId; skin: WorldSkin; atmo: Atmo; mood: string }) {
  const inner = useMemo(() => "#" + new THREE.Color(mood).lerp(new THREE.Color("#fff6e8"), 0.68).getHexString(), [mood]);
  const deep = useMemo(() => "#" + new THREE.Color(mood).multiplyScalar(0.55).getHexString(), [mood]);
  const roofs = useMemo(() => ({
    japanese: [roofGeo(6.4, 2.2, 4, 0.45), roofGeo(3.6, 1.7, 4, 0.3)],
    chinese: [roofGeo(6.6, 2.0, 4, 0.8), roofGeo(3.8, 1.6, 4, 0.6)],
    fantasy: [roofGeo(6.2, 6.5, 12, 0.2)],
    vedic: [shikharaGeo(2.6, 5.5)],
    space: [],
  }), []);

  const deckTop = 0.75;
  const posts: [number, number][] = [[-4.1, -3.1], [4.1, -3.1], [-4.1, 3.1], [4.1, 3.1]];
  return (
    <group>
      {/* deck */}
      <mesh position={[0, 0.6, 0]}><boxGeometry args={[9.6, 0.3, 7.6]} /><meshStandardMaterial color={theme === "vedic" || theme === "fantasy" ? skin.stone : skin.wood} roughness={0.85} metalness={theme === "space" ? 0.6 : 0} /></mesh>
      {[0.25, 0.45].map((y, i) => (
        <mesh key={y} position={[0, y, 4.2 + i * 0.4]}><boxGeometry args={[4, 0.12, 0.4]} /><meshStandardMaterial color={skin.stone} /></mesh>
      ))}

      {(theme === "japanese" || theme === "chinese") && (
        <>
          {posts.map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, deckTop + 2, z]}>
              <cylinderGeometry args={[0.17, 0.19, 4, 14]} />
              <meshStandardMaterial color={theme === "chinese" ? skin.trim : skin.wood} roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, deckTop + 4, 0]}><boxGeometry args={[8.8, 0.3, 6.8]} /><meshStandardMaterial color={skin.wood} /></mesh>
          <mesh geometry={roofs[theme][0]} position={[0, deckTop + 4.15, 0]} scale={[1, 1, 0.82]}>
            <meshStandardMaterial color={skin.roof} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, deckTop + 5.5, 0]}><boxGeometry args={[3.2, 1.1, 2.6]} /><meshStandardMaterial color={theme === "chinese" ? skin.trim : skin.wood} /></mesh>
          <mesh geometry={roofs[theme][1]} position={[0, deckTop + 6.0, 0]} scale={[1, 1, 0.82]}>
            <meshStandardMaterial color={skin.roof} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, deckTop + 7.8, 0]}><sphereGeometry args={[0.22, 16, 12]} /><meshStandardMaterial color="#c9a24b" metalness={0.8} roughness={0.3} /></mesh>
          {/* glowing paper wall behind the shelf */}
          <mesh position={[0, deckTop + 1.9, -3.05]}><planeGeometry args={[8, 3.8]} /><Glowing color={inner} intensity={0.22} atmo={atmo} /></mesh>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} position={[-3.6 + i * 0.9, deckTop + 1.9, -3.0]}><boxGeometry args={[0.06, 3.8, 0.06]} /><meshStandardMaterial color={skin.wood} /></mesh>
          ))}
          {[0.95, 1.9, 2.85].map((y) => (
            <mesh key={y} position={[0, deckTop + y, -3.0]}><boxGeometry args={[8, 0.06, 0.06]} /><meshStandardMaterial color={skin.wood} /></mesh>
          ))}
          {/* hanging lanterns */}
          {[-3.3, 3.3].map((x) => (
            <group key={x} position={[x, deckTop + 3.0, 3.1]}>
              <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.01, 0.01, 0.6, 4]} /><meshStandardMaterial color="#111" /></mesh>
              <mesh scale={[1, 1.3, 1]}><sphereGeometry args={[0.32, 20, 14]} /><Glowing color={theme === "chinese" ? "#ff5a3a" : skin.glow} intensity={2.2} atmo={atmo} /></mesh>
            </group>
          ))}
        </>
      )}

      {theme === "vedic" && (
        <>
          {posts.concat([[-1.4, 3.1], [1.4, 3.1]]).map(([x, z]) => (
            <group key={`${x}${z}`} position={[x, deckTop, z]}>
              <mesh position={[0, 2, 0]}><boxGeometry args={[0.5, 4, 0.5]} /><meshStandardMaterial color={skin.stone} roughness={0.9} /></mesh>
              {[0.8, 2.2, 3.4].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.62, 0.16, 0.62]} /><meshStandardMaterial color="#8a7052" /></mesh>)}
              <mesh position={[0, 4.05, 0]}><boxGeometry args={[0.9, 0.2, 0.9]} /><meshStandardMaterial color="#8a7052" /></mesh>
            </group>
          ))}
          <mesh position={[0, deckTop + 4.3, 0]}><boxGeometry args={[9.6, 0.45, 7.6]} /><meshStandardMaterial color={skin.stone} roughness={0.9} /></mesh>
          <mesh position={[0, deckTop + 4.65, 0]}><boxGeometry args={[8.6, 0.25, 6.6]} /><meshStandardMaterial color="#a88c66" /></mesh>
          <mesh geometry={roofs.vedic[0]} position={[0, deckTop + 4.75, -0.5]}><meshStandardMaterial color={skin.stone} roughness={0.9} flatShading /></mesh>
          <mesh position={[0, deckTop + 10.4, -0.5]}><cylinderGeometry args={[0.55, 0.55, 0.22, 16]} /><meshStandardMaterial color="#a88c66" /></mesh>
          <mesh position={[0, deckTop + 10.8, -0.5]}><sphereGeometry args={[0.24, 16, 12]} /><meshStandardMaterial color={skin.trim} metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[0.35, deckTop + 11.6, -0.5]}><planeGeometry args={[0.7, 0.4]} /><meshStandardMaterial color={skin.accent} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, deckTop + 1.9, -3.05]}><planeGeometry args={[8, 3.8]} /><Glowing color={inner} intensity={0.2} atmo={atmo} /></mesh>
          {Array.from({ length: 11 }, (_, i) => (
            <group key={i} position={[-4 + i * 0.8, deckTop + 0.08, 3.4]}>
              <mesh><cylinderGeometry args={[0.1, 0.06, 0.08, 10]} /><meshStandardMaterial color="#a5532f" /></mesh>
              <mesh position={[0, 0.12, 0]}><coneGeometry args={[0.04, 0.16, 8]} /><Glowing color="#ffb347" intensity={4} atmo={atmo} /></mesh>
            </group>
          ))}
          <Garland from={[-4.1, deckTop + 3.8, 3.3]} to={[4.1, deckTop + 3.8, 3.3]} sag={1} atmo={atmo} />
        </>
      )}

      {theme === "space" && (
        <>
          {/* observatory: half dome open to the front, ringed with light */}
          {posts.slice(2).map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, deckTop + 2.1, z]}><cylinderGeometry args={[0.09, 0.12, 4.2, 10]} /><meshStandardMaterial color={skin.stone} metalness={0.85} roughness={0.3} /></mesh>
          ))}
          <mesh position={[0, deckTop + 0.15, -0.2]} scale={[1, 1, 0.82]}>
            <sphereGeometry args={[5.6, 48, 24, Math.PI, Math.PI, 0, Math.PI / 2]} />
            <meshStandardMaterial color={skin.roof} metalness={0.75} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, deckTop + 0.2, -0.2]} rotation-x={Math.PI / 2} scale={[1, 0.82, 1]}><torusGeometry args={[5.6, 0.1, 8, 96]} /><Glowing color={skin.glow} intensity={2} atmo={atmo} /></mesh>
          <mesh position={[0, deckTop + 4.3, 3.1]}><boxGeometry args={[8.6, 0.16, 0.3]} /><meshStandardMaterial color={skin.stone} metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[0, deckTop + 4.2, 3.26]}><boxGeometry args={[8.2, 0.04, 0.04]} /><Glowing color={skin.glow} intensity={2.5} atmo={atmo} /></mesh>
          {/* star-map panel behind the shelf */}
          <mesh position={[0, deckTop + 2.2, -3.4]}><circleGeometry args={[4.6, 64, 0, Math.PI]} /><meshStandardMaterial color="#0b1030" emissive="#16205a" emissiveIntensity={0.6} /></mesh>
          {[0.9, 1.4, 1.9].map((r, i) => (
            <mesh key={r} position={[0, deckTop + 3.6, -3.3]} rotation-z={i * 0.6}><ringGeometry args={[r, r + 0.02, 64]} /><Glowing color={i === 1 ? "#ff8a3a" : skin.glow} intensity={1.6} atmo={atmo} /></mesh>
          ))}
          {/* dish on the crown */}
          <mesh position={[1.6, deckTop + 5.9, -1.6]}><cylinderGeometry args={[0.06, 0.06, 0.9, 8]} /><meshStandardMaterial color={skin.stone} metalness={0.8} /></mesh>
          <mesh position={[1.6, deckTop + 6.45, -1.6]} rotation={[-0.6, 0, 0.3]}><sphereGeometry args={[0.6, 20, 10, 0, Math.PI * 2, 0, 0.9]} /><meshStandardMaterial color="#c9d0e8" metalness={0.6} roughness={0.4} side={THREE.DoubleSide} /></mesh>
        </>
      )}

      {theme === "fantasy" && (
        <>
          {Array.from({ length: 7 }, (_, i) => {
            const a = Math.PI * (1.05 + (i / 6) * 0.9);
            return (
              <group key={i} position={[Math.cos(a) * 4.4, deckTop, -Math.sin(a) * 3.4 * -1 - 0.2]}>
                <mesh position={[0, 2.4, 0]}><cylinderGeometry args={[0.26, 0.32, 4.8, 12]} /><meshStandardMaterial color={skin.stone} roughness={0.9} /></mesh>
                <mesh position={[0, 4.85, 0]}><boxGeometry args={[0.8, 0.2, 0.8]} /><meshStandardMaterial color={skin.trim} metalness={0.7} roughness={0.35} /></mesh>
              </group>
            );
          })}
          <mesh position={[0, deckTop + 5.0, -0.2]}><cylinderGeometry args={[5, 5, 0.4, 32]} /><meshStandardMaterial color={skin.stone} /></mesh>
          <mesh geometry={roofs.fantasy[0]} position={[0, deckTop + 5.2, -0.2]}><meshStandardMaterial color={skin.roof} roughness={0.7} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, deckTop + 12, -0.2]}><octahedronGeometry args={[0.35]} /><Glowing color={skin.glow} intensity={4} atmo={atmo} /></mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, deckTop + 0.02, 0.8]}><ringGeometry args={[2.4, 2.6, 64]} /><Glowing color={skin.glow} intensity={2} atmo={atmo} /></mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, deckTop + 0.02, 0.8]}><ringGeometry args={[1.9, 1.96, 64]} /><Glowing color={skin.glow} intensity={2} atmo={atmo} /></mesh>
          <mesh position={[0, deckTop + 1.9, -3.4]}><planeGeometry args={[8, 3.8]} /><Glowing color={deep} intensity={0.35} atmo={atmo} /></mesh>
        </>
      )}

      {/* warm light that makes the spines readable */}
      <pointLight position={[0, deckTop + 3.2, 1.8]} intensity={theme === "space" ? 13 : 10} distance={11} decay={1.6} color={inner} />
      <pointLight position={[0.6, deckTop + 1.8, 3.2]} intensity={7} distance={8} decay={1.5} color="#fff1dc" />
    </group>
  );
}

// ── island, bridge, flora ───────────────────────────────────────────────────

export function Island({ skin }: { skin: WorldSkin }) {
  const rocks = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2 + r() * 0.2;
      return { x: Math.cos(a) * (8.6 + r() * 0.8), z: Math.sin(a) * (8.6 + r() * 0.8), s: 0.4 + r() * 0.6 };
    });
  }, []);
  const asteroid = skin.flora === "asteroids";
  return (
    <group>
      <mesh position={[0, -0.3, 0]}><cylinderGeometry args={[9, 9.6, 1.4, 48]} /><meshStandardMaterial color={skin.ground} roughness={1} flatShading={asteroid} /></mesh>
      {/* in space the island is a floating asteroid: a jagged rock tapers away beneath it */}
      {asteroid && (
        <mesh position={[0, -6.5, 0]} rotation-x={Math.PI}><coneGeometry args={[9.6, 11, 9, 3]} /><meshStandardMaterial color={skin.ground} roughness={1} flatShading /></mesh>
      )}
      {rocks.map((k, i) => (
        <mesh key={i} position={[k.x, 0.15, k.z]} scale={k.s}><dodecahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color={skin.stone} roughness={1} flatShading /></mesh>
      ))}
    </group>
  );
}

type BridgeLook = { skin: WorldSkin; theme: ThemeId };

function bridgeMaterial(look: BridgeLook, part: "plank" | "rail") {
  const { skin, theme } = look;
  if (theme === "space") {
    return part === "plank"
      ? <meshStandardMaterial color="#1a2238" emissive={skin.glow} emissiveIntensity={0.25} metalness={0.6} roughness={0.3} />
      : <meshStandardMaterial color={skin.glow} emissive={skin.glow} emissiveIntensity={1.4} toneMapped={false} />;
  }
  const rail = theme === "japanese" || theme === "chinese" ? skin.trim : skin.stone;
  return <meshStandardMaterial color={part === "plank" ? skin.wood : rail} roughness={part === "plank" ? 0.9 : 0.6} />;
}

/**
 * Arched bridge between two rooms. With `toLook` the far half is built in the
 * next room's style, so the portal in the middle is a border between cultures.
 */
export function Bridge({ skin, from, to, theme, atmo, toLook }: {
  skin: WorldSkin; from: THREE.Vector3; to: THREE.Vector3; theme: ThemeId; atmo: Atmo; toLook?: BridgeLook;
}) {
  const near: BridgeLook = { skin, theme };
  const far = toLook ?? near;
  const { len, yaw, mid } = useMemo(() => {
    const d = to.clone().sub(from);
    return { len: d.length(), yaw: Math.atan2(d.x, d.z), mid: from.clone().lerp(to, 0.5) };
  }, [from, to]);
  const rails = useMemo(() => {
    const half = (u0: number, u1: number) => [-1.3, 1.3].map((x) => {
      const pts = Array.from({ length: 11 }, (_, i) => {
        const u = u0 + ((u1 - u0) * i) / 10;
        return new THREE.Vector3(x, 0.9 + Math.sin(u * Math.PI) * 1.4 + 0.9, -len / 2 + u * len);
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.07, 8, false);
    });
    return { near: half(0, 0.5), far: half(0.5, 1) };
  }, [len]);
  const planks = Array.from({ length: 30 }, (_, i) => {
    const u = i / 29;
    const y = 0.9 + Math.sin(u * Math.PI) * 1.4;
    const slope = Math.cos(u * Math.PI) * 1.4 * Math.PI / len;
    return { u, z: -len / 2 + u * len, y, rot: -Math.atan(slope) };
  });
  const lookAt = (u: number) => (u < 0.5 ? near : far);
  return (
    <group position={mid} rotation-y={yaw}>
      {planks.map((p, i) => (
        <mesh key={i} position={[0, p.y, p.z]} rotation-x={p.rot}><boxGeometry args={[2.8, 0.14, len / 29 + 0.05]} />{bridgeMaterial(lookAt(p.u), "plank")}</mesh>
      ))}
      {rails.near.map((g, i) => <mesh key={`n${i}`} geometry={g}>{bridgeMaterial(near, "rail")}</mesh>)}
      {rails.far.map((g, i) => <mesh key={`f${i}`} geometry={g}>{bridgeMaterial(far, "rail")}</mesh>)}
      {planks.filter((_, i) => i % 4 === 0).map((p, i) => [-1.3, 1.3].map((x) => (
        <mesh key={`${i}${x}`} position={[x, p.y + 0.45, p.z]}><boxGeometry args={[0.12, 0.9, 0.12]} />{bridgeMaterial(lookAt(p.u), "rail")}</mesh>
      )))}
      {[0.12, 0.88].map((u) => [-1.3, 1.3].map((x) => (
        <mesh key={`${u}${x}`} position={[x, 0.9 + Math.sin(u * Math.PI) * 1.4 + 1.25, -len / 2 + u * len]}>
          <sphereGeometry args={[0.18, 14, 10]} /><Glowing color={lookAt(u).skin.glow} intensity={2.5} atmo={atmo} />
        </mesh>
      )))}
    </group>
  );
}

export function Flora({ skin, seed, spots, atmo, growth }: { skin: WorldSkin; seed: number; spots: V3[]; atmo: Atmo; growth: Growth }) {
  const key = JSON.stringify(spots);
  const items = useMemo(() => {
    const r = rng(seed);
    return spots.map((p) => ({ p, s: 0.8 + r() * 0.5, rot: r() * 6, k: r() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, key]);
  return (
    <group>
      {items.map(({ p, s, rot, k }, i) => (
        <group key={i} position={p} scale={s} rotation-y={rot}>
          <Grow growth={growth}>
          {skin.flora === "sakura" && (
            <>
              <mesh position={[0, 1.6, 0]} rotation-z={0.12}><cylinderGeometry args={[0.14, 0.26, 3.2, 8]} /><meshStandardMaterial color="#4a3328" /></mesh>
              {[[0, 3.6, 0, 1.6], [1.1, 3.2, 0.4, 1.1], [-1.0, 3.3, -0.3, 1.2], [0.3, 4.3, -0.6, 1.0]].map(([x, y, z, rr], j) => (
                <mesh key={j} position={[x, y, z]}><icosahedronGeometry args={[rr, 1]} /><meshStandardMaterial color={["#f6c6d0", "#f0aebf", "#fbd9e0"][j % 3]} emissive="#ff8fb0" emissiveIntensity={0.12} roughness={0.9} flatShading /></mesh>
              ))}
            </>
          )}
          {skin.flora === "bamboo" && Array.from({ length: 7 }, (_, j) => (
            <group key={j} position={[Math.cos(j * 2.4) * 0.7, 0, Math.sin(j * 2.4) * 0.7]}>
              <mesh position={[0, 3 + (j % 3) * 0.6, 0]} rotation-z={(j - 3) * 0.03}><cylinderGeometry args={[0.07, 0.09, 6 + (j % 3) * 1.2, 6]} /><meshStandardMaterial color="#6a8a4a" /></mesh>
              <mesh position={[0, 5.6 + (j % 3) * 0.8, 0]} scale={[1, 0.5, 1]}><icosahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color="#4e7a40" flatShading /></mesh>
            </group>
          ))}
          {skin.flora === "banyan" && (
            <>
              <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.5, 0.9, 4, 10]} /><meshStandardMaterial color="#5a4030" /></mesh>
              {Array.from({ length: 7 }, (_, j) => (
                <mesh key={j} position={[Math.cos(j) * 2.2, 4.4 + (j % 2) * 0.5, Math.sin(j) * 2.2]} scale={[1.4, 0.7, 1.4]}><icosahedronGeometry args={[1.6, 1]} /><meshStandardMaterial color={["#2f4a26", "#3a5a2e", "#24391e"][j % 3]} flatShading /></mesh>
              ))}
              {Array.from({ length: 6 }, (_, j) => (
                <mesh key={`r${j}`} position={[Math.cos(j * 1.3) * 2.4, 2.2, Math.sin(j * 1.3) * 2.4]}><cylinderGeometry args={[0.04, 0.05, 4.4, 4]} /><meshStandardMaterial color="#5a4030" /></mesh>
              ))}
            </>
          )}
          {skin.flora === "asteroids" && (
            <>
              {/* small rocks hanging in zero gravity, and a beacon */}
              {Array.from({ length: 5 }, (_, j) => (
                <mesh key={j} position={[Math.cos(j * 1.3 + k) * 1.4, 1.6 + j * 0.9, Math.sin(j * 1.3 + k) * 1.4]} rotation={[j, j * 0.7, 0]} scale={0.35 + (j % 3) * 0.22}>
                  <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={skin.stone} roughness={1} flatShading />
                </mesh>
              ))}
              <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.05, 0.08, 2.4, 6]} /><meshStandardMaterial color="#c9d0e8" metalness={0.8} /></mesh>
              <mesh position={[0, 2.5, 0]}><sphereGeometry args={[0.16, 12, 8]} /><Glowing color={k > 0.5 ? "#ff8a3a" : skin.glow} intensity={3} atmo={atmo} /></mesh>
            </>
          )}
          {skin.flora === "crystals" && Array.from({ length: 4 }, (_, j) => (
            <mesh key={j} position={[Math.cos(j * 1.6) * 0.6, 1 + j * 0.2, Math.sin(j * 1.6) * 0.6]} rotation={[0.2 * (j - 1.5), j, 0.15 * j]} scale={[0.5, 1.6 + j * 0.4, 0.5]}>
              <octahedronGeometry args={[1, 0]} />
              <Glowing color={j % 2 ? "#7fe3ff" : "#b48aff"} intensity={0.9} atmo={atmo} />
            </mesh>
          ))}
          </Grow>
        </group>
      ))}
    </group>
  );
}

// ── distant scenery ─────────────────────────────────────────────────────────

export function Scenery({ skin }: { skin: WorldSkin }) {
  const ring = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 26 }, (_, i) => {
      const a = -Math.PI * 0.95 + (i / 25) * Math.PI * 0.9 + r() * 0.05;
      const d = 150 + r() * 70;
      return { x: Math.cos(a) * d + 10, z: Math.sin(a) * d - 40, h: 18 + r() * 30, w: 22 + r() * 30, k: r() };
    });
  }, []);
  const dark = "#3a3550";
  return (
    <group>
      {skin.scenery !== "blackhole" && skin.scenery !== "floating" && ring.map((m, i) => (
        <mesh key={i} position={[m.x, m.h * 0.45 - 2, m.z]} scale={[m.w, m.h, m.w * 0.8]}>
          <coneGeometry args={[1, 1, 6]} /><meshStandardMaterial color={dark} roughness={1} flatShading />
        </mesh>
      ))}
      {skin.scenery === "fuji" && (
        <group position={[-70, 0, -230]}>
          <mesh position={[0, 34, 0]}><coneGeometry args={[110, 70, 48]} /><meshStandardMaterial color="#5c5674" roughness={1} /></mesh>
          <mesh position={[0, 61, 0]}><coneGeometry args={[32, 18, 48]} /><meshStandardMaterial color="#f4eef2" roughness={1} /></mesh>
        </group>
      )}
      {skin.scenery === "karst" && ring.slice(0, 18).map((m, i) => (
        <mesh key={`k${i}`} position={[m.x * 0.8, m.h, m.z * 0.8]} scale={[5 + m.k * 4, m.h * 2.2, 5 + m.k * 4]}>
          <cylinderGeometry args={[0.55, 1, 1, 7]} /><meshStandardMaterial color="#45524d" roughness={1} flatShading />
        </mesh>
      ))}
      {skin.scenery === "ghats" && (
        <group>
          {[-60, -20, 30, 70, 110].map((x, i) => (
            <group key={x} position={[x, 0, -150 - (i % 2) * 20]}>
              <mesh position={[0, 4, 0]}><boxGeometry args={[14, 8, 14]} /><meshStandardMaterial color="#6a4a3a" /></mesh>
              <mesh geometry={shikharaGeo(6, 20 + i * 3)} position={[0, 8, 0]}><meshStandardMaterial color="#5a3a40" flatShading /></mesh>
            </group>
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={`s${i}`} position={[20, i * 0.8, -125 + i * 1.6]}><boxGeometry args={[220, 0.8, 1.6]} /><meshStandardMaterial color={i % 2 ? "#6a4a3a" : "#5a3e30"} /></mesh>
          ))}
        </group>
      )}
      {skin.scenery === "blackhole" && (
        <>
          <BlackHole position={[-10, 46, -270]} scale={1.7} />
          {ring.slice(0, 8).map((m, i) => (
            <mesh key={`a${i}`} position={[m.x * 0.6, 8 + m.k * 50, m.z * 0.6]} rotation={[m.k * 3, i, m.k]} scale={3 + m.k * 7}>
              <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#3a3550" roughness={1} flatShading />
            </mesh>
          ))}
          <mesh position={[150, 70, -200]}><sphereGeometry args={[14, 32, 20]} /><meshStandardMaterial color="#c98a5a" roughness={0.9} /></mesh>
          <mesh position={[150, 70, -200]} rotation={[1.2, 0.2, 0.3]}><ringGeometry args={[19, 28, 64]} /><meshBasicMaterial color="#d9c7a0" transparent opacity={0.45} side={THREE.DoubleSide} fog={false} /></mesh>
        </>
      )}
      {skin.scenery === "floating" && ring.slice(0, 12).map((m, i) => (
        <group key={`f${i}`} position={[m.x * 0.7, 20 + m.k * 40, m.z * 0.7]}>
          <mesh rotation-x={Math.PI}><coneGeometry args={[6 + m.k * 6, 12 + m.k * 8, 7]} /><meshStandardMaterial color="#2a2140" flatShading /></mesh>
          {i % 3 === 0 && (
            <>
              <mesh position={[0, 5, 0]}><cylinderGeometry args={[1.4, 1.6, 10, 10]} /><meshStandardMaterial color="#2a2140" /></mesh>
              <mesh position={[0, 12, 0]}><coneGeometry args={[2.2, 5, 10]} /><meshStandardMaterial color="#1e1636" /></mesh>
              <mesh position={[0, 6, 1.5]}><boxGeometry args={[0.6, 1, 0.1]} /><meshStandardMaterial color="#ffcf7a" emissive="#ffcf7a" emissiveIntensity={3} toneMapped={false} /></mesh>
            </>
          )}
        </group>
      ))}
      {skin.scenery === "floating" && (
        <mesh position={[60, 60, -260]}><sphereGeometry args={[18, 32, 20]} /><meshBasicMaterial color="#f3eedd" fog={false} /></mesh>
      )}
    </group>
  );
}

// ── black hole ──────────────────────────────────────────────────────────────

const diskVert = /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const diskFrag = /* glsl */ `
  uniform float time; uniform float inner; uniform float outer; varying vec3 vP;
  void main() {
    float r = length(vP.xy);
    float t = clamp((r - inner) / (outer - inner), 0.0, 1.0);
    float a = atan(vP.y, vP.x);
    float swirl = 0.65 + 0.35 * sin(a * 6.0 - time * 1.4 + r * 0.35) * sin(a * 3.0 + time * 0.7 - r * 0.2);
    vec3 col = mix(vec3(1.0, 0.95, 0.82), vec3(1.0, 0.55, 0.2), smoothstep(0.0, 0.35, t));
    col = mix(col, vec3(0.6, 0.15, 0.08), smoothstep(0.35, 1.0, t));
    float alpha = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.55, 1.0, t)) * swirl;
    gl_FragColor = vec4(col * 1.5, alpha);
  }
`;

/** A black hole: shadow, glowing accretion disk, and a photon ring lensed over the top. */
export function BlackHole({ position, scale = 1 }: { position: V3; scale?: number }) {
  const facing = useRef<THREE.Group>(null);
  const uDisk = useMemo(() => ({ time: { value: 0 }, inner: { value: 19 }, outer: { value: 70 } }), []);
  const uRing = useMemo(() => ({ time: { value: 0 }, inner: { value: 18.5 }, outer: { value: 34 } }), []);
  useFrame((s) => {
    uDisk.time.value = s.clock.elapsedTime;
    uRing.time.value = s.clock.elapsedTime * 0.8;
    // The lensed ring always faces the viewer, as real lensing would.
    facing.current?.lookAt(s.camera.position);
  });
  return (
    <group position={position} scale={scale}>
      {/* Everything faces the viewer: the disk is seen almost edge-on, the lensed ring arcs over the shadow. */}
      <group ref={facing}>
        <mesh position={[0, 0, 0.5]}><ringGeometry args={[18.5, 30, 128, 1]} /><shaderMaterial uniforms={uRing} vertexShader={diskVert} fragmentShader={diskFrag} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} fog={false} /></mesh>
        <mesh position={[0, 0, 1]}><circleGeometry args={[18, 64]} /><meshBasicMaterial color="#000" fog={false} /></mesh>
        <mesh rotation={[Math.PI / 2 - 0.1, 0, 0.08]} position={[0, 0, 2]}>
          <ringGeometry args={[19, 70, 160, 1]} />
          <shaderMaterial uniforms={uDisk} vertexShader={diskVert} fragmentShader={diskFrag} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>
    </group>
  );
}
