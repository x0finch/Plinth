// Guard: UI code must not hard-code user-visible text; it goes through messages/{locale}.json (`m.key()`).
// Flags Chinese characters in client code. Usage: npm run check:i18n [-- <files…>]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const dirs = ['routes', 'editor', 'canvas', 'lib', 'components'].map(d => join(root, d));
const skip = ['components/ui', 'paraglide'];
const cjk = /[　-〿一-鿿＀-￯]/;

const files = [];
const walk = d => readdirSync(d).forEach(f => {
  const p = join(d, f);
  if (skip.some(s => p.includes(s))) return;
  statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(f) && files.push(p);
});
const only = process.argv.slice(2);
if (only.length) files.push(...only.map(f => join(process.cwd(), f)));
else dirs.forEach(walk);

let n = 0;
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (cjk.test(line) && !line.includes('i18n-ok')) {
      console.log(`${relative(root, f)}:${i + 1}  ${line.trim().slice(0, 100)}`);
      n++;
    }
  });
}
if (n) {
  console.log(`\n${n} lines hard-code Chinese text. Move it to messages/parts/*.json and use m.key().`);
  process.exit(1);
}
console.log('i18n check passed: no hard-coded UI text');
