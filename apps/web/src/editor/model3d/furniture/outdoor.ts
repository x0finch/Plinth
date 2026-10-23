/** Yard and roof: courtyard tree, car, rocking chair, stone table and stool, planters, solar heater, water tank, drying rack, canopy, awning */
import * as THREE from 'three';
import { add, block, clump, cyl, lathe, legs, random, rbox, ring, rod, type FurnitureMaterial, type Model, type Parts, type Size } from './parts';

function tree({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const r = Math.min(w, d) / 2;
  // Trunk and three branches up into the crown
  const trunkH = h * 0.34, tr = Math.max(0.1, r * 0.08);
  add(p, 'bark', cyl(tr * 1.15, tr * 0.75, trunkH, 0, 0, 0, 12));
  for (const [a, lean, len] of [[0.3, 0.5, 0.3], [2.4, 0.45, 0.26], [4.3, 0.55, 0.28]] as const) {
    const L = h * len, g = new THREE.CylinderGeometry(tr * 0.35, tr * 0.6, L, 8).translate(0, L / 2, 0);
    g.rotateZ(lean);
    g.rotateY(a);
    add(p, 'bark', g.translate(0, trunkH * 0.92, 0));
  }
  // A crown of overlapping, slightly flattened clumps in two greens, spread over an ellipsoid by the golden angle
  const cy = h * 0.66, ry = Math.min(h * 0.2, h - cy - r * 0.3), n = 14;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, y = 1 - 2 * t, ring = Math.sqrt(1 - y * y), a = i * 2.39996;
    const rr = r * (0.3 + 0.06 * ((i * 7) % 3));
    add(p, i % 2 ? 'leaf2' : 'leaf', new THREE.IcosahedronGeometry(rr, 3).scale(1, 0.85, 1)
      .translate(Math.cos(a) * ring * r * 0.66, cy + y * ry, Math.sin(a) * ring * r * 0.66));
  }
  add(p, 'leaf', new THREE.IcosahedronGeometry(r * 0.55, 3).scale(1, 0.85, 1).translate(0, cy, 0));
  return p;
}

/** A side profile (x along the length, y up) extruded across the width, with rounded edges */
function profile(shape: THREE.Shape, width: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 10 });
  return g.translate(0, 0, -(width - 2 * bevel) / 2);
}

function car({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const L = w / 2, R = Math.min(0.36, h * 0.2), clear = R * 0.55, belt = h * 0.52, b = 0.06, wx = L * 0.62, arch = R * 1.18;
  // Lower body, drawn inside the bevel: a short tail, a long bonnet sloping to the nose, arches over the wheels
  const bl = L - b, top = belt - b, bot = clear + b;
  const body = new THREE.Shape();
  body.moveTo(-bl + 0.12, bot);
  for (const x of [-wx, wx]) {
    body.lineTo(x - arch, bot);
    body.lineTo(x - arch, R);
    body.absarc(x, R, arch, Math.PI, 0, true);
    body.lineTo(x + arch, bot);
  }
  body.lineTo(bl - 0.12, bot);
  body.quadraticCurveTo(bl, bot, bl, bot + 0.12);
  body.lineTo(bl, top - 0.2);
  body.quadraticCurveTo(bl - 0.1, top - 0.02, bl - 0.6, top);
  body.lineTo(-bl + 0.2, top);
  body.quadraticCurveTo(-bl, top, -bl, top - 0.15);
  body.lineTo(-bl, bot + 0.12);
  body.quadraticCurveTo(-bl, bot, -bl + 0.12, bot);
  add(p, 'carBody', profile(body, d, b));
  // Cabin: tinted glass under a body-colored roof, with a raked windscreen and rear window
  const roof = h - 0.05, wsBase = L * 0.32, wsTop = -L * 0.08, rwTop = -L * 0.58, rwBase = -L * 0.8;
  const cabin = new THREE.Shape();
  cabin.moveTo(rwBase, belt - 0.04);
  cabin.lineTo(wsBase, belt - 0.04);
  cabin.lineTo(wsTop + 0.12, roof - 0.12);
  cabin.quadraticCurveTo(wsTop, roof - 0.07, wsTop - 0.15, roof - 0.07);
  cabin.lineTo(rwTop + 0.15, roof - 0.07);
  cabin.quadraticCurveTo(rwTop, roof - 0.07, rwTop - 0.08, roof - 0.14);
  cabin.lineTo(rwBase, belt - 0.04);
  add(p, 'carGlass', profile(cabin, d - 0.26, 0.04));
  add(p, 'carBody', rbox(wsTop - rwTop + 0.12, 0.05, d - 0.2, 0.025, (wsTop + rwTop) / 2, roof - 0.03, 0));
  // Pillars between the side windows
  add(p, 'carBody', rbox(0.1, roof - belt, d - 0.22, 0.02, (wsTop + rwTop) / 2 + 0.05, (belt + roof) / 2 - 0.02, 0));
  // Wheels with metal hubs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * wx, z = sz * (d / 2 - 0.15);
    add(p, 'tyre', new THREE.CylinderGeometry(R, R, 0.22, 28).rotateX(Math.PI / 2).translate(x, R, z));
    add(p, 'metal', new THREE.CylinderGeometry(R * 0.6, R * 0.6, 0.02, 24).rotateX(Math.PI / 2).translate(x, R, z + sz * 0.11));
  }
  // Head- and taillights
  for (const sz of [-1, 1]) {
    add(p, 'headlight', rbox(0.08, 0.09, 0.38, 0.03, L - 0.03, top - 0.24, sz * (d / 2 - 0.32)));
    add(p, 'taillight', rbox(0.08, 0.1, 0.34, 0.03, -L + 0.02, top - 0.1, sz * (d / 2 - 0.3)));
  }
  return p;
}

/** A rocking chair facing south: curved runners, a slatted seat and back, arms */
function rocker({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const R = d * 1.4, seat = Math.min(0.42, h * 0.46), sx = w / 2 - 0.04;
  for (const s of [-1, 1]) {
    const pts = Array.from({ length: 13 }, (_, i) => {
      const z = -d / 2 + (d * i) / 12;
      return new THREE.Vector3(s * sx, 0.025 + R - Math.sqrt(R * R - z * z), z);
    });
    add(p, 'wood', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.022, 8));
    // Legs from the runner up to the seat, and an arm on posts
    add(p, 'wood', rod([s * sx, 0.06, d * 0.22], [s * sx, seat, d * 0.2], 0.018), rod([s * sx, 0.06, -d * 0.22], [s * sx, seat - 0.03, -d * 0.18], 0.018));
    add(p, 'wood', rod([s * sx, seat, d * 0.2], [s * sx, seat + 0.22, d * 0.2], 0.015), rbox(0.06, 0.03, d * 0.5, 0.01, s * sx, seat + 0.23, 0));
  }
  // Seat slats, sloping slightly back
  const sd = d * 0.46;
  for (let i = 0; i < 6; i++) add(p, 'wood', rbox(w - 0.06, 0.02, sd / 6 - 0.01, 0.005, 0, seat - (i / 5) * 0.04, d * 0.2 - (sd / 6) * (i + 0.5)));
  // Back slats, leaning back
  const lean = 0.35, bl = h - seat, bz = d * 0.2 - sd;
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + 0.08 + ((w - 0.16) / 4) * i;
    add(p, 'wood', rbox(0.06, bl, 0.02, 0.008, x, seat - 0.04 + (bl / 2) * Math.cos(lean), bz - (bl / 2) * Math.sin(lean), -lean));
  }
  add(p, 'wood', rbox(w - 0.04, 0.06, 0.03, 0.01, 0, seat - 0.04 + bl * Math.cos(lean) - 0.03, bz - bl * Math.sin(lean) + 0.01, -lean));
  return p;
}

/** A round stone table on a carved drum */
function stonetable({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const r = Math.min(w, d) / 2;
  add(p, 'stone', cyl(r, r * 0.98, 0.08, 0, h - 0.08, 0, 40),
    lathe([[0, 0], [r * 0.42, 0], [r * 0.42, 0.06], [r * 0.3, 0.14], [r * 0.26, h * 0.45], [r * 0.34, h - 0.14], [r * 0.4, h - 0.08], [0, h - 0.08]]));
  return p;
}

/** A drum-shaped stone stool */
function stool({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const r = Math.min(w, d) / 2;
  add(p, 'stone', lathe([[0, 0], [r * 0.78, 0], [r * 0.95, h * 0.3], [r, h * 0.5], [r * 0.95, h * 0.7], [r * 0.8, h], [0, h]]));
  add(p, 'stoneDark', ring(r * 0.99, 0.008, 0, h * 0.5, 0));
  return p;
}

/** A raised bed: stone walls, soil, shrubs and flowers */
function raised({ w, d, h }: Size, seed: number): Parts {
  const p: Parts = {};
  const t = 0.06;
  add(p, 'stone', block(w, h, t, 0.01, 0, 0, d / 2 - t / 2), block(w, h, t, 0.01, 0, 0, -d / 2 + t / 2), block(t, h, d, 0.01, -w / 2 + t / 2, 0, 0), block(t, h, d, 0.01, w / 2 - t / 2, 0, 0));
  add(p, 'soil', block(w - 2 * t, h - 0.06, d - 2 * t, 0.005, 0, 0, 0));
  const rand = random(seed), n = Math.max(1, Math.round(((w - 2 * t) * (d - 2 * t)) / 0.12));
  for (let i = 0; i < n; i++) {
    const x = (rand() - 0.5) * (w - 2 * t - 0.2), z = (rand() - 0.5) * (d - 2 * t - 0.2), r = 0.12 + rand() * 0.1;
    add(p, rand() < 0.5 ? 'leaf' : 'leaf2', clump(r, x, h - 0.06 + r * 0.6, z));
    if (rand() < 0.5) add(p, 'flower', clump(0.035, x + r * 0.4, h - 0.06 + r * 1.2, z + r * 0.3, 1));
  }
  return p;
}

/** A solar water heater: a tank across the top and a row of glass tubes sloping down to the south, on a metal frame */
function solar({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const tr = Math.min(0.22, h * 0.17), ty = h - tr, tz = -d / 2 + tr;
  add(p, 'metal', new THREE.CylinderGeometry(tr, tr, w, 28).rotateZ(Math.PI / 2).translate(0, ty, tz));
  const top: [number, number] = [ty - tr * 0.6, tz + tr * 0.6], bot: [number, number] = [0.2, d / 2 - 0.05];
  const n = Math.max(4, Math.floor((w - 0.16) / 0.075));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.08 + ((w - 0.16) / (n - 1)) * i;
    add(p, 'tube', rod([x, top[0], top[1]], [x, bot[0], bot[1]], 0.026, 10));
  }
  add(p, 'metal', rod([-w / 2 + 0.04, bot[0], bot[1]], [w / 2 - 0.04, bot[0], bot[1]], 0.025));
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.04);
    add(p, 'metal', rod([x, bot[0] - 0.03, bot[1]], [x, ty - 0.05, tz + 0.05], 0.015), rod([x, 0, bot[1]], [x, bot[0], bot[1]], 0.015),
      rod([x, 0, tz], [x, ty - tr, tz], 0.015), rod([x, 0.02, bot[1]], [x, 0.02, tz], 0.012));
  }
  return p;
}

/** A rooftop water tank: a ribbed stainless drum with a domed top on a metal stand */
function watertank({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const r = Math.min(w, d) / 2 - 0.02, stand = Math.min(0.4, h * 0.28), top = h - 0.06;
  legs(p, 'iron', r * 1.5, r * 1.5, 0.02, stand, 0.025);
  add(p, 'iron', ring(r * 0.72, 0.02, 0, stand, 0));
  add(p, 'metal', lathe([[0, stand], [r, stand], [r, top - r * 0.25], [r * 0.85, top - r * 0.08], [r * 0.3, top], [0, top]]),
    cyl(0.12, 0.12, 0.06, 0, top - 0.005, 0), ring(r + 0.005, 0.012, 0, stand + (top - stand) * 0.33, 0), ring(r + 0.005, 0.012, 0, stand + (top - stand) * 0.62, 0));
  return p;
}

/** A drying rack: two end frames, three rails, some laundry */
function dryrack({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const x = w / 2 - 0.03, z = d / 2 - 0.04;
  for (const sx of [-1, 1]) {
    add(p, 'metal', rod([sx * x, 0, -z], [sx * x, h, -z * 0.3], 0.016), rod([sx * x, 0, z], [sx * x, h, z * 0.3], 0.016), rod([sx * x, h, -z * 0.5], [sx * x, h, z * 0.5], 0.014),
      rod([sx * x, 0.02, -z], [sx * x, 0.02, z], 0.014));
  }
  const rails = [-z * 0.5, 0, z * 0.5];
  for (const rz of rails) add(p, 'metal', rod([-x, h - 0.01, rz], [x, h - 0.01, rz], 0.011));
  const laundry: [number, number, number, number, FurnitureMaterial][] = [
    [-w * 0.3, rails[0], w * 0.22, 0.75, 'bedding'], [-w * 0.02, rails[1], w * 0.16, 0.5, 'linen'], [w * 0.22, rails[2], w * 0.2, 0.62, 'canvas2'], [w * 0.36, rails[0], w * 0.1, 0.4, 'fabric'],
  ];
  for (const [lx, lz, lw, ll, mat] of laundry) add(p, mat, rbox(lw, Math.min(ll, h * 0.6), 0.012, 0.004, lx, h - 0.02 - Math.min(ll, h * 0.6) / 2, lz));
  return p;
}

/** A canopy: four posts, beams and a fabric roof falling gently to the south */
function canopy({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const fall = Math.min(0.25, h * 0.1), post = 0.08;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(p, 'iron', block(post, h - fall * (sz > 0 ? 1 : 0) - 0.06, post, 0.01, sx * (w / 2 - post / 2), 0, sz * (d / 2 - post / 2)));
  const slope = Math.atan2(fall, d), len = Math.hypot(d, fall);
  for (const sx of [-1, 1]) add(p, 'iron', rbox(0.06, 0.1, len, 0.01, sx * (w / 2 - post / 2), h - fall / 2 - 0.09, 0, slope));
  for (const sz of [-1, 1]) add(p, 'iron', rbox(w, 0.1, 0.06, 0.01, 0, h - 0.09 - (sz > 0 ? fall : 0), sz * (d / 2 - post / 2)));
  add(p, 'canvas', rbox(w + 0.1, 0.03, len + 0.1, 0.01, 0, h - fall / 2 - 0.02, 0, slope));
  return p;
}

/** A retractable awning out from the wall (north): a cassette, striped canvas falling to the south, a front bar and arms */
function awning2({ w, d, h }: Size): Parts {
  const p: Parts = {};
  add(p, 'appliance', block(w, 0.14, 0.16, 0.03, 0, h - 0.14, -d / 2 + 0.08));
  const y0 = h - 0.08, z0 = -d / 2 + 0.14, y1 = 0.06, z1 = d / 2 - 0.03, len = Math.hypot(z1 - z0, y0 - y1), slope = Math.atan2(y0 - y1, z1 - z0);
  const n = Math.max(2, Math.round(w / 0.16)), sw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + sw * (i + 0.5), mat = i % 2 ? 'canvas2' : 'canvas';
    add(p, mat, rbox(sw, 0.008, len, 0.002, x, (y0 + y1) / 2, (z0 + z1) / 2, slope), block(sw, 0.1, 0.008, 0.002, x, y1 - 0.1, z1));
  }
  add(p, 'appliance', rbox(w, 0.04, 0.05, 0.01, 0, y1, z1 - 0.01));
  for (const sx of [-1, 1]) add(p, 'metal', rod([sx * (w / 2 - 0.08), y0 - 0.04, z0], [sx * (w / 2 - 0.15), (y0 + y1) / 2 - 0.05, (z0 + z1) / 2], 0.015),
    rod([sx * (w / 2 - 0.15), (y0 + y1) / 2 - 0.05, (z0 + z1) / 2], [sx * (w / 2 - 0.08), y1 - 0.01, z1 - 0.03], 0.015));
  return p;
}

export const OUTDOOR: Record<string, Model> = {
  tree, car, rocker, stonetable, stool, solar, watertank, dryrack, canopy, awning2,
  planter: s => raised(s, 7), bed: s => raised(s, 11),
};
