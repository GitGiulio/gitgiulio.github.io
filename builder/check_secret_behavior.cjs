// Run with the same Node/Playwright setup as check_secret.cjs.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const content = require('./content.json');
const url = pathToFileURL(path.join(__dirname, '../site/secret.html')).href;

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const failures = [];
  async function check(name, run, options = {}) {
    const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', ...options });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(5000);
    try {
      await page.clock.setFixedTime(new Date('2026-09-30T22:01:00Z'));
      await page.goto(url);
      await run(page);
      assert.deepEqual(errors, [], 'No script errors');
      console.log(`PASS: ${name}`);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    } finally {
      await page.close();
    }
  }
  try {
    await check('hover cards show only the story sourced from content.json', async page => {
      const stories = { ...content.secret };
      for (const [object, index] of Object.entries({ 'short-track': 0, 'long-track': 0, climbing: 1, rocket: 3 })) {
        stories[object] = content.en.interests[index].description;
      }
      assert.equal(await page.locator('#room-tooltip > *').count(), 1, 'Only the story paragraph remains');
      assert.equal(await page.locator('#tooltip-title, .tooltip-kicker, .tooltip-dismiss').count(), 0);
      for (const [object, copy] of Object.entries(stories)) {
        if (object === 'monitor') continue;
        await page.keyboard.press('Escape');
        await page.locator(`[data-object="${object}"]`).hover();
        assert.equal(await page.locator('#room-tooltip').innerText(), copy);
      }
    });
    await check('an unpinned story stays readable while the pointer is over its tooltip', async page => {
      await page.locator('[data-object="monitor"]').hover();
      const panel = await page.locator('#room-tooltip').boundingBox();
      await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
      await page.waitForTimeout(250);
      assert.equal(await page.locator('#room-tooltip').isVisible(), true, 'Moving from the object onto its story keeps it open');
      assert.equal(await page.locator('.room-scene').getAttribute('data-active'), 'monitor');
      await page.mouse.move(10, 900);
      await page.waitForFunction(() => document.querySelector('#room-tooltip').hidden);
    });

    await check('clicking or tapping a pinned story does not dismiss it or reach the room underneath', async page => {
      await page.locator('[data-object="monitor"]').click();
      await page.evaluate(() => {
        window.roomClicks = 0;
        document.querySelector('.room-scene').addEventListener('click', () => { window.roomClicks++; });
      });
      const panel = await page.locator('#room-tooltip').boundingBox();
      await page.mouse.click(panel.x + panel.width / 2, panel.y + panel.height / 2);
      assert.equal(await page.locator('#room-tooltip').isVisible(), true, 'The story remains pinned when its text is clicked');
      assert.equal(await page.locator('.room-scene').getAttribute('data-active'), 'monitor');
      assert.equal(await page.evaluate(() => window.roomClicks), 0, 'Tooltip clicks do not reach underlying scene controls');
      await page.touchscreen.tap(panel.x + panel.width / 2, panel.y + panel.height / 2);
      assert.equal(await page.locator('#room-tooltip').isVisible(), true, 'The story remains pinned when its text is tapped');
      assert.equal(await page.evaluate(() => window.roomClicks), 0, 'Tooltip taps do not reach underlying scene controls');
      await page.mouse.click(10, 900);
      assert.equal(await page.locator('#room-tooltip').isVisible(), false, 'A click outside still dismisses the story');
    }, { hasTouch: true });

    await check('blank and incorrect guesses get feedback, aliases allow a successful retry', async page => {
      assert.deepEqual(await page.locator('.daily-flag').evaluateAll(flags => flags.map(flag => flag.getAttribute('href'))),
        ['media/flags/tr.svg', 'media/flags/tj.svg', 'media/flags/ru.svg'], 'The established 1 October 2026 draw is unchanged');
      await page.locator('[data-object="flags"]').click();
      await page.locator('#flag-guess-1').fill('Atlantis');
      await page.locator('#flag-guess-2').fill('Russia');
      await page.locator('#flag-check').click();
      assert.match(await page.locator('#flag-result-0').innerText(), /enter|choose|name/i, 'A blank guess gets useful feedback');
      assert.equal(await page.locator('#flag-guess-0').getAttribute('aria-invalid'), 'true');
      assert.match(await page.locator('#flag-result-1').innerText(), /Tajikistan/, 'An incorrect guess reveals the country');
      assert.match(await page.locator('#flag-result-2').innerText(), /Correct.*Russia/);
      assert.match(await page.locator('#flag-score').innerText(), /^1 \/ 3/);
      await page.locator('#flag-guess-0').fill('t.u.R.K.e.Y');
      await page.locator('#flag-guess-1').fill('Tajikistan');
      await page.locator('#flag-check').click();
      assert.match(await page.locator('#flag-result-0').innerText(), /Correct.*Türkiye/);
      assert.match(await page.locator('#flag-score').innerText(), /^3 \/ 3/);
      await page.locator('#flag-close').click();
      assert.equal(await page.locator('[data-object="flags"]').evaluate(button => button === document.activeElement), true);
    });

    await check('every open modal blocks room shortcuts, including focus on its close button', async page => {
      await page.locator('[data-object="flags"]').click();
      await page.locator('#flag-close').focus();
      await page.keyboard.press('m');
      await page.keyboard.press('o');
      assert.equal(await page.locator('body').getAttribute('data-motion'), 'off', 'M cannot change room motion inside the quiz');
      assert.equal(await page.locator('.room-scene').evaluate(scene => scene.classList.contains('show-objects')), false);
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        const dialog = document.createElement('dialog');
        dialog.innerHTML = '<button>Other modal</button>';
        document.body.append(dialog);
        dialog.showModal();
      });
      await page.keyboard.press('m');
      await page.keyboard.press('o');
      assert.equal(await page.locator('body').getAttribute('data-motion'), 'off', 'Any new modal also blocks shortcuts');
      assert.equal(await page.locator('.room-scene').evaluate(scene => scene.classList.contains('show-objects')), false);
    });

    await check('editable descendants, modifiers and repeated keys do not activate room shortcuts', async page => {
      await page.evaluate(() => {
        const editor = document.createElement('div');
        editor.setAttribute('contenteditable', '');
        editor.innerHTML = '<span tabindex="0">Editable text</span>';
        document.body.append(editor);
        editor.firstChild.focus();
      });
      await page.keyboard.press('m');
      await page.keyboard.press('o');
      assert.equal(await page.locator('body').getAttribute('data-motion'), 'off');
      assert.equal(await page.locator('.room-scene').evaluate(scene => scene.classList.contains('show-objects')), false);
      await page.locator('.room-viewport').focus();
      await page.keyboard.press('Shift+M');
      await page.keyboard.press('Control+o');
      await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', repeat: true, bubbles: true })));
      assert.equal(await page.locator('body').getAttribute('data-motion'), 'off');
      assert.equal(await page.locator('.room-scene').evaluate(scene => scene.classList.contains('show-objects')), false);
      await page.keyboard.press('m');
      await page.keyboard.press('o');
      assert.equal(await page.locator('body').getAttribute('data-motion'), 'on', 'An ordinary M still toggles motion');
      assert.equal(await page.locator('.room-scene').evaluate(scene => scene.classList.contains('show-objects')), true);
    });

    await check('all four lyric triggers select their own artist, language and artwork and return focus', async page => {
      assert.equal(await page.locator('.lyric-note').count(), 4);
      for (const [id, artist, language, title, lines] of [
        ['sunshine', 'Rancore', 'it', 's.u.n.s.h.i.n.e.', 16],
        ['dragon', 'Rancore', 'it', 'Sangue di drago', 8],
        ['rime', 'Rancore', 'it', 'Le Rime (Gara tra 507 parole)', 5],
        ['avril', 'Avril Lavigne', 'en', 'Sk8er Boi', 12],
      ]) {
        const trigger = page.locator(`[data-lyric="${id}"]`);
        await trigger.focus();
        await page.keyboard.press(id === 'avril' ? 'Space' : 'Enter');
        assert.equal(await page.locator('#lyric-title').innerText(), title);
        assert.equal((await page.locator('.lyric-credit').textContent()).trim(), artist);
        assert.equal(await page.locator('#lyric-copy').getAttribute('lang'), language);
        assert.equal((await page.locator('#lyric-copy').innerText()).split('\n').length, lines);
        assert.equal(await page.locator('#lyric-art svg').getAttribute('viewBox'), await trigger.locator('svg').getAttribute('viewBox'));
        assert.equal(await page.locator('#lyric-art image').getAttribute('href'), await trigger.locator('image').getAttribute('href'));
        assert.equal(await page.locator('#lyric-dialog').evaluate(dialog => dialog.scrollTop), 0);
        await page.locator('#lyric-close').focus();
        await page.keyboard.press('m');
        assert.equal(await page.locator('body').getAttribute('data-motion'), 'off');
        await page.locator('#lyric-copy').click();
        assert.equal(await page.locator('#lyric-dialog').isVisible(), true, 'Clicking the quote keeps the sheet open');
        if (id === 'dragon') await page.locator('#lyric-dialog').evaluate(dialog => { dialog.scrollTop = dialog.scrollHeight; });
        if (id === 'rime') await page.mouse.click(3, 3);
        else if (id === 'avril') await page.locator('#lyric-close').click();
        else await page.keyboard.press('Escape');
        await page.waitForFunction(selector => document.activeElement.matches(selector), `[data-lyric="${id}"]`);
        assert.equal(await page.locator('#lyric-dialog').isVisible(), false);
      }
    });

    await check('monitor stories identify the selected game without rerolling on hover', async page => {
      await page.addInitScript(() => { Math.random = () => Number(new URL(location.href).searchParams.get('draw')); });
      for (const [draw, game, copy] of [
        [0, 'trackmania', 'Trackmania 2020 is on tonight.'],
        [.7, 'hearthstone', 'Hearthstone is on tonight.'],
        [.85, 'chess', 'Chess.com is on tonight.'],
        [.99, 'fez', 'FEZ is on tonight, the one-percent guest.'],
      ]) {
        await page.goto(`${url}?draw=${draw}`);
        await page.locator('[data-object="monitor"]').hover();
        assert.equal(await page.locator('body').getAttribute('data-game'), game);
        assert.equal(await page.locator('#tooltip-copy').innerText(), copy);
        await page.locator('[data-object="bike"]').hover();
        await page.locator('[data-object="monitor"]').hover();
        assert.equal(await page.locator('body').getAttribute('data-game'), game);
      }
    });
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], failures.join('\n'));
})().catch(error => { console.error(error); process.exitCode = 1; });
