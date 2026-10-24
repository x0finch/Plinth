/**
 * A still of a look, for the chat and the agent's self-check: the recipe built at a size and drawn from three sides in one
 * image (three-quarter view, front, top), in the canvas's light theme and the default model style's light.
 */
import { buildRecipe, type Recipe } from '@plinth/core';
import * as THREE from 'three';
import { lightDocument } from '@/canvas/CanvasFrame';
import { themeColor } from '@/lib/theme';
import { LOOK_MATERIALS, LOOK_TOKENS, partsGeometry } from './looks';

const M = 0.001;

/** `single`: only the three-quarter view, filling the image */
export async function renderLookPreview(recipe: Recipe, size: { w: number; d: number; h: number }, opts: { width?: number; height?: number; single?: boolean; params?: Record<string, unknown> } = {}): Promise<string> {
  const W = opts.width ?? 960, H = opts.height ?? 320, doc = await lightDocument();
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  const color = (t: string) => new THREE.Color(themeColor(t, doc));
  scene.background = color('--canvas-backdrop');
  scene.add(new THREE.HemisphereLight(color('--canvas-skylight'), color('--card'), 2.4));
  const sun = new THREE.DirectionalLight(color('--canvas-sun'), 1.4);
  sun.position.set(1.5, 3, 2);
  scene.add(sun);
  const parts = partsGeometry((await buildRecipe(recipe, size, opts.params).catch(() => ({ parts: [] }))).parts);
  const materials: THREE.Material[] = [];
  for (const [mat, g] of parts) {
    const { roughness, metalness, opacity = 1 } = LOOK_MATERIALS[mat];
    const material = new THREE.MeshStandardMaterial({ color: color(LOOK_TOKENS[mat]), roughness, metalness, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
    materials.push(material);
    scene.add(new THREE.Mesh(g, material));
  }
  // The floor it stands on: a thin outline of its footprint
  const floor = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(size.w * M, size.d * M).rotateX(-Math.PI / 2)), new THREE.LineBasicMaterial({ color: color('--muted-foreground') }));
  scene.add(floor);

  const box = new THREE.Box3(new THREE.Vector3(-size.w / 2, 0, -size.d / 2).multiplyScalar(M), new THREE.Vector3(size.w / 2, size.h, size.d / 2).multiplyScalar(M));
  for (const [, g] of parts) {
    g.computeBoundingBox();
    box.union(g.boundingBox!);
  }
  const center = box.getCenter(new THREE.Vector3()), radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
  const vw = opts.single ? W : W / 3, aspect = vw / H;
  const ortho = (dir: THREE.Vector3, up: THREE.Vector3) => {
    const r = radius * 1.1, cam = new THREE.OrthographicCamera(-r * aspect, r * aspect, r, -r, 0.01, radius * 10);
    cam.up.copy(up);
    cam.position.copy(center).addScaledVector(dir, radius * 4);
    cam.lookAt(center);
    return cam;
  };
  const persp = new THREE.PerspectiveCamera(30, aspect, 0.01, radius * 20);
  persp.position.copy(center).addScaledVector(new THREE.Vector3(1, 0.8, 1.4).normalize(), radius / Math.sin((15 * Math.PI) / 180) * 1.05);
  persp.lookAt(center);
  const views: THREE.Camera[] = opts.single ? [persp] : [persp, ortho(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)), ortho(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1))];
  views.forEach((cam, i) => {
    renderer.setViewport(i * vw, 0, vw, H);
    renderer.setScissor(i * vw, 0, vw, H);
    renderer.render(scene, cam);
  });
  const url = canvas.toDataURL('image/png');
  for (const [, g] of parts) g.dispose();
  materials.forEach(m => m.dispose());
  floor.geometry.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return url;
}
