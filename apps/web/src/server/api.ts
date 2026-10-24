/** Server API (Hono). Pages are served by the static assets layer; only /api/* comes here. */
import {
  buildRecipe, checkRecipe, createProject as newProjectData, DEFAULT_LIBRARY, FURNITURE_TYPES, libraryLookSchema, lookRecipeOf, materialOf, materialSchema, migrate, namesOf, normalizeParams,
  normalizeRecipe, parseLibrary, typicalSize, validate, type LookLibrary, type Material, type Project, type ValidationIssue,
} from '@plinth/core';
import { env } from 'cloudflare:workers';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import sample from '../../../../samples/wushi-10/project.json';
import { auth, googleEnabled } from './auth';
import { mailEnabled } from './mail';
import { handleChat } from './chat';
import { decryptSecret, encryptSecret, keyHint } from './crypto';
import { getLocale, m, uiName } from '@/lib/i18n';
import { PROVIDERS, localizedProviders } from './providers';
import { builtinDetail, builtinSummaries, builtinVersions, isBuiltinLibrary } from './builtin-libraries';
import * as repo from './repo';
import { COMMENT_STATUSES } from '@/shared/comments';
import { can, SHARE_ROLES, type Role } from '@/shared/roles';
import type { LibraryDetail, LibraryLookInput, LibraryRole } from '@/shared/looks';

type User = { id: string; name: string; email: string; isAnonymous?: boolean | null; image?: string | null };
type Vars = { user: User | null };
type C = Context<{ Variables: Vars }>;

export const api = new Hono<{ Variables: Vars }>().basePath('/api');

const ip = (c: C) => c.req.header('cf-connecting-ip') ?? 'local';

async function limit(binding: RateLimit | undefined, key: string) {
  if (!binding) return;
  const { success } = await binding.limit({ key });
  if (!success) throw new HTTPException(429, { message: m.server_err_rate_limited() });
}

api.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: m.server_err_internal() }, 500);
});

// Auth: rate-limit OTP sending and sign-in endpoints
api.on(['GET', 'POST'], '/auth/*', async c => {
  if (c.req.method === 'POST' && /email-otp|sign-in|sign-up/.test(c.req.path)) await limit(env.RL_AUTH, ip(c));
  return auth().handler(c.req.raw);
});

// Session: cached in a signed cookie, so most requests skip the database
const session: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const s = await auth().api.getSession({ headers: c.req.raw.headers });
  c.set('user', (s?.user as User) ?? null);
  await limit(env.RL_API, s?.user.id ?? ip(c));
  await next();
};
api.use('/*', session);

const requireUser = (c: C) => {
  const u = c.get('user');
  if (!u) throw new HTTPException(401, { message: m.server_err_sign_in_required() });
  return u;
};

/** Routes under /projects/:id; each one declares the minimum role it needs with minRole() */
type ProjectEnv = { Variables: Vars & { projectId: string; role: Role } };
const project = new Hono<ProjectEnv>();

/** Let only project members with at least this role through (404 for non-members, 403 for too low a role) */
const minRole = (min: Role): MiddlewareHandler<ProjectEnv> => async (c, next) => {
  const id = c.req.param('id')!;
  const role = await repo.getRole(id, c.get('user')?.id ?? null);
  if (!can(role, min)) throw new HTTPException(role ? 403 : 404, { message: role ? m.server_err_forbidden() : m.server_err_project_not_accessible() });
  c.set('projectId', id);
  c.set('role', role!);
  await next();
};

const body = async <T extends z.ZodType>(c: Pick<Context, 'req'>, schema: T): Promise<z.output<T>> => {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
  return parsed.data;
};

const MAX_CONTENT = 1_500_000;
function checkContent(json: unknown): Project {
  try {
    return migrate(json);
  } catch (e) {
    throw new HTTPException(400, { message: e instanceof Error ? e.message : m.server_err_invalid_project_data() });
  }
}

/** Stored project content as the current schema has it: what was saved before a schema change is migrated as it is read */
const stored = (raw: string): Project => migrate(JSON.parse(raw));

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    throw new HTTPException(400, { message: m.server_err_invalid_json() });
  }
};

const issueKey = (i: ValidationIssue) => `${i.path}\n${i.message}`;

/**
 * Reject structurally invalid data (duplicate IDs, missing levels, zero-length walls…). Only issues the base version
 * didn't already have are rejected, so a project saved before this check can still be edited.
 */
async function checkStructure(id: string, base: number, content: Project) {
  const issues = validate(content);
  if (!issues.length) return;
  const prev = await repo.getVersion(id, base);
  const known = new Set(prev ? validate(checkContent(JSON.parse(prev.content))).map(issueKey) : []);
  const fresh = issues.filter(i => !known.has(issueKey(i)));
  if (fresh.length) {
    throw new HTTPException(400, { message: m.server_err_project_invalid({ issues: fresh.slice(0, 5).map(i => `${i.path}: ${i.message}`).join('; ') }) });
  }
}

// ---------- Account ----------

api.get('/me', async c => {
  const u = c.get('user');
  if (u && !u.isAnonymous) await repo.acceptInvites(u.id, u.email);
  return c.json({ user: u, googleEnabled: googleEnabled(), mailEnabled: mailEnabled() });
});

api.get('/account/export', async c => {
  const u = requireUser(c);
  const data = await repo.exportUserData(u.id);
  return c.json(data, 200, { 'Content-Disposition': `attachment; filename="plinth-export-${new Date().toISOString().slice(0, 10)}.json"` });
});

// ---------- Projects ----------

api.get('/projects', async c => c.json(await repo.listProjects(requireUser(c).id)));

api.post('/projects', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({ name: z.string().trim().min(1).max(60), template: z.enum(['blank', 'sample']).default('blank'), floors: z.number().int().min(1).max(6).default(1) }));
  const id = repo.newId('p');
  const data: Project = b.template === 'sample'
    ? { ...(structuredClone(sample) as unknown as Project), id, name: b.name }
    : newProjectData({ id, name: b.name, floors: b.floors, language: getLocale() === 'en' ? 'en' : 'zh' });
  await repo.createProject(u.id, id, b.name, JSON.stringify(data), b.template === 'sample' ? m.server_version_from_sample() : m.server_version_blank());
  return c.json({ id });
});

project.get('/', minRole('viewer'), async c => {
  const id = c.var.projectId;
  const role = c.var.role;
  const [p, v] = await Promise.all([repo.getProject(id), repo.getVersion(id)]);
  if (!p || !v) throw new HTTPException(404, { message: m.server_err_project_not_found() });
  // Editors chat with the owner's models; everyone else doesn't need the list
  const models = can(role, 'editor') ? await repo.listModels(p.owner_id) : [];
  return c.json({
    id: p.id, name: p.name, role, version: v.version, ownerId: p.owner_id,
    models: models.map(x => ({ id: x.id, label: x.label, provider: x.provider, model: x.model })),
    projectModelId: models.some(x => x.id === p.model_config_id) ? p.model_config_id : null,
    defaultModelId: models.length ? await repo.defaultModelId(p.owner_id, models) : null,
    content: stored(v.content),
  });
});

project.put('/', minRole('editor'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  const raw = await c.req.text();
  if (raw.length > MAX_CONTENT) throw new HTTPException(413, { message: m.server_err_project_too_large() });
  const parsed = z.object({
    base: z.number().int(), summary: z.string().max(200).default(() => m.server_version_saved()), content: z.unknown(),
    /** A deliberate save (e.g. restoring a version) that must not absorb the version before it */
    checkpoint: z.boolean().optional(),
  }).safeParse(parseJson(raw));
  if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
  const b = parsed.data;
  const content = checkContent(b.content);
  await checkStructure(id, b.base, content);
  const version = await repo.saveVersion(id, user.id, b.base, JSON.stringify(content), b.summary, { name: content.name, checkpoint: b.checkpoint });
  if (!version) {
    const head = await repo.getVersion(id);
    return c.json({ error: m.server_err_save_conflict(), conflict: true, version: head?.version, content: head && stored(head.content) }, 409);
  }
  return c.json({ version });
});

project.patch('/', minRole('editor'), async c => {
  const id = c.var.projectId;
  const b = await body(c, z.object({ name: z.string().trim().min(1).max(60) }));
  await repo.renameProject(id, b.name);
  return c.json({ ok: true });
});

project.delete('/', minRole('owner'), async c => {
  const id = c.var.projectId;
  await repo.deleteProject(id);
  return c.json({ ok: true });
});

project.put('/thumbnail', minRole('editor'), async c => {
  const id = c.var.projectId;
  const svg = await c.req.text();
  if (svg.length > 200_000 || !svg.startsWith('<svg')) throw new HTTPException(400, { message: m.server_err_invalid_thumbnail() });
  await repo.setThumbnail(id, svg);
  return c.json({ ok: true });
});

project.get('/versions', minRole('viewer'), async c => {
  const id = c.var.projectId;
  return c.json(await repo.listVersions(id));
});

project.get('/versions/:v', minRole('viewer'), async c => {
  const id = c.var.projectId;
  const v = await repo.getVersion(id, Number(c.req.param('v')));
  if (!v) throw new HTTPException(404, { message: m.server_err_version_not_found() });
  return c.json({ ...v, content: stored(v.content) });
});

// ---------- Members, share links, invites ----------

const zShareRole = z.enum(SHARE_ROLES);

project.get('/sharing', minRole('viewer'), async c => {
  const id = c.var.projectId;
  const role = c.var.role;
  const [members, links, invites] = await Promise.all([
    repo.listMembers(id),
    role === 'owner' ? repo.listShareLinks(id) : [],
    role === 'owner' ? repo.listInvites(id) : [],
  ]);
  return c.json({ members, links, invites });
});

project.post('/links', minRole('owner'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  const b = await body(c, z.object({ role: zShareRole }));
  return c.json({ token: await repo.createShareLink(id, b.role, user.id) });
});

project.delete('/links/:token', minRole('owner'), async c => {
  const id = c.var.projectId;
  await repo.revokeShareLink(id, c.req.param('token'));
  return c.json({ ok: true });
});

project.post('/invites', minRole('owner'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  const b = await body(c, z.object({ email: z.email(), role: zShareRole }));
  return c.json({ id: await repo.createInvite(id, b.email, b.role, user.id) });
});

project.delete('/invites/:inviteId', minRole('owner'), async c => {
  const id = c.var.projectId;
  await repo.deleteInvite(id, c.req.param('inviteId'));
  return c.json({ ok: true });
});

project.patch('/members/:userId', minRole('owner'), async c => {
  const id = c.var.projectId;
  const b = await body(c, z.object({ role: zShareRole }));
  await repo.setMemberRole(id, c.req.param('userId'), b.role);
  return c.json({ ok: true });
});

project.delete('/members/:userId', minRole('viewer'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  const target = c.req.param('userId');
  // The owner can remove others; anyone can leave
  if (target !== user.id && !can(c.var.role, 'owner')) throw new HTTPException(403, { message: m.server_err_forbidden() });
  await repo.removeMember(id, target);
  return c.json({ ok: true });
});

api.get('/share/:token', async c => {
  const link = await repo.getShareLink(c.req.param('token'));
  if (!link) throw new HTTPException(404, { message: m.server_err_link_expired() });
  return c.json({ projectId: link.project_id, name: link.name, role: link.role });
});

api.post('/share/:token/accept', async c => {
  const u = requireUser(c);
  const link = await repo.getShareLink(c.req.param('token'));
  if (!link) throw new HTTPException(404, { message: m.server_err_link_expired() });
  const role = await repo.upsertMember(link.project_id, u.id, link.role);
  return c.json({ projectId: link.project_id, role });
});

// ---------- Comments ----------

project.get('/comments', minRole('viewer'), async c => {
  const id = c.var.projectId;
  return c.json(await repo.listComments(id));
});

project.post('/comments', minRole('commenter'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  const b = await body(c, z.object({
    body: z.string().trim().min(1).max(2000), targetId: z.string().max(100).nullish(), targetName: z.string().max(100).nullish(),
    parentId: z.string().max(40).nullish(), status: z.enum(['open', 'pending-confirm']).optional(),
  }));
  return c.json({ id: await repo.addComment(id, user.id, b) });
});

project.patch('/comments/:cid', minRole('commenter'), async c => {
  const id = c.var.projectId;
  const b = await body(c, z.object({ status: z.enum(COMMENT_STATUSES) }));
  await repo.setCommentStatus(id, c.req.param('cid'), b.status);
  return c.json({ ok: true });
});

project.delete('/comments/:cid', minRole('commenter'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  const role = c.var.role;
  const cm = await repo.getComment(id, c.req.param('cid'));
  if (!cm) throw new HTTPException(404, { message: m.server_err_comment_not_found() });
  if (cm.author_id !== user.id && role !== 'owner') throw new HTTPException(403, { message: m.server_err_comment_delete_own_only() });
  await repo.deleteComment(id, cm.id);
  return c.json({ ok: true });
});

// ---------- API keys and models ----------

api.get('/models', async c => {
  const u = requireUser(c);
  const [keys, models] = await Promise.all([repo.listApiKeys(u.id), repo.listModels(u.id)]);
  return c.json({ keys, models, defaultModelId: await repo.defaultModelId(u.id, models), providers: localizedProviders() });
});

const modelName = z.string().trim().min(1).max(100);

api.post('/keys', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({
    provider: z.enum(Object.keys(PROVIDERS) as [string, ...string[]]), apiKey: z.string().trim().min(8).max(400), baseUrl: z.url().max(300).nullish(),
    // The first model to use with the key, so a new key is usable in one step
    model: modelName.optional(),
  }));
  if (PROVIDERS[b.provider].needsBaseUrl && !b.baseUrl) throw new HTTPException(400, { message: m.server_err_base_url_required() });
  const id = repo.newId('k');
  const { ciphertext, iv } = await encryptSecret(b.apiKey, id);
  await repo.insertApiKey({
    id, user_id: u.id, provider: b.provider, base_url: b.baseUrl ?? null,
    key_ciphertext: ciphertext, key_iv: iv, key_hint: keyHint(b.apiKey), created_at: Date.now(),
  });
  const modelId = b.model ? repo.newId('l') : null;
  if (modelId) await repo.insertModel({ id: modelId, user_id: u.id, key_id: id, label: b.model!, model: b.model! });
  return c.json({ id, modelId });
});

api.delete('/keys/:id', async c => {
  await repo.deleteApiKey(requireUser(c).id, c.req.param('id'));
  return c.json({ ok: true });
});

api.post('/models', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({ keyId: z.string(), model: modelName, label: z.string().trim().min(1).max(40).optional() }));
  const key = await repo.getApiKey(b.keyId);
  if (!key || key.user_id !== u.id) throw new HTTPException(400, { message: m.server_err_key_not_owned() });
  const id = repo.newId('l');
  await repo.insertModel({ id, user_id: u.id, key_id: key.id, label: b.label ?? b.model, model: b.model });
  return c.json({ id });
});

api.put('/models/default', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({ modelId: z.string() }));
  const model = await repo.getModel(b.modelId);
  if (!model || model.user_id !== u.id) throw new HTTPException(400, { message: m.server_err_model_config_not_owned() });
  await repo.setDefaultModel(u.id, model.id);
  return c.json({ ok: true });
});

api.delete('/models/:id', async c => {
  await repo.deleteModel(requireUser(c).id, c.req.param('id'));
  return c.json({ ok: true });
});

/** Pin a model for the project (shared members use it too); null goes back to the owner's default */
project.put('/model', minRole('owner'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  const b = await body(c, z.object({ modelConfigId: z.string().nullable() }));
  if (b.modelConfigId) {
    const model = await repo.getModel(b.modelConfigId);
    if (!model || model.user_id !== user.id) throw new HTTPException(400, { message: m.server_err_model_config_not_owned() });
  }
  await repo.setProjectModel(id, b.modelConfigId);
  return c.json({ ok: true });
});

project.get('/usage', minRole('owner'), async c => {
  const id = c.var.projectId;
  return c.json(await repo.projectUsage(id));
});

// ---------- agent ----------

project.post('/chat', minRole('editor'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  await limit(env.RL_CHAT, user.id);
  const p = await repo.getProject(id);
  if (!p) throw new HTTPException(404, { message: m.server_err_project_not_found() });
  return handleChat(c.req.raw, async requested => {
    // The model picked in the chat, else the project's pinned model, else the owner's default; always one of the owner's
    const models = await repo.listModels(p.owner_id);
    const has = (x: string | null | undefined) => (x && models.some(o => o.id === x) ? x : null);
    const modelId = has(requested) ?? has(p.model_config_id) ?? await repo.defaultModelId(p.owner_id, models);
    const config = modelId ? await repo.getModel(modelId) : null;
    if (!config) throw new HTTPException(400, { message: m.server_err_no_model() });
    return {
      config,
      apiKey: await decryptSecret(config.key_ciphertext, config.key_iv, config.key_id),
      onUsage: (input, output) => repo.recordUsage({ userId: user.id, projectId: id, modelConfigId: config.id, input, output }),
    };
  });
});

project.get('/chat-thread', minRole('viewer'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  const t = await repo.getChat(id, user.id);
  let messages: unknown = [];
  try {
    if (t) messages = JSON.parse(t.messages);
  } catch {
    // A corrupt stored thread starts over instead of failing the editor
  }
  return c.json(Array.isArray(messages) ? messages : []);
});

project.put('/chat-thread', minRole('editor'), async c => {
  const id = c.var.projectId;
  const user = c.var.user!;
  const raw = await c.req.text();
  if (raw.length > 800_000) throw new HTTPException(413, { message: m.server_err_chat_too_long() });
  if (!Array.isArray(parseJson(raw))) throw new HTTPException(400, { message: m.server_err_invalid_chat() });
  await repo.putChat(id, user.id, raw);
  return c.json({ ok: true });
});

// ---------- Look libraries ----------

/** A look as the client sends it: the library file's look without a version, with the materials it brings; a plain name is accepted */
const zLibraryLook = z.object({ name: z.union([z.string().min(1).max(80), z.record(z.string(), z.string())]), materials: z.record(z.string(), materialSchema).optional() }).loose();

function parseLook(input: z.output<typeof zLibraryLook>): LibraryLookInput {
  const { materials, ...rest } = input;
  const named = { ...rest, name: typeof rest.name === 'string' ? namesOf(rest.name) : rest.name, version: '1.0.0' };
  if ('recipe' in named) Object.assign(named, normalizeRecipe(named.recipe), { recipe: undefined });
  else if ('params' in named) named.params = normalizeParams(named.params, materials);
  const parsed = libraryLookSchema.safeParse(JSON.parse(JSON.stringify(named)));
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  const { version: _v, ...look } = parsed.data;
  return { ...look, ...(materials ? { materials } : {}) };
}

/**
 * A library look must build for each target it is for, at that target's size, using only materials it can reach (its own, its
 * library's, the default library's)
 */
async function checkLibraryLook(l: LibraryLookInput, libraryMaterials: Record<string, Material> = {}) {
  const recipe = { ...lookRecipeOf({ ...l, version: '1.0.0' }), materials: { ...libraryMaterials, ...l.materials } };
  for (const t of l.for) {
    const [kind, type] = t.split(':');
    if (kind === 'furniture' && !l.newType && !FURNITURE_TYPES[type]) throw new HTTPException(400, { message: m.server_err_library_type({ type }) });
    const size = l.newType?.size ?? typicalSize(t);
    const problems = await checkRecipe(recipe, size);
    if (problems.length) throw new HTTPException(400, { message: problems.join('; ') });
    const built = await buildRecipe(recipe, size);
    const missing = [...new Set(built.parts.flatMap(p => (p.kind === 'base' ? Object.values(p.mats) : [p.mat])))].filter(id => !materialOf(id, recipe));
    if (missing.length) throw new HTTPException(400, { message: `unknown material ${missing.join(', ')}` });
  }
}

/** Save a look to a library, adding the materials it brings to the library's */
async function saveLook(libraryId: string, lookId: string, l: LibraryLookInput, userId: string) {
  const { materials, ...look } = l;
  if (materials) await repo.updateLibraryMeta(libraryId, meta => ({ ...meta, materials: { ...meta.materials, ...materials } }));
  return repo.putLibraryLook(libraryId, lookId, look, userId);
}

/** The library and the caller's role in it, if at least `min` (404 for non-members, 403 for too low a role); built-in libraries are read-only */
async function libraryAccess(c: C, min: LibraryRole) {
  const u = requireUser(c), id = c.req.param('lib')!;
  const role = isBuiltinLibrary(id) ? 'viewer' : await repo.libraryRole(id, u.id);
  const rank = { viewer: 0, editor: 1, owner: 2 };
  if (!role || rank[role] < rank[min]) throw new HTTPException(role ? 403 : 404, { message: role ? m.server_err_forbidden() : m.server_err_library_not_found() });
  return { id, role, user: u };
}

// Built-in libraries first (the default set leads), then the user's own and shared ones
api.get('/libraries', async c => c.json([...builtinSummaries(), ...(await repo.listLibraries(requireUser(c).id))]));

api.post('/libraries', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({ name: z.string().min(1).max(80) }));
  return c.json({ id: await repo.createLibrary(u.id, b.name) });
});

/** Import a library file as a new library of the caller's, keeping its looks' ids */
api.post('/libraries/import', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({ file: z.unknown() }));
  let file: LookLibrary;
  try {
    file = parseLibrary(b.file, DEFAULT_LIBRARY);
  } catch (e) {
    throw new HTTPException(400, { message: m.server_err_library_file({ problem: e instanceof Error ? e.message : String(e) }) });
  }
  const looks = Object.entries(file.looks).map(([k, look]) => [k, { ...look, version: undefined }] as const);
  for (const [, look] of looks) await checkLibraryLook(look as LibraryLookInput, file.materials);
  const { description, version, author, license, groups, materials } = file;
  const id = await repo.createLibrary(u.id, uiName(file.name), JSON.parse(JSON.stringify({ description, version, author, license, groups, materials })));
  for (const [k, { version: _v, ...look }] of looks) await repo.putLibraryLook(id, k, look, u.id);
  return c.json({ id });
});

api.post('/libraries/versions', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({ refs: z.array(z.object({ library: z.string(), look: z.string() })).max(100) }));
  return c.json([...(await repo.lookVersions(u.id, b.refs)), ...builtinVersions(b.refs)]);
});

api.get('/libraries/:lib', async c => {
  const { id, role } = await libraryAccess(c, 'viewer');
  const builtin = builtinDetail(id);
  if (builtin) return c.json(builtin);
  const lib = await repo.getLibrary(id);
  if (!lib) throw new HTTPException(404, { message: m.server_err_library_not_found() });
  return c.json({ ...lib, role } satisfies LibraryDetail);
});

api.patch('/libraries/:lib', async c => {
  const { id } = await libraryAccess(c, 'owner');
  const b = await body(c, z.object({ name: z.string().min(1).max(80) }));
  await repo.renameLibrary(id, b.name);
  return c.json({ ok: true });
});

api.delete('/libraries/:lib', async c => {
  const { id } = await libraryAccess(c, 'owner');
  await repo.deleteLibrary(id);
  return c.json({ ok: true });
});

/** Add a look (new id) */
api.post('/libraries/:lib/looks', async c => {
  const { id, user } = await libraryAccess(c, 'editor');
  const look = parseLook(await body(c, zLibraryLook));
  await checkLibraryLook(look, (await repo.getLibrary(id))?.library.materials);
  const lookId = repo.newId('lk');
  const version = await saveLook(id, lookId, look, user.id);
  return c.json({ look: lookId, version: `${version}.0.0` });
});

/** Save a new version of a look */
api.put('/libraries/:lib/looks/:look', async c => {
  const { id, user } = await libraryAccess(c, 'editor');
  const look = parseLook(await body(c, zLibraryLook));
  await checkLibraryLook(look, (await repo.getLibrary(id))?.library.materials);
  const version = await saveLook(id, c.req.param('look'), look, user.id);
  return c.json({ look: c.req.param('look'), version: `${version}.0.0` });
});

api.delete('/libraries/:lib/looks/:look', async c => {
  const { id } = await libraryAccess(c, 'editor');
  await repo.deleteLibraryLook(id, c.req.param('look'));
  return c.json({ ok: true });
});

/** Share with someone who has an account, as a viewer (uses looks) or an editor (also adds and changes them) */
api.post('/libraries/:lib/members', async c => {
  const { id } = await libraryAccess(c, 'owner');
  const b = await body(c, z.object({ email: z.email(), role: z.enum(['viewer', 'editor']) }));
  const target = await repo.userByEmail(b.email);
  if (!target) throw new HTTPException(404, { message: m.server_err_library_no_user({ email: b.email }) });
  await repo.setLibraryMember(id, target.id, b.role);
  return c.json({ ok: true });
});

api.delete('/libraries/:lib/members/:userId', async c => {
  const { id, role, user } = await libraryAccess(c, 'viewer');
  // The owner removes others; anyone can leave, except a built-in library
  if ((c.req.param('userId') !== user.id && role !== 'owner') || isBuiltinLibrary(id)) throw new HTTPException(403, { message: m.server_err_forbidden() });
  await repo.removeLibraryMember(id, c.req.param('userId'));
  return c.json({ ok: true });
});

// Mounted last: Hono copies a sub-app's routes when it is mounted
api.route('/projects/:id', project);

api.notFound(c => c.json({ error: m.server_err_api_not_found() }, 404));
