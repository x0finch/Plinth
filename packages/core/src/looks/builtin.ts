/**
 * Built-in look libraries: looks shipped with the app that anyone can add to a design, like a library shared with everyone
 * read-only. The Chinese set keeps the traditional pieces (tea table, ancestral shrine, wood-fired stove, stone table and
 * drum stool) while the default set follows an IKEA-like Scandinavian style. Bump a look's version when its recipe changes,
 * so designs that use it are offered the update.
 */
import type { Recipe } from '../recipe.js';
import { block, legs, pair } from './helpers.js';

/** A Chinese tea table: a heavy dark top with an apron, a stone tray, a teapot and cups */
const teatable: Recipe = {
  let: { tx: 'w * 0.1' },
  parts: [
    block('woodDark', ['w', 60, 'd'], 0, 'h - 60', 0, 10),
    block('woodDark', ['w - 80', 80, 'd - 80'], 0, 'h - 140', 0, 5),
    legs('woodDark', 50, 'h - 60', 30, { square: true }),
    pair(block('woodDark', ['w - 100', 30, 30], 0, 100, 's * (d / 2 - 50)', 5)),
    block('stoneDark', ['min(600, w * 0.45)', 30, 'min(340, d * 0.5)'], 'tx', 'h', 0, 10),
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [40, 0], [65, 40], [50, 85], [15, 95], [15, 110], [0, 110]], at: ['tx - 120', 'h + 30', 0] },
    { kind: 'repeat', count: 3, parts: [{ kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [18, 0], [26, 35], [0, 35]], at: ['tx + 40 + i * 70', 'h + 30', 60] }] },
  ],
};


/** An ancestral shrine: a lacquered altar table with raised ends, a small shrine cabinet, an incense burner and candles */
const shrine: Recipe = {
  let: { ht: 'min(850, h * 0.68)', cw: 'min(700, w * 0.35)', cd: 'min(320, d * 0.65)', cz: '-d / 2 + cd / 2 + 30', top: 'h - ht', fz: 'd / 2 - 90' },
  parts: [
    block('lacquer', ['w', 50, 'd'], 0, 'ht - 50', 0, 10),
    pair(block('lacquer', [140, 35, 'd'], 's * (w / 2 - 70)', 'ht', 0, 10)),
    legs('lacquer', 50, 'ht - 50', 35, { square: true, w: 'w - 100' }),
    block('lacquer', ['w - 300', 100, 25], 0, 'ht - 150', 'd / 2 - 60', 5),
    block('lacquer', ['cw + 80', 40, 'cd + 40'], 0, 'ht', 'cz', 8),
    block('lacquer', ['cw', 'top - 90', 'cd'], 0, 'ht + 40', 'cz', 6),
    block('lacquer', ['cw + 160', 50, 'cd + 120'], 0, 'h - 50', 'cz', 10),
    block('gold', ['cw * 0.7', '(top - 90) * 0.75', 10], 0, 'ht + 60', 'cz + cd / 2', 3),
    { kind: 'lathe', mat: 'gold', profile: [[0, 0], [50, 0], [80, 30], [80, 70], [70, 80], [0, 80]], at: [0, 'ht', 'fz'] },
    pair(
      { kind: 'cylinder', mat: 'gold', r: 45, r2: 30, h: 60, at: ['s * w * 0.3', 'ht + 30', 'fz'] },
      { kind: 'cylinder', mat: 'red', r: 25, h: 200, at: ['s * w * 0.3', 'ht + 160', 'fz'] },
    ),
  ],
};


/** A wood-fired stove: a tiled masonry body, two iron woks (one under a wooden lid), fire openings in front */
const woodstove: Recipe = {
  let: { r: 'min(300, d * 0.38, w * 0.15)', fh: 'min(240, h * 0.32)' },
  parts: [
    block('plaster', ['w', 'h - 50', 'd'], 0, 0, 0, 40),
    block('countertop', ['w + 20', 50, 'd + 20'], 0, 'h - 50', 0, 20),
    pair(
      { kind: 'ring', mat: 'iron', R: 'r', r: 20, at: ['s * w * 0.22', 'h + 5', 0] },
      { kind: 'cylinder', mat: 'iron', r: 'r', h: 4, at: ['s * w * 0.22', 'h', 0], seg: 32 },
      block('dark', [260, 'fh', 20], 's * w * 0.22', 120, 'd / 2 + 2', 60),
    ),
    { kind: 'lathe', mat: 'wood', profile: [[0, 'r * 0.03'], ['r * 0.65', 'r * 0.03'], ['r * 0.55', 'r * 0.08'], ['r * 0.35', 'r * 0.14'], [0, 'r * 0.17']], at: ['w * 0.22', 'h', 0] },
    { kind: 'cylinder', mat: 'wood', r: 30, h: 50, at: ['w * 0.22', 'h + r * 0.22 + 25', 0] },
  ],
};


/** A round stone table on a carved drum */
const stonetable: Recipe = {
  let: { r: 'min(w, d) / 2' },
  parts: [
    { kind: 'cylinder', mat: 'stone', r: 'r', r2: 'r * 0.98', h: 80, at: [0, 'h - 40', 0], seg: 40 },
    { kind: 'lathe', mat: 'stone', profile: [[0, 0], ['r * 0.42', 0], ['r * 0.42', 60], ['r * 0.3', 140], ['r * 0.26', 'h * 0.45'], ['r * 0.34', 'h - 140'], ['r * 0.4', 'h - 80'], [0, 'h - 80']], at: [0, 0, 0] },
  ],
};

/** A drum-shaped stone stool */
const stool: Recipe = {
  let: { r: 'min(w, d) / 2' },
  parts: [
    { kind: 'lathe', mat: 'stone', profile: [[0, 0], ['r * 0.78', 0], ['r * 0.95', 'h * 0.3'], ['r', 'h * 0.5'], ['r * 0.95', 'h * 0.7'], ['r * 0.8', 'h'], [0, 'h']], at: [0, 0, 0] },
    { kind: 'ring', mat: 'stoneDark', R: 'r * 0.99', r: 8, at: [0, 'h * 0.5', 0] },
  ],
};

export interface BuiltinLook {
  id: string;
  name: { zh: string; en: string };
  for: string[];
  recipe: Recipe;
  version: number;
}
export interface BuiltinLibrary {
  id: string;
  name: { zh: string; en: string };
  looks: BuiltinLook[];
}

export const BUILTIN_LIBRARIES: BuiltinLibrary[] = [
  {
    id: 'builtin-chinese',
    name: { zh: '中式物件', en: 'Chinese pieces' },
    looks: [
      { id: 'teatable', name: { zh: '功夫茶台', en: 'Gongfu tea table' }, for: ['furniture:teatable'], recipe: teatable, version: 1 },
      { id: 'shrine', name: { zh: '神位供桌', en: 'Ancestral altar' }, for: ['furniture:shrine'], recipe: shrine, version: 1 },
      { id: 'woodstove', name: { zh: '土灶', en: 'Brick wood-fired stove' }, for: ['furniture:woodstove'], recipe: woodstove, version: 1 },
      { id: 'stonetable', name: { zh: '石桌', en: 'Stone table' }, for: ['furniture:stonetable'], recipe: stonetable, version: 1 },
      { id: 'stool', name: { zh: '石鼓凳', en: 'Stone drum stool' }, for: ['furniture:stool'], recipe: stool, version: 1 },
    ],
  },
];

export const builtinLibrary = (id: string) => BUILTIN_LIBRARIES.find(l => l.id === id);
