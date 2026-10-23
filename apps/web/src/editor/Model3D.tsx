/**
 * 3D massing model: walls drawn as boxes from the solid segments cut by the core package, spaces as slabs, furniture as simple blocks.
 * Shows the current floor and below; picking is synced with the plan. Units: data in millimetres, scene in metres.
 */
import { Edges, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { findObject, projectBoxes, type Box, type Project, type Space } from '@plinth/core';
import { ScanIcon, SquareIcon, BoxIcon } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { m } from '@/lib/i18n';
import { useCanvasDocument } from '@/canvas/CanvasFrame';
import { hops, REVEAL } from '@/canvas/hop';
import { useThemeColors } from '@/lib/theme';
import { useEditor, useEditorStore } from './store';

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

function BoxMesh({ b, base, color, opacity = 1, ...o }: Outline & { b: Box; base: number; color: string; opacity?: number }) {
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
      userData={{ id: b.id, restY: y }}
    >
      <meshStandardMaterial color={color} roughness={0.9} transparent={opacity < 1} opacity={opacity} />
      {opacity === 1 && <Edges threshold={20} {...edgeProps(o)} />}
    </mesh>
  );
}

function Slab({ s, y, thickness, color, ...o }: Outline & { s: Space; y: number; thickness: number; color: string }) {
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
    <mesh ref={ref} geometry={geo} position={[0, (y - thickness) * M, 0]} receiveShadow userData={{ id: s.id, restY: (y - thickness) * M }}>
      <meshStandardMaterial color={color} roughness={1} />
      <Edges threshold={20} {...edgeProps(o)} />
    </mesh>
  );
}

function Furniture({ f, base, color, sel }: { f: Project['furniture'][number]; base: number; color: string; sel?: string }) {
  const y = (base + (f.elevation ?? 0) + f.size.h / 2) * M;
  const ref = useFeedback<THREE.Mesh>(f.id, color, !!sel);
  return (
    <mesh ref={ref} geometry={unitBox} castShadow userData={{ id: f.id, restY: y }}
      position={[f.position[0] * M, y, f.position[1] * M]}
      rotation={[0, (-f.rotation * Math.PI) / 180, 0]} scale={[f.size.w * M, f.size.h * M, f.size.d * M]}>
      <meshStandardMaterial color={color} roughness={0.95} />
      {sel && <Edges color={sel} threshold={20} lineWidth={2} />}
    </mesh>
  );
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

type Orbit = { target: THREE.Vector3; enabled: boolean; update(): void };
type Pose = { pos: THREE.Vector3; target: THREE.Vector3 };
const FOV = 40;
/** How much of the view the framed model fills (in its tighter direction) */
const FILL = 0.86;
/** Default viewing direction: from the south-east, looking down at about 35° */
const BIRD = new THREE.Vector3(0.9, 0.8, 1.1).normalize();
/** The last 3D camera per project, so coming back from the plan returns to it */
const lastPose = new Map<string, Pose>();
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Camera looking from this direction at the model's box: close enough that the box fills the view, and aimed so its outline
 * sits in the middle of the screen. The aim point is where the camera then orbits, so the model stays centered while rotating.
 */
function framed(box: THREE.Box3, aspect: number, dir: THREE.Vector3): Pose {
  const ty = Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * FILL, tx = ty * aspect;
  const back = dir.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
  const up = new THREE.Vector3().crossVectors(back, right);
  const corners = [box.min, box.max].flatMap(a => [box.min, box.max].flatMap(b => [box.min, box.max].map(c => new THREE.Vector3(a.x, b.y, c.z))));
  const target = box.getCenter(new THREE.Vector3());
  let dist = 1;
  // Perspective makes the outline's middle drift from the box center: fit, measure the outline on screen, re-aim, repeat
  for (let i = 0; i < 4; i++) {
    const rel = corners.map(p => {
      const o = p.clone().sub(target);
      return { x: o.dot(right), y: o.dot(up), d: o.dot(back) };
    });
    dist = Math.max(...rel.map(r => r.d + Math.max(Math.abs(r.x) / tx, Math.abs(r.y) / ty)));
    const sx = rel.map(r => r.x / (dist - r.d)), sy = rel.map(r => r.y / (dist - r.d));
    const mx = (Math.min(...sx) + Math.max(...sx)) / 2, my = (Math.min(...sy) + Math.max(...sy)) / 2;
    target.addScaledVector(right, mx * dist).addScaledVector(up, my * dist);
  }
  return { target, pos: target.clone().addScaledVector(back, dist) };
}

type ViewCommand = { kind: 'fit' | 'top' | 'perspective'; n: number };

/**
 * The camera always orbits the middle of the model, so rotating and zooming keep it centered (zoom goes toward that point).
 * Entering 3D swings the camera down from the plan's top view while the model rises; switching levels lifts the orbit point to the
 * new floor; the view buttons frame the model again or swing to a top or perspective view.
 */
function CameraRig({ box, levels, projectId, command, model }: {
  box: THREE.Box3; levels: string; projectId: string; command: ViewCommand | null; model: React.RefObject<THREE.Group | null>;
}) {
  const { camera, controls, size } = useThree();
  const orbit = controls as unknown as Orbit | null;
  const anim = useRef<{ elapsed: number; ms: number; from: Pose; to: Pose; grow: boolean } | null>(null);
  const shownLevels = useRef(levels);

  const run = (to: Pose, ms: number, grow = false) => {
    if (!orbit) return;
    anim.current = { elapsed: 0, ms: hops.reduced ? 0 : ms, from: { pos: camera.position.clone(), target: orbit.target.clone() }, to, grow };
  };
  const direction = () => (orbit ? camera.position.clone().sub(orbit.target).normalize() : BIRD);

  // Entering 3D: from straight above (where the plan was) to the last 3D view, or the default one
  useEffect(() => {
    if (!orbit) return;
    const aspect = size.width / size.height;
    const to = lastPose.get(projectId) ?? framed(box, aspect, BIRD);
    // North up, like the plan
    const top = framed(box, aspect, new THREE.Vector3(0, 1, 0.01));
    camera.position.copy(top.pos);
    orbit.target.copy(top.target);
    orbit.update();
    if (model.current && !hops.reduced) model.current.scale.y = 0.02;
    run(to, 1300, true);
    // Leaving mid-animation remembers where the camera was heading
    return () => void lastPose.set(projectId, anim.current?.to ?? { pos: camera.position.clone(), target: orbit.target.clone() });
  }, [orbit]);

  // Another level shows different floors: frame them again from the same direction (edits don't move the camera)
  useEffect(() => {
    if (shownLevels.current === levels) return;
    shownLevels.current = levels;
    if (orbit) run(framed(box, size.width / size.height, direction()), 600);
  }, [levels]);

  useEffect(() => {
    if (!command || !orbit) return;
    if (command.kind === 'fit') {
      const dir = direction();
      return run(framed(box, size.width / size.height, dir.y > 0.99 ? BIRD : dir), 600);
    }
    const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
    s.phi = command.kind === 'top' ? 0.01 : 0.95;
    run({ pos: orbit.target.clone().add(new THREE.Vector3().setFromSpherical(s)), target: orbit.target.clone() }, REVEAL.ms);
  }, [command]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !orbit) return;
    // Advance by frame time, at most 50 ms a step: the first frame in 3D can take a second (shader compilation), and the
    // animation should still play from its start rather than jump to the end
    a.elapsed += Math.min(dt * 1000, 50);
    const t = a.ms ? Math.min(1, a.elapsed / a.ms) : 1;
    const k = ease(t);
    // Turn around the target (angles and distance) rather than move in a straight line, so a top view stays north-up as it tilts
    const s0 = new THREE.Spherical().setFromVector3(a.from.pos.clone().sub(a.from.target));
    const s1 = new THREE.Spherical().setFromVector3(a.to.pos.clone().sub(a.to.target));
    const dTheta = Math.atan2(Math.sin(s1.theta - s0.theta), Math.cos(s1.theta - s0.theta));
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(s0.radius, s1.radius, k), THREE.MathUtils.lerp(s0.phi, s1.phi, k), s0.theta + dTheta * k);
    orbit.target.lerpVectors(a.from.target, a.to.target, k);
    camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(s));
    if (a.grow && model.current) model.current.scale.y = 0.02 + 0.98 * ease(Math.min(1, t * 1.25));
    orbit.enabled = t === 1;
    orbit.update();
    if (t === 1) anim.current = null;
  });
  return null;
}

/** Safari reports a trackpad pinch as gesture events (other browsers send a wheel event with ctrlKey, which OrbitControls handles) */
function SafariPinch() {
  const { gl, camera, controls } = useThree();
  useEffect(() => {
    const orbit = controls as unknown as (Orbit & { minDistance: number; maxDistance: number }) | null;
    if (!orbit) return;
    const el = gl.domElement;
    let last = 1;
    const start = (e: Event) => {
      e.preventDefault();
      last = 1;
    };
    const change = (e: Event) => {
      e.preventDefault();
      const scale = (e as Event & { scale: number }).scale;
      const o = camera.position.clone().sub(orbit.target);
      camera.position.copy(orbit.target).add(o.setLength(THREE.MathUtils.clamp((o.length() * last) / scale, orbit.minDistance, orbit.maxDistance)));
      last = scale;
      orbit.update();
    };
    el.addEventListener('gesturestart', start);
    el.addEventListener('gesturechange', change);
    return () => {
      el.removeEventListener('gesturestart', start);
      el.removeEventListener('gesturechange', change);
    };
  }, [gl, camera, controls]);
  return null;
}

/**
 * Picking: a press and release in (nearly) the same spot selects the object under the pointer; a drag rotates and picks nothing.
 * Done on pointer events instead of the browser's click, which OrbitControls' pointer capture makes unreliable in some browsers.
 * Shift or Cmd adds to / removes from the selection, like the plan.
 */
function Picker() {
  const { gl, camera, scene, raycaster } = useThree();
  const store = useEditorStore();
  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; id: number } | null = null;
    // A second finger (pinch) cancels the pick
    const onDown = (e: PointerEvent) => {
      down = !down && e.button === 0 && e.isPrimary ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
    };
    const onCancel = () => {
      down = null;
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
      const r = el.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      // The first surface hit: edge lines don't count, the ground counts as empty space
      const hit = raycaster.intersectObjects(scene.children, true).find(h => (h.object as THREE.Mesh).isMesh);
      const id: string | undefined = hit?.object.userData.id;
      const { select, view } = store.getState();
      if (!id) return select([]);
      if (e.shiftKey || e.metaKey) select(view.selection.includes(id) ? view.selection.filter(x => x !== id) : [...view.selection, id]);
      else select([id]);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
  }, [gl, camera, scene, raycaster, store]);
  return null;
}

export function Model3D() {
  const project = useEditor(s => s.project);
  const view = useEditor(s => s.view);
  const projectId = useEditor(s => s.projectId);
  const c = useColors();
  const model = useRef<THREE.Group>(null);

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

  const [x0, y0, x1, y1] = useMemo(() => {
    const xs = project.site.boundary.map(p => p[0]), ys = project.site.boundary.map(p => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }, [project.site.boundary]);
  const cx = ((x0 + x1) / 2) * M, cz = ((y0 + y1) / 2) * M, span = Math.max(x1 - x0, y1 - y0) * M;

  // The shown floors' extent, for framing the camera
  const shownIds = shown.map(l => l.id).join();
  const box = useMemo(() => {
    const ids = new Set(shownIds.split(','));
    const box = new THREE.Box3();
    for (const b of boxes) {
      if (!ids.has(b.level)) continue;
      const base = elev.get(b.level) ?? 0;
      const dx = (Math.cos(b.angle) * b.length) / 2, dz = (Math.sin(b.angle) * b.length) / 2;
      box.expandByPoint(new THREE.Vector3((b.center[0] - dx) * M, (base + b.z) * M, (b.center[1] - dz) * M));
      box.expandByPoint(new THREE.Vector3((b.center[0] + dx) * M, (base + b.z + b.height) * M, (b.center[1] + dz) * M));
    }
    for (const sp of project.spaces) {
      if (!ids.has(sp.level)) continue;
      for (const p of sp.shape) for (const [x, z] of p.outer) box.expandByPoint(new THREE.Vector3(x * M, (elev.get(sp.level) ?? 0) * M, z * M));
    }
    if (box.isEmpty()) box.set(new THREE.Vector3(x0 * M, 0, y0 * M), new THREE.Vector3(x1 * M, 3, y1 * M));
    return box;
  }, [boxes, project.spaces, shownIds, x0, y0, x1, y1]);
  const radius = Math.max(2, box.getSize(new THREE.Vector3()).length() / 2);

  return (
    <div className="relative size-full">
      <TintColors.Provider value={tints}>
        <Canvas
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: [cx + span * 0.9, span * 0.8, cz + span * 1.1], fov: FOV, near: 0.1, far: 2000 }}
          style={{ background: c.bg }}
          // react-three-fiber sizes the canvas with CSS only when it is an HTMLCanvasElement of the parent window, which a
          // canvas in our iframe is not. Without it the canvas shows at its drawing-buffer size, twice too large on 2x screens,
          // so the model sits off-center and clicks miss. Fill the wrapper instead.
          onCreated={({ gl }) => Object.assign(gl.domElement.style, { width: '100%', height: '100%' })}
        >
          {/* The ground fades into the background in the distance, so it has no visible edge */}
          <fog attach="fog" args={[c.bg, radius * 5, radius * 14]} />
          <hemisphereLight args={[c.sky, c.edge, 1.1]} />
          <directionalLight position={[cx - 20, 40, cz + 25]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, project.site.groundLevel * M - 0.01, cz]} receiveShadow>
            <planeGeometry args={[Math.max(span, radius) * 40, Math.max(span, radius) * 40]} />
            <meshStandardMaterial color={c.ground} roughness={1} />
          </mesh>

          <group ref={model}>
            {shown.map(l => (
              <group key={l.id}>
                {project.spaces.filter(s => s.level === l.id && s.kind !== 'void' && !s.slabOpening).map(s => (
                  <Slab key={s.id} s={s} y={s.kind === 'outdoor' && l.elevation === 0 ? project.site.groundLevel + 20 : l.elevation} thickness={s.kind === 'outdoor' ? 20 : 120}
                    color={c.slab} edge={c.edge} sel={sel.has(s.id) ? c.sel : undefined} />
                ))}
                {boxes.filter(b => b.level === l.id).map((b, i) => (
                  <BoxMesh key={`${b.id}-${i}`} b={b} base={elev.get(l.id) ?? 0} edge={c.edge}
                    color={b.kind === 'glass' ? c.glass : c.wall} sel={sel.has(b.id) ? c.sel : undefined} opacity={b.kind === 'glass' ? 0.2 : 1} />
                ))}
                {view.layers.furniture && project.furniture.filter(f => f.level === l.id).map(f => (
                  <Furniture key={f.id} f={f} base={elev.get(l.id) ?? 0} color={c.furn} sel={sel.has(f.id) ? c.sel : undefined} />
                ))}
              </group>
            ))}
          </group>
          <OrbitControls makeDefault enableDamping dampingFactor={0.09} maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={Math.max(1.5, radius * 0.15)} maxDistance={radius * 6} />
          <CameraRig box={box} levels={shownIds} projectId={projectId} command={command} model={model} />
          <SafariPinch />
          <Picker />
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
