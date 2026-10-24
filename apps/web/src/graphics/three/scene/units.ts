/** Units and sizes shared by everything drawn in 3D. Data is in millimetres, scenes in metres. */
import type { Space } from '@plinth/core';

/** Millimetres to metres */
export const M = 0.001;
/** Height of the white plinth the site stands on, in metres */
export const PLINTH = 0.3;
/** Size an element's look is built at to read its materials and whether it adds parts (both independent of size) */
export const ELEMENT_SIZE = { w: 2000, d: 2000, h: 3000 };

/** Whether a space has a floor slab: voids and openings in the slab have none */
export const hasSlab = (s: Space) => s.kind !== 'void' && !s.slabOpening;

/**
 * A space's floor slab in millimetres: its top and thickness. Outdoor paving is thin, and on the ground floor it sits just above
 * the site's ground.
 */
export function slabLevel(s: Space, elevation: number, groundLevel: number) {
  const outdoor = s.kind === 'outdoor';
  return { y: outdoor && elevation === 0 ? groundLevel + 20 : elevation, thickness: outdoor ? 20 : 120 };
}
