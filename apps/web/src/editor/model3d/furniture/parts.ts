/**
 * What furniture models are made of: their materials and the parts they are built from (see ../furniture-models.ts for the
 * local frame). All sizes in metres.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

interface MaterialDef {
  /** Theme variable (--furn-*, see light.css) */
  color: string;
  roughness: number;
  metalness: number;
  /** Below 1 for see-through glass, which also casts no shadow */
  opacity?: number;
}

/** The materials a model is made of; each has a theme color and a finish */
export const FURNITURE_MATERIALS = {
  fabric: { color: '--furn-fabric', roughness: 0.95, metalness: 0 },
  cushion: { color: '--furn-cushion', roughness: 0.95, metalness: 0 },
  linen: { color: '--furn-linen', roughness: 0.9, metalness: 0 },
  bedding: { color: '--furn-bedding', roughness: 0.95, metalness: 0 },
  canvas: { color: '--furn-canvas', roughness: 0.9, metalness: 0 },
  canvas2: { color: '--furn-canvas-2', roughness: 0.9, metalness: 0 },
  wood: { color: '--furn-wood', roughness: 0.7, metalness: 0 },
  woodDark: { color: '--furn-wood-dark', roughness: 0.6, metalness: 0 },
  lacquer: { color: '--furn-lacquer', roughness: 0.4, metalness: 0 },
  gold: { color: '--furn-gold', roughness: 0.35, metalness: 0.7 },
  red: { color: '--furn-red', roughness: 0.5, metalness: 0 },
  cabinet: { color: '--furn-cabinet', roughness: 0.6, metalness: 0 },
  countertop: { color: '--furn-countertop', roughness: 0.4, metalness: 0 },
  ceramic: { color: '--furn-ceramic', roughness: 0.2, metalness: 0 },
  ceramicShade: { color: '--furn-ceramic-shade', roughness: 0.25, metalness: 0 },
  appliance: { color: '--furn-appliance', roughness: 0.35, metalness: 0.1 },
  plaster: { color: '--furn-plaster', roughness: 0.9, metalness: 0 },
  stone: { color: '--furn-stone', roughness: 0.9, metalness: 0 },
  stoneDark: { color: '--furn-stone-dark', roughness: 0.6, metalness: 0 },
  terracotta: { color: '--furn-terracotta', roughness: 0.9, metalness: 0 },
  soil: { color: '--furn-soil', roughness: 1, metalness: 0 },
  iron: { color: '--furn-iron', roughness: 0.5, metalness: 0.5 },
  dark: { color: '--furn-dark', roughness: 0.3, metalness: 0.1 },
  glass: { color: '--canvas-glass', roughness: 0.05, metalness: 0, opacity: 0.25 },
  book1: { color: '--furn-book-1', roughness: 0.8, metalness: 0 },
  book2: { color: '--furn-book-2', roughness: 0.8, metalness: 0 },
  book3: { color: '--furn-book-3', roughness: 0.8, metalness: 0 },
  book4: { color: '--furn-book-4', roughness: 0.8, metalness: 0 },
  flower: { color: '--furn-flower', roughness: 0.8, metalness: 0 },
  tube: { color: '--furn-tube', roughness: 0.15, metalness: 0.3 },
  bark: { color: '--furn-bark', roughness: 0.95, metalness: 0 },
  leaf: { color: '--furn-leaf', roughness: 0.85, metalness: 0 },
  leaf2: { color: '--furn-leaf-2', roughness: 0.85, metalness: 0 },
  carBody: { color: '--furn-car', roughness: 0.35, metalness: 0.1 },
  carGlass: { color: '--furn-car-glass', roughness: 0.15, metalness: 0.2 },
  tyre: { color: '--furn-tyre', roughness: 0.9, metalness: 0 },
  metal: { color: '--furn-metal', roughness: 0.35, metalness: 0.25 },
  headlight: { color: '--furn-headlight', roughness: 0.2, metalness: 0 },
  taillight: { color: '--furn-taillight', roughness: 0.3, metalness: 0 },
} satisfies Record<string, MaterialDef>;
export type FurnitureMaterial = keyof typeof FURNITURE_MATERIALS;
export const materialDef = (m: FurnitureMaterial): MaterialDef => FURNITURE_MATERIALS[m];

export type Size = { w: number; d: number; h: number };
export type Parts = Partial<Record<FurnitureMaterial, THREE.BufferGeometry[]>>;
export type Model = (s: Size) => Parts;

export function add(parts: Parts, mat: FurnitureMaterial, ...g: THREE.BufferGeometry[]) {
  (parts[mat] ??= []).push(...g);
}

/** A box with rounded edges, its centre at (x, y, z), turned about x (then y) */
export function rbox(w: number, h: number, d: number, r: number, x: number, y: number, z: number, rx = 0, ry = 0) {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.max(0.0005, Math.min(r, w / 2, h / 2, d / 2) * 0.999));
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  return g.translate(x, y, z);
}

/** A rounded box standing on y0 */
export const block = (w: number, h: number, d: number, r: number, x: number, y0: number, z: number) => rbox(w, h, d, r, x, y0 + h / 2, z);

/** A vertical cylinder (or cone) standing on y0 */
export function cyl(r0: number, r1: number, h: number, x: number, y0: number, z: number, seg = 20) {
  return new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y0 + h / 2, z);
}

/** A round bar from a to b */
export function rod(a: [number, number, number], b: [number, number, number], r: number, seg = 10) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), dir = vb.clone().sub(va);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return g.applyMatrix4(new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
}

/** A solid of revolution about the vertical axis through (x, z): its profile as [radius, height] from the axis out and back */
export function lathe(profile: [number, number][], x = 0, y0 = 0, z = 0, seg = 28) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg).translate(x, y0, z);
}

/** A ring lying flat (axis 'y'), or standing facing +z (axis 'z') */
export function ring(R: number, r: number, x: number, y: number, z: number, axis: 'y' | 'z' = 'y') {
  const g = new THREE.TorusGeometry(R, r, 10, 32);
  if (axis === 'y') g.rotateX(Math.PI / 2);
  return g.translate(x, y, z);
}

/** A disc facing +z (a button, a door's glass) */
export const disc = (r: number, t: number, x: number, y: number, z: number) =>
  new THREE.CylinderGeometry(r, r, t, 28).rotateX(Math.PI / 2).translate(x, y, z);

/** A soft clump of leaves */
export const clump = (r: number, x: number, y: number, z: number, flat = 0.85) =>
  new THREE.IcosahedronGeometry(r, 3).scale(1, flat, 1).translate(x, y, z);

/** A thin vertical panel from a to b in plan ([x, z]) */
export function pane(a: [number, number], b: [number, number], y0: number, h: number, t: number) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return new THREE.BoxGeometry(len, h, t).rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0])).translate((a[0] + b[0]) / 2, y0 + h / 2, (a[1] + b[1]) / 2);
}

/** Four legs set in from the corners of a w × d footprint */
export function legs(p: Parts, mat: FurnitureMaterial, w: number, d: number, inset: number, h: number, r: number, square = false) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - inset), z = sz * (d / 2 - inset);
    add(p, mat, square ? block(r * 2, h, r * 2, r * 0.3, x, 0, z) : cyl(r * 0.8, r, h, x, 0, z, 12));
  }
}

/** A deterministic pseudo-random sequence in [0, 1), so a model looks the same every time */
export function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
