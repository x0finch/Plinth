/**
 * A look's page in its library, like a component's page in Storybook: a large still with controls for its parameters and size
 * (the same controls as the properties panel), then its variants, one parameter at a time with the others at their defaults,
 * and the size narrower and wider. Everything is generated from the look's declarations (lib/variants.ts).
 */
import { DEFAULT_TYPES, groupNames, lookGroup, lookSizeOf, names, type LibraryLook, type LookLibrary, type ParamValue } from '@plinth/core';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';
import { sizeText, LookImage } from '@/features/looks/LookCard';
import { ParamControls, paramText, paramTitle } from '@/features/looks/ParamControls';
import { SiteFooter, SiteHeader } from '@/features/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocale, m, uiName } from '@/lib/i18n';
import { getLibrary } from '@/lib/libraries';
import { cn } from '@/lib/utils';
import { paramVariants, sizeVariants, type VariantRole } from '@/features/looks/variants';

export const Route = createFileRoute('/looks/$libraryId_/$lookId')({ component: LookPage });

function LookPage() {
  const { libraryId, lookId } = Route.useParams();
  const detail = useQuery({ queryKey: ['library', libraryId], queryFn: () => getLibrary(libraryId) });
  const lib = detail.data?.library,
    look = lib?.looks[lookId];
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        <Button variant="link" size="sm" className="h-auto px-0" nativeButton={false} render={<Link to="/looks/$libraryId" params={{ libraryId }} />}>
          <ArrowLeftIcon /> {lib ? uiName(lib.name) : m.libraries_back()}
        </Button>
        {detail.isLoading ? (
          <Skeleton className="h-96" />
        ) : lib && look ? (
          <Look key={lookId} lib={lib} look={look} />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{detail.error?.message ?? m.agent_err_look_not_found({ look: lookId })}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

/** What a target is, in the UI language: a furniture type's name, a kind of opening, railings, an element */
function targetName(lib: LookLibrary, look: LibraryLook, target: string) {
  const [kind, type] = target.split(':'),
    v = names(getLocale() === 'en' ? 'en' : 'zh');
  if (kind === 'furniture') return uiName(look.newType?.name ?? DEFAULT_TYPES[type]?.name) || type;
  if (kind === 'opening') return type === 'glass-block' ? v.glassBlock(v.opening.window) : (v.opening[type as keyof typeof v.opening] ?? type);
  if (kind === 'wall') return v.wall[type as keyof typeof v.wall] ?? type;
  const element: Record<string, () => string> = { stair: m.gallery_stair, pond: m.gallery_pond, drain: m.gallery_drain };
  return element[type]?.() ?? type;
}

function Look({ lib, look }: { lib: LookLibrary; look: LibraryLook }) {
  const usual = lookSizeOf(look);
  const [values, setValues] = useState<Record<string, ParamValue>>({});
  const [size, setSize] = useState(usual);
  const group = lookGroup(look),
    groupName = group && groupNames(lib, group);
  const params = look.params ?? {};
  const set = (name: string, v: ParamValue) =>
    setValues(({ [name]: _old, ...rest }) => (v === null && params[name]?.default !== null ? rest : { ...rest, [name]: v }));
  const changed = Object.keys(values).length > 0 || size !== usual;
  return (
    <>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{uiName(look.name)}</h1>
        <p className="text-sm text-muted-foreground">
          {[
            groupName && uiName(groupName),
            m.look_page_for({ targets: look.for.map(t => targetName(lib, look, t)).join(m.looks_target_separator()) }),
            `v${look.version}`,
            sizeText(usual),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <LookImage lib={lib} look={look} size={size} params={values} live />
        </div>
        <Card className="gap-3 self-start py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">{m.look_page_controls()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <div className="space-y-1">
              <p className="text-sm">{m.look_page_size()}</p>
              <div className="grid grid-cols-3 gap-2">
                {(['w', 'd', 'h'] as const).map(k => (
                  <Input
                    key={`${k}-${size[k]}`}
                    type="number"
                    min={1}
                    aria-label={m.look_page_size_part({ part: k === 'w' ? m.look_page_w() : k === 'd' ? m.look_page_d() : m.look_page_h() })}
                    defaultValue={size[k]}
                    onBlur={e => {
                      const v = Number(e.target.value);
                      if (v > 0 && v !== size[k]) setSize({ ...size, [k]: v });
                    }}
                    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                ))}
              </div>
            </div>
            {Object.keys(params).length ? (
              <ParamControls params={params} values={values} onChange={set} recipe={{ materials: lib.materials }} />
            ) : (
              <p className="text-sm text-muted-foreground">{m.look_page_no_params()}</p>
            )}
            {changed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setValues({});
                  setSize(usual);
                }}
              >
                {m.look_page_reset()}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      <Variants lib={lib} look={look} onPick={set} />
    </>
  );
}

const roleText: Record<VariantRole | 'narrow' | 'wide', () => string> = {
  min: m.look_variant_min,
  max: m.look_variant_max,
  default: m.look_variant_default,
  auto: m.look_variant_auto,
  value: () => '',
  narrow: m.look_variant_narrow,
  wide: m.look_variant_wide,
};

/** The variant wall: a row per parameter that has values to show, and the size */
function Variants({ lib, look, onPick }: { lib: LookLibrary; look: LibraryLook; onPick: (name: string, v: ParamValue) => void }) {
  const usual = lookSizeOf(look);
  const rows = Object.entries(look.params ?? {})
    .map(([name, d]) => ({ name, d, variants: paramVariants(d) }))
    .filter(r => r.variants.length > 1);
  return (
    <section aria-labelledby="variants-title" className="space-y-4">
      <div>
        <h2 id="variants-title" className="text-base font-medium">
          {m.look_page_variants()}
        </h2>
        <p className="text-sm text-muted-foreground">{m.look_page_variants_hint()}</p>
      </div>
      {rows.map(({ name, d, variants }) => (
        <div key={name} className="space-y-2" data-variants={name}>
          <p className="text-sm font-medium">{paramTitle(name, d)}</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {variants.map(({ value, role }) => (
              <li key={JSON.stringify(value)}>
                <Variant
                  label={paramText(d, value, { materials: lib.materials })}
                  caption={roleText[role]()}
                  current={role === 'default' || (role === 'auto' && d.default === null)}
                  onClick={() => onPick(name, value)}
                >
                  <LookImage lib={lib} look={look} params={{ [name]: value }} />
                </Variant>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="space-y-2" data-variants="size">
        <p className="text-sm font-medium">{m.look_page_size()}</p>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {sizeVariants(usual).map(({ size, role }) => (
            <li key={role}>
              <Variant label={sizeText(size)} caption={roleText[role]()} current={role === 'default'}>
                <LookImage lib={lib} look={look} size={size} />
              </Variant>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Variant({
  label,
  caption,
  current,
  onClick,
  children,
}: {
  label: string;
  caption: string;
  current?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const body = (
    <>
      {children}
      <p className="mt-1 truncate text-left text-xs">
        {label}
        {caption && <span className="text-muted-foreground"> · {caption}</span>}
      </p>
    </>
  );
  return onClick ? (
    <Button variant="ghost" className={cn('block h-auto w-full p-1 font-normal', current && 'bg-muted')} onClick={onClick} aria-pressed={current}>
      {body}
    </Button>
  ) : (
    <div className={cn('p-1', current && 'rounded-md bg-muted')}>{body}</div>
  );
}
