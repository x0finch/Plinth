/**
 * Draws the 3D view through a post-processing chain: the scene, then ambient occlusion (soft darkening where surfaces meet, which
 * gives a white model its depth), then the output conversion. Only low-end phones skip the occlusion pass.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

export type Quality = 'high' | 'low';

/** Older mobile GPUs: Mali-400/450 and the Mali-T series, Adreno 500 and below, PowerVR SGX */
const WEAK_GPU = /Mali-(4\d\d|T\d+)|Adreno \(TM\) [1-5]\d\d\b|PowerVR SGX/i;

/** Touch-first devices; only these are ever downgraded */
export const isTouchDevice = (win: Window) => win.matchMedia('(pointer: coarse)').matches;

/**
 * Low-end phones get the light setup (no occlusion pass, smaller shadow and floor-drawing textures): a touch device with 2 GB of
 * memory or less, an Android device with 4 cores or fewer, or an older mobile GPU. Everything else, recent iPhones included, gets
 * the full look; a phone missed here still drops to the light setup if it can't keep up (see Model3D).
 */
export function detectQuality(win: Window, gl: WebGLRenderingContext | WebGL2RenderingContext): Quality {
  if (!isTouchDevice(win)) return 'high';
  const nav = win.navigator as Navigator & { deviceMemory?: number };
  const android = /Android/i.test(nav.userAgent);
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  const weak = (nav.deviceMemory !== undefined && nav.deviceMemory < 4) || (android && nav.hardwareConcurrency <= 4) || WEAK_GPU.test(gpu);
  return weak ? 'low' : 'high';
}

/** Takes over rendering from react-three-fiber; `draw` renders one frame the same way, for screenshots */
export function Renderer({ quality, draw }: { quality: Quality; draw: React.RefObject<(() => void) | null> }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    if (quality === 'high') {
      const ao = new GTAOPass(scene, camera, size.width, size.height);
      // The pass hides points and lines while it samples the scene's depth; also hide flat overlays marked noAO (the floor
      // drawings), which would otherwise occlude like solid sheets floating over the ground
      const hide = (ao as unknown as { _overrideVisibility(): void; _visibilityCache: THREE.Object3D[] });
      const base = hide._overrideVisibility.bind(ao);
      hide._overrideVisibility = () => {
        base();
        scene.traverse(o => {
          if (o.userData.noAO && o.visible) {
            o.visible = false;
            hide._visibilityCache.push(o);
          }
        });
      };
      ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1 });
      ao.blendIntensity = 0.9;
      c.addPass(ao);
    }
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera, quality]);
  useEffect(() => () => composer.dispose(), [composer]);
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, size, gl]);

  draw.current = () => composer.render();
  // A positive priority takes over rendering from react-three-fiber
  useFrame(() => composer.render(), 1);
  return null;
}
