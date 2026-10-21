'use strict';
const assert = require('node:assert/strict');
const { g, world } = require('./phase3-test-helpers');
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { g.bindBattle(null); }
}
function cast(path, side = 'allies', prepare = () => {}, decorate = value => value) {
  const f = world(path, 3, side), lines = [], rules = JSON.stringify(g.PATHS);
  f.state.currentRound = 3; f.state.currentTurn = 1; f.state.rng = () => .99;
  f.spec = decorate(structuredClone(g.tierFor(path, 3).abilities[0]));
  prepare(f);
  f.beforeSP = f.a.sp;
  g.bindBattle(f.state, lines);
  assert.equal(g.applyStructuredAbility(f.a, f.u, f.v, f.state, lines, f.state.rng, f.spec), true);
  assert.equal(JSON.stringify(g.PATHS), rules, 'authored pathway rules remain unchanged');
  f.lines = lines;
  return f;
}
const statuses = (f, subtype) => f.state.events.filter(event => event.type === 'status' && event.subtype === subtype);
const opposite = side => side === 'allies' ? 'enemy' : 'ally';
function addressed(f, event, target, side, id) {
  assert.equal(event.actorId, f.u.id); assert.equal(event.actorName, f.u.name);
  assert.equal(event.actorTeam, side === 'allies' ? 'ally' : 'enemy');
  assert.equal(event.targetId, target.id); assert.equal(event.targetName, target.name);
  assert.equal(event.targetTeam, target === f.u ? event.actorTeam : opposite(side));
  assert.equal(event.sourceAbilityId, id); assert.equal(event.sourcePath, f.a.path);
  assert.equal(event.round, 3); assert.equal(typeof event.text, 'string');
}
for (const side of ['allies', 'enemies']) {
  for (const [path, id, chance] of [['black_emperor', 'chaos_field', .3], ['wheel_of_fortune', 'chaos_probability', .4]]) {
    test(path + ' records every actually afflicted enemy on ' + side, () => {
      const f = cast(path, side), events = statuses(f, 'skill_misfire');
      assert.equal(events.length, 2);
      for (const target of [f.v, f.other]) {
        const event = events.find(value => value.targetId === target.id); assert(event);
        addressed(f, event, target, side, id);
        assert.equal(event.beneficial, false); assert.equal(event.chance, chance); assert.equal(event.duration, 2);
        assert.equal(target._skillMisfireChance, chance); assert.equal(target._skillMisfireDuration, 2);
        assert(f.lines.some(line => line.text === event.text), 'event reuses the actual applied-effect text');
      }
      assert.equal(f.u._skillMisfireChance, undefined); assert.equal(f.ally._skillMisfireChance, undefined);
      const casts = f.state.events.filter(event => event.type === 'cast');
      assert.equal(casts[0].abilityId, id); assert.equal(casts[1].abilityId, 'basic_attack', 'utility follow-up remains a separate basic attack');
      assert.equal(f.a.sp, f.beforeSP - casts[0].costSP, 'presentation events do not change actual SP payment');
      const before = JSON.stringify(f.state.events);
      const rows = g.groupEventsToRows(f.state.events).flatMap(round => round.rows);
      const action = rows.find(row => row.abilityId === id);
      assert.equal(action.timeline.filter(step => step.event.subtype === 'skill_misfire').length, 2);
      assert.equal(JSON.stringify(f.state.events), before, 'grouping leaves the native tape immutable');
    });
  }
  test('ineligible group targets receive neither misfire nor false presentation on ' + side, () => {
    const f = cast('black_emperor', side, f => g.addStatus(f.other, 'untargetable', 2, 'test'));
    assert.deepEqual(statuses(f, 'skill_misfire').map(event => event.targetId), [f.v.id]);
    assert.equal(f.other._skillMisfireChance, undefined);
  });
  test('Hermit outgoing damage has one addressed event and keeps the real modifier on ' + side, () => {
    const f = cast('hermit', side), events = statuses(f, 'outgoing_damage'); assert.equal(events.length, 1);
    const event = events[0]; addressed(f, event, f.u, side, 'mystic_domain');
    assert.equal(event.beneficial, true); assert.equal(event.presentationOnly, true);
    assert.equal(event.amount, .2); assert.equal(event.duration, 2);
    assert(f.u._fx.some(effect => effect.cat === 'outgoing' && effect.val === 1.2 && effect.rounds === 2));
    assert.equal(f.state.events.filter(value => value.type === 'status' && /outgoing damage/.test(value.text || '')).length, 1, 'existing outgoing event is enriched rather than duplicated');
  });
  test('Death records the actual debuffs without changing their numbers on ' + side, () => {
    const f = cast('death', side), events = statuses(f, 'debuff'); assert.equal(events.length, 2);
    assert.deepEqual(events.map(event => event.stat), ['def', 'speed']);
    for (const event of events) {
      addressed(f, event, f.v, side, 'underworld_domain');
      assert.equal(event.beneficial, false); assert.equal(event.amount, .2); assert.equal(event.duration, 2);
      assert(f.v._fx.some(effect => effect.key === event.stat && effect.val === .8 && effect.rounds === 2));
    }
    assert.equal(f.other._fx?.some(effect => effect.cat === 'debuff' || effect.cat === 'speed_debuff') || false, false, 'the domain still affects only its actual target');
  });
  for (const [path, id] of [['error', 'deceive_impact'], ['mother', 'flesh_mutation'], ['tyrant', 'thunder_god_stance']]) {
    test(path + ' records a prepared caster ward and only reflects a later real hit on ' + side, () => {
      const f = cast(path, side), events = statuses(f, 'reflect'); assert.equal(events.length, 1);
      const event = events[0]; addressed(f, event, f.u, side, id);
      assert.equal(event.beneficial, true); assert.equal(event.duration, 'next_turn');
      assert.equal(event.mode, f.u._reflect.mode); assert.equal(event.share, f.u._reflect.share);
      assert.equal(event.multiplier, f.u._reflect.multiplier); assert.equal(event.negate, f.u._reflect.negate);
      assert.equal(event.incomingCategory, f.u._reflect.incomingCategory);
      assert.equal(f.u._reflect.sourceAbilityId, id); assert.equal(f.u._reflect.untilTurn, true);
      assert(f.lines.some(line => line.text === event.text));
      assert.equal(f.state.events.some(value => value.isReflect), false, 'preparation does not invent retaliation');
      const before = f.state.events.length, hp = f.u.hp;
      g.resolveIncoming(f.v, f.u, 1000, f.state, f.lines, () => .99, { damageType: 'physical' });
      const reflected = f.state.events.slice(before).filter(value => value.isReflect); assert.equal(reflected.length, 1);
      assert.equal(reflected[0].actorId, f.u.id); assert.equal(reflected[0].targetId, f.v.id);
      assert.equal(reflected[0].sourceAbilityId, id); assert(reflected[0].amount > 0);
      if (path === 'error') assert.equal(f.u.hp, hp, 'Error keeps its actual negation rule');
      else assert(f.u.hp < hp, 'non-negating wards still receive the actual incoming damage');
      assert.equal(statuses(f, 'reflect').length, 1, 'later hit does not duplicate ward setup');
    });
  }
}
test('misfire metadata reports effective nondecreasing runtime chance and duration', () => {
  const f = cast('black_emperor', 'allies', f => { f.v._skillMisfireChance = .8; f.v._skillMisfireDuration = 5; });
  const event = statuses(f, 'skill_misfire').find(value => value.targetId === f.v.id);
  assert(event); assert.equal(event.chance, .8); assert.equal(event.duration, 5);
  assert.equal(f.v._skillMisfireChance, .8); assert.equal(f.v._skillMisfireDuration, 5);
});
for (const [path, subtype, id] of [['black_emperor', 'skill_misfire', 'chaos_field'], ['error', 'reflect', 'deceive_impact'], ['hermit', 'outgoing_damage', 'mystic_domain']]) {
  test(path + ' presentation follows the effective source of a prefixed owned skill', () => {
    const f = cast(path, 'allies', () => {}, spec => ({ ...spec, effectId: 'stored:' + id }));
    const event = statuses(f, subtype)[0]; assert(event); assert.equal(event.sourceAbilityId, id); assert.equal(event.sourcePath, path);
    assert.equal(f.state.events.find(value => value.type === 'cast').abilityId, 'stored:' + id);
  });
}
console.log(`Sequence 3 presentation event regressions: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
