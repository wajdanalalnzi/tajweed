/* ============================================================================
 * mushaf.js - the full-Quran reader ("المصحف").
 *
 * Routes (registered on TAJWEED.pages so app.js can dispatch to them):
 *   #/mushaf                 surah index (tabs: surahs / juz / bookmarks, search box)
 *   #/mushaf/<n>?ayah=<a>    reader for surah n, optionally scrolled to ayah a
 *
 * Data: data/mushaf/index.json (surah list, juz starts) and data/mushaf/NNN.json per surah,
 * fetched on demand and cached in memory (the service worker caches them on disk after the
 * first visit). Each ayah is { n, t, j, w }:
 *   t = Quran text, verbatim Tanzil Uthmani (never modified here)
 *   j = tajweed spans [start, end, ruleId] into t (may overlap), rendered by colorHtml()
 *   w = pause/sajdah/hizb marks [insertOffset, mark] inserted at display time
 * See REFERENCES.md and data/mushaf/VERIFICATION.md for how the data is built and verified.
 *
 * Also owns: last-read tracking (scroll), bookmarks, the ayah action sheet, and the
 * continuous-recitation player (one <audio>, advances ayah by ayah).
 * ========================================================================== */
/* المصحف: فهرس السور والأجزاء، صفحة القراءة بتلوين الأحكام، التلاوة المتواصلة.
   النص من data/mushaf/*.json (رسم Tanzil العثماني كما هو) ويُحمَّل كل سورة عند طلبها. */
window.TAJWEED = window.TAJWEED || {};
(function () {
  const T = TAJWEED, esc = T.esc, ar = T.ar, store = T.store;
  const DATA = 'data/mushaf/';
  let index = null; const cache = {};
  const TYPE = { meccan: 'مكّية', medinan: 'مدنية' };

  function load(url) {
    return fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function loadIndex() { return index ? Promise.resolve(index) : load(DATA + 'index.json').then(d => (index = d)); }
  function loadSurah(n) {
    const k = String(n).padStart(3, '0');
    return cache[k] ? Promise.resolve(cache[k]) : load(DATA + k + '.json').then(d => (cache[k] = d));
  }
  T.loadMushafIndex = loadIndex;
  const failHtml = `<div class="empty">تعذّر تحميل بيانات المصحف.<br><span class="muted" style="font-size:.9rem">افتح التطبيق من الموقع أو عبر خادم محلي (<code>npm start</code>)، فملفات المصحف تُحمَّل عند الطلب ولا تعمل من <code>file://</code> مباشرة.</span></div>`;

  /* ---------- أدوات ---------- */
  const norm = s => String(s).replace(/[ً-ْٰۖ-ۭٓ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toLowerCase();
  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
  function surahMeta(n) { return index && index.surahs[n - 1]; }
  function wordAround(t, a, b) {
    let s = t.lastIndexOf(' ', a - 1) + 1; let e = t.indexOf(' ', b); if (e < 0) e = t.length;
    return t.slice(s, e);
  }

  /* يحوّل نص الآية ومواضع الأحكام إلى HTML ملوّن.
     - المواضع قد تتداخل، فيُقطَّع النص عند كل حدّ ويُنسب كل مقطع إلى الموضع الأضيق (الأحدث بداية) الذي يغطّيه.
     - علامات الوقف `w` (طبقة منفصلة عن النص) تُدرج عند موضعها في نهاية الكلمة داخل <span class="waqf">،
       وتُزاح مواضع الأحكام الواقعة بعدها بعدد العلامات المدرجة قبلها. */
  function colorHtml(t, spans, w) {
    spans = spans || []; w = w || [];
    // 1) إدراج علامات الوقف في نص العرض وبناء خريطة الإزاحة
    let td = '', last = 0; const markAt = new Set(); const ins = []; // ins: [الموضع الأصلي، عدد العلامات المدرجة حتى هنا]
    for (const [off, m] of w) { td += t.slice(last, off); markAt.add(td.length); td += m; ins.push([off, ins.length + 1]); last = off; }
    td += t.slice(last);
    const shiftStart = i => { let n = 0; for (const [o, c] of ins) { if (o <= i) n = c; else break; } return i + n; }; // بداية الموضع تأتي بعد العلامة المدرجة عندها
    const shiftEnd = i => { let n = 0; for (const [o, c] of ins) { if (o < i) n = c; else break; } return i + n; };   // نهاية الموضع تبقى قبل العلامة
    const sp = spans.map(x => [shiftStart(x[0]), shiftEnd(x[1]), x[2], wordAround(t, x[0], x[1])]);
    if (!sp.length && !w.length) return esc(t);
    // 2) تقطيع نص العرض عند حدود المواضع والعلامات
    const cuts = new Set([0, td.length]); sp.forEach(x => { cuts.add(x[0]); cuts.add(x[1]); }); markAt.forEach(i => { cuts.add(i); cuts.add(i + 1); });
    const pts = [...cuts].sort((x, y) => x - y);
    let html = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; const seg = td.slice(a, b);
      if (markAt.has(a)) { html += `<span class="waqf" aria-hidden="true">${esc(seg)}</span>`; continue; }
      let best = null;
      for (const x of sp) if (x[0] <= a && x[1] >= b && (!best || x[0] > best[0] || (x[0] === best[0] && x[1] < best[1]))) best = x;
      if (!best) { html += esc(seg); continue; }
      const r = T.ruleById[best[2]]; const g = r ? r.group : 'izhar';
      html += `<span class="tj g-${g}" role="button" tabindex="0" data-rule="${best[2]}" data-text="${esc(best[3])}">${esc(seg)}</span>`;
    }
    return html;
  }
  T.colorHtml = colorHtml;

  /* ---------- فهرس السور ---------- */
  // Surah index page. Draws synchronously, then fills the list once index.json has loaded.
  function indexPage(query) {
    const m = store.mushaf();
    setTimeout(() => {
      const tabs = document.querySelectorAll('[data-tab]'); const inp = document.getElementById('m-q'); const list = document.getElementById('m-list');
      let tab = query.get('tab') || 'surahs';
      function draw() {
        tabs.forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
        if (!index) { list.innerHTML = '<div class="empty">جارٍ التحميل…</div>'; return; }
        const q = norm(inp.value.trim());
        if (tab === 'juzs') {
          list.innerHTML = `<div class="surah-grid">${index.juzs.map(j => { const s = surahMeta(j.sura); return `<a class="surah-item" href="#/mushaf/${j.sura}?ayah=${j.aya}"><span class="num">${ar(j.index)}</span><span class="nm"><b>الجزء ${ar(j.index)}</b><span class="muted">${esc(s.name)} ﴿${ar(j.aya)}﴾</span></span></a>`; }).join('')}</div>`;
        } else if (tab === 'marks') {
          const marks = (m.bookmarks || []).slice().sort((a, b) => b.at - a.at);
          list.innerHTML = marks.length ? `<div class="surah-grid">${marks.map(bm => { const s = surahMeta(bm.s); return `<a class="surah-item" href="#/mushaf/${bm.s}?ayah=${bm.a}"><span class="num">${ar(bm.s)}</span><span class="nm"><b>${esc(s ? s.name : '')} ﴿${ar(bm.a)}﴾</b><span class="muted">${new Date(bm.at).toLocaleDateString('ar')}</span></span><button type="button" class="icon-btn rm" data-s="${bm.s}" data-a="${bm.a}" aria-label="حذف العلامة" title="حذف">✕</button></a>`; }).join('')}</div>` : '<div class="empty">لا علامات بعد. المس رقم أي آية في المصحف ثم «علامة».</div>';
        } else {
          const hits = index.surahs.filter(s => !q || norm(s.name).includes(q) || String(s.n) === q || (s.tr || '').toLowerCase().includes(q));
          list.innerHTML = hits.length ? `<div class="surah-grid">${hits.map(s => `<a class="surah-item" href="#/mushaf/${s.n}"><span class="num">${ar(s.n)}</span><span class="nm"><b>${esc(s.name)}</b><span class="muted">${TYPE[s.type] || ''} · ${ar(s.count)} آية</span></span></a>`).join('')}</div>` : '<div class="empty">لا سورة بهذا الاسم.</div>';
        }
      }
      tabs.forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; history.replaceState(null, '', '#/mushaf' + (tab === 'surahs' ? '' : '?tab=' + tab)); draw(); }));
      inp.addEventListener('input', () => { if (tab !== 'surahs') tab = 'surahs'; draw(); });
      list.addEventListener('click', e => { const rm = e.target.closest('.rm'); if (!rm) return; e.preventDefault(); toggleBookmark(+rm.dataset.s, +rm.dataset.a); draw(); });
      draw();
      loadIndex().then(draw).catch(() => { list.innerHTML = failHtml; });
    }, 0);
    const last = m.last;
    return `
      <div class="row between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div><div class="eyebrow">برواية حفص عن عاصم · الرسم العثماني</div><h1>المصحف</h1></div>
        ${last ? `<a class="btn primary" href="#/mushaf/${last.s}?ayah=${last.a}">تابع القراءة: ${esc(last.name)} ﴿${ar(last.a)}﴾</a>` : ''}
      </div>
      <p class="muted">القرآن الكريم كاملًا بالرسم العثماني، مع تلوين أحكام التجويد كمُعين تعليمي: المس أي موضع ملوّن لتعرف حكمه. النص منقول حرفيًّا من مصدر معتمد ومُتحقَّق منه؛ وعند أي اختلاف يُقدَّم المصحف المطبوع.</p>
      <div class="search-box" style="margin-bottom:12px"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="m-q" type="search" placeholder="ابحث عن سورة بالاسم أو الرقم…" aria-label="بحث عن سورة"></div>
      <div class="seg mushaf-tabs" role="tablist"><button type="button" data-tab="surahs" class="on">السور</button><button type="button" data-tab="juzs">الأجزاء</button><button type="button" data-tab="marks">العلامات</button></div>
      <div id="m-list" style="margin-top:12px"><div class="empty">جارٍ التحميل…</div></div>`;
  }

  /* ---------- العلامات وآخر قراءة ---------- */
  function isBookmarked(s, a) { return (store.mushaf().bookmarks || []).some(b => b.s === s && b.a === a); }
  function toggleBookmark(s, a) {
    const m = store.mushaf(); const list = m.bookmarks || [];
    const i = list.findIndex(b => b.s === s && b.a === a);
    if (i >= 0) { list.splice(i, 1); toast('حُذفت العلامة'); } else { list.push({ s, a, at: Date.now() }); toast('أُضيفت علامة القراءة'); }
    store.setMushaf({ bookmarks: list });
    return i < 0;
  }
  function setLast(s, a) { const meta = surahMeta(s); store.setMushaf({ last: { s, a, name: meta ? meta.name : '' } }); }

  /* ---------- صفحة السورة ---------- */
  let current = null; // { s, data }
  // Reader page shell (toolbar + placeholders); drawReader() fills it when the surah JSON arrives.
  function readerPage(s, query) {
    const m = store.mushaf();
    const ayah = +query.get('ayah') || 0;
    setTimeout(() => {
      const box = document.getElementById('mushaf'); if (!box) return;
      Promise.all([loadIndex(), loadSurah(s)]).then(([ix, data]) => {
        if (!document.getElementById('mushaf')) return;
        current = { s, data };
        const meta = ix.surahs[s - 1];
        document.title = `سورة ${meta.name} · المصحف · موسوعة التجويد`;
        drawReader(data, meta, ayah);
      }).catch(() => { box.innerHTML = failHtml; });
    }, 0);
    if (player.s && player.s !== s) stopPlayer();
    return `
      <div class="mushaf-bar">
        <a class="btn small ghost" href="#/mushaf">${I.list}<span class="lbl">فهرس السور</span></a>
        <span class="spacer"></span>
        <div class="seg" role="group" aria-label="طريقة العرض"><button type="button" data-mode="flow" class="${m.mode !== 'list' ? 'on' : ''}" title="عرض متصل كالمصحف">متصل</button><button type="button" data-mode="list" class="${m.mode === 'list' ? 'on' : ''}" title="كل آية على حدة">آية آية</button></div>
        <button type="button" class="btn small ${m.color === false ? '' : 'on-color'}" id="m-color" aria-pressed="${m.color !== false}" title="إظهار أو إخفاء تلوين الأحكام">${I.palette} التلوين</button>
        <div class="seg" role="group" aria-label="حجم الخط"><button type="button" data-fs="-1" aria-label="تصغير الخط">ا−</button><button type="button" data-fs="1" aria-label="تكبير الخط">ا+</button></div>
      </div>
      <div class="mushaf-title" id="mushaf-title"><div class="num">${ar(s)}</div><div><h1>جارٍ التحميل…</h1></div></div>
      <div class="mushaf ${m.color === false ? 'nocolor' : ''} ${m.mode === 'list' ? 'list' : 'flow'}" id="mushaf"><div class="empty">جارٍ تحميل السورة…</div></div>
      <div class="chapter-nav" id="mushaf-nav"></div>`;
  }

  // Renders isti'adha + basmalah + ayat in flow mode (one justified block, like a printed page) or list mode (one card per ayah).
  function drawReader(data, meta, ayah) {
    const s = data.surah; const m = store.mushaf();
    document.getElementById('mushaf-title').innerHTML = `<div class="num">${ar(s)}</div><div><h1>سورة ${esc(meta.name)}</h1><div class="muted">${TYPE[meta.type] || ''} · ${ar(meta.count)} آية${meta.n > 1 ? ` · الجزء ${ar(juzOf(s, 1))}` : ''}</div></div>
      <div class="row"><button type="button" class="btn small primary" id="m-play">${I.play} استمع للسورة</button></div>`;
    const last = m.last && m.last.s === s && m.last.a > 1 && !ayah ? `<div class="row" style="margin:0 0 10px"><a class="chip accent" href="#/mushaf/${s}?ayah=${m.last.a}">آخر قراءة: الآية ${ar(m.last.a)} — انتقل إليها</a></div>` : '';
    const legend = `<details class="mushaf-legend"><summary>دليل الألوان</summary><div class="legend">${Object.entries(T.groups).map(([g, v]) => `<div class="legend-item g-${g}"><i></i><span>${esc(v.name)}</span></div>`).join('')}</div><p class="muted" style="font-size:.85rem;margin:8px 0 0">التلوين مولَّد آليًّا كمُعين للتعلّم وليس مرجعًا؛ النص نفسه منقول بلا تعديل.</p></details>`;
    // Isti'adha shown before every surah (including al-Fatiha and at-Tawbah). It is a display header,
    // not Quran text: it is never stored in the ayah data, never coloured, and not tappable.
    const istiadha = `<div class="istiadha" role="note" aria-label="الاستعاذة">أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ</div>`;
    const basm = data.basmalah ? `<div class="basmalah q">${colorHtml(data.basmalah.t, data.basmalah.j)}</div>` : '';
    let body;
    if (m.mode === 'list') {
      body = data.ayat.map(v => `<div class="ayah ay" id="ayah-${v.n}" data-n="${v.n}"><div class="q">${colorHtml(v.t, v.j, v.w)} <span class="aya-num" role="button" tabindex="0" data-n="${v.n}" aria-label="خيارات الآية ${ar(v.n)}">${ar(v.n)}</span></div><div class="ref"><span>${esc(meta.name)} ﴿${ar(v.n)}﴾</span><span class="row">${T.audioHtml(s, v.n)}<button type="button" class="btn small ghost bm ${isBookmarked(s, v.n) ? 'on' : ''}" data-n="${v.n}" aria-label="علامة قراءة">${I.bookmark}</button></span></div></div>`).join('');
    } else {
      body = `<div class="q flow">${data.ayat.map(v => `<span class="ay" id="ayah-${v.n}" data-n="${v.n}">${colorHtml(v.t, v.j, v.w)} <span class="aya-num" role="button" tabindex="0" data-n="${v.n}" aria-label="خيارات الآية ${ar(v.n)}">${ar(v.n)}</span></span> `).join('')}</div>`;
    }
    document.getElementById('mushaf').innerHTML = last + legend + istiadha + basm + body;
    const prev = s > 1 ? index.surahs[s - 2] : null, next = s < 114 ? index.surahs[s] : null;
    document.getElementById('mushaf-nav').innerHTML = `${prev ? `<a class="btn ghost" href="#/mushaf/${prev.n}">${I.prev} ${esc(prev.name)}</a>` : '<span></span>'}${next ? `<a class="btn ghost" href="#/mushaf/${next.n}">${esc(next.name)} ${I.next}</a>` : ''}`;
    if (ayah) { const el = document.getElementById('ayah-' + ayah); if (el) { setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('focus'); setTimeout(() => el.classList.remove('focus'), 3000); }, 60); setLast(s, ayah); } }
    else if (!(m.last && m.last.s === s)) setLast(s, 1);
    highlightPlaying();
    watchScroll();
  }
  function juzOf(s, a) {
    if (!index || !index.juzs) return 0; let j = 1;
    for (const z of index.juzs) { if (z.sura < s || (z.sura === s && z.aya <= a)) j = z.index; else break; }
    return j;
  }

  /* تسجيل آخر آية ظاهرة في أعلى الشاشة عند التمرير */
  let scrollTimer = null;
  // Remembers the first ayah visible under the header as the "last read" position (throttled).
  function watchScroll() {
    if (watchScroll.bound) return; watchScroll.bound = true;
    window.addEventListener('scroll', () => {
      if (!current || !document.getElementById('mushaf')) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const els = document.querySelectorAll('#mushaf .ay'); const top = 90;
        for (const el of els) { const r = el.getBoundingClientRect(); if (r.bottom > top) { setLast(current.s, +el.dataset.n); break; } }
      }, 400);
    }, { passive: true });
  }

  /* ---------- أحداث صفحة السورة ---------- */
  document.addEventListener('click', e => {
    const num = e.target.closest('.aya-num'); if (num) { ayahSheet(+num.dataset.n); return; }
    const bm = e.target.closest('.bm'); if (bm && current) { const on = toggleBookmark(current.s, +bm.dataset.n); bm.classList.toggle('on', on); return; }
    const mode = e.target.closest('[data-mode]'); if (mode && current) { store.setMushaf({ mode: mode.dataset.mode }); document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b === mode)); const box = document.getElementById('mushaf'); box.classList.toggle('list', mode.dataset.mode === 'list'); box.classList.toggle('flow', mode.dataset.mode !== 'list'); drawReader(current.data, surahMeta(current.s), 0); return; }
    const color = e.target.closest('#m-color'); if (color) { const on = !(store.mushaf().color !== false); store.setMushaf({ color: on }); color.setAttribute('aria-pressed', on); color.classList.toggle('on-color', on); document.getElementById('mushaf').classList.toggle('nocolor', !on); return; }
    const fs = e.target.closest('[data-fs]'); if (fs) { const cur = store.settings().fontScale || 1; const v = Math.min(1.8, Math.max(.7, +(cur + .1 * +fs.dataset.fs).toFixed(2))); store.setSetting('fontScale', v); T.applyFont && T.applyFont(); return; }
    const play = e.target.closest('#m-play'); if (play && current) { if (player.playing && player.s === current.s) stopPlayer(); else playSurah(current.s); return; }
  });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('aya-num')) { e.preventDefault(); e.target.click(); } });

  function ayahSheet(n) {
    if (!current) return; const s = current.s; const meta = surahMeta(s); const v = current.data.ayat[n - 1];
    const on = isBookmarked(s, n);
    T.openSheet(`
      <div class="grip"></div>
      <h3 id="sheet-title">${esc(meta.name)} ﴿${ar(n)}﴾ <span class="muted" style="font-size:.85rem;font-family:var(--font-ui);font-weight:400">· الجزء ${ar(juzOf(s, n))}</span></h3>
      <div class="q" style="font-family:var(--font-quran);font-size:1.4rem;line-height:2.1;margin:8px 0 12px;max-height:30vh;overflow:auto">${esc(v.t)}</div>
      <div class="row">
        <button type="button" class="btn small primary" id="sh-play">${I.play} استمع من هنا</button>
        <button type="button" class="btn small" id="sh-bm">${I.bookmark} ${on ? 'إزالة العلامة' : 'علامة قراءة'}</button>
        <button type="button" class="btn small" id="sh-copy">نسخ الآية</button>
        <button type="button" class="btn small ghost" onclick="TAJWEED.closeSheet()">إغلاق</button>
      </div>`);
    document.getElementById('sh-play').addEventListener('click', () => { T.closeSheet(); playFrom(s, n); });
    document.getElementById('sh-bm').addEventListener('click', () => { toggleBookmark(s, n); T.closeSheet(); const b = document.querySelector(`.bm[data-n="${n}"]`); if (b) b.classList.toggle('on', isBookmarked(s, n)); });
    document.getElementById('sh-copy').addEventListener('click', () => {
      const txt = `${v.t} ﴿${ar(n)}﴾ [${meta.name}: ${n}]`;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('نُسخت الآية')).catch(() => toast('تعذّر النسخ'));
      T.closeSheet();
    });
    setLast(s, n);
  }

  /* ---------- التلاوة المتواصلة ---------- */
  const player = { audio: null, s: 0, n: 0, intro: null, playing: false };
  const bar = document.createElement('div'); bar.className = 'player'; bar.id = 'player'; bar.hidden = true; document.body.appendChild(bar);
  function drawPlayer(status) {
    if (!player.s) { bar.hidden = true; return; }
    const meta = surahMeta(player.s); const count = meta ? meta.count : 0;
    bar.hidden = false;
    const where = player.intro ? INTRO[player.intro].label : `﴿${ar(player.n)}﴾`;
    const pos = player.intro ? '' : ` · ${ar(player.n)} من ${ar(count)}`;
    bar.innerHTML = `<div class="info"><b>${esc(meta ? meta.name : '')} ${where}</b><span class="muted">${status || (player.playing ? 'جارٍ التلاوة' : 'متوقّف')}${pos}</span></div>
      <div class="ctl">
        <button type="button" class="icon-btn" id="pl-prev" aria-label="الآية السابقة" ${player.n <= 1 ? 'disabled' : ''}>${I.prev}</button>
        <button type="button" class="icon-btn big" id="pl-toggle" aria-label="${player.playing ? 'إيقاف مؤقت' : 'تشغيل'}">${player.playing ? I.pause : I.play}</button>
        <button type="button" class="icon-btn" id="pl-next" aria-label="الآية التالية" ${player.n >= count ? 'disabled' : ''}>${I.next}</button>
        <button type="button" class="icon-btn" id="pl-stop" aria-label="إغلاق المشغّل">✕</button>
      </div>`;
    bar.querySelector('#pl-prev').addEventListener('click', () => playFrom(player.s, player.n - 1));
    bar.querySelector('#pl-next').addEventListener('click', () => playFrom(player.s, player.intro ? 1 : player.n + 1));
    bar.querySelector('#pl-stop').addEventListener('click', stopPlayer);
    bar.querySelector('#pl-toggle').addEventListener('click', () => {
      if (!player.audio) return;
      if (player.playing) { player.audio.pause(); player.playing = false; drawPlayer('متوقّف مؤقتًا'); }
      else { player.audio.play().catch(() => {}); player.playing = true; drawPlayer(); }
    });
  }
  // Intro clips recited before ayah 1 when the whole surah is played from the start.
  // Both are separate everyayah.com files in the chosen reciter's folder:
  //   isti'adha -> audhubillah.mp3 (if a reciter lacks it, it is skipped silently)
  //   basmalah  -> 001001.mp3 (al-Fatiha ayah 1, which is the basmalah)
  // `sel` is the on-page element highlighted while the clip plays.
  const INTRO = {
    istiadha: { label: 'الاستعاذة', file: 'audhubillah', sel: '#mushaf .istiadha' },
    basmalah: { label: 'البسملة', file: '001001', sel: '#mushaf .basmalah' },
  };
  // Plays the whole surah: isti'adha, then the basmalah (except al-Fatiha, where it is ayah 1,
  // and at-Tawbah, which has none), then the ayat from 1.
  function playSurah(s) {
    const steps = ['istiadha'];
    if (s !== 1 && s !== 9) steps.push('basmalah');
    playIntro(s, steps);
  }
  function playIntro(s, steps) {
    if (!steps.length) { playFrom(s, 1); return; }
    const step = steps[0], rest = steps.slice(1);
    T.stopAudio();
    player.audio = player.audio || new Audio();
    const a = player.audio; a.onended = null; a.onerror = null; a.onplaying = null;
    player.s = s; player.n = 0; player.intro = step; player.playing = true;
    a.src = T.audioFileUrl(INTRO[step].file);
    a.onplaying = () => drawPlayer();
    a.onended = () => playIntro(s, rest);
    // A missing intro clip must never block the recitation: move on to the next step.
    a.onerror = () => playIntro(s, rest);
    a.play().catch(() => a.onerror && a.onerror());
    drawPlayer('جارٍ التحميل…');
    highlightPlaying(true);
  }
  // Starts continuous recitation at surah s, ayah n; `onended` chains to the next ayah until the surah ends.
  function playFrom(s, n) {
    const meta = surahMeta(s); if (!meta || n < 1 || n > meta.count) { stopPlayer(); return; }
    T.stopAudio();
    player.audio = player.audio || new Audio();
    const a = player.audio; a.onended = null; a.onerror = null; a.onplaying = null;
    player.s = s; player.n = n; player.intro = null; player.playing = true;
    a.src = T.audioUrl(s, n);
    a.onplaying = () => drawPlayer();
    a.onended = () => { if (n < meta.count) playFrom(s, n + 1); else { stopPlayer(); toast('انتهت السورة'); } };
    a.onerror = () => { player.playing = false; drawPlayer('تعذّر تحميل التلاوة (تحقّق من الاتصال)'); };
    a.play().catch(() => a.onerror && a.onerror());
    drawPlayer('جارٍ التحميل…');
    highlightPlaying(true);
    if (current && current.s === s) setLast(s, n);
  }
  function stopPlayer() {
    if (player.audio) { player.audio.pause(); player.audio.onended = null; player.audio.onerror = null; }
    player.s = 0; player.n = 0; player.intro = null; player.playing = false; bar.hidden = true;
    highlightPlaying();
    const pb = document.getElementById('m-play'); if (pb) pb.innerHTML = `${I.play} استمع للسورة`;
  }
  T.stopMushafPlayer = stopPlayer;
  function highlightPlaying(scroll) {
    document.querySelectorAll('#mushaf .playing').forEach(el => el.classList.remove('playing'));
    const pb = document.getElementById('m-play');
    if (!player.s || !current || current.s !== player.s) { if (pb) pb.innerHTML = `${I.play} استمع للسورة`; return; }
    if (pb) pb.innerHTML = `${I.pause} إيقاف التلاوة`;
    const el = player.intro ? document.querySelector(INTRO[player.intro].sel) : document.getElementById('ayah-' + player.n);
    if (el) { el.classList.add('playing'); if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  /* إيقاف المشغّل عند مغادرة المصحف، وإيقافه عند تشغيل مقطع آية من مكان آخر */
  window.addEventListener('hashchange', () => { if (!/^#\/mushaf\/\d+/.test(location.hash)) stopPlayer(); });
  document.addEventListener('click', e => { if (e.target.closest('button.play') && player.s) stopPlayer(); }, true);

  /* ---------- أيقونات ---------- */
  const I = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M19 12H5m7-7-7 7 7 7"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1a9 9 0 0 0-6-12z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16.5" cy="10.5" r="1.2"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  };

  /* ---------- التسجيل في الموجّه ---------- */
  T.pages = T.pages || {};
  T.pages.mushaf = function (param, query) {
    const s = parseInt(param, 10);
    if (param && (!(s >= 1 && s <= 114))) return `<div class="empty">لا توجد سورة بهذا الرقم. <a href="#/mushaf">فهرس السور</a></div>`;
    return s ? readerPage(s, query) : indexPage(query);
  };
})();
