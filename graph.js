/* ESCHATON network graph: archetypes on an outer zodiac ring, prophecies held inside by springs. */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function Graph(host, opts) {
    this.host = host; this.opts = opts;
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'Network of prophecies linked to shared archetypes');
    host.appendChild(this.svg);
    this.tip = document.createElement('div'); this.tip.className = 'g-tip'; this.tip.hidden = true; host.appendChild(this.tip);
    this.hidden = new Set(); this.focus = null; this.match = null; this.raf = 0; this.alpha = 0;
    this.build(); this.bind();
    const self = this;
    this.ro = new ResizeObserver(function () { self.resize(); }); this.ro.observe(host);
  }

  Graph.prototype.build = function () {
    const o = this.opts;
    this.anodes = o.archetypes.map(function (a, i) { return { kind: 'a', id: a.id, a: a, i: i, x: 0, y: 0 }; });
    this.pnodes = o.prophecies.map(function (p, i) { return { kind: 'p', id: p.id, p: p, x: Math.cos(i) * 40, y: Math.sin(i * 1.7) * 40, vx: 0, vy: 0 }; });
    this.byId = {}; const self = this;
    this.anodes.concat(this.pnodes).forEach(function (n) { self.byId[n.id] = n; });
    this.edges = [];
    this.pnodes.forEach(function (n) {
      for (const k in n.p.archetypes) { const w = n.p.archetypes[k]; if (w >= 0.4 && self.byId[k]) self.edges.push({ s: n, t: self.byId[k], w: w }); }
    });
  };

  Graph.prototype.resize = function () {
    const W = this.host.clientWidth, H = this.host.clientHeight; if (!W || !H) return;
    this.W = W; this.H = H; this.cx = W / 2; this.cy = H / 2;
    this.R = W < 520 ? Math.min(W, H) / 2 - 30 : Math.min(W / 2 - 140, H / 2 - 44);
    const n = this.anodes.length, R = this.R, cx = this.cx, cy = this.cy;
    this.anodes.forEach(function (a, i) { const t = -Math.PI / 2 + i * 2 * Math.PI / n; a.t = t; a.x = cx + R * Math.cos(t); a.y = cy + R * Math.sin(t); });
    if (!this.placed) { const self = this; this.pnodes.forEach(function (p, i) { const t = i * 2.399; const r = R * 0.55 * Math.sqrt((i + 1) / self.pnodes.length); p.x = cx + r * Math.cos(t); p.y = cy + r * Math.sin(t); }); this.placed = true; }
    this.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    this.heat(1);
  };

  Graph.prototype.heat = function (a) {
    this.alpha = Math.max(this.alpha, a);
    if (this.raf) return;
    const self = this;
    const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = function () {
      const n = reduce ? 240 : 2;
      for (let i = 0; i < n && self.alpha > 0.01; i++) self.tick();
      self.render();
      if (self.alpha > 0.01) self.raf = requestAnimationFrame(step); else self.raf = 0;
    };
    this.raf = requestAnimationFrame(step);
  };

  Graph.prototype.tick = function () {
    const P = this.pnodes, R = this.R, cx = this.cx, cy = this.cy, al = this.alpha;
    for (const e of this.edges) {
      const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y; const d = Math.hypot(dx, dy) || 1;
      const target = R * 0.55; const f = (d - target) * 0.012 * e.w * al;
      e.s.vx += dx / d * f; e.s.vy += dy / d * f;
    }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j]; let dx = b.x - a.x, dy = b.y - a.y; let d2 = dx * dx + dy * dy || 1;
      const min = (R * 0.16) * (R * 0.16);
      if (d2 < min * 4) { const d = Math.sqrt(d2); const f = (R * 2.2 / d2) * al; dx /= d; dy /= d; a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f; }
    }
    for (const p of P) {
      if (p.fixed) { p.vx = p.vy = 0; continue; }
      p.vx += (cx - p.x) * 0.004 * al; p.vy += (cy - p.y) * 0.004 * al;
      p.vx *= 0.82; p.vy *= 0.82; p.x += p.vx; p.y += p.vy;
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy), lim = R * 0.82;
      if (d > lim) { p.x = cx + dx / d * lim; p.y = cy + dy / d * lim; }
    }
    this.alpha *= 0.985;
  };

  Graph.prototype.neighbors = function (id) {
    const s = new Set([id]);
    this.edges.forEach(function (e) { if (e.s.id === id) s.add(e.t.id); if (e.t.id === id) s.add(e.s.id); });
    return s;
  };

  Graph.prototype.render = function () {
    if (!this.W) return;
    const self = this, R = this.R, cx = this.cx, cy = this.cy, fam = this.opts.familyColor, small = this.W < 520;
    const visible = function (n) { return n.kind === 'a' || !self.hidden.has(n.p.family); };
    const lit = this.focus ? this.neighbors(this.focus) : null;
    const m = this.match;
    let h = '';
    // sacred geometry ring
    h += '<g class="g-geo">';
    for (let k = 1; k <= 3; k++) h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * k / 3).toFixed(1) + '"/>';
    const n = this.anodes.length; let poly = '';
    for (let i = 0; i < n; i++) { const a = this.anodes[(i * 5) % n]; poly += (i ? 'L' : 'M') + a.x.toFixed(1) + ' ' + a.y.toFixed(1); }
    h += '<path d="' + poly + 'Z"/></g>';
    // edges
    h += '<g class="g-edges">';
    for (const e of this.edges) {
      if (!visible(e.s)) continue;
      let cls = 'e';
      if (lit) cls += lit.has(e.s.id) && lit.has(e.t.id) && (e.s.id === this.focus || e.t.id === this.focus) ? ' on' : ' dim';
      else if (m) cls += m.arch[e.t.id] && m.score[e.s.id] ? ' on' : ' dim';
      h += '<line class="' + cls + '" x1="' + e.s.x.toFixed(1) + '" y1="' + e.s.y.toFixed(1) + '" x2="' + e.t.x.toFixed(1) + '" y2="' + e.t.y.toFixed(1) + '" style="stroke-width:' + (0.4 + e.w * 1.2).toFixed(2) + '"/>';
    }
    if (m) {
      h += '<circle class="g-event" cx="' + cx + '" cy="' + cy + '" r="' + (small ? 9 : 13) + '"/>';
      for (const id in m.score) { const p = this.byId[id]; if (!p || !visible(p)) continue; h += '<line class="e ev" x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" style="stroke-width:' + (0.6 + m.score[id] / 30).toFixed(2) + '"/>'; }
    }
    h += '</g>';
    // archetype nodes
    for (const a of this.anodes) {
      const on = lit ? lit.has(a.id) : m ? !!m.arch[a.id] : true;
      const lx = cx + (R + (small ? 16 : 22)) * Math.cos(a.t), ly = cy + (R + (small ? 16 : 22)) * Math.sin(a.t);
      const anchor = Math.abs(Math.cos(a.t)) < 0.3 ? 'middle' : Math.cos(a.t) > 0 ? 'start' : 'end';
      h += '<g class="g-a' + (on ? '' : ' dim') + (m && m.arch[a.id] ? ' hot' : '') + '" data-id="' + a.id + '" tabindex="0"><circle cx="' + a.x.toFixed(1) + '" cy="' + a.y.toFixed(1) + '" r="' + (small ? 7 : 10) + '"/>';
      h += '<text class="glyph" x="' + a.x.toFixed(1) + '" y="' + (a.y + 4).toFixed(1) + '" text-anchor="middle">' + esc(a.a.glyph) + '</text>';
      if (!small) h += '<text class="lbl" x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(a.a.label) + '</text>';
      h += '</g>';
    }
    // prophecy nodes
    for (const p of this.pnodes) {
      if (!visible(p)) continue;
      const on = lit ? lit.has(p.id) : m ? !!m.score[p.id] : true;
      const r = (small ? 5 : 7) + (m && m.score[p.id] ? m.score[p.id] / 12 : 0);
      h += '<g class="g-p' + (on ? '' : ' dim') + (this.focus === p.id ? ' sel' : '') + '" data-id="' + p.id + '" tabindex="0"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r.toFixed(1) + '" style="fill:' + fam[p.p.family] + '"/>';
      if ((lit && lit.has(p.id)) || (m && m.top && m.top.indexOf(p.id) !== -1)) h += '<text class="plbl" x="' + p.x.toFixed(1) + '" y="' + (p.y - r - 6).toFixed(1) + '" text-anchor="middle">' + esc(p.p.title.length > 30 ? p.p.title.slice(0, 28) + '…' : p.p.title) + '</text>';
      h += '</g>';
    }
    this.svg.innerHTML = h;
  };

  Graph.prototype.bind = function () {
    const self = this; let drag = null;
    const pt = function (ev) { const b = self.svg.getBoundingClientRect(); return { x: (ev.clientX - b.left) * self.W / b.width, y: (ev.clientY - b.top) * self.H / b.height }; };
    const nodeOf = function (ev) { const g = ev.target.closest && ev.target.closest('[data-id]'); return g ? self.byId[g.getAttribute('data-id')] : null; };
    this.svg.addEventListener('pointerdown', function (ev) {
      const n = nodeOf(ev); if (!n || n.kind !== 'p') return;
      drag = { n: n, moved: false }; n.fixed = true; self.svg.setPointerCapture(ev.pointerId);
    });
    this.svg.addEventListener('pointermove', function (ev) {
      if (drag) { const q = pt(ev); drag.n.x = q.x; drag.n.y = q.y; drag.moved = true; self.heat(0.3); return; }
      const n = nodeOf(ev);
      if (!n) { self.tip.hidden = true; return; }
      const b = self.host.getBoundingClientRect();
      self.tip.innerHTML = n.kind === 'p'
        ? '<b>' + esc(n.p.title) + '</b><span>' + esc(n.p.tradition) + ' · ' + esc(n.p.date.label) + '</span>' + (self.match && self.match.score[n.id] != null ? '<span>Predictive weight ' + self.match.score[n.id] + '</span>' : '')
        : '<b>' + esc(n.a.glyph + ' ' + n.a.label) + '</b><span>' + self.edges.filter(function (e) { return e.t.id === n.id; }).length + ' linked prophecies</span>';
      self.tip.hidden = false;
      const x = ev.clientX - b.left + 14, y = ev.clientY - b.top + 14;
      self.tip.style.left = Math.min(x, b.width - 230) + 'px'; self.tip.style.top = Math.min(y, b.height - 80) + 'px';
    });
    const up = function () {
      if (!drag) return; const n = drag.n; n.fixed = false;
      if (!drag.moved) self.select(n.id);
      drag = null; self.heat(0.2);
    };
    this.svg.addEventListener('pointerup', up);
    this.svg.addEventListener('pointercancel', up);
    this.svg.addEventListener('pointerleave', function () { self.tip.hidden = true; });
    this.svg.addEventListener('click', function (ev) { const n = nodeOf(ev); if (n && n.kind === 'a') self.select(n.id); if (!n) self.select(null); });
    this.svg.addEventListener('keydown', function (ev) { if (ev.key !== 'Enter' && ev.key !== ' ') return; const n = nodeOf(ev); if (n) { ev.preventDefault(); self.select(n.id); } });
  };

  Graph.prototype.select = function (id) {
    this.focus = id && this.focus !== id ? id : null; this.render();
    if (this.opts.onSelect) this.opts.onSelect(this.focus ? this.byId[this.focus] : null);
  };
  Graph.prototype.setHidden = function (set) { this.hidden = set; this.render(); };
  Graph.prototype.setMatch = function (m) { this.match = m; this.render(); };

  root.EschatonGraph = Graph;
})(window);
