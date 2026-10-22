import { SCHEMA, SCHEMA_VERSION, type Project } from './schema.js';

/**
 * 规范升级时在这里加一步：MIGRATIONS[n] 把 version n 的数据改成 version n+1。
 * 旧样例因此永远能读，改规范的成本只是一个函数。
 */
const MIGRATIONS: Record<number, (doc: any) => any> = {};

export class SchemaError extends Error {}

export function migrate(doc: unknown): Project {
  const d = doc as any;
  if (!d || d.schema !== SCHEMA) throw new SchemaError(`不是 Plinth 项目文件（schema 应为 ${SCHEMA}）`);
  if (typeof d.version !== 'number') throw new SchemaError('缺少 version');
  if (d.version > SCHEMA_VERSION) throw new SchemaError(`文件版本 ${d.version} 比当前核心包（${SCHEMA_VERSION}）新，请升级`);
  let cur = d;
  for (let v = d.version; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new SchemaError(`缺少从 v${v} 到 v${v + 1} 的迁移`);
    cur = { ...step(cur), version: v + 1 };
  }
  return cur as Project;
}
