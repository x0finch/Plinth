/**
 * The plan's linework printed on a floor in 3D: wall footprints, furniture outlines, door leaves and swings, room names and areas.
 * Rooms read at a glance, and on entering 3D the flat floor looks just like the plan it grows from (the wall footprints are hidden
 * under the walls once they stand). Drawn from the same shapes as the plan, as an SVG rasterized into a texture.
 */
import type { Project } from '@plinth/core';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useCanvasDocument } from '@/canvas/CanvasFrame';
import { levelShapes } from '../plan-geometry';
import type { Quality } from './Renderer';

const M = 0.001;
/** Texture size along the longer side of the level */
const MAX_PX = { high: 4096, low: 2048 };

const esc = (s: string) => s.replace(/[&<>"]/g, ch => `&#${ch.charCodeAt(0)};`);
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** SVG of one level's linework, in millimetres; colors are concrete (an SVG drawn as an image can't read theme variables) */
function linework(project: Project, level: string, ink: string, faint: string) {
  const s = levelShapes(project, level);
  const [x0, y0, x1, y1] = s.bounds;
  const font = Math.max(220, Math.min(420, (x1 - x0) / 45));
  const body = [
    `<path d="${s.light}" fill="${faint}" fill-opacity="0.5"/>`, `<path d="${s.solid}" fill="${faint}"/>`, `<path d="${s.bearing}" fill="${ink}"/>`,
    ...s.furniture.map(({ d }) => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="12"/>`),
    ...s.openings.flatMap(o => [
      ...o.lines.map(l => `<polyline points="${pts(l)}" fill="none" stroke="${ink}" stroke-width="15"${o.dashed ? ' stroke-dasharray="60 40"' : ''}/>`),
      ...o.arcs.map(a => `<path d="${a}" fill="none" stroke="${faint}" stroke-width="10" stroke-dasharray="40 30"/>`),
    ]),
    ...s.spaces.map(({ s: sp, label, area }) => `<g text-anchor="middle" font-family="sans-serif">
      <text x="${label[0]}" y="${label[1]}" font-size="${font}" fill="${ink}">${esc(sp.name)}</text>
      ${sp.kind === 'void' ? '' : `<text x="${label[0]}" y="${label[1] + font * 1.15}" font-size="${font * 0.75}" fill="${faint}">${area.toFixed(1)} m²</text>`}
    </g>`),
  ];
  return { bounds: s.bounds, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}">${body.join('')}</svg>` };
}

/** A transparent plane just above the floor (placed at the level's elevation by the parent) carrying its linework. Ignored by picking. */
export function FloorDrawing({ project, level, ink, faint, quality }: {
  project: Project; level: string; ink: string; faint: string; quality: Quality;
}) {
  const doc = useCanvasDocument();
  const drawing = useMemo(() => linework(project, level, ink, faint), [project, level, ink, faint]);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const [x0, y0, x1, y1] = drawing.bounds;
    const k = MAX_PX[quality] / Math.max(x1 - x0, y1 - y0, 1);
    const img = new (doc.defaultView!.Image)();
    let tex: THREE.CanvasTexture | null = null;
    let live = true;
    img.onload = () => {
      if (!live) return;
      const c = doc.createElement('canvas');
      c.width = Math.max(1, Math.round((x1 - x0) * k));
      c.height = Math.max(1, Math.round((y1 - y0) * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      setTexture(tex);
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawing.svg)}`;
    return () => {
      live = false;
      tex?.dispose();
    };
  }, [drawing, quality, doc]);

  if (!texture) return null;
  const [x0, y0, x1, y1] = drawing.bounds;
  return (
    <mesh position={[((x0 + x1) / 2) * M, 0.004, ((y0 + y1) / 2) * M]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={1}>
      <planeGeometry args={[(x1 - x0) * M, (y1 - y0) * M]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}
