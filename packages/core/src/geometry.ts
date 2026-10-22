import pc from 'polygon-clipping';
import type { Point, Polygon, Ring, Wall } from './schema.js';

type PcPolygon = [number, number][][];

export const toPc = (p: Polygon): PcPolygon => [p.outer, ...(p.holes ?? [])].map(r => r.map(([x, y]) => [x, y] as [number, number]));

export function fromPc(mp: PcPolygon[]): Polygon[] {
  // polygon-clipping repeats the first point at the end of each ring; drop the last point
  const ring = (r: [number, number][]): Ring => r.slice(0, -1).map(([x, y]) => [x, y] as Point);
  return mp.map(([outer, ...holes]) => (holes.length ? { outer: ring(outer), holes: holes.map(ring) } : { outer: ring(outer) }));
}

export function rect(x0: number, y0: number, x1: number, y1: number): Polygon {
  return { outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] };
}

export function union(polys: Polygon[]): Polygon[] {
  if (!polys.length) return [];
  const [a, ...rest] = polys.map(toPc);
  return fromPc(pc.union(a, ...rest));
}

export function difference(a: Polygon[], b: Polygon[]): Polygon[] {
  if (!a.length) return [];
  if (!b.length) return union(a);
  return fromPc(pc.difference(a.map(toPc), ...b.map(toPc)));
}

const ringArea = (r: Ring) => {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
};

/** Area in square millimetres */
export const area = (polys: Polygon[]) =>
  polys.reduce((s, p) => s + ringArea(p.outer) - (p.holes ?? []).reduce((h, r) => h + ringArea(r), 0), 0);

/**
 * The plan footprint a wall actually occupies. Bearing walls and partitions are extended by half their thickness at each end so corners at junctions are filled;
 * fences, parapets and railings are not extended.
 */
export function wallBody(w: Wall): Polygon {
  const [x1, y1] = w.start, [x2, y2] = w.end;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const dx = (x2 - x1) / len, dy = (y2 - y1) / len;
  const h = w.thickness / 2, e = w.kind === 'bearing' || w.kind === 'partition' ? h : 0;
  const nx = -dy * h, ny = dx * h;
  const a: Point = [x1 - dx * e, y1 - dy * e], b: Point = [x2 + dx * e, y2 + dy * e];
  return { outer: [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]] };
}

export function bbox(polys: Polygon[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p.outer) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

export function pointInPolygon([x, y]: Point, p: Polygon): boolean {
  const inRing = (r: Ring) => {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  return inRing(p.outer) && !(p.holes ?? []).some(inRing);
}
