// Headless check: loads docs/index.html, confirms the in-page reconciliation checks pass and no script errors.
// Usage: npm i playwright && npx playwright install chromium && node tests/verify.js
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://fonts.*/**', r => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '../docs/index.html'));
  await page.waitForFunction(() => window.__dash && window.__dash.last, null, { timeout: 120000 });
  const foot = await page.evaluate(() => document.getElementById('foot').innerText.replace(/\n/g, ' | '));
  console.log(foot);
  await browser.close();
  if (errors.length || !/reconciliation checks passed/.test(foot)) { console.error('FAILED', errors); process.exit(1); }
  console.log('OK');
})();
