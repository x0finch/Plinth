/**
 * Settings → look libraries: create, rename, share and delete libraries, and browse or remove their looks. Looks get into a
 * library from a design (its looks panel, or the agent); designs copy them from here.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDownIcon, PlusIcon, Trash2Icon, UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { m } from '@/lib/i18n';
import { getLibrary, listLibraries, lookSize } from '@/lib/libraries';
import { useMe } from '@/lib/query';
import type { LibraryRole, LibrarySummary } from '@/shared/looks';
import { LookStill } from './LookStill';

export const libraryRoleLabel = (r: LibraryRole) => (r === 'owner' ? m.libraries_role_owner() : r === 'editor' ? m.libraries_role_editor() : m.libraries_role_viewer());

export function LibrariesSection() {
  const qc = useQueryClient();
  const libs = useQuery({ queryKey: ['libraries'], queryFn: listLibraries });
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/libraries', { method: 'POST', json: { name: name.trim() } }),
    onSuccess: () => { setName(''); void qc.invalidateQueries({ queryKey: ['libraries'] }); },
    onError: e => toast.error(e.message),
  });
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-medium">{m.libraries_title()}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.libraries_description()}</p>
      </div>
      {libs.data?.map(l => <LibraryCard key={l.id} lib={l} />)}
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={m.libraries_new_placeholder()} aria-label={m.libraries_new_placeholder()} className="sm:w-80" />
        <Button type="submit" variant="outline" disabled={!name.trim() || create.isPending}><PlusIcon /> {m.libraries_new()}</Button>
      </form>
    </section>
  );
}

function LibraryCard({ lib }: { lib: LibrarySummary }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const detail = useQuery({ queryKey: ['library', lib.id], queryFn: () => getLibrary(lib.id), enabled: open });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['libraries'] }), qc.invalidateQueries({ queryKey: ['library', lib.id] })]);
  const call = (path: string, init: Parameters<typeof api>[1]) => api(path, init).then(refresh).catch((e: Error) => toast.error(e.message));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const owner = lib.role === 'owner', editor = owner || lib.role === 'editor';
  const userId = useMe().data?.user?.id;
  return (
    <Card className="gap-3 p-4" data-testid="look-library">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="-ml-2 min-w-0 flex-1 justify-start" />}>
            <ChevronDownIcon className={open ? '' : '-rotate-90'} />
            <span className="truncate font-medium">{lib.name}</span>
            <span className="text-muted-foreground">{m.libraries_count({ count: lib.looks })}</span>
          </CollapsibleTrigger>
          <Badge variant="secondary">{libraryRoleLabel(lib.role)}</Badge>
        </div>
        <CollapsibleContent className="space-y-4 pt-3">
          {owner && (
            <Input defaultValue={lib.name} aria-label={m.libraries_name()} onBlur={e => e.target.value.trim() && e.target.value !== lib.name && void call(`/libraries/${lib.id}`, { method: 'PATCH', json: { name: e.target.value.trim() } })} />
          )}
          {detail.data && (detail.data.looks.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {detail.data.looks.map(k => (
                <div key={k.look_id} className="space-y-1">
                  <LookStill recipe={k.recipe} size={lookSize(k)} alt={m.libraries_look_alt({ name: k.name })} />
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{k.name} <span className="text-muted-foreground">v{k.version}</span></span>
                    {editor && (
                      <Button size="icon-xs" variant="ghost" aria-label={m.libraries_remove_look({ name: k.name })} onClick={() => void call(`/libraries/${lib.id}/looks/${k.look_id}`, { method: 'DELETE' })}><Trash2Icon /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">{m.libraries_empty()}</p>)}
          {detail.data && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{m.libraries_members()}</p>
              <ItemGroup className="gap-1">
                {detail.data.members.map(u => (
                  <Item key={u.user_id} size="xs" variant="outline">
                    <ItemContent>
                      <ItemTitle>{u.name || u.email}</ItemTitle>
                      <ItemDescription>{u.email} · {libraryRoleLabel(u.role)}</ItemDescription>
                    </ItemContent>
                    {owner && u.role !== 'owner' && (
                      <ItemActions>
                        <Button size="xs" variant="ghost" onClick={() => void call(`/libraries/${lib.id}/members/${u.user_id}`, { method: 'DELETE' })}>{m.libraries_remove_member()}</Button>
                      </ItemActions>
                    )}
                  </Item>
                ))}
              </ItemGroup>
              {owner && (
                <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); if (email) void call(`/libraries/${lib.id}/members`, { method: 'POST', json: { email, role } }).then(() => setEmail('')); }}>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={m.libraries_share_placeholder()} aria-label={m.libraries_share_placeholder()} className="min-w-0 flex-1" />
                  <Select value={role} onValueChange={v => setRole(v as 'viewer' | 'editor')}>
                    <SelectTrigger className="w-32" aria-label={m.libraries_share_role()}><SelectValue>{libraryRoleLabel(role)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">{libraryRoleLabel('viewer')}</SelectItem>
                      <SelectItem value="editor">{libraryRoleLabel('editor')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" variant="outline" disabled={!email}><UserPlusIcon /> {m.libraries_share()}</Button>
                </form>
              )}
            </div>
          )}
          <div className="flex gap-2">
            {owner ? (
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="outline" size="sm" className="text-destructive" />}><Trash2Icon /> {m.libraries_delete()}</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{m.libraries_delete_title({ name: lib.name })}</AlertDialogTitle>
                    <AlertDialogDescription>{m.libraries_delete_description()}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => void call(`/libraries/${lib.id}`, { method: 'DELETE' })}>{m.settings_delete()}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : detail.data && (
              <Button variant="outline" size="sm" disabled={!userId} onClick={() => void call(`/libraries/${lib.id}/members/${userId}`, { method: 'DELETE' })}>{m.libraries_leave()}</Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
