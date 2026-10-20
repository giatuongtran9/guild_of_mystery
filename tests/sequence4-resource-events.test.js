'use strict';
const assert = require('node:assert/strict');
const game = require('../js/node-loader');
let passed = 0, failed = 0;
function fixture(path, count = 1) {
  const make = (id, pathway) => {
    const agent = game.makeAgent(() => .5, { path: pathway, sequence: 4, trait: 'Stout Vitality' });
    Object.assign(agent, { id, name: id, path: pathway, sequence: 4, awakened: true });
    game.restatAgent(agent); agent.sp = game.maxSPFor(agent);
    const unit = game.makeCombatUnit(agent); unit._formUsed = unit.agent._formUsed = true;
    return unit;
  };
  const actor = make('owner', path), enemies = Array.from({ length: count }, (_, i) => make('host_' + i, 'tyrant'));
  for (const target of enemies) { target.maxHp *= 10; target.hp = target.maxHp; }
  const state = { allies: [actor], enemies, events: [], balanceTrace: [], weaponUsage: {}, currentRound: 3, currentTurn: 1,
    rng: () => .8, createdMarionettes: [], battleMarionettes: [] };
  const lines = [], spec = structuredClone(game.tierFor(path, 4).abilities[0]);
  game.bindBattle(state, lines); game.setMeterValue(actor.agent, path, 100);
  const cast = () => assert.equal(game.applyStructuredAbility(actor.agent, actor, enemies[0], state, lines, state.rng, spec), true);
  return { actor, enemies, state, lines, spec, cast };
}
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { game.bindBattle(null, null); }
}
const siphons = state => state.events.filter(event => event.subtype === 'sp_siphon');
const ticks = state => state.events.filter(event => event.subtype === 'parasite_tick');

test('Moon records each actual SP drain and allocates only the caster\'s capped recovery', () => {
  const f = fixture('moon', 3), beforeRules = JSON.stringify(game.PATHS), beforeHP = f.actor.hp;
  const beforeSP = f.actor.agent.sp, victimSP = f.enemies.map(unit => unit.agent.sp);
  f.cast();
  const events = siphons(f.state); assert.equal(events.length, 3);
  const cost = f.state.events.find(event => event.type === 'cast').costSP;
  let gainBudget = f.actor.agent.sp - (beforeSP - cost);
  for (let i = 0; i < events.length; i++) {
    const event = events[i], target = f.enemies[i], drained = victimSP[i] - target.agent.sp;
    assert.equal(event.type, 'status'); assert.equal(event.actorId, f.actor.id); assert.equal(event.targetId, target.id);
    assert.equal(event.sourceAbilityId, 'scarlet_blood_domain'); assert.equal(event.amount, drained);
    assert.equal(event.spGain, Math.min(gainBudget, drained)); gainBudget -= event.spGain;
    assert(event.amount > 0); assert.equal(target.sp, target.agent.sp);
  }
  assert.equal(gainBudget, 0); assert.equal(f.actor.hp, beforeHP, 'SP siphon cannot fabricate HP recovery');
  assert.equal(f.actor.sp, f.actor.agent.sp); assert.equal(JSON.stringify(game.PATHS), beforeRules);
});

test('Moon emits no recovery presentation when targets have no SP', () => {
  const f = fixture('moon', 3); for (const target of f.enemies) target.sp = target.agent.sp = 0;
  const before = f.actor.agent.sp; f.cast();
  assert.equal(siphons(f.state).length, 0);
  assert.equal(f.actor.agent.sp, before - f.state.events.find(event => event.type === 'cast').costSP);
});

test('Moon metadata preserves source identity for a prefixed owned ability', () => {
  const f = fixture('moon'); f.spec.effectId = 'stored:scarlet_blood_domain'; f.cast();
  assert.equal(siphons(f.state)[0].sourceAbilityId, 'scarlet_blood_domain');
});

test('Error parasite records later host drains with actual capped SP and HP recovery', () => {
  const f = fixture('error'), beforeRules = JSON.stringify(game.PATHS);
  f.actor.hp = Math.floor(f.actor.maxHp / 2); f.cast();
  assert.equal(ticks(f.state).length, 0, 'attachment does not invent an immediate drain');
  f.state.events.length = 0; f.state.currentRound = 4;
  const beforeSP = f.actor.agent.sp, beforeHP = f.actor.hp, hostBefore = f.enemies[0].agent.sp;
  game.signatureTurnStart(f.enemies[0], f.state, f.lines, f.state.rng);
  const event = ticks(f.state)[0]; assert(event);
  assert.equal(event.type, 'status'); assert.equal(event.sourceAbilityId, 'parasitic_contagion');
  assert.equal(event.actorId, f.actor.id); assert.equal(event.targetId, f.enemies[0].id);
  assert.equal(event.amount, hostBefore - f.enemies[0].agent.sp);
  assert.equal(event.spGain, f.actor.agent.sp - beforeSP);
  assert.equal(event.text, `owner's parasite siphons ${event.amount} SP from host_0.`);
  const heal = f.state.events.find(value => value.type === 'heal'); assert(heal);
  assert.equal(heal.amount, f.actor.hp - beforeHP); assert(heal.amount <= Math.floor(f.actor.maxHp * .04));
  assert.equal(JSON.stringify(game.PATHS), beforeRules);
});

test('Error contagion keeps its existing per-round heal cap across multiple hosts', () => {
  const f = fixture('error', 3); f.actor.hp = Math.floor(f.actor.maxHp / 2); f.cast();
  f.state.events.length = 0; f.state.currentRound = 4;
  const beforeSP = f.actor.agent.sp, beforeHP = f.actor.hp;
  for (const host of f.enemies) game.signatureTurnStart(host, f.state, f.lines, f.state.rng);
  const events = ticks(f.state); assert.equal(events.length, 3);
  assert.equal(events.reduce((sum, event) => sum + event.spGain, 0), f.actor.agent.sp - beforeSP);
  assert(f.actor.hp - beforeHP <= Math.floor(f.actor.maxHp * .04));
});

test('Error zero-SP hosts do not emit a drain or recovery outcome', () => {
  const f = fixture('error'); f.actor.hp = Math.floor(f.actor.maxHp / 2); f.cast();
  f.enemies[0].sp = f.enemies[0].agent.sp = 0; f.state.events.length = 0;
  const hp = f.actor.hp, sp = f.actor.agent.sp;
  game.signatureTurnStart(f.enemies[0], f.state, f.lines, f.state.rng);
  assert.equal(ticks(f.state).length, 0); assert.equal(f.state.events.some(event => event.type === 'heal'), false);
  assert.equal(f.actor.hp, hp); assert.equal(f.actor.agent.sp, sp);
});

test('Healing prohibition blocks parasite HP recovery while SP metadata follows the real drain', () => {
  const f = fixture('error'); f.actor.hp = Math.floor(f.actor.maxHp / 2); f.cast();
  game.addStatus(f.actor, 'no_heal', 2, 'test'); f.state.events.length = 0;
  const hp = f.actor.hp, beforeSP = f.actor.agent.sp;
  game.signatureTurnStart(f.enemies[0], f.state, f.lines, f.state.rng);
  assert.equal(f.actor.hp, hp); assert.equal(f.state.events.some(event => event.type === 'heal'), false);
  assert.equal(ticks(f.state)[0].spGain, f.actor.agent.sp - beforeSP);
});

test('Grouping resource presentation events cannot rewrite the original battle tape', () => {
  const f = fixture('moon', 3); f.cast(); const before = JSON.stringify(f.state.events);
  const grouped = game.groupEventsToRows(f.state.events);
  const notes = grouped.flatMap(round => round.rows).flatMap(row => row.timeline || []).filter(step => step.event.subtype === 'sp_siphon');
  assert.equal(notes.length, 3); assert.equal(JSON.stringify(f.state.events), before);
});

console.log(`Sequence 4 resource presentation: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
