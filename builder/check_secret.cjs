// Run with the same Node/Playwright setup as check.cjs.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const url = pathToFileURL(path.join(__dirname, '../site/secret.html')).href;

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
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
    const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'no-preference' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('.room-art').evaluate(img => img.decode());
    await page.locator('.scene-layers image').evaluateAll(images => Promise.all(images.map(async image => {
      const asset = new Image();
      asset.src = image.getAttribute('href');
      await asset.decode();
    })));
    assert.equal(await page.locator('button.lyric-note').count(), 4, 'Three sketch papers and the Avril skateboard can be opened');
    assert.deepEqual(await page.locator('button.lyric-note').allTextContents(), ['', '', '', ''], 'No lyric text is printed across the room');
    for (const [source, copy] of [['ankle_xRay.jpg', 'ankle'], ['kitesurf.jpg', 'kitesurf'], ['uluru.jpg', 'uluru']]) {
      const original = path.join(__dirname, '../private', source);
      if (fs.existsSync(original)) assert.deepEqual(fs.readFileSync(path.join(__dirname, `../site/media/memory-${copy}.jpg`)), fs.readFileSync(original), 'Supplied photographs remain byte-for-byte unchanged');
    }
    assert.equal(await page.locator('.memory-original').count(), 3);
    assert.equal(await page.locator('.steam').count(), 0, 'The cleared desk has no steam');
    for (const [note, heading, lines, lastLine] of [
      ['sunshine', 's.u.n.s.h.i.n.e.', 16, 'È lenta la luce ha fretta ed è più veloce'],
      ['dragon', 'Sangue di drago', 8, 'Perché pochi sanno che alla fine della favola sarà un tiranno a portarla via'],
      ['rime', 'Le Rime (Gara tra 507 parole)', 5, 'Trenta che diventa trentatré'],
      ['avril', 'Sk8er Boi', 12, 'They had a problem with his baggy clothes'],
    ]) {
      const trigger = page.locator(`[data-lyric="${note}"]`);
      await trigger.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#lyric-dialog').isVisible(), true);
      assert.equal(await page.locator('#lyric-title').innerText(), heading);
      const quote = await page.locator('#lyric-copy').innerText();
      assert.equal(quote.split('\n').length, lines, 'The selected paper reveals its complete quote');
      assert.ok(quote.endsWith(lastLine));
      const box = await page.locator('#lyric-dialog').boundingBox();
      assert.ok(Math.abs(box.x + box.width / 2 - 836) < 2 && Math.abs(box.y + box.height / 2 - 470.5) < 2, 'The expanded paper is centered');
      await page.locator('#lyric-copy').click();
      assert.equal(await page.locator('#lyric-dialog').isVisible(), true, 'Selecting quote text does not dismiss the sheet');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#lyric-dialog').isVisible(), false);
      assert.equal(await trigger.evaluate(button => button === document.activeElement), true, 'Closing restores focus to the paper');
    }
    await page.locator('.lyric-note').last().evaluate(button => button.blur());
    fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, 'tmp/secret-room-clean.png'), fullPage: true });
    assert.equal(await page.locator('.daily-flag').count(), 3, 'Three daily country flags replace the fixed flags');
    const exposedCloth = await page.evaluate(() => {
      const gaps = [];
      for (const phase of [0, .4, .7, 1]) for (const group of document.querySelectorAll('.flag-cloth')) {
        const animation = group.querySelector('.flag-print').getAnimations()[0];
        animation.pause();
        animation.currentTime = phase * 6500 - animation.effect.getTiming().delay;
        const image = group.querySelector('.daily-flag');
        const outline = document.querySelector(`${group.getAttribute('clip-path').slice(4, -1)} path`);
        const bounds = outline.getBBox(), inverse = image.getCTM().inverse();
        for (let y = bounds.y; y < bounds.y + bounds.height; y++) for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
          const point = new DOMPoint(x, y);
          if (!outline.isPointInFill(point)) continue;
          const local = point.matrixTransform(outline.getCTM()).matrixTransform(inverse);
          if (local.x < image.x.baseVal.value || local.y < image.y.baseVal.value || local.x > image.x.baseVal.value + image.width.baseVal.value || local.y > image.y.baseVal.value + image.height.baseVal.value) gaps.push({ phase, x, y });
        }
      }
      return gaps;
    });
    assert.deepEqual(exposedCloth, [], 'Flag prints cover the whole cloth at every breeze extreme');
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
    assert.equal(await page.locator('#flag-result-0').innerText(), `Not quite. This is ${answers[0]}.`);
    assert.match(await page.locator('#flag-result-1').innerText(), /correct/i);
    await page.locator('#flag-guess-0').fill(answers[0].toUpperCase());
    await page.locator('#flag-check').click();
    assert.match(await page.locator('#flag-score').innerText(), /3.*3/);
    await page.screenshot({ path: path.join(__dirname, 'tmp/secret-flags.png'), fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#flag-quiz').isVisible(), false, 'Escape closes the native dialog');
    const game = await page.locator('body').getAttribute('data-game');
    assert.equal(await page.locator('.game-screen video').count(), 4);
    assert.ok(await page.locator('.game-screen video').evaluateAll(videos => videos.every(video => video.loop && video.muted && video.playsInline && !video.getAttribute('src'))), 'Four muted looping video slots retain placeholders until recordings arrive');
    assert.equal(await page.locator('.rain-streak').count(), 28);
    assert.equal(await page.locator('.glass-drop').count(), 7);
    assert.ok(await page.locator('.rain-streak').evaluateAll(drops => new Set(drops.map(drop => getComputedStyle(drop).animationDelay)).size > 20), 'Rain falls in independently phased streaks');
    for (const object of ['monitor', 'flags', 'bike', 'xray', 'short-track', 'long-track', 'inline', 'climbing', 'rocket', 'ferrari', 'turbines']) {
      const target = page.locator(`[data-object="${object}"]`);
      await target.hover();
      assert.equal(await page.locator('#room-tooltip').isVisible(), true, `No hover story for ${object}`);
      assert.ok((await page.locator('#tooltip-copy').innerText()).length > 0);
      assert.equal(await page.locator('.room-scene').getAttribute('data-active'), object, `The ${object} hotspot is reachable without another object intercepting it`);
    }
    // These souvenirs are decorative. Dismiss the overlaid story before testing the artwork beneath it.
    for (const [x, y] of [[695, 225], [624, 40], [780, 162], ...Array.from({ length: 9 }, (_, i) => [1050 + i * 62, 375])]) {
      await page.keyboard.press('Escape');
      await page.mouse.move(x, y);
      await page.waitForTimeout(220);
      assert.equal(await page.locator('#room-tooltip').isVisible(), false, `Decorative object at ${x}, ${y} must not open a story`);
    }
    assert.equal(await page.locator('body').getAttribute('data-game'), game, 'Hovering must not reroll the game');
    await page.locator('[data-object="bike"]').hover();
    const wheelBefore = await page.locator('.spokes-top').evaluate(el => getComputedStyle(el).transform);
    const crankBefore = await page.locator('.crank').evaluate(el => getComputedStyle(el).transform);
    assert.equal(await page.locator('.crank').evaluate(el => getComputedStyle(el).animationDuration), '3.15s');
    assert.equal(await page.locator('.pedal').first().evaluate(el => getComputedStyle(el).animationDuration), '3.15s', 'Pedal platforms counter-rotate at the crank speed');
    const chainBefore = await page.locator('.chain-links').evaluate(el => getComputedStyle(el).strokeDashoffset);
    await page.waitForFunction(previous => getComputedStyle(document.querySelector('.spokes-top')).transform !== previous, wheelBefore);
    assert.notEqual(await page.locator('.spokes-top').evaluate(el => getComputedStyle(el).transform), wheelBefore, 'Real spokes spin inside a stationary painted frame and rim');
    assert.notEqual(await page.locator('.crank').evaluate(el => getComputedStyle(el).transform), crankBefore, 'Crank arms turn with the wheels');
    for (const [selector, x, y] of [['.spokes-top', 652, 287], ['.spokes-bottom', 596, 1064], ['.crank', 677, 773]]) {
      assert.ok(await page.locator(selector).evaluate((el, [x, y]) => {
        const moving = new DOMPoint(x, y).matrixTransform(el.getCTM());
        const stationary = new DOMPoint(x, y).matrixTransform(el.parentElement.getCTM());
        return Math.hypot(moving.x - stationary.x, moving.y - stationary.y) < .1;
      }, [x, y]), 'Rotating bicycle parts retain their physical axle centers');
    }
    assert.notEqual(await page.locator('.chain-links').evaluate(el => getComputedStyle(el).strokeDashoffset), chainBefore, 'Chain links circulate between chainring and cassette');
    assert.equal(await page.locator('#front-spokes image, #rear-spokes image').count(), 0, 'No rotating rectangular or circular artwork patches');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    const cubeBefore = await page.locator('.cube-model').screenshot();
    assert.ok(await page.locator('.cube-model').evaluate(cube => { const box = cube.getBBox(); return 522 - box.y - box.height >= 0 && 522 - box.y - box.height < 2; }), 'The resting cube meets its contact shadow on the desk');
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
    await page.keyboard.press('m');
    await page.waitForTimeout(100);
    const frozen = await page.locator('.cube-model').screenshot();
    await page.waitForTimeout(250);
    assert.deepEqual(await page.locator('.cube-model').screenshot(), frozen, 'Pause motion also freezes the cube’s real layer animation');
    await page.keyboard.press('m');
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('.cube-model').dataset.state === 'solved');
    assert.equal(await page.locator('.cube-model').getAttribute('transform'), null, 'The automatic animation finishes and lands even after the pointer leaves');
    assert.notDeepEqual(await page.locator('.cube-model').screenshot(), cubeBefore, 'The cube visibly solves');
    await page.locator('[data-object="long-track"]').hover();
    await page.waitForFunction(() => !['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(document.querySelector('.clap-boot')).transform));
    assert.notEqual(await page.locator('.clap-boot').evaluate(el => getComputedStyle(el).transform), 'none', 'The boot lifts at the heel, pivoting around its toe hinge');
    assert.ok(await page.locator('.clap-boot').evaluate(el => {
      const hinge = new DOMPoint(1098, 574);
      const moving = hinge.matrixTransform(el.getCTM());
      const fixed = hinge.matrixTransform(el.parentElement.getCTM());
      return Math.hypot(moving.x - fixed.x, moving.y - fixed.y) < .1;
    }), 'The toe hinge stays attached to its fixed blade during the clap');
    assert.equal(await page.locator('#clap-skate > image').evaluate(el => getComputedStyle(el).transform), 'none', 'The blade and shelf stay stationary');
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.clap-boot')).transform === 'none');
    assert.equal(await page.locator('.clap-boot').evaluate(el => getComputedStyle(el).transform), 'none', 'The single clap completes even when the pointer leaves');
    await page.mouse.move(0, 0);
    await page.locator('[data-object="bike"]').focus();
    assert.equal(await page.locator('#room-tooltip').isVisible(), true, 'Keyboard focus opens the story');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#room-tooltip').isVisible(), false, 'Escape dismisses the story');
    await page.keyboard.press('m');
    assert.equal(await page.locator('body').getAttribute('data-motion'), 'off');
    assert.equal(await page.locator('.ambient').first().evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
    await page.keyboard.press('m');
    assert.equal(await page.locator('body').getAttribute('data-motion'), 'on');
    await page.keyboard.press('o');
    assert.match(await page.locator('.room-scene').getAttribute('class'), /show-objects/);
    await page.keyboard.press('o');
    await page.locator('[data-object="monitor"]').hover();
    assert.equal(await page.locator(`.game-screen[data-screen="${game}"]`).isVisible(), true);
    assert.match(await page.locator('#tooltip-copy').innerText(), /is on tonight/, 'Monitor copy is complete and neutral');
    assert.doesNotMatch(await page.locator('#tooltip-copy').innerText(), /placeholder|will go here|TODO/);
    await page.keyboard.press('Escape');
    await page.mouse.click(12, 12);
    fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, 'tmp/secret-desktop.png'), fullPage: true });
    for (const width of [360, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflows at ${width}px`);
      assert.ok(await page.locator('.room-viewport').evaluate(viewport => { const box = viewport.getBoundingClientRect(); return box.x === 0 && box.y === 0 && box.width === innerWidth && Math.abs(box.height - innerHeight) < 1; }), `The scene covers the entire ${width}px viewport`);
      assert.equal(await page.locator('.room-frame').evaluate(frame => getComputedStyle(frame).borderTopWidth), '0px', 'No border around the room');
      assert.equal(await page.locator('header, footer, h1, .room-controls, #game-preview').count(), 0, 'No surrounding UI');
      if (width === 360) {
        const scrollBefore = await page.locator('.room-viewport').evaluate(viewport => viewport.scrollLeft);
        await page.mouse.move(180, 450);
        await page.mouse.wheel(0, 200);
        await page.waitForFunction(previous => document.querySelector('.room-viewport').scrollLeft > previous, scrollBefore);
      }
      await page.locator('[data-object="flags"]').click();
      assert.ok(await page.locator('#flag-quiz').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), `Flag quiz overflows at ${width}px`);
      await page.keyboard.press('Escape');
    }
    await page.close();
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    touch.on('pageerror', error => errors.push(error.message));
    await touch.goto(url);
    assert.equal(await touch.locator('body').getAttribute('data-motion'), 'off');
    await touch.locator('[data-lyric="dragon"]').tap();
    assert.ok(await touch.locator('#lyric-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth && dialog.getBoundingClientRect().height <= innerHeight - 24), 'The long quote fits the mobile viewport with internal scrolling');
    await touch.screenshot({ path: path.join(__dirname, 'tmp/secret-lyric-mobile.png'), fullPage: true });
    await touch.setViewportSize({ width: 320, height: 568 });
    await touch.locator('#lyric-dialog').evaluate(dialog => { dialog.scrollTop = dialog.scrollHeight; });
    assert.ok((await touch.locator('#lyric-copy').innerText()).endsWith('Perché pochi sanno che alla fine della favola sarà un tiranno a portarla via'));
    assert.ok(await touch.locator('#lyric-dialog').evaluate(dialog => {
      const bounds = dialog.getBoundingClientRect();
      const quote = document.querySelector('#lyric-copy').getBoundingClientRect();
      const close = document.querySelector('#lyric-close').getBoundingClientRect();
      return dialog.scrollTop > 0 && quote.bottom <= bounds.bottom && close.top >= bounds.top && close.bottom <= bounds.bottom;
    }), 'Even on a short phone screen, the final line and close button remain reachable');
    await touch.setViewportSize({ width: 390, height: 844 });
    await touch.locator('#lyric-close').tap();
    assert.equal(await touch.locator('#lyric-dialog').isVisible(), false);
    await touch.locator('[data-lyric="sunshine"]').tap();
    await touch.touchscreen.tap(5, 5);
    assert.equal(await touch.locator('#lyric-dialog').isVisible(), false, 'Tapping the backdrop closes the quote');
    await touch.locator('[data-object="cube"]').tap();
    assert.equal(await touch.locator('.cube-model').getAttribute('data-state'), 'solved', 'Reduced motion skips floating and layer animation');
    assert.equal(await touch.locator('.cube-model').getAttribute('transform'), null);
    assert.equal(await touch.locator('#room-tooltip').isVisible(), true, 'Tap opens the story');
    assert.match(await touch.locator('#tooltip-copy').innerText(), /puzzles/i);
    await touch.screenshot({ path: path.join(__dirname, 'tmp/secret-mobile.png'), fullPage: true });
    await touch.locator('[data-object="flags"]').tap();
    assert.equal(await touch.locator('#flag-quiz').isVisible(), true, 'The daily quiz opens on touch devices');
    assert.ok(await touch.locator('#flag-quiz').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), 'The mobile quiz fits its dialog');
    await touch.screenshot({ path: path.join(__dirname, 'tmp/secret-flags-mobile.png'), fullPage: true });
    await touch.keyboard.press('Escape');
    for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
      await touch.setViewportSize(viewport);
      for (const object of ['cube', 'ferrari']) {
        await touch.keyboard.press('Escape');
        await touch.locator(`[data-object="${object}"]`).tap();
        assert.equal(await touch.locator('.room-scene').getAttribute('data-active'), object, `${object} stays independently reachable in landscape`);
      }
    }
    await touch.close();
    const plain = await browser.newPage({ javaScriptEnabled: false });
    await plain.goto(url);
    assert.equal(await plain.locator('.room-art').isVisible(), true, 'The illustration survives without JavaScript');
    assert.equal(await plain.locator('.lyric-note:disabled').count(), 4);
    assert.ok(await plain.locator('#cube-model path').count() > 0, 'The static cube remains on the desk without JavaScript');
    assert.deepEqual(errors, []);
    console.log('PASS: rebuilt room, protected original photos, four lyric views and exact revised quotes, touch/keyboard dismissal and short-phone scrolling; daily 195-country flag game, cube, bike and clap animations, object stories, full-screen layouts, reduced motion, and no-JS artwork.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
