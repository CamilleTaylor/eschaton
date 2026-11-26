/* Parser for Wikipedia's Portal:Current events daily pages (wikitext).
   Each leaf bullet becomes one news item; parent bullets become its topic. */
(function (root) {
  'use strict';
  function clean(s) {
    let t = String(s || '');
    t = t.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '');
    let prev; do { prev = t; t = t.replace(/\{\{[^{}]*\}\}/g, ''); } while (t !== prev);
    t = t.replace(/\[https?:[^\s\]]+(?:\s[^\]]*)?\]/g, '');           // external links = sources
    t = t.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '');
    t = t.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1');
    t = t.replace(/'{2,}/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
    return t.replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
  }
  function parseDay(wikitext) {
    const src = String(wikitext || '').replace(/<!--[\s\S]*?-->/g, '');
    const lines = src.split('\n');
    const bullets = []; let cat = '';
    for (const line of lines) {
      const h = line.match(/^\s*'''([^']+)'''\s*$/) || line.match(/^;\s*(.+)$/);
      if (h) { cat = clean(h[1]); continue; }
      const b = line.match(/^(\*+)\s*(.*)$/);
      if (b) bullets.push({ depth: b[1].length, text: clean(b[2]), cat: cat });
    }
    const items = [], stack = [];
    bullets.forEach((b, i) => {
      while (stack.length && stack[stack.length - 1].depth >= b.depth) stack.pop();
      const next = bullets[i + 1];
      const leaf = !next || next.depth <= b.depth;
      if (leaf && b.text.length >= 25) items.push({ t: b.text, cat: b.cat, topic: stack.map(s => s.text).filter(Boolean).join(' › ') });
      stack.push(b);
    });
    return items;
  }
  function dayTitle(d) { // d = 'YYYY-MM-DD'
    const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const [y, m, dd] = d.split('-').map(Number);
    return 'Portal:Current events/' + y + ' ' + M[m - 1] + ' ' + dd;
  }
  const api = { clean, parseDay, dayTitle };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EschatonWiki = api;
})(typeof window !== 'undefined' ? window : this);
