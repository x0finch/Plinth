/** Looks in a design: adding, using, per-object looks, new furniture types, all through capabilities */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRegistry, furnitureTarget, lookRecipe, migrate, Session, validate, type Project, type Recipe } from '../src/index.js';

const registry = createRegistry();
const sample = () => migrate(JSON.parse(readFileSync(join(import.meta.dirname, '../../../samples/wushi-10/project.json'), 'utf8')));

function harness(p: Project) {
  const session = new Session(p);
  const call = (name: string, input: unknown = {}) => registry.call(name, input, { session, actor: { kind: 'agent' } });
  return { session, call };
}

/** A round table: a top on one stem */
const roundTable: Recipe = {
  let: { r: 'min(w, d) / 2' },
  parts: [
    { kind: 'cylinder', mat: 'wood', r: 'r', h: 40, at: [0, 'h - 20', 0] },
    { kind: 'cylinder', mat: 'woodDark', r: 40, h: 'h - 40', at: [0, '(h - 40) / 2', 0] },
  ],
};

describe('looks', () => {
  it('an old project migrates to v4 unchanged and valid', () => {
    const p = sample();
    expect(p.version).toBe(4);
    expect(p.library.looks).toBeUndefined();
    expect(validate(p)).toEqual([]);
  });

  it('look_add with use draws every object of the target with it; one undo reverts', async () => {
    const h = harness(sample());
    const table = h.session.project.furniture.find(f => f.type === 'dining')!;
    const before = lookRecipe(h.session.project, furnitureTarget(table), table.look);
    const r = await h.call('look_add', { name: '圆餐桌', for: ['furniture:dining'], recipe: roundTable, use: true });
    expect(r.ok, r.error?.message).toBe(true);
    expect(lookRecipe(h.session.project, furnitureTarget(table))).toEqual(roundTable);
    await h.call('history_undo');
    expect(lookRecipe(h.session.project, furnitureTarget(table))).toBe(before);
  });

  it('look_set gives one object its own look, and look_remove sends it back to the default', async () => {
    const h = harness(sample());
    const [a, b] = h.session.project.furniture.filter(f => f.type === 'dining' || f.type === 'coffee');
    await h.call('look_add', { name: 'Round', for: ['furniture:dining', 'furniture:coffee'], recipe: roundTable });
    const set = await h.call('look_set', { object: a.id, look: 'Round' });
    expect(set.ok, set.error?.message).toBe(true);
    const p = h.session.project;
    expect(lookRecipe(p, furnitureTarget(a), p.furniture.find(f => f.id === a.id)!.look)).toEqual(roundTable);
    expect(lookRecipe(p, furnitureTarget(b), b.look)).not.toEqual(roundTable);
    await h.call('look_remove', { look: 'Round' });
    expect(h.session.project.furniture.find(f => f.id === a.id)!.look).toBeUndefined();
    expect(validate(h.session.project)).toEqual([]);
  });

  it('rejects a recipe that does not build, a look that does not fit, and an unknown target', async () => {
    const h = harness(sample());
    const bad = await h.call('look_add', { name: 'x', for: ['furniture:dining'], recipe: { parts: [{ kind: 'box', mat: 'wood', size: ['w', 'h', 'q'], at: [0, 0, 0] }] } });
    expect(bad.ok).toBe(false);
    expect(bad.error?.message).toMatch(/unknown name "q"/);
    await h.call('look_add', { name: 'Round', for: ['furniture:dining'], recipe: roundTable });
    const sofa = h.session.project.furniture.find(f => f.type === 'sofa3')!;
    const misfit = await h.call('look_set', { object: sofa.id, look: 'Round' });
    expect(misfit.ok).toBe(false);
    expect((await h.call('look_use', { target: 'furniture:no-such', look: null })).ok).toBe(false);
  });

  it('furniture_type_add registers a new type with its look, ready to place', async () => {
    const h = harness(sample());
    const r = await h.call('furniture_type_add', { type: 'mahjong', name: '麻将桌', size: { w: 900, d: 900, h: 750 }, recipe: roundTable });
    expect(r.ok, r.error?.message).toBe(true);
    const placed = await h.call('furniture_add', { type: 'mahjong', space: '客厅' });
    expect(placed.ok, placed.error?.message).toBe(true);
    const f = h.session.project.furniture.find(x => x.type === 'mahjong')!;
    expect(lookRecipe(h.session.project, furnitureTarget(f))).toEqual(roundTable);
  });

  it('a window can get its own look', async () => {
    const h = harness(sample());
    const win = h.session.project.walls.flatMap(w => w.openings).find(o => o.kind === 'window' && !o.glazing)!;
    const shutter: Recipe = { parts: [{ kind: 'box', mat: 'wood', size: ['w', 'h', 40], at: [0, 'h / 2', 0] }] };
    await h.call('look_add', { name: 'Shutter', for: ['opening:window'], recipe: shutter });
    const r = await h.call('look_set', { object: win.id, look: 'Shutter' });
    expect(r.ok, r.error?.message).toBe(true);
  });
});
