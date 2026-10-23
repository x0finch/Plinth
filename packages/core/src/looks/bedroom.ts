/** Bedroom and study: beds, nightstand, wardrobe, desk, bookcase */
import type { Recipe } from '../recipe.js';
import { block, legs, pick } from './helpers.js';

/** Legs, a wooden frame, an upholstered headboard (north), mattress, duvet, a throw at the foot, one or two pillows */
const bed: Recipe = {
  let: {
    leg: 60, mattress: 'min(220, h * 0.45)', frameTop: 'h - mattress + 50', head: 90, headTop: 'max(h + 550, 950)', md: 'd - head - 40',
    duvet: 'md * 0.68', throw: 'min(450, duvet * 0.35)', n: 'w >= 1200 ? 2 : 1', pw: '(w - 160) / n - 40',
  },
  parts: [
    legs('woodDark', 100, 'leg', 25),
    block('wood', ['w', 'frameTop - leg', 'd - head'], 0, 'leg', 'head / 2', 20),
    block('fabric', ['w + 40', 'headTop', 'head'], 0, 0, '-d / 2 + head / 2', 40),
    block('linen', ['w - 60', 'mattress', 'md'], 0, 'h - mattress', 'head / 2', 60),
    block('linen', ['w - 20', 60, 'duvet'], 0, 'h - 10', 'd / 2 - duvet / 2 - 20', 30),
    block('bedding', ['w', 45, 'throw'], 0, 'h + 42.5', 'd / 2 - throw / 2 - 30', 20),
    {
      kind: 'repeat', count: 'n', parts: [
        { kind: 'box', mat: 'linen', size: ['pw', 130, 420], at: ['-(w - 160) / 2 + ((w - 160) / n) * (i + 0.5)', 'h + 70', '-d / 2 + head + 260'], r: 65, rot: [-14.3, 0, 0] },
      ],
    },
  ],
};

/** A nightstand: two white drawers in a wood case on short legs */
const nightstand: Recipe = {
  let: { dh: '(h - 120) / 2' },
  parts: [
    legs('woodDark', 40, 70, 15),
    block('wood', ['w', 'h - 70', 'd'], 0, 70, 0, 12),
    {
      kind: 'repeat', count: 2, let: { y: '85 + i * (dh + 10)' }, parts: [
        block('cabinet', ['w - 40', 'dh', 14], 0, 'y', 'd / 2', 4),
        { kind: 'box', mat: 'metal', size: [80, 10, 14], at: [0, 'y + dh - 30', 'd / 2 + 12'], r: 4 },
      ],
    },
  ],
};

/** A wardrobe: a wood case on a plinth with white doors and long handles */
const wardrobe: Recipe = {
  let: { n: 'max(1, round(w / 500))', dw: '(w - 30) / n' },
  parts: [
    block('woodDark', ['w - 40', 80, 'd - 50'], 0, 0, -10, 5),
    block('wood', ['w', 'h - 80', 'd - 20'], 0, 80, -10, 10),
    {
      kind: 'repeat', count: 'n', let: { x: '-w / 2 + 15 + dw * (i + 0.5)', hx: 'x + (i % 2 ? -1 : 1) * (dw / 2 - 50)' }, parts: [
        block('cabinet', ['dw - 6', 'h - 130', 18], 'x', 100, 'd / 2 - 10', 4),
        { kind: 'rod', mat: 'metal', from: ['hx', 'h * 0.42', 'd / 2 + 12'], to: ['hx', 'h * 0.62', 'd / 2 + 12'], r: 7, seg: 8 },
      ],
    },
  ],
};

/** A desk: a wood top on slim iron legs, a drawer, a laptop and a mug */
const desk: Recipe = {
  let: { dw: 'min(420, w * 0.35)', lx: '-w * 0.08', lz: 20 },
  parts: [
    block('wood', ['w', 30, 'd'], 0, 'h - 30', 0, 8),
    legs('iron', 40, 'h - 30', 14, { square: true }),
    block('cabinet', ['dw', 120, 'd - 80'], 'w / 2 - dw / 2 - 60', 'h - 150', 0, 6),
    block('metal', [330, 14, 230], 'lx', 'h', 'lz', 5),
    { kind: 'box', mat: 'metal', size: [330, 220, 8], at: ['lx', 'h + 115', 'lz - 130'], r: 4, rot: [-16, 0, 0] },
    { kind: 'box', mat: 'dark', size: [300, 190, 2], at: ['lx', 'h + 117', 'lz - 124'], r: 1, rot: [-16, 0, 0] },
    { kind: 'cylinder', mat: 'ceramic', r: 40, h: 90, at: ['w / 2 - 200', 'h + 45', -100] },
  ],
};

/** A bookcase: shelves full of books of different heights and colors, a vase on every third shelf */
const bookcase: Recipe = {
  seed: 7,
  let: { t: 25, n: 'max(2, round(h / 360))', gap: '(h - t) / n' },
  parts: [
    block('wood', ['t', 'h', 'd'], '-w / 2 + t / 2', 0, 0, 4),
    block('wood', ['t', 'h', 'd'], 'w / 2 - t / 2', 0, 0, 4),
    block('wood', ['w', 'h', 10], 0, 0, '-d / 2 + 5', 2),
    { kind: 'repeat', count: 'n + 1', parts: [block('wood', ['w - 10', 't', 'd'], 0, 'i * gap', 0, 4)] },
    {
      kind: 'repeat', count: 'n', as: 's',
      let: { y0: 's * gap + t', room: 'gap - t - 30', vase: 's % 3 == 1', start: '-w / 2 + t + 10', end: 'w / 2 - t - (vase ? 200 : 10)', nb: 'floor((end - start) / 35)', bw: '(end - start) / nb' },
      parts: [
        {
          kind: 'repeat', count: 'nb', as: 'k',
          let: { key: 's * 100 + k', bh: 'room * (0.7 + rnd(key) * 0.3)', bd: 'd * (0.7 + rnd(key + 0.5) * 0.15)', bwk: 'bw * (0.6 + rnd(key + 0.25) * 0.38)', c: 'floor(rnd(key + 0.75) * 5)' },
          parts: [{
            kind: 'if', when: 'rnd(key + 0.9) >= 0.08',
            parts: pick('c', ['book1', 'book2', 'book3', 'book4', 'linen'], mat => block(mat, ['bwk', 'bh', 'bd'], 'start + bw * (k + 0.5)', 'y0', 'd / 2 - bd / 2 - 20', 3, { plan: false })),
          }],
        },
        { kind: 'if', when: 'vase', parts: [{ kind: 'cylinder', mat: 'ceramic', r: 50, r2: 60, h: 'min(220, room * 0.8)', at: ['w / 2 - t - 100', 'y0 + min(220, room * 0.8) / 2', 0] }] },
      ],
    },
  ],
};

export const BEDROOM: Record<string, Recipe> = { bed18: bed, bed15: bed, bed12: bed, nightstand, wardrobe, desk, bookcase };
