// Real Chromium geometry checks. NODE_PATH=<Playwright node_modules> node tests/battlefield-safe-layout.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.BATTLEFIELD_BROWSER_OUTPUT;
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const styles = Array.from(fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/href="(css\/[^"?]+\.css)/g), m => fs.readFileSync(path.join(root, m[1]), 'utf8')).join('\n');
const contracts = JSON.parse(fs.readFileSync(path.join(root, 'data/contracts.json'), 'utf8'));
const backgrounds = ['abandoned_market', 'clockmaker_alley', 'foggy_town', 'gothic_cathedral', 'river_dock', 'ruined_temple', 'sewer_vault'];
// Bounds independently reviewed against the portrait scene artwork. Geometry
// assertions must not trust the renderer to declare its own safe area.
const clearFloor = Object.fromEntries(backgrounds.map(name => [name, [0.04, 0.23, 0.96, 0.97]]));
// The temple's pillar bases extend below the other scenes' clear-floor edge.
clearFloor.ruined_temple = [0.04, 0.245, 0.96, 0.97];
const widths = [320, 390, 560, 768, 1440];
// Edge-reaching artwork makes a square-image containment assertion stricter
// than checking feet or the opaque center of the production portraits.
const sprite = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254"><path fill="#d5ac6a" d="M0 0h1254v1254H0z"/><path fill="#506a93" d="M100 100h1054v1054H100z"/></svg>');
const wideSprite = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800"><path fill="#d5ac6a" d="M0 0h1600v800H0z"/></svg>');
const tallSprite = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1600"><path fill="#506a93" d="M0 0h800v1600H0z"/></svg>');
const files = new Map();
let passed = 0, failed = 0;
const measurements = [];

function units(team, companions = 0, characters = 3) {
  const principal = Array.from({ length: characters }, (_, i) => ({
    id: `${team}_character_${i}`, name: `${team} character ${i}`, team,
    path: ['fool', 'moon', 'paragon'][i % 3], sequence: 0,
    maxHp: 100, hp: 100, maxSP: 20, sp: 20,
    meter: i === 0 ? { name: 'Charge', value: 50, max: 100 } : null
  }));
  return [...principal, ...Array.from({ length: companions }, (_, i) => ({
    id: `${team}_companion_${i}`, name: `${team} companion ${i}`, team,
    path: ['tyrant', 'moon', 'paragon'][i % 3], sequence: 0,
    // Cover legacy roster marionettes as well as automatically summoned units.
    summoned: i % 3 !== 0, unitType: i % 3 === 0 ? 'marionette' : null,
    maxHp: 50, hp: 50, maxSP: 0, sp: 0
  }))];
}

async function pageFixture(browser, width, brokenSprites = false) {
  const page = await browser.newPage({ viewport: { width, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://guild-review.test/**', async route => {
    const file = new URL(route.request().url()).pathname.slice(1);
    if (/data\/assets\/(?:characters|revisions)\//.test(file)) {
      if (brokenSprites) return route.fulfill({ status: 404, body: 'Missing fixture portrait' });
      return route.fulfill({ body: /moon_/.test(file) ? wideSprite : /paragon_/.test(file) ? tallSprite : sprite, contentType: 'image/svg+xml' });
    }
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep)) return route.abort();
    try {
      if (!files.has(absolute)) files.set(absolute, fs.readFileSync(absolute));
      return route.fulfill({ body: files.get(absolute), contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream' });
    } catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  await page.setContent(`<base href="https://guild-review.test/"><style>${styles}</style><main id="fixture"></main>`);
  await page.evaluate(value => {
    window.G9D = { contracts: value };
    window.G9_DATA = { runtimeAssets: { entries: {} } };
    window.abbrNum = number => String(Math.round(number || 0));
  }, contracts);
  await page.addScriptTag({ content: source });
  return { page, errors };
}

async function settle(page) {
  await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && (image.naturalWidth > 0 || image.hidden || image.style.display === 'none')));
  await page.evaluate(() => layoutBattlefields(document));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function render(page, allies, enemies, background, playback = false) {
  await page.evaluate(({ allies, enemies, background, playback }) => {
    const image = background ? `data/assets/battlefields/${background}.png` : '';
    window.fixtureProps = { allies, enemies, flattenedRows: [], shownCount: 0, isDone: false, showDetails: false, speed: 1, isSim: false, summaryText: '', battlefieldImage: image };
    document.getElementById('fixture').innerHTML = playback
      ? renderBattleLogComponent(window.fixtureProps)
      : renderHpStrip({}, allies, enemies, image);
    layoutBattlefields(document);
  }, { allies, enemies, background, playback });
  await settle(page);
}

async function geometry(page) {
  return page.evaluate(clearFloor => {
    const box = element => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const arena = document.querySelector('.gm-dungeon-arena');
    const image = arena.querySelector('.gm-battlefield-image');
    const frame = box(arena), canvas = box(arena.querySelector('.gm-battlefield-canvas'));
    const imageBox = image && !image.hidden ? box(image) : null;
    const name = image?.getAttribute('src').split('/').pop().split('?')[0].replace(/\.png$/, '');
    const bounds = image && !image.hidden ? clearFloor[name] : [0, 0, 1, 1];
    const sourceGround = Object.fromEntries(['left', 'top', 'right', 'bottom'].map((key, index) => [key, bounds[index]]));
    // Floor coordinates belong to the complete source-image canvas. A crowded
    // army may be outside the scroll viewport, but never outside this floor.
    const ground = {
      left: canvas.left + canvas.width * sourceGround.left,
      right: canvas.left + canvas.width * sourceGround.right,
      top: canvas.top + canvas.height * sourceGround.top,
      bottom: canvas.top + canvas.height * sourceGround.bottom
    };
    return {
      frame, canvas, imageBox, sourceGround, ground, crowded: arena.classList.contains('crowded'),
      imageRatio: imageBox ? image.naturalWidth / image.naturalHeight : null,
      imageFit: imageBox ? getComputedStyle(image).objectFit : null,
      bottomGap: parseFloat(getComputedStyle(arena).getPropertyValue('--gm-guild-bottom-gap')),
      scroll: { width: arena.scrollWidth, height: arena.scrollHeight, clientWidth: arena.clientWidth, clientHeight: arena.clientHeight, keyboardFocusable: arena.tabIndex === 0 },
      documentWidth: document.documentElement.scrollWidth,
      cards: Array.from(arena.querySelectorAll('.gm-arena-unit'), card => {
        const art = card.querySelector('.combat-sprite-img');
        const fallback = card.querySelector('.combat-sprite-fallback, .combat-enemy-avatar');
        const visibleArt = art && getComputedStyle(art).display !== 'none' ? art : fallback;
        return {
          id: card.dataset.unitId, role: card.dataset.unitRole,
          team: card.classList.contains('ally') ? 'ally' : 'enemy',
          card: box(card), sprite: box(card.querySelector('.gm-unit-sprite')),
          art: box(visibleArt), fit: art && getComputedStyle(art).objectFit,
          isFallback: visibleArt !== art,
          display: getComputedStyle(card).display, visibility: getComputedStyle(card).visibility,
          info: box(card.querySelector('.gm-unit-info')),
          nameBorderBottom: parseFloat(getComputedStyle(card.querySelector('.gm-unit-name-label')).borderBottomWidth),
          gauges: Array.from(card.querySelectorAll('.gm-float-track'), box),
          inExpectedFormation: !!card.closest(card.dataset.unitRole === 'companion' ? '.gm-companion-formation' : '.gm-character-formation')
        };
      })
    };
  }, clearFloor);
}

function inside(inner, outer, label, tolerance = 1) {
  for (const side of ['left', 'top', 'right', 'bottom']) assert(Number.isFinite(outer[side]), `${label}: finite ${side} boundary`);
  assert(inner.left >= outer.left - tolerance && inner.right <= outer.right + tolerance && inner.top >= outer.top - tolerance && inner.bottom <= outer.bottom + tolerance,
    `${label}: ${JSON.stringify(inner)} is outside ${JSON.stringify(outer)}`);
}

function check(result, width, allies, enemies) {
  assert(result.documentWidth <= width, 'formation must not widen the page');
  assert.equal(result.cards.length, allies.length + enemies.length, 'every deployed unit has a card');
  assert(result.ground.right > result.ground.left && result.ground.bottom > result.ground.top, 'safe floor exists on complete canvas');
  assert(result.scroll.keyboardFocusable, 'battlefield panning is keyboard accessible');
  assert(Math.abs(result.canvas.width - result.scroll.clientWidth) < 1, 'battlefield fills the current responsive box without side gaps');
  assert(result.scroll.width <= result.scroll.clientWidth + 1, 'formations require no horizontal panning');
  assert.equal(result.bottomGap, width <= 560 ? 32 : 48, 'responsive bottom clearance matches the approved spacing');
  if (result.imageBox) {
    for (const side of ['left', 'top', 'right', 'bottom']) assert(Math.abs(result.imageBox[side] - result.canvas[side]) < 1, 'complete image fills the responsive canvas without cropping or side gaps');
    assert.equal(result.imageFit, 'fill', 'scenery stretches to the complete canvas instead of leaving letterboxing');
    assert(Math.abs(result.imageRatio - 9 / 16) < .002, 'battlefield artwork uses the approved 9:16 portrait format');
  }
  const expected = new Map([...allies, ...enemies].map(unit => [unit.id, unit]));
  for (const card of result.cards) {
    const unit = expected.get(card.id), companion = !!unit.summoned || unit.unitType === 'marionette';
    assert.equal(card.role, companion ? 'companion' : 'character', `${card.id} keeps its real role`);
    assert(card.inExpectedFormation, `${card.id} belongs to its role's formation`);
    assert.notEqual(card.display, 'none'); assert.notEqual(card.visibility, 'hidden');
    const size = companion ? (width <= 560 ? (result.crowded ? 28 : 32) : 40) : width <= 560 ? 64 : 96;
    assert(Math.abs(card.sprite.width - size) < .1 && Math.abs(card.sprite.height - size) < .1, `${card.id}: expected ${size}px square artwork`);
    assert(card.art.width > 0 && card.art.height > 0, `${card.id} has visible artwork or a fallback`);
    if (!card.isFallback) assert.equal(card.fit, 'contain', 'wide weapons and wings must retain full source bounds');
    inside(card.card, result.ground, `${card.id} complete card on floor`);
    inside(card.art, card.sprite, `${card.id} artwork fits its square`);
    inside(card.info, card.card, `${card.id} information remains visible`);
    assert.equal(card.nameBorderBottom, 0, `${card.id} has no mythical name underline`);
    for (const gauge of card.gauges) {
      assert(gauge.width > 0 && gauge.height > 0, `${card.id} gauge remains visible`);
      inside(gauge, card.card, `${card.id} gauge fits card`);
    }
  }
  for (let i = 0; i < result.cards.length; i++) for (let j = i + 1; j < result.cards.length; j++) {
    const a = result.cards[i].art, b = result.cards[j].art;
    const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    assert(overlapX <= 1 || overlapY <= 1, `artwork ${result.cards[i].id} and ${result.cards[j].id} must not overlap`);
  }
  const enemy = result.cards.filter(card => card.team === 'enemy'), guild = result.cards.filter(card => card.team === 'ally');
  if (enemy.length) assert(Math.abs(Math.min(...enemy.map(card => card.card.top)) - (result.ground.top + 8)) < 1,
    'enemy formation stays anchored to the top of the clear floor with 8px padding');
  if (guild.length) {
    const expectedClearance = Math.max(result.bottomGap, result.canvas.height * (1 - result.sourceGround.bottom) + 8);
    const actualClearance = result.canvas.bottom - Math.max(...guild.map(card => card.card.bottom));
    assert(Math.abs(actualClearance - expectedClearance) < 1,
      'lowest complete guild card, including bars, leaves the requested bottom room while staying on the clear floor');
  }
  if (enemy.length && guild.length) assert(Math.max(...enemy.map(card => card.card.bottom)) + 16 <= Math.min(...guild.map(card => card.card.top)) + 1,
    'opposing formations retain at least 16px separation at every breakpoint');
}

async function checkPanReachability(page) {
  const unreachable = await page.evaluate(() => {
    const arena = document.querySelector('.gm-dungeon-arena');
    const original = { left: arena.scrollLeft, top: arena.scrollTop };
    const failures = [];
    for (const card of arena.querySelectorAll('.gm-arena-unit')) {
      const frame = arena.getBoundingClientRect(), current = card.getBoundingClientRect();
      arena.scrollLeft += current.left - frame.left - (arena.clientWidth - current.width) / 2;
      arena.scrollTop += current.top - frame.top - (arena.clientHeight - current.height) / 2;
      const visible = card.getBoundingClientRect();
      if (visible.left < frame.left - 1 || visible.right > frame.left + arena.clientWidth + 1 || visible.top < frame.top - 1 || visible.bottom > frame.top + arena.clientHeight + 1) failures.push(card.dataset.unitId);
    }
    arena.scrollLeft = original.left; arena.scrollTop = original.top;
    return failures;
  });
  assert.deepEqual(unreachable, [], 'every complete card is reachable within the scroll viewport');
}

async function test(label, fn) {
  try { await fn(); passed++; console.log('PASS ' + label); }
  catch (error) { failed++; console.error('FAIL ' + label + ': ' + error.message); }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  try {
    for (const width of widths) {
      const { page, errors } = await pageFixture(browser, width);
      try {
        for (const background of backgrounds) for (const companionCount of [4, 12]) {
          await test(`${background}, ${width}px, ${companionCount} companions per side`, async () => {
            const allies = units('ally', companionCount), enemies = units('enemy', companionCount);
            await render(page, allies, enemies, background);
            const result = await geometry(page); check(result, width, allies, enemies);
            await checkPanReachability(page);
            assert.equal(result.crowded, companionCount > 6);
            measurements.push({ width, background, companions: companionCount, ...result });
            if (output && width === 390 && ['abandoned_market', 'gothic_cathedral'].includes(background)) {
              fs.mkdirSync(output, { recursive: true });
              await page.screenshot({ path: path.join(output, `${background}-${width}-${companionCount}.png`), fullPage: true });
            }
          });
        }
        await test(`solo and background-free formations at ${width}px`, async () => {
          const allies = units('ally', 0, 1), enemies = units('enemy', 0, 1);
          for (const background of ['river_dock', '']) { await render(page, allies, enemies, background); check(await geometry(page), width, allies, enemies); await checkPanReachability(page); }
        });
        await test(`four principal rows at ${width}px`, async () => {
          const allies = units('ally', 0, 6), enemies = units('enemy', 0, 6);
          await render(page, allies, enemies, 'abandoned_market');
          check(await geometry(page), width, allies, enemies);
          await checkPanReachability(page);
        });
        assert.deepEqual(errors, [], 'fixture has no browser exceptions');
      } finally { await page.close(); }
    }
    await test('live summons, mythical transformation and resize preserve original portraits', async () => {
      const { page, errors } = await pageFixture(browser, 390);
      try {
        const originalAllies = units('ally'), originalEnemies = units('enemy');
        await render(page, originalAllies, originalEnemies, 'abandoned_market', true);
        await page.evaluate(() => {
          window.originalCard = document.querySelector('[data-unit-id="ally_character_0"]');
          window.originalImage = window.originalCard.querySelector('img');
        });
        const allies = units('ally', 12), enemies = units('enemy', 12);
        allies[0].inForm = true; allies[0].shield = 30;
        enemies[1].hp = 0; enemies[1].alive = false;
        await page.evaluate(({ allies, enemies }) => {
          window.fixtureProps = { ...window.fixtureProps, shownCount: 1, flattenedRows: [{ type: 'system', text: 'Companions enter on both sides.', resources: [...allies, ...enemies] }] };
          updateBattleLogComponent(document.querySelector('.battle-log-wrap'), window.fixtureProps);
        }, { allies, enemies });
        await settle(page);
        for (const width of [390, 768, 320]) {
          await page.setViewportSize({ width, height: 1100 });
          await page.evaluate(() => layoutBattlefields(document));
          await settle(page); check(await geometry(page), width, allies, enemies);
          await checkPanReachability(page);
        }
        assert(await page.evaluate(() => window.originalCard === document.querySelector('[data-unit-id="ally_character_0"]') && window.originalImage === window.originalCard.querySelector('img')));
        assert((await page.locator('[data-unit-id="ally_character_0"] img').getAttribute('src')).includes('fool_mythical'));
        assert(await page.locator('[data-unit-id="enemy_character_1"]').evaluate(node => node.classList.contains('dead')));
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    await test('short phones with reserved scrollbars fill the box and preserve vertical reading position', async () => {
      const { page, errors } = await pageFixture(browser, 390);
      try {
        await page.setViewportSize({ width: 390, height: 568 });
        await page.addStyleTag({ content: '.gm-dungeon-arena { scrollbar-gutter: stable; }' });
        const allies = units('ally', 12), enemies = units('enemy', 12);
        await render(page, allies, enemies, 'abandoned_market', true);
        const result = await geometry(page); check(result, 390, allies, enemies);
        assert(result.scroll.height > result.scroll.clientHeight, 'crowded short screen needs vertical panning');
        await checkPanReachability(page);
        const position = await page.evaluate(() => {
          const arena = document.querySelector('.gm-dungeon-arena');
          arena.scrollTop = arena.scrollHeight;
          const before = arena.scrollTop;
          window.fixtureProps = { ...window.fixtureProps, shownCount: 1, flattenedRows: [{ type: 'system', text: 'The battle continues.' }] };
          updateBattleLogComponent(document.querySelector('.battle-log-wrap'), window.fixtureProps);
          return { before, after: arena.scrollTop };
        });
        assert(Math.abs(position.before - position.after) < 1, 'playback preserves the battlefield scroll position');
        await page.setViewportSize({ width: 320, height: 480 });
        await settle(page); check(await geometry(page), 320, allies, enemies);
        await checkPanReachability(page);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    await test('missing portraits and generic enemy avatars fit character and companion slots', async () => {
      const { page, errors } = await pageFixture(browser, 320, true);
      try {
        const allies = units('ally', 2), enemies = units('enemy', 2);
        delete enemies[0].path;
        await render(page, allies, enemies, 'gothic_cathedral');
        const result = await geometry(page); check(result, 320, allies, enemies);
        await checkPanReachability(page);
        assert(result.cards.every(card => card.isFallback), 'all failed portraits and generic enemies show a fallback');
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
  } finally { await browser.close(); }
  if (output) { fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'battlefield-safe-layout.json'), JSON.stringify(measurements, null, 2) + '\n'); }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
