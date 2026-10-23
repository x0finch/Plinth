/**
 * Default furniture and material catalog (categories + parameters, not tied to specific models). New projects start from this.
 * Every entry is named in each project language; a project stores only the names in its own language (a plain `name` string).
 */
import type { Library, Mm, ProjectLanguage } from './schema.js';

type Named = Record<ProjectLanguage, string>;

/** Furniture groups */
const GROUPS = {
  living: { zh: '客厅', en: 'Living room' },
  kitchen: { zh: '餐厨', en: 'Kitchen & dining' },
  bedroom: { zh: '卧室', en: 'Bedroom' },
  study: { zh: '书房', en: 'Study' },
  bath: { zh: '卫浴', en: 'Bathroom' },
  yard: { zh: '庭院', en: 'Courtyard' },
  roof: { zh: '屋顶', en: 'Roof' },
} satisfies Record<string, Named>;

export const FURNITURE_TYPES: Record<string, { name: Named; group: keyof typeof GROUPS; size: { w: Mm; d: Mm; h: Mm } }> = {
  sofa3: { name: { zh: '三人沙发', en: '3-seat sofa' }, group: 'living', size: { w: 2100, d: 900, h: 800 } },
  sofa2: { name: { zh: '双人沙发', en: '2-seat sofa' }, group: 'living', size: { w: 1600, d: 850, h: 800 } },
  armchair: { name: { zh: '单人椅', en: 'Armchair' }, group: 'living', size: { w: 800, d: 800, h: 800 } },
  coffee: { name: { zh: '茶几', en: 'Coffee table' }, group: 'living', size: { w: 1200, d: 600, h: 420 } },
  teatable: { name: { zh: '茶台', en: 'Tea table' }, group: 'living', size: { w: 1400, d: 700, h: 650 } },
  tvstand: { name: { zh: '电视柜', en: 'TV stand' }, group: 'living', size: { w: 1800, d: 400, h: 500 } },
  sidetable: { name: { zh: '边几', en: 'Side table' }, group: 'living', size: { w: 500, d: 500, h: 550 } },
  plant: { name: { zh: '盆栽', en: 'Potted plant' }, group: 'living', size: { w: 500, d: 500, h: 1200 } },
  dining: { name: { zh: '餐桌', en: 'Dining table' }, group: 'kitchen', size: { w: 1600, d: 900, h: 750 } },
  chair: { name: { zh: '餐椅', en: 'Dining chair' }, group: 'kitchen', size: { w: 450, d: 500, h: 850 } },
  counter: { name: { zh: '橱柜', en: 'Kitchen counter' }, group: 'kitchen', size: { w: 2400, d: 600, h: 850 } },
  woodstove: { name: { zh: '柴火灶', en: 'Wood-fired stove' }, group: 'kitchen', size: { w: 1800, d: 800, h: 800 } },
  island: { name: { zh: '中岛', en: 'Kitchen island' }, group: 'kitchen', size: { w: 1600, d: 900, h: 900 } },
  bar: { name: { zh: '台面吧台', en: 'Bar counter' }, group: 'kitchen', size: { w: 2400, d: 450, h: 1000 } },
  barstool: { name: { zh: '吧椅', en: 'Bar stool' }, group: 'kitchen', size: { w: 400, d: 400, h: 750 } },
  fridge: { name: { zh: '冰箱', en: 'Fridge' }, group: 'kitchen', size: { w: 700, d: 700, h: 1800 } },
  bed18: { name: { zh: '双人床1.8', en: 'Double bed 1.8' }, group: 'bedroom', size: { w: 1800, d: 2000, h: 450 } },
  bed15: { name: { zh: '双人床1.5', en: 'Double bed 1.5' }, group: 'bedroom', size: { w: 1500, d: 2000, h: 450 } },
  bed12: { name: { zh: '单人床', en: 'Single bed' }, group: 'bedroom', size: { w: 1200, d: 2000, h: 450 } },
  nightstand: { name: { zh: '床头柜', en: 'Nightstand' }, group: 'bedroom', size: { w: 500, d: 400, h: 500 } },
  wardrobe: { name: { zh: '衣柜', en: 'Wardrobe' }, group: 'bedroom', size: { w: 1600, d: 600, h: 2200 } },
  desk: { name: { zh: '书桌', en: 'Desk' }, group: 'study', size: { w: 1200, d: 600, h: 750 } },
  bookcase: { name: { zh: '书柜', en: 'Bookcase' }, group: 'study', size: { w: 1200, d: 350, h: 2000 } },
  toilet: { name: { zh: '马桶', en: 'Toilet' }, group: 'bath', size: { w: 400, d: 700, h: 750 } },
  basin: { name: { zh: '洗手台', en: 'Washbasin' }, group: 'bath', size: { w: 600, d: 450, h: 850 } },
  shower: { name: { zh: '淋浴房', en: 'Shower' }, group: 'bath', size: { w: 900, d: 900, h: 2000 } },
  shower5: { name: { zh: '钻石型淋浴房', en: 'Diamond shower' }, group: 'bath', size: { w: 1000, d: 1000, h: 2000 } },
  grab: { name: { zh: '安全扶手', en: 'Grab bar' }, group: 'bath', size: { w: 700, d: 80, h: 40 } },
  sos: { name: { zh: '紧急呼叫按钮', en: 'Emergency call button' }, group: 'bath', size: { w: 100, d: 40, h: 100 } },
  foldseat: { name: { zh: '折叠淋浴凳', en: 'Folding shower seat' }, group: 'bath', size: { w: 450, d: 380, h: 460 } },
  washer: { name: { zh: '洗衣机', en: 'Washing machine' }, group: 'bath', size: { w: 600, d: 600, h: 850 } },
  sink: { name: { zh: '洗衣池', en: 'Laundry sink' }, group: 'bath', size: { w: 600, d: 500, h: 800 } },
  tree: { name: { zh: '庭院树', en: 'Courtyard tree' }, group: 'yard', size: { w: 3000, d: 3000, h: 4500 } },
  rocker: { name: { zh: '摇椅', en: 'Rocking chair' }, group: 'yard', size: { w: 650, d: 950, h: 900 } },
  stonetable: { name: { zh: '石桌', en: 'Stone table' }, group: 'yard', size: { w: 900, d: 900, h: 750 } },
  stool: { name: { zh: '石凳', en: 'Stone stool' }, group: 'yard', size: { w: 400, d: 400, h: 450 } },
  solar: { name: { zh: '太阳能热水器', en: 'Solar water heater' }, group: 'roof', size: { w: 2000, d: 1500, h: 1300 } },
  watertank: { name: { zh: '水塔', en: 'Water tank' }, group: 'roof', size: { w: 1000, d: 1000, h: 1400 } },
  dryrack: { name: { zh: '晾衣架', en: 'Drying rack' }, group: 'roof', size: { w: 2400, d: 600, h: 1700 } },
  canopy: { name: { zh: '遮阳棚', en: 'Canopy' }, group: 'roof', size: { w: 3000, d: 2800, h: 2500 } },
  awning2: { name: { zh: '伸缩遮阳棚', en: 'Retractable awning' }, group: 'roof', size: { w: 1200, d: 2800, h: 400 } },
  planter: { name: { zh: '种植池', en: 'Planter' }, group: 'yard', size: { w: 1000, d: 1000, h: 450 } },
  bed: { name: { zh: '种植带', en: 'Planting bed' }, group: 'yard', size: { w: 3000, d: 600, h: 500 } },
  shrine: { name: { zh: '神位', en: 'Ancestral shrine' }, group: 'living', size: { w: 2000, d: 500, h: 1250 } },
  car: { name: { zh: '汽车', en: 'Car' }, group: 'yard', size: { w: 5220, d: 2000, h: 1800 } },
};

export const MATERIAL_TYPES: Record<string, { name: Named; tileSize?: Mm }> = {
  wood: { name: { zh: '柚木地板', en: 'Teak flooring' }, tileSize: 1200 },
  oak: { name: { zh: '浅橡木地板', en: 'Light oak flooring' }, tileSize: 1200 },
  tile: { name: { zh: '米白瓷砖', en: 'Off-white tile' }, tileSize: 1600 },
  marble: { name: { zh: '大理石', en: 'Marble' }, tileSize: 1600 },
  terrazzo: { name: { zh: '水磨石', en: 'Terrazzo' }, tileSize: 800 },
  redtile: { name: { zh: '红阶砖', en: 'Red clay tile' }, tileSize: 1200 },
  slate: { name: { zh: '青石板', en: 'Bluestone slab' }, tileSize: 1200 },
  antislip: { name: { zh: '防滑砖', en: 'Anti-slip tile' }, tileSize: 1200 },
  cement: { name: { zh: '微水泥', en: 'Microcement' }, tileSize: 2000 },
  grass: { name: { zh: '草坪', en: 'Lawn' }, tileSize: 1500 },
  gravel: { name: { zh: '碎石', en: 'Gravel' }, tileSize: 800 },
  paver: { name: { zh: '透水砖', en: 'Permeable paver' }, tileSize: 600 },
};

/** Furniture catalog for a new project, named in the project's language */
export function furnitureCatalog(lang: ProjectLanguage = 'zh'): Library['furniture'] {
  return Object.fromEntries(
    Object.entries(FURNITURE_TYPES).map(([k, v]) => [k, { name: v.name[lang], group: GROUPS[v.group][lang], size: { ...v.size } }]),
  );
}

/** Material catalog for a new project, named in the project's language */
export function materialCatalog(lang: ProjectLanguage = 'zh'): Library['materials'] {
  return Object.fromEntries(
    Object.entries(MATERIAL_TYPES).map(([k, v]) => [k, { name: v.name[lang], ...(v.tileSize ? { tileSize: v.tileSize } : {}) }]),
  );
}

/** Chinese catalogs (kept for existing callers) */
export const FURNITURE_CATALOG: Library['furniture'] = furnitureCatalog('zh');
export const MATERIAL_CATALOG: Library['materials'] = materialCatalog('zh');
