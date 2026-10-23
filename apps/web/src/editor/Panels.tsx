/** Side panels: selected object properties, areas, comments, versions. */
import { areaReport, checkConstraints, checkRules, findObject } from '@plinth/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, EyeIcon, HistoryIcon, MessageSquareIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
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
import { m } from '@/lib/i18n';
import { useEditor, useEditorStore } from './store';

const KIND_LABEL: Record<string, () => string> = {
  bearing: m.panels_kind_bearing, partition: m.panels_kind_partition, fence: m.panels_kind_fence, parapet: m.panels_kind_parapet, railing: m.panels_kind_railing,
  indoor: m.panels_kind_indoor, 'semi-outdoor': m.panels_kind_semi_outdoor, outdoor: m.panels_kind_outdoor, 'roof-terrace': m.panels_kind_roof_terrace, void: m.panels_kind_void,
  door: m.panels_kind_door, 'sliding-door': m.panels_kind_sliding_door, gate: m.panels_kind_gate, window: m.panels_kind_window, opening: m.panels_kind_opening,
};
const kindLabel = (k: string) => KIND_LABEL[k]?.() ?? k;

const TYPE_LABEL: Record<string, () => string> = { space: m.panels_type_space, wall: m.panels_type_wall, opening: m.panels_type_opening, furniture: m.panels_type_furniture };

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
  const levelIssues = issues.filter(i => i.targets.some(t => findObject(project, t)?.level === level));

  const run = async (n: string, input: unknown) => {
    const r = await call(n, input);
    if (!r.ok) toast.error(r.error?.message ?? m.panels_action_failed());
    return r;
  };

  if (!data) {
    return (
      <div className="space-y-4 p-4 text-sm">
        <p className="text-muted-foreground">{m.panels_props_empty_hint()}</p>
        <ConstraintsList />
        <Separator />
        <div>
          <p className="mb-2 font-medium">{m.panels_level_check()}</p>
          {levelIssues.length === 0 ? (
            <p className="flex items-center gap-1.5 text-muted-foreground"><CheckIcon className="size-4" /> {m.panels_no_issues()}</p>
          ) : (
            <ItemGroup className="gap-1">
              {levelIssues.map((i, k) => (
                <Item key={k} size="xs" render={<button type="button" />} onClick={() => store.getState().focus(i.targets)} className="cursor-pointer text-left hover:bg-muted">
                  <ItemMedia variant="icon"><TriangleAlertIcon className={i.severity === 'error' ? 'text-destructive' : 'text-chart-1'} /></ItemMedia>
                  <ItemContent><ItemDescription className="text-foreground">{i.message}</ItemDescription></ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
        </div>
      </div>
    );
  }

  const t = data.type;
  return (
    <div className="space-y-3 p-4">
      <div>
        <p className="text-xs text-muted-foreground">{TYPE_LABEL[t]?.() ?? t}</p>
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
            aria-label={m.panels_name()}
          />
        ) : (
          <h3 className="text-base font-medium">{data.name}</h3>
        )}
      </div>
      {t === 'space' && (
        <div>
          <p className="text-lg font-medium">{fmtArea(data.netArea)}</p>
          <Row k={m.panels_row_kind()} v={kindLabel(data.kind)} />
          <Row k={m.panels_row_bay_depth()} v={`${(data.bounds.width / 1000).toFixed(2)} × ${(data.bounds.depth / 1000).toFixed(2)} m`} />
          <Row k={m.panels_row_floor()} v={project.library.materials[data.floor]?.name ?? data.floor} />
          <Separator className="my-2" />
          <p className="mb-1 text-xs text-muted-foreground">{m.panels_surroundings()}</p>
          <ItemGroup className="gap-0">
            {data.walls.map((w: any) => (
              <Item key={w.id} size="xs" render={<button type="button" />} onClick={() => store.getState().select([w.id])} className="cursor-pointer hover:bg-muted">
                <ItemContent><ItemTitle>{w.direction} · {w.name}</ItemTitle></ItemContent>
                {w.openings.length > 0 && <ItemActions className="text-xs text-muted-foreground">{m.panels_openings_count({ count: w.openings.length })}</ItemActions>}
              </Item>
            ))}
          </ItemGroup>
          {data.neighbors.length > 0 && (
            <>
              <p className="mt-2 mb-1 text-xs text-muted-foreground">{m.panels_neighbors()}</p>
              <p className="text-sm">{data.neighbors.map((n: any) => n.name).join(m.panels_list_separator())}</p>
            </>
          )}
        </div>
      )}
      {t === 'wall' && (
        <div>
          <Row k={m.panels_row_kind()} v={kindLabel(data.kind)} />
          <Row k={m.panels_row_length()} v={`${(data.length / 1000).toFixed(2)} m`} />
          <Row k={m.panels_row_thickness()} v={`${data.thickness} mm`} />
          <Row k={m.panels_row_sides()} v={data.spaces.map((s: any) => s.space).join(' / ') || '—'} />
          {data.openings.length > 0 && <Row k={m.panels_row_openings()} v={data.openings.map((o: any) => kindLabel(o.kind)).join(m.panels_list_separator())} />}
          {data.kind === 'bearing' && <p className="mt-2 text-xs text-muted-foreground">{m.panels_bearing_note()}</p>}
        </div>
      )}
      {t === 'opening' && (
        <div>
          <Row k={m.panels_row_kind()} v={kindLabel(data.kind)} />
          <Row k={m.panels_row_width_height()} v={`${data.width} × ${data.height} mm`} />
          {data.sill > 0 && <Row k={m.panels_row_sill()} v={`${data.sill} mm`} />}
          <Row k={m.panels_row_host_wall()} v={data.wall.name} />
          <Row k={m.panels_row_connects()} v={data.connects.map((s: any) => s.name).join(' ↔ ') || '—'} />
        </div>
      )}
      {t === 'furniture' && (
        <div>
          <Row k={m.panels_row_category()} v={data.label ?? data.type} />
          <Row k={m.panels_row_size()} v={`${data.size.w} × ${data.size.d} × ${data.size.h} mm`} />
          <Row k={m.panels_row_rotation()} v={`${data.rotation}°`} />
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2 pt-1">
          {t === 'furniture' && (
            <>
              <Button size="sm" variant="outline" onClick={() => run('furniture_move', { furniture: data.id, rotation: (data.rotation + 90) % 360 })}>{m.panels_rotate_90()}</Button>
              <Button size="sm" variant="outline" onClick={() => run('furniture_remove', { furniture: data.id })}><Trash2Icon /> {m.panels_remove_furniture()}</Button>
            </>
          )}
          {t === 'opening' && <Button size="sm" variant="outline" onClick={() => run('opening_remove', { opening: data.id })}><Trash2Icon /> {m.panels_remove_opening()}</Button>}
          {t === 'wall' && data.kind !== 'bearing' && <Button size="sm" variant="outline" onClick={() => run('wall_remove', { wall: data.id })}><Trash2Icon /> {m.panels_remove_wall()}</Button>}
          {t === 'space' && <Button size="sm" variant="outline" onClick={() => run('space_remove', { space: data.id })}><Trash2Icon /> {m.panels_remove_space()}</Button>}
        </div>
      )}
    </div>
  );
}

const CONSTRAINT_LABEL: Record<string, () => string> = {
  align: m.panels_constraint_align, center: m.panels_constraint_center, spacing: m.panels_constraint_spacing,
  'size-target': m.panels_constraint_size_target, reference: m.panels_constraint_reference, rule: m.panels_constraint_rule,
};
const constraintLabel = (t: string) => CONSTRAINT_LABEL[t]?.() ?? t;

function ConstraintsList() {
  const project = useEditor(s => s.project);
  const canEdit = useEditor(s => s.canEdit());
  const call = useEditor(s => s.call);
  const focus = useEditor(s => s.focus);
  const status = useMemo(() => new Map(checkConstraints(project).map(c => [c.id, c])), [project]);
  if (!project.constraints.length) return null;
  return (
    <>
      <Separator />
      <div>
        <p className="mb-2 font-medium">{m.panels_constraints_title()}</p>
        <p className="mb-2 text-xs text-muted-foreground">{m.panels_constraints_hint()}</p>
        <ItemGroup className="gap-1">
          {project.constraints.map(c => {
            const st = status.get(c.id);
            return (
              <Item key={c.id} size="xs" variant="outline">
                {!st?.ok && <ItemMedia variant="icon"><TriangleAlertIcon className="text-chart-1" /></ItemMedia>}
                <ItemContent className="cursor-pointer" onClick={() => focus(c.targets)}>
                  <ItemTitle>{c.note ?? st?.message ?? constraintLabel(c.type)}</ItemTitle>
                  <ItemDescription>{constraintLabel(c.type)}{c.hard ? m.panels_constraint_hard() : ''}{st?.ok ? '' : m.panels_constraint_unmet()}</ItemDescription>
                </ItemContent>
                {canEdit && <ItemActions><Button size="icon-xs" variant="ghost" aria-label={m.panels_constraint_remove()} onClick={() => call('constraint_remove', { constraint: c.id })}><Trash2Icon /></Button></ItemActions>}
              </Item>
            );
          })}
        </ItemGroup>
      </div>
    </>
  );
}

export function AreasPanel() {
  const project = useEditor(s => s.project);
  const focus = useEditor(s => s.focus);
  const report = useMemo(() => areaReport(project), [project]);
  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs text-muted-foreground">{m.panels_total_gross()}</p>
        <p className="text-2xl font-medium">{fmtArea(report.totalGross)}</p>
      </div>
      {report.levels.filter(l => l.spaces.length).map(l => {
        const inner = l.spaces.filter(s => s.kind === 'indoor').reduce((a, s) => a + s.net, 0);
        return (
          <div key={l.id}>
            <div className="flex items-baseline justify-between">
              <p className="font-medium">{l.name}</p>
              <p className="text-xs text-muted-foreground">{m.panels_level_summary({ gross: fmtArea(l.gross), inner: fmtArea(inner) })}</p>
            </div>
            <Table className="mt-1">
              <TableBody>
                {l.spaces.map(s => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => focus([s.id])}>
                    <TableCell className="py-1.5">{s.name}{s.kind !== 'indoor' && <span className="text-muted-foreground">{m.panels_area_kind_suffix({ kind: kindLabel(s.kind) })}</span>}</TableCell>
                    <TableCell className="py-1.5 text-right font-mono">{s.net.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{m.panels_area_note()}</p>
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
  const targetName = target && findObject(project, target)?.name;
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
  useEffect(() => {
    const on = () => qc.invalidateQueries({ queryKey: ['comments', projectId] });
    window.addEventListener('plinth:comments-changed', on);
    return () => window.removeEventListener('plinth:comments-changed', on);
  }, [projectId]);
  const roots = data.filter(c => !c.parent_id);
  const open = roots.filter(c => c.status !== 'resolved');
  const done = roots.filter(c => c.status === 'resolved');
  const STATUS: Record<CommentRow['status'], () => string> = { open: m.panels_status_open, 'pending-confirm': m.panels_status_pending_confirm, resolved: m.panels_status_resolved };

  const Thread = ({ c }: { c: CommentRow }) => (
    <Card size="sm" className="gap-1 px-3 text-sm">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{c.author ?? m.panels_someone()} · {fmtTime(c.created_at)}</span>
        <Badge variant={c.status === 'pending-confirm' ? 'default' : 'secondary'}>{STATUS[c.status]()}</Badge>
      </div>
      {c.target_name && (
        <Button variant="link" size="xs" className="h-auto justify-start p-0 text-foreground" onClick={() => c.target_id && focus([c.target_id])}>@{c.target_name}</Button>
      )}
      <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
      {data.filter(r => r.parent_id === c.id).map(r => (
        <div key={r.id} className="mt-2 border-l-2 pl-2 text-sm">
          <p className="text-xs text-muted-foreground">{r.author ?? m.panels_someone()} · {fmtTime(r.created_at)}</p>
          <p className="whitespace-pre-wrap">{r.body}</p>
        </div>
      ))}
      {can(role, 'commenter') && (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.status !== 'resolved' && <Button size="xs" variant="ghost" onClick={() => setStatus.mutate({ id: c.id, status: 'resolved' })}><CheckIcon /> {m.panels_resolve()}</Button>}
          {c.status === 'resolved' && <Button size="xs" variant="ghost" onClick={() => setStatus.mutate({ id: c.id, status: 'open' })}>{m.panels_reopen()}</Button>}
          {can(role, 'editor') && c.status !== 'resolved' && onAskAgent && (
            <Button size="xs" variant="ghost" onClick={() => onAskAgent(m.panels_ask_agent_prompt({ about: c.target_name ? m.panels_ask_agent_about({ name: c.target_name }) : '', body: c.body, id: c.id }))}>
              {m.panels_ask_agent()}
            </Button>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {roots.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon"><MessageSquareIcon /></EmptyMedia>
              <EmptyTitle>{m.panels_no_comments()}</EmptyTitle>
              <EmptyDescription>{m.panels_no_comments_hint()}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {open.map(c => <Thread key={c.id} c={c} />)}
            {done.length > 0 && <p className="pt-2 text-xs text-muted-foreground">{m.panels_resolved_count({ count: done.length })}</p>}
            {done.map(c => <Thread key={c.id} c={c} />)}
          </div>
        )}
      </div>
      {can(role, 'commenter') && (
        <form className="space-y-2 border-t p-3" onSubmit={e => { e.preventDefault(); if (text.trim()) add.mutate({ body: text.trim() }); }}>
          <p className="text-xs text-muted-foreground">{targetName ? m.panels_comment_on({ name: targetName }) : m.panels_comment_on_project()}</p>
          <Textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder={m.panels_comment_placeholder()} />
          <Button size="sm" type="submit" disabled={!text.trim() || add.isPending}>{m.panels_comment_submit()}</Button>
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
    store.setState({ dirty: true, pendingLabels: [m.panels_restore_label({ version: v })] });
    await s.save();
    toast.success(m.panels_restored({ version: v }));
  };

  return (
    <div className="p-3">
      {viewing != null && (
        <Alert className="mb-3">
          <EyeIcon />
          <AlertTitle>{m.panels_viewing_version({ version: viewing })}</AlertTitle>
          <AlertDescription>
            <div className="mt-1 flex gap-2">
              {canEdit && <Button size="sm" onClick={() => restore(viewing)}>{m.panels_restore_this()}</Button>}
              <Button size="sm" variant="outline" onClick={() => loadVersion(null)}>{m.panels_back_to_latest()}</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <ItemGroup className="gap-1">
        {data.map(v => (
          <Item
            key={v.version}
            size="xs"
            variant={viewing === v.version ? 'muted' : 'default'}
            render={<button type="button" />}
            className="cursor-pointer text-left hover:bg-muted"
            onClick={() => (v.version === version && viewing == null ? null : loadVersion(v.version === version ? null : v.version))}
          >
            <ItemMedia variant="icon"><HistoryIcon className="text-muted-foreground" /></ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="w-full truncate">{v.summary ?? m.panels_version_default_summary()}</ItemTitle>
              <ItemDescription>{m.panels_version_number({ version: v.version })} · {v.author || m.panels_someone()} · {fmtTime(v.created_at)}{v.version === version ? m.panels_version_latest() : ''}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
