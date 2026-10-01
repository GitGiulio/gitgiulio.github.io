// Run with Node and Playwright, like check.cjs. No website dependencies.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const http = require('node:http');
const root = path.join(__dirname, '..');
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname.replace(/^\/portfolio\/?/, '');
  const file = path.resolve(root, decodeURIComponent(pathname || 'index.html'));
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  if (!file.startsWith(root)) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }
  fs.readFile(file, (error, data) => {
    response.statusCode = error ? 404 : 200;
    response.end(error ? 'Not found' : data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  const home = `http://127.0.0.1:${server.address().port}/portfolio/index.html`;
  try {
    const inventory = await browser.newPage();
    const placements = { 'index.html': ['blade'], 'site/projects.html': ['hold'], 'site/skills-it.html': ['knight'], 'site/interests-da.html': ['rocket'], 'site/travel.html': ['compass'] };
    const files = ['index.html', ...fs.readdirSync(path.join(root, 'site')).filter(file => file.endsWith('.html') && file !== 'secret.html').map(file => `site/${file}`)];
    for (const file of files) {
      await inventory.goto(new URL(file, home).href);
      assert.deepEqual(await inventory.locator('[data-egg]').evaluateAll(buttons => buttons.map(button => button.dataset.egg)), placements[file] || [], `Unique language placement: ${file}`);
    }
    await inventory.close();
    for (const base of [home, pathToFileURL(path.join(root, 'index.html')).href]) {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install();
      await page.goto(base);
      assert.equal(await page.locator('.profile [data-egg="blade"]').count(), 1, 'About must contain the hidden skate');
      assert.equal(await page.locator('#egg-collection').isVisible(), false);
      assert.equal(await page.locator('#secret-link').isVisible(), false);
      await page.locator('.profile [data-egg="blade"]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-egg-slot].found').count(), 1);
      assert.ok((await page.locator('#egg-notice').innerText()).length > 0);
      assert.equal(await page.locator('#egg-collection').isVisible(), true);
      const popup = await page.locator('#egg-collection').boundingBox();
      assert.ok(popup.y >= 0 && popup.y + popup.height <= 720, 'Collection appears in the viewport');
      await page.clock.fastForward(5100);
      assert.equal(await page.locator('#egg-collection').isVisible(), false, 'Incomplete collection disappears after five seconds');
      await page.locator('.profile [data-egg="blade"]').click();
      assert.equal(await page.locator('[data-egg-slot].found').count(), 1, 'Repeat finds count once');
      await page.getByRole('link', { name: 'Italiano', exact: true }).click();
      assert.equal(await page.locator('[data-egg-slot].found').count(), 1, 'Language changes preserve progress');
      assert.equal(await page.locator('#egg-collection').isVisible(), false, 'Navigation does not reveal an incomplete collection');
      for (const [file, id, count] of [['site/projects.html', 'hold', 2], ['site/skills-it.html', 'knight', 3], ['site/interests-da.html', 'rocket', 4]]) {
        await page.goto(new URL(file, base).href);
        assert.equal(await page.locator('#secret-link').isVisible(), false, 'No early unlock');
        await page.locator(`section [data-egg="${id}"]`).click();
        assert.equal(await page.locator('[data-egg-slot].found').count(), count);
      }
      assert.equal(await page.locator('#secret-link').isVisible(), false, 'Four finds are no longer enough');
      await page.goto(new URL('site/travel.html', base).href);
      await page.locator('[data-egg="compass"]').click();
      assert.equal(await page.locator('[data-egg-slot].found').count(), 5);
      assert.equal(await page.locator('#trail-toggle').getAttribute('aria-pressed'), 'false', 'Hunt never enables the trail');
      await page.clock.fastForward(20000);
      assert.equal(await page.locator('#egg-collection').isVisible(), true, 'Completed collection never times out');
      await page.reload();
      assert.equal(await page.locator('#secret-link').isVisible(), true, 'Unlock survives reload');
      await page.locator('#secret-link').click();
      assert.equal(await page.locator('#room').isVisible(), true, 'Unlock opens the interactive room');
      assert.equal(new URL(page.url()).pathname.split('/').pop(), 'secret.html');
      if (base.startsWith('file:')) {
        await page.locator('.back-link').focus();
        await page.locator('.back-link').click();
        assert.equal(await page.locator('[data-egg-slot].found').count(), 5, 'Returning from the room preserves file-preview progress');
        await page.locator('#secret-link').click();
      }
      await page.goBack();
      assert.equal(await page.locator('[data-egg-slot].found').count(), 5);
      await context.close();
    }

    // Denied storage carries progress through navigation without duplicate symbols.
    const blocked = await browser.newContext({ hasTouch: true, viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    });
    const touch = await blocked.newPage();
    touch.on('pageerror', error => errors.push(error.message));
    await touch.goto(home);
    await touch.locator('.profile [data-egg="blade"]').tap();
    assert.equal(await touch.locator('[data-egg="blade"] svg').evaluate(el => getComputedStyle(el).animationName), 'none');
    await touch.locator('nav.sections a[href^="site/projects.html"]').tap();
    await touch.locator('[data-egg="hold"]').tap();
    await touch.getByRole('link', { name: 'Italiano', exact: true }).tap();
    await touch.locator('nav.sections a[href^="skills-it.html"]').tap();
    await touch.locator('[data-egg="knight"]').tap();
    await touch.getByRole('link', { name: 'Dansk', exact: true }).tap();
    await touch.locator('nav.sections a[href^="interests-da.html"]').tap();
    await touch.locator('[data-egg="rocket"]').tap();
    await touch.goto(new URL('site/travel.html', home).href + new URL(touch.url()).hash);
    await touch.locator('[data-egg="compass"]').tap();
    assert.equal(await touch.locator('#secret-link').isVisible(), true);
    assert.ok(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive: true });
    await touch.screenshot({ path: path.join(__dirname, 'tmp/eggs-mobile.png'), fullPage: true });
    await touch.locator('#secret-link').tap();
    await touch.waitForURL(url => url.pathname.endsWith('/site/secret.html'));
    assert.equal(await touch.locator('#room').isVisible(), true, 'Touch unlock opens the interactive room');
    await touch.locator('.back-link').focus();
    await touch.locator('.back-link').tap();
    await touch.waitForURL(url => url.pathname.endsWith('/index.html'));
    assert.equal(await touch.locator('[data-egg-slot].found').count(), 5, 'Returning from the room preserves progress with blocked storage');
    await blocked.close();

    // Bad browser data must not crash or manufacture completion.
    for (const saved of ['{broken', '{}', '["blade","blade","fake","hold"]', '["blade","hold","knight","rocket"]']) {
      const context = await browser.newContext();
      await context.addInitScript(value => localStorage.setItem('glc-eggs-v1', value), saved);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(home);
      assert.equal(await page.locator('#secret-link').isVisible(), false);
      await page.locator('.profile [data-egg="blade"]').click();
      assert.equal(await page.locator('[data-egg-slot].found').count(), saved.includes('rocket') ? 4 : saved.startsWith('[') ? 2 : 1);
      await context.close();
    }

    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const plain = await noJS.newPage();
    await plain.goto(home);
    assert.equal(await plain.locator('.profile [data-egg="blade"]').isVisible(), false);
    assert.equal(await plain.locator('#egg-collection').isVisible(), false);
    await plain.locator('nav.sections a[href="site/projects.html"]').click();
    assert.equal(await plain.locator('h1').innerText(), 'Projects');
    await noJS.close();
    assert.deepEqual(errors, []);
    console.log('PASS: unique 2 EN / 1 IT / 1 DA placements, five-second collection, permanent completion, saved progress, file/subpath URLs, keyboard/touch, denied/malformed storage, reduced motion, no JS, and secret-room entry/return.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
