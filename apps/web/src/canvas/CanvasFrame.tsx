/**
 * 画布放在同源 iframe 里渲染：样式和主题与网页隔离（画布只有亮色），
 * 组件仍通过 portal 留在同一棵 React 树里，共用编辑器状态。
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import css from './canvas.css?inline';

const CanvasDoc = createContext<Document | null>(null);

/** 画布所在的文档（读主题颜色、截图用） */
export const useCanvasDocument = () => useContext(CanvasDoc) ?? document;

const KEYS = ['key', 'code', 'shiftKey', 'ctrlKey', 'metaKey', 'altKey', 'repeat'] as const;

export function CanvasFrame({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);

  const mount = () => {
    const d = ref.current?.contentDocument;
    if (!d || d.getElementById('canvas-style')) return;
    const style = d.createElement('style');
    style.id = 'canvas-style';
    style.textContent = css;
    d.head.appendChild(style);
    d.documentElement.lang = document.documentElement.lang;
    setDoc(d);
  };

  // 焦点在画布里时，快捷键（撤销、Esc）仍交给网页处理
  useEffect(() => {
    const win = doc?.defaultView;
    if (!win) return;
    const forward = (e: KeyboardEvent) => {
      const init = Object.fromEntries(KEYS.map(k => [k, e[k]]));
      if (!window.dispatchEvent(new KeyboardEvent('keydown', { ...init, cancelable: true }))) e.preventDefault();
    };
    win.addEventListener('keydown', forward);
    return () => win.removeEventListener('keydown', forward);
  }, [doc]);

  // 开发时样式热更新
  useEffect(() => {
    const el = doc?.getElementById('canvas-style');
    if (el) el.textContent = css;
  }, [doc, css]);

  return (
    <iframe ref={ref} title="画布" srcDoc="<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>"
      onLoad={mount} className={className}>
      {doc && createPortal(<CanvasDoc.Provider value={doc}>{children}</CanvasDoc.Provider>, doc.body)}
    </iframe>
  );
}
