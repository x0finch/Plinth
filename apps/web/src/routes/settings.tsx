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
import { getLocale, locales, m, setLocale, type Locale } from '@/lib/i18n';
import { authClient } from '@/lib/auth-client';
import { AUTONOMIES, autonomyHint, autonomyLabel, getAutonomy, setAutonomy } from '@/lib/prefs';
import { queryClient, useMe } from '@/lib/query';
import type { Autonomy } from '@/agent/policy';

export const Route = createFileRoute('/settings')({ component: Settings });

/** Each language is listed by its own name */
const LANGUAGE_NAME: Record<Locale, () => string> = { zh: m.language_zh, en: m.language_en };

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
      toast.success(m.settings_model_added());
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Card className="p-4">
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); add.mutate(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>{m.settings_provider()}</FieldLabel>
          <Select value={provider} onValueChange={v => { setProvider(v as string); setModel(providers[v as string].models[0] ?? ''); }}>
            <SelectTrigger className="w-full"><SelectValue>{p.name}</SelectValue></SelectTrigger>
            <SelectContent>{Object.entries(providers).map(([k, v]) => <SelectItem key={k} value={k}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="model">{m.settings_model()}</FieldLabel>
          <Input id="model" list="model-suggestions" value={model} onChange={e => setModel(e.target.value)} required />
          <datalist id="model-suggestions">{p.models.map(m => <option key={m} value={m} />)}</datalist>
        </Field>
      </div>
      {p.needsBaseUrl && (
        <Field>
          <FieldLabel htmlFor="base">{m.settings_base_url()}</FieldLabel>
          <Input id="base" type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" required />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="key">API Key</FieldLabel>
        <Input id="key" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} required />
        <FieldDescription>{p.hint}{m.settings_key_hint()}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="label">{m.settings_label_optional()}</FieldLabel>
        <Input id="label" value={label} onChange={e => setLabel(e.target.value)} placeholder={`${p.name} ${model}`} maxLength={40} />
      </Field>
      <Button type="submit" size="sm" disabled={add.isPending || !apiKey || !model}>{add.isPending && <LoaderIcon className="animate-spin" />}{m.settings_add()}</Button>
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
      toast.error(r.error.message === 'Session expired. Re-authenticate to perform this action.' ? m.settings_reauth_to_delete() : r.error.message ?? m.settings_delete_failed());
      return;
    }
    queryClient.clear();
    toast.success(m.settings_account_deleted());
    void navigate({ to: '/' });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-10 px-4 py-6">
        <h1 className="text-xl font-semibold">{m.settings_title()}</h1>

        <section className="space-y-4">
          <div>
            <h2 className="font-medium">{m.settings_models_title()}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{m.settings_models_description()}</p>
          </div>
          <ItemGroup className="gap-2">
            {models.data?.configs.map(c => (
              <Item key={c.id} variant="outline" size="sm">
                <ItemMedia variant="icon"><KeyRoundIcon /></ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{c.label}</ItemTitle>
                  <ItemDescription>{models.data.providers[c.provider]?.name} · {c.model} · {c.key_hint}</ItemDescription>
                </ItemContent>
                <ItemActions><Button size="icon-sm" variant="ghost" aria-label={m.settings_delete()} onClick={() => del.mutate(c.id)}><Trash2Icon /></Button></ItemActions>
              </Item>
            ))}
          </ItemGroup>
          {models.data && <AddModel providers={models.data.providers} />}
        </section>

        <Separator />
        <section className="space-y-3">
          <h2 className="font-medium">{m.settings_autonomy_title()}</h2>
          <Select value={autonomy} onValueChange={v => { setAuto(v as Autonomy); setAutonomy(v as Autonomy); toast.success(m.settings_autonomy_saved()); }}>
            <SelectTrigger className="w-full sm:w-80"><SelectValue>{m.settings_autonomy_option({ label: autonomyLabel(autonomy), hint: autonomyHint(autonomy) })}</SelectValue></SelectTrigger>
            <SelectContent>{AUTONOMIES.map(k => <SelectItem key={k} value={k}>{m.settings_autonomy_option({ label: autonomyLabel(k), hint: autonomyHint(k) })}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{m.settings_autonomy_note()}</p>
        </section>

        <Separator />
        <section className="space-y-3">
          <h2 className="font-medium">{m.language_label()}</h2>
          <Select value={getLocale()} onValueChange={v => setLocale(v as Locale)}>
            <SelectTrigger className="w-full sm:w-80"><SelectValue>{LANGUAGE_NAME[getLocale()]()}</SelectValue></SelectTrigger>
            <SelectContent>{locales.map(l => <SelectItem key={l} value={l}>{LANGUAGE_NAME[l]()}</SelectItem>)}</SelectContent>
          </Select>
        </section>

        <Separator />
        <section className="space-y-3">
          <h2 className="font-medium">{m.settings_account_title()}</h2>
          <p className="text-sm text-muted-foreground">{user?.isAnonymous ? m.settings_guest() : user?.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<a href="/api/account/export" download />}><DownloadIcon /> {m.settings_export()}</Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" size="sm" className="text-destructive" />}>{m.settings_delete_account()}</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{m.settings_delete_account_title()}</AlertDialogTitle>
                  <AlertDialogDescription>{m.settings_delete_account_description()}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={deleteAccount}>{m.settings_delete()}</AlertDialogAction>
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
