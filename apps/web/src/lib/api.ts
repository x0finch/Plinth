/** Thin client wrapper for /api: shared JSON handling and error messages */
import { m } from './i18n';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? m.api_request_failed({ status: res.status }), data);
  return data as T;
}

export type Role = 'owner' | 'editor' | 'commenter' | 'viewer';
const ROLE_LABEL: Record<Role, () => string> = { owner: m.role_owner, editor: m.role_editor, commenter: m.role_commenter, viewer: m.role_viewer };
export const roleLabel = (r: Role) => ROLE_LABEL[r]();
export const ROLE_RANK: Record<Role, number> = { viewer: 0, commenter: 1, editor: 2, owner: 3 };
export const can = (role: Role | undefined, min: Role) => !!role && ROLE_RANK[role] >= ROLE_RANK[min];

export interface Me {
  user: { id: string; name: string; email: string; isAnonymous?: boolean | null; image?: string | null } | null;
  googleEnabled: boolean;
  mailEnabled: boolean;
}
