/** Kitchen and dining: dining table and chair, counter, wood-fired stove, island, bar counter and stool, fridge */
import type { Expr, Recipe, RecipePart } from '../recipe.js';
import { block, legs, pair } from './helpers.js';

const dining: Recipe = {
  parts: [
    block('wood', ['w', 40, 'd'], 0, 'h - 40', 0, 10),
    block('wood', ['w - 160', 80, 'd - 160'], 0, 'h - 120', 0, 4),
    legs('wood', 70, 'h - 40', 30, { square: true }),
  ],
};

/** A wooden chair with a cushioned seat and a railed back (to the north) */
const chair: Recipe = {
  let: { seat: 'min(460, h * 0.54)', bz: '-d / 2 + 35' },
  parts: [
    legs('wood', 35, 'seat - 30', 17),
    block('wood', ['w', 35, 'd'], 0, 'seat - 35', 0, 10),
    block('fabric', ['w - 50', 30, 'd - 80'], 0, 'seat', 20, 12),
    pair({ kind: 'rod', mat: 'wood', from: ['s * (w / 2 - 35)', 'seat', 'bz'], to: ['s * (w / 2 - 35)', 'h', 'bz - 30'], r: 16, seg: 8 }),
    { kind: 'box', mat: 'wood', size: ['w - 20', 100, 22], at: [0, 'h - 70', 'bz - 25'], r: 8, rot: [-4.6, 0, 0] },
    { kind: 'box', mat: 'wood', size: ['w - 60', 40, 20], at: [0, 'seat + 200', 'bz - 12'], r: 6, rot: [-4.6, 0, 0] },
  ],
};

/** Base cabinets of height `h` and depth `d`, centred at z, facing south (face 1) or north (-1): a dark plinth, a wood carcass, white doors with handles */
function cabinets(d: Expr, h: Expr, z: Expr, face: 1 | -1): RecipePart[] {
  return [
    block('dark', ['w - 20', 100, `(${d}) - 80`], 0, 0, `(${z}) - ${face * 30}`, 5),
    block('wood', ['w', `(${h}) - 100`, `(${d}) - 30`], 0, 100, `(${z}) - ${face * 15}`, 6),
    {
      kind: 'repeat', count: 'max(1, round(w / 600))', let: { dw: 'w / max(1, round(w / 600))', x: '-w / 2 + dw * (i + 0.5)' }, parts: [
        block('cabinet', ['dw - 6', `(${h}) - 130`, 18], 'x', 110, `(${z}) + ${face} * ((${d}) / 2 - 20)`, 4),
        { kind: 'box', mat: 'metal', size: ['min(160, dw * 0.4)', 12, 20], at: ['x', `(${h}) - 60`, `(${z}) + ${face} * ((${d}) / 2 - 2)`], r: 5 },
      ],
    },
  ];
}

/** Base cabinets under a stone top, with a sink and a cooktop */
const counter: Recipe = {
  let: { sx: '-w * 0.22', cx: 'w * 0.24' },
  parts: [
    ...cabinets('d', 'h - 40', 0, 1),
    block('countertop', ['w', 40, 'd'], 0, 'h - 40', 0, 6),
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

/** A kitchen island: cabinets facing north, a stone top overhanging to the south for stools, a bowl on top */
const island: Recipe = {
  let: { over: 'min(300, d * 0.3)' },
  parts: [
    ...cabinets('d - over', 'h - 40', '-over / 2', -1),
    block('countertop', ['w', 40, 'd'], 0, 'h - 40', 0, 6),
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], [60, 0], [130, 80], [125, 85], [0, 30]], at: ['w * 0.2', 'h', 0] },
  ],
};

/** A bar counter: a fluted wood front, a stone top and a metal foot rail */
const bar: Recipe = {
  let: { n: 'floor(w / 60)' },
  parts: [
    block('wood', ['w', 'h - 50', 'd - 60'], 0, 0, -30, 8),
    { kind: 'repeat', count: 'n', parts: [{ kind: 'box', mat: 'wood', size: [40, 'h - 80', 20], at: ['-w / 2 + (w / n) * (i + 0.5)', '(h - 50) / 2', 'd / 2 - 50'], r: 10, plan: false }] },
    block('countertop', ['w', 50, 'd'], 0, 'h - 50', 0, 8),
    { kind: 'rod', mat: 'metal', from: ['-w / 2 + 100', 220, 'd / 2 - 10'], to: ['w / 2 - 100', 220, 'd / 2 - 10'], r: 16 },
    pair({ kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 150)', 220, 'd / 2 - 10'], to: ['s * (w / 2 - 150)', 220, 'd / 2 - 50'], r: 10 }),
  ],
};

/** A bar stool: a cushioned seat on a metal pole, foot ring and base */
const barstool: Recipe = {
  let: { r: 'min(w, d) / 2' },
  parts: [
    { kind: 'cylinder', mat: 'metal', r: 'r * 0.85', r2: 'r * 0.8', h: 20, at: [0, 10, 0], seg: 28 },
    { kind: 'cylinder', mat: 'metal', r: 24, h: 'h - 60', at: [0, '20 + (h - 60) / 2', 0] },
    { kind: 'ring', mat: 'metal', R: 'r * 0.65', r: 10, at: [0, 'h * 0.4', 0] },
    { kind: 'repeat', count: 3, parts: [{ kind: 'rod', mat: 'metal', from: [0, 'h * 0.4', 0], to: ['cos(i * 120) * r * 0.65', 'h * 0.4', 'sin(i * 120) * r * 0.65'], r: 6 }] },
    { kind: 'lathe', mat: 'fabric', profile: [[0, 0], ['r * 0.95', 0], ['r', 30], ['r * 0.95', 60], [0, 65]], at: [0, 'h - 65', 0] },
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
