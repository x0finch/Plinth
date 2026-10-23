/** Floor plan: SVG in millimetres. Picking, zoom/pan, selection and change highlights, compare with before. */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { wallBody, wallLength, type Point } from '@plinth/core';
import { levelShapes, polyPath } from './plan-geometry';
import { useEditor } from './store';
import { m } from '@/lib/i18n';
import { standaloneSvg } from '@/lib/theme';

const pts = (p: Point[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** Render the SVG to PNG (screenshots, image export) */
export async function svgToPng(svg: SVGSVGElement, width = 2000) {
  const vb = svg.viewBox.baseVal;
  const height = Math.round((width * vb.height) / vb.width);
  const cs = svg.ownerDocument.defaultView!.getComputedStyle(svg);
  const data = standaloneSvg(svg, { width: String(width), height: String(height) });
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = cs.getPropertyValue('--background');
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

const SPACE_FILL: Record<string, string> = {
  indoor: 'var(--card)', 'semi-outdoor': 'var(--muted)', outdoor: 'var(--secondary)', 'roof-terrace': 'var(--accent)', void: 'url(#hatch)',
};

export function Plan2D({ svgRef }: { svgRef?: React.RefObject<SVGSVGElement | null> }) {
  const project = useEditor(s => s.project);
  const view = useEditor(s => s.view);
  const select = useEditor(s => s.select);
  const compare = useEditor(s => s.compare);
  const lastChange = useEditor(s => s.lastChange);
  const shapes = useMemo(() => levelShapes(project, view.level), [project, view.level]);
  // Before: draw only the original positions of walls that changed
  const before = useMemo(() => {
    if (!compare || !lastChange) return null;
    const changed = new Set(lastChange.changed);
    const walls = lastChange.before.walls.filter(w => w.level === view.level && changed.has(w.id));
    return polyPath(walls.map(wallBody));
  }, [compare, lastChange, view.level]);
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);

  const pad = 1500;
  const [x0, y0, x1, y1] = shapes.bounds;
  const vb = `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`;
  const font = Math.max(220, Math.min(420, (x1 - x0) / 45));

  const sel = new Set(view.selection);
  const localRef = useRef<SVGSVGElement>(null);
  const ref = svgRef ?? localRef;
  // Outline of every pickable object, for the selection and change highlights
  const outlines = useMemo(() => {
    const out = new Map<string, string>();
    for (const { s: sp, d } of shapes.spaces) out.set(sp.id, d);
    for (const { f, d } of shapes.furniture) out.set(f.id, d);
    for (const { w, d } of shapes.walls) out.set(w.id, d);
    for (const o of shapes.openings) out.set(o.id, `M${pts(o.outline).replaceAll(' ', 'L')}Z`);
    return out;
  }, [shapes]);
  const thin = useMemo(() => new Set([...shapes.walls.map(x => x.w.id), ...shapes.openings.map(o => o.id)]), [shapes]);
  // A new highlight restarts the fade: the token goes into the overlay keys
  const changeToken = useMemo(() => Date.now(), [view.highlight]);

  const pick = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      select(e.shiftKey || e.metaKey ? (sel.has(id) ? view.selection.filter(x => x !== id) : [...view.selection, id]) : [id]);
    },
    [select, view.selection],
  );

  // Reset zoom when switching floors, and on "fit all"
  const fitRequest = useEditor(s => s.fitRequest);
  useEffect(() => {
    zoomRef.current?.resetTransform(0);
  }, [view.level]);
  useEffect(() => {
    if (fitRequest) zoomRef.current?.resetTransform(300);
  }, [fitRequest]);

  const selWall = shapes.walls.find(x => sel.has(x.w.id));

  return (
    <TransformWrapper ref={zoomRef} minScale={0.5} maxScale={20} doubleClick={{ disabled: true }} wheel={{ step: 0.15 }}>
      <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
        <svg
          ref={ref}
          viewBox={vb}
          className="h-full w-full select-none"
          style={{ background: 'var(--background)' }}
          onClick={() => select([])}
          role="img"
          aria-label={m.editor_plan_aria({ level: project.levels.find(l => l.id === view.level)?.name ?? '' })}
        >
          <defs>
            <pattern id="hatch" width="200" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="200" stroke="var(--muted-foreground)" strokeWidth="20" />
            </pattern>
            <pattern id="glassblock" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth="12" />
            </pattern>
          </defs>

          {/* Site boundary */}
          <polygon points={pts(project.site.boundary)} fill="none" stroke="var(--muted-foreground)" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />

          {/* Spaces */}
          {shapes.spaces.map(({ s, d }) => (
            <path key={s.id} d={d} fill={SPACE_FILL[s.kind]} vectorEffect="non-scaling-stroke" onClick={pick(s.id)} className="plan-hit cursor-pointer" data-id={s.id} />
          ))}

          {/* Furniture */}
          {view.layers.furniture && shapes.furniture.map(({ f, d }) => (
            <path key={f.id} d={d} fill="var(--background)" fillOpacity={0.6} stroke="var(--muted-foreground)" strokeWidth={1}
              vectorEffect="non-scaling-stroke" onClick={pick(f.id)} className="plan-hit cursor-pointer" data-id={f.id} />
          ))}

          {/* Walls */}
          <path d={shapes.light} fill="var(--muted-foreground)" fillOpacity={0.5} pointerEvents="none" />
          <path d={shapes.solid} fill="var(--muted-foreground)" pointerEvents="none" />
          <path d={shapes.bearing} fill="var(--foreground)" pointerEvents="none" />
          {shapes.railings.map(({ w, d }) => (
            <path key={w.id} d={d} fill="none" stroke="var(--foreground)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          ))}
          {/* Wall hit areas */}
          {shapes.walls.map(({ w, d }) => (
            <path key={w.id} d={d} fill="transparent" fillOpacity={0} vectorEffect="non-scaling-stroke" onClick={pick(w.id)} className="plan-hit cursor-pointer" data-id={w.id} />
          ))}

          {/* Doors and windows */}
          {shapes.openings.map(o => (
            <g key={o.id} onClick={pick(o.id)} className="cursor-pointer" data-id={o.id}>
              <polygon points={pts(o.outline)} fill={o.glassBlock ? 'url(#glassblock)' : 'transparent'} vectorEffect="non-scaling-stroke" className="plan-hit" />
              {o.lines.map((l, i) => (
                <polyline key={i} points={pts(l)} fill="none" stroke="var(--foreground)" strokeWidth={1.2}
                  strokeDasharray={o.dashed ? '6 4' : undefined} vectorEffect="non-scaling-stroke" />
              ))}
              {o.arcs.map((a, i) => (
                <path key={i} d={a} fill="none" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          ))}

          {/* Just changed (or pointed at by the agent): a tint that fades out. Selected: tinted with an outline until deselected */}
          <g pointerEvents="none" data-feedback>
            {view.highlight.filter(id => outlines.has(id) && !sel.has(id)).map(id => (
              <path key={`${id}-${changeToken}`} d={outlines.get(id)} fill="var(--chart-1)" className="plan-changed" />
            ))}
            {view.selection.filter(id => outlines.has(id)).map(id => (
              // Walls, doors and windows are thin: fill them nearly solid so the color reads; rooms and furniture get a light wash
              <path key={id} d={outlines.get(id)} fill="var(--chart-2)" fillOpacity={thin.has(id) ? 0.85 : 0.25} stroke="var(--chart-2)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          {/* Walls before the change: dashed */}
          {before && (
            <g pointerEvents="none">
               <path d={before} fill="none" stroke="var(--foreground)" strokeWidth={1.2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            </g>
          )}

          {/* Labels: room name + usable area */}
          {view.layers.labels && shapes.spaces.map(({ s, label, area }) => (
            // Clicking the room name also selects the room: hard to hit empty floor when it is full of furniture (especially on phones)
            <g key={s.id} textAnchor="middle" fontFamily="var(--font-sans)" onClick={pick(s.id)} className="cursor-pointer">
              <text x={label[0]} y={label[1]} fontSize={font} fill="var(--foreground)" fontWeight={500}
                paintOrder="stroke" stroke="var(--background)" strokeWidth={font / 6}>{s.name}</text>
              {s.kind !== 'void' && (
                <text x={label[0]} y={label[1] + font * 1.15} fontSize={font * 0.8} fill="var(--muted-foreground)" fontFamily="var(--font-mono)"
                  paintOrder="stroke" stroke="var(--background)" strokeWidth={font / 6}>{area.toFixed(1)} m²</text>
              )}
            </g>
          ))}

          {/* Dimension: length of the selected wall */}
          {view.layers.dimensions && selWall && (
            <text x={(selWall.w.start[0] + selWall.w.end[0]) / 2} y={(selWall.w.start[1] + selWall.w.end[1]) / 2 - selWall.w.thickness}
              fontSize={font * 0.85} textAnchor="middle" fill="var(--foreground)" fontFamily="var(--font-mono)" pointerEvents="none"
              paintOrder="stroke" stroke="var(--background)" strokeWidth={font / 6}>
              {(wallLength(selWall.w) / 1000).toFixed(2)} m
            </text>
          )}
        </svg>
      </TransformComponent>
    </TransformWrapper>
  );
}

