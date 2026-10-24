import { text } from './i18n.js';
import { upgradeLegacyStairs } from './legacy/stairs.js';
import { normalizeRecipe } from './recipe-convert.js';
import { SCHEMA, SCHEMA_VERSION, type Project } from './schema.js';

/**
 * When the schema is upgraded, add a step here: MIGRATIONS[n] converts version n data to version n+1.
 * Old samples therefore always load, and changing the schema costs just one function.
 */
const MIGRATIONS: Record<number, (doc: any) => any> = {
  // v2 adds the project language; all data before it was written in Chinese
  1: doc => ({ ...doc, language: doc.language ?? 'zh' }),
  // v3: the legacy page's stair becomes proper U-shaped stairs, one per storey
  2: doc => upgradeLegacyStairs(doc),
  // v4 adds looks (library.looks, library.use, an object's own look); all optional, nothing to convert
  3: doc => doc,
  // v5: recipes are JSONata scripts; looks stored as part lists become scripts that build the same parts
  4: doc => !doc.library?.looks ? doc : {
    ...doc,
    library: { ...doc.library, looks: Object.fromEntries(Object.entries(doc.library.looks).map(([id, l]: [string, any]) => [id, { ...l, recipe: normalizeRecipe(l.recipe) }])) },
  },
  // v6 adds look parameter values on furniture, openings and elements (lookParams); optional, nothing to convert
  5: doc => doc,
};

export class SchemaError extends Error {}

export function migrate(doc: unknown): Project {
  const d = doc as any;
  if (!d || d.schema !== SCHEMA) throw new SchemaError(text('schema_not_plinth', 'Not a Plinth project file (schema should be {schema})', { schema: SCHEMA }));
  if (typeof d.version !== 'number') throw new SchemaError(text('schema_no_version', 'Missing version'));
  if (d.version > SCHEMA_VERSION)
    throw new SchemaError(text('schema_too_new', 'File version {version} is newer than this app supports ({current}); please upgrade', { version: d.version, current: SCHEMA_VERSION }));
  let cur = d;
  for (let v = d.version; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new SchemaError(text('schema_no_migration', 'Missing migration from v{from} to v{to}', { from: v, to: v + 1 }));
    cur = { ...step(cur), version: v + 1 };
  }
  return cur as Project;
}
