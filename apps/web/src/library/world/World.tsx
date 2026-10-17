import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { memo, Suspense, useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Book } from "@/library/data/books";
import type { Library } from "@/library/data/library";
import type { Theme } from "@/library/themes/types";
import type { SpineRect } from "@/library/ui/types";
import { BlackHole, Bridge, Flora, Gate, Island, Pavilion, PortalVeil, Scenery } from "@/library/world/architecture";
import { Floaters, PageStorm } from "@/library/world/Effects";
import { Environment, type Atmo } from "@/library/world/Environment";
import { GrowthDriver, Rise, type Growth } from "@/library/world/Growth";
import type { Journey, JourneyState } from "@/library/world/journey";
import { Shelf3D } from "@/library/world/Shelf3D";
import { SKINS, type TimeOfDay } from "@/library/world/skins";

type V3 = [number, number, number];

/** Trees sit at the back corners and on the front corner the bridges don't use. */
function floraSpots(bridgeSide: number): V3[] {
  return [[-6.6, 0.4, -2.7], [6.4, 0.4, -3.4], [-bridgeSide * 6.8, 0.4, 3], [bridgeSide * 2.5, 0.4, -7.2]];
}

const veilShapeOf = (t: Theme) => (t.id === "chinese" || t.id === "space" ? "circle" : t.id === "fantasy" ? "arch" : "rect");

/** Moves the camera along the journey path; the HUD reads progress from the same object. */
function CameraRig({ journey, layout, onProgress }: { journey: JourneyState; layout: Journey; onProgress: (p: number) => void }) {
  const { camera, pointer } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const sway = useRef(new THREE.Vector2());
  const last = useRef(-1);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    journey.target = Math.min(journey.target, layout.last);
    journey.p += (journey.target - journey.p) * Math.min(1, dt * 1.7);
    if (Math.abs(journey.target - journey.p) < 1e-4) journey.p = journey.target;
    const t = layout.progressToT(journey.p);
    layout.camCurve.getPoint(t, pos);
    layout.lookCurve.getPoint(t, look);
    // A slow breath and a little look-around that follows the pointer.
    sway.current.lerp(journey.locked ? new THREE.Vector2() : pointer, Math.min(1, dt * 2));
    const time = state.clock.elapsedTime;
    pos.y += Math.sin(time * 0.6) * 0.05;
    look.x += sway.current.x * 1.2;
    look.y += sway.current.y * 0.6;
    camera.position.copy(pos);
    camera.lookAt(look);
    if (Math.abs(journey.p - last.current) > 0.002) {
      last.current = journey.p;
      onProgress(journey.p);
    }
  });
  return null;
}

export const World = memo(function World({ theme, themeFor, mixed, time, journey, layout, library, today, hiddenBookId, onPick, onProgress, reduced, registry, growth }: {
  /** Home theme: the entrance gate, distant scenery and sky tint. */
  theme: Theme;
  /** Theme each genre's room is built in (always `theme` unless Mixed). */
  themeFor: (genreId: string) => Theme;
  mixed: boolean;
  time: TimeOfDay;
  journey: JourneyState;
  /** Generated from the genres: islands, bridges and the camera path. */
  layout: Journey;
  library: Library;
  today: number;
  hiddenBookId: string | null;
  onPick: (book: Book, rect: SpineRect) => void;
  onProgress: (p: number) => void;
  reduced: boolean;
  /** Lets the HUD open a book by id (used by "Continue reading"). */
  registry: Map<string, () => void>;
  /** Which month of the library's history to show (today = the latest). */
  growth: Growth;
}) {
  const skin = SKINS[theme.id];
  const atmo = useMemo<Atmo>(() => ({ lanterns: 1, night: 0 }), []);
  const bridgeTop = 2.3;
  const canPick = (genreId: string) => () => !journey.locked && Math.abs(journey.p - layout.roomChapter[genreId]) < 0.08;
  const firstMonth = layout.islands[0]?.genre.month ?? 1;
  const spaceIslands = layout.islands.filter((i) => themeFor(i.genre.id).id === "space");

  // How deep into space the camera is: always for the Space theme, near Space rooms in Mixed mode.
  const spaceAt = useCallback((p: number) => {
    if (skin.space) return 1;
    let v = 0;
    for (const isl of spaceIslands) {
      const c = layout.roomChapter[isl.genre.id];
      v = Math.max(v, 1 - THREE.MathUtils.smoothstep(Math.abs(p - c), 0.35, 1.3));
    }
    if (spaceIslands.length) v = Math.max(v, 0.3 * THREE.MathUtils.smoothstep(p, layout.last - 1, layout.last));
    return v;
  }, [skin.space, spaceIslands, layout]);

  return (
    <Canvas
      className="world-canvas"
      dpr={[1, 1.6]}
      camera={{ fov: 42, near: 0.1, far: 900, position: [0, 2.4, 12] }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <CameraRig journey={journey} layout={layout} onProgress={onProgress} />
        <GrowthDriver growth={growth} />
        <Environment skin={skin} time={time} journey={journey} layout={layout} atmo={atmo} spaceAt={spaceAt} />
        <group position={[layout.center.x - 12, 0, layout.center.z + 54]}>
          <Scenery skin={skin} />
        </group>
        {/* In Mixed mode a black hole hangs in the sky behind the first Space room. */}
        {mixed && !skin.space && spaceIslands[0] && (
          <Rise growth={growth} at={spaceIslands[0].genre.month} ring={false} depth={0}>
            <BlackHole position={spaceIslands[0].pos.clone().add(new THREE.Vector3(-70, 46, -190)).toArray()} scale={0.8} />
          </Rise>
        )}

        <group position={layout.gate}>
          <Rise growth={growth} at={firstMonth} radius={6}>
            <Gate theme={theme.id} skin={skin} atmo={atmo} position={[0, 0, 0]} />
          </Rise>
        </group>

        {layout.islands.map((isl, i) => {
          const t = themeFor(isl.genre.id);
          const s = SKINS[t.id];
          return (
            <group key={isl.genre.id} position={isl.pos}>
              <Rise growth={growth} at={isl.genre.month}>
                <Island skin={s} />
                <Pavilion theme={t.id} skin={s} atmo={atmo} mood={isl.genre.mood} />
                <group position={[0, 0.75, -1.5]}>
                  <Shelf3D
                    room={isl.genre.id}
                    books={library.books}
                    theme={t}
                    skin={s}
                    atmo={atmo}
                    hiddenBookId={hiddenBookId}
                    enabled={canPick(isl.genre.id)}
                    onPick={onPick}
                    registry={registry}
                    growth={growth}
                  />
                </group>
                <Flora skin={s} atmo={atmo} growth={growth} seed={i * 11 + 3} spots={floraSpots(isl.bridgeSide)} />
              </Rise>
            </group>
          );
        })}

        {layout.crossings.map((c, i) => {
          const fromT = themeFor(layout.islands[i].genre.id);
          const toT = themeFor(layout.islands[i + 1].genre.id);
          const fromS = SKINS[fromT.id], toS = SKINS[toT.id];
          return (
            <Rise key={c.chapter} growth={growth} at={c.month} ring={false} depth={6}>
              {/* The near half of the bridge is built like the room you leave, the far half like the room ahead. */}
              <Bridge skin={fromS} theme={fromT.id} atmo={atmo} from={c.from} to={c.to} toLook={{ skin: toS, theme: toT.id }} />
              <Gate theme={toT.id} skin={toS} atmo={atmo} position={[c.portal.x, bridgeTop, c.portal.z]} rotationY={c.yaw} scale={0.92} />
              <group position={[c.portal.x, bridgeTop, c.portal.z]} rotation-y={c.yaw} scale={0.92}>
                <PortalVeil position={[0, 0, 0]} rotationY={0} color={toS.glow} shape={veilShapeOf(toT)} />
              </group>
              {!reduced && <PageStorm skin={fromS} journey={journey} atmo={atmo} layout={layout} chapter={c.chapter} />}
            </Rise>
          );
        })}

        {mixed
          ? layout.islands.map((isl) => {
            const s = SKINS[themeFor(isl.genre.id).id];
            return <Floaters key={isl.genre.id} skin={s} atmo={atmo} growth={growth} layout={layout} today={today} region={{ x: isl.pos.x, z: isl.pos.z, r: 22 }} />;
          })
          : <Floaters key={layout.islands.length} skin={skin} atmo={atmo} growth={growth} layout={layout} today={today} />}

        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.82} luminanceSmoothing={0.2} />
          <Vignette offset={0.3} darkness={0.6} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
});
