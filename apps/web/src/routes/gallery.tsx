/**
 * Style gallery: one of every kind of object (walls, doors and windows, floor materials, furniture, elements, space kinds) laid
 * out on tiles and drawn in the default model style, in the plan and in 3D, through the same canvas as the editor. The specimen
 * project is generated in the page (see gallery/specimens.ts) and opened read-only; nothing is saved.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { EditorCanvas } from '@/editor/Editor';
import { PropsPanel } from '@/editor/panels';
import { createEditorStore, EditorContext, useEditor } from '@/editor/store';
import { specimenProject } from '@/gallery/specimens';
import { getLocale, m } from '@/lib/i18n';

export const Route = createFileRoute('/gallery')({ component: Gallery });

function Gallery() {
  const store = useMemo(() => {
    const content = specimenProject(getLocale() === 'en' ? 'en' : 'zh');
    return createEditorStore({ id: content.id, name: content.name, role: 'viewer', version: 1, content });
  }, []);
  return (
    <EditorContext.Provider value={store}>
      <div className="flex h-dvh flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
          <Button size="icon-sm" variant="ghost" nativeButton={false} render={<Link to="/settings" />} aria-label={m.gallery_back()}><ArrowLeftIcon /></Button>
          <h1 className="font-medium">{m.gallery_title()}</h1>
        </header>
        <div className="flex min-h-0 flex-1 max-md:flex-col">
          <main className="relative min-h-0 min-w-0 flex-1" aria-label={m.editor_canvas()}>
            <EditorCanvas />
          </main>
          <aside className="flex shrink-0 flex-col overflow-y-auto border-l md:w-[340px] max-md:h-[35dvh] max-md:border-t max-md:border-l-0">
            <Details />
          </aside>
        </div>
      </div>
    </EditorContext.Provider>
  );
}

/** The selected specimen's properties; with nothing selected, what the gallery is */
function Details() {
  const selected = useEditor(s => s.view.selection.length > 0);
  return selected ? <PropsPanel /> : <p className="p-4 text-sm text-muted-foreground">{m.gallery_intro()}</p>;
}
