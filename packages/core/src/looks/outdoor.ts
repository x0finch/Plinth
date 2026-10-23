/** Yard and roof: courtyard tree, car, rocking chair, garden table and stool, planters, solar heater, water tank, drying rack, canopy, awning */
import type { Expr, Recipe, RecipeMaterial, RecipePart } from '../recipe.js';
import { block, clump, legs, pair } from './helpers.js';

/** A birch: a slim white trunk with dark marks, two leaning stems, a light, airy crown of small clumps in two greens */
const tree: Recipe = {
  seed: 5,
  let: { r: 'min(w, d) / 2', trunkH: 'h * 0.42', tr: 'max(90, r * 0.06)', cy: 'h * 0.68', ry: 'min(h * 0.22, h - cy - r * 0.25)' },
  parts: [
    { kind: 'cylinder', mat: 'white', r: 'tr * 1.1', r2: 'tr * 0.8', h: 'trunkH', at: [0, 'trunkH / 2', 0], seg: 12 },
    { kind: 'repeat', count: 6, parts: [{ kind: 'cylinder', mat: 'dark', r: 'tr * 1.06', h: 25, at: ['0', 'trunkH * (0.15 + i * 0.13)', 0], scale: [1, 1, 0.98], seg: 12, plan: false }] },
    ...([[30, 18, 0.34], [200, 22, 0.32]] as const).map(([a, lean, len]): RecipePart => ({
      kind: 'rod', mat: 'white', r: 'tr * 0.55', seg: 8, from: [0, 'trunkH * 0.95', 0],
      to: [`-h * ${len} * sin(${lean}) * cos(${a})`, `trunkH * 0.95 + h * ${len} * cos(${lean})`, `h * ${len} * sin(${lean}) * sin(${a})`],
    })),
    {
      kind: 'repeat', count: 22,
      let: { t: '(i + 0.5) / 22', yy: '1 - 2 * t', ring: 'sqrt(1 - yy * yy)', a: 'i * 137.508', rr: 'r * (0.27 + 0.08 * rnd(i))' },
      parts: [{
        kind: 'if', when: 'i % 3',
        parts: [clump('leaf2', 'rr', ['cos(a) * ring * r * 0.72', 'cy + yy * ry', 'sin(a) * ring * r * 0.72'])],
        else: [clump('leaf', 'rr', ['cos(a) * ring * r * 0.72', 'cy + yy * ry', 'sin(a) * ring * r * 0.72'])],
      }],
    },
  ],
};

/** A car heading east: a body with wheel arches and a sloping bonnet, a tinted glass cabin under a body-colored roof, wheels, lights */
const car: Recipe = {
  let: {
    L: 'w / 2', R: 'min(360, h * 0.2)', clear: 'R * 0.55', belt: 'h * 0.52', b: 60, wx: 'L * 0.62', arch: 'R * 1.18', bl: 'L - b', top: 'belt - b', bot: 'clear + b',
    roof: 'h - 50', wsBase: 'L * 0.32', wsTop: '-L * 0.08', rwTop: '-L * 0.58', rwBase: '-L * 0.8',
  },
  parts: [
    {
      kind: 'extrude', mat: 'carBody', plane: 'side', depth: 'd - 2 * b', bevel: 'b',
      profile: [
        ['-bl + 120', 'bot'],
        ...(['-wx', 'wx'] as const).flatMap(x => [[`${x} - arch`, 'bot'], [`${x} - arch`, 'R'], { arc: [x, 'R', 'arch', 180, 0, true] }, [`${x} + arch`, 'bot']] as [Expr, Expr][]),
        ['bl - 120', 'bot'], { curve: ['bl', 'bot', 'bl', 'bot + 120'] }, ['bl', 'top - 200'], { curve: ['bl - 100', 'top - 20', 'bl - 600', 'top'] },
        ['-bl + 200', 'top'], { curve: ['-bl', 'top', '-bl', 'top - 150'] }, ['-bl', 'bot + 120'], { curve: ['-bl', 'bot', '-bl + 120', 'bot'] },
      ],
    },
    {
      kind: 'extrude', mat: 'carGlass', plane: 'side', depth: 'd - 340', bevel: 40,
      profile: [['rwBase', 'belt - 40'], ['wsBase', 'belt - 40'], ['wsTop + 120', 'roof - 120'], { curve: ['wsTop', 'roof - 70', 'wsTop - 150', 'roof - 70'] },
        ['rwTop + 150', 'roof - 70'], { curve: ['rwTop', 'roof - 70', 'rwTop - 80', 'roof - 140'] }],
    },
    { kind: 'box', mat: 'carBody', size: ['wsTop - rwTop + 120', 50, 'd - 200'], at: ['(wsTop + rwTop) / 2', 'roof - 30', 0], r: 25 },
    { kind: 'box', mat: 'carBody', size: [100, 'roof - belt', 'd - 220'], at: ['(wsTop + rwTop) / 2 + 50', '(belt + roof) / 2 - 20', 0], r: 20, plan: false },
    {
      kind: 'repeat', count: 4, let: { sx: 'i % 2 * 2 - 1', sz: 'floor(i / 2) * 2 - 1' }, parts: [
        { kind: 'cylinder', mat: 'tyre', r: 'R', h: 220, axis: 'z', at: ['sx * wx', 'R', 'sz * (d / 2 - 150)'], seg: 28 },
        { kind: 'cylinder', mat: 'metal', r: 'R * 0.6', h: 20, axis: 'z', at: ['sx * wx', 'R', 'sz * (d / 2 - 150) + sz * 110'], seg: 24 },
      ],
    },
    pair(
      { kind: 'box', mat: 'headlight', size: [80, 90, 380], at: ['L - 30', 'top - 240', 's * (d / 2 - 320)'], r: 30 },
      { kind: 'box', mat: 'taillight', size: [80, 100, 340], at: ['-L + 20', 'top - 100', 's * (d / 2 - 300)'], r: 30 },
    ),
  ],
};

/** A rocking chair facing south (IKEA style garden furniture in stained acacia): curved runners, a slatted seat and back, arms */
const rocker: Recipe = {
  let: { R: 'd * 1.4', seat: 'min(420, h * 0.46)', sx: 'w / 2 - 40', sd: 'd * 0.46', lean: 20, bl: 'h - seat', bz: 'd * 0.2 - sd' },
  parts: [
    pair(
      {
        kind: 'tube', mat: 'woodDark', r: 22,
        points: Array.from({ length: 13 }, (_, k): [Expr, Expr, Expr] => ['s * sx', `25 + R - sqrt(R * R - (-d / 2 + d * ${k} / 12) * (-d / 2 + d * ${k} / 12))`, `-d / 2 + d * ${k} / 12`]),
      },
      { kind: 'rod', mat: 'woodDark', from: ['s * sx', 60, 'd * 0.22'], to: ['s * sx', 'seat', 'd * 0.2'], r: 18 },
      { kind: 'rod', mat: 'woodDark', from: ['s * sx', 60, '-d * 0.22'], to: ['s * sx', 'seat - 30', '-d * 0.18'], r: 18 },
      { kind: 'rod', mat: 'woodDark', from: ['s * sx', 'seat', 'd * 0.2'], to: ['s * sx', 'seat + 220', 'd * 0.2'], r: 15 },
      { kind: 'box', mat: 'woodDark', size: [60, 30, 'd * 0.5'], at: ['s * sx', 'seat + 230', 0], r: 10 },
    ),
    { kind: 'repeat', count: 6, parts: [{ kind: 'box', mat: 'woodDark', size: ['w - 60', 20, 'sd / 6 - 10'], at: [0, 'seat - (i / 5) * 40', 'd * 0.2 - (sd / 6) * (i + 0.5)'], r: 5 }] },
    {
      kind: 'repeat', count: 5, parts: [
        { kind: 'box', mat: 'woodDark', size: [60, 'bl', 20], at: ['-w / 2 + 80 + ((w - 160) / 4) * i', 'seat - 40 + (bl / 2) * cos(lean)', 'bz - (bl / 2) * sin(lean)'], r: 8, rot: ['-lean', 0, 0] },
      ],
    },
    { kind: 'box', mat: 'woodDark', size: ['w - 40', 60, 30], at: [0, 'seat - 70 + bl * cos(lean)', 'bz - bl * sin(lean) + 10'], r: 10, rot: ['-lean', 0, 0] },
  ],
};

/** A round garden table (IKEA style, stained acacia): a slatted top in a frame, an apron and four legs */
const stonetable: Recipe = {
  let: { r: 'min(w, d) / 2', n: 'max(5, round(r * 2 / 90))', sw: 'r * 2 / n' },
  parts: [
    { kind: 'ring', mat: 'woodDark', R: 'r - 25', r: 25, at: [0, 'h - 25', 0] },
    { kind: 'repeat', count: 'n', let: { x: '-r + sw * (i + 0.5)', len: '2 * sqrt(max(0, (r - 45) * (r - 45) - (abs(x) + sw / 2) * (abs(x) + sw / 2)))' }, parts: [
      { kind: 'if', when: 'len > 40', parts: [{ kind: 'box', mat: 'woodDark', size: ['sw - 12', 24, 'len'], at: ['x', 'h - 12', 0], r: 4 }] },
    ] },
    { kind: 'cylinder', mat: 'woodDark', r: 'r * 0.82', h: 70, at: [0, 'h - 60', 0], seg: 36 },
    { kind: 'repeat', count: 4, let: { a: 'i * 90 + 45' }, parts: [
      { kind: 'box', mat: 'woodDark', size: [50, 'h - 30', 50], at: ['cos(a) * r * 0.6', '(h - 30) / 2', 'sin(a) * r * 0.6'], r: 6 },
    ] },
  ],
};

/** A garden stool (IKEA style, stained acacia): a slatted square seat on four legs with cross rails */
const stool: Recipe = {
  let: { n: 4, sw: 'd / n' },
  parts: [
    { kind: 'repeat', count: 'n', parts: [block('woodDark', ['w', 24, 'sw - 12'], 0, 'h - 24', '-d / 2 + sw * (i + 0.5)', 4)] },
    legs('woodDark', 30, 'h - 24', 22, { square: true }),
    pair(block('woodDark', ['w - 60', 40, 22], 0, 'h * 0.25', 's * (d / 2 - 30)', 3)),
  ],
};

/** A raised bed (IKEA style): a planter box of stained acacia boards, soil, shrubs and flowers */
const raised = (seed: number): Recipe => ({
  seed,
  let: { t: 40, n: 'max(1, round((w - 2 * t) * (d - 2 * t) / 120000))' },
  parts: [
    pair(block('woodDark', ['w', 'h', 't'], 0, 0, 's * (d / 2 - t / 2)', 4), block('woodDark', ['t', 'h', 'd'], 's * (w / 2 - t / 2)', 0, 0, 4)),
    { kind: 'repeat', count: 'max(1, floor(h / 120))', parts: [
      pair(block('dark', ['w + 2', 6, 't + 2'], 0, '(i + 1) * h / (floor(h / 120) + 1)', 's * (d / 2 - t / 2)', 2, { plan: false })),
    ] },
    block('soil', ['w - 2 * t', 'h - 60', 'd - 2 * t'], 0, 0, 0, 5),
    {
      kind: 'repeat', count: 'n',
      // Shrubs stay inside the walls; a flower sits on each other one
      let: { r: 'min(120 + rnd(i + 0.6) * 100, (min(w, d) - 2 * t) / 2)', x: '(rnd(i) - 0.5) * max(0, w - 2 * t - 2.8 * r)', z: '(rnd(i + 0.3) - 0.5) * max(0, d - 2 * t - 2.8 * r)' },
      parts: [
        { kind: 'if', when: 'rnd(i + 0.1) < 0.5', parts: [clump('leaf', 'r', ['x', 'h - 60 + r * 0.6', 'z'])], else: [clump('leaf2', 'r', ['x', 'h - 60 + r * 0.6', 'z'])] },
        { kind: 'if', when: 'rnd(i + 0.8) < 0.5', parts: [{ kind: 'sphere', mat: 'flower', r: 35, at: ['x + r * 0.4', 'h - 60 + r * 1.2', 'z + r * 0.3'] }] },
      ],
    },
  ],
});

/** A solar water heater: a tank across the top and a row of glass tubes sloping down to the south, on a metal frame */
const solar: Recipe = {
  let: { tr: 'min(220, h * 0.17)', ty: 'h - tr', tz: '-d / 2 + tr', n: 'max(4, floor((w - 160) / 75))', fz: 'd / 2 - 50' },
  parts: [
    { kind: 'cylinder', mat: 'metal', r: 'tr', h: 'w', axis: 'x', at: [0, 'ty', 'tz'], seg: 28 },
    { kind: 'repeat', count: 'n', parts: [{ kind: 'rod', mat: 'tube', from: ['-w / 2 + 80 + ((w - 160) / (n - 1)) * i', 'ty - tr * 0.6', 'tz + tr * 0.6'], to: ['-w / 2 + 80 + ((w - 160) / (n - 1)) * i', 200, 'fz'], r: 26, seg: 10 }] },
    { kind: 'rod', mat: 'metal', from: ['-w / 2 + 40', 200, 'fz'], to: ['w / 2 - 40', 200, 'fz'], r: 25 },
    pair(
      { kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 40)', 170, 'fz'], to: ['s * (w / 2 - 40)', 'ty - 50', 'tz + 50'], r: 15 },
      { kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 40)', 0, 'fz'], to: ['s * (w / 2 - 40)', 200, 'fz'], r: 15 },
      { kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 40)', 0, 'tz'], to: ['s * (w / 2 - 40)', 'ty - tr', 'tz'], r: 15 },
      { kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 40)', 20, 'fz'], to: ['s * (w / 2 - 40)', 20, 'tz'], r: 12 },
    ),
  ],
};

/** A rooftop water tank: a ribbed white drum with a domed top on a dark steel stand */
const watertank: Recipe = {
  let: { r: 'min(w, d) / 2 - 20', stand: 'min(400, h * 0.28)', top: 'h - 60' },
  parts: [
    legs('iron', 20, 'stand', 25, { w: 'r * 1.5', d: 'r * 1.5' }),
    { kind: 'ring', mat: 'iron', R: 'r * 0.72', r: 20, at: [0, 'stand', 0] },
    { kind: 'lathe', mat: 'white', profile: [[0, 'stand'], ['r', 'stand'], ['r', 'top - r * 0.25'], ['r * 0.85', 'top - r * 0.08'], ['r * 0.3', 'top'], [0, 'top']], at: [0, 0, 0] },
    { kind: 'cylinder', mat: 'white', r: 120, h: 60, at: [0, 'top + 25', 0] },
    { kind: 'ring', mat: 'white', R: 'r + 5', r: 12, at: [0, 'stand + (top - stand) * 0.33', 0] },
    { kind: 'ring', mat: 'white', R: 'r + 5', r: 12, at: [0, 'stand + (top - stand) * 0.62', 0] },
  ],
};

/** A drying rack (IKEA style): white steel end frames, three rails, some laundry */
const dryrack: Recipe = {
  let: { x: 'w / 2 - 30', z: 'd / 2 - 40' },
  parts: [
    pair(
      { kind: 'rod', mat: 'white', from: ['s * x', 0, '-z'], to: ['s * x', 'h', '-z * 0.3'], r: 16 },
      { kind: 'rod', mat: 'white', from: ['s * x', 0, 'z'], to: ['s * x', 'h', 'z * 0.3'], r: 16 },
      { kind: 'rod', mat: 'white', from: ['s * x', 'h', '-z * 0.5'], to: ['s * x', 'h', 'z * 0.5'], r: 14 },
      { kind: 'rod', mat: 'white', from: ['s * x', 20, '-z'], to: ['s * x', 20, 'z'], r: 14 },
    ),
    ...['-z * 0.5', 0, 'z * 0.5'].map((rz): RecipePart => ({ kind: 'rod', mat: 'white', from: ['-x', 'h - 10', rz], to: ['x', 'h - 10', rz], r: 11 })),
    ...([['-w * 0.3', '-z * 0.5', 'w * 0.22', 750, 'bedding'], ['-w * 0.02', 0, 'w * 0.16', 500, 'linen'], ['w * 0.22', 'z * 0.5', 'w * 0.2', 620, 'canvas2'], ['w * 0.36', '-z * 0.5', 'w * 0.1', 400, 'fabric']] as const)
      .map(([lx, lz, lw, ll, mat]): RecipePart => ({ kind: 'box', mat: mat as RecipeMaterial, size: [lw, `min(${ll}, h * 0.6)`, 12], at: [lx, `h - 20 - min(${ll}, h * 0.6) / 2`, lz], r: 4 })),
  ],
};

/** A canopy (IKEA style gazebo): four slim dark steel posts, beams and an off-white fabric roof falling gently to the south */
const canopy: Recipe = {
  let: { fall: 'min(250, h * 0.1)', post: 60, slope: 'atan2(fall, d)', len: 'hypot(d, fall)' },
  parts: [
    {
      kind: 'repeat', count: 4, let: { sx: 'i % 2 * 2 - 1', sz: 'floor(i / 2) * 2 - 1', ph: 'h - (sz > 0 ? fall : 0) - 60' },
      parts: [block('iron', ['post', 'ph', 'post'], 'sx * (w / 2 - post / 2)', 0, 'sz * (d / 2 - post / 2)', 10)],
    },
    pair(
      { kind: 'box', mat: 'iron', size: [60, 100, 'len'], at: ['s * (w / 2 - post / 2)', 'h - fall / 2 - 90', 0], r: 10, rot: ['slope', 0, 0] },
      { kind: 'box', mat: 'iron', size: ['w', 100, 60], at: [0, 'h - 90 - (s > 0 ? fall : 0)', 's * (d / 2 - post / 2)'], r: 10 },
    ),
    { kind: 'box', mat: 'canvas', size: ['w + 100', 30, 'len + 100'], at: [0, 'h - fall / 2 - 20', 0], r: 10, rot: ['slope', 0, 0] },
  ],
};

/** A retractable awning out from the wall (north): a white cassette, plain light grey canvas falling to the south, a front bar and arms */
const awning2: Recipe = {
  let: { y0: 'h - 80', z0: '-d / 2 + 140', y1: 60, z1: 'd / 2 - 30', len: 'hypot(z1 - z0, y0 - y1)', slope: 'atan2(y0 - y1, z1 - z0)' },
  parts: [
    block('white', ['w', 140, 160], 0, 'h - 140', '-d / 2 + 80', 30),
    { kind: 'box', mat: 'fabric', size: ['w - 20', 8, 'len'], at: [0, '(y0 + y1) / 2', '(z0 + z1) / 2'], r: 2, rot: ['slope', 0, 0] },
    block('fabric', ['w - 20', 100, 8], 0, 'y1 - 100', 'z1', 2),
    { kind: 'box', mat: 'white', size: ['w', 40, 50], at: [0, 'y1', 'z1 - 10'], r: 10 },
    pair(
      { kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 80)', 'y0 - 40', 'z0'], to: ['s * (w / 2 - 150)', '(y0 + y1) / 2 - 50', '(z0 + z1) / 2'], r: 15 },
      { kind: 'rod', mat: 'metal', from: ['s * (w / 2 - 150)', '(y0 + y1) / 2 - 50', '(z0 + z1) / 2'], to: ['s * (w / 2 - 80)', 'y1 - 10', 'z1 - 30'], r: 15 },
    ),
  ],
};

export const OUTDOOR: Record<string, Recipe> = {
  tree, car, rocker, stonetable, stool, solar, watertank, dryrack, canopy, awning2, planter: raised(7), bed: raised(11),
};
