/**
 * 3D massing model: walls drawn as boxes from the solid segments cut by the core package, spaces as slabs, furniture as simple blocks.
 * Shows the current floor and below; picking is synced with the plan. Units: data in millimetres, scene in metres.
 */
import { Bounds, Edges, OrbitControls, useBounds } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { findObject, projectBoxes, type Box, type Project, type Space } from '@plinth/core';
import { ScanIcon, SquareIcon, BoxIcon } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { m } from '@/lib/i18n';
import { useCanvasDocument } from '@/canvas/CanvasFrame';
import { hops, REVEAL } from '@/canvas/hop';
import { useThemeColors } from '@/lib/theme';
import { useEditor } from './store';

const M = 0.001;
const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** All 3D model colors come from the theme */
const useColors = () =>
  useThemeColors({
    bg: '--muted', wall: '--card', slab: '--secondary', ground: '--accent', furn: '--chart-3',
    glass: '--muted-foreground', edge: '--muted-foreground', sel: '--chart-2', changed: '--chart-1', sky: '--background',
  }, useCanvasDocument());

/** Selected objects are tinted with the selection color and outlined; just-changed objects get a tint that fades out */
const SELECTED_TINT = 0.45;
const CHANGED_TINT = 0.6;
const TintColors = createContext<{ sel: THREE.Color; changed: THREE.Color }>({ sel: new THREE.Color(), changed: new THREE.Color() });

/**
 * Per-frame feedback for one object (see canvas/hop.ts): its color (selected, or fading after a change) and the one-time hop.
 * userData.restY and userData.baseColor record the resting state; screenshots put objects back to it first.
 */
function useFeedback<T extends THREE.Mesh>(id: string, color: string, selected: boolean) {
  const ref = useRef<T>(null);
  const tints = useContext(TintColors);
  const base = useMemo(() => new THREE.Color(color), [color]);
  useFrame(({ camera, size }) => {
    const o = ref.current;
    if (!o) return;
    const now = performance.now();
    const mat = o.material as THREE.MeshStandardMaterial;
    o.userData.baseColor = base;
    mat.color.copy(base);
    if (selected) mat.color.lerp(tints.sel, SELECTED_TINT);
    else {
      const k = hops.changeTint(id, now);
      if (k > 0) mat.color.lerp(tints.changed, CHANGED_TINT * k);
    }
    const px = hops.lift(id, now);
    o.position.y = o.userData.restY;
    if (!px) return;
    // Hop height is in screen pixels: the farther from the camera, the higher the lift
    const dist = camera.position.distanceTo(o.getWorldPosition(tmp));
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 40;
    o.position.y += (px * 2 * dist * Math.tan((fov * Math.PI) / 360)) / size.height;
  });
  return ref;
}
const tmp = new THREE.Vector3();

/**
 * When the selected object is hidden by walls (e.g. furniture in a room), raise the camera, aim at it to reveal it, then hop.
 * If it is already visible the camera stays put.
 */
function Reveal({ ownerOf }: { ownerOf: (id: string) => string | undefined }) {
  const selection = useEditor(s => s.view.selection);
  const { camera, scene, controls } = useThree();
  const anim = useRef<{ t0: number; from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; id: string } | null>(null);
  const prev = useRef<string[]>([]);

  useEffect(() => {
    const id = selection.find(x => !prev.current.includes(x));
    prev.current = selection;
    if (!id) return;
    const target = ownerOf(id) ?? id;
    const parts: THREE.Mesh[] = [];
    scene.traverse(o => {
      if ((o as THREE.Mesh).isMesh && o.userData.id === target) parts.push(o as THREE.Mesh);
    });
    if (!parts.length) return;
    const box = new THREE.Box3();
    for (const m of parts) box.expandByObject(m);
    const center = box.getCenter(new THREE.Vector3());
    const top = new THREE.Vector3(center.x, box.max.y, center.z);
    if ([center, top].some(p => visible(p, target))) return;

    // Hidden: keep the azimuth, raise the camera to near top-down and aim at it
    const orbit = controls as unknown as { target: THREE.Vector3 } | null;
    const fromTarget = orbit?.target.clone() ?? new THREE.Vector3();
    const offset = camera.position.clone().sub(fromTarget);
    const s = new THREE.Spherical().setFromVector3(offset);
    s.phi = Math.min(s.phi, 0.45);
    const toTarget = new THREE.Vector3(center.x, box.min.y, center.z);
    const toPos = toTarget.clone().add(new THREE.Vector3().setFromSpherical(s));
    anim.current = { t0: performance.now(), from: [camera.position.clone(), fromTarget], to: [toPos, toTarget], id };
  }, [selection]);

  /** Whether the first solid hit from the camera to this point is the target itself (glass does not occlude) */
  const visible = (p: THREE.Vector3, target: string) => {
    const ray = new THREE.Raycaster(camera.position, p.clone().sub(camera.position).normalize());
    const far = camera.position.distanceTo(p);
    for (const hit of ray.intersectObjects(scene.children, true)) {
      const o = hit.object as THREE.Mesh;
      if (!o.isMesh || !o.userData.id) continue;
      if (o.userData.id === target) return true;
      if ((o.material as THREE.Material).transparent) continue;
      return hit.distance > far - 0.05;
    }
    return true;
  };

  useFrame(() => {
    const a = anim.current;
    if (!a) return;
    const t = Math.min(1, (performance.now() - a.t0) / REVEAL.ms);
    const k = t * t * (3 - 2 * t);
    camera.position.lerpVectors(a.from[0], a.to[0], k);
    const orbit = controls as unknown as { target: THREE.Vector3; update(): void } | null;
    orbit?.target.lerpVectors(a.from[1], a.to[1], k);
    orbit?.update();
    if (t === 1) {
      anim.current = null;
      hops.poke(a.id);
    }
  });
  return null;
}

/** The selected object's edges are drawn in the selection color */
type Outline = { edge: string; sel?: string };
const edgeProps = ({ edge, sel }: Outline) => ({ color: sel ?? edge, lineWidth: sel ? 2 : 1 });

function BoxMesh({ b, base, color, opacity = 1, onPick, ...o }: Outline & { b: Box; base: number; color: string; opacity?: number; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const y = (base + b.z + b.height / 2) * M;
  const ref = useFeedback<THREE.Mesh>(b.id, color, !!o.sel);
  return (
    <mesh
      ref={ref}
      geometry={unitBox}
      position={[b.center[0] * M, y, b.center[1] * M]}
      rotation={[0, -b.angle, 0]}
      scale={[b.length * M, b.height * M, b.thickness * M]}
      castShadow={opacity === 1}
      receiveShadow
      onClick={onPick}
      userData={{ id: b.id, restY: y }}
    >
      <meshStandardMaterial color={color} roughness={0.9} transparent={opacity < 1} opacity={opacity} />
      {opacity === 1 && <Edges threshold={20} {...edgeProps(o)} />}
    </mesh>
  );
}

function Slab({ s, y, thickness, color, onPick, ...o }: Outline & { s: Space; y: number; thickness: number; color: string; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const ref = useFeedback<THREE.Mesh>(s.id, color, !!o.sel);
  const geo = useMemo(() => {
    const shapes = s.shape.map(p => {
      const sh = new THREE.Shape(p.outer.map(([x, z]) => new THREE.Vector2(x * M, -z * M)));
      for (const h of p.holes ?? []) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x * M, -z * M))));
      return sh;
    });
    const g = new THREE.ExtrudeGeometry(shapes, { depth: thickness * M, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [s.shape, thickness]);
  return (
    <mesh ref={ref} geometry={geo} position={[0, (y - thickness) * M, 0]} receiveShadow onClick={onPick} userData={{ id: s.id, restY: (y - thickness) * M }}>
      <meshStandardMaterial color={color} roughness={1} />
      <Edges threshold={20} {...edgeProps(o)} />
    </mesh>
  );
}

function Furniture({ f, base, color, sel, onPick }: { f: Project['furniture'][number]; base: number; color: string; sel?: string; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const y = (base + (f.elevation ?? 0) + f.size.h / 2) * M;
  const ref = useFeedback<THREE.Mesh>(f.id, color, !!sel);
  return (
    <mesh ref={ref} geometry={unitBox} castShadow onClick={onPick} userData={{ id: f.id, restY: y }}
      position={[f.position[0] * M, y, f.position[1] * M]}
      rotation={[0, (-f.rotation * Math.PI) / 180, 0]} scale={[f.size.w * M, f.size.h * M, f.size.d * M]}>
      <meshStandardMaterial color={color} roughness={0.95} />
      {sel && <Edges color={sel} threshold={20} lineWidth={2} />}
    </mesh>
  );
}

function Fit({ project, level }: { project: Project; level: string }) {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().clip().fit();
  }, [level, project.id]);
  return null;
}

function Capture() {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const setCapture = useEditor(s => s.setCapture);
  useEffect(() => {
    setCapture(async () => {
      // Capture the drawing only: put hopping and tinted objects back to rest first
      scene.traverse(o => {
        if (typeof o.userData.restY === 'number') o.position.y = o.userData.restY;
        if (o.userData.baseColor) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.copy(o.userData.baseColor);
      });
      gl.render(scene, camera);
      const c = gl.domElement;
      return { dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height };
    });
    return () => setCapture(null);
  }, [gl, scene, camera]);
  return null;
}

type Orbit = { target: THREE.Vector3; maxPolarAngle: number; update(): void };

/** Wheel events from a trackpad: they scroll horizontally too, or report the fine-grained deltas mouse wheels don't */
const fromTrackpad = (e: WheelEvent) =>
  e.deltaMode === 0 && (e.deltaX !== 0 || (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY === -3 * e.deltaY || !Number.isInteger(e.deltaY));

/**
 * Wheel and gesture input. A trackpad swipe orbits the camera (with Shift it pans) and a pinch zooms, like map and design tools;
 * a mouse wheel zooms. OrbitControls keeps drag and touch input; its own wheel zoom is turned off.
 */
function WheelControls() {
  const { gl, camera, controls } = useThree();
  useEffect(() => {
    const orbit = controls as unknown as Orbit | null;
    if (!orbit) return;
    const el = gl.domElement;
    let trackpad = false;
    const offset = () => camera.position.clone().sub(orbit.target);
    const zoom = (factor: number) => {
      const o = offset();
      camera.position.copy(orbit.target).add(o.setLength(THREE.MathUtils.clamp(o.length() * factor, 1, 1000)));
      orbit.update();
    };
    const rotate = (dx: number, dy: number) => {
      const s = new THREE.Spherical().setFromVector3(offset());
      s.theta -= dx * 0.005;
      s.phi = THREE.MathUtils.clamp(s.phi - dy * 0.005, 0.01, orbit.maxPolarAngle);
      camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(s));
      orbit.update();
    };
    // The scene follows the fingers: move the camera and its target across the ground plane
    const pan = (dx: number, dy: number) => {
      const k = offset().length() * 0.0015;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).setY(0).normalize();
      const forward = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right);
      const move = right.multiplyScalar(dx * k).add(forward.multiplyScalar(-dy * k));
      camera.position.add(move);
      orbit.target.add(move);
      orbit.update();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Pinch on a trackpad (Chrome, Firefox) arrives as a wheel event with ctrlKey; so does Ctrl + mouse wheel
      if (e.ctrlKey) return zoom(Math.exp(e.deltaY * 0.01));
      if (fromTrackpad(e)) trackpad = true;
      if (!trackpad) return zoom(Math.exp(e.deltaY * 0.001));
      if (e.shiftKey) pan(e.deltaX, e.deltaY);
      else rotate(e.deltaX, e.deltaY);
    };
    // Safari reports a pinch as gesture events with a running scale
    let lastScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const scale = (e as Event & { scale: number }).scale;
      zoom(lastScale / scale);
      lastScale = scale;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, [gl, camera, controls]);
  return null;
}

type ViewCommand = { kind: 'fit' | 'top' | 'perspective'; n: number };

/** Runs the view buttons' commands: frame the level again, or swing the camera to a top or perspective view around the same target */
function ViewCommands({ command }: { command: ViewCommand | null }) {
  const bounds = useBounds();
  const { camera, controls } = useThree();
  const anim = useRef<{ t0: number; from: THREE.Vector3; to: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const orbit = controls as unknown as Orbit | null;
    if (!command || !orbit) return;
    if (command.kind === 'fit') return void bounds.refresh().clip().fit();
    const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
    s.phi = command.kind === 'top' ? 0.01 : 0.95;
    anim.current = { t0: performance.now(), from: camera.position.clone(), to: orbit.target.clone().add(new THREE.Vector3().setFromSpherical(s)) };
  }, [command]);
  useFrame(() => {
    const a = anim.current;
    if (!a) return;
    const t = Math.min(1, (performance.now() - a.t0) / REVEAL.ms);
    camera.position.lerpVectors(a.from, a.to, t * t * (3 - 2 * t));
    (controls as unknown as Orbit | null)?.update();
    if (t === 1) anim.current = null;
  });
  return null;
}

export function Model3D() {
  const project = useEditor(s => s.project);
  const view = useEditor(s => s.view);
  const select = useEditor(s => s.select);
  const c = useColors();

  const current = project.levels.find(l => l.id === view.level);
  const shown = project.levels.filter(l => !current || l.elevation <= current.elevation);
  const elev = new Map(project.levels.map(l => [l.id, l.elevation]));
  const boxes = useMemo(() => projectBoxes(project), [project]);
  const ownerOf = (id: string) => findObject(project, id, 'opening')?.wall?.id;
  // A door or window is part of its wall in 3D, so selecting it marks the wall
  const sel = new Set(view.selection.map(id => ownerOf(id) ?? id));
  const tints = useMemo(() => ({ sel: new THREE.Color(c.sel), changed: new THREE.Color(c.changed) }), [c.sel, c.changed]);

  const [command, setCommand] = useState<ViewCommand | null>(null);
  const [top, setTop] = useState(false);
  const run = (kind: ViewCommand['kind']) => setCommand(c => ({ kind, n: (c?.n ?? 0) + 1 }));

  const pick = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select([id]);
  };

  const [x0, y0, x1, y1] = useMemo(() => {
    const xs = project.site.boundary.map(p => p[0]), ys = project.site.boundary.map(p => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }, [project.site.boundary]);
  const cx = ((x0 + x1) / 2) * M, cz = ((y0 + y1) / 2) * M, span = Math.max(x1 - x0, y1 - y0) * M;

  return (
    <div className="relative size-full">
      <TintColors.Provider value={tints}>
        <Canvas
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: [cx + span * 0.9, span * 0.8, cz + span * 1.1], fov: 40, near: 0.1, far: 2000 }}
          onPointerMissed={() => select([])}
          style={{ background: c.bg }}
        >
          <hemisphereLight args={[c.sky, c.edge, 1.1]} />
          <directionalLight position={[cx - 20, 40, cz + 25]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, project.site.groundLevel * M - 0.01, cz]} receiveShadow>
            <planeGeometry args={[span * 4, span * 4]} />
            <meshStandardMaterial color={c.ground} roughness={1} />
          </mesh>

          <Bounds margin={1.15}>
            <Fit project={project} level={view.level} />
            <ViewCommands command={command} />
            <group>
              {shown.map(l => (
                <group key={l.id}>
                  {project.spaces.filter(s => s.level === l.id && s.kind !== 'void' && !s.slabOpening).map(s => (
                    <Slab key={s.id} s={s} y={s.kind === 'outdoor' && l.elevation === 0 ? project.site.groundLevel + 20 : l.elevation} thickness={s.kind === 'outdoor' ? 20 : 120}
                      color={c.slab} edge={c.edge} sel={sel.has(s.id) ? c.sel : undefined} onPick={pick(s.id)} />
                  ))}
                  {boxes.filter(b => b.level === l.id).map((b, i) => (
                    <BoxMesh key={`${b.id}-${i}`} b={b} base={elev.get(l.id) ?? 0} edge={c.edge} onPick={pick(b.id)}
                      color={b.kind === 'glass' ? c.glass : c.wall} sel={sel.has(b.id) ? c.sel : undefined} opacity={b.kind === 'glass' ? 0.2 : 1} />
                  ))}
                  {view.layers.furniture && project.furniture.filter(f => f.level === l.id).map(f => (
                    <Furniture key={f.id} f={f} base={elev.get(l.id) ?? 0} color={c.furn} sel={sel.has(f.id) ? c.sel : undefined} onPick={pick(f.id)} />
                  ))}
                </group>
              ))}
            </group>
          </Bounds>
          <OrbitControls makeDefault enableDamping enableZoom={false} maxPolarAngle={Math.PI / 2 - 0.05} />
          <WheelControls />
          <Reveal ownerOf={ownerOf} />
          <Capture />
        </Canvas>
      </TintColors.Provider>
      <div className="absolute top-2 right-2 flex gap-1">
        <Button size="icon-sm" variant="outline" className="bg-background" onClick={() => run('fit')} aria-label={m.model3d_fit()} title={m.model3d_fit()}><ScanIcon /></Button>
        <Button size="icon-sm" variant="outline" className="bg-background" onClick={() => { run(top ? 'perspective' : 'top'); setTop(!top); }}
          aria-label={top ? m.model3d_perspective() : m.model3d_top()} title={top ? m.model3d_perspective() : m.model3d_top()}>
          {top ? <BoxIcon /> : <SquareIcon />}
        </Button>
      </div>
      <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted-foreground max-md:hidden">{m.model3d_hint()}</p>
    </div>
  );
}
