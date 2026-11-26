/* ESCHATON alignment engine.
   Deterministic, transparent heuristics. Nothing here is a probability.
   Runs in the browser (window.EschatonEngine) and in Node (module.exports). */
(function (root) {
  'use strict';

  /* ---------- text basics ---------- */
  function normalize(text) {
    return String(text || '').toLowerCase()
      .replace(/[‘’ʼ']/g, '')
      .replace(/[^a-z0-9À-ɏ]+/g, ' ').trim();
  }
  function stem(w) {
    if (w.length <= 3 || /^\d+$/.test(w)) return w;
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    if (/(sses|shes|ches|xes)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) return w;
    if (w.endsWith('s')) return w.slice(0, -1);
    return w;
  }
  function stemPhrase(p) { return normalize(p).split(' ').filter(Boolean).map(stem).join(' '); }

  /* ---------- negation ---------- */
  const PRE_CUES = new Set(['no', 'not', 'never', 'neither', 'nor', 'without', 'none', 'nothing', 'nobody', 'noone',
    'deny', 'denies', 'denied', 'denying', 'reject', 'rejects', 'rejected', 'refute', 'refutes', 'refuted',
    'dismiss', 'dismisses', 'dismissed', 'debunk', 'debunks', 'debunked', 'disproved', 'cannot',
    'isnt', 'arent', 'wasnt', 'werent', 'dont', 'doesnt', 'didnt', 'wont', 'wouldnt', 'cant', 'couldnt', 'shouldnt', 'hasnt', 'havent', 'hadnt']);
  const EMPHATIC_NEXT = { not: ['only', 'just'], never: ['before'], nothing: ['but'], no: ['doubt', 'wonder'] };
  const RULE_OUT = ['ruled out', 'rules out', 'rule out', 'ruling out', 'no longer'];
  const POST_CUES = ['is false', 'are false', 'was false', 'were false', 'proved false', 'proven false', 'is untrue', 'are untrue', 'was untrue', 'were untrue',
    'is unfounded', 'are unfounded', 'was unfounded', 'were unfounded', 'is baseless', 'are baseless', 'was debunked', 'were debunked', 'has been debunked', 'have been debunked',
    'is not true', 'are not true', 'was not true', 'did not happen', 'never happened'];
  const BREAK_WORDS = new Set(['but', 'however', 'although', 'though', 'whereas', 'yet', 'while', 'when', 'after', 'because', 'since', 'meanwhile', 'instead']);

  function negateClause(words, neg) {
    const str = ' ' + words.join(' ') + ' ';
    const posOf = at => str.slice(1, at).split(' ').filter(Boolean).length;
    for (const pc of POST_CUES) { const at = str.indexOf(' ' + pc + ' '); if (at !== -1) for (let i = 0; i < posOf(at); i++) neg[i] = true; }
    for (const rc of RULE_OUT) { const at = str.indexOf(' ' + rc + ' '); if (at !== -1) for (let i = posOf(at) + rc.split(' ').length; i < words.length; i++) neg[i] = true; }
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (!PRE_CUES.has(w)) continue;
      if (EMPHATIC_NEXT[w] && EMPHATIC_NEXT[w].indexOf(words[i + 1]) !== -1) { i++; continue; }
      for (let j = i + 1; j < words.length; j++) neg[j] = true;
      break;
    }
  }

  /* ---------- proper nouns ----------
     A capitalized word that is not sentence-initial is treated as part of a name, so
     "Mark Carney" or "Miami Heat" never triggers the archetypes for 'mark' or 'heat'.
     Sentence-initial words count as names only when the next word is also capitalized.
     Short all-caps acronyms (AI, UN, CBDC) count as ordinary words.
     Lexicon terms written with a capital letter ("Euphrates", "Ebola") are names and may match names. */
  const GENERIC_HEADS = new Set(['hurricane', 'typhoon', 'cyclone', 'storm', 'tropical', 'earthquake', 'war', 'battle', 'siege', 'flood', 'floods',
    'wildfire', 'wildfires', 'pandemic', 'epidemic', 'outbreak', 'famine', 'drought', 'massacre', 'coup', 'crisis', 'invasion', 'offensive', 'insurgency', 'eruption']);
  const isCap = s => /^[A-ZÀ-Þ]/.test(s);
  const isAcronym = s => s.length <= 5 && /^[A-Z0-9]+$/.test(s) && /[A-Z]/.test(s);

  function tokenize(text) {
    const raw = String(text || '');
    const re = /[A-Za-zÀ-ɏ0-9]+(?:['’][A-Za-z]+)?/g;
    const toks = []; let m, last = 0;
    while ((m = re.exec(raw))) {
      const gap = raw.slice(last, m.index);
      toks.push({ raw: m[0], w: normalize(m[0]), sentStart: toks.length === 0 || /[.!?\n]/.test(gap), brk: toks.length === 0 || /[.;:!?\n—]/.test(gap) });
      last = m.index + m[0].length;
    }
    const alpha = toks.filter(t => /[a-z]/i.test(t.raw) && t.raw.length > 3);
    const titleCase = alpha.length >= 4 && alpha.filter(t => isCap(t.raw)).length / alpha.length >= 0.7;
    toks.forEach((t, i) => {
      if (titleCase || !isCap(t.raw) || isAcronym(t.raw) || GENERIC_HEADS.has(t.w)) { t.proper = false; return; }
      const next = toks[i + 1];
      t.proper = !t.sentStart || !!(next && !next.sentStart && isCap(next.raw) && !isAcronym(next.raw));
    });
    return toks;
  }

  function subIndex(stems, keep) {
    const arr = stems.map((s, i) => keep(i) ? s : '~');
    return { set: new Set(arr), str: ' ' + arr.join(' ') + ' ' };
  }

  function buildIndex(text) {
    const toks = tokenize(text);
    // clauses
    let clause = [];
    const flush = () => { if (!clause.length) return; const neg = clause.map(() => false); negateClause(clause.map(t => t.w), neg); clause.forEach((t, i) => { t.neg = neg[i]; }); clause = []; };
    toks.forEach(t => { if (t.brk || BREAK_WORDS.has(t.w)) { flush(); t.clauseStart = true; } clause.push(t); });
    flush();
    const stems = [];
    toks.forEach(t => { if (t.clauseStart && stems.length) stems.push('|'); t.si = stems.length; stems.push(stem(t.w)); });
    const tokAt = []; toks.forEach(t => { tokAt[t.si] = t; });
    const ok = i => tokAt[i] && !tokAt[i].neg;
    return {
      raw: String(text || ''), words: toks.map(t => t.w),
      common: subIndex(stems, i => ok(i) && !tokAt[i].proper),
      all: subIndex(stems, ok),
      neg: { all: subIndex(stems, i => tokAt[i] && tokAt[i].neg) },
      negatedWords: toks.filter(t => t.neg).map(t => t.w),
      properWords: toks.filter(t => t.proper && !t.neg).map(t => t.raw)
    };
  }

  const phraseCache = new Map();
  function hasTerm(idx, term) {
    let s = phraseCache.get(term);
    if (s === undefined) { s = stemPhrase(term); phraseCache.set(term, s); }
    if (!s) return false;
    const sub = /[A-Z]/.test(term) || !idx.common ? idx.all : idx.common;
    return s.indexOf(' ') === -1 ? sub.set.has(s) : sub.str.indexOf(' ' + s + ' ') !== -1;
  }
  function hits(idx, terms) {
    const out = [], seen = new Set();
    for (const t of terms || []) {
      const k = stemPhrase(t);
      if (!seen.has(k) && hasTerm(idx, t)) { seen.add(k); out.push(t); }
    }
    return out;
  }

  /* ---------- archetypes ---------- */
  function eventVector(idx, archetypes) {
    const vec = {}, matched = {}, negated = {};
    for (const a of archetypes) {
      const h = hits(idx, a.terms);
      if (h.length) { vec[a.id] = 1 - Math.exp(-0.9 * h.length); matched[a.id] = h; }
      const n = hits(idx.neg, a.terms).filter(t => h.indexOf(t) === -1);
      if (n.length) negated[a.id] = n;
    }
    return { vec: vec, matched: matched, negated: negated, negatedWords: idx.negatedWords, properWords: idx.properWords };
  }
  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (const k in a) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
    for (const k in b) nb += b[k] * b[k];
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  /* ---------- prophecy scoring ---------- */
  const VERDICTS = {
    none: { label: 'No real match', note: 'Too little in common to compare.' },
    symbolic: { label: 'Loose resemblance', note: 'Shares a theme, but nothing concrete. Almost any event resembles something this loosely.' },
    thematic: { label: 'Some overlap', note: 'Shares themes and at least one concrete detail. Still a match found after the fact, not a prediction.' },
    specific: { label: 'Close match', note: 'Several concrete details line up with a well-sourced text. Interesting, but not proof that anyone foresaw it.' }
  };
  function verdictFor(T, PW) { return T < 20 ? 'none' : PW < 20 ? 'symbolic' : PW < 40 ? 'thematic' : 'specific'; }

  function scoreProphecy(p, idx, ev) {
    const kw = hits(idx, p.keywords);
    const cos = cosine(ev.vec, p.archetypes || {});
    const thematic = Math.round(100 * (0.65 * cos + 0.35 * Math.min(1, kw.length / 3)));
    const markers = (p.markers || []).map(m => { const h = hits(idx, m.terms); return { label: m.label, hit: h.length > 0, terms: h }; });
    const mHit = markers.filter(m => m.hit).length;
    const frac = markers.length ? mHit / markers.length : 0;
    const specificity = Math.round(20 * p.specificity.score * (0.15 + 0.85 * frac));
    const evidence = 20 * p.evidence.score;
    const contradictions = (p.contradictions || []).map(c => { const h = hits(idx, c.terms); return { note: c.note, terms: h, hit: h.length > 0 }; }).filter(c => c.hit);
    const unmet = (p.preconditions || []).filter(c => hits(idx, c.terms).length === 0).map(c => ({ note: c.note }));
    const penalty = Math.min(45, contradictions.length * 15 + unmet.length * 6);
    const predictive = Math.max(0, Math.round((thematic / 100) * Math.sqrt(specificity * evidence) - penalty));
    const shared = Object.keys(ev.vec).filter(k => p.archetypes && p.archetypes[k]).sort((a, b) => ev.vec[b] * p.archetypes[b] - ev.vec[a] * p.archetypes[a]);
    const affirmed = kw.concat.apply(kw, markers.map(m => m.terms));
    const pool = (p.keywords || []).concat.apply(p.keywords || [], (p.markers || []).map(m => m.terms));
    const negated = hits(idx.neg, pool).filter(t => affirmed.indexOf(t) === -1);
    return { id: p.id, prophecy: p, thematic, specificity, evidence, penalty, predictive, cosine: cos, keywords: kw, markers, markersHit: mHit, contradictions, unmet, shared, negated, verdict: verdictFor(thematic, predictive) };
  }

  function align(text, prophecies, archetypes) {
    const idx = buildIndex(text);
    const ev = eventVector(idx, archetypes);
    return { text: text, words: idx.words.length, event: ev, results: prophecies.map(p => scoreProphecy(p, idx, ev)) };
  }

  /* Several events, scored one at a time, then aggregated per prophecy:
     the strongest single event carries the scores; 'support' counts how many events resonate. */
  function splitEvents(text) {
    return String(text || '').split(/\n+/).map(s => s.replace(/^[\s*\-•\d.)]+/, '').trim()).filter(s => s.length > 2);
  }
  function alignBatch(lines, prophecies, archetypes) {
    const each = lines.map(t => align(t, prophecies, archetypes));
    const shareVec = {}, matched = {}, negated = {};
    each.forEach(r => {
      Object.keys(r.event.vec).forEach(k => { shareVec[k] = (shareVec[k] || 0) + 1 / each.length; (matched[k] = matched[k] || []).push.apply(matched[k], r.event.matched[k]); });
      Object.keys(r.event.negated).forEach(k => { (negated[k] = negated[k] || []).push.apply(negated[k], r.event.negated[k]); });
    });
    Object.keys(matched).forEach(k => matched[k] = Array.from(new Set(matched[k])));
    Object.keys(negated).forEach(k => negated[k] = Array.from(new Set(negated[k])));
    const results = prophecies.map((p, i) => {
      const per = each.map((r, j) => Object.assign({ line: j }, r.results[i]));
      const best = per.slice().sort((a, b) => (b.predictive - a.predictive) || (b.thematic - a.thematic))[0];
      return Object.assign({}, best, { batch: { total: each.length, support: per.filter(x => x.thematic >= 20).length, lineText: lines[best.line] } });
    });
    return { text: lines.join('\n'), lines: lines, words: each.reduce((s, r) => s + r.words, 0), batch: true, event: { vec: shareVec, matched, negated, negatedWords: [], properWords: [] }, results };
  }

  function sortResults(results, by) {
    const key = by === 'symbolic' ? 'thematic' : 'predictive', alt = key === 'thematic' ? 'predictive' : 'thematic';
    return results.slice().sort((a, b) => (b[key] - a[key]) || (b[alt] - a[alt]));
  }

  /* ---------- daily index ----------
     Each news item is scored on its own. A day's share for an archetype is the fraction
     of that day's items carrying it. Items are never concatenated. */
  function itemArchetypes(text, archetypes) {
    const ev = eventVector(buildIndex(text), archetypes);
    return Object.keys(ev.vec);
  }
  function dayCounts(items, archetypes) {
    const counts = archetypes.map(() => 0);
    const pos = {}; archetypes.forEach((a, i) => pos[a.id] = i);
    items.forEach(t => itemArchetypes(t, archetypes).forEach(id => counts[pos[id]]++));
    return { n: items.length, c: counts };
  }
  function quantiles(values, steps) {
    const v = values.slice().sort((a, b) => a - b), out = [];
    for (let i = 0; i <= steps; i++) { const pos = (v.length - 1) * i / steps, lo = Math.floor(pos), hi = Math.ceil(pos); out.push(v.length ? +(v[lo] + (v[hi] - v[lo]) * (pos - lo)).toFixed(4) : 0); }
    return out;
  }
  // Percentile rank (0–100) of x within a baseline given as 101 quantiles.
  function percentileOf(x, q) {
    if (!q || !q.length) return null;
    if (x <= q[0]) return 0;
    if (x >= q[q.length - 1]) return 100;
    let lo = 0; while (lo < q.length - 1 && q[lo + 1] < x) lo++;
    let hi = lo + 1; while (hi < q.length - 1 && q[hi + 1] <= x) hi++;
    // ties: report the middle of the tied block
    if (q[hi] === x) { let a = hi; while (a > 0 && q[a - 1] === x) a--; return Math.round(((a + hi) / 2) * 100 / (q.length - 1)); }
    return Math.round((lo + (x - q[lo]) / (q[lo + 1] - q[lo])) * 100 / (q.length - 1));
  }

  const api = { normalize, stem, stemPhrase, tokenize, buildIndex, hasTerm, hits, eventVector, cosine, scoreProphecy, align, alignBatch, splitEvents, sortResults, VERDICTS, verdictFor, itemArchetypes, dayCounts, quantiles, percentileOf };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EschatonEngine = api;
})(typeof window !== 'undefined' ? window : this);
