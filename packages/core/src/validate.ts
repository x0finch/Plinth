import { area } from './geometry.js';
import type { Project } from './schema.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

/** 结构校验：ID 唯一、引用存在、几何有效。规则检查（门开向、房间重叠等）在路线图第 2 步。 */
export function validate(p: Project): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Map<string, string>();
  const claim = (id: string, path: string) => {
    if (ids.has(id)) issues.push({ path, message: `ID ${id} 与 ${ids.get(id)} 重复` });
    else ids.set(id, path);
  };
  const levels = new Set(p.levels.map(l => l.id));
  const lib = p.library;

  p.levels.forEach((l, i) => claim(l.id, `levels[${i}]`));
  p.walls.forEach((w, i) => {
    const at = `walls[${i}]（${w.name}）`;
    claim(w.id, at);
    if (!levels.has(w.level)) issues.push({ path: at, message: `楼层 ${w.level} 不存在` });
    const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
    if (len <= 0) issues.push({ path: at, message: '墙长为 0' });
    if (w.thickness <= 0) issues.push({ path: at, message: '墙厚必须大于 0' });
    w.openings.forEach((o, j) => {
      claim(o.id, `${at}.openings[${j}]`);
      if (o.at - o.width / 2 < -1 || o.at + o.width / 2 > len + 1)
        issues.push({ path: `${at}.openings[${j}]（${o.name}）`, message: '洞口超出墙长' });
    });
  });
  p.spaces.forEach((s, i) => {
    const at = `spaces[${i}]（${s.name}）`;
    claim(s.id, at);
    if (!levels.has(s.level)) issues.push({ path: at, message: `楼层 ${s.level} 不存在` });
    if (!(s.floor in lib.materials)) issues.push({ path: at, message: `材质 ${s.floor} 未登记` });
    if (area(s.shape) <= 0) issues.push({ path: at, message: '范围面积为 0' });
  });
  p.elements.forEach((e, i) => {
    const at = `elements[${i}]（${e.name}）`;
    claim(e.id, at);
    if (!levels.has(e.level) || (e.topLevel && !levels.has(e.topLevel))) issues.push({ path: at, message: '楼层不存在' });
    if (!(e.type in lib.elements)) issues.push({ path: at, message: `构件类型 ${e.type} 未登记` });
  });
  p.furniture.forEach((f, i) => {
    const at = `furniture[${i}]（${f.name}）`;
    claim(f.id, at);
    if (!levels.has(f.level)) issues.push({ path: at, message: `楼层 ${f.level} 不存在` });
    if (!(f.type in lib.furniture)) issues.push({ path: at, message: `家具类型 ${f.type} 未登记` });
  });
  return issues;
}
