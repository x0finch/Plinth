/** Wire editor selection and changes to hops: hop on select, ripple once on change */
import { useEffect, useState } from 'react';
import { useEditor } from '@/editor/store';
import { useCanvasDocument } from './CanvasFrame';
import { hops } from './hop';

/** With the system "reduce motion" setting, no hops; selection uses a thin outline */
export function useReducedMotion() {
  const win = useCanvasDocument().defaultView ?? window;
  const [reduced, setReduced] = useState(() => win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const q = win.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [win]);
  return reduced;
}

export function HopDriver() {
  const project = useEditor(s => s.project);
  const selection = useEditor(s => s.view.selection);
  const highlight = useEditor(s => s.view.highlight);
  const reduced = useReducedMotion();

  hops.setProject(project);
  hops.reduced = reduced;
  useEffect(() => hops.select(selection), [selection]);
  // Changes, undo, redo and agent focus all produce a new highlight
  useEffect(() => hops.ripple(highlight), [highlight]);
  useEffect(() => () => hops.stop(), []);
  return null;
}
