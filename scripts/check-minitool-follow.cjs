const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/dayweave-reader/venv/lib/python3.12/site-packages/playwright/driver/package');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const deadline = Date.UTC(2026, 10, 30, 16);
    const result = {};
    for (const [test, now, reject, expectedCalls] of [
      ['beforeDeadline', deadline - 1, false, 1],
      ['atDeadline', deadline, false, 0],
      ['clientRejected', deadline - 1, true, 1],
    ]) {
      const page = await browser.newPage({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
      await page.addInitScript(({ now, reject }) => {
        Date.now = () => now;
        window.followCalls = 0;
        window.xhs = { miniTool: { followAuthor: async () => {
          window.followCalls++;
          if (reject) throw Error('unsupported');
        } } };
      }, { now, reject });
      await page.goto(process.env.APP_URL_LEGACY || 'http://127.0.0.1:5192');
      await page.locator('.loading').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: '关注作者', exact: true }).tap();
      const hint = page.locator('#follow-help');
      if (reject || !expectedCalls) await hint.waitFor();
      else assert.equal(await hint.count(), 0);
      assert.equal(await page.evaluate(() => window.followCalls), expectedCalls);
      result[test] = { calls: expectedCalls, builtInMenuHint: await hint.isVisible() };
      await page.close();
    }
    fs.writeFileSync('output/minitool-follow-check.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
