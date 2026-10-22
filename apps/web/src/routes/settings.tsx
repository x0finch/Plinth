import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { DownloadIcon, KeyRoundIcon, LoaderIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { AUTONOMY_ZH, getAutonomy, setAutonomy } from '@/lib/prefs';
import { queryClient, useMe } from '@/lib/query';
import type { Autonomy } from '@/agent/policy';

export const Route = createFileRoute('/settings')({ component: Settings });

interface Models {
  configs: { id: string; label: string; provider: string; model: string; base_url: string | null; key_hint: string; created_at: number }[];
  providers: Record<string, { name: string; models: string[]; needsBaseUrl?: boolean; hint: string }>;
}

function AddModel({ providers }: { providers: Models['providers'] }) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState(providers.anthropic?.models[0] ?? '');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const p = providers[provider];
  const add = useMutation({
    mutationFn: () => api('/models', { method: 'POST', json: { provider, model, apiKey, label: label || `${p.name} ${model}`, baseUrl: p.needsBaseUrl ? baseUrl : null } }),
    onSuccess: () => {
      setApiKey('');
      setLabel('');
      void qc.invalidateQueries({ queryKey: ['models'] });
      toast.success('已添加。打开方案，在“分享”里选用它');
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Card className="p-4">
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); add.mutate(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>厂商</FieldLabel>
          <Select value={provider} onValueChange={v => { setProvider(v as string); setModel(providers[v as string].models[0] ?? ''); }}>
            <SelectTrigger className="w-full"><SelectValue>{p.name}</SelectValue></SelectTrigger>
            <SelectContent>{Object.entries(providers).map(([k, v]) => <SelectItem key={k} value={k}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="model">型号</FieldLabel>
          <Input id="model" list="model-suggestions" value={model} onChange={e => setModel(e.target.value)} required />
          <datalist id="model-suggestions">{p.models.map(m => <option key={m} value={m} />)}</datalist>
        </Field>
      </div>
      {p.needsBaseUrl && (
        <Field>
          <FieldLabel htmlFor="base">接口地址</FieldLabel>
          <Input id="base" type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" required />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="key">API Key</FieldLabel>
        <Input id="key" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} required />
        <FieldDescription>{p.hint}。密钥加密后只存在服务器上，不会发回浏览器，也不会给分享出去的人看到。</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="label">名称（可选）</FieldLabel>
        <Input id="label" value={label} onChange={e => setLabel(e.target.value)} placeholder={`${p.name} ${model}`} maxLength={40} />
      </Field>
      <Button type="submit" size="sm" disabled={add.isPending || !apiKey || !model}>{add.isPending && <LoaderIcon className="animate-spin" />}添加</Button>
    </form>
    </Card>
  );
}

function Settings() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = me.data?.user;
  const [autonomy, setAuto] = useState<Autonomy>('balanced');
  useEffect(() => setAuto(getAutonomy()), []);
  useEffect(() => {
    if (me.isSuccess && !user) void navigate({ to: '/login', search: { redirect: '/settings' } });
  }, [me.isSuccess, user]);
  const models = useQuery({ queryKey: ['models'], queryFn: () => api<Models>('/models'), enabled: !!user });
  const del = useMutation({ mutationFn: (id: string) => api(`/models/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }) });

  const deleteAccount = async () => {
    const r = await authClient.deleteUser();
    if (r.error) {
      toast.error(r.error.message === 'Session expired. Re-authenticate to perform this action.' ? '为了安全，请重新登录后再删除账号' : r.error.message ?? '删除失败');
      return;
    }
    queryClient.clear();
    toast.success('账号和名下的方案已删除');
    void navigate({ to: '/' });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-10 px-4 py-6">
        <h1 className="text-xl font-semibold">设置</h1>

        <section className="space-y-4">
          <div>
            <h2 className="font-medium">大模型</h2>
            <p className="mt-1 text-sm text-muted-foreground">agent 用你自己的大模型密钥。添加后在方案的“分享”里选用；分享给可编辑的家人后，他们也能用这个方案的模型和 agent 对话，用量会记在各自名下。</p>
          </div>
          <ItemGroup className="gap-2">
            {models.data?.configs.map(c => (
              <Item key={c.id} variant="outline" size="sm">
                <ItemMedia variant="icon"><KeyRoundIcon /></ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{c.label}</ItemTitle>
                  <ItemDescription>{models.data.providers[c.provider]?.name} · {c.model} · {c.key_hint}</ItemDescription>
                </ItemContent>
                <ItemActions><Button size="icon-sm" variant="ghost" aria-label="删除" onClick={() => del.mutate(c.id)}><Trash2Icon /></Button></ItemActions>
              </Item>
            ))}
          </ItemGroup>
          {models.data && <AddModel providers={models.data.providers} />}
        </section>

        <Separator />
        <section className="space-y-3">
          <h2 className="font-medium">agent 自主程度</h2>
          <Select value={autonomy} onValueChange={v => { setAuto(v as Autonomy); setAutonomy(v as Autonomy); toast.success('已保存（只对这台设备有效）'); }}>
            <SelectTrigger className="w-full sm:w-80"><SelectValue>{AUTONOMY_ZH[autonomy].label}：{AUTONOMY_ZH[autonomy].hint}</SelectValue></SelectTrigger>
            <SelectContent>{(Object.keys(AUTONOMY_ZH) as Autonomy[]).map(k => <SelectItem key={k} value={k}>{AUTONOMY_ZH[k].label}：{AUTONOMY_ZH[k].hint}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">删除楼层、对外分享、产生费用这类操作无论如何都会先问你。</p>
        </section>

        <Separator />
        <section className="space-y-3">
          <h2 className="font-medium">账号</h2>
          <p className="text-sm text-muted-foreground">{user?.isAnonymous ? '访客（试用中）' : user?.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<a href="/api/account/export" download />}><DownloadIcon /> 导出我的数据</Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" size="sm" className="text-destructive" />}>删除账号</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除账号？</AlertDialogTitle>
                  <AlertDialogDescription>你名下的方案、版本、评论、模型密钥会全部删除，不能恢复。建议先导出数据。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={deleteAccount}>删除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
