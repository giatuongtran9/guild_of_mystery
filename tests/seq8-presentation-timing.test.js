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
    battlePresentationRate, battlePresentationDelay, advanceBattlePresentation,
    battlePresentationRows };`)();
const catalog = g.PATH_KEYS.flatMap(key => g.tierFor(key, 8).abilities
  .filter(spec => spec.type === 'active').map(spec => ({ key, spec })));
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { g.bindBattle(null); }
}
function playing(row) { return { turnRows: [row], currentTurn: 0, eventCount: null }; }
function resolve(key, spec) {
  const w = world(key, 8);
  w.u.hp -= 1000;
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
    assert.equal(api.isReadableAbility({ abilityId: passive.effectId }), false);
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

test('Sequence 8 outcomes retain their existing short reading phases instead of inheriting Sequence 9 holds', () => {
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
  for (const abilityId of ['exploit_loophole', 'combat_theft', 'healing_touch']) {
    const old = playing({ type: 'turn', abilityId, timeline: [note, damage] });
    api.advanceBattlePresentation(old); api.advanceBattlePresentation(old);
    assert.equal(api.battlePresentationDelay(old, 1), 400, abilityId + ' retains its established outcome hold');
    api.advanceBattlePresentation(old);
    assert.equal(api.battlePresentationDelay(old, 1), 400);
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

test('periodic damage and unrelated empty rows do not acquire a new ability cast', () => {
  const dot = { type: 'damage', event: { type: 'damage', isDot: true, hpLoss: 2 } };
  const p = playing({ type: 'turn', abilityId: 'madness_curse', timeline: [dot] });
  assert.equal(api.advanceBattlePresentation(p).type, 'damage');
  assert.equal(api.battlePresentationRate(p, 2), 2);
  const plain = playing({ type: 'turn', abilityId: 'unrelated_action', timeline: [] });
  assert.equal(api.battlePresentationDelay(plain, 1), 1000);
  assert.equal(api.advanceBattlePresentation(plain).type, 'row');
  assert.equal(plain.currentTurn, 1);
});

test('ordinary attacks and Brutal Strike keep their original cast duration at every speed', () => {
  for (const abilityId of ['basic_attack', 'brutal_strike']) for (const speed of [.5, 1, 2, 4]) {
    const p = playing({ type: 'turn', abilityId, timeline: [{ type: 'damage', event: { type: 'damage' } }] });
    api.advanceBattlePresentation(p);
    assert.equal(api.battlePresentationDelay(p, speed), 300 / speed);
    assert.equal(api.battlePresentationRate(p, speed), speed);
  }
});

console.log(`\nSequence 8 presentation timing: ${passed} passed; ${failed} failed.`);
if (failed) process.exitCode = 1;
