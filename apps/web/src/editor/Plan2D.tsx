/** 平面图：SVG，单位毫米。点选对象、缩放平移、高亮改动、对比改前。 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { wallLength, type Point } from '@plinth/core';
import { levelShapes } from './plan-geometry';
import { useEditor } from './store';

const pts = (p: Point[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** 把 SVG 画成 PNG（截图、导出图片） */
export async function svgToPng(svg: SVGSVGElement, width = 2000) {
  const vb = svg.viewBox.baseVal;
  const height = Math.round((width * vb.height) / vb.width);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  // 把用到的 CSS 变量落成具体颜色，离开页面也能显示
  const cs = getComputedStyle(svg);
  const vars = ['--plan-bg', '--plan-wall', '--plan-partition', '--plan-light', '--plan-indoor', '--plan-semi', '--plan-outdoor', '--plan-roof', '--plan-line', '--plan-text', '--plan-muted', '--plan-highlight', '--plan-before'];
  clone.setAttribute('style', vars.map(v => `${v}:${cs.getPropertyValue(v)}`).join(';'));
  const data = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = cs.getPropertyValue('--plan-bg') || '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

const SPACE_FILL: Record<string, string> = {
  indoor: 'var(--plan-indoor)', 'semi-outdoor': 'var(--plan-semi)', outdoor: 'var(--plan-outdoor)', 'roof-terrace': 'var(--plan-roof)', void: 'url(#hatch)',
};

export function Plan2D({ svgRef }: { svgRef?: React.RefObject<SVGSVGElement | null> }) {
  const project = useEditor(s => s.project);
  const view = useEditor(s => s.view);
  const select = useEditor(s => s.select);
  const compare = useEditor(s => s.compare);
  const lastChange = useEditor(s => s.lastChange);
  const shapes = useMemo(() => levelShapes(project, view.level), [project, view.level]);
  const before = useMemo(
    () => (compare && lastChange ? levelShapes(lastChange.before, view.level) : null),
    [compare, lastChange, view.level],
  );
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);

  const pad = 1500;
  const [x0, y0, x1, y1] = shapes.bounds;
  const vb = `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`;
  const font = Math.max(220, Math.min(420, (x1 - x0) / 45));

  const sel = new Set(view.selection);
  const hl = new Set(view.highlight);
  const isOn = (id: string) => sel.has(id) || hl.has(id);

  const pick = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      select(e.shiftKey || e.metaKey ? (sel.has(id) ? view.selection.filter(x => x !== id) : [...view.selection, id]) : [id]);
    },
    [select, view.selection],
  );

  // 换楼层时复位缩放
  useEffect(() => {
    zoomRef.current?.resetTransform(0);
  }, [view.level]);

  const selWall = shapes.walls.find(x => sel.has(x.w.id));

  return (
    <TransformWrapper ref={zoomRef} minScale={0.5} maxScale={20} doubleClick={{ disabled: true }} wheel={{ step: 0.15 }}>
      <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
        <svg
          ref={svgRef}
          viewBox={vb}
          className="h-full w-full select-none"
          style={{ background: 'var(--plan-bg)' }}
          onClick={() => select([])}
          role="img"
          aria-label={`${project.levels.find(l => l.id === view.level)?.name ?? ''}平面图`}
        >
          <defs>
            <pattern id="hatch" width="200" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="200" stroke="var(--plan-muted)" strokeWidth="20" />
            </pattern>
            <pattern id="glassblock" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="var(--plan-indoor)" stroke="var(--plan-muted)" strokeWidth="12" />
            </pattern>
          </defs>

          {/* 用地红线 */}
          <polygon points={pts(project.site.boundary)} fill="none" stroke="var(--plan-muted)" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />

          {/* 空间 */}
          {shapes.spaces.map(({ s, d }) => (
            <path key={s.id} d={d} fill={SPACE_FILL[s.kind]} stroke={isOn(s.id) ? 'var(--plan-highlight)' : 'none'} strokeWidth={isOn(s.id) ? 3 : 0}
              vectorEffect="non-scaling-stroke" onClick={pick(s.id)} className="cursor-pointer" data-id={s.id} />
          ))}

          {/* 家具 */}
          {view.layers.furniture && shapes.furniture.map(({ f, d }) => (
            <path key={f.id} d={d} fill="var(--plan-bg)" fillOpacity={0.6} stroke={isOn(f.id) ? 'var(--plan-highlight)' : 'var(--plan-muted)'}
              strokeWidth={isOn(f.id) ? 2.5 : 1} vectorEffect="non-scaling-stroke" onClick={pick(f.id)} className="cursor-pointer" data-id={f.id} />
          ))}

          {/* 墙体 */}
          <path d={shapes.light} fill="var(--plan-light)" pointerEvents="none" />
          <path d={shapes.solid} fill="var(--plan-partition)" pointerEvents="none" />
          <path d={shapes.bearing} fill="var(--plan-wall)" pointerEvents="none" />
          {shapes.railings.map(({ w, d }) => (
            <path key={w.id} d={d} fill="none" stroke="var(--plan-line)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          ))}
          {/* 墙的命中区域与高亮 */}
          {shapes.walls.map(({ w, d }) => (
            <path key={w.id} d={d} fill={isOn(w.id) ? 'var(--plan-highlight)' : 'transparent'} fillOpacity={isOn(w.id) ? 0.55 : 0}
              onClick={pick(w.id)} className="cursor-pointer" data-id={w.id} />
          ))}

          {/* 门窗 */}
          {shapes.openings.map(o => (
            <g key={o.id} onClick={pick(o.id)} className="cursor-pointer" data-id={o.id}>
              <polygon points={pts(o.outline)} fill={o.glassBlock ? 'url(#glassblock)' : isOn(o.id) ? 'var(--plan-highlight)' : 'transparent'} fillOpacity={isOn(o.id) ? 0.35 : 1} />
              {o.lines.map((l, i) => (
                <polyline key={i} points={pts(l)} fill="none" stroke={isOn(o.id) ? 'var(--plan-highlight)' : 'var(--plan-line)'} strokeWidth={1.2}
                  strokeDasharray={o.dashed ? '6 4' : undefined} vectorEffect="non-scaling-stroke" />
              ))}
              {o.arcs.map((a, i) => (
                <path key={i} d={a} fill="none" stroke="var(--plan-muted)" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          ))}

          {/* 改前的墙：虚线 */}
          {before && (
            <g pointerEvents="none">
              <path d={before.bearing + before.solid} fill="none" stroke="var(--plan-before)" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            </g>
          )}

          {/* 标注：房间名 + 使用面积 */}
          {view.layers.labels && shapes.spaces.map(({ s, label, area }) => (
            <g key={s.id} pointerEvents="none" textAnchor="middle" fontFamily="var(--font-sans)">
              <text x={label[0]} y={label[1]} fontSize={font} fill="var(--plan-text)" fontWeight={500}
                paintOrder="stroke" stroke="var(--plan-bg)" strokeWidth={font / 6}>{s.name}</text>
              {s.kind !== 'void' && (
                <text x={label[0]} y={label[1] + font * 1.15} fontSize={font * 0.8} fill="var(--plan-muted)" fontFamily="var(--font-mono)"
                  paintOrder="stroke" stroke="var(--plan-bg)" strokeWidth={font / 6}>{area.toFixed(1)} m²</text>
              )}
            </g>
          ))}

          {/* 尺寸：选中墙的长度 */}
          {view.layers.dimensions && selWall && (
            <text x={(selWall.w.start[0] + selWall.w.end[0]) / 2} y={(selWall.w.start[1] + selWall.w.end[1]) / 2 - selWall.w.thickness}
              fontSize={font * 0.85} textAnchor="middle" fill="var(--plan-highlight)" fontFamily="var(--font-mono)" pointerEvents="none"
              paintOrder="stroke" stroke="var(--plan-bg)" strokeWidth={font / 6}>
              {(wallLength(selWall.w) / 1000).toFixed(2)} m
            </text>
          )}
        </svg>
      </TransformComponent>
    </TransformWrapper>
  );
}

