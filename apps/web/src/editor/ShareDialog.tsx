/** 分享与权限：成员、分享链接、邮箱邀请、方案选用的模型、用量。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CopyIcon, LinkIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ROLE_ZH, type Role } from '@/lib/api';
import { useEditor, useEditorStore } from './store';

type ShareRole = Exclude<Role, 'owner'>;
const SHARE_ROLES: ShareRole[] = ['viewer', 'commenter', 'editor'];
const ROLE_HINT: Record<ShareRole, string> = { viewer: '只能看', commenter: '能看、能评论', editor: '能改方案、用方案的模型和 agent 对话' };

interface Sharing {
  members: { user_id: string; role: Role; name: string; email: string; anonymous: number }[];
  links: { token: string; role: ShareRole; created_at: number }[];
  invites: { id: string; email: string; role: ShareRole }[];
}

function RoleSelect({ value, onChange }: { value: ShareRole; onChange: (r: ShareRole) => void }) {
  return (
    <Select value={value} onValueChange={v => onChange(v as ShareRole)}>
      <SelectTrigger size="sm" className="w-28"><SelectValue>{ROLE_ZH[value]}</SelectValue></SelectTrigger>
      <SelectContent>
        {SHARE_ROLES.map(r => (
          <SelectItem key={r} value={r}>
            <div className="flex flex-col"><span>{ROLE_ZH[r]}</span><span className="text-xs text-muted-foreground">{ROLE_HINT[r]}</span></div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ShareDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const projectId = useEditor(s => s.projectId);
  const role = useEditor(s => s.role);
  const model = useEditor(s => s.model);
  const store = useEditorStore();
  const qc = useQueryClient();
  const owner = role === 'owner';
  const [linkRole, setLinkRole] = useState<ShareRole>('commenter');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ShareRole>('editor');

  const sharing = useQuery({ queryKey: ['sharing', projectId], queryFn: () => api<Sharing>(`/projects/${projectId}/sharing`), enabled: open });
  const models = useQuery({ queryKey: ['models'], queryFn: () => api<{ configs: { id: string; label: string; model: string; key_hint: string }[] }>('/models'), enabled: open && owner });
  const usage = useQuery({ queryKey: ['usage', projectId], queryFn: () => api<{ user_id: string; name: string; input: number; output: number; calls: number }[]>(`/projects/${projectId}/usage`), enabled: open && owner });
  const refresh = () => qc.invalidateQueries({ queryKey: ['sharing', projectId] });
  const fail = (e: Error) => toast.error(e.message);

  const createLink = useMutation({ mutationFn: () => api<{ token: string }>(`/projects/${projectId}/links`, { method: 'POST', json: { role: linkRole } }), onSuccess: r => { void refresh(); copy(r.token); }, onError: fail });
  const revoke = useMutation({ mutationFn: (t: string) => api(`/projects/${projectId}/links/${t}`, { method: 'DELETE' }), onSuccess: refresh, onError: fail });
  const invite = useMutation({ mutationFn: () => api(`/projects/${projectId}/invites`, { method: 'POST', json: { email, role: inviteRole } }), onSuccess: () => { setEmail(''); void refresh(); toast.success('已邀请。对方用这个邮箱登录后会自动加入'); }, onError: fail });
  const delInvite = useMutation({ mutationFn: (id: string) => api(`/projects/${projectId}/invites/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  const setRole = useMutation({ mutationFn: (v: { userId: string; role: ShareRole }) => api(`/projects/${projectId}/members/${v.userId}`, { method: 'PATCH', json: { role: v.role } }), onSuccess: refresh, onError: fail });
  const remove = useMutation({ mutationFn: (userId: string) => api(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }), onSuccess: refresh, onError: fail });
  const pickModel = useMutation({
    mutationFn: (id: string | null) => api(`/projects/${projectId}/model`, { method: 'PUT', json: { modelConfigId: id } }),
    onSuccess: (_r, id) => {
      const m = models.data?.configs.find(c => c.id === id);
      store.setState({ model: m ? { id: m.id, label: m.label, provider: '', model: m.model } : null });
      toast.success(m ? `方案改用 ${m.label}` : '方案不再使用模型');
    },
    onError: fail,
  });

  const copy = (token: string) => {
    const url = `${location.origin}/s/${token}`;
    void navigator.clipboard?.writeText(url).then(() => toast.success('链接已复制'), () => toast.message(url));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>分享与权限</DialogTitle>
          <DialogDescription>家人默认只看和评论；可编辑的人能改方案，也能用这个方案配置的模型和 agent 对话。</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h4 className="text-sm font-medium">成员</h4>
          <ul className="space-y-1.5">
            {sharing.data?.members.map(m => (
              <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{m.anonymous ? '访客' : m.name || m.email}<span className="ml-1 text-xs text-muted-foreground">{m.anonymous ? '' : m.email}</span></span>
                {m.role === 'owner' || !owner ? (
                  <span className="text-xs text-muted-foreground">{ROLE_ZH[m.role]}</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <RoleSelect value={m.role as ShareRole} onChange={r => setRole.mutate({ userId: m.user_id, role: r })} />
                    <Button size="icon-sm" variant="ghost" aria-label="移除" onClick={() => remove.mutate(m.user_id)}><Trash2Icon /></Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {owner && (
          <>
            <Separator />
            <section className="space-y-2">
              <h4 className="text-sm font-medium">分享链接</h4>
              <div className="flex gap-2">
                <RoleSelect value={linkRole} onChange={setLinkRole} />
                <Button size="sm" onClick={() => createLink.mutate()} disabled={createLink.isPending}><LinkIcon /> 生成并复制链接</Button>
              </div>
              <ul className="space-y-1">
                {sharing.data?.links.map(l => (
                  <li key={l.token} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-muted-foreground">…/s/{l.token.slice(0, 8)}…（{ROLE_ZH[l.role]}）</span>
                    <span>
                      <Button size="icon-sm" variant="ghost" aria-label="复制" onClick={() => copy(l.token)}><CopyIcon /></Button>
                      <Button size="xs" variant="ghost" onClick={() => revoke.mutate(l.token)}>收回</Button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <Separator />
            <section className="space-y-2">
              <h4 className="text-sm font-medium">按邮箱邀请</h4>
              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (email) invite.mutate(); }}>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="家人的邮箱" className="h-8" />
                <RoleSelect value={inviteRole} onChange={setInviteRole} />
                <Button size="sm" type="submit" disabled={!email || invite.isPending}>邀请</Button>
              </form>
              <ul className="space-y-1">
                {sharing.data?.invites.map(i => (
                  <li key={i.id} className="flex items-center justify-between text-sm">
                    <span>{i.email}（{ROLE_ZH[i.role]}，待接受）</span>
                    <Button size="xs" variant="ghost" onClick={() => delInvite.mutate(i.id)}>撤销</Button>
                  </li>
                ))}
              </ul>
            </section>

            <Separator />
            <section className="space-y-2">
              <h4 className="text-sm font-medium">方案使用的大模型</h4>
              {models.data?.configs.length ? (
                <Select value={model?.id ?? ''} onValueChange={v => pickModel.mutate((v as string) || null)}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue>{model?.label ?? '不使用'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {models.data.configs.map(c => <SelectItem key={c.id} value={c.id}>{c.label}（{c.model}，{c.key_hint}）</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">还没有模型配置。到 <Button variant="link" className="h-auto p-0" nativeButton={false} render={<Link to="/settings" />}>设置</Button> 添加你的密钥。</p>
              )}
              <p className="text-xs text-muted-foreground">密钥只保存在服务器上，分享出去的人看不到，只能通过 agent 使用。随时可以换掉或在设置里删除。</p>
              {usage.data && usage.data.length > 0 && (
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow><TableHead>谁</TableHead><TableHead className="text-right">次数</TableHead><TableHead className="text-right">输入 token</TableHead><TableHead className="text-right">输出 token</TableHead></TableRow>
                  </TableHeader>
                  <TableBody className="font-mono">
                    {usage.data.map(u => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-sans">{u.name || '访客'}</TableCell>
                        <TableCell className="text-right">{u.calls}</TableCell>
                        <TableCell className="text-right">{u.input.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{u.output.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
