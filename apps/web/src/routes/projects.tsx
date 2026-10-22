import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { EllipsisIcon, HouseIcon, LoaderIcon, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ROLE_ZH, type Role } from '@/lib/api';
import { fmtTime, useMe } from '@/lib/query';

export const Route = createFileRoute('/projects')({ component: Projects });

interface Row { id: string; name: string; head_version: number; thumbnail: string | null; updated_at: number; role: Role; owner_name: string }

function NewProject({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('我的新房子');
  const [template, setTemplate] = useState<'blank' | 'sample'>('blank');
  const [floors, setFloors] = useState('2');
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/projects', { method: 'POST', json: { name, template, floors: Number(floors) } }),
    onSuccess: r => navigate({ to: '/p/$projectId', params: { projectId: r.id } }),
    onError: e => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>新建方案</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); create.mutate(); }}>
          <Field><FieldLabel htmlFor="pname">名称</FieldLabel><Input id="pname" value={name} onChange={e => setName(e.target.value)} required maxLength={60} /></Field>
          <Field>
            <FieldLabel>从哪开始</FieldLabel>
            <Select value={template} onValueChange={v => setTemplate(v as 'blank' | 'sample')}>
              <SelectTrigger className="w-full"><SelectValue>{template === 'blank' ? '空白：和 agent 从一句需求开始' : '样例：乌石合院（三层带院子）'}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">空白：和 agent 从一句需求开始</SelectItem>
                <SelectItem value="sample">样例：乌石合院（三层带院子）</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {template === 'blank' && (
            <Field>
              <FieldLabel>楼层数</FieldLabel>
              <Select value={floors} onValueChange={v => setFloors(v as string)}>
                <SelectTrigger className="w-full"><SelectValue>{floors} 层</SelectValue></SelectTrigger>
                <SelectContent>{['1', '2', '3', '4'].map(n => <SelectItem key={n} value={n}>{n} 层</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <DialogFooter><Button type="submit" disabled={create.isPending || !name.trim()}>{create.isPending && <LoaderIcon className="animate-spin" />}创建</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Projects() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [newName, setNewName] = useState('');
  const user = me.data?.user;

  useEffect(() => {
    if (me.isSuccess && !user) void navigate({ to: '/login', search: { redirect: '/projects' } });
  }, [me.isSuccess, user]);

  const list = useQuery({ queryKey: ['projects'], queryFn: () => api<Row[]>('/projects'), enabled: !!user });
  const rename = useMutation({
    mutationFn: (r: Row) => api(`/projects/${r.id}`, { method: 'PATCH', json: { name: newName } }),
    onSuccess: () => { setRenaming(null); void qc.invalidateQueries({ queryKey: ['projects'] }); },
    onError: e => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (r: Row) => api(`/projects/${r.id}`, { method: 'DELETE' }),
    onSuccess: () => { setDeleting(null); void qc.invalidateQueries({ queryKey: ['projects'] }); },
    onError: e => toast.error(e.message),
  });
  const leave = useMutation({
    mutationFn: (r: Row) => api(`/projects/${r.id}/members/${user!.id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {user?.isAnonymous && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <span className="flex-1">你正在以访客身份试用。登录后这些方案会转到你的账号，换设备也能打开。</span>
            <Button size="sm" nativeButton={false} render={<Link to="/login" search={{ redirect: '/projects' }} />}>登录保存</Button>
          </div>
        )}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">我的方案</h1>
          <Button size="sm" onClick={() => setCreating(true)}><PlusIcon /> 新建方案</Button>
        </div>
        {list.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-52" />)}</div>
        ) : !list.data?.length ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><HouseIcon /></EmptyMedia>
              <EmptyTitle>还没有方案</EmptyTitle>
              <EmptyDescription>新建一个空白方案，和 agent 从一句需求开始；或者先打开样例看看。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent><Button onClick={() => setCreating(true)}><PlusIcon /> 新建方案</Button></EmptyContent>
          </Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.map(r => (
              <li key={r.id} className="group relative overflow-hidden rounded-xl border">
                <Link to="/p/$projectId" params={{ projectId: r.id }} className="block">
                  <div className="flex aspect-[4/3] items-center justify-center bg-[var(--plan-bg)] p-3">
                    {r.thumbnail ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(r.thumbnail)}`} alt="" className="max-h-full max-w-full" /> : <HouseIcon className="size-8 text-muted-foreground" />}
                  </div>
                  <div className="border-t px-3 py-2">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.role === 'owner' ? '我的' : `${r.owner_name || '别人'}分享 · ${ROLE_ZH[r.role]}`} · 第 {r.head_version} 版 · {fmtTime(r.updated_at)}</p>
                  </div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="secondary" size="icon-sm" className="absolute top-2 right-2" aria-label="更多" />}><EllipsisIcon /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {r.role !== 'viewer' && r.role !== 'commenter' && <DropdownMenuItem onClick={() => { setNewName(r.name); setRenaming(r); }}>重命名</DropdownMenuItem>}
                    {r.role === 'owner' ? (
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleting(r)}>删除</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => leave.mutate(r)}>退出这个方案</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
      <NewProject open={creating} onOpenChange={setCreating} />
      <Dialog open={!!renaming} onOpenChange={o => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>重命名</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); renaming && rename.mutate(renaming); }} className="space-y-4">
            <Input value={newName} onChange={e => setNewName(e.target.value)} maxLength={60} required autoFocus />
            <DialogFooter><Button type="submit" disabled={rename.isPending}>保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除“{deleting?.name}”？</AlertDialogTitle>
            <AlertDialogDescription>方案和它的所有版本、评论、对话都会删除，分享出去的链接也会失效。这个操作不能撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && del.mutate(deleting)}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
