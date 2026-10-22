/**
 * 方案编辑器：一边对话、一边画布。手机上画布全屏，面板从底部弹出。
 * 页面暴露 window.artifact.call(能力, 参数) 和“已就绪”信号，任何 agent 用自己的浏览器都能验证。
 */
import { describe, type Project } from '@plinth/core';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeftIcon, BoxIcon, CloudCheckIcon, CloudIcon, DownloadIcon, EllipsisIcon, HistoryIcon, ImageIcon, LayoutPanelLeftIcon, LoaderIcon,
  MessageSquareIcon, MessagesSquareIcon, Redo2Icon, RulerIcon, Share2Icon, SquareIcon, TriangleAlertIcon, Undo2Icon, InfoIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { registry } from '@/agent/registry';
import { PlanPreview } from '@/components/site/PlanPreview';
import { api, can, ROLE_ZH } from '@/lib/api';
import { ChatPanel } from './ChatPanel';
import { CanvasFrame } from '@/canvas/CanvasFrame';
import { Model3D } from './Model3D';
import { AreasPanel, CommentsPanel, PropsPanel, VersionsPanel } from './Panels';
import { Plan2D, svgToPng } from './Plan2D';
import { ShareDialog } from './ShareDialog';
import { createEditorStore, EditorContext, useEditor, type InitialProject } from './store';

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
const TABS: { id: Tab; label: string; icon: typeof InfoIcon }[] = [
  { id: 'chat', label: '对话', icon: MessagesSquareIcon },
  { id: 'props', label: '属性', icon: InfoIcon },
  { id: 'areas', label: '面积', icon: RulerIcon },
  { id: 'comments', label: '评论', icon: MessageSquareIcon },
  { id: 'versions', label: '版本', icon: HistoryIcon },
];

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 767px)');
    const f = () => setM(q.matches);
    f();
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  return m;
}

/** 下载文件。大图的 data: 地址浏览器下载不可靠，统一转成 Blob 地址 */
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
  if (viewing != null) return <span className="text-xs text-muted-foreground">查看第 {viewing} 版（只读）</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
      {saving ? <LoaderIcon className="size-3.5 animate-spin" /> : dirty ? <CloudIcon className="size-3.5" /> : <CloudCheckIcon className="size-3.5" />}
      <span className="hidden sm:inline">{saving ? '保存中' : dirty ? '未保存' : `已保存 · 第 ${version} 版`}</span>
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
      <AlertTitle>别人刚保存了第 {conflict.version} 版</AlertTitle>
      <AlertDescription>
        要保留谁的修改？
        <div className="mt-1 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => resolve('theirs')}>用他们的</Button>
          <Button size="sm" onClick={() => resolve('mine')}>用我的覆盖</Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function Toolbar({ onShare, onExport }: { onShare: () => void; onExport: () => void }) {
  const project = useEditor(s => s.project);
  const view = useEditor(s => s.view);
  const setView = useEditor(s => s.setView);
  const role = useEditor(s => s.role);
  const undo = useEditor(s => s.undo);
  const redo = useEditor(s => s.redo);
  const canEdit = useEditor(s => s.canEdit());
  const session = useEditor(s => s.session);
  useEditor(s => s.project); // 撤销/重做可用状态随数据变化

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 1)], { type: 'application/json' });
    void download(URL.createObjectURL(blob), `${project.name}.json`);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
      <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link to="/projects" />} aria-label="返回我的方案"><ArrowLeftIcon /></Button>
      <div className="min-w-0 flex-1 md:flex-none">
        <p className="truncate text-sm font-medium">{project.name}</p>
      </div>
      <SaveStatus />
      <div className="flex-1 max-md:hidden" />
      <ToggleGroup value={[view.level]} onValueChange={v => v[0] && setView({ level: v[0] as string })} variant="outline" size="sm" className="max-md:hidden">
        {project.levels.map(l => <ToggleGroupItem key={l.id} value={l.id}>{l.name}</ToggleGroupItem>)}
      </ToggleGroup>
      <ToggleGroup value={[view.mode]} onValueChange={v => v[0] && setView({ mode: v[0] as '2d' | '3d' })} variant="outline" size="sm">
        <ToggleGroupItem value="2d" aria-label="平面"><SquareIcon /><span className="max-sm:hidden">平面</span></ToggleGroupItem>
        <ToggleGroupItem value="3d" aria-label="三维"><BoxIcon /><span className="max-sm:hidden">三维</span></ToggleGroupItem>
      </ToggleGroup>
      {canEdit && (
        <div className="flex max-sm:hidden">
          <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={undo} disabled={!session.canUndo} aria-label="撤销" />}><Undo2Icon /></TooltipTrigger><TooltipContent>撤销（⌘Z）</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={redo} disabled={!session.canRedo} aria-label="重做" />}><Redo2Icon /></TooltipTrigger><TooltipContent>重做（⇧⌘Z）</TooltipContent></Tooltip>
        </div>
      )}
      <Button size="sm" variant="outline" onClick={onShare}><Share2Icon /><span className="max-sm:hidden">{role === 'owner' ? '分享' : ROLE_ZH[role]}</span></Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="更多" />}><EllipsisIcon /></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onExport}><ImageIcon /> 导出图片</DropdownMenuItem>
          <DropdownMenuItem onClick={exportJson}><DownloadIcon /> 下载方案数据（JSON）</DropdownMenuItem>
          <DropdownMenuSeparator />
          {(['furniture', 'labels', 'dimensions'] as const).map(k => (
            <DropdownMenuItem key={k} onClick={() => setView({ layers: { ...view.layers, [k]: !view.layers[k] } })}>
              <LayoutPanelLeftIcon /> {view.layers[k] ? '隐藏' : '显示'}{k === 'furniture' ? '家具' : k === 'labels' ? '房间名和面积' : '尺寸'}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function PanelBody({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const store = useEditor(s => s);
  return (
    <>
      <TabsContent value="chat" keepMounted className="min-h-0 flex-1 data-[hidden]:hidden"><ChatPanel /></TabsContent>
      <TabsContent value="props" className="min-h-0 flex-1 overflow-y-auto"><PropsPanel /></TabsContent>
      <TabsContent value="areas" className="min-h-0 flex-1 overflow-y-auto"><AreasPanel /></TabsContent>
      <TabsContent value="comments" className="min-h-0 flex-1"><CommentsPanel onAskAgent={can(store.role, 'editor') ? text => { setTab('chat'); window.dispatchEvent(new CustomEvent('plinth:ask', { detail: text })); } : undefined} /></TabsContent>
      <TabsContent value="versions" className="min-h-0 flex-1 overflow-y-auto"><VersionsPanel /></TabsContent>
    </>
  );
}

/** 每次保存后上传一张平面缩略图（方案列表用） */
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
    const cs = getComputedStyle(document.documentElement);
    const html = svg.outerHTML
      .replace(/var\((--[a-z-]+)\)/g, (_m, v: string) => cs.getPropertyValue(v).trim() || 'sans-serif')
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    if (html.length < 190_000) void api(`/projects/${projectId}/thumbnail`, { method: 'PUT', body: html, headers: { 'Content-Type': 'image/svg+xml' } }).catch(() => {});
  }, [snap]);
  return snap ? <div ref={ref} className="hidden" aria-hidden><PlanPreview project={snap} /></div> : null;
}

function Workspace() {
  const view = useEditor(s => s.view);
  const project = useEditor(s => s.project);
  const setView = useEditor(s => s.setView);
  const setCapture = useEditor(s => s.setCapture);
  const svgRef = useRef<SVGSVGElement>(null);
  const mobile = useIsMobile();
  const [tab, setTab] = useState<Tab>('chat');
  const [sheet, setSheet] = useState(false);
  const [share, setShare] = useState(false);

  // 平面图模式下由 SVG 提供截图
  useEffect(() => {
    if (view.mode === '2d') {
      setCapture(() => (svgRef.current ? svgToPng(svgRef.current) : Promise.reject(new Error('平面图未就绪'))));
      return () => setCapture(null);
    }
  }, [view.mode]);

  const capture = useEditor(s => s.capture);
  const exportImage = async () => {
    try {
      const r = await capture!();
      const lv = project.levels.find(l => l.id === view.level)?.name ?? '';
      await download(r.dataUrl, `${project.name}-${lv}-${view.mode === '3d' ? '三维' : '平面'}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    }
  };

  // 选中对象时，手机上自动打开属性面板
  const sel = view.selection[0];
  useEffect(() => {
    if (sel && tab !== 'chat') setTab('props');
  }, [sel]);

  const tabs = (
    <Tabs value={tab} onValueChange={v => setTab(v as Tab)} className="flex h-full min-h-0 flex-col gap-0">
      <TabsList variant="line" className="w-full shrink-0 justify-start border-b px-2">
        {TABS.map(t => <TabsTrigger key={t.id} value={t.id} className="flex-none">{t.label}</TabsTrigger>)}
      </TabsList>
      <PanelBody tab={tab} setTab={setTab} />
    </Tabs>
  );

  return (
    <div className="flex h-dvh flex-col">
      <Toolbar onShare={() => setShare(true)} onExport={exportImage} />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1" aria-label="画布">
          <Conflict />
          <CanvasFrame className="absolute inset-0 size-full border-0">
            {view.mode === '2d' ? <Plan2D svgRef={svgRef} /> : <Model3D />}
          </CanvasFrame>
          {/* 手机：楼层切换浮在画布上 */}
          <div className="absolute top-2 left-2 md:hidden">
            <ToggleGroup value={[view.level]} onValueChange={v => v[0] && setView({ level: v[0] as string })} variant="outline" size="sm" className="bg-background">
              {project.levels.map(l => <ToggleGroupItem key={l.id} value={l.id}>{l.name}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
          {mobile && (
            <nav className="absolute inset-x-0 bottom-0 flex justify-around border-t bg-background/95 pb-[env(safe-area-inset-bottom)]">
              {TABS.slice(0, 4).map(t => (
                <Button key={t.id} variant="ghost" className="h-auto flex-1 flex-col gap-0.5 rounded-none py-2 text-xs font-normal" onClick={() => { setTab(t.id); setSheet(true); }}>
                  <t.icon className="size-5" />{t.label}
                </Button>
              ))}
            </nav>
          )}
        </main>
        {!mobile && <aside className="flex w-[380px] shrink-0 flex-col border-l lg:w-[420px]">{tabs}</aside>}
      </div>
      {mobile && (
        <Sheet open={sheet} onOpenChange={setSheet}>
          <SheetContent side="bottom" className="h-[75dvh] gap-0 p-0">
            <SheetHeader className="sr-only"><SheetTitle>{TABS.find(t => t.id === tab)?.label}</SheetTitle></SheetHeader>
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
  const navigate = useNavigate();

  // 链接里指定版本时只读打开
  useEffect(() => {
    if (search.v && search.v !== initial.version) void store.getState().loadVersion(search.v);
  }, []);

  // 浏览器自动化接口
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

  // 视图状态写回链接，方便分享到指定楼层和视图
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.view.level !== prev.view.level || s.view.mode !== prev.view.mode)
          void navigate({ to: '.', search: (old: any) => ({ ...old, level: s.view.level, mode: s.view.mode }), replace: true });
      }),
    [store],
  );

  // 快捷键；离开前保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable]')) return;
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
