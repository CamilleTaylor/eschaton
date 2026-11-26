// Records the outcome of a registered claim as a new registry entry (the original is never edited).
// Run from the Actions tab: "Prediction registry" > Run workflow > fill seq, outcome, evidence.
// Only people with write access to the repository can run it.
//   SEQ=3 OUTCOME=failed EVIDENCE="https://..." node tools/resolve.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../js/registry.js');
const root = new URL('../', import.meta.url);
const regPath = new URL('data/registry.json', root);
const reg = JSON.parse(readFileSync(regPath, 'utf8'));
const seq = Number(process.env.SEQ), outcome = String(process.env.OUTCOME || ''), evidence = String(process.env.EVIDENCE || '').slice(0, 2000).trim();
const target = reg.entries.find(e => e.seq === seq);
if (!target || target.type !== 'claim') { console.error('No claim with seq ' + seq); process.exit(1); }
if (!['supported', 'failed', 'inconclusive'].includes(outcome)) { console.error('OUTCOME must be supported, failed or inconclusive'); process.exit(1); }
if (!evidence) { console.error('EVIDENCE is required: say what happened and link a source'); process.exit(1); }
const y = outcome === 'supported' ? 1 : outcome === 'failed' ? 0 : null;
const p = target.body.probability;
const body = { of: target.hash, ofSeq: seq, outcome, evidence, brier: y == null || p == null ? null : R.brier(p, y), baseBrier: y == null || target.body.baseRate == null ? null : R.brier(target.body.baseRate, y), resolvedBy: process.env.ACTOR ? '@' + process.env.ACTOR : null };
const e = R.append(reg, 'resolution', body);
if (!R.verify(reg).ok) { console.error('verification failed'); process.exit(1); }
writeFileSync(regPath, JSON.stringify(reg, null, 1));
writeFileSync(new URL(`data/stamps/head-${String(e.seq).padStart(5, '0')}.txt`, root), reg.head + '\n');
console.log(`+ #${e.seq} resolution of #${seq}: ${outcome} ${e.hash}`);
