import { api } from './api';
import { authClient } from './auth-client';
import { queryClient } from './query';

/** 先试用：没登录就以访客身份进来，建一个样例方案 */
export async function startTrial(template: 'sample' | 'blank' = 'sample') {
  const s = await authClient.getSession();
  if (!s.data) {
    const r = await authClient.signIn.anonymous();
    if (r.error) throw new Error(r.error.message ?? '无法开始试用');
  }
  await queryClient.invalidateQueries({ queryKey: ['me'] });
  const { id } = await api<{ id: string }>('/projects', { method: 'POST', json: { name: template === 'sample' ? '乌石合院（样例）' : '我的新房子', template } });
  return id;
}
