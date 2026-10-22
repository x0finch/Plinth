// 生成 Better Auth 的建表 SQL：npm run auth:migration
import { writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { NodeSqliteDialect } from '@better-auth/kysely-adapter/node-sqlite-dialect';
import { getMigrations } from 'better-auth/db/migration';
import { schemaPlugins } from '../src/server/auth-schema';

const { compileMigrations } = await getMigrations({
  database: { dialect: new NodeSqliteDialect({ database: new DatabaseSync(':memory:') }), type: 'sqlite' },
  plugins: schemaPlugins(),
});
const sql = await compileMigrations();
writeFileSync(new URL('../migrations/0001_auth.sql', import.meta.url), `-- 由 scripts/auth-migration.ts 生成，勿手改\n${sql}\n`);
console.log(sql);
