import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { areaReport, fromLegacy, migrate, validate } from '../src/index.js';

const dir = join(import.meta.dirname, '../../../samples/wushi-10');
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const legacy = read('legacy.json');
const expected = read('expected-areas.json') as {
  floors: { level: string; gross: number; rooms: { name: string; net: number }[] }[];
};

describe('乌石合院方案十', () => {
  const project = migrate(read('project.json'));

  it('提交的 project.json 与转换结果一致（转换可重跑）', () => {
    expect(project).toEqual(fromLegacy(legacy));
  });

  it('通过结构校验', () => {
    expect(validate(project)).toEqual([]);
  });

  it('每层建筑面积、每间使用面积与旧页面一致（误差 < 0.01㎡）', () => {
    const report = areaReport(project);
    expect(report.levels.map(l => l.name)).toEqual(expected.floors.map(f => f.level));
    report.levels.forEach((l, i) => {
      const exp = expected.floors[i];
      expect(l.gross, `${l.name}建筑面积`).toBeCloseTo(exp.gross, 2);
      expect(l.spaces.map(s => s.net)).toHaveLength(exp.rooms.length);
      l.spaces.forEach((s, j) => expect(s.net, `${l.name}·${s.name}`).toBeCloseTo(exp.rooms[j].net, 2));
    });
  });

  it('对象名称在同一楼层内不重复，可用来定位', () => {
    for (const l of project.levels) {
      for (const list of [project.walls, project.spaces, project.furniture]) {
        const names = list.filter(o => o.level === l.id).map(o => o.name);
        expect(new Set(names).size, l.name).toBe(names.length);
      }
    }
  });
});

describe('migrate', () => {
  it('拒绝非 Plinth 文件和更新版本', () => {
    expect(() => migrate({})).toThrow();
    expect(() => migrate({ schema: 'plinth/project', version: 99 })).toThrow(/比当前核心包/);
  });
});
