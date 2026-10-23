/** Built-in capabilities: query, edit, relation, verify. Browser-only view capabilities are registered at runtime. */
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
import { text } from './i18n.js';
import { directionOf, NAME_SEPARATOR, names, REF_SEPARATOR } from './names.js';
import { findObject, projectIndex, type IndexEntry, type ObjectKind } from './project-index.js';
import type { Furniture, Id, Level, Opening, Point, Polygon, Project, Space, Wall } from './schema.js';

// ---------- Reference resolution: ID or readable name ----------

type Kind = ObjectKind;

const KIND_EN: Record<Kind, string> = { level: 'level', wall: 'wall', space: 'space', opening: 'opening', furniture: 'furniture', element: 'element', constraint: 'constraint' };
const kindText = (k: Kind) => text(`err_kind_${k}`, KIND_EN[k]);
/** Join a list for a message: “a、b” in Chinese, "a, b" in English */
const listText = (items: string[]) => items.join(text('list_separator', ', '));
const refItem = (name: string, id: string | undefined) => text('err_ref_item', '{name} ({id})', { name, id: id ?? '' });

/** Find an object by ID or name; names may carry a level prefix, e.g. “二层·主卧” or “Level 2·Bedroom” (also `:` / `：`) */
export function resolve<K extends Kind>(p: Project, kind: K, ref: string, level?: string): IndexEntry<K> {
  const all = projectIndex(p).of(kind);
  const byId = all.find(o => o.id === ref);
  if (byId) return byId;
  let name = ref, lv = level ? resolveLevel(p, level).id : undefined;
  const m = ref.match(REF_SEPARATOR);
  if (!lv && m && p.levels.some(l => l.name === m[1] || l.id === m[1])) {
    lv = resolveLevel(p, m[1]).id;
    name = m[2];
  }
  const hits = all.filter(o => o.name === name && (!lv || o.level === lv));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1)
    throw new TxError('ambiguous-ref', text('err_ambiguous_ref', '{count} objects of type {kind} are named “{name}”; use an ID or add a level: {hits}', {
      count: hits.length, kind: kindText(kind), name, hits: listText(hits.map(h => refItem(h.id, h.level))),
    }));
  const near = all.filter(o => o.name.includes(name) || name.includes(o.name)).slice(0, 8);
  if (near.length)
    throw new TxError('not-found', text('err_not_found_similar', 'Cannot find {kind} “{ref}”; similar: {similar}', { kind: kindText(kind), ref, similar: listText(near.map(h => refItem(h.name, h.id))) }));
  throw new TxError('not-found', text('err_not_found', 'Cannot find {kind} “{ref}”', { kind: kindText(kind), ref }));
}

export function resolveLevel(p: Project, ref: string): Level {
  const l = p.levels.find(x => x.id === ref || x.name === ref);
  if (!l) throw new TxError('not-found', text('err_level_not_found', 'Cannot find level “{ref}”; existing levels: {levels}', { ref, levels: listText(p.levels.map(x => refItem(x.name, x.id))) }));
  return l;
}

const getWall = (p: Project, ref: string) => resolve(p, 'wall', ref).obj;
const getSpace = (p: Project, ref: string) => resolve(p, 'space', ref).obj;
const getFurniture = (p: Project, ref: string) => resolve(p, 'furniture', ref).obj;
function getOpening(p: Project, ref: string) {
  const e = resolve(p, 'opening', ref);
  return { w: e.wall!, o: e.obj };
}

// ---------- Input fragments ----------

const zRef = (what: string) => z.string().describe(`ID or name of the ${what} (names may take a level prefix, e.g. “Level 2·Bedroom” or “二层·主卧”)`);
const zPoint = z.tuple([z.number(), z.number()]).describe('[x, y] in mm; x points east, y points south');
const zRect = z.tuple([z.number(), z.number(), z.number(), z.number()]).describe('[x, y, width (east-west), depth (north-south)] in mm; x, y is the north-west corner');
const zDirection = z.enum(['north', 'south', 'east', 'west']).describe('Direction: north / south / east / west');
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
const OPENING_EN: Record<Opening['kind'], string> = { door: 'door', 'sliding-door': 'sliding door', gate: 'gate', window: 'window', opening: 'opening' };
/** Opening kind in UI text (operation log); names in project data use names.ts instead */
const openingText = (k: Opening['kind']) => text(`log_opening_${k.replace('-', '_')}`, OPENING_EN[k]);

const toPolygon = (input: { rect?: number[]; polygon?: Point[] }): Polygon => {
  if (input.rect) {
    const [x, y, w, h] = input.rect;
    if (w <= 0 || h <= 0) throw new TxError('invalid-input', text('err_rect_size', 'Rectangle width and depth must be greater than 0'));
    return rect(x, y, x + w, y + h);
  }
  if (input.polygon && input.polygon.length >= 3) return { outer: input.polygon.map(round) };
  throw new TxError('invalid-input', text('err_shape_required', 'Needs rect or polygon'));
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- Summary output ----------

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

function spaceInfo(p: Project, s: Space) {
  const vocab = names(p);
  const walls = spaceWalls(p, s).map(b => {
    const toWall = scale(wallNormal(b.wall), -b.side);
    return { id: b.wall.id, name: b.wall.name, direction: vocab.direction[directionOf(toWall)], length: Math.round(b.length), kind: b.wall.kind, openings: b.wall.openings.map(o => o.name) };
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

function objectInfo(p: Project, id: Id) {
  const e = findObject(p, id);
  switch (e?.kind) {
    case 'wall': return wallInfo(p, e.obj);
    case 'space': return spaceInfo(p, e.obj);
    case 'opening': return openingInfo(p, e.wall!, e.obj);
    case 'furniture': return { ...e.obj, type: 'furniture', label: p.library.furniture[e.obj.type]?.name };
    case 'element': return { ...e.obj, type: 'element' };
    case 'level': return { ...e.obj, type: 'level', gross: r2(grossArea(p, e.id)) };
    case 'constraint': return { ...e.obj, type: 'constraint' };
    default: return null;
  }
}

/** Find an object of any type by name or ID */
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
  throw new TxError('not-found', text('err_object_not_found', 'Cannot find “{ref}”. Try searching with find_objects first', { ref }));
}

// ---------- Edit helpers ----------

function addWall(p: Project, level: Id, start: Point, end: Point, o: { thickness?: number; kind?: Wall['kind']; height?: number; name?: string } = {}): Wall {
  if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 50) throw new TxError('invalid-input', text('err_wall_too_short', 'Wall too short (under 50 mm)'));
  const w: Wall = {
    id: nextId(p, `${level}-w`), name: '', level, start: round(start), end: round(end),
    thickness: o.thickness ?? (o.kind === 'bearing' ? 240 : o.kind === 'railing' ? 60 : 120),
    kind: o.kind ?? 'partition', openings: [], ...(o.height ? { height: o.height } : {}),
  };
  p.walls.push(w);
  w.name = uniqueName(p.walls.filter(x => x.level === level && x !== w).map(x => x.name), o.name ?? autoWallName(p, w), p.language);
  return w;
}

function addOpening(p: Project, w: Wall, kind: Opening['kind'], o: { at?: number; width?: number; height?: number; sill?: number; swing?: Opening['swing']; glassBlock?: boolean; name?: string }): Opening {
  const d = OPENING_DEFAULTS[kind];
  const width = o.width ?? d.width;
  const at = Math.round(o.at ?? wallLength(w) / 2);
  const vocab = names(p);
  const word = o.glassBlock ? vocab.glassBlock(vocab.opening[kind]) : vocab.opening[kind];
  const taken = w.openings.map(x => x.name);
  const op: Opening = {
    id: nextId(p, `${w.id}-o`), name: o.name ?? uniqueName(taken, `${w.name}${NAME_SEPARATOR}${word}`, p.language), kind, at, width,
    height: o.height ?? d.height, sill: o.sill ?? d.sill,
    ...(kind === 'door' ? { swing: o.swing ?? { hinge: 'start', side: 'right' } } : {}),
    ...(o.glassBlock ? { glazing: 'glass-block' as const } : {}),
  };
  w.openings.push(op);
  return op;
}

/** Midpoint, along the wall, of the segment where a space meets the wall */
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

/** Add walls along each polygon edge, skipping parts already covered by walls */
function wallsAround(p: Project, level: Id, poly: Polygon, thickness: number, kind: Wall['kind']): Wall[] {
  const out: Wall[] = [];
  const ring = poly.outer;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 50) continue;
    const dir: Point = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    // Intervals covered by existing collinear walls
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
    id: nextId(p, `${level}-s`), name: uniqueName(p.spaces.filter(x => x.level === level).map(x => x.name), name, p.language),
    level, kind, shape: union(shape), floor,
  };
  p.spaces.push(s);
  return s;
}

/** Refresh auto-generated names after wall changes: only renames walls whose names are still auto-generated */
function renameWalls(p: Project, level: Id) {
  for (const w of p.walls.filter(x => x.level === level)) {
    if ((w.extras as any)?.customName) continue;
    const base = autoWallName(p, w);
    if (w.name === base || w.name.startsWith(base)) continue;
    const others = p.walls.filter(x => x.level === level && x !== w).map(x => x.name);
    const name = uniqueName(others, base, p.language);
    for (const o of w.openings) if (o.name.startsWith(`${w.name}${NAME_SEPARATOR}`)) o.name = name + o.name.slice(w.name.length);
    w.name = name;
  }
}

// ---------- Capabilities ----------

const read = defineRead, edit = defineEdit;

export const projectSummary = read({
  name: 'project_summary', title: 'Project overview', kind: 'query', permission: 'read', runtime: 'any',
  description: 'Project name, levels, gross area per level, object counts, brief and constraint overview. Call this before starting work.',
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
  name: 'find_objects', title: 'Find objects', kind: 'query', permission: 'read', runtime: 'any',
  description: 'Search walls, spaces, openings, furniture and elements by name keyword, type and level. Returns ID, name, type and level.',
  input: z.object({
    query: z.string().optional().describe('Name keyword in the language the project data uses, e.g. “Bedroom”, “north wall”, “Window” (or “老人房”, “北墙”, “窗”)'),
    type: z.enum(['wall', 'space', 'opening', 'furniture', 'element', 'level', 'constraint']).optional(),
    level: z.string().optional().describe('Level ID or name'),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  run: ({ query, type, level, limit }, { session }) => {
    const p = session.project;
    const lv = level ? resolveLevel(p, level).id : undefined;
    const kinds: Kind[] = type ? [type] : ['space', 'wall', 'opening', 'furniture', 'element', 'level', 'constraint'];
    return kinds.flatMap(k => projectIndex(p).of(k).map(o => ({ id: o.id, name: o.name, type: k, level: o.level })))
      .filter(o => (!lv || o.level === lv) && (!query || o.name.includes(query) || o.id === query))
      .slice(0, limit);
  },
});

export const getObject = read({
  name: 'get_object', title: 'View object', kind: 'query', permission: 'read', runtime: 'any',
  description: 'Get details of one object. Space: usable area, bounds, surrounding walls and their directions, neighboring spaces, furniture. Wall: endpoints, length, thickness, spaces on each side, openings. Opening: host wall, position, connected spaces.',
  input: z.object({ ref: z.string().describe('Object ID or name') }),
  run: ({ ref }, { session }) => objectInfo(session.project, findAny(session.project, ref)),
});

export const areaReportCap = read({
  name: 'area_report', title: 'Area report', kind: 'query', permission: 'read', runtime: 'any',
  description: 'Gross area per level and usable area per space (m²).',
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
  name: 'check_rules', title: 'Rule check', kind: 'verify', permission: 'read', runtime: 'any',
  description: 'Check for overlapping rooms, openings beyond the wall or overlapping, rooms without an entrance, bedrooms without a window, door leaves hitting furniture, furniture outside any space, and whether constraints are satisfied.',
  input: z.object({}),
  run: (_, { session }) => ({
    issues: checkRules(session.project),
    constraints: checkConstraints(session.project).filter(c => !c.ok),
  }),
});

export const listConstraints = read({
  name: 'list_constraints', title: 'Constraints', kind: 'query', permission: 'read', runtime: 'any',
  description: 'List all constraints and whether each is satisfied.',
  input: z.object({}),
  run: (_, { session }) => {
    const st = new Map(checkConstraints(session.project).map(s => [s.id, s]));
    return session.project.constraints.map(c => ({ ...c, ok: st.get(c.id)?.ok, status: st.get(c.id)?.message }));
  },
});

export const wallAdd = edit({
  name: 'wall_add', title: 'Add wall', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Add a straight wall on the given level. Endpoints lie on the wall centreline.',
  input: z.object({
    level: zRef('level'), start: zPoint, end: zPoint,
    thickness: z.number().positive().optional().describe('Wall thickness; defaults to 120 for partitions, 240 for bearing walls'),
    kind: zWallKind.default('partition'), height: z.number().positive().optional(), name: z.string().optional(),
  }),
  label: () => text('log_wall_add', 'Add wall'),
  apply: (p, i) => {
    const w = addWall(p, resolveLevel(p, i.level).id, i.start, i.end, i);
    if (i.name) w.extras = { ...w.extras, customName: true };
    return { id: w.id, name: w.name };
  },
  examples: [{ input: { level: 'L1', start: [3000, 120], end: [3000, 3600], thickness: 120 }, note: 'Add a north-south partition on level 1' }],
});

export const wallMove = edit({
  name: 'wall_move', title: 'Move wall', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Translate a wall perpendicular to itself. Connected walls stretch to follow, the boundaries of spaces on both sides update, and openings keep their position on the wall.',
  input: z.object({
    wall: zRef('wall'),
    direction: zDirection.optional(), distance: z.number().optional().describe('Distance to move (mm)'),
    to: z.number().optional().describe('Move directly to a coordinate: y for east-west walls, x for north-south walls'),
  }),
  label: (i, p) => text('log_wall_move', 'Move {wall}', { wall: resolve(p, 'wall', i.wall).name }),
  apply: (p, i) => {
    const w = getWall(p, i.wall);
    const n = wallNormal(w);
    let v: Point;
    if (i.to != null) {
      const horiz = Math.abs(n[1]) > Math.abs(n[0]);
      v = horiz ? [0, i.to - w.start[1]] : [i.to - w.start[0], 0];
    } else {
      if (!i.direction || i.distance == null) throw new TxError('invalid-input', text('err_direction_or_to', 'Needs direction + distance, or to'));
      v = scale(DIR_VEC[i.direction], i.distance);
    }
    // Keep only the component perpendicular to the wall
    const k = dot(v, n);
    if (Math.abs(k) < 1) throw new TxError('invalid-input', text('err_move_parallel', '{wall} cannot move in this direction (it is parallel to the wall)', { wall: w.name }));
    moveWall(p, w.id, round(scale(n, k)));
    renameWalls(p, w.level);
    return { id: w.id, start: w.start, end: w.end };
  },
  examples: [{ input: { wall: '老人房一西墙', direction: 'west', distance: 500 }, note: 'Move 老人房一西墙 0.5 m west' }],
});

export const wallUpdate = edit({
  name: 'wall_update', title: 'Edit wall', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Change a wall\'s thickness, kind, height or name.',
  input: z.object({ wall: zRef('wall'), thickness: z.number().positive().optional(), kind: zWallKind.optional(), height: z.number().positive().nullable().optional(), name: z.string().optional() }),
  label: (i, p) => text('log_wall_update', 'Edit {wall}', { wall: resolve(p, 'wall', i.wall).name }),
  apply: (p, i) => {
    const w = getWall(p, i.wall);
    if (i.thickness) w.thickness = i.thickness;
    if (i.kind) w.kind = i.kind;
    if (i.height === null) delete w.height;
    else if (i.height) w.height = i.height;
    if (i.name) {
      const old = w.name;
      w.name = uniqueName(p.walls.filter(x => x.level === w.level && x !== w).map(x => x.name), i.name, p.language);
      w.extras = { ...w.extras, customName: true };
      for (const o of w.openings) if (o.name.startsWith(`${old}${NAME_SEPARATOR}`)) o.name = w.name + o.name.slice(old.length);
    }
    return { id: w.id };
  },
});

export const wallRemove = edit({
  name: 'wall_remove', title: 'Remove wall', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Remove a wall (with its openings). Spaces on both sides are not merged automatically; use space_merge if needed.',
  input: z.object({ wall: zRef('wall') }),
  label: (i, p) => text('log_wall_remove', 'Remove {wall}', { wall: resolve(p, 'wall', i.wall).name }),
  apply: (p, i) => {
    const w = getWall(p, i.wall);
    if (w.kind === 'bearing') throw new TxError('structural', text('err_remove_bearing_wall', '{wall} is a bearing wall: removing it affects structural safety and needs professional review. Confirm with the owner and change it to a partition before removing it', { wall: w.name }));
    p.walls = p.walls.filter(x => x.id !== w.id);
    p.constraints = p.constraints.filter(c => !c.targets.includes(w.id) && !w.openings.some(o => c.targets.includes(o.id)));
    return { removed: w.id };
  },
});

export const openingAdd = edit({
  name: 'opening_add', title: 'Add opening', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Add a door, window, sliding door or opening to a wall. Position it with at (distance from the opening centre to the wall start) or center_on (centred on the segment where a space meets this wall); with neither it goes at the wall midpoint.',
  input: z.object({
    wall: zRef('wall'), kind: zOpeningKind,
    at: z.number().optional(), center_on: z.string().optional().describe('Space ID or name'),
    width: z.number().positive().optional(), height: z.number().positive().optional(), sill: z.number().min(0).optional().describe('Sill height (mm)'),
    swing: z.object({ hinge: z.enum(['start', 'end']), side: z.enum(['left', 'right']) }).optional().describe('Hinge end and swing side of a swing door (looking from start → end)'),
    glass_block: z.boolean().optional(), name: z.string().optional(),
  }),
  label: (i, p) => text('log_opening_add', 'Add a {opening} to {wall}', { wall: resolve(p, 'wall', i.wall).name, opening: openingText(i.kind) }),
  apply: (p, i) => {
    const w = getWall(p, i.wall);
    let at = i.at;
    if (at == null && i.center_on) {
      const c = centerOnSpace(w, getSpace(p, i.center_on));
      if (c == null) throw new TxError('invalid-input', text('err_not_adjacent', '{space} does not touch {wall}', { space: i.center_on, wall: w.name }));
      at = c;
    }
    const o = addOpening(p, w, i.kind, { ...i, at, glassBlock: i.glass_block });
    return { id: o.id, name: o.name, at: o.at };
  },
  examples: [{ input: { wall: '主卧北墙', kind: 'window', width: 1500, center_on: '主卧' }, note: 'Add a 1.5 m wide window centred on 主卧北墙' }],
});

export const openingUpdate = edit({
  name: 'opening_update', title: 'Edit opening', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Change an opening\'s position, size, kind or swing.',
  input: z.object({
    opening: zRef('opening'), at: z.number().optional(), move_by: z.number().optional().describe('Move along the wall (mm; positive toward the wall end)'),
    width: z.number().positive().optional(), height: z.number().positive().optional(), sill: z.number().min(0).optional(), kind: zOpeningKind.optional(),
    swing: z.object({ hinge: z.enum(['start', 'end']), side: z.enum(['left', 'right']) }).optional(), name: z.string().optional(),
  }),
  label: (i, p) => text('log_opening_update', 'Edit {opening}', { opening: resolve(p, 'opening', i.opening).name }),
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
  name: 'opening_remove', title: 'Close opening', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Close up (remove) an opening.',
  input: z.object({ opening: zRef('opening') }),
  label: (i, p) => text('log_opening_remove', 'Close up {opening}', { opening: resolve(p, 'opening', i.opening).name }),
  apply: (p, i) => {
    const { w, o } = getOpening(p, i.opening);
    w.openings = w.openings.filter(x => x.id !== o.id);
    p.constraints = p.constraints.filter(c => !c.targets.includes(o.id));
    return { removed: o.id };
  },
});

const zShape = { rect: zRect.optional(), polygon: z.array(zPoint).optional().describe('Vertices of an arbitrary polygon (in order)') };

export const roomAdd = edit({
  name: 'room_add', title: 'Add room', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Add a room: creates the space and adds walls wherever its edges have none (existing walls are reused). Can also add a door on one side. Use it to build a design room by room from scratch.',
  input: z.object({
    level: zRef('level'), name: z.string(), ...zShape,
    kind: zSpaceKind.default('indoor'), floor: z.string().default('oak').describe('Floor material category'),
    wall_thickness: z.number().positive().default(120), wall_kind: zWallKind.default('partition'),
    door: z.object({ side: zDirection, width: z.number().positive().optional() }).optional().describe('Which side\'s wall gets a centred door'),
  }),
  label: i => text('log_room_add', 'Add room “{name}”', { name: i.name }),
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
      if (!b) throw new TxError('invalid-input', text('err_no_wall_for_door', 'There is no wall on the {side} side of {space} to put a door in', { space: s.name, side: text(`err_side_${i.door.side}`, i.door.side) }));
      door = addOpening(p, b.wall, 'door', { at: centerOnSpace(b.wall, s) ?? undefined, width: i.door.width });
    }
    return { id: s.id, name: s.name, walls: walls.map(w => ({ id: w.id, name: w.name })), door: door && { id: door.id, name: door.name } };
  },
  examples: [{ input: { level: 'L2', name: '书房', rect: [10000, 120, 3000, 3480], door: { side: 'south' } }, note: 'Add a 3 × 3.48 m study on level 2 with a door in the south wall' }],
});

export const spaceAdd = edit({
  name: 'space_add', title: 'Define space', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Define a space only (e.g. courtyard, terrace, corridor), without adding walls.',
  input: z.object({ level: zRef('level'), name: z.string(), ...zShape, kind: zSpaceKind.default('indoor'), floor: z.string().default('tile') }),
  label: i => text('log_space_add', 'Define space “{name}”', { name: i.name }),
  apply: (p, i) => {
    const level = resolveLevel(p, i.level).id;
    const s = addSpace(p, level, i.name, [toPolygon(i)], i.kind, i.floor);
    return { id: s.id, name: s.name };
  },
});

export const spaceUpdate = edit({
  name: 'space_update', title: 'Edit space', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Change a space\'s name, kind or floor material, or redefine its extent with rect / polygon (walls are not moved).',
  input: z.object({ space: zRef('space'), name: z.string().optional(), kind: zSpaceKind.optional(), floor: z.string().optional(), ...zShape }),
  label: (i, p) => text('log_space_update', 'Edit {space}', { space: resolve(p, 'space', i.space).name }),
  apply: (p, i) => {
    const s = getSpace(p, i.space);
    if (i.name) {
      s.name = uniqueName(p.spaces.filter(x => x.level === s.level && x !== s).map(x => x.name), i.name, p.language);
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
  name: 'space_remove', title: 'Delete space', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Delete a space. With walls=true, also removes partitions that belong only to this space (bearing walls are kept).',
  input: z.object({ space: zRef('space'), walls: z.boolean().default(false) }),
  label: (i, p) => text('log_space_remove', 'Delete {space}', { space: resolve(p, 'space', i.space).name }),
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
  name: 'space_merge', title: 'Merge spaces', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Merge several adjacent spaces into one (removing the partitions between them).',
  input: z.object({ spaces: z.array(zRef('space')).min(2), name: z.string().optional() }),
  label: (i, p) => text('log_space_merge', 'Merge {spaces}', { spaces: listText(i.spaces.map(s => resolve(p, 'space', s).name)) }),
  apply: (p, i) => {
    const ss = i.spaces.map(r => getSpace(p, r));
    const level = ss[0].level;
    if (ss.some(s => s.level !== level)) throw new TxError('invalid-input', text('err_merge_other_level', 'Only spaces on the same level can be merged'));
    const between = p.walls.filter(w => w.level === level && ss.filter(s => sharedLength(w, s) > 100).length >= 2);
    if (between.some(w => w.kind === 'bearing')) throw new TxError('structural', text('err_merge_bearing_wall', 'There is a bearing wall between them: removing it affects structural safety and needs professional review'));
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
  name: 'space_set_area', title: 'Set area', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Move one wall of a space so its usable area approaches the target (m²). Without a wall given, a partition is chosen automatically. Neighboring spaces shrink or grow accordingly.',
  input: z.object({ space: zRef('space'), area: z.number().positive().describe('Target usable area (m²)'), wall: z.string().optional().describe('Wall to move') }),
  label: (i, p) => text('log_space_set_area', 'Resize {space} to about {area} m²', { space: resolve(p, 'space', i.space).name, area: i.area }),
  apply: (p, i) => {
    const s = getSpace(p, i.space);
    const sol = solveAreaMove(p, s.id, i.area, i.wall ? getWall(p, i.wall).id : undefined);
    if (!sol) throw new TxError('cannot-resize', text('err_cannot_resize', '{space} has no suitable wall to move; specify wall', { space: s.name }));
    moveWall(p, sol.wall.id, sol.vector);
    renameWalls(p, s.level);
    return { space: s.id, wall: { id: sol.wall.id, name: sol.wall.name }, moved: sol.vector, area: r2(sol.area) };
  },
  examples: [{ input: { space: '老人房一', area: 12 }, note: 'Resize 老人房一 to about 12 m²' }],
});

export const furnitureAdd = edit({
  name: 'furniture_add', title: 'Place furniture', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Place a piece of furniture. type is a furniture category (see furnitureTypes in project_summary; a new category is allowed if size is given). Without position it goes at the centre of space.',
  input: z.object({
    level: zRef('level').optional(), type: z.string(), position: zPoint.optional(), space: z.string().optional(),
    rotation: z.number().default(0).describe('Clockwise rotation (degrees)'),
    size: z.object({ w: z.number().positive(), d: z.number().positive(), h: z.number().positive() }).optional(),
    elevation: z.number().optional(), label: z.string().optional().describe('Display name of a new category, in the language the project data uses'),
  }),
  label: (i, p) => text('log_furniture_add', 'Place {type}', { type: p.library.furniture[i.type]?.name ?? i.label ?? i.type }),
  apply: (p, i) => {
    const s = i.space ? getSpace(p, i.space) : undefined;
    const level = s?.level ?? (i.level ? resolveLevel(p, i.level).id : undefined);
    if (!level) throw new TxError('invalid-input', text('err_level_or_space', 'Needs level or space'));
    let pos = i.position;
    if (!pos && s) {
      const xs = s.shape.flatMap(q => q.outer.map(v => v[0])), ys = s.shape.flatMap(q => q.outer.map(v => v[1]));
      pos = [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)];
    }
    if (!pos) throw new TxError('invalid-input', text('err_position_or_space', 'Needs position or space'));
    const def = p.library.furniture[i.type];
    if (!def) {
      if (!i.size) throw new TxError('invalid-input', text('err_unknown_furniture', 'Furniture category {type} is not registered; give size (and label)', { type: i.type }));
      p.library.furniture[i.type] = { name: i.label ?? i.type, size: i.size };
    }
    const size = i.size ?? def.size;
    const host = p.spaces.find(x => x.level === level && x.shape.some(q => pointInPolygon(pos!, q)));
    const label = p.library.furniture[i.type].name;
    const f: Furniture = {
      id: nextId(p, `${level}-f`), name: uniqueName(p.furniture.filter(x => x.level === level).map(x => x.name), host ? `${host.name}${NAME_SEPARATOR}${label}` : label, p.language),
      type: i.type, level, position: round(pos), rotation: i.rotation, size: { ...size }, ...(i.elevation ? { elevation: i.elevation } : {}),
    };
    p.furniture.push(f);
    return { id: f.id, name: f.name };
  },
});

export const furnitureMove = edit({
  name: 'furniture_move', title: 'Move furniture', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Move or rotate furniture: position for an absolute location or by for a relative offset; rotation for the new angle.',
  input: z.object({ furniture: zRef('furniture'), position: zPoint.optional(), by: zPoint.optional(), rotation: z.number().optional() }),
  label: (i, p) => text('log_furniture_move', 'Move {furniture}', { furniture: resolve(p, 'furniture', i.furniture).name }),
  apply: (p, i) => {
    const f = getFurniture(p, i.furniture);
    if (i.position) f.position = round(i.position);
    if (i.by) f.position = round(add(f.position, i.by));
    if (i.rotation != null) f.rotation = i.rotation;
    return { id: f.id, position: f.position };
  },
});

export const furnitureRemove = edit({
  name: 'furniture_remove', title: 'Remove furniture', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Remove a piece of furniture.',
  input: z.object({ furniture: zRef('furniture') }),
  label: (i, p) => text('log_furniture_remove', 'Remove {furniture}', { furniture: resolve(p, 'furniture', i.furniture).name }),
  apply: (p, i) => {
    const f = getFurniture(p, i.furniture);
    p.furniture = p.furniture.filter(x => x.id !== f.id);
    return { removed: f.id };
  },
});

export const levelAdd = edit({
  name: 'level_add', title: 'Add level', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Add a level above the topmost non-roof level (the roof level moves up). With copy_from, copies that level\'s walls and spaces (not furniture).',
  input: z.object({ name: z.string(), height: z.number().positive().default(3000), copy_from: z.string().optional() }),
  label: i => text('log_level_add', 'Add level “{name}”', { name: i.name }),
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
  name: 'level_remove', title: 'Delete level', kind: 'edit', permission: 'main', runtime: 'any',
  description: 'Delete a level with all its walls, spaces and furniture. Levels above move down. Affects the main design and needs owner confirmation.',
  input: z.object({ level: zRef('level') }),
  label: (i, p) => text('log_level_remove', 'Delete {level}', { level: resolveLevel(p, i.level).name }),
  apply: (p, i) => {
    const lv = resolveLevel(p, i.level);
    if (p.levels.filter(l => !l.roof).length <= 1 && !lv.roof) throw new TxError('invalid-input', text('err_last_level', 'At least one level must remain'));
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
  name: 'constraint_add', title: 'Add constraint', kind: 'relation', permission: 'reversible', runtime: 'any',
  description: [
    'Store a relationship stated by the owner as a constraint, maintained automatically on later edits. Supported: ',
    'align (targets: several parallel walls, kept collinear); ',
    'center (targets: [opening, space]; the opening is centred on that space\'s segment of the wall); ',
    'spacing (targets: [opening or wall, wall], params.distance in mm: clear distance from the opening edge to the wall face, or centre-to-centre distance of two parallel walls); ',
    'size-target (targets: [space, optional wall], params.area in m², params.tolerance default 0.3). ',
    'With hard=true, violating operations are rejected. source: user if the owner said it, agent if you inferred it.',
  ].join(''),
  input: z.object({
    type: z.enum(SUPPORTED_CONSTRAINTS as [string, ...string[]]),
    targets: z.array(z.string()).min(1).describe('Object IDs or names'),
    params: z.record(z.string(), z.unknown()).default({}),
    hard: z.boolean().default(false), source: z.enum(['user', 'agent', 'default']).default('user'),
    note: z.string().optional().describe('Record in the owner\'s own words'),
  }),
  label: i => text('log_constraint_add', 'Add constraint: {note}', { note: i.note ?? i.type }),
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
    { input: { type: 'center', targets: ['主卧南墙·门', '主卧'], note: '门在房间中线上' }, note: 'Centre a door' },
    { input: { type: 'size-target', targets: ['老人房一'], params: { area: 12 }, note: '老人房一约 12 平' }, note: 'Area target' },
  ],
});

export const constraintRemove = edit({
  name: 'constraint_remove', title: 'Delete constraint', kind: 'relation', permission: 'reversible', runtime: 'any',
  description: 'Delete a constraint.',
  input: z.object({ constraint: z.string() }),
  label: i => text('log_constraint_remove', 'Delete constraint {id}', { id: i.constraint }),
  apply: (p, i) => {
    const id = resolve(p, 'constraint', i.constraint).id;
    p.constraints = p.constraints.filter(c => c.id !== id);
    return { removed: id };
  },
});

export const briefUpdate = edit({
  name: 'brief_update', title: 'Record brief', kind: 'relation', permission: 'reversible', runtime: 'any',
  description: 'Record or update the owner\'s brief: household members, room list, preferences, budget, notes. Array fields are replaced wholesale.',
  input: z.object({
    household: z.array(z.string()).optional(), rooms: z.array(z.string()).optional(), preferences: z.array(z.string()).optional(),
    budget: z.string().optional(), notes: z.array(z.string()).optional(),
  }),
  label: () => text('log_brief_update', 'Update brief'),
  apply: (p, i) => {
    p.brief = { ...p.brief, ...Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined)) };
    return p.brief;
  },
});

export const decisionAdd = edit({
  name: 'decision_add', title: 'Record decision', kind: 'relation', permission: 'reversible', runtime: 'any',
  description: 'Write a trade-off to the decision log: what was done, why, and which options were rejected.',
  input: z.object({ summary: z.string(), reason: z.string().optional(), rejected: z.array(z.string()).optional() }),
  label: i => text('log_decision_add', 'Record decision: {summary}', { summary: i.summary }),
  apply: (p, i) => {
    const d = { id: nextId(p, 'd-'), at: new Date().toISOString(), ...i };
    p.decisions.push(d);
    return { id: d.id };
  },
});

export const historyUndo = defineRead({
  name: 'history_undo', title: 'Undo', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Undo the last change.',
  input: z.object({}),
  run: (_, { session }) => {
    const e = session.undo();
    return e ? { undone: e.label, changed: e.changed } : { undone: null };
  },
});

export const historyRedo = defineRead({
  name: 'history_redo', title: 'Redo', kind: 'edit', permission: 'reversible', runtime: 'any',
  description: 'Redo the change just undone.',
  input: z.object({}),
  run: (_, { session }) => {
    const e = session.redo();
    return e ? { redone: e.label, changed: e.changed } : { redone: null };
  },
});

export const historyLog = read({
  name: 'history_log', title: 'Operation log', kind: 'query', permission: 'read', runtime: 'any',
  description: 'Operation log for this session: who, when, what and why.',
  input: z.object({ limit: z.number().int().positive().default(20) }),
  run: ({ limit }, { session }) => session.log.slice(-limit),
});

/** Batch: several edits combined into one transaction, undone together */
export function batchCapability(registry: Registry) {
  return edit({
    name: 'batch', title: 'Batch edit', kind: 'edit', permission: 'reversible', runtime: 'any',
    description: 'Run several edit capabilities as one step: all succeed or all roll back, and they undo together. Use for large changes or building a design from scratch.',
    input: z.object({
      label: z.string().describe('One-sentence summary of this batch'),
      calls: z.array(z.object({ name: z.string(), input: z.record(z.string(), z.unknown()).default({}) })).min(1).max(60),
    }),
    label: i => i.label,
    apply: (p, i, ctx: CapabilityContext) => {
      const results: unknown[] = [];
      for (const [k, call] of i.calls.entries()) {
        const c = registry.get(call.name);
        if (!c || c.mode !== 'edit' || c.name === 'batch') throw new TxError('invalid-input', text('err_batch_not_edit', 'Step {step}: {name} is not an edit capability that can be batched', { step: k + 1, name: call.name }));
        const parsed = c.input.safeParse(call.input);
        if (!parsed.success) throw new TxError('invalid-input', text('err_batch_step', 'Step {step} ({name}): {message}', { step: k + 1, name: call.name, message: z.prettifyError(parsed.error) }));
        try {
          results.push(c.apply(p, parsed.data, ctx));
        } catch (e) {
          if (e instanceof TxError) throw new TxError(e.code, text('err_batch_step', 'Step {step} ({name}): {message}', { step: k + 1, name: call.name, message: e.message }));
          throw e;
        }
      }
      return results;
    },
  });
}

export const searchCapabilitiesFor = (registry: Registry) => read({
  name: 'search_capabilities', title: 'Search capabilities', kind: 'query', permission: 'read', runtime: 'any',
  description: 'Search available capabilities by keyword; returns name, description, input schema and examples.',
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

/** Built-in capability registry (including batch and search_capabilities) */
export function createRegistry(extra: Capability[] = []): Registry {
  const r = new Registry([...BUILTIN, ...extra]);
  r.register(batchCapability(r));
  r.register(searchCapabilitiesFor(r));
  return r;
}

