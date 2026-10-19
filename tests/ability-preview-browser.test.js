// Full-page Chromium smoke checks, including actual module loading and phone geometry.
// NODE_PATH=<playwright node_modules> node tests/ability-preview-browser.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.ABILITY_PREVIEW_OUTPUT || '/tmp/guild-ability-preview';
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  const results = [];
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [], missing = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://ability-preview.test/**', route => {
        const name = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '') || 'index.html';
        const file = path.resolve(root, name);
        if (!file.startsWith(root + path.sep)) return route.abort();
        if (!fs.existsSync(file)) { missing.push(name); return route.fulfill({ status: 404, body: 'Missing asset' }); }
        return route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream' });
      });
      await page.goto('https://ability-preview.test/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.G9 && document.querySelector('.tabs'));
      await page.evaluate(() => { G9.tab('simulator'); G9.simulatorSection('animations'); });
      await page.waitForSelector('#animation-viewport');
      assert.equal(await page.locator('#animation-sequence').inputValue(), '8');
      assert.equal(await page.locator('#animation-sequence option[value="9"]').count(), 0);

      // Sample real, unscripted playback at both readable speeds before using
      // controlled scheduler callbacks for the exhaustive catalog sweep.
      for (const speed of [1, 2]) {
        await page.evaluate(speed => { G9.animationPath('tyrant'); G9.animationSequence(8); G9.setTickerSpeed(speed); }, speed);
        const effect = page.locator('.gm-combat-sequence8[data-stage="cast"]');
        await effect.waitFor({ state: 'attached', timeout: 5000 }).catch(async error => {
          await page.screenshot({ path: path.join(output, 'failed-preview.png'), fullPage: true });
          console.error({ width, speed, errors, missing, ui: await page.locator('.animation-tester').innerText() });
          throw error;
        });
        const timing = await effect.evaluate(node => {
          const animation = node.getAnimations()[0];
          return { duration: animation.effect.getTiming().duration, rate: animation.playbackRate, width: node.getBoundingClientRect().width };
        });
        assert.equal(timing.duration, 800); assert.equal(timing.rate, speed === 2 ? 1.6 : 1);
        assert(timing.width > 30, 'custom art is visible at phone scale');
        await page.evaluate(() => G9.toggleTickerPause());
        const visibility = await effect.evaluate(node => {
          for (const animation of node.getAnimations({ subtree: true })) animation.currentTime = Number(animation.effect.getTiming().duration) / 2;
          const box = node.getBoundingClientRect();
          return { opacity: Number(getComputedStyle(node).opacity), visible: box.top < innerHeight && box.bottom > 0 };
        });
        assert(visibility.opacity > .5 && visibility.visible, 'selection brings a legible cast into the viewport');
        await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `cast-${width}-${speed}x.png`), animations: 'allow' });
        await page.locator('.animation-tester').screenshot({ path: path.join(output, `tester-${width}-${speed}x.png`), animations: 'allow' });
        results.push({ width, speed, ...timing });
      }
      const bounds = await page.evaluate(() => {
        const box = document.querySelector('.animation-tester').getBoundingClientRect();
        const controls = [...document.querySelectorAll('.animation-tester-controls select')].map(node => node.getBoundingClientRect().toJSON());
        return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, box: box.toJSON(), controls };
      });
      assert(bounds.scroll <= width + 1, `page overflows at ${width}px`);
      for (const control of bounds.controls) assert(control.x >= 0 && control.right <= width + 1);

      if (width === 390) {
        // Keep native effects and real layout; control only the UI scheduler so
        // all 188 recorded demonstrations can run without a long wall-clock wait.
        const sweep = await page.evaluate(() => {
          G9.clearAnimationPreview();
          const save = localStorage.getItem('guild-rpg-browser-v9');
          const originalSet = window.setTimeout, originalClear = window.clearTimeout;
          const timers = new Map(); let serial = 0, count = 0;
          window.setTimeout = (fn, delay = 0) => { timers.set(++serial, { fn, delay }); return serial; };
          window.clearTimeout = id => { timers.delete(id); originalClear(id); };
          try {
            for (const entry of abilityPreviewCatalog()) {
              G9.animationPath(entry.path); G9.animationSequence(entry.sequence);
              let steps = 0;
              while (document.querySelector('[data-animation-status]').textContent !== 'Preview complete' && steps++ < 100) {
                if (timers.size !== 1) throw new Error(`${entry.path}:${entry.sequence}: ${timers.size} schedulers`);
                const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn();
              }
              if (steps >= 100) throw new Error(`${entry.path}:${entry.sequence} did not complete`);
              if (!document.querySelector('#animation-viewport .b-row')) throw new Error('empty preview log');
              count++;
            }
            if (localStorage.getItem('guild-rpg-browser-v9') !== save) throw new Error('preview modified saved guild');
            G9.animationPath('moon'); G9.animationSequence(9); G9.setTickerSpeed(4);
            G9.animationLoop(true); G9.animationLoop(false); G9.skipTicker(true);
          } finally { window.setTimeout = originalSet; window.clearTimeout = originalClear; }
          return count;
        });
        assert.equal(sweep, 188);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => { G9.animationReplay(); G9.setTickerSpeed(2); });
        await page.waitForFunction(() => document.querySelector('[data-animation-status]').textContent === 'Preview complete');
        assert.equal(await page.locator('.gm-combat-projectile').count(), 0, 'reduced motion leaves no traveling effect behind');
        await page.evaluate(() => { G9.simulatorSection('battle'); G9.runSimulation(); G9.skipTicker(true); });
        assert(await page.locator('#sim-viewport .b-row').count() > 0);
      }
      assert.deepEqual(errors, [], 'no runtime errors');
      assert.deepEqual(missing, [], 'no missing runtime or artwork assets');
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ catalog: 188, results }, null, 2) + '\n');
    console.log('PASS full-page animation tester: 188 active previews; 320/390/1280px; 1x/2x clocks; compact/reduced playback; original simulator.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
