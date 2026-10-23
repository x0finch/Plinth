/** Living room: sofas, armchair, coffee and tea tables, TV stand, side table, potted plant, ancestral shrine */
import { add, block, clump, cyl, lathe, legs, rbox, rod, type Model, type Parts, type Size } from './parts';

export function sofa({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const leg = 0.07, arm = Math.min(0.18, Math.max(0.12, w * 0.1)), back = Math.min(0.22, d * 0.25);
  const baseTop = leg + 0.2, seatTop = Math.min(h * 0.55, 0.45), armTop = Math.min(h * 0.8, 0.64);
  // Legs, set in from the corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(p, 'woodDark', cyl(0.018, 0.024, leg, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)));
  // Base, arms and back frame
  add(p, 'fabric',
    rbox(w, baseTop - leg, d, 0.03, 0, (leg + baseTop) / 2, 0),
    rbox(arm, armTop - leg, d, 0.05, -(w - arm) / 2, (leg + armTop) / 2, 0),
    rbox(arm, armTop - leg, d, 0.05, (w - arm) / 2, (leg + armTop) / 2, 0),
    rbox(w - 2 * arm + 0.02, h - baseTop, back, 0.05, 0, (baseTop + h) / 2, -(d - back) / 2));
  // Seat and back cushions, about 65 cm each
  const inner = w - 2 * arm, n = Math.max(1, Math.round(inner / 0.65)), cw = inner / n, gap = 0.012;
  const seatD = d - back - 0.02;
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + 0.5);
    add(p, 'cushion',
      rbox(cw - gap, seatTop - baseTop, seatD, 0.06, x, (baseTop + seatTop) / 2, (d - seatD) / 2 - 0.01),
      rbox(cw - gap, (h - seatTop) * 0.92, 0.17, 0.07, x, seatTop + ((h - seatTop) * 0.92) / 2, -d / 2 + back + 0.07, -0.12));
  }
  return p;
}

function coffee({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'wood', block(w, 0.04, d, 0.012, 0, h - 0.04, 0), block(w - 0.14, 0.02, d - 0.12, 0.006, 0, 0.12, 0));
  legs(p, 'wood', w, d, 0.05, h - 0.04, 0.022);
  // A couple of books on top
  add(p, 'book2', rbox(0.26, 0.03, 0.19, 0.004, -w * 0.22, h + 0.015, 0.02, 0, 0.2));
  add(p, 'book4', rbox(0.22, 0.025, 0.16, 0.004, -w * 0.22, h + 0.043, 0.02, 0, -0.1));
  add(p, 'ceramic', lathe([[0, 0], [0.05, 0], [0.09, 0.05], [0.09, 0.055], [0, 0.055]], w * 0.2, h, -0.02));
  return p;
}

/** A Chinese tea table: a heavy dark top with an apron, a stone tray, a teapot and cups */
function teatable({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'woodDark', block(w, 0.06, d, 0.01, 0, h - 0.06, 0), block(w - 0.08, 0.08, d - 0.08, 0.005, 0, h - 0.14, 0));
  legs(p, 'woodDark', w, d, 0.05, h - 0.06, 0.03, true);
  for (const sz of [-1, 1]) add(p, 'woodDark', block(w - 0.1, 0.03, 0.03, 0.005, 0, 0.1, sz * (d / 2 - 0.05)));
  const tx = w * 0.1;
  add(p, 'stoneDark', block(Math.min(0.6, w * 0.45), 0.03, Math.min(0.34, d * 0.5), 0.01, tx, h, 0));
  add(p, 'ceramic',
    lathe([[0, 0], [0.04, 0], [0.065, 0.04], [0.05, 0.085], [0.015, 0.095], [0.015, 0.11], [0, 0.11]], tx - 0.12, h + 0.03, 0),
    ...[0, 1, 2].map(i => lathe([[0, 0], [0.018, 0], [0.026, 0.035], [0, 0.035]], tx + 0.04 + i * 0.07, h + 0.03, 0.06)));
  return p;
}

/** A low cabinet: a wood carcass with white doors, a vase and books on top */
function tvstand({ w, d, h }: Size): Parts {
  const p: Parts = {};
  legs(p, 'woodDark', w, d, 0.06, 0.08, 0.018);
  add(p, 'wood', block(w, h - 0.08, d, 0.012, 0, 0.08, 0));
  const n = Math.max(1, Math.round(w / 0.6)), dw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + dw * (i + 0.5);
    add(p, 'cabinet', block(dw - 0.03, h - 0.08 - 0.04, 0.014, 0.004, x, 0.1, d / 2));
    add(p, 'metal', rbox(0.1, 0.012, 0.016, 0.005, x, h - 0.06, d / 2 + 0.012));
  }
  add(p, 'ceramic', lathe([[0, 0], [0.06, 0], [0.08, 0.1], [0.04, 0.22], [0.035, 0.26], [0, 0.26]], -w * 0.32, h, 0));
  add(p, 'book1', block(0.3, 0.04, 0.22, 0.004, w * 0.3, h, 0));
  add(p, 'book3', block(0.26, 0.035, 0.2, 0.004, w * 0.3, h + 0.04, 0));
  return p;
}

/** A round side table on one stem */
function sidetable({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const r = Math.min(w, d) / 2;
  add(p, 'wood', cyl(r, r, 0.03, 0, h - 0.03, 0, 36), cyl(r * 0.55, r * 0.6, 0.02, 0, 0, 0, 32));
  add(p, 'woodDark', cyl(0.025, 0.025, h - 0.05, 0, 0.02, 0));
  return p;
}

/** A terracotta pot with a small leafy tree */
function plant({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const r = Math.min(w, d) / 2, ph = Math.min(0.38, h * 0.32);
  add(p, 'terracotta', lathe([[0, 0], [r * 0.6, 0], [r * 0.78, ph * 0.92], [r * 0.82, ph], [0, ph]]));
  add(p, 'soil', cyl(r * 0.74, r * 0.74, 0.01, 0, ph - 0.03, 0));
  for (const [a, lean] of [[0, 0.12], [2.1, 0.2], [4.2, 0.16]]) add(p, 'bark', rod([0, ph - 0.03, 0], [Math.cos(a) * lean, h * 0.72, Math.sin(a) * lean], 0.012, 6));
  const rand = [[0, 0.78, 0, 0.5], [0.16, 0.66, 0.08, 0.4], [-0.14, 0.7, 0.1, 0.38], [0.05, 0.62, -0.16, 0.4], [-0.08, 0.88, -0.06, 0.36], [0.1, 0.9, 0.1, 0.3]];
  rand.forEach(([x, y, z, s], i) => add(p, i % 2 ? 'leaf2' : 'leaf', clump(r * s * 1.9, x * r * 2.4, Math.min(h - r * s, y * h), z * r * 2.2)));
  return p;
}

/** An ancestral shrine: a lacquered altar table with raised ends, a small shrine cabinet, an incense burner and candles */
function shrine({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const ht = Math.min(0.85, h * 0.68);
  add(p, 'lacquer', block(w, 0.05, d, 0.01, 0, ht - 0.05, 0));
  for (const sx of [-1, 1]) add(p, 'lacquer', block(0.14, 0.035, d, 0.01, sx * (w / 2 - 0.07), ht, 0));
  legs(p, 'lacquer', w - 0.1, d, 0.05, ht - 0.05, 0.035, true);
  add(p, 'lacquer', block(w - 0.3, 0.1, 0.025, 0.005, 0, ht - 0.15, d / 2 - 0.06));
  // The cabinet: a base, a body with a gilded niche, a roof
  const cw = Math.min(0.7, w * 0.35), cd = Math.min(0.32, d * 0.65), cz = -d / 2 + cd / 2 + 0.03, top = h - ht;
  add(p, 'lacquer', block(cw + 0.08, 0.04, cd + 0.04, 0.008, 0, ht, cz), block(cw, top - 0.09, cd, 0.006, 0, ht + 0.04, cz),
    block(cw + 0.16, 0.05, cd + 0.12, 0.01, 0, h - 0.05, cz));
  add(p, 'gold', block(cw * 0.7, (top - 0.09) * 0.75, 0.01, 0.003, 0, ht + 0.06, cz + cd / 2));
  // Incense burner in front, candles either side
  const fz = d / 2 - 0.09;
  add(p, 'gold', lathe([[0, 0], [0.05, 0], [0.08, 0.03], [0.08, 0.07], [0.07, 0.08], [0, 0.08]], 0, ht, fz));
  for (const sx of [-1, 1]) {
    add(p, 'gold', cyl(0.045, 0.03, 0.06, sx * w * 0.3, ht, fz));
    add(p, 'red', cyl(0.025, 0.025, 0.2, sx * w * 0.3, ht + 0.06, fz));
  }
  return p;
}

export const LIVING: Record<string, Model> = { sofa3: sofa, sofa2: sofa, armchair: sofa, coffee, teatable, tvstand, sidetable, plant, shrine };
