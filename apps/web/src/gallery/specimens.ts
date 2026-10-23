/**
 * The gallery's specimen project: one of every kind of thing the model draws (walls, doors and windows, floor materials,
 * furniture, elements, space kinds), each in its own cell, laid out in rows and named on the ground in front of it. Generated
 * here, never stored: the gallery shows them in the default model style, through the same 3D view as a real design.
 */
import { createProject, names, type Element, type Opening, type Point, type Project, type Space, type Wall, type WallKind } from '@plinth/core';
import type { GroundLabelSpec } from '@/editor/ground-labels';
import { kindLabel } from '@/editor/panels/common';
import { m } from '@/lib/i18n';

/** Gap between cells and between rows (mm); a cell's name is written in the gap in front of it */
const GAP = 600;
const STOREY = 3000;

interface Tile {
  w: number;
  h: number;
  /** Adds the cell's content with its top-left corner at (x, y); returns its name and the id picking the name selects */
  fill(p: Project, x: number, y: number, id: string): [name: string, pick: string];
}

const rect = (x: number, y: number, w: number, h: number): Point[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** A space filling the cell, for the cells that show a floor material or a kind of space */
function floor(p: Project, id: string, name: string, x: number, y: number, w: number, h: number, o: Partial<Space>): [string, string] {
  p.spaces.push({ id, name, level: 'L1', kind: 'indoor', shape: [{ outer: rect(x, y, w, h) }], floor: '', ...o });
  return [name, id];
}

function wall(id: string, name: string, kind: WallKind, start: Point, end: Point, o: Partial<Wall> = {}): Wall {
  const thickness = { bearing: 180, partition: 120, fence: 200, parapet: 200, railing: 60 }[kind];
  return { id, name, level: 'L1', kind, start, end, thickness, openings: [], ...o };
}

export function specimenProject(lang: Project['language']): { project: Project; labels: GroundLabelSpec[] } {
  // A second, empty level gives the stair a storey to climb; the gallery shows 3D only, with no level switcher
  const p = createProject({ id: 'gallery', name: m.gallery_title(), language: lang, floors: 2, floorHeight: STOREY });
  p.levels = p.levels.filter(l => !l.roof);
  const v = names(lang);
  p.library.elements = {
    stair: { name: m.gallery_stair(), version: 1 },
    pond: { name: m.gallery_pond(), version: 1 },
    drain: { name: m.gallery_drain(), version: 1 },
  };

  const rows: Tile[][] = [];

  // Walls of each kind
  rows.push((['bearing', 'partition', 'fence', 'parapet', 'railing'] as const).map(kind => ({
    w: 2400, h: 1600,
    fill(p, x, y, id) {
      const name = kindLabel(kind);
      p.walls.push(wall(`${id}-w`, name, kind, [x + 200, y + 800], [x + 2200, y + 800]));
      return [name, `${id}-w`];
    },
  })));

  // Doors and windows, each in a wall
  const openings: [string, Omit<Opening, 'id' | 'name' | 'at'>][] = [
    [v.opening.door, { kind: 'door', width: 900, height: 2100, sill: 0, swing: { hinge: 'start', side: 'right' } }],
    [v.opening['sliding-door'], { kind: 'sliding-door', width: 1800, height: 2400, sill: 0 }],
    [v.opening.window, { kind: 'window', width: 1200, height: 1500, sill: 900 }],
    [v.glassBlock(v.opening.window), { kind: 'window', width: 1200, height: 1500, sill: 900, glazing: 'glass-block' }],
    [v.opening.gate, { kind: 'gate', width: 1500, height: 2400, sill: 0 }],
    [v.opening.opening, { kind: 'opening', width: 900, height: 2100, sill: 0 }],
  ];
  rows.push(openings.map(([name, o]) => ({
    w: 2800, h: 2000,
    fill(p, x, y, id) {
      const w = wall(`${id}-w`, name, o.kind === 'gate' ? 'fence' : 'bearing', [x + 200, y + 1000], [x + 2600, y + 1000]);
      w.openings.push({ id: `${id}-o`, name, at: 1200, ...o });
      p.walls.push(w);
      return [name, `${id}-o`];
    },
  })));

  // Floor materials
  rows.push(Object.entries(p.library.materials).map(([key, mat]) => ({
    w: 2000, h: 2000,
    fill(p, x, y, id) {
      return floor(p, id, mat.name, x, y, 2000, 2000, { floor: key });
    },
  })));

  // Furniture, a row per group
  const groups = new Map<string, [string, Project['library']['furniture'][string]][]>();
  for (const [key, f] of Object.entries(p.library.furniture)) groups.set(f.group ?? '', [...(groups.get(f.group ?? '') ?? []), [key, f]]);
  for (const items of groups.values()) {
    rows.push(items.map(([key, f]) => {
      // Wide enough for the name in front of the piece
      const w = Math.max(2200, Math.ceil((f.size.w + 800) / 100) * 100), h = Math.ceil((f.size.d + 400) / 100) * 100;
      return {
        w, h,
        fill(p, x, y, id) {
          p.furniture.push({ id: `${id}-f`, name: f.name, type: key, level: 'L1', position: [x + w / 2, y + h / 2], rotation: 0, size: { ...f.size } });
          return [f.name, `${id}-f`];
        },
      };
    }));
  }

  // Elements: a stair up to the next level, a pond, a drain
  const element = (e: Omit<Element, 'level'>): Element => ({ level: 'L1', ...e });
  rows.push([
    {
      w: 2700, h: 5000,
      fill(p, x, y, id) {
        p.elements.push(element({ id: `${id}-e`, name: p.library.elements.stair.name, type: 'stair', topLevel: 'L2',
          params: { rect: [x + 240, y + 200, 2220, 4600], up: 'north', turn: 'right', gap: 100 } }));
        return [p.library.elements.stair.name, `${id}-e`];
      },
    },
    {
      w: 3000, h: 3000,
      fill(p, x, y, id) {
        p.elements.push(element({ id: `${id}-e`, name: m.gallery_pond(), type: 'pond', params: { center: [x + 1500, y + 1500], radius: 1100, sweep: 'full' } }));
        return [m.gallery_pond(), `${id}-e`];
      },
    },
    {
      w: 3000, h: 1600,
      fill(p, x, y, id) {
        p.elements.push(element({ id: `${id}-e`, name: m.gallery_drain(), type: 'drain', params: { rect: [x + 200, y + 725, 2600, 150] } }));
        return [m.gallery_drain(), `${id}-e`];
      },
    },
  ]);

  // Space kinds
  rows.push((['indoor', 'semi-outdoor', 'outdoor', 'roof-terrace', 'void'] as const).map(kind => ({
    w: 2000, h: 2000,
    fill(p, x, y, id) {
      return floor(p, id, kindLabel(kind), x, y, 2000, 2000, { kind, floor: kind === 'roof-terrace' ? 'redtile' : kind === 'outdoor' ? 'paver' : 'tile' });
    },
  })));

  // Lay the rows out top to bottom, tiles left to right, wrapping long rows at about the side of a square of the same area, so
  // the gallery comes out about square (the 3D view looks at it diagonally)
  const area = rows.flat().reduce((a, t) => a + (t.w + GAP) * (t.h + GAP), 0);
  const rowWidth = Math.sqrt(area) * 1.1;
  const labels: GroundLabelSpec[] = [];
  let y = GAP, width = 0;
  rows.forEach((row, r) => {
    let x = GAP, lineHeight = 0;
    row.forEach((t, i) => {
      if (x > GAP && x + t.w > rowWidth) {
        y += lineHeight + GAP;
        x = GAP;
        lineHeight = 0;
      }
      const [name, pick] = t.fill(p, x, y, `g${r + 1}-${i + 1}`);
      labels.push({ name, pick, level: 'L1', at: [x + t.w / 2, y + t.h + 60], width: t.w });
      x += t.w + GAP;
      lineHeight = Math.max(lineHeight, t.h);
      width = Math.max(width, x);
    });
    y += lineHeight + GAP;
  });
  p.site.boundary = rect(0, 0, width, y);
  return { project: p, labels };
}
