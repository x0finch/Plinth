/**
 * Selection and change feedback: objects hop up and land back instead of color highlighting.
 * - Select: hop once, then a gentle hop every 3 s until deselected
 * - Change: a ripple sweeps out from the change center, one round only; after that the "compare with before" dashes take over
 * - Feel by weight: load-bearing walls hop low and land heavy, partitions and railings are light, furniture lightest
 * Hops are transient; at rest objects are always at their true position. Screenshots capture still frames only.
 * The plan is viewed from above, so a "hop" lifts toward you: slight scale-up plus shadow.
 */
import type { Point, Project } from '@plinth/core';

export type Weight = 'heavy' | 'light' | 'furniture' | 'floor';

/**
 * lift: 3D hop height in screen pixels (equally visible at any camera distance); scale: plan scale factor; ms: hop duration
 */
export const PROFILE: Record<Weight, { lift: number; scale: number; ms: number }> = {
  heavy: { lift: 12, scale: 1.02, ms: 560 },
  light: { lift: 18, scale: 1.035, ms: 460 },
  furniture: { lift: 22, scale: 1.06, ms: 420 },
  floor: { lift: 10, scale: 1.015, ms: 560 },
};

/** How long the camera takes to turn to a hidden selected object */
export const REVEAL = { ms: 600 };

const REPEAT_MS = 3000;
const REPEAT_GAIN = 0.55;
/** Ripple delay per metre and maximum delay */
const RIPPLE_MS_PER_M = 90;
const RIPPLE_MAX_MS = 900;

/** 0→1→0: take off, land with one small rebound; exactly 0 for t≥1 */
export function hopCurve(t: number) {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.72) return Math.sin((Math.PI * t) / 0.72);
  return 0.12 * Math.sin((Math.PI * (t - 0.72)) / 0.28);
}

export interface Hop { id: string; at: number; gain: number; weight: Weight }

type Listener = (h: Hop) => void;

/** Object weight and position; doors/windows count as their wall (in 3D they are part of the wall) */
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
  /** Latest hop per object, keyed by ID; 3D looks it up by ID every frame */
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
    // In 3D, doors/windows hop with their wall
    if (d.wall) this.push({ ...h, id: d.wall, weight: describe(this.project, d.wall)?.weight ?? 'light' });
    this.listeners.forEach(l => l(h));
  }

  private push(h: Hop) {
    const done = h.at - 2000;
    this.recent.set(h.id, [...(this.recent.get(h.id) ?? []).filter(x => x.at > done), h]);
  }

  /** Selection changed: newly selected objects hop once, then hop gently on a timer */
  select(ids: string[]) {
    const now = performance.now();
    for (const id of ids) if (!this.selected.includes(id)) this.emit(id, now, 1);
    this.selected = ids;
    if (this.timer) clearInterval(this.timer);
    this.timer = ids.length ? setInterval(() => this.selected.forEach(id => this.emit(id, performance.now(), REPEAT_GAIN)), REPEAT_MS) : null;
  }

  /** Change: hop one round outward from the center, ordered by distance */
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

  /** Hop again after the camera turns to reveal a hidden object */
  poke(id: string) {
    this.emit(id, performance.now(), 1);
  }

  /** How many screen pixels an object is lifted right now (0 = at rest); called by 3D every frame */
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
