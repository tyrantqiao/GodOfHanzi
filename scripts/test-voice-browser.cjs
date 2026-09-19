// Supply PLAYWRIGHT_MODULE when using an existing external Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    const requests = [];
    page.on('request', request => {
      if (request.url().endsWith('/api/voice')) requests.push(request.postDataJSON());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.voiceStarts = 0;
      const original = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.voiceStarts++;
        return original.apply(this, args);
      };
    });
    await page.goto(process.env.GAME_URL || 'http://localhost:5174/');
    await page.locator('.pause-button').click();
    await page.locator('#voice-preview').click();
    await page.waitForFunction(() => window.voiceStarts >= 2, null, { timeout: 90000 });
    assert.equal(await page.locator('#voice-enabled').isChecked(), true);
    await page.locator('#voice-enabled').uncheck();
    await page.locator('#voice-preview').click();
    await page.waitForFunction(() => window.voiceStarts >= 3);
    await page.locator('#voice-stop').click();
    await page.screenshot({ path: 'data/voice-cache/chrome-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'data/voice-cache/chrome-mobile.png' });
    const bounds = await page.locator('#voice-volume').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#resume-battle').click();
    await page.locator('.cast-button').click();
    const canvas = await page.locator('#writing-canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * 0.2, canvas.y + canvas.height * 0.15);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + canvas.height * 0.15, { steps: 12 });
    await page.mouse.up();
    requests.length = 0;
    const feedback = page.waitForResponse(response => response.url().endsWith('/api/voice') && response.request().postDataJSON().role === 'mentor', { timeout: 90000 });
    await page.locator('#submit-writing').click();
    await feedback;
    assert.equal(requests[0].text, '一');
    assert.equal(requests[0].role, 'hero');
    assert.equal(requests[1].role, 'mentor');
    assert.deepEqual(errors, []);
    console.log('Chrome: dialogue playback, toggle, replay, skip, mobile controls and writing/mentor voice sequence passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
