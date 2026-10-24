/**
 * A still of a whole house in 3D, for the design list: the same model as the editor's 3D view (walls in their finish, floors in
 * their material, doors, windows, railings and furniture drawn by their looks, elements, the plinth), seen from the 3D view's
 * default direction, with its sun and shadows, in the canvas's light theme. Drawn offscreen on the one renderer the look stills
 * share (look-preview.ts), as a JPEG data URL.
 */
import {
  DEFAULT_FINISH, elementTarget, furnitureTarget, lookRecipe, materialOf, openingFrames, openingTarget, projectElements, requestBuild, wallBoxes,
  wallTarget, type Material, type Project, type Recipe, type RecipeSize,
} from '@plinth/core';
import * as THREE from 'three';
import { lightDocument } from '@/canvas/CanvasFrame';
import { themeColor } from '@/lib/theme';
import { materialStyle } from '@/lib/materials';
import { plinthRect } from '../plan-geometry';
import { floorTexture } from './floor-textures';
import { BIRD, FOV, framed } from './framing';
import { withStillRenderer } from './look-preview';
import { lookMaterial, partsGeometry } from './looks';
import { materialPattern } from '../floor-materials';

const M = 0.001;
const PLINTH = 0.3;
/** The size an element's look is built at to read the materials of its own geometry (as the 3D view does) */
const ELEMENT_SIZE = { w: 2000, d: 2000, h: 3000 };

export function renderHouseStill(project: Project, opts: { width?: number; height?: number } = {}): Promise<string> {
  return withStillRenderer(r => draw(r, project, opts.width ?? 640, opts.height ?? 480));
}

async function draw(renderer: THREE.WebGLRenderer, p: Project, W: number, H: number): Promise<string> {
  const doc = await lightDocument();
  const color = (t: string) => new THREE.Color(themeColor(t, doc));
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const standard = (m: Material | undefined, fallback?: THREE.Color) => {
    const s = materialStyle(m);
    return keep(new THREE.MeshStandardMaterial({ color: m ? new THREE.Color(s.color) : fallback, roughness: s.roughness, metalness: s.metalness, transparent: s.opacity < 1, opacity: s.opacity, depthWrite: s.opacity === 1 }));
  };
  const house = new THREE.Group();
  const elev = new Map(p.levels.map(l => [l.id, l.elevation]));
  const wall = color('--card');

  // A look built at a size, as meshes in its materials
  const look = async (recipe: Recipe | null, size: RecipeSize, params?: Record<string, unknown>) => {
    const g = new THREE.Group();
    const built = recipe && (await requestBuild(recipe, size, params));
    if (!built) return g;
    for (const [mat, geo] of partsGeometry(built.parts)) {
      keep(geo);
      const s = lookMaterial(mat, recipe, p.library.materials);
      const mesh = new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(s.color), roughness: s.roughness, metalness: s.metalness, transparent: s.opacity < 1, opacity: s.opacity, depthWrite: s.opacity === 1 })));
      mesh.castShadow = s.opacity === 1;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  };
  const jobs: Promise<void>[] = [];

  // Floors, in their material (its pattern, else its colour)
  for (const s of p.spaces) {
    if (s.kind === 'void' || s.slabOpening) continue;
    const base = elev.get(s.level) ?? 0, y = s.kind === 'outdoor' && base === 0 ? p.site.groundLevel + 20 : base, t = s.kind === 'outdoor' ? 20 : 120;
    const shapes = s.shape.map(poly => {
      const sh = new THREE.Shape(poly.outer.map(([x, z]) => new THREE.Vector2(x * M, -z * M)));
      for (const h of poly.holes ?? []) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x * M, -z * M))));
      return sh;
    });
    const geo = keep(new THREE.ExtrudeGeometry(shapes, { depth: t * M, bevelEnabled: false })).rotateX(-Math.PI / 2);
    const m = materialOf(s.floor, null, p.library.materials);
    const material = standard(m, wall);
    if (m && materialPattern(m)) {
      material.color.copy(wall);
      material.map = await floorTexture(doc, m);
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = (y + 2 - t) * M;
    mesh.receiveShadow = true;
    house.add(mesh);
  }

  // Walls in their finish (glass is drawn by the openings' looks); railings by their look, piece by piece
  for (const w of p.walls) {
    const base = elev.get(w.level) ?? 0;
    for (const b of wallBoxes(p, w)) {
      if (b.kind === 'glass' || b.kind === 'glass-block') continue;
      if (b.kind === 'railing') {
        jobs.push(look(lookRecipe(p, wallTarget(w), w.look), { w: b.length, d: b.thickness, h: b.height }, w.lookParams).then(g => {
          g.position.set(b.center[0] * M, (base + b.z) * M, b.center[1] * M);
          g.rotation.y = -b.angle;
          house.add(g);
        }));
        continue;
      }
      const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(b.length * M, b.height * M, b.thickness * M)), standard(materialOf(w.finish ?? DEFAULT_FINISH, null, p.library.materials), wall));
      mesh.position.set(b.center[0] * M, (base + b.z + b.height / 2) * M, b.center[1] * M);
      mesh.rotation.y = -b.angle;
      mesh.castShadow = mesh.receiveShadow = true;
      house.add(mesh);
    }
  }

  // Doors and windows
  for (const fr of openingFrames(p)) {
    jobs.push(look(lookRecipe(p, openingTarget(fr.opening), fr.opening.look), { w: fr.width, d: fr.thickness, h: fr.height }, fr.opening.lookParams).then(g => {
      g.position.set(fr.center[0] * M, ((elev.get(fr.level) ?? 0) + fr.z) * M, fr.center[1] * M);
      g.rotation.y = -fr.angle;
      house.add(g);
    }));
  }

  // Elements' own geometry, in the materials their look gives each kind of solid
  for (const s of projectElements(p).flatMap(g => g.solids)) {
    const e = p.elements.find(x => x.id === s.id), recipe = e && lookRecipe(p, elementTarget(e), e.look);
    const own = recipe && (await requestBuild(recipe, ELEMENT_SIZE, e?.lookParams))?.parts.find(x => x.kind === 'base');
    const mat = own?.kind === 'base' ? own.mats[s.kind] : undefined;
    const geo = keep(new THREE.ExtrudeGeometry(new THREE.Shape(s.outline.map(([x, z]) => new THREE.Vector2(x * M, -z * M))), { depth: s.height * M, bevelEnabled: false })).rotateX(-Math.PI / 2);
    const material = standard(mat ? materialOf(mat, recipe, p.library.materials) : undefined, s.kind === 'water' ? color('--muted') : s.kind === 'grate' ? color('--muted-foreground') : wall);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = ((elev.get(s.level) ?? 0) + s.z) * M;
    mesh.castShadow = s.kind === 'structure';
    mesh.receiveShadow = true;
    house.add(mesh);
  }

  // Furniture
  for (const f of p.furniture) {
    jobs.push(look(lookRecipe(p, furnitureTarget(f), f.look), f.size, f.lookParams).then(g => {
      g.position.set(f.position[0] * M, ((elev.get(f.level) ?? 0) + (f.elevation ?? 0)) * M, f.position[1] * M);
      g.rotation.y = (-f.rotation * Math.PI) / 180;
      house.add(g);
    }));
  }
  await Promise.all(jobs);

  const scene = new THREE.Scene();
  scene.background = color('--canvas-backdrop');
  scene.add(house);
  const box = new THREE.Box3().setFromObject(house);
  if (box.isEmpty()) box.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
  const center = box.getCenter(new THREE.Vector3()), radius = Math.max(2, box.getSize(new THREE.Vector3()).length() / 2);

  // The plinth, a white board a little larger than the site, and a ground that only catches shadows
  const [x0, y0, x1, y1] = plinthRect(p), ground = p.site.groundLevel * M;
  const plinth = new THREE.Mesh(keep(new THREE.BoxGeometry((x1 - x0) * M, PLINTH, (y1 - y0) * M)), keep(new THREE.MeshStandardMaterial({ color: wall, roughness: 1 })));
  plinth.position.set(((x0 + x1) / 2) * M, ground - PLINTH / 2 - 0.002, ((y0 + y1) / 2) * M);
  plinth.receiveShadow = plinth.castShadow = true;
  const shadowGround = new THREE.Mesh(keep(new THREE.PlaneGeometry(radius * 40, radius * 40)).rotateX(-Math.PI / 2), keep(new THREE.ShadowMaterial({ color: color('--canvas-shadow'), opacity: 0.35 })));
  shadowGround.position.set(center.x, ground - PLINTH - 0.001, center.z);
  shadowGround.receiveShadow = true;
  scene.add(plinth, shadowGround);

  // The 3D view's light: sky light, and a sun from the south-west casting soft shadows
  scene.add(new THREE.HemisphereLight(color('--canvas-skylight'), wall, 2.4));
  const sun = new THREE.DirectionalLight(color('--canvas-sun'), 1.4);
  sun.position.set(center.x - radius * 1.2, center.y + radius * 2, center.z + radius * 0.9);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = ((radius * 2.8) / 2048) * 2;
  Object.assign(sun.shadow.camera, { left: -radius * 1.4, right: radius * 1.4, top: radius * 1.4, bottom: -radius * 1.4, near: 0.5, far: radius * 6 });
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.05, radius * 40);
  const pose = framed(box, W / H, BIRD);
  camera.position.copy(pose.pos);
  camera.lookAt(pose.target);

  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, W, H);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/jpeg', 0.85);
  disposables.forEach(d => d.dispose());
  sun.shadow.map?.dispose();
  return url;
}
