/**
 * 读主题颜色给 three.js 用。主题变量是 oklch，three.js 不认，借 canvas 让浏览器换算成 rgb。
 * 系统深浅色切换时重新读取。
 */
import { useEffect, useState } from 'react';

let canvas: HTMLCanvasElement | null = null;

export function themeColor(token: string): string {
  canvas ??= document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

export function useThemeColors<const T extends Record<string, string>>(tokens: T): Record<keyof T, string> {
  const read = () => Object.fromEntries(Object.entries(tokens).map(([k, t]) => [k, themeColor(t)])) as Record<keyof T, string>;
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const q = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setColors(read());
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return colors;
}
