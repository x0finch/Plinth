/**
 * 能力清单：界面、内置 agent、将来的 MCP 只调用这里登记的能力。
 * 每项能力：已登记（名称、说明、输入格式、权限等级、范例）、输入输出都是 JSON、标注运行要求。
 */
import { z } from 'zod';
import { TxError, type Actor, type Session, type TxResult } from './session.js';
import type { Project } from './schema.js';

/** 权限等级，对应 agent 的自主程度 */
export type Permission = 'read' | 'reversible' | 'main' | 'external';
export type CapabilityKind = 'query' | 'edit' | 'relation' | 'verify' | 'view';
/** any：核心包即可运行；browser：需要浏览器（渲染、截图） */
export type Runtime = 'any' | 'browser';

export interface CapabilityContext {
  session: Session;
  actor: Actor;
  /** 浏览器运行时注入的扩展上下文（视图、截图） */
  host?: Record<string, unknown>;
}

interface Base<I extends z.ZodType> {
  name: string;
  title: string;
  description: string;
  kind: CapabilityKind;
  permission: Permission;
  runtime: Runtime;
  input: I;
  examples?: { input: z.input<I>; note: string }[];
}

/** 修改类：在事务里改数据 */
export interface EditCapability<I extends z.ZodType = z.ZodType, R = unknown> extends Base<I> {
  mode: 'edit';
  /** 写进操作日志的一句话 */
  label: (input: z.output<I>, p: Project) => string;
  apply: (draft: Project, input: z.output<I>, ctx: CapabilityContext) => R;
}

/** 查询类或宿主类：只读或作用于视图 */
export interface ReadCapability<I extends z.ZodType = z.ZodType, R = unknown> extends Base<I> {
  mode: 'read';
  run: (input: z.output<I>, ctx: CapabilityContext) => R | Promise<R>;
}

export type Capability = EditCapability<any, any> | ReadCapability<any, any>;

export const defineEdit = <I extends z.ZodType, R>(c: Omit<EditCapability<I, R>, 'mode'>): EditCapability<I, R> => ({ ...c, mode: 'edit' });
export const defineRead = <I extends z.ZodType, R>(c: Omit<ReadCapability<I, R>, 'mode'>): ReadCapability<I, R> => ({ ...c, mode: 'read' });

export interface CallResult {
  ok: boolean;
  /** 修改类的结果 */
  result?: unknown;
  error?: { code: string; message: string; details?: unknown };
  changed?: string[];
  warnings?: { code: string; message: string; targets: string[] }[];
  areaChanges?: TxResult['areaChanges'];
}

export class Registry {
  private map = new Map<string, Capability>();

  constructor(caps: Capability[] = []) {
    for (const c of caps) this.register(c);
  }

  register(c: Capability) {
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(c.name)) throw new Error(`能力名不合法：${c.name}`);
    if (this.map.has(c.name)) throw new Error(`能力重复登记：${c.name}`);
    this.map.set(c.name, c);
    return this;
  }

  get(name: string) {
    return this.map.get(name);
  }

  list() {
    return [...this.map.values()];
  }

  /** 按关键词搜索：名称、标题、说明里出现的词越多越靠前 */
  search(query: string, limit = 10) {
    const words = query.toLowerCase().split(/[\s,，、]+/).filter(Boolean);
    return this.list()
      .map(c => {
        const hay = `${c.name} ${c.title} ${c.description}`.toLowerCase();
        return { c, score: words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0) };
      })
      .filter(x => x.score > 0 || !words.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => describe(x.c));
  }

  /** 调用：校验输入 → 修改类走事务 → 返回可序列化结果 */
  async call(name: string, raw: unknown, ctx: CapabilityContext): Promise<CallResult> {
    const c = this.map.get(name);
    if (!c) return { ok: false, error: { code: 'unknown-capability', message: `没有名为 ${name} 的能力` } };
    const parsed = c.input.safeParse(raw ?? {});
    if (!parsed.success) {
      return { ok: false, error: { code: 'invalid-input', message: z.prettifyError(parsed.error) } };
    }
    try {
      if (c.mode === 'read') return { ok: true, result: await c.run(parsed.data, ctx) };
      const tx = ctx.session.transact(c.label(parsed.data, ctx.session.project), ctx.actor, d => c.apply(d, parsed.data, ctx));
      if (!tx.ok) return { ok: false, error: { code: tx.error!.code, message: tx.error!.message, details: tx.error!.issues } };
      return {
        ok: true,
        result: tx.result,
        changed: tx.changed,
        warnings: tx.warnings.map(({ code, message, targets }) => ({ code, message, targets })),
        areaChanges: tx.areaChanges,
      };
    } catch (e) {
      if (e instanceof TxError) return { ok: false, error: { code: e.code, message: e.message } };
      return { ok: false, error: { code: 'internal', message: e instanceof Error ? e.message : String(e) } };
    }
  }
}

export function describe(c: Capability) {
  return {
    name: c.name,
    title: c.title,
    description: c.description,
    kind: c.kind,
    permission: c.permission,
    runtime: c.runtime,
    input: z.toJSONSchema(c.input, { io: 'input', unrepresentable: 'any' }),
    examples: c.examples ?? [],
  };
}
