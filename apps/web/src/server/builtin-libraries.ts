/** Built-in look libraries (packages/core/src/looks/builtin.ts) served like libraries every user can view */
import { BUILTIN_LIBRARIES, builtinLibrary } from '@plinth/core';
import { getLocale } from '@/lib/i18n';
import type { LibraryDetail, LibrarySummary } from '@/shared/looks';

const lang = () => (getLocale() === 'en' ? 'en' : 'zh');

export const isBuiltinLibrary = (id: string) => !!builtinLibrary(id);

export const builtinSummaries = (): LibrarySummary[] =>
  BUILTIN_LIBRARIES.map(l => ({ id: l.id, name: l.name[lang()], role: 'viewer', owner_name: 'Plinth', looks: l.looks.length, updated_at: 0, builtin: true }));

export function builtinDetail(id: string): LibraryDetail | null {
  const l = builtinLibrary(id);
  if (!l) return null;
  return {
    id: l.id, name: l.name[lang()], role: 'viewer', builtin: true, members: [],
    looks: l.looks.map(k => ({ look_id: k.id, name: k.name[lang()], for: k.for, recipe: k.recipe, version: k.version, updated_at: 0 })),
  };
}

/** Current versions of built-in looks among `refs` */
export function builtinVersions(refs: { library: string; look: string }[]) {
  return refs.flatMap(r => {
    const l = builtinLibrary(r.library), k = l?.looks.find(x => x.id === r.look);
    return l && k ? [{ library: l.id, look: k.id, version: k.version, name: k.name[lang()], library_name: l.name[lang()] }] : [];
  });
}
