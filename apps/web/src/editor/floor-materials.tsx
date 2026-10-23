/**
 * Floor materials drawn as patterns: wood planks, tiles, terrazzo, gravel… One definition per material key of the catalog
 * (library.materials), used by the plan (an SVG pattern fill) and by the 3D floors (the same tile rasterized as a texture), so
 * the house growing out of the plan keeps its floors. Sizes in millimetres; colors from the theme (--floor-*).
 */
import type { ReactElement } from 'react';

export interface FloorPattern {
  /** Size of one repeat */
  w: number;
  h: number;
  /** The repeat's content, drawn in a w × h box */
  tile: ReactElement;
}

/** A pseudo-random sequence, so speckles land in the same places every time */
function* scatter(seed: number) {
  let s = seed;
  for (;;) {
    s = (s * 16807) % 2147483647;
    yield (s - 1) / 2147483646;
  }
}

const SEAM = 10;

/** Boards in a running bond: rows `width` wide, boards `length` long, every other row shifted half a board */
function planks(base: string, seam: string, width: number, length: number): FloorPattern {
  return {
    w: length, h: width * 2,
    tile: (
      <>
        <rect width={length} height={width * 2} fill={`var(${base})`} />
        <rect y={width} width={length} height={width} fill={`var(${seam})`} fillOpacity={0.18} />
        <path d={`M0 0H${length}M0 ${width}H${length}M0 0V${width}M${length / 2} ${width}V${width * 2}`} stroke={`var(${seam})`} strokeWidth={SEAM} />
      </>
    ),
  };
}

/** Square tiles with grout lines */
function tiles(base: string, grout: string, size: number): FloorPattern {
  return {
    w: size, h: size,
    tile: (
      <>
        <rect width={size} height={size} fill={`var(${base})`} />
        <path d={`M0 0H${size}M0 0V${size}`} stroke={`var(${grout})`} strokeWidth={SEAM * 1.5} />
      </>
    ),
  };
}

/** Bricks in a running bond, `w` × `h` each */
function bricks(base: string, joint: string, w: number, h: number): FloorPattern {
  return {
    w: w, h: h * 2,
    tile: (
      <>
        <rect width={w} height={h * 2} fill={`var(${base})`} />
        <path d={`M0 0H${w}M0 ${h}H${w}M0 0V${h}M${w / 2} ${h}V${h * 2}`} stroke={`var(${joint})`} strokeWidth={SEAM} />
      </>
    ),
  };
}

/** A plain surface with speckles (terrazzo chips, gravel stones, cement mottling) */
function speckled(base: string, dots: string[], size: number, count: number, radius: [number, number], seed: number): FloorPattern {
  const r = scatter(seed);
  const next = () => r.next().value as number;
  return {
    w: size, h: size,
    tile: (
      <>
        <rect width={size} height={size} fill={`var(${base})`} />
        {Array.from({ length: count }, (_, i) => (
          <circle key={i} cx={next() * size} cy={next() * size} r={radius[0] + next() * (radius[1] - radius[0])} fill={`var(${dots[i % dots.length]})`} />
        ))}
      </>
    ),
  };
}

export const FLOOR_PATTERNS: Record<string, FloorPattern> = {
  oak: planks('--floor-oak', '--floor-oak-seam', 150, 1200),
  wood: planks('--floor-teak', '--floor-teak-seam', 150, 1200),
  tile: tiles('--floor-tile', '--floor-tile-grout', 800),
  antislip: tiles('--floor-antislip', '--floor-antislip-grout', 300),
  redtile: tiles('--floor-redtile', '--floor-redtile-grout', 300),
  paver: bricks('--floor-paver', '--floor-paver-joint', 200, 100),
  terrazzo: speckled('--floor-terrazzo', ['--floor-terrazzo-chip', '--floor-terrazzo-chip-2'], 800, 140, [6, 16], 7),
  gravel: speckled('--floor-gravel', ['--floor-gravel-stone', '--floor-gravel-stone-2'], 600, 260, [10, 24], 11),
  cement: speckled('--floor-cement', ['--floor-cement-mottle'], 2000, 18, [120, 320], 3),
};

/** The plan's fill for a floor material: its pattern, or plain white for one without */
export const floorFill = (material: string) => (FLOOR_PATTERNS[material] ? `url(#floor-${material})` : 'var(--card)');

/** Pattern definitions for every floor material, inside the plan's <defs> */
export function FloorPatternDefs() {
  return (
    <>
      {Object.entries(FLOOR_PATTERNS).map(([k, p]) => (
        <pattern key={k} id={`floor-${k}`} width={p.w} height={p.h} patternUnits="userSpaceOnUse">{p.tile}</pattern>
      ))}
    </>
  );
}
