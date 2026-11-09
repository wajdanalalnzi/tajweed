# موسوعة التجويد

تطبيق ويب ثابت (بلا خادم) لتعلّم أحكام تجويد القرآن الكريم برواية حفص عن عاصم من طريق الشاطبية.

**جرّبه:** افتح `index.html` مباشرة، أو شغّل أي خادم ملفات ثابت في المجلد (`npm start` ثم `http://localhost:8080`). يعمل كما هو على GitHub Pages.

## ما الذي يقدّمه

- **المصحف كاملًا** بالرسم العثماني (نص Tanzil برواية حفص، مُتحقَّق منه ومقارَن حرفًا بحرف مع نص مجمع الملك فهد)، مع تلوين أحكام التجويد في كل آية كمُعين تعليمي يمكن إخفاؤه، وعلامات الوقف والسجدة والأحزاب، وفهرس السور والأجزاء، وعلامات القراءة، وتلاوة متواصلة للسورة، وحفظ آخر موضع قراءة. تفاصيل المصادر والتحقق في `REFERENCES.md` و`data/mushaf/VERIFICATION.md`.
- **مسار تعلّم مرتّب** من ١٣ بابًا: المدخل، المخارج، الصفات، النون الساكنة والتنوين، الميم الساكنة، المدود، القلقلة، الراء، اللام، التفخيم والترقيق، الإدغام العام، الوقف والسكت، همزة الوصل والقطع.
- **آيات ملوّنة بالأحكام** (١٥١ مثالًا، ١٨٢ موضعًا مظلّلًا): المس أي جزء ملوّن لتظهر بطاقة تشرح الحكم، ولماذا ينطبق هنا تحديدًا، وكيف يُؤدّى.
- **تلاوات صوتية** لكل آية مثال من everyayah.com باختيار القارئ (الحصري، الحصري المعلّم، عبد الباسط، المنشاوي، العفاسي).
- **اختبار لكل باب** (٩٥ سؤالًا) مع تعليل كل إجابة، وتسجيل أفضل نتيجة؛ النجاح بنسبة ٨٠٪ يُتمّ الباب تلقائيًّا.
- **تدريب «تعرّف على الحكم»**: أمثلة عشوائية من الآيات مع خيارات، يمكن تصفيتها بالباب أو بالحكم.
- **مخطط تفاعلي لمخارج الحروف**، ودليل ألوان، ومسرد مصطلحات، وبحث يتجاهل التشكيل.
- **تقدّم محفوظ محليًّا** (أبواب مكتملة، نتائج، أيام متتالية) دون أي إرسال للبيانات.
- واجهة عربية RTL كاملة، وضع داكن، خط عثماني (Amiri Quran) مضمّن محليًّا، يعمل دون اتصال بعد أول زيارة (Service Worker)، وقابل للتثبيت كتطبيق (PWA).

## بنية الملفات

```
index.html            الصفحة الوحيدة (تطبيق صفحة واحدة بتوجيه عبر #)
css/app.css           التصميم (متغيّرات ألوان للوضعين الفاتح والداكن)
css/fonts.css         تعريف الخطوط المضمّنة
js/data/rules.js      الأحكام ومجموعات الألوان
js/data/chapters.js   الأبواب والأمثلة الملوّنة
js/data/quizzes.js    الاختبارات
js/data/glossary.js   المصطلحات
js/store.js           التقدّم والإعدادات (localStorage)
js/ayah.js            عرض الآيات، بطاقة الشرح، الصوت
js/mushaf.js          المصحف: فهرس السور، صفحة القراءة، التلاوة المتواصلة
js/app.js             التوجيه والصفحات
data/mushaf/          نص المصحف ومواضع الأحكام وعلامات الوقف (ملف لكل سورة) وتقرير التحقق
scripts/build_mushaf.py  يبني data/mushaf من المصادر ويتحقق منها (python3 -I scripts/build_mushaf.py)
scripts/validate.js   فحص سلامة البيانات (npm test)
REFERENCES.md         قائمة المصادر والتراخيص وطريقة التحقق منها
```

## ترميز الأمثلة

نص المثال يُكتب كما في المصحف مع تظليل مواضع الأحكام بالصيغة:

```
{معرّف-الحكم|النص المظلّل|ملاحظة اختيارية تشرح سبب انطباق الحكم هنا}
```

مثال: `وَءَامَنَهُم {izhar|مِّنْ خَ|نون ساكنة بعدها خاء: إظهار}وْفٍۭ`. معرّفات الأحكام في `js/data/rules.js`. شغّل `npm test` بعد أي تعديل للتأكد من صحة المعرّفات والمراجع.

## إضافة محتوى

1. أضف الحكم في `rules.js` (إن كان جديدًا) مع مجموعته اللونية.
2. أضف الفقرة والأمثلة في الباب المناسب في `chapters.js` مع مرجع الآية `[رقم السورة, رقم الآية, 'اسم السورة']` ليعمل الصوت.
3. أضف أسئلة الاختبار في `quizzes.js`.
4. `npm test`.

## الترخيص والمصادر

- نص المصحف من Tanzil.net (رخصة CC BY 3.0، لا يجوز تعديله) ويُنقل حرفيًّا؛ علامات الوقف من نص مجمع الملك فهد؛ تظليل الأحكام من مشروع quran-tajweed (CC BY 4.0) بعد إعادة محاذاته والتحقق منه. القائمة الكاملة بالروابط والبصمات في `REFERENCES.md`.
- الخطوط Amiri وAmiri Quran وNoto Naskh Arabic برخصة SIL Open Font License 1.1 (`fonts/OFL.txt`).
- التلاوات تُبثّ من everyayah.com ولا تُخزَّن في المشروع.
- المحتوى تعليمي مبسّط ولا يُغني عن التلقّي عن شيخ متقن.

## للتواصل والاستفسارات

لأي سؤال أو ملاحظة: [Eng.majid.f@outlook.com](mailto:Eng.majid.f@outlook.com) (يظهر العنوان أيضًا في صفحتي «المزيد» و«الإعدادات» داخل التطبيق).

## Developer guide (English)

A quick orientation for new contributors. Every file also starts with a header comment explaining what it does.

### Run it

- No build step and no dependencies. Open `index.html` directly, or run `npm start` and open `http://localhost:8080` (the service worker only runs over http).
- `npm test` validates all content data. Run it after every content change.
- `npm run screenshots` (needs Playwright and a running server) captures every page on mobile, desktop and dark mode and fails on any console error. Use it as a smoke test after code changes.

### How it fits together

- Plain classic `<script>` tags, no modules or framework, so the app also works from `file://`. Everything hangs off one global object, `window.TAJWEED` (usually aliased as `T`).
- Load order in `index.html` matters: `js/data/*.js` (pure data) → `js/store.js` (localStorage) → `js/ayah.js` (ayah rendering, explanation sheet, audio) → `js/mushaf.js` (full-Quran reader, registers its pages on `T.pages`) → `js/app.js` (router and pages).
- Routing is hash based: `#/chapter/madd#rule-madd-lazim` means route `chapter`, param `madd`, then scroll to the element with id `rule-madd-lazim`. Each route is a function in `pages` (in `app.js`) that returns an HTML string for `<main id="view">`. The full route list is at the top of `app.js`.
- Clicks are handled by event delegation on `document` or `#view`, so pages can re-render without re-binding.
- Pages that need data or event listeners do that in `setTimeout(..., 0)` after their HTML is in the DOM (search, settings, the mushaf pages).

### Content data

| File | Contains | Key format |
| --- | --- | --- |
| `js/data/rules.js` | `groups` (colours) and `rules` | rule `{ id, chapter, group, name, letters, short, detail, how }` |
| `js/data/chapters.js` | learning path | chapter → `sections[]` → `examples[]` of `{ text, ref: [surah, ayah, name], note }` |
| `js/data/quizzes.js` | quizzes by chapter id | `{ q, options[], answer (0-based), why }` |
| `js/data/glossary.js` | glossary | `{ term, def }` |

Coloured Quran text uses the markup `{ruleId|text to colour|optional why-note}` (see "ترميز الأمثلة" above). The rule's `group` picks the colour; `ayah.js` turns each group into a CSS class `g-<group>` with a `--c` colour variable for light and dark mode.

### Mushaf data (`data/mushaf/`)

- One JSON file per surah (`001.json` … `114.json`) plus `index.json` (surah list, juz starts, checksums). Each ayah is `{ n, t, j, w }`: `t` is the Quran text, a verbatim copy of the Tanzil Uthmani text (never edit it by hand; `npm test` checks its SHA-256); `j` lists tajweed spans `[start, end, ruleId]` into `t` (rule ids from `rules.js`, spans may overlap); `w` lists pause/sajdah/hizb marks `[offset, mark]` inserted at display time.
- `js/mushaf.js` (`colorHtml`) merges text, spans and marks into HTML; the reader toolbar toggles colours, flow/list mode and font size; the player streams the surah ayah by ayah.
- To regenerate the data (for example after a new source version) run `python3 -I scripts/build_mushaf.py` from the repo root. It downloads the sources into `sources/` (gitignored), verifies the Tanzil checksum, cross-checks the letters against two other editions, realigns the tajweed annotations, builds the pause-mark layer and rewrites `data/mushaf/VERIFICATION.md` (Arabic report). `REFERENCES.md` lists every source with links, checksums and licenses.

### Audio, storage, offline

- Audio streams from `https://everyayah.com/data/<reciter>/<SSS><AAA>.mp3` (surah and ayah padded to 3 digits). Reciters are listed in `T.reciters` in `ayah.js`. Nothing is downloaded into the repo.
- Progress and settings live in `localStorage` under `tajweed:progress`, `tajweed:settings`, `tajweed:mushaf` (last read position, bookmarks, reader preferences), `tajweed:theme` and `tajweed:onboarded` (first-visit help card dismissed). The shape is documented at the top of `js/store.js`. No data leaves the device.
- `sw.js` caches the app shell network-first, so online users always get the latest files; surah files are cached once opened. Add new files to its `SHELL` list if they are needed offline, and bump `CACHE` when that list changes.

### Brand

- Logo: an open mushaf whose lines are drawn in tajweed rule colours (coral, cream, mint), on a gold eight-point star over the brand green. Original SVG paths, no font needed.
- `icons/icon.svg` is the app icon and `icons/favicon.svg` the browser-tab icon (same artwork); it is also inlined in the header (`.brand .mark` in `index.html`). PNGs: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (full-bleed, for Android), `apple-touch-icon.png` (180px). Re-render the PNGs from the SVGs if the artwork changes.
- Colours: brand green `#0f6e56` (deep `#0a4d3c`), gold accent `#d9b35c`, paper `#f6f1e7`. The header tile and home hero keep the brand green in dark mode too.

### Conventions

- Escape every dynamic value with `T.esc()` before putting it in HTML. Only chapter `body` fields are trusted HTML.
- Show numbers to users with `T.ar()` (Arabic-Indic digits).
- UI text is Arabic and the layout is RTL; code comments are in English.
- Never change Quran text when editing markup: only wrap existing text in `{…|…}`.
