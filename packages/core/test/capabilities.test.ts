/**
 * 契约测试：不碰界面，只靠调用能力就能建一栋房子、修改、检查。将来也是 MCP 的验收标准。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, createRegistry, migrate, openingCenter, Session, spaceNetArea, type CallResult, type Project } from '../src/index.js';

const registry = createRegistry();
const actor = { kind: 'agent' as const };

function harness(p: Project) {
  const session = new Session(p);
  const call = async (name: string, input: unknown = {}): Promise<CallResult> => registry.call(name, input, { session, actor });
  const ok = async (name: string, input: unknown = {}) => {
    const r = await call(name, input);
    if (!r.ok) throw new Error(`${name} 失败：${r.error?.message}`);
    return r;
  };
  return { session, call, ok };
}

const sample = () => migrate(JSON.parse(readFileSync(join(import.meta.dirname, '../../../samples/wushi-10/project.json'), 'utf8')));

describe('从零搭一栋房子', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness(createProject({ id: 't', name: '测试' }));
  });

  it('逐间加房间、开门窗、放家具，规则检查通过', async () => {
    const living = await h.ok('room_add', { level: '一层', name: '客厅', rect: [0, 0, 6000, 5000], wall_thickness: 240, wall_kind: 'bearing' });
    expect((living.result as any).walls).toHaveLength(4);
    // 卧室贴着客厅东墙：共用的墙不重复建
    const bed = await h.ok('room_add', { level: 'L1', name: '主卧', rect: [6000, 0, 4000, 5000], wall_thickness: 240, wall_kind: 'bearing', door: { side: 'west' } });
    expect((bed.result as any).walls).toHaveLength(3);
    expect((bed.result as any).door).toBeTruthy();
    await h.ok('opening_add', { wall: '主卧北墙', kind: 'window', center_on: '主卧' });
    await h.ok('opening_add', { wall: '客厅南墙', kind: 'door', width: 1000 });
    await h.ok('furniture_add', { space: '主卧', type: 'bed18' });

    const p = h.session.project;
    expect(p.walls).toHaveLength(7);
    const rules = await h.ok('check_rules');
    expect((rules.result as any).issues.filter((i: any) => i.severity === 'error')).toEqual([]);
    const report = await h.ok('area_report');
    const spaces = (report.result as any).levels[0].spaces;
    expect(spaces.find((s: any) => s.name === '主卧').net).toBeCloseTo(3.76 * 4.76, 1);
  });

  it('房间重叠会被拒绝，数据不变', async () => {
    await h.ok('room_add', { level: 'L1', name: 'A', rect: [0, 0, 4000, 4000] });
    const before = h.session.project;
    const r = await h.call('room_add', { level: 'L1', name: 'B', rect: [2000, 2000, 4000, 4000] });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('rule-violated');
    expect(h.session.project).toBe(before);
  });

  it('batch 中途失败整批回滚', async () => {
    const before = h.session.project;
    const r = await h.call('batch', {
      label: '两间房',
      calls: [
        { name: 'room_add', input: { level: 'L1', name: 'A', rect: [0, 0, 3000, 3000] } },
        { name: 'wall_move', input: { wall: '不存在的墙', direction: 'east', distance: 100 } },
      ],
    });
    expect(r.ok).toBe(false);
    expect(h.session.project).toBe(before);
  });

  it('输入不合法时给出可读的错误', async () => {
    const r = await h.call('wall_move', { wall: 1 });
    expect(r.error?.code).toBe('invalid-input');
  });
});

describe('在方案十上修改', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness(sample());
  });

  it('按名称找到对象，重名时要求消歧', async () => {
    const r = await h.ok('get_object', { ref: '一层·老人房一' });
    expect((r.result as any).netArea).toBeGreaterThan(10);
    const amb = await h.call('get_object', { ref: '楼梯' });
    expect(amb.error?.code).toBe('ambiguous-ref');
  });

  it('移墙：两侧空间面积此消彼长，撤销后完全复原', async () => {
    const original = h.session.project;
    const info = (await h.ok('get_object', { ref: '一层·老人房一' })).result as any;
    const west = info.walls.find((w: any) => w.direction === '西');
    const r = await h.ok('wall_move', { wall: west.id, direction: 'west', distance: 300 });
    const changes = r.areaChanges!;
    const old1 = changes.find(c => c.name === '老人房一')!;
    const old2 = changes.find(c => c.name === '老人房二')!;
    expect(old1.after! - old1.before!).toBeGreaterThan(0.9);
    expect(old2.after! - old2.before!).toBeLessThan(-0.9);
    h.session.undo();
    expect(h.session.project).toEqual(original);
  });

  it('调面积：老人房一到 12 m²', async () => {
    const r = await h.ok('space_set_area', { space: '一层·老人房一', area: 12 });
    const s = h.session.project.spaces.find(x => x.id === (r.result as any).space)!;
    expect(spaceNetArea(h.session.project, s)).toBeCloseTo(12, 0);
    expect(Math.abs(spaceNetArea(h.session.project, s) - 12)).toBeLessThan(0.15);
  });

  it('拆承重墙会被拦下，提示专业复核', async () => {
    const w = h.session.project.walls.find(x => x.kind === 'bearing')!;
    const r = await h.call('wall_remove', { wall: w.id });
    expect(r.error?.code).toBe('structural');
  });
});

describe('约束', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(async () => {
    h = harness(createProject({ id: 't', name: '测试' }));
    await h.ok('room_add', { level: 'L1', name: '卧室', rect: [0, 0, 4000, 4000], door: { side: 'south' } });
    await h.ok('room_add', { level: 'L1', name: '书房', rect: [4000, 0, 3000, 4000] });
  });

  it('门居中：移墙后门自动回到中线', async () => {
    const door = h.session.project.walls.flatMap(w => w.openings).find(o => o.kind === 'door')!;
    await h.ok('constraint_add', { type: 'center', targets: [door.id, '卧室'], note: '门在房间中线上' });
    await h.ok('wall_move', { wall: '卧室西墙', direction: 'west', distance: 1000 });
    const after = h.session.project.walls.flatMap(w => w.openings).find(o => o.id === door.id)!;
    const wall = h.session.project.walls.find(w => w.openings.some(o => o.id === door.id))!;
    // 卧室现在 x ∈ [-1000, 4000]，门中心应在 x = 1500
    expect(openingCenter(wall, after)[0]).toBe(1500);
  });

  it('硬面积目标：会让面积跑出范围的操作被拒绝', async () => {
    // 加约束时求解器会先把书房调到目标面积
    await h.ok('constraint_add', { type: 'size-target', targets: ['书房', '书房东墙'], params: { area: 10.5, tolerance: 0.3 }, hard: true });
    const s = h.session.project.spaces.find(x => x.name === '书房')!;
    expect(Math.abs(spaceNetArea(h.session.project, s) - 10.5)).toBeLessThan(0.3);
    // 亲手把这面墙往里挪 1 米：用户的操作不被拉回，硬约束不满足，整笔拒绝
    const r = await h.call('wall_move', { wall: '书房东墙', direction: 'west', distance: 1000 });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('constraint-violated');
  });

  it('对齐：挪了一面，另一面跟着走', async () => {
    await h.ok('room_add', { level: 'L1', name: '卫生间', rect: [7000, 0, 2000, 4000] });
    await h.ok('constraint_add', { type: 'align', targets: ['卧室南墙', '卫生间南墙'] });
    await h.ok('wall_move', { wall: '卧室南墙', direction: 'south', distance: 500 });
    const a = h.session.project.walls.find(w => w.name.startsWith('卧室南墙'))!;
    const b = h.session.project.walls.find(w => w.name.startsWith('卫生间南墙'))!;
    expect(b.start[1]).toBe(a.start[1]);
  });
});

describe('能力清单', () => {
  it('每项能力都有说明、权限、可导出的输入格式', () => {
    for (const c of registry.list()) {
      expect(c.description.length, c.name).toBeGreaterThan(5);
      expect(['read', 'reversible', 'main', 'external']).toContain(c.permission);
    }
    const found = registry.search('面积');
    expect(found.map(f => f.name)).toContain('space_set_area');
    expect(found[0].input).toHaveProperty('type', 'object');
  });
});
