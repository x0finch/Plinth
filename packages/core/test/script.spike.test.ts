import { describe, expect, it } from 'vitest';
import { buildRecipe, buildScript, checkScript, DEFAULT_LOOKS, FURNITURE_TYPES, runScript, sidetableScript, sofaScript, type ScriptRecipe } from '../src/index.js';

const round = (v: unknown): unknown => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(round) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v);

describe('JSONata recipes (spike)', () => {
  it('the scripted side table and sofa build the same parts as the data recipes', async () => {
    for (const [type, script] of [['sidetable', sidetableScript], ['sofa3', sofaScript], ['sofa2', sofaScript]] as const) {
      const size = FURNITURE_TYPES[type].size;
      const a = buildRecipe(DEFAULT_LOOKS[`furniture:${type}`], size).map(p => ({ ...p })).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
      const b = (await buildScript(script, size)).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
      expect(round(b).length, type).toBe(round(a).length);
      expect(round(b), type).toEqual(round(a));
    }
  });

  it('parameters change the look without changing the recipe', async () => {
    const size = FURNITURE_TYPES.sofa3.size;
    const base = await buildScript(sofaScript, size);
    const grey = await buildScript(sofaScript, size, { fabric: 'stoneDark', cushions: 4, armWidth: 200 });
    expect(base.filter(p => p.kind === 'box' && p.mat === 'fabric').length).toBeGreaterThan(0);
    expect(grey.filter(p => p.kind === 'box' && p.mat === 'fabric').length).toBe(0);
    expect(grey.filter(p => p.kind === 'box' && p.mat === 'cushion').length).toBe(8);
    const noVase = await buildScript(sidetableScript, FURNITURE_TYPES.sidetable.size, { vase: false });
    expect(noVase.some(p => p.kind === 'lathe')).toBe(false);
  });

  it('scripts are checked at their size, half and twice it', async () => {
    expect(await checkScript(sofaScript, FURNITURE_TYPES.sofa3.size)).toEqual([]);
    const bad: ScriptRecipe = { script: `[$box([$w - 5000, 10, $d], [0, 0, 0], 'wood')]` };
    expect((await checkScript(bad, { w: 1000, d: 500, h: 500 }))[0]).toMatch(/positive|size/);
    const badMat: ScriptRecipe = { script: `[$box([$w, 10, $d], [0, 0, 0], "gold-plated")]` };
    expect((await checkScript(badMat, { w: 1000, d: 500, h: 500 }))[0]).toMatch(/mat/);
  });

  it('guardrails stop runaway scripts', async () => {
    const size = { w: 1000, d: 500, h: 500 };
    const recursion: ScriptRecipe = { script: `( $f := function($n) { $f($n + 1) }; $f(0) )` };
    await expect(runScript(recursion, size)).rejects.toThrow(/D1011|D1012/);
    const busy: ScriptRecipe = { script: `( $f := function($n) { $n > 0 ? $f($n - 1) + $f($n - 1) : 1 }; $f(40) )` };
    await expect(runScript(busy, size)).rejects.toThrow(/D1012|timeout|D1011/i);
    const huge: ScriptRecipe = { script: `[1..100000].$box([10, 10, 10], [0, 0, 0], 'wood')` };
    await expect(runScript(huge, size)).rejects.toThrow(/D2015|sequence|parts/i);
  });

  it('scripts cannot reach the outside world', async () => {
    const size = { w: 1000, d: 500, h: 500 };
    for (const script of [
      `$eval("constructor")`,
      `$string($)`,
      `constructor.constructor("return process")()`,
      `$lookup($, "__proto__")`,
      `$box.constructor("return globalThis")()`,
    ]) {
      let out: unknown;
      try { out = (await runScript({ script }, size)).parts; } catch { out = 'error'; }
      expect(JSON.stringify(out) ?? '', script).not.toMatch(/process|global|function/i);
    }
    expect((globalThis as Record<string, unknown>).pwned).toBeUndefined();
  });

  it('speed', async () => {
    const size = FURNITURE_TYPES.sofa3.size;
    await buildScript(sofaScript, size);
    let t = performance.now();
    for (let i = 0; i < 200; i++) await buildScript(sofaScript, { ...size, w: size.w + i });
    const script = (performance.now() - t) / 200;
    t = performance.now();
    for (let i = 0; i < 200; i++) buildRecipe(DEFAULT_LOOKS['furniture:sofa3'], { ...size, w: size.w + i });
    const data = (performance.now() - t) / 200;
    console.log(`sofa: script ${script.toFixed(3)} ms/build, data recipe ${data.toFixed(3)} ms/build`);
    expect(script).toBeLessThan(20);
  });
});
