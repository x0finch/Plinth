/** 新建项目：空白方案，带默认目录。 */
import { FURNITURE_CATALOG, MATERIAL_CATALOG } from './catalog.js';
import { SCHEMA, SCHEMA_VERSION, type Project } from './schema.js';

export interface NewProjectOptions {
  id: string;
  name: string;
  /** 用地宽、深（毫米），默认 20 × 20 米 */
  site?: { width: number; depth: number };
  location?: { lat: number; lon: number; tz: number };
  floors?: number;
  floorHeight?: number;
}

export function createProject(o: NewProjectOptions): Project {
  const { width, depth } = o.site ?? { width: 20000, depth: 20000 };
  const n = o.floors ?? 1, h = o.floorHeight ?? 3000;
  const names = ['一层', '二层', '三层', '四层', '五层', '六层'];
  return {
    schema: SCHEMA,
    version: SCHEMA_VERSION,
    id: o.id,
    name: o.name,
    units: 'mm',
    site: {
      boundary: [[0, 0], [width, 0], [width, depth], [0, depth]],
      northAngle: 0,
      location: o.location ?? { lat: 30, lon: 114, tz: 8 },
      groundLevel: -150,
    },
    levels: [
      ...Array.from({ length: n }, (_, i) => ({ id: `L${i + 1}`, name: names[i] ?? `${i + 1}层`, elevation: i * h, height: h })),
      { id: 'RF', name: '屋顶', elevation: n * h, height: 0, roof: true },
    ],
    walls: [],
    spaces: [],
    elements: [],
    furniture: [],
    constraints: [],
    brief: {},
    decisions: [],
    library: {
      furniture: structuredClone(FURNITURE_CATALOG),
      materials: structuredClone(MATERIAL_CATALOG),
      elements: {},
    },
    variants: [],
  };
}
