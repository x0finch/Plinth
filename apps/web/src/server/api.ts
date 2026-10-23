/** Server API (Hono). Pages are served by the static assets layer; only /api/* comes here. */
import { createProject as newProjectData, migrate, validate, type Project, type ValidationIssue } from '@plinth/core';
import { env } from 'cloudflare:workers';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import sample from '../../../../samples/wushi-10/project.json';
import { auth, googleEnabled } from './auth';
import { mailEnabled } from './mail';
import { handleChat } from './chat';
import { decryptSecret, encryptSecret, keyHint } from './crypto';
import { getLocale, m } from '@/lib/i18n';
import { PROVIDERS, localizedProviders } from './providers';
import * as repo from './repo';
import { COMMENT_STATUSES } from '@/shared/comments';
import { can, SHARE_ROLES, type Role } from '@/shared/roles';

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

async function requireRole(c: C, projectId: string, min: Role) {
  const u = c.get('user');
  const role = await repo.getRole(projectId, u?.id ?? null);
  if (!can(role, min)) throw new HTTPException(role ? 403 : 404, { message: role ? m.server_err_forbidden() : m.server_err_project_not_accessible() });
  return { user: u!, role: role! };
}

const body = async <T extends z.ZodType>(c: C, schema: T): Promise<z.output<T>> => {
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

api.get('/projects/:id', async c => {
  const id = c.req.param('id');
  const { role } = await requireRole(c, id, 'viewer');
  const [p, v] = await Promise.all([repo.getProject(id), repo.getVersion(id)]);
  if (!p || !v) throw new HTTPException(404, { message: m.server_err_project_not_found() });
  const model = p.model_config_id ? await repo.getModelConfig(p.model_config_id) : null;
  return c.json({
    id: p.id, name: p.name, role, version: v.version, ownerId: p.owner_id,
    model: model && { id: model.id, label: model.label, provider: model.provider, model: model.model },
    content: JSON.parse(v.content),
  });
});

api.put('/projects/:id', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'editor');
  const raw = await c.req.text();
  if (raw.length > MAX_CONTENT) throw new HTTPException(413, { message: m.server_err_project_too_large() });
  const parsed = z.object({ base: z.number().int(), summary: z.string().max(200).default(() => m.server_version_saved()), content: z.unknown() }).safeParse(parseJson(raw));
  if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
  const b = parsed.data;
  const content = checkContent(b.content);
  await checkStructure(id, b.base, content);
  const version = await repo.saveVersion(id, user.id, b.base, JSON.stringify(content), b.summary, content.name);
  if (!version) {
    const head = await repo.getVersion(id);
    return c.json({ error: m.server_err_save_conflict(), conflict: true, version: head?.version, content: head && JSON.parse(head.content) }, 409);
  }
  return c.json({ version });
});

api.patch('/projects/:id', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'editor');
  const b = await body(c, z.object({ name: z.string().trim().min(1).max(60) }));
  await repo.renameProject(id, b.name);
  return c.json({ ok: true });
});

api.delete('/projects/:id', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'owner');
  await repo.deleteProject(id);
  return c.json({ ok: true });
});

api.put('/projects/:id/thumbnail', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'editor');
  const svg = await c.req.text();
  if (svg.length > 200_000 || !svg.startsWith('<svg')) throw new HTTPException(400, { message: m.server_err_invalid_thumbnail() });
  await repo.setThumbnail(id, svg);
  return c.json({ ok: true });
});

api.get('/projects/:id/versions', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'viewer');
  return c.json(await repo.listVersions(id));
});

api.get('/projects/:id/versions/:v', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'viewer');
  const v = await repo.getVersion(id, Number(c.req.param('v')));
  if (!v) throw new HTTPException(404, { message: m.server_err_version_not_found() });
  return c.json({ ...v, content: JSON.parse(v.content) });
});

// ---------- Members, share links, invites ----------

const zShareRole = z.enum(SHARE_ROLES);

api.get('/projects/:id/sharing', async c => {
  const id = c.req.param('id');
  const { role } = await requireRole(c, id, 'viewer');
  const [members, links, invites] = await Promise.all([
    repo.listMembers(id),
    role === 'owner' ? repo.listShareLinks(id) : [],
    role === 'owner' ? repo.listInvites(id) : [],
  ]);
  return c.json({ members, links, invites });
});

api.post('/projects/:id/links', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'owner');
  const b = await body(c, z.object({ role: zShareRole }));
  return c.json({ token: await repo.createShareLink(id, b.role, user.id) });
});

api.delete('/projects/:id/links/:token', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'owner');
  await repo.revokeShareLink(id, c.req.param('token'));
  return c.json({ ok: true });
});

api.post('/projects/:id/invites', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'owner');
  const b = await body(c, z.object({ email: z.email(), role: zShareRole }));
  return c.json({ id: await repo.createInvite(id, b.email, b.role, user.id) });
});

api.delete('/projects/:id/invites/:inviteId', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'owner');
  await repo.deleteInvite(id, c.req.param('inviteId'));
  return c.json({ ok: true });
});

api.patch('/projects/:id/members/:userId', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'owner');
  const b = await body(c, z.object({ role: zShareRole }));
  await repo.setMemberRole(id, c.req.param('userId'), b.role);
  return c.json({ ok: true });
});

api.delete('/projects/:id/members/:userId', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'viewer');
  const target = c.req.param('userId');
  // The owner can remove others; anyone can leave
  if (target !== user.id) await requireRole(c, id, 'owner');
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

api.get('/projects/:id/comments', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'viewer');
  return c.json(await repo.listComments(id));
});

api.post('/projects/:id/comments', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'commenter');
  const b = await body(c, z.object({
    body: z.string().trim().min(1).max(2000), targetId: z.string().max(100).nullish(), targetName: z.string().max(100).nullish(),
    parentId: z.string().max(40).nullish(), status: z.enum(['open', 'pending-confirm']).optional(),
  }));
  return c.json({ id: await repo.addComment(id, user.id, b) });
});

api.patch('/projects/:id/comments/:cid', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'commenter');
  const b = await body(c, z.object({ status: z.enum(COMMENT_STATUSES) }));
  await repo.setCommentStatus(id, c.req.param('cid'), b.status);
  return c.json({ ok: true });
});

api.delete('/projects/:id/comments/:cid', async c => {
  const id = c.req.param('id');
  const { user, role } = await requireRole(c, id, 'commenter');
  const cm = await repo.getComment(id, c.req.param('cid'));
  if (!cm) throw new HTTPException(404, { message: m.server_err_comment_not_found() });
  if (cm.author_id !== user.id && role !== 'owner') throw new HTTPException(403, { message: m.server_err_comment_delete_own_only() });
  await repo.deleteComment(id, cm.id);
  return c.json({ ok: true });
});

// ---------- Model configs ----------

api.get('/models', async c => c.json({ configs: await repo.listModelConfigs(requireUser(c).id), providers: localizedProviders() }));

api.post('/models', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({
    label: z.string().trim().min(1).max(40), provider: z.enum(Object.keys(PROVIDERS) as [string, ...string[]]),
    model: z.string().trim().min(1).max(100), apiKey: z.string().trim().min(8).max(400), baseUrl: z.url().max(300).nullish(),
  }));
  if (PROVIDERS[b.provider].needsBaseUrl && !b.baseUrl) throw new HTTPException(400, { message: m.server_err_base_url_required() });
  const id = repo.newId('k');
  const { ciphertext, iv } = await encryptSecret(b.apiKey, id);
  await repo.insertModelConfig({
    id, user_id: u.id, label: b.label, provider: b.provider, model: b.model, base_url: b.baseUrl ?? null,
    key_ciphertext: ciphertext, key_iv: iv, key_hint: keyHint(b.apiKey), created_at: Date.now(),
  });
  return c.json({ id });
});

api.delete('/models/:id', async c => {
  await repo.deleteModelConfig(requireUser(c).id, c.req.param('id'));
  return c.json({ ok: true });
});

api.put('/projects/:id/model', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'owner');
  const b = await body(c, z.object({ modelConfigId: z.string().nullable() }));
  if (b.modelConfigId) {
    const cfg = await repo.getModelConfig(b.modelConfigId);
    if (!cfg || cfg.user_id !== user.id) throw new HTTPException(400, { message: m.server_err_model_config_not_owned() });
  }
  await repo.setProjectModel(id, b.modelConfigId);
  return c.json({ ok: true });
});

api.get('/projects/:id/usage', async c => {
  const id = c.req.param('id');
  await requireRole(c, id, 'owner');
  return c.json(await repo.projectUsage(id));
});

// ---------- agent ----------

api.post('/projects/:id/chat', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'editor');
  await limit(env.RL_CHAT, user.id);
  const p = await repo.getProject(id);
  if (!p?.model_config_id) throw new HTTPException(400, { message: m.server_err_no_model() });
  const cfg = await repo.getModelConfig(p.model_config_id);
  if (!cfg) throw new HTTPException(400, { message: m.server_err_model_config_deleted() });
  const apiKey = await decryptSecret(cfg.key_ciphertext, cfg.key_iv, cfg.id);
  return handleChat(c.req.raw, {
    config: cfg, apiKey,
    onUsage: (input, output) => repo.recordUsage({ userId: user.id, projectId: id, modelConfigId: cfg.id, input, output }),
  });
});

api.get('/projects/:id/chat-thread', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'viewer');
  const t = await repo.getChat(id, user.id);
  let messages: unknown = [];
  try {
    if (t) messages = JSON.parse(t.messages);
  } catch {
    // A corrupt stored thread starts over instead of failing the editor
  }
  return c.json(Array.isArray(messages) ? messages : []);
});

api.put('/projects/:id/chat-thread', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'editor');
  const raw = await c.req.text();
  if (raw.length > 800_000) throw new HTTPException(413, { message: m.server_err_chat_too_long() });
  if (!Array.isArray(parseJson(raw))) throw new HTTPException(400, { message: m.server_err_invalid_chat() });
  await repo.putChat(id, user.id, raw);
  return c.json({ ok: true });
});

api.notFound(c => c.json({ error: m.server_err_api_not_found() }, 404));
