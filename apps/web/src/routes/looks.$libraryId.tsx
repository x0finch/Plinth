/**
 * A look library's page, the same for every library: what it has laid out in rows, each named on the ground in front of it, in
 * 3D, through the same canvas as the editor. The default library shows one of every kind of thing (walls, doors and windows,
 * floor materials, furniture, elements, space kinds) in the default set, other libraries only their own looks. The specimen
 * project is generated in the page (see gallery/specimens.ts) and opened read-only; nothing is saved. With ?p=<design>, the
 * default library's page also shows that design's own looks (linked from the design's properties panel).
 */
import { DEFAULT_LIBRARY_ID, migrate, type Project } from '@plinth/core';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeftIcon, SettingsIcon, ShapesIcon } from 'lucide-react';
import { useMemo } from 'react';
import { z } from 'zod';
import { LibraryBadge, LibraryManage } from '@/components/looks/library';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { EditorCanvas } from '@/editor/Editor';
import { GroundLabels } from '@/editor/ground-labels';
import { PropsPanel } from '@/editor/panels';
import { createEditorStore, EditorContext, useEditor, type InitialProject } from '@/editor/store';
import { specimenProject, type SpecimenLooks } from '@/gallery/specimens';
import { api } from '@/lib/api';
import { getLocale, m } from '@/lib/i18n';
import { getLibrary } from '@/lib/libraries';
import type { LibraryDetail } from '@/shared/looks';

export const Route = createFileRoute('/looks/$libraryId')({
  validateSearch: z.object({ p: z.string().optional() }),
  component: LibraryPage,
});

function LibraryPage() {
  const { libraryId } = Route.useParams();
  const { p } = Route.useSearch();
  const isDefault = libraryId === DEFAULT_LIBRARY_ID;
  const design = useQuery({ queryKey: ['project', p], queryFn: () => api<InitialProject>(`/projects/${p}`), enabled: isDefault && !!p, staleTime: Infinity, gcTime: 0 });
  const detail = useQuery({ queryKey: ['library', libraryId], queryFn: () => getLibrary(libraryId), enabled: !isDefault });
  if ((isDefault && p && design.isLoading) || (!isDefault && detail.isLoading)) return <div className="h-dvh" />;
  if (!isDefault && !detail.data) {
    return (
      <Empty className="h-dvh">
        <EmptyHeader><EmptyTitle>{detail.error?.message ?? m.server_err_library_not_found()}</EmptyTitle></EmptyHeader>
        <Button variant="link" nativeButton={false} render={<Link to="/looks" />}>{m.libraries_back()}</Button>
      </Empty>
    );
  }
  const lib = detail.data;
  // A new specimen project whenever what the library holds changes
  const key = isDefault ? `default:${design.data?.id ?? ''}` : JSON.stringify(lib!.looks.map(k => [k.look_id, k.version]));
  return <LibraryView key={key} lib={lib} from={design.data?.content} back={isDefault ? p : undefined} />;
}

function LibraryView({ lib, from, back }: { lib?: LibraryDetail; from?: Project; back?: string }) {
  const title = lib?.name ?? (from ? m.gallery_title() : m.libraries_default_name());
  const { store, labels } = useMemo(() => {
    const lang = getLocale() === 'en' ? 'en' : 'zh';
    const only: SpecimenLooks | undefined = lib && {
      looks: lib.looks.map(k => ({ id: k.look_id, name: k.name, for: k.for, recipe: k.recipe, version: k.version })),
      types: Object.assign({}, ...lib.looks.map(k => k.types ?? {})),
    };
    const { project: content, labels } = specimenProject(lang, { from: from && migrate(from), only, title });
    return { store: createEditorStore({ id: content.id, name: content.name, role: 'viewer', version: 1, content }, { mode: '3d' }), labels };
  }, [lib, from, title]);
  const empty = !!lib && !lib.looks.length;
  return (
    <EditorContext.Provider value={store}>
      <GroundLabels.Provider value={labels}>
      <div className="flex h-dvh flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
          <Button size="icon-sm" variant="ghost" nativeButton={false} render={back ? <Link to="/p/$projectId" params={{ projectId: back }} /> : <Link to="/looks" />} aria-label={back ? m.gallery_back() : m.libraries_back()}><ArrowLeftIcon /></Button>
          <h1 className="min-w-0 truncate font-medium">{title}</h1>
          {!from && <LibraryBadge lib={lib ?? { role: 'viewer', builtin: true, default: true }} />}
          <div className="flex-1" />
          {lib && !lib.builtin && (
            <Sheet>
              <SheetTrigger render={<Button size="sm" variant="outline" />}><SettingsIcon /> {m.libraries_manage()}</SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader><SheetTitle>{lib.name}</SheetTitle></SheetHeader>
                <div className="px-4 pb-4"><LibraryManage lib={lib} /></div>
              </SheetContent>
            </Sheet>
          )}
        </header>
        <main className="relative min-h-0 flex-1" aria-label={m.editor_canvas()}>
          {empty ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ShapesIcon /></EmptyMedia>
                <EmptyTitle>{m.libraries_empty()}</EmptyTitle>
                <EmptyDescription>{m.libraries_canvas_empty()}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <EditorCanvas only3D />
              <Details />
            </>
          )}
        </main>
      </div>
      </GroundLabels.Provider>
    </EditorContext.Provider>
  );
}

/** The selected specimen's name and parameters, floating over the canvas (at the bottom on phones) while one is selected */
function Details() {
  const selected = useEditor(s => s.view.selection.length > 0);
  if (!selected) return null;
  return (
    <Card className="absolute inset-x-2 bottom-2 max-h-[40%] gap-0 overflow-y-auto py-0 md:inset-x-auto md:top-14 md:right-2 md:bottom-auto md:w-80">
      <PropsPanel />
    </Card>
  );
}
