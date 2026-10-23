// Temporary helper while several people add messages at once: folds messages/parts/*.{zh,en}.json into
// messages/zh.json and messages/en.json (union; a key may not change value). Removed once the work lands.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../messages/', import.meta.url);
for (const locale of ['zh', 'en']) {
  const file = new URL(`${locale}.json`, dir);
  const out = JSON.parse(readFileSync(file, 'utf8'));
  const parts = existsSync(new URL('parts/', dir)) ? readdirSync(new URL('parts/', dir)).filter(f => f.endsWith(`.${locale}.json`)).sort() : [];
  for (const f of parts) {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(new URL(`parts/${f}`, dir), 'utf8')))) {
      if (k === '$schema') continue;
      if (k in out && out[k] !== v) throw new Error(`${locale}: key ${k} in ${f} differs from the existing value`);
      out[k] = v;
    }
  }
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`messages/${locale}.json: ${Object.keys(out).length - 1} keys`);
}
