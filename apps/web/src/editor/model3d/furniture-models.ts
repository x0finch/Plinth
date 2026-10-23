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
import { BATH } from './furniture/bath';
import { BEDROOM } from './furniture/bedroom';
import { KITCHEN } from './furniture/kitchen';
import { LIVING } from './furniture/living';
import { OUTDOOR } from './furniture/outdoor';
import type { FurnitureMaterial, Model } from './furniture/parts';

export { FURNITURE_MATERIALS, materialDef, type FurnitureMaterial } from './furniture/parts';

const MODELS: Record<string, Model> = { ...LIVING, ...KITCHEN, ...BEDROOM, ...BATH, ...OUTDOOR };

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
