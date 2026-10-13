// Focused regression tests for the approved Phase 4 audit fixes.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.PHASE3_GAME_ROOT || path.join(__dirname, '..');
const g = require(path.join(root, 'js/node-loader.js'));
require('./mechanics-fixture')(g);
const {world} = require('./phase3-test-helpers.js');
const high = () => .99;
const shipped = (key, rank) => g.tierFor(key, rank).abilities[0];
const cast = (w, spec, actor = w.u, victim = w.v, lines = []) => g.applyStructuredAbility(actor.agent, actor, victim, w.state, lines, high, spec);
const meter = unit => g.getMeterValue(unit.agent, unit.agent.path);
const setMeter = (unit, value) => g.changeMeter(unit.agent, unit.agent.path, value - meter(unit));
let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`# PASS ${name}`); } catch (error) { failures++; console.log(`# FAIL ${name}: ${error.message}`); }
}

test('Abyss Desire outlasts Corrupted Flesh cooldown', () => {
  const w = world('abyss', 5), spec = shipped('abyss', 5);
  cast(w, spec);
  const effect = spec.effects.find(e => e.type === 'signature');
  assert.equal(effect.duration, 5);
  assert.equal(w.v._signatureDesire.turns, 5);
  assert((spec.cooldown + 1) < w.v._signatureDesire.turns + 1, 'mark must still exist when the skill is ready again');
});

test('Calamity backlash uses the caster INT and is free to cast', () => {
  const lossFor = victimInt => {
    const w = world('wheel_of_fortune', 6);
    cast(w, shipped('wheel_of_fortune', 6));
    assert(w.v._signatureCalamity, 'victim is marked');
    g.getCombatAgent(w.v).stats.int = victimInt;
    const before = w.v.hp;
    g.attackHit(g.getCombatAgent(w.v), w.v, w.u, w.state, [], high, {forcedMiss: true});
    return before - w.v.hp;
  };
  const a = lossFor(50), b = lossFor(900);
  assert(a > 0, 'backlash happened');
  assert.equal(a, b, 'victim INT must not change the backlash');
  const effect = shipped('wheel_of_fortune', 6).effects.find(e => e.type === 'signature');
  assert.equal(effect.chargeCost, undefined);
});

test('Parasite: normal cast moves one parasite, charged Contagion spreads to every foe', () => {
  const w = world('error', 4);
  setMeter(w.u, 0);
  cast(w, shipped('error', 4));
  assert.equal(w.v._signatureParasites.length, 1);
  assert.equal((w.other._signatureParasites || []).length, 0);
  assert.equal(w.u._signatureParasite.turns, 2);
  setMeter(w.u, 100);
  cast(w, shipped('error', 4));
  assert.equal(w.v._signatureParasites.length, 1, 'existing parasite refreshed, not duplicated');
  assert.equal(w.other._signatureParasites.length, 1);
  assert(meter(w.u) < 100, 'Contagion spent the charge');
  assert.equal(w.u._signatureParasite.hostId, w.v.id, 'primary host is the cast target');
});

test('Parasite: Contagion against a lone enemy drains 50% more', () => {
  const w = world('error', 4);
  w.other.alive = false;
  setMeter(w.u, 100);
  cast(w, shipped('error', 4));
  const base = (shipped('error', 4).effects.find(e => e.type === 'signature').drain ?? 20);
  assert.equal(w.v._signatureParasites[0].drain, Math.round(base * 1.5));
});

test('Parasite uses one shared timer that removes every host entry', () => {
  const w = world('error', 4);
  setMeter(w.u, 100);
  cast(w, shipped('error', 4));
  for (let i = 0; i < 4 && w.u._signatureParasite; i++) g.signatureTurnEnd(w.u, w.state, [], high);
  assert(!w.u._signatureParasite, 'owner timer expired');
  assert.equal(w.v._signatureParasites.length, 0);
  assert.equal(w.other._signatureParasites.length, 0);
});

test('Rewind keeps buffs and clears debuffs only with a full meter (Perfect Loop)', () => {
  const build = charge => {
    const w = world('wheel_of_fortune', 2);
    w.state.currentRound = 4;
    w.u._signatureHistory = [{round: 1, hp: w.u.maxHp, fx: [{cat: 'buff', key: 'atk', val: 1.2, rounds: 2}, {cat: 'debuff', key: 'def', val: .8, rounds: 2}]}];
    w.u._fx = [{cat: 'buff', key: 'int', val: 1.3, rounds: 2}, {cat: 'debuff', key: 'atk', val: .7, rounds: 2}];
    g.addStatus(w.u, 'curse', 2, 'fixture');
    setMeter(w.u, charge);
    cast(w, shipped('wheel_of_fortune', 2), w.u, w.v);
    return w;
  };
  const perfect = build(100), plain = build(0);
  const keys = unit => unit._fx.map(f => `${f.cat}:${f.key}`).sort();
  assert.deepEqual(keys(perfect.u), ['buff:atk', 'buff:int']);
  assert(!g.hasStatus(perfect.u, 'curse'));
  assert(meter(perfect.u) < 100);
  assert.deepEqual(keys(plain.u), ['buff:atk', 'debuff:def']);
});

test('Sun cleanse emits an event that earns its gain without damage or healing', () => {
  const w = world('sun', 7);
  g.addStatus(w.u, 'burn', 2, 'fixture');
  setMeter(w.u, 0);
  const spec = {id: 'test_cleanse', effectId: 'test_cleanse', type: 'active', name: 'Cleanse', spCost: 0, effects: [{type: 'cleanse'}]};
  cast(w, spec, w.u, w.v);
  assert(w.state.events.some(ev => ev.type === 'status' && /cleanses/.test(ev.text)), 'cleanse event emitted');
});

test('Demoness gains only from a real Curse tick', () => {
  const w = world('demoness', 5);
  g.addStatus(w.v, 'curse', 2, w.u.name);
  const gain = (hpLoss, opt) => { setMeter(w.u, 0); w.u.agent._signatureGainRound = 0; g.signatureAfterDamage(w.u, w.v, {hpLoss, absorbed: 0}, w.state, [], high, opt); return meter(w.u); };
  assert.equal(gain(0, {indirect: true, dotStatus: 'curse'}), 0, 'zero damage tick');
  assert.equal(gain(30, {indirect: true, dotStatus: 'burn'}), 0, 'other indirect damage');
  assert(gain(30, {indirect: true, dotStatus: 'curse'}) > 0, 'real Curse tick');
});

test('Black Emperor gains Authority from a successful bribe', () => {
  const w = world('black_emperor', 7);
  setMeter(w.u, 0);
  cast(w, shipped('black_emperor', 7));
  assert.equal(meter(w.u), 10);
});

test('Darkness: Sleep gives a setup bonus and Nightmare needs an already sleeping foe', () => {
  const w = world('darkness', 6);
  setMeter(w.u, 100);
  const hp = w.v.hp;
  cast(w, shipped('darkness', 6));
  assert(g.hasStatus(w.v, 'sleep'), 'sleep applied');
  assert(w.v.hp<hp,'the new direct attack damages the target');assert(!w.state.events.some(e=>e.type==='damage'&&e.isSignature),'Nightmare still waits for an already sleeping target');
  assert.equal(meter(w.u), 100, 'charge kept (setup bonus is capped at the maximum)');
  cast(w, shipped('darkness', 6));
  assert(w.v.hp < hp, 'second cast on a sleeping foe spends charge and deals damage');
  assert(meter(w.u) < 100);
});

test('Red Priest Seq4 grants the authored +30% DEF', () => {
  const w = world('red_priest', 4);
  cast(w, shipped('red_priest', 4), w.u, w.v);
  assert(w.u._fx.some(f => f.cat === 'buff' && f.key === 'def' && Math.abs(f.val - 1.3) < 1e-9));
});

test('Snake of Mercury still damages and grants a 2-turn 10% lethal-hit revive', () => {
  const w = world('wheel_of_fortune', 1);
  const spec = shipped('wheel_of_fortune', 1), hp = w.v.hp;
  cast(w, spec);
  assert(w.v.hp < hp, 'still deals damage');
  assert.equal(w.u._fateSkin.turns, 2);
  w.u.hp = 0;
  const result = g.settleFatalDamage(w.u, w.state, [], w.v);
  assert(w.u.alive && result.revived);
  assert.equal(w.u.hp, Math.round(w.u.maxHp * .1));
  assert(!w.u._fateSkin);
});

test('Crowd-controlled units cannot dodge or evade', () => {
  const w = world('door', 6);
  g.addStatus(w.v, 'evade', 2, 'fixture', {dodgeRate: 1});
  assert.equal(g.attackHit(g.getCombatAgent(w.u), w.u, w.v, w.state, [], high), false, 'evade blocks a normal target');
  g.addStatus(w.v, 'stunned', 2, 'fixture');
  assert.equal(g.attackHit(g.getCombatAgent(w.u), w.u, w.v, w.state, [], high), true, 'stunned target cannot evade');
});

test('Fortune gains meter from a dodge', () => {
  const w = world('wheel_of_fortune', 7);
  g.addStatus(w.u, 'evade', 2, 'fixture', {dodgeRate: 1});
  setMeter(w.u, 0);
  w.u.agent._signatureGainRound = 0;
  g.attackHit(g.getCombatAgent(w.v), w.v, w.u, w.state, [], high);
  assert(meter(w.u) > 0);
});

test('status_pool rolls are logged and Evade shows its dodge percentage', () => {
  const w = world('door', 6), lines = [];
  cast(w, {id: 'pool', effectId: 'pool', type: 'active', name: 'Pool', spCost: 0, effects: [{type: 'status_pool', statuses: ['stunned'], chance: 1, duration: 1}]}, w.u, w.v, lines);
  assert(lines.some(l => /afflicted with stunned/.test(l.text)), 'pool status logged');
  assert(w.state.events.some(ev => /afflicted with stunned/.test(ev.text || '')));
  cast(w, {id: 'ev', effectId: 'ev', type: 'active', name: 'Ev', spCost: 0, effects: [{type: 'status', status: 'evade', chance: 1, duration: 1, dodgeRate: .5}]}, w.u, w.v);
  assert(w.state.events.some(ev => /evade \(1 turn, 50% dodge\)/.test(ev.text || '')));
});

test('Silence no longer interrupts Thread Binding', () => {
  const source = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  const body = source.slice(source.indexOf('function hasThreadCC'), source.indexOf('function threadUsage'));
  assert(!body.includes('silenced'));
  assert(body.includes('stunned'));
});

if (failures) { console.log(`# fail ${failures}`); process.exit(1); }
console.log('# pass all');
