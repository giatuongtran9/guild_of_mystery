// Full-page Chromium checks for the Sequence gallery and native on-demand casts.
// NODE_PATH=<playwright node_modules> node tests/ability-preview-browser.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.ABILITY_PREVIEW_OUTPUT || '/tmp/guild-ability-preview';
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const cardSelector = id => `[data-gallery-ability="${id}"]`;
const closeAngle = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < .05;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  const results = [];
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [], missing = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.route('https://ability-preview.test/**', route => {
          const name = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '') || 'index.html';
          const file = name === 'js/ui.js' && process.env.ABILITY_PREVIEW_UI_SOURCE
            ? path.resolve(process.env.ABILITY_PREVIEW_UI_SOURCE) : path.resolve(root, name);
          if (!file.startsWith(root + path.sep) && file !== path.resolve(process.env.ABILITY_PREVIEW_UI_SOURCE || root)) return route.abort();
          if (!fs.existsSync(file)) { missing.push(name); return route.fulfill({ status: 404, body: 'Missing asset' }); }
          return route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream' });
        });
        await page.goto('https://ability-preview.test/', { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.G9 && document.querySelector('.tabs'));
        await page.evaluate(() => {
          window.__galleryBuilds = [];
          window.__gallerySave = localStorage.getItem('guild-rpg-browser-v9');
          window.__galleryDefinitions = JSON.stringify({ paths: PATHS, balance: GLOBAL_COMBAT });
          const original = buildAbilityPreview;
          buildAbilityPreview = function (...args) {
            const demo = original(...args);
            window.__galleryBuilds.push({ args, demo, eventsBefore: JSON.stringify(demo.events) }); return demo;
          };
          G9.tab('simulator'); G9.simulatorSection('animations');
        });
        await page.waitForSelector('#gallery-sequence');
        assert.equal(await page.locator('#gallery-sequence').inputValue(), '5');
        assert.equal(await page.locator('#gallery-sequence option').count(), 10);
        assert.equal(await page.locator('[data-gallery-ability]').count(), 20);
        assert.equal(await page.locator('#animation-viewport').count(), 0, 'the single-ability tester is replaced');
        assert.equal(await page.evaluate(() => __galleryBuilds.length), 0, 'opening the gallery does not resolve any native cast');
        assert.equal(await page.locator('.gm-combat-fx-layer').count(), 0, 'there is no autoplay');
        assert.equal(await page.locator('[data-gallery-ability="iron_blood_vigor"], [data-gallery-ability="reset_fate"]').count(), 0);
        const catalog = await page.evaluate(() => abilityPreviewCatalog().map(entry => ({ path: entry.path, sequence: entry.sequence,
          id: entry.ability.effectId || entry.ability.id })));
        assert.equal(catalog.length, 188);
        const geometry = await page.evaluate(() => {
          const gallery = document.querySelector('.ability-gallery'), controls = [...gallery.querySelectorAll('input,select')];
          const cards = [...gallery.querySelectorAll('[data-gallery-ability]')];
          return { scroll: document.documentElement.scrollWidth, controls: controls.map(node => node.getBoundingClientRect().toJSON()),
            cards: cards.map(card => ({ box: card.getBoundingClientRect().toJSON(),
              sprites: [...card.querySelectorAll('.gm-unit-sprite-anchor')].map(node => node.getBoundingClientRect().toJSON()),
              lazy: [...card.querySelectorAll('img')].every(image => image.loading === 'lazy') })) };
        });
        assert(geometry.scroll <= width + 1, `${width}px page has no horizontal overflow`);
        for (const control of geometry.controls) assert(control.x >= 0 && control.right <= width + 1);
        for (const card of geometry.cards) {
          assert(card.box.x >= 0 && card.box.right <= width + 1); assert(card.lazy, 'card portraits and idle art load lazily');
          for (const sprite of card.sprites) { assert.equal(sprite.width, 64); assert.equal(sprite.height, 64); }
        }
        if (width === 1280) assert(geometry.cards[1].box.x > geometry.cards[0].box.x, 'desktop uses a card grid');
        // Exercise lazy loading before taking a whole-gallery image; otherwise
        // cards below the viewport legitimately contain undecoded portraits.
        for (const card of await page.locator('[data-gallery-ability]').all()) {
          await card.locator('.gallery-stage').scrollIntoViewIfNeeded();
          await card.locator('img').evaluateAll(images => Promise.all(images.map(async image => {
            await image.decode();
            if (!image.naturalWidth) throw new Error('Undecoded gallery artwork: ' + image.src);
            const fallback = image.parentElement.querySelector('.combat-sprite-fallback');
            if (fallback && getComputedStyle(fallback).display !== 'none') throw new Error('Gallery portrait fell back: ' + image.src);
          })));
        }
        await page.locator('.ability-gallery').evaluate(node => node.scrollIntoView({ block: 'start' }));
        await page.locator('.ability-gallery').screenshot({ path: path.join(output, `gallery-${width}px.png`), animations: 'disabled' });
        if (width === 390) {
          await page.locator('.ability-gallery').evaluate(node => node.scrollIntoView({ block: 'start' }));
          await page.screenshot({ path: path.join(output, 'gallery-390px-viewport.png'), animations: 'disabled' });
        }

        if (width === 390) {
          // Counts come from the authored catalog; changing Sequence only renders
          // the relevant cards, without eagerly constructing 188 battles.
          for (let sequence = 9; sequence >= 0; sequence--) {
            await page.selectOption('#gallery-sequence', String(sequence));
            const ids = await page.locator('[data-gallery-ability]').evaluateAll(cards => cards.map(card => card.dataset.galleryAbility));
            assert.deepEqual(ids.sort(), catalog.filter(entry => entry.sequence === sequence).map(entry => entry.id).sort());
          }
          assert.equal(await page.evaluate(() => __galleryBuilds.length), 0);
          await page.selectOption('#gallery-sequence', '5');
          await page.evaluate(() => { window.__filterInput = document.querySelector('#gallery-search'); window.__filterCard = document.querySelector('[data-gallery-ability="thread_binding"]'); });
          await page.locator('#gallery-search').fill('Thread Binding');
          assert.deepEqual(await page.locator('[data-gallery-ability]:visible').evaluateAll(cards => cards.map(card => card.dataset.galleryAbility)), ['thread_binding']);
          assert(await page.evaluate(() => document.querySelector('#gallery-search') === __filterInput && document.activeElement === __filterInput
            && document.querySelector('[data-gallery-ability="thread_binding"]') === __filterCard), 'filtering preserves input focus and existing card nodes');
          await page.locator('#gallery-search').fill(''); await page.selectOption('#gallery-path', 'mother');
          assert.deepEqual(await page.locator('[data-gallery-ability]:visible').evaluateAll(cards => cards.map(card => card.dataset.galleryAbility)), ['life_bloom']);
          await page.selectOption('#gallery-path', ''); await page.selectOption('#gallery-placement', 'thread');
          assert.equal(await page.locator('[data-gallery-ability]:visible').count(), 2);
          await page.selectOption('#gallery-placement', ''); await page.locator('#gallery-search').fill('<img onerror="alert(1)">');
          assert.equal(await page.locator('[data-gallery-ability]:visible').count(), 0); assert(await page.locator('[data-gallery-empty]').isVisible());
          assert.equal(await page.locator('.ability-gallery img[onerror="alert(1)"]').count(), 0, 'search text cannot inject an image handler');
          await page.locator('#gallery-search').fill('');
        }

        const inspectReplay = async id => {
          const card = page.locator(cardSelector(id)); await card.scrollIntoViewIfNeeded();
          return card.evaluate(card => {
            // Sample this 800ms one-shot in its click task, before browser/driver
            // scheduling can consume the entire cast. Natural expiry is checked below.
            card.querySelector('[data-gallery-replay]').click();
            const node = card.querySelector('.gm-combat-sequence4[data-stage="cast"], .gm-combat-sequence5[data-stage="cast"], .gm-combat-sequence7[data-stage="cast"]') || card.querySelector('.gm-combat-fx-layer > g');
            if (!node) throw new Error('Missing native cast art: ' + card.dataset.galleryAbility + ' ' + JSON.stringify({
              playing: card.dataset.playing, status: card.querySelector('[data-gallery-status]').textContent,
              hidden: document.hidden, stage: card.querySelector('.gallery-stage').getBoundingClientRect().toJSON(),
              viewport: innerHeight, builds: __galleryBuilds.length }));
            for (const animation of card.querySelector('.gallery-stage').getAnimations({ subtree: true })) {
              animation.pause(); animation.currentTime = 400;
            }
            const actor = card.querySelector('[data-role="caster"] .gm-unit-sprite-anchor').getBoundingClientRect();
            const target = card.querySelector('[data-role="target"] .gm-unit-sprite-anchor').getBoundingClientRect();
            const matrix = new DOMMatrix(getComputedStyle(node).transform), tracks = node.getAnimations({ subtree: true });
            const demo = __galleryBuilds.at(-1), row = flattenTurnRows(demo.demo.groupedRounds).find(value => value.type === 'turn' && value.actorId === 'preview_caster');
            return { id: card.dataset.galleryAbility, playing: card.dataset.playing, status: card.querySelector('[data-gallery-status]').textContent,
              activeCards: document.querySelectorAll('[data-gallery-ability][data-playing="true"]').length,
              sourceId: row.sourceAbilityId || row.abilityId, targetId: node.dataset.targetId, actorId: row.actorId,
              targetUnit: card.querySelector('[data-role="target"]').dataset.unitId,
              angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
              nativeAngle: Number(node.dataset.angleDeg),
              expected: Math.atan2(target.y - actor.y, target.x - actor.x) * 180 / Math.PI,
              actorX: actor.x + actor.width / 2, targetX: target.x + target.width / 2,
              flow: node.dataset.flowDirection, flightPath: node.dataset.flightPath,
              opacity: Number(getComputedStyle(node).opacity), rate: tracks[0]?.playbackRate,
              frames: tracks[0]?.effect.getKeyframes().map(frame => frame.transform),
              outcomes: card.querySelectorAll('.gm-battle-fx-number, .gm-combat-heal, .gm-combat-status, [data-stage="impact"], [data-stage="outcome"]').length,
              idleHidden: getComputedStyle(card.querySelector('.gallery-idle')).visibility === 'hidden',
              unchanged: JSON.stringify(demo.demo.events) === demo.eventsBefore };
          });
        };
        const ids = width === 390 ? catalog.filter(entry => entry.sequence === 5).map(entry => entry.id) : ['thread_binding', 'holy_sun_bolt'];
        for (const id of ids) {
          const cast = await inspectReplay(id);
          assert.equal(cast.playing, 'true'); assert.equal(cast.activeCards, 1); assert.equal(cast.status, 'Playing cast'); assert(cast.opacity > .5 && cast.idleHidden);
          assert.equal(cast.outcomes, 0, 'this gallery plays only the attempted cast, never damage, healing or status outcomes');
          assert(cast.unchanged, 'the actual event tape remains immutable'); assert.equal(cast.sourceId, id);
          if (['holy_sun_bolt', 'ocean_calling', 'law_enforcement', 'thread_binding'].includes(id)) assert(closeAngle(cast.angle, cast.expected));
          if (id === 'thread_binding') {
            assert.equal(cast.flightPath, 'stationary-attacker-to-target-span');
            assert.equal(cast.targetId, cast.targetUnit);
            const positions = cast.frames.map(frame => frame.match(/translate\([^)]*\)/)[0]); assert(positions.every(value => value === positions[0]));
          }
          if (id === 'soul_drain') { assert.equal(cast.flow, 'target-to-caster'); assert(closeAngle(cast.angle, cast.expected + 180)); }
          if (['thread_binding', 'life_bloom'].includes(id)) await page.locator(cardSelector(id)).screenshot({ path: path.join(output, `${id}-${width}px.png`), animations: 'allow' });
          results.push({ width, ...cast });
        }
        if (width === 390) {
          for (const speed of [.5, 1, 1.5]) {
            await page.selectOption('#gallery-speed', String(speed)); const cast = await inspectReplay('holy_sun_bolt'); assert.equal(cast.rate, speed);
          }
          await page.locator('#gallery-swap').check(); await page.locator('#gallery-guides').check();
          for (const id of ['holy_sun_bolt', 'thread_binding', 'soul_drain']) {
            const cast = await inspectReplay(id); assert(cast.actorX > cast.targetX, 'swapping changes genuine sprite geometry');
            assert(closeAngle(cast.angle, cast.expected + (id === 'soul_drain' ? 180 : 0))); results.push({ width, swapped: true, ...cast });
          }
          assert(await page.locator('.ability-gallery').evaluate(node => node.classList.contains('gallery-guides-active')));
          await page.locator('#gallery-swap').uncheck(); await page.selectOption('#gallery-speed', '1.5');
          const selected = page.locator(cardSelector('holy_sun_bolt')); await selected.scrollIntoViewIfNeeded(); await selected.locator('[data-gallery-replay]').click();
          await page.waitForFunction(() => document.querySelector('[data-gallery-ability="holy_sun_bolt"]').dataset.playing === 'false');
          assert.equal(await selected.locator('.gm-combat-fx-layer').count(), 0); assert.equal(await selected.locator('[data-gallery-status]').innerText(), 'Ready');
          for (const sequence of [9, 8, 7, 6, 4, 3, 2, 1, 0]) {
            await page.selectOption('#gallery-sequence', String(sequence));
            const requested = { 7: 'flesh_healing', 4: 'bizarro_transformation', 0: 'fooling_reality' }[sequence];
            const id = catalog.find(entry => entry.sequence === sequence && (!requested || entry.id === requested)).id;
            const cast = await inspectReplay(id);
            assert.equal(cast.outcomes, 0); assert(cast.opacity > .5); results.push({ width, sequence, ...cast });
            if (sequence === 4) assert(await page.locator(cardSelector(id) + ' .gm-combat-sequence4[data-stage="cast"]').count() > 0,
              id + ' renders its integrated Sequence 4 PNG');
            if (sequence === 0) assert(await page.locator(cardSelector(id) + ' .gm-combat-projectile').count() > 0,
              id + ' renders its generic ability projectile, beyond the ability chip');
            if (sequence === 7) {
              assert.equal(await page.locator(cardSelector(id)).getAttribute('data-placement'), 'self');
              assert.equal(await page.locator(cardSelector(id) + ' .gallery-idle .gallery-effect').first().getAttribute('data-placement'), 'self');
              assert.equal(cast.targetId, cast.actorId, 'Flesh Healing art remains on its caster');
            }
          }
          await page.selectOption('#gallery-sequence', '7');
          const shield = await inspectReplay('dawn_shield');
          assert.equal(await page.locator(cardSelector('dawn_shield')).getAttribute('data-placement'), 'self');
          assert.equal(await page.locator(cardSelector('dawn_shield') + ' .gallery-idle .gallery-effect').first().getAttribute('data-placement'), 'self');
          assert.equal(shield.targetId, shield.actorId, 'Dawn Shield art remains on its caster');
          for (const [id, nativeAngle] of [['witch_s_curse', -30], ['bribe_weakening', 35], ['blood_siphon', 0]]) {
            for (const swapped of [false, true]) {
              await page.evaluate(swapped => G9.gallerySwap(swapped), swapped);
              const idleAngle = await page.locator(cardSelector(id) + ' .gallery-idle .gallery-effect').first().evaluate(node => {
                const matrix = new DOMMatrix(getComputedStyle(node).transform); return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
              });
              const cast = await inspectReplay(id), expected = nativeAngle + (swapped ? 180 : 0);
              assert(closeAngle(cast.nativeAngle, expected), id + ' retains its native artwork direction');
              assert(closeAngle(idleAngle, cast.nativeAngle), id + ' idle art matches its actual Replay angle');
              results.push({ width, sequence: 7, swapped, idleAngle, ...cast });
            }
          }
          await page.evaluate(() => G9.gallerySwap(false));
          await page.selectOption('#gallery-sequence', '4');
          const sequence4 = catalog.filter(entry => entry.sequence === 4);
          assert.equal(sequence4.length, 22);
          assert.equal(await page.locator('.gallery-idle .gallery-effect').count(), 27, 'all five split effects appear beside their primary samples');
          for (const swapped of [false, true]) {
            await page.evaluate(swapped => G9.gallerySwap(swapped), swapped);
            for (const id of ['door_of_concealment', 'spiteful_shackles', 'nature_s_growth_surge']) {
              const angle = await page.locator(cardSelector(id) + ' .gallery-idle .gallery-effect').first().evaluate(node => {
                const matrix = new DOMMatrix(getComputedStyle(node).transform); return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
              });
              assert(closeAngle(angle, 0), id + ' remains upright when sides swap');
            }
            const siphon = page.locator(cardSelector('scarlet_blood_domain') + ' .gallery-effect.secondary');
            assert.equal(await siphon.getAttribute('data-placement'), 'travel');
            const angle = await siphon.evaluate(node => {
              const matrix = new DOMMatrix(getComputedStyle(node).transform); return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
            });
            assert(closeAngle(angle, swapped ? 0 : 180), 'Moon idle motes face from victim to caster');
          }
          await page.evaluate(() => G9.gallerySwap(false));
          for (const entry of sequence4) {
            const cast = await inspectReplay(entry.id);
            assert.equal(cast.sourceId, entry.id); assert.equal(cast.outcomes, 0); assert(cast.unchanged);
            const art = page.locator(cardSelector(entry.id) + ' .gm-combat-sequence4[data-stage="cast"]');
            assert(await art.count() > 0, entry.id + ' uses the approved PNG in the gallery');
            assert.equal(await art.first().getAttribute('data-effect-src'), await page.evaluate(id => G9_DATA.fx.sequence4Abilities[id].asset, entry.id));
            results.push({ width, sequence: 4, ...cast });
          }
          for (const card of await page.locator('[data-gallery-ability]').all()) {
            await card.locator('.gallery-stage').scrollIntoViewIfNeeded();
            await card.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
          }
          await page.locator('.ability-gallery').screenshot({ path: path.join(output, 'gallery-sequence4-390px.png'), animations: 'disabled' });
          await page.selectOption('#gallery-sequence', '5'); await inspectReplay('holy_sun_bolt');
          await page.locator('#gallery-search').fill('Life Bloom'); assert.equal(await page.locator('.gm-combat-fx-layer').count(), 0, 'filtering cleans the active cast');
          await page.locator('#gallery-search').fill(''); await inspectReplay('holy_sun_bolt');
          await page.evaluate(() => G9.simulatorSection('battle')); assert.equal(await page.locator('.gm-combat-fx-layer').count(), 0);
          await page.evaluate(() => { G9.simulatorSection('animations'); G9.gallerySequence(5); }); await inspectReplay('holy_sun_bolt');
          await page.evaluate(() => G9.tab('hall')); assert.equal(await page.locator('.gm-combat-fx-layer').count(), 0, 'tab navigation cleans the cast');
          assert(await page.evaluate(() => localStorage.getItem('guild-rpg-browser-v9') === __gallerySave
            && JSON.stringify({ paths: PATHS, balance: GLOBAL_COMBAT }) === __galleryDefinitions), 'gallery changes neither saves nor shared rules');
          for (const mode of ['1v1', '2v2']) {
            await page.evaluate(mode => { G9.tab('simulator'); G9.simulatorSection('battle'); G9.simMode(mode); G9.runSimulation(); G9.skipTicker(true); }, mode);
            assert(await page.locator('#sim-viewport .b-row').count() > 0, mode + ' original simulator still resolves battles');
          }
        }
        assert.deepEqual(errors, [], 'no runtime errors'); assert.deepEqual(missing, [], 'no missing assets');
        console.log(`PASS ${width}px Sequence gallery, native casts, art-only presentation and layout`);
      } finally { await context.close(); }
    }
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ catalog: 188, results }, null, 2) + '\n');
    console.log('PASS Sequence gallery: 188 authored active tiers; all 20 Sequence 5 and 22 Sequence 4 casts; 320/390/1280px; filters, swap, clocks, cleanup and 1v1/2v2.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
