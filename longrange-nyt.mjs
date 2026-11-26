// Extends theme coverage back across decades using the New York Times Archive API (monthly article metadata
// back to 1851). Free: sign up at https://developer.nytimes.com, enable the Archive API, and store the key as
// the repository secret NYT_API_KEY. The free tier allows about 5 requests a minute and 500 a day, so this
// script works through a "budget" of months per run, resumes where it stopped, and the daily Action
// finishes 1945 to today in about two to three weeks without anyone touching it.
//
//   NYT_API_KEY=... node tools/longrange-nyt.mjs --from 1945-01 --budget 60
//
// Only headlines and abstracts are read, scored with the same theme lexicon, and reduced to monthly counts
// (data/longrange.json). No article text is stored. Levels are NOT comparable with the Wikipedia series:
// one newspaper's headlines are a different lens from an encyclopedia's daily log. Compare the NYT series
// only with itself (for example, the 1970s against the 2010s).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../js/engine.js');
const root = new URL('../', import.meta.url);
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const KEY = process.env.NYT_API_KEY;
const FROM = opt('--from', '1945-01'), BUDGET = Number(opt('--budget', 60)), GAP = Number(opt('--gap-ms', 12500));
const A = JSON.parse(readFileSync(new URL('data/archetypes.json', root), 'utf8'));
const outPath = new URL('data/longrange.json', root);
const lr = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { source: 'The New York Times Archive API (headlines and abstracts only; monthly counts). Data provided by The New York Times.', archetypes: A.map(a => a.id), months: [] };
if (lr.archetypes.join() !== A.map(a => a.id).join()) { console.error('Theme list changed; delete data/longrange.json to rebuild.'); process.exit(1); }
const have = new Set(lr.months.map(m => m[0]));
const fetchImpl = globalThis.__ESCHATON_FETCH || fetch;

// News-like documents only: skip obituaries, paid notices, corrections, crosswords, listings.
const SKIP = /obituar|paid (death )?notice|correction|crossword|letter|editorial|op-ed|review|schedule|list|index|summary|caption|recipe/i;
export function scoreDocs(docs) {
  const c = A.map(() => 0); let n = 0;
  for (const d of docs) {
    if (SKIP.test(d.type_of_material || '') || SKIP.test(d.section_name || '')) continue;
    const text = [d.headline && d.headline.main, d.abstract].filter(Boolean).join('. ').trim();
    if (text.length < 20) continue;
    n++; E.itemArchetypes(text, A).forEach(id => c[lr.archetypes.indexOf(id)]++);
  }
  return { n, c };
}

const now = new Date(), lastFull = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const todo = [];
for (let t = new Date(FROM + '-01T00:00:00Z'); t <= lastFull; t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1))) {
  const ym = t.toISOString().slice(0, 7); if (!have.has(ym)) todo.push(ym);
}
if (!KEY) { console.log('NYT_API_KEY not set; skipping. ' + todo.length + ' months remaining.'); process.exit(0); }
let done = 0;
for (const ym of todo.slice(0, BUDGET)) {
  const [y, m] = ym.split('-').map(Number);
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    try {
      const r = await fetchImpl(`https://api.nytimes.com/svc/archive/v1/${y}/${m}.json?api-key=${encodeURIComponent(KEY)}`);
      if (r.status === 429) { console.log('Rate limited; stopping for today.'); attempt = 3; break; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); const docs = (j.response && j.response.docs) || [];
      const s = scoreDocs(docs); lr.months.push([ym, s.n, s.c]); ok = true; done++;
      console.log(ym, s.n, 'items');
    } catch (e) { console.log(ym, 'failed:', e.message); await new Promise(r => setTimeout(r, GAP)); }
  }
  if (!ok) break;
  await new Promise(r => setTimeout(r, GAP));
}
lr.months.sort((a, b) => a[0] < b[0] ? -1 : 1);
lr.from = lr.months.length ? lr.months[0][0] : null; lr.to = lr.months.length ? lr.months[lr.months.length - 1][0] : null;
lr.updated = new Date().toISOString(); lr.remaining = todo.length - done;
if (done) writeFileSync(outPath, JSON.stringify(lr));
console.log(`Long-range: +${done} months, ${lr.months.length} total, ${lr.remaining} remaining.`);
