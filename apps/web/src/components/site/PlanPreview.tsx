/** 只读的平面缩略图（介绍页、方案列表） */
import type { Project } from '@plinth/core';
import { useMemo } from 'react';
import { levelShapes } from '@/editor/plan-geometry';

export function PlanPreview({ project, level, className }: { project: Project; level?: string; className?: string }) {
  const lv = level ?? project.levels.find(l => !l.roof)?.id ?? 'L1';
  const s = useMemo(() => levelShapes(project, lv), [project, lv]);
  const [x0, y0, x1, y1] = s.bounds;
  const pad = 600;
  const font = Math.max(220, (x1 - x0) / 40);
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} className={className} role="img" aria-label={`${project.name}平面图`}>
      {s.spaces.map(({ s: sp, d }) => <path key={sp.id} d={d} fill={sp.kind === 'indoor' ? 'var(--plan-indoor)' : 'var(--plan-semi)'} />)}
      <path d={s.light} fill="var(--plan-light)" />
      <path d={s.solid} fill="var(--plan-partition)" />
      <path d={s.bearing} fill="var(--plan-wall)" />
      {s.openings.map(o => o.lines.map((l, i) => <polyline key={o.id + i} points={l.map(p => p.join(',')).join(' ')} fill="none" stroke="var(--plan-line)" strokeWidth={30} />))}
      {s.spaces.filter(x => x.s.kind === 'indoor' && x.area > 4).map(({ s: sp, label, area }) => (
        <g key={sp.id} textAnchor="middle" fontFamily="var(--font-sans)">
          <text x={label[0]} y={label[1]} fontSize={font} fill="var(--plan-text)">{sp.name}</text>
          <text x={label[0]} y={label[1] + font * 1.15} fontSize={font * 0.8} fill="var(--plan-muted)" fontFamily="var(--font-mono)">{area.toFixed(1)} m²</text>
        </g>
      ))}
    </svg>
  );
}
