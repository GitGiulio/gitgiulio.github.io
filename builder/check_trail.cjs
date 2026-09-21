// Focused Canvas regression check: node check_trail.cjs [path/to/trail.js --baseline]
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(process.argv[2] || 'site/trail.js', 'utf8');
const baseline = process.argv.includes('--baseline');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const dpr of [1, 2]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
      await page.setContent('<body style="margin:0;background:#101114"><canvas id="pearl-trail" style="width:100vw;height:100vh"></canvas><div class="effect-control"><button id="trail-toggle" data-on="On" data-off="Off"><span class="toggle-state"></span></button></div>');
      await page.evaluate(() => {
        let now = 0, id = 0;
        const realNow = performance.now.bind(performance);
        const callbacks = new Map();
        window.clock = {
          gradients: 0,
          timings: [],
          step() {
            now += 1000 / 60;
            const pending = [...callbacks.values()];
            callbacks.clear();
            const start = realNow();
            for (const callback of pending) callback(now);
            this.timings.push(realNow() - start);
          },
          pending: () => callbacks.size,
        };
        performance.now = () => now;
        window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
        window.cancelAnimationFrame = id => callbacks.delete(id);
        const create = CanvasRenderingContext2D.prototype.createRadialGradient;
        CanvasRenderingContext2D.prototype.createRadialGradient = function (...args) {
          clock.gradients++;
          return create.apply(this, args);
        };
      });
      await page.addScriptTag({ content: source });
      for (const buttons of [0, 1, 2]) {
        const result = await page.evaluate(buttons => {
          const toggle = document.querySelector('button');
          toggle.click(); toggle.click();
          const event = (type, x, y) => document.body.dispatchEvent(new PointerEvent(type, {
            bubbles: true, pointerType: 'mouse', clientX: x, clientY: y, buttons,
          }));
          const start = clock.gradients;
          clock.timings = [];
          event('pointermove', 720, 450);
          if (buttons) event('pointerdown', 720, 450);
          for (let frame = 0; frame < 180; frame++) {
            if (!buttons) event('pointermove', 720 + Math.sin(frame * .08) * 150, 450 + Math.cos(frame * .08) * 60);
            clock.step();
          }
          const canvas = document.querySelector('canvas');
          const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let visible = 0, white = 0, brightest = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 64) continue;
            visible++;
            const light = Math.min(data[i], data[i + 1], data[i + 2]);
            brightest = Math.max(brightest, light);
            if (light >= 245) white++;
          }
          const timings = clock.timings.slice(60).sort((a, b) => a - b);
          return { gradients: clock.gradients - start, visible, white, brightest,
            medianDrawMs: timings[Math.floor(timings.length / 2)] };
        }, buttons);
        console.log(JSON.stringify({ dpr, buttons, ...result }));
        if (!baseline) {
          assert.ok(result.visible > 0, 'Trail must remain visible');
          assert.equal(result.white, 0, 'Overlapping pearls must not wash out to white');
          assert.ok(result.gradients < 1000, 'Build gradients once per particle, not every frame');
        }
        if (buttons === 1 && dpr === 1) await page.screenshot({ path: path.join('tmp', baseline ? 'pearl-before.png' : 'pearl-after.png') });
        await page.evaluate(() => {
          document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, buttons: 0 }));
          for (let frame = 0; frame < 90; frame++) clock.step();
        });
        assert.equal(await page.evaluate(() => clock.pending()), 0, 'Animation must stop after fading');
      }
      await page.close();
    }
  } finally { await browser.close(); }
})();
