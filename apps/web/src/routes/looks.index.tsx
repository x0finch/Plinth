/**
 * Look libraries, like a font book: the default library (what objects without a look of their own are drawn with), the built-in
 * ones, and the user's own and shared libraries in one list. Each opens the same page (looks.$libraryId.tsx).
 */
import { DEFAULT_LOOKS, FURNITURE_TYPES } from '@plinth/core';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ShapesIcon } from 'lucide-react';
import { LibraryBadge, LibraryCreate } from '@/components/looks/library';
import { LookStill } from '@/components/looks/LookStill';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { m } from '@/lib/i18n';
import { getLibrary, listLibraries, lookSize } from '@/lib/libraries';
import type { LibrarySummary } from '@/shared/looks';

export const Route = createFileRoute('/looks/')({ component: Libraries });

function Libraries() {
  const libs = useQuery({ queryKey: ['libraries'], queryFn: listLibraries });
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold">{m.nav_libraries()}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{m.libraries_page_description()}</p>
        </div>
        <LibraryCreate />
        {libs.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-60" />)}</div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {libs.data?.map(l => <li key={l.id}><LibraryCard lib={l} /></li>)}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function LibraryCard({ lib }: { lib: LibrarySummary }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Link to="/looks/$libraryId" params={{ libraryId: lib.id }} className="block" aria-label={m.libraries_open({ name: lib.name })}>
        <div className="bg-card p-3"><Preview lib={lib} /></div>
        <CardHeader className="border-t px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="truncate text-sm">{lib.name}</CardTitle>
            <LibraryBadge lib={lib} />
          </div>
          <CardDescription className="text-xs">
            {m.libraries_count({ count: lib.looks })} · {lib.default ? m.libraries_default_hint() : m.libraries_owner({ name: lib.owner_name })}
          </CardDescription>
        </CardHeader>
      </Link>
    </Card>
  );
}

/** A still of one of the library's pieces, like a font's sample text: the default sofa, or the library's first look */
function Preview({ lib }: { lib: LibrarySummary }) {
  const detail = useQuery({ queryKey: ['library', lib.id], queryFn: () => getLibrary(lib.id), enabled: !lib.default && lib.looks > 0 });
  if (lib.default) return <LookStill single recipe={DEFAULT_LOOKS['furniture:sofa3']} size={FURNITURE_TYPES.sofa3.size} alt="" />;
  const first = detail.data?.looks[0];
  if (first) return <LookStill single recipe={first.recipe} size={lookSize(first)} alt="" />;
  if (lib.looks > 0) return <Skeleton className="aspect-[4/3] w-full" />;
  return <div className="flex aspect-[4/3] items-center justify-center rounded-md border"><ShapesIcon className="size-8 text-muted-foreground" /></div>;
}
