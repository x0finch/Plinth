/** 侧栏面板：选中对象的属性、面积、评论、版本。 */
import { areaReport, checkRules } from '@plinth/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, HistoryIcon, MessageSquareIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { registry } from '@/agent/registry';
import { api, can } from '@/lib/api';
import { fmtArea, fmtTime } from '@/lib/query';
import { useEditor, useEditorStore } from './store';

const KIND_ZH: Record<string, string> = {
  bearing: '承重墙', partition: '隔墙', fence: '围墙', parapet: '女儿墙', railing: '栏杆',
  indoor: '室内', 'semi-outdoor': '半室外', outdoor: '室外', 'roof-terrace': '屋顶平台', void: '通高',
  door: '门', 'sliding-door': '推拉门', gate: '大门', window: '窗', opening: '洞口',
};

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-mono">{v}</span>
    </div>
  );
}

export function PropsPanel() {
  const store = useEditorStore();
  const project = useEditor(s => s.project);
  const sel = useEditor(s => s.view.selection);
  const canEdit = useEditor(s => s.canEdit());
  const call = useEditor(s => s.call);
  const [name, setName] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    let live = true;
    if (!sel[0]) setData(null);
    else void registry.call('get_object', { ref: sel[0] }, { session: store.getState().session, actor: { kind: 'user' } }).then(r => live && setData(r.ok ? r.result : null));
    return () => {
      live = false;
    };
  }, [sel[0], project]);

  const issues = useMemo(() => checkRules(project), [project]);
  const level = useEditor(s => s.view.level);
  const levelIssues = issues.filter(i => i.targets.some(t => {
    const o = project.spaces.find(s => s.id === t) ?? project.walls.find(w => w.id === t || w.openings.some(x => x.id === t)) ?? project.furniture.find(f => f.id === t);
    return o?.level === level;
  }));

  const run = async (n: string, input: unknown) => {
    const r = await call(n, input);
    if (!r.ok) toast.error(r.error?.message ?? '操作失败');
    return r;
  };

  if (!data) {
    return (
      <div className="space-y-4 p-4 text-sm">
        <p className="text-muted-foreground">在图上点选一面墙、一个房间、一扇门窗或一件家具，查看它的信息。按住 Shift 可以多选。</p>
        <Separator />
        <div>
          <p className="mb-2 font-medium">本层检查</p>
          {levelIssues.length === 0 ? (
            <p className="flex items-center gap-1.5 text-muted-foreground"><CheckIcon className="size-4" /> 没有发现问题</p>
          ) : (
            <ul className="space-y-1.5">
              {levelIssues.map((i, k) => (
                <li key={k}>
                  <button className="flex w-full items-start gap-1.5 text-left hover:underline" onClick={() => store.getState().focus(i.targets)}>
                    <TriangleAlertIcon className={`mt-0.5 size-4 shrink-0 ${i.severity === 'error' ? 'text-destructive' : 'text-amber-600'}`} />
                    <span>{i.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  const t = data.type;
  return (
    <div className="space-y-3 p-4">
      <div>
        <p className="text-xs text-muted-foreground">{t === 'space' ? '空间' : t === 'wall' ? '墙' : t === 'opening' ? '门窗' : t === 'furniture' ? '家具' : t}</p>
        {canEdit && (t === 'space' || t === 'wall') ? (
          <Input
            className="mt-1 h-8 font-medium"
            value={name ?? data.name}
            onChange={e => setName(e.target.value)}
            onBlur={() => {
              if (name && name !== data.name) void run(t === 'space' ? 'space_update' : 'wall_update', { [t]: data.id, name });
              setName(null);
            }}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="名称"
          />
        ) : (
          <h3 className="text-base font-medium">{data.name}</h3>
        )}
      </div>
      {t === 'space' && (
        <div>
          <p className="text-lg font-medium">{fmtArea(data.netArea)}</p>
          <Row k="类型" v={KIND_ZH[data.kind]} />
          <Row k="开间 × 进深" v={`${(data.bounds.width / 1000).toFixed(2)} × ${(data.bounds.depth / 1000).toFixed(2)} m`} />
          <Row k="地面" v={project.library.materials[data.floor]?.name ?? data.floor} />
          <Separator className="my-2" />
          <p className="mb-1 text-xs text-muted-foreground">四周</p>
          {data.walls.map((w: any) => (
            <button key={w.id} className="flex w-full justify-between py-0.5 text-left text-sm hover:underline" onClick={() => store.getState().select([w.id])}>
              <span>{w.direction} · {w.name}</span>
              <span className="text-muted-foreground">{w.openings.length ? `${w.openings.length} 个门窗` : ''}</span>
            </button>
          ))}
          {data.neighbors.length > 0 && (
            <>
              <p className="mt-2 mb-1 text-xs text-muted-foreground">相邻</p>
              <p className="text-sm">{data.neighbors.map((n: any) => n.name).join('、')}</p>
            </>
          )}
        </div>
      )}
      {t === 'wall' && (
        <div>
          <Row k="类型" v={KIND_ZH[data.kind]} />
          <Row k="长度" v={`${(data.length / 1000).toFixed(2)} m`} />
          <Row k="厚度" v={`${data.thickness} mm`} />
          <Row k="两侧" v={data.spaces.map((s: any) => s.space).join(' / ') || '—'} />
          {data.openings.length > 0 && <Row k="门窗" v={data.openings.map((o: any) => KIND_ZH[o.kind]).join('、')} />}
          {data.kind === 'bearing' && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">承重墙：改动需专业人员复核</p>}
        </div>
      )}
      {t === 'opening' && (
        <div>
          <Row k="类型" v={KIND_ZH[data.kind]} />
          <Row k="宽 × 高" v={`${data.width} × ${data.height} mm`} />
          {data.sill > 0 && <Row k="窗台高" v={`${data.sill} mm`} />}
          <Row k="所在墙" v={data.wall.name} />
          <Row k="连通" v={data.connects.map((s: any) => s.name).join(' ↔ ') || '—'} />
        </div>
      )}
      {t === 'furniture' && (
        <div>
          <Row k="类别" v={data.label ?? data.type} />
          <Row k="尺寸" v={`${data.size.w} × ${data.size.d} × ${data.size.h} mm`} />
          <Row k="旋转" v={`${data.rotation}°`} />
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2 pt-1">
          {t === 'furniture' && (
            <>
              <Button size="sm" variant="outline" onClick={() => run('furniture_move', { furniture: data.id, rotation: (data.rotation + 90) % 360 })}>旋转 90°</Button>
              <Button size="sm" variant="outline" onClick={() => run('furniture_remove', { furniture: data.id })}><Trash2Icon /> 移走</Button>
            </>
          )}
          {t === 'opening' && <Button size="sm" variant="outline" onClick={() => run('opening_remove', { opening: data.id })}><Trash2Icon /> 封掉</Button>}
          {t === 'wall' && data.kind !== 'bearing' && <Button size="sm" variant="outline" onClick={() => run('wall_remove', { wall: data.id })}><Trash2Icon /> 拆除</Button>}
          {t === 'space' && <Button size="sm" variant="outline" onClick={() => run('space_remove', { space: data.id })}><Trash2Icon /> 删除空间</Button>}
        </div>
      )}
    </div>
  );
}

export function AreasPanel() {
  const project = useEditor(s => s.project);
  const focus = useEditor(s => s.focus);
  const report = useMemo(() => areaReport(project), [project]);
  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs text-muted-foreground">合计建筑面积</p>
        <p className="text-2xl font-medium">{fmtArea(report.totalGross)}</p>
      </div>
      {report.levels.filter(l => l.spaces.length).map(l => {
        const inner = l.spaces.filter(s => s.kind === 'indoor').reduce((a, s) => a + s.net, 0);
        return (
          <div key={l.id}>
            <div className="flex items-baseline justify-between">
              <p className="font-medium">{l.name}</p>
              <p className="text-xs text-muted-foreground">建筑 {fmtArea(l.gross)} · 室内使用 {fmtArea(inner)}</p>
            </div>
            <ul className="mt-1">
              {l.spaces.map(s => (
                <li key={s.id}>
                  <button className="flex w-full justify-between py-0.5 text-sm hover:underline" onClick={() => focus([s.id])}>
                    <span>{s.name}{s.kind !== 'indoor' && <span className="text-muted-foreground">（{KIND_ZH[s.kind]}）</span>}</span>
                    <span className="font-mono">{s.net.toFixed(1)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">使用面积按墙内净尺寸计算；建筑面积量到外墙外皮，不含檐廊、露台和屋顶平台。</p>
    </div>
  );
}

interface CommentRow {
  id: string; target_id: string | null; target_name: string | null; parent_id: string | null; author: string | null; author_id: string | null;
  body: string; status: 'open' | 'resolved' | 'pending-confirm'; created_at: number;
}

export function CommentsPanel({ onAskAgent }: { onAskAgent?: (text: string) => void }) {
  const projectId = useEditor(s => s.projectId);
  const role = useEditor(s => s.role);
  const sel = useEditor(s => s.view.selection);
  const project = useEditor(s => s.project);
  const focus = useEditor(s => s.focus);
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const { data = [] } = useQuery({ queryKey: ['comments', projectId], queryFn: () => api<CommentRow[]>(`/projects/${projectId}/comments`), refetchInterval: 30_000 });
  const target = sel[0];
  const targetName = target && (project.spaces.find(s => s.id === target)?.name ?? project.walls.find(w => w.id === target)?.name ?? project.furniture.find(f => f.id === target)?.name
    ?? project.walls.flatMap(w => w.openings).find(o => o.id === target)?.name);
  const add = useMutation({
    mutationFn: (b: { body: string; parentId?: string }) => api(`/projects/${projectId}/comments`, { method: 'POST', json: { ...b, targetId: b.parentId ? null : target ?? null, targetName: b.parentId ? null : targetName ?? null } }),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({ queryKey: ['comments', projectId] });
    },
    onError: e => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: CommentRow['status'] }) => api(`/projects/${projectId}/comments/${v.id}`, { method: 'PATCH', json: { status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', projectId] }),
  });
  const roots = data.filter(c => !c.parent_id);
  const open = roots.filter(c => c.status !== 'resolved');
  const done = roots.filter(c => c.status === 'resolved');
  const STATUS: Record<CommentRow['status'], string> = { open: '待处理', 'pending-confirm': '待业主确认', resolved: '已解决' };

  const Thread = ({ c }: { c: CommentRow }) => (
    <li className="rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{c.author ?? '某人'} · {fmtTime(c.created_at)}</span>
        <Badge variant={c.status === 'pending-confirm' ? 'default' : 'secondary'}>{STATUS[c.status]}</Badge>
      </div>
      {c.target_name && (
        <button className="mt-1 text-xs font-medium hover:underline" onClick={() => c.target_id && focus([c.target_id])}>@{c.target_name}</button>
      )}
      <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
      {data.filter(r => r.parent_id === c.id).map(r => (
        <div key={r.id} className="mt-2 border-l-2 pl-2 text-sm">
          <p className="text-xs text-muted-foreground">{r.author ?? '某人'} · {fmtTime(r.created_at)}</p>
          <p className="whitespace-pre-wrap">{r.body}</p>
        </div>
      ))}
      {can(role, 'commenter') && (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.status !== 'resolved' && <Button size="xs" variant="ghost" onClick={() => setStatus.mutate({ id: c.id, status: 'resolved' })}><CheckIcon /> 解决</Button>}
          {c.status === 'resolved' && <Button size="xs" variant="ghost" onClick={() => setStatus.mutate({ id: c.id, status: 'open' })}>重新打开</Button>}
          {can(role, 'editor') && c.status !== 'resolved' && onAskAgent && (
            <Button size="xs" variant="ghost" onClick={() => onAskAgent(`请处理这条评论${c.target_name ? `（关于“${c.target_name}”）` : ''}：“${c.body}”。能直接改就改；需要业主拍板的，说明选项。评论 ID：${c.id}`)}>
              交给 agent
            </Button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {roots.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon"><MessageSquareIcon /></EmptyMedia>
              <EmptyTitle>还没有评论</EmptyTitle>
              <EmptyDescription>选中图上的对象再写评论，评论会挂在它上面（比如“厨房东墙：窗再高点”）。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-2">
            {open.map(c => <Thread key={c.id} c={c} />)}
            {done.length > 0 && <li className="pt-2 text-xs text-muted-foreground">已解决（{done.length}）</li>}
            {done.map(c => <Thread key={c.id} c={c} />)}
          </ul>
        )}
      </div>
      {can(role, 'commenter') && (
        <form className="space-y-2 border-t p-3" onSubmit={e => { e.preventDefault(); if (text.trim()) add.mutate({ body: text.trim() }); }}>
          <p className="text-xs text-muted-foreground">{targetName ? `评论：${targetName}` : '对整个方案评论（先在图上选中对象，可挂到对象上）'}</p>
          <Textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="写评论…" />
          <Button size="sm" type="submit" disabled={!text.trim() || add.isPending}>发表</Button>
        </form>
      )}
    </div>
  );
}

export function VersionsPanel() {
  const projectId = useEditor(s => s.projectId);
  const version = useEditor(s => s.version);
  const viewing = useEditor(s => s.readOnlyVersion);
  const loadVersion = useEditor(s => s.loadVersion);
  const canEdit = useEditor(s => can(s.role, 'editor'));
  const store = useEditorStore();
  const { data = [] } = useQuery({
    queryKey: ['versions', projectId, version],
    queryFn: () => api<{ version: number; summary: string | null; created_at: number; author: string | null }[]>(`/projects/${projectId}/versions`),
  });

  const restore = async (v: number) => {
    const r = await api<{ content: any }>(`/projects/${projectId}/versions/${v}`);
    await loadVersion(null);
    const s = store.getState();
    s.session.load(r.content);
    store.setState({ dirty: true, pendingLabels: [`回退到第 ${v} 版`] });
    await s.save();
    toast.success(`已回退到第 ${v} 版（存为新版本，之前的版本都还在）`);
  };

  return (
    <div className="p-3">
      {viewing != null && (
        <div className="mb-3 rounded-lg border bg-muted/50 p-3 text-sm">
          <p>正在查看第 {viewing} 版（只读）。</p>
          <div className="mt-2 flex gap-2">
            {canEdit && <Button size="sm" onClick={() => restore(viewing)}>回退到这一版</Button>}
            <Button size="sm" variant="outline" onClick={() => loadVersion(null)}>回到最新</Button>
          </div>
        </div>
      )}
      <ul className="space-y-1">
        {data.map(v => (
          <li key={v.version}>
            <button
              className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${viewing === v.version ? 'bg-muted' : ''}`}
              onClick={() => (v.version === version && viewing == null ? null : loadVersion(v.version === version ? null : v.version))}
            >
              <HistoryIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{v.summary ?? '保存'}</span>
                <span className="text-xs text-muted-foreground">第 {v.version} 版 · {v.author || '某人'} · {fmtTime(v.created_at)}{v.version === version ? ' · 最新' : ''}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
