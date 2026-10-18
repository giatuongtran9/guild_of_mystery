// Chromium verifies the effects at real phone geometry and both readable speeds.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.COMBAT_ALIGNMENT_OUTPUT || '/tmp/guild-combat-alignment';
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = [...html.matchAll(/href="(css\/[^"?]+\.css)/g)].map(m => fs.readFileSync(path.join(root, m[1]), 'utf8')).join('\n');
const data = Object.fromEntries(['contracts', 'fx', 'balance'].map(name => [name, JSON.parse(fs.readFileSync(path.join(root, `data/${name}.json`)))]));
let passed = 0;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  const results = [];
  try {
    for (const width of [320, 390]) for (const speed of [1, 2]) {
      const page = await browser.newPage({ viewport: { width, height: 1200 } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      try {
        await page.route('https://combat-alignment.test/**', route => {
          const file = path.resolve(root, new URL(route.request().url()).pathname.slice(1));
          if (!file.startsWith(root + path.sep)) return route.abort();
          try { return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); }
          catch { return route.fulfill({ status: 404, body: 'Missing test asset' }); }
        });
        await page.setContent(`<base href="https://combat-alignment.test/"><style>${styles}</style><main></main>`);
        await page.evaluate(value => { window.G9_DATA = value; window.G9D = value; window.abbrNum = n => String(Math.round(n || 0)); }, data);
        await page.addScriptTag({ content: source });
        await page.evaluate(async () => {
          const make = (id, team, path) => ({ id, name: id, team, path, sequence: 8, hp: 100, maxHp: 100, sp: 100, maxSP: 100, alive: true });
          window.testUnits = [make('caster', 'ally', 'tyrant'), make('enemy', 'enemy', 'error')];
          document.querySelector('main').innerHTML = renderBattleLogComponent({ allies: testUnits.slice(0, 1), enemies: testUnits.slice(1),
            flattenedRows: [], shownCount: 0, isDone: false, speed: 1, summaryText: '', battlefieldImage: 'data/assets/battlefields/abandoned_market.png' });
          await Promise.all([...Object.values(G9_DATA.fx.sequence8Abilities).map(s => s.asset),
            'data/assets/effects/sword-slash.png', 'data/assets/effects/gun-muzzle.png',
            'data/assets/effects/unarmed-punch-impact.png', 'data/assets/effects/brutal-strike.png'].map(async src => {
            const image = new Image(); image.src = src; await image.decode();
          }));
        });
        await page.waitForFunction(() => [...document.images].every(image => image.complete));
        await page.evaluate(() => {
          layoutBattlefields(document);
          const wrap = document.querySelector('.battle-log-wrap'), field = wrap.querySelector('.gm-battlefield-canvas');
          // Preserve genuine browser box metrics while giving the four compass
          // directions repeatable positions independent of the party algorithm.
          field.style.height = '620px';
          for (const unit of wrap.querySelectorAll('.gm-arena-unit')) {
            field.append(unit); unit.style.position = 'absolute'; unit.style.width = '64px';
            unit.querySelector('.gm-unit-sprite-anchor').style.cssText = 'width:64px;height:64px;flex-basis:64px';
          }
          window.testEffects = createBattleEffects(wrap);
          testEffects.sync(Object.fromEntries(testUnits.map(u => [u.id, u])));
          window.makeAlignmentAction = (id, attackKind, critical = false, counter = false) => {
            const event = { type: 'damage', actorId: 'caster', targetId: 'enemy', amount: 40, hpLoss: 40,
              damageType: 'physical', critical, ...(counter ? { isReaction: true, isCounter: true, abilityId: 'basic_attack', attackKind } : {}) };
            const row = { type: 'turn', actorId: 'caster', abilityId: id,
              ability: counter ? 'Counter' : id === 'basic_attack' ? 'Attack' : id.replaceAll('_', ' '),
              sourcePath: G9_DATA.fx.sequence8Abilities[id]?.pathway || 'tyrant', ...(attackKind ? { attackKind } : {}),
              ...(counter ? { isCounter: true } : {}), timeline: [{ type: counter ? 'reaction' : 'damage', event }] };
            return { row, event };
          };
          window.positionAlignmentUnits = direction => {
            testEffects.clear(); testEffects.sync(Object.fromEntries(testUnits.map(u => [u.id, u])));
            const field = document.querySelector('.gm-battlefield-canvas'), size = field.getBoundingClientRect().width;
            const center = (size - 64) / 2;
            const locations = direction === 'left' ? [[size - 72, 250], [8, 250]]
              : direction === 'right' ? [[8, 250], [size - 72, 250]]
                : direction === 'down' ? [[center, 80], [center, 390]] : [[center, 390], [center, 80]];
            for (const [index, id] of ['caster', 'enemy'].entries()) {
              const node = document.querySelector(`[data-unit-id="${id}"]`); node.style.left = locations[index][0] + 'px'; node.style.top = locations[index][1] + 'px';
            }
          };
          window.freezeAlignmentPhase = time => {
            testEffects.pause();
            for (const animation of document.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true })) animation.currentTime = time;
          };
        });

        for (const id of Object.keys(data.fx.sequence8Abilities).filter(id => data.fx.sequence8Abilities[id].mode === 'travel')) {
          for (const direction of ['up', 'down', 'left', 'right']) {
            const result = await page.evaluate(({ id, direction, speed }) => {
              positionAlignmentUnits(direction);
              const { row, event } = makeAlignmentAction(id);
              const wrap = document.querySelector('.battle-log-wrap'), field = wrap.querySelector('.gm-battlefield-canvas');
              const actor = wrap.querySelector('[data-unit-id="caster"] .gm-unit-sprite-anchor').getBoundingClientRect();
              const target = wrap.querySelector('[data-unit-id="enemy"] .gm-unit-sprite-anchor').getBoundingClientRect();
              const expected = Math.atan2(target.y - actor.y, target.x - actor.x) * 180 / Math.PI;
              testEffects.show({ type: 'cast', row, next: row.timeline[0] }, speed, 800); freezeAlignmentPhase(464);
              const cast = wrap.querySelector('.gm-combat-sequence8[data-stage="cast"]');
              const castMatrix = new DOMMatrix(getComputedStyle(cast).transform);
              const castAngle = Math.atan2(castMatrix.b, castMatrix.a) * 180 / Math.PI;
              const castResult = { data: Number(cast.dataset.angleDeg), angle: castAngle,
                opacity: Number(getComputedStyle(cast).opacity), flip: cast.querySelector('image').dataset.flipDeg || '0',
                rate: cast.getAnimations()[0]?.playbackRate, width: cast.getBoundingClientRect().width,
                start: cast.getAnimations()[0].effect.getKeyframes()[0].transform,
                end: cast.getAnimations()[0].effect.getKeyframes().at(-1).transform };
              const playing = { turnRows: [row], currentTurn: 0, eventCount: 1 };
              const hold = battlePresentationDelay(playing, speed);
              testEffects.show({ type: 'damage', row, event }, speed, 225); freezeAlignmentPhase(70);
              const impact = wrap.querySelector('.gm-combat-sequence8[data-stage="impact"]');
              const matrix = new DOMMatrix(getComputedStyle(impact).transform);
              const impacts = { data: Number(impact.dataset.angleDeg), angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
                opacity: Number(getComputedStyle(impact).opacity), flip: impact.querySelector('image').dataset.flipDeg || '0',
                shakeCount: field.getAnimations().length, shakeRate: field.getAnimations()[0]?.playbackRate };
              return { id, direction, expected, cast: castResult, impact: impacts, hold, number: wrap.querySelector('.gm-battle-fx-number')?.textContent };
            }, { id, direction, speed });
            const closeAngle = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < .05;
            assert(closeAngle(result.cast.data, result.expected), id + ' metadata follows the flight direction');
            assert(closeAngle(result.cast.angle, result.expected), id + ' rendered cast actually faces the target');
            assert(closeAngle(result.impact.data, result.expected));
            assert(closeAngle(result.impact.angle, result.cast.angle), id + ' rendered impact and trail are aligned');
            assert(result.cast.opacity > .5 && result.impact.opacity > .5, id + ' cast and impact remain readable');
            assert(result.cast.width >= 40); assert.equal(result.cast.rate, speed === 2 ? 1.6 : 1);
            assert.equal(result.impact.shakeCount, 1); assert.equal(result.impact.shakeRate, speed);
            assert.equal(result.hold, 225 / speed, 'the shake does not append playback time');
            assert(result.number.includes('40'));
            if (id === 'raging_blow') { assert.equal(result.cast.flip, '180'); assert.equal(result.impact.flip, '180'); }
            if (id === 'heavy_cleave') assert.notEqual(result.cast.start, result.cast.end, 'Cleave crosses the battlefield');
            if (width === 390 && direction === 'up' && ['raging_blow', 'heavy_cleave'].includes(id)) {
              await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `${id}-${speed}x-impact.png`), animations: 'allow' });
            }
            passed++; results.push({ width, speed, ...result });
          }
        }

        const criticals = await page.evaluate(({ speed }) => {
          const cases = [['raging_blow'], ['heavy_cleave'], ['brutal_strike'], ['basic_attack', 'weapon'],
            ['basic_attack', 'gun'], ['basic_attack', 'unarmed']];
          const records = [];
          for (const [id, kind] of cases) {
            const variants = [];
            for (const critical of [false, true]) {
              positionAlignmentUnits('up'); const { row, event } = makeAlignmentAction(id, kind, critical);
              testEffects.show({ type: 'damage', row, event }, speed, 225); freezeAlignmentPhase(70);
              const wrap = document.querySelector('.battle-log-wrap'), layer = wrap.querySelector('.gm-combat-fx-layer');
              const copy = layer.cloneNode(true); for (const node of [copy, ...copy.querySelectorAll('*')]) node.removeAttribute('data-critical');
              const number = wrap.querySelector('.gm-battle-fx-number'), style = getComputedStyle(number);
              variants.push({ html: copy.outerHTML,
                tracks: layer.getAnimations({ subtree: true }).map(a => ({ duration: a.effect.getTiming().duration, frames: a.effect.getKeyframes(), rate: a.playbackRate })),
                numberColor: style.color, numberSize: parseFloat(style.fontSize), critical: number.dataset.critical,
                hold: battlePresentationDelay({ turnRows: [row], currentTurn: 0, eventCount: 1 }, speed),
                shakeDuration: wrap.querySelector('.gm-battlefield-canvas').getAnimations()[0]?.effect.getTiming().duration });
            }
            records.push({ id, variants });
          }
          return records;
        }, { speed });
        for (const { id, variants: [normal, critical] } of criticals) {
          assert.equal(critical.html, normal.html, id + ' critical uses identical impact artwork');
          assert.deepEqual(critical.tracks, normal.tracks, id + ' critical uses identical effect frames and timing');
          assert.equal(critical.numberColor, 'rgb(255, 166, 77)'); assert(critical.numberSize > normal.numberSize);
          assert.equal(critical.critical, 'true'); assert.equal(normal.critical, 'false');
          assert.equal(critical.hold, normal.hold);
          assert.equal(critical.shakeDuration, normal.shakeDuration, 'criticals add no shake time');
          assert.equal(critical.shakeDuration, id === 'basic_attack' ? 160 : 225); passed++;
        }

        for (const [kind, selector] of [['weapon', '.gm-combat-sword-slash-travel'], ['gun', '.gm-combat-gun-muzzle'], ['unarmed', '.gm-combat-punch-trail']]) {
          const counter = await page.evaluate(({ kind, selector, speed }) => {
            positionAlignmentUnits('up'); const { row, event } = makeAlignmentAction('basic_attack', kind, false, true);
            testEffects.show({ type: 'cast', row, next: row.timeline[0] }, speed, 300); freezeAlignmentPhase(180);
            const wrap = document.querySelector('.battle-log-wrap'), cue = wrap.querySelector(selector);
            const result = { present: !!cue, opacity: cue ? Number(getComputedStyle(cue).opacity) : 0,
              attackChip: !!wrap.querySelector('.gm-combat-ability-chip') };
            testEffects.show({ type: 'reaction', row, event }, speed, 225); freezeAlignmentPhase(70);
            result.punchImpact = !!wrap.querySelector('.gm-combat-impact-image-punch');
            result.number = wrap.querySelector('.gm-battle-fx-number')?.textContent; return result;
          }, { kind, selector, speed });
          assert(counter.present && counter.opacity > 0, kind + ' Counter uses a visible normal attack cue');
          assert.equal(counter.attackChip, false); assert(counter.number.includes('40'));
          if (kind === 'unarmed') assert(counter.punchImpact); passed++;
        }

        const controls = await page.evaluate(async ({ speed }) => {
          positionAlignmentUnits('up'); const { row, event } = makeAlignmentAction('heavy_cleave');
          const wrap = document.querySelector('.battle-log-wrap'), field = wrap.querySelector('.gm-battlefield-canvas');
          field.style.transform = 'scale(1)'; const original = getComputedStyle(field).transform;
          testEffects.show({ type: 'damage', row, event }, speed, 225); freezeAlignmentPhase(56);
          const shake = field.getAnimations()[0], before = getComputedStyle(field).transform;
          await new Promise(resolve => setTimeout(resolve, 60));
          const pausedTime = shake.currentTime, pausedTransform = getComputedStyle(field).transform;
          testEffects.setSpeed(speed === 1 ? 2 : 1);
          const switched = { state: shake.playState, rate: shake.playbackRate };
          testEffects.resume(); testEffects.clear();
          const afterSkip = { animations: field.getAnimations().length, transform: getComputedStyle(field).transform,
            inline: field.style.transform, attached: field.isConnected, effects: wrap.querySelectorAll('.gm-combat-fx-layer, .gm-battle-fx-layer, .gm-pathway-fx-layer').length };
          testEffects.sync(Object.fromEntries(testUnits.map(u => [u.id, u])));
          testEffects.show({ type: 'damage', row, event }, 1, 225); const completing = field.getAnimations()[0]; completing.finish();
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return { original, before, pausedTransform, pausedTime, switched, afterSkip,
            finished: { attached: field.isConnected, transform: getComputedStyle(field).transform, animations: field.getAnimations().length } };
        }, { speed });
        assert.notEqual(controls.before, controls.original, 'impact really displaces the battlefield');
        assert.equal(controls.pausedTransform, controls.before); assert.equal(controls.pausedTime, 56, 'Pause freezes the shake clock');
        assert.equal(controls.switched.state, 'paused'); assert.equal(controls.switched.rate, speed === 1 ? 2 : 1);
        assert.deepEqual(controls.afterSkip, { animations: 0, transform: controls.original, inline: 'scale(1)', attached: true, effects: 0 });
        assert.deepEqual(controls.finished, { attached: true, transform: controls.original, animations: 0 }); passed++;

        for (const reduced of [false, true]) {
          await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
          const count = await page.evaluate(({ reduced }) => {
            positionAlignmentUnits('up'); const { row, event } = makeAlignmentAction('brutal_strike');
            testEffects.show({ type: 'damage', row, event }, reduced ? 2 : 4, 225);
            return document.querySelector('.gm-battlefield-canvas').getAnimations().length;
          }, { reduced });
          assert.equal(count, 0, (reduced ? 'reduced motion' : 'compact playback') + ' does not shake'); passed++;
        }
        assert.deepEqual(errors, []); await page.evaluate(() => testEffects.clear());
        console.log(`PASS ${width}px ${speed}x aligned flight/impact, counters, criticals and controls`);
      } finally { await page.close(); }
    }
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed, results }, null, 2) + '\n');
  } finally { await browser.close(); }
  console.log(`${passed} combat alignment browser checks passed.`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
