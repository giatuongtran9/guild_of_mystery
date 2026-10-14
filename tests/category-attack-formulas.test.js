'use strict';
const assert = require('node:assert/strict');
const g = require('../js/node-loader');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
}
function fixture(path, sequence = 9) {
  const a = g.makeAgent(() => .5, { path, sequence, trait: 'Stout Vitality' });
  a.stats = { hp: 100000, atk: 100, def: 100, int: 400 };
  a.sp = a.maxSP = 10000; a.weaponId = 'none'; a.weaponMastery = {};
  const u = { id: a.id, name: a.name, path, sequence, agent: a, hp: 100000,
    maxHp: 100000, alive: true, status: [], statusMeta: {}, resistances: {} };
  return { a, u };
}
function damage(w, options = {}) {
  const target = fixture(w.a.path, w.a.sequence).u, trace = {};
  g.v15Damage('basic_physical_attack', { agent: w.a, actor: w.u, target, trace, ...options });
  return trace;
}
function close(actual, expected, message) {
  assert(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} vs ${expected}`);
}

for (const [path, raw] of [['tyrant', 100], ['darkness', 215], ['door', 320]]) {
  test(path + ' real basic strike uses its category with unequal ATK and INT', () => {
    const w = fixture(path), trace = damage(w);
    close(trace.raw, raw, 'category offensive basis');
    assert.equal(trace.final, Math.round(raw - 50), 'DEF remains independent of offensive category');
  });
}
for (const [path, raw] of [['tyrant', 129.6], ['darkness', 170.7], ['door', 168]]) {
  test(path + ' scales each category term with its own buff and debuff', () => {
    const w = fixture(path);
    w.a._buffs = { atk: 1.5, int: 2 };
    w.u._debuffs = { atk: .8, int: .25 };
    w.u.status = ['inspired'];
    close(damage(w).raw, raw, 'separately modified ATK and INT terms');
  });
}
test('weapon, strike and outgoing bonuses each apply once after category power', () => {
  const w = fixture('darkness');
  w.a._outgoingMultiplier = w.u._outgoingMultiplier = .7;
  w.a._teamDamageMultiplier = .8; w.u._formBoost = 1.2;
  close(damage(w, { weaponBonus: 20, strikeMult: 1.5 }).raw,
    (215 + 20) * 1.5 * .7 * .8 * 1.2, 'ordered category/weapon and outgoing bonuses');
});
test('stolen ATK enters only the ATK part of each category', () => {
  for (const [path, raw] of [['tyrant', 140], ['darkness', 245], ['door', 320]]) {
    const w = fixture(path); w.a._stolenAtk = 40;
    close(damage(w).raw, raw, path + ' stolen ATK');
  }
});
test('ordinary units with no pathway retain ATK basic scaling', () => {
  const w = fixture('tyrant'); w.a.path = null; w.a.awakened = false;
  close(damage(w).raw, 100, 'ordinary ATK basis');
});
test('legacy INT fallback cannot replace category basic scaling', () => {
  const saved = g.GLOBAL_COMBAT.intBasicFloor;
  try {
    g.GLOBAL_COMBAT.intBasicFloor = 10;
    close(damage(fixture('tyrant')).raw, 100, 'Physical stays ATK');
    close(damage(fixture('door')).raw, 320, 'Caster uses 80% INT');
  } finally { g.GLOBAL_COMBAT.intBasicFloor = saved; }
});
test('explicit retaliation basic specs retain their declared stat', () => {
  const w = fixture('door');
  close(damage(w, { damageSpec: { formula: 'basic_physical_attack', scaling: 'ATK' } }).raw,
    100, 'ATK-authored retaliation');
  close(damage(w, { damageSpec: { formula: 'basic_physical_attack', scaling: 'INT' } }).raw,
    400, 'INT-authored retaliation');
});
test('companions inherit their pathway category without changing their stats', () => {
  for (const [path, raw] of [['tyrant', 100], ['darkness', 215], ['door', 320]]) {
    const w = fixture(path), before = structuredClone(w.a.stats);
    w.a.awakened = false; w.u.summoned = true;
    close(damage(w).raw, raw, path + ' vessel attack category');
    assert.deepEqual(w.a.stats, before, 'damage must not rewrite captured/vessel stats');
  }
});
test('explicit additive damage components remain additive rather than reclassified', () => {
  const w = fixture('darkness'), target = fixture('darkness').u, trace = {};
  const spec = { formula: 'empowered_hybrid_physical', scaling: 'ATK',
    multiplier: 1.4, components: [{ stat: 'INT', multiplier: .3 }], type: 'physical' };
  g.v15Damage(spec.formula, { agent: w.a, actor: w.u, target,
    abilityMult: 1.4, damageSpec: spec, trace });
  close(trace.raw, 100 * 1.4 + 400 * .3, '140% ATK + 30% INT stays explicit');
});
test('paid abilities retain their three stronger bases independently of owner category', () => {
  const w = fixture('door'), target = fixture('door').u;
  for (const [formula, raw] of [['empowered_hybrid_physical', 225],
    ['empowered_hybrid_agility', 305], ['pure_caster_ability', 400]]) {
    const trace = {};
    g.v15Damage(formula, { agent: w.a, actor: w.u, target,
      abilityMult: 1, damageSpec: { formula, scaling: 'INT', type: 'true' }, trace });
    close(trace.raw, raw, formula + ' source power');
    assert.equal(trace.final, raw, 'true damage preserves basis but ignores mitigation');
  }
});
test('a stolen physical ability uses its source formula and learner stats', () => {
  const w = fixture('error'), source = { type: 'active', effectId: 'observed_physical',
    name: 'Observed physical ability', costSP: 17, cooldown: 2, effects: [],
    damage: { formula: 'empowered_hybrid_physical', scaling: 'ATK', multiplier: 1.5, type: 'true' } };
  const original = structuredClone(source);
  w.a._signatureBorrowed = { spec: source, sourceId: 'source_with_different_stats', sequence: 9 };
  const copied = g.signatureBorrowedAbilities(w.a).find(s => s._signatureOwned === 'error');
  assert(copied); assert.equal(copied.damage.formula, 'empowered_hybrid_physical');
  const target = fixture('error').u, trace = {};
  g.v15Damage(copied.damage.formula, { agent: w.a, actor: w.u, target,
    abilityMult: copied.damage.multiplier, damageSpec: copied.damage, trace });
  close(trace.raw, (100 * 1.05 + 400 * .30) * 1.5, 'source formula on learner stats');
  assert.equal(copied.costSP, 17); assert.equal(copied.cooldown, 2);
  assert.deepEqual(source, original, 'copy evaluation must not mutate canonical source');
});
test('a retained caster soul keeps INT scaling when prepared by Hanged Man', () => {
  const w = fixture('hanged_man', 5);
  const asset = { id: 'caster_soul', kind: 'soul', condition: 'ready', sourcePath: 'sun',
    sequence: 8, abilityId: 'holy_flash', sourceId: 'sun_victim' };
  w.a.pathwayInventory = { version: 1, assets: [asset], prepared: [asset.id],
    policy: 'auto', progress: { contracts: 0, hypnosis: 0 } };
  g.setMeterValue(w.a, 'hanged_man', 100);
  const state = { allies: [w.u], enemies: [], events: [], currentRound: 1 };
  const soul = g.pathwayAssetAbilities(w.a, w.u, state).find(s => s._assetId === asset.id);
  assert(soul); assert.equal(soul.damage.formula, 'pure_caster_ability');
  const target = fixture('hanged_man', 5).u, trace = {};
  g.v15Damage(soul.damage.formula, { agent: w.a, actor: w.u, target,
    abilityMult: soul.damage.multiplier, damageSpec: soul.damage, trace });
  close(trace.raw, 400 * g.passiveCombatModifier(w.a).int * soul.damage.multiplier,
    'soul uses learner INT, not Physical category power');
});
console.log(`Category attack formulas: ${passed} passed; ${failed} failed.`);
if (failed) process.exitCode = 1;
