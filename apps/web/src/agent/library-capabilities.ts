/**
 * Look libraries for the agent: list them, read a look to copy it into the design (look_import), and save a look of the design
 * to a library. Run in the browser, which calls the API as the user; the server only uses the definitions.
 */
import { defineRead, type CapabilityContext } from '@plinth/core';
import { z } from 'zod';
import { m } from '@/lib/i18n';
import type { LibraryDetail, LibrarySummary, LookTypeDef } from '@/shared/looks';

/** Implemented by the editor and injected into CapabilityContext.host.libraries */
export interface LibrariesHost {
  list(): Promise<LibrarySummary[]>;
  get(id: string): Promise<LibraryDetail>;
  save(library: string, look: { name: string; for: string[]; recipe: unknown; types?: Record<string, LookTypeDef> }, lookId?: string): Promise<{ look: string; version: number }>;
}

const host = (ctx: CapabilityContext) => {
  const h = ctx.host?.libraries as LibrariesHost | undefined;
  if (!h) throw new Error(m.server_err_view_needs_browser());
  return h;
};

export const libraryList = defineRead({
  name: 'library_list', title: 'List look libraries', kind: 'query', permission: 'read', runtime: 'browser',
  description: 'List the look libraries the user can use (their own and shared ones), each with its looks (ID, name, what they draw, version). Copy one into the design with library_look_get then look_import.',
  input: z.object({}),
  run: async (_, ctx) => {
    const libs = await host(ctx).list();
    return Promise.all(libs.map(async l => ({
      id: l.id, name: l.name, role: l.role,
      looks: (await host(ctx).get(l.id)).looks.map(k => ({ look: k.look_id, name: k.name, for: k.for, version: k.version })),
    })));
  },
});

export const libraryLookGet = defineRead({
  name: 'library_look_get', title: 'Read a look in a library', kind: 'query', permission: 'read', runtime: 'browser',
  description: 'Read a look in a library (its recipe and the furniture types it needs), to pass to look_import as is with source { library, look, version }.',
  input: z.object({ library: z.string().describe('Library ID'), look: z.string().describe('Look ID in the library') }),
  run: async (i, ctx) => {
    const k = (await host(ctx).get(i.library)).looks.find(x => x.look_id === i.look);
    if (!k) throw new Error(m.agent_err_look_not_found({ look: i.look }));
    return { name: k.name, for: k.for, recipe: k.recipe, types: k.types, source: { library: i.library, look: k.look_id, version: k.version } };
  },
});

export const librarySave = defineRead({
  name: 'library_save', title: 'Save a look to a library', kind: 'relation', permission: 'reversible', runtime: 'browser',
  description: 'Save a look of the design to a look library the user can edit (a look copied from that library gets a new version there). Then call look_import with the returned source and replace set to the design look, so the design knows where its copy lives.',
  input: z.object({ look: z.string().describe('ID or name of a look of the design'), library: z.string().describe('Library ID') }),
  run: async (i, ctx) => {
    const p = ctx.session.project, looks = p.library.looks ?? {};
    const id = looks[i.look] ? i.look : Object.entries(looks).find(([, l]) => l.name === i.look)?.[0];
    if (!id) throw new Error(m.agent_err_look_not_found({ look: i.look }));
    const look = looks[id];
    const types = Object.fromEntries(look.for.map(t => t.split(':')).filter(([k, type]) => k === 'furniture' && p.library.furniture[type]).map(([, type]) => [type, p.library.furniture[type]]));
    const r = await host(ctx).save(i.library, { name: look.name, for: look.for, recipe: look.recipe, types }, look.source?.library === i.library ? look.source.look : undefined);
    return { designLook: id, source: { library: i.library, look: r.look, version: r.version } };
  },
});

export const LIBRARY_CAPABILITIES = [libraryList, libraryLookGet, librarySave];
