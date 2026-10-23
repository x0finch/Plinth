/**
 * Floor material textures for the 3D floors: each material's pattern tile (see floor-materials.tsx) rasterized once per canvas
 * document and repeated by world position (floor UVs are in metres), so a floor in 3D shows the same pattern as in the plan.
 */
import { createElement, useEffect, useState } from 'react';
import * as THREE from 'three';
import { FLOOR_PATTERNS } from '../floor-materials';
import { markup } from './FloorDrawing';

const M = 0.001;
/** Pixels per millimetre of a tile: about 4 mm per pixel, enough for seams and grout at viewing distance */
const PX_PER_MM = 0.25;
const cache = new WeakMap<Document, Map<string, Promise<THREE.Texture>>>();

function load(doc: Document, material: string) {
  let m = cache.get(doc);
  if (!m) cache.set(doc, (m = new Map()));
  let t = m.get(material);
  if (!t) {
    const p = FLOOR_PATTERNS[material];
    const w = Math.max(64, Math.min(512, Math.round(p.w * PX_PER_MM))), h = Math.max(64, Math.min(512, Math.round(p.h * PX_PER_MM)));
    const svg = markup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${p.w} ${p.h}`, width: w, height: h }, p.tile), doc);
    t = (async () => {
      const img = new (doc.defaultView!.Image)();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const c = doc.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1 / (p.w * M), 1 / (p.h * M));
      tex.anisotropy = 8;
      return tex;
    })();
    m.set(material, t);
  }
  return t;
}

/** The texture for a floor material, once ready; null for a material without a pattern */
export function useFloorTexture(doc: Document, material: string | null) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!material || !FLOOR_PATTERNS[material]) return setTex(null);
    let live = true;
    void load(doc, material).then(t => live && setTex(t));
    return () => void (live = false);
  }, [doc, material]);
  return tex;
}
