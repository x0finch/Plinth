// 把 samples/wushi-<方案号>/legacy.json 转成规范格式 project.json，并打印面积对照。
// 用法：npm run convert -- [方案号=10]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { areaReport, fromLegacy, validate } from '@plinth/core';

const sch = Number(process.argv[2] ?? 10);
const dir = join(import.meta.dirname, '..', `samples/wushi-${sch}`);
const project = fromLegacy(JSON.parse(readFileSync(join(dir, 'legacy.json'), 'utf8')));
const issues = validate(project);
if (issues.length) {
  for (const i of issues) console.error(`${i.path}: ${i.message}`);
  process.exit(1);
}
writeFileSync(join(dir, 'project.json'), JSON.stringify(project, null, 1) + '\n');
const r = areaReport(project);
for (const l of r.levels) console.log(`${l.name} 建筑面积 ${l.gross.toFixed(2)}㎡，${l.spaces.length} 个空间`);
console.log(`合计建筑面积 ${r.totalGross.toFixed(2)}㎡ → ${join(dir, 'project.json')}`);
