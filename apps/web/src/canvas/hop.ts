/**
 * 选中与改动的提示：对象往上跳一下再落回原位，不再用颜色高亮。
 * - 选中：先跳一下，之后每 3 秒轻轻再跳，直到取消选中
 * - 改动：从改动中心向外波纹扫过，只跳一轮；之后靠“对比改前”的虚线
 * - 手感按轻重：承重墙跳得低、落得沉，隔墙栏杆轻快，家具最轻
 * 跳动只是瞬间动作，静止时一定在真实位置；截图只拍静止帧。
 * 平面图从上往下看，“往上跳”表现为朝你抬起：轻微放大加投影。
 */
import type { Point, Project } from '@plinth/core';

export type Weight = 'heavy' | 'light' | 'furniture' | 'floor';

/**
 * lift：三维里跳多高，按屏幕像素算（镜头远近都一样明显）；scale：平面图放大倍数；ms：一跳的时长
 */
export const PROFILE: Record<Weight, { lift: number; scale: number; ms: number }> = {
  heavy: { lift: 12, scale: 1.02, ms: 560 },
  light: { lift: 18, scale: 1.035, ms: 460 },
  furniture: { lift: 22, scale: 1.06, ms: 420 },
  floor: { lift: 10, scale: 1.015, ms: 560 },
};

/** 选中的东西被挡住时，镜头转过去用多久 */
export const REVEAL = { ms: 600 };

const REPEAT_MS = 3000;
const REPEAT_GAIN = 0.55;
/** 波纹每米延迟、最长延迟 */
const RIPPLE_MS_PER_M = 90;
const RIPPLE_MAX_MS = 900;

/** 0→1→0：起跳、落地后轻轻回弹一次，t≥1 时严格为 0 */
export function hopCurve(t: number) {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.72) return Math.sin((Math.PI * t) / 0.72);
  return 0.12 * Math.sin((Math.PI * (t - 0.72)) / 0.28);
}

export interface Hop { id: string; at: number; gain: number; weight: Weight }

type Listener = (h: Hop) => void;

/** 对象的轻重与位置；门窗算进所在的墙（三维里门窗是墙的一部分） */
export function describe(project: Project, id: string): { weight: Weight; at: Point; wall?: string } | null {
  for (const w of project.walls) {
    const mid: Point = [(w.start[0] + w.end[0]) / 2, (w.start[1] + w.end[1]) / 2];
    if (w.id === id) return { weight: w.kind === 'bearing' ? 'heavy' : 'light', at: mid };
    const o = w.openings.find(o => o.id === id);
    if (o) {
      const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]) || 1;
      const f = o.at / len;
      return { weight: 'light', at: [w.start[0] + (w.end[0] - w.start[0]) * f, w.start[1] + (w.end[1] - w.start[1]) * f], wall: w.id };
    }
  }
  const f = project.furniture.find(f => f.id === id);
  if (f) return { weight: 'furniture', at: f.position };
  const s = project.spaces.find(s => s.id === id);
  if (s) {
    const pts = s.shape.flatMap(p => p.outer);
    const at: Point = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
    return { weight: 'floor', at };
  }
  return null;
}

class Hops {
  /** 每个对象最近的跳动，按 ID 存，三维每帧按 ID 查 */
  private recent = new Map<string, Hop[]>();
  private listeners = new Set<Listener>();
  private selected: string[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private project: Project | null = null;
  reduced = false;

  setProject(p: Project) {
    this.project = p;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit(id: string, at: number, gain: number) {
    if (this.reduced || !this.project) return;
    const d = describe(this.project, id);
    if (!d) return;
    const h: Hop = { id, at, gain, weight: d.weight };
    this.push(h);
    // 三维里门窗随墙一起跳
    if (d.wall) this.push({ ...h, id: d.wall, weight: describe(this.project, d.wall)?.weight ?? 'light' });
    this.listeners.forEach(l => l(h));
  }

  private push(h: Hop) {
    const done = h.at - 2000;
    this.recent.set(h.id, [...(this.recent.get(h.id) ?? []).filter(x => x.at > done), h]);
  }

  /** 选中变化：新选中的先跳一下，之后定时轻跳 */
  select(ids: string[]) {
    const now = performance.now();
    for (const id of ids) if (!this.selected.includes(id)) this.emit(id, now, 1);
    this.selected = ids;
    if (this.timer) clearInterval(this.timer);
    this.timer = ids.length ? setInterval(() => this.selected.forEach(id => this.emit(id, performance.now(), REPEAT_GAIN)), REPEAT_MS) : null;
  }

  /** 改动：从中心向外按距离依次跳一轮 */
  ripple(ids: string[]) {
    if (!this.project || !ids.length) return;
    const items = ids.map(id => ({ id, d: describe(this.project!, id) })).filter(x => x.d);
    if (!items.length) return;
    const cx = items.reduce((a, x) => a + x.d!.at[0], 0) / items.length;
    const cy = items.reduce((a, x) => a + x.d!.at[1], 0) / items.length;
    const far = Math.max(...items.map(x => Math.hypot(x.d!.at[0] - cx, x.d!.at[1] - cy)), 1);
    const span = Math.min(RIPPLE_MAX_MS, (far / 1000) * RIPPLE_MS_PER_M);
    const now = performance.now();
    for (const x of items) this.emit(x.id, now + (Math.hypot(x.d!.at[0] - cx, x.d!.at[1] - cy) / far) * span, 1);
  }

  /** 镜头转过去露出被挡住的对象后，再跳一下 */
  poke(id: string) {
    this.emit(id, performance.now(), 1);
  }

  /** 某对象此刻在屏幕上抬起多少像素（0 = 原位），三维每帧调用 */
  lift(id: string, now: number) {
    let v = 0;
    for (const h of this.recent.get(id) ?? []) {
      const y = hopCurve((now - h.at) / PROFILE[h.weight].ms) * h.gain * PROFILE[h.weight].lift;
      if (y > v) v = y;
    }
    return v;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.selected = [];
    this.recent.clear();
  }
}

export const hops = new Hops();
