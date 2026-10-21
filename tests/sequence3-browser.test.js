// Exercise the shared renderer with native Sequence 3 casts and real outcomes.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { g, world } = require('./phase3-test-helpers');
const root = path.resolve(__dirname, '..');
const output = process.env.SEQUENCE3_FX_OUTPUT || '/tmp/guild-sequence3-fx';
const source = fs.readFileSync(process.env.SEQUENCE3_UI_SOURCE || path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = [...html.matchAll(/href="(css\/[^"?]+\.css)/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const data = Object.fromEntries(['contracts', 'fx', 'balance'].map(name => [name, JSON.parse(fs.readFileSync(path.join(root, `data/${name}.json`)))]));
const ids = Object.keys(data.fx.sequence3Abilities || {});
assert.equal(ids.length, 20, 'every newly unlocked Sequence 3 active ability has PNG metadata');
const reflected = new Set(['deceive_impact', 'flesh_mutation', 'thunder_god_stance']);
const damaged = new Set(['concealment_realm', 'despair_thread', 'energy_cannon', 'exorcism_charter', 'dream_prison']);
const closeAngle = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < .05;
function fixture(id, side) {
  const spec = data.fx.sequence3Abilities[id], w = world(spec.pathway, 3, side);
  w.u.hp = Math.round(w.u.maxHp * .4);
  const snapshot = (unit, team) => ({ id: unit.id, name: unit.name, team, path: unit.agent.path,
    sequence: unit.agent.sequence, hp: unit.hp, maxHp: unit.maxHp, sp: unit.agent.sp, maxSP: unit.agent.maxSP, alive: unit.alive });
  const units = [...w.state.allies.map(unit => snapshot(unit, 'ally')), ...w.state.enemies.map(unit => snapshot(unit, 'enemy'))];
  g.bindBattle(w.state, []);
  try {
    assert(g.applyStructuredAbility(w.a, w.u, w.v, w.state, [], () => .99, g.tierFor(spec.pathway, 3).abilities[0]));
    const rows = () => g.groupEventsToRows(w.state.events).flatMap(round => round.rows);
    const row = rows().find(item => item.type === 'turn' && String(item.sourceAbilityId || item.abilityId).split(':').pop() === id);
    assert(row, id + ' produces a native cast row');
    const castEnd = w.state.events.length;
    if (reflected.has(id)) {
      assert(g.applyStructuredAbility(w.b, w.v, w.u, w.state, [], () => .99, g.tierFor('fool', 8).abilities[0]));
    }
    const lateEvents = w.state.events.slice(castEnd), late = [];
    for (const event of lateEvents) {
      const action = rows().find(item => (item.timeline || []).some(step => JSON.stringify(step.event) === JSON.stringify(event)));
      late.push({ type: event.type, event, row: action || row });
    }
    if (reflected.has(id)) assert(lateEvents.some(event => event.isReflect && event.sourceAbilityId === id), id + ' really reflects a later incoming hit');
    assert.equal(w.state.allies.length + w.state.enemies.length, 4, 'cast does not invent summoned units');
    const basic = rows().find(item => item.abilityId === 'basic_attack' && item.actorId === row.actorId);
    return JSON.parse(JSON.stringify({ id, units, row, late, basic }));
  } finally { g.bindBattle(null); }
}
const fixtures = ['allies', 'enemies'].flatMap(side => ids.map(id => fixture(id, side)));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  const results = [];
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1200 } }), errors = [], missing = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.route('https://sequence3-fx.test/**', route => {
          const file = path.resolve(root, new URL(route.request().url()).pathname.slice(1));
          if (!file.startsWith(root + path.sep)) return route.abort();
          try { return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } }); }
          catch { missing.push(file); return route.fulfill({ status: 404, body: 'Missing test asset' }); }
        });
        await page.setContent(`<base href="https://sequence3-fx.test/"><style>${styles}</style><main></main>`);
        await page.evaluate(value => { window.G9_DATA = value; window.G9D = value; window.abbrNum = number => String(Math.round(number || 0)); }, data);
        await page.addScriptTag({ content: source });
        const decoded = await page.evaluate(async () => Promise.all(Object.values(G9_DATA.fx.sequence3Abilities)
          .flatMap(spec => [spec.asset, spec.secondaryAsset].filter(Boolean)).map(async src => {
            const image = new Image(); image.crossOrigin = 'anonymous'; image.src = src; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, image.width, image.height).data;
            let transparent = 0, visible = 0;
            for (let i = 3; i < pixels.length; i += 4) { if (!pixels[i]) transparent++; if (pixels[i] > 0) visible++; }
            return { src, width: image.width, height: image.height, transparent, visible };
          })));
        assert.equal(decoded.length, 21);
        for (const asset of decoded) {
          assert.equal(asset.width, 256); assert.equal(asset.height, 256);
          assert(asset.transparent > 1000 && asset.visible > 100, asset.src + ' has visible art and true transparency');
        }
        await page.evaluate(() => {
          window.installFixture = entry => {
            window.reviewEffects?.clear();
            document.querySelector('main').innerHTML = renderBattleLogComponent({ allies: entry.units.filter(unit => unit.team === 'ally'),
              enemies: entry.units.filter(unit => unit.team === 'enemy'), flattenedRows: [], shownCount: 0, isDone: false,
              speed: 1, summaryText: '', battlefieldImage: 'data/assets/battlefields/abandoned_market.png' });
            layoutBattlefields(document);
            const wrap = document.querySelector('.battle-log-wrap'); window.reviewEffects = createBattleEffects(wrap);
            reviewEffects.sync(Object.fromEntries(entry.units.map(unit => [unit.id, unit]))); return wrap;
          };
          window.freezeFx = time => {
            reviewEffects.pause();
            for (const animation of document.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true })) animation.currentTime = time;
          };
        });
        for (const entry of fixtures) {
          const cast = await page.evaluate(entry => {
            const wrap = installFixture(entry), row = entry.row, before = JSON.stringify(entry);
            const playing = { turnRows: [row], currentTurn: 0, eventCount: null };
            const cue = advanceBattlePresentation(playing), hold = battlePresentationDelay(playing);
            reviewEffects.show(cue, 1, hold); freezeFx(370);
            const nodes = [...wrap.querySelectorAll('.gm-combat-sequence3[data-stage="cast"]')];
            if (!nodes.length) throw new Error('Missing Sequence 3 cast: ' + entry.id);
            const actorBox = wrap.querySelector(`[data-unit-id="${row.actorId}"] .gm-unit-sprite-anchor`).getBoundingClientRect();
            const art = [...wrap.querySelectorAll('.gm-combat-sequence3')].map(node => {
              const tracks = node.getAnimations({ subtree: true }), matrix = new DOMMatrix(getComputedStyle(node).transform);
              const target = wrap.querySelector(`[data-unit-id="${node.dataset.targetId}"] .gm-unit-sprite-anchor`).getBoundingClientRect();
              return { targetId: node.dataset.targetId, asset: node.dataset.effectSrc, ownerId: node.dataset.ownerId, stage: node.dataset.stage,
                duration: tracks[0]?.effect.getTiming().duration, opacity: Number(getComputedStyle(node).opacity),
                offsets: tracks[0]?.effect.getKeyframes().map(frame => frame.offset),
                angle: Number(node.dataset.angleDeg), renderedAngle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
                expected: Math.atan2(target.y - actorBox.y, target.x - actorBox.x) * 180 / Math.PI,
                flow: node.dataset.flowDirection, width: Number(node.dataset.effectWidth), height: Number(node.dataset.effectHeight), spriteHeight: target.height };
            });
            const firstTrack = nodes[0].getAnimations()[0]; reviewEffects.setSpeed(2);
            const switchedRate = firstTrack?.playbackRate, pausedAfterSwitch = firstTrack?.playState; reviewEffects.setSpeed(1);
            return { art, hold, switchedRate, pausedAfterSwitch, unchanged: JSON.stringify(entry) === before,
              outcomes: wrap.querySelectorAll('.gm-battle-fx-number, .gm-combat-heal, .gm-combat-sequence3[data-stage="impact"], .gm-combat-sequence3[data-stage="outcome"]').length,
              olderCastDuration: readableCastDuration({ type: 'turn', abilityId: 'unshadowed_execution', actorId: row.actorId }) };
          }, entry);
          const spec = data.fx.sequence3Abilities[entry.id];
          assert(cast.unchanged); assert.equal(cast.outcomes, 0); assert.equal(cast.hold, 1250); assert.equal(cast.olderCastDuration, 800);
          assert.equal(cast.switchedRate, 1.6); assert.equal(cast.pausedAfterSwitch, 'paused');
          for (const art of cast.art) {
            assert.equal(art.ownerId, 'caster'); assert.equal(art.duration, 1250);
            assert(art.opacity > .5 && art.width > 10 && art.height > 10, entry.id + ' visible native cast');
            const olderFrame = art.spriteHeight * 2 * 1.14;
            const ideal = olderFrame * (spec.mode === 'travel' && art.stage === 'cast' ? 108 / 92 : 120 / 104);
            assert(art.width > olderFrame && art.width <= ideal + .01, `relative Sequence4 upgrade, bounded by visible canvas: ${entry.id} ${entry.row.actorTeam} ${width}px ${art.stage} size=${art.width}, ideal=${ideal}`);
            for (const offset of [.224, .368, .768]) assert(art.offsets.some(value => Math.abs(value - offset) < 1e-5), 'four-phase boundary ' + offset);
            if (spec.mode === 'travel' && art.stage === 'cast') {
              assert(closeAngle(art.angle, art.expected) && closeAngle(art.renderedAngle, art.expected), entry.id + ' follows its actual recipient');
              assert.equal(art.flow, 'caster-to-target');
            }
          }
          const primary = cast.art.filter(art => art.stage === 'cast');
          if (['chaos_field', 'chaos_probability'].includes(entry.id))
            assert.deepEqual(primary.map(art => art.targetId).sort(), ['other', 'victim'], 'every real misfire recipient gets application art');
          if (entry.id === 'war_command') assert.deepEqual(primary.map(art => art.targetId).sort(), ['ally', 'caster'], 'every living supported ally gets command art');
          if (spec.mode === 'caster' && entry.id !== 'war_command') assert.deepEqual(primary.map(art => art.targetId), ['caster']);
          if (entry.id === 'underworld_domain') assert.deepEqual(primary.map(art => art.targetId), ['victim'], 'domain remains a single-target effect');
          if (entry.id === 'concealment_realm') {
            assert.equal(primary[0].targetId, 'victim');
            assert(cast.art.some(art => art.stage === 'cast-secondary' && art.targetId === 'caster' && art.asset === spec.secondaryAsset));
          }
          if (['historical_summoning', 'concealment_realm', 'energy_cannon', 'war_command', 'chaos_field'].includes(entry.id) && entry.row.actorTeam === 'ally')
            await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `${entry.id}-${width}px.png`), animations: 'allow' });
          const outcomes = await page.evaluate(entry => {
            const wrap = document.querySelector('.battle-log-wrap'), before = JSON.stringify(entry), frames = [];
            for (const step of [...(entry.row.timeline || []).map(step => ({ ...step, row: entry.row })), ...entry.late]) {
              reviewEffects.show(step, 1, 500); freezeFx(180);
              frames.push({ event: step.event, art: [...wrap.querySelectorAll('.gm-combat-sequence3')].map(node => ({ targetId: node.dataset.targetId,
                ownerId: node.dataset.ownerId, stage: node.dataset.stage, asset: node.dataset.effectSrc, flow: node.dataset.flowDirection })),
                number: wrap.querySelector('.gm-battle-fx-number')?.textContent || null });
            }
            if (entry.basic) {
              reviewEffects.show({ type: 'cast', row: entry.basic, next: entry.basic.timeline?.[0] }, 1, 300); freezeFx(100);
              if (wrap.querySelector('.gm-combat-sequence3')) throw new Error('Utility basic attack stole Sequence 3 art');
            }
            reviewEffects.clear(); return { frames, unchanged: JSON.stringify(entry) === before,
              leftovers: wrap.querySelectorAll('.gm-combat-fx-layer, .gm-battle-fx-layer, .gm-pathway-fx-layer').length };
          }, entry);
          assert(outcomes.unchanged); assert.equal(outcomes.leftovers, 0);
          for (const frame of outcomes.frames) {
            const event = frame.event, own = event.actorId == null || event.actorId === 'caster';
            if (damaged.has(entry.id) && event.type === 'damage' && !event.isReflect && !event.isReaction && own) {
              assert(frame.number); assert(frame.art.some(art => art.stage === 'impact' && art.targetId === event.targetId));
            }
            if (reflected.has(entry.id) && event.isReflect && event.sourceAbilityId === entry.id) {
              assert(frame.art.some(art => art.stage === 'guard' && art.ownerId === event.actorId && art.targetId === event.actorId), 'ward stays on its real owner');
              assert(!frame.art.some(art => art.flow), 'prepared ward artwork never flies at attacker'); assert(frame.number);
            }
            if (entry.id === 'lunar_blessing' && event.type === 'heal' && Number(event.amount) > 0)
              assert(frame.art.some(art => art.targetId === 'caster' && art.asset === spec.asset), 'native recovery pulses its caster');
            if (['historical_summoning', 'zombie_legion', 'flesh_creation'].includes(entry.id) && event.type === 'shield' && Number(event.amount) > 0)
              assert(frame.art.some(art => art.targetId === 'caster' && art.asset === spec.asset), 'native shield remains on its owner');
          }
          results.push({ width, id: entry.id, team: entry.row.actorTeam, cast, outcomes: outcomes.frames });
        }
        for (const compact of [false, true]) {
          await page.emulateMedia({ reducedMotion: compact ? 'no-preference' : 'reduce' });
          const failures = await page.evaluate(({ entries, compact }) => entries.flatMap(entry => {
            const wrap = installFixture(entry);
            reviewEffects.show({ type: 'cast', row: entry.row, next: entry.row.timeline[0] }, compact ? 4 : 2, 1250);
            const nodes = [...wrap.querySelectorAll('.gm-combat-sequence3[data-stage="cast"]')];
            const failed = !nodes.length || nodes.some(node => Number(getComputedStyle(node).opacity) < .5 || node.getAnimations({ subtree: true }).length);
            reviewEffects.clear(); return failed ? [entry.id] : [];
          }), { entries: fixtures.filter(entry => entry.row.actorTeam === 'ally'), compact });
          assert.deepEqual(failures, [], (compact ? 'compact' : 'reduced-motion') + ' preserves every static effect');
        }
        assert.deepEqual(errors, []); assert.deepEqual(missing, []);
        console.log(`PASS ${width}px: all20 native Sequence3 casts on both teams,21PNGs, actual outcomes and playback controls`);
      } finally { await page.close(); }
    }
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed: results.length, results }, null, 2) + '\n');
    console.log(`${results.length} Sequence 3 real-browser cast checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
