const assert = require('assert');
const g = require('../js/node-loader');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.log(`FAIL ${name}: ${error.message}`); }
}
function fixture(path, sequence = 8) {
  const a = g.makeAgent(() => .5, { path, sequence, trait: 'Stout Vitality' });
  a.id = path; a.name = path; a.stats = { hp: 10000, atk: 200, def: 200, int: 300 };
  a.weaponId = 'none'; a.weaponMastery = {};
  const u = { id: path, name: path, path, sequence, agent: a, hp: 10000, maxHp: 10000,
    atk: 200, def: 200, int: 300, alive: true, status: [], resistances: {} };
  return { a, u };
}
for (const path of ['tyrant', 'hanged_man', 'red_priest']) {
  test(`${path}: separately stated INT component retains its own coefficient`, () => {
    const { a, u } = fixture(path, 4), target = fixture(path, 4).u;
    const spec = g.activeSpecs(a).find(s => s.effects.some(e => e.type === 'damage_component'));
    assert(spec, 'Real ability must contain an explicit damage component');
    const pm = g.passiveCombatModifier(a), trace = {};
    g.v15Damage(spec.damage.formula, { agent: a, actor: u, target,
      abilityMult: spec.damage.multiplier, damageSpec: spec.damage, trace });
    const expected = a.stats.atk * pm.atk * spec.damage.multiplier + spec.damage.components
      .reduce((sum, c) => sum + a.stats.int * pm.int * c.multiplier, 0);
    assert.strictEqual(trace.raw, expected);
  });
}
for (const flag of ['trueDamage', 'psychicTrue']) {
  test(`${flag}: damage bypasses both defense and elemental resistance`, () => {
    const { a, u } = fixture('moon'), target = fixture('moon').u;
    target.resistances = { blood: 90, psychic: 90 }; target.def = target.agent.stats.def = 10000;
    const trace = {};
    const damage = g.v15Damage('pure_caster_ability', { agent: a, actor: u, target,
      abilityMult: 2, [flag]: true,
      damageSpec: { scaling: 'INT', type: 'elemental', element: flag === 'psychicTrue' ? 'psychic' : 'blood' }, trace });
    assert.strictEqual(damage, Math.round(trace.raw));
    assert.strictEqual(trace.resistance, 0); assert.strictEqual(trace.defenseReduction, 0);
    assert.strictEqual(trace.isTrue, true);
  });
}
test('a mirrored timed outgoing modifier affects the damage once', () => {
  const { a, u } = fixture('moon'), target = fixture('moon').u;
  const spec = { scaling: 'INT', type: 'true' }, trace = {};
  a._outgoingMultiplier = u._outgoingMultiplier = .7;
  g.v15Damage('pure_caster_ability', { agent: a, actor: u, target,
    abilityMult: 2, damageSpec: spec, trace });
  assert.strictEqual(trace.raw, a.stats.int * g.passiveCombatModifier(a).int * 2 * .7);
});
test('a timed modifier and contract damage factor each affect the damage once', () => {
  const { a, u } = fixture('moon'), target = fixture('moon').u, trace = {};
  a._teamDamageMultiplier = .8; a._outgoingMultiplier = u._outgoingMultiplier = .7;
  g.v15Damage('pure_caster_ability', { agent: a, actor: u, target,
    abilityMult: 2, damageSpec: { scaling: 'INT', type: 'true' }, trace });
  assert(Math.abs(trace.raw - a.stats.int * g.passiveCombatModifier(a).int * 2 * .7 * .8) < 1e-9);
});
test('a transformed actor fallback basic attack gains its form bonus once', () => {
  const { a, u } = fixture('moon', 4), target = fixture('moon', 4).u;
  a.sp = 0; a._formBoost = u._formBoost = 1.2;
  a.cooldowns = Object.fromEntries(g.activeSpecs(a).map(s => [s.effectId, 99]));
  const state = { allies: [u], enemies: [target], events: [], balanceTrace: [], weaponUsage: {}, currentRound: 1 };
  g.powerEffect(a, u, target, state, [], () => .99);
  const hit = state.balanceTrace.find(t => t.abilityId === 'basic_attack');
  assert(hit, 'Fixture must exercise the real basic fallback');
  assert(Math.abs(hit.raw - a.stats.atk * g.passiveCombatModifier(a).atk * 1.2) < 1e-9);
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
