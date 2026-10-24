/**
 * Doors, windows and elements. An opening's recipe is built at its width (w), the wall's thickness (d) and its height (h), from
 * the centre of its sill; an element's recipe draws its own geometry (stairs, ponds, drains, from elements.ts) with `base`.
 * Their plan symbols follow drafting conventions and don't come from the recipe.
 */
import type { Recipe } from '../script.js';

/** A window: a slim dark frame round a clear pane */
const glazed: Recipe = {
  script: `(
    $fw := 40;
    $fd := 50;
    [
      $box([$w, $h, $min([30, $d])], [0, $h / 2, 0], 'glass'),
      $box([$w, $fw, $fd], [0, 0 + $fw / 2, 0], 'frame', 0),
      $box([$w, $fw, $fd], [0, $h - $fw + $fw / 2, 0], 'frame', 0),
      $box([$fw, $h, $fd], [-$w / 2 + $fw / 2, 0 + $h / 2, 0], 'frame', 0),
      $box([$fw, $h, $fd], [$w / 2 - $fw / 2, 0 + $h / 2, 0], 'frame', 0)
    ]
  )`,
};

const glassBlock: Recipe = {
  script: `[
    $box([$w, $h, $min([80, $d])], [0, $h / 2, 0], 'glassBlock')
  ]`,
};

/** Doors, gates and plain openings stay open */
const open: Recipe = {
  script: `[
  
  ]`,
};

/** An element's own geometry in the default materials */
const own: Recipe = {
  script: `[
    $base({"structure":"wall","water":"water","grate":"grate"})
  ]`,
};

export const OPENINGS: Record<string, Recipe> = { window: glazed, 'sliding-door': glazed, 'glass-block': glassBlock, door: open, gate: open, opening: open };
export const ELEMENTS: Record<string, Recipe> = { stair: own, pond: own, drain: own };
