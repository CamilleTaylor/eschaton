// Daily ingestion of Wikipedia's Portal:Current events into the ESCHATON archetype index.
// Free to run: Node 18+, no API keys. Used by .github/workflows/daily-index.yml.
//
//   node tools/ingest.mjs              update: refetch the last 5 days, fetch anything new, rebuild data/index.json
//   node tools/ingest.mjs --rebuild    refetch everything from the start date (run after editing the lexicons)
//   node tools/ingest.mjs --to 2026-11-24
//   node tools/ingest.mjs --rebuild --start 2008-01-01   extend coverage back (older portal pages are patchier; missing days are skipped)
//
// data/daily.json keeps one compact row per day so daily runs only fetch a few pages.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../js/engine.js');
const W = require('../js/wiki.js');
const IX = require('../js/indexer.js');
const C = require('../js/control.js');

const root = new URL('../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const A = read('data/archetypes.json');
const P = read('data/prophecies.json');
const FAMILY_INDEX = Object.fromEntries(P.map(p => [p.id, IX.FAMILIES.indexOf(p.family)]));
const DECOYS = C.decoys(P, A); // control corpus: shuffled fake prophecies, see js/control.js
const A_INDEX = Object.fromEntries(A.map((a, i) => [a.id, i]));

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const START = opt('--start') || process.env.ESCHATON_START || (existsSync(new URL('data/index.json', new URL('../', import.meta.url))) ? (JSON.parse(readFileSync(new URL('data/index.json', new URL('../', import.meta.url)), 'utf8')).start || '2016-01-01') : '2016-01-01');
if (!/^\d{4}-\d{2}-\d{2}$/.test(START)) throw new Error('--start must be YYYY-MM-DD');
const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const TO = opt('--to') || yesterday;
const HIGHLIGHT_DAYS = 10;
const UA = 'ESCHATON/1.0 (comparative mythology research prototype; https://github.com/)';

const dailyPath = new URL('data/daily.json', root);
const daily = !flag('--rebuild') && existsSync(dailyPath) ? JSON.parse(readFileSync(dailyPath, 'utf8')) : {};

function dayRange(from, to) { const out = []; for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out; }
const all = dayRange(START, TO);
const known = Object.keys(daily).sort();
const refetchFrom = flag('--rebuild') || !known.length ? START : dayRange(START, known[known.length - 1]).slice(-5)[0];
const todo = all.filter(d => d >= refetchFrom || !(d in daily));

function scoreDay(items, withHighlights) {
  const c = A.map(() => 0), f = [0, 0, 0, 0, 0, 0, 0]; let r = 0, dr = 0; const hl = [];
  for (const it of items) {
    const text = (it.topic ? it.topic + '. ' : '') + it.t;
    const res = E.align(text, P, A);
    Object.keys(res.event.vec).forEach(id => c[A_INDEX[id]]++);
    const good = res.results.filter(x => x.predictive >= 20).sort((a, b) => b.predictive - a.predictive);
    if (E.align(text, DECOYS, A).results.some(x => x.predictive >= 20)) dr++;
    if (good.length) { r++; [...new Set(good.map(x => FAMILY_INDEX[x.id]))].forEach(i => f[i]++); }
    if (withHighlights && good.length) hl.push({ t: it.t.length > 240 ? it.t.slice(0, 237) + '…' : it.t, topic: it.topic.length > 90 ? it.topic.slice(0, 88) + '…' : it.topic, cat: it.cat, a: Object.keys(res.event.vec), m: good.slice(0, 2).map(x => [x.id, x.thematic, x.predictive]) });
  }
  hl.sort((a, b) => b.m[0][2] - a.m[0][2]);
  return { n: items.length, c, r, dr, f, hl: hl.slice(0, 4) };
}

async function fetchBatch(days) {
  const titles = days.map(W.dayTitle);
  const url = 'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&maxlag=5&titles=' + encodeURIComponent(titles.join('|'));
  for (let attempt = 0; attempt < 4; attempt++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) { const j = await r.json(); if (j.query) return { j, titles }; } } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error('Wikipedia API failed for batch starting ' + days[0]);
}

const hlFrom = all.slice(-HIGHLIGHT_DAYS)[0];
console.log(`Fetching ${todo.length} day(s) from ${todo[0]} to ${todo[todo.length - 1]}`);
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50);
  const { j, titles } = await fetchBatch(chunk);
  const byTitle = Object.fromEntries(chunk.map((d, k) => [titles[k], d]));
  const norm = Object.fromEntries((j.query.normalized || []).map(n => [n.to, n.from]));
  for (const p of j.query.pages) {
    const d = byTitle[p.title] || byTitle[norm[p.title]];
    if (!d) continue;
    if (p.missing || !p.revisions) { daily[d] = null; continue; }
    daily[d] = scoreDay(W.parseDay(p.revisions[0].slots.main.content), d >= hlFrom);
  }
  process.stdout.write(`\r${Math.min(i + 50, todo.length)}/${todo.length}`);
  await new Promise(r => setTimeout(r, 300));
}
console.log();
// keep highlights only for the recent window
Object.keys(daily).forEach(d => { if (daily[d] && d < hlFrom) delete daily[d].hl; });
const sorted = Object.fromEntries(Object.keys(daily).sort().map(d => [d, daily[d]]));
writeFileSync(dailyPath, JSON.stringify(sorted));
const index = IX.build(all, sorted, A, { recentDays: 90, highlightDays: HIGHLIGHT_DAYS, start: START, baselineFrom: START < '2016-01-01' ? START : '2016-01-01' });
writeFileSync(new URL('data/index.json', root), JSON.stringify(index));
console.log(`index.json: ${index.coverage.usableDays} usable days, ${index.coverage.items} items, baseline ${index.baseline.days} days`);
