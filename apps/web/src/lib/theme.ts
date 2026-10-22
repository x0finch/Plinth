/**
 * 读主题颜色给 three.js 用。主题变量是 oklch，three.js 不认，借 canvas 让浏览器换算成 rgb。
 * 画布在自己的 iframe 里、只有亮色，所以从画布文档读；网页里的调用读网页文档并跟随系统深浅色。
 */
import { useEffect, useState } from 'react';

let canvas: HTMLCanvasElement | null = null;

export function themeColor(token: string, doc: Document = document): string {
  canvas ??= document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = doc.defaultView!.getComputedStyle(doc.documentElement).getPropertyValue(token).trim();
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

export function useThemeColors<const T extends Record<string, string>>(tokens: T, doc: Document = document): Record<keyof T, string> {
  const read = () => Object.fromEntries(Object.entries(tokens).map(([k, t]) => [k, themeColor(t, doc)])) as Record<keyof T, string>;
  const [colors, setColors] = useState(read);
  useEffect(() => {
    setColors(read());
    const q = doc.defaultView!.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setColors(read());
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [doc]);
  return colors;
}
