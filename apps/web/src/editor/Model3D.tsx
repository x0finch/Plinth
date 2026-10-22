/**
 * 3D massing model: walls drawn as boxes from the solid segments cut by the core package, spaces as slabs, furniture as simple blocks.
 * Shows the current floor and below; picking is synced with the plan. Units: data in millimetres, scene in metres.
 */
import { Bounds, Edges, OrbitControls, useBounds } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { projectBoxes, type Box, type Project, type Space } from '@plinth/core';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useCanvasDocument } from '@/canvas/CanvasFrame';
import { hops, REVEAL } from '@/canvas/hop';
import { useReducedMotion } from '@/canvas/HopDriver';
import { useThemeColors } from '@/lib/theme';
import { useEditor } from './store';

const M = 0.001;
const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** All 3D model colors come from the theme */
const useColors = () =>
  useThemeColors({
    bg: '--muted', wall: '--card', slab: '--secondary', ground: '--accent', furn: '--chart-3',
    glass: '--muted-foreground', edge: '--muted-foreground', sel: '--foreground', sky: '--background',
  }, useCanvasDocument());

/**
 * Selection and changes don't change color; objects hop up and land back (see canvas/hop.ts).
 * restY records the rest position; objects are put back before screenshots.
 */
function useHop<T extends THREE.Object3D>(id: string) {
  const ref = useRef<T>(null);
  useFrame(({ camera, size }) => {
    const o = ref.current;
    if (!o) return;
    const px = hops.lift(id, performance.now());
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

/** With reduced motion, the selected object gets a thin foreground-color outline */
type Outline = { edge: string; sel?: string };
const edgeProps = ({ edge, sel }: Outline) => ({ color: sel ?? edge, lineWidth: sel ? 2 : 1 });

function BoxMesh({ b, base, color, opacity = 1, onPick, ...o }: Outline & { b: Box; base: number; color: string; opacity?: number; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const y = (base + b.z + b.height / 2) * M;
  const ref = useHop<THREE.Mesh>(b.id);
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
  const ref = useHop<THREE.Mesh>(s.id);
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
  const ref = useHop<THREE.Mesh>(f.id);
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
      // Capture still frames only: put hopping objects back at rest first
      scene.traverse(o => {
        if (typeof o.userData.restY === 'number') o.position.y = o.userData.restY;
      });
      gl.render(scene, camera);
      const c = gl.domElement;
      return { dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height };
    });
    return () => setCapture(null);
  }, [gl, scene, camera]);
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
  const reduced = useReducedMotion();
  const ownerOf = (id: string) => project.walls.find(w => w.openings.some(o => o.id === id))?.id;
  const sel = new Set(reduced ? view.selection.map(id => ownerOf(id) ?? id) : []);

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
      <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2 - 0.05} />
      <Reveal ownerOf={ownerOf} />
      <Capture />
    </Canvas>
  );
}
