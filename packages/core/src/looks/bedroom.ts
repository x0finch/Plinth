/** Bedroom and study: beds, nightstand, wardrobe, desk, bookcase */
import type { Recipe } from '../recipe.js';
import { block, pair, pick } from './helpers.js';

/**
 * A platform bed (IKEA style): birch panel sides and foot that hold the mattress, a tall flat headboard (north), a white
 * duvet, a grey throw at the foot, one or two pillows
 */
const bed: Recipe = {
  let: {
    t: 30, mattress: 'min(200, h * 0.45)', side: 'h - mattress + 70', head: 40, headTop: 'max(h + 520, 950)', md: 'd - head - 2 * t',
    duvet: 'md * 0.68', throw: 'min(450, duvet * 0.35)', n: 'w >= 1200 ? 2 : 1', pw: '(w - 160) / n - 40',
  },
  parts: [
    block('dark', ['w - 80', 30, 'd - head - 80'], 0, 0, 'head / 2', 2),
    pair(block('birch', ['t', 'side - 30', 'd - head'], 's * (w - t) / 2', 30, 'head / 2', 4)),
    block('birch', ['w', 'side - 30', 't'], 0, 30, 'd / 2 - t / 2', 4),
    block('birch', ['w - 2 * t', 30, 'md'], 0, 'h - mattress - 30', 'head / 2', 2),
    block('birch', ['w', 'headTop', 'head'], 0, 0, '-d / 2 + head / 2', 6),
    block('linen', ['w - 2 * t - 10', 'mattress', 'md - 10'], 0, 'h - mattress', 'head / 2', 50),
    block('linen', ['w - 2 * t + 20', 60, 'duvet'], 0, 'h - 10', 'd / 2 - t - duvet / 2 - 10', 30),
    block('bedding', ['w - 2 * t + 30', 45, 'throw'], 0, 'h + 42.5', 'd / 2 - t - throw / 2 - 20', 20),
    {
      kind: 'repeat', count: 'n', parts: [
        { kind: 'box', mat: 'linen', size: ['pw', 130, 420], at: ['-(w - 160) / 2 + ((w - 160) / n) * (i + 0.5)', 'h + 70', '-d / 2 + head + t + 230'], r: 65, rot: [-14.3, 0, 0] },
      ],
    },
  ],
};

/** A nightstand (IKEA style): a flat birch case with two handleless drawers, each with a finger slot along its top edge */
const nightstand: Recipe = {
  let: { base: 30, dh: '(h - base - 30) / 2' },
  parts: [
    block('birch', ['w - 20', 'base', 'd - 30'], 0, 0, -15, 2),
    block('birch', ['w', 'h - base', 'd - 18'], 0, 'base', -9, 4),
    {
      kind: 'repeat', count: 2, let: { y: 'base + 4 + i * (dh + 6)' }, parts: [
        block('birch', ['w - 8', 'dh', 18], 0, 'y', 'd / 2 - 9', 2),
        block('woodDark', ['w * 0.4', 8, 4], 0, 'y + dh - 22', 'd / 2 + 0.5', 2, { plan: false }),
      ],
    },
  ],
};

/** A wardrobe (IKEA style): a white case on a recessed plinth, flat white doors about 50 cm wide, slim steel bar handles */
const wardrobe: Recipe = {
  let: { n: 'max(1, round(w / 500))', dw: 'w / n' },
  parts: [
    block('white', ['w - 40', 80, 'd - 50'], 0, 0, -10, 3),
    block('white', ['w', 'h - 80', 'd - 20'], 0, 80, -10, 4),
    {
      kind: 'repeat', count: 'n', let: { x: '-w / 2 + dw * (i + 0.5)', hx: 'x + (i % 2 ? -1 : 1) * (dw / 2 - 45)' }, parts: [
        block('white', ['dw - 4', 'h - 84', 18], 'x', 82, 'd / 2 - 10', 2),
        { kind: 'rod', mat: 'metal', from: ['hx', 'h * 0.4', 'd / 2 + 14'], to: ['hx', 'h * 0.58', 'd / 2 + 14'], r: 6, seg: 8 },
      ],
    },
  ],
};

/** A desk (IKEA style): a white top on a white drawer unit (left) and two round legs, a laptop, a mug and an arm lamp */
const desk: Recipe = {
  let: { dw: 'min(360, w * 0.32)', dx: '-w / 2 + dw / 2 + 20', nd: 5, dh: '(h - 50) / nd', lx: 'w * 0.06', lz: 20, ax: 'w / 2 - 140', az: '-d / 2 + 110' },
  parts: [
    block('white', ['w', 36, 'd'], 0, 'h - 36', 0, 4),
    block('white', ['dw', 'h - 36', 'd - 40'], 'dx', 0, -10, 3),
    { kind: 'repeat', count: 'nd', parts: [block('white', ['dw - 6', 'dh - 6', 14], 'dx', '14 + i * dh', 'd / 2 - 23', 2)] },
    { kind: 'repeat', count: 'nd', parts: [block('dark', ['dw * 0.4', 10, 4], 'dx', '14 + i * dh + dh - 26', 'd / 2 - 14', 2, { plan: false })] },
    pair({ kind: 'cylinder', mat: 'white', r: 25, h: 'h - 36', at: ['w / 2 - 60', '(h - 36) / 2', 's * (d / 2 - 60)'] }),
    block('metal', [330, 14, 230], 'lx', 'h', 'lz', 5),
    { kind: 'box', mat: 'metal', size: [330, 220, 8], at: ['lx', 'h + 115', 'lz - 130'], r: 4, rot: [-16, 0, 0] },
    { kind: 'box', mat: 'dark', size: [300, 190, 2], at: ['lx', 'h + 117', 'lz - 124'], r: 1, rot: [-16, 0, 0] },
    { kind: 'cylinder', mat: 'ceramic', r: 40, h: 90, at: ['-w * 0.25', 'h + 45', -100] },
    { kind: 'cylinder', mat: 'dark', r: 70, h: 18, at: ['ax', 'h + 9', 'az'], seg: 28, plan: false },
    { kind: 'rod', mat: 'dark', from: ['ax', 'h + 18', 'az'], to: ['ax - 60', 'h + 380', 'az + 20'], r: 8, plan: false },
    { kind: 'rod', mat: 'dark', from: ['ax - 60', 'h + 380', 'az + 20'], to: ['ax - 230', 'h + 330', 'az + 90'], r: 7, plan: false },
    { kind: 'lathe', mat: 'dark', profile: [[0, 0], [75, 0], [70, 20], [35, 120], [0, 130]], at: ['ax - 250', 'h + 210', 'az + 100'], plan: false },
  ],
};

/**
 * A bookcase (IKEA style): white units about 80 cm wide side by side, each with a toe kick and shelves full of books of
 * different heights and colors, a vase on every third shelf
 */
const bookcase: Recipe = {
  seed: 7,
  let: { t: 18, kick: 60, nu: 'max(1, round(w / 800))', uw: 'w / nu', n: 'max(2, round((h - kick) / 360))', gap: '(h - kick - t) / n' },
  parts: [
    {
      kind: 'repeat', count: 'nu', as: 'u', let: { ux: '-w / 2 + uw * (u + 0.5)' }, parts: [
        block('white', ['t', 'h', 'd'], 'ux - uw / 2 + t / 2', 0, 0, 2),
        block('white', ['t', 'h', 'd'], 'ux + uw / 2 - t / 2', 0, 0, 2),
        block('white', ['uw - 4', 'h', 6], 'ux', 0, '-d / 2 + 3', 1),
        block('white', ['uw - 2 * t', 'kick', 18], 'ux', 0, 'd / 2 - 30', 1),
        { kind: 'repeat', count: 'n + 1', parts: [block('white', ['uw - 2 * t', 't', 'd - 10'], 'ux', 'kick + i * gap', 5, 2)] },
        {
          kind: 'repeat', count: 'n', as: 's',
          let: { y0: 'kick + s * gap + t', room: 'gap - t - 30', vase: '(s + u) % 3 == 1', start: 'ux - uw / 2 + t + 10', end: 'ux + uw / 2 - t - (vase ? 190 : 10)', nb: 'floor((end - start) / 35)', bw: '(end - start) / nb' },
          parts: [
            {
              kind: 'repeat', count: 'nb', as: 'k',
              let: { key: 'u * 1000 + s * 100 + k', bh: 'room * (0.7 + rnd(key) * 0.3)', bd: 'd * (0.7 + rnd(key + 0.5) * 0.15)', bwk: 'bw * (0.6 + rnd(key + 0.25) * 0.38)', c: 'floor(rnd(key + 0.75) * 5)' },
              parts: [{
                kind: 'if', when: 'rnd(key + 0.9) >= 0.08',
                parts: pick('c', ['book1', 'book2', 'book3', 'book4', 'linen'], mat => block(mat, ['bwk', 'bh', 'bd'], 'start + bw * (k + 0.5)', 'y0', 'd / 2 - bd / 2 - 20', 3, { plan: false })),
              }],
            },
            { kind: 'if', when: 'vase', parts: [{ kind: 'cylinder', mat: 'ceramic', r: 50, r2: 60, h: 'min(220, room * 0.8)', at: ['ux + uw / 2 - t - 95', 'y0 + min(220, room * 0.8) / 2', 0] }] },
          ],
        },
      ],
    },
  ],
};

export const BEDROOM: Record<string, Recipe> = { bed18: bed, bed15: bed, bed12: bed, nightstand, wardrobe, desk, bookcase };
