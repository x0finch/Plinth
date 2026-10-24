/**
 * The default model set: a recipe for every catalog furniture type, every kind of opening and every element type. It lives in
 * code and is never written to a project; designs that don't choose other looks follow it as it improves.
 */
import type { Recipe } from '../script.js';
import { BATH } from './bath.js';
import { BEDROOM } from './bedroom.js';
import { ELEMENTS, OPENINGS } from './building.js';
import { KITCHEN } from './kitchen.js';
import { LIVING } from './living.js';
import { OUTDOOR } from './outdoor.js';

/** What a look is for: a furniture type, a kind of opening (glass-block windows count as their own kind) or an element type */
export type LookTarget = `furniture:${string}` | `opening:${string}` | `element:${string}`;

const entries = (prefix: string, m: Record<string, Recipe>) => Object.entries(m).map(([k, r]) => [`${prefix}:${k}`, r] as const);

export const DEFAULT_LOOKS: Record<LookTarget, Recipe> = Object.fromEntries([
  ...entries('furniture', { ...LIVING, ...KITCHEN, ...BEDROOM, ...BATH, ...OUTDOOR }),
  ...entries('opening', OPENINGS),
  ...entries('element', ELEMENTS),
]);
