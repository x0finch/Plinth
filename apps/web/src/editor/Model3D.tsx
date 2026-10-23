/**
 * 3D massing model, drawn as a white model: walls as boxes from the solid segments cut by the core package, spaces as slabs,
 * furniture as simple blocks, each floor carrying its plan linework. Light and soft shadows give the form, no outlines.
 * Shows the whole house, or with the cutaway layer the current floor and below; picking is synced with the plan.
 * Units: data in millimetres, scene in metres.
 */
import { Edges, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { findObject, projectBoxes, type Box, type Project, type Space } from '@plinth/core';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { m } from '@/lib/i18n';
import { useCanvasDocument } from '@/canvas/CanvasFrame';
import { hops, REVEAL } from '@/canvas/hop';
import { useThemeColors } from '@/lib/theme';
import { FloorDrawing, PlanSheet } from './model3d/FloorDrawing';
import { detectQuality, isTouchDevice, Renderer, type Quality } from './model3d/Renderer';
import { planFrame, plinthRect } from './plan-geometry';
import { useEditor, useEditorStore } from './store';

const M = 0.001;
/** Height of the white plinth the site stands on, in metres */
const PLINTH = 0.3;
const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** All 3D model colors come from the theme */
const useColors = () =>
  useThemeColors({
    backdrop: '--canvas-backdrop', sun: '--canvas-sun', skylight: '--canvas-skylight', wall: '--card', furn: '--muted',
    page: '--canvas-backdrop', shadow: '--canvas-shadow', sel: '--chart-2', changed: '--chart-1',
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
  useFrame(({ camera, size, invalidate }) => {
    const o = ref.current;
    if (!o) return;
    const now = performance.now();
    const mat = o.material as THREE.MeshStandardMaterial;
    o.userData.baseColor = base;
    mat.color.copy(base);
    if (selected) mat.color.lerp(tints.sel, SELECTED_TINT);
    else {
      const k = hops.changeTint(id, now);
      if (k > 0) {
        mat.color.lerp(tints.changed, CHANGED_TINT * k);
        invalidate();
      }
    }
    const px = hops.lift(id, now);
    o.position.y = o.userData.restY;
    if (!px) return;
    invalidate();
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
  const { camera, scene, controls, invalidate } = useThree();
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
    invalidate();
  }, [selection]);

  /** Whether the first solid hit from the camera to this point is the target itself (see-through surfaces do not occlude) */
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

  useFrame(({ invalidate }) => {
    const a = anim.current;
    if (!a) return;
    invalidate();
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

/** No outlines on the model, except the selected object's edges in the selection color */
type Outline = { sel?: string };

function BoxMesh({ b, base, color, ...o }: Outline & { b: Box; base: number; color: string }) {
  const y = (base + b.z + b.height / 2) * M;
  const ref = useFeedback<THREE.Mesh>(b.id, color, !!o.sel);
  return (
    <mesh
      ref={ref}
      geometry={unitBox}
      position={[b.center[0] * M, y, b.center[1] * M]}
      rotation={[0, -b.angle, 0]}
      scale={[b.length * M, b.height * M, b.thickness * M]}
      castShadow
      receiveShadow
      userData={{ id: b.id, restY: y }}
    >
      <meshStandardMaterial color={color} roughness={0.9} />
      {o.sel && <Edges threshold={20} color={o.sel} lineWidth={2} />}
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
      {o.sel && <Edges threshold={20} color={o.sel} lineWidth={2} />}
    </mesh>
  );
}

function Furniture({ f, base, color, ...o }: Outline & { f: Project['furniture'][number]; base: number; color: string }) {
  const y = (base + (f.elevation ?? 0) + f.size.h / 2) * M;
  const ref = useFeedback<THREE.Mesh>(f.id, color, !!o.sel);
  return (
    <mesh ref={ref} geometry={unitBox} castShadow userData={{ id: f.id, restY: y }}
      position={[f.position[0] * M, y, f.position[1] * M]}
      rotation={[0, (-f.rotation * Math.PI) / 180, 0]} scale={[f.size.w * M, f.size.h * M, f.size.d * M]}>
      <meshStandardMaterial color={color} roughness={0.95} />
      {o.sel && <Edges threshold={20} color={o.sel} lineWidth={2} />}
    </mesh>
  );
}

function Capture({ draw }: { draw: React.RefObject<(() => void) | null> }) {
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
      if (draw.current) draw.current();
      else gl.render(scene, camera);
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


/**
 * How far each floor has grown at overall progress g (0: flat like the plan, 1: built). The current floor and the ones below rise
 * together first; the floors above follow one after another, each from the top of the one below.
 */
function floorGrowth(levels: { id: string; elevation: number }[], current: string, g: number) {
  const top = levels.find(l => l.id === current)?.elevation ?? Infinity;
  const n = levels.filter(l => l.elevation > top).length;
  // The upper floors share the last stretch, staggered so the top one finishes exactly at the end
  const each = 0.3, step = n > 1 ? (0.45 - each) / (n - 1) : 0;
  let above = 0;
  return levels.map(l => {
    if (l.elevation <= top) return { id: l.id, k: ease(Math.min(1, g / 0.7)), below: true };
    const start = 0.55 + step * above++;
    return { id: l.id, k: ease(THREE.MathUtils.clamp((g - start) / each, 0, 1)), below: false };
  });
}

/**
 * The camera always orbits the middle of the model, so rotating and zooming keep it centered (zoom goes toward that point).
 * Entering 3D starts exactly where the plan was (same framing, straight down, the floor drawing showing the plan) and grows the
 * house out of it while the camera tilts; leaving runs the same in reverse before the plan comes back. Showing other floors
 * (the cutaway) and "fit all" frame the model again from the current direction.
 */
function CameraRig({ box, levels, current, growing, drawings, growth, projectId }: {
  box: THREE.Box3; levels: { id: string; elevation: number }[]; current: string;
  growing: React.RefObject<Map<string, THREE.Group>>; drawings: React.RefObject<Map<string, THREE.Group>>;
  growth: React.RefObject<{ g: number }>; projectId: string;
}) {
  const { camera, controls, size, invalidate } = useThree();
  const project = useEditor(s => s.project);
  const setLeave3D = useEditor(s => s.setLeave3D);
  const setPlanUntil3D = useEditor(s => s.setPlanUntil3D);
  const orbit = controls as unknown as Orbit | null;
  const anim = useRef<{ elapsed: number; frames: number; ms: number; from: Pose; to: Pose; grow?: [number, number]; done?: () => void; hold?: number } | null>(null);
  const leaving = useRef(false);
  const levelKey = levels.map(l => l.id).join();
  const shownLevels = useRef(levelKey);

  const run = (to: Pose, ms: number, grow?: [number, number], done?: () => void) => {
    if (!orbit) return;
    anim.current = { elapsed: 0, frames: 0, ms: hops.reduced ? 0 : ms, from: { pos: camera.position.clone(), target: orbit.target.clone() }, to, grow, done };
    // The view renders on demand: ask for the first frame, the animation keeps asking until it ends
    invalidate();
  };
  const direction = () => (orbit ? camera.position.clone().sub(orbit.target).normalize() : BIRD);
  const grow = (g: number) => {
    growth.current.g = g;
    for (const { id, k, below } of floorGrowth(levels, current, g)) {
      const group = growing.current.get(id), drawing = drawings.current.get(id);
      if (group) {
        group.scale.y = Math.max(k, 0.001);
        group.visible = below || k > 0;
      }
      if (drawing) drawing.visible = below || k > 0;
    }
  };

  /** Straight down at the current floor, framed like the plan (which fits the floor's drawing plus a margin to the view) */
  const planPose = (): Pose => {
    const { x, y, w, h } = planFrame(project, current);
    const visibleH = (w / h > size.width / size.height ? (w * size.height) / size.width : h) * M;
    // The drawing lies just above the floor
    const floor = (levels.find(l => l.id === current)?.elevation ?? 0) * M + 0.006;
    const dist = visibleH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const target = new THREE.Vector3((x + w / 2) * M, floor, (y + h / 2) * M);
    // A hair off vertical, toward the south, so north stays up
    return { target, pos: target.clone().add(new THREE.Vector3(0, dist, dist * 1e-4)) };
  };

  // Entering 3D: from the plan's framing to the last 3D view (or the default one), growing the house
  useEffect(() => {
    if (!orbit) return;
    const to = lastPose.get(projectId) ?? framed(box, size.width / size.height, BIRD);
    const from = planPose();
    camera.position.copy(from.pos);
    orbit.target.copy(from.target);
    orbit.update();
    grow(hops.reduced ? 1 : 0);
    run(to, 1600, [0, 1]);
    // Start once the floor drawings are on (they rasterize asynchronously), so the first frame looks like the plan
    if (anim.current) anim.current.hold = performance.now();
    // Leaving 3D: remember the view, then sink the house back into the plan and settle on the plan's framing
    setLeave3D(() => new Promise<void>(resolve => {
      leaving.current = true;
      lastPose.set(projectId, anim.current?.to ?? { pos: camera.position.clone(), target: orbit.target.clone() });
      run(planPose(), 1100, [1, 0], resolve);
    }));
    return () => {
      setLeave3D(null);
      setPlanUntil3D(false);
      // Leaving mid-animation remembers where the camera was heading
      if (!leaving.current) lastPose.set(projectId, anim.current?.to ?? { pos: camera.position.clone(), target: orbit.target.clone() });
    };
  }, [orbit]);

  // Other floors shown (the cutaway): frame them again from the same direction (edits don't move the camera)
  useEffect(() => {
    if (shownLevels.current === levelKey) return;
    shownLevels.current = levelKey;
    grow(1);
    if (orbit) run(framed(box, size.width / size.height, direction()), 600);
  }, [levelKey]);

  // "Fit all": frame the model again from the current direction (from straight above, back to the default angle)
  const fitRequest = useEditor(s => s.fitRequest);
  useEffect(() => {
    if (!fitRequest || !orbit) return;
    const dir = direction();
    run(framed(box, size.width / size.height, dir.y > 0.99 ? BIRD : dir), 600);
  }, [fitRequest]);

  useFrame(({ invalidate }, dt) => {
    const a = anim.current;
    if (!a || !orbit) return;
    invalidate();
    if (a.hold) {
      const ready = floorGrowth(levels, current, 0).every(l => !l.below || (drawings.current.get(l.id)?.children.length ?? 0) > 0);
      if (!ready && performance.now() - a.hold < 1500) return;
      a.hold = undefined;
      // This frame is the plan itself: the plan kept on screen while 3D got ready can go
      setPlanUntil3D(false);
    }
    // The clock starts after two frames (the first frame in 3D can take a second, compiling shaders) so the animation plays from
    // its start; after that it follows real time, a slow frame advancing at most 200 ms, so slow devices still finish on time
    if (++a.frames > 2) a.elapsed += Math.min(dt * 1000, 200);
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
    if (a.grow) grow(THREE.MathUtils.lerp(a.grow[0], a.grow[1], t));
    orbit.enabled = t === 1 && !leaving.current;
    orbit.update();
    if (t === 1) {
      anim.current = null;
      a.done?.();
    }
  });
  return null;
}

/**
 * The view renders on demand (nothing changes, nothing is drawn). Selection and highlights can change without any prop on the
 * scene changing (the agent pointing at an object starts its hop and tint), so wake the scene when they do.
 */
function Wake({ on }: { on: unknown[] }) {
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => invalidate(), on);
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
  const doc = useCanvasDocument();
  // Decided once the WebGL context exists (the GPU model is part of it); a touch device that can't keep up drops to 'low'
  const [quality, setQuality] = useState<Quality | null>(null);
  const touch = useMemo(() => isTouchDevice(doc.defaultView!), [doc]);
  const q: Quality = quality ?? 'high';
  const draw = useRef<(() => void) | null>(null);

  const current = project.levels.find(l => l.id === view.level);
  // The whole house by default; the cutaway shows the current level and below, to look into it
  const shown = project.levels.filter(l => !view.layers.cutaway || !current || l.elevation <= current.elevation);
  const elev = new Map(project.levels.map(l => [l.id, l.elevation]));
  const boxes = useMemo(() => projectBoxes(project), [project]);
  const ownerOf = (id: string) => findObject(project, id, 'opening')?.wall?.id;
  // A door or window is part of its wall in 3D, so selecting it marks the wall
  const sel = new Set(view.selection.map(id => ownerOf(id) ?? id));
  const tints = useMemo(() => ({ sel: new THREE.Color(c.sel), changed: new THREE.Color(c.changed) }), [c.sel, c.changed]);

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

  // The plinth: a white board a little larger than the site, like a model's base (the same board as on the plan)
  const plinth = useMemo(() => {
    const [x0, y0, x1, y1] = plinthRect(project);
    return { size: [(x1 - x0) * M, PLINTH, (y1 - y0) * M] as [number, number, number], center: [((x0 + x1) / 2) * M, ((y0 + y1) / 2) * M] };
  }, [project.site.boundary]);
  const ground = project.site.groundLevel * M;
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const center = box.getCenter(new THREE.Vector3());
  const levels = [...shown].sort((a, b) => a.elevation - b.elevation);
  const growing = useRef(new Map<string, THREE.Group>());
  const drawings = useRef(new Map<string, THREE.Group>());
  // How far the house has grown out of the plan (0 flat, 1 built); the plan's paper fades with it
  const growth = useRef({ g: 1 });
  const sheet = useMemo(() => {
    const { x, y, w, h } = planFrame(project, current?.id ?? levels[0]?.id ?? '');
    return { center: [(x + w / 2) * M, (y + h / 2) * M] as [number, number] };
  }, [project, current?.id]);

  return (
    <div className="relative size-full">
      <TintColors.Provider value={tints}>
        <Canvas
          shadows="percentage"
          frameloop="demand"
          // Occlusion is costly per pixel: cap the resolution where it runs
          dpr={q === 'high' ? [1, 1.5] : [1, 2]}
          // No tone mapping: white surfaces stay white instead of the filmic gray
          flat
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: [cx + span * 0.9, span * 0.8, cz + span * 1.1], fov: FOV, near: 0.1, far: 2000 }}
          // White like the plan's page until the first frame: switching from the plan shows no gray flash
          style={{ background: c.page }}
          // react-three-fiber sizes the canvas with CSS only when it is an HTMLCanvasElement of the parent window, which a
          // canvas in our iframe is not. Without it the canvas shows at its drawing-buffer size, twice too large on 2x screens,
          // so the model sits off-center and clicks miss. Fill the wrapper instead.
          onCreated={({ gl, scene }) => {
            Object.assign(gl.domElement.style, { width: '100%', height: '100%' });
            scene.background = new THREE.Color(c.backdrop);
            setQuality(detectQuality(doc.defaultView!, gl.getContext()));
          }}
        >
          {/* The ground fades into the backdrop in the distance, so it has no visible edge */}
          <fog attach="fog" args={[c.backdrop, radius * 4, radius * 12]} />
          {/* A warm sun and a cool sky: lit faces are white, shadows a soft lavender (three.js divides diffuse light by π,
              hence the strong intensities) */}
          <hemisphereLight args={[c.skylight, c.wall, 2.2]} />
          <primitive object={sunTarget} position={center} />
          {/* Remounted when the quality changes: a shadow map keeps its size once created */}
          <directionalLight key={q} color={c.sun} intensity={3.6} target={sunTarget} castShadow
            position={[center.x - radius * 1.2, center.y + radius * 2, center.z + radius * 0.9]}
            shadow-mapSize={q === 'high' ? [2048, 2048] : [1024, 1024]} shadow-radius={q === 'high' ? 6 : 3} shadow-bias={-0.0004} shadow-normalBias={0.02}
            shadow-camera-left={-radius * 1.4} shadow-camera-right={radius * 1.4} shadow-camera-top={radius * 1.4} shadow-camera-bottom={-radius * 1.4}
            shadow-camera-near={0.5} shadow-camera-far={radius * 6} />
          {/* The ground only catches shadows: lit, it would read as a lighter board under the plinth; this way the backdrop shows */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, ground - PLINTH - 0.001, cz]} receiveShadow>
            <planeGeometry args={[Math.max(span, radius) * 40, Math.max(span, radius) * 40]} />
            <shadowMaterial color={c.shadow} opacity={0.35} transparent fog={false} />
          </mesh>
          <mesh position={[plinth.center[0], ground - PLINTH / 2 - 0.002, plinth.center[1]]} receiveShadow castShadow>
            <boxGeometry args={plinth.size} />
            <meshStandardMaterial color={c.wall} roughness={1} />
          </mesh>

          {/* The plan's page around the drawing at the current floor, while the house lies flat */}
          <group position={[0, (current?.elevation ?? 0) * M, 0]}>
            <PlanSheet center={sheet.center} size={Math.max(span, radius) * 40} color={c.page} growth={growth} />
          </group>
          <group>
            {levels.map(l => (
              // Each floor grows from its own base when entering 3D (see CameraRig)
              <group key={l.id} position={[0, l.elevation * M, 0]}>
                <group ref={g => void (g ? growing.current.set(l.id, g) : growing.current.delete(l.id))}>
                  <group position={[0, -l.elevation * M, 0]}>
                    {project.spaces.filter(s => s.level === l.id && s.kind !== 'void' && !s.slabOpening).map(s => (
                      <Slab key={s.id} s={s} y={s.kind === 'outdoor' && l.elevation === 0 ? project.site.groundLevel + 20 : l.elevation} thickness={s.kind === 'outdoor' ? 20 : 120}
                        color={c.wall} sel={sel.has(s.id) ? c.sel : undefined} />
                    ))}
                    {boxes.filter(b => b.level === l.id).map((b, i) => (
                      // Openings are left open; a glass-block infill is part of the white model like the walls
                      <BoxMesh key={`${b.id}-${i}`} b={b} base={elev.get(l.id) ?? 0} sel={sel.has(b.id) ? c.sel : undefined} color={c.wall} />
                    ))}
                    {view.layers.furniture && project.furniture.filter(f => f.level === l.id).map(f => (
                      <Furniture key={f.id} f={f} base={elev.get(l.id) ?? 0} color={c.furn} sel={sel.has(f.id) ? c.sel : undefined} />
                    ))}
                  </group>
                </group>
                {/* Outside the growing group, so the drawing stays just above the floor while the floor is flat; shown with its floor */}
                <group ref={g => void (g ? drawings.current.set(l.id, g) : drawings.current.delete(l.id))}>
                  <FloorDrawing project={project} level={l.id} current={l.id === current?.id} furniture={view.layers.furniture} labels={view.layers.labels} quality={q} growth={growth} />
                </group>
              </group>
            ))}
          </group>
          <OrbitControls makeDefault enableDamping dampingFactor={0.09} maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={Math.max(1.5, radius * 0.15)} maxDistance={radius * 6} />
          <CameraRig box={box} levels={levels} current={current?.id ?? ''} growing={growing} drawings={drawings} growth={growth} projectId={projectId} />
          <SafariPinch />
          <Picker />
          <Reveal ownerOf={ownerOf} />
          <Renderer quality={q} draw={draw} />
          {/* A phone that wasn't recognized as low-end but can't keep up drops to the light setup, for good */}
          {touch && q === 'high' && <PerformanceMonitor bounds={() => [25, 50]} onDecline={() => setQuality('low')} />}
          <Wake on={[view.selection, view.highlight]} />
          <Capture draw={draw} />
        </Canvas>
      </TintColors.Provider>
      <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted-foreground max-md:hidden">{m.model3d_hint()}</p>
    </div>
  );
}
