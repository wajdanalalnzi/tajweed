/* موسوعة التجويد — التطبيق: التوجيه والصفحات */
/*
 * js/app.js — The single-page app: navigation, hash router and every page.
 * Loaded last (see index.html), so all data and helpers already exist.
 *
 * HOW A PAGE IS SHOWN
 *   1. The URL hash changes (a link like <a href="#/chapter/madd">).
 *   2. render() parses the hash with parseHash():
 *        #/<route>/<param>?<query>#<anchor>
 *      e.g. #/chapter/noon-sakinah#rule-iqlab -> route 'chapter',
 *      param 'noon-sakinah', anchor 'rule-iqlab' (scrolled into view).
 *   3. pages[route](param, query) returns an HTML string that replaces
 *      the contents of <main id="view">.
 *   4. Both navigation bars are redrawn to mark the active item.
 *
 * ROUTES
 *   #/                  home      dashboard, continue button, ayah of the day
 *   #/path              path      all chapters in order with status
 *   #/chapter/<id>      chapter   one lesson (id from js/data/chapters.js)
 *   #/quiz/<id>         quiz      that chapter's quiz (js/data/quizzes.js)
 *   #/practice          practice  "name the rule" drill; ?rule=<id> or ?chapter=<id>
 *   #/legend            legend    colour legend
 *   #/glossary          glossary  terms
 *   #/search?q=…        search    full-text search
 *   #/settings          settings  theme, reciter, font size, reset
 *   #/more              more      mobile hub for legend, glossary, search, settings
 *
 * TO ADD A PAGE: add pages.<name> = function (param, query) { return html; },
 * and optionally an entry in NAV. Pages that need event listeners on their own
 * elements bind them in a setTimeout(…, 0), i.e. after the HTML is in the DOM.
 * Clicks shared by many pages are delegated on #view (see "أحداث عامة").
 *
 * SAFETY: always pass data through esc() before putting it in HTML.
 * Shortcuts: T = window.TAJWEED, esc = HTML escape, ar = Arabic-Indic digits,
 * store = js/store.js.
 */
(function () {
  const T = TAJWEED, esc = T.esc, ar = T.ar, store = T.store;
  const view = document.getElementById('view');

  /* ---------- أيقونات ---------- */
  // Inline SVG icons (stroke style comes from CSS), used as I.home, I.check, …
  // Note: in RTL "next" points left and "prev" points right.
  const I = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>',
    path: '<svg viewBox="0 0 24 24"><path d="M4 6h8a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="22" r="1.5"/></svg>',
    practice: '<svg viewBox="0 0 24 24"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1a9 9 0 0 0-6-12z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16.5" cy="10.5" r="1.2"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    quran: '<svg viewBox="0 0 24 24"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M6 17h13M9 7h6M9 10.5h4"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M19 12H5m7-7-7 7 7 7"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    tap: '<svg viewBox="0 0 24 24"><path d="M9 11V5a2 2 0 0 1 4 0v5"/><path d="M13 10a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L4.6 15a2 2 0 0 1 3.2-2.4L9 14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  };

  /* ---------- التنقل ---------- */
  // Main navigation items. `match(route)` decides which item is highlighted.
  // bottom: false -> desktop side bar only; side: false -> mobile bottom bar only.
  // On mobile the bottom bar has room for five items, so the secondary pages
  // (colours, glossary, search, settings) are grouped under "More" (#/more).
  // The side bar (desktop) lists everything plus the chapter list with ticks.
  const MORE_ROUTES = ['more', 'legend', 'glossary', 'search', 'settings'];
  const NAV = [
    { href: '#/', icon: 'home', label: 'الرئيسية', match: r => r === '' },
    { href: '#/path', icon: 'path', label: 'المسار', match: r => r === 'path' || r === 'chapter' || r === 'quiz' },
    { href: '#/mushaf', icon: 'quran', label: 'المصحف', match: r => r === 'mushaf' },
    { href: '#/practice', icon: 'practice', label: 'تدريب', match: r => r === 'practice' },
    { href: '#/legend', icon: 'palette', label: 'الألوان', match: r => r === 'legend', bottom: false },
    { href: '#/glossary', icon: 'book', label: 'المصطلحات', match: r => r === 'glossary', bottom: false },
    { href: '#/search', icon: 'search', label: 'بحث', match: r => r === 'search', bottom: false },
    { href: '#/settings', icon: 'settings', label: 'الإعدادات', match: r => r === 'settings', bottom: false },
    { href: '#/more', icon: 'more', label: 'المزيد', match: r => MORE_ROUTES.includes(r), side: false },
  ];
  // Page titles for the browser tab (routes not in NAV, or with a better name).
  // Contact address for user questions and feedback, shown on the More hub
  // and the Settings page.
  const CONTACT_EMAIL = 'Eng.majid.f@outlook.com';
  const contactHref = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent('استفسار عن موسوعة التجويد');

  const TITLES = { more: 'المزيد', quiz: 'اختبار' };
  // One nav link; the active one also gets aria-current for screen readers.
  const navLink = (n, on) => `<a href="${n.href}" class="${on ? 'active' : ''}"${on ? ' aria-current="page"' : ''}>${I[n.icon]}<span>${n.label}</span></a>`;
  function renderNav(route) {
    document.getElementById('bottomnav').innerHTML = NAV.filter(n => n.bottom !== false).map(n => navLink(n, n.match(route))).join('');
    const side = NAV.filter(n => n.side !== false).map(n => navLink(n, n.match(route) && route !== 'chapter')).join('') +
      `<div class="group">الأبواب <span>${ar(T.chapters.filter(c => store.chapterDone(c.id)).length)}/${ar(T.chapters.length)}</span></div>` +
      T.chapters.map(c => { const on = location.hash.startsWith('#/chapter/' + c.id + '#') || location.hash === '#/chapter/' + c.id; return `<a class="chap ${store.chapterDone(c.id) ? 'done' : ''} ${on ? 'active' : ''}"${on ? ' aria-current="page"' : ''} href="#/chapter/${c.id}"><span class="n">${store.chapterDone(c.id) ? '✓' : ar(c.order)}</span><span>${esc(c.title)}</span></a>`; }).join('');
    document.getElementById('sidenav').innerHTML = side;
  }

  /* ---------- أدوات ---------- */
  // toast(msg)          short message at the bottom for ~2 s
  // ring(pct, size)     circular progress SVG with the % in the middle
  // shuffle(arr)        Fisher–Yates shuffle, returns a new array
  // nextChapter()       first chapter not yet done
  // continueChapter()   last visited chapter if unfinished, else nextChapter()
  // chapterStatus(c)    { done, best quiz score, total questions, visited }
  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
  function ring(pct, size) { const r = 32, c = 2 * Math.PI * r; return `<div class="ring" style="${size ? `width:${size}px;height:${size}px` : ''}"><svg viewBox="0 0 76 76"><circle class="track" cx="38" cy="38" r="${r}"/><circle class="bar" cx="38" cy="38" r="${r}" stroke-dasharray="${c * pct / 100} ${c}"/></svg><div class="val">${ar(pct)}٪</div></div>`; }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function nextChapter() { return T.chapters.find(c => !store.chapterDone(c.id)) || null; }
  function continueChapter() { const s = store.get(); if (s.lastChapter && !store.chapterDone(s.lastChapter)) return T.chapterById[s.lastChapter]; return nextChapter(); }
  function chapterStatus(c) {
    const done = store.chapterDone(c.id); const best = store.quizBest(c.id); const total = (T.quizzes[c.id] || []).length;
    return { done, best, total, visited: !!store.get().chapters[c.id]?.visited };
  }

  /* ---------- الصفحات ---------- */
  // Every page is a function (param, query) => HTML string. See ROUTES above.
  const pages = {};

  // Home: progress ring, continue button, stats, first 5 chapters, legend
  // preview, and an "ayah of the day".

  pages.home = function () {
    const pct = store.overall(); const cont = continueChapter(); const s = store.get();
    const doneCount = T.chapters.filter(c => store.chapterDone(c.id)).length;
    const quizzes = Object.values(s.quizzes); const avg = quizzes.length ? Math.round(100 * quizzes.reduce((n, q) => n + q.best / q.total, 0) / quizzes.length) : 0;
    const streak = store.streak();
    return `
      <section class="hero fade-in">
        <div class="hero-head">
          <div>
            <div class="eyebrow">برواية حفص عن عاصم</div>
            <h1>تعلّم التجويد خطوة خطوة</h1>
          </div>
          ${ring(pct)}
        </div>
        <p>مسار مرتّب من المخارج إلى الوقف والابتداء، آيات ملوّنة بالأحكام تشرح نفسها عند اللمس، تلاوات بصوت القرّاء، واختبارات تثبّت ما تعلّمته.</p>
        <div class="hero-actions">
          ${cont ? `<a class="btn" href="#/chapter/${cont.id}">${s.lastChapter ? 'تابع:' : 'ابدأ:'} ${esc(cont.title)}</a>` : `<a class="btn" href="#/practice">أتممت المسار! تدرّب</a>`}
          <a class="btn ghost" href="#/practice">تدريب سريع</a>
        </div>
      </section>
      ${onboardingHtml()}
      <div class="stats">
        <div class="stat"><b>${ar(doneCount)}<span style="font-size:.9rem;color:var(--muted)">/${ar(T.chapters.length)}</span></b><span>أبواب أتممتها</span></div>
        <div class="stat"><b>${ar(avg)}٪</b><span>متوسط الاختبارات</span></div>
        <div class="stat"><b>${ar(streak)}</b><span>أيام متتالية</span></div>
      </div>
      <div class="section-title"><h2>المصحف</h2><a href="#/mushaf">فهرس السور</a></div>
      ${mushafCta()}
      <div class="section-title"><h2>مسار التعلّم</h2><a href="#/path">عرض الكل</a></div>
      ${pathHtml(T.chapters.slice(0, 5))}
      <div class="section-title"><h2>دليل الألوان</h2><a href="#/legend">التفاصيل</a></div>
      <div class="legend">${Object.entries(T.groups).slice(0, 6).map(([g, v]) => `<div class="legend-item g-${g}"><i></i><span>${esc(v.name)}</span></div>`).join('')}</div>
      <div class="section-title" id="daily"><h2>آية اليوم</h2></div>
      ${T.ayahHtml(dailyAyah())}
      <p class="muted" style="font-size:.9rem">المس أي جزء ملوّن لتعرف الحكم وسببه.</p>`;
  };

  // First-visit "how it works" card: three short steps that teach the core
  // interactions (tap a coloured word, colours = rules, follow the path, quiz).
  // Hidden for good once dismissed (localStorage key tajweed:onboarded) or once
  // the learner has opened any chapter.
  const ONBOARD_KEY = 'tajweed:onboarded';
  function onboarded() { try { return localStorage.getItem(ONBOARD_KEY) === '1'; } catch (e) { return true; } }
  function onboardingHtml() {
    if (onboarded() || store.get().lastChapter) return '';
    const steps = [
      [I.tap, 'المس الكلمة الملوّنة', 'كل لون يدلّ على حكم. المس أي كلمة ملوّنة في الآيات لتظهر لك بطاقة تشرح الحكم وسببه.'],
      [I.play, 'استمع ثم قلّد', 'زر «استمع» بجانب كل آية يشغّل تلاوة القارئ لتسمع الحكم منطوقًا.'],
      [I.path, 'سر في المسار واختبر نفسك', 'الأبواب مرتّبة من الأساس إلى الأداء. أتمم الباب ثم اختبر نفسك، ونجاحك بـ ٨٠٪ يسجّله مكتملًا.'],
    ];
    setTimeout(() => {
      const box = document.getElementById('onboard'); if (!box) return;
      box.querySelector('[data-dismiss]').addEventListener('click', () => { try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {} box.remove(); });
    }, 0);
    return `<section class="onboard card fade-in" id="onboard" aria-labelledby="onboard-title">
      <div class="row between"><h2 id="onboard-title">كيف تستخدم التطبيق؟</h2><button class="icon-btn flat" type="button" data-dismiss aria-label="إخفاء الإرشادات" title="إخفاء">${I.close}</button></div>
      <ol class="steps">${steps.map(([ic, t, d]) => `<li><span class="ic">${ic}</span><span><b>${t}</b><span class="muted">${d}</span></span></li>`).join('')}</ol>
      <div class="row"><a class="btn small primary" href="#/chapter/${T.chapters[0].id}">ابدأ الباب الأول</a><a class="btn small" href="#/" data-toc="daily">جرّب على آية اليوم</a></div>
    </section>`;
  }

  // Home-page card linking to the mushaf (continues from the last read position when there is one).
  function mushafCta() {
    const m = store.mushaf(); const last = m.last;
    const href = last ? `#/mushaf/${last.s}?ayah=${last.a}` : '#/mushaf/1';
    return `<a class="mushaf-cta" href="${href}"><span class="mark">۞</span><span><b>${last ? `تابع القراءة: ${esc(last.name)} ﴿${ar(last.a)}﴾` : 'اقرأ المصحف كاملًا'}</b><span class="muted">القرآن الكريم بالرسم العثماني مع تلوين أحكام التجويد وتلاوة متواصلة.</span></span>${I.next}</a>`;
  }
  // Pick an example with a reference and at least two coloured segments.
  // The index is the number of days since 1970, so it changes once a day and
  // is the same for everyone on that day.
  function dailyAyah() {
    const all = []; T.chapters.forEach(c => c.sections.forEach(s => (s.examples || []).forEach(e => { if (e.ref && (e.text.match(/\{/g) || []).length >= 2) all.push(e); })));
    const d = Math.floor(Date.now() / 864e5); return all[d % all.length];
  }

  // The learning path list. A chapter is 'done', 'current' (the one to
  // continue) or neither; the right side shows the quiz score or reading time.
  function pathHtml(chapters) {
    const cont = continueChapter();
    return `<div class="path">${chapters.map(c => {
      const st = chapterStatus(c);
      const cls = st.done ? 'done' : (cont && cont.id === c.id ? 'current' : '');
      return `<a class="path-item ${cls}" href="#/chapter/${c.id}">
        <span class="icon">${st.done ? '✓' : esc(c.icon)}</span>
        <span><span class="t">${esc(c.title)}</span><br><span class="s">${esc(c.subtitle)}</span></span>
        <span class="meta"><span class="chip">${esc(c.level)}</span><span>${st.best !== null ? `اختبار ${ar(st.best)}/${ar(st.total)}` : `${ar(c.minutes)} د`}</span></span>
      </a>`; }).join('')}</div>`;
  }

  pages.path = function () {
    const pct = store.overall();
    return `<div class="row between" style="margin-bottom:14px"><div><h1>مسار التعلّم</h1><p class="muted" style="margin:0">${ar(T.chapters.length)} بابًا مرتّبة من الأساس إلى الأداء. أتمم الباب ثم اختبر نفسك.</p></div>${ring(pct)}</div>${pathHtml(T.chapters)}`;
  };

  // Chapter (lesson) page. Opening it marks the chapter visited and makes it
  // the "continue" chapter. Layout: header, intro, optional diagram, sections
  // (rule tags, body HTML, example ayat, tips), summary, quiz / mark-done
  // buttons, prev/next links. Section ids are s0, s1, … and rule tags have
  // id rule-<ruleId> so search results and the legend can deep-link to them.
  pages.chapter = function (id) {
    const c = T.chapterById[id]; if (!c) return `<div class="empty">الباب غير موجود.</div>`;
    store.visitChapter(id);
    const st = chapterStatus(c);
    const i = T.chapters.indexOf(c); const prev = T.chapters[i - 1], next = T.chapters[i + 1];
    const sections = c.sections.map((s, si) => `
      <section class="section card" id="s${si}">
        <h2>${esc(s.title)}</h2>
        ${s.rules ? `<div class="rule-tags">${s.rules.map(rid => { const r = T.ruleById[rid]; return `<span class="rule-tag g-${r.group}" id="rule-${rid}" data-rule="${rid}" role="button" tabindex="0"><i></i>${esc(r.name)}</span>`; }).join('')}</div>` : ''}
        <div class="body">${s.body || ''}</div>
        ${(s.examples || []).map(e => T.ayahHtml(e)).join('')}
        ${s.tips ? `<div class="tips"><b>تنبيهات</b><ul>${s.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      </section>`).join('');
    return `
      <div class="chapter-head fade-in">
        <div class="icon">${esc(c.icon)}</div>
        <div>
          <div class="eyebrow">الباب ${ar(c.order)} من ${ar(T.chapters.length)}، ${esc(c.level)}، نحو ${ar(c.minutes)} دقيقة</div>
          <h1>${esc(c.title)}</h1>
          <div class="muted">${esc(c.subtitle)}</div>
        </div>
      </div>
      <div class="read-progress" aria-hidden="true"><span id="read-bar"></span></div>
      <div class="chapter-intro">${esc(c.intro)}</div>
      ${c.sections.length > 1 ? `<nav class="toc card" aria-label="محتويات الباب"><b>في هذا الباب</b><ol>${c.sections.map((s, si) => `<li><a href="#/chapter/${c.id}#s${si}" data-toc="s${si}">${esc(s.title)}</a></li>`).join('')}<li><a href="#/chapter/${c.id}#summary" data-toc="summary">خلاصة الباب والاختبار</a></li></ol></nav>` : ''}
      ${c.diagram === 'makharij' ? makharijDiagram() : ''}
      ${sections}
      <section class="summary card" id="summary"><h2>خلاصة الباب</h2><ol>${c.summary.map(x => `<li>${esc(x)}</li>`).join('')}</ol></section>
      <div class="chapter-actions">
        <a class="btn primary block" href="#/quiz/${c.id}">${I.practice} ${st.best !== null ? `أعد الاختبار (أفضل نتيجة ${ar(st.best)}/${ar(st.total)})` : 'اختبر نفسك في هذا الباب'}</a>
        <button class="btn block" id="mark-done" type="button">${I.check} ${st.done ? 'تم إتمام الباب ✓ (إلغاء)' : 'أتممتُ هذا الباب'}</button>
      </div>
      <div class="chapter-nav">
        ${prev ? `<a class="btn ghost" href="#/chapter/${prev.id}">${I.prev} ${esc(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a class="btn ghost" href="#/chapter/${next.id}">${esc(next.title)} ${I.next}</a>` : ''}
      </div>`;
  };

  // Interactive side view of the vocal tract, only for chapters with
  // diagram: 'makharij'. Each Z row is one articulation point:
  //   [id, x, y, name, letters, description]   (x, y in SVG units)
  // The positions are approximate and only for teaching. The zone data is
  // stored as JSON in data-zones; the click handler at the bottom of this file
  // reads it to fill #diagram-info.
  function makharijDiagram() {
    const Z = [
      ['khayshum', 200, 52, 'الخيشوم', 'الغنّة', 'أعلى الأنف: منه تخرج الغنّة المصاحبة للنون والميم.'],
      ['jawf', 235, 122, 'الجوف', 'ا و ي', 'الخلاء الداخل في الفم والحلق: حروف المدّ الثلاثة.'],
      ['halq1', 348, 285, 'أقصى الحلق', 'ء هـ', 'أبعد الحلق عن الفم: الهمزة والهاء.'],
      ['halq2', 346, 235, 'وسط الحلق', 'ع ح', 'وسط الحلق: العين والحاء.'],
      ['halq3', 341, 185, 'أدنى الحلق', 'غ خ', 'أقرب الحلق إلى الفم: الغين والخاء.'],
      ['qaf', 305, 130, 'أقصى اللسان', 'ق', 'أقصى اللسان مع ما يحاذيه من الحنك الأعلى (اللهاة).'],
      ['kaf', 268, 108, 'أقصى اللسان (أسفل)', 'ك', 'أسفل مخرج القاف قليلًا.'],
      ['wasat', 185, 95, 'وسط اللسان', 'ج ش ي', 'وسط اللسان مع ما يحاذيه من الحنك الأعلى.'],
      ['dad', 172, 152, 'حافة اللسان', 'ض', 'إحدى حافتي اللسان أو كلتاهما مع ما يحاذيها من الأضراس العليا.'],
      ['lam', 140, 108, 'أدنى الحافة', 'ل', 'أدنى حافة اللسان إلى منتهى طرفه مع لثة الأسنان العليا.'],
      ['noon', 132, 145, 'طرف اللسان', 'ن', 'طرف اللسان مع لثة الثنيتين العليين، تحت مخرج اللام قليلًا.'],
      ['ra', 120, 182, 'طرف اللسان (ظهره)', 'ر', 'طرف اللسان مع ظهره، قريبًا من مخرج النون.'],
      ['nit', 95, 118, 'أصول الثنايا', 'ط د ت', 'طرف اللسان مع أصول الثنايا العليا.'],
      ['lith', 72, 150, 'أطراف الثنايا', 'ظ ذ ث', 'طرف اللسان مع أطراف الثنايا العليا.'],
      ['safir', 80, 185, 'بين الثنايا', 'ص ز س', 'طرف اللسان مع ما بين الثنايا، فويق الثنايا السفلى.'],
      ['shafatan', 40, 165, 'الشفتان', 'ب م و', 'الشفتان معًا: الباء والميم بانطباقهما، والواو بانفتاحهما مع استدارة.'],
      ['fa', 52, 212, 'الشفة السفلى', 'ف', 'باطن الشفة السفلى مع أطراف الثنايا العليا.'],
    ];
    const zones = Z.map(z => `<g class="zone" data-id="${z[0]}" tabindex="0" role="button" aria-label="${esc(z[3])}"><circle cx="${z[1]}" cy="${z[2]}" r="17"/><text x="${z[1]}" y="${z[2]}" style="font-size:${z[4].length > 3 ? 11 : 15}px">${esc(z[4])}</text></g>`).join('');
    const data = JSON.stringify(Object.fromEntries(Z.map(z => [z[0], { name: z[3], letters: z[4], desc: z[5] }])));
    return `<div class="card diagram" id="diagram" data-zones='${esc(data)}'>
      <div class="eyebrow">مخطط تقريبي لجهاز النطق من الجانب (الشفتان إلى اليسار والحلق إلى اليمين). المس أي نقطة لمعرفة مخرجها.</div>
      <svg viewBox="15 25 375 300" aria-label="مخارج الحروف">
        <path class="outline" d="M85 95 C 130 40, 240 35, 300 60 L 330 60 L 378 310" stroke-dasharray="7 7"/>
        <path class="outline" d="M80 100 C 130 70, 220 70, 290 85 C 320 92, 332 105, 326 128"/>
        <path class="outline" d="M326 128 C 318 180, 314 250, 322 312"/>
        <path class="outline" d="M80 100 C 58 108, 52 132, 68 150 M 66 180 C 46 190, 50 220, 84 222 M 84 222 C 170 226, 260 222, 322 312"/>
        <path class="outline" d="M86 118 L 86 150 M 86 186 L 86 206" stroke-width="4"/>
        <path class="tongue" d="M90 206 C 100 150, 160 125, 230 132 C 280 136, 312 150, 318 182 C 300 208, 200 214, 90 206 Z"/>
        ${zones}
      </svg>
      <div class="diagram-info" id="diagram-info"><span class="muted">اختر مخرجًا من الرسم…</span></div>
    </div>`;
  }

  /* ---------- الاختبار ---------- */
  // Quiz flow: questions are shuffled once, shown one by one, and each answer
  // reveals the correct option and the `why` explanation. At the end the score
  // is saved (store.recordQuiz). Scoring 80% or more marks the chapter done.
  // quizState = { id, qs (shuffled questions), i (current index),
  //               results (true/false per answered question), answered }
  pages.quiz = function (id) {
    const c = T.chapterById[id]; const qs = T.quizzes[id];
    if (!c || !qs) return `<div class="empty">لا يوجد اختبار لهذا الباب.</div>`;
    quizState = { id, qs: shuffle(qs), i: 0, results: [], answered: false };
    setTimeout(renderQuiz, 0);
    return `<div id="quiz"></div>`;
  };
  let quizState = null;
  function renderQuiz() {
    const el = document.getElementById('quiz'); if (!el || !quizState) return;
    const { qs, i, results } = quizState; const c = T.chapterById[quizState.id];
    if (i >= qs.length) {
      const score = results.filter(Boolean).length; store.recordQuiz(quizState.id, score, qs.length);
      const pct = score / qs.length; const badge = pct === 1 ? '🏆' : pct >= .8 ? '🌟' : pct >= .6 ? '👍' : '📖';
      const msg = pct === 1 ? 'ممتاز! أتقنت هذا الباب.' : pct >= .8 ? 'أحسنت، راجع ما أخطأت فيه.' : pct >= .6 ? 'جيد، يحتاج إلى مراجعة.' : 'راجع الباب ثم أعد الاختبار.';
      if (pct >= .8 && !store.chapterDone(quizState.id)) store.setChapterDone(quizState.id, true);
      el.innerHTML = `<div class="card result fade-in"><div class="badge">${badge}</div><div class="score">${ar(score)} / ${ar(qs.length)}</div><p>${msg}</p>
        ${pct >= .8 ? '<p class="chip ok">تم تسجيل الباب مكتملًا</p>' : ''}
        <div class="row" style="justify-content:center;margin-top:14px"><a class="btn primary" href="#/quiz/${quizState.id}" onclick="location.reload()">أعد الاختبار</a><a class="btn" href="#/chapter/${quizState.id}">العودة إلى الباب</a>${nextAfter(quizState.id)}</div></div>`;
      renderNav('path'); return;
    }
    const q = qs[i];
    el.innerHTML = `<div class="row between"><div><div class="eyebrow">اختبار الباب</div><h1 style="font-size:1.4rem">${esc(c.title)}</h1></div><span class="chip">${ar(i + 1)} / ${ar(qs.length)}</span></div>
      <div class="quiz-progress">${qs.map((_, k) => `<i class="${k < i ? (results[k] ? 'ok' : 'bad') : k === i ? 'cur' : ''}"></i>`).join('')}</div>
      <div class="card fade-in"><div class="question">${esc(q.q)}</div>
        <div class="options">${q.options.map((o, k) => `<button class="option" type="button" data-k="${k}"><span class="k">${'أبجد'[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div id="fb"></div></div>`;
    el.querySelectorAll('.option').forEach(b => b.addEventListener('click', () => answer(+b.dataset.k)));
  }
  function nextAfter(id) { const i = T.chapters.findIndex(c => c.id === id); const n = T.chapters[i + 1]; return n ? `<a class="btn" href="#/chapter/${n.id}">الباب التالي: ${esc(n.title)}</a>` : ''; }
  function answer(k) {
    if (quizState.answered) return; quizState.answered = true;
    const q = quizState.qs[quizState.i]; const ok = k === q.answer; quizState.results.push(ok);
    document.querySelectorAll('.option').forEach(b => { b.disabled = true; const kk = +b.dataset.k; if (kk === q.answer) b.classList.add('correct'); else if (kk === k) b.classList.add('wrong'); });
    document.getElementById('fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}"><b>${ok ? 'صحيح ✓' : 'غير صحيح ✗'}</b> — ${esc(q.why)}<div style="margin-top:10px"><button class="btn primary small" id="next-q" type="button">${quizState.i + 1 < quizState.qs.length ? 'السؤال التالي' : 'النتيجة'}</button></div></div>`;
    document.getElementById('next-q').addEventListener('click', () => { quizState.i++; quizState.answered = false; renderQuiz(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ---------- التدريب: تعرّف على الحكم ---------- */
  // Practice ("name the rule"): picks a random coloured segment from all
  // chapter examples, shows the ayah with only that segment highlighted
  // (opts.plain, so tapping does not reveal the answer) and asks which rule it is.
  // Wrong options come first from the same chapter (harder), then from others.
  // 'silent' and 'hamzat-qat' segments are never asked, because they are not
  // a rule you can recognise from the highlight alone.

  // Every coloured segment, optionally filtered by rule id or chapter id.
  // Each item: { ex (the example), idx (segment index), rule, text, note }.
  function practicePool(filter) {
    const pool = [];
    T.chapters.forEach(c => c.sections.forEach(s => (s.examples || []).forEach(ex => {
      const segs = T.parseMarkup(ex.text);
      segs.forEach((seg, idx) => {
        if (!seg.rule) return; const r = T.ruleById[seg.rule]; if (!r) return;
        if (filter.rule && seg.rule !== filter.rule) return;
        if (filter.chapter && r.chapter !== filter.chapter) return;
        pool.push({ ex, idx, rule: r, text: seg.t, note: seg.note });
      });
    })));
    return pool;
  }
  let practice = null;
  pages.practice = function (_, query) {
    const filter = { rule: query.get('rule') || '', chapter: query.get('chapter') || '' };
    practice = { filter, asked: 0, correct: 0, last: null };
    setTimeout(nextPractice, 0);
    const title = filter.rule ? T.ruleById[filter.rule]?.name : filter.chapter ? T.chapterById[filter.chapter]?.title : 'جميع الأبواب';
    return `<div class="row between"><div><div class="eyebrow">تدريب: تعرّف على الحكم</div><h1 style="font-size:1.5rem">${esc(title || 'تدريب')}</h1></div><span class="chip" id="p-score">٠ / ٠</span></div>
      <div class="row" style="margin:10px 0 14px"><select id="p-chapter" class="btn small" aria-label="اختر الباب"><option value="">كل الأبواب</option>${T.chapters.filter(c => c.sections.some(s => s.rules)).map(c => `<option value="${c.id}" ${filter.chapter === c.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>${filter.rule ? `<a class="btn small ghost" href="#/practice">إلغاء تصفية الحكم</a>` : ''}</div>
      <div id="p-body"></div>`;
  };
  function nextPractice() {
    const el = document.getElementById('p-body'); if (!el || !practice) return;
    const sel = document.getElementById('p-chapter'); if (sel && !sel.dataset.bound) { sel.dataset.bound = 1; sel.addEventListener('change', () => { location.hash = '#/practice' + (sel.value ? '?chapter=' + sel.value : ''); }); }
    const pool = practicePool(practice.filter).filter(p => !['silent', 'hamzat-qat'].includes(p.rule.id));
    if (!pool.length) { el.innerHTML = '<div class="empty">لا توجد أمثلة لهذا التصفية.</div>'; return; }
    let item = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && practice.last && item.text === practice.last) item = pool[(pool.indexOf(item) + 1) % pool.length];
    practice.last = item.text;
    const sameChapter = T.rules.filter(r => r.chapter === item.rule.chapter && r.id !== item.rule.id);
    const others = T.rules.filter(r => r.chapter !== item.rule.chapter && !['silent', 'hamzat-qat', 'hamzat-wasl'].includes(r.id));
    const distract = shuffle(sameChapter).slice(0, 3); while (distract.length < 3) { const o = shuffle(others).find(r => !distract.includes(r)); if (!o) break; distract.push(o); }
    const options = shuffle([item.rule, ...distract]);
    el.innerHTML = `<div class="card fade-in"><div class="question">ما الحكم في الجزء المظلّل؟</div>
      ${T.ayahHtml({ text: item.ex.text, ref: item.ex.ref }, { plain: true, targetIndex: item.idx, hideNote: true })}
      <div class="options">${options.map((r, k) => `<button class="option" type="button" data-r="${r.id}"><span class="k">${'أبجد'[k]}</span><span>${esc(r.name)}</span></button>`).join('')}</div>
      <div id="p-fb"></div></div>`;
    el.querySelectorAll('.option').forEach(b => b.addEventListener('click', () => {
      const ok = b.dataset.r === item.rule.id; practice.asked++; if (ok) practice.correct++; store.recordPractice(item.rule.id, ok);
      el.querySelectorAll('.option').forEach(x => { x.disabled = true; if (x.dataset.r === item.rule.id) x.classList.add('correct'); else if (x === b) x.classList.add('wrong'); });
      document.getElementById('p-score').textContent = `${ar(practice.correct)} / ${ar(practice.asked)}`;
      document.getElementById('p-fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}"><b>${ok ? 'صحيح ✓' : 'غير صحيح ✗'}</b> ${esc(item.note || item.rule.short)}
        <div class="row" style="margin-top:10px"><button class="btn primary small" id="p-next" type="button">مثال آخر</button><button class="btn small" type="button" id="p-explain">اشرح الحكم</button></div></div>`;
      document.getElementById('p-next').addEventListener('click', nextPractice);
      document.getElementById('p-explain').addEventListener('click', () => T.explain(item.rule.id, item.text, item.note));
    }));
  }

  /* ---------- الألوان ---------- */
  // Legend: one card per colour group in TAJWEED.groups, with a sample word
  // and links to every rule in that group.
  pages.legend = function () {
    const sample = { madd6: 'ٱلضَّآلِّينَ', madd45: 'جَآءَ', madd246: 'بِمَآ أُنزِلَ', madd2: 'قَالَ', ghunnah: 'مِن شَرِّ', idgham: 'مِن رَّبِّهِمْ', izhar: 'مِنْ خَوْفٍ', qalqalah: 'أَحَدْ', tafkhim: 'ٱللَّهُ', tarqiq: 'بِسْمِ ٱللَّهِ', silent: 'ٱلشَّمْسِ', sakt: 'مَنْ ۜ رَاقٍ' };
    return `<h1>دليل الألوان</h1><p class="muted">كل حكم له لون ثابت في جميع أمثلة التطبيق، مع خط منقّط تحته حتى لا يعتمد التمييز على اللون وحده. الألوان مستوحاة من المصحف الملوّن المعروف (المدود بالأحمر، الغنّة بالأخضر، القلقلة بالأزرق، ما لا يُنطق بالرمادي).</p>
      ${Object.entries(T.groups).map(([g, v]) => `<div class="card g-${g}" style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;margin-top:10px"><span class="legend-sample">${esc(sample[g] || '')}</span><div><div class="row"><i style="width:14px;height:14px;border-radius:4px;background:var(--c);display:inline-block"></i><b>${esc(v.name)}</b></div><div class="muted" style="font-size:.9rem">${T.rules.filter(r => r.group === g).map(r => `<a href="#/chapter/${r.chapter}#rule-${r.id}">${esc(r.name)}</a>`).join(' · ')}</div></div></div>`).join('')}`;
  };

  /* ---------- المصطلحات ---------- */
  pages.glossary = function () {
    return `<h1>المصطلحات</h1><p class="muted">تعريفات مختصرة لأهم مصطلحات علم التجويد.</p><div class="card">${T.glossary.map(g => `<div class="term"><b>${esc(g.term)}</b><div>${esc(g.def)}</div></div>`).join('')}</div>`;
  };

  /* ---------- البحث ---------- */
  // norm(): makes Arabic text searchable regardless of diacritics: removes
  // harakat and Quranic marks, unifies alef forms (أ إ آ ٱ -> ا), ة -> ه,
  // ى -> ي, and strips HTML tags.
  const norm = s => String(s).replace(/[ً-ْٰۖ-ۭٓ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/<[^>]+>/g, '').toLowerCase();
  // Builds (once, then cached) a list of searchable items: rules, chapters,
  // chapter sections (body, tips and example text) and glossary terms.
  function searchIndex() {
    if (searchIndex.cache) return searchIndex.cache;
    const items = [];
    T.rules.forEach(r => items.push({ kind: 'حكم', title: r.name, text: r.short + ' ' + r.detail + ' ' + (r.letters || ''), href: `#/chapter/${r.chapter}#rule-${r.id}` }));
    T.chapters.forEach(c => { items.push({ kind: 'باب', title: c.title, text: c.subtitle + ' ' + c.intro, href: `#/chapter/${c.id}` }); c.sections.forEach((s, i) => items.push({ kind: `باب: ${c.title}`, title: s.title, text: (s.body || '') + ' ' + (s.tips || []).join(' ') + ' ' + (s.examples || []).map(e => T.stripMarkup(e.text)).join(' '), href: `#/chapter/${c.id}#s${i}` })); });
    T.glossary.forEach(g => items.push({ kind: 'مصطلح', title: g.term, text: g.def, href: '#/glossary' }));
    items.forEach(it => { it.n = norm(it.title + ' ' + it.text); it.nt = norm(it.title); });
    return (searchIndex.cache = items);
  }
  pages.search = function (_, query) {
    const q = query.get('q') || '';
    setTimeout(() => { const inp = document.getElementById('q'); inp.focus(); inp.addEventListener('input', () => { history.replaceState(null, '', '#/search?q=' + encodeURIComponent(inp.value)); document.getElementById('results').innerHTML = resultsHtml(inp.value); }); }, 0);
    return `<h1>بحث</h1><div class="search-box">${I.search}<input id="q" type="search" placeholder="ابحث عن حكم أو مصطلح أو كلمة… (مثل: إقلاب، قطب جد، مِن رَّبِّهِمْ)" value="${esc(q)}"></div><div id="results">${resultsHtml(q)}</div>`;
  };
  // Scoring: each query word found in the title adds 3, found anywhere adds 1.
  // Best 30 results are shown.
  function resultsHtml(q) {
    const n = norm(q.trim()); if (!n) return '<p class="muted" style="margin-top:12px">اكتب كلمة للبحث في الأحكام والأبواب والمصطلحات.</p>';
    const words = n.split(/\s+/).filter(Boolean);
    const hits = searchIndex().map(it => { let score = 0; words.forEach(w => { if (it.nt.includes(w)) score += 3; if (it.n.includes(w)) score += 1; }); return { it, score }; }).filter(h => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 30);
    if (!hits.length) return '<div class="empty">لا نتائج.</div>';
    return hits.map(({ it }) => { const snippet = it.text.replace(/<[^>]+>/g, '').slice(0, 140); return `<a class="result-item" href="${it.href}"><div class="k">${esc(it.kind)}</div><b>${esc(it.title)}</b><div class="muted" style="font-size:.9rem">${esc(snippet)}…</div></a>`; }).join('');
  }

  /* ---------- المزيد ---------- */
  // "More" hub for mobile, where the bottom bar only fits five items.
  // Lists every secondary page with a one-line description.
  pages.more = function () {
    const items = [
      ['#/legend', 'palette', 'دليل الألوان', 'معنى كل لون من ألوان الأحكام'],
      ['#/glossary', 'book', 'المصطلحات', 'تعريفات مختصرة لأهم مصطلحات التجويد'],
      ['#/search', 'search', 'بحث', 'ابحث في الأحكام والأبواب والمصطلحات'],
      ['#/settings', 'settings', 'الإعدادات', 'المظهر، القارئ، حجم الخط، مسح التقدّم'],
    ];
    // Last item opens the user's mail app (mailto), not an in-app route.
    items.push([contactHref, 'mail', 'للتواصل والاستفسارات', `<span dir="ltr">${CONTACT_EMAIL}</span>`]);
    return `<h1>المزيد</h1><div class="menu-list">${items.map(([h, ic, t, d]) => `<a class="menu-item" href="${h}"><span class="ic">${I[ic]}</span><span><b>${t}</b><span class="muted">${d}</span></span>${I.next}</a>`).join('')}</div>`;
  };

  /* ---------- الإعدادات ---------- */
  // Settings page. Theme is stored in 'tajweed:theme' (read early by
  // index.html to avoid a flash); reciter and font size in store settings.
  pages.settings = function () {
    const s = store.settings(); const theme = document.documentElement.getAttribute('data-theme') || 'auto';
    setTimeout(() => {
      document.querySelectorAll('[data-theme-opt]').forEach(b => b.addEventListener('click', () => { setTheme(b.dataset.themeOpt); document.querySelectorAll('[data-theme-opt]').forEach(x => x.classList.toggle('on', x === b)); }));
      document.getElementById('reciter').addEventListener('change', e => { store.setSetting('reciter', e.target.value); T.stopAudio(); toast('تم تغيير القارئ'); });
      document.getElementById('fs').addEventListener('input', e => { store.setSetting('fontScale', +e.target.value); applyFont(); });
      document.getElementById('reset').addEventListener('click', () => { if (confirm('هل تريد مسح كل التقدّم المسجّل؟')) { store.reset(); toast('تم مسح التقدّم'); renderNav('settings'); } });
    }, 0);
    return `<h1>الإعدادات</h1><div class="card">
      <div class="setting"><div><b>المظهر</b><div class="muted" style="font-size:.85rem">فاتح، داكن، أو حسب النظام</div></div><div class="seg"><button data-theme-opt="light" class="${theme === 'light' ? 'on' : ''}">فاتح</button><button data-theme-opt="auto" class="${theme === 'auto' ? 'on' : ''}">تلقائي</button><button data-theme-opt="dark" class="${theme === 'dark' ? 'on' : ''}">داكن</button></div></div>
      <div class="setting"><div><b>القارئ</b><div class="muted" style="font-size:.85rem">التلاوات من everyayah.com وتحتاج إلى اتصال بالإنترنت</div></div><select id="reciter">${T.reciters.map(r => `<option value="${r.id}" ${s.reciter === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div class="setting"><div><b>حجم خط الآيات</b></div><input id="fs" type="range" min=".8" max="1.5" step=".05" value="${s.fontScale || 1}"></div>
      <div class="setting"><div><b>مسح التقدّم</b><div class="muted" style="font-size:.85rem">يحذف الأبواب المكتملة ونتائج الاختبارات من هذا الجهاز</div></div><button class="btn small" id="reset" type="button" style="color:var(--danger)">مسح</button></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>عن التطبيق</h3><p class="muted" style="margin:6px 0 0">موسوعة التجويد: تطبيق مفتوح لتعلّم أحكام تجويد القرآن الكريم برواية حفص عن عاصم من طريق الشاطبية. المحتوى تعليمي مبسّط ولا يُغني عن التلقّي عن شيخ متقن. الخطوط: Amiri وAmiri Quran وNoto Naskh Arabic برخصة SIL OFL. التلاوات من everyayah.com. يعمل التطبيق كليًّا في المتصفح ولا يرسل أي بيانات.</p></div>
    <div class="card" style="margin-top:14px"><h3>للتواصل والاستفسارات</h3><p class="muted" style="margin:6px 0 0">لأي سؤال أو ملاحظة أو خطأ تلاحظه في التطبيق، راسلنا على: <a href="${contactHref}" dir="ltr">${CONTACT_EMAIL}</a></p></div>`;
  };

  // 'light' | 'dark' set data-theme on <html>; 'auto' removes it so CSS follows
  // the OS (prefers-color-scheme).
  function setTheme(t) { if (t === 'auto') { document.documentElement.removeAttribute('data-theme'); try { localStorage.removeItem('tajweed:theme'); } catch (e) {} } else { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('tajweed:theme', t); } catch (e) {} } syncThemeButton(); }
  // The top-bar button shows the theme it will switch TO (sun in dark mode,
  // moon in light mode), and its label says so.
  const isDark = () => (document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  function syncThemeButton() {
    const b = document.getElementById('theme-toggle'); const dark = isDark();
    b.innerHTML = dark ? I.sun : I.moon;
    const label = dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن';
    b.setAttribute('aria-label', label); b.title = label;
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeButton);
  // Quran text size = 1.9rem × fontScale, through the --quran-size CSS variable.
  function applyFont() { document.documentElement.style.setProperty('--quran-size', (1.9 * (store.settings().fontScale || 1)).toFixed(2) + 'rem'); }
  T.applyFont = applyFont;
  document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(isDark() ? 'light' : 'dark');
  });

  /* ---------- أحداث عامة ---------- */
  // Delegated handlers on #view (survive re-renders):
  //   .rule-tag   -> open the explanation sheet for that rule
  //   #mark-done  -> toggle "chapter done" for the chapter in the URL
  //   .zone       -> show details of a makharij diagram point
  // Enter / Space activate rule tags and diagram zones for keyboard users.
  view.addEventListener('click', e => {
    const toc = e.target.closest('[data-toc]'); if (toc) { e.preventDefault(); const el = document.getElementById(toc.dataset.toc); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } return; }
    const tag = e.target.closest('.rule-tag'); if (tag) { T.explain(tag.dataset.rule); return; }
    const done = e.target.closest('#mark-done'); if (done) { const id = location.hash.split('/')[2]?.split('#')[0]; const now = !store.chapterDone(id); store.setChapterDone(id, now); toast(now ? 'أحسنت! تم إتمام الباب' : 'تم إلغاء الإتمام'); render(); return; }
    const zone = e.target.closest('.zone'); if (zone) { const d = JSON.parse(document.getElementById('diagram').dataset.zones)[zone.dataset.id]; document.querySelectorAll('.zone').forEach(z => z.classList.toggle('on', z === zone)); document.getElementById('diagram-info').innerHTML = `<b>${esc(d.name)}</b> <span class="letters">${esc(d.letters)}</span><div>${esc(d.desc)}</div>`; }
  });
  view.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && (e.target.classList.contains('zone') || e.target.classList.contains('rule-tag'))) { e.preventDefault(); e.target.click(); } });

  /* ---------- التوجيه ---------- */
  // Hash router. See the explanation at the top of this file.
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [pathAndQuery, anchor] = h.split('#');
    const [path, qs] = pathAndQuery.split('?');
    const parts = path.split('/').filter(Boolean);
    return { route: parts[0] || '', param: parts[1] ? decodeURIComponent(parts[1]) : '', query: new URLSearchParams(qs || ''), anchor };
  }
  // Draw the current route: close the sheet, stop audio, render the page,
  // redraw navigation, set the tab title, then scroll to the anchor (if any)
  // or to the top.
  function render() {
    const { route, param, query, anchor } = parseHash();
    const page = pages[route === '' ? 'home' : route] || (T.pages && T.pages[route]);
    T.closeSheet(); T.stopAudio();
    view.innerHTML = page ? page(param, query) : `<div class="empty">الصفحة غير موجودة. <a href="#/">العودة إلى الرئيسية</a></div>`;
    renderNav(route);
    const label = route === 'chapter' && T.chapterById[param] ? T.chapterById[param].title : (TITLES[route] || NAV.find(n => n.match(route) && n.side !== false)?.label);
    document.title = (route && label ? label + ' · ' : '') + 'موسوعة التجويد';
    // Move keyboard / screen-reader focus to the new page's heading, so a
    // route change is announced and Tab continues from the page, not the nav.
    // Skipped on first load and for the search page (it focuses its input).
    if (rendered && route !== 'search') { const h = view.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    rendered = true;
    if (anchor) { setTimeout(() => { const el = document.getElementById(anchor); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('active'); } }, 50); }
    else window.scrollTo(0, 0);
  }
  let rendered = false;
  window.addEventListener('hashchange', render);
  // Reading progress bar on chapter pages (#read-bar width = scrolled %).
  // Also toggles .scrolled on the top bar to add a shadow once the page moves.
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      document.querySelector('.topbar').classList.toggle('scrolled', window.scrollY > 4);
      const bar = document.getElementById('read-bar'); if (!bar) return;
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (max > 0 ? Math.min(100, 100 * scrollY / max) : 0).toFixed(1) + '%';
    });
  }, { passive: true });
  syncThemeButton();
  applyFont();
  render();
  /* تسجيل عامل الخدمة للعمل دون اتصال (إن وُجد) */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) { navigator.serviceWorker.register('sw.js').catch(() => {}); }
})();
