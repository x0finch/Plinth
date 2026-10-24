/**
 * A look you can turn around: the same stage as its stills (editor/model3d/look-stage.ts), starting from the same view, with
 * drag to orbit, pinch or scroll to zoom, and a button back to the starting view. It redraws as its parameters and size change.
 * Drawn in the canvas's light theme whatever the website's theme, like the stills.
 */
import type { Recipe } from '@plinth/core';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { RotateCcwIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { lightDocument } from '@/canvas/CanvasFrame';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cameraPosition, FOV, lookBounds, stageGround, stageSun } from '@/editor/model3d/look-stage';
import { lookMaterial, partsGeometry, useBuild } from '@/editor/model3d/looks';
import { m } from '@/lib/i18n';
import { useThemeColors } from '@/lib/theme';

type Size = { w: number; d: number; h: number };

export function LookViewer({ recipe, size, params, alt }: { recipe: Recipe; size: Size; params?: Record<string, unknown>; alt: string }) {
  const [doc, setDoc] = useState<Document | null>(null);
  useEffect(() => void lightDocument().then(setDoc), []);
  const built = useBuild(recipe, size, params);
  // A new starting view whenever the look's extent changes; the button goes back to it
  const [view, setView] = useState(0);
  if (!doc || !built) return <Skeleton className="aspect-[4/3] w-full" />;
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border" role="img" aria-label={alt}>
      <Canvas shadows="soft" frameloop="demand" dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.NoToneMapping }} camera={{ fov: FOV, near: 0.01, far: 200 }}>
        <Stage doc={doc} recipe={recipe} parts={built.parts} size={size} view={view} />
      </Canvas>
      <Button size="icon-sm" variant="outline" className="absolute right-2 bottom-2 bg-background" aria-label={m.look_viewer_reset()} onClick={() => setView(v => v + 1)}>
        <RotateCcwIcon />
      </Button>
    </div>
  );
}

function Stage({ doc, recipe, parts, size, view }: { doc: Document; recipe: Recipe; parts: Parameters<typeof partsGeometry>[0]; size: Size; view: number }) {
  const c = useThemeColors({ backdrop: '--canvas-backdrop', sky: '--canvas-skylight', ground: '--card', sun: '--canvas-sun' }, doc);
  const camera = useThree(s => s.camera);
  const invalidate = useThree(s => s.invalidate);
  const geometry = useMemo(() => partsGeometry(parts), [parts]);
  useEffect(() => () => geometry.forEach(([, g]) => g.dispose()), [geometry]);
  const { center, radius } = useMemo(() => lookBounds(geometry.map(([, g]) => g), size), [geometry, size]);
  const sun = useMemo(() => stageSun(c.sun, center, radius), [c.sun, center, radius]);
  const ground = useMemo(() => stageGround(radius), [radius]);
  useEffect(() => () => { ground.geometry.dispose(); (ground.material as THREE.Material).dispose(); sun.shadow.map?.dispose(); }, [ground, sun]);
  // The starting view: when the look's extent changes, or on reset
  const key = `${radius.toFixed(3)}:${view}`;
  useEffect(() => {
    camera.position.copy(cameraPosition(center, radius));
    camera.lookAt(center);
    invalidate();
  }, [key]);
  return (
    <>
      <color attach="background" args={[c.backdrop]} />
      <hemisphereLight args={[c.sky, c.ground, 2.4]} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      <primitive object={ground} />
      {geometry.map(([mat, g]) => {
        const { color, roughness, metalness, opacity } = lookMaterial(mat, recipe);
        return (
          <mesh key={mat} geometry={g} castShadow={opacity === 1}>
            <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
          </mesh>
        );
      })}
      <OrbitControls key={key} makeDefault target={center} enableDamping dampingFactor={0.1} minDistance={radius * 0.6} maxDistance={radius * 12} maxPolarAngle={Math.PI / 2 - 0.02} />
    </>
  );
}
