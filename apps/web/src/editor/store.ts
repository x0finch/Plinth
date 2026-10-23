/**
 * Editor state, one per open plan. Data lives in the core package Session and all changes go through the capability list;
 * this only handles view state, autosave, conflicts and the before/after comparison.
 */
import { capabilityTitle, findObject, mutates, Session, type Actor, type CallResult, type Project, type TxResult } from '@plinth/core';
import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { registry } from '@/agent/registry';
import type { CommentsHost, ViewHost, ViewState } from '@/agent/view-capabilities';
import { api, ApiError, can, type Role } from '@/lib/api';
import { m } from '@/lib/i18n';

export interface LastChange {
  label: string;
  actor: Actor['kind'];
  before: Project;
  changed: string[];
  areaChanges: TxResult['areaChanges'];
  warnings: NonNullable<CallResult['warnings']>;
  at: number;
}

export interface EditorState {
  projectId: string;
  name: string;
  role: Role;
  version: number;
  model: { id: string; label: string; provider: string; model: string } | null;
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
  compare: boolean;
  /** Screenshot function registered by the canvas */
  capture: (() => Promise<{ dataUrl: string; width: number; height: number }>) | null;
}

export interface EditorActions {
  call(name: string, input: unknown, actor?: Actor): Promise<CallResult>;
  setView(patch: Partial<ViewState>): ViewState;
  select(ids: string[]): void;
  focus(ids: string[], highlight?: boolean): ViewState;
  undo(): void;
  redo(): void;
  save(force?: boolean): Promise<void>;
  resolveConflict(keep: 'mine' | 'theirs'): Promise<void>;
  setCompare(on: boolean): void;
  setCapture(fn: EditorState['capture']): void;
  loadVersion(version: number | null): Promise<void>;
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
  model: EditorState['model'];
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

    session.subscribe(p => {
      set({ project: p, dirty: true });
      scheduleSave();
    });

    const view: ViewState = {
      mode: opts.mode ?? '2d',
      level: opts.level && init.content.levels.some(l => l.id === opts.level) ? opts.level : firstLevel(init.content),
      selection: [],
      highlight: opts.focus ?? [],
      camera: null,
      layers: { furniture: true, dimensions: true, labels: true },
    };

    return {
      projectId: init.id,
      name: init.name,
      role: init.role,
      version: init.version,
      model: init.model,
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
      compare: false,
      capture: null,

      canEdit: () => can(get().role, 'editor') && get().readOnlyVersion == null,

      async call(name, input, actor = { kind: 'user' }) {
        const cap = registry.get(name);
        if (cap && mutates(cap) && !get().canEdit()) {
          return { ok: false, error: { code: 'forbidden', message: get().readOnlyVersion != null ? m.store_readonly_history() : m.store_readonly_viewer() } };
        }
        const before = session.project;
        const r = await registry.call(name, input, { session, actor, host: { view: get().viewHost(), comments: commentsHost(get().projectId) } });
        if (r.ok && cap?.mode === 'edit' && r.changed?.length) {
          set(s => ({
            pendingLabels: [...s.pendingLabels, session.log.at(-1)?.label ?? capabilityTitle(cap)],
            lastChange: {
              label: session.log.at(-1)?.label ?? capabilityTitle(cap), actor: actor.kind, before, changed: r.changed!,
              areaChanges: r.areaChanges ?? [], warnings: r.warnings ?? [], at: Date.now(),
            },
            view: { ...s.view, highlight: r.changed! },
          }));
        }
        return r;
      },

      setView(patch) {
        const v = { ...get().view, ...patch };
        set({ view: v });
        return v;
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

      async save(force = false) {
        const s = get();
        if (!s.dirty || s.saving || s.conflict || !s.canEdit()) return;
        set({ saving: true });
        const labels = s.pendingLabels;
        const summary = (labels.length > 3 ? [...labels.slice(0, 3), m.store_summary_more({ count: labels.length })] : labels).join(m.store_summary_separator()).slice(0, 200) || m.store_summary_default();
        const snapshot = session.project;
        try {
          const r = await api<{ version: number }>(`/projects/${s.projectId}`, {
            method: 'PUT',
            json: { base: s.version, summary, content: snapshot },
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

/** Agent reads/writes comments via the server API and refreshes the comments panel after replying */
function commentsHost(projectId: string): CommentsHost {
  return {
    list: () => api(`/projects/${projectId}/comments`),
    async reply(parentId, body, status) {
      await api(`/projects/${projectId}/comments`, { method: 'POST', json: { body: m.store_agent_comment({ body }), parentId } });
      if (status) await api(`/projects/${projectId}/comments/${parentId}`, { method: 'PATCH', json: { status } });
      window.dispatchEvent(new Event('plinth:comments-changed'));
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
