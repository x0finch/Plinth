/** 数据访问：直接用 D1 预编译语句，开销最小。 */
import { env } from 'cloudflare:workers';

export type Role = 'owner' | 'editor' | 'commenter' | 'viewer';
export const ROLE_RANK: Record<Role, number> = { viewer: 0, commenter: 1, editor: 2, owner: 3 };
export const atLeast = (role: Role | null, min: Role) => !!role && ROLE_RANK[role] >= ROLE_RANK[min];

const db = () => env.DB;
const now = () => Date.now();
export const newId = (prefix = '') => prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 20);

// ---------- 项目 ----------

export interface ProjectRow {
  id: string;
  name: string;
  owner_id: string;
  head_version: number;
  model_config_id: string | null;
  thumbnail: string | null;
  created_at: number;
  updated_at: number;
}

export async function listProjects(userId: string) {
  const { results } = await db()
    .prepare(
      `select p.id, p.name, p.head_version, p.thumbnail, p.updated_at, m.role, u.name as owner_name
       from project_member m join project p on p.id = m.project_id join "user" u on u.id = p.owner_id
       where m.user_id = ? order by p.updated_at desc limit 200`,
    )
    .bind(userId)
    .all<{ id: string; name: string; head_version: number; thumbnail: string | null; updated_at: number; role: Role; owner_name: string }>();
  return results;
}

export async function createProject(userId: string, id: string, name: string, content: string, summary = '新建') {
  const t = now();
  await db().batch([
    db().prepare('insert into project (id, name, owner_id, head_version, created_at, updated_at) values (?, ?, ?, 1, ?, ?)').bind(id, name, userId, t, t),
    db().prepare('insert into project_version (project_id, version, content, author_id, summary, created_at) values (?, 1, ?, ?, ?, ?)').bind(id, content, userId, summary, t),
    db().prepare(`insert into project_member (project_id, user_id, role, created_at) values (?, ?, 'owner', ?)`).bind(id, userId, t),
  ]);
}

export const getProject = (id: string) => db().prepare('select * from project where id = ?').bind(id).first<ProjectRow>();

export async function getRole(projectId: string, userId: string | null): Promise<Role | null> {
  if (!userId) return null;
  const r = await db().prepare('select role from project_member where project_id = ? and user_id = ?').bind(projectId, userId).first<{ role: Role }>();
  return r?.role ?? null;
}

export async function getVersion(projectId: string, version?: number) {
  const q = version
    ? db().prepare('select version, content, summary, created_at from project_version where project_id = ? and version = ?').bind(projectId, version)
    : db().prepare(
        'select v.version, v.content, v.summary, v.created_at from project p join project_version v on v.project_id = p.id and v.version = p.head_version where p.id = ?',
      ).bind(projectId);
  return q.first<{ version: number; content: string; summary: string | null; created_at: number }>();
}

/** 保存新版本：乐观并发，base 不是当前最新版本时返回 null（有人先存了） */
export async function saveVersion(projectId: string, userId: string, base: number, content: string, summary: string, name?: string) {
  const t = now();
  const [upd] = await db().batch([
    db()
      .prepare('update project set head_version = head_version + 1, updated_at = ?, name = coalesce(?, name) where id = ? and head_version = ?')
      .bind(t, name ?? null, projectId, base),
    db()
      .prepare(
        `insert into project_version (project_id, version, content, author_id, summary, created_at)
         select id, head_version, ?, ?, ?, ? from project where id = ? and head_version = ? and updated_at = ?`,
      )
      .bind(content, userId, summary, t, projectId, base + 1, t),
  ]);
  return upd.meta.changes ? base + 1 : null;
}

export async function listVersions(projectId: string) {
  const { results } = await db()
    .prepare(
      `select v.version, v.summary, v.created_at, u.name as author from project_version v left join "user" u on u.id = v.author_id
       where v.project_id = ? order by v.version desc limit 200`,
    )
    .bind(projectId)
    .all<{ version: number; summary: string | null; created_at: number; author: string | null }>();
  return results;
}

export const renameProject = (id: string, name: string) => db().prepare('update project set name = ?, updated_at = ? where id = ?').bind(name, now(), id).run();
export const setThumbnail = (id: string, svg: string) => db().prepare('update project set thumbnail = ? where id = ?').bind(svg, id).run();
export const deleteProject = (id: string) => db().prepare('delete from project where id = ?').bind(id).run();
export const setProjectModel = (id: string, modelConfigId: string | null) =>
  db().prepare('update project set model_config_id = ? where id = ?').bind(modelConfigId, id).run();

// ---------- 成员、分享、邀请 ----------

export async function listMembers(projectId: string) {
  const { results } = await db()
    .prepare(
      `select m.user_id, m.role, u.name, u.email, u.image, coalesce(u."isAnonymous", 0) as anonymous from project_member m join "user" u on u.id = m.user_id
       where m.project_id = ? order by m.created_at`,
    )
    .bind(projectId)
    .all<{ user_id: string; role: Role; name: string; email: string; image: string | null; anonymous: number }>();
  return results;
}

/** 加入或升级成员角色（不降级） */
export async function upsertMember(projectId: string, userId: string, role: Role) {
  const cur = await getRole(projectId, userId);
  if (cur && ROLE_RANK[cur] >= ROLE_RANK[role]) return cur;
  await db()
    .prepare('insert into project_member (project_id, user_id, role, created_at) values (?, ?, ?, ?) on conflict (project_id, user_id) do update set role = excluded.role')
    .bind(projectId, userId, role, now())
    .run();
  return role;
}

export const setMemberRole = (projectId: string, userId: string, role: Role) =>
  db().prepare(`update project_member set role = ? where project_id = ? and user_id = ? and role != 'owner'`).bind(role, projectId, userId).run();
export const removeMember = (projectId: string, userId: string) =>
  db().prepare(`delete from project_member where project_id = ? and user_id = ? and role != 'owner'`).bind(projectId, userId).run();

export async function createShareLink(projectId: string, role: Role, userId: string) {
  const token = newId('s') + newId();
  await db().prepare('insert into share_link (token, project_id, role, created_by, created_at) values (?, ?, ?, ?, ?)').bind(token, projectId, role, userId, now()).run();
  return token;
}

export async function listShareLinks(projectId: string) {
  const { results } = await db()
    .prepare('select token, role, created_at from share_link where project_id = ? and revoked_at is null order by created_at desc')
    .bind(projectId)
    .all<{ token: string; role: Role; created_at: number }>();
  return results;
}

export const revokeShareLink = (projectId: string, token: string) =>
  db().prepare('update share_link set revoked_at = ? where project_id = ? and token = ?').bind(now(), projectId, token).run();

export const getShareLink = (token: string) =>
  db()
    .prepare('select s.token, s.project_id, s.role, p.name from share_link s join project p on p.id = s.project_id where s.token = ? and s.revoked_at is null')
    .bind(token)
    .first<{ token: string; project_id: string; role: Role; name: string }>();

export async function createInvite(projectId: string, email: string, role: Role, userId: string) {
  const id = newId('i');
  await db().prepare('insert into invite (id, project_id, email, role, created_by, created_at) values (?, ?, ?, ?, ?, ?)').bind(id, projectId, email.toLowerCase(), role, userId, now()).run();
  return id;
}

export async function listInvites(projectId: string) {
  const { results } = await db()
    .prepare('select id, email, role, created_at from invite where project_id = ? and accepted_at is null order by created_at desc')
    .bind(projectId)
    .all<{ id: string; email: string; role: Role; created_at: number }>();
  return results;
}

export const deleteInvite = (projectId: string, id: string) => db().prepare('delete from invite where project_id = ? and id = ?').bind(projectId, id).run();

/** 用户登录后：把发给这个邮箱的邀请兑现 */
export async function acceptInvites(userId: string, email: string) {
  const { results } = await db()
    .prepare('select id, project_id, role from invite where email = ? and accepted_at is null')
    .bind(email.toLowerCase())
    .all<{ id: string; project_id: string; role: Role }>();
  for (const inv of results) {
    await upsertMember(inv.project_id, userId, inv.role);
    await db().prepare('update invite set accepted_at = ? where id = ?').bind(now(), inv.id).run();
  }
  return results.length;
}

/** 匿名用户登录正式账号后，名下的东西都转过去 */
export async function transferOwnership(from: string, to: string) {
  await db().batch([
    db().prepare('update project set owner_id = ? where owner_id = ?').bind(to, from),
    db().prepare('update or ignore project_member set user_id = ? where user_id = ?').bind(to, from),
    db().prepare('update model_config set user_id = ? where user_id = ?').bind(to, from),
    db().prepare('update or ignore chat_thread set user_id = ? where user_id = ?').bind(to, from),
    db().prepare('update comment set author_id = ? where author_id = ?').bind(to, from),
    db().prepare('update project_version set author_id = ? where author_id = ?').bind(to, from),
    db().prepare('update usage set user_id = ? where user_id = ?').bind(to, from),
  ]);
}

// ---------- 评论 ----------

export interface CommentRow {
  id: string;
  target_id: string | null;
  target_name: string | null;
  parent_id: string | null;
  author_id: string | null;
  author: string | null;
  body: string;
  status: 'open' | 'resolved' | 'pending-confirm';
  created_at: number;
}

export async function listComments(projectId: string) {
  const { results } = await db()
    .prepare(
      `select c.id, c.target_id, c.target_name, c.parent_id, c.author_id, u.name as author, c.body, c.status, c.created_at
       from comment c left join "user" u on u.id = c.author_id where c.project_id = ? order by c.created_at limit 1000`,
    )
    .bind(projectId)
    .all<CommentRow>();
  return results;
}

export async function addComment(projectId: string, userId: string, c: { targetId?: string | null; targetName?: string | null; parentId?: string | null; body: string; status?: CommentRow['status'] }) {
  const id = newId('m');
  await db()
    .prepare('insert into comment (id, project_id, target_id, target_name, parent_id, author_id, body, status, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, projectId, c.targetId ?? null, c.targetName ?? null, c.parentId ?? null, userId, c.body, c.status ?? 'open', now())
    .run();
  return id;
}

export const setCommentStatus = (projectId: string, id: string, status: CommentRow['status']) =>
  db().prepare('update comment set status = ? where project_id = ? and id = ?').bind(status, projectId, id).run();
export const getComment = (projectId: string, id: string) =>
  db().prepare('select * from comment where project_id = ? and id = ?').bind(projectId, id).first<CommentRow>();
export const deleteComment = (projectId: string, id: string) => db().prepare('delete from comment where project_id = ? and id = ?').bind(projectId, id).run();

// ---------- 模型配置、用量 ----------

export interface ModelConfigRow {
  id: string;
  user_id: string;
  label: string;
  provider: string;
  model: string;
  base_url: string | null;
  key_ciphertext: string;
  key_iv: string;
  key_hint: string;
  created_at: number;
}

export async function listModelConfigs(userId: string) {
  const { results } = await db()
    .prepare('select id, label, provider, model, base_url, key_hint, created_at from model_config where user_id = ? order by created_at desc')
    .bind(userId)
    .all<Omit<ModelConfigRow, 'key_ciphertext' | 'key_iv' | 'user_id'>>();
  return results;
}

export async function insertModelConfig(row: ModelConfigRow) {
  await db()
    .prepare('insert into model_config (id, user_id, label, provider, model, base_url, key_ciphertext, key_iv, key_hint, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(row.id, row.user_id, row.label, row.provider, row.model, row.base_url, row.key_ciphertext, row.key_iv, row.key_hint, row.created_at)
    .run();
}

export const getModelConfig = (id: string) => db().prepare('select * from model_config where id = ?').bind(id).first<ModelConfigRow>();
export const deleteModelConfig = (userId: string, id: string) => db().prepare('delete from model_config where user_id = ? and id = ?').bind(userId, id).run();

export const recordUsage = (u: { userId: string; projectId: string; modelConfigId: string; input: number; output: number }) =>
  db()
    .prepare('insert into usage (user_id, project_id, model_config_id, input_tokens, output_tokens, created_at) values (?, ?, ?, ?, ?, ?)')
    .bind(u.userId, u.projectId, u.modelConfigId, u.input, u.output, now())
    .run();

export async function projectUsage(projectId: string) {
  const { results } = await db()
    .prepare(
      `select u.user_id, coalesce(x.name, '已删除用户') as name, sum(u.input_tokens) as input, sum(u.output_tokens) as output, count(*) as calls
       from usage u left join "user" x on x.id = u.user_id where u.project_id = ? group by u.user_id order by input desc`,
    )
    .bind(projectId)
    .all<{ user_id: string; name: string; input: number; output: number; calls: number }>();
  return results;
}

// ---------- 对话记录 ----------

export const getChat = (projectId: string, userId: string) =>
  db().prepare('select messages from chat_thread where project_id = ? and user_id = ?').bind(projectId, userId).first<{ messages: string }>();

export const putChat = (projectId: string, userId: string, messages: string) =>
  db()
    .prepare('insert into chat_thread (project_id, user_id, messages, updated_at) values (?, ?, ?, ?) on conflict (project_id, user_id) do update set messages = excluded.messages, updated_at = excluded.updated_at')
    .bind(projectId, userId, messages, now())
    .run();

// ---------- 账号 ----------

/** 数据导出：账号信息 + 名下每个方案的最新版本 */
export async function exportUserData(userId: string) {
  const user = await db().prepare('select id, name, email, "createdAt" from "user" where id = ?').bind(userId).first();
  const { results: projects } = await db()
    .prepare(
      `select p.id, p.name, p.created_at, p.updated_at, v.content from project p join project_version v on v.project_id = p.id and v.version = p.head_version where p.owner_id = ?`,
    )
    .bind(userId)
    .all<{ id: string; name: string; created_at: number; updated_at: number; content: string }>();
  const { results: comments } = await db().prepare('select project_id, target_name, body, created_at from comment where author_id = ?').bind(userId).all();
  const models = await listModelConfigs(userId);
  return {
    exportedAt: new Date().toISOString(),
    user,
    projects: projects.map(p => ({ ...p, content: JSON.parse(p.content) })),
    comments,
    modelConfigs: models.map(({ key_hint, ...m }) => ({ ...m, key: `（不导出）${key_hint}` })),
  };
}
