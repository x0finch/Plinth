/**
 * 约束求解：对齐、居中、间距、面积目标四类。每类约束有一个“修复”动作，按轮迭代直到全部满足或达到上限。
 * 硬约束修不好会让事务回滚；软约束修不好只给警告。
 */
import { current, isDraft } from 'immer';
import {
  cross, dot, moveWall, project as projectPoint, scale, sideOf, spaceNetArea, spaceWalls, sub, wallDir,
  wallLength, wallNormal,
} from './topology.js';
import type { Constraint, Id, Point, Project, Space, Wall } from './schema.js';

export interface ConstraintStatus {
  id: Id;
  ok: boolean;
  hard: boolean;
  message: string;
}

export interface ConstraintReport {
  rounds: number;
  violatedHard: ConstraintStatus[];
  violatedSoft: ConstraintStatus[];
}

const plain = (p: Project): Project => JSON.parse(JSON.stringify(isDraft(p) ? current(p) : p));

const findWall = (p: Project, id: Id) => p.walls.find(w => w.id === id);
const findSpace = (p: Project, id: Id) => p.spaces.find(s => s.id === id);
function findOpening(p: Project, id: Id) {
  for (const w of p.walls) {
    const o = w.openings.find(x => x.id === id);
    if (o) return { w, o };
  }
  return null;
}

const parallel = (a: Wall, b: Wall) => Math.abs(cross(wallDir(a), wallDir(b))) < 1e-6;
/** b 的中心线相对 a 的中心线沿 a 法线的偏移 */
const offsetBetween = (a: Wall, b: Wall) => dot(sub(b.start, a.start), wallNormal(a));

/** 洞口所在墙与空间边界重合的区间 */
function sharedInterval(w: Wall, s: Space): [number, number] | null {
  const d = wallDir(w), L = wallLength(w);
  let lo = Infinity, hi = -Infinity;
  for (const poly of s.shape) {
    const r = poly.outer;
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      const pa = projectPoint(w, a), pb = projectPoint(w, b);
      if (pa.dist > 5 || pb.dist > 5 || Math.abs(cross(d, sub(b, a))) > 10) continue;
      lo = Math.min(lo, Math.max(0, Math.min(pa.at, pb.at)));
      hi = Math.max(hi, Math.min(L, Math.max(pa.at, pb.at)));
    }
  }
  return hi > lo ? [lo, hi] : null;
}

/** 选一面用来调面积的墙：优先隔墙、贴合最长 */
export function pickResizeWall(p: Project, s: Space): Wall | null {
  const cands = spaceWalls(p, s).filter(b => b.wall.kind === 'partition' || b.wall.kind === 'bearing');
  cands.sort((a, b) => (a.wall.kind === 'partition' ? 0 : 1) - (b.wall.kind === 'partition' ? 0 : 1) || b.length - a.length);
  return cands[0]?.wall ?? null;
}

/**
 * 移动一面墙让空间使用面积接近目标（㎡）。返回位移向量（毫米），不修改 p。
 * 面积对位移基本是线性的，用两次割线法求解，结果取整到 10 mm。
 */
export function solveAreaMove(p: Project, spaceId: Id, target: number, wallId?: Id): { wall: Wall; vector: Point; area: number } | null {
  const s = findSpace(p, spaceId);
  if (!s) return null;
  const w = wallId ? findWall(p, wallId) : pickResizeWall(p, s);
  if (!w) return null;
  const out = scale(wallNormal(w), -sideOf(w, s)); // 朝空间外
  const areaAt = (d: number) => {
    const q = plain(p);
    if (d) moveWall(q, w.id, scale(out, d));
    return spaceNetArea(q, findSpace(q, spaceId)!);
  };
  let d0 = 0, a0 = areaAt(0), d1 = 500, a1 = areaAt(d1);
  if (Math.abs(a1 - a0) < 1e-6) return null;
  for (let i = 0; i < 4 && Math.abs(a1 - target) > 0.01; i++) {
    const d2 = Math.round((d1 + ((target - a1) * (d1 - d0)) / (a1 - a0)) / 10) * 10;
    if (d2 === d1) break;
    d0 = d1; a0 = a1; d1 = d2; a1 = areaAt(d1);
  }
  return { wall: w, vector: scale(out, d1).map(Math.round) as Point, area: a1 };
}

interface Handler {
  /** 返回是否已满足、说明 */
  check(p: Project, c: Constraint): { ok: boolean; message: string };
  /** 尝试修复，返回是否有改动 */
  fix(p: Project, c: Constraint, changed: Set<Id>): boolean;
}

const HANDLERS: Partial<Record<Constraint['type'], Handler>> = {
  // 对齐：所有目标墙与参照墙共线。本次被改动的那面墙作参照，否则取第一面。
  align: {
    check(p, c) {
      const ws = c.targets.map(id => findWall(p, id)).filter((w): w is Wall => !!w);
      const bad = ws.slice(1).filter(w => !parallel(ws[0], w) || Math.abs(offsetBetween(ws[0], w)) > 5);
      return { ok: ws.length === c.targets.length && !bad.length, message: `${ws.map(w => w.name).join('、')}对齐` };
    },
    fix(p, c, changed) {
      const ws = c.targets.map(id => findWall(p, id)).filter((w): w is Wall => !!w);
      if (ws.length < 2) return false;
      const ref = ws.find(w => changed.has(w.id)) ?? ws[0];
      let moved = false;
      for (const w of ws) {
        if (w === ref || !parallel(ref, w)) continue;
        const off = offsetBetween(ref, w);
        if (Math.abs(off) <= 5) continue;
        moveWall(p, w.id, scale(wallNormal(ref), -off).map(Math.round) as Point);
        changed.add(w.id);
        moved = true;
      }
      return moved;
    },
  },

  // 居中：洞口在它所在墙与空间重合段的中点
  center: {
    check(p, c) {
      const hit = findOpening(p, c.targets[0]), s = findSpace(p, c.targets[1]);
      if (!hit || !s) return { ok: false, message: '居中的对象不存在' };
      const iv = sharedInterval(hit.w, s);
      return { ok: !!iv && Math.abs(hit.o.at - (iv[0] + iv[1]) / 2) <= 5, message: `${hit.o.name}在${s.name}中线上` };
    },
    fix(p, c, changed) {
      const hit = findOpening(p, c.targets[0]), s = findSpace(p, c.targets[1]);
      if (!hit || !s) return false;
      const iv = sharedInterval(hit.w, s);
      if (!iv) return false;
      const mid = Math.round((iv[0] + iv[1]) / 2);
      if (Math.abs(hit.o.at - mid) <= 5) return false;
      hit.o.at = mid;
      changed.add(hit.o.id);
      return true;
    },
  },

  // 间距：洞口边到一面墙的净距，或两面平行墙中心线的距离
  spacing: {
    check(p, c) {
      const dist = Number(c.params.distance);
      const hit = findOpening(p, c.targets[0]);
      const other = findWall(p, c.targets[1]);
      if (!other) return { ok: false, message: '间距的对象不存在' };
      if (hit) {
        const g = openingGap(hit.w, hit.o, other);
        return { ok: g != null && Math.abs(g - dist) <= 5, message: `${hit.o.name}距${other.name} ${dist} mm` };
      }
      const a = findWall(p, c.targets[0]);
      if (!a) return { ok: false, message: '间距的对象不存在' };
      return { ok: parallel(a, other) && Math.abs(Math.abs(offsetBetween(a, other)) - dist) <= 5, message: `${a.name}与${other.name}相距 ${dist} mm` };
    },
    fix(p, c, changed) {
      const dist = Number(c.params.distance);
      const hit = findOpening(p, c.targets[0]);
      const other = findWall(p, c.targets[1]);
      if (!other) return false;
      if (hit) {
        const g = openingGap(hit.w, hit.o, other);
        if (g == null || Math.abs(g - dist) <= 5) return false;
        // 洞口在墙上靠近 other 的那一侧：沿墙方向远离 other 为正
        const sign = Math.sign(hit.o.at - projectPoint(hit.w, other.start).at) || 1;
        hit.o.at = Math.round(hit.o.at + sign * (dist - g));
        changed.add(hit.o.id);
        return true;
      }
      const a = findWall(p, c.targets[0]);
      if (!a || !parallel(a, other)) return false;
      const off = offsetBetween(a, other), want = Math.sign(off || 1) * dist;
      if (Math.abs(off - want) <= 5) return false;
      // 被改动的一方作参照，移动另一方
      if (changed.has(other.id) && !changed.has(a.id)) {
        moveWall(p, a.id, scale(wallNormal(a), off - want).map(Math.round) as Point);
        changed.add(a.id);
      } else {
        moveWall(p, other.id, scale(wallNormal(a), want - off).map(Math.round) as Point);
        changed.add(other.id);
      }
      return true;
    },
  },

  // 面积目标：使用面积在目标 ± 容差内，移动指定墙（或自动选一面）
  'size-target': {
    check(p, c) {
      const s = findSpace(p, c.targets[0]);
      if (!s) return { ok: false, message: '面积目标的空间不存在' };
      const target = Number(c.params.area), tol = Number(c.params.tolerance ?? 0.3);
      const a = spaceNetArea(p, s);
      return { ok: Math.abs(a - target) <= tol, message: `${s.name}约 ${target} m²（现 ${a.toFixed(1)} m²）` };
    },
    fix(p, c, changed) {
      const s = findSpace(p, c.targets[0]);
      if (!s) return false;
      const target = Number(c.params.area), tol = Number(c.params.tolerance ?? 0.3);
      if (Math.abs(spaceNetArea(p, s) - target) <= tol) return false;
      const sol = solveAreaMove(p, s.id, target, c.targets[1]);
      // 用户这次亲手动过的墙不拉回去：以用户的操作为准，约束记为未满足
      if (!sol || changed.has(sol.wall.id) || (!sol.vector[0] && !sol.vector[1])) return false;
      moveWall(p, sol.wall.id, sol.vector);
      changed.add(sol.wall.id);
      return true;
    },
  },
};

/** 洞口边到另一面墙表面的净距 */
function openingGap(w: Wall, o: Wall['openings'][number], other: Wall): number | null {
  if (parallel(w, other)) return null;
  const at = projectPoint(w, other.start).at;
  const cross0 = projectPoint(w, other.end).at;
  const pos = Math.abs(cross0 - at) < 1 ? at : null; // other 垂直于 w 时两端投影相同
  if (pos == null) return null;
  const edge = o.at > pos ? o.at - o.width / 2 : o.at + o.width / 2;
  return Math.abs(edge - pos) - other.thickness / 2;
}

export const SUPPORTED_CONSTRAINTS = Object.keys(HANDLERS) as Constraint['type'][];

export function checkConstraints(p: Project): ConstraintStatus[] {
  return p.constraints.map(c => {
    const h = HANDLERS[c.type];
    if (!h) return { id: c.id, ok: true, hard: c.hard, message: `${c.type} 暂不求解` };
    return { id: c.id, hard: c.hard, ...h.check(p, c) };
  });
}

/** 在事务里调用：迭代修复，直到满足或 8 轮上限 */
export function solveConstraints(p: Project, changedIds: Id[] = []): ConstraintReport {
  const changed = new Set(changedIds);
  let rounds = 0;
  if (p.constraints.length) {
    for (; rounds < 8; rounds++) {
      let any = false;
      for (const c of p.constraints) {
        const h = HANDLERS[c.type];
        if (h && !h.check(p, c).ok && h.fix(p, c, changed)) any = true;
      }
      if (!any) break;
    }
  }
  const status = checkConstraints(p).filter(s => !s.ok);
  return { rounds, violatedHard: status.filter(s => s.hard), violatedSoft: status.filter(s => !s.hard) };
}

