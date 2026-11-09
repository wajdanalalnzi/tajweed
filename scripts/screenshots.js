/* يلتقط صورًا للتطبيق ويرصد أخطاء الكونسول. يحتاج Playwright وخادمًا على المنفذ 8080. */
/*
 * Usage: start a server first (`npm start`), then `npm run screenshots`.
 * Env vars: BASE (default http://localhost:8080/), OUT (default ./screenshots).
 * Captures every main route on mobile, desktop and mobile-dark, plus the
 * explanation sheet, and fails if any page logs a console error. Handy as a
 * quick smoke test after code changes. Requires Playwright (not a dependency
 * in package.json; install it globally or with npx).
 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const base = process.env.BASE || 'http://localhost:8080/';
  const out = process.env.OUT || 'screenshots'; fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const routes = ['#/', '#/path', '#/chapter/noon-sakinah', '#/chapter/makharij', '#/chapter/madd', '#/quiz/noon-sakinah', '#/practice', '#/legend', '#/glossary', '#/search?q=اقلاب', '#/settings'];
  for (const [name, vp, theme] of [['mobile', { width: 390, height: 844 }, 'light'], ['desktop', { width: 1280, height: 860 }, 'light'], ['mobile-dark', { width: 390, height: 844 }, 'dark']]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: theme, locale: 'ar' });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
    for (const r of routes) {
      await page.goto(base + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/${name}-${r.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: r !== '#/chapter/madd' });
    }
    // تفاعل: المس جزءًا ملوّنًا
    await page.goto(base + '#/chapter/noon-sakinah', { waitUntil: 'networkidle' });
    await page.locator('.tj').first().click(); await page.waitForTimeout(350);
    await page.screenshot({ path: `${out}/${name}-sheet.png` });
    await ctx.close();
  }
  await browser.close();
  if (errors.length) { console.error('Console errors:\n' + errors.join('\n')); process.exit(1); }
  console.log('screenshots OK, no console errors');
})();
