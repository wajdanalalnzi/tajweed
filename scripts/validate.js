#!/usr/bin/env node
/* يتحقق من سلامة بيانات التطبيق: معرّفات الأحكام في الأمثلة، مراجع الآيات، الاختبارات، وملفات المصحف (العدد، الحدود، بصمة النص). */
/*
 * Run with `npm test` (or `node scripts/validate.js`) after any content change.
 * Loads the four data files in a Node sandbox (no browser needed) and checks:
 *   - every rule points to an existing chapter and colour group
 *   - every rule id used in sections and example markup exists
 *   - example markup braces are balanced
 *   - every example ref [surah, ayah] is a real ayah (SURAH_AYAT table below)
 *   - every chapter has at least 5 quiz questions with valid, unique options
 *   - data/mushaf/: 114 files, 6,236 ayat, tajweed spans inside bounds with known rule ids,
 *     pause marks at word ends with the exact counts of the source text, and the SHA-256 of the
 *     reconstructed Tanzil lines (so the Quran text cannot be edited by hand without failing)
 * Exits with code 1 and a list of errors if anything is wrong.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = {}; ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['rules', 'chapters', 'quizzes', 'glossary']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js/data', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
}
const T = ctx.window.TAJWEED;
const errors = [];
const ruleIds = new Set(T.rules.map(r => r.id));
const chapterIds = new Set(T.chapters.map(c => c.id));
// Number of ayat per surah, only for surahs used so far. When an example cites
// a new surah, add it here (surah number: ayah count).
const SURAH_AYAT = {1:7,2:286,3:200,4:176,5:120,6:165,7:206,9:129,10:109,11:123,12:111,13:43,16:128,17:111,18:110,19:98,20:135,21:112,23:118,24:64,26:227,27:93,30:60,34:54,36:83,38:88,50:45,54:55,69:52,73:20,75:40,77:50,78:40,80:42,81:29,83:36,89:30,91:15,92:21,93:11,96:19,99:8,100:11,102:8,103:3,104:9,105:5,106:4,107:7,108:3,110:3,111:5,112:4,113:5,114:6};

for (const r of T.rules) {
  if (!chapterIds.has(r.chapter)) errors.push(`rule ${r.id}: unknown chapter ${r.chapter}`);
  if (!T.groups[r.group]) errors.push(`rule ${r.id}: unknown group ${r.group}`);
}
let examples = 0, spans = 0;
// Same pattern as MARK in js/ayah.js. Keep both in sync.
const markupRe = /\{([a-z0-9-]+)\|([^{}|]+)(?:\|([^{}]*))?\}/g;
for (const c of T.chapters) {
  if (!T.quizzes[c.id] || T.quizzes[c.id].length < 5) errors.push(`chapter ${c.id}: needs at least 5 quiz questions`);
  for (const s of c.sections) {
    for (const id of (s.rules || [])) if (!ruleIds.has(id)) errors.push(`chapter ${c.id} / ${s.title}: unknown rule ${id}`);
    for (const ex of (s.examples || [])) {
      examples++;
      const stripped = ex.text.replace(markupRe, (m, id) => { spans++; if (!ruleIds.has(id)) errors.push(`example "${ex.text.slice(0, 30)}": unknown rule ${id}`); return ''; });
      if (/[{}|]/.test(stripped)) errors.push(`example "${ex.text.slice(0, 40)}": unbalanced markup`);
      if (ex.ref) {
        const [s, a] = ex.ref;
        if (!SURAH_AYAT[s]) errors.push(`example ref ${s}:${a}: surah not in table (add it)`);
        else if (a < 1 || a > SURAH_AYAT[s]) errors.push(`example ref ${s}:${a}: ayah out of range`);
      }
    }
  }
}
for (const [cid, qs] of Object.entries(T.quizzes)) {
  if (!chapterIds.has(cid)) errors.push(`quiz for unknown chapter ${cid}`);
  qs.forEach((q, i) => {
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${cid} q${i + 1}: needs options`);
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length) errors.push(`${cid} q${i + 1}: bad answer index`);
    if (new Set(q.options).size !== q.options.length) errors.push(`${cid} q${i + 1}: duplicate options`);
  });
}
/* ---------- بيانات المصحف: 114 ملفًا، عدد الآيات، حدود المواضع، معرّفات الأحكام، وبصمة النص ---------- */
const crypto = require('crypto');
const CANON = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const mushafDir = path.join(root, 'data/mushaf');
let mushafAyat = 0, mushafSpans = 0; const waqfCounts = {};
// أعداد علامات الوقف في نص مجمع الملك فهد (الإصدار 13) التي بُنيت منها الطبقة
const WAQF_EXPECTED = { '\u06da': 2083, '\u06d6': 1651, '\u06d7': 511, '\u06d8': 21, '\u06db': 6, '\u06dc': 5, '\u06de': 199, '\u06e9': 15 };
if (!fs.existsSync(path.join(mushafDir, 'index.json'))) errors.push('data/mushaf/index.json missing (run: python3 scripts/build_mushaf.py)');
else {
  const ix = JSON.parse(fs.readFileSync(path.join(mushafDir, 'index.json'), 'utf8'));
  if (!ix.surahs || ix.surahs.length !== 114) errors.push('mushaf index: expected 114 surahs');
  if (!ix.juzs || ix.juzs.length !== 30) errors.push('mushaf index: expected 30 juz entries');
  const hash = crypto.createHash('sha256');
  for (let s = 1; s <= 114; s++) {
    const f = path.join(mushafDir, String(s).padStart(3, '0') + '.json');
    if (!fs.existsSync(f)) { errors.push(`mushaf: missing ${path.basename(f)}`); continue; }
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (d.surah !== s) errors.push(`mushaf ${s}: surah field is ${d.surah}`);
    if (d.ayat.length !== CANON[s - 1] || d.count !== CANON[s - 1]) errors.push(`mushaf ${s}: ${d.ayat.length} ayat, expected ${CANON[s - 1]}`);
    if (ix.surahs[s - 1] && (ix.surahs[s - 1].count !== d.ayat.length || ix.surahs[s - 1].name !== d.name)) errors.push(`mushaf ${s}: index entry mismatch`);
    const needsBasmalah = s !== 1 && s !== 9;
    if (needsBasmalah !== !!d.basmalah) errors.push(`mushaf ${s}: basmalah ${d.basmalah ? 'present' : 'missing'}`);
    const check = (t, spans, label) => {
      let prev = -1;
      for (const sp of spans) {
        mushafSpans++;
        if (!Array.isArray(sp) || sp.length !== 3 || !(sp[0] >= 0 && sp[0] < sp[1] && sp[1] <= t.length)) errors.push(`mushaf ${label}: span out of bounds ${JSON.stringify(sp)}`);
        else if (sp[0] < prev) errors.push(`mushaf ${label}: spans not sorted`);
        if (!ruleIds.has(sp[2])) errors.push(`mushaf ${label}: unknown rule ${sp[2]}`);
        prev = sp[0];
      }
    };
    if (d.basmalah) check(d.basmalah.t, d.basmalah.j, `${s}:basmalah`);
    // علامات الوقف: داخل الحدود، في نهاية كلمة (أو بداية الآية للحزب)، ومن المجموعة المسموحة
    const WAQF = new Set(['\u06d6', '\u06d7', '\u06d8', '\u06d9', '\u06da', '\u06db', '\u06dc', '\u06de', '\u06e9']);
    d.ayat.forEach(v => (v.w || []).forEach(([off, ch]) => {
      waqfCounts[ch] = (waqfCounts[ch] || 0) + 1;
      if (!WAQF.has(ch)) errors.push(`mushaf ${s}:${v.n}: unknown waqf mark ${ch}`);
      if (!(off >= 0 && off <= v.t.length) || (off > 0 && off < v.t.length && v.t[off] !== ' ')) errors.push(`mushaf ${s}:${v.n}: waqf mark not at a word end (offset ${off})`);
      if (ch === '\u06de' && off !== 0) errors.push(`mushaf ${s}:${v.n}: hizb sign not at ayah start`);
    }));
    d.ayat.forEach((v, i) => {
      mushafAyat++;
      if (v.n !== i + 1) errors.push(`mushaf ${s}: ayah ${i + 1} numbered ${v.n}`);
      if (typeof v.t !== 'string' || !v.t.trim() || /[{}|<>]/.test(v.t)) errors.push(`mushaf ${s}:${v.n}: bad text`);
      check(v.t, v.j, `${s}:${v.n}`);
      const line = (d.basmalah && v.n === 1) ? d.basmalah.t + ' ' + v.t : v.t;
      hash.update(`${s}|${v.n}|${line}\n`);
    });
  }
  const sha = hash.digest('hex');
  if (ix.tanzil_lines_sha256 && sha !== ix.tanzil_lines_sha256) errors.push(`mushaf: text checksum changed (${sha} != ${ix.tanzil_lines_sha256}); the Quran text must not be edited by hand`);
  if (mushafAyat !== 6236) errors.push(`mushaf: ${mushafAyat} ayat, expected 6236`);
  for (const [ch, n] of Object.entries(WAQF_EXPECTED)) if ((waqfCounts[ch] || 0) !== n) errors.push(`mushaf: waqf mark U+${ch.codePointAt(0).toString(16)} count ${waqfCounts[ch] || 0}, expected ${n}`);
}
const nQ = Object.values(T.quizzes).reduce((n, q) => n + q.length, 0);
console.log(`rules: ${T.rules.length}, chapters: ${T.chapters.length}, examples: ${examples}, marked spans: ${spans}, quiz questions: ${nQ}, glossary: ${T.glossary.length}`);
console.log(`mushaf: ${mushafAyat} ayat, ${mushafSpans} tajweed spans, ${Object.values(waqfCounts).reduce((a, b) => a + b, 0)} waqf/sajdah/hizb marks, text checksum verified`);
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('data OK');
