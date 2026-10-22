/**
 * 从数据生成三维构件块：墙按洞口切成若干实体段（洞口下的窗台、洞口上的过梁、洞口之间的墙垛），
 * 每段是一个沿墙方向的长方体。渲染器只需画盒子，导出 glTF 也用同一份结果。
 */
import { wallDir, wallLength } from './topology.js';
import type { Id, Project, Wall } from './schema.js';

export interface Box {
  /** 所属对象 */
  id: Id;
  level: Id;
  kind: 'wall' | 'sill' | 'lintel' | 'railing' | 'parapet' | 'fence' | 'glass';
  /** 底面中心（平面坐标，毫米） */
  center: [number, number];
  /** 底面离本层楼面的高度 */
  z: number;
  /** 沿墙长度、墙厚、高度 */
  length: number;
  thickness: number;
  height: number;
  /** 墙方向与 x 轴的夹角（弧度，y 向南） */
  angle: number;
}

export function wallHeight(p: Project, w: Wall) {
  if (w.height) return w.height;
  const lv = p.levels.find(l => l.id === w.level);
  if (w.kind === 'railing') return 1100;
  if (w.kind === 'parapet') return 1100;
  if (w.kind === 'fence') return 2000;
  return lv && lv.height > 0 ? lv.height : 3000;
}

export function wallBoxes(p: Project, w: Wall): Box[] {
  const L = wallLength(w), d = wallDir(w), H = wallHeight(p, w);
  const angle = Math.atan2(d[1], d[0]);
  const kind: Box['kind'] = w.kind === 'railing' ? 'railing' : w.kind === 'parapet' ? 'parapet' : w.kind === 'fence' ? 'fence' : 'wall';
  const ext = w.kind === 'bearing' || w.kind === 'partition' ? w.thickness / 2 : 0;
  const box = (a: number, b: number, z: number, h: number, k: Box['kind']): Box => {
    const mid = (a + b) / 2;
    return {
      id: w.id, level: w.level, kind: k, angle, thickness: k === 'glass' ? Math.min(30, w.thickness) : w.thickness,
      center: [w.start[0] + d[0] * mid, w.start[1] + d[1] * mid], z, length: b - a, height: h,
    };
  };
  const out: Box[] = [];
  const ops = [...w.openings].sort((a, b) => a.at - b.at);
  let t = -ext;
  for (const o of ops) {
    const a = Math.max(-ext, o.at - o.width / 2), b = Math.min(L + ext, o.at + o.width / 2);
    if (a > t) out.push(box(t, a, 0, H, kind));
    const top = Math.min(H, o.sill + o.height);
    if (o.sill > 0) out.push(box(a, b, 0, o.sill, kind === 'wall' ? 'sill' : kind));
    if (top < H) out.push(box(a, b, top, H - top, kind === 'wall' ? 'lintel' : kind));
    if (o.kind === 'window' || o.kind === 'sliding-door') out.push(box(a, b, o.sill, top - o.sill, 'glass'));
    t = Math.max(t, b);
  }
  if (t < L + ext) out.push(box(t, L + ext, 0, H, kind));
  return out.filter(b => b.length > 1 && b.height > 1);
}

export const projectBoxes = (p: Project) => p.walls.flatMap(w => wallBoxes(p, w));
