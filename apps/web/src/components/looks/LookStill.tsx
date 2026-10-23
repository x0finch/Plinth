/** A still of a look from three sides (see editor/model3d/look-preview.ts), drawn on demand */
import type { Recipe } from '@plinth/core';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { renderLookPreview } from '@/editor/model3d/look-preview';
import { cn } from '@/lib/utils';

/** `single`: only the three-quarter view, in a 4:3 image */
export function LookStill({ recipe, size, alt, className, single }: { recipe: Recipe; size: { w: number; d: number; h: number }; alt: string; className?: string; single?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const key = JSON.stringify([recipe, size, single]);
  useEffect(() => {
    let live = true;
    setSrc(null);
    renderLookPreview(recipe, size, single ? { width: 400, height: 300, single } : { width: 480, height: 160 }).then(u => live && setSrc(u)).catch(() => {});
    return () => void (live = false);
  }, [key]);
  const aspect = single ? 'aspect-[4/3]' : 'aspect-[3/1]';
  return src ? <img src={src} alt={alt} className={cn(aspect, 'w-full rounded-md border object-cover', className)} /> : <Skeleton className={cn(aspect, 'w-full', className)} />;
}
