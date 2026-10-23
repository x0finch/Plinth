/** Living room: sofas, armchair, coffee and tea tables, TV stand, side table, potted plant, ancestral shrine */
import type { Recipe } from '../recipe.js';
import { block, clump, legs, pair } from './helpers.js';

/** Legs, a base, arms and a back frame; seat and back cushions of about 65 cm each, so a longer sofa gets more cushions */
const sofa: Recipe = {
  let: {
    leg: 70, arm: 'min(180, max(120, w * 0.1))', back: 'min(220, d * 0.25)', baseTop: 'leg + min(200, h * 0.25)', seatTop: 'max(baseTop + 40, min(h * 0.55, 450))',
    armTop: 'min(h * 0.8, 640)', inner: 'w - 2 * arm', n: 'max(1, round(inner / 650))', cw: 'inner / n', seatD: 'd - back - 20',
  },
  parts: [
    legs('woodDark', 80, 'leg', 24),
    block('fabric', ['w', 'baseTop - leg', 'd'], 0, 'leg', 0, 30),
    pair(block('fabric', ['arm', 'armTop - leg', 'd'], 's * (w - arm) / 2', 'leg', 0, 50)),
    block('fabric', ['w - 2 * arm + 20', 'h - baseTop', 'back'], 0, 'baseTop', '-(d - back) / 2', 50),
    {
      kind: 'repeat', count: 'n', let: { x: '-inner / 2 + cw * (i + 0.5)' }, parts: [
        block('cushion', ['cw - 12', 'seatTop - baseTop', 'seatD'], 'x', 'baseTop', '(d - seatD) / 2 - 10', 60),
        { kind: 'box', mat: 'cushion', size: ['cw - 12', '(h - seatTop) * 0.92', 170], at: ['x', 'seatTop + (h - seatTop) * 0.46', '-d / 2 + back + 70'], r: 70, rot: [-6.9, 0, 0] },
      ],
    },
  ],
};

const coffee: Recipe = {
  parts: [
    block('wood', ['w', 40, 'd'], 0, 'h - 40', 0, 12),
    block('wood', ['w - 140', 20, 'd - 120'], 0, 120, 0, 6),
    legs('wood', 50, 'h - 40', 22),
    { kind: 'box', mat: 'book2', size: [260, 30, 190], at: ['-w * 0.22', 'h + 15', 20], r: 4, rot: [0, 11.5, 0] },
    { kind: 'box', mat: 'book4', size: [220, 25, 160], at: ['-w * 0.22', 'h + 43', 20], r: 4, rot: [0, -5.7, 0] },
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [50, 0], [90, 50], [90, 55], [0, 55]], at: ['w * 0.2', 'h', -20] },
  ],
};

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

/** A low cabinet: a wood carcass with white doors, a vase and books on top */
const tvstand: Recipe = {
  let: { n: 'max(1, round(w / 600))', dw: 'w / n' },
  parts: [
    legs('woodDark', 60, 80, 18),
    block('wood', ['w', 'h - 80', 'd'], 0, 80, 0, 12),
    {
      kind: 'repeat', count: 'n', let: { x: '-w / 2 + dw * (i + 0.5)' }, parts: [
        block('cabinet', ['dw - 30', 'h - 120', 14], 'x', 100, 'd / 2', 4),
        { kind: 'box', mat: 'metal', size: [100, 12, 16], at: ['x', 'h - 60', 'd / 2 + 12'], r: 5 },
      ],
    },
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [60, 0], [80, 100], [40, 220], [35, 260], [0, 260]], at: ['-w * 0.32', 'h', 0] },
    block('book1', [300, 40, 220], 'w * 0.3', 'h', 0, 4),
    block('book3', [260, 35, 200], 'w * 0.3', 'h + 40', 0, 4),
  ],
};

/** A round side table on one stem */
const sidetable: Recipe = {
  let: { r: 'min(w, d) / 2' },
  parts: [
    { kind: 'cylinder', mat: 'wood', r: 'r', h: 30, at: [0, 'h - 15', 0], seg: 36 },
    { kind: 'cylinder', mat: 'wood', r: 'r * 0.55', r2: 'r * 0.6', h: 20, at: [0, 10, 0], seg: 32 },
    { kind: 'cylinder', mat: 'woodDark', r: 25, h: 'h - 50', at: [0, '20 + (h - 50) / 2', 0] },
  ],
};

/** A terracotta pot with a small leafy tree */
const plant: Recipe = {
  let: { r: 'min(w, d) / 2', ph: 'min(380, h * 0.32)' },
  parts: [
    { kind: 'lathe', mat: 'terracotta', profile: [[0, 0], ['r * 0.6', 0], ['r * 0.78', 'ph * 0.92'], ['r * 0.82', 'ph'], [0, 'ph']], at: [0, 0, 0] },
    { kind: 'cylinder', mat: 'soil', r: 'r * 0.74', h: 10, at: [0, 'ph - 25', 0] },
    ...([[0, 120], [120, 200], [240, 160]] as const).map(([a, lean]) =>
      ({ kind: 'rod' as const, mat: 'bark' as const, from: [0, 'ph - 30', 0] as [string | number, string, number], to: [`cos(${a}) * ${lean}`, 'h * 0.72', `sin(${a}) * ${lean}`] as [string, string, string], r: 12, seg: 6 })),
    ...([[0, 0.78, 0, 0.5], [0.16, 0.66, 0.08, 0.4], [-0.14, 0.7, 0.1, 0.38], [0.05, 0.62, -0.16, 0.4], [-0.08, 0.88, -0.06, 0.36], [0.1, 0.9, 0.1, 0.3]] as const)
      .map(([x, y, z, s], i) => clump(i % 2 ? 'leaf2' : 'leaf', `r * ${s} * 1.9`, [`${x} * r * 2.4`, `min(h - r * ${s}, ${y} * h)`, `${z} * r * 2.2`])),
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

export const LIVING: Record<string, Recipe> = { sofa3: sofa, sofa2: sofa, armchair: sofa, coffee, teatable, tvstand, sidetable, plant, shrine };
