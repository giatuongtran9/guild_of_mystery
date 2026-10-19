// Real Chromium coverage using native engine casts, not fabricated combat results.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { g, world } = require('./phase3-test-helpers');
const root = path.resolve(__dirname, '..');
const output = process.env.SEQUENCE5_FX_OUTPUT || '/tmp/guild-sequence5-fx';
const source = fs.readFileSync(process.env.SEQUENCE5_UI_SOURCE || path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = [...html.matchAll(/href="(css\/[^"?]+\.css)/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const data = Object.fromEntries(['contracts', 'fx', 'balance'].map(name => [name, JSON.parse(fs.readFileSync(path.join(root, `data/${name}.json`)))]));
const ids = Object.keys(data.fx.sequence5Abilities || {});
const directional = ['law_enforcement', 'holy_sun_bolt', 'ocean_calling', 'thread_binding', 'soul_drain'];
const screenshots = ['thread_binding', 'blink_strike', 'life_bloom', 'ocean_calling'];
assert.equal(ids.length, 20);
assert(!ids.includes('iron_blood_vigor') && !ids.includes('reset_fate'), 'passive ranks do not acquire active effects');
let passed = 0;

function fixture(id, side = 'allies') {
  const spec = data.fx.sequence5Abilities[id], w = world(spec.pathway, 5, side);
  w.u.hp = Math.round(w.u.maxHp * .4); g.addStatus(w.u, 'poison', 3, 'encounter');
  const snapshot = (unit, team) => ({ id: unit.id, name: unit.name, team, path: unit.agent.path,
    sequence: unit.agent.sequence, hp: unit.hp, maxHp: unit.maxHp, sp: unit.agent.sp, maxSP: unit.agent.maxSP, alive: unit.alive });
  const units = [...w.state.allies.map(unit => snapshot(unit, 'ally')), ...w.state.enemies.map(unit => snapshot(unit, 'enemy'))];
  g.bindBattle(w.state, []);
  try {
    if (id === 'thread_binding') {
      for (const ability of g.activeSpecs(w.a)) if (ability.effectId !== id) w.a.cooldowns[ability.effectId] = 99;
      assert(g.powerEffect(w.a, w.u, w.v, w.state, [], () => .99));
    } else assert(g.applyStructuredAbility(w.a, w.u, w.v, w.state, [], () => .99, g.tierFor(spec.pathway, 5).abilities[0]));
    const row = g.groupEventsToRows(w.state.events).flatMap(round => round.rows)
      .find(item => item.type === 'turn' && String(item.sourceAbilityId || item.abilityId).split(':').pop() === id);
    assert(row, id + ' produces a native cast row');
    if (['corrupted_flesh', 'logic_distortion'].includes(id)) {
      assert.equal(row.presentationTargetId, w.v.id, id + ' retains its actual intended enemy for presentation');
      assert.equal(row.targetId, undefined, 'presentation metadata must not change legacy replay target selection');
    }
    return JSON.parse(JSON.stringify({ id, units, row }));
  } finally { g.bindBattle(null); }
}
const fixtures = ids.map(id => fixture(id));
const reversed = directional.map(id => fixture(id, 'enemies'));
const closeAngle = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < .05;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  const results = [];
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1200 } });
      const errors = [], missing = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.route('https://sequence5-fx.test/**', route => {
          const file = path.resolve(root, new URL(route.request().url()).pathname.slice(1));
          if (!file.startsWith(root + path.sep)) return route.abort();
          try { return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream',
            headers: { 'Access-Control-Allow-Origin': '*' } }); }
          catch { missing.push(file); return route.fulfill({ status: 404, body: 'Missing test asset' }); }
        });
        await page.setContent(`<base href="https://sequence5-fx.test/"><style>${styles}</style><main></main>`);
        await page.evaluate(value => { window.G9_DATA = value; window.G9D = value; window.abbrNum = number => String(Math.round(number || 0)); }, data);
        await page.addScriptTag({ content: source });
        const decoded = await page.evaluate(async () => Promise.all(Object.values(G9_DATA.fx.sequence5Abilities)
          .flatMap(spec => [spec.asset, spec.secondaryAsset].filter(Boolean)).map(async src => {
            const image = new Image(); image.crossOrigin = 'anonymous'; image.src = src; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, image.width, image.height).data;
            let transparent = 0, visible = 0;
            for (let i = 3; i < pixels.length; i += 4) { if (!pixels[i]) transparent++; if (pixels[i] > 0) visible++; }
            return { src, width: image.width, height: image.height, transparent, visible };
          })));
        assert.equal(decoded.length, 24);
        for (const asset of decoded) {
          assert.equal(asset.width, 256); assert.equal(asset.height, 256);
          assert(asset.transparent > 1000 && asset.visible > 100, asset.src + ' is visible isolated art with genuine transparency');
        }
        await page.evaluate(() => {
          window.installSequence5Fixture = entry => {
            window.reviewEffects?.clear(); window.activeSequence5Fixture = entry;
            document.querySelector('main').innerHTML = renderBattleLogComponent({ allies: entry.units.filter(unit => unit.team === 'ally'),
              enemies: entry.units.filter(unit => unit.team === 'enemy'), flattenedRows: [], shownCount: 0, isDone: false,
              speed: 1, summaryText: '', battlefieldImage: 'data/assets/battlefields/abandoned_market.png' });
            layoutBattlefields(document);
            const wrap = document.querySelector('.battle-log-wrap'); window.reviewEffects = createBattleEffects(wrap);
            reviewEffects.sync(Object.fromEntries(entry.units.map(unit => [unit.id, unit]))); return wrap;
          };
          window.freezeSequence5 = time => {
            reviewEffects.pause();
            for (const animation of document.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true })) animation.currentTime = time;
          };
        });
        for (const entry of [...fixtures, ...reversed]) {
          const cast = await page.evaluate(entry => {
            const wrap = installSequence5Fixture(entry), row = entry.row, before = JSON.stringify(row);
            const playing = { turnRows: [row], currentTurn: 0, eventCount: null };
            reviewEffects.show(advanceBattlePresentation(playing), 1, battlePresentationDelay(playing)); freezeSequence5(464);
            const node = wrap.querySelector('.gm-combat-sequence5[data-stage="cast"]');
            if (!node) throw new Error('Missing Sequence 5 cast: ' + entry.id);
            const tracks = node.getAnimations({ subtree: true }), matrix = new DOMMatrix(getComputedStyle(node).transform);
            const point = id => { const box = wrap.querySelector(`[data-unit-id="${id}"] .gm-unit-sprite-anchor`).getBoundingClientRect();
              return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
            const actor = point(row.actorId), victim = point('victim'), reverse = entry.id === 'soul_drain';
            const expected = Math.atan2((reverse ? actor.y - victim.y : victim.y - actor.y), (reverse ? actor.x - victim.x : victim.x - actor.x)) * 180 / Math.PI;
            const secondary = wrap.querySelector('.gm-combat-sequence5[data-stage="cast-secondary"]');
            const frames = tracks[0]?.effect.getKeyframes();
            const result = { id: entry.id, width: innerWidth, team: row.actorTeam, asset: node.dataset.effectSrc,
              targetId: node.dataset.targetId, secondaryTargetId: secondary?.dataset.targetId, secondaryAsset: secondary?.dataset.effectSrc,
              duration: tracks[0]?.effect.getTiming().duration, opacity: Number(getComputedStyle(node).opacity),
              boxWidth: node.getBoundingClientRect().width, boxHeight: node.getBoundingClientRect().height,
              angle: Number(node.dataset.angleDeg), renderedAngle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, expected,
              flow: node.dataset.flowDirection, flightPath: node.dataset.flightPath,
              frames: frames?.map(frame => frame.transform),
              numberBefore: wrap.querySelector('.gm-battle-fx-number')?.textContent || null,
              outcomeBefore: !!wrap.querySelector('.gm-combat-sequence5[data-stage="impact"], .gm-combat-sequence5[data-stage="outcome"]'),
              healingBefore: !!wrap.querySelector('.gm-combat-heal'), unchanged: JSON.stringify(row) === before };
            reviewEffects.setSpeed(2); result.switchedRate = tracks[0]?.playbackRate; result.pausedAfterSwitch = tracks[0]?.playState;
            reviewEffects.setSpeed(1); return result;
          }, entry);
          const spec = data.fx.sequence5Abilities[entry.id];
          assert.equal(cast.asset, spec.asset); assert.equal(cast.duration, 800);
          assert(cast.opacity > .5 && cast.boxWidth >= 12 && cast.boxHeight >= 12, entry.id + ' is visible at real arena size');
          assert.equal(cast.numberBefore, null); assert.equal(cast.outcomeBefore, false); assert.equal(cast.healingBefore, false);
          assert(cast.unchanged); assert.equal(cast.switchedRate, 1.6); assert.equal(cast.pausedAfterSwitch, 'paused');
          if (spec.secondaryAsset) {
            assert.equal(cast.secondaryAsset, spec.secondaryAsset);
            assert.equal(cast.secondaryTargetId, entry.id === 'corrupted_flesh' ? 'victim' : 'caster');
          }
          if (['desire_control', 'logic_distortion', ...directional].includes(entry.id)) assert.equal(cast.targetId, 'victim');
          if (directional.includes(entry.id)) {
            assert(closeAngle(cast.angle, cast.expected) && closeAngle(cast.renderedAngle, cast.expected), entry.id + ' rendered art faces its real flow direction');
            assert.equal(cast.flow, entry.id === 'soul_drain' ? 'target-to-caster' : 'caster-to-target');
            if (entry.id === 'thread_binding') {
              assert.equal(cast.flightPath, 'stationary-attacker-to-target-span');
              const positions = cast.frames.map(frame => frame.match(/translate\([^)]*\)/)[0]);
              assert(positions.every(position => position === positions[0]), 'threads span the units without firing as a projectile');
            } else assert.notEqual(cast.frames[0], cast.frames.at(-1));
          }
          if (screenshots.includes(entry.id) && entry.row.actorTeam === 'ally') {
            await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `${entry.id}-${width}px.png`), animations: 'allow' });
          }
          const outcomes = await page.evaluate(entry => {
            const wrap = document.querySelector('.battle-log-wrap'), row = entry.row, before = JSON.stringify(row), outcomes = [];
            for (const step of row.timeline) {
              reviewEffects.show({ ...step, row }, 1, 500); freezeSequence5(180);
              const art = wrap.querySelector('.gm-combat-sequence5[data-stage="impact"], .gm-combat-sequence5[data-stage="outcome"]');
              outcomes.push({ type: step.type, eventType: step.event.type, targetId: step.event.targetId,
                number: wrap.querySelector('.gm-battle-fx-number')?.textContent || null, artTargetId: art?.dataset.targetId,
                artStage: art?.dataset.stage, artAsset: art?.dataset.effectSrc, healing: !!wrap.querySelector('.gm-combat-heal') });
            }
            reviewEffects.clear(); return { outcomes, unchanged: JSON.stringify(row) === before,
              leftovers: wrap.querySelectorAll('.gm-combat-fx-layer, .gm-battle-fx-layer, .gm-pathway-fx-layer').length };
          }, entry);
          assert(outcomes.unchanged); assert.equal(outcomes.leftovers, 0);
          for (const outcome of outcomes.outcomes) {
            if (outcome.artTargetId) assert.equal(outcome.artTargetId, outcome.targetId, 'only the recorded recipient gets the outcome');
            if (outcome.type === 'damage') { assert(outcome.number); assert.equal(outcome.artStage, 'impact'); }
            if (entry.id === 'soul_drain') assert.equal(outcome.healing, false, 'SP extraction never invents HP recovery');
          }
          results.push({ cast, outcomes: outcomes.outcomes }); passed++;
        }
        const controls = await page.evaluate(async entry => {
          const wrap = installSequence5Fixture(entry), row = entry.row;
          reviewEffects.show({ type: 'cast', row, next: row.timeline[0] }, 1, 800); freezeSequence5(464);
          const track = wrap.querySelector('.gm-combat-sequence5').getAnimations()[0];
          await new Promise(resolve => setTimeout(resolve, 60));
          const time = track.currentTime; reviewEffects.setSpeed(2);
          const paused = track.playState; reviewEffects.resume(); const resumed = track.playState; reviewEffects.clear();
          // Ambient CSS (for example a unit marker) may continue after Skip;
          // the managed cast clock and its effect surfaces must be removed.
          return { time, paused, resumed, clearedTrack: track.playState,
            layers: wrap.querySelectorAll('.gm-combat-fx-layer, .gm-battle-fx-layer, .gm-pathway-fx-layer').length };
        }, fixtures.find(entry => entry.id === 'ocean_calling'));
        assert.equal(controls.time, 464); assert.equal(controls.paused, 'paused'); assert.equal(controls.resumed, 'running');
        assert.equal(controls.clearedTrack, 'idle'); assert.equal(controls.layers, 0);
        for (const compact of [false, true]) {
          await page.emulateMedia({ reducedMotion: compact ? 'no-preference' : 'reduce' });
          const failures = await page.evaluate(({ entries, compact }) => entries.flatMap(entry => {
            const wrap = installSequence5Fixture(entry);
            reviewEffects.show({ type: 'cast', row: entry.row, next: entry.row.timeline[0] }, compact ? 4 : 2, 800);
            const node = wrap.querySelector('.gm-combat-sequence5[data-stage="cast"]');
            const failed = !node || Number(getComputedStyle(node).opacity) < .5 || node.getAnimations({ subtree: true }).length;
            reviewEffects.clear(); return failed ? [entry.id] : [];
          }), { entries: fixtures, compact });
          assert.deepEqual(failures, [], (compact ? 'compact' : 'reduced-motion') + ' preserves every static effect without animation');
        }
        assert.deepEqual(errors, []); assert.deepEqual(missing, []);
        console.log(`PASS ${width}px: 20 native casts, five reversed flows, outcomes and playback controls`);
      } finally { await page.close(); }
    }
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed, results }, null, 2) + '\n');
  } finally { await browser.close(); }
  console.log(`${passed} Sequence 5 real-browser checks passed.`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
