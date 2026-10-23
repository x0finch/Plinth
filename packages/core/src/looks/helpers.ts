/** Shorthands for writing the default recipes; what they return is plain recipe data */
import type { Expr, RecipeMaterial, RecipePart } from '../recipe.js';

/** Both sides: the parts are repeated with `s` = -1 and 1 */
export const pair = (...parts: RecipePart[]): RecipePart => ({ kind: 'repeat', count: 2, let: { s: 'i * 2 - 1' }, parts });

/** Four legs set in from the corners of a footprint (default the object's); round legs taper slightly to the floor */
export function legs(mat: RecipeMaterial, inset: Expr, h: Expr, r: Expr, opts: { square?: boolean; w?: Expr; d?: Expr } = {}): RecipePart {
  const w = opts.w ?? 'w', d = opts.d ?? 'd';
  const at: [Expr, Expr, Expr] = [`sx * ((${w}) / 2 - (${inset}))`, `(${h}) / 2`, `sz * ((${d}) / 2 - (${inset}))`];
  return {
    kind: 'repeat', count: 4, let: { sx: 'i % 2 * 2 - 1', sz: 'floor(i / 2) * 2 - 1' },
    parts: [opts.square
      ? { kind: 'box', mat, size: [`(${r}) * 2`, h, `(${r}) * 2`], at, r: `(${r}) * 0.3` }
      : { kind: 'cylinder', mat, r: `(${r}) * 0.8`, r2: r, h, at, seg: 12 }],
  };
}

/** A box standing on y0 (instead of centred) */
export const block = (mat: RecipeMaterial, size: [Expr, Expr, Expr], x: Expr, y0: Expr, z: Expr, r: Expr = 0, extra: Partial<{ rot: [Expr, Expr, Expr]; plan: boolean }> = {}): RecipePart =>
  ({ kind: 'box', mat, size, at: [x, `(${y0}) + (${size[1]}) / 2`, z], r, ...extra });

/** A soft, slightly flattened clump of leaves */
export const clump = (mat: RecipeMaterial, r: Expr, at: [Expr, Expr, Expr]): RecipePart => ({ kind: 'sphere', mat, r, at, scale: [1, 0.85, 1] });

/** One of several materials, picked by an expression's value 0, 1, 2… */
export const pick = (which: Expr, mats: RecipeMaterial[], part: (mat: RecipeMaterial) => RecipePart): RecipePart[] =>
  mats.map((m, k) => ({ kind: 'if', when: `(${which}) == ${k}`, parts: [part(m)] }));
