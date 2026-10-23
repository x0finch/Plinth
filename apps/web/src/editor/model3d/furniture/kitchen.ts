/** Kitchen and dining: dining table and chair, counter, wood-fired stove, island, bar counter and stool, fridge */
import * as THREE from 'three';
import { add, block, cyl, lathe, legs, rbox, ring, rod, type Model, type Parts, type Size } from './parts';

function dining({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'wood', block(w, 0.04, d, 0.01, 0, h - 0.04, 0), block(w - 0.16, 0.08, d - 0.16, 0.004, 0, h - 0.12, 0));
  legs(p, 'wood', w, d, 0.07, h - 0.04, 0.03, true);
  return p;
}

/** A wooden chair with a cushioned seat and a railed back (to the north) */
function chair({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const seat = Math.min(0.46, h * 0.54), bz = -d / 2 + 0.035;
  legs(p, 'wood', w, d, 0.035, seat - 0.03, 0.017);
  add(p, 'wood', block(w, 0.035, d, 0.01, 0, seat - 0.035, 0));
  add(p, 'fabric', block(w - 0.05, 0.03, d - 0.08, 0.012, 0, seat, 0.02));
  for (const sx of [-1, 1]) add(p, 'wood', rod([sx * (w / 2 - 0.035), seat, bz], [sx * (w / 2 - 0.035), h, bz - 0.03], 0.016, 8));
  add(p, 'wood', rbox(w - 0.02, 0.1, 0.022, 0.008, 0, h - 0.07, bz - 0.025, -0.08), rbox(w - 0.06, 0.04, 0.02, 0.006, 0, seat + 0.2, bz - 0.012, -0.08));
  return p;
}

/** Base cabinets: wood carcass and white doors with handles; returns the door height's top */
function cabinets(p: Parts, w: number, d: number, h: number, z: number, face: 1 | -1, doorW = 0.6) {
  add(p, 'dark', block(w - 0.02, 0.1, d - 0.08, 0.005, 0, 0, z - face * 0.03));
  add(p, 'wood', block(w, h - 0.1, d - 0.03, 0.006, 0, 0.1, z - face * 0.015));
  const n = Math.max(1, Math.round(w / doorW)), dw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + dw * (i + 0.5);
    add(p, 'cabinet', block(dw - 0.006, h - 0.13, 0.018, 0.004, x, 0.11, z + face * (d / 2 - 0.02)));
    add(p, 'metal', rbox(Math.min(0.16, dw * 0.4), 0.012, 0.02, 0.005, x, h - 0.06, z + face * (d / 2 - 0.002)));
  }
}

/** Base cabinets under a stone top, with a sink and a cooktop */
function counter({ w, d, h }: Size): Parts {
  const p: Parts = {};
  cabinets(p, w, d, h - 0.04, 0, 1);
  add(p, 'countertop', block(w, 0.04, d, 0.006, 0, h - 0.04, 0));
  const sx = -w * 0.22, cx = w * 0.24;
  add(p, 'metal', block(Math.min(0.55, w * 0.3), 0.004, d * 0.62, 0.02, sx, h, 0.02));
  add(p, 'metal', rod([sx, h, -d / 2 + 0.08], [sx, h + 0.3, -d / 2 + 0.08], 0.013), rod([sx, h + 0.3, -d / 2 + 0.08], [sx, h + 0.28, -d / 2 + 0.24], 0.011));
  add(p, 'dark', block(Math.min(0.6, w * 0.3), 0.006, d * 0.75, 0.01, cx, h, 0.02));
  for (const [dx, dz, r] of [[-0.14, -0.1, 0.08], [0.14, -0.1, 0.06], [-0.14, 0.12, 0.06], [0.14, 0.12, 0.08]]) add(p, 'metal', ring(r, 0.006, cx + dx, h + 0.008, dz + 0.02));
  return p;
}

/** A wood-fired stove: a tiled masonry body, two iron woks (one under a wooden lid), fire openings in front */
function woodstove({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'plaster', block(w, h - 0.05, d, 0.04, 0, 0, 0));
  add(p, 'countertop', block(w + 0.02, 0.05, d + 0.02, 0.02, 0, h - 0.05, 0));
  const r = Math.min(0.3, d * 0.38, w * 0.15);
  [-1, 1].forEach((sx, i) => {
    const x = sx * w * 0.22;
    add(p, 'iron', ring(r, 0.02, x, h + 0.005, 0), cyl(r, r, 0.004, x, h - 0.002, 0, 32));
    if (i) add(p, 'wood', new THREE.SphereGeometry(r * 0.95, 28, 8, 0, Math.PI * 2, 0, 0.75).scale(1, 0.55, 1).translate(x, h - r * 0.35, 0),
      cyl(0.03, 0.03, 0.05, x, h + r * 0.22, 0));
    add(p, 'dark', block(0.26, Math.min(0.24, h * 0.32), 0.02, 0.06, x, 0.12, d / 2 + 0.002));
  });
  return p;
}

/** A kitchen island: cabinets facing north, a stone top overhanging to the south for stools, a bowl on top */
function island({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const over = Math.min(0.3, d * 0.3), cd = d - over;
  cabinets(p, w, cd, h - 0.04, -over / 2, -1);
  add(p, 'countertop', block(w, 0.04, d, 0.006, 0, h - 0.04, 0));
  add(p, 'ceramic', lathe([[0, 0], [0.06, 0], [0.13, 0.08], [0.125, 0.085], [0, 0.03]], w * 0.2, h, 0));
  return p;
}

/** A bar counter: a fluted wood front, a stone top and a metal foot rail */
function bar({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'wood', block(w, h - 0.05, d - 0.06, 0.008, 0, 0, -0.03));
  const n = Math.floor(w / 0.06);
  for (let i = 0; i < n; i++) add(p, 'wood', rbox(0.04, h - 0.08, 0.02, 0.01, -w / 2 + (w / n) * (i + 0.5), (h - 0.05) / 2, d / 2 - 0.05));
  add(p, 'countertop', block(w, 0.05, d, 0.008, 0, h - 0.05, 0));
  add(p, 'metal', rod([-w / 2 + 0.1, 0.22, d / 2 - 0.01], [w / 2 - 0.1, 0.22, d / 2 - 0.01], 0.016));
  for (const sx of [-1, 1]) add(p, 'metal', rod([sx * (w / 2 - 0.15), 0.22, d / 2 - 0.01], [sx * (w / 2 - 0.15), 0.22, d / 2 - 0.05], 0.01));
  return p;
}

/** A bar stool: a cushioned seat on a metal pole, foot ring and base */
function barstool({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const r = Math.min(w, d) / 2;
  add(p, 'metal', cyl(r * 0.85, r * 0.8, 0.02, 0, 0, 0, 28), cyl(0.024, 0.024, h - 0.06, 0, 0.02, 0), ring(r * 0.65, 0.01, 0, h * 0.4, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(p, 'metal', rod([0, h * 0.4, 0], [Math.cos(a) * r * 0.65, h * 0.4, Math.sin(a) * r * 0.65], 0.006));
  }
  add(p, 'fabric', lathe([[0, 0], [r * 0.95, 0], [r, 0.03], [r * 0.95, 0.06], [0, 0.065]], 0, h - 0.065, 0));
  return p;
}

/** A fridge: freezer drawer below, door above, handles on the right */
function fridge({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'appliance', block(w, h - 0.02, d - 0.06, 0.03, 0, 0.02, -0.03));
  const split = h * 0.36, fz = d / 2 - 0.025;
  add(p, 'appliance', block(w - 0.006, split - 0.03, 0.05, 0.02, 0, 0.025, fz), block(w - 0.006, h - split - 0.03, 0.05, 0.02, 0, split + 0.005, fz));
  add(p, 'metal', rod([w / 2 - 0.06, split - 0.08, fz + 0.04], [w / 2 - 0.06, split - 0.3, fz + 0.04], 0.012),
    rod([w / 2 - 0.06, split + 0.1, fz + 0.04], [w / 2 - 0.06, split + 0.6, fz + 0.04], 0.012));
  add(p, 'dark', block(w - 0.1, 0.02, d - 0.1, 0.005, 0, 0, -0.03));
  return p;
}

export const KITCHEN: Record<string, Model> = { dining, chair, counter, woodstove, island, bar, barstool, fridge };
