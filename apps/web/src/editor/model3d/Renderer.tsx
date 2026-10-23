/**
 * Draws the 3D view through a post-processing chain: the scene, then ambient occlusion (soft darkening where surfaces meet, which
 * gives a white model its depth), then the output conversion. Phones and other coarse-pointer devices skip the occlusion pass.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

export type Quality = 'high' | 'low';

/** Touch-first devices (phones, tablets) get the light setup: no occlusion pass, smaller shadow and floor-drawing textures */
export function detectQuality(win: Window): Quality {
  return win.matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
}

/** Takes over rendering from react-three-fiber; `draw` renders one frame the same way, for screenshots */
export function Renderer({ quality, draw }: { quality: Quality; draw: React.RefObject<(() => void) | null> }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    if (quality === 'high') {
      const ao = new GTAOPass(scene, camera, size.width, size.height);
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
