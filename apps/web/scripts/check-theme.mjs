// 守护：界面颜色只能引用主题变量（shadcn / Vercel 主题），不许写死颜色或用 Tailwind 色板。
// 用法：npm run check:theme
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const skip = ['components/ui', 'routeTree.gen.ts'];
const bad = [
  [/#[0-9a-fA-F]{3,8}\b(?![^'"]*['"]\s*\))/, '写死的十六进制颜色'],
  [/\b(?:text|bg|border|fill|stroke|ring|from|to|via)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/, 'Tailwind 色板颜色'],
  [/\b(?:rgb|rgba|hsl|hsla|oklch)\(\s*\d/, '写死的颜色函数'],
];
const files = [];
const walk = d => readdirSync(d).forEach(f => {
  const p = join(d, f);
  if (skip.some(s => p.includes(s))) return;
  statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(f) && files.push(p);
});
walk(root);
let n = 0;
for (const f of files) {
  if (f.endsWith('styles.css') || f.includes('/theme/')) continue; // 主题定义本身
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const [re, why] of bad) if (re.test(line) && !line.includes('theme-ok')) {
      console.log(`${f.replace(root, 'src')}:${i + 1}  ${why}：${line.trim().slice(0, 100)}`);
      n++;
    }
  });
}
if (n) {
  console.log(`\n${n} 处颜色没有引用主题变量。请用 var(--background) / text-muted-foreground 等主题颜色。`);
  process.exit(1);
}
console.log('颜色检查通过：全部引用主题变量');
