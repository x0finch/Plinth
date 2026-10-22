/** Local preferences (this browser only): agent autonomy level */
import type { Autonomy } from '@/agent/policy';

const KEY = 'plinth.autonomy';
export const AUTONOMY_ZH: Record<Autonomy, { label: string; hint: string }> = {
  ask: { label: '谨慎', hint: '每次修改都先问我' },
  balanced: { label: '默认', hint: '可撤销的修改直接做；影响主方案、不可逆或对外的先问我' },
  auto: { label: '放手', hint: '除了对外分享和产生费用，都直接做' },
};

export function getAutonomy(): Autonomy {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'ask' || v === 'balanced' || v === 'auto') return v;
  } catch {}
  return 'balanced';
}

export function setAutonomy(v: Autonomy) {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
}
