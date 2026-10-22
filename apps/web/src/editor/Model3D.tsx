/**
 * 三维白模：墙体按核心包切好的实体段画成盒子，空间画成楼板，家具画成简单体块。
 * 显示当前楼层及以下；点选对象与平面图同步。单位：数据是毫米，场景是米。
 */
import { Bounds, Edges, OrbitControls, useBounds } from '@react-three/drei';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { projectBoxes, type Box, type Project, type Space } from '@plinth/core';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useCanvasDocument } from '@/canvas/CanvasFrame';
import { useThemeColors } from '@/lib/theme';
import { useEditor } from './store';

const M = 0.001;
const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** 三维白模的颜色全部取自主题 */
const useColors = () =>
  useThemeColors({
    bg: '--muted', wall: '--card', slab: '--secondary', ground: '--accent', furn: '--chart-3',
    glass: '--muted-foreground', edge: '--muted-foreground', hl: '--chart-2', sky: '--background',
  }, useCanvasDocument());

/** 选中或刚改过的对象保持原色，只描边并带一点主题强调色，白模不会整片变色 */
const HL_MIX = 0.15;
const tint = (color: string, hl?: string) => (hl ? `#${new THREE.Color(color).lerp(new THREE.Color(hl), HL_MIX).getHexString()}` : color);

function BoxMesh({ b, base, color, edge, hl, opacity = 1, onPick }: { b: Box; base: number; color: string; edge: string; hl?: string; opacity?: number; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <mesh
      geometry={unitBox}
      position={[b.center[0] * M, (base + b.z + b.height / 2) * M, b.center[1] * M]}
      rotation={[0, -b.angle, 0]}
      scale={[b.length * M, b.height * M, b.thickness * M]}
      castShadow={opacity === 1}
      receiveShadow
      onClick={onPick}
      userData={{ id: b.id }}
    >
      <meshStandardMaterial color={tint(color, hl)} roughness={0.9} transparent={opacity < 1} opacity={opacity} />
      {opacity === 1 && <Edges color={hl ?? edge} threshold={20} lineWidth={hl ? 2 : 1} />}
    </mesh>
  );
}

function Slab({ s, y, thickness, color, edge, hl, onPick }: { s: Space; y: number; thickness: number; color: string; edge: string; hl?: string; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
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
    <mesh geometry={geo} position={[0, (y - thickness) * M, 0]} receiveShadow onClick={onPick} userData={{ id: s.id }}>
      <meshStandardMaterial color={tint(color, hl)} roughness={1} />
      <Edges color={hl ?? edge} threshold={20} lineWidth={hl ? 2 : 1} />
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
  const on = new Set([...view.selection, ...view.highlight]);
  const ownerOf = (id: string) => project.walls.find(w => w.openings.some(o => o.id === id))?.id;
  const hlWalls = new Set([...on].map(id => ownerOf(id) ?? id));

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
                  color={c.slab} hl={on.has(s.id) ? c.hl : undefined} edge={c.edge} onPick={pick(s.id)} />
              ))}
              {boxes.filter(b => b.level === l.id).map((b, i) => (
                <BoxMesh key={`${b.id}-${i}`} b={b} base={elev.get(l.id) ?? 0} edge={c.edge} onPick={pick(b.id)}
                  color={b.kind === 'glass' ? c.glass : c.wall} hl={hlWalls.has(b.id) ? c.hl : undefined} opacity={b.kind === 'glass' ? 0.2 : 1} />
              ))}
              {view.layers.furniture && project.furniture.filter(f => f.level === l.id).map(f => (
                <mesh key={f.id} geometry={unitBox} castShadow onClick={pick(f.id)} userData={{ id: f.id }}
                  position={[f.position[0] * M, ((elev.get(l.id) ?? 0) + (f.elevation ?? 0) + f.size.h / 2) * M, f.position[1] * M]}
                  rotation={[0, (-f.rotation * Math.PI) / 180, 0]} scale={[f.size.w * M, f.size.h * M, f.size.d * M]}>
                  <meshStandardMaterial color={tint(c.furn, on.has(f.id) ? c.hl : undefined)} roughness={0.95} />
                  {on.has(f.id) && <Edges color={c.hl} threshold={20} lineWidth={2} />}
                </mesh>
              ))}
            </group>
          ))}
        </group>
      </Bounds>
      <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2 - 0.05} />
      <Capture />
    </Canvas>
  );
}
