/**
 * SPIKE: recipes written as JSONata scripts (https://jsonata.org) instead of part lists. A script sees the object's size ($w, $d,
 * $h) and its parameters ($name: defaults declared by the recipe, overridden per object) as variables, calls the helpers below
 * to make parts, and returns them (nested arrays are flattened). The parts are plain numbers in the existing part format, so the
 * existing checks, 3D builder and plan symbols apply unchanged. Guardrails stop runaway scripts (stack depth, time, sequence
 * length); a script can only call the helpers bound here.
 */
import jsonata from 'jsonata';
import { hashRandom } from './expr.js';
import { buildRecipe, RecipeError, recipeSchema, type BuiltPart, type Recipe, type RecipePart, type RecipeSize } from './recipe.js';

export interface ScriptRecipe {
  /** Parameters and their defaults; null means "worked out by the script from the size" */
  params?: Record<string, string | number | boolean | null>;
  /** What each parameter does, for people and the agent */
  docs?: Record<string, string>;
  seed?: number;
  /** A JSONata expression returning parts */
  script: string;
}

export const SCRIPT_LIMITS = { stack: 300, timeout: 250, sequence: 20000, parts: 3000 };

type V3 = [number, number, number];
const DEG = Math.PI / 180;

/** The helpers a script can call; each returns one part (or a list of parts) in the part format */
function helpers(seed: number) {
  return {
    box: (size: V3, at: V3, mat: string, r = 0, rot?: V3): RecipePart => ({ kind: 'box', mat, size, at, r, ...(rot ? { rot } : {}) }) as RecipePart,
    /** A box standing on y0 instead of centred */
    block: (size: V3, x: number, y0: number, z: number, mat: string, r = 0): RecipePart => ({ kind: 'box', mat, size, at: [x, y0 + size[1] / 2, z], r }) as RecipePart,
    cylinder: (r: number, h: number, at: V3, mat: string, o: { r2?: number; axis?: 'x' | 'y' | 'z'; seg?: number } = {}): RecipePart => ({ kind: 'cylinder', mat, r, h, at, ...o }) as RecipePart,
    sphere: (r: number, at: V3, mat: string, scale?: V3): RecipePart => ({ kind: 'sphere', mat, r, at, ...(scale ? { scale } : {}) }) as RecipePart,
    lathe: (profile: [number, number][], at: V3, mat: string): RecipePart => ({ kind: 'lathe', mat, profile, at }) as RecipePart,
    rod: (from: V3, to: V3, r: number, mat: string): RecipePart => ({ kind: 'rod', mat, from, to, r }) as RecipePart,
    ring: (R: number, r: number, at: V3, mat: string, axis: 'y' | 'z' = 'y'): RecipePart => ({ kind: 'ring', mat, R, r, at, axis }) as RecipePart,
    /** Four legs set in from the corners of w × d; round legs taper slightly to the floor */
    fourLegs: (w: number, d: number, inset: number, h: number, r: number, mat: string, square = false): RecipePart[] =>
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
        const at: V3 = [sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)];
        return (square ? { kind: 'box', mat, size: [2 * r, h, 2 * r], at, r: r * 0.3 } : { kind: 'cylinder', mat, r: r * 0.8, r2: r, h, at, seg: 12 }) as RecipePart;
      }),
    /** Leave this part out of the plan symbol */
    noplan: (p: RecipePart | RecipePart[]) => (Array.isArray(p) ? p.map(x => ({ ...x, plan: false })) : { ...p, plan: false }),
    sin: (a: number) => Math.sin(a * DEG),
    cos: (a: number) => Math.cos(a * DEG),
    atan2: (y: number, x: number) => Math.atan2(y, x) / DEG,
    hypot: (...a: number[]) => Math.hypot(...a),
    clamp: (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi),
    rnd: (k: number) => hashRandom(seed, k),
  };
}

const compiled = new Map<string, ReturnType<typeof jsonata>>();

const flatten = (v: unknown): unknown[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v.flatMap(flatten) : [v]);

/** Run a script at a size with parameters: the parts as a static part-list recipe (numbers only) */
export async function runScript(r: ScriptRecipe, size: RecipeSize, params: Record<string, unknown> = {}): Promise<Recipe> {
  let expr = compiled.get(r.script);
  if (!expr) {
    try {
      expr = jsonata(r.script, { stack: SCRIPT_LIMITS.stack, timeout: SCRIPT_LIMITS.timeout, sequence: SCRIPT_LIMITS.sequence } as never);
    } catch (e) {
      throw new RecipeError(`script: ${(e as Error).message}`);
    }
    compiled.set(r.script, expr);
  }
  // Size and parameters are variables ($w, $fabric…), so they read the same inside mapping steps, where bare names would
  // refer to the current item
  const fns = helpers(r.seed ?? 1);
  const values = { ...size, ...r.params, ...params };
  const clash = Object.keys(values).find(k => k in fns);
  if (clash) throw new RecipeError(`parameter "${clash}" has the name of a helper`);
  let out: unknown;
  try {
    out = await expr.evaluate(values, { ...values, ...fns });
  } catch (e) {
    const err = e as { code?: string; message: string; position?: number };
    throw new RecipeError(`script${err.code ? ` ${err.code}` : ''}${err.position !== undefined ? ` at ${err.position}` : ''}: ${err.message}`);
  }
  const parts = flatten(out) as RecipePart[];
  if (parts.length > SCRIPT_LIMITS.parts) throw new RecipeError(`script made ${parts.length} parts (at most ${SCRIPT_LIMITS.parts})`);
  return { parts };
}

/** Built parts of a script at a size (checked like any recipe) */
export async function buildScript(r: ScriptRecipe, size: RecipeSize, params: Record<string, unknown> = {}): Promise<BuiltPart[]> {
  return buildRecipe(await runScript(r, size, params), size);
}

/** Problems at the size, half and twice it, like checkRecipe */
export async function checkScript(r: ScriptRecipe, size: RecipeSize, params: Record<string, unknown> = {}): Promise<string[]> {
  const out: string[] = [];
  for (const [label, k] of [['at its size', 1], ['at half its size', 0.5], ['at twice its size', 2]] as const) {
    const s = { ...size, w: size.w * k, d: size.d * k, h: size.h * k };
    try {
      const parsed = recipeSchema.safeParse(await runScript(r, s, params));
      if (!parsed.success) out.push(...parsed.error.issues.slice(0, 5).map(i => `${label}: ${i.path.join('.')}: ${i.message}`));
      else buildRecipe(parsed.data, s);
    } catch (e) {
      out.push(`${label}: ${(e as Error).message}`);
    }
  }
  return out;
}
