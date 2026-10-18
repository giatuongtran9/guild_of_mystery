'use strict';
const { g, assert, world } = require('./phase3-test-helpers');
let passed = 0;
function cast(path, sequence, override) {
  const w = world(path, sequence);
  const spec = override || g.tierFor(path, sequence).abilities[0];
  g.bindBattle(w.state, []);
  assert(g.applyStructuredAbility(w.a, w.u, w.v, w.state, [], () => .99, spec));
  return w;
}
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  finally { g.bindBattle(null); }
}
test('every authored active stat buff carries a structured positive result', () => {
  let abilities = 0;
  for (const path of g.PATH_KEYS) for (let sequence = 9; sequence >= 0; sequence--) {
    const spec = g.tierFor(path, sequence).abilities[0];
    if (spec.type !== 'active') continue;
    const buffs = spec.effects.filter(e => e.type === 'buff'
      || e.type === 'stat_modifier' && ['atk', 'def', 'int'].includes(e.stat));
    if (!buffs.length) continue;
    const w = cast(path, sequence);
    const recipients = spec.effects.some(e => e.type === 'targeting' && e.mode === 'all_allies')
      ? [w.u.id, w.ally.id] : [w.u.id];
    const events = w.state.events.filter(event => event.subtype === 'buff');
    assert.equal(events.length, buffs.length * recipients.length, spec.effectId);
    for (const event of events) {
      assert.equal(event.beneficial, true, spec.effectId);
      assert.equal(event.actorId, w.u.id);
      assert(recipients.includes(event.targetId), 'the buff cue follows an actual recipient');
    }
    abilities++;
  }
  assert(abilities >= 15, 'coverage includes buffs outside the former support allowlist');
});
test('self evade is beneficial even though its display text says afflicted', () => {
  const w = cast('fool', 4);
  const event = w.state.events.find(event => event.status === 'evade');
  assert(event); assert.equal(event.beneficial, true);
  assert.equal(event.targetId, w.u.id);
});
test('hostile status effects do not acquire a positive result cue', () => {
  const w = cast('demoness', 7);
  const statuses = w.state.events.filter(event => event.status);
  assert(statuses.length);
  for (const event of statuses) assert.notEqual(event.beneficial, true);
});
test('a negative stat modifier is not labelled as a beneficial result', () => {
  const w = cast('red_priest', 4, { ...g.tierFor('red_priest', 4).abilities[0],
    effects: [{ type: 'stat_modifier', stat: 'def', amount: -.2, duration: 2 }] });
  const event = w.state.events.find(event => event.subtype === 'buff');
  assert(event); assert.equal(event.beneficial, false);
});
test('full-health healing does not invent a successful recovery event', () => {
  const w = cast('hanged_man', 7);
  assert.equal(w.state.events.some(event => event.type === 'heal'), false);
});
test('Wind Step and Mystic Domain expose their actual applied buff before the next action', () => {
  for (const [path, sequence, id, category] of [['tyrant', 7, 'wind_step', 'dodge'],
    ['hermit', 3, 'mystic_domain', 'outgoing']]) {
    const w = cast(path, sequence);
    const event = w.state.events.find(event => event.presentationOnly && event.beneficial);
    assert(event, id + ' records its successful buff');
    assert.equal(event.targetId, w.u.id);
    assert(w.u._fx.some(effect => effect.cat === category), 'the cue follows real applied combat state');
    const rows = g.groupEventsToRows(w.state.events).flatMap(round => round.rows);
    assert(rows.find(row => row.abilityId === id).timeline.some(step => step.event === event));
    const resultIndex = w.state.events.indexOf(event);
    const nextAction = w.state.events.findIndex(entry => entry.type === 'cast' && entry.abilityId === 'basic_attack');
    assert(nextAction < 0 || nextAction > resultIndex, 'the result precedes any utility attack');
  }
});
test('passive lifesteal and Blood Siphon recovery retain distinct presentation causes', () => {
  const passive = world('hanged_man', 0);
  passive.u.hp -= 2000;
  g.bindBattle(passive.state, []);
  g.attackOnce(passive.a, passive.u, passive.v, passive.state, [], () => .99);
  assert.equal(passive.state.events.find(event => event.type === 'heal').recoveryKind, 'lifesteal');
  const active = world('moon', 7);
  active.u.hp -= 2000;
  g.bindBattle(active.state, []);
  g.applyStructuredAbility(active.a, active.u, active.v, active.state, [], () => .99,
    g.tierFor('moon', 7).abilities[0]);
  assert.equal(active.state.events.find(event => event.type === 'heal').recoveryKind, 'ability');
});
console.log(`Support presentation events: ${passed} passed.`);
