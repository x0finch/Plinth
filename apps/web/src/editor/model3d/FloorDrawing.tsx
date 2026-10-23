/**
 * The plan printed on a floor in 3D, drawn by the plan's own code (PlanDrawing), so on entering 3D the flat house is exactly the
 * plan and grows out of it. Two layers: paper (site boundary, room fills; and with it a sheet of the plan's background around the
 * drawing) fades out as the house rises; ink (walls, furniture, doors, labels) stays, the wall footprints hidden under the walls
 * once they stand. Both are unlit, so their colors are the plan's. Line widths are the plan's screen widths at the scale the plan
 * is shown, converted to millimetres.
 */
import type { Project } from '@plinth/core';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { useCanvasDocument } from '@/canvas/CanvasFrame';
import { levelShapes, PLAN_PAD, type LevelShapes } from '../plan-geometry';
import { PlanDefs, PlanInk, PlanLabels, PlanPaper, scaledLine } from '../PlanDrawing';
import type { Quality } from './Renderer';

const M = 0.001;
/** Texture size along the longer side of the drawing */
const MAX_PX = { high: 4096, low: 2048 };

/** How opaque the paper is while the house grows (g: 0 flat, 1 built): gone once the walls are a third of the way up */
export const paperOpacity = (g: number) => 1 - THREE.MathUtils.smoothstep(g, 0, 0.3);

/** The plan's framing of a level: its drawing plus the margin, in millimetres */
export function planFrame(shapes: LevelShapes) {
  const [x0, y0, x1, y1] = shapes.bounds;
  return { x: x0 - PLAN_PAD, y: y0 - PLAN_PAD, w: x1 - x0 + 2 * PLAN_PAD, h: y1 - y0 + 2 * PLAN_PAD };
}

/** Render React SVG to markup, with theme variables replaced by their values (an SVG drawn as an image can't read them) */
function markup(el: React.ReactElement, doc: Document) {
  const html = renderToStaticMarkup(el);
  const cs = doc.defaultView!.getComputedStyle(doc.documentElement);
  return html.replace(/var\((--[\w-]+)\)/g, (_, v: string) => cs.getPropertyValue(v).trim().replace(/"/g, "'"));
}

async function rasterize(svg: string, width: number, height: number, doc: Document) {
  const img = new (doc.defaultView!.Image)();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const c = doc.createElement('canvas');
  c.width = width;
  c.height = height;
  c.getContext('2d')!.drawImage(img, 0, 0, width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The level's drawing, just above its floor (the parent places it at the level's elevation). Ignored by picking. */
export function FloorDrawing({ project, level, furniture, labels, quality, growth }: {
  project: Project; level: string; furniture: boolean; labels: boolean; quality: Quality; growth: React.RefObject<{ g: number }>;
}) {
  const doc = useCanvasDocument();
  const size = useThree(s => s.size);
  const shapes = useMemo(() => levelShapes(project, level), [project, level]);
  const frame = planFrame(shapes);
  // The plan's scale on screen (it fits the framing to the view), for line widths
  const mmPerPx = Math.max(frame.w / size.width, frame.h / size.height);
  const [textures, setTextures] = useState<{ paper: THREE.Texture; ink: THREE.Texture } | null>(null);

  useEffect(() => {
    const line = scaledLine(mmPerPx);
    const svg = (children: React.ReactNode, w: number, h: number) =>
      markup(<svg xmlns="http://www.w3.org/2000/svg" viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`} width={w} height={h}>{children}</svg>, doc);
    const k = MAX_PX[quality] / Math.max(frame.w, frame.h);
    const w = Math.round(frame.w * k), h = Math.round(frame.h * k);
    let live = true;
    let made: { paper: THREE.Texture; ink: THREE.Texture } | null = null;
    void Promise.all([
      rasterize(svg(<><PlanDefs /><PlanPaper project={project} level={level} shapes={shapes} /></>, w, h), w, h, doc),
      rasterize(svg(<><PlanDefs /><PlanInk shapes={shapes} furniture={furniture} line={line} />{labels && <PlanLabels shapes={shapes} />}</>, w, h), w, h, doc),
    ]).then(([paper, ink]) => {
      made = { paper, ink };
      if (live) setTextures(made);
      else (paper.dispose(), ink.dispose());
    });
    return () => {
      live = false;
      made?.paper.dispose();
      made?.ink.dispose();
    };
  }, [shapes, furniture, labels, quality, mmPerPx, doc]);

  const paper = useRef<THREE.MeshBasicMaterial>(null);
  const paperMesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const f = paperOpacity(growth.current.g);
    if (paper.current) paper.current.opacity = f;
    if (paperMesh.current) paperMesh.current.visible = f > 0;
  });

  if (!textures) return null;
  const center: [number, number] = [(frame.x + frame.w / 2) * M, (frame.y + frame.h / 2) * M];
  return (
    <group>
      <mesh ref={paperMesh} position={[center[0], 0.005, center[1]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={2}>
        <planeGeometry args={[frame.w * M, frame.h * M]} />
        <meshBasicMaterial ref={paper} map={textures.paper} transparent depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <mesh position={[center[0], 0.006, center[1]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={3}>
        <planeGeometry args={[frame.w * M, frame.h * M]} />
        <meshBasicMaterial map={textures.ink} transparent depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}

/**
 * The plan's background around the drawing, as far as the view reaches: with the paper it makes the flat house look exactly like
 * the plan (white page, no backdrop or plinth), and fades out with it.
 */
export function PlanSheet({ center, size, color, growth }: { center: [number, number]; size: number; color: string; growth: React.RefObject<{ g: number }> }) {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const f = paperOpacity(growth.current.g);
    if (material.current) material.current.opacity = f;
    if (mesh.current) mesh.current.visible = f > 0;
  });
  return (
    <mesh ref={mesh} position={[center[0], 0.004, center[1]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial ref={material} color={color} transparent depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  );
}
