/**
 * The plan's drawing, shared by the plan view and the 3D floors (so 3D grows out of exactly the plan): paper (the site's white
 * plinth, room fills), ink (walls, furniture, doors and windows) and labels. Drawn like the white model seen from above: a gray
 * backdrop, soft lavender shadows, gray walls, light-blue glass. Coordinates in millimetres. Interaction (picking) is optional.
 */
import type { Project } from '@plinth/core';
import type { LevelShapes } from './plan-geometry';

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** White like the model: rooms, yards and terraces alike (the walls tell them apart), so the plinth reads as one white board; covered outside areas a faint gray */
const SPACE_FILL: Record<string, string> = {
  indoor: 'var(--card)', 'semi-outdoor': 'var(--muted)', outdoor: 'var(--card)', 'roof-terrace': 'var(--card)', void: 'url(#hatch)',
};

/** Glazed openings show their glass; doors and plain openings are gaps in the wall */
const GLAZED = new Set(['window', 'sliding-door']);

/**
 * Stroke props for a line `width` screen pixels wide (dashes too). The plan keeps them that wide at any zoom (non-scaling strokes);
 * a 3D floor converts them to millimetres at the scale the plan is shown, so both draw the same line.
 */
export type Line = (width: number, dash?: number[]) => { strokeWidth: number; strokeDasharray?: string; vectorEffect?: 'non-scaling-stroke' };

export const screenLine: Line = (width, dash) => ({ strokeWidth: width, strokeDasharray: dash?.join(' '), vectorEffect: 'non-scaling-stroke' });
export const scaledLine = (mmPerPx: number): Line => (width, dash) => ({ strokeWidth: width * mmPerPx, strokeDasharray: dash?.map(d => d * mmPerPx).join(' ') });

/** Label size for a level, in millimetres */
export const labelSize = ([x0, , x1]: LevelShapes['bounds']) => Math.max(220, Math.min(420, (x1 - x0) / 45));

type Pick = (id: string) => (e: React.MouseEvent) => void;
const hit = (pick: Pick | undefined, id: string) => (pick ? { onClick: pick(id), className: 'plan-hit cursor-pointer', 'data-id': id } : {});

export function PlanDefs() {
  return (
    <defs>
      {/* Soft shadows, as if lit from the upper left like the 3D view; sizes in millimetres, so they scale with the drawing */}
      <filter id="plan-plinth-shadow" x="-10%" y="-10%" width="125%" height="125%">
        <feDropShadow dx="150" dy="220" stdDeviation="260" floodColor="var(--canvas-shadow)" floodOpacity="0.5" />
      </filter>
      <filter id="plan-wall-shadow" x="-5%" y="-5%" width="115%" height="115%">
        <feDropShadow dx="45" dy="70" stdDeviation="55" floodColor="var(--canvas-shadow)" floodOpacity="0.45" />
      </filter>
      <pattern id="hatch" width="200" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="200" stroke="var(--muted-foreground)" strokeWidth="20" />
      </pattern>
      <pattern id="glassblock" width="100" height="100" patternUnits="userSpaceOnUse">
        <rect width="100" height="100" fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth="12" />
      </pattern>
    </defs>
  );
}

/** The site's white plinth (on the lowest floor only: upper floors stand above it) and the room fills */
export function PlanPaper({ project, level, shapes, pick }: { project: Project; level: string; shapes: LevelShapes; pick?: Pick }) {
  const lowest = Math.min(...project.levels.map(l => l.elevation));
  const ground = project.levels.find(l => l.id === level)?.elevation === lowest;
  return (
    <>
      {ground && <polygon points={pts(project.site.boundary)} fill="var(--card)" filter="url(#plan-plinth-shadow)" />}
      {shapes.spaces.map(({ s, d }) => <path key={s.id} d={d} fill={SPACE_FILL[s.kind]} {...hit(pick, s.id)} />)}
    </>
  );
}

/** Walls, furniture, doors and windows; with `pick`, walls get hit areas above them */
export function PlanInk({ shapes, furniture, line, pick }: { shapes: LevelShapes; furniture: boolean; line: Line; pick?: Pick }) {
  return (
    <>
      {furniture && shapes.furniture.map(({ f, d }) => (
        <path key={f.id} d={d} fill="var(--card)" fillOpacity={0.85} stroke="var(--muted-foreground)" {...line(0.8)} {...hit(pick, f.id)} />
      ))}
      {/* Walls: load-bearing dark gray, partitions lighter, fences and parapets lightest; each casts a soft shadow */}
      <g filter="url(#plan-wall-shadow)" pointerEvents="none">
        <path d={shapes.light} fill="var(--chart-4)" stroke="var(--chart-3)" {...line(0.8)} />
        <path d={shapes.solid} fill="var(--chart-3)" />
        <path d={shapes.bearing} fill="var(--chart-5)" />
      </g>
      {shapes.railings.map(({ w, d }) => (
        <path key={w.id} d={d} fill="none" stroke="var(--foreground)" {...line(1.5)} pointerEvents="none" />
      ))}
      {pick && shapes.walls.map(({ w, d }) => <path key={w.id} d={d} fill="transparent" fillOpacity={0} {...hit(pick, w.id)} />)}
      {shapes.openings.map(o => (
        <g key={o.id} {...(pick ? { onClick: pick(o.id), className: 'cursor-pointer', 'data-id': o.id } : {})}>
          <polygon points={pts(o.outline)} className={pick ? 'plan-hit' : undefined}
            {...(o.glassBlock ? { fill: 'url(#glassblock)' } : GLAZED.has(o.kind) ? { fill: 'var(--canvas-glass)', stroke: 'var(--foreground)', ...line(1) } : { fill: 'transparent' })} />
          {o.lines.map((l, i) => <polyline key={i} points={pts(l)} fill="none" stroke="var(--foreground)" {...line(1, o.dashed ? [6, 4] : undefined)} />)}
          {o.arcs.map((a, i) => <path key={i} d={a} fill="none" stroke="var(--muted-foreground)" {...line(1, [4, 3])} />)}
        </g>
      ))}
    </>
  );
}

/** Room name and usable area; clicking a name also selects its room (hard to hit empty floor full of furniture, especially on phones) */
export function PlanLabels({ shapes, pick }: { shapes: LevelShapes; pick?: Pick }) {
  const font = labelSize(shapes.bounds);
  return (
    <>
      {shapes.spaces.map(({ s, label, area }) => (
        <g key={s.id} textAnchor="middle" fontFamily="var(--font-sans)" {...(pick ? { onClick: pick(s.id), className: 'cursor-pointer' } : {})}>
          <text x={label[0]} y={label[1]} fontSize={font} fill="var(--foreground)" fontWeight={500}
            paintOrder="stroke" stroke="var(--background)" strokeWidth={font / 6}>{s.name}</text>
          {s.kind !== 'void' && (
            <text x={label[0]} y={label[1] + font * 1.15} fontSize={font * 0.8} fill="var(--muted-foreground)" fontFamily="var(--font-mono)"
              paintOrder="stroke" stroke="var(--background)" strokeWidth={font / 6}>{area.toFixed(1)} m²</text>
          )}
        </g>
      ))}
    </>
  );
}
