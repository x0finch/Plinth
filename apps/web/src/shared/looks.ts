/** Look libraries as the API returns them (see migrations/0005_look_libraries.sql) */
import type { Recipe } from '@plinth/core';

export type LibraryRole = 'owner' | 'editor' | 'viewer';

export interface LibrarySummary {
  id: string;
  name: string;
  role: LibraryRole;
  owner_name: string;
  looks: number;
  updated_at: number;
  /** Shipped with the app; read-only for everyone */
  builtin?: boolean;
}

/** A furniture type a look draws that the catalog doesn't have */
export interface LookTypeDef {
  name: string;
  group?: string;
  size: { w: number; d: number; h: number };
}

export interface LibraryLook {
  look_id: string;
  name: string;
  for: string[];
  recipe: Recipe;
  types?: Record<string, LookTypeDef>;
  version: number;
  updated_at: number;
}

export interface LibraryDetail {
  id: string;
  name: string;
  role: LibraryRole;
  builtin?: boolean;
  looks: LibraryLook[];
  members: { user_id: string; name: string; email: string; role: LibraryRole }[];
}
