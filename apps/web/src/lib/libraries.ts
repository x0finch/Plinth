/** Look libraries from the API, and the size a library look is shown at */
import { FURNITURE_TYPES } from '@plinth/core';
import type { LibraryDetail, LibraryLook, LibrarySummary, LookTypeDef } from '@/shared/looks';
import { api } from './api';

export const listLibraries = () => api<LibrarySummary[]>('/libraries');
export const getLibrary = (id: string) => api<LibraryDetail>(`/libraries/${id}`);

/** Save a look to a library: a new one, or a new version of `lookId` */
export const saveToLibrary = (library: string, look: { name: string; for: string[]; recipe: unknown; types?: Record<string, LookTypeDef> }, lookId?: string) =>
  api<{ look: string; version: number }>(lookId ? `/libraries/${library}/looks/${lookId}` : `/libraries/${library}/looks`, { method: lookId ? 'PUT' : 'POST', json: look });

/** Current versions of looks copied from libraries (only the libraries the user can see) */
export const lookVersions = (refs: { library: string; look: string }[]) =>
  api<{ library: string; look: string; version: number; name: string; library_name: string }[]>('/libraries/versions', { method: 'POST', json: { refs } });

/** The size a look is shown at: its furniture type's (catalog or its own), else a typical opening or element */
export function lookSize(look: Pick<LibraryLook, 'for' | 'types'>, furniture: Record<string, { size: { w: number; d: number; h: number } }> = {}) {
  const [kind, type] = look.for[0].split(':');
  if (kind === 'furniture') return look.types?.[type]?.size ?? furniture[type]?.size ?? FURNITURE_TYPES[type]?.size ?? { w: 1000, d: 600, h: 800 };
  return kind === 'opening' ? { w: 1200, d: 240, h: 1500 } : { w: 2000, d: 2000, h: 3000 };
}
