/**
 * The canvas renders in a same-origin iframe: styles and theme are isolated from the page (canvas is light only);
 * components stay in the same React tree via a portal and share editor state.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import css from './canvas.css?inline';
import { m } from '@/lib/i18n';

const CanvasDoc = createContext<Document | null>(null);

/** The canvas document (for reading theme colors and screenshots) */
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

  // When focus is in the canvas, shortcuts (undo, Esc) are still handled by the page
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

  // Hot-reload styles in development
  useEffect(() => {
    const el = doc?.getElementById('canvas-style');
    if (el) el.textContent = css;
  }, [doc, css]);

  return (
    <iframe ref={ref} title={m.editor_canvas()} srcDoc="<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>"
      onLoad={mount} className={className}>
      {doc && createPortal(<CanvasDoc.Provider value={doc}>{children}</CanvasDoc.Provider>, doc.body)}
    </iframe>
  );
}
