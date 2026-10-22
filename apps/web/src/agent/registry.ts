/** The single capability registry shared by the UI, the agent and window.artifact.call */
import { createRegistry } from '@plinth/core';
import { VIEW_CAPABILITIES } from './view-capabilities';

export const registry = createRegistry(VIEW_CAPABILITIES);
