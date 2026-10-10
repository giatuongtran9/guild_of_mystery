// Approved signature rules belong to the authored ability data.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'data', 'pathways');
const read = key => JSON.parse(fs.readFileSync(path.join(root, `${key}.json`), 'utf8'));
const keys = read('index').order;
const rank = (key, sequence) => read(key).sequences.find(row => row.sequence === sequence).ability;
const rule = (key, sequence, id) => rank(key, sequence).effects?.find(effect => effect.type === 'signature' && effect.rule === id);
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

test('all 22 pathways declare an ability signature and charge rules', () => {
  assert.equal(keys.length, 22);
  for (const key of keys) {
    const data = read(key);
    assert(data.sequences.some(row => row.ability.effects?.some(effect => effect.type === 'signature')), `${key}: missing signature`);
    assert.equal(data.meter.max, 100);
    assert.equal(data.meter.spendAmount, 100, `${key}: missing charge cost`);
    assert.equal(data.meter.gainAction, 20, `${key}: action charge`);
    assert.equal(data.meter.gainSignature, 10, `${key}: signature charge`);
  }
});
test('Fool binds in five stages and full charge removes resistance without a minimum floor', () => {
  const effect = rule('fool', 5, 'thread_binding');
  assert(effect, 'missing Thread Binding rule');
  assert.equal(effect.chargeCost, 100);
  assert.equal(effect.resistancePenetration, .2);
  assert.equal(effect.resistanceFloor, 0);
  assert.equal(effect.damageBreakThreshold, .3);
  assert.equal(rank('fool', 5).threadStages.length, 5);
  assert(!rank('fool', 5).effects.some(effect => effect.type === 'execute'), 'ordinary execution cannot substitute for thread completion');
});
test('Door records from Sequence 6 and spends charge on full-strength replay', () => {
  const effect = rule('door', 6, 'door_record');
  assert(effect, 'missing owned record rule');
  assert.equal(effect.chargeCost, 100);
  assert.equal(effect.multiplier, 1);
  assert(!rank('door', 6).effects.some(effect => effect.type === 'copy_ability'), 'old immediate copy remains');
});
test('Error ability theft starts at Sequence 6 and parasitism at Sequence 4', () => {
  const effect = rule('error', 6, 'error_theft');
  assert(effect, 'missing theft rule');
  assert.equal(effect.duration, 1);
  assert.equal(effect.uses, 1);
  assert.equal(effect.chargeCost, 100);
  assert(rule('error', 4, 'error_parasite'), 'missing parasite host rule');
  assert.equal(read('error').meter.gainCondition, 'successful_theft_deception');
  assert(!rank('error', 6).effects.some(effect => effect.type === 'steal_stat'), 'old ATK theft substitutes for observed-ability theft');
});
test('Error distortion redirects one paid skill without requiring full charge', () => {
  const ability = rank('error', 5), effect = rule('error', 5, 'error_distortion');
  assert(effect, 'missing paid skill redirection');
  assert.equal(effect.duration, 2);
  assert.equal(effect.uses, 1);
  assert.equal(effect.chargeCost, 0);
  assert.equal(ability.spCost, 45);
  assert.equal(ability.cooldown, 3);
  assert(!ability.effects.some(effect => effect.type === 'mind_control'), 'old immediate attack remains');
});
test('White Tower imitation starts at Polymath and is distinct from Door records', () => {
  assert(rule('white_tower', 6, 'tower_imitation'), 'missing Polymath imitation');
  assert.equal(rank('white_tower', 6).id, 'spell_imitation');
  assert(!rank('white_tower', 8).effects.some(effect => effect.type === 'copy_ability'), 'student already copies spells');
  assert(!read('white_tower').sequences.some(row => row.ability.effects?.some(effect => effect.rule === 'door_record')));
});
test('Death summons a unit and Moon tame beasts before becoming Sanguine', () => {
  assert(rule('death', 7, 'death_summon'), 'missing actual undead summon');
  assert(!rank('death', 7).effects.some(effect => effect.type === 'shield'), 'summon is still a shield substitute');
  assert(rule('moon', 8, 'moon_beast'), 'missing Beast Tamer rule');
  assert(!rank('moon', 8).effects.some(effect => effect.type === 'lifesteal'), 'Beast Tamer has premature vampire claws');
  assert(rule('moon', 7, 'moon_blood'), 'missing Sanguine blood rule');
});
test('Demoness charge cannot overwrite saved harmful corruption', () => {
  assert.equal(read('demoness').meter.key, 'affliction');
  assert.equal(read('demoness').meter.name, 'Affliction');
  assert(rule('demoness', 7, 'demoness_affliction'), 'missing curse-linked affliction rule');
});
test('signature configs use finite numbers and retain all 220 rank identities', () => {
  for (const key of keys) {
    const data = read(key);
    assert.deepEqual(data.sequences.map(row => row.sequence), [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    assert.equal(new Set(data.sequences.map(row => row.ability.id)).size, 10, `${key}: duplicate ability identity`);
    for (const row of data.sequences) for (const effect of row.ability.effects || []) {
      if (effect.type !== 'signature') continue;
      assert(/^[a-z][a-z_]+$/.test(effect.rule), `${key}: invalid signature identity`);
      for (const [name, value] of Object.entries(effect)) if (typeof value === 'number') {
        assert(Number.isFinite(value) && value >= 0, `${key}: invalid ${name}`);
      }
    }
  }
});
console.log(`Phase 4 signature data: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
