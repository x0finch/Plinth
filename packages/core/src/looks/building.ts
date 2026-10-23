/**
 * Doors, windows and elements. An opening's recipe is built at its width (w), the wall's thickness (d) and its height (h), from
 * the centre of its sill; an element's recipe draws its own geometry (stairs, ponds, drains, from elements.ts) with `base`.
 * Their plan symbols follow drafting conventions and don't come from the recipe.
 */
import type { Recipe } from '../recipe.js';
import { block } from './helpers.js';

/** A window: a slim dark frame round a clear pane */
const glazed: Recipe = {
  let: { fw: 40, fd: 50 },
  parts: [
    { kind: 'box', mat: 'glass', size: ['w', 'h', 'min(30, d)'], at: [0, 'h / 2', 0] },
    block('frame', ['w', 'fw', 'fd'], 0, 0, 0),
    block('frame', ['w', 'fw', 'fd'], 0, 'h - fw', 0),
    block('frame', ['fw', 'h', 'fd'], '-w / 2 + fw / 2', 0, 0),
    block('frame', ['fw', 'h', 'fd'], 'w / 2 - fw / 2', 0, 0),
  ],
};

/** Doors, gates and plain openings stay open */
const open: Recipe = { parts: [] };

export const OPENINGS: Record<string, Recipe> = {
  window: glazed,
  'sliding-door': glazed,
  'glass-block': { parts: [{ kind: 'box', mat: 'glassBlock', size: ['w', 'h', 'min(80, d)'], at: [0, 'h / 2', 0] }] },
  door: open,
  gate: open,
  opening: open,
};

/** An element's own geometry in the default materials */
const own: Recipe = { parts: [{ kind: 'base', mats: { structure: 'wall', water: 'water', grate: 'grate' } }] };

export const ELEMENTS: Record<string, Recipe> = { stair: own, pond: own, drain: own };
