/** 内置能力：查询、编辑、关系、验证。浏览器才有的视图类能力在运行时登记。 */
import { z } from 'zod';
import { defineEdit, defineRead, Registry, type Capability, type CapabilityContext } from './capability.js';
import { areaReport, grossArea, netArea } from './area.js';
import { area, pointInPolygon, rect, union } from './geometry.js';
import { checkRules } from './rules.js';
import { checkConstraints, solveAreaMove, SUPPORTED_CONSTRAINTS } from './constraints.js';
import {
  add, autoWallName, moveWall, nextId, openingCenter, openingSpaces, project as projectPoint, round, sharedLength,
  sideOf, spaceNeighbors, spaceWalls, uniqueName, wallDir, wallLength, wallNormal, scale, sub, dot, TOL,
} from './topology.js';
import { TxError } from './session.js';
import type { Element, Furniture, Id, Level, Opening, Point, Polygon, Project, Space, Wall } from './schema.js';

// ---------- 引用解析：ID 或可读名称 ----------

type Kind = 'level' | 'wall' | 'space' | 'opening' | 'furniture' | 'element' | 'constraint';

const KIND_ZH: Record<Kind, string> = { level: '楼层', wall: '墙', space: '空间', opening: '门窗洞口', furniture: '家具', element: '构件', constraint: '约束' };

function pool(p: Project, kind: Kind): { id: Id; name: string; level?: Id }[] {
  switch (kind) {
    case 'level': return p.levels;
    case 'wall': return p.walls;
    case 'space': return p.spaces;
    case 'furniture': return p.furniture;
    case 'element': return p.elements;
    case 'constraint': return p.constraints.map(c => ({ id: c.id, name: c.note ?? c.id }));
    case 'opening': return p.walls.flatMap(w => w.openings.map(o => ({ id: o.id, name: o.name, level: w.level })));
  }
}

/** 按 ID 或名称找对象；名称可带楼层前缀“二层·主卧” */
export function resolve(p: Project, kind: Kind, ref: string, level?: string): { id: Id; name: string; level?: Id } {
  const all = pool(p, kind);
  const byId = all.find(o => o.id === ref);
  if (byId) return byId;
  let name = ref, lv = level ? resolveLevel(p, level).id : undefined;
  const m = ref.match(/^(.+?)[·:：](.+)$/);
  if (!lv && m && p.levels.some(l => l.name === m[1] || l.id === m[1])) {
    lv = resolveLevel(p, m[1]).id;
    name = m[2];
  }
  const hits = all.filter(o => o.name === name && (!lv || o.level === lv));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1)
    throw new TxError('ambiguous-ref', `有 ${hits.length} 个${KIND_ZH[kind]}叫“${name}”，请用 ID 或加楼层：${hits.map(h => `${h.id}（${h.level}）`).join('、')}`);
  const near = all.filter(o => o.name.includes(name) || name.includes(o.name)).slice(0, 8);
  throw new TxError('not-found', `找不到${KIND_ZH[kind]}“${ref}”${near.length ? `，相近的有：${near.map(h => `${h.name}（${h.id}）`).join('、')}` : ''}`);
}

export function resolveLevel(p: Project, ref: string): Level {
  const l = p.levels.find(x => x.id === ref || x.name === ref);
  if (!l) throw new TxError('not-found', `找不到楼层“${ref}”，现有：${p.levels.map(x => `${x.name}（${x.id}）`).join('、')}`);
  return l;
}

const getWall = (p: Project, ref: string) => p.walls.find(w => w.id === resolve(p, 'wall', ref).id)!;
const getSpace = (p: Project, ref: string) => p.spaces.find(s => s.id === resolve(p, 'space', ref).id)!;
const getFurniture = (p: Project, ref: string) => p.furniture.find(f => f.id === resolve(p, 'furniture', ref).id)!;
function getOpening(p: Project, ref: string) {
  const id = resolve(p, 'opening', ref).id;
  for (const w of p.walls) {
    const o = w.openings.find(x => x.id === id);
    if (o) return { w, o };
  }
  throw new TxError('not-found', ref);
}

// ---------- 输入片段 ----------

const zRef = (what: string) => z.string().describe(`${what}的 ID 或名称（名称可加楼层前缀，如“二层·主卧”）`);
const zPoint = z.tuple([z.number(), z.number()]).describe('[x, y] 毫米，x 向东、y 向南');
const zRect = z.tuple([z.number(), z.number(), z.number(), z.number()]).describe('[x, y, 宽(东西向), 深(南北向)] 毫米，x,y 为西北角');
const zDirection = z.enum(['north', 'south', 'east', 'west']).describe('方向：north 北 / south 南 / east 东 / west 西');
const zWallKind = z.enum(['bearing', 'partition', 'fence', 'parapet', 'railing']);
const zSpaceKind = z.enum(['indoor', 'semi-outdoor', 'outdoor', 'roof-terrace', 'void']);
const zOpeningKind = z.enum(['door', 'sliding-door', 'gate', 'window', 'opening']);

const DIR_VEC: Record<z.infer<typeof zDirection>, Point> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const OPENING_DEFAULTS: Record<Opening['kind'], { width: number; height: number; sill: number }> = {
  door: { width: 900, height: 2100, sill: 0 },
  'sliding-door': { width: 1800, height: 2400, sill: 0 },
  gate: { width: 1500, height: 2400, sill: 0 },
  window: { width: 1500, height: 1500, sill: 900 },
  opening: { width: 1000, height: 2400, sill: 0 },
};
const OPENING_WORD: Record<Opening['kind'], string> = { door: '门', 'sliding-door': '推拉门', gate: '大门', window: '窗', opening: '洞口' };

const toPolygon = (input: { rect?: number[]; polygon?: Point[] }): Polygon => {
  if (input.rect) {
    const [x, y, w, h] = input.rect;
    if (w <= 0 || h <= 0) throw new TxError('invalid-input', '矩形宽深必须大于 0');
    return rect(x, y, x + w, y + h);
  }
  if (input.polygon && input.polygon.length >= 3) return { outer: input.polygon.map(round) };
  throw new TxError('invalid-input', '需要 rect 或 polygon');
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- 摘要输出 ----------

function wallInfo(p: Project, w: Wall) {
  const sides = p.spaces
    .filter(s => s.level === w.level && sharedLength(w, s) > 100)
    .map(s => ({ space: s.name, id: s.id, side: sideOf(w, s) === 1 ? 'right' : 'left' }));
  return {
    id: w.id, name: w.name, type: 'wall', level: w.level, kind: w.kind,
    start: w.start, end: w.end, length: Math.round(wallLength(w)), thickness: w.thickness, height: w.height ?? null,
    spaces: sides,
    openings: w.openings.map(o => ({ id: o.id, name: o.name, kind: o.kind, at: o.at, width: o.width, height: o.height, sill: o.sill })),
  };
}

const DIR_ZH = (v: Point) => (Math.abs(v[0]) > Math.abs(v[1]) ? (v[0] > 0 ? '东' : '西') : v[1] > 0 ? '南' : '北');

function spaceInfo(p: Project, s: Space) {
  const walls = spaceWalls(p, s).map(b => {
    const toWall = scale(wallNormal(b.wall), -b.side);
    return { id: b.wall.id, name: b.wall.name, direction: DIR_ZH(toWall), length: Math.round(b.length), kind: b.wall.kind, openings: b.wall.openings.map(o => o.name) };
  });
  const xs = s.shape.flatMap(q => q.outer.map(v => v[0])), ys = s.shape.flatMap(q => q.outer.map(v => v[1]));
  return {
    id: s.id, name: s.name, type: 'space', level: s.level, kind: s.kind, floor: s.floor,
    netArea: r2(netArea(s, p.walls)), axisArea: r2(area(s.shape) / 1e6),
    bounds: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) },
    shape: s.shape,
    walls,
    neighbors: spaceNeighbors(p, s).map(n => ({ id: n.space.id, name: n.space.name, via: n.via.map(w => w.name) })),
    furniture: p.furniture.filter(f => f.level === s.level && s.shape.some(q => pointInPolygon(f.position, q))).map(f => ({ id: f.id, name: f.name })),
  };
}

function openingInfo(p: Project, w: Wall, o: Opening) {
  return {
    ...o, type: 'opening', level: w.level, wall: { id: w.id, name: w.name }, center: round(openingCenter(w, o)),
    connects: openingSpaces(p, w, o).map(s => ({ id: s.id, name: s.name })),
  };
}

function objectInfo(p: Project, ref: string) {
  const id = ref;
  const w = p.walls.find(x => x.id === id);
  if (w) return wallInfo(p, w);
  const s = p.spaces.find(x => x.id === id);
  if (s) return spaceInfo(p, s);
  for (const ww of p.walls) {
    const o = ww.openings.find(x => x.id === id);
    if (o) return openingInfo(p, ww, o);
  }
  const f = p.furniture.find(x => x.id === id);
  if (f) return { ...f, type: 'furniture', label: p.library.furniture[f.type]?.name };
  const e = p.elements.find(x => x.id === id);
  if (e) return { ...e, type: 'element' };
  const l = p.levels.find(x => x.id === id);
  if (l) return { ...l, type: 'level', gross: r2(grossArea(p, l.id)) };
  const c = p.constraints.find(x => x.id === id);
  if (c) return { ...c, type: 'constraint' };
  return null;
}

/** 按任意名称或 ID 找对象，不限类型 */
function findAny(p: Project, ref: string): Id {
  const kinds: Kind[] = ['space', 'wall', 'opening', 'furniture', 'element', 'level', 'constraint'];
  const errors: string[] = [];
  for (const k of kinds) {
    try {
      return resolve(p, k, ref).id;
    } catch (e) {
      if (e instanceof TxError && e.code === 'ambiguous-ref') throw e;
      errors.push(k);
    }
  }
  throw new TxError('not-found', `找不到“${ref}”。可以先用 find_objects 搜索`);
}

// ---------- 编辑辅助 ----------

function addWall(p: Project, level: Id, start: Point, end: Point, o: { thickness?: number; kind?: Wall['kind']; height?: number; name?: string } = {}): Wall {
  if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 50) throw new TxError('invalid-input', '墙太短（小于 50 mm）');
  const w: Wall = {
    id: nextId(p, `${level}-w`), name: '', level, start: round(start), end: round(end),
    thickness: o.thickness ?? (o.kind === 'bearing' ? 240 : o.kind === 'railing' ? 60 : 120),
    kind: o.kind ?? 'partition', openings: [], ...(o.height ? { height: o.height } : {}),
  };
  p.walls.push(w);
  w.name = uniqueName(p.walls.filter(x => x.level === level && x !== w).map(x => x.name), o.name ?? autoWallName(p, w));
  return w;
}

function addOpening(p: Project, w: Wall, kind: Opening['kind'], o: { at?: number; width?: number; height?: number; sill?: number; swing?: Opening['swing']; glassBlock?: boolean; name?: string }): Opening {
  const d = OPENING_DEFAULTS[kind];
  const width = o.width ?? d.width;
  const at = Math.round(o.at ?? wallLength(w) / 2);
  const word = (o.glassBlock ? '玻璃砖' : '') + OPENING_WORD[kind];
  const names = w.openings.map(x => x.name);
  const op: Opening = {
    id: nextId(p, `${w.id}-o`), name: o.name ?? uniqueName(names, `${w.name}·${word}`), kind, at, width,
    height: o.height ?? d.height, sill: o.sill ?? d.sill,
    ...(kind === 'door' ? { swing: o.swing ?? { hinge: 'start', side: 'right' } } : {}),
    ...(o.glassBlock ? { glazing: 'glass-block' as const } : {}),
  };
  w.openings.push(op);
  return op;
}

/** 沿墙方向，某空间与墙重合段的中点 */
function centerOnSpace(w: Wall, s: Space): number | null {
  const d = wallDir(w), L = wallLength(w);
  let lo = Infinity, hi = -Infinity;
  for (const poly of s.shape) for (let i = 0; i < poly.outer.length; i++) {
    const a = poly.outer[i], b = poly.outer[(i + 1) % poly.outer.length];
    const pa = projectPoint(w, a), pb = projectPoint(w, b);
    if (pa.dist > TOL || pb.dist > TOL || Math.abs(d[0] * (b[1] - a[1]) - d[1] * (b[0] - a[0])) > 10) continue;
    lo = Math.min(lo, Math.max(0, Math.min(pa.at, pb.at)));
    hi = Math.max(hi, Math.min(L, Math.max(pa.at, pb.at)));
  }
  return hi > lo ? (lo + hi) / 2 : null;
}

/** 给多边形每条边补墙：已有墙覆盖的部分跳过 */
function wallsAround(p: Project, level: Id, poly: Polygon, thickness: number, kind: Wall['kind']): Wall[] {
  const out: Wall[] = [];
  const ring = poly.outer;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 50) continue;
    const dir: Point = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    // 已有共线墙覆盖的区间
    const covered: [number, number][] = [];
    for (const w of p.walls) {
      if (w.level !== level) continue;
      const wd = wallDir(w);
      if (Math.abs(wd[0] * dir[1] - wd[1] * dir[0]) > 1e-6) continue;
      const off = Math.abs((w.start[0] - a[0]) * dir[1] - (w.start[1] - a[1]) * dir[0]);
      if (off > TOL) continue;
      const t1 = dot(sub(w.start, a), dir), t2 = dot(sub(w.end, a), dir);
      covered.push([Math.max(0, Math.min(t1, t2)), Math.min(L, Math.max(t1, t2))]);
    }
    covered.sort((x, y) => x[0] - y[0]);
    let t = 0;
    const gaps: [number, number][] = [];
    for (const [lo, hi] of covered) {
      if (lo > t + TOL) gaps.push([t, lo]);
      t = Math.max(t, hi);
    }
    if (t < L - TOL) gaps.push([t, L]);
    for (const [lo, hi] of gaps) if (hi - lo >= 50) out.push(addWall(p, level, add(a, scale(dir, lo)), add(a, scale(dir, hi)), { thickness, kind }));
  }
  return out;
}

function addSpace(p: Project, level: Id, name: string, shape: Polygon[], kind: Space['kind'], floor: string): Space {
  if (!(floor in p.library.materials)) p.library.materials[floor] = { name: floor };
  const s: Space = {
    id: nextId(p, `${level}-s`), name: uniqueName(p.spaces.filter(x => x.level === level).map(x => x.name), name),
    level, kind, shape: union(shape), floor,
  };
  p.spaces.push(s);
  return s;
}

/** 墙改动后刷新自动名称：只改名字仍是自动生成样式的 */
function renameWalls(p: Project, level: Id) {
  for (const w of p.walls.filter(x => x.level === level)) {
    if ((w.extras as any)?.customName) continue;
    const base = autoWallName(p, w);
    if (w.name === base || w.name.startsWith(base)) continue;
    const others = p.walls.filter(x => x.level === level && x !== w).map(x => x.name);
    const name = uniqueName(others, base);
    for (const o of w.openings) if (o.name.startsWith(`${w.name}·`)) o.name = name + o.name.slice(w.name.length);
    w.name = name;
  }
}

// ---------- 能力 ----------

const read = defineRead, edit = defineEdit;

export const projectSummary = read({
  name: 'project_summary', title: '项目概况', kind: 'query', permission: 'read', runtime: 'any',
  description: '项目名称、楼层、各层建筑面积、对象数量、需求和约束概况。开始工作前先调用。',
  input: z.object({}),
  run: (_, { session }) => {
    const p = session.project;
    const rep = areaReport(p);
    return {
      name: p.name,
      levels: p.levels.map(l => ({ id: l.id, name: l.name, elevation: l.elevation, height: l.height, roof: !!l.roof, gross: r2(rep.levels.find(x => x.id === l.id)!.gross), spaces: p.spaces.filter(s => s.level === l.id).map(s => s.name) })),
      totalGross: r2(rep.totalGross),
      counts: { walls: p.walls.length, spaces: p.spaces.length, furniture: p.furniture.length, elements: p.elements.length, constraints: p.constraints.length },
      brief: p.brief,
      site: { boundary: p.site.boundary },
      furnitureTypes: Object.fromEntries(Object.entries(p.library.furniture).map(([k, v]) => [k, v.name])),
      materials: Object.fromEntries(Object.entries(p.library.materials).map(([k, v]) => [k, v.name])),
    };
  },
});

export const findObjects = read({
  name: 'find_objects', title: '搜索对象', kind: 'query', permission: 'read', runtime: 'any',
  description: '按名称关键词、类型、楼层搜索墙、空间、门窗、家具、构件。返回 ID、名称、类型、楼层。',
  input: z.object({
    query: z.string().optional().describe('名称关键词，如“老人房”“北墙”“窗”'),
    type: z.enum(['wall', 'space', 'opening', 'furniture', 'element', 'level', 'constraint']).optional(),
    level: z.string().optional().describe('楼层 ID 或名称'),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  run: ({ query, type, level, limit }, { session }) => {
    const p = session.project;
    const lv = level ? resolveLevel(p, level).id : undefined;
    const kinds: Kind[] = type ? [type] : ['space', 'wall', 'opening', 'furniture', 'element', 'level', 'constraint'];
    return kinds.flatMap(k => pool(p, k).map(o => ({ id: o.id, name: o.name, type: k, level: o.level })))
      .filter(o => (!lv || o.level === lv) && (!query || o.name.includes(query) || o.id === query))
      .slice(0, limit);
  },
});

export const getObject = read({
  name: 'get_object', title: '查看对象', kind: 'query', permission: 'read', runtime: 'any',
  description: '查看一个对象的详情。空间：使用面积、范围、四周的墙及方位、相邻空间、家具；墙：端点、长度、厚度、两侧空间、门窗；门窗：所在墙、位置、连通的空间。',
  input: z.object({ ref: z.string().describe('对象 ID 或名称') }),
  run: ({ ref }, { session }) => objectInfo(session.project, findAny(session.project, ref)),
});

export const areaReportCap = read({
  name: 'area_report', title: '面积统计', kind: 'query', permission: 'read', runtime: 'any',
  description: '各层建筑面积和每个空间的使用面积（㎡）。',
  input: z.object({ level: z.string().optional() }),
  run: ({ level }, { session }) => {
    const p = session.project;
    const lv = level ? resolveLevel(p, level).id : undefined;
    const rep = areaReport(p);
    return {
      levels: rep.levels.filter(l => !lv || l.id === lv).map(l => ({ ...l, gross: r2(l.gross), spaces: l.spaces.map(s => ({ ...s, net: r2(s.net) })) })),
      totalGross: r2(rep.totalGross),
    };
  },
});

export const checkRulesCap = read({
  name: 'check_rules', title: '规则检查', kind: 'verify', permission: 'read', runtime: 'any',
  description: '检查房间重叠、门窗超出或重叠、房间没有入口、卧室没有窗、门扇碰家具、家具不在空间内，以及约束是否满足。',
  input: z.object({}),
  run: (_, { session }) => ({
    issues: checkRules(session.project),
    constraints: checkConstraints(session.project).filter(c => !c.ok),
  }),
});

export const listConstraints = read({
  name: 'list_constraints', title: '约束列表', kind: 'query', permission: 'read', runtime: 'any',
  description: '列出所有约束及是否满足。',
  input: z.object({}),
  run: (_, { session }) => {
    const st = new Map(checkConstraints(session.project).map(s => [s.id, s]));
    return session.project.constraints.map(c => ({ ...c, ok: st.get(c.id)?.ok, status: st.get(c.id)?.message }));
  },
});

export const wallAdd = edit({
  name: 'wall_add', title: '加墙', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '在指定楼层加一面直墙。端点在墙中心线上。',
  input: z.object({
    level: zRef('楼层'), start: zPoint, end: zPoint,
    thickness: z.number().positive().optional().describe('墙厚，默认隔墙 120、承重墙 240'),
    kind: zWallKind.default('partition'), height: z.number().positive().optional(), name: z.string().optional(),
  }),
  label: i => `加墙`,
  apply: (p, i) => {
    const w = addWall(p, resolveLevel(p, i.level).id, i.start, i.end, i);
    if (i.name) w.extras = { ...w.extras, customName: true };
    return { id: w.id, name: w.name };
  },
  examples: [{ input: { level: 'L1', start: [3000, 120], end: [3000, 3600], thickness: 120 }, note: '一层加一面南北向隔墙' }],
});

export const wallMove = edit({
  name: 'wall_move', title: '移墙', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '把一面墙沿垂直于墙的方向平移。相连的墙会伸缩跟上，两侧空间的边界跟着变，门窗保持在墙上的位置。',
  input: z.object({
    wall: zRef('墙'),
    direction: zDirection.optional(), distance: z.number().optional().describe('移动距离（毫米）'),
    to: z.number().optional().describe('直接移到某坐标：东西向的墙给 y，南北向的墙给 x'),
  }),
  label: (i, p) => `移动${resolve(p, 'wall', i.wall).name}`,
  apply: (p, i) => {
    const w = getWall(p, i.wall);
    const n = wallNormal(w);
    let v: Point;
    if (i.to != null) {
      const horiz = Math.abs(n[1]) > Math.abs(n[0]);
      v = horiz ? [0, i.to - w.start[1]] : [i.to - w.start[0], 0];
    } else {
      if (!i.direction || i.distance == null) throw new TxError('invalid-input', '需要 direction + distance，或 to');
      v = scale(DIR_VEC[i.direction], i.distance);
    }
    // 只取垂直于墙的分量
    const k = dot(v, n);
    if (Math.abs(k) < 1) throw new TxError('invalid-input', `${w.name}不能沿这个方向移动（方向与墙平行）`);
    moveWall(p, w.id, round(scale(n, k)));
    renameWalls(p, w.level);
    return { id: w.id, start: w.start, end: w.end };
  },
  examples: [{ input: { wall: '老人房一西墙', direction: 'west', distance: 500 }, note: '老人房一西墙向西移 0.5 米' }],
});

export const wallUpdate = edit({
  name: 'wall_update', title: '改墙', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '修改墙的厚度、类型、高度或名称。',
  input: z.object({ wall: zRef('墙'), thickness: z.number().positive().optional(), kind: zWallKind.optional(), height: z.number().positive().nullable().optional(), name: z.string().optional() }),
  label: (i, p) => `修改${resolve(p, 'wall', i.wall).name}`,
  apply: (p, i) => {
    const w = getWall(p, i.wall);
    if (i.thickness) w.thickness = i.thickness;
    if (i.kind) w.kind = i.kind;
    if (i.height === null) delete w.height;
    else if (i.height) w.height = i.height;
    if (i.name) {
      const old = w.name;
      w.name = uniqueName(p.walls.filter(x => x.level === w.level && x !== w).map(x => x.name), i.name);
      w.extras = { ...w.extras, customName: true };
      for (const o of w.openings) if (o.name.startsWith(`${old}·`)) o.name = w.name + o.name.slice(old.length);
    }
    return { id: w.id };
  },
});

export const wallRemove = edit({
  name: 'wall_remove', title: '拆墙', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '拆除一面墙（连同墙上的门窗）。不会自动合并两侧空间，需要时再用 space_merge。',
  input: z.object({ wall: zRef('墙') }),
  label: (i, p) => `拆除${resolve(p, 'wall', i.wall).name}`,
  apply: (p, i) => {
    const w = getWall(p, i.wall);
    if (w.kind === 'bearing') throw new TxError('structural', `${w.name}是承重墙，拆除涉及结构安全，需要专业人员复核，请先和业主确认后改为隔墙再拆`);
    p.walls = p.walls.filter(x => x.id !== w.id);
    p.constraints = p.constraints.filter(c => !c.targets.includes(w.id) && !w.openings.some(o => c.targets.includes(o.id)));
    return { removed: w.id };
  },
});

export const openingAdd = edit({
  name: 'opening_add', title: '开门窗', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '在墙上开门、窗、推拉门或洞口。位置用 at（洞口中心到墙起点的距离），或 center_on（居中在某空间与这面墙重合的一段上），都不给就放在墙中间。',
  input: z.object({
    wall: zRef('墙'), kind: zOpeningKind,
    at: z.number().optional(), center_on: z.string().optional().describe('空间 ID 或名称'),
    width: z.number().positive().optional(), height: z.number().positive().optional(), sill: z.number().min(0).optional().describe('窗台高（毫米）'),
    swing: z.object({ hinge: z.enum(['start', 'end']), side: z.enum(['left', 'right']) }).optional().describe('平开门的铰链端和开向（沿起点→终点看）'),
    glass_block: z.boolean().optional(), name: z.string().optional(),
  }),
  label: (i, p) => `在${resolve(p, 'wall', i.wall).name}上开${OPENING_WORD[i.kind]}`,
  apply: (p, i) => {
    const w = getWall(p, i.wall);
    let at = i.at;
    if (at == null && i.center_on) {
      const c = centerOnSpace(w, getSpace(p, i.center_on));
      if (c == null) throw new TxError('invalid-input', `${i.center_on}不挨着${w.name}`);
      at = c;
    }
    const o = addOpening(p, w, i.kind, { ...i, at, glassBlock: i.glass_block });
    return { id: o.id, name: o.name, at: o.at };
  },
  examples: [{ input: { wall: '主卧北墙', kind: 'window', width: 1500, center_on: '主卧' }, note: '在主卧北墙居中开一扇 1.5 米宽的窗' }],
});

export const openingUpdate = edit({
  name: 'opening_update', title: '改门窗', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '修改门窗的位置、尺寸、类型或开向。',
  input: z.object({
    opening: zRef('门窗'), at: z.number().optional(), move_by: z.number().optional().describe('沿墙方向移动（毫米，正数朝墙终点）'),
    width: z.number().positive().optional(), height: z.number().positive().optional(), sill: z.number().min(0).optional(), kind: zOpeningKind.optional(),
    swing: z.object({ hinge: z.enum(['start', 'end']), side: z.enum(['left', 'right']) }).optional(), name: z.string().optional(),
  }),
  label: (i, p) => `修改${resolve(p, 'opening', i.opening).name}`,
  apply: (p, i) => {
    const { o } = getOpening(p, i.opening);
    if (i.at != null) o.at = Math.round(i.at);
    if (i.move_by) o.at = Math.round(o.at + i.move_by);
    for (const k of ['width', 'height', 'sill', 'name'] as const) if (i[k] != null) (o as any)[k] = i[k];
    if (i.kind) {
      o.kind = i.kind;
      if (i.kind !== 'door') delete o.swing;
      else o.swing ??= { hinge: 'start', side: 'right' };
    }
    if (i.swing) o.swing = i.swing;
    return { id: o.id };
  },
});

export const openingRemove = edit({
  name: 'opening_remove', title: '封门窗', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '封掉一个门窗洞口。',
  input: z.object({ opening: zRef('门窗') }),
  label: (i, p) => `封掉${resolve(p, 'opening', i.opening).name}`,
  apply: (p, i) => {
    const { w, o } = getOpening(p, i.opening);
    w.openings = w.openings.filter(x => x.id !== o.id);
    p.constraints = p.constraints.filter(c => !c.targets.includes(o.id));
    return { removed: o.id };
  },
});

const zShape = { rect: zRect.optional(), polygon: z.array(zPoint).optional().describe('任意多边形顶点（按顺序）') };

export const roomAdd = edit({
  name: 'room_add', title: '加房间', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '加一个房间：建空间，并在四周没有墙的地方补墙（已有的墙会复用）。可同时在某一侧开门。从零建方案时用它逐间搭。',
  input: z.object({
    level: zRef('楼层'), name: z.string(), ...zShape,
    kind: zSpaceKind.default('indoor'), floor: z.string().default('oak').describe('地面材质类别'),
    wall_thickness: z.number().positive().default(120), wall_kind: zWallKind.default('partition'),
    door: z.object({ side: zDirection, width: z.number().positive().optional() }).optional().describe('在房间哪一侧的墙上居中开门'),
  }),
  label: i => `加房间“${i.name}”`,
  apply: (p, i) => {
    const level = resolveLevel(p, i.level).id;
    const poly = toPolygon(i);
    const walls = i.kind === 'outdoor' ? [] : wallsAround(p, level, poly, i.wall_thickness, i.wall_kind);
    const s = addSpace(p, level, i.name, [poly], i.kind, i.floor);
    renameWalls(p, level);
    let door: Opening | undefined;
    if (i.door) {
      const want = DIR_VEC[i.door.side];
      const b = spaceWalls(p, s)
        .map(x => ({ ...x, toward: scale(wallNormal(x.wall), -x.side) }))
        .filter(x => dot(x.toward, want) > 0.9)
        .sort((a, b2) => b2.length - a.length)[0];
      if (!b) throw new TxError('invalid-input', `${s.name}的${i.door.side}侧没有墙可以开门`);
      door = addOpening(p, b.wall, 'door', { at: centerOnSpace(b.wall, s) ?? undefined, width: i.door.width });
    }
    return { id: s.id, name: s.name, walls: walls.map(w => ({ id: w.id, name: w.name })), door: door && { id: door.id, name: door.name } };
  },
  examples: [{ input: { level: 'L2', name: '书房', rect: [10000, 120, 3000, 3480], door: { side: 'south' } }, note: '二层加一间 3×3.48 米的书房，南墙开门' }],
});

export const spaceAdd = edit({
  name: 'space_add', title: '划空间', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '只划定一个空间（如院子、露台、走廊），不加墙。',
  input: z.object({ level: zRef('楼层'), name: z.string(), ...zShape, kind: zSpaceKind.default('indoor'), floor: z.string().default('tile') }),
  label: i => `划出“${i.name}”`,
  apply: (p, i) => {
    const level = resolveLevel(p, i.level).id;
    const s = addSpace(p, level, i.name, [toPolygon(i)], i.kind, i.floor);
    return { id: s.id, name: s.name };
  },
});

export const spaceUpdate = edit({
  name: 'space_update', title: '改空间', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '修改空间的名称、类型、地面材质，或用 rect / polygon 重新划定范围（不动墙）。',
  input: z.object({ space: zRef('空间'), name: z.string().optional(), kind: zSpaceKind.optional(), floor: z.string().optional(), ...zShape }),
  label: (i, p) => `修改${resolve(p, 'space', i.space).name}`,
  apply: (p, i) => {
    const s = getSpace(p, i.space);
    if (i.name) {
      s.name = uniqueName(p.spaces.filter(x => x.level === s.level && x !== s).map(x => x.name), i.name);
      renameWalls(p, s.level);
    }
    if (i.kind) s.kind = i.kind;
    if (i.floor) {
      if (!(i.floor in p.library.materials)) p.library.materials[i.floor] = { name: i.floor };
      s.floor = i.floor;
    }
    if (i.rect || i.polygon) s.shape = [toPolygon(i)];
    return { id: s.id, name: s.name };
  },
});

export const spaceRemove = edit({
  name: 'space_remove', title: '删空间', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '删除空间。walls=true 时一并拆掉只属于这个空间的隔墙（承重墙不拆）。',
  input: z.object({ space: zRef('空间'), walls: z.boolean().default(false) }),
  label: (i, p) => `删除${resolve(p, 'space', i.space).name}`,
  apply: (p, i) => {
    const s = getSpace(p, i.space);
    const removed: Id[] = [];
    if (i.walls) {
      for (const b of spaceWalls(p, s)) {
        if (b.wall.kind === 'bearing') continue;
        const shared = p.spaces.some(o => o.id !== s.id && o.level === s.level && sharedLength(b.wall, o) > 100);
        if (!shared) removed.push(b.wall.id);
      }
      p.walls = p.walls.filter(w => !removed.includes(w.id));
    }
    p.spaces = p.spaces.filter(x => x.id !== s.id);
    p.constraints = p.constraints.filter(c => !c.targets.includes(s.id));
    return { removed: [s.id, ...removed] };
  },
});

export const spaceMerge = edit({
  name: 'space_merge', title: '合并空间', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '把几个相邻空间合成一个（拆掉它们之间的隔墙）。',
  input: z.object({ spaces: z.array(zRef('空间')).min(2), name: z.string().optional() }),
  label: (i, p) => `合并${i.spaces.map(s => resolve(p, 'space', s).name).join('、')}`,
  apply: (p, i) => {
    const ss = i.spaces.map(r => getSpace(p, r));
    const level = ss[0].level;
    if (ss.some(s => s.level !== level)) throw new TxError('invalid-input', '只能合并同一层的空间');
    const between = p.walls.filter(w => w.level === level && ss.filter(s => sharedLength(w, s) > 100).length >= 2);
    if (between.some(w => w.kind === 'bearing')) throw new TxError('structural', '它们之间有承重墙，拆除涉及结构安全，需要专业人员复核');
    p.walls = p.walls.filter(w => !between.includes(w));
    const keep = ss[0];
    keep.shape = union(ss.flatMap(s => s.shape));
    if (i.name) keep.name = i.name;
    p.spaces = p.spaces.filter(s => s === keep || !ss.includes(s));
    renameWalls(p, level);
    return { id: keep.id, removedWalls: between.map(w => w.id) };
  },
});

export const spaceSetArea = edit({
  name: 'space_set_area', title: '调面积', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '移动空间的一面墙，让使用面积接近目标值（㎡）。不指定墙时自动选一面隔墙。相邻空间会相应变小或变大。',
  input: z.object({ space: zRef('空间'), area: z.number().positive().describe('目标使用面积（㎡）'), wall: z.string().optional().describe('要移动的墙') }),
  label: (i, p) => `把${resolve(p, 'space', i.space).name}调到约 ${i.area} m²`,
  apply: (p, i) => {
    const s = getSpace(p, i.space);
    const sol = solveAreaMove(p, s.id, i.area, i.wall ? getWall(p, i.wall).id : undefined);
    if (!sol) throw new TxError('cannot-resize', `${s.name}没有合适的墙可以移动，请指定 wall`);
    moveWall(p, sol.wall.id, sol.vector);
    renameWalls(p, s.level);
    return { space: s.id, wall: { id: sol.wall.id, name: sol.wall.name }, moved: sol.vector, area: r2(sol.area) };
  },
  examples: [{ input: { space: '老人房一', area: 12 }, note: '老人房一调到约 12 m²' }],
});

export const furnitureAdd = edit({
  name: 'furniture_add', title: '放家具', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '放一件家具。type 用家具类别（见 project_summary 的 furnitureTypes，也可用新类别并给 size）。position 不给时放在 space 的中心。',
  input: z.object({
    level: zRef('楼层').optional(), type: z.string(), position: zPoint.optional(), space: z.string().optional(),
    rotation: z.number().default(0).describe('顺时针旋转角（度）'),
    size: z.object({ w: z.number().positive(), d: z.number().positive(), h: z.number().positive() }).optional(),
    elevation: z.number().optional(), label: z.string().optional().describe('新类别的中文名'),
  }),
  label: i => `放${i.type}`,
  apply: (p, i) => {
    const s = i.space ? getSpace(p, i.space) : undefined;
    const level = s?.level ?? (i.level ? resolveLevel(p, i.level).id : undefined);
    if (!level) throw new TxError('invalid-input', '需要 level 或 space');
    let pos = i.position;
    if (!pos && s) {
      const xs = s.shape.flatMap(q => q.outer.map(v => v[0])), ys = s.shape.flatMap(q => q.outer.map(v => v[1]));
      pos = [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)];
    }
    if (!pos) throw new TxError('invalid-input', '需要 position 或 space');
    const def = p.library.furniture[i.type];
    if (!def) {
      if (!i.size) throw new TxError('invalid-input', `家具类别 ${i.type} 未登记，请给 size（和 label）`);
      p.library.furniture[i.type] = { name: i.label ?? i.type, size: i.size };
    }
    const size = i.size ?? def.size;
    const host = p.spaces.find(x => x.level === level && x.shape.some(q => pointInPolygon(pos!, q)));
    const label = p.library.furniture[i.type].name;
    const f: Furniture = {
      id: nextId(p, `${level}-f`), name: uniqueName(p.furniture.filter(x => x.level === level).map(x => x.name), host ? `${host.name}·${label}` : label),
      type: i.type, level, position: round(pos), rotation: i.rotation, size: { ...size }, ...(i.elevation ? { elevation: i.elevation } : {}),
    };
    p.furniture.push(f);
    return { id: f.id, name: f.name };
  },
});

export const furnitureMove = edit({
  name: 'furniture_move', title: '挪家具', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '移动或旋转家具：position 绝对位置，或 by 相对位移；rotation 新的旋转角。',
  input: z.object({ furniture: zRef('家具'), position: zPoint.optional(), by: zPoint.optional(), rotation: z.number().optional() }),
  label: (i, p) => `挪动${resolve(p, 'furniture', i.furniture).name}`,
  apply: (p, i) => {
    const f = getFurniture(p, i.furniture);
    if (i.position) f.position = round(i.position);
    if (i.by) f.position = round(add(f.position, i.by));
    if (i.rotation != null) f.rotation = i.rotation;
    return { id: f.id, position: f.position };
  },
});

export const furnitureRemove = edit({
  name: 'furniture_remove', title: '移走家具', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '移走一件家具。',
  input: z.object({ furniture: zRef('家具') }),
  label: (i, p) => `移走${resolve(p, 'furniture', i.furniture).name}`,
  apply: (p, i) => {
    const f = getFurniture(p, i.furniture);
    p.furniture = p.furniture.filter(x => x.id !== f.id);
    return { removed: f.id };
  },
});

export const levelAdd = edit({
  name: 'level_add', title: '加楼层', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '在最上面的非屋顶层之上加一层（屋顶层随之上移）。copy_from 给出时复制那一层的墙和空间（不含家具）。',
  input: z.object({ name: z.string(), height: z.number().positive().default(3000), copy_from: z.string().optional() }),
  label: i => `加楼层“${i.name}”`,
  apply: (p, i) => {
    const roof = p.levels.find(l => l.roof);
    const floors = p.levels.filter(l => !l.roof);
    const top = floors[floors.length - 1];
    const elevation = top ? top.elevation + top.height : 0;
    let n = floors.length + 1, id = `L${n}`;
    while (p.levels.some(l => l.id === id)) id = `L${++n}`;
    const lv: Level = { id, name: i.name, elevation, height: i.height };
    p.levels.splice(roof ? p.levels.indexOf(roof) : p.levels.length, 0, lv);
    if (roof) roof.elevation = elevation + i.height;
    if (i.copy_from) {
      const src = resolveLevel(p, i.copy_from);
      for (const w of p.walls.filter(x => x.level === src.id)) {
        const nw = addWall(p, id, w.start, w.end, { thickness: w.thickness, kind: w.kind, height: w.height, name: w.name });
        for (const o of w.openings) addOpening(p, nw, o.kind, { ...o, name: o.name.replace(w.name, nw.name), glassBlock: o.glazing === 'glass-block' });
      }
      for (const s of p.spaces.filter(x => x.level === src.id)) addSpace(p, id, s.name, s.shape, s.kind, s.floor);
    }
    return { id, name: lv.name, elevation };
  },
});

export const levelRemove = edit({
  name: 'level_remove', title: '删楼层', kind: 'edit', permission: 'main', runtime: 'any',
  description: '删除一层及其上所有墙、空间、家具。上面的楼层整体下移。影响主方案，需业主确认。',
  input: z.object({ level: zRef('楼层') }),
  label: (i, p) => `删除${resolveLevel(p, i.level).name}`,
  apply: (p, i) => {
    const lv = resolveLevel(p, i.level);
    if (p.levels.filter(l => !l.roof).length <= 1 && !lv.roof) throw new TxError('invalid-input', '至少保留一层');
    p.levels = p.levels.filter(l => l.id !== lv.id);
    for (const l of p.levels) if (l.elevation > lv.elevation) l.elevation -= lv.height;
    p.walls = p.walls.filter(x => x.level !== lv.id);
    p.spaces = p.spaces.filter(x => x.level !== lv.id);
    p.furniture = p.furniture.filter(x => x.level !== lv.id);
    p.elements = p.elements.filter(x => x.level !== lv.id);
    return { removed: lv.id };
  },
});

export const constraintAdd = edit({
  name: 'constraint_add', title: '加约束', kind: 'relation', permission: 'reversible', runtime: 'any',
  description: [
    '把业主说的相对关系存成约束，以后改动时自动保持。支持：',
    'align（targets: 几面平行墙，保持共线）；',
    'center（targets: [门窗, 空间]，门窗居中在该空间那段墙上）；',
    'spacing（targets: [门窗或墙, 墙]，params.distance 毫米：门窗边到墙面的净距，或两面平行墙中心距）；',
    'size-target（targets: [空间, 可选的墙]，params.area ㎡、params.tolerance 默认 0.3）。',
    'hard=true 时违反会拒绝操作。source：业主原话为 user，你推断的为 agent。',
  ].join(''),
  input: z.object({
    type: z.enum(SUPPORTED_CONSTRAINTS as [string, ...string[]]),
    targets: z.array(z.string()).min(1).describe('对象 ID 或名称'),
    params: z.record(z.string(), z.unknown()).default({}),
    hard: z.boolean().default(false), source: z.enum(['user', 'agent', 'default']).default('user'),
    note: z.string().optional().describe('用业主的原话记录'),
  }),
  label: i => `加约束：${i.note ?? i.type}`,
  apply: (p, i) => {
    const targets = i.targets.map(t => findAny(p, t));
    const c = {
      id: nextId(p, 'c-'), type: i.type as any, targets, params: i.params, hard: i.hard, source: i.source,
      weight: i.source === 'user' ? 3 : i.source === 'agent' ? 2 : 1, ...(i.note ? { note: i.note } : {}),
    };
    p.constraints.push(c);
    return { id: c.id };
  },
  examples: [
    { input: { type: 'center', targets: ['主卧南墙·门', '主卧'], note: '门在房间中线上' }, note: '门居中' },
    { input: { type: 'size-target', targets: ['老人房一'], params: { area: 12 }, note: '老人房一约 12 平' }, note: '面积目标' },
  ],
});

export const constraintRemove = edit({
  name: 'constraint_remove', title: '删约束', kind: 'relation', permission: 'reversible', runtime: 'any',
  description: '删除一条约束。',
  input: z.object({ constraint: z.string() }),
  label: i => `删除约束 ${i.constraint}`,
  apply: (p, i) => {
    const id = resolve(p, 'constraint', i.constraint).id;
    p.constraints = p.constraints.filter(c => c.id !== id);
    return { removed: id };
  },
});

export const briefUpdate = edit({
  name: 'brief_update', title: '记录需求', kind: 'relation', permission: 'reversible', runtime: 'any',
  description: '记录或更新业主需求：家庭成员、房间清单、偏好、预算、备注。数组字段整体替换。',
  input: z.object({
    household: z.array(z.string()).optional(), rooms: z.array(z.string()).optional(), preferences: z.array(z.string()).optional(),
    budget: z.string().optional(), notes: z.array(z.string()).optional(),
  }),
  label: () => '更新需求',
  apply: (p, i) => {
    p.brief = { ...p.brief, ...Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined)) };
    return p.brief;
  },
});

export const decisionAdd = edit({
  name: 'decision_add', title: '记录决策', kind: 'relation', permission: 'reversible', runtime: 'any',
  description: '把一次取舍写进决策日志：做了什么、为什么、放弃了哪些选项。',
  input: z.object({ summary: z.string(), reason: z.string().optional(), rejected: z.array(z.string()).optional() }),
  label: i => `记录决策：${i.summary}`,
  apply: (p, i) => {
    const d = { id: nextId(p, 'd-'), at: new Date().toISOString(), ...i };
    p.decisions.push(d);
    return { id: d.id };
  },
});

export const historyUndo = defineRead({
  name: 'history_undo', title: '撤销', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '撤销上一步修改。',
  input: z.object({}),
  run: (_, { session }) => {
    const e = session.undo();
    return e ? { undone: e.label, changed: e.changed } : { undone: null };
  },
});

export const historyRedo = defineRead({
  name: 'history_redo', title: '重做', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: '重做刚撤销的修改。',
  input: z.object({}),
  run: (_, { session }) => {
    const e = session.redo();
    return e ? { redone: e.label, changed: e.changed } : { redone: null };
  },
});

export const historyLog = read({
  name: 'history_log', title: '操作记录', kind: 'query', permission: 'read', runtime: 'any',
  description: '本次会话的操作日志：谁、何时、做了什么、为什么。',
  input: z.object({ limit: z.number().int().positive().default(20) }),
  run: ({ limit }, { session }) => session.log.slice(-limit),
});

/** 批量：多个修改合成一个事务，一次撤销 */
export function batchCapability(registry: Registry) {
  return edit({
    name: 'batch', title: '批量修改', kind: 'edit', permission: 'reversible', runtime: 'any',
    description: '把多个修改类能力合成一步执行：全部成功或全部回滚，撤销时一起撤销。大改动、从零搭方案时使用。',
    input: z.object({
      label: z.string().describe('这批修改的一句话说明'),
      calls: z.array(z.object({ name: z.string(), input: z.record(z.string(), z.unknown()).default({}) })).min(1).max(60),
    }),
    label: i => i.label,
    apply: (p, i, ctx: CapabilityContext) => {
      const results: unknown[] = [];
      for (const [k, call] of i.calls.entries()) {
        const c = registry.get(call.name);
        if (!c || c.mode !== 'edit' || c.name === 'batch') throw new TxError('invalid-input', `第 ${k + 1} 步：${call.name} 不是可批量的修改类能力`);
        const parsed = c.input.safeParse(call.input);
        if (!parsed.success) throw new TxError('invalid-input', `第 ${k + 1} 步 ${call.name}：${z.prettifyError(parsed.error)}`);
        try {
          results.push(c.apply(p, parsed.data, ctx));
        } catch (e) {
          if (e instanceof TxError) throw new TxError(e.code, `第 ${k + 1} 步 ${call.name}：${e.message}`);
          throw e;
        }
      }
      return results;
    },
  });
}

export const searchCapabilitiesFor = (registry: Registry) => read({
  name: 'search_capabilities', title: '搜索能力', kind: 'query', permission: 'read', runtime: 'any',
  description: '按关键词搜索可用的能力，返回名称、说明、输入格式和范例。',
  input: z.object({ query: z.string().default('') }),
  run: ({ query }) => registry.search(query, 15),
});

export const BUILTIN: Capability[] = [
  projectSummary, findObjects, getObject, areaReportCap, checkRulesCap, listConstraints,
  wallAdd, wallMove, wallUpdate, wallRemove, openingAdd, openingUpdate, openingRemove,
  roomAdd, spaceAdd, spaceUpdate, spaceRemove, spaceMerge, spaceSetArea,
  furnitureAdd, furnitureMove, furnitureRemove, levelAdd, levelRemove,
  constraintAdd, constraintRemove, briefUpdate, decisionAdd,
  historyUndo, historyRedo, historyLog,
];

/** 内置能力清单（含 batch 和 search_capabilities） */
export function createRegistry(extra: Capability[] = []): Registry {
  const r = new Registry([...BUILTIN, ...extra]);
  r.register(batchCapability(r));
  r.register(searchCapabilitiesFor(r));
  return r;
}

