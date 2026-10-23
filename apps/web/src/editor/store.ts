/**
 * Editor state, one per open plan. Data lives in the core package Session and all changes go through the capability list;
 * this only handles view state, autosave, conflicts and the before/after comparison.
 */
import { capabilityTitle, findObject, mutates, Session, type Actor, type CallResult, type Project, type TxResult } from '@plinth/core';
import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { registry } from '@/agent/registry';
import type { CommentsHost, ViewHost, ViewState } from '@/agent/view-capabilities';
import type { LibrariesHost } from '@/agent/library-capabilities';
import type { LooksHost } from '@/agent/look-capabilities';
import { getLibrary, listLibraries, saveToLibrary } from '@/lib/libraries';
import { api, ApiError } from '@/lib/api';
import { can, type Role } from '@/shared/roles';
import { m } from '@/lib/i18n';
import { queryClient } from '@/lib/query';

export interface LastChange {
  label: string;
  actor: Actor['kind'];
  before: Project;
  changed: string[];
  areaChanges: TxResult['areaChanges'];
  warnings: NonNullable<CallResult['warnings']>;
  at: number;
}

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  model: string;
}

/** The model the project uses: the pinned one, else the owner's default */
export const projectModel = (s: Pick<EditorState, 'models' | 'projectModelId' | 'defaultModelId'>) =>
  s.models.find(x => x.id === (s.projectModelId ?? s.defaultModelId)) ?? null;

export interface EditorState {
  projectId: string;
  name: string;
  role: Role;
  version: number;
  /** The owner's models (editors chat with them) */
  models: ModelOption[];
  /** The model the owner pinned for the project; null uses the owner's default */
  projectModelId: string | null;
  defaultModelId: string | null;
  session: Session;
  project: Project;
  view: ViewState;
  readOnlyVersion: number | null;
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
  pendingLabels: string[];
  conflict: { version: number; content: Project } | null;
  lastChange: LastChange | null;
  /** The look just added or changed (by the agent or the user), for the chat's preview card */
  lookChange: { id: string; isNew: boolean; at: number } | null;
  compare: boolean;
  /** Screenshot function registered by the canvas */
  capture: (() => Promise<{ dataUrl: string; width: number; height: number }>) | null;
  /** A message handed to the agent from elsewhere in the editor (e.g. a comment); the chat panel sends it */
  ask: { text: string; at: number } | null;
  /** Bumped by "fit all": the plan and the 3D view frame the whole drawing again when it changes */
  fitRequest: number;
  /** Registered by the 3D view: plays the house sinking back into the plan; the view switch waits for it before showing the plan */
  leave3D: (() => Promise<void>) | null;
  /**
   * Keep the plan on screen after switching to 3D until the 3D view's first frame is ready (loading code, drawing the floors).
   * That frame is the same picture as the plan, so the plan then goes away without a visible change.
   */
  planUntil3D: boolean;
}

export interface EditorActions {
  call(name: string, input: unknown, actor?: Actor): Promise<CallResult>;
  /** The project as it would be after this call, from a scratch copy (nothing is committed); null if the call fails */
  preview(name: string, input: unknown): Promise<Project | null>;
  setView(patch: Partial<ViewState>): ViewState;
  fitView(): void;
  setLeave3D(fn: (() => Promise<void>) | null): void;
  setPlanUntil3D(on: boolean): void;
  select(ids: string[]): void;
  focus(ids: string[], highlight?: boolean): ViewState;
  undo(): void;
  redo(): void;
  /** Save if dirty. checkpoint: a deliberate save (restore) that the server must keep apart from the autosave before it */
  save(opts?: { force?: boolean; checkpoint?: boolean }): Promise<void>;
  resolveConflict(keep: 'mine' | 'theirs'): Promise<void>;
  setCompare(on: boolean): void;
  /** Close the look preview card */
  clearLookChange(): void;
  setCapture(fn: EditorState['capture']): void;
  loadVersion(version: number | null): Promise<void>;
  /** Make an earlier version the latest one (saved as a new version) */
  restoreVersion(version: number): Promise<void>;
  askAgent(text: string): void;
  /** Follow session changes (mark dirty, autosave) while the editor is open; returns the disconnect function */
  connect(): () => void;
  viewHost(): ViewHost;
  canEdit(): boolean;
}

export type EditorStore = ReturnType<typeof createEditorStore>;

export interface InitialProject {
  id: string;
  name: string;
  role: Role;
  version: number;
  content: Project;
  models?: ModelOption[];
  projectModelId?: string | null;
  defaultModelId?: string | null;
}

const firstLevel = (p: Project) => p.levels.find(l => !l.roof)?.id ?? p.levels[0]?.id ?? 'L1';

/** Floor the object is on */
export const levelOf = (p: Project, id: string): string | undefined => findObject(p, id)?.level;

export function createEditorStore(init: InitialProject, opts: { level?: string; mode?: '2d' | '3d'; focus?: string[] } = {}) {
  const session = new Session(init.content);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const store = createStore<EditorState & EditorActions>()((set, get) => {
    const scheduleSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void get().save(), 1500);
    };


    const view: ViewState = {
      mode: opts.mode ?? '2d',
      level: opts.level && init.content.levels.some(l => l.id === opts.level) ? opts.level : firstLevel(init.content),
      selection: [],
      highlight: opts.focus ?? [],
      camera: null,
      layers: { furniture: true, dimensions: true, labels: true, cutaway: false },
    };

    return {
      projectId: init.id,
      name: init.name,
      role: init.role,
      version: init.version,
      models: init.models ?? [],
      projectModelId: init.projectModelId ?? null,
      defaultModelId: init.defaultModelId ?? null,
      session,
      project: init.content,
      view,
      readOnlyVersion: null,
      dirty: false,
      saving: false,
      savedAt: null,
      pendingLabels: [],
      conflict: null,
      lastChange: null,
      lookChange: null,
      compare: false,
      capture: null,
      ask: null,
      fitRequest: 0,
      leave3D: null,
      planUntil3D: false,

      canEdit: () => can(get().role, 'editor') && get().readOnlyVersion == null,

      async call(name, input, actor = { kind: 'user' }) {
        const cap = registry.get(name);
        if (cap && mutates(cap) && !get().canEdit()) {
          return { ok: false, error: { code: 'forbidden', message: get().readOnlyVersion != null ? m.store_readonly_history() : m.store_readonly_viewer() } };
        }
        const before = session.project;
        const r = await registry.call(name, input, { session, actor, host: { view: get().viewHost(), comments: commentsHost(get().projectId), looks: looksHost, libraries: librariesHost } });
        if (r.ok && LOOK_EDITS.has(name)) {
          const res = r.result as { id?: string; look?: string };
          const id = name === 'furniture_type_add' ? res.look : res.id;
          if (id) set({ lookChange: { id, isNew: name !== 'look_update', at: Date.now() } });
        }
        if (r.ok && cap?.mode === 'edit' && r.changed?.length) {
          set(s => ({
            pendingLabels: [...s.pendingLabels, session.log.at(-1)?.label ?? capabilityTitle(cap)],
            lastChange: {
              label: session.log.at(-1)?.label ?? capabilityTitle(cap), actor: actor.kind, before, changed: r.changed!,
              areaChanges: r.areaChanges ?? [], warnings: r.warnings ?? [], at: Date.now(),
            },
            view: { ...s.view, highlight: r.changed! },
          }));
        } else if (r.ok && cap?.mode === 'edit' && session.project !== before) {
          // A change to no object (e.g. a look in the library) still names the next saved version
          set(s => ({ pendingLabels: [...s.pendingLabels, session.log.at(-1)?.label ?? capabilityTitle(cap)] }));
        }
        return r;
      },

      async preview(name, input) {
        const scratch = new Session(session.project);
        const r = await registry.call(name, input, { session: scratch, actor: { kind: 'user' }, host: { view: get().viewHost(), comments: commentsHost(get().projectId), looks: looksHost, libraries: librariesHost } });
        return r.ok ? scratch.project : null;
      },

      setView(patch) {
        const v = { ...get().view, ...patch };
        set({ view: v });
        return v;
      },

      fitView() {
        set(s => ({ fitRequest: s.fitRequest + 1 }));
      },

      setLeave3D(fn) {
        set({ leave3D: fn });
      },

      setPlanUntil3D(planUntil3D) {
        set({ planUntil3D });
      },

      select(ids) {
        // Click on empty space: also clear change highlights
        set(s => ({ view: { ...s.view, selection: ids, highlight: ids.length ? s.view.highlight : [] } }));
      },

      focus(ids, highlight = true) {
        const p = get().project;
        const lv = ids.map(id => levelOf(p, id)).find(Boolean);
        const v = { ...get().view, ...(lv ? { level: lv } : {}), highlight: highlight ? ids : [], selection: ids.slice(0, 1) };
        set({ view: v });
        return v;
      },

      undo() {
        const e = session.undo();
        if (e) set(s => ({ pendingLabels: [...s.pendingLabels, m.store_undo_label({ label: e.label })], view: { ...s.view, highlight: e.changed }, lastChange: null }));
      },

      redo() {
        const e = session.redo();
        if (e) set(s => ({ pendingLabels: [...s.pendingLabels, m.store_redo_label({ label: e.label })], view: { ...s.view, highlight: e.changed } }));
      },

      async save({ force = false, checkpoint = false } = {}) {
        const s = get();
        if (!s.dirty || s.saving || s.conflict || !s.canEdit()) return;
        set({ saving: true });
        const labels = s.pendingLabels;
        const summary = (labels.length > 3 ? [...labels.slice(0, 3), m.store_summary_more({ count: labels.length })] : labels).join(m.store_summary_separator()).slice(0, 200) || m.store_summary_default();
        const snapshot = session.project;
        try {
          const r = await api<{ version: number }>(`/projects/${s.projectId}`, {
            method: 'PUT',
            json: { base: s.version, summary, content: snapshot, ...(checkpoint ? { checkpoint } : {}) },
          });
          set(cur => ({
            version: r.version, saving: false, savedAt: Date.now(),
            // New changes during save: stay dirty and save again later
            dirty: session.project !== snapshot,
            pendingLabels: cur.pendingLabels.slice(labels.length),
          }));
          if (get().dirty) {
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => void get().save(), 800);
          }
        } catch (e) {
          if (e instanceof ApiError && e.status === 409 && e.data?.conflict) {
            set({ saving: false, conflict: { version: e.data.version, content: e.data.content } });
            if (force) await get().resolveConflict('mine');
          } else {
            set({ saving: false });
            throw e;
          }
        }
      },

      async resolveConflict(keep) {
        const c = get().conflict;
        if (!c) return;
        if (keep === 'theirs') {
          session.load(c.content);
          set({ conflict: null, version: c.version, dirty: false, pendingLabels: [], lastChange: null });
        } else {
          set({ conflict: null, version: c.version });
          await get().save();
        }
      },

      clearLookChange() {
        set({ lookChange: null });
      },
      setCompare(on) {
        set({ compare: on });
      },

      setCapture(fn) {
        set({ capture: fn });
      },

      async loadVersion(version) {
        if (version == null) {
          const r = await api<InitialProject>(`/projects/${get().projectId}`);
          session.load(r.content);
          set({ readOnlyVersion: null, version: r.version, dirty: false, pendingLabels: [], lastChange: null });
          return;
        }
        if (get().dirty) await get().save();
        const r = await api<{ version: number; content: Project }>(`/projects/${get().projectId}/versions/${version}`);
        session.load(r.content);
        set({ readOnlyVersion: version, dirty: false, lastChange: null });
      },

      async restoreVersion(version) {
        const r = await api<{ content: Project }>(`/projects/${get().projectId}/versions/${version}`);
        await get().loadVersion(null);
        session.load(r.content);
        set({ dirty: true, pendingLabels: [m.panels_restore_label({ version })], lastChange: null });
        await get().save({ checkpoint: true });
      },

      askAgent(text) {
        set({ ask: { text, at: Date.now() } });
      },

      connect() {
        const unsubscribe = session.subscribe((p, reason) => {
          // Loading a version or the other side of a conflict is not an edit: nothing to save
          if (reason === 'load') return set({ project: p });
          set({ project: p, dirty: true });
          scheduleSave();
        });
        return () => {
          unsubscribe();
          if (saveTimer) clearTimeout(saveTimer);
        };
      },

      viewHost(): ViewHost {
        return {
          get: () => get().view,
          set: patch => get().setView(patch),
          focus: (ids, hl) => get().focus(ids, hl),
          screenshot: async () => {
            const cap = get().capture;
            if (!cap) throw new Error(m.store_canvas_not_ready());
            return cap();
          },
        };
      },
    };
  });
  return store;
}

/** Capabilities that add or change a look: the chat shows it with a preview */
const LOOK_EDITS = new Set(['look_add', 'look_update', 'furniture_type_add']);

/** Look libraries for the agent, through the API as the user */
const librariesHost: LibrariesHost = { list: listLibraries, get: getLibrary, save: (lib, look, id) => saveToLibrary(lib, look, id) };

/** Draws look previews for the agent's self-check and the chat (three.js loads on demand) */
const looksHost: LooksHost = { preview: async (recipe, size) => (await import('./model3d/look-preview')).renderLookPreview(recipe, size) };

/** Agent reads/writes comments via the server API and refreshes the comments panel after replying */
function commentsHost(projectId: string): CommentsHost {
  return {
    list: () => api(`/projects/${projectId}/comments`),
    async reply(parentId, body, status) {
      await api(`/projects/${projectId}/comments`, { method: 'POST', json: { body: m.store_agent_comment({ body }), parentId } });
      if (status) await api(`/projects/${projectId}/comments/${parentId}`, { method: 'PATCH', json: { status } });
      await queryClient.invalidateQueries({ queryKey: ['comments', projectId] });
    },
  };
}

export const EditorContext = createContext<EditorStore | null>(null);

export function useEditor<T>(selector: (s: EditorState & EditorActions) => T): T {
  const store = useContext(EditorContext);
  if (!store) throw new Error('useEditor must be used inside EditorContext');
  return useStore(store, selector);
}

export function useEditorStore() {
  const store = useContext(EditorContext);
  if (!store) throw new Error('useEditorStore must be used inside EditorContext');
  return store;
}
