import { api } from './api';
import { authClient } from './auth-client';
import { m } from './i18n';
import { queryClient } from './query';

/** Try first: enter as a guest without signing in and create a sample plan */
export async function startTrial(template: 'sample' | 'blank' = 'sample') {
  const s = await authClient.getSession();
  if (!s.data) {
    const r = await authClient.signIn.anonymous();
    if (r.error) throw new Error(r.error.message ?? m.trial_cannot_start());
  }
  await queryClient.invalidateQueries({ queryKey: ['me'] });
  const { id } = await api<{ id: string }>('/projects', {
    method: 'POST',
    json: { name: template === 'sample' ? m.trial_sample_name() : m.trial_blank_name(), template },
  });
  return id;
}
