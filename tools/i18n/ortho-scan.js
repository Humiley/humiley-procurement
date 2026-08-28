#!/usr/bin/env node
//
// Vietnamese accent placement, checked by rule rather than against a list of words.
//
//   old style: mark on the SECOND vowel  -> hoá, khoá, xoá, thuỷ, luỹ, hoà, toà, khoẻ
//   new style: mark on the FIRST  vowel  -> hóa, khóa, xóa, thủy, lũy, hòa, tòa, khỏe
//
// Both are correct Vietnamese; using both in one product is the defect. The portal settled on the
// new style, and Procurement renders inside it as a native section, so the two catalogues have to
// agree — otherwise this tab says "Hoá đơn" while the chrome around it says "Hóa đơn".
//
// An old-style OPEN syllable is a plain o/u glide followed by an accented a/e/y that ends the
// syllable. Three things this must not get wrong:
//
//  * "qu" is a single onset digraph, so its u is not a glide and "quá" is correct either way. The
//    lookbehind has to sit against the glide itself; in front of an alternation that can consume
//    the q it tests the wrong character and reports every "quá" in the file.
//  * the syllable must be OPEN. "hoàn", "toàn", "khoán" and "suýt" carry the mark on the second
//    vowel in BOTH conventions. Rewriting those by substring is how the portal's first attempt at
//    this broke 156 words, so BAD below also refuses the shapes that mistake produces.
//  * the nucleus case needs no handling at all: "của" already carries the mark on the u, and this
//    looks for a PLAIN o/u, so it cannot match.
//
//   node tools/i18n/ortho-scan.js      exits non-zero if anything is found
const fs = require('fs');
const path = require('path');

const P = path.join(__dirname, '..', '..', 'messages', 'vi.json');
const j = JSON.parse(fs.readFileSync(P, 'utf8'));

const flat = [];
(function walk(o, at) {
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string') flat.push({ key: at.concat(k).join('.'), val: v });
    else if (v && typeof v === 'object') walk(v, at.concat(k));
  }
})(j, []);

const ACC = 'àáảãạèéẻẽẹỳýỷỹỵÀÁẢÃẠÈÉẺẼẸỲÝỶỸỴ';
const OLD = new RegExp('(?<![qQ])[ouOU][' + ACC + '](?![a-zà-ỹA-ZÀ-Ỹ])', 'gu');
const BAD = /hòan|tòan|khóan|súyt/i;

let corrupt = 0;
const hits = new Map();
for (const e of flat) {
  if (BAD.test(e.val)) { corrupt++; console.log('  CORRUPT  ' + e.key + '  ' + JSON.stringify(e.val)); }
  let m; OLD.lastIndex = 0;
  while ((m = OLD.exec(e.val))) {
    const start = e.val.slice(0, m.index).match(/[a-zà-ỹA-ZÀ-Ỹ]*$/)[0];
    const w = start + m[0];
    if (!hits.has(w)) hits.set(w, []);
    hits.get(w).push(e);
    OLD.lastIndex = m.index + 1;
  }
}
const rows = [...hits].sort((a, b) => b[1].length - a[1].length);
console.log('strings: ' + flat.length + '   corrupted syllables: ' + corrupt);
console.log('old-style OPEN syllables: ' + rows.length + ' distinct\n');
for (const [w, list] of rows) {
  list.forEach(e => console.log('  ' + w.padEnd(8) + ' ' + e.key.padEnd(26) + ' ' + JSON.stringify(e.val.slice(0, 44))));
}
if (!rows.length) console.log('  none — spelling matches the portal');
process.exit(rows.length || corrupt ? 1 : 0);
