/**
 * 编辑会话：所有修改都是事务。流程固定为 校验 → 应用 → 约束重算 → 规则检查 → 写日志，
 * 任何一步失败整笔回滚。撤销 / 重做基于 immer 补丁。
 */
import { applyPatches, current, enablePatches, produceWithPatches, setAutoFreeze, type Patch } from 'immer';
import { areaReport } from './area.js';
import { checkRules, issueKey, type Issue } from './rules.js';
import { solveConstraints, type ConstraintReport } from './constraints.js';
import type { Id, Project } from './schema.js';

enablePatches();
setAutoFreeze(false);

export type Actor = { kind: 'user' | 'agent' | 'external'; id?: string; name?: string };

export interface LogEntry {
  id: number;
  at: string;
  actor: Actor;
  label: string;
  reason?: string;
  changed: Id[];
}

interface HistoryEntry extends LogEntry {
  patches: Patch[];
  inverse: Patch[];
}

export interface AreaChange {
  id: Id;
  name: string;
  level: Id;
  before: number | null;
  after: number | null;
}

export interface TxResult<R = unknown> {
  ok: boolean;
  result?: R;
  error?: { code: string; message: string; issues?: Issue[] };
  /** 被改动的对象 ID，供界面高亮、镜头定位 */
  changed: Id[];
  /** 操作新引入的警告 */
  warnings: Issue[];
  areaChanges: AreaChange[];
  constraints?: ConstraintReport;
}

export class TxError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** 从补丁路径找出被改动的对象 ID */
function changedIds(before: Project, after: Project, patches: Patch[]): Id[] {
  const ids = new Set<Id>();
  for (const p of patches) {
    const [coll, idx, sub, subIdx] = p.path as [string, number, string?, number?];
    const pick = (proj: Project) => {
      const list = (proj as any)[coll];
      if (!Array.isArray(list) || typeof idx !== 'number') return;
      const obj = list[idx];
      if (!obj?.id) return;
      if (sub === 'openings' && typeof subIdx === 'number' && obj.openings[subIdx]) ids.add(obj.openings[subIdx].id);
      ids.add(obj.id);
    };
    pick(before);
    pick(after);
  }
  return [...ids];
}

/** 本次被改了位置的墙和洞口，约束求解时以它们为参照 */
function touchedGeometry(a: Project, b: Project): Id[] {
  const old = new Map(a.walls.map(w => [w.id, w]));
  const out: Id[] = [];
  for (const w of b.walls) {
    const o = old.get(w.id);
    if (!o || o.start.join() !== w.start.join() || o.end.join() !== w.end.join()) out.push(w.id);
    const oo = new Map((o?.openings ?? []).map(x => [x.id, x]));
    for (const op of w.openings) if (oo.get(op.id)?.at !== op.at) out.push(op.id);
  }
  return out;
}

function areaSnapshot(p: Project) {
  const m = new Map<Id, { name: string; level: Id; net: number }>();
  for (const l of areaReport(p).levels) for (const s of l.spaces) m.set(s.id, { name: s.name, level: l.id, net: s.net });
  return m;
}

function diffAreas(a: ReturnType<typeof areaSnapshot>, b: ReturnType<typeof areaSnapshot>): AreaChange[] {
  const out: AreaChange[] = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id), y = b.get(id);
    const before = x ? Math.round(x.net * 100) / 100 : null, after = y ? Math.round(y.net * 100) / 100 : null;
    if (before !== after) out.push({ id, name: (y ?? x)!.name, level: (y ?? x)!.level, before, after });
  }
  return out;
}

export class Session {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private listeners = new Set<(p: Project) => void>();
  private seq = 0;
  readonly log: LogEntry[] = [];

  constructor(public project: Project) {}

  subscribe(fn: (p: Project) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.project);
  }

  /** 替换整个项目（加载新版本），清空历史 */
  load(p: Project) {
    this.project = p;
    this.past = [];
    this.future = [];
    this.emit();
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }

  /** 只读访问：不进事务 */
  read<R>(fn: (p: Project) => R): R {
    return fn(this.project);
  }

  transact<R>(label: string, actor: Actor, recipe: (draft: Project) => R, opts: { reason?: string } = {}): TxResult<R> {
    const before = this.project;
    let result: R | undefined;
    let patches: Patch[], inverse: Patch[], next: Project;
    let constraints: ConstraintReport | undefined;
    try {
      [next, patches, inverse] = produceWithPatches(before, draft => {
        result = recipe(draft as Project);
        constraints = solveConstraints(draft as Project, touchedGeometry(before, current(draft) as Project));
        if (constraints.violatedHard.length) {
          throw new TxError('constraint-violated', `违反硬约束：${constraints.violatedHard.map(c => c.message).join('；')}`);
        }
      });
    } catch (e) {
      if (e instanceof TxError) return { ok: false, error: { code: e.code, message: e.message }, changed: [], warnings: [], areaChanges: [] };
      throw e;
    }
    if (!patches.length) return { ok: true, result, changed: [], warnings: [], areaChanges: [], constraints };

    // 规则检查：只拦新引入的错误，原来就有的问题不阻止修改
    const old = new Set(checkRules(before).map(issueKey));
    const fresh = checkRules(next).filter(i => !old.has(issueKey(i)));
    const errors = fresh.filter(i => i.severity === 'error');
    if (errors.length) {
      return {
        ok: false,
        error: { code: 'rule-violated', message: errors.map(e => e.message).join('；'), issues: errors },
        changed: [], warnings: [], areaChanges: [],
      };
    }

    const changed = changedIds(before, next, patches);
    const entry: HistoryEntry = {
      id: ++this.seq, at: new Date().toISOString(), actor, label, reason: opts.reason, changed, patches, inverse,
    };
    this.project = next;
    this.past.push(entry);
    this.future = [];
    this.log.push({ id: entry.id, at: entry.at, actor, label, reason: opts.reason, changed });
    this.emit();
    return {
      ok: true, result, changed,
      warnings: fresh.filter(i => i.severity === 'warning'),
      areaChanges: diffAreas(areaSnapshot(before), areaSnapshot(next)),
      constraints,
    };
  }

  undo(): LogEntry | null {
    const e = this.past.pop();
    if (!e) return null;
    this.project = applyPatches(this.project, e.inverse);
    this.future.push(e);
    this.emit();
    return e;
  }

  redo(): LogEntry | null {
    const e = this.future.pop();
    if (!e) return null;
    this.project = applyPatches(this.project, e.patches);
    this.past.push(e);
    this.emit();
    return e;
  }
}
