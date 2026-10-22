/**
 * 把旧页面（乌石合院）导出的方案数据转换成 Plinth 项目数据规范。
 * 输入是 scripts/extract-legacy.mjs 抓下来的 legacy.json，只在导入时用一次。
 */
import { rect, union, pointInPolygon } from '../geometry.js';
import {
  SCHEMA, SCHEMA_VERSION,
  type Element, type Furniture, type Level, type Opening, type OpeningKind, type Project, type Space,
  type SpaceKind, type Wall, type WallKind,
} from '../schema.js';

interface LRect { x: number; y: number; w: number; h: number }
interface LOp { type: string; c: number; w: number; h: number; sill: number; hinge?: string; side?: number; gb?: number; [k: string]: unknown }
interface LWall { x1: number; y1: number; x2: number; y2: number; t: number; bearing: boolean; kind: string; h: number | null; ops: LOp[]; slope: number }
interface LRoom { name: string; mat: string; kind: string; rects: LRect[]; stair?: number; hole?: number }
interface LFurn { k: string; x: number; y: number; rot: number; w: number; d: number; h: number; z?: number }
export interface LegacyExport {
  scheme: number;
  name: string;
  design: { floors: { walls: LWall[]; rooms: LRoom[]; furn: LFurn[] }[] };
  cfg: Record<string, unknown> & { stair: Record<string, unknown> };
  consts: {
    LAT: number; LON: number; TZ: number; GL: number; FB: number[]; FN: string[];
    SITE: { x0: number; w: number; h: number };
    STAIR: unknown; SX: unknown; POND: { x: number; y: number; r: number }; DRAINS: number[][];
  };
  catalog: Record<string, { n: string; g: string; w: number; d: number; h: number }>;
  materials: Record<string, { n: string; size: number }>;
}

const WALL_KIND: Record<string, WallKind> = { fence: 'fence', parapet: 'parapet', rail: 'railing' };
const WALL_WORD: Record<WallKind, string> = { bearing: '墙', partition: '墙', fence: '围墙', parapet: '女儿墙', railing: '栏杆' };
const OP_KIND: Record<string, OpeningKind> = { door: 'door', slide: 'sliding-door', gate: 'gate', win: 'window', open: 'opening' };
const OP_WORD: Record<OpeningKind, string> = { door: '门', 'sliding-door': '推拉门', gate: '大门', window: '窗', opening: '洞口' };
const SPACE_KIND: Record<string, SpaceKind> = { in: 'indoor', semi: 'semi-outdoor', out: 'outdoor', roof: 'roof-terrace', void: 'void' };
const LEVEL_IDS = ['L1', 'L2', 'L3', 'L4', 'L5'];
const pad = (n: number) => String(n).padStart(2, '0');

/** 同一楼层内重名时加序号：客厅北墙、客厅北墙（2） */
function namer() {
  const seen = new Map<string, number>();
  return (base: string) => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}（${n}）`;
  };
}

/**
 * 按墙两侧的空间给墙起名。一侧贴着多个室内空间、另一侧没有室内空间的叫“北外墙”；
 * 其余取贴合最长的空间（室内优先）：“老人房二西墙”。
 */
function wallName(w: LWall, rooms: LRoom[], kind: WallKind): string {
  const horiz = w.y1 === w.y2, tol = 5;
  const rank: Record<string, number> = { in: 3, semi: 2, roof: 1, out: 1, void: 0 };
  const indoorBySide = new Map<string, Set<string>>();
  let best: { name: string; side: string; score: number } | null = null;
  for (const r of rooms) for (const q of r.rects) {
    let side = '', overlap = 0;
    if (horiz) {
      overlap = Math.min(q.x + q.w, w.x2) - Math.max(q.x, w.x1);
      if (Math.abs(q.y - w.y1) <= tol) side = '北';
      else if (Math.abs(q.y + q.h - w.y1) <= tol) side = '南';
    } else {
      overlap = Math.min(q.y + q.h, w.y2) - Math.max(q.y, w.y1);
      if (Math.abs(q.x - w.x1) <= tol) side = '西';
      else if (Math.abs(q.x + q.w - w.x1) <= tol) side = '东';
    }
    if (!side || overlap <= 0) continue;
    if (r.kind === 'in') indoorBySide.set(side, (indoorBySide.get(side) ?? new Set()).add(r.name));
    const score = rank[r.kind] * 1e6 + overlap;
    if (!best || score > best.score) best = { name: r.name, side, score };
  }
  if ((kind === 'bearing' || kind === 'partition') && indoorBySide.size === 1) {
    const [[side, names]] = indoorBySide;
    if (names.size > 1) return `${side}外墙`;
  }
  if (best) return `${best.name}${best.side}${WALL_WORD[kind]}`;
  const dir = horiz ? '东西向' : '南北向';
  return `${dir}${WALL_WORD[kind]}`;
}

export function fromLegacy(src: LegacyExport): Project {
  const { consts: C } = src;
  const floors = src.design.floors;
  const levels: Level[] = floors.map((_, i) => {
    const roof = i === floors.length - 1;
    const elevation = Math.round(C.FB[i] * 1000);
    return {
      id: roof ? 'RF' : LEVEL_IDS[i],
      name: C.FN[i],
      elevation,
      height: roof ? 0 : Math.round((C.FB[i + 1] - C.FB[i]) * 1000),
      ...(roof ? { roof: true } : {}),
    };
  });

  const walls: Wall[] = [], spaces: Space[] = [], furniture: Furniture[] = [];
  const usedFurn = new Set<string>(), usedMats = new Set<string>();

  floors.forEach((fl, li) => {
    const level = levels[li];
    const wallNames = namer();
    fl.walls.forEach((w, wi) => {
      const kind: WallKind = WALL_KIND[w.kind] ?? (w.bearing ? 'bearing' : 'partition');
      const name = wallNames(wallName(w, fl.rooms, kind));
      // 同一面墙上同类洞口从起点往终点编号：北外墙·窗1、北外墙·窗2
      const word = (o: LOp) => {
        const k = OP_KIND[o.type];
        if (!k) throw new Error(`未知洞口类型 ${o.type}`);
        return (o.gb ? '玻璃砖' : '') + OP_WORD[k];
      };
      const total = new Map<string, number>(), seq = new Map<string, number>();
      for (const o of w.ops) total.set(word(o), (total.get(word(o)) ?? 0) + 1);
      const openings: Opening[] = [...w.ops].sort((a, b) => a.c - b.c).map((o, oi) => {
        const k = OP_KIND[o.type], label = word(o), n = (seq.get(label) ?? 0) + 1;
        seq.set(label, n);
        const { type, c, w: width, h, sill, hinge, side, gb, id, ...rest } = o;
        return {
          id: `${level.id}-w${pad(wi + 1)}-o${oi + 1}`,
          name: `${name}·${label}${total.get(label)! > 1 ? n : ''}`,
          kind: k,
          at: c,
          width,
          height: h,
          sill,
          // 旧数据 side 沿墙法线 (-dy, dx) 计正负，y 向南时正向即沿起点→终点的右侧
          ...(k === 'door' ? { swing: { hinge: hinge === 'e' ? 'end' : 'start', side: (side ?? -1) > 0 ? 'right' : 'left' } } : {}),
          ...(gb ? { glazing: 'glass-block' as const } : {}),
          ...(Object.keys(rest).length ? { extras: rest } : {}),
        } satisfies Opening;
      });
      walls.push({
        id: `${level.id}-w${pad(wi + 1)}`,
        name,
        level: level.id,
        start: [w.x1, w.y1],
        end: [w.x2, w.y2],
        thickness: w.t,
        kind,
        ...(w.h != null ? { height: w.h } : {}),
        openings,
        ...(w.slope ? { extras: { slope: w.slope } } : {}),
      });
    });

    const spaceNames = namer();
    const levelSpaces: Space[] = fl.rooms.map((r, ri) => {
      usedMats.add(r.mat);
      return {
        id: `${level.id}-s${pad(ri + 1)}`,
        name: spaceNames(r.name),
        level: level.id,
        kind: SPACE_KIND[r.kind],
        shape: union(r.rects.map(q => rect(q.x, q.y, q.x + q.w, q.y + q.h))),
        floor: r.mat,
        ...(r.hole ? { slabOpening: true } : {}),
        ...(r.stair ? { extras: { stair: true } } : {}),
      };
    });
    spaces.push(...levelSpaces);

    const furnNames = namer();
    fl.furn.forEach((it, fi) => {
      usedFurn.add(it.k);
      const host = levelSpaces.find(s => s.shape.some(p => pointInPolygon([it.x, it.y], p)));
      const label = src.catalog[it.k]?.n ?? it.k;
      furniture.push({
        id: `${level.id}-f${pad(fi + 1)}`,
        name: furnNames(host ? `${host.name}·${label}` : label),
        type: it.k,
        level: level.id,
        position: [it.x, it.y],
        rotation: it.rot,
        size: { w: it.w, d: it.d, h: it.h },
        ...(it.z ? { elevation: it.z } : {}),
      });
    });
  });

  const top = levels[levels.length - 1].id;
  const elements: Element[] = [
    {
      id: 'e-stair', name: '楼梯', type: 'legacy-stair', level: 'L1', topLevel: top,
      params: { ...src.cfg.stair, footprint: C.STAIR, flights: C.SX },
    },
    { id: 'e-pond', name: '鱼池', type: 'pond', level: 'L1', params: { center: [C.POND.x, C.POND.y], radius: C.POND.r, sweep: 'quarter-ne' } },
    ...C.DRAINS.map(([x, y, w, h], i): Element => ({
      id: `e-drain-${i + 1}`, name: `排水沟${i + 1}`, type: 'drain', level: 'L1', params: { rect: [x, y, w, h] },
    })),
  ];

  const pick = <T>(keys: Set<string>, f: (k: string) => T) => Object.fromEntries([...keys].sort().map(k => [k, f(k)]));
  const { stair: _s, desc: _d, beams, piers, walk, walkTo } = src.cfg as Record<string, unknown>;
  const legacyExtras = Object.fromEntries(
    Object.entries({ beams, piers, walk, walkTo }).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)),
  );

  return {
    schema: SCHEMA,
    version: SCHEMA_VERSION,
    id: `wushi-courtyard-${src.scheme}`,
    name: `乌石合院 · ${src.name}`,
    units: 'mm',
    site: {
      boundary: rect(C.SITE.x0, 0, C.SITE.x0 + C.SITE.w, C.SITE.h).outer,
      northAngle: 0,
      location: { lat: C.LAT, lon: C.LON, tz: C.TZ },
      groundLevel: Math.round(C.GL * 1000),
    },
    levels,
    walls,
    spaces,
    elements,
    furniture,
    constraints: [],
    brief: {},
    decisions: [],
    library: {
      furniture: pick(usedFurn, k => {
        const c = src.catalog[k];
        return { name: c.n, group: c.g, size: { w: c.w, d: c.d, h: c.h } };
      }),
      materials: pick(usedMats, k => ({ name: src.materials[k].n, tileSize: src.materials[k].size })),
      elements: {
        'legacy-stair': { name: '楼梯（旧页面参数）', version: 1, note: '参数照搬旧页面，第 5 步改写成正式的楼梯构件' },
        pond: { name: '鱼池', version: 1, note: '四分之一圆，圆心在用地西南角，向东北展开' },
        drain: { name: '排水沟', version: 1 },
      },
    },
    variants: [],
    ...(Object.keys(legacyExtras).length ? { extras: { legacy: legacyExtras } } : {}),
  };
}
