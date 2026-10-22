/**
 * 编辑器状态：一个打开的方案一份。数据在核心包的 Session 里，所有修改都经能力清单；
 * 这里只管视图状态、自动保存、冲突和“改前 / 改后”对比。
 */
import { Session, type Actor, type CallResult, type Project, type TxResult } from '@plinth/core';
import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { registry } from '@/agent/registry';
import type { CommentsHost, ViewHost, ViewState } from '@/agent/view-capabilities';
import { api, ApiError, can, type Role } from '@/lib/api';

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
  /** 画布注册的截图函数 */
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

/** 对象所在楼层 */
export function levelOf(p: Project, id: string): string | undefined {
  return (
    p.walls.find(w => w.id === id)?.level ??
    p.spaces.find(s => s.id === id)?.level ??
    p.furniture.find(f => f.id === id)?.level ??
    p.elements.find(e => e.id === id)?.level ??
    p.walls.find(w => w.openings.some(o => o.id === id))?.level ??
    p.levels.find(l => l.id === id)?.id
  );
}

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
        if (cap && cap.mode === 'edit' && !get().canEdit()) {
          return { ok: false, error: { code: 'forbidden', message: get().readOnlyVersion != null ? '正在查看历史版本，不能修改' : '你只有查看权限' } };
        }
        const before = session.project;
        const r = await registry.call(name, input, { session, actor, host: { view: get().viewHost(), comments: commentsHost(get().projectId) } });
        if (r.ok && cap?.mode === 'edit' && r.changed?.length) {
          set(s => ({
            pendingLabels: [...s.pendingLabels, session.log.at(-1)?.label ?? cap.title],
            lastChange: {
              label: session.log.at(-1)?.label ?? cap.title, actor: actor.kind, before, changed: r.changed!,
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
        // 点空白处：同时清掉改动高亮
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
        if (e) set(s => ({ pendingLabels: [...s.pendingLabels, `撤销：${e.label}`], view: { ...s.view, highlight: e.changed }, lastChange: null }));
      },

      redo() {
        const e = session.redo();
        if (e) set(s => ({ pendingLabels: [...s.pendingLabels, `重做：${e.label}`], view: { ...s.view, highlight: e.changed } }));
      },

      async save(force = false) {
        const s = get();
        if (!s.dirty || s.saving || s.conflict || !s.canEdit()) return;
        set({ saving: true });
        const labels = s.pendingLabels;
        const summary = (labels.length > 3 ? [...labels.slice(0, 3), `等 ${labels.length} 项`] : labels).join('；').slice(0, 200) || '保存';
        const snapshot = session.project;
        try {
          const r = await api<{ version: number }>(`/projects/${s.projectId}`, {
            method: 'PUT',
            json: { base: s.version, summary, content: snapshot },
          });
          set(cur => ({
            version: r.version, saving: false, savedAt: Date.now(),
            // 保存期间又有新修改：继续标记未保存，稍后再存
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
            if (!cap) throw new Error('画布还没准备好');
            return cap();
          },
        };
      },
    };
  });
  return store;
}

/** agent 读写评论：走服务端接口，回复后刷新评论面板 */
function commentsHost(projectId: string): CommentsHost {
  return {
    list: () => api(`/projects/${projectId}/comments`),
    async reply(parentId, body, status) {
      await api(`/projects/${projectId}/comments`, { method: 'POST', json: { body: `【agent】${body}`, parentId } });
      if (status) await api(`/projects/${projectId}/comments/${parentId}`, { method: 'PATCH', json: { status } });
      window.dispatchEvent(new Event('plinth:comments-changed'));
    },
  };
}

export const EditorContext = createContext<EditorStore | null>(null);

export function useEditor<T>(selector: (s: EditorState & EditorActions) => T): T {
  const store = useContext(EditorContext);
  if (!store) throw new Error('useEditor 必须在 EditorContext 里');
  return useStore(store, selector);
}

export function useEditorStore() {
  const store = useContext(EditorContext);
  if (!store) throw new Error('useEditorStore 必须在 EditorContext 里');
  return store;
}
