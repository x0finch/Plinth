/**
 * Look options: the parameters a selected object's look declares (materials, decoration on/off, choices, numbers), set per
 * object with params_set; the look itself stays the same. A control per parameter, chosen from its default and its hints.
 */
import { elementTarget, findObject, furnitureTarget, lookRecipe, openingTarget, RECIPE_MATERIALS, type ParamDecl, type ParamValue, type RecipeMaterial } from '@plinth/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { m } from '@/lib/i18n';
import { LOOK_MATERIALS } from '../model3d/looks';
import { useEditor } from '../store';
import { Row, useRun } from './common';

const messages = m as unknown as Record<string, (() => string) | undefined>;
const isMaterial = (v: unknown): v is RecipeMaterial => typeof v === 'string' && (RECIPE_MATERIALS as readonly string[]).includes(v);
/** Materials offered for a material parameter without its own options: the ones that make sense on furniture */
const PICKABLE = RECIPE_MATERIALS.filter(x => !['tube', 'carGlass', 'tyre', 'headlight', 'taillight', 'frame', 'glassBlock', 'wall', 'water', 'grate', 'soil', 'bark', 'flower', 'appliance'].includes(x));

export const materialLabel = (mat: string) => messages[`material_${mat}`]?.() ?? mat;
const paramLabel = (name: string, decl: ParamDecl) => (decl !== null && typeof decl === 'object' && decl.label) || messages[`look_param_${name}`]?.() || name;

function Swatch({ mat }: { mat: string }) {
  const token = isMaterial(mat) ? LOOK_MATERIALS[mat].color : '--muted';
  return <span aria-hidden className="inline-block size-3 shrink-0 rounded-full border" style={{ background: `var(${token})` }} />;
}

export function LookParams({ id }: { id: string }) {
  const project = useEditor(s => s.project);
  const canEdit = useEditor(s => s.canEdit());
  const run = useRun();
  const e = findObject(project, id);
  if (!e || (e.kind !== 'furniture' && e.kind !== 'opening' && e.kind !== 'element')) return null;
  const target = e.kind === 'furniture' ? furnitureTarget(e.obj) : e.kind === 'opening' ? openingTarget(e.obj) : elementTarget(e.obj);
  const decls = Object.entries(lookRecipe(project, target, e.obj.look)?.params ?? {});
  if (!decls.length) return null;
  const set = (name: string, value: ParamValue) => run('params_set', { object: id, params: { [name]: value } });
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{m.looks_params()}</p>
      {decls.map(([name, decl]) => {
        const hint = decl !== null && typeof decl === 'object' ? decl : { default: decl };
        const own = e.obj.lookParams?.[name];
        const value = own !== undefined ? own : hint.default;
        const label = paramLabel(name, decl);
        const text = (v: ParamValue) => (isMaterial(v) ? materialLabel(v) : typeof v === 'boolean' ? (v ? m.looks_param_on() : m.looks_param_off()) : v === null ? m.looks_param_auto() : String(v));
        if (!canEdit) return <Row key={name} k={label} v={text(value)} />;
        const options = hint.options ?? (isMaterial(hint.default) ? PICKABLE : typeof hint.default === 'boolean' ? [true, false] : null);
        const reset = own !== undefined && (
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => set(name, null)}>{m.looks_param_reset()}</Button>
        );
        return (
          <div key={name} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>{label}</span>
              {reset}
            </div>
            {options ? (
              <Select value={JSON.stringify(value)} onValueChange={v => set(name, JSON.parse(v as string))}>
                <SelectTrigger className="w-full" aria-label={label}>
                  <SelectValue>{isMaterial(value) && <Swatch mat={value} />} {text(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {options.map(o => (
                    <SelectItem key={JSON.stringify(o)} value={JSON.stringify(o)}>{isMaterial(o) && <Swatch mat={o} />} {text(o)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : typeof hint.default === 'number' || hint.default === null ? (
              <Input key={String(value)} type="number" aria-label={label} defaultValue={value === null ? '' : String(value)} placeholder={m.looks_param_auto()}
                min={hint.min} max={hint.max}
                onBlur={ev => { const v = ev.target.value.trim() === '' ? null : Number(ev.target.value); if (v !== value && (v === null || Number.isFinite(v))) void set(name, v); }}
                onKeyDown={ev => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()} />
            ) : (
              <Input key={String(value)} aria-label={label} defaultValue={String(value ?? '')}
                onBlur={ev => ev.target.value !== value && void set(name, ev.target.value)}
                onKeyDown={ev => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()} />
            )}
          </div>
        );
      })}
    </div>
  );
}
