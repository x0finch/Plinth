/** 墙、空间、洞口之间的几何关系：邻接、定位、连带移动。 */
import pc from 'polygon-clipping';
import { area, difference, pointInPolygon, toPc, union, wallBody } from './geometry.js';
import type { Id, Opening, Point, Polygon, Project, Space, Wall, WallKind } from './schema.js';

export const TOL = 5;

export const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
export const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
export const len = (a: Point) => Math.hypot(a[0], a[1]);
export const round = (p: Point): Point => [Math.round(p[0]), Math.round(p[1])];

export const wallLength = (w: Wall) => len(sub(w.end, w.start));
export const wallDir = (w: Wall): Point => scale(sub(w.end, w.start), 1 / wallLength(w));
/** 法线：沿起点→终点看的右手侧（平面图北在上、y 向南） */
export const wallNormal = (w: Wall): Point => {
  const [dx, dy] = wallDir(w);
  return [-dy, dx];
};

export const pointAt = (w: Wall, at: number): Point => add(w.start, scale(wallDir(w), at));
export const openingCenter = (w: Wall, o: Opening) => pointAt(w, o.at);

/** 点到线段的距离及投影参数（沿墙距离） */
export function project(w: Wall, p: Point): { dist: number; at: number } {
  const d = wallDir(w), v = sub(p, w.start);
  const at = dot(v, d);
  return { dist: Math.abs(cross(d, v)), at };
}

/** 点是否在墙中心线上（含端点） */
export function onWall(w: Wall, p: Point, tol = TOL) {
  const { dist, at } = project(w, p);
  return dist <= tol && at >= -tol && at <= wallLength(w) + tol;
}

/** 两条直线的交点（平行时返回 null） */
export function intersectLines(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(p2, p1), d2) / den;
  return add(p1, scale(d1, t));
}

const edges = (p: Polygon): [Point, Point][] =>
  [p.outer, ...(p.holes ?? [])].flatMap(r => r.map((a, i) => [a, r[(i + 1) % r.length]] as [Point, Point]));

/** 墙与空间边界重合的长度 */
export function sharedLength(w: Wall, s: Space, tol = TOL): number {
  const d = wallDir(w), L = wallLength(w);
  let total = 0;
  for (const poly of s.shape) for (const [a, b] of edges(poly)) {
    const pa = project(w, a), pb = project(w, b);
    if (pa.dist > tol || pb.dist > tol) continue;
    if (Math.abs(cross(d, sub(b, a))) > tol * 2) continue;
    const lo = Math.max(0, Math.min(pa.at, pb.at)), hi = Math.min(L, Math.max(pa.at, pb.at));
    if (hi > lo) total += hi - lo;
  }
  return total;
}

export const centroid = (s: Space): Point => {
  let x = 0, y = 0, n = 0;
  for (const p of s.shape) for (const [px, py] of p.outer) { x += px; y += py; n++; }
  return [x / n, y / n];
};

/** 空间在墙的哪一侧：沿法线为 1，反方向为 -1 */
export function sideOf(w: Wall, s: Space): 1 | -1 {
  // 从墙中点沿法线两侧各探一小步，看哪侧落在空间里
  const L = wallLength(w), n = wallNormal(w);
  const samples = [0.25, 0.5, 0.75].map(t => pointAt(w, L * t));
  const probe = (k: number) => samples.filter(m => s.shape.some(p => pointInPolygon(add(m, scale(n, k * 50)), p))).length;
  return probe(1) >= probe(-1) ? 1 : -1;
}

export interface SpaceBoundary { wall: Wall; length: number; side: 1 | -1 }

/** 围合空间的墙 */
export function spaceWalls(p: Project, s: Space): SpaceBoundary[] {
  return p.walls
    .filter(w => w.level === s.level)
    .map(w => ({ wall: w, length: sharedLength(w, s) }))
    .filter(b => b.length > 100)
    .map(b => ({ ...b, side: sideOf(b.wall, s) }));
}

/** 隔着一面墙或直接相邻的空间 */
export function spaceNeighbors(p: Project, s: Space): { space: Space; via: Wall[] }[] {
  const mine = spaceWalls(p, s);
  const out: { space: Space; via: Wall[] }[] = [];
  for (const o of p.spaces) {
    if (o.id === s.id || o.level !== s.level) continue;
    const via = mine.filter(b => sharedLength(b.wall, o) > 100).map(b => b.wall);
    if (via.length) out.push({ space: o, via });
  }
  return out;
}

/** 洞口连通的两侧空间 */
export function openingSpaces(p: Project, w: Wall, o: Opening): Space[] {
  const c = openingCenter(w, o), n = wallNormal(w), off = w.thickness / 2 + 100;
  return [1, -1].map(k => p.spaces.find(s => s.level === w.level && s.shape.some(poly => pointInPolygon(add(c, scale(n, k * off)), poly))))
    .filter((s): s is Space => !!s);
}

const DIRS: Record<string, string> = { '0,-1': '北', '0,1': '南', '1,0': '东', '-1,0': '西' };
export const KIND_WORD: Record<WallKind, string> = { bearing: '墙', partition: '墙', fence: '围墙', parapet: '女儿墙', railing: '栏杆' };

/** 按墙两侧空间起名（与 legacy 导入一致）：贴合最长的室内空间优先 */
export function autoWallName(p: Project, w: Wall): string {
  const rank: Record<Space['kind'], number> = { indoor: 3, 'semi-outdoor': 2, 'roof-terrace': 1, outdoor: 1, void: 0 };
  let best: { s: Space; score: number } | null = null;
  const indoorSides = new Map<number, number>();
  for (const s of p.spaces) {
    if (s.level !== w.level) continue;
    const l = sharedLength(w, s);
    if (l <= 0) continue;
    const side = sideOf(w, s);
    if (s.kind === 'indoor') indoorSides.set(side, (indoorSides.get(side) ?? 0) + 1);
    const score = rank[s.kind] * 1e6 + l;
    if (!best || score > best.score) best = { s, score };
  }
  const word = KIND_WORD[w.kind];
  if (!best) return `${w.level}${word}`;
  // 墙在空间的哪个方位：空间指向墙的方向
  const n = scale(wallNormal(w), -sideOf(w, best.s));
  const key = `${Math.round(n[0])},${Math.round(n[1])}`;
  const dir = DIRS[key] ?? '';
  if ((w.kind === 'bearing' || w.kind === 'partition') && indoorSides.size === 1 && [...indoorSides.values()][0] > 1) return `${dir}外墙`;
  return `${best.s.name}${dir}${word}`;
}

/** 同层内重名时加序号 */
export function uniqueName(existing: Iterable<string>, base: string): string {
  const set = new Set(existing);
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) if (!set.has(`${base}（${i}）`)) return `${base}（${i}）`;
}

/** 生成新 ID：前缀 + 递增序号 */
export function nextId(p: Project, prefix: string): Id {
  const all = new Set<string>([
    ...p.levels.map(o => o.id), ...p.walls.map(o => o.id), ...p.walls.flatMap(w => w.openings.map(o => o.id)),
    ...p.spaces.map(o => o.id), ...p.elements.map(o => o.id), ...p.furniture.map(o => o.id), ...p.constraints.map(o => o.id),
    ...p.decisions.map(o => o.id),
  ]);
  for (let i = 1; ; i++) {
    const id = `${prefix}${String(i).padStart(2, '0')}`;
    if (!all.has(id)) return id;
  }
}

/**
 * 平移一面墙，并连带调整：端点搭在这面墙上的墙伸缩到新位置，这面墙的端点沿所搭的墙滑动，
 * 落在墙线上的空间顶点跟着平移，被移动起点的墙上洞口保持绝对位置不变。直接修改传入的数据。
 */
export function moveWall(p: Project, wallId: Id, v: Point) {
  const w = p.walls.find(x => x.id === wallId)!;
  const old = { start: w.start, end: w.end };
  const oldWall: Wall = { ...w, ...old };
  const d = wallDir(oldWall);
  const others = p.walls.filter(o => o.level === w.level && o.id !== w.id);

  // 本墙端点：若搭在另一面不平行的墙上，沿那面墙滑动
  const slide = (pt: Point): Point => {
    const moved = add(pt, v);
    const host = others.find(o => Math.abs(cross(wallDir(o), d)) > 1e-6 && onWall(o, pt));
    if (!host) return moved;
    return intersectLines(moved, d, host.start, wallDir(host)) ?? moved;
  };
  w.start = round(slide(old.start));
  w.end = round(slide(old.end));

  // 端点搭在本墙上的其他墙：伸缩到新墙线
  for (const o of others) {
    const od = wallDir(o);
    if (Math.abs(cross(od, d)) < 1e-6) continue;
    for (const key of ['start', 'end'] as const) {
      if (!onWall(oldWall, o[key])) continue;
      const hit = intersectLines(o.start, od, w.start, d);
      if (!hit) continue;
      const before = o.start;
      o[key] = round(hit);
      if (key === 'start') {
        const shift = dot(sub(o.start, before), od);
        for (const op of o.openings) op.at = Math.round(op.at - shift);
      }
    }
  }

  // 空间顶点：落在旧墙线上（含墙厚范围内的延长）的跟着平移
  const ext = w.thickness;
  for (const s of p.spaces) {
    if (s.level !== w.level) continue;
    for (const poly of s.shape) for (const ring of [poly.outer, ...(poly.holes ?? [])]) {
      for (let i = 0; i < ring.length; i++) {
        const pr = project(oldWall, ring[i]);
        if (pr.dist <= TOL && pr.at >= -ext && pr.at <= wallLength(oldWall) + ext) ring[i] = round(add(ring[i], v));
      }
    }
    s.shape = union(s.shape);
  }
}

/** 空间的使用面积（㎡），与 area.ts 一致 */
export function spaceNetArea(p: Project, s: Space) {
  const bodies = p.walls.filter(w => w.level === s.level && w.kind !== 'railing').map(wallBody);
  return area(difference(s.shape, bodies)) / 1e6;
}

/** 两组多边形的重叠面积（mm²） */
export function overlapArea(a: Polygon[], b: Polygon[]) {
  if (!a.length || !b.length) return 0;
  return area(
    pc.intersection(a.map(toPc), b.map(toPc)).map(([outer, ...holes]) => ({
      outer: outer.slice(0, -1) as Point[],
      holes: holes.map(h => h.slice(0, -1) as Point[]),
    })),
  );
}

