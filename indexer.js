/* Builds data/index.json from per-day results.
   dayResults: { 'YYYY-MM-DD': { n, c:[counts per archetype], r, f:[counts per family], hl:[...] } | null }
   Baseline statistics use 7-day pooled windows: sum of counts / sum of items over the 7 days ending that day. */
(function (root) {
  'use strict';
  const QP = [0, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.975, 0.99, 1];
  const FAMILIES = ['Abrahamic', 'Gnostic', 'Pagan', 'Eastern', 'Indigenous', 'Esoteric', 'Futurist'];
  const P90 = QP.indexOf(0.9);
  const MIN_ITEMS = 5; // days with fewer parsed items are treated as missing
  const MIN_HIGH = 2;  // items needed before a theme can count as running high

  function quant(values, qp) {
    const v = values.filter(x => x != null && !isNaN(x)).sort((a, b) => a - b);
    return qp.map(p => { if (!v.length) return 0; const pos = (v.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return +(v[lo] + (v[hi] - v[lo]) * (pos - lo)).toFixed(4); });
  }
  // Percentile rank (0–100) of x in a distribution summarised by quantile values q at probabilities qp.
  function rank(x, q, qp) {
    qp = qp || QP;
    if (x == null || !q) return null;
    if (x < q[0]) return 0;
    if (x > q[q.length - 1]) return 100;
    let lo = -1, hi = -1;
    for (let i = 0; i < q.length; i++) { if (q[i] === x) { if (lo < 0) lo = i; hi = i; } }
    if (lo >= 0) return Math.round(50 * (qp[lo] + qp[hi]));
    let i = 0; while (q[i + 1] < x) i++;
    return Math.round(100 * (qp[i] + (qp[i + 1] - qp[i]) * (x - q[i]) / (q[i + 1] - q[i])));
  }

  function windows(days, res, k, nA) {
    // pooled k-day window ending at each day; null if fewer than 4 usable days in the window
    const out = {};
    days.forEach((d, i) => {
      let n = 0, r = 0, used = 0; const c = new Array(nA).fill(0), f = new Array(7).fill(0);
      for (let j = Math.max(0, i - k + 1); j <= i; j++) {
        const x = res[days[j]]; if (!x || x.n < MIN_ITEMS) continue;
        used++; n += x.n; r += x.r; x.c.forEach((v, a) => c[a] += v); x.f.forEach((v, a) => f[a] += v);
      }
      out[d] = used >= Math.min(4, k) ? { n, r, c, f, used } : null;
    });
    return out;
  }

  function build(days, res, archetypes, opts) {
    opts = opts || {};
    const nA = archetypes.length;
    const bFrom = opts.baselineFrom || '2016-01-01', bTo = opts.baselineTo || '2025-12-31';
    const usable = d => res[d] && res[d].n >= MIN_ITEMS;
    const base = days.filter(d => d >= bFrom && d <= bTo && usable(d));
    // Baseline weeks are DISJOINT calendar blocks of 7 days starting at bFrom, so no news day is counted twice
    // and every baseline week is a separate observation (overlapping windows inflate the apparent sample).
    const t0 = Date.parse(bFrom + 'T00:00:00Z'), blocks = {};
    base.forEach(d => { const b = Math.floor((Date.parse(d + 'T00:00:00Z') - t0) / (7 * 864e5)); const x = res[d]; const o = blocks[b] || (blocks[b] = { n: 0, r: 0, dr: 0, used: 0, c: new Array(nA).fill(0), f: new Array(7).fill(0) }); o.used++; o.n += x.n; o.r += x.r; o.dr += x.dr || 0; x.c.forEach((v, a) => o.c[a] += v); x.f.forEach((v, a) => o.f[a] += v); });
    const baseW = Object.keys(blocks).map(Number).sort((a, b) => a - b).map(b => blocks[b]).filter(w => w.used >= 4);

    const daily = archetypes.map((a, i) => quant(base.map(d => res[d].c[i] / res[d].n), QP));
    const week = archetypes.map((a, i) => quant(baseW.map(w => w.c[i] / w.n), QP));
    const resonant7 = quant(baseW.map(w => w.r / w.n), QP);
    const load7 = quant(baseW.map(w => w.c.reduce((s, v) => s + v, 0) / w.n), QP);
    // A theme is 'running high' only if above its own 90th percentile AND carried by at least MIN_HIGH items,
    // so near-silent themes (normal week = 0 items) cannot be tipped over by a single item.
    const conv = w => w.c.filter((v, i) => v >= MIN_HIGH && v / w.n > week[i][P90]).length;
    const convHist = new Array(nA + 1).fill(0); baseW.forEach(w => convHist[conv(w)]++);
    const famHist = new Array(8).fill(0); baseW.forEach(w => famHist[w.f.filter(v => v > 0).length]++);

    const months = {};
    days.forEach(d => { const x = res[d]; if (!usable(d)) return; const m = d.slice(0, 7); const o = months[m] || (months[m] = { days: 0, n: 0, r: 0, dr: 0, hasDr: false, c: new Array(nA).fill(0), f: new Array(7).fill(0) }); o.days++; o.n += x.n; o.r += x.r; if (x.dr != null) { o.dr += x.dr; o.hasDr = true; } x.c.forEach((v, i) => o.c[i] += v); x.f.forEach((v, i) => o.f[i] += v); });
    const bItems = baseW.reduce((s, w) => s + w.n, 0), bDecoy = base.some(d => res[d].dr != null);
    const recentDays = days.slice(-(opts.recentDays || 120));
    const hl = {}; days.slice(-(opts.highlightDays || 10)).forEach(d => { if (res[d] && res[d].hl && res[d].hl.length) hl[d] = res[d].hl; });

    return {
      version: 1,
      generated: opts.generated || new Date().toISOString(),
      source: 'Wikipedia, Portal:Current events (CC BY-SA 4.0). Items scored individually by the ESCHATON engine.',
      archetypes: archetypes.map(a => a.id),
      families: FAMILIES,
      qp: QP,
      baseline: { rule: 'min2', windowing: 'disjoint', from: bFrom, to: bTo, days: base.length, windows: baseW.length, items: base.reduce((s, d) => s + res[d].n, 0), daily, week, resonant7, load7, convHist, famHist, control: bDecoy ? { realRate: baseW.reduce((s, w) => s + w.r, 0) / bItems, decoyRate: baseW.reduce((s, w) => s + w.dr, 0) / bItems } : null },
      months: Object.keys(months).sort().map(m => { const o = months[m], row = [m, o.days, o.n, o.c, o.r, o.f]; if (o.hasDr) row.push(o.dr); return row; }),
      recent: recentDays.filter(usable).map(d => [d, res[d].n, res[d].c, res[d].r, res[d].f]),
      start: opts.start || days[0],
      highlights: hl,
      coverage: { from: days[0], to: days[days.length - 1], usableDays: days.filter(usable).length, totalDays: days.length, items: days.filter(usable).reduce((s, d) => s + res[d].n, 0) }
    };
  }


  /* Long-run patterns per theme, from full months only.
     Yearly share = theme items / all items that year. Trend = Theil–Sen slope of yearly shares
     (median of all pairwise slopes, so one extreme year cannot drive it), relative to the theme's mean. */
  function trends(months, ids) {
    const full = months.filter(m => { const [y, mo] = m[0].split('-').map(Number); return m[1] >= new Date(Date.UTC(y, mo, 0)).getUTCDate() - 3; });
    const years = Array.from(new Set(full.map(m => m[0].slice(0, 4))));
    const median = v => { const s = v.slice().sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
    return ids.map((id, i) => {
      const yearly = years.map(y => { const ms = full.filter(m => m[0].startsWith(y)); const n = ms.reduce((s, m) => s + m[2], 0), c = ms.reduce((s, m) => s + m[3][i], 0); return { y, share: n ? c / n : 0, c, n }; });
      const v = yearly.map(x => x.share), mean = v.reduce((a, b) => a + b, 0) / v.length;
      const slopes = []; for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) slopes.push((v[b] - v[a]) / (b - a));
      const slope = mean ? median(slopes) / mean : 0;
      const k = Math.min(3, Math.floor(v.length / 3)), first = v.slice(0, k).reduce((a, b) => a + b, 0) / k, last = v.slice(-k).reduce((a, b) => a + b, 0) / k;
      const ratio = first ? last / first : (last ? Infinity : 1);
      const med = median(v), recentAbove = v.slice(-4).filter(x => x > med).length;
      const ms = full.map(m => m[3][i] / m[2]), mMed = median(ms), peak = Math.max.apply(null, ms);
      const peakMonth = full[ms.indexOf(peak)][0], spike = mMed ? peak / mMed : Infinity;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length), cv = mean ? sd / mean : 0;
      let kind;
      if (mean < 0.002) kind = 'rare';
      else if (slope >= 0.04 && ratio >= 1.4 && recentAbove >= 3) kind = 'rising';
      else if (slope <= -0.04 && ratio <= 0.7 && recentAbove <= 1) kind = 'fading';
      else if (spike >= 8 || cv >= 0.8) kind = 'waves';
      else if (cv < 0.4) kind = 'perennial';
      else kind = 'mixed';
      const recordYear = yearly.length > 1 && v[v.length - 1] >= Math.max.apply(null, v.slice(0, -1));
      return { id, k: i, kind, yearly, typical: mMed, mean, slope, ratio, first, last, firstYears: years.slice(0, k), lastYears: years.slice(-k), peak, peakMonth, spike, cv, recordYear };
    });
  }

  // Non-overlapping monthly comparison. Calendar months never overlap, so each baseline month is a separate
  // observation. Works from the shipped months table alone (no daily data needed).
  const MIN_HIGH_MONTH = 3;
  function monthly(months, ids, opts) {
    opts = opts || {};
    const bFrom = (opts.baselineFrom || '2016-01').slice(0, 7), bTo = (opts.baselineTo || '2025-12').slice(0, 7);
    const full = m => { const [y, mo] = m[0].split('-').map(Number); return m[1] >= new Date(Date.UTC(y, mo, 0)).getUTCDate() - 3; };
    const sh = (m, i) => m[2] ? m[3][i] / m[2] : 0;
    const base = months.filter(m => m[0] >= bFrom && m[0] <= bTo && full(m));
    const p90 = ids.map((id, i) => quant(base.map(m => sh(m, i)), [0.9])[0]);
    const high = m => ids.map((id, i) => i).filter(i => m[3][i] >= MIN_HIGH_MONTH && sh(m, i) > p90[i]);
    const hist = new Array(ids.length + 1).fill(0); base.forEach(m => hist[high(m).length]++);
    const pct = k => { const tot = base.length; let below = 0; for (let i = 0; i < k; i++) below += hist[i]; return tot ? Math.round(100 * (below + hist[k] / 2) / tot) : null; };
    const atLeast = k => base.length ? hist.slice(k).reduce((a, b) => a + b, 0) / base.length : null;
    const rows = months.map(m => { const h = high(m); return { m: m[0], days: m[1], n: m[2], partial: !full(m), conv: h.length, high: h.map(i => ids[i]), pct: pct(h.length), atLeast: atLeast(h.length) }; });
    return { from: bFrom, to: bTo, months: base.length, minItems: MIN_HIGH_MONTH, p90, hist, rows };
  }

  const api = { QP, FAMILIES, MIN_ITEMS, MIN_HIGH, quant, rank, windows, build, trends, monthly, MIN_HIGH_MONTH };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EschatonIndexer = api;
})(typeof window !== 'undefined' ? window : this);
