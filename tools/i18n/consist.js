#!/usr/bin/env node
//
// One English string, two Vietnamese renderings. After spelling, this is the defect a native
// reader notices fastest: the same button called "Duyệt" on one screen and "Phê duyệt" on the next
// reads as two different products.
//
// ADVISORY. Most of what it prints is fine — the same English word often means two different
// things, and those SHOULD differ. Read each hit in its own context; do not sweep this list.
//
//   node tools/i18n/consist.js
const fs = require('fs');
const path = require('path');

const load = f => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'messages', f), 'utf8'));
  const out = [];
  (function walk(o, at) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string') out.push({ key: at.concat(k).join('.'), val: v });
      else if (v && typeof v === 'object') walk(v, at.concat(k));
    }
  })(j, []);
  return out;
};

const en = new Map(load('en.json').map(e => [e.key, e.val]));
const vi = load('vi.json');

const norm = s => s.toLowerCase().replace(/[:…]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.]+$/, '');

// group Vietnamese values by the English they translate
const byEn = new Map();
for (const e of vi) {
  const src = en.get(e.key);
  if (!src) continue;
  const k = norm(src);
  if (!k || k.split(' ').length > 4) continue;      // long sentences legitimately vary
  if (!byEn.has(k)) byEn.set(k, new Map());
  const m = byEn.get(k);
  if (!m.has(e.val)) m.set(e.val, []);
  m.get(e.val).push(e.key);
}

const rows = [];
for (const [src, m] of byEn) {
  if (m.size < 2) continue;
  const shapes = new Set([...m.keys()].map(v => norm(v)));
  if (shapes.size < 2) continue;                     // differ only by case/punctuation
  rows.push({ src, variants: [...m.entries()] });
}
rows.sort((a, b) => b.variants.length - a.variants.length || a.src.localeCompare(b.src));

console.log('English strings with more than one Vietnamese rendering: ' + rows.length + '\n');
for (const r of rows) {
  console.log('  "' + r.src + '"');
  r.variants.forEach(([v, ks]) => console.log('       ' + JSON.stringify(v).padEnd(30) + '  ' + ks.join(', ')));
}
if (!rows.length) console.log('  none');
