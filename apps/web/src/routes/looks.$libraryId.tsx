/**
 * A look library's page, the same for every library, like a font's specimen page: what the file says about it, its looks by
 * group (an index to jump to each group, then a section per group with a card per look), and its materials. Everything comes
 * from the library file (packages/core/src/library.ts); nothing here knows one library from another. A look opens its own page
 * (looks.$libraryId_.$lookId.tsx).
 */
import { groupedLooks, type LookLibrary } from '@plinth/core';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeftIcon, DownloadIcon, SettingsIcon, ShapesIcon } from 'lucide-react';
import { LibraryBadge, LibraryManage } from '@/components/looks/library';
import { LookCard, MaterialSwatch } from '@/components/looks/LookCard';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { m, uiName } from '@/lib/i18n';
import { downloadLibrary, getLibrary } from '@/lib/libraries';
import type { LibraryDetail } from '@/shared/looks';

export const Route = createFileRoute('/looks/$libraryId')({ component: LibraryPage });

/** Anchor of a group's section */
const anchor = (group: string | null) => `group-${group ?? 'other'}`;

function LibraryPage() {
  const { libraryId } = Route.useParams();
  const detail = useQuery({ queryKey: ['library', libraryId], queryFn: () => getLibrary(libraryId) });
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        <Button variant="link" size="sm" className="h-auto px-0" nativeButton={false} render={<Link to="/looks" />}><ArrowLeftIcon /> {m.libraries_back()}</Button>
        {detail.isLoading ? <Skeleton className="h-40" /> : !detail.data ? (
          <Empty>
            <EmptyHeader><EmptyTitle>{detail.error?.message ?? m.server_err_library_not_found()}</EmptyTitle></EmptyHeader>
          </Empty>
        ) : <Library detail={detail.data} />}
      </main>
      <SiteFooter />
    </div>
  );
}

function Library({ detail }: { detail: LibraryDetail }) {
  const lib = detail.library;
  const groups = groupedLooks(lib);
  const materials = Object.entries(lib.materials ?? {});
  return (
    <>
      <LibraryHeader detail={detail} />
      {!groups.length && !materials.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ShapesIcon /></EmptyMedia>
            <EmptyTitle>{m.libraries_empty()}</EmptyTitle>
            <EmptyDescription>{m.libraries_canvas_empty()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-[11rem_1fr]">
          <nav aria-label={m.libraries_groups()} className="md:sticky md:top-4 md:self-start">
            <ItemGroup className="flex-row flex-wrap gap-1 md:flex-col">
              {groups.map(g => (
                <Item key={anchor(g.group)} size="xs" render={<a href={`#${anchor(g.group)}`} />} className="hover:bg-muted">
                  <ItemContent><ItemTitle>{g.names ? uiName(g.names) : m.libraries_group_other()} <span className="text-muted-foreground">{g.looks.length}</span></ItemTitle></ItemContent>
                </Item>
              ))}
              {materials.length > 0 && (
                <Item size="xs" render={<a href="#materials" />} className="hover:bg-muted">
                  <ItemContent><ItemTitle>{m.libraries_materials()} <span className="text-muted-foreground">{materials.length}</span></ItemTitle></ItemContent>
                </Item>
              )}
            </ItemGroup>
          </nav>
          <div className="min-w-0 space-y-8">
            {groups.map(g => (
              <section key={anchor(g.group)} id={anchor(g.group)} aria-labelledby={`${anchor(g.group)}-title`} className="scroll-mt-4 space-y-3">
                <h2 id={`${anchor(g.group)}-title`} className="text-base font-medium">
                  {g.names ? uiName(g.names) : m.libraries_group_other()} <span className="text-sm font-normal text-muted-foreground">{m.libraries_count({ count: g.looks.length })}</span>
                </h2>
                <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                  {g.looks.map(([id, look]) => <li key={id}><LookCard lib={lib} id={id} look={look} /></li>)}
                </ul>
              </section>
            ))}
            {materials.length > 0 && <Materials lib={lib} />}
          </div>
        </div>
      )}
    </>
  );
}

function LibraryHeader({ detail }: { detail: LibraryDetail }) {
  const lib = detail.library;
  const looks = Object.keys(lib.looks).length, materials = Object.keys(lib.materials ?? {}).length;
  const facts = [
    `v${lib.version}`,
    lib.author && m.libraries_by({ author: lib.author }),
    lib.license && m.libraries_license({ license: lib.license }),
    m.libraries_count({ count: looks }),
    materials > 0 && m.libraries_materials_count({ count: materials }),
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-xl font-semibold">{uiName(lib.name)}</h1>
          <LibraryBadge lib={detail} />
        </div>
        {lib.description && <p className="max-w-2xl text-sm text-muted-foreground">{uiName(lib.description)}</p>}
        <p className="text-xs text-muted-foreground">{facts.join(' · ')}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => downloadLibrary(lib)}><DownloadIcon /> {m.libraries_export()}</Button>
        {!detail.builtin && (
          <Sheet>
            <SheetTrigger render={<Button size="sm" variant="outline" />}><SettingsIcon /> {m.libraries_manage()}</SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader><SheetTitle>{uiName(lib.name)}</SheetTitle></SheetHeader>
              <div className="px-4 pb-4"><LibraryManage detail={detail} /></div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}

/** The library's materials, like a font's glyph table */
function Materials({ lib }: { lib: LookLibrary }) {
  const materials = Object.entries(lib.materials ?? {});
  return (
    <section id="materials" aria-labelledby="materials-title" className="scroll-mt-4 space-y-3">
      <h2 id="materials-title" className="text-base font-medium">
        {m.libraries_materials()} <span className="text-sm font-normal text-muted-foreground">{m.libraries_materials_count({ count: materials.length })}</span>
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {materials.map(([id, mat]) => <li key={id}><MaterialSwatch id={id} material={mat} /></li>)}
      </ul>
    </section>
  );
}
