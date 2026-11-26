/* ESCHATON control corpus.
   Builds decoy prophecies by shuffling the parts of the real ones: each decoy keeps a real prophecy's
   evidence and specificity scores, but gets archetype weights moved to random other themes, keywords
   drawn at random from the whole pool, and markers borrowed from other prophecies.
   If news "matches" decoys about as often as it matches the real texts, the matcher is manufacturing
   associations rather than detecting anything specific to the prophecies. Deterministic (seeded). */
(function (root) {
  'use strict';
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function decoys(prophecies, archetypes, seed) {
    const r = rng(seed == null ? 20261126 : seed), ids = archetypes.map(a => a.id);
    const pool = [...new Set(prophecies.flatMap(p => p.keywords || []))];
    return prophecies.map((p, k) => {
      const others = prophecies.filter(q => q.id !== p.id);
      const own = new Set(p.keywords || []);
      const weights = Object.values(p.archetypes || {});
      const arch = {}; shuffle(ids, r).slice(0, weights.length).forEach((id, i) => arch[id] = weights[i]);
      const kw = shuffle(pool.filter(w => !own.has(w)), r).slice(0, (p.keywords || []).length);
      const markers = shuffle(others.flatMap(q => q.markers || []), r).slice(0, (p.markers || []).length);
      const donor = others[Math.floor(r() * others.length)];
      return {
        id: 'decoy-' + (k + 1), title: 'Decoy ' + (k + 1), family: p.family, decoy: true,
        archetypes: arch, keywords: kw, markers,
        specificity: p.specificity, evidence: p.evidence,
        contradictions: donor.contradictions || [], preconditions: donor.preconditions || []
      };
    });
  }

  const api = { rng, decoys };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EschatonControl = api;
})(typeof window !== 'undefined' ? window : this);
