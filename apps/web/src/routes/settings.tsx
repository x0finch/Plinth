import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { DownloadIcon, KeyRoundIcon, LoaderIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Autocomplete, AutocompleteContent, AutocompleteInput, AutocompleteItem, AutocompleteList } from '@/components/ui/autocomplete';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';
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
  keys: { id: string; provider: string; base_url: string | null; key_hint: string; created_at: number }[];
  models: { id: string; key_id: string; label: string; model: string; provider: string }[];
  defaultModelId: string | null;
  providers: Record<string, { name: string; models: string[]; needsBaseUrl?: boolean; hint: string }>;
}

/** Model name: suggestions for the provider, any other name can be typed */
function ModelInput({ id, value, onChange, suggestions, className }: { id?: string; value: string; onChange: (v: string) => void; suggestions: string[]; className?: string }) {
  return (
    <Autocomplete
      items={suggestions}
      value={value}
      onValueChange={v => onChange(v)}
      // A name picked from the list shows the whole list again, so another one is one click away
      filter={(s: string, q) => !q || suggestions.includes(q) || s.toLowerCase().includes(q.toLowerCase())}
      openOnInputClick
    >
      <AutocompleteInput id={id} className={className} required placeholder={suggestions[0]} />
      <AutocompleteContent>
        <AutocompleteList>{(s: string) => <AutocompleteItem key={s} value={s}>{s}</AutocompleteItem>}</AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  );
}

const refreshModels = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ['models'] });

/** Save a provider key together with the first model to use with it */
function AddKey({ providers }: { providers: Models['providers'] }) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState(providers.anthropic?.models[0] ?? '');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const p = providers[provider];
  const add = useMutation({
    mutationFn: () => api('/keys', { method: 'POST', json: { provider, apiKey, model, baseUrl: p.needsBaseUrl ? baseUrl : null } }),
    onSuccess: () => {
      setApiKey('');
      void refreshModels(qc);
      toast.success(m.settings_key_added());
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Card className="p-4">
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); add.mutate(); }}>
      <h3 className="text-sm font-medium">{m.settings_add_key_title()}</h3>
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
          <ModelInput id="model" value={model} onChange={setModel} suggestions={p.models} />
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
      <Button type="submit" size="sm" disabled={add.isPending || !apiKey || !model.trim()}>{add.isPending && <LoaderIcon className="animate-spin" />}{m.settings_save_key()}</Button>
    </form>
    </Card>
  );
}

/** A saved key with the models picked for it */
function KeyCard({ k, data }: { k: Models['keys'][number]; data: Models }) {
  const qc = useQueryClient();
  const provider = data.providers[k.provider];
  const [model, setModel] = useState('');
  const fail = (e: Error) => toast.error(e.message);
  const addModel = useMutation({
    mutationFn: () => api('/models', { method: 'POST', json: { keyId: k.id, model } }),
    onSuccess: () => { setModel(''); void refreshModels(qc); },
    onError: fail,
  });
  const delModel = useMutation({ mutationFn: (id: string) => api(`/models/${id}`, { method: 'DELETE' }), onSuccess: () => refreshModels(qc), onError: fail });
  const delKey = useMutation({ mutationFn: () => api(`/keys/${k.id}`, { method: 'DELETE' }), onSuccess: () => refreshModels(qc), onError: fail });
  const setDefault = useMutation({
    mutationFn: (id: string) => api('/models/default', { method: 'PUT', json: { modelId: id } }),
    onSuccess: () => { void refreshModels(qc); toast.success(m.settings_default_saved()); },
    onError: fail,
  });
  const models = data.models.filter(x => x.key_id === k.id);
  return (
    <Card className="gap-3 p-4" data-testid="api-key">
      <div className="flex items-center gap-2">
        <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{provider?.name ?? k.provider}</p>
          <p className="truncate text-xs text-muted-foreground">{k.key_hint}{k.base_url ? ` · ${k.base_url}` : ''}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button size="icon-sm" variant="ghost" aria-label={m.settings_delete_key()} />}><Trash2Icon /></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.settings_delete_key_title()}</AlertDialogTitle>
              <AlertDialogDescription>{m.settings_delete_key_description()}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => delKey.mutate()}>{m.settings_delete()}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <ItemGroup className="gap-1">
        {models.map(x => (
          <Item key={x.id} variant="muted" size="xs">
            <ItemContent className="min-w-0"><ItemTitle className="truncate">{x.label}</ItemTitle></ItemContent>
            <ItemActions>
              {x.id === data.defaultModelId
                ? <Badge variant="secondary">{m.settings_default_badge()}</Badge>
                : <Button size="xs" variant="ghost" onClick={() => setDefault.mutate(x.id)}>{m.settings_set_default()}</Button>}
              <Button size="icon-xs" variant="ghost" aria-label={m.settings_delete_model({ model: x.label })} onClick={() => delModel.mutate(x.id)}><Trash2Icon /></Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (model.trim()) addModel.mutate(); }}>
        <ModelInput value={model} onChange={setModel} suggestions={(provider?.models ?? []).filter(s => !models.some(x => x.model === s))} className="h-8 flex-1" />
        <Button type="submit" size="sm" variant="outline" disabled={!model.trim() || addModel.isPending}><PlusIcon />{m.settings_add_model()}</Button>
      </form>
    </Card>
  );
}

function Settings() {
  const me = useMe();
  const navigate = useNavigate();
  const user = me.data?.user;
  const [autonomy, setAuto] = useState<Autonomy>('balanced');
  useEffect(() => setAuto(getAutonomy()), []);
  useEffect(() => {
    if (me.isSuccess && !user) void navigate({ to: '/login', search: { redirect: '/settings' } });
  }, [me.isSuccess, user]);
  const models = useQuery({ queryKey: ['models'], queryFn: () => api<Models>('/models'), enabled: !!user });

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
          {models.data?.keys.map(k => <KeyCard key={k.id} k={k} data={models.data} />)}
          {models.data && <AddKey providers={models.data.providers} />}
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
