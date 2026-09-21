// Run with Node and Playwright installed. The website itself has no dependencies.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const content = JSON.parse(fs.readFileSync(path.join(__dirname, 'content.json'), 'utf8'));
const sections = ['about', 'experience', 'projects', 'education', 'skills', 'interests'];
const filename = (lang, section) => section === 'about'
  ? (lang === 'en' ? 'index.html' : `${lang}.html`)
  : `${section}${lang === 'en' ? '' : `-${lang}`}.html`;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const home = pathToFileURL(path.join(__dirname, 'site/index.html')).href;
  try {
    for (const lang of ['en', 'it', 'da']) {
      for (const section of sections) {
      const file = filename(lang, section);
      await page.goto(new URL(file, home).href);
      assert.equal(await page.locator('html').getAttribute('lang'), lang);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('nav.languages a').count(), 3);
      assert.equal(await page.locator('nav.languages a[aria-current="page"]').getAttribute('lang'), lang);
      assert.equal(await page.locator('main > section').count(), 1, 'Each page must contain only its own section');
      assert.equal(await page.locator('main > section').getAttribute('id'), section);
      assert.equal(await page.locator('header nav.sections a').count(), 6);
      if (section === 'projects') {
        for (const [index, project] of content[lang].projects.entries()) {
          const links = page.locator('article.project').nth(index).locator('.project-link');
          const expected = project.links || [{ url: project.url, label: content[lang].projectLink }];
          assert.equal(await links.count(), expected.length);
          for (const [i, link] of expected.entries()) {
            assert.equal(await links.nth(i).getAttribute('href'), link.url);
            assert.ok((await links.nth(i).textContent()).startsWith(link.label));
          }
        }
      }
      if (section === 'interests') {
        assert.equal(await page.locator('main article').count(), content[lang].interests.length);
        assert.ok((await page.title()).includes(content[lang].nav[5]));
        const placeholders = content[lang].interests.filter(item => item.media && !item.media.src.trim());
        assert.equal(await page.locator('.media-placeholder').count(), placeholders.length);
        for (const slot of await page.locator('.media-placeholder').all()) {
          assert.ok((await slot.textContent()).includes(content[lang].mediaPlaceholder));
        }
      }
      assert.equal(await page.locator('nav.sections a[aria-current="page"]').getAttribute('href'), file);
      for (const img of await page.locator('img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(element => element.decode());
      }
      assert.equal(await page.locator('a[href$=".pdf"]').count(), 0);
      for (const width of [360, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang}: overflow at ${width}`);
      }
      for (const link of await page.locator('nav.sections a').all()) {
        const href = await link.getAttribute('href');
        assert.ok(fs.existsSync(path.join(__dirname, 'site', href)), `Missing page ${href}`);
      }
      for (const link of await page.locator('nav.languages a').all()) {
        assert.equal(await link.getAttribute('href'), filename(await link.getAttribute('lang'), section));
      }
      }
    }
    await page.goto(new URL('projects.html', home).href);
    await page.getByRole('link', { name: 'Italiano', exact: true }).click();
    assert.equal(new URL(page.url()).pathname.split('/').pop(), 'projects-it.html');
    await page.locator('nav.sections a[href="education-it.html"]').click();
    assert.equal(await page.locator('main > section').getAttribute('id'), 'education');
    await page.goBack();
    assert.equal(await page.locator('main > section').getAttribute('id'), 'projects');
    await page.reload();
    assert.equal(await page.locator('main > section').getAttribute('id'), 'projects');
    await page.goto(home);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
    await page.getByRole('link', { name: 'Italiano', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'it');
    await page.getByRole('link', { name: 'Dansk', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'da');
    await page.getByRole('link', { name: 'English', exact: true }).click();
    const toggle = page.locator('#trail-toggle');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await page.reload();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await toggle.focus();
    await page.keyboard.press('Space');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    const ink = () => page.locator('canvas').evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      for (let i = 3; i < data.length; i += 4) sum += data[i];
      return sum;
    });
    await page.mouse.move(50, 400);
    await page.mouse.move(240, 470, { steps: 15 });
    await page.waitForTimeout(80);
    assert.ok(await ink() > 0, 'Mouse movement must draw a trail');
    for (const button of ['left', 'right']) {
      await toggle.click(); await toggle.click();
      await page.mouse.move(50, 400);
      await page.waitForTimeout(1600);
      await page.mouse.down({ button });
      await page.waitForTimeout(400);
      assert.ok(await ink() > 0, `${button} held stationary must emit`);
      await page.mouse.up({ button });
      await page.keyboard.press('Escape');
    }
    await toggle.click();
    await page.mouse.move(100, 700, { steps: 5 });
    assert.equal(await ink(), 0, 'Off must clear and stop the effect');
    const reduced = await browser.newContext({ reducedMotion: 'reduce' });
    const quiet = await reduced.newPage();
    await quiet.goto(home);
    assert.equal(await quiet.locator('#trail-toggle').getAttribute('aria-pressed'), 'false');
    await reduced.close();
    await page.screenshot({ path: path.join(__dirname, 'tmp/desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, 'tmp/mobile.png'), fullPage: true });
    await page.goto(new URL('projects-it.html', home).href);
    await page.screenshot({ path: path.join(__dirname, 'tmp/projects-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(__dirname, 'tmp/projects-desktop.png'), fullPage: true });
    await page.goto(new URL('interests.html', home).href);
    await page.screenshot({ path: path.join(__dirname, 'tmp/interests-desktop.png'), fullPage: true });
    await page.getByRole('link', { name: 'Italiano', exact: true }).click();
    assert.equal(new URL(page.url()).pathname.split('/').pop(), 'interests-it.html');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, 'tmp/interests-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 720, height: 900 });
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Enlarged text must reflow');
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const plain = await noJS.newPage();
    await plain.goto(new URL('projects-it.html', home).href);
    await plain.locator('nav.sections a[href="interests-it.html"]').click();
    await plain.getByRole('link', { name: 'Dansk', exact: true }).click();
    assert.equal(await plain.locator('main > section').getAttribute('id'), 'interests');
    assert.equal(await plain.locator('html').getAttribute('lang'), 'da');
    assert.equal(await plain.locator('.effect-control').isVisible(), false);
    await noJS.close();
    assert.deepEqual(errors, []);
    console.log('PASS: 18 standalone pages including personal interests, three languages, responsive layout, section-preserving language links, browser history, assets, keyboard toggle, saved preference, mouse buttons and reduced motion.');
  } finally {
    await browser.close();
  }
})();
