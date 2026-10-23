/** A still of a look from three sides (see editor/model3d/look-preview.ts), drawn on demand */
import type { Recipe } from '@plinth/core';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { renderLookPreview } from '@/editor/model3d/look-preview';
import { cn } from '@/lib/utils';

export function LookStill({ recipe, size, alt, className }: { recipe: Recipe; size: { w: number; d: number; h: number }; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const key = JSON.stringify([recipe, size]);
  useEffect(() => {
    let live = true;
    setSrc(null);
    renderLookPreview(recipe, size, { width: 480, height: 160 }).then(u => live && setSrc(u)).catch(() => {});
    return () => void (live = false);
  }, [key]);
  return src ? <img src={src} alt={alt} className={cn('aspect-[3/1] w-full rounded-md border object-cover', className)} /> : <Skeleton className={cn('aspect-[3/1] w-full', className)} />;
}
