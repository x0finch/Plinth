/**
 * Furniture modelled in 3D, in the spirit of SketchUp's components: recognisable parts (cushions, pillows, wheels…) with softened
 * edges and a few materials, built from the piece's size so a resized piece keeps its proportions (a longer sofa gets more
 * cushions, not wider ones). Types without a model stay a block.
 *
 * Local frame, in metres: origin at the centre of the footprint on the floor, x across the width (w), z across the depth (d),
 * y up. At rotation 0 a piece faces south (+z, the bottom of the plan): its back (a sofa's back, a bed's headboard) is to the
 * north. A car's length is its width (w), and it heads east (+x).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** The materials a model is made of; each has a theme color (--furn-*, see light.css) and a finish */
export const FURNITURE_MATERIALS = {
  fabric: { color: '--furn-fabric', roughness: 0.95, metalness: 0 },
  cushion: { color: '--furn-cushion', roughness: 0.95, metalness: 0 },
  linen: { color: '--furn-linen', roughness: 0.9, metalness: 0 },
  bedding: { color: '--furn-bedding', roughness: 0.95, metalness: 0 },
  wood: { color: '--furn-wood', roughness: 0.7, metalness: 0 },
  woodDark: { color: '--furn-wood-dark', roughness: 0.6, metalness: 0 },
  bark: { color: '--furn-bark', roughness: 0.95, metalness: 0 },
  leaf: { color: '--furn-leaf', roughness: 0.85, metalness: 0 },
  leaf2: { color: '--furn-leaf-2', roughness: 0.85, metalness: 0 },
  carBody: { color: '--furn-car', roughness: 0.35, metalness: 0.1 },
  carGlass: { color: '--furn-car-glass', roughness: 0.15, metalness: 0.2 },
  tyre: { color: '--furn-tyre', roughness: 0.9, metalness: 0 },
  metal: { color: '--furn-metal', roughness: 0.35, metalness: 0.6 },
  headlight: { color: '--furn-headlight', roughness: 0.2, metalness: 0 },
  taillight: { color: '--furn-taillight', roughness: 0.3, metalness: 0 },
} as const;
export type FurnitureMaterial = keyof typeof FURNITURE_MATERIALS;

type Size = { w: number; d: number; h: number };
type Parts = Partial<Record<FurnitureMaterial, THREE.BufferGeometry[]>>;

/** A box with rounded edges, its centre at (x, y, z) */
function rbox(w: number, h: number, d: number, r: number, x: number, y: number, z: number, rx = 0) {
  const g = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
  if (rx) g.rotateX(rx);
  return g.translate(x, y, z);
}

/** A vertical cylinder (or cone) standing on y0 */
function cyl(r0: number, r1: number, h: number, x: number, y0: number, z: number, seg = 16) {
  return new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y0 + h / 2, z);
}

function add(parts: Parts, mat: FurnitureMaterial, ...g: THREE.BufferGeometry[]) {
  (parts[mat] ??= []).push(...g);
}

function sofa({ w, d, h }: Size): Parts {
  const p: Parts = {};
  const leg = 0.07, arm = Math.min(0.18, w * 0.1), back = Math.min(0.22, d * 0.25);
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

const MODELS: Record<string, (s: Size) => Parts> = {
  sofa3: sofa, sofa2: sofa,
  bed18: bed, bed15: bed, bed12: bed,
  tree,
  car,
};

export const hasModel = (type: string) => type in MODELS;

/**
 * The model of a piece of furniture at a size (mm): one geometry per material, in the local frame above; null for a type
 * without a model
 */
export function furnitureModel(type: string, size: { w: number; d: number; h: number }) {
  const make = MODELS[type];
  if (!make) return null;
  const parts = make({ w: size.w / 1000, d: size.d / 1000, h: size.h / 1000 });
  const out: [FurnitureMaterial, THREE.BufferGeometry][] = [];
  for (const [mat, list] of Object.entries(parts) as [FurnitureMaterial, THREE.BufferGeometry[]][]) {
    // Merge each material's parts into one geometry (one draw call); the parts mix indexed and non-indexed geometries
    const flat = list.map(g => (g.index ? g.toNonIndexed() : g));
    for (const g of flat) {
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      g.clearGroups();
    }
    const merged = mergeGeometries(flat);
    for (const g of [...list, ...flat]) if (g !== merged) g.dispose();
    out.push([mat, merged]);
  }
  return out;
}
