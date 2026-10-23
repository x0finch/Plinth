/** Shapes the plan draws: derived from project data, cached per floor. */
import {
  add, difference, furnitureFootprint, netArea, ringArea, scale, union, wallBody, wallDir, wallNormal, pointAt,
  type Furniture, type Opening, type Point, type Polygon, type Project, type Space, type Wall,
} from '@plinth/core';
import polylabel from 'polylabel';

export interface OpeningShape {
  id: string;
  wallId: string;
  kind: Opening['kind'];
  glassBlock: boolean;
  /** Opening outline (hit area) */
  outline: Point[];
  /** Lines (door leaves, window lines) */
  lines: Point[][];
  /** Door swing arc SVG path */
  arcs: string[];
  dashed: boolean;
}

export interface LevelShapes {
  bounds: [number, number, number, number];
  spaces: { s: Space; d: string; label: Point; area: number }[];
  /** Merged solids of load-bearing walls and partitions (openings cut out) */
  solid: string;
  bearing: string;
  light: string;
  railings: { w: Wall; d: string }[];
  walls: { w: Wall; d: string }[];
  openings: OpeningShape[];
  furniture: { f: Furniture; d: string }[];
}

export const polyPath = (polys: Polygon[]) =>
  polys.map(p => [p.outer, ...(p.holes ?? [])].map(r => `M${r.map(([x, y]) => `${x},${y}`).join('L')}Z`).join('')).join('');

function rectAlong(w: Wall, a: number, b: number, half: number): Point[] {
  const n = wallNormal(w);
  const p1 = pointAt(w, a), p2 = pointAt(w, b);
  return [add(p1, scale(n, half)), add(p2, scale(n, half)), add(p2, scale(n, -half)), add(p1, scale(n, -half))];
}

function openingShape(w: Wall, o: Opening): OpeningShape {
  const half = w.thickness / 2, a = o.at - o.width / 2, b = o.at + o.width / 2;
  const d = wallDir(w), n = wallNormal(w);
  const lines: Point[][] = [], arcs: string[] = [];
  const at = (t: number, off: number) => add(pointAt(w, t), scale(n, off));
  if (o.kind === 'window') {
    for (const off of [-half, 0, half]) lines.push([at(a, off), at(b, off)]);
    lines.push([at(a, -half), at(a, half)], [at(b, -half), at(b, half)]);
  } else if (o.kind === 'sliding-door') {
    const m = (a + b) / 2;
    lines.push([at(a, -half / 3), at(m + 50, -half / 3)], [at(m - 50, half / 3), at(b, half / 3)]);
    lines.push([at(a, -half), at(a, half)], [at(b, -half), at(b, half)]);
  } else if (o.kind === 'door' || o.kind === 'gate') {
    const leaves: { hinge: number; dir: 1 | -1; len: number }[] =
      o.kind === 'gate'
        ? [{ hinge: a, dir: 1, len: o.width / 2 }, { hinge: b, dir: -1, len: o.width / 2 }]
        : [{ hinge: o.swing?.hinge === 'end' ? b : a, dir: o.swing?.hinge === 'end' ? -1 : 1, len: o.width }];
    const side = o.swing?.side === 'left' ? -1 : 1;
    for (const l of leaves) {
      const h = at(l.hinge, side * half);
      const open = add(h, scale(n, side * l.len));
      const closed = add(h, scale(d, l.dir * l.len));
      lines.push([h, open]);
      // Arc: sweep from the open leaf position to the closed one
      const sweep = (side * l.dir) > 0 ? 0 : 1;
      arcs.push(`M${open[0]},${open[1]}A${l.len},${l.len} 0 0 ${sweep} ${closed[0]},${closed[1]}`);
    }
  } else {
    lines.push([at(a, -half), at(b, -half)], [at(a, half), at(b, half)]);
  }
  return {
    id: o.id, wallId: w.id, kind: o.kind, glassBlock: o.glazing === 'glass-block',
    outline: rectAlong(w, a, b, half + 10), lines, arcs, dashed: o.kind === 'opening',
  };
}

const cache = new WeakMap<Project, Map<string, LevelShapes>>();

export function levelShapes(p: Project, level: string): LevelShapes {
  let m = cache.get(p);
  if (!m) cache.set(p, (m = new Map()));
  const hit = m.get(level);
  if (hit) return hit;

  const walls = p.walls.filter(w => w.level === level);
  const holes = walls.flatMap(w => w.openings.map(o => ({ outer: rectAlong(w, o.at - o.width / 2, o.at + o.width / 2, w.thickness / 2 + 2) })));
  const solidWalls = walls.filter(w => w.kind === 'bearing' || w.kind === 'partition');
  const bearing = difference(union(solidWalls.filter(w => w.kind === 'bearing').map(wallBody)), holes);
  const partition = difference(union(solidWalls.filter(w => w.kind === 'partition').map(wallBody)), [...holes, ...bearing]);
  const light = difference(union(walls.filter(w => w.kind === 'fence' || w.kind === 'parapet').map(wallBody)), holes);

  const spaces = p.spaces
    .filter(s => s.level === level)
    .map(s => {
      const big = [...s.shape].sort((a, b) => ringArea(b.outer) - ringArea(a.outer))[0];
      const lp = polylabel([big.outer, ...(big.holes ?? [])], 50);
      return { s, d: polyPath(s.shape), label: [lp[0], lp[1]] as Point, area: s.kind === 'void' ? 0 : netArea(s, p.walls) };
    });

  const pts = [...walls.flatMap(w => [w.start, w.end]), ...p.spaces.filter(s => s.level === level).flatMap(s => s.shape.flatMap(q => q.outer))];
  const src = pts.length ? pts : p.site.boundary;
  const xs = src.map(q => q[0]), ys = src.map(q => q[1]);
  const shapes: LevelShapes = {
    bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    spaces,
    solid: polyPath(partition),
    bearing: polyPath(bearing),
    light: polyPath(light),
    railings: walls.filter(w => w.kind === 'railing').map(w => ({ w, d: polyPath([wallBody(w)]) })),
    walls: walls.map(w => ({ w, d: polyPath([wallBody(w)]) })),
    openings: walls.flatMap(w => w.openings.map(o => openingShape(w, o))),
    furniture: p.furniture.filter(f => f.level === level).map(f => ({ f, d: polyPath([furnitureFootprint(f)]) })),
  };
  m.set(level, shapes);
  return shapes;
}
