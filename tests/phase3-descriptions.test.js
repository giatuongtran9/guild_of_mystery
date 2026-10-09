// Generated rules must follow live effect data, not authored prose or saved text.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const g = require('../js/node-loader.js');
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`PASS ${name}`); }
  catch (error) { fail++; console.log(`FAIL ${name}: ${error.message}`); }
}
const tier = (key, rank) => g.tierFor(key, rank);
const spec = (key, rank) => tier(key, rank).abilities[0];
const describe = (key, rank) => g.abilityDescription(spec(key, rank), key, rank);
test('218 abilities are generated and two entire Error rules stay deferred', () => {
  for (const key of g.PATH_KEYS) for (let rank = 9; rank >= 0; rank--) {
    const text = describe(key, rank);
    if(g.isPhase3DeferredAbility(spec(key,rank),key)){assert.equal(text,spec(key,rank).text);continue;}
    assert.equal(typeof text, 'string');
    assert(text.length > 10 && !/undefined|NaN/.test(text), `${key} ${rank}: ${text}`);
    assert.equal(spec(key, rank).text, text);
    assert.equal(tier(key, rank).abilityText, text);
    assert.equal(tier(key, rank).ability, text);
  }
});
test('changing authored prose cannot change effect rules', () => {
  const original = spec('fool', 8), changed = structuredClone(original);
  changed.text = 'Paper Card Dagger — Restores all health and wins immediately.';
  assert.equal(g.abilityDescription(changed, 'fool', 8), describe('fool', 8));
});
test('cost, cooldown, stat and penetration come from runtime values', () => {
  const changed = structuredClone(spec('fool', 8));
  Object.assign(changed, {costSP: 17, cooldown: 4});
  changed.damage.multiplier = 1.37;
  changed.effects[0].amount = .13;
  const text = g.abilityDescription(changed, 'fool', 8);
  for (const value of ['17 SP', '4 turns', '137% INT', '13%']) assert(text.includes(value), text);
});
test('numeric duration override wins over shared default', () => {
  const original = spec('fool', 6), changed = structuredClone(original);
  changed.effects[0].duration = 7;
  assert(g.abilityDescription(changed, 'fool', 6).includes('7 turns'));
});
test('next-turn wards disclose expiry and output coefficient', () => {
  const text = describe('fool', 7);
  for (const value of ['50%', '100% INT', 'Fire', 'next turn']) assert(text.includes(value), text);
});
test('intentional hybrid damage shows both configured terms', () => {
  const text = describe('chained', 1);
  assert(text.includes('320%') && text.includes('105% ATK') && text.includes('30% INT'), text);
});
test('component damage discloses independent coefficients', () => {
  const text = describe('tyrant', 8);
  assert(text.includes('30% INT'), text);
});
test('generated text is pure and never changes runtime definitions', () => {
  const before = JSON.stringify(g.PATHS);
  for (const key of g.PATH_KEYS) for (let rank = 9; rank >= 0; rank--) describe(key, rank);
  assert.equal(JSON.stringify(g.PATHS), before);
});
test('UI uses live rules rather than saved learned descriptions', () => {
  const ui = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
  assert(!ui.includes('text:learned?.ability||spec.text'), 'old saves override the shipped ability rules');
  assert(!ui.includes('Math.round((skill.damage.multiplier||0)*100)'), 'dossier repeats misleading pure-stat coefficient');
});
test('mixed elemental casts disclose the four-school resistance average',()=>{const text=describe('door',8);for(const school of ['Fire','Water','Lightning','Frost'])assert(text.includes(school),text);assert(text.includes('average'),text);});
console.log(`Phase 3 descriptions: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
