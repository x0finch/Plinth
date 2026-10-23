// API permission matrix: every route × every role (signed out, signed-in stranger, viewer, commenter, editor, owner) → allowed or denied.
// Needs only the dev server (no browser, no model). "Allowed" means the request got past the permission check (any status
// but 401/403/404); validation errors and conflicts still count as allowed.
const BASE = process.env.BASE ?? 'http://localhost:3000';
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};

/** A client with its own cookie jar */
function client() {
  const jar = new Map();
  const call = async (method, path, body, type = 'application/json', retried = false) => {
    const headers = { Origin: BASE, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
    if (body !== undefined) headers['Content-Type'] = type;
    const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    // The local dev server now and then fails to reach the Worker ("fetch failed") and answers with a non-JSON 500.
    // The API's own errors are always JSON, so only that infrastructure error is retried, once.
    if (res.status >= 500 && !res.headers.get('content-type')?.includes('application/json') && !retried) {
      console.log(`  (dev server error on ${method} ${path}, retrying)`);
      return call(method, path, body, type, true);
    }
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
  return { call, signIn: () => call('POST', '/auth/sign-in/anonymous', {}) };
}

const actors = { anon: client(), stranger: client(), viewer: client(), commenter: client(), editor: client(), owner: client() };
for (const k of ['stranger', 'viewer', 'commenter', 'editor', 'owner']) {
  let { status } = await actors[k].signIn();
  // Sign-ins are rate-limited to 10 a minute per IP (other e2e scripts sign in too): wait for the window to reset, once
  if (status === 429) {
    console.log('  (sign-in rate limit reached, waiting a minute)');
    await new Promise(r => setTimeout(r, 61_000));
    ({ status } = await actors[k].signIn());
  }
  check(status === 200, `${k} signed in`);
}
const me = async k => (await actors[k].call('GET', '/me')).data.user.id;

const { owner } = actors;
const id = (await owner.call('POST', '/projects', { name: 'Permissions', template: 'blank' })).data.id;
for (const role of ['viewer', 'commenter', 'editor']) {
  const token = (await owner.call('POST', `/projects/${id}/links`, { role })).data.token;
  const r = await actors[role].call('POST', `/share/${token}/accept`);
  check(r.data?.role === role, `${role} joined through a share link`);
}
const comment = (await owner.call('POST', `/projects/${id}/comments`, { body: 'owner comment' })).data.id;
const otherUser = await me('stranger');
const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

// Who may call each route: a minimum role, 'user' (any signed-in user) or 'public'
const ROUTES = [
  ['GET', '/me', 'public'],
  ['GET', '/projects', 'user'],
  ['GET', '/models', 'user'],
  ['GET', '/account/export', 'user'],
  ['POST', '/projects', 'user', { name: 'Scratch', template: 'blank' }],
  ['POST', '/models', 'user', { label: 'x' }],
  ['DELETE', '/models/nope', 'user'],
  ['GET', `/projects/${id}`, 'viewer'],
  ['PUT', `/projects/${id}`, 'editor', { base: 0, content: {} }],
  ['PATCH', `/projects/${id}`, 'editor', { name: 'Permissions' }],
  ['PUT', `/projects/${id}/thumbnail`, 'editor', svg, 'image/svg+xml'],
  ['GET', `/projects/${id}/versions`, 'viewer'],
  ['GET', `/projects/${id}/versions/1`, 'viewer'],
  ['GET', `/projects/${id}/sharing`, 'viewer'],
  ['POST', `/projects/${id}/links`, 'owner', { role: 'viewer' }],
  ['DELETE', `/projects/${id}/links/nope`, 'owner'],
  ['POST', `/projects/${id}/invites`, 'owner', { email: 'someone@example.com', role: 'viewer' }],
  ['DELETE', `/projects/${id}/invites/nope`, 'owner'],
  ['PATCH', `/projects/${id}/members/${otherUser}`, 'owner', { role: 'viewer' }],
  ['DELETE', `/projects/${id}/members/${otherUser}`, 'owner'],
  ['GET', `/projects/${id}/comments`, 'viewer'],
  ['POST', `/projects/${id}/comments`, 'commenter', { body: 'hi' }],
  ['PATCH', `/projects/${id}/comments/${comment}`, 'commenter', { status: 'open' }],
  // Only the author or the owner may delete a comment; the owner wrote this one
  ['DELETE', `/projects/${id}/comments/${comment}`, 'owner'],
  ['PUT', `/projects/${id}/model`, 'owner', { modelConfigId: null }],
  ['GET', `/projects/${id}/usage`, 'owner'],
  ['POST', `/projects/${id}/chat`, 'editor', {}],
  ['GET', `/projects/${id}/chat-thread`, 'viewer'],
  ['PUT', `/projects/${id}/chat-thread`, 'editor', []],
];
// Least privileged first, so the owner's destructive calls come last; a route allows its minimum and everyone after it
const ORDER = ['anon', 'stranger', 'viewer', 'commenter', 'editor', 'owner'];
const FIRST_ALLOWED = { public: 'anon', user: 'stranger', viewer: 'viewer', commenter: 'commenter', editor: 'editor', owner: 'owner' };

for (const [method, path, min, body, type] of ROUTES) {
  const results = [];
  for (const [i, who] of ORDER.entries()) {
    const expected = i >= ORDER.indexOf(FIRST_ALLOWED[min]);
    const { status } = await actors[who].call(method, path, body, type);
    const allowed = ![401, 403, 404].includes(status);
    results.push({ who, status, ok: allowed === expected });
  }
  const label = path.replace(id, ':id').replace(comment, ':comment').replace(otherUser, ':user');
  check(results.every(r => r.ok), `${method} ${label} (${min}): ${results.map(r => `${r.who} ${r.status}${r.ok ? '' : '!'}`).join(', ')}`);
}

// Every route the API registers is in the matrix (share links are checked in setup and below)
import { readFileSync } from 'node:fs';
const registered = [...readFileSync(new URL('../src/server/api.ts', import.meta.url), 'utf8').matchAll(/api\.(get|post|put|patch|delete)\('([^']+)'/g)]
  .map(([, m, p]) => `${m.toUpperCase()} ${p.replace(/:\w+/g, ':_')}`)
  .filter(r => !r.includes('/share/'));
const covered = new Set([...ROUTES, ['DELETE', `/projects/${id}`]].map(([m, p]) => `${m} ${p.replace(id, ':_').replace(comment, ':_').replace(otherUser, ':_').replace(/\/(links|invites|models)\/nope/, '/$1/:_').replace(/\/versions\/1$/, '/versions/:_')}`));
const missing = registered.filter(r => !covered.has(r));
check(!missing.length, `every API route is in the matrix${missing.length ? `; missing: ${missing.join(', ')}` : ''}`);
check((await actors.anon.call('POST', '/share/nope/accept')).status === 401, 'accepting a share link needs sign-in');

// Leaving a project: any member may remove themselves
const viewerId = await me('viewer');
check((await actors.viewer.call('DELETE', `/projects/${id}/members/${viewerId}`)).status === 200, 'a member can leave the project');
// Deleting the project: only the owner
check((await actors.editor.call('DELETE', `/projects/${id}`)).status === 403, 'an editor cannot delete the project');
check((await owner.call('DELETE', `/projects/${id}`)).status === 200, 'the owner can delete the project');
