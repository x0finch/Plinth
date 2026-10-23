/** The single capability registry shared by the UI, the agent and window.artifact.call */
import { createRegistry } from '@plinth/core';
import { LOOK_CAPABILITIES } from './look-capabilities';
import { VIEW_CAPABILITIES } from './view-capabilities';

export const registry = createRegistry([...VIEW_CAPABILITIES, ...LOOK_CAPABILITIES]);
