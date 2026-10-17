import { MeshReflectorMaterial } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { atmosphere, type TimeOfDay, type WorldSkin } from "./skins";
import type { Journey, JourneyState } from "./journey";

/** Live values other world pieces read every frame (lantern brightness etc). */
export interface Atmo {
  lanterns: number;
  night: number;
}

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFrag = /* glsl */ `
  uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor;
  uniform vec3 sunDir; uniform float stars; uniform float time; uniform float space;
  varying vec3 vDir;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.42)) : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.5));
    float s = max(dot(d, normalize(sunDir)), 0.0);
    // At night the "sun" is the moon: keep the disc, shrink the halo.
    // In space there is no sun at all; the black hole is the light source.
    col += sunColor * (pow(s, 900.0) * 2.0 + (pow(s, 14.0) * 0.35 + pow(s, 3.0) * 0.08) * (1.0 - 0.75 * stars)) * (1.0 - space);
    // a soft haze band on the horizon (gone in space, where there is no horizon)
    col = mix(col, horizon * 1.08, exp(-abs(h) * 18.0) * 0.5 * (1.0 - space));
    // nebula clouds in space
    float n1 = pow(0.5 + 0.5 * sin(d.x * 3.1 + sin(d.y * 4.3) * 1.6 + d.z * 2.2), 3.0);
    float n2 = pow(0.5 + 0.5 * sin(d.y * 5.2 - d.z * 3.4 + sin(d.x * 2.0) * 1.2 + 1.0), 4.0);
    col += space * (vec3(0.32, 0.08, 0.45) * n1 * 0.35 + vec3(0.06, 0.2, 0.42) * n2 * 0.3);
    if (stars > 0.0 && (h > 0.02 || space > 0.5)) {
      vec3 cell = floor(d * 380.0);
      float st = step(0.9975 - space * 0.0015, hash(cell));
      float tw = 0.6 + 0.4 * sin(time * 2.0 + hash(cell + 3.0) * 40.0);
      col += vec3(st * tw * stars * mix(smoothstep(0.02, 0.3, h), 1.0, space));
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const tmp = new THREE.Color();
const tmp2 = new THREE.Color();

export function Environment({ skin, time, journey, layout, atmo, spaceAt }: {
  skin: WorldSkin;
  time: TimeOfDay;
  journey: JourneyState;
  layout: Journey;
  atmo: Atmo;
  /** 0..1: how far into space the camera is (1 everywhere for the Space theme). */
  spaceAt: (p: number) => number;
}) {
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.FogExp2("#888888", 0.016), []);
  const sky = useRef<THREE.ShaderMaterial>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const water = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    bottom: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(-0.3, 0.06, -1) },
    stars: { value: 0 },
    time: { value: 0 },
    space: { value: 0 },
  }), []);
  const spaceLive = useRef(spaceAt(journey.p));

  // Live (smoothed) colours, so switching time of day fades rather than snaps.
  const live = useMemo(() => {
    const a = atmosphere(time);
    return {
      top: new THREE.Color(a.skyTop), horizon: new THREE.Color(a.horizon), bottom: new THREE.Color(a.skyBottom),
      fog: new THREE.Color(a.fog), sun: new THREE.Color(a.sun), water: new THREE.Color(a.water),
      density: a.fogDensity, ambient: a.ambient, lanterns: a.lanterns, sunHeight: a.sunHeight, stars: time === "night" ? 1 : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scene.fog = fog;
    return () => { scene.fog = null; };
  }, [scene, fog]);

  useFrame((state, dt) => {
    const k = Math.min(1, dt * 1.5);
    // Blend the Earth sky toward deep space as the camera nears a Space room.
    spaceLive.current += (spaceAt(journey.p) - spaceLive.current) * Math.min(1, dt * 2);
    const sp = spaceLive.current;
    const e = atmosphere(time), o = atmosphere(time, true);
    const c = (x: string, y: string) => "#" + tmp.set(x).lerp(tmp2.set(y), sp).getHexString();
    const n = (x: number, y: number) => x + (y - x) * sp;
    const a = {
      skyTop: c(e.skyTop, o.skyTop), horizon: c(e.horizon, o.horizon), skyBottom: c(e.skyBottom, o.skyBottom),
      fog: c(e.fog, o.fog), sun: c(e.sun, o.sun), water: c(e.water, o.water),
      fogDensity: n(e.fogDensity, o.fogDensity), ambient: n(e.ambient, o.ambient), lanterns: n(e.lanterns, o.lanterns), sunHeight: n(e.sunHeight, o.sunHeight),
    };
    // Each genre colours the air; crossings blend from one room's mood to the next.
    const p = journey.p;
    const mood = layout.moodAt(p, tmp2);
    const moodAmt = p < 0.6 ? 0.03 : p > layout.last - 0.6 ? 0.06 : 0.14;
    // The air clears at the overlook so a long chain of rooms stays visible.
    const clear = 1 - 0.72 * THREE.MathUtils.smoothstep(p, layout.last - 1, layout.last) * Math.min(1, layout.islands.length / 3 + 0.3);

    // Space stays near-black: the theme tint and genre mood barely touch it.
    const calm = 1 - 0.85 * sp;
    const mix = (target: string, extra = 0) =>
      tmp.set(target).lerp(new THREE.Color(skin.tint), skin.tintAmount * extra * calm).lerp(mood, moodAmt * extra * calm);
    live.top.lerp(mix(a.skyTop, 0.4), k);
    live.horizon.lerp(mix(a.horizon, 1), k);
    live.bottom.lerp(mix(a.skyBottom, 0.6), k);
    live.fog.lerp(mix(a.fog, 1), k);
    live.sun.lerp(tmp.set(a.sun), k);
    live.water.lerp(mix(a.water, 0.5), k);
    live.density += (a.fogDensity * clear - live.density) * k;
    live.ambient += (a.ambient - live.ambient) * k;
    live.lanterns += (a.lanterns - live.lanterns) * k;
    live.sunHeight += (a.sunHeight - live.sunHeight) * k;
    const starTarget = Math.max(time === "night" ? 1 : skin.floaters === "candles" ? 0.4 : 0, sp);
    live.stars += (starTarget - live.stars) * k;

    atmo.lanterns = live.lanterns;
    atmo.night = live.stars;

    uniforms.top.value.copy(live.top);
    uniforms.horizon.value.copy(live.horizon);
    uniforms.bottom.value.copy(live.bottom);
    uniforms.sunColor.value.copy(live.sun);
    uniforms.sunDir.value.set(-0.35, live.sunHeight, -1).normalize();
    uniforms.stars.value = live.stars;
    uniforms.time.value = state.clock.elapsedTime;
    uniforms.space.value = sp;

    fog.color.copy(live.fog);
    fog.density = live.density;
    if (hemi.current) {
      hemi.current.color.copy(live.horizon);
      hemi.current.groundColor.copy(live.water);
      hemi.current.intensity = live.ambient * 1.4;
    }
    if (sun.current) {
      sun.current.color.copy(live.sun);
      sun.current.intensity = 0.4 + (1 - live.stars) * 1.4 + sp * 0.6;
      sun.current.position.set(-35, 10 + live.sunHeight * 80, -60);
    }
    const wm = water.current?.material as THREE.MeshStandardMaterial | undefined;
    if (wm) wm.color.copy(live.water);
    // A Space-only world floats in the void: no water at all.
    if (water.current) water.current.visible = !skin.space;
  });

  return (
    <>
      <mesh scale={400} renderOrder={-1}>
        <sphereGeometry args={[1, 48, 24]} />
        <shaderMaterial ref={sky} side={THREE.BackSide} depthWrite={false} fog={false} uniforms={uniforms}
          vertexShader={skyVert} fragmentShader={skyFrag} />
      </mesh>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} position={[-35, 14, -60]} />
      <mesh ref={water} rotation-x={-Math.PI / 2} position={[10, 0, -40]}>
        <planeGeometry args={[700, 700]} />
        <MeshReflectorMaterial
          blur={[400, 120]}
          resolution={512}
          mixBlur={0.9}
          mixStrength={3}
          mirror={0.75}
          roughness={0.9}
          depthScale={0.4}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.2}
          metalness={0.3}
          color="#333"
        />
      </mesh>
    </>
  );
}
