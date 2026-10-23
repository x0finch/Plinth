/** Built-in capabilities: query, edit, relation, verify. Browser-only view capabilities are registered at runtime. */
import { Registry, type Capability } from './capability.js';
import { areaReportCap, checkRulesCap, findObjects, getObject, listConstraints, projectSummary } from './capabilities/query.js';
import { wallAdd, wallMove, wallRemove, wallUpdate } from './capabilities/wall.js';
import { openingAdd, openingRemove, openingUpdate } from './capabilities/opening.js';
import { roomAdd, spaceAdd, spaceMerge, spaceRemove, spaceSetArea, spaceUpdate } from './capabilities/space.js';
import { furnitureAdd, furnitureMove, furnitureRemove } from './capabilities/furniture.js';
import { levelAdd, levelRemove } from './capabilities/level.js';
import { briefUpdate, constraintAdd, constraintRemove, decisionAdd } from './capabilities/relation.js';
import { historyLog, historyRedo, historyUndo } from './capabilities/history.js';
import { batchCapability, searchCapabilitiesFor } from './capabilities/meta.js';
import { furnitureTypeAdd, lookAdd, lookGet, lookRemove, lookSet, lookUpdate, lookUse } from './capabilities/look.js';

export * from './capabilities/query.js';
export * from './capabilities/wall.js';
export * from './capabilities/opening.js';
export * from './capabilities/space.js';
export * from './capabilities/furniture.js';
export * from './capabilities/level.js';
export * from './capabilities/relation.js';
export * from './capabilities/history.js';
export * from './capabilities/meta.js';
export * from './capabilities/look.js';
export { resolve, resolveLevel } from './refs.js';
export { objectInfo, type ObjectInfo } from './info.js';

export const BUILTIN: Capability[] = [
  projectSummary, findObjects, getObject, areaReportCap, checkRulesCap, listConstraints,
  wallAdd, wallMove, wallUpdate, wallRemove, openingAdd, openingUpdate, openingRemove,
  roomAdd, spaceAdd, spaceUpdate, spaceRemove, spaceMerge, spaceSetArea,
  furnitureAdd, furnitureMove, furnitureRemove, levelAdd, levelRemove,
  constraintAdd, constraintRemove, briefUpdate, decisionAdd,
  historyUndo, historyRedo, historyLog,
  lookGet, lookAdd, lookUpdate, lookRemove, lookUse, lookSet, furnitureTypeAdd,
];

/** Built-in capability registry (including batch and search_capabilities) */
export function createRegistry(extra: Capability[] = []): Registry {
  const r = new Registry([...BUILTIN, ...extra]);
  r.register(batchCapability(r));
  r.register(searchCapabilitiesFor(r));
  return r;
}

