/* ESCHATON forecasting engine.
   Issues falsifiable monthly forecasts from the theme index and scores them with Brier scores.
   Three competing models, so we can test whether "archetypal convergence" adds anything:
     base        : the long-run base rate only
     persistence : base rate conditioned on last month's state (ordinary momentum)
     convergence : persistence plus whether last month had many themes running high at once
   Everything is computed from months strictly before the forecast month (no look-ahead). */
(function (root) {
  'use strict';
  const MIN_SHARE = 0.005;   // themes averaging under 0.5% of news are too thin to forecast monthly
  const MIN_ITEMS_HIGH = 3;  // a theme needs >= 3 items in a month to count as running high
  const CONV_HIGH = 3;       // "high convergence" month: 3+ themes running high at once
  const FIRST_TEST = '2019-01';

  const share = (m, i) => m[2] ? m[3][i] / m[2] : 0;
  const median = v => { const s = v.slice().sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const pctl = (v, p) => { const s = v.slice().sort((a, b) => a - b); const pos = (s.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return s[lo] + (s[hi] - s[lo]) * (pos - lo); };
  const rate = (hits, n) => (hits + 1) / (n + 2); // Laplace-smoothed proportion

  function fullMonths(months) {
    return months.filter(m => { const [y, mo] = m[0].split('-').map(Number); return m[1] >= new Date(Date.UTC(y, mo, 0)).getUTCDate() - 3; });
  }

  // Everything a forecaster is allowed to know, computed from training months only.
  function fit(train, ids) {
    const themes = ids.map((id, i) => ({ id, i, mean: train.reduce((s, m) => s + share(m, i), 0) / train.length })).filter(t => t.mean >= MIN_SHARE);
    const thr = {}, p90 = {};
    ids.forEach((id, i) => { const v = train.map(m => share(m, i)); thr[id] = median(v); p90[id] = pctl(v, 0.9); });
    const conv = m => ids.filter((id, i) => m[3][i] >= MIN_ITEMS_HIGH && share(m, i) > p90[id]).length;
    const convs = train.map(conv);
    const tbl = {};
    themes.forEach(t => {
      const o = { all: [0, 0], prev: { 0: [0, 0], 1: [0, 0] }, pc: { '00': [0, 0], '01': [0, 0], '10': [0, 0], '11': [0, 0] } };
      for (let j = 1; j < train.length; j++) {
        const y = share(train[j], t.i) > thr[t.id] ? 1 : 0, s = share(train[j - 1], t.i) > thr[t.id] ? 1 : 0, c = convs[j - 1] >= CONV_HIGH ? 1 : 0;
        o.all[0] += y; o.all[1]++; o.prev[s][0] += y; o.prev[s][1]++; o.pc['' + s + c][0] += y; o.pc['' + s + c][1]++;
      }
      tbl[t.id] = o;
    });
    const ct = { all: [0, 0], prev: { 0: [0, 0], 1: [0, 0] } };
    for (let j = 1; j < train.length; j++) { const y = convs[j] >= CONV_HIGH ? 1 : 0, s = convs[j - 1] >= CONV_HIGH ? 1 : 0; ct.all[0] += y; ct.all[1]++; ct.prev[s][0] += y; ct.prev[s][1]++; }
    return { themes, thr, p90, conv, tbl, ct };
  }

  // Forecasts for the month after `last`, using a model fitted on `train` (which ends with `last`).
  // `state` is the month whose level conditions the forecast (default: last training month). Live forecasts are
  // issued a few days before month end, so the state is the current month to date.
  function issue(train, ids, target, state) {
    const F = fit(train, ids), last = state || train[train.length - 1], lastConv = F.conv(last), c = lastConv >= CONV_HIGH ? 1 : 0;
    const out = F.themes.map(t => {
      const s = share(last, t.i) > F.thr[t.id] ? 1 : 0, o = F.tbl[t.id];
      return {
        kind: 'theme', theme: t.id, target, threshold: +F.thr[t.id].toFixed(5),
        event: 'above-median',
        lastState: s, lastValue: +share(last, t.i).toFixed(5),
        p: { base: +rate(o.all[0], o.all[1]).toFixed(3), persistence: +rate(o.prev[s][0], o.prev[s][1]).toFixed(3), convergence: +rate(o.pc['' + s + c][0], o.pc['' + s + c][1]).toFixed(3) }
      };
    });
    out.push({
      kind: 'convergence', target, threshold: CONV_HIGH, event: 'high-convergence', lastState: c, lastCount: lastConv,
      p: { base: +rate(F.ct.all[0], F.ct.all[1]).toFixed(3), persistence: +rate(F.ct.prev[c][0], F.ct.prev[c][1]).toFixed(3), convergence: +rate(F.ct.prev[c][0], F.ct.prev[c][1]).toFixed(3) },
      p90: Object.fromEntries(Object.entries(F.p90).map(([k, v]) => [k, +v.toFixed(5)]))
    });
    return out;
  }

  function outcome(f, month, ids) {
    if (!month) return null;
    if (f.kind === 'theme') { const i = ids.indexOf(f.theme); return { y: share(month, i) > f.threshold ? 1 : 0, value: +share(month, i).toFixed(5) }; }
    const n = ids.filter((id, i) => month[3][i] >= MIN_ITEMS_HIGH && share(month, i) > f.p90[id]).length;
    return { y: n >= f.threshold ? 1 : 0, value: n };
  }

  // Rolling-origin backtest: for each month from FIRST_TEST, fit on all earlier full months and forecast it.
  function backtest(months, ids) {
    const full = fullMonths(months), rows = [];
    for (let k = 0; k < full.length; k++) {
      if (full[k][0] < FIRST_TEST) continue;
      const fs = issue(full.slice(0, k), ids, full[k][0]);
      fs.forEach(f => { const o = outcome(f, full[k], ids); rows.push(Object.assign({}, f, o)); });
    }
    const models = ['base', 'persistence', 'convergence'];
    const score = list => { const r = {}; models.forEach(m => r[m] = list.length ? list.reduce((s, x) => s + (x.p[m] - x.y) ** 2, 0) / list.length : null); return r; };
    const themeRows = rows.filter(r => r.kind === 'theme'), convRows = rows.filter(r => r.kind === 'convergence');
    const skill = (b, ref) => ref ? 1 - b / ref : null;
    const sT = score(themeRows), sC = score(convRows);
    // calibration of the persistence model (theme forecasts), in probability bins
    const bins = [0, 0.2, 0.4, 0.6, 0.8, 1.0001].slice(0, -1).map((lo, i, a) => { const hi = [0.2, 0.4, 0.6, 0.8, 1.0001][i]; const sel = themeRows.filter(r => r.p.persistence >= lo && r.p.persistence < hi); return { lo, hi: Math.min(hi, 1), n: sel.length, forecast: sel.length ? sel.reduce((s, r) => s + r.p.persistence, 0) / sel.length : null, observed: sel.length ? sel.reduce((s, r) => s + r.y, 0) / sel.length : null }; });
    return {
      from: FIRST_TEST, to: full[full.length - 1][0], months: convRows.length,
      theme: { n: themeRows.length, brier: sT, skillPersistence: skill(sT.persistence, sT.base), skillConvergence: skill(sT.convergence, sT.persistence) },
      convergence: { n: convRows.length, brier: sC, skillPersistence: skill(sC.persistence, sC.base) },
      calibration: bins
    };
  }

  const api = { MIN_SHARE, MIN_ITEMS_HIGH, CONV_HIGH, FIRST_TEST, fullMonths, fit, issue, outcome, backtest };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EschatonForecast = api;
})(typeof window !== 'undefined' ? window : this);
