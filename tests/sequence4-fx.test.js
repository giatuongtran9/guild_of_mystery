'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const game = require('../js/node-loader');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const fx = JSON.parse(fs.readFileSync(path.join(root, 'data/fx.json'), 'utf8'));
const catalog = game.abilityPreviewCatalog().filter(entry => entry.sequence === 4);
const ids = Object.fromEntries(catalog.map(entry => [entry.ability.effectId || entry.ability.id, entry.path]));
const casterOnly = new Set(['psychological_invisibility', 'prophetic_intervention', 'dawn_guardian_barrier', 'iron_blood_steel_body', 'alchemical_overclock', 'misfortune_inversion']);
const secondary = { bizarro_transformation: 'fool_bizarro_shimmer', undying_rebirth_aura: 'death_undying_ward', nature_s_growth_surge: 'mother_growth_bloom', scarlet_blood_domain: 'moon_sp_siphon', shadow_sword_execution: 'hanged_man_recovery_motes' };
let passed = 0, failed = 0;

function fixture() {
  const dom = new JSDOM('<main></main>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, animations = [], preloads = [];
  Object.defineProperty(w, 'innerWidth', { value: 390 }); Object.defineProperty(w, 'innerHeight', { value: 900 });
  w.abbrNum = n => String(Math.round(n || 0)); w.matchMedia = () => ({ matches: false });
  w.G9_DATA = { fx, runtimeAssets: { entries: {} }, balance: { path_archetype: { moon: 'Caster' } } };
  w.Image = class { set src(value) { preloads.push(value); } };
  w.Element.prototype.animate = function(keyframes, timing) {
    const a = { element: this, keyframes, timing, currentTime: 0, playbackRate: 1, playState: 'running',
      pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
      cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); } };
    animations.push(a); return a;
  };
  const positions = { caster: [80, 370], ally: [240, 370], enemy: [60, 80], enemy2: [170, 80], enemy3: [280, 80],
    preview_caster: [80, 370], preview_ally: [240, 370], preview_target_0: [60, 80], preview_target_1: [170, 80], preview_target_2: [280, 80] };
  w.Element.prototype.getBoundingClientRect = function() {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId, [left, top] = positions[id] || [0, 0];
    const width = id ? 64 : 390, height = id ? 64 : 650;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} };
  };
  const api = w.eval('(function(){\n' + source + '\nreturn {createCombatFx,renderBattleLogComponent};\n})()');
  const units = Object.keys(positions).map(id => ({ id, name: id, path: id.includes('enemy') || id.includes('target') ? 'tyrant' : 'fool', sequence: 4,
    team: id.includes('enemy') || id.includes('target') ? 'enemy' : 'ally', hp: 80, curHp: 80, maxHp: 100, sp: 40, maxSP: 50, alive: true }));
  const map = Object.fromEntries(units.map(unit => [unit.id, unit]));
  w.document.querySelector('main').innerHTML = api.renderBattleLogComponent({ allies: units.filter(unit => unit.team === 'ally'), enemies: units.filter(unit => unit.team === 'enemy'), flattenedRows: [], shownCount: 0, isDone: false, speed: 1, summaryText: '' });
  const wrap = w.document.querySelector('.battle-log-wrap'), effects = api.createCombatFx(wrap); effects.sync(map);
  return { dom, w, wrap, map, effects, animations, preloads, positions,
    find: query => wrap.querySelector(query), all: query => [...wrap.querySelectorAll(query)] };
}
function test(name, fn) { let f; try { f = fixture(); fn(f); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } finally { f?.effects.clear(); f?.dom.window.close(); } }
const event = (type, actorId, targetId, extra = {}) => ({ type, actorId, targetId, ...extra });
const step = event => ({ type: ['status', 'resist'].includes(event.type) ? 'note' : event.type, event });
const row = (id, timeline = [], actorId = 'caster', targetId = actorId === 'caster' ? 'enemy' : 'caster') => ({ type: 'turn', actorId, abilityId: id, sourceAbilityId: id, sourcePath: ids[id], sequence: 4, ability: id, timeline, presentationTargetId: targetId });
const active = f => f.animations.filter(a => !a.cancelled && a.playState !== 'finished');
const xy = frame => frame.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/).slice(1).map(Number);
const art = (f, id, stage = 'cast', field = 'asset') => f.all('.gm-combat-sequence4').find(n => n.dataset.stage === stage && n.dataset.abilityId === id && n.dataset.effectSrc === fx.sequence4Abilities?.[id]?.[field]);
const cast = (f, r, speed = 1) => f.effects.show({ type: 'cast', row: r, next: r.timeline.find(item => item.type === 'damage') || r.timeline[0] }, speed, 800);
const outcome = (f, r, e) => f.effects.show({ type: e.type === 'status' ? 'note' : e.type, row: r, event: e }, 1, 500);
const reset = f => { f.effects.clear(); f.effects.sync(f.map); };
const native = id => game.buildAbilityPreview({ path: ids[id], sequence: 4 });
const nativeRow = id => native(id).groupedRounds.flatMap(group => group.rows).find(r => r.type === 'turn' && r.actorId === 'preview_caster');

test('all twenty-two native active casts use their own 800ms PNG without changing the tape', f => {
  assert.equal(catalog.length, 22);
  for (const id of Object.keys(ids)) {
    reset(f); const r = nativeRow(id), before = JSON.stringify(r); cast(f, r);
    const n = art(f, id); assert(n, id + ' authored cast');
    assert.equal(n.dataset.effectSrc, fx.sequence4Abilities[id].asset);
    assert.equal(n.dataset.targetId, casterOnly.has(id) ? 'preview_caster' : 'preview_target_0', id + ' recipient');
    assert(active(f).some(a => a.element === n && a.timing.duration === 800), id + ' uses managed cast timing');
    assert.equal(JSON.stringify(r), before, id + ' immutable native cast');
    assert.equal(f.find('.gm-combat-heal, .gm-combat-status, .gm-battle-fx-number'), null, 'a cast is an attempt, not an outcome');
  }
});
test('Fool, Death and Mother keep caster art separate from their target attempt', f => {
  for (const id of ['bizarro_transformation', 'undying_rebirth_aura', 'nature_s_growth_surge']) {
    reset(f); cast(f, nativeRow(id));
    assert.equal(art(f, id).dataset.targetId, 'preview_target_0');
    const n = art(f, id, 'cast-secondary', 'secondaryAsset'); assert(n, id + ' secondary'); assert.equal(n.dataset.targetId, 'preview_caster');
    assert.equal(f.find('.gm-combat-revive'), null);
  }
});
test('Hanged Man recovery and Moon SP return are absent from the initial cast', f => {
  for (const id of ['shadow_sword_execution', 'scarlet_blood_domain']) {
    reset(f); cast(f, nativeRow(id));
    assert.equal(art(f, id, 'cast-secondary', 'secondaryAsset'), undefined);
    assert.equal(f.all('.gm-combat-sequence4').some(n => n.dataset.effectSrc === fx.sequence4Abilities?.[id]?.secondaryAsset), false);
  }
});
test('actual Mother healing and enemy binding stay on their recorded recipients', f => {
  const r = nativeRow('nature_s_growth_surge');
  const heal = r.timeline.find(s => s.event.type === 'heal').event, bound = r.timeline.find(s => s.event.status === 'bound').event;
  outcome(f, r, heal); assert.equal(art(f, 'nature_s_growth_surge', 'outcome', 'secondaryAsset').dataset.targetId, 'preview_caster');
  reset(f); outcome(f, r, bound); assert.equal(art(f, 'nature_s_growth_surge', 'impact').dataset.targetId, 'preview_target_0');
  reset(f); outcome(f, r, { ...heal, amount: 0 }); assert.equal(f.find('.gm-combat-sequence4'), null);
});
test('Fool Evade and Death shield outcomes use their secondary art rather than an attack', f => {
  for (const [id, e] of [['bizarro_transformation', event('status', 'caster', 'ally', { status: 'evade', beneficial: true })], ['undying_rebirth_aura', event('shield', 'caster', 'ally', { amount: 25 })]]) {
    reset(f); outcome(f, row(id), e); const n = art(f, id, 'outcome', 'secondaryAsset'); assert(n, id); assert.equal(n.dataset.targetId, 'ally');
    assert.equal(f.all('.gm-combat-sequence4').some(node => node.dataset.effectSrc === fx.sequence4Abilities[id].asset), false);
  }
});
test('Hanged Man recovery follows a positive native ability heal and not its damage or miss', f => {
  const r = nativeRow('shadow_sword_execution'), heal = r.timeline.find(s => s.event.type === 'heal').event;
  assert.equal(heal.recoveryKind, 'ability'); outcome(f, r, heal);
  assert.equal(art(f, 'shadow_sword_execution', 'outcome', 'secondaryAsset').dataset.targetId, 'preview_caster');
  for (const e of [{ ...heal, amount: 0 }, { ...heal, recoveryKind: 'signature' }, { ...heal, recoveryKind: 'lifesteal' }, event('miss', 'preview_caster', 'preview_target_0')]) {
    reset(f); outcome(f, r, e); assert.equal(art(f, 'shadow_sword_execution', 'outcome', 'secondaryAsset'), undefined);
  }
});
for (const actor of ['caster', 'enemy']) for (const id of ['shadow_sword_execution', 'fairy_tale_spell', 'imperator_s_decree', 'unshadowed_execution']) test(id + ' follows genuine opposing anchors from ' + actor, f => {
  const victim = actor === 'caster' ? 'enemy' : 'caster', r = row(id, [step(event('damage', actor, victim, { amount: 20 }))], actor, victim); cast(f, r);
  const n = art(f, id); assert(n); assert.equal(n.dataset.targetId, victim); assert.equal(n.dataset.flowDirection, 'caster-to-target');
  const frames = active(f).find(a => a.element === n).keyframes, start = xy(frames[0]), end = xy(frames.at(-1)); assert.notDeepEqual(start, end);
  assert(Math.abs(Number(n.dataset.angleDeg) - Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI) < 1e-8);
});
test('every real AoE damage recipient receives its own recorded impact', f => {
  for (const id of ['interdiction_roar', 'horror_domain', 'undying_rebirth_aura', 'scarlet_blood_domain']) {
    const r = nativeRow(id), hits = r.timeline.filter(s => s.type === 'damage'); assert.equal(hits.length, 3, id);
    for (const hit of hits) { reset(f); outcome(f, r, hit.event); assert.equal(art(f, id, 'impact').dataset.targetId, hit.event.targetId); }
  }
});
test('misses, resists, zero heals and zero shields cannot invent successful results', f => {
  for (const id of ['unaging_mirror_clone', 'fairy_tale_spell', 'spiteful_shackles', 'door_of_concealment', 'nature_s_growth_surge']) {
    for (const type of ['miss', 'resist']) { reset(f); outcome(f, row(id), event(type, 'caster', 'enemy')); assert.equal(f.find('.gm-combat-sequence4'), null, id + ' ' + type); }
  }
  for (const id of ['nature_s_growth_surge', 'undying_rebirth_aura', 'dawn_guardian_barrier']) {
    for (const type of ['heal', 'shield']) { reset(f); outcome(f, row(id), event(type, 'caster', 'caster', { amount: 0 })); assert.equal(f.find('.gm-combat-sequence4'), null); }
  }
});
test('utility fallback damage never turns caster-only art into an offensive spell', f => {
  for (const id of [...casterOnly, 'nature_s_growth_surge', 'parasitic_contagion']) {
    reset(f); outcome(f, row(id), event('damage', 'caster', 'enemy', { amount: 15, damageType: 'physical' }));
    assert.equal(art(f, id, 'impact'), undefined, id + ' utility follow-up');
  }
});
test('unrelated periodic, reflected and foreign damage cannot steal a Sequence 4 attack image', f => {
  for (const extra of [{ isDot: true }, { isReflect: true }, { isReaction: true }, { actorId: 'ally' }]) {
    reset(f); outcome(f, row('unshadowed_execution'), event('damage', 'caster', 'enemy', { amount: 20, ...extra })); assert.equal(f.find('.gm-combat-sequence4'), null);
  }
});
test('Error uses the intended victim despite targetless signature narration', f => {
  const r = nativeRow('parasitic_contagion'), before = JSON.stringify(r); assert(r.timeline.every(s => s.event.targetId == null)); cast(f, r);
  assert.equal(art(f, 'parasitic_contagion').dataset.targetId, 'preview_target_0'); assert.equal(JSON.stringify(r), before);
  assert.equal(art(f, 'parasitic_contagion', 'outcome'), undefined);
});
test('White Tower prepares its guard from native ward metadata and older empty timelines without a countershot', f => {
  const r = nativeRow('prophetic_intervention');
  const setup = r.timeline.filter(step => step.event.subtype === 'reflect');
  assert.equal(setup.length, 1); assert.equal(setup[0].event.beneficial, true);
  assert.equal(setup[0].event.targetId, 'preview_caster');
  assert.equal(setup[0].event.sourceAbilityId, 'prophetic_intervention');
  for (const current of [r, { ...r, timeline: [] }]) {
    reset(f); cast(f, current);
    assert.equal(art(f, 'prophetic_intervention').dataset.targetId, 'preview_caster');
    assert.equal(f.find('.gm-combat-projectile, .gm-combat-sequence4[data-stage="impact"]'), null);
  }
});
test('recorded hostile controls use target artwork without summoning clones or creatures', f => {
  for (const [id, status] of [['door_of_concealment', 'silenced'], ['unaging_mirror_clone', 'frozen'], ['fairy_tale_spell', 'polymorphed'], ['spiteful_shackles', 'bound'], ['nature_s_growth_surge', 'bound'], ['horror_domain', 'stunned']]) {
    reset(f); const before = JSON.stringify(f.map); outcome(f, row(id), event('status', 'caster', 'enemy', { status, beneficial: false }));
    assert.equal(art(f, id, 'impact').dataset.targetId, 'enemy', id + ' actual control'); assert.equal(JSON.stringify(f.map), before);
  }
});
test('Moon SP return appears only for a positive recorded gain, including in another actor turn', f => {
  const r = row('basic_attack', [], 'enemy', 'caster');
  const e = event('status', 'caster', 'enemy', { subtype: 'sp_siphon', sourceAbilityId: 'scarlet_blood_domain', amount: 20, spGain: 15 });
  outcome(f, r, e); const n = art(f, 'scarlet_blood_domain', 'outcome', 'secondaryAsset'); assert(n);
  assert.equal(n.dataset.ownerId, 'caster'); assert.equal(n.dataset.flowDirection, 'target-to-caster');
  const frames = active(f).find(a => a.element === n).keyframes, start = xy(frames[0]), end = xy(frames.at(-1)); assert(end[1] > start[1], 'SP travels from the victim back to its owner');
  assert.equal(f.find('.gm-combat-heal'), null);
  for (const extra of [{ amount: 0 }, { spGain: 0 }]) { reset(f); outcome(f, r, { ...e, ...extra }); assert.equal(f.find('.gm-combat-sequence4'), null); }
});
test('Error parasite ticks are attributed to their owner and real host on a later turn', f => {
  const r = row('basic_attack', [], 'enemy', 'caster');
  const e = event('status', 'caster', 'enemy', { subtype: 'parasite_tick', sourceAbilityId: 'parasitic_contagion', amount: 30, spGain: 20 });
  outcome(f, r, e); const n = art(f, 'parasitic_contagion', 'outcome'); assert(n);
  assert.equal(n.dataset.ownerId, 'caster'); assert.equal(n.dataset.targetId, 'enemy'); assert.equal(f.find('.gm-combat-heal'), null, 'HP recovery still requires its own heal event');
  reset(f); outcome(f, r, { ...e, amount: 0 }); assert.equal(f.find('.gm-combat-sequence4'), null);
});
test('later White Tower reflection pulses the actual ward owner and never a guard projectile', f => {
  const r = row('unshadowed_execution', [], 'enemy', 'caster');
  const e = event('damage', 'caster', 'enemy', { sourceAbilityId: 'prophetic_intervention', isReflect: true, amount: 30, hpLoss: 30, damageType: 'magic' });
  outcome(f, r, e); const n = art(f, 'prophetic_intervention', 'guard'); assert(n);
  assert.equal(n.dataset.ownerId, 'caster'); assert.equal(n.dataset.targetId, 'caster');
  assert.equal(f.all('.gm-combat-sequence4').some(node => node.dataset.mode === 'travel'), false);
  reset(f); outcome(f, r, { ...e, sourceAbilityId: 'paper_figurine_rebound' }); assert.equal(f.find('.gm-combat-sequence4'), null);
});
test('borrowed source IDs choose Sequence 4 art without rewriting the borrowed cast', f => {
  const r = row('unshadowed_execution'); r.abilityId = 'combat_record'; r.sourceAbilityId = 'record:unshadowed_execution'; const before = JSON.stringify(r); cast(f, r);
  assert(art(f, 'unshadowed_execution')); assert.equal(JSON.stringify(r), before);
});
test('only selected cast PNGs preload once instead of every Sequence 4 pathway', f => {
  f.preloads.length = 0; f.effects.prepare([row('nature_s_growth_surge'), row('nature_s_growth_surge')]);
  const selected = f.preloads.filter(src => src.includes('/sequence4/'));
  assert.deepEqual(selected.sort(), [fx.sequence4Abilities.nature_s_growth_surge.asset, fx.sequence4Abilities.nature_s_growth_surge.secondaryAsset].sort());
});
test('pause, speed, clear and compact playback use existing managed animations', f => {
  cast(f, row('unshadowed_execution')); assert(art(f, 'unshadowed_execution'));
  f.effects.pause(); assert(active(f).every(a => a.playState === 'paused'));
  f.effects.setSpeed(2); f.effects.resume(); assert(active(f).every(a => a.playState === 'running'));
  reset(f); assert.equal(f.find('.gm-combat-sequence4'), null);
  cast(f, row('unshadowed_execution'), 4); assert(art(f, 'unshadowed_execution'));
  assert.equal(active(f).length, 0, 'compact cue stays readable without new animation clocks');
});
test('offscreen combatants do not create detached or misplaced Sequence 4 artwork', f => {
  f.positions.caster = [100, 2000]; cast(f, row('unshadowed_execution')); assert.equal(f.find('.gm-combat-sequence4'), null);
});
test('all native casts and outcomes leave combat state, definitions and events unchanged', f => {
  for (const id of Object.keys(ids)) {
    reset(f); const r = nativeRow(id), before = JSON.stringify({ r, fx, map: f.map }); cast(f, r);
    for (const s of r.timeline) outcome(f, r, s.event);
    assert.equal(JSON.stringify({ r, fx, map: f.map }), before, id);
  }
});
console.log(`Sequence 4 battle FX regressions: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
