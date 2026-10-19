'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const fx = JSON.parse(fs.readFileSync(path.join(root, 'data/fx.json'), 'utf8'));
const ids = {
  corrupted_flesh: 'abyss', order_distortion: 'black_emperor', desire_control: 'chained', soul_pacification: 'darkness',
  zombie_transformation: 'death', mirror_substitution: 'demoness', blink_strike: 'door', logic_distortion: 'error',
  thread_binding: 'fool', soul_drain: 'hanged_man', constellation_constrain: 'hermit', law_enforcement: 'justiciar',
  vampire_transformation: 'moon', life_bloom: 'mother', matter_fortification: 'paragon', holy_sun_bolt: 'sun',
  guardian_stance: 'twilight_giant', ocean_calling: 'tyrant', dream_tether: 'visionary', prophetic_evade: 'white_tower'
};
const targetIds = new Set(['order_distortion', 'desire_control', 'soul_pacification', 'zombie_transformation', 'blink_strike', 'logic_distortion', 'thread_binding', 'constellation_constrain', 'law_enforcement', 'holy_sun_bolt', 'ocean_calling', 'dream_tether']);
let passed = 0, failed = 0;
function fixture() {
  const dom = new JSDOM('<main></main>', { runScripts: 'dangerously', pretendToBeVisual: true }), w = dom.window, animations = [];
  Object.defineProperty(w, 'innerWidth', { value: 390 }); Object.defineProperty(w, 'innerHeight', { value: 900 });
  w.abbrNum = n => String(Math.round(n || 0)); w.matchMedia = () => ({ matches: false });
  w.G9_DATA = { fx, runtimeAssets: { entries: {} }, balance: { path_archetype: { moon: 'Caster' } } };
  w.Element.prototype.animate = function(keyframes, timing) {
    const a = { element: this, keyframes, timing, currentTime: 0, playbackRate: 1, playState: 'running',
      pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; }, cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); } };
    animations.push(a); return a;
  };
  const positions = { caster: [100, 370], ally: [230, 370], enemy: [140, 80] };
  w.Element.prototype.getBoundingClientRect = function() {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId, [left, top] = positions[id] || [0, 0], width = id ? 64 : 390, height = id ? 64 : 650;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} };
  };
  const api = w.eval('(function(){\n' + source + '\nreturn {createBattleEffects,renderBattleLogComponent};\n})()');
  const make = (id, pathway, team = 'ally') => ({ id, name: id, path: pathway, sequence: 5, team, hp: 80, maxHp: 100, curHp: 80, sp: 40, maxSP: 50, alive: true });
  const allies = [make('caster', 'fool'), make('ally', 'sun')], enemies = [make('enemy', 'red_priest', 'enemy')];
  const map = Object.fromEntries([...allies, ...enemies].map(unit => [unit.id, unit]));
  w.document.querySelector('main').innerHTML = api.renderBattleLogComponent({ allies, enemies, flattenedRows: [], shownCount: 0, isDone: false, speed: 1, summaryText: '' });
  const wrap = w.document.querySelector('.battle-log-wrap'), effects = api.createBattleEffects(wrap); effects.sync(map);
  return { dom, w, wrap, map, effects, animations, find: query => wrap.querySelector(query), all: query => [...wrap.querySelectorAll(query)] };
}
function test(name, fn) { let f; try { f = fixture(); fn(f); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } finally { f?.effects.clear(); f?.dom.window.close(); } }
const event = (type, actorId, targetId, extra = {}) => ({ type, actorId, targetId, ...extra });
const step = value => ({ type: value.type, event: value });
const row = (id, timeline = [], actorId = 'caster', targetId = actorId === 'caster' ? 'enemy' : 'caster') => ({ type: 'turn', actorId, abilityId: id, sourceAbilityId: id, sourcePath: ids[id], sequence: 5, ability: id, timeline, targetId });
const active = f => f.animations.filter(a => !a.cancelled && a.playState !== 'finished');
const xy = frame => frame.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/).slice(1).map(Number);
const art = (f, id, stage = 'cast', field = 'asset') => f.all('.gm-combat-sequence5').find(n => n.dataset.stage === stage && n.dataset.abilityId === id && n.dataset.effectSrc === fx.sequence5Abilities?.[id]?.[field]);
const cast = (f, r) => f.effects.show({ type: 'cast', row: r, next: r.timeline[0] }, 1, 800);
const reset = f => { f.effects.clear(); f.effects.sync(f.map); };

test('all twenty active skills use their own cast PNG for the readable 800ms phase', f => {
  for (const [id, pathway] of Object.entries(ids)) {
    reset(f); f.map.caster.path = pathway;
    const r = row(id, [step(event('damage', 'caster', 'enemy', { amount: 15, hpLoss: 15 }))]); cast(f, r);
    const n = art(f, id); assert(n, id + ' authored cast');
    assert.equal(n.dataset.effectSrc, fx.sequence5Abilities[id].asset);
    assert(active(f).some(a => a.element === n && a.timing.duration === 800), id + ' managed timing');
    if (targetIds.has(id)) assert.equal(n.dataset.targetId, 'enemy', id + ' target');
    if (['mirror_substitution', 'vampire_transformation', 'matter_fortification', 'guardian_stance', 'prophetic_evade', 'corrupted_flesh'].includes(id)) assert.equal(n.dataset.targetId, 'caster', id + ' self cast');
  }
});
test('all four split casts keep their self and target layers on separate recipients', f => {
  for (const id of ['corrupted_flesh', 'zombie_transformation', 'blink_strike', 'dream_tether']) {
    reset(f); const r = row(id, [step(event('damage', 'caster', 'enemy', { amount: 12 }))]); cast(f, r);
    const primary = art(f, id), secondary = art(f, id, 'cast-secondary', 'secondaryAsset'); assert(primary && secondary, id);
    assert.equal(primary.dataset.targetId, id === 'corrupted_flesh' ? 'caster' : 'enemy');
    assert.equal(secondary.dataset.targetId, id === 'corrupted_flesh' ? 'enemy' : 'caster');
  }
});
test('Logic Distortion uses presentation-only target metadata when legacy targetId is absent', f => {
  const r = row('logic_distortion', [step(event('status', 'caster', undefined, { subtype: 'signature', text: 'attempts distortion' }))]);
  delete r.targetId; r.presentationTargetId = 'enemy'; const before = JSON.stringify(r); cast(f, r);
  const n = art(f, 'logic_distortion'); assert(n); assert.equal(n.dataset.targetId, 'enemy');
  assert.equal(JSON.stringify(r), before, 'target fallback cannot rewrite the saved replay row');
  assert.equal(Object.hasOwn(r, 'targetId'), false);
});
test('Corrupted Flesh keeps self recovery and targeted attempt separate without a legacy targetId', f => {
  const heal = event('heal', 'caster', 'caster', { amount: 15 }), r = row('corrupted_flesh', [step(heal)]);
  delete r.targetId; r.presentationTargetId = 'enemy'; const before = JSON.stringify(r); cast(f, r);
  assert.equal(art(f, 'corrupted_flesh').dataset.targetId, 'caster');
  const mark = art(f, 'corrupted_flesh', 'cast-secondary', 'secondaryAsset'); assert(mark); assert.equal(mark.dataset.targetId, 'enemy');
  assert.equal(JSON.stringify(r), before, 'presentation fallback leaves support and targeting records unchanged');
  assert.equal(Object.hasOwn(r, 'targetId'), false);
});
for (const actorId of ['caster', 'enemy']) {
  for (const id of ['law_enforcement', 'holy_sun_bolt', 'ocean_calling']) test(`${id} travels toward the actual recipient with ${actorId} attacking`, f => {
    const targetId = actorId === 'caster' ? 'enemy' : 'caster', r = row(id, [step(event('damage', actorId, targetId, { amount: 20 }))], actorId, targetId);
    cast(f, r); const n = art(f, id); assert(n); assert.equal(n.dataset.targetId, targetId);
    const frames = active(f).find(a => a.element === n).keyframes, start = xy(frames[0]), end = xy(frames.at(-1));
    assert.notDeepEqual(start, end); assert.equal(n.dataset.flowDirection, 'caster-to-target');
    assert(Math.abs(Number(n.dataset.angleDeg) - Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI) < 1e-8, 'native right-facing art follows travel');
  });
  test(`Spirit Threads remain a narrow stationary span with ${actorId} attacking`, f => {
    const r = row('thread_binding', [], actorId); cast(f, r); const n = art(f, 'thread_binding'); assert(n);
    assert.equal(n.dataset.flightPath, 'stationary-attacker-to-target-span'); assert.equal(n.dataset.flowDirection, 'caster-to-target');
    assert(Number(n.dataset.effectWidth) > 280); assert(Number(n.dataset.effectWidth) > Number(n.dataset.effectHeight) * 3);
    assert.equal(n.querySelector('image').getAttribute('preserveAspectRatio'), 'none');
    const frames = active(f).find(a => a.element === n).keyframes, positions = frames.map(xy);
    for (const position of positions) assert.deepEqual(position, positions[0], 'thread is held rather than fired as a projectile');
    assert(frames.every(frame => frame.transform.includes(`rotate(${n.dataset.angleDeg}deg)`)));
  });
  test(`Soul Drain extracts from victim toward ${actorId} without a recovery pulse`, f => {
    const targetId = actorId === 'caster' ? 'enemy' : 'caster', r = row('soul_drain', [step(event('damage', actorId, targetId, { amount: 20 }))], actorId, targetId);
    cast(f, r); const n = art(f, 'soul_drain'); assert(n); assert.equal(n.dataset.flowDirection, 'target-to-caster');
    const frames = active(f).find(a => a.element === n).keyframes, start = xy(frames[0]), end = xy(frames.at(-1)); assert.notDeepEqual(start, end);
    assert.equal(Math.sign(end[1] - start[1]), actorId === 'caster' ? 1 : -1);
    assert(Math.abs(Number(n.dataset.angleDeg) - Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI) < 1e-8);
    assert.equal(f.find('.gm-combat-heal'), null); reset(f);
    f.effects.show({ type: 'damage', row: r, event: r.timeline[0].event }, 1, 225);
    assert.equal(f.find('.gm-combat-heal'), null); assert.equal(art(f, 'soul_drain', 'outcome'), undefined);
  });
}
test('actual split support results use secondary artwork on the recorded recipient', f => {
  for (const [id, extra] of [['zombie_transformation', { subtype: 'buff', stat: 'def', beneficial: true }], ['blink_strike', { status: 'evade', beneficial: true }], ['dream_tether', { subtype: 'buff', stat: 'int', beneficial: true }]]) {
    reset(f); const r = row(id), result = event('status', 'caster', 'ally', extra);
    f.effects.show({ type: 'status', row: r, event: result }, 1, 500);
    const n = art(f, id, 'outcome', 'secondaryAsset'); assert(n, id); assert.equal(n.dataset.targetId, 'ally');
    assert.equal(f.all('.gm-combat-sequence5').some(node => node.dataset.effectSrc === fx.sequence5Abilities[id].asset), false, 'offensive primary does not hit a healed or buffed ally');
  }
});
test('Life Bloom follows its real healing recipient and zero recovery creates no result art', f => {
  const heal = event('heal', 'caster', 'ally', { amount: 12 }), r = row('life_bloom', [step(heal)]); cast(f, r);
  assert.equal(art(f, 'life_bloom').dataset.targetId, 'ally'); reset(f);
  f.effects.show({ type: 'heal', row: r, event: heal }, 1, 500);
  assert.equal(art(f, 'life_bloom', 'outcome').dataset.targetId, 'ally'); reset(f);
  f.effects.show({ type: 'heal', row: r, event: { ...heal, amount: 0 } }, 1, 500);
  assert.equal(f.find('.gm-combat-sequence5'), null);
});
test('damaging art stays on the actual victim even when row target differs', f => {
  const r = row('holy_sun_bolt'); f.effects.show({ type: 'damage', row: r, event: event('damage', 'caster', 'ally', { amount: 20, hpLoss: 20 }) }, 1, 225);
  const n = art(f, 'holy_sun_bolt', 'impact'); assert(n); assert.equal(n.dataset.targetId, 'ally');
});
test('utility and caster abilities retain generic damage feedback for their basic fallback', f => {
  for (const id of ['guardian_stance', 'vampire_transformation', 'mirror_substitution', 'matter_fortification', 'prophetic_evade', 'life_bloom', 'corrupted_flesh', 'logic_distortion']) {
    reset(f); f.effects.show({ type: 'damage', row: row(id), event: event('damage', 'caster', 'enemy', { amount: 20, hpLoss: 20, damageType: 'physical' }) }, 1, 225);
    assert(f.find('.gm-combat-impact'), id + ' fallback retains shared hit feedback');
    assert.equal(art(f, id, 'impact'), undefined, id + ' support art is not an enemy attack');
  }
});
test('missed and resisted controls cannot invent successful outcome artwork', f => {
  for (const id of ['desire_control', 'logic_distortion', 'thread_binding', 'constellation_constrain']) {
    for (const type of ['miss', 'resist']) {
      reset(f); f.effects.show({ type, row: row(id), event: event(type, 'caster', 'enemy', { text: 'resisted' }) }, 1, 225);
      assert.equal(f.find('.gm-combat-sequence5'), null, id + ' ' + type);
    }
  }
});
test('periodic, reflected, reaction and foreign outcomes cannot replay the authored cast', f => {
  for (const extra of [{ isDot: true }, { isReflect: true }, { isReaction: true }, { actorId: 'ally' }]) {
    reset(f); f.effects.show({ type: 'damage', row: row('holy_sun_bolt'), event: event('damage', 'caster', 'enemy', { amount: 20, ...extra }) }, 1, 225);
    assert.equal(f.find('.gm-combat-sequence5'), null);
  }
});
test('plain signature narration and later thread progress cannot fabricate a new result', f => {
  for (const id of ['logic_distortion', 'corrupted_flesh']) {
    reset(f); f.effects.show({ type: 'note', row: row(id), event: event('status', 'caster', undefined, { subtype: 'signature', text: 'uses an ability' }) }, 1, 500);
    assert.equal(f.find('.gm-combat-sequence5'), null);
  }
  for (const subtype of ['progress', 'damage_interrupt', 'interrupt']) {
    reset(f); f.effects.show({ type: 'thread', row: row('thread_binding'), event: event('thread', 'caster', 'enemy', { subtype, threadState: { ownerId: 'caster', value: 2, max: 5 } }) }, 1, 500);
    assert.equal(f.find('.gm-combat-sequence5'), null, subtype + ' does not repeat initial attachment');
  }
});
test('recorded and borrowed source IDs select the same artwork without changing their events', f => {
  const r = row('holy_sun_bolt', [step(event('damage', 'caster', 'enemy', { amount: 10 }))]); r.abilityId = 'copy_ability'; r.sourceAbilityId = 'record:holy_sun_bolt';
  const before = JSON.stringify(r); cast(f, r); assert(art(f, 'holy_sun_bolt')); assert.equal(JSON.stringify(r), before);
});
test('basic attacks and the two passive Sequence 5 ranks never use active Sequence 5 art', f => {
  for (const id of ['basic_attack', 'iron_blood_vigor', 'reset_fate']) { reset(f); cast(f, row(id)); assert.equal(f.find('.gm-combat-sequence5'), null); }
});
test('rendering every cast and outcome never changes combat, authored data or replay records', f => {
  for (const id of Object.keys(ids)) {
    reset(f); const r = row(id, [step(event('damage', 'caster', 'enemy', { amount: 10, hpLoss: 10 })), step(event('status', 'caster', 'caster', { subtype: 'buff', beneficial: true }))]);
    const before = JSON.stringify({ r, map: f.map, fx }); cast(f, r);
    for (const outcome of r.timeline) f.effects.show({ type: outcome.type, row: r, event: outcome.event }, 1, 500);
    assert.equal(JSON.stringify({ r, map: f.map, fx }), before, id);
  }
});
test('pause, speed, cleanup and compact playback manage the new PNGs through existing controls', f => {
  cast(f, row('ocean_calling')); assert(art(f, 'ocean_calling'));
  f.effects.pause(); assert(active(f).every(a => a.playState === 'paused'));
  f.effects.setSpeed(2); f.effects.resume(); assert(active(f).every(a => a.playState === 'running'));
  reset(f); assert.equal(f.find('.gm-combat-sequence5'), null);
  f.effects.show({ type: 'cast', row: row('holy_sun_bolt') }, 4, 800);
  assert(art(f, 'holy_sun_bolt'), 'compact playback keeps one readable authored cue');
});
console.log(`Sequence 5 battle FX regressions: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
