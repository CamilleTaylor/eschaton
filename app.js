/* ESCHATON app shell: data loading, views, ledger, drawer. */
{
  const E = window.EschatonEngine;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TXT = s => esc(s) + '︎';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  const KEY_LEDGER = 'eschaton.ledger.v1', KEY_EVENT = 'eschaton.lastEvent';
  const FAMILIES = ['Abrahamic', 'Gnostic', 'Pagan', 'Eastern', 'Indigenous', 'Esoteric', 'Futurist'];
  const FAM_COLOR = { Abrahamic: '#b69cff', Gnostic: '#f39bd8', Pagan: '#ffb27a', Eastern: '#7fd8c8', Indigenous: '#9fd17a', Esoteric: '#ffd86b', Futurist: '#6fb8ff' };
  const FAM_LABEL = { Futurist: 'Modern futurist' };
  const STATUSES = ['pending', 'supported', 'failed', 'inconclusive'];
  const STATUS_LABEL = { pending: 'Pending', supported: 'Supported', failed: 'Failed', inconclusive: 'Inconclusive' };
  const EXAMPLES = [
    ['Euphrates running low', 'Drought and upstream dams push the Euphrates to record low water levels'],
    ['AI outperforms experts', 'A new AI system outperforms human experts as labs race to build self-improving models'],
    ['Mandatory digital ID', 'Government pilots a mandatory digital ID tied to a central bank digital currency'],
    ['War, prices, pandemic', 'War spreads while food prices soar and a new pandemic outbreak is declared'],
    ['Record heat and fires', 'Record heat and wildfires as scientists warn of climate tipping points and resource depletion'],
    ['White buffalo calf', 'A white buffalo calf is born'],
    ['Skyscraper race', 'Gulf states compete to build the world\'s tallest skyscraper'],
    ['Quake as end-time sign', 'Preachers call a major earthquake a sign that the end of the world is near']
  ];

  const S = { P: [], A: [], seed: [], user: [], byId: {}, arch: {}, sort: 'predictive', showAll: false, last: null, libFam: null, libQ: '', ledFilter: 'all', netHidden: new Set(), graph: null };
  const famChip = f => '<span class="fam" style="--c:' + FAM_COLOR[f] + '"><span class="dot"></span>' + esc(FAM_LABEL[f] || f) + '</span>';
  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------- data ---------- */
  async function load() {
    try {
      const get = n => fetch('data/' + n + '.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(n); return r.json(); });
      const B = window.ESCHATON_DATA || {}, opt = n => (n in B && B[n] === null ? Promise.resolve(null) : get(n).catch(() => B[n] || null));
      const [p, a, l, ix, reg, lr, cfg] = await Promise.all([get('prophecies'), get('archetypes'), get('ledger'), opt('index'), opt('registry'), opt('longrange'), get('config').catch(() => null)]);
      return { prophecies: p, archetypes: a, ledger: l, index: ix, registry: reg, longrange: lr, config: cfg };
    } catch (e) {
      if (window.ESCHATON_DATA) return window.ESCHATON_DATA;
      throw e;
    }
  }

  /* ---------- starfield ---------- */
  function sky() {
    const c = $('#sky'), x = c.getContext('2d');
    const draw = () => {
      const d = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
      c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, W, H);
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const n = Math.round(W * H / 4200);
      for (let i = 0; i < n; i++) {
        const r = rnd() < 0.93 ? rnd() * 0.9 + 0.2 : rnd() * 1.4 + 0.9, a = rnd() * 0.7 + 0.15;
        x.fillStyle = rnd() < 0.25 ? 'rgba(205,186,255,' + a + ')' : 'rgba(235,240,255,' + a + ')';
        x.beginPath(); x.arc(rnd() * W, rnd() * H, r, 0, 7); x.fill();
      }
    };
    draw(); let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
  }

  /* ---------- astrolabe ---------- */
  const astro = { nodes: [] };
  function buildAstro() {
    const svg = $('#astro'), cx = 200, cy = 200, n = S.A.length;
    let h = '<defs><radialGradient id="coreGrad"><stop offset="0" stop-color="#7b5cff" stop-opacity=".9"/><stop offset=".6" stop-color="#3a2596" stop-opacity=".6"/><stop offset="1" stop-color="#07051a" stop-opacity="0"/></radialGradient></defs>';
    h += '<circle class="astro-ring" cx="200" cy="200" r="192"/><circle class="astro-ring" cx="200" cy="200" r="178"/>';
    for (let i = 0; i < 72; i++) { const t = i * Math.PI / 36, r1 = i % 6 ? 184 : 178; h += '<line class="astro-tick" x1="' + (cx + r1 * Math.cos(t)).toFixed(1) + '" y1="' + (cy + r1 * Math.sin(t)).toFixed(1) + '" x2="' + (cx + 192 * Math.cos(t)).toFixed(1) + '" y2="' + (cy + 192 * Math.sin(t)).toFixed(1) + '"/>'; }
    h += '<g class="astro-spin"><g class="astro-geo">';
    const tri = o => { let d = ''; for (let k = 0; k < 3; k++) { const t = o + k * 2 * Math.PI / 3; d += (k ? 'L' : 'M') + (cx + 118 * Math.cos(t)).toFixed(1) + ' ' + (cy + 118 * Math.sin(t)).toFixed(1); } return '<path d="' + d + 'Z"/>'; };
    h += tri(-Math.PI / 2) + tri(Math.PI / 2) + '<circle cx="200" cy="200" r="118"/><circle cx="200" cy="200" r="59"/>';
    for (let k = 0; k < 6; k++) { const t = k * Math.PI / 3; h += '<circle cx="' + (cx + 59 * Math.cos(t)).toFixed(1) + '" cy="' + (cy + 59 * Math.sin(t)).toFixed(1) + '" r="59"/>'; }
    h += '</g></g><g id="astro-rays"></g>';
    astro.nodes = S.A.map((a, i) => { const t = -Math.PI / 2 + i * 2 * Math.PI / n; return { id: a.id, x: cx + 152 * Math.cos(t), y: cy + 152 * Math.sin(t) }; });
    astro.nodes.forEach((p, i) => { const a = S.A[i]; h += '<g class="astro-node" data-id="' + esc(a.id) + '"><title>' + esc(a.label) + '</title><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="13"/><text x="' + p.x.toFixed(1) + '" y="' + (p.y + 4.5).toFixed(1) + '" text-anchor="middle">' + TXT(a.glyph) + '</text></g>'; });
    h += '<circle class="astro-core" cx="200" cy="200" r="58"/><text class="astro-num" id="astro-num" x="200" y="207">' + S.P.length + '</text><text class="astro-cap" id="astro-cap" x="200" y="230">prophecies</text>';
    svg.innerHTML = h;
  }
  function updateAstro(res) {
    const vec = res ? res.event.vec : {};
    $$('#astro .astro-node').forEach(g => g.classList.toggle('hot', !!vec[g.getAttribute('data-id')]));
    $('#astro-rays').innerHTML = astro.nodes.filter(p => vec[p.id]).map(p => '<line class="astro-ray" x1="200" y1="200" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" style="opacity:' + (0.35 + 0.6 * vec[p.id]).toFixed(2) + '"/>').join('');
    const top = res ? E.sortResults(res.results, 'predictive')[0] : null;
    $('#astro-num').textContent = res ? (top ? top.predictive : 0) : S.P.length;
    $('#astro-cap').textContent = res ? 'best match strength' : 'prophecies';
  }

  /* ---------- align ---------- */
  function renderExamples() {
    $('#examples').innerHTML = '<span class="hint" style="flex-basis:100%">Try an example (generic prompts, not news reports):</span>' + EXAMPLES.map((t, i) => '<button type="button" data-ex="' + i + '" title="' + esc(t[1]) + '">' + esc(t[0]) + '</button>').join('');
    $$('#examples button').forEach(b => b.addEventListener('click', () => { $('#event').value = EXAMPLES[+b.dataset.ex][1]; runAlign(); }));
  }

  function runAlign() {
    const text = $('#event').value.trim();
    if (!text) { $('#event').focus(); return; }
    store.set(KEY_EVENT, text);
    const lines = E.splitEvents(text);
    S.last = lines.length > 1 ? E.alignBatch(lines.slice(0, 60), S.P, S.A) : E.align(text, S.P, S.A); S.showAll = false;
    renderReading(); renderResults(); updateAstro(S.last); syncGraphMatch();
    $('#results-band').hidden = false;
  }

  function renderReading() {
    const r = S.last, keys = Object.keys(r.event.vec).sort((a, b) => r.event.vec[b] - r.event.vec[a]);
    const negKeys = Object.keys(r.event.negated || {});
    const negHtml = negKeys.length
      ? '<p class="meta neg-line"><strong>Denied or negated, so not counted:</strong> ' + negKeys.map(k => '<span class="arch sm negd">' + TXT(S.arch[k].glyph) + ' ' + r.event.negated[k].map(esc).join(', ') + '</span>').join(' ') + '</p>'
      : (r.event.negatedWords && r.event.negatedWords.length ? '<p class="meta neg-line">Negated wording detected and excluded: <em>' + esc(r.event.negatedWords.join(' ')) + '</em></p>' : '');
    const names = (r.event.properWords || []).filter((w, i, a) => a.indexOf(w) === i);
    const namesHtml = names.length ? '<p class="meta neg-line">Read as names, not themes: <em>' + esc(names.slice(0, 12).join(', ')) + '</em></p>' : '';
    const head = r.batch ? r.lines.length + ' events, each checked separately. Percentages show how many of them touch each theme.' : keys.length + ' theme' + (keys.length > 1 ? 's' : '') + ' found in your ' + r.words + ' words.';
    $('#reading').innerHTML = '<h2>What we found</h2>' + (keys.length
      ? '<p class="meta" style="margin-bottom:10px">' + head + '</p><div class="arch-chips">' + keys.map(k => '<span class="arch">' + TXT(S.arch[k].glyph) + ' ' + esc(S.arch[k].label) + (r.batch ? ' <small>' + Math.round(r.event.vec[k] * 100) + '% of events</small>' : ' <small>' + r.event.matched[k].map(esc).join(', ') + '</small>') + '</span>').join('') + '</div>'
      : '<p class="meta">' + (negKeys.length ? 'Everything that matched sits inside a negation or denial, so nothing was counted.' : 'No themes found. Try describing what happened, where, and to whom.') + '</p>') + negHtml + namesHtml;
  }

  const bar = (label, v, neg) => '<div class="bar' + (neg ? ' neg' : '') + '"><span>' + label + '</span><span class="track"><span class="fill" style="width:' + Math.min(100, neg ? v / 45 * 100 : v) + '%"></span></span><span class="n">' + (neg ? (v ? '−' + v : '0') : v) + '</span></div>';

  function ledgerFor(id) { return allLedger().filter(l => l.prophecy === id); }

  function resultCard(x) {
    const p = x.prophecy, v = E.VERDICTS[x.verdict];
    const flags = [], warn = [];
    x.contradictions.forEach(c => { flags.push('<li class="warn"><b>Works against the match.</b> ' + esc(c.note) + ' <span>(because your text says: ' + c.terms.map(esc).join(', ') + ')</span></li>'); warn.push(c.note); });
    x.unmet.forEach(c => flags.push('<li><b>Missing piece.</b> ' + esc(c.note) + '</li>'));
    if (x.negated && x.negated.length) flags.push('<li class="info"><b>Not counted.</b> ' + x.negated.map(esc).join(', ') + ' only appear' + (x.negated.length === 1 ? 's' : '') + ' in a denial or negation in your text.</li>');
    if (p.counterProphecy) { flags.push('<li class="info"><b>This text argues against reading events as signs.</b></li>'); }
    if (p.conditional) flags.push('<li class="info"><b>Conditional.</b> It describes a choice or scenario, not a fixed outcome.</li>');
    if (p.evidence.score === 1) { flags.push('<li class="warn"><b>Weak source.</b> A documented or near-certain forgery, so a match here means very little.</li>'); warn.push('This source is a documented or near-certain forgery.'); }
    const failed = ledgerFor(p.id).filter(l => l.status === 'failed').length;
    if (failed) flags.push('<li class="warn"><b>Track record.</b> ' + failed + ' dated prediction' + (failed > 1 ? 's' : '') + ' from this source already failed (see Predictions).</li>');
    const themes = x.shared.map(k => S.arch[k].label);
    const why = (themes.length ? 'Shared themes: ' + themes.slice(0, 3).join(', ') + '. ' : 'Matched on wording, not themes. ') +
      (x.markers.length ? x.markersHit + ' of ' + x.markers.length + ' concrete details match.' : 'This text has no concrete details to check.');
    return '<article class="res v-' + x.verdict + '">' +
      '<div class="res-top"><div>' + famChip(p.family) + '<h3><button type="button" data-open="' + esc(p.id) + '">' + esc(p.title) + '</button></h3><p class="meta">' + esc(p.tradition) + ' · ' + esc(p.date.label) + '</p></div>' +
      '<div class="scores"><div class="score pw"><b>' + x.predictive + '</b><span>Match strength</span></div></div></div>' +
      '<p class="verdict"><span class="v-badge">' + esc(v.label) + '</span>' + esc(v.note) + '</p>' +
      '<p class="why-line">' + esc(why) + '</p>' +
      (warn.length ? '<p class="warn-line">' + esc(warn[0]) + '</p>' : '') +
      (x.batch ? '<p class="batch-line">Best-matching event: <em>' + esc(x.batch.lineText) + '</em> · ' + x.batch.support + ' of ' + x.batch.total + ' events overlap</p>' : '') +
      '<details class="why"><summary>Show the scoring</summary>' +
      '<div class="bars">' + bar('Theme overlap', x.thematic) + bar('Concrete details', x.specificity) + bar('Source strength', x.evidence) + bar('Points against', x.penalty, true) + '</div>' +
      '<div class="res-cols"><div><h4>Shared themes</h4><div class="arch-chips">' + (x.shared.length ? x.shared.map(k => '<span class="arch sm">' + TXT(S.arch[k].glyph) + ' ' + esc(S.arch[k].label) + '</span>').join('') : '<span class="meta">None</span>') + '</div>' +
      (x.keywords.length ? '<h4 style="margin-top:12px">Words from the prophecy found</h4><p class="meta">' + x.keywords.map(esc).join(', ') + '</p>' : '') + '</div>' +
      '<div><h4>Concrete details (' + x.markersHit + ' of ' + x.markers.length + ')</h4>' + (x.markers.length ? '<ul class="mk">' + x.markers.map(m => '<li class="' + (m.hit ? 'hit' : '') + '">' + esc(m.label) + '</li>').join('') + '</ul>' : '<p class="meta">None to check.</p>') + '</div></div>' +
      (flags.length ? '<ul class="flags">' + flags.join('') + '</ul>' : '') +
      '<p class="src-line">Match strength = theme overlap × √(concrete details × source strength) − points against. <a href="#method">How it works</a></p></details>' +
      '<div class="res-foot"><button type="button" class="btn" data-open="' + esc(p.id) + '">Read the prophecy and sources</button><button type="button" class="btn ghost" data-log="' + esc(p.id) + '">Save as a prediction to track</button></div></article>';
  }

  function renderResults() {
    const all = E.sortResults(S.last.results, S.sort);
    const strong = all.filter(x => x.thematic >= 20), weak = all.filter(x => x.thematic > 0 && x.thematic < 20);
    const pool = strong.concat(weak), limit = S.showAll ? pool.length : Math.min(5, strong.length);
    const shown = pool.slice(0, limit);
    const close = strong.filter(x => x.verdict === 'specific' || x.verdict === 'thematic').length;
    $('#res-title').textContent = !strong.length ? 'No real match' : close ? close + (close === 1 ? ' prophecy overlaps' : ' prophecies overlap') + ' with concrete details' : 'Only loose resemblances';
    $('#results').innerHTML = shown.length ? shown.map(resultCard).join('') : '<p class="empty">Nothing in the database has enough in common with this event to compare. That is a useful answer too.</p>';
    const rest = pool.length - shown.length;
    const more = $('#more-results'); more.hidden = !rest; more.textContent = 'Show ' + rest + ' more';
    $$('[data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === S.sort)));
  }

  /* ---------- drawer ---------- */
  let lastFocus = null;
  function openDrawer(id) {
    const p = S.byId[id]; if (!p) return;
    const pips = n => '<span class="pip" aria-label="' + n + ' of 5">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= n ? 'on' : '') + '"></i>').join('') + '</span>';
    const led = ledgerFor(id);
    const qlabel = p.excerpt.type === 'quotation' ? 'Quotation · ' + p.source.edition : 'Summary in our own words (original wording not reproduced)';
    $('#drawer-body').innerHTML =
      famChip(p.family) + '<h2 id="d-title">' + esc(p.title) + '</h2><p class="meta">' + esc(p.tradition) + ' · ' + esc(p.date.label) + '</p>' +
      '<div class="d-sec"><h4>Original source</h4><p class="q-type">' + esc(qlabel) + '</p><blockquote>' + esc(p.excerpt.text) + '</blockquote><p class="cite">' + esc(p.excerpt.ref) + '</p></div>' +
      '<div class="d-sec"><dl class="kv"><dt>Work</dt><dd>' + esc(p.source.work) + '</dd><dt>Locator</dt><dd>' + esc(p.source.locator) + '</dd><dt>Edition</dt><dd>' + esc(p.source.edition) + '</dd><dt>Date</dt><dd>' + esc(p.date.label) + '</dd></dl></div>' +
      '<div class="d-sec"><h4>Summary</h4><p>' + esc(p.summary) + '</p></div>' +
      '<div class="d-sec"><h4>How we rate this text</h4><div class="rate"><div><b>How specific it is: ' + p.specificity.score + '/5</b>' + pips(p.specificity.score) + '<br>' + esc(p.specificity.rationale) + '</div><div><b>How solid the source is: ' + p.evidence.score + '/5</b>' + pips(p.evidence.score) + '<br>' + esc(p.evidence.rationale) + '</div></div></div>' +
      '<div class="d-sec"><h4>Themes in this prophecy</h4><div class="arch-chips">' + Object.keys(p.archetypes).sort((a, b) => p.archetypes[b] - p.archetypes[a]).map(k => '<span class="arch sm">' + TXT(S.arch[k].glyph) + ' ' + esc(S.arch[k].label) + ' <small>' + p.archetypes[k].toFixed(1) + '</small></span>').join('') + '</div></div>' +
      '<div class="d-sec"><h4>Historical parallels</h4><ul class="timeline">' + p.parallels.map(x => '<li><span class="when">' + esc(x.when) + '</span>' + esc(x.event) + '<small>' + esc(x.note) + '</small></li>').join('') + '</ul></div>' +
      '<div class="d-sec"><h4>Competing interpretations</h4><div class="interp">' + p.interpretations.map(x => '<div><b>' + esc(x.school) + '</b>' + esc(x.reading) + '</div>').join('') + '</div></div>' +
      ((p.contradictions.length || p.preconditions.length) ? '<div class="d-sec"><h4>What would count against a match</h4><ul class="flags">' + p.contradictions.map(c => '<li class="warn">' + esc(c.note) + '</li>').join('') + p.preconditions.map(c => '<li>' + esc(c.note) + '</li>').join('') + '</ul></div>' : '') +
      '<div class="d-sec"><h4>Tracked predictions</h4>' + (led.length ? led.map(l => '<p><span class="pill s-' + l.status + '">' + STATUS_LABEL[l.status] + '</span> ' + esc(l.claim) + '</p>').join('') : '<p class="meta">No tracked predictions for this source yet.</p>') + '<button type="button" class="btn ghost" data-log="' + esc(p.id) + '">Save as a prediction to track</button></div>' +
      '<div class="d-sec"><h4>Check it yourself</h4><ul>' + p.links.map(l => '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a></li>').join('') + '</ul></div>';
    lastFocus = document.activeElement;
    $('#drawer').hidden = false; document.body.style.overflow = 'hidden';
    const panel = $('.drawer-panel'); panel.scrollTop = 0; panel.focus();
  }
  function closeDrawer() { $('#drawer').hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  /* ---------- library ---------- */
  function renderLibrary() {
    $('#lib-fams').innerHTML = '<button type="button" aria-pressed="' + (!S.libFam) + '">All ' + S.P.length + '</button>' + FAMILIES.map(f => '<button type="button" style="--c:' + FAM_COLOR[f] + '" data-fam="' + f + '" aria-pressed="' + (S.libFam === f) + '"><span class="dot"></span>' + esc(FAM_LABEL[f] || f) + ' ' + S.P.filter(p => p.family === f).length + '</button>').join('');
    const q = E.normalize(S.libQ);
    const list = S.P.filter(p => (!S.libFam || p.family === S.libFam) && (!q || E.normalize([p.title, p.tradition, p.summary, p.keywords.join(' '), p.source.work].join(' ')).indexOf(q) !== -1));
    const pips = n => '<span class="pip">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= n ? 'on' : '') + '"></i>').join('') + '</span>';
    $('#lib-grid').innerHTML = list.length ? list.map(p => '<article class="lib-card">' + famChip(p.family) + '<h3><button type="button" data-open="' + esc(p.id) + '">' + esc(p.title) + '</button></h3><p>' + esc(p.tradition) + ' · ' + esc(p.date.label) + '</p><p>' + esc(p.source.work) + ', ' + esc(p.source.locator) + '</p><div class="pips"><span>How specific' + pips(p.specificity.score) + '</span><span>Source strength' + pips(p.evidence.score) + '</span></div></article>').join('') : '<p class="empty">No prophecies match that search.</p>';
  }

  /* ---------- forecasts & public register ---------- */
  const RG = window.EschatonRegistry, FC = window.EschatonForecast;
  const short = h => h ? h.slice(0, 8) + '…' + h.slice(-4) : '';
  const P100 = p => p == null ? '–' : Math.round(p * 100) + '%';
  function repoSlug() {
    if (S.config && /^[\w.-]+\/[\w.-]+$/.test(S.config.repo || '')) return S.config.repo;
    const h = location.hostname; if (!/\.github\.io$/i.test(h)) return null;
    const seg = location.pathname.split('/').filter(Boolean)[0];
    return h.split('.')[0] + '/' + (seg && !/\.html?$/i.test(seg) ? seg : h);
  }
  function issueURL(d) {
    const repo = repoSlug(); if (!repo) return null;
    const q = { template: 'prediction.yml', title: ('Prediction: ' + (d.claim || '')).slice(0, 120) };
    if (d.claim) q.claim = d.claim; if (d.criteria) q.criteria = d.criteria; if (d.resolveBy) q.resolveBy = d.resolveBy;
    if (d.probability != null && d.probability !== '') q.probability = String(Math.round(d.probability * 100));
    if (d.prophecy) q.prophecy = d.prophecy; if (d.evidence) q.evidence = d.evidence.slice(0, 1200);
    return 'https://github.com/' + repo + '/issues/new?' + Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
  }
  let FC_BT = null;
  function renderForecasts() {
    const reg = S.REG, repo = repoSlug();
    $('#fc-lede').innerHTML = 'Near the end of each month, ESCHATON forecasts the next month of its own news index: for each common theme, will it be above its usual level, and will several themes run high at once? Every forecast states its probability, the base rate, and exactly how it resolves. The batch is hashed into an append-only public registry before the month starts, then scored with a Brier score after it ends (0 is perfect; always saying 50% scores 0.25; lower is better).';
    if (!reg || !reg.entries || !reg.entries.length) { $('#fc-chain').innerHTML = '<span class="chain-warn">No registry file yet. The daily GitHub Action creates it.</span>'; $('#fc-batch').innerHTML = ''; }
    else {
      const v = RG.verify(reg), res = RG.resolved(reg);
      $('#fc-chain').className = 'chain ' + (v.ok ? 'ok' : 'bad');
      $('#fc-chain').innerHTML = v.ok
        ? '<b>Registry intact.</b> ' + v.count + ' entr' + (v.count === 1 ? 'y' : 'ies') + ', every hash recomputed in your browser just now. Latest fingerprint <code title="' + esc(v.head) + '">' + esc(short(v.head)) + '</code>.' + (repo ? ' <a href="https://github.com/' + esc(repo) + '/commits/main/data/registry.json" target="_blank" rel="noopener">History</a> · <a href="https://github.com/' + esc(repo) + '/tree/main/data/stamps" target="_blank" rel="noopener">Bitcoin timestamps</a>' : '')
        : '<b>Registry check failed.</b> ' + v.bad.map(b => 'Entry ' + esc(b.seq) + ': ' + esc(b.problems.join(', '))).join('; ') + '. Something in data/registry.json was changed after it was recorded.';
      const batches = reg.entries.filter(e => e.type === 'forecast-batch');
      const scored = batches.filter(b => res[b.hash]);
      const open = batches.filter(b => !res[b.hash]).slice(-1)[0], show = open || batches[batches.length - 1];
      let html = '';
      if (scored.length) {
        const avg = k => scored.reduce((s2, b) => s2 + res[b.hash].body.meanBrier[k], 0) / scored.length;
        html += '<p class="live-score"><b>Live record, ' + scored.length + ' month' + (scored.length === 1 ? '' : 's') + ' scored:</b> momentum ' + avg('persistence').toFixed(3) + ' · base rate ' + avg('base').toFixed(3) + ' · momentum + convergence ' + avg('convergence').toFixed(3) + ' (mean Brier, lower is better).' + (scored.length < 12 ? ' Too few months to judge yet; the method commits to a verdict after 12.' : '') + '</p>';
      }
      if (show) {
        const b = show.body, r = res[show.hash], outs = r ? Object.fromEntries(r.body.outcomes.map(o => [o.id, o])) : {};
        html += '<div class="fc-head"><h3>' + esc(MONTH_FMT(b.target)) + (r ? ': scored' : ': open') + '</h3><span class="tag">Entry #' + show.seq + ' · recorded ' + esc(show.issued.slice(0, 16).replace('T', ' ')) + ' UTC · <code title="' + esc(show.hash) + '">' + esc(short(show.hash)) + '</code></span></div>' +
          '<p class="meta">Based on ' + esc(MONTH_FMT(b.state.month)) + ' to date (' + b.state.days + ' days, ' + b.state.items + ' items). Published forecast = the momentum model, the best performer in testing. ' + (r ? '' : 'Resolves after ' + esc(DAY_FMT(b.target + '-' + String(new Date(Date.UTC(+b.target.slice(0, 4), +b.target.slice(5, 7), 0)).getUTCDate()))) + '.') + '</p>' +
          '<div class="scroll"><table class="fc-table"><thead><tr><th>Above its usual level in ' + esc(MONTH_FMT(b.target).split(' ')[0]) + '?</th><th>' + esc(MONTH_FMT(b.state.month).split(' ')[0]) + ' so far</th><th>Forecast</th><th class="fc-br">Base rate</th>' + (r ? '<th>Outcome · Brier</th>' : '') + '</tr></thead><tbody>' +
          b.forecasts.map(f => {
            const o = outs[f.id], name = f.kind === 'theme' ? (S.arch[f.theme] ? S.arch[f.theme].label : f.theme) : 'Several themes high at once';
            const lastTxt = f.kind === 'theme' ? (f.lastState ? 'above' : 'below') + ' <small>(' + (f.lastValue * 100).toFixed(1) + '% vs ' + (f.threshold * 100).toFixed(1) + '%)</small>' : f.lastCount + ' high';
            return '<tr><td><details><summary>' + esc(name) + (f.kind === 'theme' ? '' : ' (' + f.threshold + '+)') + '</summary><p>' + esc(f.criteria) + '</p><p class="meta">Models: base rate ' + P100(f.p.base) + ' · momentum ' + P100(f.p.persistence) + ' · momentum + convergence ' + P100(f.p.convergence) + '</p></details></td>' +
              '<td>' + lastTxt + '</td><td><b class="fc-p" style="--p:' + f.probability + '">' + P100(f.probability) + '</b></td><td class="fc-br">' + P100(f.baseRate) + '</td>' +
              (r ? '<td>' + (o ? '<span class="pill s-' + (o.y ? 'supported' : 'failed') + '">' + (o.y ? 'Yes' : 'No') + '</span> ' + o.brier.persistence.toFixed(3) : '') + '</td>' : '') + '</tr>';
          }).join('') + '</tbody></table></div>' +
          '<p class="meta">What would refute the method: ' + esc(b.methodInvalidation) + '</p>';
      }
      $('#fc-batch').innerHTML = html;
    }
    // Out-of-sample backtest, computed here from the shipped monthly data.
    if (!FC_BT && S.IX && S.IX.months) FC_BT = FC.backtest(S.IX.months, S.IX.archetypes);
    const bt = FC_BT; if (!bt) { $('#fc-score').innerHTML = ''; return; }
    const t = bt.theme, worst = Math.max(t.brier.base, t.brier.persistence, t.brier.convergence);
    const bar = (label, v, note) => '<div class="bt-row"><span>' + label + '</span><div class="bt-track"><i style="width:' + (v / worst * 100).toFixed(1) + '%"></i></div><b>' + v.toFixed(3) + '</b><small>' + note + '</small></div>';
    const better = (x, y) => { const d = 1 - x / y; return (d >= 0 ? Math.round(d * 100) + '% better than ' : Math.round(-d * 100) + '% worse than '); };
    $('#fc-score').innerHTML = '<p class="meta">Every month from ' + esc(MONTH_FMT(bt.from)) + ' to ' + esc(MONTH_FMT(bt.to)) + ' was forecast using only the months before it, then checked: ' + t.n.toLocaleString() + ' theme forecasts in all. Average Brier score per model:</p>' +
      '<div class="bt">' + bar('Guess the usual rate', t.brier.base, 'the yardstick') + bar('Momentum: was it high last month?', t.brier.persistence, better(t.brier.persistence, t.brier.base) + 'the yardstick') + bar('Momentum + convergence', t.brier.convergence, better(t.brier.convergence, t.brier.persistence) + 'momentum alone') + '</div>' +
      '<p class="verdict"><b>What this shows.</b> Themes have momentum: a theme that was high last month tends to stay high, and knowing that beats the base rate by ' + Math.round(t.skillPersistence * 100) + '%. But "many themes running high at once" ' + (t.skillConvergence > 0.01 ? 'adds a little (' + Math.round(t.skillConvergence * 100) + '%).' : 'adds nothing; it makes the forecasts slightly worse. Convergence describes a month; it does not predict the next one.') + ' Forecasting whether convergence itself continues: ' + better(bt.convergence.brier.persistence, bt.convergence.brier.base) + 'the base rate, which is barely different.</p>' +
      '<details class="why"><summary>Is it calibrated?</summary><p class="meta">When the momentum model gave a probability in each range, how often did the event happen?</p><div class="scroll"><table class="fc-table"><thead><tr><th>Forecast range</th><th>Forecasts</th><th>Average forecast</th><th>Actually happened</th></tr></thead><tbody>' +
      bt.calibration.filter(c => c.n).map(c => '<tr><td>' + Math.round(c.lo * 100) + '–' + Math.round(c.hi * 100) + '%</td><td>' + c.n + '</td><td>' + P100(c.forecast) + '</td><td>' + P100(c.observed) + '</td></tr>').join('') + '</tbody></table></div></details>';
  }

  function renderPublic() {
    const repo = repoSlug(), reg = S.REG, claims = reg && reg.entries ? reg.entries.filter(e => e.type === 'claim') : [], res = reg ? RG.resolved(reg) : {};
    const reg1 = repo ? '<a class="btn primary" href="' + esc(issueURL({})) + '" target="_blank" rel="noopener">Register a prediction</a>' : '';
    $('#pub-lede').innerHTML = 'Predictions anyone can check. Each is filed as a GitHub issue, then a free bot adds it to the same hash chain, timestamps it in Bitcoin with OpenTimestamps, and replies with its fingerprint. After that it cannot be quietly edited or deleted. Outcomes are added later as separate entries. ' +
      (repo ? reg1 : '<em>Public registration switches on when this site runs from its GitHub repository (GitHub Pages), or when <code>data/config.json</code> names the repository.</em>');
    $('#pub-list').innerHTML = claims.length ? claims.slice().reverse().map(e => {
      const b = e.body, r = res[e.hash], st = r ? r.body.outcome : 'pending', p = S.byId[b.prophecy];
      return '<article class="led" style="--c:var(--' + st + ')"><div class="led-top"><span class="pill s-' + st + '">' + STATUS_LABEL[st] + '</span><span class="tag">#' + e.seq + ' · ' + esc(e.issued.slice(0, 10)) + ' · <code title="' + esc(e.hash) + '">' + esc(short(e.hash)) + '</code></span>' + (b.probability != null ? '<span class="tag">' + P100(b.probability) + ' likely' + (b.baseRate != null ? ' · base rate ' + P100(b.baseRate) : '') + '</span>' : '') + '</div>' +
        '<h3>' + esc(b.claim) + '</h3><dl><dt>By</dt><dd>' + (b.url ? '<a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(b.madeBy) + '</a>' : esc(b.madeBy)) + '</dd><dt>Resolve by</dt><dd>' + esc(b.resolveBy) + '</dd><dt>Criteria</dt><dd>' + esc(b.criteria) + '</dd>' + (b.invalidation ? '<dt>Proved wrong if</dt><dd>' + esc(b.invalidation) + '</dd>' : '') + (p ? '<dt>Related</dt><dd><a href="#" data-open="' + esc(p.id) + '">' + esc(p.title) + '</a></dd>' : '') +
        (r ? '<dt>Outcome</dt><dd>' + esc(r.body.evidence) + (r.body.brier != null ? ' · Brier ' + r.body.brier.toFixed(3) + (r.body.baseBrier != null ? ' (base rate would have scored ' + r.body.baseBrier.toFixed(3) + ')' : '') : '') + '</dd>' : '') + '</dl></article>';
    }).join('') : '<p class="empty">No public predictions registered yet.</p>';
  }

  /* ---------- ledger ---------- */
  const allLedger = () => S.user.map(l => Object.assign({ origin: 'user' }, l)).concat(S.seed.map(l => Object.assign({ origin: 'seed' }, l)));
  const saveUser = () => store.set(KEY_LEDGER, S.user);
  const draftFP = l => RG.sha256(RG.canonical({ claim: l.claim, criteria: l.criteria, madeBy: l.madeBy, madeOn: l.madeOn, resolveBy: l.resolveBy, prophecy: l.prophecy || '', probability: l.probability == null ? null : l.probability, createdAt: l.createdAt || null }));
  function msg(t) { $('#led-msg').textContent = t; }

  function renderLedger() {
    renderForecasts(); renderPublic();
    const all = allLedger();
    const counts = {}; STATUSES.forEach(s => counts[s] = all.filter(l => l.status === s).length);
    $('#ledger-stats').innerHTML = STATUSES.map(s => '<button type="button" class="stat" style="--c:var(--' + s + ')" data-status="' + s + '" aria-pressed="' + (S.ledFilter === s) + '"><b>' + counts[s] + '</b><span>' + STATUS_LABEL[s] + '</span></button>').join('');
    $('#ledger-filter').innerHTML = ['all'].concat(STATUSES).map(s => '<button type="button" data-lf="' + s + '" aria-pressed="' + (S.ledFilter === s) + '">' + (s === 'all' ? 'All ' + all.length : STATUS_LABEL[s]) + '</button>').join('');
    const list = all.filter(l => S.ledFilter === 'all' || l.status === S.ledFilter);
    const t = today();
    $('#ledger-list').innerHTML = list.length ? list.map(l => {
      const p = S.byId[l.prophecy], overdue = l.status === 'pending' && l.resolveBy && l.resolveBy < t;
      return '<article class="led" style="--c:var(--' + l.status + ')"><div class="led-top"><span class="pill s-' + l.status + '">' + STATUS_LABEL[l.status] + '</span><span class="tag">' + (l.origin === 'seed' ? 'Historical record' : 'Your draft') + '</span>' + (overdue ? '<span class="tag alert">Its date has passed: update the result</span>' : '') + '</div>' +
        '<h3>' + esc(l.claim) + '</h3><dl><dt>Made by</dt><dd>' + esc(l.madeBy) + '</dd><dt>Recorded</dt><dd>' + esc(l.madeOn) + '</dd><dt>Resolve by</dt><dd>' + (l.resolveBy ? esc(l.resolveBy) : 'No date (so it can never fail)') + '</dd><dt>Criteria</dt><dd>' + esc(l.criteria) + '</dd>' + (l.evidence ? '<dt>Evidence</dt><dd>' + esc(l.evidence) + '</dd>' : '') + (p ? '<dt>Related</dt><dd><a href="#" data-open="' + esc(p.id) + '">' + esc(p.title) + '</a></dd>' : '') + '</dl>' +
        (l.origin === 'user' && l.createdAt ? '<p class="fp">Draft saved ' + esc(l.createdAt.slice(0, 16).replace('T', ' ')) + ' UTC · fingerprint <code title="' + esc(l.fp || '') + '">' + esc(short(l.fp)) + '</code>' + (l.fp && l.fp !== draftFP(l) ? ' <span class="tag alert">does not match its content</span>' : '') + (l.history && l.history.length ? ' · edited ' + l.history.length + '× (earlier fingerprints kept)' : '') + (l.probability != null ? ' · your probability ' + P100(l.probability) : '') + '</p>' : '') +
        (l.origin === 'user' ? '<div class="led-actions"><label class="sr" for="st-' + esc(l.id) + '">Status</label><select id="st-' + esc(l.id) + '" data-status-of="' + esc(l.id) + '">' + STATUSES.map(s => '<option value="' + s + '"' + (s === l.status ? ' selected' : '') + '>' + STATUS_LABEL[s] + '</option>').join('') + '</select><button type="button" class="btn ghost" data-edit="' + esc(l.id) + '">Edit</button>' + (issueURL(l) && l.status === 'pending' && (!l.resolveBy || l.resolveBy > t) ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(issueURL(l)) + '">Register publicly</a>' : '') + '<button type="button" class="btn ghost" data-del="' + esc(l.id) + '">Delete</button></div>' : '') + '</article>';
    }).join('') : '<p class="empty">No entries with this status yet.</p>';
  }

  function startEdit(id) {
    const u = S.user.find(x => x.id === id); if (!u) return;
    const f = $('#add-form'); $('#add-wrap').open = true; f.dataset.editing = id;
    ['claim', 'criteria', 'madeBy', 'madeOn', 'resolveBy', 'prophecy', 'evidence'].forEach(k => f[k].value = u[k] || '');
    f.probability.value = u.probability == null ? '' : Math.round(u.probability * 100);
    $('#add-submit').textContent = 'Save changes'; $('#add-cancel').hidden = false; $('#add-sum').textContent = 'Edit draft';
    $('#add-wrap').scrollIntoView({ block: 'start' }); f.claim.focus({ preventScroll: true });
  }
  function endEdit() {
    const f = $('#add-form'); f.reset(); delete f.dataset.editing; f.madeOn.value = today();
    $('#add-submit').textContent = 'Save draft'; $('#add-cancel').hidden = true; $('#add-sum').textContent = 'Write a draft prediction';
  }
  function fillProphecySelect() {
    $('#add-prophecy').innerHTML = '<option value="">None</option>' + FAMILIES.map(f => '<optgroup label="' + esc(FAM_LABEL[f] || f) + '">' + S.P.filter(p => p.family === f).map(p => '<option value="' + esc(p.id) + '">' + esc(p.title) + '</option>').join('') + '</optgroup>').join('');
  }

  function prefillLedger(pid) {
    closeDrawer(); location.hash = '#ledger';
    const f = $('#add-form'); $('#add-wrap').open = true;
    f.prophecy.value = pid || ''; f.madeOn.value = today();
    if (S.last && !f.evidence.value) f.evidence.value = 'Prompted by the event: ' + S.last.text;
    setTimeout(() => { $('#add-wrap').scrollIntoView({ block: 'start' }); f.claim.focus({ preventScroll: true }); }, 180);
  }

  function exportJSON() { return JSON.stringify({ app: 'ESCHATON', version: 1, exportedAt: new Date().toISOString(), entries: allLedger() }, null, 2); }
  function importJSON(text) {
    let data; try { data = JSON.parse(text); } catch (e) { msg('That file is not valid JSON.'); return; }
    const arr = Array.isArray(data) ? data : data && data.entries;
    if (!Array.isArray(arr)) { msg('No entries found in that file.'); return; }
    const ids = new Set(S.user.map(u => u.id)); let n = 0;
    arr.forEach(e => {
      if (!e || e.origin === 'seed' || typeof e.claim !== 'string' || typeof e.criteria !== 'string' || STATUSES.indexOf(e.status) === -1) return;
      const clean = { id: String(e.id || ''), claim: e.claim.slice(0, 1000), criteria: e.criteria.slice(0, 1000), madeBy: String(e.madeBy || '').slice(0, 200), madeOn: String(e.madeOn || '').slice(0, 30), resolveBy: String(e.resolveBy || '').slice(0, 30), status: e.status, evidence: String(e.evidence || '').slice(0, 1000), prophecy: S.byId[e.prophecy] ? e.prophecy : '', probability: typeof e.probability === 'number' && e.probability >= 0 && e.probability <= 1 ? e.probability : null, createdAt: typeof e.createdAt === 'string' ? e.createdAt.slice(0, 30) : null, fp: typeof e.fp === 'string' ? e.fp.slice(0, 64) : null, history: Array.isArray(e.history) ? e.history.slice(0, 50).filter(h => h && typeof h.fp === 'string').map(h => ({ fp: h.fp.slice(0, 64), at: String(h.at || '').slice(0, 30) })) : [] };
      if (!clean.id || ids.has(clean.id)) clean.id = 'U-' + Date.now().toString(36) + '-' + n;
      ids.add(clean.id); S.user.unshift(clean); n++;
    });
    saveUser(); renderLedger(); msg(n ? 'Imported ' + n + ' entr' + (n === 1 ? 'y' : 'ies') + '.' : 'Nothing to import: entries need a claim, criteria and a valid status.');
  }

  /* ---------- network ---------- */
  function renderNetFams() {
    $('#net-fams').innerHTML = FAMILIES.map(f => '<button type="button" style="--c:' + FAM_COLOR[f] + '" data-nf="' + f + '" aria-pressed="' + !S.netHidden.has(f) + '"><span class="dot"></span>' + esc(FAM_LABEL[f] || f) + '</button>').join('');
  }
  function netSide(node) {
    const el = $('#net-side');
    if (!node) {
      let h = '<h3>How to read the map</h3><p>The outer ring holds the 23 themes. Each coloured dot is a prophecy, coloured by tradition. A line means the prophecy is strongly about that theme. Tap anything to see its links.</p>';
      if (S.last) {
        const top = E.sortResults(S.last.results, 'predictive').filter(x => x.thematic >= 20).slice(0, 6);
        h += '<h3 style="margin-top:16px">Your event</h3><p class="meta">' + esc(S.last.text) + '</p>' + (top.length ? '<ul>' + top.map(x => '<li><a href="#" data-open="' + esc(x.id) + '">' + esc(x.prophecy.title) + '</a> · match strength ' + x.predictive + '</li>').join('') + '</ul>' : '<p>No real match.</p>');
      } else h += '<p>Check an event to place it at the centre.</p>';
      el.innerHTML = h; return;
    }
    if (node.kind === 'p') {
      const p = node.p;
      el.innerHTML = famChip(p.family) + '<h3>' + esc(p.title) + '</h3><p>' + esc(p.tradition) + ' · ' + esc(p.date.label) + '</p><div class="arch-chips">' + Object.keys(p.archetypes).map(k => '<span class="arch sm">' + TXT(S.arch[k].glyph) + ' ' + esc(S.arch[k].label) + '</span>').join('') + '</div><p style="margin-top:14px"><button type="button" class="btn" data-open="' + esc(p.id) + '">Open sources</button></p>';
    } else {
      const a = node.a, linked = S.P.filter(p => (p.archetypes[a.id] || 0) >= 0.4).sort((x, y) => y.archetypes[a.id] - x.archetypes[a.id]);
      el.innerHTML = '<h3>' + TXT(a.glyph) + ' ' + esc(a.label) + '</h3><p>' + linked.length + ' prophecies are strongly about this theme.</p><ul>' + linked.map(p => '<li><a href="#" data-open="' + esc(p.id) + '">' + esc(p.title) + '</a> <span class="meta">' + p.archetypes[a.id].toFixed(1) + '</span></li>').join('') + '</ul><p class="meta">Lexicon: ' + a.terms.slice(0, 14).map(esc).join(', ') + '…</p>';
    }
  }
  function syncGraphMatch() {
    if (!S.graph) return;
    if (!S.last) { S.graph.setMatch(null); return; }
    const sorted = E.sortResults(S.last.results, 'predictive').filter(x => x.thematic >= 20).slice(0, 8);
    const score = {}; sorted.forEach(x => score[x.id] = x.predictive);
    S.graph.setMatch({ arch: S.last.event.vec, score: score, top: sorted.slice(0, 4).map(x => x.id) });
    netSide(null);
  }
  function ensureGraph() {
    if (S.graph) return;
    S.graph = new window.EschatonGraph($('#net'), { prophecies: S.P, archetypes: S.A, familyColor: FAM_COLOR, onSelect: netSide });
    S.graph.setHidden(S.netHidden); syncGraphMatch(); netSide(null);
  }

  /* ---------- daily archetype index ---------- */
  const IXR = window.EschatonIndexer;
  const DAY_FMT = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const pctTxt = p => p == null ? 'n/a' : p >= 99 ? 'top 1%' : p <= 1 ? 'bottom 1%' : ordinal(p) + ' percentile';
  function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  const share = (c, n) => n ? c / n : 0;
  const pctOfHist = (hist, k) => { const tot = hist.reduce((a, b) => a + b, 0); if (!tot) return null; let below = 0; for (let i = 0; i < k; i++) below += hist[i]; return Math.round(100 * (below + hist[k] / 2) / tot); };

  function weekEnding(i) {
    const rows = S.IX.recent, end = rows[i][0], t0 = Date.parse(end) - 6 * 864e5;
    const w = { end, n: 0, r: 0, days: 0, c: new Array(S.IX.archetypes.length).fill(0), f: new Array(7).fill(0) };
    for (let j = i; j >= 0 && Date.parse(rows[j][0]) >= t0; j--) { const x = rows[j]; w.days++; w.n += x[1]; w.r += x[3]; x[2].forEach((v, k) => w.c[k] += v); x[4].forEach((v, k) => w.f[k] += v); }
    const B = S.IX.baseline, p90 = S.IX.qp.indexOf(0.9);
    w.arch = S.IX.archetypes.map((id, k) => { const sh = share(w.c[k], w.n); return { id, k, share: sh, pct: IXR.rank(sh, B.week[k], S.IX.qp), med: B.week[k][S.IX.qp.indexOf(0.5)], p10: B.week[k][S.IX.qp.indexOf(0.1)], p90v: B.week[k][p90], elevated: w.c[k] >= IXR.MIN_HIGH && sh > B.week[k][p90] }; });
    w.conv = w.arch.filter(a => a.elevated).length;
    w.convPct = pctOfHist(B.convHist, w.conv);
    w.resShare = share(w.r, w.n); w.resPct = IXR.rank(w.resShare, B.resonant7, S.IX.qp);
    w.fams = w.f.filter(v => v > 0).length; w.famPct = pctOfHist(B.famHist, w.fams);
    return w;
  }

  function initIndex() {
    if (!S.IX || !S.IX.recent || !S.IX.recent.length) {
      $('#ix-lede').textContent = 'The index data has not been generated yet. Run node tools/ingest.mjs or enable the GitHub Action, then reload.';
      $('#ix-body').hidden = true; return;
    }
    const rows = S.IX.recent;
    $('#ix-day').innerHTML = rows.map((r, i) => '<option value="' + i + '">Week ending ' + esc(DAY_FMT(r[0])) + '</option>').reverse().join('');
    S.ixDay = rows.length - 1; $('#ix-day').value = String(S.ixDay);
    $('#ix-day').addEventListener('change', e => { S.ixDay = +e.target.value; renderIndexWeek(); });
    $('#ix-arch-more').addEventListener('click', () => { S.ixAll = !S.ixAll; renderIndexWeek(); });
    $('#ix-prev').addEventListener('click', () => { if (S.ixDay > 6) { S.ixDay--; $('#ix-day').value = String(S.ixDay); renderIndexWeek(); } });
    $('#ix-next').addEventListener('click', () => { if (S.ixDay < rows.length - 1) { S.ixDay++; $('#ix-day').value = String(S.ixDay); renderIndexWeek(); } });
    const B = S.IX.baseline, cov = S.IX.coverage;
    $('#ix-source').innerHTML = 'Source: <a href="https://en.wikipedia.org/wiki/Portal:Current_events" target="_blank" rel="noopener">Wikipedia, Portal:Current events</a> (CC BY-SA 4.0). ' + cov.items.toLocaleString() + ' items from ' + cov.usableDays.toLocaleString() + ' days, ' + esc(DAY_FMT(cov.from)) + ' to ' + esc(DAY_FMT(cov.to)) + '. Baseline: ' + B.windows.toLocaleString() + ' weeks, ' + esc(B.from.slice(0, 4)) + '–' + esc(B.to.slice(0, 4)) + '. Updated ' + esc(DAY_FMT(S.IX.generated.slice(0, 10))) + '.';
    if (B.control) $('#ix-source').insertAdjacentHTML('beforeend', ' <span class="ctl">Control test: ' + pct1(B.control.realRate) + ' of baseline news items match a real prophecy at strength 20+, versus ' + pct1(B.control.decoyRate) + ' for shuffled decoy prophecies built from the same parts.</span>');
    S.trend = {}; IXR.trends(S.IX.months, S.IX.archetypes).forEach(t => S.trend[t.id] = t);
    S.MON = IXR.monthly(S.IX.months, S.IX.archetypes, { baselineFrom: B.from, baselineTo: B.to });
    renderIndexWeek(); renderHighlights(); renderPatterns(); renderLongView();
  }

  const pct1 = v => (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%';
  const MONTH_FMT = ym => new Date(ym + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  function renderMonthCheck(ym) {
    const r = S.MON && S.MON.rows.find(x => x.m === ym), el = $('#ix-month');
    if (!r || !S.MON.months) { el.innerHTML = ''; return; }
    const lbl = r.high.map(id => esc(S.arch[id].label)).join(', ');
    el.innerHTML = '<b>Month check, no overlap.</b> ' + esc(MONTH_FMT(ym)) + (r.partial ? ' so far (' + r.days + ' days)' : '') + ': <strong>' + r.conv + ' theme' + (r.conv === 1 ? '' : 's') + '</strong> above their own 90th percentile for a month' + (lbl ? ' (' + lbl + ')' : '') + '. ' +
      (r.atLeast != null ? (r.conv ? 'That many or more happened in <strong>' + pct1(r.atLeast) + '</strong> of the ' + S.MON.months + ' months from ' + S.MON.from.slice(0, 4) + ' to ' + S.MON.to.slice(0, 4) + '.' : '') : '') +
      ' Calendar months never overlap, so each is a separate comparison.' + (r.partial ? ' A partial month has fewer items, which makes this check stricter, not looser.' : '') +
      (r.high.some(id => S.trend[id] && S.trend[id].kind === 'rising') ? ' Note: themes that have been rising for years clear an old baseline easily, so part of this is the long trend rather than a sudden cluster.' : '');
  }

  function renderLongView() {
    const L = S.LR, box = $('#longview');
    if (!L || !L.months || L.months.length < 120) { box.hidden = true; return; }
    const ids = L.archetypes, dec = {};
    L.months.forEach(m => { const d = m[0].slice(0, 3) + '0s'; const o = dec[d] || (dec[d] = { n: 0, c: ids.map(() => 0), months: 0 }); o.n += m[1]; o.months++; m[2].forEach((v, i) => o.c[i] += v); });
    const ds = Object.keys(dec).sort().filter(d => dec[d].months >= 24);
    if (ds.length < 3) { box.hidden = true; return; }
    const last = ds[ds.length - 1], prev = ds.slice(0, -1);
    const rows = ids.map((id, i) => {
      const sh = ds.map(d => dec[d].n ? dec[d].c[i] / dec[d].n : 0), before = prev.map(d => dec[d].n ? dec[d].c[i] / dec[d].n : 0);
      const avg = before.reduce((a, b) => a + b, 0) / before.length, ratio = avg ? sh[sh.length - 1] / avg : null;
      return { id, sh, ratio, mean: sh.reduce((a, b) => a + b, 0) / sh.length };
    }).filter(r => r.mean >= 0.002 && S.arch[r.id]).sort((a, b) => (b.ratio || 0) - (a.ratio || 0));
    const top = Math.max(...rows.flatMap(r => r.sh));
    $('#lv-table').innerHTML = '<thead><tr><th>Theme</th>' + ds.map(d => '<th>' + d + '</th>').join('') + '<th>' + last + ' vs. earlier decades</th></tr></thead><tbody>' +
      rows.map(r => '<tr><th>' + esc(S.arch[r.id].label) + '</th>' + r.sh.map(v => '<td style="--a:' + (0.08 + 0.8 * Math.sqrt(v / top)).toFixed(2) + '">' + (v * 100).toFixed(1) + '%</td>').join('') +
        '<td class="lv-r">' + (r.ratio == null ? 'n/a' : r.ratio >= 1.15 ? '<span class="up">' + r.ratio.toFixed(1) + '× higher</span>' : r.ratio <= 0.87 ? '<span class="down">' + r.ratio.toFixed(1) + '× (lower)</span>' : 'about the same') + '</td></tr>').join('') + '</tbody>';
    $('#lv-note').innerHTML = 'Share of New York Times headlines and abstracts touching each theme, by decade (' + esc(L.from) + ' to ' + esc(L.to) + ', ' + L.months.length.toLocaleString() + ' months' + (L.remaining ? '; ' + L.remaining + ' months still loading' : '') + '). This is a different lens from Wikipedia\'s log, so compare decades with each other, not with the numbers above. Data provided by The New York Times.';
    box.hidden = false;
  }

  function renderIndexWeek() {
    const w = weekEnding(S.ixDay), A = S.IX.archetypes, years = S.IX.baseline.from.slice(0, 4) + '–' + S.IX.baseline.to.slice(0, 4);
    const answer = w.convPct >= 97.5 ? ['Yes, unusual', 'rare'] : w.convPct >= 90 ? ['Busier than usual', 'high'] : w.convPct <= 10 ? ['Quieter than usual', 'low'] : ['No, fairly ordinary', 'normal'];
    $('#h-index').textContent = answer[0];
    $('#ix-answer').className = 'answer a-' + answer[1];
    $('#ix-lede').innerHTML = '<strong>' + w.conv + ' of ' + A.length + ' themes</strong> in the news for the week ending ' + esc(DAY_FMT(w.end)) + ' are running higher than normal. ' +
      (w.convPct != null ? (w.convPct >= 50 ? 'That many at once happens in fewer than ' + Math.max(1, 100 - w.convPct) + '% of weeks since ' + S.IX.baseline.from.slice(0, 4) + '.' : 'That is typical: most weeks since ' + S.IX.baseline.from.slice(0, 4) + ' have this many or more.') : '') +
      (w.conv ? '<span class="high-list">Running high: ' + w.arch.filter(a => a.elevated).sort((a, b) => b.pct - a.pct).map(a => esc(S.arch[a.id].label) + ' <em class="kind-' + S.trend[a.id].kind + '">(' + esc(KIND[S.trend[a.id].kind].short) + ')</em>').join(', ') + '.</span>' : '') +
      (S.IX.baseline.rule !== 'min2' || S.IX.baseline.windowing !== 'disjoint' ? '<span class="cons-note">Weekly percentiles here still come from overlapping 7-day windows (each day counted in up to seven windows), which overstates how many independent weeks we compared against. They switch to separate weeks at the next full data rebuild. The month check below has no overlap.</span>' : '');
    renderMonthCheck(w.end.slice(0, 7));
    const tile = (big, label, sub) => '<div class="stat-tile"><b>' + big + '</b><span>' + label + '</span><small>' + sub + '</small></div>';
    const vs = p => p == null ? '' : p >= 50 ? 'more than in ' + p + '% of weeks' : 'fewer than in ' + (100 - p) + '% of weeks';
    $('#ix-stats').innerHTML =
      tile(w.conv + '<i>/' + A.length + '</i>', 'Themes running high', esc(vs(w.convPct))) +
      tile(Math.round(w.resShare * 100) + '<i>%</i>', 'News matching a prophecy', 'items with match strength 20+ · ' + esc(vs(w.resPct))) +
      tile(w.fams + '<i>/7</i>', 'Traditions with a match', esc(vs(w.famPct))) +
      tile(w.n, 'News items read', 'from ' + w.days + ' days of Wikipedia\'s daily news log');
    drawRose(w);
    const sorted = w.arch.slice().sort((a, b) => (b.pct - a.pct) || (b.share - a.share));
    const show = S.ixAll ? sorted : sorted.slice(0, 8);
    $('#ix-arch-note').textContent = 'How much of this week\'s news touches each theme, compared with ' + years + '. The shaded bar is a normal week; the dot is this week.';
    $('#ix-arch').innerHTML = show.map(a => {
      const ar = S.arch[a.id], top = Math.max(S.IX.baseline.week[a.k][S.IX.qp.length - 2], a.share, 0.01) * 1.08;
      const L = v => Math.min(100, v / top * 100).toFixed(1);
      const tag = a.pct == null ? '' : a.pct >= 97.5 ? 'Rare high' : a.elevated ? 'High' : a.pct <= 10 ? 'Low' : 'Normal';
      return '<div class="ixa' + (a.elevated ? ' up' : '') + '"><span class="ixa-l">' + TXT(ar.glyph) + ' ' + esc(ar.label) + '</span><span class="ixa-bar" aria-hidden="true"><span class="rng" style="left:' + L(a.p10) + '%;width:' + (L(a.p90v) - L(a.p10)).toFixed(1) + '%"></span><span class="med" style="left:' + L(a.med) + '%"></span><span class="dot" style="left:' + L(a.share) + '%"></span></span><span class="ixa-n">' + Math.round(a.share * 100) + '%</span><span class="ixa-p">' + tag + '</span></div>';
    }).join('');
    $('#ix-arch-more').textContent = S.ixAll ? 'Show fewer' : 'Show all ' + A.length + ' themes';
  }


  /* ---------- rising, perennial, or just feels new ---------- */
  const KIND = {
    rising: { label: 'Rising for years', short: 'rising for years', note: 'A larger share of the news year after year, not just one bad year.' },
    perennial: { label: 'Always with us', short: 'a perennial theme', note: 'Roughly the same share every year. Spikes come and go around a steady level.' },
    waves: { label: 'Comes in waves', short: 'comes in waves', note: 'Long quiet stretches broken by huge spikes. A spike feels unprecedented, then fades.' },
    fading: { label: 'Fading', short: 'fading over the years', note: 'A smaller share of the news than it used to be.' },
    mixed: { label: 'No clear pattern', short: 'no clear pattern', note: 'Moves around without a steady direction.' },
    rare: { label: 'Too rare to tell', short: 'too rare to judge', note: 'Under 0.2% of news items, too few to measure a pattern.' }
  };
  function spark(t) {
    const v = t.yearly.map(x => x.share), max = Math.max.apply(null, v) || 1, W = 120, H = 34;
    const pts = v.map((x, i) => (i * W / (v.length - 1)).toFixed(1) + ',' + (H - 3 - x / max * (H - 8)).toFixed(1)).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polyline points="' + pts + '"/><circle cx="' + W + '" cy="' + (H - 3 - v[v.length - 1] / max * (H - 8)).toFixed(1) + '" r="2.6"/></svg>';
  }
  function renderPatterns() {
    const order = ['rising', 'perennial', 'waves', 'fading', 'mixed', 'rare'], T = Object.values(S.trend);
    const yr = T[0].yearly, span = yr[0].y + '–' + yr[yr.length - 1].y;
    const count = k => T.filter(t => t.kind === k).length;
    $('#pat-lede').innerHTML = 'Over ' + yr.length + ' years of news (' + esc(span) + '), <strong>' + count('rising') + ' themes are rising</strong>, ' + count('perennial') + ' are perennial, ' + count('waves') + ' come in waves and ' + count('fading') + ' are fading. ' + count('rare') + ' are too rare to judge.';
    const pct = x => (x * 100 < 1 ? (x * 100).toFixed(2) : (x * 100).toFixed(1)) + '%';
    const yrs = a => '<span class="nw">' + (a.length > 1 ? a[0] + '–' + a[a.length - 1].slice(2) : a[0]) + '</span>';
    $('#pat-grid').innerHTML = order.filter(k => count(k)).map(k => {
      const items = T.filter(t => t.kind === k).sort((a, b) => b.mean - a.mean);
      if (k === 'rare') return '<div class="pat-group pat-rare"><h3>' + esc(KIND[k].label) + '</h3><p class="meta">' + esc(KIND[k].note) + ' ' + items.map(t => esc(S.arch[t.id].label)).join(', ') + '.</p></div>';
      return '<div class="pat-group"><h3 class="kind-' + k + '">' + esc(KIND[k].label) + '</h3><p class="meta">' + esc(KIND[k].note) + '</p>' + items.map(t => {
        const detail = k === 'waves' ? 'Peaked at ' + pct(t.peak) + ' in ' + esc(new Date(t.peakMonth + '-15T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })) + '; a typical month is ' + pct(t.typical)
          : pct(t.first) + ' of news in ' + yrs(t.firstYears) + ' → ' + pct(t.last) + ' in ' + yrs(t.lastYears);
        return '<div class="pat"><span class="pat-l">' + TXT(S.arch[t.id].glyph) + ' ' + esc(S.arch[t.id].label) + (t.recordYear && k !== 'fading' ? ' <span class="rec">record year</span>' : '') + '</span>' + spark(t) + '<span class="pat-d">' + detail + '</span></div>';
      }).join('') + '</div>';
    }).join('');
  }

  function drawRose(w) {
    const svg = $('#rose'), cx = 200, cy = 200, R0 = 46, R = 168, n = w.arch.length;
    let h = '<g class="astro-geo"><circle cx="200" cy="200" r="' + R0 + '"/><circle cx="200" cy="200" r="' + (R0 + (R - R0) * 0.5) + '"/></g>';
    h += '<circle class="rose-p90" cx="200" cy="200" r="' + (R0 + (R - R0) * 0.9).toFixed(1) + '"/><circle class="astro-ring" cx="200" cy="200" r="' + R + '"/>';
    w.arch.forEach((a, i) => {
      const t0 = -Math.PI / 2 + (i - 0.42) * 2 * Math.PI / n, t1 = -Math.PI / 2 + (i + 0.42) * 2 * Math.PI / n;
      const r = R0 + (R - R0) * (a.pct == null ? 0 : a.pct / 100);
      const P = (rr, t) => (cx + rr * Math.cos(t)).toFixed(1) + ' ' + (cy + rr * Math.sin(t)).toFixed(1);
      h += '<path class="petal' + (a.elevated ? ' up' : '') + '" d="M' + P(R0, t0) + 'L' + P(r, t0) + 'A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + P(r, t1) + 'L' + P(R0, t1) + 'A' + R0 + ' ' + R0 + ' 0 0 0 ' + P(R0, t0) + 'Z"><title>' + esc(S.arch[a.id].label) + ': ' + (a.share * 100).toFixed(1) + '% of this week\'s news, ' + esc(pctTxt(a.pct)) + ' of weeks since 2016</title></path>';
      const tm = -Math.PI / 2 + i * 2 * Math.PI / n;
      h += '<text class="rose-g' + (a.elevated ? ' up' : '') + '" x="' + (cx + (R + 17) * Math.cos(tm)).toFixed(1) + '" y="' + (cy + (R + 17) * Math.sin(tm) + 4).toFixed(1) + '" text-anchor="middle">' + TXT(S.arch[a.id].glyph) + '</text>';
    });
    h += '<circle class="astro-core" cx="200" cy="200" r="' + (R0 - 2) + '"/><text class="astro-num" x="200" y="210">' + w.conv + '</text><text class="astro-cap" x="200" y="230">high</text>';
    svg.innerHTML = h;
  }

  function drawIndexFigures() { if (S.IX && S.IX.months) { drawYears(); drawHeat(); } }

  function drawYears() {
    const svg = $('#ix-years'), W = svg.clientWidth, H = svg.clientHeight; if (!W || !H) return;
    const yrs = {};
    S.IX.months.forEach(m => { const y = m[0].slice(0, 4); const o = yrs[y] || (yrs[y] = { n: 0, r: 0, months: 0 }); o.n += m[2]; o.r += m[4]; o.months++; });
    const keys = Object.keys(yrs).sort(), vals = keys.map(k => yrs[k].r / yrs[k].n), max = Math.max.apply(null, vals) * 1.15;
    const padL = 8, padB = 26, padT = 22, bw = (W - padL * 2) / keys.length;
    const cur = keys[keys.length - 1], small = W < 520;
    let h = '';
    keys.forEach((k, i) => {
      const v = vals[i], bh = (H - padB - padT) * v / max, x = padL + i * bw + bw * 0.18, y = H - padB - bh;
      h += '<rect class="yr' + (k === cur ? ' cur' : '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3"><title>' + k + ': ' + (v * 100).toFixed(1) + '% of ' + yrs[k].n.toLocaleString() + ' items</title></rect>';
      if (!small || i % 2 === 0 || k === cur) h += '<text class="yr-l" x="' + (x + bw * 0.32).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + (small ? "'" + k.slice(2) : k) + '</text>';
      if (!small || k === cur) h += '<text class="yr-v" x="' + (x + bw * 0.32).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle">' + (v * 100).toFixed(1) + '</text>';
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = h;
    const rank = vals.slice().sort((a, b) => b - a).indexOf(vals[vals.length - 1]) + 1;
    const lo = Math.min.apply(null, vals.slice(0, -1)), hi = Math.max.apply(null, vals.slice(0, -1));
    $('#ix-years-note').innerHTML = '<strong>' + esc(cur) + ' so far ranks ' + ordinal(rank) + ' of ' + keys.length + ' years.</strong> ' + (vals[vals.length - 1] * 100).toFixed(1) + '% of its news items match a prophecy; other years ranged from ' + (lo * 100).toFixed(1) + '% to ' + (hi * 100).toFixed(1) + '%. Close to the usual range, so far.';
  }

  function drawHeat() {
    const svg = $('#heat'), wrap = $('#heat-wrap'), W = svg.clientWidth, H = svg.clientHeight; if (!W || !H) return;
    const M = S.IX.months, A = S.IX.archetypes, B = S.IX.baseline;
    const small = W < 700, padL = small ? 30 : 150, padB = 22, padT = 4;
    const cw = (W - padL - 4) / M.length, ch = (H - padB - padT) / A.length;
    const base = M.filter(m => m[0] >= B.from.slice(0, 7) && m[0] <= B.to.slice(0, 7));
    const pctCell = A.map((id, k) => { const vals = base.map(m => m[3][k] / m[2]).sort((a, b) => a - b); return M.map(m => { const v = m[3][k] / m[2]; let lo = 0; while (lo < vals.length && vals[lo] < v) lo++; let hi = lo; while (hi < vals.length && vals[hi] === v) hi++; return { v, p: Math.round(100 * (lo + (hi - lo) / 2) / vals.length) }; }); });
    const col = p => p >= 97.5 ? '#8ef0ff' : p >= 90 ? '#cdbaff' : p >= 75 ? '#8f73ff' : p >= 50 ? '#5b3fd6' : p >= 25 ? '#33237d' : '#191242';
    let h = '';
    A.forEach((id, k) => {
      const y = padT + k * ch;
      h += '<text class="hm-l" x="' + (padL - 6) + '" y="' + (y + ch * 0.7).toFixed(1) + '" text-anchor="end">' + (small ? TXT(S.arch[id].glyph) : esc(S.arch[id].label)) + '</text>';
      M.forEach((m, j) => { h += '<rect x="' + (padL + j * cw).toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + (cw + 0.3).toFixed(2) + '" height="' + (ch - 1).toFixed(2) + '" fill="' + col(pctCell[k][j].p) + '"/>'; });
    });
    M.forEach((m, j) => { if (m[0].endsWith('-01')) h += '<line class="hm-y" x1="' + (padL + j * cw).toFixed(1) + '" x2="' + (padL + j * cw).toFixed(1) + '" y1="' + padT + '" y2="' + (H - padB + 4) + '"/><text class="hm-t" x="' + (padL + j * cw + 2).toFixed(1) + '" y="' + (H - 6) + '">' + (small ? "'" + m[0].slice(2, 4) : m[0].slice(0, 4)) + '</text>'; });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = h;
    const tip = $('#heat-tip');
    svg.onpointermove = ev => {
      const b = svg.getBoundingClientRect(), x = (ev.clientX - b.left) * W / b.width, y = (ev.clientY - b.top) * H / b.height;
      const j = Math.floor((x - padL) / cw), k = Math.floor((y - padT) / ch);
      if (j < 0 || j >= M.length || k < 0 || k >= A.length) { tip.hidden = true; return; }
      const c = pctCell[k][j], m = M[j];
      tip.innerHTML = '<b>' + esc(S.arch[A[k]].label) + ' · ' + esc(new Date(m[0] + '-15T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })) + '</b><span>' + (c.v * 100).toFixed(1) + '% of ' + m[2].toLocaleString() + ' news items · ' + (c.p >= 50 ? 'higher than ' + c.p + '% of months' : 'lower than ' + (100 - c.p) + '% of months') + ' in 2016–2025</span>';
      tip.hidden = false; const wb = wrap.getBoundingClientRect();
      tip.style.left = Math.min(ev.clientX - wb.left + 12, wb.width - 240) + 'px'; tip.style.top = Math.max(0, ev.clientY - wb.top - 60) + 'px';
    };
    svg.onpointerleave = () => { tip.hidden = true; };
  }

  function renderHighlights() {
    const H = S.IX.highlights || {}, days = Object.keys(H).sort().reverse();
    if (!days.length) { $('#ix-hl').innerHTML = '<p class="empty">No news items in the latest days matched a prophecy with strength 20 or more.</p>'; return; }
    $('#ix-hl').innerHTML = days.map(d => {
      const url = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(window.EschatonWiki ? window.EschatonWiki.dayTitle(d).replace(/ /g, '_') : 'Portal:Current_events');
      return '<section class="hl-day"><h3><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(DAY_FMT(d)) + '</a></h3>' + H[d].map(it =>
        '<article class="hl"><p class="hl-t">' + esc(it.t) + '</p>' + (it.topic || it.cat ? '<p class="meta">' + esc([it.cat, it.topic].filter(Boolean).join(' · ')) + '</p>' : '') +
        '<div class="arch-chips">' + it.a.map(k => S.arch[k] ? '<span class="arch sm">' + TXT(S.arch[k].glyph) + ' ' + esc(S.arch[k].label) + '</span>' : '').join('') + '</div>' +
        '<ul class="hl-m">' + it.m.map(m => S.byId[m[0]] ? '<li><button type="button" class="linkish" data-open="' + esc(m[0]) + '">' + esc(S.byId[m[0]].title) + '</button> <span class="meta">' + esc(S.byId[m[0]].tradition) + '</span> <span class="hl-s">resonance ' + m[1] + ' · weight ' + m[2] + '</span></li>' : '').join('') + '</ul></article>').join('') + '</section>';
    }).join('');
  }
  let ixResize; addEventListener('resize', () => { clearTimeout(ixResize); ixResize = setTimeout(() => { if (!$('#v-index').hidden) drawIndexFigures(); }, 150); });

  /* ---------- routing ---------- */
  const VIEWS = ['index', 'align', 'library', 'ledger', 'network', 'method'];
  function route() {
    const v = VIEWS.indexOf(location.hash.slice(1)) !== -1 ? location.hash.slice(1) : 'index';
    VIEWS.forEach(n => { $('#v-' + n).hidden = n !== v; });
    $$('.tabs a').forEach(a => { if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (v === 'network') ensureGraph();
    if (v === 'ledger') renderLedger();
    if (v === 'index') drawIndexFigures();
    window.scrollTo(0, 0);
  }

  /* ---------- events ---------- */
  function bind() {
    $('#align-form').addEventListener('submit', e => { e.preventDefault(); runAlign(); });
    $('#event').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); runAlign(); } });
    $$('[data-sort]').forEach(b => b.addEventListener('click', () => { S.sort = b.dataset.sort; renderResults(); }));
    $('#more-results').addEventListener('click', () => { S.showAll = true; renderResults(); });
    document.addEventListener('click', e => {
      const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openDrawer(o.dataset.open); return; }
      const l = e.target.closest('[data-log]'); if (l) { prefillLedger(l.dataset.log); return; }
      if (e.target.closest('[data-close]')) { closeDrawer(); return; }
      const lf = e.target.closest('[data-lf],[data-status]'); if (lf) { const s = lf.dataset.lf || lf.dataset.status; S.ledFilter = S.ledFilter === s && lf.dataset.status ? 'all' : s; renderLedger(); return; }
      const fam = e.target.closest('#lib-fams button'); if (fam) { S.libFam = fam.dataset.fam || null; renderLibrary(); return; }
      const nf = e.target.closest('[data-nf]'); if (nf) { const f = nf.dataset.nf; S.netHidden.has(f) ? S.netHidden.delete(f) : S.netHidden.add(f); renderNetFams(); if (S.graph) S.graph.setHidden(S.netHidden); return; }
      const ed = e.target.closest('[data-edit]'); if (ed) { startEdit(ed.dataset.edit); return; }
      const jm = e.target.closest('[data-jump]'); if (jm) { e.preventDefault(); const t2 = document.getElementById(jm.dataset.jump); if (t2) t2.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      const del = e.target.closest('[data-del]');
      if (del) {
        if (del.dataset.armed) { S.user = S.user.filter(u => u.id !== del.dataset.del); saveUser(); renderLedger(); msg('Entry deleted.'); }
        else { del.dataset.armed = '1'; del.textContent = 'Confirm delete'; setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = 'Delete'; } }, 4000); }
      }
    });
    document.addEventListener('change', e => {
      const s = e.target.closest('[data-status-of]'); if (!s) return;
      const u = S.user.find(x => x.id === s.dataset.statusOf); if (u) { u.status = s.value; saveUser(); renderLedger(); msg('Status updated.'); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });
    $('#lib-q').addEventListener('input', e => { S.libQ = e.target.value; renderLibrary(); });
    $('#add-form').addEventListener('submit', e => {
      e.preventDefault(); const f = e.target;
      if (f.resolveBy.value && f.madeOn.value && f.resolveBy.value < f.madeOn.value) { msg('The resolve-by date must come after the recorded date.'); f.resolveBy.focus(); return; }
      const pv = f.probability.value === '' ? null : Math.max(0, Math.min(100, Number(f.probability.value))) / 100;
      const fields = { claim: f.claim.value.trim(), criteria: f.criteria.value.trim(), madeBy: f.madeBy.value.trim(), madeOn: f.madeOn.value, resolveBy: f.resolveBy.value, prophecy: f.prophecy.value, evidence: f.evidence.value.trim(), probability: pv };
      const editing = f.dataset.editing && S.user.find(u => u.id === f.dataset.editing);
      if (editing) { editing.history = (editing.history || []).concat(editing.fp ? [{ fp: editing.fp, at: editing.editedAt || editing.createdAt }] : []); Object.assign(editing, fields, { editedAt: new Date().toISOString() }); editing.fp = draftFP(editing); }
      else { const d = Object.assign({ id: 'U-' + Date.now().toString(36), status: 'pending', createdAt: new Date().toISOString(), history: [] }, fields); d.fp = draftFP(d); S.user.unshift(d); }
      const ok = saveUser(); endEdit(); S.ledFilter = 'all'; renderLedger();
      msg((editing ? 'Saved changes; the earlier fingerprint is kept in its history. ' : 'Draft saved with a timestamp and fingerprint. ') + (ok ? 'It lives in this browser only; register it publicly or export JSON to keep it.' : 'This browser is not allowing storage, so export it to keep it.'));
    });
    $('#add-cancel').addEventListener('click', () => { endEdit(); msg('Editing cancelled.'); });
    $('#led-copy').addEventListener('click', () => {
      const txt = exportJSON();
      const fallback = () => { let ta = $('#led-fallback'); if (!ta) { ta = document.createElement('textarea'); ta.id = 'led-fallback'; ta.rows = 8; ta.readOnly = true; $('#led-msg').after(ta); } ta.value = txt; ta.select(); msg('Copying was blocked; the JSON is selected below.'); };
      try { navigator.clipboard.writeText(txt).then(() => msg('Predictions copied as JSON (' + allLedger().length + ' entries).'), fallback); } catch (e) { fallback(); }
    });
    $('#led-dl').addEventListener('click', () => {
      try { const url = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'eschaton-ledger-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); msg('Download started. If nothing appeared, this viewer blocks downloads; use Copy JSON.'); }
      catch (e) { msg('This viewer blocks downloads; use Copy JSON.'); }
    });
    $('#led-import').addEventListener('change', e => { const file = e.target.files[0]; if (!file) return; file.text().then(importJSON); e.target.value = ''; });
    addEventListener('hashchange', route);
  }

  /* ---------- boot ---------- */
  sky();
  load().then(d => {
    S.P = d.prophecies; S.A = d.archetypes; S.seed = d.ledger; S.IX = d.index; S.REG = d.registry || null; S.LR = d.longrange || null; S.config = d.config || {};
    S.P.forEach(p => S.byId[p.id] = p); S.A.forEach(a => S.arch[a.id] = a);
    const u = store.get(KEY_LEDGER, []); S.user = Array.isArray(u) ? u : [];
    buildAstro(); renderExamples(); renderLibrary(); fillProphecySelect(); renderNetFams(); bind();
    $('#add-form').madeOn.value = today();
    $('#event').value = store.get(KEY_EVENT, EXAMPLES[3][1]);
    runAlign(); initIndex(); route();
  }).catch(err => {
    console.error(err);
    $('#v-align').insertAdjacentHTML('afterbegin', '<div class="band"><p class="notice"><strong>The database could not be loaded.</strong> Serve this folder over HTTP (for example GitHub Pages, or <code>python3 -m http.server</code>) and reload.</p></div>');
  });
}
