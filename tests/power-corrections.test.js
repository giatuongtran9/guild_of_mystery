'use strict';
// Real-cast regressions for category alignment and explicit power corrections.
const fs = require('node:fs');
const path = require('node:path');
const {g, assert, world} = require('./phase3-test-helpers');
require('./mechanics-fixture')(g);
const root = path.join(__dirname, '..');
const authored = Object.fromEntries(g.PATH_KEYS.map(key => [key, JSON.parse(fs.readFileSync(path.join(root, 'data/pathways', key + '.json'), 'utf8'))]));
const expectedFormula = {Physical:'empowered_hybrid_physical', Agility:'empowered_hybrid_agility', Caster:'pure_caster_ability'};
const near = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} vs ${expected}`);
const clone = value => JSON.parse(JSON.stringify(value));
const native = (key, sequence) => g.tierFor(key, sequence).abilities[0];
let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); } }
function cast(w, spell) { return g.applyStructuredAbility(w.a, w.u, w.v, w.state, [], () => .99, spell); }

check('all native direct skills use their source category; explicit component attacks retain their authored sum', () => {
  let ordinary = 0, components = 0;
  for (const [key, source] of Object.entries(authored)) for (const tier of source.sequences) {
    const ability = tier.ability, spell = native(key, tier.sequence);
    if (ability.kind !== 'active' || !(ability.scale > 0)) continue;
    if ((ability.effects || []).some(effect => effect.type === 'damage_component')) {
      components++;
      assert.equal(spell.damage.scaling, ability.stat);
      assert.deepEqual(spell.damage.components, ability.effects.filter(effect => effect.type === 'damage_component').map(effect => ({stat:effect.stat, multiplier:effect.multiplier})));
    } else {
      ordinary++;
      assert.equal(spell.damage.formula, expectedFormula[source.archetype], key + ' Sequence ' + tier.sequence);
    }
    assert.equal(spell.damage.multiplier, ability.scale, 'normalization does not silently change coefficients');
  }
  assert.equal(ordinary, 113);
  assert.equal(components, 6);
});

check('Death and Darkness casts use their category offense instead of the weaker INT-only basis', () => {
  for (const [key, sequence, atkWeight, intWeight] of [['death', 8, 1.05, .30], ['darkness', 8, .85, .55]]) {
    const w = world(key, sequence), spell = native(key, sequence), before = clone(spell);
    assert(cast(w, spell));
    const trace = w.state.balanceTrace.find(entry => entry.abilityId === spell.effectId);
    const pm = g.passiveCombatModifier(w.a);
    near(trace.raw, (w.a.stats.atk * pm.atk * atkWeight + w.a.stats.int * pm.int * intWeight) * spell.damage.multiplier, key + ' raw offense');
    assert.deepEqual(spell, before, 'casting never mutates the source skill');
    assert(w.state.events.some(event => event.type === 'damage' && event.actorId === w.u.id));
  }
});

check('a retained Agility soul keeps its source formula when invoked by a Physical owner', () => {
  const w = world('hanged_man', 5);
  g.initializePathwayBattle(w.state, {id:'fixture', kind:'contract', name:'Fixture', difficultySequence:5}, 17, {day:1});
  const asset = g.newPathwayAsset(w.u, w.state, {kind:'soul', sourcePath:'darkness', sequence:8, abilityId:'midnight_requiem', sourceId:'old-victim'});
  assert(g.addPathwayAsset(w.u, w.state, asset, []));
  g.setMeterValue(w.a, 'hanged_man', 100);
  const spell = g.pathwayAssetAbilities(w.a, w.u, w.state).find(spec => spec._assetId === asset.id);
  assert.equal(spell.damage.formula, 'empowered_hybrid_agility');
  assert(cast(w, spell));
  const trace = w.state.balanceTrace.find(entry => entry.abilityId === spell.effectId);
  const pm = g.passiveCombatModifier(w.a);
  near(trace.raw, (w.a.stats.atk * pm.atk * .85 + w.a.stats.int * pm.int * .55) * spell.damage.multiplier, 'borrowed source-category offense');
  assert.equal(w.a.pathwayInventory.assets.length, 1, 'a soul is retained after invocation');
});

check('Courageous Song improves Sun INT while preserving DEF and Fear immunity', () => {
  const w = world('sun', 9), before = clone(w.a.stats), modifier = g.passiveCombatModifier(w.a);
  near(modifier.int, 1.12, 'Sun INT passive');
  near(modifier.atk, 1, 'unused ATK compensation removed');
  near(modifier.def, 1.12, 'Sun DEF preserved');
  assert(modifier.immunities.includes('fear'));
  assert.deepEqual(w.a.stats, before, 'passives do not rewrite saved stats');
  assert(g.abilityDescription(native('sun', 9), 'sun', 9).includes('+12% INT'));
});

check('Deterrent Aura adds Psychic resistance while retaining default Piercing resistance', () => {
  const w = world('justiciar', 9), resistances = g.combatResistances(w.a);
  assert.equal(resistances.psychic, 10);
  assert.equal(resistances.piercing, 15);
  const shielded = g.v15Damage('pure_caster_ability', {agent:w.b, actor:w.v, target:w.u, damageSpec:{scaling:'INT', type:'elemental', element:'psychic'}, abilityMult:1});
  const bare = g.v15Damage('pure_caster_ability', {agent:w.b, actor:w.v, target:{...w.u, resistances:{...resistances, psychic:0}}, damageSpec:{scaling:'INT', type:'elemental', element:'psychic'}, abilityMult:1});
  assert(shielded < bare, 'Psychic resistance reduces actual Psychic damage');
});

check('Executioner Stance is offensive preparation rather than a survival-tagged defense', () => {
  assert.equal(native('justiciar', 2).tag, null);
  const effects = native('justiciar', 2).effects;
  assert(effects.some(effect => effect.type === 'buff' && effect.stat === 'atk' && effect.amount === .25));
  assert(effects.some(effect => effect.type === 'defense_penetration' && effect.amount === .30));
});

check('Origin of Life heals only once while subsequent casts retain their damage', () => {
  const w = world('mother', 0), spell = native('mother', 0);
  w.u.hp = Math.round(w.u.maxHp * .6);
  assert(cast(w, spell));
  assert.equal(w.u.hp, w.u.maxHp, 'first cast restores HP');
  w.u.hp = Math.round(w.u.maxHp * .6); w.a.cooldowns.origin_of_life = 0;
  const before = w.u.hp, events = w.state.events.length, targetHP = w.v.hp;
  assert(cast(w, spell));
  assert.equal(w.u.hp, before, 'repeated cast does not heal');
  assert(w.v.hp < targetHP, 'repeat retains offensive effect');
  assert(!w.state.events.slice(events).some(event => event.type === 'heal' && event.actorId === w.u.id));
});

check('Sun corruption vulnerability recognizes explicit undead without labeling every Death-path human', () => {
  for (const [marker, qualifies] of [[null, false], [{undead:true}, true], [{creatureType:'undead'}, true], [{tags:['undead']}, true], [{corruption:10}, true]]) {
    const w = world('sun', 5);
    Object.assign(w.b, {path:'death', awakened:true}, marker || {});
    Object.assign(w.v, marker || {});
    assert(cast(w, native('sun', 5)));
    assert.equal(w.v._vulnerability || 1, qualifies ? 1.4 : 1, JSON.stringify(marker));
  }
});

check('Notarize describes immediate dispel and Paragon meter describes automatic devices', () => {
  const text = g.abilityDescription(native('sun', 6), 'sun', 6);
  assert(/current stat buffs/i.test(text));
  assert(!/next stat buff/i.test(text));
  const meter = authored.paragon.meter;
  assert(/Alchemical Fire/.test(meter.full));
  assert(/shield/.test(meter.full));
  assert(!/Deploy or renew/.test(meter.full));
});

console.log(`Power corrections: ${passed} passed; ${failed} failed.`);
if (failed) process.exitCode = 1;
