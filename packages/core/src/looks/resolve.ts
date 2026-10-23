/** Which recipe draws an object, and its plan symbol in plan coordinates */
import { buildRecipe, planSymbol, type PlanSymbol, type Recipe } from '../recipe.js';
import type { Element, Furniture, Opening, Point, Project } from '../schema.js';
import { DEFAULT_LOOKS, type LookTarget } from './index.js';

export const furnitureTarget = (f: Pick<Furniture, 'type'>): LookTarget => `furniture:${f.type}`;
export const openingTarget = (o: Pick<Opening, 'kind' | 'glazing'>): LookTarget => (o.glazing === 'glass-block' ? 'opening:glass-block' : `opening:${o.kind}`);
export const elementTarget = (e: Pick<Element, 'type'>): LookTarget => `element:${e.type}`;

/** The recipe for a target in a project, or null when none draws it (a furniture type without a look is drawn as a block) */
export function lookRecipe(_p: Project, target: LookTarget): Recipe | null {
  return DEFAULT_LOOKS[target] ?? null;
}

/** A piece of furniture's plan symbol (outlines seen from above, lowest first), in plan coordinates; null if it has no look */
export function furniturePlan(p: Project, f: Furniture): PlanSymbol | null {
  const recipe = lookRecipe(p, furnitureTarget(f));
  if (!recipe) return null;
  let sym: PlanSymbol;
  try {
    sym = planSymbol(recipe, buildRecipe(recipe, f.size), f.size);
  } catch {
    return null;
  }
  const r = (f.rotation * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const tf = ([x, z]: Point): Point => [f.position[0] + x * c - z * s, f.position[1] + x * s + z * c];
  return { items: sym.items.map(it => ({ ...it, ring: it.ring.map(tf) })), lines: sym.lines.map(l => l.map(tf)) };
}
