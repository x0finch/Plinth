/** Living room: sofas, lounge chair, coffee and tea tables, TV stand, side table, potted plant, memorial sideboard (the Chinese pieces are in builtin.ts) */
import type { Recipe } from '../recipe.js';
import { block, clump, legs, pair } from './helpers.js';

/**
 * A Scandinavian sofa (IKEA style): wide, low, softly rounded arms, a deep seat on small black feet, loose seat and back
 * cushions of about 65 cm each, so a longer sofa gets more cushions
 */
const sofa: Recipe = {
  let: {
    leg: 50, arm: 'min(240, max(140, w * 0.11))', back: 'min(200, d * 0.22)', baseTop: 'leg + min(220, h * 0.27)', seatTop: 'max(baseTop + 40, min(h * 0.55, 450))',
    armTop: 'min(h * 0.76, 630)', inner: 'w - 2 * arm', n: 'max(1, round(inner / 650))', cw: 'inner / n', seatD: 'd - back - 30',
  },
  parts: [
    legs('dark', 60, 'leg', 20, { square: true }),
    block('fabric', ['w - 20', 'baseTop - leg', 'd - 20'], 0, 'leg', 0, 40),
    pair(block('fabric', ['arm', 'armTop - leg', 'd'], 's * (w - arm) / 2', 'leg', 0, 90)),
    block('fabric', ['inner + 40', 'h - baseTop - 40', 'back'], 0, 'baseTop', '-(d - back) / 2', 60),
    {
      kind: 'repeat', count: 'n', let: { x: '-inner / 2 + cw * (i + 0.5)' }, parts: [
        block('cushion', ['cw - 10', 'seatTop - baseTop', 'seatD'], 'x', 'baseTop', '(d - seatD) / 2 - 15', 70),
        { kind: 'box', mat: 'cushion', size: ['cw - 10', '(h - seatTop) * 0.98', 200], at: ['x', 'seatTop + (h - seatTop) * 0.49', '-d / 2 + back + 80'], r: 90, rot: [-9, 0, 0] },
      ],
    },
  ],
};

/**
 * A bentwood lounge chair (IKEA style): a laminated birch frame that runs along the floor, curves up at the front into the
 * arms and carries one long cushion from the knees to the head
 */
const armchair: Recipe = {
  let: {
    cw: 'w - 150', fx: 'cw / 2 + 25',
    zf: 'd / 2 - 110', yf: 'h * 0.43', zb: '-d / 2 + 230', yb: 'h * 0.32', zt: '-d / 2 + 60', yt: 'h - 30',
    a1: 'atan2(yf - yb, zf - zb)', l1: 'hypot(yf - yb, zf - zb)', a2: 'atan2(zb - zt, yt - yb)', l2: 'hypot(zb - zt, yt - yb)',
  },
  parts: [
    pair(
      { kind: 'tube', mat: 'birch', r: 16, points: [
        ['s * fx', 16, '-d / 2 + 100'], ['s * fx', 16, 'd / 2 - 160'], ['s * fx', 60, 'd / 2 - 40'], ['s * fx', 'h * 0.3', 'd / 2 - 30'],
        ['s * fx', 'h * 0.56', 'd / 2 - 80'], ['s * fx', 'h * 0.6', 'd / 2 - 260'], ['s * fx', 'h * 0.5', '-d / 2 + 250'], ['s * fx', 'yb - 20', 'zb - 20'],
      ] },
      { kind: 'tube', mat: 'birch', r: 14, points: [['s * (cw / 2 - 10)', 'yf - 50', 'zf'], ['s * (cw / 2 - 10)', 'yb - 50', 'zb'], ['s * (cw / 2 - 10)', 'yt - 40', 'zt + 20']] },
    ),
    { kind: 'rod', mat: 'birch', from: ['-fx', 16, '-d / 2 + 100'], to: ['fx', 16, '-d / 2 + 100'], r: 14 },
    { kind: 'rod', mat: 'birch', from: ['-fx', 'yf - 60', 'zf'], to: ['fx', 'yf - 60', 'zf'], r: 14 },
    { kind: 'box', mat: 'cushion', size: ['cw', 100, 'l1 + 60'], at: [0, '(yf + yb) / 2', '(zf + zb) / 2'], r: 45, rot: ['-a1', 0, 0] },
    { kind: 'box', mat: 'cushion', size: ['cw', 'l2 + 40', 90], at: [0, '(yb + yt) / 2', '(zb + zt) / 2'], r: 40, rot: ['-a2', 0, 0] },
  ],
};

/** A low table with a thick top flush on square legs and a shelf underneath (IKEA style): a birch top, white legs and shelf */
const coffee: Recipe = {
  let: { t: 50, l: 50 },
  parts: [
    block('birch', ['w', 't', 'd'], 0, 'h - t', 0, 4),
    legs('white', 'l / 2', 'h - t', 'l / 2', { square: true }),
    block('white', ['w - 2 * l', 18, 'd - 2 * l'], 0, 90, 0, 2),
    { kind: 'box', mat: 'book2', size: [260, 30, 190], at: ['-w * 0.22', 'h + 15', 20], r: 4, rot: [0, 11.5, 0] },
    { kind: 'box', mat: 'book4', size: [220, 25, 160], at: ['-w * 0.22', 'h + 43', 20], r: 4, rot: [0, -5.7, 0] },
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [50, 0], [90, 50], [90, 55], [0, 55]], at: ['w * 0.2', 'h', -20] },
    block('book1', [300, 22, 220], '-w * 0.18', 108, 0, 3, { plan: false }),
    block('book3', [280, 18, 200], '-w * 0.18', 130, 0, 3, { plan: false }),
  ],
};
/** A low media bench (IKEA style): a white case on slim steel legs, handleless push-open doors, a vase and books on top */
const tvstand: Recipe = {
  let: { leg: 110, n: 'max(1, round(w / 600))', dw: 'w / n' },
  parts: [
    legs('metal', 40, 'leg', 12),
    block('white', ['w', 'h - leg', 'd - 16'], 0, 'leg', -8, 6),
    {
      kind: 'repeat', count: 'n', let: { x: '-w / 2 + dw * (i + 0.5)' }, parts: [
        block('white', ['dw - 4', 'h - leg - 4', 16], 'x', 'leg + 2', 'd / 2 - 8', 3),
      ],
    },
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [60, 0], [80, 100], [40, 220], [35, 260], [0, 260]], at: ['-w * 0.32', 'h', 0] },
    block('book1', [300, 40, 220], 'w * 0.3', 'h', 0, 4),
    block('book3', [260, 35, 200], 'w * 0.3', 'h + 40', 0, 4),
  ],
};

/** A small square side table (IKEA style): a thick top flush on four square legs, all white */
const sidetable: Recipe = {
  let: { t: 50, l: 50 },
  parts: [
    block('white', ['w', 't', 'd'], 0, 'h - t', 0, 4),
    legs('white', 'l / 2', 'h - t', 'l / 2', { square: true }),
    { kind: 'lathe', mat: 'ceramicShade', profile: [[0, 0], [45, 0], [60, 60], [35, 150], [28, 180], [0, 180]], at: ['w * 0.15', 'h', '-d * 0.1'] },
  ],
};

/** A white ceramic pot with a small leafy tree */
const plant: Recipe = {
  let: { r: 'min(w, d) / 2', ph: 'min(340, h * 0.3)' },
  parts: [
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], ['r * 0.66', 0], ['r * 0.72', 'ph * 0.08'], ['r * 0.76', 'ph'], ['r * 0.7', 'ph'], [0, 'ph - 20']], at: [0, 0, 0] },
    { kind: 'cylinder', mat: 'soil', r: 'r * 0.7', h: 10, at: [0, 'ph - 25', 0] },
    ...([[0, 120], [120, 200], [240, 160]] as const).map(([a, lean]) =>
      ({ kind: 'rod' as const, mat: 'bark' as const, from: [0, 'ph - 30', 0] as [string | number, string, number], to: [`cos(${a}) * ${lean}`, 'h * 0.72', `sin(${a}) * ${lean}`] as [string, string, string], r: 12, seg: 6 })),
    ...([[0, 0.78, 0, 0.5], [0.16, 0.66, 0.08, 0.4], [-0.14, 0.7, 0.1, 0.38], [0.05, 0.62, -0.16, 0.4], [-0.08, 0.88, -0.06, 0.36], [0.1, 0.9, 0.1, 0.3]] as const)
      .map(([x, y, z, s], i) => clump(i % 2 ? 'leaf2' : 'leaf', `r * ${s} * 1.9`, [`${x} * r * 2.4`, `min(h - r * ${s}, ${y} * h)`, `${z} * r * 2.2`])),
  ],
};

/** A tea table (IKEA style): a birch top on a white frame with a slatted lower shelf, a birch tray with a white tea set */
const teatable: Recipe = {
  let: { tx: 'w * 0.12', ty: 'min(560, w * 0.4)', tz: 'min(320, d * 0.5)' },
  parts: [
    block('birch', ['w', 30, 'd'], 0, 'h - 30', 0, 6),
    legs('white', 40, 'h - 30', 22, { square: true }),
    pair(block('white', ['w - 80', 60, 20], 0, 'h - 90', 's * (d / 2 - 40)', 3)),
    { kind: 'repeat', count: 'max(3, floor((d - 120) / 90))', let: { n: 'max(3, floor((d - 120) / 90))' }, parts: [
      block('birch', ['w - 80', 18, '(d - 120) / n - 20'], 0, 140, '-(d - 120) / 2 + ((d - 120) / n) * (i + 0.5)', 3),
    ] },
    block('birch', ['ty', 18, 'tz'], 'tx', 'h', 0, 6),
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [45, 0], [70, 45], [55, 90], [18, 100], [18, 115], [0, 115]], at: ['tx - ty * 0.25', 'h + 18', 0] },
    { kind: 'repeat', count: 3, parts: [{ kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [20, 0], [28, 40], [0, 40]], at: ['tx + ty * 0.05 + i * 70', 'h + 18', 'tz * 0.2'] }] },
  ],
};

/** A memorial sideboard (IKEA style): a long white sideboard on birch legs, a small white cabinet with a glass door, white candles */
const shrine: Recipe = {
  let: { leg: 120, ht: 'min(800, h * 0.62)', n: 'max(2, round(w / 500))', dw: 'w / n', cw: 'min(600, w * 0.32)', cd: 'min(300, d * 0.6)', cz: '-d / 2 + cd / 2 + 20', top: 'h - ht' },
  parts: [
    legs('birch', 60, 'leg', 20),
    block('white', ['w', 'ht - leg', 'd - 16'], 0, 'leg', -8, 6),
    { kind: 'repeat', count: 'n', parts: [block('white', ['dw - 4', 'ht - leg - 4', 16], '-w / 2 + dw * (i + 0.5)', 'leg + 2', 'd / 2 - 8', 3)] },
    block('white', ['cw', 'top', 'cd'], 0, 'ht', 'cz', 4),
    { kind: 'box', mat: 'glass', size: ['cw - 40', 'top - 40', 6], at: [0, 'ht + top / 2', 'cz + cd / 2 + 3'], r: 2 },
    block('birch', ['cw - 60', 20, 'cd - 40'], 0, 'ht + top * 0.45', 'cz', 2),
    pair(
      { kind: 'cylinder', mat: 'ceramic', r: 35, h: 30, at: ['s * w * 0.3', 'ht + 15', 'd / 2 - 110'] },
      { kind: 'cylinder', mat: 'linen', r: 25, h: 180, at: ['s * w * 0.3', 'ht + 120', 'd / 2 - 110'] },
    ),
    { kind: 'lathe', mat: 'ceramicShade', profile: [[0, 0], [60, 0], [70, 40], [55, 90], [0, 90]], at: [0, 'ht', 'd / 2 - 90'] },
  ],
};

export const LIVING: Record<string, Recipe> = { sofa3: sofa, sofa2: sofa, armchair, coffee, teatable, tvstand, sidetable, plant, shrine };
