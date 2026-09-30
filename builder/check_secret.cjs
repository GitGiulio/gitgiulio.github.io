// Run with the same Node/Playwright setup as check.cjs.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const url = pathToFileURL(path.join(__dirname, '../site/secret.html')).href;

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    const draws = [];
    for (const timezoneId of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      const visitor = await browser.newPage({ timezoneId });
      visitor.on('pageerror', error => errors.push(error.message));
      await visitor.clock.setFixedTime(new Date('2026-09-30T22:01:00Z'));
      await visitor.goto(url);
      draws.push(await visitor.locator('.daily-flag').evaluateAll(images => images.map(image => image.getAttribute('href'))));
      assert.match(await visitor.locator('#flag-day').innerText(), /1 October 2026/);
      await visitor.close();
    }
    assert.deepEqual(draws[0], draws[1], 'Visitors in different time zones get the same daily trio');
    assert.deepEqual(draws[0], draws[2], 'The combination uses the Copenhagen date everywhere');
    const midnight = await browser.newPage();
    await midnight.clock.install({ time: new Date('2026-09-30T21:59:30Z') });
    await midnight.goto(url);
    const yesterday = await midnight.locator('.daily-flag').evaluateAll(images => images.map(image => image.getAttribute('href')));
    await midnight.clock.fastForward(30_500);
    assert.deepEqual(await midnight.locator('.daily-flag').evaluateAll(images => images.map(image => image.getAttribute('href'))), draws[0], 'An open room updates after Copenhagen midnight');
    assert.notDeepEqual(yesterday, draws[0], 'The next day gets a new combination');
    await midnight.close();
    // Boundary mistakes here change the visitor's actual game probabilities.
    for (const [draw, game] of [[0, 'trackmania'], [.699999, 'trackmania'], [.7, 'hearthstone'], [.849999, 'hearthstone'], [.85, 'chess'], [.989999, 'chess'], [.99, 'fez'], [.999999, 'fez']]) {
      const page = await browser.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(value => { Math.random = () => value; }, draw);
      await page.goto(url);
      assert.equal(await page.locator('body').getAttribute('data-game'), game, `Wrong game for random draw ${draw}`);
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('.room-art').evaluate(img => img.decode());
    assert.equal(await page.locator('.daily-flag').count(), 3, 'Three daily country flags replace the fixed flags');
    assert.equal(await page.locator('#country-options option').count(), 195, 'All 193 UN members and two observer states are guessable');
    const flags = await page.locator('.daily-flag').evaluateAll(images => images.map(image => image.getAttribute('href')));
    assert.equal(new Set(flags).size, 3, 'Daily flags must be distinct');
    await page.reload();
    assert.deepEqual(await page.locator('.daily-flag').evaluateAll(images => images.map(image => image.getAttribute('href'))), flags, 'Refreshing keeps today’s combination');
    await page.locator('[data-object="flags"]').click();
    assert.equal(await page.locator('#flag-quiz').isVisible(), true, 'Clicking flags opens the guessing game');
    const countries = await page.locator('#country-options option').evaluateAll(options => options.map(option => ({ code: option.dataset.code, name: option.value })));
    const assets = fs.readdirSync(path.join(__dirname, '../site/media/flags')).filter(name => name.endsWith('.svg'));
    assert.deepEqual(assets.sort(), countries.map(country => `${country.code}.svg`).sort(), 'Every eligible country has local flag artwork');
    await page.locator('.quiz-flag').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const answers = flags.map(src => countries.find(country => src.endsWith(`/${country.code}.svg`)).name);
    for (let i = 0; i < 3; i++) await page.locator(`#flag-guess-${i}`).fill(i === 0 ? 'Not a country' : answers[i]);
    await page.locator('#flag-check').click();
    assert.match(await page.locator('#flag-result-0').innerText(), /try again/i);
    assert.match(await page.locator('#flag-result-1').innerText(), /correct/i);
    await page.locator('#flag-guess-0').fill(answers[0].toUpperCase());
    await page.locator('#flag-check').click();
    assert.match(await page.locator('#flag-score').innerText(), /3.*3/);
    await page.screenshot({ path: path.join(__dirname, 'tmp/secret-flags.png'), fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#flag-quiz').isVisible(), false, 'Escape closes the native dialog');
    const game = await page.locator('body').getAttribute('data-game');
    for (const object of ['monitor', 'flags', 'bike', 'xray', 'short-track', 'long-track', 'inline', 'climbing', 'rocket', 'ferrari']) {
      const target = page.locator(`[data-object="${object}"]`);
      await target.hover();
      assert.equal(await page.locator('#room-tooltip').isVisible(), true, `No hover story for ${object}`);
      assert.ok((await page.locator('#tooltip-copy').innerText()).length > 0);
    }
    assert.equal(await page.locator('body').getAttribute('data-game'), game, 'Hovering must not reroll the game');
    await page.locator('[data-object="bike"]').hover();
    const wheelBefore = await page.locator('.wheel-top').evaluate(el => getComputedStyle(el).transform);
    await page.waitForFunction(previous => getComputedStyle(document.querySelector('.wheel-top')).transform !== previous, wheelBefore);
    assert.notEqual(await page.locator('.wheel-top').evaluate(el => getComputedStyle(el).transform), wheelBefore, 'The wheel actually spins');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    const cubeBefore = await page.locator('.cube-model').screenshot();
    await page.locator('[data-object="cube"]').hover();
    assert.match(await page.locator('#tooltip-copy').innerText(), /puzzles/i);
    await page.waitForFunction(() => document.querySelector('.cube-model').dataset.state === 'lifting');
    await page.waitForFunction(() => document.querySelector('.cube-model').getAttribute('transform') !== null);
    await page.waitForFunction(() => document.querySelector('.cube-model').dataset.state === 'turning');
    const cubePaths = await page.locator('.cube-model path').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
    const cubeColors = await page.locator('.cube-model path').evaluateAll(paths => paths.map(path => path.getAttribute('fill')).sort());
    await page.waitForTimeout(250);
    assert.notDeepEqual(await page.locator('.cube-model path').evaluateAll(paths => paths.map(path => path.getAttribute('d'))), cubePaths, 'The cube’s geometry moves during real layer turns');
    assert.deepEqual(await page.locator('.cube-model path').evaluateAll(paths => paths.map(path => path.getAttribute('fill')).sort()), cubeColors, 'Plastic pieces retain their colors while turning');
    await page.screenshot({ path: path.join(__dirname, 'tmp/secret-cube-floating.png'), fullPage: true });
    const clear = await page.evaluate(() => {
      const cube = document.querySelector('.cube-model').getBoundingClientRect();
      const story = document.querySelector('#room-tooltip').getBoundingClientRect();
      return cube.right <= story.left || cube.left >= story.right || cube.bottom <= story.top || cube.top >= story.bottom;
    });
    assert.equal(clear, true, 'The story popup leaves the floating cube visible');
    await page.locator('#motion-toggle').click();
    await page.waitForTimeout(100);
    const frozen = await page.locator('.cube-model').screenshot();
    await page.waitForTimeout(250);
    assert.deepEqual(await page.locator('.cube-model').screenshot(), frozen, 'Pause motion also freezes the cube’s real layer animation');
    await page.locator('#motion-toggle').click();
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('.cube-model').dataset.state === 'solved');
    assert.equal(await page.locator('.cube-model').getAttribute('transform'), null, 'The automatic animation finishes and lands even after the pointer leaves');
    assert.notDeepEqual(await page.locator('.cube-model').screenshot(), cubeBefore, 'The cube visibly solves');
    await page.locator('[data-object="long-track"]').hover();
    await page.waitForFunction(() => !['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(document.querySelector('.clap-blade')).transform));
    assert.notEqual(await page.locator('.clap-blade').evaluate(el => getComputedStyle(el).transform), 'none', 'Clap blades move on hover');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.clap-blade')).transform === 'none');
    assert.equal(await page.locator('.clap-blade').evaluate(el => getComputedStyle(el).transform), 'none', 'The clap finishes once instead of looping');
    await page.mouse.move(0, 0);
    await page.locator('[data-object="bike"]').focus();
    assert.equal(await page.locator('#room-tooltip').isVisible(), true, 'Keyboard focus opens the story');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#room-tooltip').isVisible(), false, 'Escape dismisses the story');
    await page.locator('#motion-toggle').click();
    assert.equal(await page.locator('body').getAttribute('data-motion'), 'off');
    assert.equal(await page.locator('.ambient').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.locator('#motion-toggle').click();
    assert.equal(await page.locator('body').getAttribute('data-motion'), 'on');
    for (const value of ['hearthstone', 'chess', 'fez', 'trackmania']) {
      await page.locator('#game-preview').selectOption(value);
      assert.equal(await page.locator('body').getAttribute('data-game'), value);
      assert.equal(await page.locator(`.game-screen[data-screen="${value}"]`).isVisible(), true);
    }
    await page.locator('[data-object="monitor"]').click();
    await page.locator('#game-preview').selectOption('fez');
    await page.locator('[data-object="monitor"]').hover();
    assert.equal(await page.locator('#tooltip-title').innerText(), 'FEZ', 'Monitor story follows the previewed game');
    await page.keyboard.press('Escape');
    await page.locator('#game-preview').selectOption('trackmania');
    await page.locator('h1').click();
    fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, 'tmp/secret-desktop.png'), fullPage: true });
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflows at ${width}px`);
      await page.locator('#flags-toggle').click();
      assert.ok(await page.locator('#flag-quiz').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), `Flag quiz overflows at ${width}px`);
      await page.keyboard.press('Escape');
    }
    await page.close();
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    touch.on('pageerror', error => errors.push(error.message));
    await touch.goto(url);
    assert.equal(await touch.locator('body').getAttribute('data-motion'), 'off');
    await touch.locator('[data-object="cube"]').tap();
    assert.equal(await touch.locator('.cube-model').getAttribute('data-state'), 'solved', 'Reduced motion skips floating and layer animation');
    assert.equal(await touch.locator('.cube-model').getAttribute('transform'), null);
    assert.equal(await touch.locator('#room-tooltip').isVisible(), true, 'Tap opens the story');
    assert.match(await touch.locator('#tooltip-copy').innerText(), /puzzles/i);
    await touch.screenshot({ path: path.join(__dirname, 'tmp/secret-mobile.png'), fullPage: true });
    await touch.locator('#flags-toggle').tap();
    assert.equal(await touch.locator('#flag-quiz').isVisible(), true, 'The daily quiz opens on touch devices');
    assert.ok(await touch.locator('#flag-quiz').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), 'The mobile quiz fits its dialog');
    await touch.screenshot({ path: path.join(__dirname, 'tmp/secret-flags-mobile.png'), fullPage: true });
    await touch.close();
    const plain = await browser.newPage({ javaScriptEnabled: false });
    await plain.goto(url);
    assert.equal(await plain.locator('.room-art').isVisible(), true, 'The illustration survives without JavaScript');
    assert.deepEqual(errors, []);
    console.log('PASS: 195 local country flags, daily seeded selection shared across time zones, midnight rollover, guessing and feedback, automatic stickerless cube lift/layer turns/landing, unchanged game probabilities, room stories and motion, keyboard/touch, responsive layouts, reduced motion, and no-JS artwork.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
