/** Properties of the selected object; with nothing selected, the level's rule check and the constraints. */
import { DEFAULT_LIBRARY_ID, derived, elementTarget, findObject, furnitureTarget, looksFor, objectInfo, openingTarget, type ObjectInfo } from '@plinth/core';
import { Link } from '@tanstack/react-router';
import { CheckIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { m } from '@/lib/i18n';
import { fmtArea } from '@/lib/query';
import { useEditor } from '../store';
import { kindLabel, Row, useRun } from './common';
import { ConstraintsList } from './ConstraintsList';
import { LooksPanel } from './LooksPanel';

type Info<T extends ObjectInfo['type']> = Extract<ObjectInfo, { type: T }>;

const TYPE_LABEL: Partial<Record<ObjectInfo['type'], () => string>> = {
  space: m.panels_type_space, wall: m.panels_type_wall, opening: m.panels_type_opening, furniture: m.panels_type_furniture, element: m.panels_type_element,
};

export function PropsPanel() {
  const project = useEditor(s => s.project);
  const selected = useEditor(s => s.view.selection[0]);
  const info = useMemo(() => (selected ? objectInfo(project, selected) : null), [project, selected]);
  return info ? <ObjectProps info={info} /> : <LevelOverview />;
}

function LevelOverview() {
  const project = useEditor(s => s.project);
  const level = useEditor(s => s.view.level);
  const focus = useEditor(s => s.focus);
  const issues = derived(project).rules.filter(i => i.targets.some(t => findObject(project, t)?.level === level));
  return (
    <div className="space-y-4 p-4 text-sm">
      <p className="text-muted-foreground">{m.panels_props_empty_hint()}</p>
      <ConstraintsList />
      <Separator />
      <LooksPanel />
      <Separator />
      <div>
        <p className="mb-2 font-medium">{m.panels_level_check()}</p>
        {issues.length === 0 ? (
          <p className="flex items-center gap-1.5 text-muted-foreground"><CheckIcon className="size-4" /> {m.panels_no_issues()}</p>
        ) : (
          <ItemGroup className="gap-1">
            {issues.map((i, k) => (
              <Item key={k} size="xs" render={<button type="button" />} onClick={() => focus(i.targets)} className="cursor-pointer text-left hover:bg-muted">
                <ItemMedia variant="icon"><TriangleAlertIcon className={i.severity === 'error' ? 'text-destructive' : 'text-chart-1'} /></ItemMedia>
                <ItemContent><ItemDescription className="text-foreground">{i.message}</ItemDescription></ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </div>
    </div>
  );
}

function ObjectProps({ info }: { info: ObjectInfo }) {
  const canEdit = useEditor(s => s.canEdit());
  const run = useRun();
  return (
    <div className="space-y-3 p-4">
      <div>
        <p className="text-xs text-muted-foreground">{TYPE_LABEL[info.type]?.() ?? info.type}</p>
        {canEdit && (info.type === 'space' || info.type === 'wall') ? (
          <NameInput key={info.id} name={info.name} onRename={name => run(info.type === 'space' ? 'space_update' : 'wall_update', { [info.type]: info.id, name })} />
        ) : (
          <h3 className="text-base font-medium">{'name' in info ? info.name : info.id}</h3>
        )}
      </div>
      {info.type === 'space' && <SpaceProps info={info} />}
      {info.type === 'wall' && <WallProps info={info} />}
      {info.type === 'opening' && <OpeningProps info={info} />}
      {info.type === 'furniture' && <FurnitureProps info={info} />}
      {info.type === 'element' && <ElementProps info={info} />}
      {(info.type === 'furniture' || info.type === 'opening' || info.type === 'element') && <LookPicker id={info.id} />}
      {canEdit && (info.type === 'wall' || info.type === 'opening' || info.type === 'furniture') && (
        <p className="text-xs text-muted-foreground">{m.panels_drag_hint()}</p>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2 pt-1">
          {info.type === 'furniture' && (
            <>
              <Button size="sm" variant="outline" onClick={() => run('furniture_move', { furniture: info.id, rotation: (info.rotation + 90) % 360 })}>{m.panels_rotate_90()}</Button>
              <Button size="sm" variant="outline" onClick={() => run('furniture_remove', { furniture: info.id })}><Trash2Icon /> {m.panels_remove_furniture()}</Button>
            </>
          )}
          {info.type === 'opening' && <Button size="sm" variant="outline" onClick={() => run('opening_remove', { opening: info.id })}><Trash2Icon /> {m.panels_remove_opening()}</Button>}
          {info.type === 'wall' && info.kind !== 'bearing' && <Button size="sm" variant="outline" onClick={() => run('wall_remove', { wall: info.id })}><Trash2Icon /> {m.panels_remove_wall()}</Button>}
          {info.type === 'space' && <Button size="sm" variant="outline" onClick={() => run('space_remove', { space: info.id })}><Trash2Icon /> {m.panels_remove_space()}</Button>}
        </div>
      )}
    </div>
  );
}

const FOLLOW = '__follow__';

/**
 * The object's look, when the design has looks that fit it: the look of its type (like the font of the whole text), or its own
 * one; and making its own look the one for its whole type
 */
function LookPicker({ id }: { id: string }) {
  const project = useEditor(s => s.project);
  const canEdit = useEditor(s => s.canEdit());
  const run = useRun();
  const projectId = useEditor(s => s.projectId);
  const e = findObject(project, id);
  if (!e || (e.kind !== 'furniture' && e.kind !== 'opening' && e.kind !== 'element')) return null;
  const target = e.kind === 'furniture' ? furnitureTarget(e.obj) : e.kind === 'opening' ? openingTarget(e.obj) : elementTarget(e.obj);
  const options = looksFor(project, target);
  if (!options.length) return null;
  const looks = project.library.looks ?? {};
  const own = e.obj.look && looks[e.obj.look] ? e.obj.look : null;
  const typeLook = project.library.use?.[target];
  const typeName = typeLook && looks[typeLook] ? looks[typeLook].name : m.panels_look_default();
  const label = (v: string) => (v === FOLLOW ? m.panels_look_follow({ name: typeName }) : looks[v]?.name ?? v);
  const value = own ?? FOLLOW;
  if (!canEdit) return <Row k={m.panels_look()} v={label(value)} />;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{m.panels_look()}</p>
      <Select value={value} onValueChange={v => run('look_set', { object: id, look: v === FOLLOW ? null : v })}>
        <SelectTrigger className="w-full" aria-label={m.panels_look()}><SelectValue>{label(value)}</SelectValue></SelectTrigger>
        <SelectContent>
          <SelectItem value={FOLLOW}>{label(FOLLOW)}</SelectItem>
          {options.map(([k, l]) => <SelectItem key={k} value={k}>{l.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex flex-wrap gap-x-3">
        {own && own !== typeLook && (
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => run('look_use', { target, look: own })}>{m.panels_look_use_all({ name: looks[own].name })}</Button>
        )}
        {!own && typeLook && (
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => run('look_use', { target, look: null })}>{m.panels_look_reset_all()}</Button>
        )}
        <Button variant="link" size="sm" className="h-auto px-0" nativeButton={false} render={<Link to="/looks/$libraryId" params={{ libraryId: DEFAULT_LIBRARY_ID }} search={{ p: projectId }} />}>{m.panels_look_gallery()}</Button>
      </div>
    </div>
  );
}

/** Editable name: commits on blur or Enter */
function NameInput({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      className="mt-1 h-8 font-medium"
      value={draft ?? name}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        if (draft && draft !== name) onRename(draft);
        setDraft(null);
      }}
      onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      aria-label={m.panels_name()}
    />
  );
}

function SpaceProps({ info }: { info: Info<'space'> }) {
  const materials = useEditor(s => s.project.library.materials);
  const select = useEditor(s => s.select);
  return (
    <div>
      <p className="text-lg font-medium">{fmtArea(info.netArea)}</p>
      <Row k={m.panels_row_kind()} v={kindLabel(info.kind)} />
      <Row k={m.panels_row_bay_depth()} v={`${(info.bounds.width / 1000).toFixed(2)} × ${(info.bounds.depth / 1000).toFixed(2)} m`} />
      <Row k={m.panels_row_floor()} v={materials[info.floor]?.name ?? info.floor} />
      <Separator className="my-2" />
      <p className="mb-1 text-xs text-muted-foreground">{m.panels_surroundings()}</p>
      <ItemGroup className="gap-0">
        {info.walls.map(w => (
          <Item key={w.id} size="xs" render={<button type="button" />} onClick={() => select([w.id])} className="cursor-pointer hover:bg-muted">
            <ItemContent><ItemTitle>{w.direction} · {w.name}</ItemTitle></ItemContent>
            {w.openings.length > 0 && <ItemActions className="text-xs text-muted-foreground">{m.panels_openings_count({ count: w.openings.length })}</ItemActions>}
          </Item>
        ))}
      </ItemGroup>
      {info.neighbors.length > 0 && (
        <>
          <p className="mt-2 mb-1 text-xs text-muted-foreground">{m.panels_neighbors()}</p>
          <p className="text-sm">{info.neighbors.map(n => n.name).join(m.panels_list_separator())}</p>
        </>
      )}
    </div>
  );
}

function WallProps({ info }: { info: Info<'wall'> }) {
  return (
    <div>
      <Row k={m.panels_row_kind()} v={kindLabel(info.kind)} />
      <Row k={m.panels_row_length()} v={`${(info.length / 1000).toFixed(2)} m`} />
      <Row k={m.panels_row_thickness()} v={`${info.thickness} mm`} />
      <Row k={m.panels_row_sides()} v={info.spaces.map(s => s.space).join(' / ') || '—'} />
      {info.openings.length > 0 && <Row k={m.panels_row_openings()} v={info.openings.map(o => kindLabel(o.kind)).join(m.panels_list_separator())} />}
      {info.kind === 'bearing' && <p className="mt-2 text-xs text-muted-foreground">{m.panels_bearing_note()}</p>}
    </div>
  );
}

function OpeningProps({ info }: { info: Info<'opening'> }) {
  return (
    <div>
      <Row k={m.panels_row_kind()} v={kindLabel(info.kind)} />
      <Row k={m.panels_row_width_height()} v={`${info.width} × ${info.height} mm`} />
      {info.sill > 0 && <Row k={m.panels_row_sill()} v={`${info.sill} mm`} />}
      <Row k={m.panels_row_host_wall()} v={info.wall.name} />
      <Row k={m.panels_row_connects()} v={info.connects.map(s => s.name).join(' ↔ ') || '—'} />
    </div>
  );
}

function ElementProps({ info }: { info: Info<'element'> }) {
  const project = useEditor(s => s.project);
  const levelName = (id?: string) => project.levels.find(l => l.id === id)?.name ?? id;
  return (
    <div>
      <Row k={m.panels_row_kind()} v={project.library.elements[info.type]?.name ?? info.type} />
      <Row k={m.panels_row_levels()} v={info.topLevel ? `${levelName(info.level)} → ${levelName(info.topLevel)}` : levelName(info.level)} />
    </div>
  );
}

function FurnitureProps({ info }: { info: Info<'furniture'> }) {
  return (
    <div>
      <Row k={m.panels_row_category()} v={info.label ?? info.type} />
      <Row k={m.panels_row_size()} v={`${info.size.w} × ${info.size.d} × ${info.size.h} mm`} />
      <Row k={m.panels_row_rotation()} v={`${info.rotation}°`} />
    </div>
  );
}
