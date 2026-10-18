// Real Chromium presentation checks; the engine has already resolved the result.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.READABLE_FX_OUTPUT || '/tmp/guild-readable-seq9';
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = [...html.matchAll(/href="(css\/[^"?]+\.css)/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const data = Object.fromEntries(['contracts', 'fx', 'balance'].map(name => [name, JSON.parse(fs.readFileSync(path.join(root, `data/${name}.json`)))]));
const preloads = [...html.matchAll(/<link rel="preload" as="image"[^>]+>/g)].map(match => match[0]).join('');
for (const asset of ['exploit-loophole', 'combat-theft', 'healing-touch']) assert(preloads.includes(`${asset}.png`));
let passed = 0;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  try {
    for (const width of [320, 390, 1440]) for (const speed of [1, 2]) {
      const page = await browser.newPage({ viewport: { width, height: 1200 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      try {
        await page.route('https://readable-fx.test/**', route => {
          const file = path.resolve(root, new URL(route.request().url()).pathname.slice(1));
          if (!file.startsWith(root + path.sep)) return route.abort();
          try { return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); }
          catch { return route.fulfill({ status: 404, body: 'Missing test asset' }); }
        });
        await page.setContent(`<base href="https://readable-fx.test/">${preloads}<style>${styles}</style><main></main>`);
        await page.evaluate(value => {
          window.G9_DATA = value; window.G9D = value; window.abbrNum = number => String(Math.round(number || 0));
        }, data);
        await page.addScriptTag({ content: source });
        await page.evaluate(async () => {
          const make = (id, team) => ({ id, name: id, team, path: team === 'ally' ? 'moon' : 'error', sequence: 9,
            hp: 100, maxHp: 100, sp: 100, maxSP: 100, alive: true });
          window.units = [make('caster', 'ally'), make('friend', 'ally'), make('enemy', 'enemy')];
          document.querySelector('main').innerHTML = renderBattleLogComponent({ allies: units.slice(0, 2), enemies: units.slice(2),
            flattenedRows: [], shownCount: 0, isDone: false, speed: 1, summaryText: '', battlefieldImage: 'data/assets/battlefields/abandoned_market.png' });
          await Promise.all(['exploit-loophole', 'combat-theft', 'healing-touch'].map(async name => {
            const image = new Image(); image.src = `data/assets/effects/${name}.png`; await image.decode();
          }));
        });
        await page.waitForFunction(() => [...document.images].every(image => image.complete));
        await page.evaluate(() => layoutBattlefields(document));
        for (const [id, targetId] of [['exploit_loophole', 'enemy'], ['combat_theft', 'enemy'], ['healing_touch', 'friend'], ['healing_touch', 'caster']]) {
          const result = await page.evaluate(({ id, targetId, speed }) => {
            window.reviewEffects?.clear();
            const wrap = document.querySelector('.battle-log-wrap'), effects = createBattleEffects(wrap); window.reviewEffects = effects;
            effects.sync(Object.fromEntries(units.map(unit => [unit.id, unit])));
            const kind = id === 'healing_touch' ? 'heal' : id === 'combat_theft' ? 'note' : 'damage';
            const event = { type: kind === 'note' ? 'status' : kind, actorId: 'caster', targetId,
              amount: 40, hpLoss: kind === 'damage' ? 40 : 0, damageType: 'disorder', text: 'Steals ATK and DEF.' };
            const row = { type: 'turn', actorId: 'caster', abilityId: id, ability: id.replaceAll('_', ' '),
              timeline: [{ type: kind, event }] };
            const playing = { turnRows: [row], currentTurn: 0, eventCount: null };
            effects.show(advanceBattlePresentation(playing), speed, battlePresentationDelay(playing)); effects.pause();
            const selector = id === 'exploit_loophole' ? '.gm-combat-loophole-seal' : id === 'combat_theft' ? '.gm-combat-theft-siphon' : '.gm-combat-healing-touch-flight';
            const main = wrap.querySelector(selector); if (!main) throw new Error('Missing main ability effect');
            const tracked = [...wrap.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true })];
            const mainAnimation = id === 'exploit_loophole' ? main.querySelector('.gm-loophole-half-top').getAnimations()[0] : main.getAnimations()[0];
            const duration = Number(mainAnimation.effect.getTiming().duration), rate = mainAnimation.playbackRate;
            const sample = id === 'healing_touch' && targetId === 'friend' ? .82 : .65;
            for (const animation of tracked) animation.currentTime = duration * sample;
            const splitOpacity = id === 'exploit_loophole' ? Number(getComputedStyle(main.querySelector('.gm-loophole-half-top')).opacity) : null;
            const flashOpacity = id === 'exploit_loophole' ? Number(getComputedStyle(main.querySelector('ellipse')).opacity) : null;
            const opacity = Number(getComputedStyle(main).opacity);
            const castWall = battlePresentationDelay(playing, speed);
            const numberBefore = wrap.querySelector('.gm-battle-fx-number')?.textContent || null;
            effects.setSpeed(speed === 1 ? 2 : 1);
            const switchedRate = mainAnimation.playbackRate, pausedAfterSwitch = mainAnimation.playState;
            effects.setSpeed(speed);
            const revealWidth = id === 'healing_touch' && targetId === 'friend'
              ? wrap.querySelector('[data-gm-healing-defs] clipPath rect').getBBox().width : null;
            const imageWidth = Number(main.querySelector('image').getAttribute('width'));
            return { duration, rate, castWall, splitOpacity, flashOpacity, opacity, numberBefore, switchedRate, pausedAfterSwitch, revealWidth, imageWidth };
          }, { id, targetId, speed });
          assert.equal(result.duration, 800); assert.equal(result.rate, speed === 2 ? 1.6 : 1);
          assert.equal(result.castWall, speed === 2 ? 500 : 800); assert.equal(result.duration / result.rate, result.castWall);
          assert.equal(result.numberBefore, null, 'the result remains hidden until the complete cast finishes');
          assert(result.opacity > .5, 'the main effect remains visible through its readable middle');
          if (id === 'exploit_loophole') {
            assert(result.splitOpacity > .8, 'the shattering halves are visible before the cast ends');
            assert(result.flashOpacity < .05, 'the brief glint cannot obscure the separating halves');
          }
          if (id === 'healing_touch' && targetId === 'friend') assert(result.revealWidth >= result.imageWidth, 'the complete healing stream and recipient lotus are revealed before fading');
          assert.equal(result.switchedRate, speed === 1 ? 1.6 : 1); assert.equal(result.pausedAfterSwitch, 'paused');
          if (width === 390) await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `${id}-${targetId}-${speed}x-readable.png`), animations: 'allow' });
          await page.evaluate(() => reviewEffects.clear());
          assert.equal(await page.locator('.gm-combat-fx-layer, .gm-battle-fx-layer').count(), 0, 'Skip/clear removes the complete effect');
          assert.deepEqual(errors, []); passed++; console.log(`PASS ${width}px ${speed}x ${id} -> ${targetId}`);
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  console.log(`${passed} readable Sequence 9 browser checks passed.`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
