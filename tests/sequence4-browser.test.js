// Real Chromium checks from native casts; never manufacture combat outcomes.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { g, world } = require('./phase3-test-helpers');
const root = path.resolve(__dirname, '..');
const output = process.env.SEQUENCE4_FX_OUTPUT || '/tmp/guild-sequence4-fx';
const source = fs.readFileSync(process.env.SEQUENCE4_UI_SOURCE || path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = [...html.matchAll(/href="(css\/[^"?]+\.css)/g)].map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const data = Object.fromEntries(['contracts', 'fx', 'balance'].map(name => [name, JSON.parse(fs.readFileSync(path.join(root, `data/${name}.json`)))]));
const ids = Object.keys(data.fx.sequence4Abilities || {});
assert.equal(ids.length, 22, 'every newly unlocked Sequence 4 active ability has PNG metadata');
const closeAngle = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < .05;

function fixture(id, side) {
  const spec = data.fx.sequence4Abilities[id], w = world(spec.pathway, 4, side);
  w.u.hp = Math.round(w.u.maxHp * .4); g.addStatus(w.u, 'poison', 3, 'encounter');
  const snapshot = (unit, team) => ({ id: unit.id, name: unit.name, team, path: unit.agent.path,
    sequence: unit.agent.sequence, hp: unit.hp, maxHp: unit.maxHp, sp: unit.agent.sp, maxSP: unit.agent.maxSP, alive: unit.alive });
  const units = [...w.state.allies.map(unit => snapshot(unit, 'ally')), ...w.state.enemies.map(unit => snapshot(unit, 'enemy'))];
  g.bindBattle(w.state, []);
  try {
    assert(g.applyStructuredAbility(w.a, w.u, w.v, w.state, [], () => .99, g.tierFor(spec.pathway, 4).abilities[0]));
    const rows = () => g.groupEventsToRows(w.state.events).flatMap(round => round.rows);
    const row = rows().find(item => item.type === 'turn' && String(item.sourceAbilityId || item.abilityId).split(':').pop() === id);
    assert(row, id + ' produces a native cast row');
    const castEnd = w.state.events.length;
    if (id === 'prophetic_intervention') {
      assert(g.applyStructuredAbility(w.b, w.v, w.u, w.state, [], () => .99, g.tierFor('fool', 8).abilities[0]));
    } else if (id === 'parasitic_contagion') g.signatureTurnStart(w.v, w.state, [], () => .99);
    const lateEvents = w.state.events.slice(castEnd);
    if (id === 'scarlet_blood_domain') assert((row.timeline || []).some(step => step.event.subtype === 'sp_siphon' && step.event.spGain > 0), 'Moon fixture records actual SP recovery');
    if (id === 'parasitic_contagion') assert(lateEvents.some(event => event.subtype === 'parasite_tick'), 'parasite fixture reaches a real host-turn tick');
    if (id === 'prophetic_intervention') assert(lateEvents.some(event => event.isReflect && event.sourceAbilityId === id), 'ward fixture reaches its real deferred reflection');
    const late = rows().flatMap(item => (item.timeline || []).filter(step => lateEvents.includes(step.event))
      .map(step => ({ ...step, row: item })));
    // Grouping may copy event records. Preserve the native event and use its
    // native action row when available; the source ability still owns the cue.
    for (const event of lateEvents) if (!late.some(step => step.event === event || JSON.stringify(step.event) === JSON.stringify(event))) {
      const action = rows().find(item => (item.timeline || []).some(step => JSON.stringify(step.event) === JSON.stringify(event)));
      late.push({ type: event.type, event, row: action || row });
    }
    return JSON.parse(JSON.stringify({ id, units, row, late }));
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
        await page.route('https://sequence4-fx.test/**', route => {
          const file = path.resolve(root, new URL(route.request().url()).pathname.slice(1));
          if (!file.startsWith(root + path.sep)) return route.abort();
          try { return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } }); }
          catch { missing.push(file); return route.fulfill({ status: 404, body: 'Missing test asset' }); }
        });
        await page.setContent(`<base href="https://sequence4-fx.test/"><style>${styles}</style><main></main>`);
        await page.evaluate(value => { window.G9_DATA = value; window.G9D = value; window.abbrNum = number => String(Math.round(number || 0)); }, data);
        await page.addScriptTag({ content: source });
        const decoded = await page.evaluate(async () => Promise.all(Object.values(G9_DATA.fx.sequence4Abilities)
          .flatMap(spec => [spec.asset, spec.secondaryAsset].filter(Boolean)).map(async src => {
            const image = new Image(); image.crossOrigin = 'anonymous'; image.src = src; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, image.width, image.height).data;
            let transparent = 0, visible = 0;
            for (let i = 3; i < pixels.length; i += 4) { if (!pixels[i]) transparent++; if (pixels[i] > 0) visible++; }
            return { src, width: image.width, height: image.height, transparent, visible };
          })));
        assert.equal(decoded.length, 27);
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
            const wrap = installFixture(entry), row = entry.row, before = JSON.stringify(row);
            const playing = { turnRows: [row], currentTurn: 0, eventCount: null };
            reviewEffects.show(advanceBattlePresentation(playing), 1, battlePresentationDelay(playing)); freezeFx(464);
            const nodes = [...wrap.querySelectorAll('.gm-combat-sequence4[data-stage="cast"]')];
            if (!nodes.length) throw new Error('Missing Sequence 4 cast: ' + entry.id);
            const actorBox = wrap.querySelector(`[data-unit-id="${row.actorId}"] .gm-unit-sprite-anchor`).getBoundingClientRect();
            const art = nodes.map(node => {
              const tracks = node.getAnimations({ subtree: true }), matrix = new DOMMatrix(getComputedStyle(node).transform);
              const target = wrap.querySelector(`[data-unit-id="${node.dataset.targetId}"] .gm-unit-sprite-anchor`).getBoundingClientRect();
              return { targetId: node.dataset.targetId, asset: node.dataset.effectSrc, ownerId: node.dataset.ownerId,
                duration: tracks[0]?.effect.getTiming().duration, opacity: Number(getComputedStyle(node).opacity),
                angle: Number(node.dataset.angleDeg), renderedAngle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
                expected: Math.atan2(target.y - actorBox.y, target.x - actorBox.x) * 180 / Math.PI,
                flow: node.dataset.flowDirection, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height };
            });
            const firstTrack = nodes[0].getAnimations()[0]; reviewEffects.setSpeed(2);
            const switchedRate = firstTrack?.playbackRate, pausedAfterSwitch = firstTrack?.playState; reviewEffects.setSpeed(1);
            return { art, switchedRate, pausedAfterSwitch, unchanged: JSON.stringify(row) === before,
              outcomes: wrap.querySelectorAll('.gm-battle-fx-number, .gm-combat-heal, .gm-combat-sequence4[data-stage="impact"], .gm-combat-sequence4[data-stage="outcome"]').length,
              prematureRecovery: !!wrap.querySelector('.gm-combat-sequence4[data-stage="cast-secondary"][data-effect-src*="recovery-motes"], .gm-combat-sequence4[data-stage="cast-secondary"][data-effect-src*="sp-siphon"]') };
          }, entry);
          const spec = data.fx.sequence4Abilities[entry.id];
          assert(cast.unchanged); assert.equal(cast.outcomes, 0); assert.equal(cast.prematureRecovery, false);
          assert.equal(cast.switchedRate, 1.6); assert.equal(cast.pausedAfterSwitch, 'paused');
          for (const art of cast.art) {
            assert.equal(art.asset, spec.asset); assert.equal(art.ownerId, 'caster');
            assert.equal(art.duration, 800); assert(art.opacity > .5 && art.width > 10 && art.height > 10, entry.id + ' visible native cast');
            if (spec.mode === 'travel') {
              assert(closeAngle(art.angle, art.expected) && closeAngle(art.renderedAngle, art.expected), entry.id + ' follows its actual recipient');
              assert.equal(art.flow, 'caster-to-target');
            }
          }
          const damageTargets = [...new Set((entry.row.timeline || []).filter(step => step.type === 'damage' && !step.event.isReflect && !step.event.isReaction).map(step => step.event.targetId))];
          if (['interdiction_roar', 'horror_domain', 'undying_rebirth_aura', 'scarlet_blood_domain'].includes(entry.id)) {
            assert.equal(damageTargets.length, 2); assert.deepEqual(cast.art.map(art => art.targetId).sort(), damageTargets.sort(), 'area art uses every real enemy target');
          }
          if (['prophetic_intervention', 'parasitic_contagion'].includes(entry.id)) assert.equal(cast.art[0].targetId, entry.id === 'prophetic_intervention' ? 'caster' : 'victim');
          if (['bizarro_transformation', 'scarlet_blood_domain', 'dawn_guardian_barrier', 'interdiction_roar'].includes(entry.id) && entry.row.actorTeam === 'ally')
            await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, `${entry.id}-${width}px.png`), animations: 'allow' });
          const outcomes = await page.evaluate(entry => {
            const wrap = document.querySelector('.battle-log-wrap'), before = JSON.stringify(entry), frames = [];
            for (const step of [...(entry.row.timeline || []).map(step => ({ ...step, row: entry.row })), ...entry.late]) {
              reviewEffects.show(step, 1, 500); freezeFx(180);
              const art = [...wrap.querySelectorAll('.gm-combat-sequence4')].map(node => ({ targetId: node.dataset.targetId, ownerId: node.dataset.ownerId,
                stage: node.dataset.stage, asset: node.dataset.effectSrc, flow: node.dataset.flowDirection }));
              frames.push({ event: step.event, art, number: wrap.querySelector('.gm-battle-fx-number')?.textContent || null,
                healing: !!wrap.querySelector('.gm-combat-heal'), reflectedTravel: !!wrap.querySelector('.gm-combat-projectile') });
            }
            reviewEffects.clear(); return { frames, unchanged: JSON.stringify(entry) === before,
              leftovers: wrap.querySelectorAll('.gm-combat-fx-layer, .gm-battle-fx-layer, .gm-pathway-fx-layer').length };
          }, entry);
          assert(outcomes.unchanged); assert.equal(outcomes.leftovers, 0);
          for (const frame of outcomes.frames) {
            const event = frame.event, own = event.actorId == null || event.actorId === 'caster';
            if (event.type === 'damage' && !event.isReflect && !event.isReaction && own) {
              assert(frame.number); assert(frame.art.some(art => art.stage === 'impact' && art.targetId === event.targetId));
            }
            if (entry.id === 'shadow_sword_execution' && event.type === 'heal' && Number(event.amount) > 0)
              assert(frame.art.some(art => art.targetId === event.targetId && art.asset === spec.secondaryAsset), 'only real recovery gets recovery art');
            if (entry.id === 'scarlet_blood_domain' && event.subtype === 'sp_siphon') {
              const returning = frame.art.filter(art => art.asset === spec.secondaryAsset);
              assert.equal(returning.length > 0, Number(event.spGain) > 0);
              if (returning.length) { assert.equal(returning[0].targetId, 'caster'); assert.equal(returning[0].flow, 'target-to-caster'); }
              assert.equal(frame.healing, false, 'SP siphoning never invents HP recovery');
            }
            if (entry.id === 'parasitic_contagion' && event.subtype === 'parasite_tick')
              assert(frame.art.some(art => art.targetId === event.targetId && art.asset === spec.asset), 'the native later host tick uses its parasite art');
            if (entry.id === 'prophetic_intervention' && event.isReflect && event.sourceAbilityId === entry.id) {
              assert(frame.art.some(art => art.stage === 'guard' && art.ownerId === event.actorId && art.targetId === event.actorId), 'later reflection shows the ward on its real owner');
              assert(frame.number, 'actual reflected damage remains visible');
            }
          }
          results.push({ width, id: entry.id, team: entry.row.actorTeam, cast, outcomes: outcomes.frames });
        }
        for (const compact of [false, true]) {
          await page.emulateMedia({ reducedMotion: compact ? 'no-preference' : 'reduce' });
          const failures = await page.evaluate(({ entries, compact }) => entries.flatMap(entry => {
            const wrap = installFixture(entry);
            reviewEffects.show({ type: 'cast', row: entry.row, next: entry.row.timeline[0] }, compact ? 4 : 2, 800);
            const nodes = [...wrap.querySelectorAll('.gm-combat-sequence4[data-stage="cast"]')];
            const failed = !nodes.length || nodes.some(node => Number(getComputedStyle(node).opacity) < .5 || node.getAnimations({ subtree: true }).length);
            reviewEffects.clear(); return failed ? [entry.id] : [];
          }), { entries: fixtures.filter(entry => entry.row.actorTeam === 'ally'), compact });
          assert.deepEqual(failures, [], (compact ? 'compact' : 'reduced-motion') + ' preserves every static effect');
        }
        assert.deepEqual(errors, []); assert.deepEqual(missing, []);
        console.log(`PASS ${width}px: all 22 native casts on both teams, actual outcomes, 27 PNGs and playback controls`);
      } finally { await page.close(); }
    }
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ passed: results.length, results }, null, 2) + '\n');
    console.log(`${results.length} Sequence 4 real-browser cast checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
