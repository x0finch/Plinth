/** 把编辑器的选中、改动接到跳动上：选中就跳，改动就波纹扫过一轮 */
import { useEffect, useState } from 'react';
import { useEditor } from '@/editor/store';
import { useCanvasDocument } from './CanvasFrame';
import { hops } from './hop';

/** 系统“减少动态效果”打开时不跳，选中改用细描边 */
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
  // 改动、撤销、重做、agent 聚焦都会换一份 highlight
  useEffect(() => hops.ripple(highlight), [highlight]);
  useEffect(() => () => hops.stop(), []);
  return null;
}
