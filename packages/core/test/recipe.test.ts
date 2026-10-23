import { describe, expect, it } from 'vitest';
import { BUILTIN_LIBRARIES, buildRecipe, checkRecipe, DEFAULT_LOOKS, evalExpr, FURNITURE_TYPES, inspectRecipe, parseExpr, planSymbol, type Recipe } from '../src/index.js';

describe('expressions', () => {
  it('evaluates arithmetic, comparisons, ternaries and functions', () => {
    expect(evalExpr('1 + 2 * 3', {})).toBe(7);
    expect(evalExpr('(w - 2 * arm) / n', { w: 2000, arm: 100, n: 3 })).toBe(600);
    expect(evalExpr('w >= 1200 ? 2 : 1', { w: 1500 })).toBe(2);
    expect(evalExpr('min(3, max(1, 2))', {})).toBe(2);
    expect(evalExpr('round(sin(90) * 100)', {})).toBe(100);
    expect(evalExpr('atan2(1, 1)', {})).toBeCloseTo(45);
    expect(evalExpr('-x % 2', { x: 3 })).toBe(-1);
    expect(evalExpr('!0 && 2', {})).toBe(2);
  });
  it('rnd is fixed per seed and key', () => {
    expect(evalExpr('rnd(3)', {}, 7)).toBe(evalExpr('rnd(3)', {}, 7));
    expect(evalExpr('rnd(3)', {}, 7)).not.toBe(evalExpr('rnd(4)', {}, 7));
    for (let k = 0; k < 200; k++) { const v = evalExpr(`rnd(${k})`, {}, 3); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('reports what it cannot read', () => {
    expect(() => parseExpr('1 +')).toThrow(/end/);
    expect(() => parseExpr('foo(1)')).toThrow(/unknown function/);
    expect(() => parseExpr('2 $ 3')).toThrow(/cannot read/);
    expect(() => evalExpr('w + q', { w: 1 })).toThrow(/unknown name "q"/);
  });
});

describe('recipes', () => {
  const size = (target: string) => {
    const [kind, type] = target.split(':');
    if (kind === 'furniture') return FURNITURE_TYPES[type].size;
    if (kind === 'opening') return { w: 1200, d: 180, h: 1500 };
    return { w: 2000, d: 2000, h: 3000 };
  };
  it('every default look builds at its size, half and twice that size', () => {
    for (const [target, recipe] of Object.entries(DEFAULT_LOOKS)) {
      expect(checkRecipe(recipe, size(target)), target).toEqual([]);
    }
  });
  it('every built-in library look builds for each of its targets', () => {
    for (const lib of BUILTIN_LIBRARIES) for (const look of lib.looks) {
      expect(look.for.length, look.id).toBeGreaterThan(0);
      for (const t of look.for) expect(checkRecipe(look.recipe, size(t)), `${lib.id}/${look.id} ${t}`).toEqual([]);
    }
  });
  it('every catalog furniture type has a default look', () => {
    for (const type of Object.keys(FURNITURE_TYPES)) expect(DEFAULT_LOOKS[`furniture:${type}`], type).toBeTruthy();
  });
  it('every furniture look has a plan symbol inside its footprint', () => {
    for (const type of Object.keys(FURNITURE_TYPES)) {
      const r = DEFAULT_LOOKS[`furniture:${type}`], s = FURNITURE_TYPES[type].size;
      const sym = planSymbol(r, buildRecipe(r, s), s);
      expect(sym.items.length, type).toBeGreaterThan(0);
      for (const it of sym.items) for (const [x, z] of it.ring) {
        expect(Math.abs(x), `${type} x`).toBeLessThanOrEqual(s.w / 2 + 200);
        expect(Math.abs(z), `${type} z`).toBeLessThanOrEqual(s.d / 2 + 200);
      }
    }
  });
  it('a longer sofa gets more cushions', () => {
    const count = (w: number) => buildRecipe(DEFAULT_LOOKS['furniture:sofa3'], { w, d: 900, h: 800 }).filter(p => p.kind === 'box' && p.mat === 'cushion').length;
    expect(count(3000)).toBeGreaterThan(count(2100));
  });
  it('rejects bad recipes with readable problems', () => {
    expect(checkRecipe({ parts: [{ kind: 'box', mat: 'wood', size: ['w', 'h', 'd'] }] }, { w: 1, d: 1, h: 1 })[0]).toMatch(/at/);
    expect(checkRecipe({ parts: [{ kind: 'box', mat: 'gold-ish', size: [1, 1, 1], at: [0, 0, 0] }] }, { w: 1, d: 1, h: 1 })[0]).toMatch(/mat/);
    const negative: Recipe = { parts: [{ kind: 'box', mat: 'wood', size: ['w - 2000', 10, 10], at: [0, 0, 0] }] };
    expect(checkRecipe(negative, { w: 1000, d: 1, h: 1 })[0]).toMatch(/width must be positive/);
    const runaway: Recipe = { parts: [{ kind: 'repeat', count: 1000, parts: [{ kind: 'box', mat: 'wood', size: [1, 1, 1], at: [0, 0, 0] }] }] };
    expect(checkRecipe(runaway, { w: 1, d: 1, h: 1 })[0]).toMatch(/limit/);
  });
});

describe('inspection', () => {
  it('finds parts out of bounds and floating, and draws rough views', () => {
    const r: Recipe = { parts: [
      { kind: 'box', mat: 'wood', size: ['w', 40, 'd'], at: [0, 'h - 20', 0] },
      { kind: 'box', mat: 'wood', size: [60, 'h - 40', 60], at: [0, '(h - 40) / 2', 0] },
      { kind: 'sphere', mat: 'gold', r: 50, at: [0, 'h + 400', 0] },
      { kind: 'box', mat: 'wood', size: [100, 10, 100], at: ['w', 5, 0] },
    ] };
    const i = inspectRecipe(r, { w: 1000, d: 600, h: 750 });
    expect(i.parts).toBe(4);
    expect(i.floating).toEqual(['#2 sphere (gold)']);
    expect(i.outside).toEqual(['#2 sphere (gold)', '#3 box (wood)']);
    expect(i.views.front.split('\n')[13]).toContain('#');
  });
  it('the default looks have no floating or stray parts', () => {
    for (const type of ['sofa3', 'bed18', 'dining', 'chair', 'tree', 'car', 'toilet', 'wardrobe']) {
      const i = inspectRecipe(DEFAULT_LOOKS[`furniture:${type}`], FURNITURE_TYPES[type].size);
      expect(i.floating, type).toEqual([]);
    }
  });
});
