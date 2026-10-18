// Real Chromium coverage of the shipped artwork using resolved engine events.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { g, world } = require('./phase3-test-helpers');
const loadout = require('../scripts/permanent-asset-loadouts');
const root = path.resolve(__dirname, '..');
const output = process.env.SEQUENCE7_FX_OUTPUT || '/tmp/guild-sequence7-fx';
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = [...html.matchAll(/href="(css\/[^"?]+\.css)/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const data = Object.fromEntries(['contracts', 'fx', 'balance'].map(name => [name, JSON.parse(fs.readFileSync(path.join(root, `data/${name}.json`)))]));
const ids = Object.keys(data.fx.sequence7Abilities);
assert.equal(ids.length, 18);
const directional = ids.filter(id => data.fx.sequence7Abilities[id].mode === 'travel');
const clone = value => JSON.parse(JSON.stringify(value));
const position = transform => transform.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/).slice(1).map(Number);
let passed = 0;

function fixture(id, { enemy = false, fullHP = false, emptyInventory = false } = {}) {
  const spec = data.fx.sequence7Abilities[id], w = world(spec.pathway, 7, enemy ? 'enemies' : 'allies');
  w.u.hp = fullHP ? w.u.maxHp : Math.round(w.u.maxHp * .4);
  if (!fullHP) g.addStatus(w.u, 'poison', 3, 'encounter');
  if (id === 'necromancy_summon') {
    if (!emptyInventory) loadout(g, w.a, 'rare');
    g.initializePathwayBattle(w.state, { kind: 'contract', difficultySequence: 7 }, 9, { day: 1 });
  }
  const snapshot = (unit, team) => ({ id: unit.id, name: unit.name, team,
    path: unit.agent.path, sequence: unit.agent.sequence, hp: unit.hp, maxHp: unit.maxHp,
    sp: unit.agent.sp, maxSP: unit.agent.maxSP, alive: unit.alive, summoned: !!unit.summoned });
  const units = [...w.state.allies.map(unit => snapshot(unit, 'ally')), ...w.state.enemies.map(unit => snapshot(unit, 'enemy'))];
  const ability = g.tierFor(spec.pathway, 7).abilities[0];
  const lines = [];
  g.bindBattle(w.state, lines);
  g.applyStructuredAbility(w.a, w.u, w.v, w.state, lines, () => .99, ability);
  if (id === 'paper_figurine_rebound') g.attackOnce(w.v.agent, w.v, w.u, w.state, [], () => .99);
  const rows = g.groupEventsToRows(w.state.events).flatMap(round => round.rows);
  let row = rows.find(item => item.type === 'turn' && String(item.sourceAbilityId || item.abilityId).split(':').pop() === id);
  if (id === 'necromancy_summon' && emptyInventory) {
    assert.equal(w.state.events.length, 0, 'the live engine rejects an empty-inventory summon');
    row = null;
  } else assert(row, id + ' produces its native cast row');
  const reflectionRow = rows.find(item => item.timeline?.some(step => step.event.isReflect));
  if (fullHP) assert(!row.timeline.some(step => step.type === 'heal'), 'full HP does not invent successful recovery');
  if (id === 'necromancy_summon') {
    assert.equal(w.state.allies.some(unit => unit.summoned), !emptyInventory, 'only an owned prepared spirit can appear');
  }
  g.bindBattle(null);
  return clone({ id, units, row, reflectionRow, eventCount: w.state.events.length });
}
const fixtures = ids.map(id => fixture(id));
const reversed = directional.map(id => fixture(id, { enemy: true }));
const noOutcome = ['flesh_healing', 'harvest_blessing', 'purification_halo', 'peaceful_rest'].map(id => fixture(id, { fullHP: true }));
noOutcome.push(fixture('necromancy_summon', { emptyInventory: true }));

if (process.env.SEQUENCE7_FIXTURES_ONLY === '1') {
  console.log(`${fixtures.length + reversed.length} native engine fixtures and ${noOutcome.length} no-outcome cases are ready.`);
} else (async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  const results = [];
  try {
    for (const width of [320, 390, 1440]) for (const speed of [1, 2]) {
      const page = await browser.newPage({ viewport: { width, height: 1200 } });
      const errors = [], missing = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.route('https://sequence7-fx.test/**', route => {
          const file = path.resolve(root, new URL(route.request().url()).pathname.slice(1));
          if (!file.startsWith(root + path.sep)) return route.abort();
          try { return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } }); }
          catch { missing.push(file); return route.fulfill({ status: 404, body: 'Missing test asset' }); }
        });
        await page.setContent(`<base href="https://sequence7-fx.test/"><style>${styles}</style><main></main>`);
        await page.evaluate(value => { window.G9_DATA = value; window.G9D = value; window.abbrNum = number => String(Math.round(number || 0)); }, data);
        await page.addScriptTag({ content: source });
        const decoded = await page.evaluate(async () => {
          const assets = Object.values(G9_DATA.fx.sequence7Abilities).flatMap(spec => [spec.asset, spec.reflectAsset].filter(Boolean));
          return Promise.all(assets.map(async src => {
            const image = new Image(); image.crossOrigin = 'anonymous'; image.src = src; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, image.width, image.height).data;
            let transparent = 0, opaque = 0;
            for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] === 0) transparent++; if (pixels[i] === 255) opaque++; }
            return { src, width: image.width, height: image.height, transparent, opaque };
          }));
        });
        assert.equal(decoded.length, 19);
        for (const asset of decoded) {
          assert.equal(asset.width, 256); assert.equal(asset.height, 256);
          assert(asset.transparent > 1000 && asset.opaque > 100, asset.src + ' contains isolated visible art and genuine transparent pixels');
        }
        await page.evaluate(() => {
          window.installSequence7Fixture = entry => {
            window.reviewEffects?.clear(); window.activeSequence7Fixture = entry;
            document.querySelector('main').innerHTML = renderBattleLogComponent({
              allies: entry.units.filter(unit => unit.team === 'ally'), enemies: entry.units.filter(unit => unit.team === 'enemy'),
              flattenedRows: [], shownCount: 0, isDone: false, speed: 1, summaryText: '', battlefieldImage: 'data/assets/battlefields/abandoned_market.png'
            });
            layoutBattlefields(document);
            const wrap = document.querySelector('.battle-log-wrap');
            window.reviewEffects = createBattleEffects(wrap);
            reviewEffects.sync(Object.fromEntries(entry.units.map(unit => [unit.id, unit])));
            reviewEffects.prepare([entry.row, entry.reflectionRow].filter(Boolean));
            return wrap;
          };
          window.freezeSequence7 = time => {
            reviewEffects.pause();
            for (const animation of document.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true })) animation.currentTime = time;
          };
        });

        for (const entry of [...fixtures, ...reversed]) {
          const result = await page.evaluate(({ entry, speed }) => {
            const wrap = installSequence7Fixture(entry), row = entry.row, original = JSON.stringify(row);
            const playing = { turnRows: [row], currentTurn: 0, eventCount: null }, cue = advanceBattlePresentation(playing);
            const duration = battlePresentationDuration(playing, speed), rate = battlePresentationRate(playing, speed);
            reviewEffects.show(cue, speed, duration); freezeSequence7(duration * .56);
            const paper = entry.id === 'paper_figurine_rebound';
            const artwork = wrap.querySelector('.gm-combat-sequence7[data-stage="cast"]');
            const node = paper ? wrap.querySelector('.gm-combat-ability-chip') : artwork;
            if (!node) throw new Error('Missing native cast artwork for ' + entry.id);
            const animation = node.getAnimations()[0], frames = animation?.effect.getKeyframes(), box = node.getBoundingClientRect();
            const cast = { id: entry.id, actorTeam: row.actorTeam, width: innerWidth, speed,
              duration, rate, animationDuration: Number(animation?.effect.getTiming().duration), animationRate: animation?.playbackRate,
              opacity: Number(getComputedStyle(node).opacity), asset: node.dataset.effectSrc, targetId: paper ? 'caster' : node.dataset.targetId, hasCastArtwork: !!artwork,
              mode: node.dataset.mode, angle: Number(node.dataset.angleDeg), flowAngle: Number(node.dataset.flowAngleDeg),
              nativeAngle: Number(node.dataset.nativeAngleDeg), fromId: node.dataset.flowFromId, toId: node.dataset.flowToId,
              start: frames?.[0].transform, end: frames?.at(-1).transform,
              effectWidth: box.width, effectHeight: box.height, fieldWidth: wrap.querySelector('.gm-battlefield-canvas').getBoundingClientRect().width,
              prematureNumber: !!wrap.querySelector('.gm-battle-fx-number'), prematureHit: !!wrap.querySelector('.gm-combat-impact') };
            reviewEffects.setSpeed(speed === 1 ? 2 : 1);
            cast.staysPaused = animation?.playState === 'paused'; reviewEffects.setSpeed(speed);
            return { cast, unchanged: JSON.stringify(row) === original };
          }, { entry, speed });
          const cast = result.cast, spec = data.fx.sequence7Abilities[entry.id];
          if (entry.id === 'paper_figurine_rebound') assert.equal(cast.hasCastArtwork, false, 'the guard waits for an actual incoming hit');
          else assert.equal(cast.asset, spec.asset);
          assert.equal(cast.duration, 800); assert.equal(cast.animationDuration, cast.duration); assert.equal(cast.animationRate, cast.rate);
          assert.equal(cast.duration / cast.rate, speed === 2 ? 500 : 800);
          assert(cast.opacity > .5, entry.id + ' remains clearly visible in the middle of the cast');
          assert(cast.effectWidth >= 24 && cast.effectHeight >= (entry.id === 'paper_figurine_rebound' ? 15 : 24), entry.id + ' is readable at phone size');
          assert(cast.effectWidth <= cast.fieldWidth * 1.5, entry.id + ' is bounded to the mobile arena');
          assert.equal(cast.prematureNumber, false); assert.equal(cast.prematureHit, false);
          assert(cast.staysPaused, 'changing speed preserves Pause'); assert(result.unchanged, 'rendering preserves the resolved engine row');
          if (spec.mode === 'travel') {
            assert.equal(cast.fromId, entry.id === 'blood_siphon' ? 'victim' : 'caster');
            assert.equal(cast.toId, entry.id === 'blood_siphon' ? 'caster' : 'victim');
            assert(Math.abs(cast.angle + cast.nativeAngle - cast.flowAngle) < 1e-6, 'artwork heading follows its flight, including native orientation');
            const start = position(cast.start), end = position(cast.end);
            assert(Math.abs(Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI - cast.flowAngle) < 1e-6,
              'the visible PNG travels in the direction encoded by its artwork');
          } else assert.equal(cast.targetId, 'caster', 'native support and caster effects stay on the owner');
          if (width === 390 && (speed === 1 || ['blood_siphon', 'witch_s_curse', 'flesh_healing'].includes(entry.id))) {
            await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `${entry.id}-${entry.row.actorTeam}-${speed}x-cast.png`), animations: 'allow' });
          }

          const outcomes = await page.evaluate(({ entry, speed }) => {
            const wrap = document.querySelector('.battle-log-wrap'), row = activeSequence7Fixture.row, before = JSON.stringify(row), results = [];
            for (let index = 0; index < row.timeline.length; index++) {
              const step = row.timeline[index], event = step.event;
              const playing = { turnRows: [row], currentTurn: 0, eventCount: index + 1 };
              const duration = battlePresentationDuration(playing, speed);
              reviewEffects.show({ ...step, row }, speed, duration); freezeSequence7(duration * .45);
              const art = wrap.querySelector('.gm-combat-sequence7[data-stage="impact"]');
              const support = wrap.querySelector('.gm-combat-sequence7[data-stage="support"]');
              const positive = isPositiveSupportEvent(event, row), rate = battlePresentationRate(playing, speed);
              results.push({ type: step.type, targetId: event.targetId, healTarget: wrap.querySelector('.gm-combat-heal')?.dataset.targetId,
                shieldTarget: wrap.querySelector('.gm-combat-shield')?.dataset.targetId,
                hitTarget: wrap.querySelector('.gm-combat-impact')?.dataset.targetId, number: wrap.querySelector('.gm-battle-fx-number')?.textContent,
                positive, duration, rate, supportTarget: support?.dataset.targetId, supportOpacity: support ? Number(getComputedStyle(support).opacity) : null,
                supportDuration: support?.getAnimations()[0]?.effect.getTiming().duration,
                supportRate: support?.getAnimations()[0]?.playbackRate,
                art: art ? { targetId: art.dataset.targetId, damageTargetId: art.dataset.damageTargetId,
                  angle: Number(art.dataset.angleDeg), flowAngle: Number(art.dataset.flowAngleDeg), fromId: art.dataset.flowFromId, toId: art.dataset.flowToId,
                  start: art.getAnimations()[0]?.effect.getKeyframes()[0].transform } : null });
            }
            return { results, unchanged: JSON.stringify(row) === before };
          }, { entry, speed });
          assert(outcomes.unchanged);
          for (const outcome of outcomes.results) {
            if (outcome.positive) {
              assert.equal(outcome.duration, 600); assert.equal(outcome.duration / outcome.rate, speed === 2 ? 400 : 600);
              if (spec.mode !== 'travel' && entry.id !== 'paper_figurine_rebound') {
                assert.equal(outcome.supportTarget, outcome.targetId); assert(outcome.supportOpacity >= .99);
                assert.equal(outcome.supportDuration, 600); assert.equal(outcome.supportRate, outcome.rate);
              }
            }
            if (outcome.type === 'damage') {
              assert.equal(outcome.hitTarget, outcome.targetId, 'hit cue stays on the engine damage recipient'); assert(outcome.number);
              if (spec.mode === 'travel') {
                assert(outcome.art, entry.id + ' retains its identity at arrival');
                assert.equal(outcome.art.angle, cast.angle); assert.equal(outcome.art.fromId, cast.fromId); assert.equal(outcome.art.toId, cast.toId);
                assert.deepEqual(position(outcome.art.start), position(cast.end), 'impact remains at the end of the travel path');
                assert.equal(outcome.art.targetId, entry.id === 'blood_siphon' ? 'caster' : outcome.targetId);
                if (entry.id === 'blood_siphon') assert.equal(outcome.art.damageTargetId, outcome.targetId);
              }
            }
            if (outcome.type === 'heal') assert.equal(outcome.healTarget, outcome.targetId, 'only actual healing produces a recovery cue');
            if (outcome.type === 'shield') assert.equal(outcome.shieldTarget, outcome.targetId);
          }
          if (width === 390 && ['flesh_healing', 'wind_step', 'dawn_shield', 'necromancy_summon', 'harvest_blessing'].includes(entry.id)) {
            await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `${entry.id}-${speed}x-result.png`), animations: 'allow' });
          }
          await page.evaluate(() => reviewEffects.clear());
          assert.equal(await page.locator('.gm-combat-fx-layer, .gm-battle-fx-layer, .gm-pathway-fx-layer').count(), 0, 'Skip removes every effect layer');
          results.push({ ...cast, outcomes: outcomes.results }); passed++;
          console.log(`PASS ${width}px ${speed}x ${entry.id} (${entry.row.actorTeam})`);
        }

        for (const entry of noOutcome) {
          const result = await page.evaluate(({ entry, speed }) => {
            const wrap = installSequence7Fixture(entry), row = entry.row;
            const rows = row ? [{ type: 'cast', row, next: row.timeline[0] }, ...row.timeline.map(step => ({ ...step, row }))] : [];
            let falseHealing = false, falseCompanion = false, falseSummonArt = false;
            for (const cue of rows) {
              reviewEffects.show(cue, speed, 800);
              falseHealing ||= !!wrap.querySelector('.gm-combat-heal');
              falseCompanion ||= !!wrap.querySelector('.gm-arena-unit[data-companion-kind="spirit"]');
              if (entry.id === 'necromancy_summon') falseSummonArt ||= !!wrap.querySelector('.gm-combat-sequence7');
            }
            reviewEffects.clear(); return { falseHealing, falseCompanion, falseSummonArt };
          }, { entry, speed });
          assert.equal(result.falseHealing, false, 'a full-HP cast cannot invent a heal result');
          assert.equal(result.falseCompanion, false, 'an empty Death inventory cannot invent a spirit'); passed++;
          assert.equal(result.falseSummonArt, false, 'an empty Death inventory cannot show a successful summon PNG');
        }

        const paper = fixtures.find(entry => entry.id === 'paper_figurine_rebound');
        const reflection = await page.evaluate(({ entry, speed }) => {
          const wrap = installSequence7Fixture(entry), row = entry.reflectionRow;
          const triggering = row.timeline.find(item => item.event.paperReboundOwnerId != null);
          if (!triggering) throw new Error('The real ward hit lacks its presentation marker');
          reviewEffects.show({ ...triggering, row }, speed, 600); freezeSequence7(300);
          const guard = wrap.querySelector('.gm-combat-sequence7[data-stage="guard"]');
          const guardResult = { src: guard?.dataset.effectSrc, targetId: guard?.dataset.targetId,
            opacity: guard ? Number(getComputedStyle(guard).opacity) : 0,
            prematureFire: !!wrap.querySelector('.gm-combat-sequence7[data-stage="reflect"]') };
          const step = row.timeline.find(item => item.event.isReflect);
          reviewEffects.show({ ...step, row }, speed, 600); freezeSequence7(300);
          const node = wrap.querySelector('.gm-combat-sequence7[data-stage="reflect"]');
          const result = { src: node?.dataset.effectSrc, ownerId: node?.dataset.ownerId,
            fromId: node?.dataset.flowFromId, toId: node?.dataset.flowToId, targetId: node?.dataset.targetId,
            hitTarget: wrap.querySelector('.gm-combat-impact')?.dataset.targetId, guard: guardResult,
            guardRemaining: !!wrap.querySelector('.gm-combat-sequence7[data-stage="guard"]') };
          reviewEffects.clear();
          const other = { ...step.event, sourceAbilityId: 'other_ward' };
          reviewEffects.show({ ...step, row, event: other }, speed, 500);
          result.unrelatedFire = !!wrap.querySelector('.gm-combat-sequence7[data-stage="reflect"]'); reviewEffects.clear();
          return result;
        }, { entry: paper, speed });
        assert.equal(reflection.src, data.fx.sequence7Abilities.paper_figurine_rebound.reflectAsset);
        assert.equal(reflection.guard.src, data.fx.sequence7Abilities.paper_figurine_rebound.asset);
        assert.equal(reflection.guard.targetId, 'caster'); assert(reflection.guard.opacity > .99);
        assert.equal(reflection.guard.prematureFire, false); assert.equal(reflection.guardRemaining, false);
        assert.equal(reflection.ownerId, 'caster'); assert.equal(reflection.fromId, 'caster'); assert.equal(reflection.toId, 'victim');
        assert.equal(reflection.targetId, 'victim'); assert.equal(reflection.hitTarget, 'victim'); assert.equal(reflection.unrelatedFire, false); passed++;
        if (width === 390) for (const stage of ['guard', 'reflect']) {
          await page.evaluate(({ entry, speed, stage }) => {
            installSequence7Fixture(entry);
            const row = entry.reflectionRow, step = row.timeline.find(item => stage === 'guard'
              ? item.event.paperReboundOwnerId != null : item.event.isReflect);
            reviewEffects.show({ ...step, row }, speed, 600); freezeSequence7(340);
          }, { entry: paper, speed, stage });
          await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `paper-figurine-rebound-${stage}-${speed}x.png`), animations: 'allow' });
          await page.evaluate(() => reviewEffects.clear());
        }

        for (const compact of [true, false]) {
          await page.emulateMedia({ reducedMotion: compact ? 'no-preference' : 'reduce' });
          const staticResult = await page.evaluate(({ entries, compact }) => {
            const failures = [];
            for (const entry of entries) {
              const wrap = installSequence7Fixture(entry), row = entry.row;
              // Inspect the FX layer only; the separate character cue controller
              // can use its existing reduced positional motion policy.
              reviewEffects.clear();
              const effects = createCombatFx(wrap); effects.sync(Object.fromEntries(entry.units.map(unit => [unit.id, unit])));
              effects.show({ type: 'cast', row, next: row.timeline[0] }, compact ? 4 : 2, 800);
              const node = wrap.querySelector('.gm-combat-sequence7');
              if (entry.id === 'paper_figurine_rebound' ? !!node : !node || node.dataset.abilityId !== entry.id || node.getAnimations({ subtree: true }).length) failures.push(entry.id);
              for (const step of row.timeline.filter(step => ['heal', 'shield'].includes(step.type) || step.event.beneficial)) {
                effects.show({ ...step, row }, compact ? 4 : 2, 600);
                const result = wrap.querySelector('.gm-combat-sequence7[data-stage="support"]');
                if (G9_DATA.fx.sequence7Abilities[entry.id].mode !== 'travel' && entry.id !== 'paper_figurine_rebound'
                  && (!result || result.getAnimations({ subtree: true }).length)) failures.push(entry.id + ':' + step.type);
              }
              effects.clear();
            }
            return failures;
          }, { entries: fixtures, compact });
          assert.deepEqual(staticResult, [], (compact ? '4x compact' : 'reduced motion') + ' keeps the static ability identity'); passed += ids.length;
        }
        assert.deepEqual(errors, []); assert.deepEqual(missing, []);
      } finally { await page.close(); }
    }
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed, results }, null, 2) + '\n');
  } finally { await browser.close(); }
  console.log(`${passed} Sequence 7 real-browser checks passed.`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
