/**
 * Style gallery: one of every kind of object (walls, doors and windows, floor materials, furniture, elements, space kinds) laid
 * out in rows, each named on the ground in front of it, and drawn in the default model style, in 3D, through the same canvas as
 * the editor. The specimen project is generated in the page (see gallery/specimens.ts) and opened read-only; nothing is saved.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EditorCanvas } from '@/editor/Editor';
import { GroundLabels } from '@/editor/ground-labels';
import { PropsPanel } from '@/editor/panels';
import { createEditorStore, EditorContext, useEditor } from '@/editor/store';
import { specimenProject } from '@/gallery/specimens';
import { getLocale, m } from '@/lib/i18n';

export const Route = createFileRoute('/gallery')({ component: Gallery });

function Gallery() {
  const { store, labels } = useMemo(() => {
    const { project: content, labels } = specimenProject(getLocale() === 'en' ? 'en' : 'zh');
    return { store: createEditorStore({ id: content.id, name: content.name, role: 'viewer', version: 1, content }, { mode: '3d' }), labels };
  }, []);
  return (
    <EditorContext.Provider value={store}>
      <GroundLabels.Provider value={labels}>
      <div className="flex h-dvh flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
          <Button size="icon-sm" variant="ghost" nativeButton={false} render={<Link to="/settings" />} aria-label={m.gallery_back()}><ArrowLeftIcon /></Button>
          <h1 className="font-medium">{m.gallery_title()}</h1>
        </header>
        <main className="relative min-h-0 flex-1" aria-label={m.editor_canvas()}>
          <EditorCanvas only3D />
          <Details />
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
