/** 规则检查：轻量、确定、不依赖浏览器。错误会让操作被拒绝，警告只提示。 */
import { add, openingSpaces, overlapArea, pointAt, scale, spaceWalls, wallDir, wallLength, wallNormal } from './topology.js';
import { pointInPolygon } from './geometry.js';
import type { Furniture, Id, Point, Polygon, Project, Space, Wall } from './schema.js';

export interface Issue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  targets: Id[];
}

export const issueKey = (i: Issue) => `${i.code}:${[...i.targets].sort().join(',')}`;

const ROOMLIKE = (s: Space) => s.kind === 'indoor' && !s.slabOpening && !(s.extras as any)?.stair;
const BEDROOM = /卧|老人房|客房|儿童房|书房/;
const PASSAGE = ['door', 'sliding-door', 'opening', 'gate'];

function furnitureBox(f: Furniture): Polygon {
  const r = (f.rotation * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const hw = f.size.w / 2, hd = f.size.d / 2;
  const pts: Point[] = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [f.position[0] + x * c - y * s, f.position[1] + x * s + y * c]);
  return { outer: pts };
}

/** 平开门扇扫过的范围（近似成一个正方形） */
function doorSwing(w: Wall, o: Wall['openings'][number]): Polygon | null {
  if (o.kind !== 'door' || !o.swing) return null;
  const d = wallDir(w), n = scale(wallNormal(w), o.swing.side === 'right' ? 1 : -1);
  const hingeAt = o.swing.hinge === 'start' ? o.at - o.width / 2 : o.at + o.width / 2;
  const toward = o.swing.hinge === 'start' ? 1 : -1;
  const h = add(pointAt(w, hingeAt), scale(n, w.thickness / 2));
  const a = h, b = add(h, scale(d, toward * o.width)), c = add(b, scale(n, o.width)), e = add(h, scale(n, o.width));
  return { outer: [a, b, c, e] };
}

export function checkRules(p: Project): Issue[] {
  const out: Issue[] = [];

  // 洞口：超出墙长、互相重叠
  for (const w of p.walls) {
    const L = wallLength(w);
    const ops = [...w.openings].sort((a, b) => a.at - b.at);
    for (const o of ops) {
      if (o.at - o.width / 2 < -1 || o.at + o.width / 2 > L + 1)
        out.push({ code: 'opening-outside-wall', severity: 'error', message: `${o.name}超出了${w.name}的长度`, targets: [o.id, w.id] });
    }
    for (let i = 1; i < ops.length; i++) {
      const a = ops[i - 1], b = ops[i];
      if (a.at + a.width / 2 > b.at - b.width / 2 + 1)
        out.push({ code: 'opening-overlap', severity: 'error', message: `${a.name}和${b.name}重叠`, targets: [a.id, b.id] });
    }
  }

  // 同层室内、半室外空间不应重叠
  const bodies = p.spaces.filter(s => s.kind === 'indoor' || s.kind === 'semi-outdoor');
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (a.level !== b.level) continue;
    const ov = overlapArea(a.shape, b.shape);
    if (ov > 0.05e6) out.push({ code: 'space-overlap', severity: 'error', message: `${a.name}和${b.name}重叠约 ${(ov / 1e6).toFixed(1)} m²`, targets: [a.id, b.id] });
  }

  // 房间要能进得去；卧室要有窗
  for (const s of p.spaces.filter(ROOMLIKE)) {
    const walls = spaceWalls(p, s);
    const ops = walls.flatMap(b => b.wall.openings.map(o => ({ o, w: b.wall })));
    const entries = ops.filter(({ o, w }) => PASSAGE.includes(o.kind) && openingSpaces(p, w, o).some(x => x.id === s.id));
    const open = walls.some(b => b.wall.kind === 'railing');
    if (!entries.length && !open) out.push({ code: 'room-no-entry', severity: 'warning', message: `${s.name}没有门或洞口可以进入`, targets: [s.id] });
    if (BEDROOM.test(s.name) && !ops.some(({ o }) => o.kind === 'window' && o.glazing !== 'glass-block'))
      out.push({ code: 'bedroom-no-window', severity: 'warning', message: `${s.name}没有可开启的窗`, targets: [s.id] });
  }

  // 门扇扫过的地方不要放家具
  for (const w of p.walls) for (const o of w.openings) {
    const sw = doorSwing(w, o);
    if (!sw) continue;
    for (const f of p.furniture) {
      if (f.level !== w.level || f.elevation) continue;
      if (overlapArea([sw], [furnitureBox(f)]) > 0.02e6)
        out.push({ code: 'door-blocked', severity: 'warning', message: `${o.name}开门会碰到${f.name}`, targets: [o.id, f.id] });
    }
  }

  // 家具要放在某个空间里
  for (const f of p.furniture) {
    if (!p.spaces.some(s => s.level === f.level && s.shape.some(poly => pointInPolygon(f.position, poly))))
      out.push({ code: 'furniture-outside', severity: 'warning', message: `${f.name}不在任何空间里`, targets: [f.id] });
  }

  return out;
}

