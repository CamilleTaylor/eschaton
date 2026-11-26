// Turns a GitHub issue (filed with .github/ISSUE_TEMPLATE/prediction.yml) into a registry entry.
// Run by .github/workflows/registry.yml. Inputs come from environment variables, never from the shell:
//   ISSUE_BODY, ISSUE_NUMBER, ISSUE_USER, ISSUE_CREATED, ISSUE_URL
// Writes the new hash to $GITHUB_OUTPUT (hash, seq, error) so the workflow can reply on the issue.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../js/registry.js');
const root = new URL('../', import.meta.url);
const out = (k, v) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}<<EOF_ESCHATON\n${v}\nEOF_ESCHATON\n`); else console.log(k + ':', v); };
const fail = msg => { out('error', msg); console.error(msg); process.exit(0); };

// Issue forms render as "### Label\n\nvalue" blocks.
export function parseForm(body) {
  const f = {}; const parts = String(body || '').replace(/\r/g, '').split(/^###\s+/m).slice(1);
  for (const p of parts) { const nl = p.indexOf('\n'); const k = p.slice(0, nl).trim().toLowerCase(); let v = p.slice(nl + 1).trim(); if (v === '_No response_') v = ''; f[k] = v; }
  return f;
}
const clip = (s, n) => String(s || '').slice(0, n).trim();

const env = process.env;
if (!env.ISSUE_BODY) fail('No issue body.');
const f = parseForm(env.ISSUE_BODY);
const claim = clip(f['prediction'], 1000), criteria = clip(f['how it resolves'], 1500), resolveBy = clip(f['resolve by'], 10);
if (!claim || !criteria) fail('The prediction and "How it resolves" fields are both required.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(resolveBy) || isNaN(Date.parse(resolveBy))) fail('"Resolve by" must be a date written YYYY-MM-DD.');
if (resolveBy <= (env.ISSUE_CREATED || new Date().toISOString()).slice(0, 10)) fail('"Resolve by" must be in the future: a prediction has to be registered before its outcome is known.');
const prob = f['probability (0-100)'] ? Number(String(f['probability (0-100)']).replace('%', '')) : null;
if (prob != null && !(prob >= 0 && prob <= 100)) fail('Probability must be a number from 0 to 100.');
const base = f['base rate (0-100, optional)'] ? Number(String(f['base rate (0-100, optional)']).replace('%', '')) : null;

const regPath = new URL('data/registry.json', root);
const reg = existsSync(regPath) ? JSON.parse(readFileSync(regPath, 'utf8')) : { about: 'ESCHATON public prediction registry. Append-only, hash-chained; verify with js/registry.js. Do not edit by hand.', entries: [], head: R.GENESIS };
if (reg.entries.some(e => e.type === 'claim' && e.body.issue === Number(env.ISSUE_NUMBER))) fail('This issue is already registered.');
const e = R.append(reg, 'claim', {
  claim, criteria, resolveBy,
  probability: prob == null || isNaN(prob) ? null : prob / 100,
  baseRate: base == null || isNaN(base) ? null : base / 100,
  invalidation: clip(f['what would prove it wrong'], 1000) || null,
  prophecy: clip(f['related prophecy (optional)'], 80) || null,
  evidence: clip(f['reasoning or sources (optional)'], 2000) || null,
  madeBy: '@' + clip(env.ISSUE_USER, 60), issue: Number(env.ISSUE_NUMBER), url: clip(env.ISSUE_URL, 300)
});
if (!R.verify(reg).ok) fail('Registry failed verification; nothing written.');
writeFileSync(regPath, JSON.stringify(reg, null, 1));
writeFileSync(new URL(`data/stamps/head-${String(e.seq).padStart(5, '0')}.txt`, root), reg.head + '\n');
out('hash', e.hash); out('seq', String(e.seq)); out('issued', e.issued);
