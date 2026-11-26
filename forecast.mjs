// Issues next month's index forecasts and resolves finished months, appending both to the public registry.
// Free: Node 18+, no keys. Run daily by .github/workflows/daily-index.yml after the ingest.
//
//   node tools/forecast.mjs            issue (only in the last 5 days of a month) and resolve whatever is due
//   node tools/forecast.mjs --force    issue next month's forecasts now even if it is earlier in the month
//   node tools/forecast.mjs --dry      print what would be appended, write nothing
//
// Forecasts are never edited. A resolution is a separate, later entry that points at the forecast's hash.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const F = require('../js/forecast.js');
const R = require('../js/registry.js');

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2), flag = n => args.includes(n);
const ix = JSON.parse(readFileSync(new URL('data/index.json', root), 'utf8'));
const regPath = new URL('data/registry.json', root);
const reg = existsSync(regPath) ? JSON.parse(readFileSync(regPath, 'utf8')) : { about: 'ESCHATON public prediction registry. Append-only, hash-chained; verify with js/registry.js. Do not edit by hand.', entries: [], head: R.GENESIS };
const ids = ix.archetypes;
const now = new Date(), today = now.toISOString().slice(0, 10);
const monthEnd = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const nextMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7); };
const LABEL = Object.fromEntries(JSON.parse(readFileSync(new URL('data/archetypes.json', root), 'utf8')).map(a => [a.id, a.label]));
const pct = v => (v * 100).toFixed(2) + '%';
const added = [];

// ---- resolve every forecast batch whose month is over and covered by the index
const resolvedOf = R.resolved(reg);
for (const e of reg.entries.filter(e => e.type === 'forecast-batch' && !resolvedOf[e.hash])) {
  const t = e.body.target, row = ix.months.find(m => m[0] === t);
  if (!row || ix.coverage.to < monthEnd(t)) continue;
  const items = e.body.forecasts.map(f => {
    const o = F.outcome(f, row, ids);
    return { id: f.id, y: o.y, value: o.value, brier: Object.fromEntries(Object.entries(f.p).map(([k, p]) => [k, R.brier(p, o.y)])) };
  });
  const mean = k => +(items.reduce((s, x) => s + x.brier[k], 0) / items.length).toFixed(4);
  const body = { of: e.hash, ofSeq: e.seq, target: t, data: { days: row[1], items: row[2], indexGenerated: ix.generated }, outcomes: items, meanBrier: { base: mean('base'), persistence: mean('persistence'), convergence: mean('convergence') } };
  added.push(['resolution', body]);
}

// ---- issue next month's forecasts in the last 5 days of the month (or with --force)
const curMonth = today.slice(0, 7), target = nextMonth(curMonth);
const daysLeft = (Date.parse(monthEnd(curMonth)) - Date.parse(today)) / 864e5;
const already = reg.entries.some(e => e.type === 'forecast-batch' && e.body.target === target);
if (!already && (daysLeft <= 4 || flag('--force'))) {
  const state = ix.months.find(m => m[0] === curMonth);
  const train = F.fullMonths(ix.months.filter(m => m[0] < curMonth));
  if (state && state[1] >= 14 && train.length >= 24) {
    const fs = F.issue(train, ids, target, state).map(f => {
      if (f.kind === 'theme') {
        const name = LABEL[f.theme] || f.theme;
        return Object.assign(f, {
          id: target + '/' + f.theme,
          question: `Will "${name}" be above its usual level in ${target}?`,
          criteria: `Resolves YES if more than ${pct(f.threshold)} of the news items in Wikipedia's Current events portal for ${target} touch the theme "${name}" (the theme's median monthly share over ${train[0][0]} to ${train[train.length - 1][0]}), as measured by ESCHATON's lexicon. Otherwise NO.`,
          invalidation: `Wrong if the ${target} share ends at or below ${pct(f.threshold)}.`,
          baseRate: f.p.base, probability: f.p.persistence
        });
      }
      return Object.assign(f, {
        id: target + '/convergence',
        question: `Will ${f.threshold} or more themes run unusually high at once in ${target}?`,
        criteria: `Resolves YES if, in ${target}, at least ${f.threshold} themes each exceed their own 90th-percentile monthly share (training months) while appearing in ${F.MIN_ITEMS_HIGH}+ items. Otherwise NO.`,
        invalidation: `Wrong if fewer than ${f.threshold} themes run high in ${target}.`,
        baseRate: f.p.base, probability: f.p.persistence
      });
    });
    added.push(['forecast-batch', {
      target, horizon: `calendar month ${target} (UTC), resolved after ${monthEnd(target)}`,
      state: { month: curMonth, days: state[1], items: state[2], note: 'month to date when issued' },
      training: { from: train[0][0], to: train[train.length - 1][0], months: train.length },
      published: 'persistence',
      models: { base: 'long-run base rate', persistence: 'base rate given whether the theme was above its median in the state month', convergence: 'persistence, further split by whether 3+ themes ran high at once in the state month' },
      methodInvalidation: 'After 12 resolved months: if the momentum (persistence) model\'s mean Brier score is not below the base-rate model\'s, the momentum claim is refuted; if the convergence model does not beat momentum, the convergence signal adds no predictive value.',
      code: 'js/forecast.js', indexGenerated: ix.generated,
      forecasts: fs
    }]);
  } else console.log('Not enough data to issue forecasts for', target);
}

if (!added.length) { console.log('Registry: nothing due.'); process.exit(0); }
for (const [type, body] of added) {
  const e = R.append(reg, type, body);
  console.log(`+ #${e.seq} ${type} ${body.target} ${e.hash}`);
}
const v = R.verify(reg);
if (!v.ok) { console.error('Registry failed verification', JSON.stringify(v.bad)); process.exit(1); }
if (flag('--dry')) { console.log('(dry run, nothing written)'); process.exit(0); }
writeFileSync(regPath, JSON.stringify(reg, null, 1));
writeFileSync(new URL(`data/stamps/head-${String(reg.entries.length).padStart(5, '0')}.txt`, root), reg.head + '\n');
console.log('Registry head', reg.head);
