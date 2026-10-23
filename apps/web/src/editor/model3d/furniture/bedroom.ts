/** Bedroom and study: beds, nightstand, wardrobe, desk, bookcase */
import { add, block, cyl, legs, random, rbox, rod, type FurnitureMaterial, type Model, type Parts, type Size } from './parts';

function bed({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const leg = 0.06, mattress = Math.min(0.22, h * 0.45), frameTop = h - mattress + 0.05, head = 0.09;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(p, 'woodDark', cyl(0.025, 0.025, leg, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1)));
  // Frame and the upholstered headboard
  add(p, 'wood', rbox(w, frameTop - leg, d - head, 0.02, 0, (leg + frameTop) / 2, head / 2));
  const headTop = Math.max(h + 0.55, 0.95);
  add(p, 'fabric', rbox(w + 0.04, headTop, head, 0.04, 0, headTop / 2, -d / 2 + head / 2));
  // Mattress, the duvet over its foot end and a throw folded at the foot
  const md = d - head - 0.04;
  add(p, 'linen', rbox(w - 0.06, mattress, md, 0.06, 0, h - mattress / 2, head / 2));
  const duvet = md * 0.68;
  add(p, 'linen', rbox(w - 0.02, 0.06, duvet, 0.03, 0, h + 0.02, d / 2 - duvet / 2 - 0.02));
  add(p, 'bedding', rbox(w, 0.045, Math.min(0.45, duvet * 0.35), 0.02, 0, h + 0.065, d / 2 - Math.min(0.45, duvet * 0.35) / 2 - 0.03));
  // Pillows against the headboard: two on a double bed, one on a single
  const n = w >= 1.2 ? 2 : 1, pw = (w - 0.16) / n - 0.04;
  for (let i = 0; i < n; i++)
    add(p, 'linen', rbox(pw, 0.13, 0.42, 0.065, -(w - 0.16) / 2 + ((w - 0.16) / n) * (i + 0.5), h + 0.07, -d / 2 + head + 0.26, -0.25));
  return p;
}

/** A nightstand: two white drawers in a wood case on short legs */
function nightstand({ w, d, h }: Size): Parts {
  const p: Parts = {};
  legs(p, 'woodDark', w, d, 0.04, 0.07, 0.015);
  add(p, 'wood', block(w, h - 0.07, d, 0.012, 0, 0.07, 0));
  const dh = (h - 0.07 - 0.05) / 2;
  for (let i = 0; i < 2; i++) {
    const y = 0.085 + i * (dh + 0.01);
    add(p, 'cabinet', block(w - 0.04, dh, 0.014, 0.004, 0, y, d / 2));
    add(p, 'metal', rbox(0.08, 0.01, 0.014, 0.004, 0, y + dh - 0.03, d / 2 + 0.012));
  }
  return p;
}

/** A wardrobe: a wood case on a plinth with white doors and long handles */
function wardrobe({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'woodDark', block(w - 0.04, 0.08, d - 0.05, 0.005, 0, 0, -0.01));
  add(p, 'wood', block(w, h - 0.08, d - 0.02, 0.01, 0, 0.08, -0.01));
  const n = Math.max(1, Math.round(w / 0.5)), dw = (w - 0.03) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.015 + dw * (i + 0.5);
    add(p, 'cabinet', block(dw - 0.006, h - 0.13, 0.018, 0.004, x, 0.1, d / 2 - 0.01));
    const hx = x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05);
    add(p, 'metal', rod([hx, h * 0.42, d / 2 + 0.012], [hx, h * 0.62, d / 2 + 0.012], 0.007, 8));
  }
  return p;
}

/** A desk: a wood top on slim iron legs, a drawer, a laptop and a mug */
function desk({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'wood', block(w, 0.03, d, 0.008, 0, h - 0.03, 0));
  legs(p, 'iron', w, d, 0.04, h - 0.03, 0.014, true);
  add(p, 'cabinet', block(Math.min(0.42, w * 0.35), 0.12, d - 0.08, 0.006, w / 2 - Math.min(0.42, w * 0.35) / 2 - 0.06, h - 0.15, 0));
  // An open laptop
  const lx = -w * 0.08, lz = 0.02;
  add(p, 'metal', block(0.33, 0.014, 0.23, 0.005, lx, h, lz), rbox(0.33, 0.22, 0.008, 0.004, lx, h + 0.115, lz - 0.13, -0.28));
  add(p, 'dark', rbox(0.3, 0.19, 0.002, 0.001, lx, h + 0.117, lz - 0.124, -0.28));
  add(p, 'ceramic', cyl(0.04, 0.04, 0.09, w / 2 - 0.2, h, -0.1));
  return p;
}

/** A bookcase: shelves full of books of different heights and colors, a vase here and there */
function bookcase({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const t = 0.025, n = Math.max(2, Math.round(h / 0.36)), gap = (h - t) / n;
  add(p, 'wood', block(t, h, d, 0.004, -w / 2 + t / 2, 0, 0), block(t, h, d, 0.004, w / 2 - t / 2, 0, 0), block(w, h, 0.01, 0.002, 0, 0, -d / 2 + 0.005));
  for (let i = 0; i <= n; i++) add(p, 'wood', block(w - 0.01, t, d, 0.004, 0, i * gap, 0));
  const rand = random(Math.round(w * 1000 + h * 7));
  const colors: FurnitureMaterial[] = ['book1', 'book2', 'book3', 'book4', 'linen'];
  for (let i = 0; i < n; i++) {
    const y0 = i * gap + t, room = gap - t - 0.03;
    let x = -w / 2 + t + 0.01;
    // Some shelves end in a vase
    const end = w / 2 - t - (i % 3 === 1 ? 0.2 : 0.01);
    while (x < end) {
      const bw = 0.02 + rand() * 0.03, bh = room * (0.7 + rand() * 0.3), bd = d * (0.7 + rand() * 0.15);
      if (x + bw > end) break;
      if (rand() < 0.08) { x += 0.04; continue; }
      add(p, colors[Math.floor(rand() * colors.length)], block(bw - 0.002, bh, bd, 0.003, x + bw / 2, y0, d / 2 - bd / 2 - 0.02));
      x += bw;
    }
    if (i % 3 === 1) add(p, 'ceramic', cyl(0.05, 0.06, Math.min(0.22, room * 0.8), w / 2 - t - 0.1, y0, 0));
  }
  return p;
}

export const BEDROOM: Record<string, Model> = { bed18: bed, bed15: bed, bed12: bed, nightstand, wardrobe, desk, bookcase };
