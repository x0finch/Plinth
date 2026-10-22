import { SCHEMA, SCHEMA_VERSION, type Project } from './schema.js';

/**
 * When the schema is upgraded, add a step here: MIGRATIONS[n] converts version n data to version n+1.
 * Old samples therefore always load, and changing the schema costs just one function.
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
