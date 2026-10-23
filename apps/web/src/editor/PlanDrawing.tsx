/**
 * The plan's drawing, shared by the plan view and the 3D floors (so 3D grows out of exactly the plan): paper (site boundary, room
 * fills), ink (walls, furniture, doors and windows) and labels. Coordinates in millimetres. Interaction (picking) is optional.
 */
import type { Project } from '@plinth/core';
import type { LevelShapes } from './plan-geometry';

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** Indoor rooms are white; outside areas share the 3D view's ground color, covered ones lighter */
const SPACE_FILL: Record<string, string> = {
  indoor: 'var(--card)', 'semi-outdoor': 'var(--secondary)', outdoor: 'var(--canvas-ground)', 'roof-terrace': 'var(--canvas-ground)', void: 'url(#hatch)',
};

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
      <pattern id="hatch" width="200" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="200" stroke="var(--muted-foreground)" strokeWidth="20" />
      </pattern>
      <pattern id="glassblock" width="100" height="100" patternUnits="userSpaceOnUse">
        <rect width="100" height="100" fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth="12" />
      </pattern>
    </defs>
  );
}

/** Site boundary and room fills */
export function PlanPaper({ project, shapes, line, pick }: { project: Project; shapes: LevelShapes; line: Line; pick?: Pick }) {
  return (
    <>
      <polygon points={pts(project.site.boundary)} fill="none" stroke="var(--muted-foreground)" {...line(1, [8, 6])} />
      {shapes.spaces.map(({ s, d }) => <path key={s.id} d={d} fill={SPACE_FILL[s.kind]} {...hit(pick, s.id)} />)}
    </>
  );
}

/** Walls, furniture, doors and windows; with `pick`, walls get hit areas above them */
export function PlanInk({ shapes, furniture, line, pick }: { shapes: LevelShapes; furniture: boolean; line: Line; pick?: Pick }) {
  return (
    <>
      {furniture && shapes.furniture.map(({ f, d }) => (
        <path key={f.id} d={d} fill="var(--background)" fillOpacity={0.6} stroke="var(--muted-foreground)" {...line(1)} {...hit(pick, f.id)} />
      ))}
      <path d={shapes.light} fill="var(--muted-foreground)" fillOpacity={0.5} pointerEvents="none" />
      <path d={shapes.solid} fill="var(--muted-foreground)" pointerEvents="none" />
      <path d={shapes.bearing} fill="var(--foreground)" pointerEvents="none" />
      {shapes.railings.map(({ w, d }) => (
        <path key={w.id} d={d} fill="none" stroke="var(--foreground)" {...line(1.5)} pointerEvents="none" />
      ))}
      {pick && shapes.walls.map(({ w, d }) => <path key={w.id} d={d} fill="transparent" fillOpacity={0} {...hit(pick, w.id)} />)}
      {shapes.openings.map(o => (
        <g key={o.id} {...(pick ? { onClick: pick(o.id), className: 'cursor-pointer', 'data-id': o.id } : {})}>
          <polygon points={pts(o.outline)} fill={o.glassBlock ? 'url(#glassblock)' : 'transparent'} className={pick ? 'plan-hit' : undefined} />
          {o.lines.map((l, i) => <polyline key={i} points={pts(l)} fill="none" stroke="var(--foreground)" {...line(1.2, o.dashed ? [6, 4] : undefined)} />)}
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
