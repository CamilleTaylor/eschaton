/* ESCHATON public prediction registry: an append-only, hash-chained log.
   Each entry = { seq, type, issued, body, prev, hash } where
     hash = SHA-256( canonical JSON of {seq, type, issued, body, prev} )
     prev = hash of the previous entry ('0'*64 for the first).
   Editing, deleting or reordering any past entry changes its hash and breaks every later link, so the
   whole history can be checked by anyone with this file. Git history and OpenTimestamps proofs of the
   chain head (data/stamps/) add independent evidence of *when* each entry existed.
   Pure JS SHA-256 so it runs identically in Node, in browsers, and from file://. */
(function (root) {
  'use strict';
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function utf8(str) { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str); return Uint8Array.from(Buffer.from(str, 'utf8')); }
  function sha256(str) {
    const msg = utf8(str), l = msg.length, nb = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(nb);
    b.set(msg); b[l] = 0x80; const bits = l * 8; for (let i = 0; i < 8; i++) b[nb - 1 - i] = Math.floor(bits / 2 ** (8 * i)) & 255;
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), w = new Uint32Array(64);
    const rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) { const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return Array.from(H, x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  // Canonical JSON: object keys sorted, no whitespace. Numbers and strings as JSON.stringify writes them.
  function canonical(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  const GENESIS = '0'.repeat(64);
  const hashEntry = e => sha256(canonical({ seq: e.seq, type: e.type, issued: e.issued, body: e.body, prev: e.prev }));
  function append(reg, type, body, issued) {
    const last = reg.entries[reg.entries.length - 1];
    const e = { seq: reg.entries.length + 1, type, issued: issued || new Date().toISOString(), body, prev: last ? last.hash : GENESIS };
    e.hash = hashEntry(e); reg.entries.push(e); reg.head = e.hash; return e;
  }
  function verify(reg) {
    const bad = []; let prev = GENESIS;
    reg.entries.forEach((e, i) => {
      const problems = [];
      if (e.seq !== i + 1) problems.push('sequence number out of order');
      if (e.prev !== prev) problems.push('link to the previous entry is broken');
      if (hashEntry(e) !== e.hash) problems.push('content does not match its hash');
      if (i && e.issued < reg.entries[i - 1].issued) problems.push('timestamp earlier than the previous entry');
      if (problems.length) bad.push({ seq: e.seq, problems });
      prev = e.hash;
    });
    if (reg.entries.length && reg.head && reg.head !== prev) bad.push({ seq: 'head', problems: ['head hash does not match the last entry'] });
    return { ok: !bad.length, count: reg.entries.length, head: prev, bad };
  }
  // Latest resolution for each registered entry (resolutions are later entries that point at an earlier hash).
  function resolved(reg) { const out = {}; reg.entries.filter(e => e.type === 'resolution').forEach(e => out[e.body.of] = e); return out; }
  const brier = (p, y) => +((p - y) ** 2).toFixed(4);

  const api = { sha256, canonical, GENESIS, hashEntry, append, verify, resolved, brier };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EschatonRegistry = api;
})(typeof window !== 'undefined' ? window : this);
