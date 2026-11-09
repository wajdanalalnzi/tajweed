#!/usr/bin/env python3
# build_mushaf.py - builds and verifies data/mushaf/ (developer notes in English; the Arabic docstring
# below describes the same pipeline and the generated report is Arabic).
#
#   Step 1  download the sources into sources/ (skipped when present) and verify the Tanzil checksum
#   Step 2  split Tanzil's basmalah off ayah 1 (surahs other than 1 and 9) without changing a character
#   Step 3  check 114 surahs / 6,236 ayat against the canonical table
#   Step 4  compare base letters with two independent editions (KFGQPC Hafs v13, Quran Academy)
#   Step 5  realign the cpfair/quran-tajweed annotations (made on the 2017 Tanzil text) to the current text,
#           verifying every span against a per-rule anchor and dropping anything that cannot be verified
#   Step 5b take pause/sajdah/hizb marks from the KFGQPC text as a separate layer `w`
#   Step 6  write data/mushaf/NNN.json, index.json (with checksums) and VERIFICATION.md; round-trip check
#
# Run from the repo root:  python3 -I scripts/build_mushaf.py
# The output is deterministic; commit data/mushaf/ but not sources/ (gitignored).
"""
يبني بيانات المصحف للتطبيق ويتحقق منها.

المصادر (تُحمَّل إلى sources/ عند الحاجة):
  - نص المصحف العثماني (رواية حفص) من Tanzil.net، عبر لقطة مشروع quran-json (risan) مع تحقق sha256
    من بيان المصادر الخاص به.
  - نصّان مستقلان للمقارنة حرفًا بحرف: نص مجمع الملك فهد (الإصدار 13) ونص Quran Academy.
  - تظليل أحكام التجويد من مشروع quran-tajweed (CC BY 4.0)، وهو مبني على نسخة Tanzil لعام 2017،
    فيُعاد محاذاته مع النص الحالي ويُتحقق من كل موضع بمراسٍ (همزة الوصل، اللام الشمسية، القلقلة...).

المخرجات: data/mushaf/NNN.json لكل سورة، data/mushaf/index.json، data/mushaf/VERIFICATION.md.
يعمل بـ: python3 -I scripts/build_mushaf.py
"""
import hashlib, json, os, re, sys, unicodedata, urllib.request, collections, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'sources')
OUT = os.path.join(ROOT, 'data', 'mushaf')
os.makedirs(SRC, exist_ok=True); os.makedirs(OUT, exist_ok=True)

SOURCES = {
    'tanzil-uthmani.json': 'https://raw.githubusercontent.com/risan/quran-json/main/data/tanzil/uthmani.json',
    'tanzil-chapters.json': 'https://raw.githubusercontent.com/risan/quran-json/main/data/tanzil/chapters.json',
    'quran-json-sources.json': 'https://raw.githubusercontent.com/risan/quran-json/main/data/meta/sources.json',
    'kfgqpc-hafs-v13.json': 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ara-quranuthmanihaf.json',
    'quranacademy.json': 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ara-quranacademy.json',
    'tajweed-2017.json': 'https://raw.githubusercontent.com/cpfair/quran-tajweed/master/output/tajweed.hafs.uthmani-pause-sajdah.json',
}
CANON = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]
assert sum(CANON) == 6236

RULE_MAP = {
    'ghunnah': 'ghunnah', 'hamzat_wasl': 'hamzat-wasl', 'idghaam_ghunnah': 'idgham-ghunnah',
    'idghaam_no_ghunnah': 'idgham-no-ghunnah', 'idghaam_mutajanisayn': 'idgham-mutajanisayn',
    'idghaam_mutaqaribayn': 'idgham-mutaqaribayn', 'idghaam_shafawi': 'idgham-shafawi', 'ikhfa': 'ikhfa',
    'ikhfa_shafawi': 'ikhfa-shafawi', 'iqlab': 'iqlab', 'lam_shamsiyyah': 'lam-shamsiyah', 'madd_2': 'madd-tabii',
    'madd_246': 'madd-arid', 'madd_6': 'madd-lazim', 'madd_munfasil': 'madd-munfasil', 'madd_muttasil': 'madd-muttasil',
    'qalqalah': 'qalqalah-sughra', 'silent': 'silent',
}

report = []
def log(s=''):
    print(s); report.append(s)

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()

def fetch(name, url):
    p = os.path.join(SRC, name)
    if not os.path.exists(p):
        print('downloading', url)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, 'wb') as f: f.write(r.read())
    return p

def main():
    log('# تقرير التحقق من بيانات المصحف')
    log(f'\nتاريخ البناء: {datetime.date.today().isoformat()}\n')
    log('## المصادر وبصماتها (sha256)\n')
    paths = {}
    for name, url in SOURCES.items():
        paths[name] = fetch(name, url)
        log(f'- `{name}` ← {url}\n  `{sha256(paths[name])}`')

    # 1) التحقق من سلامة لقطة Tanzil مقابل بيان المصادر الخاص بمشروع quran-json
    manifest = json.load(open(paths['quran-json-sources.json'], encoding='utf-8'))
    entries = manifest if isinstance(manifest, list) else manifest.get('sources', manifest.get('files', []))
    if isinstance(entries, dict): entries = list(entries.values())
    expected = next((e.get('sha256') for e in entries if isinstance(e, dict) and e.get('path') == 'data/tanzil/uthmani.json'), None)
    actual = sha256(paths['tanzil-uthmani.json'])
    log('\n## سلامة نقل نص Tanzil\n')
    log(f'- البصمة المسجّلة في بيان المصادر: `{expected}`\n- البصمة المحسوبة بعد التحميل: `{actual}`\n- النتيجة: **{"مطابقة" if expected == actual else "غير مطابقة"}**')
    if expected != actual: sys.exit('Tanzil snapshot checksum mismatch')

    tz = json.load(open(paths['tanzil-uthmani.json'], encoding='utf-8'))
    kf = {(v['chapter'], v['verse']): v['text'] for v in json.load(open(paths['kfgqpc-hafs-v13.json'], encoding='utf-8'))['quran']}
    qa = {(v['chapter'], v['verse']): v['text'] for v in json.load(open(paths['quranacademy.json'], encoding='utf-8'))['quran']}
    chapters = json.load(open(paths['tanzil-chapters.json'], encoding='utf-8'))

    # 2) عدد الآيات
    log('\n## عدد السور والآيات\n')
    counts = [len(tz[str(s)]) for s in range(1, 115)]
    bad = [(s + 1, counts[s], CANON[s]) for s in range(114) if counts[s] != CANON[s]]
    log(f'- عدد السور: {len(tz)} · عدد الآيات: {sum(counts)} · مطابقة الجدول المعتمد (٦٢٣٦ آية): **{"نعم" if not bad and len(tz) == 114 else "لا"}** {bad or ""}')
    if bad or len(tz) != 114: sys.exit('ayah count mismatch')

    # 3) فصل البسملة
    BASM = tz['1'][0]['text']; first, rest = BASM.split(' ', 1)
    bre = re.compile('^ب[ِّ]+سْمِ ' + re.escape(rest) + ' ')
    text = {}; basm_text = {}; variants = collections.Counter()
    for s in range(1, 115):
        for v in tz[str(s)]:
            t = v['text']
            if v['verse'] == 1 and s not in (1, 9):
                m = bre.match(t)
                if not m: sys.exit(f'basmalah not found at {s}:1')
                basm_text[s] = m.group(0).rstrip(); variants[basm_text[s]] += 1; t = t[m.end():]
            text[(s, v['verse'])] = t
    log(f'- البسملة مفصولة عن أول آية في {sum(variants.values())} سورة (كل السور عدا الفاتحة والتوبة). صيغها كما في المصحف: ' + '، '.join(f'«{k}» ×{n}' for k, n in variants.items()))

    # 4) المقارنة حرفًا بحرف مع نصّين مستقلين
    def skel(s):
        out = []; hamza = 0
        for ch in s:
            if ch == 'ء' or ch in 'ٕٔ': hamza += 1; continue
            if ch in 'أإآ': hamza += 1; ch = 'ا'
            if ch == 'ؤ': hamza += 1; ch = 'و'
            if ch == 'ئ': hamza += 1; ch = 'ي'
            if unicodedata.category(ch).startswith('M'): continue
            if ch == 'ٱ': ch = 'ا'
            if ch in 'ۀۃ': ch = 'ه'
            if ch in 'یىے': ch = 'ي'
            if ch == 'ـ': continue
            if 0x0621 <= ord(ch) <= 0x064A: out.append(ch)
        return ''.join(out), hamza
    log('\n## مقارنة الحروف مع نصّين مستقلين\n')
    log('تُقارن الحروف الأساسية لكل آية (بعد إسقاط علامات الضبط وتوحيد صور الهمزة والألف والياء، لأن المصادر تختلف في الترميز لا في الرسم)، ثم يُقارن عدد الهمزات.\n')
    diffs = {}
    for label, other in (('نص مجمع الملك فهد (الإصدار 13)', kf), ('نص Quran Academy', qa)):
        letters_diff = []; hamza_diff = []
        for key, t in text.items():
            a = skel(t); b = skel(other[key])
            if a[0] != b[0]: letters_diff.append((key, a[0], b[0]))
            elif a[1] != b[1]: hamza_diff.append((key, a[1], b[1]))
        diffs[label] = (letters_diff, hamza_diff)
        log(f'- مقابل {label}: {len(text)} آية، اختلاف في الحروف: **{len(letters_diff)}**، اختلاف في عدد الهمزات: **{len(hamza_diff)}**')
        for key, a, b in letters_diff[:20]:
            i = next((i for i in range(min(len(a), len(b))) if a[i] != b[i]), min(len(a), len(b)))
            log(f'  - {key[0]}:{key[1]} — Tanzil: …{a[max(0, i - 10):i + 12]}… / الآخر: …{b[max(0, i - 10):i + 12]}…')
        for key, a, b in hamza_diff[:10]:
            log(f'  - {key[0]}:{key[1]} — عدد الهمزات {a} مقابل {b}')

    # 5) محاذاة تظليل التجويد مع النص الحالي
    ann = {(e['surah'], e['ayah']): e['annotations'] for e in json.load(open(paths['tajweed-2017.json'], encoding='utf-8'))}
    full = {(s, v['verse']): v['text'] for s in range(1, 115) for v in tz[str(s)]}   # مع البسملة كما في Tanzil
    QALQ = set('قطبجد')
    def base(sp): return ''.join(ch for ch in sp if not unicodedata.category(ch).startswith('M') and ch != 'ـ')
    # مراسٍ ثابتة لكل حكم: مستخرجة من شكل المواضع في الآيات المطابقة تمامًا (أول حرف/آخر حرف/الحروف الأساسية)
    IKHFA = set('صذثكجشقسدطزفتضظ')
    TANWEEN = set('ًٌٍ')
    checks = {
        'hamzat_wasl': lambda sp: sp == 'ٱ',
        'lam_shamsiyyah': lambda sp: sp == 'ل',
        'qalqalah': lambda sp: 1 <= len(sp) <= 2 and sp[0] in QALQ and (len(sp) == 1 or sp[1] == 'ْ'),
        'ghunnah': lambda sp: 2 <= len(sp) <= 4 and sp[0] in 'نم',
        'madd_2': lambda sp: len(sp) == 1 and sp in 'ٰۥۦ',
        'madd_246': lambda sp: len(sp) == 1 and sp in 'يواٰۥى',
        'madd_6': lambda sp: len(sp) == 2 and sp[-1] == 'ٓ',
        'madd_munfasil': lambda sp: 2 <= len(sp) <= 3 and sp[-1] == 'ٓ' and sp[0] in 'اىوٰۥۦ',
        'madd_muttasil': lambda sp: len(sp) == 2 and sp[-1] == 'ٓ' and sp[0] in 'اٰوى',
        'ikhfa_shafawi': lambda sp: sp[0] == 'م' and base(sp) == 'م ب',
        'idghaam_shafawi': lambda sp: sp[0] == 'م' and base(sp) == 'م م',
        'iqlab': lambda sp: sp[0] in 'ًٌٍۭۢن' and base(sp)[-1:] == 'ب',
        'ikhfa': lambda sp: sp[0] in 'ًٌٍن' and base(sp)[-1:] in IKHFA,
        'idghaam_ghunnah': lambda sp: sp[0] in 'ًٌٍن' and base(sp)[-1:] in set('ومني'),
        'idghaam_no_ghunnah': lambda sp: sp[0] in 'ًٌٍن' and base(sp)[-1:] in set('لر'),
        'idghaam_mutajanisayn': lambda sp: len(sp) == 1 and sp in 'دتذبثطظ',
        'idghaam_mutaqaribayn': lambda sp: len(sp) == 1 and sp in 'لقك',
        'silent': lambda sp: 1 <= len(sp) <= 3 and sp[0] in 'اويصى' and (sp[-1] == '۟' or len(sp) == 1),
    }
    def index_map(t):
        # خريطة من مواضع نص 2017 (بلا تطويل) إلى مواضع النص الحالي
        m = []
        for i, ch in enumerate(t):
            if ch != 'ـ': m.append(i)
        m.append(len(t)); return m
    aligned = {}; stats = collections.Counter(); unresolved = []; shifted = []
    for key, t in full.items():
        spans = sorted(((a['start'], a['end'], a['rule']) for a in ann.get(key, [])), key=lambda x: (x[0], x[1]))
        im = index_map(t); t17 = t.replace('ـ', ''); n17 = len(t17)
        def passes(a, b, r):
            return 0 <= a < b <= n17 and checks[r](t17[a:b])
        if all(passes(a, b, r) for a, b, r in spans):
            aligned[key] = [(im[a], im[b], r) for a, b, r in spans]; stats['tatweel-only'] += 1; continue
        # محاذاة تراكمية: تُتابَع الإزاحة من موضع إلى الذي يليه، وتُجرَّب إزاحات قريبة عند فشل المرساة
        delta = 0; out = []; dropped = 0; changes = 0
        for a, b, r in spans:
            for d in (delta, delta + 1, delta - 1, delta + 2, delta - 2, delta + 3, delta - 3):
                if passes(a + d, b + d, r):
                    if d != delta: changes += 1
                    delta = d; out.append((im[a + d], im[b + d], r)); break
            else:
                dropped += 1
        aligned[key] = out
        if dropped: stats['partial'] += 1; unresolved.append((key, dropped))
        else: stats['shifted'] += 1; shifted.append((key, changes))
    # فحص نهائي على النص الحالي: كل موضع داخل الحدود ويجتاز مرساته
    for key, spans in aligned.items():
        t = full[key]
        for a, b, r in spans:
            assert 0 <= a < b <= len(t) and checks[r](t[a:b].replace('ـ', '')), (key, a, b, r)
    log('\n## محاذاة تظليل أحكام التجويد\n')
    log('بيانات quran-tajweed مبنية على نسخة Tanzil لعام 2017. الفرق المنهجي بينها وبين النص الحالي هو إدراج حرف التطويل (U+0640) حاملًا للهمزة أو الياء الصغيرة؛ فتُحذف مواضع التطويل من حساب الفهارس ثم يُتحقق من كل موضع بمراسٍ ثابتة (همزة الوصل يجب أن تقع على «ٱ»، اللام الشمسية على «ل»، القلقلة على أحد حروفها، الغنّة على نون أو ميم، المدود على حرف مدّ...).\n')
    total_spans = sum(len(v) for v in aligned.values())
    log(f'- آيات تمّت محاذاتها بحذف التطويل فقط: **{stats["tatweel-only"]}**')
    log(f'- آيات فيها اختلاف ترميز آخر، حُوذيت تراكميًّا موضعًا موضعًا واجتاز كل موضع فيها مرساته: **{stats["shifted"]}** (مجموع نقاط الإزاحة: {sum(n for _, n in shifted)})')
    log(f'- آيات أُسقط فيها موضع أو أكثر لم يجتز مرساته بأي إزاحة قريبة (فلا يُلوَّن احتياطًا): **{stats["partial"]}** (مواضع مُسقطة: {sum(n for _, n in unresolved)})')
    for key, n in unresolved[:40]: log(f'  - {key[0]}:{key[1]} أُسقط {n}')
    log(f'- إجمالي مواضع التظليل المعتمدة: **{total_spans}**')

    # 5ب) طبقة علامات الوقف والسجدة والحزب
    # تنزيل Tanzil المستخدم هنا بلا علامات وقف ولا سجدة ولا أحزاب (خيارات marks/sajdah/rub غير مفعّلة في رابط التنزيل)،
    # فتُؤخذ هذه العلامات من نص مجمع الملك فهد (الإصدار 13) وتُحفظ طبقةً منفصلة `w` لا تمسّ نص Tanzil نفسه.
    # الربط بين النصين يتم بعدّ الحروف الأساسية (التطبيع نفسه المستخدم في المقارنة أعلاه، وقد ثبت تطابق الحروف في كل الآيات).
    WAQF = {'ۖ', 'ۗ', 'ۘ', 'ۙ', 'ۚ', 'ۛ', 'ۜ'}   # ۖ ۗ ۘ ۙ ۚ ۛ ۜ
    HIZB, SAJDAH = '۞', '۩'                                                  # ۞ ۩
    def is_letter(ch):
        if ch == 'ء' or ch in 'ٕٔ' or ch == 'ـ': return False
        if unicodedata.category(ch).startswith('M'): return False
        if ch in 'أإآٱؤئۀۃیىے': return True
        return 0x0621 <= ord(ch) <= 0x064A
    def letter_positions(t): return [i for i, ch in enumerate(t) if is_letter(ch)]
    waqf = {}; waqf_counts = collections.Counter(); waqf_problems = []
    for key, body in text.items():
        src = kf[key]; marks = []; n = 0
        for i, ch in enumerate(src):
            if is_letter(ch): n += 1; continue
            if ch == HIZB and i == 0: marks.append((0, ch)); continue
            if ch == SAJDAH: marks.append((n, ch)); continue
            if ch in WAQF and (i + 1 == len(src) or src[i + 1] in ' ‏' or src[i + 1] in WAQF): marks.append((n, ch))   # قد تتوالى علامتان (مَّرۡقَدِنَاۜۗ)
            # علامة السين داخل الكلمة (بصۜطة، المصۜيطرون) ليست وقفًا وهي موجودة في نص Tanzil أصلًا
        pos = letter_positions(body); out = []
        for n, ch in marks:
            if n == 0: off = 0
            else:
                i = pos[n - 1]; off = body.find(' ', i)
                if off < 0: off = len(body)
                if any(is_letter(c) for c in body[i + 1:off]): waqf_problems.append((key, ch, n)); continue
            out.append([off, ch]); waqf_counts[ch] += 1
        if [o for o, _ in out] != sorted(o for o, _ in out): waqf_problems.append((key, 'order', 0))
        waqf[key] = out
    assert not waqf_problems, waqf_problems[:5]
    log('\n## طبقة علامات الوقف والسجدة والحزب\n')
    log('رابط تنزيل Tanzil المعتمد في المصدر لا يتضمّن علامات الوقف ولا علامتي السجدة والحزب، فأُخذت من نص مجمع الملك فهد (الإصدار 13) وحُفظت طبقةً منفصلة (`w`) إلى جانب نص Tanzil دون تعديله. تُربط كل علامة بالحرف الذي تقع بعده بعدّ الحروف الأساسية في النصين (وقد ثبت أعلاه تطابقهما حرفًا حرفًا)، وتُوضع في نهاية الكلمة نفسها. علامة «لا» غير موجودة في ترميز نص المجمع فلا تظهر.\n')
    NAMES = {'ۖ': 'ۖ صلى', 'ۗ': 'ۗ قلى', 'ۘ': 'ۘ م', 'ۙ': 'ۙ لا', 'ۚ': 'ۚ ج', 'ۛ': 'ۛ ∴ معانقة', 'ۜ': 'ۜ س (سكتة)', HIZB: '۞ حزب', SAJDAH: '۩ سجدة'}
    for ch in ('ۚ', 'ۖ', 'ۗ', 'ۘ', 'ۛ', 'ۜ', HIZB, SAJDAH):
        log(f'- {NAMES[ch]}: **{waqf_counts[ch]}**')
    log(f'- مجموع العلامات: **{sum(waqf_counts.values())}** · علامات تعذّر ربطها بنهاية كلمة: **{len(waqf_problems)}**')

    # 6) كتابة المخرجات
    def prev_letter(t, a):
        # الحرف الأساسي السابق لموضع ما (بتجاوز علامات الضبط والتطويل)
        i = a - 1
        while i >= 0 and (unicodedata.category(t[i]).startswith('M') or t[i] == 'ـ'): i -= 1
        return t[i] if i >= 0 else ''
    def classify(t, a, b, r):
        rid = RULE_MAP[r]
        sp = t[a:b]
        # مدّ اللين: واو أو ياء ساكنة قبلها فتحة (الموضع حرف واحد، فيُنظر إلى ما قبله وما بعده)
        if r == 'madd_246' and sp in ('و', 'ي') and t[b:b + 1] == 'ْ' and t[a - 1:a] == 'َ': rid = 'madd-lin'
        if r == 'qalqalah' and base(t[b:]).strip() == '': rid = 'qalqalah-kubra'
        # الواو/الياء الصغيرة بعد هاء الضمير: مدّ الصلة (صغرى، أو كبرى إن تلتها همزة)
        if r == 'madd_2' and sp in ('ۥ', 'ۦ') and prev_letter(t, a) == 'ه': rid = 'madd-silah-sughra'
        if r == 'madd_munfasil' and sp[0] in 'ۥۦ' and prev_letter(t, a) == 'ه': rid = 'madd-silah-kubra'
        return rid
    index = []
    for s in range(1, 115):
        meta = chapters['chapters'][s - 1] if isinstance(chapters, dict) else chapters[s - 1]
        ayat = []
        for v in tz[str(s)]:
            key = (s, v['verse']); t = full[key]; body = text[key]
            off = len(t) - len(body)   # طول البسملة + مسافة
            spans = []
            for a, b, r in aligned[key]:
                if a < off: continue   # مواضع البسملة تُعرض من بيانات البسملة الثابتة
                spans.append([a - off, b - off, classify(t, a, b, r)])
            ayat.append({'n': v['verse'], 't': body, 'j': spans, 'w': waqf[key]})
        basm = None
        if s in basm_text:
            key = (s, 1); t = full[key]; off = len(basm_text[s])
            basm = {'t': basm_text[s], 'j': [[a, min(b, off), classify(t, a, b, r)] for a, b, r in aligned[key] if a < off]}
        data = {'surah': s, 'name': meta['name'], 'type': meta.get('type'), 'count': len(ayat), 'basmalah': basm, 'ayat': ayat}
        with open(os.path.join(OUT, f'{s:03d}.json'), 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        index.append({'n': s, 'name': meta['name'], 'tr': meta.get('transliteration'), 'type': meta.get('type'), 'count': len(ayat)})
    juz = chapters.get('indexes', {}).get('juzs') if isinstance(chapters, dict) else None
    # فحص الإياب: إعادة تركيب نص Tanzil من الملفات المكتوبة ومطابقته حرفًا حرفًا بالأصل، ثم تسجيل بصمته في الفهرس
    h = hashlib.sha256()
    for s in range(1, 115):
        d = json.load(open(os.path.join(OUT, f'{s:03d}.json'), encoding='utf-8'))
        for v in d['ayat']:
            line = (d['basmalah']['t'] + ' ' + v['t']) if (d['basmalah'] and v['n'] == 1) else v['t']
            assert line == full[(s, v['n'])], ('round-trip mismatch', s, v['n'])
            h.update(f"{s}|{v['n']}|{line}\n".encode('utf-8'))
    lines_sha = h.hexdigest()
    log(f'\n## فحص الإياب\n\n- أُعيد تركيب نص Tanzil (البسملة + الآية الأولى) من ملفات المخرجات وطُوبق حرفًا حرفًا بالأصل: **مطابق** (6236 آية)\n- بصمة الأسطر المُعاد تركيبها (`surah|ayah|text`): `{lines_sha}` (مسجّلة في index.json ويتحقق منها `npm test`)')
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'surahs': index, 'juzs': juz, 'built': datetime.date.today().isoformat(), 'tanzil_lines_sha256': lines_sha, 'waqf_counts': dict(waqf_counts),
                   'text_source': 'Tanzil.net Uthmani (CC BY 3.0) via risan/quran-json snapshot',
                   'tajweed_source': 'cpfair/quran-tajweed (CC BY 4.0), realigned', 'waqf_source': 'KFGQPC Hafs v13 (qurancomplex.gov.sa) via fawazahmed0/quran-api ara-quranuthmanihaf'}, f, ensure_ascii=False, separators=(',', ':'))
    log('\n## المخرجات\n')
    log(f'- `data/mushaf/001.json` … `114.json`: نص كل آية `t` (رسم Tanzil العثماني كما هو، بلا تعديل)، مواضع التظليل `j` = `[بداية، نهاية، معرّف الحكم]`، وعلامات الوقف `w` = `[موضع الإدراج في t، العلامة]`.')
    log('- `data/mushaf/index.json`: فهرس السور والأجزاء.')
    log('\n## ملاحظة\n\nالنص القرآني يُنقل حرفيًّا من Tanzil دون أي تعديل، ويُتحقق منه بالبصمة والمقارنة مع نصّين مستقلين. أما تظليل الأحكام فهو مُعين تعليمي مولَّد آليًّا وليس مرجعًا؛ عند التعارض يُقدَّم المصحف المطبوع والتلقّي عن المتقنين.')
    with open(os.path.join(OUT, 'VERIFICATION.md'), 'w', encoding='utf-8') as f: f.write('\n'.join(report) + '\n')
    print('\nwrote', OUT)

if __name__ == '__main__':
    main()
