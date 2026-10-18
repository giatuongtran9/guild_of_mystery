// Actual Chromium checks for the complete Sequence 8 cast/outcome presentation.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.SEQUENCE8_FX_OUTPUT || '/tmp/guild-sequence8-fx';
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = [...html.matchAll(/href="(css\/[^"?]+\.css)/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const data = Object.fromEntries(['contracts', 'fx', 'balance'].map(name => [name, JSON.parse(fs.readFileSync(path.join(root, `data/${name}.json`)))]));
const ids = Object.keys(data.fx.sequence8Abilities || {});
const utility = ['provocation', 'bad_luck_curse', 'beast_command'];
assert.equal(ids.length, 20, 'all active Sequence 8 abilities must be represented');
let passed = 0;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  const results = [];
  try {
    for (const width of [320, 390, 1440]) for (const speed of [1, 2]) {
      const page = await browser.newPage({ viewport: { width, height: 1200 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      try {
        await page.route('https://sequence8-fx.test/**', route => {
          const file = path.resolve(root, new URL(route.request().url()).pathname.slice(1));
          if (!file.startsWith(root + path.sep)) return route.abort();
          try { return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); }
          catch { return route.fulfill({ status: 404, body: 'Missing test asset' }); }
        });
        await page.setContent(`<base href="https://sequence8-fx.test/"><style>${styles}</style><main></main>`);
        await page.evaluate(value => { window.G9_DATA = value; window.G9D = value; window.abbrNum = number => String(Math.round(number || 0)); }, data);
        await page.addScriptTag({ content: source });
        await page.evaluate(async () => {
          const make = (id, team, path, companion) => ({ id, name: id, team, path, sequence: 8,
            hp: 100, maxHp: 100, sp: 100, maxSP: 100, alive: true,
            ...(companion ? { summoned: true, companion } : {}) });
          window.units = [make('caster', 'ally', 'moon'), make('friend', 'ally', 'fool'),
            make('beast', 'ally', 'moon', { ownerId: 'caster', kind: 'beast' }), make('enemy', 'enemy', 'error')];
          document.querySelector('main').innerHTML = renderBattleLogComponent({ allies: units.slice(0, 3), enemies: units.slice(3),
            flattenedRows: [], shownCount: 0, isDone: false, speed: 1, summaryText: '', battlefieldImage: 'data/assets/battlefields/abandoned_market.png' });
        });
        await page.waitForFunction(() => [...document.images].every(image => image.complete));
        await page.evaluate(() => layoutBattlefields(document));

        // Exercise the real participant-only warmup before the fixture decodes
        // the remaining artwork for the large screenshot matrix.
        const warmAsset = data.fx.sequence8Abilities.beast_command.asset;
        const warmed = page.waitForResponse(response => new URL(response.url()).pathname === '/' + warmAsset);
        await page.evaluate(() => {
          window.firstSequence8Effects = createBattleEffects(document.querySelector('.battle-log-wrap'));
          firstSequence8Effects.sync(Object.fromEntries(units.map(unit => [unit.id, unit])));
        });
        const warmResponse = await warmed;
        assert(warmResponse.ok(), 'the participating Moon artwork is warmed before its first cast');
        await warmResponse.finished();
        const firstCast = await page.evaluate(async () => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const event = { type: 'status', subtype: 'signature', presentationEffect: 'beast_command', actorId: 'caster', ownerId: 'caster', targetId: 'beast' };
          const row = { type: 'turn', actorId: 'caster', abilityId: 'beast_command', ability: 'Beast Command', timeline: [{ type: 'note', event }] };
          firstSequence8Effects.show({ type: 'cast', row, next: row.timeline[0] }, 1, 800); firstSequence8Effects.pause();
          const node = document.querySelector('.gm-combat-sequence8');
          for (const animation of node.getAnimations({ subtree: true })) animation.currentTime = 400;
          const result = { src: node.querySelector('image').getAttribute('href'), opacity: Number(getComputedStyle(node).opacity), targetId: node.dataset.targetId };
          firstSequence8Effects.clear(); return result;
        });
        assert.equal(firstCast.src, warmAsset); assert(firstCast.opacity > .5); assert.equal(firstCast.targetId, 'beast');
        const copiedAsset = data.fx.sequence8Abilities.desire_ignition.asset;
        const copiedWarm = page.waitForResponse(response => new URL(response.url()).pathname === '/' + copiedAsset);
        await page.evaluate(() => firstSequence8Effects.prepare([
          { actorId: 'caster', abilityId: 'record:desire_ignition', sourceAbilityId: 'desire_ignition' }
        ]));
        const copiedResponse = await copiedWarm;
        assert(copiedResponse.ok(), 'a cold copied-source effect is warmed from resolved replay rows');
        await copiedResponse.finished();
        await page.evaluate(async () => {
          await Promise.all(Object.values(G9_DATA.fx.sequence8Abilities).map(async effect => {
            const image = new Image(); image.src = effect.asset; await image.decode();
          }));
        });

        for (const id of ids) {
          const result = await page.evaluate(({ id, speed }) => {
            window.reviewEffects?.clear();
            const wrap = document.querySelector('.battle-log-wrap'), effects = createBattleEffects(wrap); window.reviewEffects = effects;
            effects.sync(Object.fromEntries(units.map(unit => [unit.id, unit])));
            const isUtility = ['provocation', 'bad_luck_curse', 'beast_command'].includes(id);
            const event = id === 'beast_command' ? { type: 'status', subtype: 'signature', presentationEffect: 'beast_command', ownerId: 'caster', actorId: 'caster', targetId: 'beast' }
              : id === 'bad_luck_curse' ? { type: 'story', actorId: 'caster', text: 'A curse is cast.' }
                : id === 'provocation' ? { type: 'status', actorId: 'caster', targetId: 'enemy', text: 'Enemy loses DEF.' }
                  : { type: 'damage', actorId: 'caster', targetId: 'enemy', amount: 40, hpLoss: 40, damageType: 'physical' };
            const row = { type: 'turn', actorId: 'caster', abilityId: id, ability: id.replaceAll('_', ' '), sourcePath: G9_DATA.fx.sequence8Abilities[id].pathway,
              timeline: id === 'bad_luck_curse' ? [] : [{ type: isUtility ? 'note' : 'damage', event }] };
            window.activeSequence8Row = row;
            const playing = { turnRows: [row], currentTurn: 0, eventCount: null };
            effects.show(advanceBattlePresentation(playing), speed, battlePresentationDelay(playing)); effects.pause();
            const node = wrap.querySelector('.gm-combat-sequence8[data-stage="cast"]');
            if (!node) throw new Error('Missing Sequence 8 effect: ' + id);
            const tracks = node.getAnimations({ subtree: true });
            if (!tracks.length) throw new Error('Missing managed effect animation: ' + id);
            const duration = Math.max(...tracks.map(animation => Number(animation.effect.getTiming().duration)));
            for (const animation of wrap.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true })) animation.currentTime = duration * .58;
            const box = node.getBoundingClientRect(), field = wrap.querySelector('.gm-battlefield-canvas').getBoundingClientRect();
            const result = { id, width: innerWidth, speed, duration, rate: tracks[0].playbackRate, castWall: battlePresentationDelay(playing, speed),
              opacity: Number(getComputedStyle(node).opacity), effectWidth: box.width, effectHeight: box.height, fieldWidth: field.width,
              asset: node.dataset.effectSrc, mode: node.dataset.mode, targetId: node.dataset.targetId,
              numberBefore: wrap.querySelector('.gm-battle-fx-number')?.textContent || null,
              impactBefore: !!wrap.querySelector('.gm-combat-sequence8[data-stage="impact"]') };
            effects.setSpeed(speed === 1 ? 2 : 1);
            result.switchedRate = tracks[0].playbackRate; result.pausedAfterSwitch = tracks[0].playState;
            effects.setSpeed(speed);
            return result;
          }, { id, speed });
          assert.equal(result.duration, 800, id + ' has the full cast phase');
          assert.equal(result.rate, speed === 2 ? 1.6 : 1);
          assert.equal(result.castWall, speed === 2 ? 500 : 800);
          assert.equal(result.duration / result.rate, result.castWall);
          assert(result.opacity > .5, id + ' is clearly visible at the readable middle of the cast');
          assert(result.effectWidth >= 24 && result.effectHeight >= 24, id + ' is not reduced to a tiny spark');
          assert(result.effectWidth <= result.fieldWidth * 1.2, id + ' remains readable within the mobile arena');
          assert.equal(result.asset, data.fx.sequence8Abilities[id].asset);
          assert.equal(result.numberBefore, null); assert.equal(result.impactBefore, false);
          assert.equal(result.switchedRate, speed === 1 ? 1.6 : 1);
          assert.equal(result.pausedAfterSwitch, 'paused', 'speed switching must not resume paused animations');
          if (id === 'beast_command') { assert.equal(result.targetId, 'beast'); assert.equal(result.mode, 'support'); }
          if (id === 'bad_luck_curse') assert.equal(result.mode, 'caster');
          if (width === 390) await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `${id}-${speed}x-cast.png`), animations: 'allow' });

          if (!utility.includes(id)) {
            const outcome = await page.evaluate(({ speed }) => {
              const row = activeSequence8Row, event = row.timeline[0].event, before = JSON.stringify(row);
              reviewEffects.show({ type: 'damage', row, event }, speed, 225); reviewEffects.pause();
              const wrap = document.querySelector('.battle-log-wrap'), node = wrap.querySelector('.gm-combat-sequence8[data-stage="impact"]');
              for (const animation of wrap.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true })) animation.currentTime = 90;
              return { targetId: node?.dataset.targetId, id: node?.dataset.abilityId,
                castRemaining: !!wrap.querySelector('.gm-combat-sequence8[data-stage="cast"]'),
                number: wrap.querySelector('.gm-battle-fx-number')?.textContent, unchanged: JSON.stringify(row) === before };
            }, { speed });
            assert.equal(outcome.id, id); assert.equal(outcome.targetId, 'enemy'); assert.equal(outcome.castRemaining, false);
            assert(outcome.number?.includes('40')); assert.equal(outcome.unchanged, true);
          }
          await page.evaluate(() => reviewEffects.clear());
          assert.equal(await page.locator('.gm-combat-fx-layer, .gm-battle-fx-layer, .gm-pathway-fx-layer').count(), 0, 'Skip removes every effect layer');
          assert.deepEqual(errors, []);
          results.push(result); passed++; console.log(`PASS ${width}px ${speed}x ${id}`);
        }

        // Run a real elapsed cast and recorded outcome chain on a phone. This
        // catches a scheduler that shows a complete-looking paused frame while
        // still exposing its damage/status too early during ordinary playback.
        if (width === 390) {
          const chronological = await page.evaluate(async ({ speed }) => {
            const wrap = document.querySelector('.battle-log-wrap'), effects = createBattleEffects(wrap);
            const makeDamage = (critical = false) => ({ type: 'damage', actorId: 'caster', targetId: 'enemy',
              amount: 40, hpLoss: 40, damageType: 'physical', critical });
            const cases = [
              { id: 'raging_blow', timeline: [{ type: 'damage', event: makeDamage(true) }] },
              { id: 'midnight_requiem', timeline: [{ type: 'damage', event: makeDamage() },
                { type: 'note', event: { type: 'status', actorId: 'caster', targetId: 'enemy', status: 'sleep' } }] },
              { id: 'beast_command', timeline: [{ type: 'note', event: { type: 'status', actorId: 'caster', subtype: 'signature', text: 'Spends 100 charge.' } },
                { type: 'note', event: { type: 'status', subtype: 'signature', presentationEffect: 'beast_command', actorId: 'caster', ownerId: 'caster', targetId: 'beast' } },
                { type: 'heal', event: { type: 'heal', actorId: 'caster', targetId: 'beast', amount: 25, hpAfter: 100 } }] },
              { id: 'bad_luck_curse', timeline: [] }
            ];
            const records = [];
            for (const entry of cases) {
              effects.clear(); effects.sync(Object.fromEntries(units.map(unit => [unit.id, unit])));
              const row = { type: 'turn', actorId: 'caster', abilityId: entry.id, ability: entry.id.replaceAll('_', ' '), timeline: entry.timeline };
              const playing = { turnRows: [row], currentTurn: 0, eventCount: null }, start = performance.now(), phases = [];
              while (playing.currentTurn === 0) {
                const cue = advanceBattlePresentation(playing), wall = battlePresentationDelay(playing, speed), base = battlePresentationDelay(playing);
                effects.show(cue, speed, base);
                phases.push({ phase: cue.type, elapsed: performance.now() - start,
                  number: wrap.querySelector('.gm-battle-fx-number')?.textContent || null,
                  critical: wrap.querySelector('.gm-battle-fx-number')?.dataset.critical || null,
                  numberColor: wrap.querySelector('.gm-battle-fx-number')?.style.getPropertyValue('--gm-fx-color') || null,
                  status: !!wrap.querySelector('.gm-combat-status'),
                  commandTarget: wrap.querySelector('[data-effect="beast_command"]')?.dataset.targetId || null,
                  impact: !!wrap.querySelector('.gm-combat-sequence8[data-stage="impact"]'),
                  heal: !!wrap.querySelector('.gm-combat-heal') });
                if (wall > 0) await new Promise(resolve => setTimeout(resolve, wall));
              }
              records.push({ id: entry.id, phases });
            }
            effects.clear(); return records;
          }, { speed });
          for (const result of chronological) {
            assert.equal(result.phases[0].phase, 'cast');
            assert.equal(result.phases[0].number, null); assert.equal(result.phases[0].impact, false);
            assert(result.phases[1].elapsed >= (speed === 2 ? 480 : 780), result.id + ' waits for its complete readable cast');
            assert.equal(result.phases.at(-1).phase, 'settle');
            if (result.id === 'raging_blow') {
              assert.deepEqual(result.phases.map(phase => phase.phase), ['cast', 'damage', 'settle']);
              assert.equal(result.phases[1].critical, 'true'); assert.equal(result.phases[1].numberColor, data.fx.impact.critColor);
            } else if (result.id === 'midnight_requiem') {
              assert.deepEqual(result.phases.map(phase => phase.phase), ['cast', 'damage', 'note', 'settle']);
              assert.equal(result.phases[1].status, false); assert.equal(result.phases[2].status, true);
            } else if (result.id === 'beast_command') {
              assert.deepEqual(result.phases.map(phase => phase.phase), ['cast', 'note', 'note', 'heal', 'settle']);
              assert.equal(result.phases[1].commandTarget, null); assert.equal(result.phases[2].commandTarget, 'beast');
              assert.equal(result.phases[2].heal, false); assert.equal(result.phases[3].heal, true);
              assert(result.phases.every(phase => !phase.impact), 'a command cannot invent an extra attack');
            } else assert.deepEqual(result.phases.map(phase => phase.phase), ['cast', 'settle']);
          }
          results.push({ width, speed, chronological });
        }

        for (const compact of [true, false]) {
          await page.emulateMedia({ reducedMotion: compact ? 'no-preference' : 'reduce' });
          const staticResult = await page.evaluate(({ compact }) => {
            const wrap = document.querySelector('.battle-log-wrap'), effects = createCombatFx(wrap); effects.sync(Object.fromEntries(units.map(unit => [unit.id, unit])));
            const ids = Object.keys(G9_DATA.fx.sequence8Abilities), failures = [];
            for (const id of ids) {
              effects.show({ type: 'cast', row: { actorId: 'caster', abilityId: id, ability: id },
                next: { type: 'damage', event: { actorId: 'caster', targetId: 'enemy', hpLoss: 40 } } }, compact ? 4 : 2, 800);
              const node = wrap.querySelector('.gm-combat-sequence8');
              if (!node || node.dataset.abilityId !== id || node.getAnimations({ subtree: true }).length) failures.push(id);
              effects.clear(); effects.sync(Object.fromEntries(units.map(unit => [unit.id, unit])));
            }
            return failures;
          }, { compact });
          assert.deepEqual(staticResult, [], (compact ? 'compact' : 'reduced') + ' keeps every static ability identity');
        }
      } finally { await page.close(); }
    }
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed, results }, null, 2) + '\n');
  } finally { await browser.close(); }
  console.log(`${passed} Sequence 8 real-browser checks passed.`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
