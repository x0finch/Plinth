/**
 * Plinth 项目数据规范 v1。
 *
 * 约定：
 * - 长度单位毫米；平面坐标 x 向东、y 向南；高度从各楼层底标高算起。
 * - 所有对象都有稳定的 `id`（给程序用）和可读的 `name`（给人和 agent 用，如“老人房二西墙”）。
 * - 推导结果（楼板、屋面、面积、墙体交接）不入库。
 * - 规范只收录已经在真实方案里用到、含义确定的字段；含义还不确定的放进 `extras`，
 *   用到第二次再升格成正式字段。字段的增删改通过 `version` + 迁移函数完成（见 migrate.ts）。
 */

export const SCHEMA = 'plinth/project' as const;
export const SCHEMA_VERSION = 1 as const;

export type Id = string;
/** 毫米 */
export type Mm = number;
/** [x, y]，毫米 */
export type Point = [Mm, Mm];
/** 闭合环，首尾不重复，外环逆时针或顺时针均可 */
export type Ring = Point[];
export interface Polygon {
  outer: Ring;
  holes?: Ring[];
}
/** 尚未进入规范、但需要原样保留的信息 */
export type Extras = Record<string, unknown>;

export interface Project {
  schema: typeof SCHEMA;
  version: typeof SCHEMA_VERSION;
  id: Id;
  name: string;
  units: 'mm';
  site: Site;
  levels: Level[];
  walls: Wall[];
  spaces: Space[];
  elements: Element[];
  furniture: Furniture[];
  constraints: Constraint[];
  brief: Brief;
  decisions: Decision[];
  library: Library;
  variants: Variant[];
  extras?: Extras;
}

export interface Site {
  /** 用地范围 */
  boundary: Ring;
  /** 正北方向相对 -y 轴的顺时针角度（度）；0 表示图纸上方为北 */
  northAngle: number;
  location: { lat: number; lon: number; /** 时区，小时 */ tz: number };
  /** 室外地坪相对一层地面的标高 */
  groundLevel: Mm;
  extras?: Extras;
}

export interface Level {
  id: Id;
  name: string;
  /** 底标高 */
  elevation: Mm;
  /** 层高；屋顶层为 0，其上的墙必须写明 height */
  height: Mm;
  roof?: boolean;
}

export type WallKind = 'bearing' | 'partition' | 'fence' | 'parapet' | 'railing';

export interface Wall {
  id: Id;
  name: string;
  level: Id;
  /** 中心线起点、终点 */
  start: Point;
  end: Point;
  thickness: Mm;
  kind: WallKind;
  /** 墙高；不写则等于楼层层高 */
  height?: Mm;
  openings: Opening[];
  extras?: Extras;
}

export type OpeningKind = 'door' | 'sliding-door' | 'gate' | 'window' | 'opening';

export interface Opening {
  id: Id;
  name: string;
  kind: OpeningKind;
  /** 洞口中心到墙起点的距离（沿中心线） */
  at: Mm;
  width: Mm;
  height: Mm;
  /** 洞口底到楼面的高度 */
  sill: Mm;
  /** 平开门：铰链在靠起点还是终点一侧，向墙的哪一侧开（沿起点→终点看，平面图北在上） */
  swing?: { hinge: 'start' | 'end'; side: 'left' | 'right' };
  glazing?: 'glass-block';
  extras?: Extras;
}

export type SpaceKind = 'indoor' | 'semi-outdoor' | 'outdoor' | 'roof-terrace' | 'void';

export interface Space {
  id: Id;
  name: string;
  level: Id;
  kind: SpaceKind;
  /** 轴线围合的范围（墙中心线），可由多块组成 */
  shape: Polygon[];
  /** 地面材质类别，见 library.materials */
  floor: string;
  /** 楼板在此开洞（楼梯井、通高） */
  slabOpening?: boolean;
  extras?: Extras;
}

/** 构件实例：楼梯、水池、排水沟等，引用 library.elements 的定义 + 参数 */
export interface Element {
  id: Id;
  name: string;
  type: string;
  level: Id;
  /** 跨楼层构件的顶层 */
  topLevel?: Id;
  params: Record<string, unknown>;
  extras?: Extras;
}

export interface Furniture {
  id: Id;
  name: string;
  /** 家具类别，见 library.furniture */
  type: string;
  level: Id;
  /** 中心点 */
  position: Point;
  /** 绕中心顺时针旋转角（度，平面图北在上） */
  rotation: number;
  size: { w: Mm; d: Mm; h: Mm };
  /** 离楼面高度（挂墙、吊装） */
  elevation?: Mm;
  extras?: Extras;
}

/** 约束：v1 只占位，求解在路线图第 3 步 */
export interface Constraint {
  id: Id;
  type: 'align' | 'center' | 'size-target' | 'spacing' | 'reference' | 'rule';
  targets: Id[];
  params: Record<string, unknown>;
  hard: boolean;
  source: 'user' | 'agent' | 'default';
  weight?: number;
  note?: string;
}

export interface Brief {
  household?: string[];
  rooms?: string[];
  preferences?: string[];
  budget?: string;
  notes?: string[];
}

export interface Decision {
  id: Id;
  at: string;
  summary: string;
  reason?: string;
  rejected?: string[];
}

export interface Library {
  furniture: Record<string, { name: string; group?: string; size: { w: Mm; d: Mm; h: Mm } }>;
  materials: Record<string, { name: string; tileSize?: Mm }>;
  elements: Record<string, { name: string; version: number; note?: string }>;
}

export interface Variant {
  id: Id;
  name: string;
  /** 相对主线的变更，格式待定 */
  changes: unknown[];
}
