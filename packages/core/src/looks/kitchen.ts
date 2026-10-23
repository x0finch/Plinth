/** Kitchen and dining: dining table and chair, counter, wood-fired stove, island, bar counter and stool, fridge */
import type { Expr, Recipe, RecipePart } from '../recipe.js';
import { block, legs, pair } from './helpers.js';

/** A dining table (IKEA style): a thin birch top with a softened edge on slightly tapered round legs and a slim frame */
const dining: Recipe = {
  parts: [
    block('birch', ['w', 28, 'd'], 0, 'h - 28', 0, 8),
    block('birch', ['w - 200', 60, 'd - 200'], 0, 'h - 88', 0, 3),
    legs('birch', 90, 'h - 28', 26),
  ],
};

/** A white spindle-back chair (IKEA style): turned legs, a solid seat, rear posts that rise into a bent top rail, five spindles */
const chair: Recipe = {
  let: { seat: 'min(450, h * 0.53)', bz: '-d / 2 + 30', tilt: 50 },
  parts: [
    legs('white', 30, 'seat - 30', 16),
    block('white', ['w - 20', 22, 'd - 40'], 0, 'seat - 52', 0, 4),
    block('white', ['w', 30, 'd'], 0, 'seat - 30', 10, 12),
    pair({ kind: 'rod', mat: 'white', from: ['s * (w / 2 - 30)', 'seat - 30', 'bz'], to: ['s * (w / 2 - 34)', 'h - 20', 'bz - tilt'], r: 15, seg: 10 }),
    { kind: 'box', mat: 'white', size: ['w - 30', 90, 24], at: [0, 'h - 55', 'bz - tilt + 2'], r: 10, rot: [-8, 0, 0] },
    { kind: 'repeat', count: 5, let: { x: '(i - 2) * (w - 120) / 4' }, parts: [
      { kind: 'rod', mat: 'white', from: ['x', 'seat', 'bz + 6'], to: ['x', 'h - 95', 'bz - tilt + 8'], r: 8, seg: 8 },
    ] },
  ],
};

/**
 * Base cabinets of height `h` and depth `d`, centred at z, facing south (face 1) or north (-1), IKEA style: a white case on a
 * recessed plinth, flat white handleless fronts with a narrow drawer above each door, thin gaps between them
 */
function cabinets(d: Expr, h: Expr, z: Expr, face: 1 | -1): RecipePart[] {
  return [
    block('white', ['w - 20', 100, `(${d}) - 80`], 0, 0, `(${z}) - ${face * 30}`, 3),
    block('white', ['w', `(${h}) - 100`, `(${d}) - 30`], 0, 100, `(${z}) - ${face * 15}`, 4),
    {
      kind: 'repeat', count: 'max(1, round(w / 600))', let: { dw: 'w / max(1, round(w / 600))', x: '-w / 2 + dw * (i + 0.5)', dh: 160 }, parts: [
        block('white', ['dw - 4', `(${h}) - 108 - dh`, 18], 'x', 102, `(${z}) + ${face} * ((${d}) / 2 - 20)`, 2),
        block('white', ['dw - 4', 'dh - 4', 18], 'x', `(${h}) - 4 - dh`, `(${z}) + ${face} * ((${d}) / 2 - 20)`, 2),
        { kind: 'box', mat: 'metal', size: ['min(240, dw * 0.45)', 10, 16], at: ['x', `(${h}) - 40`, `(${z}) + ${face} * ((${d}) / 2 - 4)`], r: 4 },
      ],
    },
  ];
}

/** Base cabinets under an oak-look worktop, with a steel sink and a black cooktop */
const counter: Recipe = {
  let: { sx: '-w * 0.22', cx: 'w * 0.24' },
  parts: [
    ...cabinets('d', 'h - 40', 0, 1),
    block('birch', ['w', 40, 'd'], 0, 'h - 40', 0, 4),
    block('metal', ['min(550, w * 0.3)', 4, 'd * 0.62'], 'sx', 'h', 20, 20),
    { kind: 'rod', mat: 'metal', from: ['sx', 'h', '-d / 2 + 80'], to: ['sx', 'h + 300', '-d / 2 + 80'], r: 13 },
    { kind: 'rod', mat: 'metal', from: ['sx', 'h + 300', '-d / 2 + 80'], to: ['sx', 'h + 280', '-d / 2 + 240'], r: 11 },
    block('dark', ['min(600, w * 0.3)', 6, 'd * 0.75'], 'cx', 'h', 20, 10),
    ...([[-140, -100, 80], [140, -100, 60], [-140, 120, 60], [140, 120, 80]] as const)
      .map(([dx, dz, R]) => ({ kind: 'ring' as const, mat: 'metal' as const, R, r: 6, at: [`cx + ${dx}`, 'h + 8', dz + 20] as [string, string, number] })),
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

/** A kitchen island: cabinets facing north, an oak-look top overhanging to the south for stools, a bowl on top */
const island: Recipe = {
  let: { over: 'min(300, d * 0.3)' },
  parts: [
    ...cabinets('d - over', 'h - 40', '-over / 2', -1),
    block('birch', ['w', 40, 'd'], 0, 'h - 40', 0, 4),
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [60, 0], [130, 80], [125, 85], [0, 30]], at: ['w * 0.2', 'h', 0] },
  ],
};

/** A bar counter (IKEA style): a white panelled front, an oak-look top overhanging the front, a steel foot rail */
const bar: Recipe = {
  let: { n: 'max(1, round(w / 600))' },
  parts: [
    block('white', ['w', 'h - 40', 'd - 120'], 0, 0, -60, 4),
    { kind: 'repeat', count: 'n', parts: [block('white', ['w / n - 4', 'h - 50', 14], '-w / 2 + (w / n) * (i + 0.5)', 4, 'd / 2 - 113', 2)] },
    block('birch', ['w', 40, 'd'], 0, 'h - 40', 0, 4),
    { kind: 'rod', mat: 'metal', from: ['-w / 2 + 100', 220, 'd / 2 - 60'], to: ['w / 2 - 100', 220, 'd / 2 - 60'], r: 14 },
    pair({ kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 150)', 220, 'd / 2 - 60'], to: ['s * (w / 2 - 150)', 220, 'd / 2 - 106'], r: 9 }),
  ],
};

/** A wooden bar stool (IKEA style): a round birch seat on four splayed legs joined by a foot ring */
const barstool: Recipe = {
  let: { r: 'min(w, d) / 2', top: 'r * 0.42', foot: 'r * 0.82', fy: 'h * 0.32' },
  parts: [
    { kind: 'cylinder', mat: 'birch', r: 'r * 0.82', h: 30, at: [0, 'h - 15', 0], seg: 36 },
    { kind: 'repeat', count: 4, let: { a: 'i * 90 + 45' }, parts: [
      { kind: 'rod', mat: 'birch', from: ['cos(a) * top', 'h - 30', 'sin(a) * top'], to: ['cos(a) * foot', 0, 'sin(a) * foot'], r: 15, seg: 10 },
    ] },
    { kind: 'ring', mat: 'birch', R: 'top + (foot - top) * (1 - fy / (h - 30))', r: 10, at: [0, 'fy', 0] },
  ],
};

/** A fridge: freezer drawer below, door above, handles on the right */
const fridge: Recipe = {
  let: { split: 'h * 0.36', fz: 'd / 2 - 25' },
  parts: [
    block('appliance', ['w', 'h - 20', 'd - 60'], 0, 20, -30, 30),
    block('appliance', ['w - 6', 'split - 30', 50], 0, 25, 'fz', 20),
    block('appliance', ['w - 6', 'h - split - 30', 50], 0, 'split + 5', 'fz', 20),
    { kind: 'rod', mat: 'metal', from: ['w / 2 - 60', 'split - 80', 'fz + 40'], to: ['w / 2 - 60', 'split - 300', 'fz + 40'], r: 12 },
    { kind: 'rod', mat: 'metal', from: ['w / 2 - 60', 'split + 100', 'fz + 40'], to: ['w / 2 - 60', 'split + 600', 'fz + 40'], r: 12 },
    block('dark', ['w - 100', 20, 'd - 100'], 0, 0, -30, 5),
  ],
};

export const KITCHEN: Record<string, Recipe> = { dining, chair, counter, woodstove, island, bar, barstool, fridge };
