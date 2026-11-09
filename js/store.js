/* التخزين المحلي للتقدّم والإعدادات */
/*
 * js/store.js — Learner progress and settings, saved in the browser's
 * localStorage. Nothing is ever sent to a server.
 *
 * Two localStorage keys:
 *   'tajweed:progress'  the progress object below
 *   'tajweed:settings'  { reciter, fontScale, maddLength }
 * (index.html and app.js also use 'tajweed:theme' for light/dark mode.)
 *
 * Progress object shape:
 *   {
 *     chapters:    { [chapterId]: { visited?: true, done?: bool, at?: timestamp } },
 *     quizzes:     { [chapterId]: { best, total, attempts, last, at } },
 *     practice:    { asked, correct, byRule: { [ruleId]: { asked, correct } } },
 *     lastChapter: chapterId | null   // drives the "continue" button on Home
 *     days:        ['YYYY-MM-DD', ...] // days with activity, for the streak (max 400 kept)
 *   }
 *
 * Every localStorage call is wrapped in try/catch: private browsing or a full
 * quota must never break the app, it just stops saving.
 * If you add a field, add it to def() too; load() merges saved data over the
 * defaults, so older saved progress keeps working.
 */
window.TAJWEED = window.TAJWEED || {};
TAJWEED.store = (function () {
  const KEY = 'tajweed:progress';
  const SETTINGS = 'tajweed:settings';
  const MUSHAF = 'tajweed:mushaf';
  const def = () => ({ chapters: {}, quizzes: {}, practice: { asked: 0, correct: 0, byRule: {} }, lastChapter: null, days: [] });
  let state = null; // in-memory copy, loaded lazily once
  function load() {
    if (state) return state;
    try { state = Object.assign(def(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { state = def(); }
    return state;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  // Record today (UTC date) as an active day. Called by every action that counts
  // as studying.
  function touchDay() {
    const s = load(); const d = new Date().toISOString().slice(0, 10);
    if (!s.days.includes(d)) { s.days.push(d); if (s.days.length > 400) s.days = s.days.slice(-400); save(); }
  }
  // Number of consecutive active days ending today. If today has no activity
  // yet, the streak still counts from yesterday so it does not look broken
  // before the learner opens a chapter.
  function streak() {
    const s = load(); const set = new Set(s.days); let n = 0; const d = new Date();
    for (;;) { const k = d.toISOString().slice(0, 10); if (!set.has(k)) { if (n === 0) { d.setDate(d.getDate() - 1); const y = d.toISOString().slice(0, 10); if (set.has(y)) { n++; d.setDate(d.getDate() - 1); continue; } } break; } n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const api = {
    get: load, save,
    touchDay, streak,
    // Settings with defaults filled in. reciter = everyayah.com folder name (see
    // T.reciters in ayah.js); fontScale multiplies the Quran font size.
    // maddLength is reserved and not used by the UI yet.
    settings() { try { return Object.assign({ reciter: 'Husary_128kbps', fontScale: 1, maddLength: 4 }, JSON.parse(localStorage.getItem(SETTINGS) || '{}')); } catch (e) { return { reciter: 'Husary_128kbps', fontScale: 1 }; } },
    setSetting(k, v) { const s = api.settings(); s[k] = v; try { localStorage.setItem(SETTINGS, JSON.stringify(s)); } catch (e) {} },
    chapterDone(id) { return !!load().chapters[id]?.done; },
    setChapterDone(id, done) { const s = load(); s.chapters[id] = Object.assign(s.chapters[id] || {}, { done, at: Date.now() }); touchDay(); save(); },
    visitChapter(id) { const s = load(); s.lastChapter = id; s.chapters[id] = Object.assign(s.chapters[id] || {}, { visited: true }); touchDay(); save(); },
    quizBest(id) { return load().quizzes[id]?.best ?? null; },
    // Save a quiz attempt; keeps the best score and counts attempts.
    recordQuiz(id, score, total) {
      const s = load(); const prev = s.quizzes[id] || { best: 0, attempts: 0 };
      s.quizzes[id] = { best: Math.max(prev.best, score), total, attempts: prev.attempts + 1, last: score, at: Date.now() };
      touchDay(); save();
    },
    recordPractice(ruleId, ok) {
      const s = load(); s.practice.asked++; if (ok) s.practice.correct++;
      const r = s.practice.byRule[ruleId] || { asked: 0, correct: 0 }; r.asked++; if (ok) r.correct++; s.practice.byRule[ruleId] = r;
      touchDay(); save();
    },
    // Overall progress percentage for the rings on Home and Path.
    // Each chapter is worth 2 points: 1 for being marked done, and up to 1 for
    // its best quiz score (best/total).
    overall() {
      const s = load(); const chapters = TAJWEED.chapters;
      let pts = 0, max = 0;
      chapters.forEach(c => {
        max += 2; if (s.chapters[c.id]?.done) pts += 1;
        const q = s.quizzes[c.id]; if (q && q.total) pts += Math.min(1, q.best / q.total);
      });
      return max ? Math.round(100 * pts / max) : 0;
    },
    /* تفضيلات المصحف: آخر قراءة، العلامات، التلوين، طريقة العرض */
    mushaf() { const d = { last: null, bookmarks: [], color: true, mode: 'flow' }; try { return Object.assign(d, JSON.parse(localStorage.getItem(MUSHAF) || '{}')); } catch (e) { return d; } },
    setMushaf(patch) { const m = api.mushaf(); Object.assign(m, patch); try { localStorage.setItem(MUSHAF, JSON.stringify(m)); } catch (e) {} return m; },
    reset() { state = def(); save(); try { localStorage.removeItem(MUSHAF); } catch (e) {} },
  };
  return api;
})();
