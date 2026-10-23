/**
 * Built-in look libraries served like libraries every user can view: the default set (what objects without a look of their own
 * are drawn with) and the libraries in packages/core/src/looks/builtin.ts
 */
import { BUILTIN_LIBRARIES, builtinLibrary, DEFAULT_LIBRARY_ID, DEFAULT_LOOKS, FURNITURE_TYPES, names } from '@plinth/core';
import { getLocale, m } from '@/lib/i18n';
import type { LibraryDetail, LibrarySummary } from '@/shared/looks';

const lang = () => (getLocale() === 'en' ? 'en' : 'zh');

export const isBuiltinLibrary = (id: string) => id === DEFAULT_LIBRARY_ID || !!builtinLibrary(id);

/** A default look's name: its furniture type's, its kind of opening's, or its element type */
function defaultLookName(target: string) {
  const [kind, type] = target.split(':'), v = names(lang());
  if (kind === 'furniture') return FURNITURE_TYPES[type]?.name[lang()] ?? type;
  if (kind === 'opening') return type === 'glass-block' ? v.glassBlock(v.opening.window) : v.opening[type as keyof typeof v.opening] ?? type;
  return type;
}

export const builtinSummaries = (): LibrarySummary[] => [
  { id: DEFAULT_LIBRARY_ID, name: m.libraries_default_name(), role: 'viewer', owner_name: 'Plinth', looks: Object.keys(DEFAULT_LOOKS).length, updated_at: 0, builtin: true, default: true },
  ...BUILTIN_LIBRARIES.map((l): LibrarySummary => ({ id: l.id, name: l.name[lang()], role: 'viewer', owner_name: 'Plinth', looks: l.looks.length, updated_at: 0, builtin: true })),
];

export function builtinDetail(id: string): LibraryDetail | null {
  if (id === DEFAULT_LIBRARY_ID) {
    return {
      id, name: m.libraries_default_name(), role: 'viewer', builtin: true, default: true, members: [],
      looks: Object.entries(DEFAULT_LOOKS).map(([t, recipe]) => ({ look_id: t, name: defaultLookName(t), for: [t], recipe, version: 1, updated_at: 0 })),
    };
  }
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
