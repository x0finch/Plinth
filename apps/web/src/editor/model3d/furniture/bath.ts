/** Bathroom and laundry: toilet, washbasin, showers, grab bar, call button, folding seat, washing machine, laundry sink */
import * as THREE from 'three';
import { add, block, cyl, disc, lathe, pane, rbox, ring, rod, type Model, type Parts, type Size } from './parts';

/** A toilet: a cistern against the wall (north), an oval bowl, seat and lid */
function toilet({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const tank = Math.min(0.18, d * 0.26), seat = Math.min(0.4, h * 0.53), r = Math.min(w / 2, 0.2), k = Math.min(1.45, (d - tank + 0.02) / (2 * r));
  add(p, 'ceramic', block(w * 0.95, h - seat - 0.03, tank, 0.03, 0, seat, -d / 2 + tank / 2), block(w, 0.025, tank + 0.02, 0.01, 0, h - 0.03, -d / 2 + tank / 2));
  const bz = d / 2 - r * k;
  add(p, 'ceramic', lathe([[0, 0], [r * 0.55, 0], [r * 0.6, seat * 0.25], [r * 0.82, seat * 0.75], [r * 0.95, seat - 0.03], [0, seat - 0.03]]).scale(1, 1, k).translate(0, 0, bz));
  add(p, 'ceramic', cyl(r, r, 0.03, 0, seat - 0.03, 0, 32).scale(1, 1, k).translate(0, 0, bz), cyl(r * 0.96, r * 0.96, 0.02, 0, seat, 0, 32).scale(1, 1, k).translate(0, 0, bz));
  add(p, 'metal', cyl(0.025, 0.025, 0.01, 0, h - 0.005, -d / 2 + tank / 2));
  return p;
}

/** A wall-hung vanity: a wood cabinet with white doors, a ceramic top with its basin, a faucet */
function basin({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const top = h - 0.04, ch = Math.min(0.5, top - 0.2);
  add(p, 'wood', block(w, ch, d - 0.02, 0.008, 0, top - ch, -0.01));
  for (const sx of w >= 0.5 ? [-1, 1] : [0]) {
    const dw = sx ? w / 2 - 0.006 : w - 0.01;
    add(p, 'cabinet', block(dw, ch - 0.02, 0.016, 0.004, sx * w / 4, top - ch + 0.01, d / 2 - 0.01));
  }
  add(p, 'ceramic', block(w, 0.04, d, 0.012, 0, top, 0));
  add(p, 'ceramicShade', cyl(Math.min(w * 0.32, 0.2), Math.min(w * 0.32, 0.2), 0.004, 0, h, 0.03, 36).scale(1, 1, 0.75).translate(0, 0, 0.008));
  add(p, 'metal', cyl(0.02, 0.02, 0.18, 0, h, -d / 2 + 0.06), rod([0, h + 0.17, -d / 2 + 0.06], [0, h + 0.15, -d / 2 + 0.18], 0.012));
  return p;
}

/** A shower: a tray, a riser rail and head on the back wall, glass where there is no wall (along `glass`, in plan) */
function shower(p: Parts, tray: THREE.BufferGeometry, glass: [number, number][], w: number, d: number, h: number) {
  add(p, 'ceramic', tray);
  for (let i = 1; i < glass.length; i++) {
    add(p, 'glass', pane(glass[i - 1], glass[i], 0.05, h - 0.05, 0.008));
    add(p, 'metal', rod([glass[i - 1][0], h, glass[i - 1][1]], [glass[i][0], h, glass[i][1]], 0.01, 8));
  }
  for (const [x, z] of glass) add(p, 'metal', rod([x, 0.05, z], [x, h, z], 0.01, 8));
  const rx = -w * 0.15, rz = -d / 2 + 0.03;
  add(p, 'metal', rod([rx, 0.9, rz], [rx, h - 0.1, rz], 0.012), rod([rx, h - 0.1, rz], [rx, h - 0.12, rz + 0.2], 0.01), cyl(0.09, 0.09, 0.015, rx, h - 0.135, rz + 0.22, 28),
    cyl(0.03, 0.03, 0.006, 0, 0.05, 0.05));
}

/** A square shower in a corner (walls to the north and west), glass to the south and east */
function showerSquare({ w, d, h }: Size): Parts {
  const p: Parts = {};
  shower(p, block(w, 0.05, d, 0.01, 0, 0, 0), [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2]], w, d, h);
  return p;
}

/** A diamond shower: a corner shower with its outer corner cut by the door */
function showerDiamond({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const c = Math.min(w, d) * 0.45;
  const outline: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2 - c], [w / 2 - c, d / 2], [-w / 2, d / 2]];
  const s = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const tray = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }).rotateX(-Math.PI / 2);
  shower(p, tray, [[-w / 2, d / 2], [w / 2 - c, d / 2], [w / 2, d / 2 - c], [w / 2, -d / 2]], w, d, h);
  return p;
}

/** A grab bar on the wall (north): a rail on two posts with round wall plates */
function grab({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const y = h / 2, z = d / 2 - 0.02, x = w / 2 - 0.04;
  add(p, 'metal', rod([-x, y, z], [x, y, z], 0.016, 14));
  for (const sx of [-1, 1]) add(p, 'metal', rod([sx * x, y, z], [sx * x, y, -d / 2 + 0.01], 0.012), disc(0.035, 0.01, sx * x, y, -d / 2 + 0.005));
  return p;
}

/** An emergency call button: a white plate with a red button */
function sos({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'appliance', rbox(w, h, 0.015, 0.008, 0, h / 2, -d / 2 + 0.0075));
  add(p, 'red', disc(Math.min(w, h) * 0.28, 0.018, 0, h / 2, -d / 2 + 0.024));
  return p;
}

/** A folding shower seat: slatted seat on a wall plate (north), held by two diagonal braces */
function foldseat({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'metal', block(w - 0.04, 0.14, 0.02, 0.006, 0, h - 0.16, -d / 2 + 0.01));
  const n = 4, sd = (d - 0.03) / n;
  for (let i = 0; i < n; i++) add(p, 'wood', block(w, 0.025, sd - 0.012, 0.006, 0, h - 0.025, -d / 2 + 0.025 + sd * (i + 0.5)));
  for (const sx of [-1, 1]) add(p, 'metal', rod([sx * (w / 2 - 0.03), h - 0.03, d / 2 - 0.05], [sx * (w / 2 - 0.03), h - 0.3, -d / 2 + 0.02], 0.01),
    rod([sx * (w / 2 - 0.03), h - 0.03, -d / 2 + 0.02], [sx * (w / 2 - 0.03), h - 0.03, d / 2 - 0.03], 0.01));
  return p;
}

/** A front-loading washing machine: control strip, round door */
function washer({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'appliance', block(w, h, d - 0.01, 0.025, 0, 0, -0.005));
  const z = d / 2;
  add(p, 'dark', block(w * 0.4, 0.05, 0.004, 0.004, -w * 0.15, h - 0.09, z - 0.008));
  add(p, 'metal', disc(0.03, 0.02, w * 0.3, h - 0.065, z), ring(Math.min(w, h) * 0.27, 0.025, 0, h * 0.45, z, 'z'));
  add(p, 'carGlass', disc(Math.min(w, h) * 0.25, 0.01, 0, h * 0.45, z - 0.005));
  return p;
}

/** A laundry sink: a deep tub with a ribbed washboard on a pedestal, a tap on the wall (north) */
function sink({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const tub = Math.min(0.3, h * 0.38), t = 0.035, y = h - tub;
  add(p, 'ceramic', block(w - 0.12, y, d - 0.14, 0.01, 0, 0, -0.03));
  add(p, 'ceramic', block(w, t, d, 0.01, 0, y, 0), block(w, tub, t, 0.012, 0, y, d / 2 - t / 2), block(w, tub, t, 0.012, 0, y, -d / 2 + t / 2),
    block(t, tub, d, 0.012, -w / 2 + t / 2, y, 0), block(t, tub, d, 0.012, w / 2 - t / 2, y, 0));
  // Washboard: the back half slopes down into the tub, ribbed across
  const bd = (d - 2 * t) * 0.45, slope = Math.atan2(tub * 0.5, bd);
  add(p, 'ceramicShade', rbox(w - 2 * t, 0.02, bd / Math.cos(slope), 0.005, 0, h - tub * 0.25 - 0.02, -d / 2 + t + bd / 2, slope));
  const ribs = Math.floor(bd / 0.03);
  for (let i = 0; i < ribs; i++) {
    const f = (i + 0.5) / ribs;
    add(p, 'ceramic', rbox(w - 2 * t - 0.02, 0.01, 0.012, 0.004, 0, h - 0.02 - f * tub * 0.5 + 0.01, -d / 2 + t + f * bd));
  }
  add(p, 'metal', rod([0, h + 0.25, -d / 2 + 0.005], [0, h + 0.25, -d / 2 + 0.12], 0.012), rod([0, h + 0.25, -d / 2 + 0.12], [0, h + 0.18, -d / 2 + 0.13], 0.01));
  return p;
}

export const BATH: Record<string, Model> = { toilet, basin, shower: showerSquare, shower5: showerDiamond, grab, sos, foldseat, washer, sink };
