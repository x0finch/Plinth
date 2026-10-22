/** 哪些能力要业主点确认：服务端（工具定义）和浏览器（确认卡片）共用同一套规则 */
import type { Capability, Permission } from '@plinth/core';

export type Autonomy = 'ask' | 'balanced' | 'auto';

export const NEEDS_APPROVAL: Record<Autonomy, Permission[]> = {
  ask: ['reversible', 'main', 'external'],
  balanced: ['main', 'external'],
  auto: ['external'],
};

export const needsApproval = (c: Capability, autonomy: Autonomy) =>
  NEEDS_APPROVAL[autonomy].includes(c.permission) && c.kind !== 'query' && c.kind !== 'view';

export const isAutonomy = (v: unknown): v is Autonomy => v === 'ask' || v === 'balanced' || v === 'auto';
