/** Bathroom and laundry: toilet, washbasin, showers, grab bar, call button, folding seat, washing machine, laundry sink */
import type { Expr, Recipe, RecipePart } from '../recipe.js';
import { block, pair } from './helpers.js';

/** A toilet: a cistern against the wall (north), an oval bowl, seat and lid */
const toilet: Recipe = {
  let: { tank: 'min(180, d * 0.26)', seat: 'min(400, h * 0.53)', r: 'min(w / 2, 200)', k: 'min(1.45, (d - tank + 20) / (2 * r))', bz: 'd / 2 - r * k' },
  parts: [
    block('ceramic', ['w * 0.95', 'h - seat - 30', 'tank'], 0, 'seat', '-d / 2 + tank / 2', 30),
    block('ceramic', ['w', 25, 'tank + 20'], 0, 'h - 30', '-d / 2 + tank / 2', 10),
    { kind: 'lathe', mat: 'ceramic', profile: [[0, 0], ['r * 0.55', 0], ['r * 0.6', 'seat * 0.25'], ['r * 0.82', 'seat * 0.75'], ['r * 0.95', 'seat - 30'], [0, 'seat - 30']], at: [0, 0, 'bz'], scale: [1, 1, 'k'] },
    { kind: 'cylinder', mat: 'ceramic', r: 'r', h: 30, at: [0, 'seat - 15', 'bz'], scale: [1, 1, 'k'], seg: 32 },
    { kind: 'cylinder', mat: 'ceramic', r: 'r * 0.96', h: 20, at: [0, 'seat + 10', 'bz'], scale: [1, 1, 'k'], seg: 32 },
    { kind: 'cylinder', mat: 'metal', r: 25, h: 10, at: [0, 'h - 5', '-d / 2 + tank / 2'] },
  ],
};

/** A wall-hung vanity (IKEA style): a white case with two handleless drawers, a ceramic top with its basin, a faucet */
const basin: Recipe = {
  let: { top: 'h - 40', ch: 'min(500, top - 200)', dh: '(ch - 12) / 2', br: 'min(w * 0.32, 200)' },
  parts: [
    block('white', ['w', 'ch', 'd - 20'], 0, 'top - ch', -10, 4),
    { kind: 'repeat', count: 2, let: { y: 'top - ch + 4 + i * (dh + 4)' }, parts: [
      block('white', ['w - 8', 'dh', 16], 0, 'y', 'd / 2 - 10', 2),
      block('metal', ['min(260, w * 0.5)', 8, 6], 0, 'y + dh - 20', 'd / 2 + 1', 3, { plan: false }),
    ] },
    block('ceramic', ['w', 40, 'd'], 0, 'top', 0, 12),
    { kind: 'cylinder', mat: 'ceramicShade', r: 'br', h: 4, at: [0, 'h + 2', 30.5], scale: [1, 1, 0.75], seg: 36 },
    { kind: 'cylinder', mat: 'metal', r: 20, h: 180, at: [0, 'h + 90', '-d / 2 + 60'] },
    { kind: 'rod', mat: 'metal', from: [0, 'h + 170', '-d / 2 + 60'], to: [0, 'h + 150', '-d / 2 + 180'], r: 12 },
  ],
};

/** A shower: the tray, glass panels along `glass` (where there is no wall), a riser rail and head on the back wall */
function shower(tray: RecipePart, glass: [Expr, Expr][]): RecipePart[] {
  return [
    tray,
    ...glass.slice(1).flatMap((b, k): RecipePart[] => [
      { kind: 'panel', mat: 'glass', from: glass[k], to: b, y: 50, h: 'h - 50', t: 8 },
      { kind: 'rod', mat: 'metal', from: [glass[k][0], 'h', glass[k][1]], to: [b[0], 'h', b[1]], r: 10, seg: 8 },
    ]),
    ...glass.map(([x, z]): RecipePart => ({ kind: 'rod', mat: 'metal', from: [x, 50, z], to: [x, 'h', z], r: 10, seg: 8 })),
    { kind: 'rod', mat: 'metal', from: ['-w * 0.15', 'min(900, h * 0.45)', '-d / 2 + 30'], to: ['-w * 0.15', 'h - 100', '-d / 2 + 30'], r: 12 },
    { kind: 'rod', mat: 'metal', from: ['-w * 0.15', 'h - 100', '-d / 2 + 30'], to: ['-w * 0.15', 'h - 120', '-d / 2 + 230'], r: 10 },
    { kind: 'cylinder', mat: 'metal', r: 90, h: 15, at: ['-w * 0.15', 'h - 127.5', '-d / 2 + 250'], seg: 28 },
    { kind: 'cylinder', mat: 'metal', r: 30, h: 6, at: [0, 53, 50] },
  ];
}

/** A square shower in a corner (walls to the north and west), glass to the south and east */
const showerSquare: Recipe = {
  parts: shower(block('ceramic', ['w', 50, 'd'], 0, 0, 0, 10), [['-w / 2', 'd / 2'], ['w / 2', 'd / 2'], ['w / 2', '-d / 2']]),
};

/** A diamond shower: a corner shower with its outer corner cut by the door */
const showerDiamond: Recipe = {
  let: { c: 'min(w, d) * 0.45' },
  parts: shower(
    { kind: 'extrude', mat: 'ceramic', plane: 'plan', profile: [['-w / 2', '-d / 2'], ['w / 2', '-d / 2'], ['w / 2', 'd / 2 - c'], ['w / 2 - c', 'd / 2'], ['-w / 2', 'd / 2']], depth: 50 },
    [['-w / 2', 'd / 2'], ['w / 2 - c', 'd / 2'], ['w / 2', 'd / 2 - c'], ['w / 2', '-d / 2']],
  ),
};

/** A grab bar on the wall (north): a rail on two posts with round wall plates */
const grab: Recipe = {
  let: { y: 'h / 2', z: 'd / 2 - 20', x: 'w / 2 - 40' },
  parts: [
    { kind: 'rod', mat: 'metal', from: ['-x', 'y', 'z'], to: ['x', 'y', 'z'], r: 16, seg: 14 },
    pair(
      { kind: 'rod', mat: 'metal', from: ['s * x', 'y', 'z'], to: ['s * x', 'y', '-d / 2 + 10'], r: 12 },
      { kind: 'cylinder', mat: 'metal', r: 35, h: 10, axis: 'z', at: ['s * x', 'y', '-d / 2 + 5'], seg: 28 },
    ),
  ],
};

/** An emergency call button: a white plate with a red button */
const sos: Recipe = {
  parts: [
    { kind: 'box', mat: 'appliance', size: ['w', 'h', 15], at: [0, 'h / 2', '-d / 2 + 7.5'], r: 8 },
    { kind: 'cylinder', mat: 'red', r: 'min(w, h) * 0.28', h: 18, axis: 'z', at: [0, 'h / 2', '-d / 2 + 24'], seg: 28 },
  ],
};

/** A folding shower seat: slatted seat on a wall plate (north), held by two diagonal braces */
const foldseat: Recipe = {
  let: { sd: '(d - 30) / 4' },
  parts: [
    block('metal', ['w - 40', 140, 20], 0, 'h - 160', '-d / 2 + 10', 6),
    { kind: 'repeat', count: 4, parts: [block('wood', ['w', 25, 'sd - 12'], 0, 'h - 25', '-d / 2 + 25 + sd * (i + 0.5)', 6)] },
    pair(
      { kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 30)', 'h - 30', 'd / 2 - 50'], to: ['s * (w / 2 - 30)', 'h - 300', '-d / 2 + 20'], r: 10 },
      { kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 30)', 'h - 30', '-d / 2 + 20'], to: ['s * (w / 2 - 30)', 'h - 30', 'd / 2 - 30'], r: 10 },
    ),
  ],
};

/** A front-loading washing machine: control strip, round door */
const washer: Recipe = {
  let: { z: 'd / 2', dr: 'min(w, h)' },
  parts: [
    block('appliance', ['w', 'h', 'd - 10'], 0, 0, -5, 25),
    { kind: 'box', mat: 'dark', size: ['w * 0.4', 50, 4], at: ['-w * 0.15', 'h - 65', 'z - 8'], r: 4 },
    { kind: 'cylinder', mat: 'metal', r: 30, h: 20, axis: 'z', at: ['w * 0.3', 'h - 65', 'z'], seg: 28 },
    { kind: 'ring', mat: 'metal', R: 'dr * 0.27', r: 25, axis: 'z', at: [0, 'h * 0.45', 'z'] },
    { kind: 'cylinder', mat: 'carGlass', r: 'dr * 0.25', h: 10, axis: 'z', at: [0, 'h * 0.45', 'z - 5'], seg: 28 },
  ],
};

/** A laundry sink: a deep tub with a ribbed washboard on a pedestal, a tap on the wall (north) */
const sink: Recipe = {
  let: { tub: 'min(300, h * 0.38)', t: 35, y: 'h - tub', bd: '(d - 2 * t) * 0.45', slope: 'atan2(tub * 0.5, bd)', ribs: 'floor(bd / 30)' },
  parts: [
    block('ceramic', ['w - 120', 'y', 'd - 140'], 0, 0, -30, 10),
    block('ceramic', ['w', 't', 'd'], 0, 'y', 0, 10),
    pair(block('ceramic', ['w', 'tub', 't'], 0, 'y', 's * (d / 2 - t / 2)', 12), block('ceramic', ['t', 'tub', 'd'], 's * (w / 2 - t / 2)', 'y', 0, 12)),
    { kind: 'box', mat: 'ceramicShade', size: ['w - 2 * t', 20, 'bd / cos(slope)'], at: [0, 'h - tub * 0.25 - 20', '-d / 2 + t + bd / 2'], r: 5, rot: ['slope', 0, 0] },
    { kind: 'repeat', count: 'ribs', let: { f: '(i + 0.5) / ribs' }, parts: [{ kind: 'box', mat: 'ceramic', size: ['w - 2 * t - 20', 10, 12], at: [0, 'h - 10 - f * tub * 0.5', '-d / 2 + t + f * bd'], r: 4, plan: false }] },
    { kind: 'rod', mat: 'metal', from: [0, 'h + 250', '-d / 2 + 5'], to: [0, 'h + 250', '-d / 2 + 120'], r: 12 },
    { kind: 'rod', mat: 'metal', from: [0, 'h + 250', '-d / 2 + 120'], to: [0, 'h + 180', '-d / 2 + 130'], r: 10 },
  ],
};

export const BATH: Record<string, Recipe> = { toilet, basin, shower: showerSquare, shower5: showerDiamond, grab, sos, foldseat, washer, sink };
