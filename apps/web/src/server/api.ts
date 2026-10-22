/** 服务端 API：Hono。页面由静态资源层直接返回，只有 /api/* 进这里。 */
import { createProject as newProjectData, migrate, type Project } from '@plinth/core';
import { env } from 'cloudflare:workers';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import sample from '../../../../samples/wushi-10/project.json';
import { auth, googleEnabled } from './auth';
import { handleChat } from './chat';
import { decryptSecret, encryptSecret, keyHint } from './crypto';
import { PROVIDERS } from './providers';
import * as repo from './repo';
import { atLeast, type Role } from './repo';

type User = { id: string; name: string; email: string; isAnonymous?: boolean | null; image?: string | null };
type Vars = { user: User | null };
type C = Context<{ Variables: Vars }>;

export const api = new Hono<{ Variables: Vars }>().basePath('/api');

const ip = (c: C) => c.req.header('cf-connecting-ip') ?? 'local';

async function limit(binding: RateLimit | undefined, key: string) {
  if (!binding) return;
  const { success } = await binding.limit({ key });
  if (!success) throw new HTTPException(429, { message: '请求太频繁，请稍后再试' });
}

api.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: '服务器出错了，请稍后再试' }, 500);
});

// 登录相关：验证码发送和登录接口限流
api.on(['GET', 'POST'], '/auth/*', async c => {
  if (c.req.method === 'POST' && /email-otp|sign-in/.test(c.req.path)) await limit(env.RL_AUTH, ip(c));
  return auth().handler(c.req.raw);
});

// 会话：签名 cookie 缓存，大多数请求不查库
const session: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const s = await auth().api.getSession({ headers: c.req.raw.headers });
  c.set('user', (s?.user as User) ?? null);
  await limit(env.RL_API, s?.user.id ?? ip(c));
  await next();
};
api.use('/*', session);

const requireUser = (c: C) => {
  const u = c.get('user');
  if (!u) throw new HTTPException(401, { message: '请先登录或开始试用' });
  return u;
};

async function requireRole(c: C, projectId: string, min: Role) {
  const u = c.get('user');
  const role = await repo.getRole(projectId, u?.id ?? null);
  if (!atLeast(role, min)) throw new HTTPException(role ? 403 : 404, { message: role ? '你没有这个操作的权限' : '方案不存在或没有访问权限' });
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
    throw new HTTPException(400, { message: e instanceof Error ? e.message : '方案数据格式不对' });
  }
}

// ---------- 账号 ----------

api.get('/me', async c => {
  const u = c.get('user');
  if (u && !u.isAnonymous) await repo.acceptInvites(u.id, u.email);
  return c.json({ user: u, googleEnabled: googleEnabled() });
});

api.get('/account/export', async c => {
  const u = requireUser(c);
  const data = await repo.exportUserData(u.id);
  return c.json(data, 200, { 'Content-Disposition': `attachment; filename="plinth-export-${new Date().toISOString().slice(0, 10)}.json"` });
});

// ---------- 方案 ----------

api.get('/projects', async c => c.json(await repo.listProjects(requireUser(c).id)));

api.post('/projects', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({ name: z.string().trim().min(1).max(60), template: z.enum(['blank', 'sample']).default('blank'), floors: z.number().int().min(1).max(6).default(1) }));
  const id = repo.newId('p');
  const data: Project = b.template === 'sample'
    ? { ...(structuredClone(sample) as unknown as Project), id, name: b.name }
    : newProjectData({ id, name: b.name, floors: b.floors });
  await repo.createProject(u.id, id, b.name, JSON.stringify(data), b.template === 'sample' ? '从样例方案创建' : '新建空白方案');
  return c.json({ id });
});

api.get('/projects/:id', async c => {
  const id = c.req.param('id');
  const { role } = await requireRole(c, id, 'viewer');
  const [p, v] = await Promise.all([repo.getProject(id), repo.getVersion(id)]);
  if (!p || !v) throw new HTTPException(404, { message: '方案不存在' });
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
  if (raw.length > MAX_CONTENT) throw new HTTPException(413, { message: '方案数据太大' });
  const b = z.object({ base: z.number().int(), summary: z.string().max(200).default('保存'), content: z.unknown() }).parse(JSON.parse(raw));
  const content = checkContent(b.content);
  const version = await repo.saveVersion(id, user.id, b.base, JSON.stringify(content), b.summary, content.name);
  if (!version) {
    const head = await repo.getVersion(id);
    return c.json({ error: '别人刚保存了新版本', conflict: true, version: head?.version, content: head && JSON.parse(head.content) }, 409);
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
  if (svg.length > 200_000 || !svg.startsWith('<svg')) throw new HTTPException(400, { message: '缩略图格式不对' });
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
  if (!v) throw new HTTPException(404, { message: '版本不存在' });
  return c.json({ ...v, content: JSON.parse(v.content) });
});

// ---------- 成员、分享、邀请 ----------

const zShareRole = z.enum(['editor', 'commenter', 'viewer']);

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
  // 主人可以移除别人；任何人可以退出
  if (target !== user.id) await requireRole(c, id, 'owner');
  await repo.removeMember(id, target);
  return c.json({ ok: true });
});

api.get('/share/:token', async c => {
  const link = await repo.getShareLink(c.req.param('token'));
  if (!link) throw new HTTPException(404, { message: '链接已失效' });
  return c.json({ projectId: link.project_id, name: link.name, role: link.role });
});

api.post('/share/:token/accept', async c => {
  const u = requireUser(c);
  const link = await repo.getShareLink(c.req.param('token'));
  if (!link) throw new HTTPException(404, { message: '链接已失效' });
  const role = await repo.upsertMember(link.project_id, u.id, link.role);
  return c.json({ projectId: link.project_id, role });
});

// ---------- 评论 ----------

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
  const b = await body(c, z.object({ status: z.enum(['open', 'resolved', 'pending-confirm']) }));
  await repo.setCommentStatus(id, c.req.param('cid'), b.status);
  return c.json({ ok: true });
});

api.delete('/projects/:id/comments/:cid', async c => {
  const id = c.req.param('id');
  const { user, role } = await requireRole(c, id, 'commenter');
  const cm = await repo.getComment(id, c.req.param('cid'));
  if (!cm) throw new HTTPException(404, { message: '评论不存在' });
  if (cm.author_id !== user.id && role !== 'owner') throw new HTTPException(403, { message: '只能删除自己的评论' });
  await repo.deleteComment(id, cm.id);
  return c.json({ ok: true });
});

// ---------- 模型配置 ----------

api.get('/models', async c => c.json({ configs: await repo.listModelConfigs(requireUser(c).id), providers: PROVIDERS }));

api.post('/models', async c => {
  const u = requireUser(c);
  const b = await body(c, z.object({
    label: z.string().trim().min(1).max(40), provider: z.enum(Object.keys(PROVIDERS) as [string, ...string[]]),
    model: z.string().trim().min(1).max(100), apiKey: z.string().trim().min(8).max(400), baseUrl: z.url().max(300).nullish(),
  }));
  if (PROVIDERS[b.provider].needsBaseUrl && !b.baseUrl) throw new HTTPException(400, { message: '这个厂商需要填接口地址' });
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
    const m = await repo.getModelConfig(b.modelConfigId);
    if (!m || m.user_id !== user.id) throw new HTTPException(400, { message: '只能用自己添加的模型配置' });
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
  if (!p?.model_config_id) throw new HTTPException(400, { message: '这个方案还没有配置大模型。请方案主人在“设置 → 模型”添加密钥，并在方案里选用' });
  const cfg = await repo.getModelConfig(p.model_config_id);
  if (!cfg) throw new HTTPException(400, { message: '方案选用的模型配置已被删除，请方案主人重新选择' });
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
  return c.json(t ? JSON.parse(t.messages) : []);
});

api.put('/projects/:id/chat-thread', async c => {
  const id = c.req.param('id');
  const { user } = await requireRole(c, id, 'editor');
  const raw = await c.req.text();
  if (raw.length > 800_000) throw new HTTPException(413, { message: '对话太长' });
  await repo.putChat(id, user.id, raw);
  return c.json({ ok: true });
});

api.notFound(c => c.json({ error: '接口不存在' }, 404));
