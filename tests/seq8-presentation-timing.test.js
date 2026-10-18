'use strict';
// Replay-clock checks use shipped ability definitions and resolved event rows.
// No animation callback or timing helper is allowed to change combat outcomes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { g, world } = require('./phase3-test-helpers');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
const api = new Function(source.slice(0, source.indexOf('function createPathwayEffects')) + `
  return { isReadableAbility, readableCastDuration, battleAnimationRate,
    battlePresentationRate, battlePresentationDelay, battlePresentationDuration, advanceBattlePresentation,
    battlePresentationRows, isPositiveSupportEvent };`)();
const catalog = g.PATH_KEYS.flatMap(key => g.tierFor(key, 8).abilities
  .filter(spec => spec.type === 'active').map(spec => ({ key, spec })));
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { g.bindBattle(null); }
}
function playing(row) { return { turnRows: [row], currentTurn: 0, eventCount: null }; }
function resolve(key, spec, sequence = 8, prepare = () => {}) {
  const w = world(key, sequence);
  w.u.hp -= 1000;
  prepare(w);
  const lines = [];
  g.bindBattle(w.state, lines);
  assert(g.applyStructuredAbility(w.a, w.u, w.v, w.state, lines, () => .99, spec));
  const rows = g.groupEventsToRows(w.state.events).flatMap(round => round.rows);
  return { w, rows, row: rows.find(row => row.abilityId === spec.effectId) };
}

test('all twenty shipped Sequence 8 actives receive readable casts while the two passives remain excluded', () => {
  assert.equal(catalog.length, 20);
  for (const { spec } of catalog) assert(api.isReadableAbility({ abilityId: spec.effectId }), spec.effectId);
  for (const key of ['black_emperor', 'visionary']) {
    const passive = g.tierFor(key, 8).abilities[0];
    assert.equal(passive.type, 'passive');
    assert.equal(api.isReadableAbility({ abilityId: passive.effectId, abilityType: 'passive' }), false);
  }
});

for (const { key, spec } of catalog) test(`${spec.effectId}: native and copied metadata share the complete cast clock`, () => {
  const { row } = resolve(key, spec);
  assert(row, 'the real ability has a grouped cast row');
  for (const identity of [{ abilityId: spec.effectId },
    { abilityId: `record:${spec.effectId}` },
    { abilityId: `asset_soul:${spec.effectId}` },
    { abilityId: 'stored:retained_power', sourceAbilityId: spec.effectId }]) {
    for (const [speed, expectedMs, expectedRate] of [[.5, 1600, .5], [1, 800, 1], [2, 500, 1.6], [4, 200, 4]]) {
      const p = playing({ ...row, ...identity });
      assert.equal(api.battlePresentationDelay(p, speed), 0, 'the cast begins before any outcome is revealed');
      const cue = api.advanceBattlePresentation(p);
      assert.equal(cue.type, 'cast'); assert.equal(p.currentTurn, 0);
      assert.equal(api.battlePresentationDelay(p, speed), expectedMs);
      assert.equal(api.battlePresentationRate(p, speed), expectedRate);
      assert.equal(api.battleAnimationRate(p.turnRows[0], expectedRate, 'cast'), expectedRate,
        'forwarding the resolved rate to a child controller is idempotent');
      const visible = api.battlePresentationRows(p.turnRows, p.currentTurn, p.eventCount);
      assert.equal(visible[0].timeline.length, 0);
      assert.equal(visible[0].damages.length, 0); assert.equal(visible[0].heals.length, 0);
      assert.equal(visible[0].presentationPartial, true);
    }
  }
});

test('all active abilities use the same Sequence 8 event-specific outcome holds', () => {
  const note = { type: 'note', event: { type: 'status', text: 'A recorded debuff' } };
  const damage = { type: 'damage', event: { type: 'damage', hpLoss: 3 } };
  const p = playing({ type: 'turn', abilityId: 'undying_touch', timeline: [note, damage] });
  api.advanceBattlePresentation(p);
  api.advanceBattlePresentation(p);
  assert.equal(api.battlePresentationDelay(p, 1), 90);
  assert.equal(api.battlePresentationDelay(p, 2), 45);
  assert.equal(api.battlePresentationRate(p, 2), 2, 'the 1.6x exception ends when the cast ends');
  api.advanceBattlePresentation(p);
  assert.equal(api.battlePresentationDelay(p, 1), 225);
  for (const abilityId of ['exploit_loophole', 'combat_theft', 'healing_touch', 'brutal_strike', 'unlisted_active_skill']) {
    const active = playing({ type: 'turn', abilityId, timeline: [note, damage] });
    api.advanceBattlePresentation(active); api.advanceBattlePresentation(active);
    assert.equal(api.battlePresentationDelay(active, 1), 90, abilityId + ' uses the Sequence 8 note hold');
    api.advanceBattlePresentation(active);
    assert.equal(api.battlePresentationDelay(active, 1), 225, abilityId + ' uses the Sequence 8 damage hold');
  }
});

test('real healing, shields, cleanse and positive buffs use a stable 600ms result clock at every Sequence', () => {
  const cases = [['moon', 9], ['hanged_man', 7], ['sun', 7], ['twilight_giant', 7], ['tyrant', 7], ['hermit', 3],
    ['mother', 7], ['darkness', 7], ['red_priest', 3], ['mother', 3],
    ['moon', 6], ['paragon', 2], ['abyss', 3], ['chained', 3], ['justiciar', 2]];
  for (const [key, sequence] of cases) {
    const { row } = resolve(key, g.tierFor(key, sequence).abilities[0], sequence);
    assert(row, key + ' has a real cast row');
    const p = playing(row);
    assert.equal(api.advanceBattlePresentation(p).type, 'cast');
    for (const [speed, rate, wall] of [[.5, .5, 1600], [1, 1, 800], [2, 1.6, 500], [4, 4, 200]]) {
      assert.equal(api.battlePresentationDuration(p, speed), 800);
      assert.equal(api.battlePresentationRate(p, speed), rate);
      assert.equal(api.battlePresentationDelay(p, speed), wall);
    }
    let supports = 0;
    while (p.currentTurn === 0) {
      const cue = api.advanceBattlePresentation(p);
      if (cue.type === 'settle' || !api.isPositiveSupportEvent(cue.event, row)) continue;
      supports++;
      for (const [speed, rate, wall] of [[.5, .5, 1200], [1, 1, 600], [2, 1.5, 400], [4, 4, 150]]) {
        assert.equal(api.battlePresentationDuration(p, speed), 600, key + ' keeps one base clock');
        assert.equal(api.battlePresentationRate(p, speed), rate);
        assert.equal(api.battlePresentationDelay(p, speed), wall);
        assert.equal(api.battleAnimationRate(row, rate, cue.type, cue.event), rate, 'forwarding is idempotent');
      }
    }
    assert(supports > 0, key + ' emits an actual support outcome');
  }
});

test('Beast Command protects the actual prepared recipient and its real healing without slowing resource notes', () => {
  const w = world('moon', 8), loadout = require('../scripts/permanent-asset-loadouts');
  loadout(g, w.a, 'rare');
  g.initializePathwayBattle(w.state, { kind: 'contract', id: 'support-clock' }, 71);
  g.deployPreparedPathwayCompanions(w.state, []);
  const beast = w.state.allies.find(unit => unit._assetOwnerId === w.u.id);
  assert(beast); beast.hp -= 80; g.setMeterValue(w.a, 'moon', 100); w.state.events = [];
  g.bindBattle(w.state, []);
  assert(g.applyStructuredAbility(w.a, w.u, w.v, w.state, [], () => .99, g.tierFor('moon', 8).abilities[0]));
  const row = g.groupEventsToRows(w.state.events).flatMap(round => round.rows).find(row => row.abilityId === 'beast_command');
  const p = playing(row); api.advanceBattlePresentation(p);
  const outcomes = [];
  while (p.currentTurn === 0) {
    const cue = api.advanceBattlePresentation(p); if (cue.type === 'settle') continue;
    const support = api.isPositiveSupportEvent(cue.event, row);
    outcomes.push({ event: cue.event, support });
    assert.equal(api.battlePresentationDelay(p, 2), support ? 400 : 45);
  }
  const command = outcomes.find(value => value.event.presentationEffect === 'beast_command');
  assert(command.support); assert.equal(command.event.targetId, beast.id);
  assert(outcomes.some(value => value.support && value.event.type === 'heal' && value.event.targetId === beast.id));
  assert(outcomes.some(value => !value.support), 'the charge-spend note keeps its ordinary cadence');
});

test('Lucky Break remains a cast-only utility row without an invented positive outcome', () => {
  for (const key of ['wheel_of_fortune']) {
    const { row, rows } = resolve(key, g.tierFor(key, 7).abilities[0], 7);
    assert.equal(row.timeline.length, 0);
    const p = playing(row); assert.equal(api.advanceBattlePresentation(p).type, 'cast');
    assert.equal(api.battlePresentationDelay(p, 1), 800);
    assert.equal(api.battlePresentationDelay(p, 2), 500);
    assert.equal(api.advanceBattlePresentation(p).type, 'settle');
    assert.equal(rows[1].abilityId, 'basic_attack');
  }
});

test('Paper guard and reflection are timed only by actual recorded triggers, never by an incoming ability name', () => {
  for (const event of [
    { type: 'damage', actorId: 'enemy', targetId: 'ally', paperReboundOwnerId: 'ally', amount: 8 },
    { type: 'damage', actorId: 'ally', targetId: 'enemy', isReflect: true, sourceAbilityId: 'paper_figurine_rebound', amount: 8 }
  ]) {
    const row = { type: 'turn', abilityId: 'basic_attack', actorId: 'enemy', timeline: [{ type: 'damage', event }] };
    const p = playing(row); api.advanceBattlePresentation(p); api.advanceBattlePresentation(p);
    assert(api.isPositiveSupportEvent(event, row));
    assert.equal(api.battlePresentationDuration(p, 1), 600, 'the actual ward result has its own stable clock');
    assert.equal(api.battlePresentationDelay(p, 2), 400);
  }
  assert.equal(api.isPositiveSupportEvent({ type: 'damage', actorId: 'enemy', targetId: 'ally' }, { abilityId: 'basic_attack' }), false);
});

test('basic and passive recovery retain ordinary action timing while explicit active recovery is readable', () => {
  const heal = { type: 'heal', actorId: 'ally', targetId: 'ally', amount: 10 };
  for (const row of [
    { abilityId: 'basic_attack' },
    { abilityId: 'passive_recovery', abilityType: 'passive' },
    { abilityId: 'raging_blow', timeline: [], recoveryKind: 'lifesteal' }
  ]) {
    const event = { ...heal, ...(row.recoveryKind ? { recoveryKind: row.recoveryKind } : {}) };
    assert.equal(api.isPositiveSupportEvent(event, { actorId: 'ally', ...row }), false);
  }
  assert(api.isPositiveSupportEvent({ ...heal, recoveryKind: 'ability' }, { abilityId: 'blood_siphon', actorId: 'ally' }));
  const p = playing({ type: 'turn', actorId: 'ally', abilityId: 'basic_attack', timeline: [
    { type: 'damage', event: { type: 'damage', actorId: 'ally', amount: 10 } }, { type: 'heal', event: heal }
  ] });
  let total = 0;
  while (p.currentTurn === 0) { const cue = api.advanceBattlePresentation(p); if (cue.type !== 'settle') total += api.battlePresentationDuration(p); }
  assert.equal(total, 1000);
});

test('real basic lifesteal, passive recovery and Blood Siphon keep distinct recovery clocks', () => {
  const w = world('tyrant', 8); w.u.hp -= 1000; w.u._lifestealBonus = .25;
  g.bindBattle(w.state, []); g.attackOnce(w.a, w.u, w.v, w.state, [], () => .99);
  const basic = g.groupEventsToRows(w.state.events).flatMap(round => round.rows).find(row => row.abilityId === 'basic_attack');
  const basicHeal = basic.timeline.find(step => step.event.type === 'heal');
  assert(basicHeal, 'the real basic strike restores HP');
  assert.equal(basicHeal.event.recoveryKind, 'lifesteal');
  assert.equal(api.isPositiveSupportEvent(basicHeal.event, basic), false);
  const passive = resolve('tyrant', g.tierFor('tyrant', 8).abilities[0], 8, value => { value.u._lifestealBonus = .25; });
  const passiveHeal = passive.row.timeline.find(step => step.event.type === 'heal');
  assert(passiveHeal, 'an active damage cast can carry passive recovery');
  assert.equal(passiveHeal.event.recoveryKind, 'lifesteal');
  assert.equal(api.isPositiveSupportEvent(passiveHeal.event, passive.row), false);
  const siphon = resolve('moon', g.tierFor('moon', 7).abilities[0], 7);
  const siphonHeal = siphon.row.timeline.find(step => step.event.type === 'heal');
  assert(siphonHeal, 'Blood Siphon actually restores HP');
  assert.equal(siphonHeal.event.recoveryKind, 'ability');
  assert(api.isPositiveSupportEvent(siphonHeal.event, siphon.row));
  const p = playing(siphon.row); api.advanceBattlePresentation(p);
  while (p.currentTurn === 0) {
    const cue = api.advanceBattlePresentation(p);
    if (cue.event !== siphonHeal.event) continue;
    assert.equal(api.battlePresentationDelay(p, 1), 600);
    assert.equal(api.battlePresentationDelay(p, 2), 400);
  }
});

test('cast-only Bad Luck Curse finishes its cue before its separate basic attack without inventing outcomes', () => {
  const { w, rows, row } = resolve('wheel_of_fortune', g.tierFor('wheel_of_fortune', 8).abilities[0]);
  assert.equal(row.timeline.length, 0);
  assert.equal(rows[1].abilityId, 'basic_attack');
  const originalEvents = JSON.stringify(w.state.events);
  const originalRows = JSON.stringify(rows);
  for (const speed of [1, 2, 4]) {
    const p = { turnRows: rows, currentTurn: 0, eventCount: null };
    const cast = api.advanceBattlePresentation(p);
    assert.equal(cast.type, 'cast'); assert.equal(cast.next, null); assert.equal(p.currentTurn, 0);
    assert.equal(api.battlePresentationDelay(p, speed), speed === 2 ? 500 : 800 / speed);
    const partial = api.battlePresentationRows(rows, 0, p.eventCount)[0];
    assert.equal(partial.timeline.length, 0);
    assert.equal(partial.damages.length, 0); assert.equal(partial.subrows.length, 0);
    const settle = api.advanceBattlePresentation(p);
    assert.equal(settle.type, 'settle'); assert.equal(p.currentTurn, 1); assert.equal(p.eventCount, null);
    assert.equal(api.battlePresentationDelay(p, speed), 0);
    const basic = api.advanceBattlePresentation(p);
    assert.equal(basic.type, 'cast'); assert.equal(basic.row.abilityId, 'basic_attack');
    assert.equal(api.battlePresentationDelay(p, speed), 300 / speed, 'the separate basic retains its own timing');
  }
  assert.equal(JSON.stringify(w.state.events), originalEvents);
  assert.equal(JSON.stringify(rows), originalRows);
});

test('every native Sequence 8 timeline replays its real events once and preserves the resolved order', () => {
  for (const { key, spec } of catalog) {
    const { w, rows } = resolve(key, spec);
    const before = JSON.stringify(w.state.events);
    const p = { turnRows: rows, currentTurn: 0, eventCount: null }, revealed = [];
    for (let guard = 0; p.currentTurn < rows.length && guard < 100; guard++) {
      const cue = api.advanceBattlePresentation(p);
      if (!['cast', 'settle', 'row'].includes(cue.type)) revealed.push(cue.event);
    }
    assert.equal(p.currentTurn, rows.length, spec.effectId + ' terminates without a presentation loop');
    assert.deepEqual(revealed, rows.flatMap(row => row.timeline || []).map(step => step.event));
    assert.equal(JSON.stringify(w.state.events), before);
  }
});

test('periodic damage skips casting while passive and non-ability empty rows stay uncast', () => {
  const dot = { type: 'damage', event: { type: 'damage', isDot: true, hpLoss: 2 } };
  const p = playing({ type: 'turn', abilityId: 'madness_curse', timeline: [dot] });
  assert.equal(api.advanceBattlePresentation(p).type, 'damage');
  assert.equal(api.battlePresentationRate(p, 2), 2);
  const passive = playing({ type: 'turn', abilityId: 'inert_passive', abilityType: 'passive', timeline: [] });
  assert.equal(api.battlePresentationDelay(passive, 1), 1000);
  assert.equal(api.advanceBattlePresentation(passive).type, 'row');
  assert.equal(passive.currentTurn, 1);
  const plain = playing({ type: 'story', timeline: [] });
  assert.equal(api.battlePresentationDelay(plain, 1), 400);
  assert.equal(api.advanceBattlePresentation(plain).type, 'row');
  assert.equal(plain.currentTurn, 1);
});

test('basic attacks keep their original cast duration while active attacks use the universal ability clock', () => {
  for (const [abilityId, duration] of [['basic_attack', 300], ['brutal_strike', 800], ['unlisted_active_skill', 800]])
    for (const speed of [.5, 1, 2, 4]) {
      const p = playing({ type: 'turn', abilityId, timeline: [{ type: 'damage', event: { type: 'damage' } }] });
      api.advanceBattlePresentation(p);
      const rate = duration === 800 && speed === 2 ? 1.6 : speed;
      assert.equal(api.battlePresentationDelay(p, speed), duration / rate);
      assert.equal(api.battlePresentationRate(p, speed), rate);
    }
});

console.log(`\nSequence 8 presentation timing: ${passed} passed; ${failed} failed.`);
if (failed) process.exitCode = 1;
