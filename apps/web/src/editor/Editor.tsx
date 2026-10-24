/**
 * Plan editor: chat on one side, canvas on the other. On phones the canvas is full screen and panels slide up from the bottom.
 * The page exposes window.artifact.call(capability, args) and a "ready" signal, so any agent can verify it with its own browser.
 */
import { describe, type Project } from '@plinth/core';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeftIcon, BoxIcon, CloudCheckIcon, CloudIcon, DownloadIcon, EllipsisIcon, HistoryIcon, ImageIcon, LayoutPanelLeftIcon, LoaderIcon,
  LayersIcon, MessageSquareIcon, MessagesSquareIcon, Redo2Icon, RulerIcon, ScanIcon, Share2Icon, SquareIcon, TriangleAlertIcon, Undo2Icon, InfoIcon,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { registry } from '@/agent/registry';
import { PlanPreview } from '@/components/site/PlanPreview';
import { api, roleLabel } from '@/lib/api';
import { standaloneSvg } from '@/lib/theme';
import { m } from '@/lib/i18n';
import { ChatPanel } from './ChatPanel';
import { CanvasFrame } from '@/canvas/CanvasFrame';
import { Spinner } from '@/components/ui/spinner';
import { HopDriver } from '@/canvas/HopDriver';
import { AreasPanel, CommentsPanel, PropsPanel, VersionsPanel } from './panels';
import { Plan2D, svgToPng } from './Plan2D';
import { ShareDialog } from './ShareDialog';
import { createEditorStore, EditorContext, useEditor, type InitialProject } from './store';

/** 3D (three.js) is most of the plan page script; load it only when switching to 3D */
const loadModel3D = () => import('./Model3D');
const Model3D = lazy(() => loadModel3D().then(mod => ({ default: mod.Model3D })));

declare global {
  interface Window {
    artifact?: {
      ready: boolean;
      call: (name: string, input?: unknown) => Promise<unknown>;
      capabilities: () => unknown[];
      project: () => unknown;
    };
  }
}

type Tab = 'chat' | 'props' | 'areas' | 'comments' | 'versions';
const TABS: { id: Tab; label: () => string; icon: typeof InfoIcon }[] = [
  { id: 'chat', label: m.editor_tab_chat, icon: MessagesSquareIcon },
  { id: 'props', label: m.editor_tab_props, icon: InfoIcon },
  { id: 'areas', label: m.editor_tab_areas, icon: RulerIcon },
  { id: 'comments', label: m.editor_tab_comments, icon: MessageSquareIcon },
  { id: 'versions', label: m.editor_tab_versions, icon: HistoryIcon },
];

/** Layer toggle labels: [show, hide] */
const LAYER_LABELS = {
  furniture: [m.editor_show_furniture, m.editor_hide_furniture],
  labels: [m.editor_show_labels, m.editor_hide_labels],
  dimensions: [m.editor_show_dimensions, m.editor_hide_dimensions],
} as const;

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 767px)');
    const f = () => setMobile(q.matches);
    f();
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  return mobile;
}

/** Download a file. Browsers download large data: URLs unreliably, so always convert to a Blob URL */
async function download(url: string, filename: string) {
  const href = url.startsWith('data:') ? URL.createObjectURL(await (await fetch(url)).blob()) : url;
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

function SaveStatus() {
  const saving = useEditor(s => s.saving);
  const dirty = useEditor(s => s.dirty);
  const version = useEditor(s => s.version);
  const viewing = useEditor(s => s.readOnlyVersion);
  if (viewing != null) return <span className="text-xs text-muted-foreground">{m.editor_viewing_version({ version: viewing })}</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
      {saving ? <LoaderIcon className="size-3.5 animate-spin" /> : dirty ? <CloudIcon className="size-3.5" /> : <CloudCheckIcon className="size-3.5" />}
      <span className="hidden sm:inline">{saving ? m.editor_saving() : dirty ? m.editor_unsaved() : m.editor_saved_version({ version })}</span>
    </span>
  );
}

function Conflict() {
  const conflict = useEditor(s => s.conflict);
  const resolve = useEditor(s => s.resolveConflict);
  if (!conflict) return null;
  return (
    <Alert className="absolute inset-x-0 top-0 z-20 m-3 w-auto shadow-sm">
      <TriangleAlertIcon />
      <AlertTitle>{m.editor_conflict_title({ version: conflict.version })}</AlertTitle>
      <AlertDescription>
        {m.editor_conflict_question()}
        <div className="mt-1 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => resolve('theirs')}>{m.editor_conflict_theirs()}</Button>
          <Button size="sm" onClick={() => resolve('mine')}>{m.editor_conflict_mine()}</Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Level switcher, floating over the canvas top-left: a level is a choice within the plan / 3D view, stacked top floor first like
 * the building. In 3D the whole house is shown unless the cutaway is on (then the chosen level and the ones below it).
 */
function LevelSwitcher({ className }: { className?: string }) {
  const levels = useEditor(s => s.project.levels);
  const level = useEditor(s => s.view.level);
  const setView = useEditor(s => s.setView);
  const stacked = useMemo(() => [...levels].sort((a, b) => b.elevation - a.elevation), [levels]);
  return (
    <ToggleGroup value={[level]} onValueChange={v => v[0] && setView({ level: v[0] as string })} orientation="vertical" variant="outline" size="sm" spacing={0}
      aria-label={m.editor_levels_aria()} className={className}>
      {stacked.map(l => <ToggleGroupItem key={l.id} value={l.id}>{l.name}</ToggleGroupItem>)}
    </ToggleGroup>
  );
}

/**
 * View tools, floating over the canvas top-right: fit all, the switch to the other view (labelled with where it goes), and in 3D
 * the cutaway toggle.
 */
function CanvasTools({ className }: { className?: string }) {
  const view = useEditor(s => s.view);
  const setView = useEditor(s => s.setView);
  const fitView = useEditor(s => s.fitView);
  const leave3D = useEditor(s => s.leave3D);
  const setPlanUntil3D = useEditor(s => s.setPlanUntil3D);
  const [switching, setSwitching] = useState(false);
  const to = view.mode === '2d' ? '3d' : '2d';
  // Leaving 3D lets the house sink back into the plan first
  const switchView = async () => {
    setSwitching(true);
    try {
      if (to === '2d' && leave3D) await leave3D();
      else if (to === '3d') setPlanUntil3D(true);
      setView({ mode: to });
    } finally {
      setSwitching(false);
    }
  };
  const cutaway = view.layers.cutaway;
  return (
    <div className={cn('flex gap-1', className)}>
      {view.mode === '3d' && (
        <Tooltip>
          <TooltipTrigger render={
            <Toggle size="sm" variant="outline" className="bg-background aria-pressed:bg-primary aria-pressed:text-primary-foreground" pressed={cutaway}
              onPressedChange={p => setView({ layers: { ...view.layers, cutaway: p } })} aria-label={m.model3d_cutaway()} />
          }><LayersIcon /></TooltipTrigger>
          <TooltipContent>{cutaway ? m.model3d_whole() : m.model3d_cutaway()}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger render={<Button size="icon-sm" variant="outline" className="bg-background" onClick={fitView} aria-label={m.canvas_fit()} />}><ScanIcon /></TooltipTrigger>
        <TooltipContent>{m.canvas_fit()}</TooltipContent>
      </Tooltip>
      <Button size="sm" variant="outline" className="bg-background" onClick={switchView} disabled={switching}>
        {to === '3d' ? <BoxIcon /> : <SquareIcon />}{to === '3d' ? m.editor_view_3d() : m.editor_view_2d()}
      </Button>
    </div>
  );
}

function Toolbar({ onShare, onExport }: { onShare: () => void; onExport: () => void }) {
  // Subscribing to the project also keeps undo/redo availability current
  const project = useEditor(s => s.project);
  const view = useEditor(s => s.view);
  const setView = useEditor(s => s.setView);
  const role = useEditor(s => s.role);
  const undo = useEditor(s => s.undo);
  const redo = useEditor(s => s.redo);
  const canEdit = useEditor(s => s.canEdit());
  const session = useEditor(s => s.session);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 1)], { type: 'application/json' });
    void download(URL.createObjectURL(blob), `${project.name}.json`);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
      <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link to="/projects" />} aria-label={m.editor_back_to_projects()}><ArrowLeftIcon /></Button>
      <div className="min-w-0 flex-1 md:flex-none">
        <p className="truncate text-sm font-medium">{project.name}</p>
      </div>
      <SaveStatus />
      <div className="flex-1 max-md:hidden" />
      {canEdit && (
        <div className="flex max-sm:hidden">
          <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={undo} disabled={!session.canUndo} aria-label={m.editor_undo()} />}><Undo2Icon /></TooltipTrigger><TooltipContent>{m.editor_undo_shortcut()}</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={redo} disabled={!session.canRedo} aria-label={m.editor_redo()} />}><Redo2Icon /></TooltipTrigger><TooltipContent>{m.editor_redo_shortcut()}</TooltipContent></Tooltip>
        </div>
      )}
      <Button size="sm" variant="outline" onClick={onShare}><Share2Icon /><span className="max-sm:hidden">{role === 'owner' ? m.editor_share() : roleLabel(role)}</span></Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={m.editor_more()} />}><EllipsisIcon /></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onExport}><ImageIcon /> {m.editor_export_image()}</DropdownMenuItem>
          <DropdownMenuItem onClick={exportJson}><DownloadIcon /> {m.editor_download_json()}</DropdownMenuItem>
          <DropdownMenuSeparator />
          {(['furniture', 'labels', 'dimensions'] as const).map(k => (
            <DropdownMenuItem key={k} onClick={() => setView({ layers: { ...view.layers, [k]: !view.layers[k] } })}>
              <LayoutPanelLeftIcon /> {LAYER_LABELS[k][view.layers[k] ? 1 : 0]()}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function PanelBody() {
  return (
    <>
      <TabsContent value="chat" keepMounted className="min-h-0 flex-1 data-[hidden]:hidden"><ChatPanel /></TabsContent>
      <TabsContent value="props" className="min-h-0 flex-1 overflow-y-auto"><PropsPanel /></TabsContent>
      <TabsContent value="areas" className="min-h-0 flex-1 overflow-y-auto"><AreasPanel /></TabsContent>
      <TabsContent value="comments" className="min-h-0 flex-1"><CommentsPanel /></TabsContent>
      <TabsContent value="versions" className="min-h-0 flex-1 overflow-y-auto"><VersionsPanel /></TabsContent>
    </>
  );
}

/**
 * Upload a thumbnail for the design list after each save (and on opening): a still of the house in 3D, or the plan when 3D can't
 * be drawn
 */
function Thumbnail() {
  const version = useEditor(s => s.version);
  const projectId = useEditor(s => s.projectId);
  const canEdit = useEditor(s => s.canEdit());
  const session = useEditor(s => s.session);
  const ref = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Project | null>(null);
  useEffect(() => {
    if (!canEdit) return;
    const t = setTimeout(() => setSnap(session.project), 2000);
    return () => clearTimeout(t);
  }, [version]);
  useEffect(() => {
    const svg = ref.current?.querySelector('svg');
    if (!snap || !svg) return;
    const put = (body: string, type: string) => body.length < 290_000 && api(`/projects/${projectId}/thumbnail`, { method: 'PUT', body, headers: { 'Content-Type': type } });
    const plan = standaloneSvg(svg);
    void import('./model3d/house-still')
      .then(({ renderHouseStill }) => renderHouseStill(snap))
      .then(jpeg => put(jpeg, 'text/plain'), () => put(plan, 'image/svg+xml'))
      .catch(() => {});
  }, [snap]);
  return snap ? <div ref={ref} className="hidden" aria-hidden><PlanPreview project={snap} /></div> : null;
}

/**
 * The canvas with its floating controls: the plan or the 3D view (the plan stays on screen while 3D gets ready), the level
 * switcher top-left and the view tools top-right.
 */
export function EditorCanvas({ svgRef }: { svgRef?: React.RefObject<SVGSVGElement | null> }) {
  const view = useEditor(s => s.view);
  const planUntil3D = useEditor(s => s.planUntil3D);
  // Fetch the 3D view's code once the canvas is idle, so switching to 3D grows the house without a loading pause first
  useEffect(() => {
    const id = setTimeout(() => void loadModel3D(), 1500);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      <CanvasFrame className="absolute inset-0 size-full border-0">
        <HopDriver />
        {view.mode === '2d' ? <Plan2D svgRef={svgRef} /> : (
          <Suspense fallback={<div className="flex size-full items-center justify-center text-muted-foreground"><Spinner className="size-6" /></div>}>
            <Model3D />
          </Suspense>
        )}
        {view.mode === '3d' && planUntil3D && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Plan2D />
          </div>
        )}
      </CanvasFrame>
      <div className="absolute top-2 left-2">
        <LevelSwitcher className="bg-background shadow-xs" />
      </div>
      <CanvasTools className="absolute top-2 right-2" />
    </>
  );
}

function Workspace() {
  const view = useEditor(s => s.view);
  const project = useEditor(s => s.project);
  const setCapture = useEditor(s => s.setCapture);
  const ask = useEditor(s => s.ask);
  const svgRef = useRef<SVGSVGElement>(null);
  const mobile = useIsMobile();
  const [tab, setTab] = useState<Tab>('chat');
  const [sheet, setSheet] = useState(false);
  const [share, setShare] = useState(false);

  // In plan mode the SVG provides the screenshot
  useEffect(() => {
    if (view.mode === '2d') {
      setCapture(() => (svgRef.current ? svgToPng(svgRef.current) : Promise.reject(new Error(m.editor_plan_not_ready()))));
      return () => setCapture(null);
    }
  }, [view.mode]);

  const capture = useEditor(s => s.capture);
  const exportImage = async () => {
    try {
      const r = await capture!();
      const lv = project.levels.find(l => l.id === view.level)?.name ?? '';
      await download(r.dataUrl, `${project.name}-${lv}-${view.mode === '3d' ? m.editor_view_3d() : m.editor_view_2d()}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : m.editor_export_failed());
    }
  };

  // Something was handed to the agent (e.g. from a comment): show the chat
  useEffect(() => {
    if (ask) setTab('chat');
  }, [ask]);

  // On phones, open the properties panel when an object is selected
  const sel = view.selection[0];
  useEffect(() => {
    if (sel && tab !== 'chat') setTab('props');
  }, [sel]);

  const tabs = (
    <Tabs value={tab} onValueChange={v => setTab(v as Tab)} className="flex h-full min-h-0 flex-col gap-0">
      <TabsList variant="line" className="w-full shrink-0 justify-start border-b px-2">
        {TABS.map(t => <TabsTrigger key={t.id} value={t.id} className="flex-none">{t.label()}</TabsTrigger>)}
      </TabsList>
      <PanelBody />
    </Tabs>
  );

  return (
    <div className="flex h-dvh flex-col">
      <Toolbar onShare={() => setShare(true)} onExport={exportImage} />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1" aria-label={m.editor_canvas()}>
          <Conflict />
          <EditorCanvas svgRef={svgRef} />
          {mobile && (
            <nav className="absolute inset-x-0 bottom-0 flex justify-around border-t bg-background/95 pb-[env(safe-area-inset-bottom)]">
              {TABS.slice(0, 4).map(t => (
                <Button key={t.id} variant="ghost" className="h-auto flex-1 flex-col gap-0.5 rounded-none py-2 text-xs font-normal" onClick={() => { setTab(t.id); setSheet(true); }}>
                  <t.icon className="size-5" />{t.label()}
                </Button>
              ))}
            </nav>
          )}
        </main>
        {!mobile && <aside className="flex w-[380px] shrink-0 flex-col border-l lg:w-[420px]">{tabs}</aside>}
      </div>
      {mobile && (
        <Sheet open={sheet} onOpenChange={setSheet}>
          {/* The base bottom sheet is h-auto under data-[side=bottom]; the height must use the same variant to win, or the panels grow instead of scrolling */}
          <SheetContent side="bottom" className="gap-0 p-0 data-[side=bottom]:h-[75dvh]">
            <SheetHeader className="sr-only"><SheetTitle>{TABS.find(t => t.id === tab)?.label()}</SheetTitle></SheetHeader>
            {tabs}
          </SheetContent>
        </Sheet>
      )}
      <ShareDialog open={share} onOpenChange={setShare} />
      <Thumbnail />
    </div>
  );
}

export function Editor({ initial, search }: { initial: InitialProject; search: { level?: string; mode?: '2d' | '3d'; focus?: string; v?: number } }) {
  const store = useMemo(
    () => createEditorStore(initial, { level: search.level, mode: search.mode, focus: search.focus?.split(',').filter(Boolean) }),
    [initial.id],
  );
  useEffect(() => store.getState().connect(), [store]);
  const navigate = useNavigate();

  // Open read-only when the link specifies a version
  useEffect(() => {
    if (search.v && search.v !== initial.version) void store.getState().loadVersion(search.v);
  }, []);

  // Browser automation interface
  useEffect(() => {
    window.artifact = {
      ready: true,
      call: (name, input) => store.getState().call(name, input ?? {}, { kind: 'external' }),
      capabilities: () => registry.list().map(describe),
      project: () => store.getState().project,
    };
    document.documentElement.dataset.artifactReady = 'true';
    window.dispatchEvent(new Event('artifact:ready'));
    return () => {
      delete window.artifact;
      delete document.documentElement.dataset.artifactReady;
    };
  }, [store]);

  // Write view state back to the URL so links share a specific floor and view
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.view.level !== prev.view.level || s.view.mode !== prev.view.mode)
          void navigate({ to: '.', search: (old: any) => ({ ...old, level: s.view.level, mode: s.view.mode }), replace: true });
      }),
    [store],
  );

  // Shortcuts; save before leaving
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The target can be the document or window (no closest) when nothing has focus
      const t = e.target as Partial<HTMLElement> | null;
      if (t?.closest?.('input, textarea, [contenteditable]')) return;
      const s = store.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (!s.canEdit()) return;
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (e.key === 'Escape') s.select([]);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') void store.getState().save();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (store.getState().dirty) {
        void store.getState().save();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
      void store.getState().save();
    };
  }, [store]);

  return (
    <EditorContext.Provider value={store}>
      <Workspace />
    </EditorContext.Provider>
  );
}
